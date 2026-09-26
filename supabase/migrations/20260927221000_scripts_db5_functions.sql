-- DB-5 (parte 2): Scripts — RPCs, notificações, stats e triggers

CREATE OR REPLACE FUNCTION public.fn_atribuir_numero_referencia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.numero_referencia IS NULL THEN
    SELECT COALESCE(MAX(numero_referencia), 0) + 1
      INTO NEW.numero_referencia
      FROM scripts_customizados;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resetar_curadoria_ao_editar()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Só processa se o conteúdo realmente mudou
  -- e se o script estava curado antes
  IF OLD.curadoria_atuada = TRUE
     AND NEW.curadoria_atuada = TRUE  -- não está sendo desmarcado intencionalmente
     AND OLD.conteudo_bruto IS DISTINCT FROM NEW.conteudo_bruto
     AND NEW.conteudo_bruto IS NOT NULL
  THEN
    -- Reseta a curadoria: conteúdo mudou, precisa re-curar
    NEW.curadoria_atuada := FALSE;
    NEW.modificado_curadoria := FALSE;
    NEW.data_curadoria := NULL;
    NEW.curadoria_por := NULL;
    
    RAISE NOTICE 'Curadoria resetada para script % — conteúdo foi editado após curadoria', OLD.id;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.salvar_conteudo_original_script()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Na criação (INSERT), salva o conteúdo_bruto como conteúdo_original
  IF TG_OP = 'INSERT' THEN
    NEW.conteudo_original = NEW.conteudo_bruto;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marcar_script_para_classificacao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Em INSERT: sempre marcar como pendente
  IF TG_OP = 'INSERT' THEN
    NEW.classificacao_pendente := TRUE;
    RETURN NEW;
  END IF;

  -- Em UPDATE: só marcar se campos relevantes mudaram
  IF TG_OP = 'UPDATE' THEN
    IF (
      NEW.nome IS DISTINCT FROM OLD.nome OR
      NEW.conteudo_bruto IS DISTINCT FROM OLD.conteudo_bruto OR
      NEW.conteudo_atendente IS DISTINCT FROM OLD.conteudo_atendente
    ) THEN
      -- Só marcar pendente se NÃO for uma atualização de classificação
      IF (
        NEW.categoria_equipe_slug IS NOT DISTINCT FROM OLD.categoria_equipe_slug AND
        NEW.subcategoria_gse_slug IS NOT DISTINCT FROM OLD.subcategoria_gse_slug AND
        NEW.classificacao_origem IS NOT DISTINCT FROM OLD.classificacao_origem
      ) THEN
        NEW.classificacao_pendente := TRUE;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_tem_conteudo_atendente()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.tem_conteudo_atendente := (NEW.conteudo_atendente IS NOT NULL AND TRIM(NEW.conteudo_atendente) != '');
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pasta_desativados_id(p_equipe_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_pasta_id UUID;
BEGIN
  SELECT id INTO v_pasta_id
  FROM pastas_scripts
  WHERE equipe_id = p_equipe_id
    AND nome = '🗑️ Desativados'
  LIMIT 1;
  
  -- Se não existe, criar a pasta
  IF v_pasta_id IS NULL THEN
    INSERT INTO pastas_scripts (nome, icone, equipe_id, ordem, pasta_pai_id)
    VALUES ('🗑️ Desativados', '🗑️', p_equipe_id, 9999, NULL)
    RETURNING id INTO v_pasta_id;
  END IF;
  
  RETURN v_pasta_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_notificacao_script(p_destinatario_id uuid, p_script_id uuid, p_tipo text, p_mensagem text, p_proposta_id uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_notif_id UUID;
BEGIN
  INSERT INTO script_notificacoes (
    destinatario_id, script_id, proposta_id, tipo, mensagem, metadata
  ) VALUES (
    p_destinatario_id, p_script_id, p_proposta_id, p_tipo, p_mensagem, p_metadata
  )
  RETURNING id INTO v_notif_id;

  RETURN v_notif_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_proposta_script(p_script_id uuid, p_campo_alvo text, p_conteudo_proposto text, p_motivacao text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_script RECORD;
  v_proposta_id UUID;
BEGIN
  -- Validar script
  SELECT id, email_enviado, deletado, tem_proposta_pendente
  INTO v_script
  FROM scripts_customizados
  WHERE id = p_script_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Script % não encontrado', p_script_id;
  END IF;

  IF v_script.deletado = true THEN
    RAISE EXCEPTION 'Script % está deletado', p_script_id;
  END IF;

  IF v_script.email_enviado = false THEN
    RAISE EXCEPTION 'Script % não está publicado', p_script_id;
  END IF;

  IF v_script.tem_proposta_pendente = true THEN
    RAISE EXCEPTION 'Script % já tem proposta pendente', p_script_id;
  END IF;

  -- Inserir proposta
  INSERT INTO script_propostas_revisao (
    script_id, campo_alvo, conteudo_proposto, motivacao, autor_id, status
  ) VALUES (
    p_script_id, p_campo_alvo, p_conteudo_proposto, p_motivacao, auth.uid(), 'pendente'
  )
  RETURNING id INTO v_proposta_id;

  -- Marcar proposta pendente
  UPDATE scripts_customizados
  SET tem_proposta_pendente = true
  WHERE id = p_script_id;

  RETURN v_proposta_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.aprovar_proposta_script(p_proposta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposta RECORD;
  v_script RECORD;
  v_nova_versao INTEGER;
  v_conteudo_anterior TEXT;
BEGIN
  -- a. Buscar proposta pendente
  SELECT * INTO v_proposta
  FROM script_propostas_revisao
  WHERE id = p_proposta_id AND status = 'pendente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta % não encontrada ou não está pendente', p_proposta_id;
  END IF;

  -- Buscar script
  SELECT id, conteudo_bruto, conteudo_atendente
  INTO v_script
  FROM scripts_customizados
  WHERE id = v_proposta.script_id;

  -- b. Calcular nova versão
  SELECT COALESCE(MAX(numero_versao), 0) + 1
  INTO v_nova_versao
  FROM script_versoes
  WHERE script_id = v_proposta.script_id
    AND campo_alvo = v_proposta.campo_alvo;

  -- c. Capturar conteudo_anterior
  IF v_proposta.campo_alvo = 'usuario_final' THEN
    v_conteudo_anterior := COALESCE(v_script.conteudo_bruto, '');
  ELSE
    v_conteudo_anterior := COALESCE(v_script.conteudo_atendente, '');
  END IF;

  -- d. INSERT versão
  INSERT INTO script_versoes (
    script_id, campo_alvo, numero_versao, conteudo, conteudo_anterior,
    motivacao, tipo_motivacao, autor_id, aprovado_por, revisado_em
  ) VALUES (
    v_proposta.script_id, v_proposta.campo_alvo, v_nova_versao,
    v_proposta.conteudo_proposto, v_conteudo_anterior,
    v_proposta.motivacao, 'proposta_aprovada',
    v_proposta.autor_id, auth.uid(), now()
  );

  -- e. Atualizar scripts_customizados
  ALTER TABLE scripts_customizados DISABLE TRIGGER trigger_resetar_curadoria_ao_editar;

  IF v_proposta.campo_alvo = 'usuario_final' THEN
    UPDATE scripts_customizados
    SET conteudo_bruto = v_proposta.conteudo_proposto,
        curadoria_atuada = true,
        curadoria_por = auth.uid(),
        data_curadoria = now(),
        tem_proposta_pendente = false
    WHERE id = v_proposta.script_id;
  ELSE
    UPDATE scripts_customizados
    SET conteudo_atendente = v_proposta.conteudo_proposto,
        curadoria_atuada = true,
        curadoria_por = auth.uid(),
        data_curadoria = now(),
        tem_proposta_pendente = false
    WHERE id = v_proposta.script_id;
  END IF;

  ALTER TABLE scripts_customizados ENABLE TRIGGER trigger_resetar_curadoria_ao_editar;

  -- f. Atualizar proposta
  UPDATE script_propostas_revisao
  SET status = 'aprovada',
      versao_gerada = v_nova_versao,
      decidido_por = auth.uid(),
      decidido_em = now(),
      atualizado_em = now()
  WHERE id = p_proposta_id;

  RETURN jsonb_build_object(
    'versao', v_nova_versao,
    'script_id', v_proposta.script_id,
    'campo_alvo', v_proposta.campo_alvo,
    'autor_proposta_id', v_proposta.autor_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rejeitar_proposta_script(p_proposta_id uuid, p_razao_rejeicao text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposta RECORD;
BEGIN
  IF char_length(COALESCE(p_razao_rejeicao, '')) < 10 THEN
    RAISE EXCEPTION 'Razão de rejeição deve ter pelo menos 10 caracteres';
  END IF;

  SELECT * INTO v_proposta
  FROM script_propostas_revisao
  WHERE id = p_proposta_id AND status = 'pendente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta % não encontrada ou não está pendente', p_proposta_id;
  END IF;

  -- Rejeitar
  UPDATE script_propostas_revisao
  SET status = 'rejeitada',
      razao_rejeicao = p_razao_rejeicao,
      decidido_por = auth.uid(),
      decidido_em = now(),
      atualizado_em = now()
  WHERE id = p_proposta_id;

  -- Liberar flag
  UPDATE scripts_customizados
  SET tem_proposta_pendente = false
  WHERE id = v_proposta.script_id;

  RETURN jsonb_build_object(
    'script_id', v_proposta.script_id,
    'campo_alvo', v_proposta.campo_alvo,
    'autor_proposta_id', v_proposta.autor_id,
    'tentativa', v_proposta.tentativa
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reenviar_proposta_script(p_proposta_id uuid, p_conteudo_proposto text, p_motivacao text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposta RECORD;
BEGIN
  SELECT * INTO v_proposta
  FROM script_propostas_revisao
  WHERE id = p_proposta_id
    AND autor_id = auth.uid()
    AND status = 'rejeitada';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta % não encontrada, não pertence ao usuário ou não está rejeitada', p_proposta_id;
  END IF;

  IF v_proposta.tentativa >= 3 THEN
    RAISE EXCEPTION 'Proposta % já atingiu o máximo de 3 tentativas', p_proposta_id;
  END IF;

  UPDATE script_propostas_revisao
  SET conteudo_proposto = p_conteudo_proposto,
      motivacao = p_motivacao,
      status = 'pendente',
      tentativa = v_proposta.tentativa + 1,
      razao_rejeicao = NULL,
      decidido_por = NULL,
      decidido_em = NULL,
      atualizado_em = now()
  WHERE id = p_proposta_id;

  UPDATE scripts_customizados
  SET tem_proposta_pendente = true
  WHERE id = v_proposta.script_id;

  RETURN jsonb_build_object(
    'script_id', v_proposta.script_id,
    'tentativa', v_proposta.tentativa + 1
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.revisar_script_inicial(p_script_id uuid, p_campo_alvo text, p_conteudo text, p_tipo_alteracao text, p_motivacao text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_script RECORD;
  v_autor_original UUID;
  v_tipo_motivacao TEXT;
  v_conteudo_anterior TEXT;
  v_conteudo_atual TEXT;
BEGIN
  -- a. Verificar script existe, não deletado, curadoria_atuada = false
  SELECT id, criado_por, criado_em, conteudo_bruto, conteudo_atendente,
         curadoria_atuada, deletado, email_enviado
  INTO v_script
  FROM scripts_customizados
  WHERE id = p_script_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Script % não encontrado', p_script_id;
  END IF;

  IF v_script.deletado = true THEN
    RAISE EXCEPTION 'Script % está deletado', p_script_id;
  END IF;

  IF v_script.curadoria_atuada = true THEN
    RAISE EXCEPTION 'Script % já foi revisado — use criar_versao_curadoria', p_script_id;
  END IF;

  -- b. Determinar autor original
  v_autor_original := COALESCE(v_script.criado_por, auth.uid());

  -- Mapear tipo_alteracao → tipo_motivacao
  CASE p_tipo_alteracao
    WHEN 'correcao_menor' THEN v_tipo_motivacao := 'correcao_grafia';
    WHEN 'substantiva' THEN v_tipo_motivacao := 'substantiva';
    ELSE RAISE EXCEPTION 'tipo_alteracao inválido: %', p_tipo_alteracao;
  END CASE;

  -- Conteúdo atual do script conforme campo_alvo
  IF p_campo_alvo = 'usuario_final' THEN
    v_conteudo_atual := COALESCE(v_script.conteudo_bruto, '');
  ELSE
    v_conteudo_atual := COALESCE(v_script.conteudo_atendente, '');
  END IF;

  -- c. Cleanup reentrada pós-contestação: deletar V2+
  DELETE FROM script_versoes
  WHERE script_id = p_script_id
    AND campo_alvo = p_campo_alvo
    AND numero_versao >= 2;

  -- d. Garantir V1 existe (se não, criar com conteúdo ATUAL do script)
  IF NOT EXISTS (
    SELECT 1 FROM script_versoes
    WHERE script_id = p_script_id
      AND campo_alvo = p_campo_alvo
      AND numero_versao = 1
  ) THEN
    INSERT INTO script_versoes (
      script_id, campo_alvo, numero_versao, conteudo, conteudo_anterior,
      motivacao, tipo_motivacao, autor_id, criado_em
    ) VALUES (
      p_script_id, p_campo_alvo, 1, v_conteudo_atual, NULL,
      'Publicação do script', 'criacao', v_autor_original, v_script.criado_em
    );
  END IF;

  -- e. Registrar revisor na V1
  UPDATE script_versoes
  SET aprovado_por = auth.uid(),
      revisado_em = now()
  WHERE script_id = p_script_id
    AND campo_alvo = p_campo_alvo
    AND numero_versao = 1;

  -- f. Capturar conteudo_anterior da V1
  SELECT conteudo INTO v_conteudo_anterior
  FROM script_versoes
  WHERE script_id = p_script_id
    AND campo_alvo = p_campo_alvo
    AND numero_versao = 1;

  -- g. INSERT V2
  INSERT INTO script_versoes (
    script_id, campo_alvo, numero_versao, conteudo, conteudo_anterior,
    motivacao, tipo_motivacao, autor_id, aprovado_por, revisado_em
  ) VALUES (
    p_script_id, p_campo_alvo, 2, p_conteudo, v_conteudo_anterior,
    p_motivacao, v_tipo_motivacao, v_autor_original, auth.uid(), now()
  );

  -- h. Atualizar scripts_customizados (desabilitar trigger)
  ALTER TABLE scripts_customizados DISABLE TRIGGER trigger_resetar_curadoria_ao_editar;

  IF p_campo_alvo = 'usuario_final' THEN
    UPDATE scripts_customizados
    SET conteudo_bruto = p_conteudo,
        curadoria_atuada = true,
        curadoria_por = auth.uid(),
        data_curadoria = now(),
        modificado_curadoria = true
    WHERE id = p_script_id;
  ELSE
    UPDATE scripts_customizados
    SET conteudo_atendente = p_conteudo,
        curadoria_atuada = true,
        curadoria_por = auth.uid(),
        data_curadoria = now(),
        modificado_curadoria = true
    WHERE id = p_script_id;
  END IF;

  ALTER TABLE scripts_customizados ENABLE TRIGGER trigger_resetar_curadoria_ao_editar;

  RETURN jsonb_build_object('versao', 2, 'tipo', v_tipo_motivacao);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.aceitar_contestacao_script(p_script_id uuid, p_campo_alvo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_v1 RECORD;
  v_deletadas INTEGER;
BEGIN
  -- Buscar V1
  SELECT id, conteudo INTO v_v1
  FROM script_versoes
  WHERE script_id = p_script_id
    AND campo_alvo = p_campo_alvo
    AND numero_versao = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'V1 não encontrada para script % campo %', p_script_id, p_campo_alvo;
  END IF;

  -- Deletar V2+
  DELETE FROM script_versoes
  WHERE script_id = p_script_id
    AND campo_alvo = p_campo_alvo
    AND numero_versao >= 2;

  GET DIAGNOSTICS v_deletadas = ROW_COUNT;

  -- Reverter V1 ao estado pré-revisão
  UPDATE script_versoes
  SET aprovado_por = NULL,
      revisado_em = NULL
  WHERE id = v_v1.id;

  -- Reverter scripts_customizados
  ALTER TABLE scripts_customizados DISABLE TRIGGER trigger_resetar_curadoria_ao_editar;

  IF p_campo_alvo = 'usuario_final' THEN
    UPDATE scripts_customizados
    SET conteudo_bruto = v_v1.conteudo,
        curadoria_atuada = false,
        curadoria_por = NULL,
        data_curadoria = NULL,
        modificado_curadoria = false
    WHERE id = p_script_id;
  ELSE
    UPDATE scripts_customizados
    SET conteudo_atendente = v_v1.conteudo,
        curadoria_atuada = false,
        curadoria_por = NULL,
        data_curadoria = NULL,
        modificado_curadoria = false
    WHERE id = p_script_id;
  END IF;

  ALTER TABLE scripts_customizados ENABLE TRIGGER trigger_resetar_curadoria_ao_editar;

  RETURN jsonb_build_object(
    'sucesso', true,
    'versoes_deletadas', v_deletadas,
    'conteudo_revertido', v_v1.conteudo
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_versao_curadoria(p_script_id uuid, p_campo_alvo text, p_conteudo text, p_motivacao text, p_tipo_motivacao text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_script RECORD;
  v_nova_versao INTEGER;
  v_conteudo_anterior TEXT;
BEGIN
  -- a. Verificar script existe, curadoria_atuada = true
  SELECT id, conteudo_bruto, conteudo_atendente, curadoria_atuada, deletado
  INTO v_script
  FROM scripts_customizados
  WHERE id = p_script_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Script % não encontrado', p_script_id;
  END IF;

  IF v_script.deletado = true THEN
    RAISE EXCEPTION 'Script % está deletado', p_script_id;
  END IF;

  IF v_script.curadoria_atuada = false THEN
    RAISE EXCEPTION 'Script % não foi revisado ainda — use revisar_script_inicial', p_script_id;
  END IF;

  -- Validar tipo_motivacao
  IF p_tipo_motivacao NOT IN ('correcao_grafia', 'substantiva', 'atualizacao_normativa', 'outro') THEN
    RAISE EXCEPTION 'tipo_motivacao inválido: %', p_tipo_motivacao;
  END IF;

  -- b. Calcular nova versão
  SELECT COALESCE(MAX(numero_versao), 0) + 1
  INTO v_nova_versao
  FROM script_versoes
  WHERE script_id = p_script_id
    AND campo_alvo = p_campo_alvo;

  -- c. Capturar conteudo_anterior de scripts_customizados
  IF p_campo_alvo = 'usuario_final' THEN
    v_conteudo_anterior := COALESCE(v_script.conteudo_bruto, '');
  ELSE
    v_conteudo_anterior := COALESCE(v_script.conteudo_atendente, '');
  END IF;

  -- d. INSERT versão
  INSERT INTO script_versoes (
    script_id, campo_alvo, numero_versao, conteudo, conteudo_anterior,
    motivacao, tipo_motivacao, autor_id, aprovado_por, revisado_em
  ) VALUES (
    p_script_id, p_campo_alvo, v_nova_versao, p_conteudo, v_conteudo_anterior,
    p_motivacao, p_tipo_motivacao, auth.uid(), auth.uid(), now()
  );

  -- e. Atualizar scripts_customizados (desabilitar trigger)
  ALTER TABLE scripts_customizados DISABLE TRIGGER trigger_resetar_curadoria_ao_editar;

  IF p_campo_alvo = 'usuario_final' THEN
    UPDATE scripts_customizados
    SET conteudo_bruto = p_conteudo,
        curadoria_por = auth.uid(),
        data_curadoria = now()
    WHERE id = p_script_id;
  ELSE
    UPDATE scripts_customizados
    SET conteudo_atendente = p_conteudo,
        curadoria_por = auth.uid(),
        data_curadoria = now()
    WHERE id = p_script_id;
  END IF;

  ALTER TABLE scripts_customizados ENABLE TRIGGER trigger_resetar_curadoria_ao_editar;

  RETURN jsonb_build_object('versao', v_nova_versao);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_versao_v1_publicacao(p_script_id uuid, p_campo_alvo text, p_conteudo text, p_autor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existe BOOLEAN;
  v_criado_em TIMESTAMPTZ;
BEGIN
  -- Verifica se V1 já existe para este script+campo
  SELECT EXISTS(
    SELECT 1 FROM script_versoes
    WHERE script_id = p_script_id
      AND campo_alvo = p_campo_alvo
      AND numero_versao = 1
  ) INTO v_existe;

  IF v_existe THEN
    RETURN; -- Idempotente
  END IF;

  -- Buscar criado_em do script original
  SELECT criado_em INTO v_criado_em
  FROM scripts_customizados
  WHERE id = p_script_id;

  IF v_criado_em IS NULL THEN
    RAISE EXCEPTION 'Script % não encontrado', p_script_id;
  END IF;

  INSERT INTO script_versoes (
    script_id, campo_alvo, numero_versao, conteudo, conteudo_anterior,
    motivacao, tipo_motivacao, autor_id, criado_em
  ) VALUES (
    p_script_id, p_campo_alvo, 1, p_conteudo, NULL,
    'Publicação do script', 'criacao', p_autor_id, v_criado_em
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.determinar_dominio_script(p_equipe_id uuid, p_pasta_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  -- Equipe 2.3.2 → sempre externo
  IF p_equipe_id = '11111111-1111-1111-1111-111111111111' THEN 
    RETURN 'externo'; 
  END IF;

  -- Equipe 2.2.2, verificar se está na pasta Advogados (recursivo)
  IF p_equipe_id = '2299bffb-48ce-45eb-9e46-bcbc4d15c964' THEN
    IF p_pasta_id IS NOT NULL AND EXISTS (
      WITH RECURSIVE ancestors AS (
        SELECT id, pasta_pai_id, nome FROM pastas_scripts WHERE id = p_pasta_id
        UNION ALL
        SELECT p.id, p.pasta_pai_id, p.nome 
        FROM pastas_scripts p 
        JOIN ancestors a ON p.id = a.pasta_pai_id
      )
      SELECT 1 FROM ancestors WHERE LOWER(nome) = 'advogados'
    ) THEN 
      RETURN 'externo'; 
    END IF;
  END IF;

  -- Demais equipes (2.3.1, 2.2.1, 2.2.2 sem Advogados) → interno
  RETURN 'interno';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marcar_curadoria_script(p_script_id uuid, p_curado boolean DEFAULT true, p_curador_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_foi_modificado BOOLEAN;
  v_resultado JSONB;
BEGIN
  -- Verificar se o conteúdo foi modificado
  v_foi_modificado := script_foi_modificado(p_script_id);
  
  -- Atualizar o registro
  -- NOTA: Como curadoria_atuada e conteudo_bruto mudam juntos aqui,
  -- o trigger resetar_curadoria_ao_editar NÃO interfere porque
  -- estamos setando curadoria_atuada explicitamente
  UPDATE scripts_customizados
  SET 
    curadoria_atuada = p_curado,
    modificado_curadoria = v_foi_modificado,
    data_curadoria = NOW(),
    curadoria_por = CASE WHEN p_curado THEN COALESCE(p_curador_id, auth.uid()) ELSE NULL END
  WHERE id = p_script_id;
  
  -- Retornar resultado
  v_resultado := jsonb_build_object(
    'script_id', p_script_id,
    'curadoria_atuada', p_curado,
    'modificado', v_foi_modificado,
    'data_curadoria', NOW(),
    'curadoria_por', CASE WHEN p_curado THEN COALESCE(p_curador_id, auth.uid()) ELSE NULL END
  );
  
  RETURN v_resultado;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_revisor_v1(p_script_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE script_versoes
  SET aprovado_por = auth.uid(),
      revisado_em = now()
  WHERE script_id = p_script_id
    AND numero_versao = 1
    AND aprovado_por IS NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.aprovar_exclusao_script(p_script_id uuid, p_admin_id uuid, p_aprovar boolean, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_script_data JSONB;
  v_solicitante_id UUID;
  v_equipe_id UUID;
  v_pasta_desativados_id UUID;
  v_pasta_original_id UUID;
BEGIN
  -- Verificar se há solicitação pendente
  IF NOT EXISTS (
    SELECT 1 FROM scripts_customizados 
    WHERE id = p_script_id AND exclusao_pendente = true
  ) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Nenhuma solicitação de exclusão pendente para este script'
    );
  END IF;
  
  -- Capturar dados do script antes de qualquer ação (para log)
  SELECT 
    jsonb_build_object(
      'id', id,
      'nome', nome,
      'numero_chamado', numero_chamado,
      'conteudo_bruto', conteudo_bruto,
      'pergunta', pergunta,
      'equipe_id', equipe_id,
      'criado_por', criado_por,
      'criado_em', criado_em,
      'email_enviado', email_enviado,
      'motivo_exclusao', motivo_exclusao,
      'pasta_id', pasta_id
    ),
    exclusao_solicitada_por,
    equipe_id,
    pasta_id
  INTO v_script_data, v_solicitante_id, v_equipe_id, v_pasta_original_id
  FROM scripts_customizados 
  WHERE id = p_script_id;
  
  -- Marcar notificação como lida
  UPDATE notificacoes_exclusao_scripts
  SET lida = true, lida_em = NOW()
  WHERE script_id = p_script_id AND lida = false;
  
  IF p_aprovar THEN
    -- Obter ID da pasta Desativados
    v_pasta_desativados_id := get_pasta_desativados_id(v_equipe_id);
    
    -- Registrar aprovação no log (com pasta original para possível restauração)
    INSERT INTO scripts_exclusao_log (script_id, tipo_exclusao, solicitante_id, aprovador_id, motivo, dados_script)
    VALUES (
      p_script_id,
      'aprovada',
      v_solicitante_id,
      p_admin_id,
      p_observacao,
      v_script_data || jsonb_build_object('pasta_original_id', v_pasta_original_id)
    );
    
    -- DESATIVAR o script: mover para pasta Desativados e marcar data
    UPDATE scripts_customizados 
    SET 
      deletado = true,
      deletado_em = NOW(),
      deletado_por = p_admin_id,
      desativado_em = NOW(),
      exclusao_pendente = false,
      pasta_id = v_pasta_desativados_id
    WHERE id = p_script_id;
    
    RETURN jsonb_build_object(
      'sucesso', true,
      'acao', 'aprovada',
      'mensagem', 'Script desativado e movido para pasta Desativados'
    );
  ELSE
    -- Negar: limpar flags de exclusão pendente (script volta a aparecer normalmente)
    UPDATE scripts_customizados 
    SET 
      exclusao_pendente = false,
      exclusao_solicitada_em = NULL,
      exclusao_solicitada_por = NULL,
      motivo_exclusao = NULL
    WHERE id = p_script_id;
    
    -- Registrar negação no log
    INSERT INTO scripts_exclusao_log (script_id, tipo_exclusao, solicitante_id, aprovador_id, motivo, dados_script)
    VALUES (
      p_script_id,
      'negada',
      v_solicitante_id,
      p_admin_id,
      p_observacao,
      v_script_data
    );
    
    RETURN jsonb_build_object(
      'sucesso', true,
      'acao', 'negada',
      'mensagem', 'Solicitação de exclusão negada. Script restaurado.'
    );
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reativar_script(p_script_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_script_nome TEXT;
  v_pasta_original_id UUID;
  v_dados_log JSONB;
BEGIN
  -- Verificar se o script existe e está desativado
  IF NOT EXISTS (
    SELECT 1 FROM scripts_customizados 
    WHERE id = p_script_id AND deletado = true
  ) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Script não encontrado ou não está desativado'
    );
  END IF;
  
  -- Buscar o nome do script
  SELECT nome INTO v_script_nome
  FROM scripts_customizados
  WHERE id = p_script_id;
  
  -- Buscar a pasta original do log de exclusão
  SELECT (dados_script->>'pasta_original_id')::UUID INTO v_pasta_original_id
  FROM scripts_exclusao_log
  WHERE script_id = p_script_id
    AND tipo_exclusao = 'aprovada'
  ORDER BY criado_em DESC
  LIMIT 1;
  
  -- Reativar o script
  UPDATE scripts_customizados 
  SET 
    deletado = false,
    deletado_em = NULL,
    deletado_por = NULL,
    desativado_em = NULL,
    pasta_id = v_pasta_original_id -- Restaurar para pasta original (pode ser NULL = raiz)
  WHERE id = p_script_id;
  
  -- Registrar reativação no log
  INSERT INTO scripts_exclusao_log (script_id, tipo_exclusao, solicitante_id, motivo, dados_script)
  VALUES (
    p_script_id,
    'reativada',
    p_user_id,
    'Script reativado manualmente',
    jsonb_build_object(
      'nome', v_script_nome,
      'pasta_restaurada_id', v_pasta_original_id
    )
  );
  
  RETURN jsonb_build_object(
    'sucesso', true,
    'mensagem', 'Script reativado com sucesso',
    'pasta_id', v_pasta_original_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_versoes_resumo(p_script_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(script_id uuid, campo_alvo text, max_versao integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT sv.script_id, sv.campo_alvo, MAX(sv.numero_versao)::INTEGER AS max_versao
  FROM script_versoes sv
  WHERE (p_script_ids IS NULL OR sv.script_id = ANY(p_script_ids))
  GROUP BY sv.script_id, sv.campo_alvo;
$function$
;



-- Permite salvar scripts mesmo quando categoria/subcategoria estao ausentes
-- ou inconsistentes com a taxonomia atual.

CREATE OR REPLACE FUNCTION public.validar_script_categoria_hierarquica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'distribuidor'
AS $function$
BEGIN
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.validar_script_categoria_hierarquica()
IS 'Compatibilidade para triggers de scripts; categoria/subcategoria sao metadados opcionais e nao bloqueiam INSERT/UPDATE.';

CREATE OR REPLACE FUNCTION public.notificacoes_destinatarios(
  p_codigo text,
  p_equipe_contexto uuid DEFAULT NULL
)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT u.id AS user_id
  FROM public.users u
  WHERE u.ativo IS DISTINCT FROM FALSE
    AND EXISTS (
      SELECT 1
      FROM public.permissoes_grants g
      WHERE g.objeto_codigo = p_codigo
        AND (
          (
            g.target_type = 'usuario'
            AND g.target_id = u.id::text
          )
          OR (
            g.target_type = 'equipe'
            AND u.equipe_id IS NOT NULL
            AND g.target_id = u.equipe_id::text
            AND (p_equipe_contexto IS NULL OR u.equipe_id = p_equipe_contexto)
          )
          OR (
            g.target_type = 'role'
            AND u.role IS NOT NULL
            AND g.target_id = u.role::text
            AND (p_equipe_contexto IS NULL OR u.equipe_id = p_equipe_contexto)
          )
        )
    );
$$;

COMMENT ON FUNCTION public.notificacoes_destinatarios(text, uuid) IS
  'Resolve destinatarios ativos de notificacoes a partir de permissoes_grants.';

REVOKE ALL ON FUNCTION public.notificacoes_destinatarios(text, uuid) FROM PUBLIC;

-- Publicação sem e-mail: notificar curadoria in-app; exclusão soft se publicado OU revisado

CREATE OR REPLACE FUNCTION public.notificar_curadoria_script_publicado(p_script_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_script RECORD;
  v_destinatario RECORD;
  v_publicador uuid;
BEGIN
  v_publicador := auth.uid();

  SELECT id, nome, equipe_id
  INTO v_script
  FROM scripts_customizados
  WHERE id = p_script_id
    AND COALESCE(deletado, false) = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Script % não encontrado', p_script_id;
  END IF;

  FOR v_destinatario IN
    SELECT d.user_id
    FROM public.notificacoes_destinatarios('scripts.curadoria_acesso', v_script.equipe_id) d
    WHERE d.user_id IS DISTINCT FROM v_publicador
  LOOP
    PERFORM public.criar_notificacao_script(
      v_destinatario.user_id,
      p_script_id,
      'script_publicado',
      format('Novo script publicado: "%s".', v_script.nome),
      NULL,
      NULL
    );
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.notificar_curadoria_script_publicado(uuid) TO authenticated;

COMMENT ON FUNCTION public.notificar_curadoria_script_publicado(uuid) IS
  'Notifica usuários com scripts.curadoria_acesso (escopo equipe) quando um script é publicado.';

CREATE OR REPLACE FUNCTION public.solicitar_exclusao_script(
  p_script_id uuid,
  p_usuario_id uuid,
  p_motivo text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_email_enviado BOOLEAN;
  v_curadoria_atuada BOOLEAN;
  v_script_nome TEXT;
  v_exclusao_pendente BOOLEAN;
  v_equipe_id UUID;
  v_destinatario RECORD;
  v_script_data JSONB;
  v_exige_aprovacao BOOLEAN;
BEGIN
  SELECT
    email_enviado,
    curadoria_atuada,
    nome,
    equipe_id,
    COALESCE(exclusao_pendente, false)
  INTO
    v_email_enviado,
    v_curadoria_atuada,
    v_script_nome,
    v_equipe_id,
    v_exclusao_pendente
  FROM scripts_customizados
  WHERE id = p_script_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Script não encontrado'
    );
  END IF;

  IF v_exclusao_pendente THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Já existe uma solicitação de exclusão pendente para este script'
    );
  END IF;

  SELECT to_jsonb(sc.*) INTO v_script_data
  FROM scripts_customizados sc
  WHERE sc.id = p_script_id;

  v_exige_aprovacao :=
    COALESCE(v_email_enviado, false)
    OR COALESCE(v_curadoria_atuada, false);

  IF NOT v_exige_aprovacao THEN
    INSERT INTO scripts_exclusao_log (script_id, tipo_exclusao, solicitante_id, motivo, dados_script)
    VALUES (p_script_id, 'hard', p_usuario_id, p_motivo, v_script_data);

    DELETE FROM scripts_customizados WHERE id = p_script_id;

    RETURN jsonb_build_object(
      'sucesso', true,
      'tipo_exclusao', 'hard',
      'mensagem', 'Script excluído permanentemente'
    );
  END IF;

  UPDATE scripts_customizados
  SET
    exclusao_pendente = true,
    exclusao_solicitada_em = NOW(),
    exclusao_solicitada_por = p_usuario_id,
    motivo_exclusao = p_motivo
  WHERE id = p_script_id;

  INSERT INTO scripts_exclusao_log (script_id, tipo_exclusao, solicitante_id, motivo, dados_script)
  VALUES (p_script_id, 'soft', p_usuario_id, p_motivo, v_script_data);

  FOR v_destinatario IN
    SELECT d.user_id
    FROM public.notificacoes_destinatarios('scripts.curadoria_acesso', v_equipe_id) d
    INNER JOIN auth.users au ON au.id = d.user_id
  LOOP
    INSERT INTO notificacoes_exclusao_scripts (
      script_id,
      script_nome,
      admin_id,
      solicitante_id,
      motivo
    )
    SELECT
      p_script_id,
      v_script_nome,
      v_destinatario.user_id,
      p_usuario_id,
      p_motivo
    WHERE NOT EXISTS (
      SELECT 1
      FROM notificacoes_exclusao_scripts n
      WHERE n.script_id = p_script_id
        AND n.admin_id = v_destinatario.user_id
        AND n.lida = false
    );
  END LOOP;

  RETURN jsonb_build_object(
    'sucesso', true,
    'tipo_exclusao', 'soft',
    'mensagem', 'Solicitação de exclusão enviada para aprovação da curadoria'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.stats_scripts_resumo()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*) FILTER (WHERE NOT deletado),
    'revisados', COUNT(*) FILTER (WHERE NOT deletado AND curadoria_atuada = true),
    'pendentes_revisao', COUNT(*) FILTER (WHERE NOT deletado AND curadoria_atuada = false)
  )
  FROM public.scripts_customizados;
$$;

CREATE OR REPLACE FUNCTION public.stats_scripts_top_criadores(p_limit INT DEFAULT 15)
RETURNS TABLE(user_id UUID, nome TEXT, equipe_nome TEXT, total BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_totals AS (
    SELECT
      sc.criado_por,
      COUNT(*) AS total
    FROM public.scripts_customizados sc
    WHERE sc.deletado = false AND sc.criado_por IS NOT NULL
    GROUP BY sc.criado_por
    ORDER BY total DESC
    LIMIT p_limit
  ),
  user_primary_equipe AS (
    SELECT DISTINCT ON (sc.criado_por)
      sc.criado_por,
      e.nome AS equipe_nome
    FROM public.scripts_customizados sc
    LEFT JOIN public.equipes e ON e.id = sc.equipe_autor_id
    WHERE sc.deletado = false
      AND sc.criado_por IN (SELECT criado_por FROM user_totals)
    GROUP BY sc.criado_por, sc.equipe_autor_id, e.nome
    ORDER BY sc.criado_por, COUNT(*) DESC
  )
  SELECT
    ut.criado_por AS user_id,
    u.nome,
    upe.equipe_nome,
    ut.total
  FROM user_totals ut
  JOIN public.users u ON u.id = ut.criado_por
  LEFT JOIN user_primary_equipe upe ON upe.criado_por = ut.criado_por
  ORDER BY ut.total DESC;
$$;

CREATE OR REPLACE FUNCTION public.stats_scripts_criacao_por_periodo(p_desde TIMESTAMPTZ)
RETURNS TABLE(data DATE, total BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    DATE(criado_em) AS data,
    COUNT(*) AS total
  FROM public.scripts_customizados
  WHERE deletado = false
    AND criado_em >= p_desde
  GROUP BY DATE(criado_em)
  ORDER BY data;
$$;

CREATE OR REPLACE FUNCTION public.stats_scripts_revisao_por_periodo(p_desde TIMESTAMPTZ)
RETURNS TABLE(data DATE, total BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH todas_revisoes AS (
    SELECT DATE(criado_em) AS data
    FROM public.script_versoes
    WHERE tipo_motivacao != 'criacao'
      AND criado_em >= p_desde
    UNION ALL
    SELECT DATE(data_curadoria) AS data
    FROM public.scripts_customizados
    WHERE curadoria_atuada = true
      AND data_curadoria IS NOT NULL
      AND data_curadoria >= p_desde
      AND deletado = false
      AND id NOT IN (
        SELECT DISTINCT script_id FROM public.script_versoes WHERE tipo_motivacao != 'criacao'
      )
  )
  SELECT data, COUNT(*) AS total
  FROM todas_revisoes
  GROUP BY data
  ORDER BY data;
$$;

CREATE OR REPLACE FUNCTION public.stats_scripts_criadores_por_periodo(
  p_desde TIMESTAMPTZ,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(user_id UUID, nome TEXT, data DATE, total BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH top_users AS (
    SELECT criado_por
    FROM public.scripts_customizados
    WHERE deletado = false
      AND criado_por IS NOT NULL
      AND criado_em >= p_desde
    GROUP BY criado_por
    ORDER BY COUNT(*) DESC
    LIMIT p_limit
  )
  SELECT
    sc.criado_por AS user_id,
    u.nome,
    DATE(sc.criado_em) AS data,
    COUNT(*) AS total
  FROM public.scripts_customizados sc
  JOIN public.users u ON u.id = sc.criado_por
  WHERE sc.deletado = false
    AND sc.criado_por IS NOT NULL
    AND sc.criado_em >= p_desde
    AND sc.criado_por IN (SELECT criado_por FROM top_users)
  GROUP BY sc.criado_por, u.nome, DATE(sc.criado_em)
  ORDER BY data, total DESC;
$$;

CREATE OR REPLACE FUNCTION public.stats_scripts_top_revisores(
  p_desde TIMESTAMPTZ,
  p_limit INT DEFAULT 15
)
RETURNS TABLE(user_id UUID, nome TEXT, total_revisoes BIGINT, total_aprovacoes BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sub.revisor_id AS user_id,
    u.nome,
    COUNT(*) FILTER (WHERE sub.origem IN ('versao', 'legado')) AS total_revisoes,
    COUNT(*) FILTER (WHERE sub.origem = 'proposta') AS total_aprovacoes
  FROM (
    SELECT aprovado_por AS revisor_id, 'versao'::TEXT AS origem, criado_em
    FROM public.script_versoes
    WHERE aprovado_por IS NOT NULL
      AND tipo_motivacao != 'criacao'
      AND criado_em >= p_desde
    UNION ALL
    SELECT decidido_por AS revisor_id, 'proposta'::TEXT AS origem, decidido_em AS criado_em
    FROM public.script_propostas_revisao
    WHERE status = 'aprovada'
      AND decidido_por IS NOT NULL
      AND decidido_em >= p_desde
    UNION ALL
    SELECT curadoria_por AS revisor_id, 'legado'::TEXT AS origem, data_curadoria AS criado_em
    FROM public.scripts_customizados
    WHERE curadoria_atuada = true
      AND curadoria_por IS NOT NULL
      AND data_curadoria IS NOT NULL
      AND data_curadoria >= p_desde
      AND deletado = false
      AND id NOT IN (
        SELECT DISTINCT script_id FROM public.script_versoes WHERE tipo_motivacao != 'criacao'
      )
  ) sub
  JOIN public.users u ON u.id = sub.revisor_id
  GROUP BY sub.revisor_id, u.nome
  ORDER BY (COUNT(*)) DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.stats_scripts_propostas_por_periodo(p_desde TIMESTAMPTZ)
RETURNS TABLE(data DATE, total BIGINT, aprovadas BIGINT, rejeitadas BIGINT, pendentes BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    DATE(criado_em) AS data,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'aprovada') AS aprovadas,
    COUNT(*) FILTER (WHERE status = 'rejeitada') AS rejeitadas,
    COUNT(*) FILTER (WHERE status IN ('pendente', 'em_revisao')) AS pendentes
  FROM public.script_propostas_revisao
  WHERE criado_em >= p_desde
  GROUP BY DATE(criado_em)
  ORDER BY data;
$$;

CREATE OR REPLACE FUNCTION public.stats_scripts_equipes_criadoras(p_limit INT DEFAULT 15)
RETURNS TABLE(equipe_id UUID, equipe_nome TEXT, total_scripts BIGINT, total_usuarios BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sc.equipe_autor_id AS equipe_id,
    e.nome AS equipe_nome,
    COUNT(*) AS total_scripts,
    COUNT(DISTINCT sc.criado_por) AS total_usuarios
  FROM public.scripts_customizados sc
  JOIN public.equipes e ON e.id = sc.equipe_autor_id
  WHERE sc.deletado = false
    AND sc.equipe_autor_id IS NOT NULL
  GROUP BY sc.equipe_autor_id, e.nome
  ORDER BY total_scripts DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.stats_scripts_resumo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.stats_scripts_top_criadores(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stats_scripts_criacao_por_periodo(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stats_scripts_revisao_por_periodo(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stats_scripts_criadores_por_periodo(TIMESTAMPTZ, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stats_scripts_top_revisores(TIMESTAMPTZ, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stats_scripts_propostas_por_periodo(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stats_scripts_equipes_criadoras(INT) TO authenticated;

-- Permissões de card/modal
INSERT INTO public.permissoes_objetos (codigo, nome, descricao, categoria, origem)
VALUES
  (
    'home.card.scripts_em_numeros',
    'Home — Scripts em Números',
    'Exibe o card "Scripts em Números" na Home.',
    'home',
    'src/pages/Home.tsx'
  ),
  (
    'scripts.em_numeros_modal',
    'Abrir Scripts em Números',
    'Modal de analytics dos scripts.',
    'scripts',
    'src/pages/Home.tsx'
  )
ON CONFLICT (codigo) DO UPDATE
SET nome = excluded.nome,
    descricao = excluded.descricao,
    categoria = excluded.categoria,
    origem = excluded.origem,
    updated_at = now();

-- Grants de modal espelham curadoria (roles)
INSERT INTO public.permissoes_grants (objeto_codigo, target_type, target_id)
VALUES
  ('scripts.em_numeros_modal', 'role', 'supervisor'),
  ('scripts.em_numeros_modal', 'role', 'coordenador'),
  ('home.card.scripts_em_numeros', 'role', 'supervisor'),
  ('home.card.scripts_em_numeros', 'role', 'coordenador')
ON CONFLICT (objeto_codigo, target_type, target_id) DO NOTHING;

-- Triggers em scripts_customizados
DROP TRIGGER IF EXISTS trg_atribuir_numero_referencia ON public.scripts_customizados;
CREATE TRIGGER trg_atribuir_numero_referencia
  BEFORE INSERT ON public.scripts_customizados
  FOR EACH ROW EXECUTE FUNCTION public.fn_atribuir_numero_referencia();

DROP TRIGGER IF EXISTS trigger_resetar_curadoria_ao_editar ON public.scripts_customizados;
CREATE TRIGGER trigger_resetar_curadoria_ao_editar
  BEFORE UPDATE ON public.scripts_customizados
  FOR EACH ROW EXECUTE FUNCTION public.resetar_curadoria_ao_editar();

DROP TRIGGER IF EXISTS trigger_salvar_conteudo_original ON public.scripts_customizados;
CREATE TRIGGER trigger_salvar_conteudo_original
  BEFORE INSERT ON public.scripts_customizados
  FOR EACH ROW EXECUTE FUNCTION public.salvar_conteudo_original_script();

DROP TRIGGER IF EXISTS trigger_scripts_classificacao_pendente ON public.scripts_customizados;
CREATE TRIGGER trigger_scripts_classificacao_pendente
  BEFORE INSERT OR UPDATE ON public.scripts_customizados
  FOR EACH ROW EXECUTE FUNCTION public.marcar_script_para_classificacao();

DROP TRIGGER IF EXISTS trigger_sync_tem_conteudo_atendente ON public.scripts_customizados;
CREATE TRIGGER trigger_sync_tem_conteudo_atendente
  BEFORE INSERT OR UPDATE ON public.scripts_customizados
  FOR EACH ROW EXECUTE FUNCTION public.sync_tem_conteudo_atendente();

DROP TRIGGER IF EXISTS trigger_validar_script_cat_hierarquica ON public.scripts_customizados;
CREATE TRIGGER trigger_validar_script_cat_hierarquica
  BEFORE INSERT OR UPDATE ON public.scripts_customizados
  FOR EACH ROW EXECUTE FUNCTION public.validar_script_categoria_hierarquica();

GRANT EXECUTE ON FUNCTION public.notificacoes_destinatarios(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_notificacao_script(uuid, uuid, text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_proposta_script(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_proposta_script(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rejeitar_proposta_script(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reenviar_proposta_script(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revisar_script_inicial(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceitar_contestacao_script(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_versao_curadoria(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_versao_v1_publicacao(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.determinar_dominio_script(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_curadoria_script(uuid, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_revisor_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_exclusao_script(uuid, uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reativar_script(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_versoes_resumo(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_curadoria_script_publicado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_exclusao_script(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pasta_desativados_id(uuid) TO authenticated;

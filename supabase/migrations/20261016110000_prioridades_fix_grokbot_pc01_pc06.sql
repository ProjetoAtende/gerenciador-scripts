-- Correções pós-teste Grok (16/10/2026): PC-01, PC-03, PC-04, PC-06.

BEGIN;

-- PC-03: competência não depende só de validacao=localizado; exige sequencial Cível (4).
CREATE OR REPLACE FUNCTION public.prioridades_processo_competencia_atende(
  p_processo text,
  p_vara integer,
  p_nome_orgao text,
  p_validacao text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_d text;
BEGIN
  v_d := regexp_replace(COALESCE(p_processo, ''), '\D', '', 'g');
  IF length(v_d) <> 20 THEN
    RETURN FALSE;
  END IF;

  IF substring(v_d FROM 14 FOR 3) <> '826'
     OR substring(v_d FROM 17 FOR 4) <> '0100' THEN
    RETURN FALSE;
  END IF;

  -- TJSP Atende (piloto): Varas Cíveis 1–45 → sequencial CNJ inicia em 4 (Eproc Cível).
  IF substring(v_d FROM 1 FOR 1) <> '4' THEN
    RETURN FALSE;
  END IF;

  IF p_vara IS NOT NULL AND (p_vara < 1 OR p_vara > 45) THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(trim(p_nome_orgao), '') <> '' THEN
    IF p_nome_orgao ~* '(Câmara|Camara|Gab\.|Gabinete|Turma Recursal|Desembargador)'
       AND p_nome_orgao !~* '(Vara Cível|Varas Cíveis)' THEN
      RETURN FALSE;
    END IF;

    IF p_nome_orgao !~* '(Vara Cível|Varas Cíveis|UPJ da|Foro Central Cível)' THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

-- PC-01: admin não bypassa isolamento UPJ de quem opera como Coordenador/Analista.
CREATE OR REPLACE FUNCTION public.prioridades_pode_ver(p_anotacao_id bigint)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_perfil public.prioridades_perfil_tipo;
  v_upj uuid;
  v_row public.prioridades_anotacoes%ROWTYPE;
  v_eh_upj boolean;
  v_upj_usuario uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT p.perfil, p.upj_id INTO v_perfil, v_upj
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = v_uid AND p.ativo;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_eh_upj := v_perfil IN ('coordenador', 'analista')
    OR public.prioridades_designacao_ativa(ARRAY['coordenador', 'analista']::public.prioridades_perfil_tipo[]);

  v_upj_usuario := v_upj;
  IF v_eh_upj AND v_upj_usuario IS NULL THEN
    SELECT d.upj_id INTO v_upj_usuario
    FROM public.prioridades_designacoes d
    WHERE d.usuario_id = v_uid
      AND d.ativa
      AND d.perfil IN ('coordenador', 'analista')
      AND d.inicio_em <= CURRENT_DATE
      AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
      AND d.upj_id IS NOT NULL
    ORDER BY d.inicio_em DESC
    LIMIT 1;
  END IF;

  IF v_row.criador_id = v_uid
     OR v_row.conferente_vinculado_id = v_uid
     OR v_row.conferido_por_id = v_uid THEN
    RETURN TRUE;
  END IF;

  IF v_row.analista_vinculado_id = v_uid OR v_row.analisado_por_id = v_uid THEN
    RETURN v_upj_usuario IS NOT NULL AND v_row.upj_id = v_upj_usuario;
  END IF;

  IF v_perfil = 'gestor' THEN
    RETURN TRUE;
  END IF;

  IF v_eh_upj THEN
    RETURN v_upj_usuario IS NOT NULL AND v_row.upj_id = v_upj_usuario;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.prioridades_designacoes d
    WHERE d.usuario_id = v_uid
      AND d.ativa
      AND d.inicio_em <= CURRENT_DATE
      AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
      AND d.perfil IN ('gestor', 'conferente')
      AND (d.upj_id IS NULL OR d.upj_id = v_row.upj_id)
  ) THEN
    RETURN TRUE;
  END IF;

  IF public.prioridades_designacao_ativa(ARRAY['gestor']::public.prioridades_perfil_tipo[]) THEN
    RETURN v_row.status = 'gestor-conferencia';
  END IF;

  -- Leitura total do admin do Gerenciador: só sem perfil operacional UPJ ativo.
  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND role::text = 'admin') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- PC-06: log consultável por Gestor/Coordenador base ou designação ativa.
CREATE OR REPLACE FUNCTION public.prioridades_pode_consultar_log_acessos()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid()
      AND p.ativo
      AND p.perfil IN ('gestor', 'coordenador')
  )
  OR EXISTS (
    SELECT 1 FROM public.prioridades_designacoes d
    WHERE d.usuario_id = auth.uid()
      AND d.ativa
      AND d.perfil IN ('gestor', 'coordenador')
      AND d.inicio_em <= CURRENT_DATE
      AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
  );
$$;

-- PC-04: restaura recálculo de marcas na criação (regressão 20261016103000).
CREATE OR REPLACE FUNCTION public.prioridades_criar_anotacao(p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_perfil public.prioridades_perfil_tipo;
  v_nome text;
  v_status public.prioridades_status;
  v_id bigint;
  v_upj uuid;
  v_vara integer;
  v_processo text;
  v_conferente RECORD;
  v_analista RECORD;
  v_pendentes text[] := ARRAY[]::text[];
  v_validacao_status text;
  v_upj_do_orgao uuid;
  v_id_orgao bigint;
BEGIN
  SELECT p.perfil INTO v_perfil
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  IF v_perfil IS NULL THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Usuário sem perfil no app de Prioridades e Urgências.');
  END IF;

  IF NOT (v_perfil IN ('atendente', 'gestor', 'conferente')) THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Perfil sem permissão para registrar anotações.');
  END IF;

  v_processo := regexp_replace(COALESCE(p_dados->>'processo', ''), '\D', '', 'g');

  IF v_processo = '' THEN
    v_pendentes := array_append(v_pendentes, 'N.º do Processo');
  ELSIF length(v_processo) <> 20 THEN
    v_pendentes := array_append(v_pendentes, 'N.º do Processo (deve ter 20 dígitos no padrão CNJ)');
  ELSIF NOT public.prioridades_cnj_dv_valido(v_processo) THEN
    v_pendentes := array_append(v_pendentes, 'N.º do Processo (dígito verificador inválido no padrão CNJ)');
  END IF;

  IF COALESCE(trim(p_dados->>'tipo_solicitante'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Tipo de Solicitante');
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.prioridades_tipos_solicitante t
    WHERE t.codigo = p_dados->>'tipo_solicitante' AND t.ativo
  ) THEN
    v_pendentes := array_append(v_pendentes,
      format('Tipo de Solicitante (valor não reconhecido: %s)', p_dados->>'tipo_solicitante'));
  END IF;

  IF p_dados->>'tipo_solicitante' = 'outros'
     AND COALESCE(trim(p_dados->>'descricao_solicitante'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Descrição do(s) Solicitante');
  END IF;

  IF COALESCE(trim(p_dados->>'tipo_prioridade'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Tipo de Prioridade/Urgência');
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.prioridades_tipos_prioridade t
    WHERE t.codigo = p_dados->>'tipo_prioridade' AND t.ativo
  ) THEN
    v_pendentes := array_append(v_pendentes,
      format('Tipo de Prioridade/Urgência (valor não reconhecido: %s)', p_dados->>'tipo_prioridade'));
  END IF;

  IF p_dados->>'tipo_prioridade' = 'outros'
     AND COALESCE(trim(p_dados->>'descricao_tipo_outros'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Descrição do Tipo de Prioridade/Urgência (Outros)');
  END IF;

  IF COALESCE(trim(p_dados->>'evento_folha'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Evento ou Folhas');
  END IF;
  IF COALESCE(trim(p_dados->>'descricao_prioridade'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Descrição da Prioridade/Urgência');
  END IF;

  IF COALESCE(p_dados->>'plataforma', '') NOT IN ('', 'eproc', 'saj') THEN
    v_pendentes := array_append(v_pendentes, 'Sistema (use Eproc ou SAJ)');
  END IF;

  v_upj := NULLIF(p_dados->>'upj_id', '')::uuid;
  v_id_orgao := NULLIF(p_dados->>'id_orgao_djen', '')::bigint;

  IF v_upj IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.prioridades_upjs WHERE id = v_upj AND ativa) THEN
    v_pendentes := array_append(v_pendentes, 'UPJ de destino (inexistente ou inativa)');
  END IF;

  IF v_upj IS NOT NULL AND v_id_orgao IS NOT NULL THEN
    SELECT o.upj_id INTO v_upj_do_orgao
    FROM public.prioridades_orgaos_upj o
    WHERE o.id_orgao_djen = v_id_orgao AND o.ativo;

    IF v_upj_do_orgao IS NOT NULL AND v_upj_do_orgao <> v_upj THEN
      v_pendentes := array_append(v_pendentes,
        'UPJ de destino (não corresponde ao órgão publicado no DJEN para este processo)');
    END IF;
  END IF;

  IF array_length(v_pendentes, 1) > 0 THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Preencha os campos obrigatórios.',
      'campos_pendentes', to_jsonb(v_pendentes));
  END IF;

  SELECT u.nome INTO v_nome FROM public.users u WHERE u.id = auth.uid();

  v_validacao_status := COALESCE(NULLIF(p_dados->>'validacao_djen_status', ''), 'nao_consultado');
  IF v_validacao_status NOT IN ('nao_consultado', 'localizado', 'sem_comunicacao', 'erro') THEN
    v_validacao_status := 'nao_consultado';
  END IF;
  IF v_validacao_status = 'localizado' AND v_id_orgao IS NULL THEN
    v_validacao_status := 'nao_consultado';
  END IF;

  v_vara := NULLIF(p_dados->>'vara', '')::integer;

  IF NOT public.prioridades_processo_competencia_atende(
    v_processo,
    v_vara,
    NULLIF(p_dados->>'nome_orgao_djen', ''),
    v_validacao_status
  ) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Este processo não está na competência do TJSP Atende (1ª a 45ª Varas Cíveis do Foro Central de São Paulo).',
      'campos_pendentes', to_jsonb(ARRAY['N.º do Processo'])
    );
  END IF;

  v_status := CASE WHEN v_perfil = 'gestor' THEN 'upj-pendente'::public.prioridades_status
                   ELSE 'gestor-conferencia'::public.prioridades_status END;

  INSERT INTO public.prioridades_anotacoes (
    status, criador_id, criador_nome, criador_perfil,
    processo, vara, upj_id, plataforma,
    validacao_djen_status, validacao_djen_em, validacao_djen_detalhe,
    id_orgao_djen, nome_orgao_djen,
    tipo_solicitante, descricao_solicitante, nome_solicitante,
    tipo_prioridade, descricao_tipo_outros,
    evento_folha, descricao_prioridade, observacao_adicional_atende,
    data_remessa_gestor, data_remessa_upj
  ) VALUES (
    v_status, auth.uid(), v_nome, v_perfil,
    v_processo, v_vara, v_upj, NULLIF(p_dados->>'plataforma', ''),
    v_validacao_status,
    CASE WHEN v_validacao_status = 'nao_consultado' THEN NULL
         ELSE NULLIF(p_dados->>'validacao_djen_em', '')::timestamptz END,
    NULLIF(p_dados->>'validacao_djen_detalhe', ''),
    v_id_orgao, NULLIF(p_dados->>'nome_orgao_djen', ''),
    p_dados->>'tipo_solicitante', NULLIF(p_dados->>'descricao_solicitante', ''),
    NULLIF(p_dados->>'nome_solicitante', ''),
    p_dados->>'tipo_prioridade', NULLIF(p_dados->>'descricao_tipo_outros', ''),
    p_dados->>'evento_folha', p_dados->>'descricao_prioridade',
    NULLIF(p_dados->>'observacao_adicional_atende', ''),
    CASE WHEN v_status = 'gestor-conferencia' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'upj-pendente' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_id;

  IF v_status = 'gestor-conferencia' THEN
    SELECT * INTO v_conferente FROM public.prioridades_proximo_da_fila('atende', NULL);
    IF v_conferente.usuario_id IS NOT NULL THEN
      UPDATE public.prioridades_anotacoes
      SET conferente_vinculado_id = v_conferente.usuario_id,
          conferente_vinculado_nome = v_conferente.usuario_nome
      WHERE id = v_id;
    END IF;
  ELSIF v_upj IS NOT NULL THEN
    SELECT * INTO v_analista FROM public.prioridades_proximo_da_fila('upj', v_upj);
    IF v_analista.usuario_id IS NOT NULL THEN
      UPDATE public.prioridades_anotacoes
      SET analista_vinculado_id = v_analista.usuario_id,
          analista_vinculado_nome = v_analista.usuario_nome
      WHERE id = v_id;
    END IF;
  END IF;

  PERFORM public.prioridades_registrar_historico(
    v_id, NULL, v_status, 'criacao', p_dados->>'descricao_prioridade');

  PERFORM public.prioridades_recalcular_especiais(v_processo);

  RETURN jsonb_build_object('sucesso', true, 'anotacao_id', v_id, 'status', v_status);
END;
$$;

COMMENT ON FUNCTION public.prioridades_pode_ver(bigint) IS
  'RF-GER-02 / RF-UPJ-01. Admin só tem leitura total fora do módulo UPJ; Coordenador/Analista isolados na própria UPJ mesmo com role admin.';

COMMIT;

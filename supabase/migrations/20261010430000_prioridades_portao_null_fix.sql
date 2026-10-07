-- App "Prioridades e Urgências" — corrige a lógica de negação com NULL.
--
-- ────────────────────────────────────────────────────────────────────────────
-- DEFEITO (encontrado por instrumentação dentro da própria função)
-- ────────────────────────────────────────────────────────────────────────────
-- O portão de permissão era escrito assim:
--
--     IF NOT (
--       v_perfil IN ('gestor', 'conferente')
--       OR public.prioridades_designacao_ativa(...)
--     ) THEN
--       RETURN 'sem permissão';
--     END IF;
--
-- Quando o usuário NÃO tem perfil, `v_perfil` é NULL, e em SQL:
--
--     NULL IN ('gestor','conferente')  ->  NULL        (não é FALSE)
--     NULL OR false                    ->  NULL
--     NOT NULL                         ->  NULL
--     IF NULL THEN                     ->  NÃO ENTRA no bloco
--
-- Ou seja: o portão **não fechava exatamente para quem não tem perfil** — o
-- caso que ele deveria barrar. Log interno da função instrumentada:
--
--     v_perfil_is_null: true
--     in_gestor_conferente: null
--     designacao_ativa: false
--     portao_nega: null            <-- deveria ser true
--
-- Foi por isso que o admin (sem perfil no app) conseguiu aprovar anotação.
-- Nenhuma revisão de código pegou, porque a expressão "parece" correta.
--
-- Correção: envolver a expressão em `COALESCE(..., false)` antes de negar.
-- Aplicado a **todas** as funções do módulo que usam esse padrão, para não
-- deixar a mesma armadilha em outro lugar.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. conferir — portão explícito
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_conferir(
  p_anotacao_id bigint,
  p_decisao text,
  p_justificativa text DEFAULT NULL,
  p_urgentissimo boolean DEFAULT false,
  p_correcao_automatica boolean DEFAULT false,
  p_texto_correcao text DEFAULT NULL,
  p_alteracoes jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row public.prioridades_anotacoes%ROWTYPE;
  v_perfil public.prioridades_perfil_tipo;
  v_analista RECORD;
  v_upj uuid;
  v_novo_texto text;
  v_auditoria jsonb;
  v_observacao_final text;
  v_pode_decidir boolean;
BEGIN
  SELECT p.perfil INTO v_perfil
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  -- COALESCE: sem perfil, `v_perfil` é NULL e a comparação IN devolveria NULL.
  -- `IF NULL THEN` não executa — o portão abriria justamente para quem não tem
  -- perfil. Este é o bug que deixava o admin decidir.
  v_pode_decidir := COALESCE(
    v_perfil IN ('gestor', 'conferente')
    OR public.prioridades_designacao_ativa(ARRAY['gestor', 'conferente']::public.prioridades_perfil_tipo[]),
    false
  );

  IF NOT v_pode_decidir THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Apenas Gestor ou Conferente Designado pode conferir. O acesso administrativo permite consultar, não decidir.');
  END IF;

  IF p_decisao IS NULL OR p_decisao NOT IN ('aprovar', 'devolver', 'rejeitar') THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', format('Decisão inválida: %s.', COALESCE(p_decisao, '(vazia)')));
  END IF;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação não encontrada.');
  END IF;
  IF v_row.status <> 'gestor-conferencia' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A anotação não está aguardando conferência.');
  END IF;

  -- ── VALIDAÇÃO — nada é gravado antes deste bloco terminar (PU-07) ──────

  IF p_decisao = 'aprovar' THEN
    v_upj := COALESCE(NULLIF(p_alteracoes->>'upj_id', '')::uuid, v_row.upj_id);

    IF v_upj IS NULL THEN
      RETURN jsonb_build_object('sucesso', false,
        'erro', 'Defina a UPJ de destino antes de enviar. Sem UPJ a anotação não é visível por nenhum cartório.',
        'requer_upj', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.prioridades_upjs WHERE id = v_upj AND ativa) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'UPJ de destino inexistente ou inativa.');
    END IF;

    IF v_row.id_orgao_djen IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.prioridades_orgaos_upj o
        WHERE o.id_orgao_djen = v_row.id_orgao_djen AND o.ativo
      ) AND NOT EXISTS (
        SELECT 1 FROM public.prioridades_orgaos_upj o
        WHERE o.id_orgao_djen = v_row.id_orgao_djen AND o.ativo AND o.upj_id = v_upj
      ) THEN
        RETURN jsonb_build_object('sucesso', false,
          'erro', 'A UPJ escolhida não corresponde ao órgão publicado no DJEN para este processo.',
          'divergencia_upj', true);
      END IF;
    END IF;
  END IF;

  IF p_decisao IN ('devolver', 'rejeitar') AND COALESCE(trim(p_justificativa), '') = '' THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', format('Justificativa é obrigatória para %s.', p_decisao));
  END IF;

  IF p_decisao = 'devolver' AND p_correcao_automatica
     AND COALESCE(trim(p_texto_correcao), '') = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Informe o texto da Correção Automática.');
  END IF;

  -- ── ESCRITA — a partir daqui a decisão é válida ────────────────────────

  v_novo_texto := COALESCE(
    NULLIF(p_alteracoes->>'descricao_prioridade', ''),
    v_row.descricao_prioridade
  );

  v_auditoria := jsonb_strip_nulls(jsonb_build_object(
    'descricao_anterior', CASE WHEN v_novo_texto IS DISTINCT FROM v_row.descricao_prioridade
                               THEN v_row.descricao_prioridade END,
    'descricao_nova', CASE WHEN v_novo_texto IS DISTINCT FROM v_row.descricao_prioridade
                           THEN v_novo_texto END,
    'evento_folha_anterior', CASE WHEN COALESCE(NULLIF(p_alteracoes->>'evento_folha', ''), v_row.evento_folha)
                                       IS DISTINCT FROM v_row.evento_folha
                                  THEN v_row.evento_folha END,
    'motivo', NULLIF(p_alteracoes->>'observacao_adicional_gestor', '')
  ));

  v_observacao_final := NULLIF(p_alteracoes->>'observacao_adicional_gestor', '');
  IF v_novo_texto IS DISTINCT FROM v_row.descricao_prioridade THEN
    v_observacao_final := concat_ws(
      E'\n\n',
      v_observacao_final,
      format('Texto original (preservado na conferência de %s):%s%s',
             to_char(now(), 'DD/MM/YYYY HH24:MI'),
             E'\n',
             v_row.descricao_prioridade)
    );
  END IF;

  UPDATE public.prioridades_anotacoes
  SET descricao_prioridade = v_novo_texto,
      evento_folha = COALESCE(NULLIF(p_alteracoes->>'evento_folha', ''), evento_folha),
      observacao_adicional_gestor = COALESCE(v_observacao_final, observacao_adicional_gestor),
      conferido_por_id = auth.uid(),
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  IF p_decisao = 'aprovar' THEN
    IF v_upj IS DISTINCT FROM v_row.upj_id THEN
      UPDATE public.prioridades_anotacoes SET upj_id = v_upj WHERE id = p_anotacao_id;
    END IF;

    UPDATE public.prioridades_anotacoes
    SET urgentissimo = COALESCE(p_urgentissimo, false),
        data_remessa_upj = now(),
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-conferencia', 'gestor-aprovada', 'aprovacao',
      CASE WHEN v_auditoria = '{}'::jsonb THEN NULL ELSE v_auditoria::text END);

    SELECT * INTO v_analista FROM public.prioridades_proximo_da_fila('upj', v_upj);
    IF v_analista.usuario_id IS NOT NULL THEN
      UPDATE public.prioridades_anotacoes
      SET analista_vinculado_id = v_analista.usuario_id,
          analista_vinculado_nome = v_analista.usuario_nome
      WHERE id = p_anotacao_id;
    END IF;

    UPDATE public.prioridades_anotacoes
    SET status = 'upj-pendente', atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-aprovada', 'upj-pendente', 'remessa_upj', NULL);

    RETURN jsonb_build_object('sucesso', true, 'status', 'upj-pendente');
  END IF;

  IF p_decisao = 'devolver' THEN
    UPDATE public.prioridades_anotacoes
    SET status = 'gestor-devolvida',
        justificativa_devolucao_gestor = p_justificativa,
        correcao_automatica = COALESCE(p_correcao_automatica, false),
        texto_correcao_automatica = NULLIF(p_texto_correcao, ''),
        devolvida_por = 'gestor',
        data_devolucao = now(),
        prazo_resposta_em = now() + interval '24 hours',
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-conferencia', 'gestor-devolvida', 'devolucao_gestor', p_justificativa);

    RETURN jsonb_build_object('sucesso', true, 'status', 'gestor-devolvida',
                              'prazo_resposta_em', now() + interval '24 hours');
  END IF;

  UPDATE public.prioridades_anotacoes
  SET status = 'gestor-rejeitada',
      justificativa_rejeicao_gestor = p_justificativa,
      arquivamento_automatico = false,
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  PERFORM public.prioridades_registrar_historico(
    p_anotacao_id, 'gestor-conferencia', 'gestor-rejeitada', 'rejeicao_gestor', p_justificativa);

  RETURN jsonb_build_object('sucesso', true, 'status', 'gestor-rejeitada');
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_conferir(bigint, text, text, boolean, boolean, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_conferir(bigint, text, text, boolean, boolean, text, jsonb)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. analisar — mesmo padrão, mesmo risco
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_analisar(
  p_anotacao_id bigint,
  p_decisao text,
  p_observacao_upj text DEFAULT NULL,
  p_justificativa text DEFAULT NULL,
  p_arquivamento_automatico boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row public.prioridades_anotacoes%ROWTYPE;
  v_perfil public.prioridades_perfil_tipo;
  v_upj uuid;
  v_novo public.prioridades_status;
  v_pode_decidir boolean;
BEGIN
  SELECT p.perfil, p.upj_id INTO v_perfil, v_upj
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  SELECT public.prioridades_sou_upj() INTO v_pode_decidir;

  IF NOT COALESCE(v_pode_decidir, false) THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Apenas Coordenador ou Analista Designado pode analisar.');
  END IF;

  IF p_decisao IS NULL OR p_decisao NOT IN ('resolver', 'devolver', 'rejeitar') THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', format('Decisão inválida: %s.', COALESCE(p_decisao, '(vazia)')));
  END IF;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação não encontrada.');
  END IF;

  -- RF-UPJ-01: isolamento por UPJ. Sem UPJ vinculada, não há o que analisar.
  IF v_upj IS NULL OR v_row.upj_id IS DISTINCT FROM v_upj THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação de outra UPJ.');
  END IF;

  IF v_row.status <> 'upj-pendente' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A anotação não está pendente na UPJ.');
  END IF;

  -- ── VALIDAÇÃO antes de qualquer escrita ────────────────────────────────
  IF p_decisao = 'devolver' AND COALESCE(trim(p_justificativa), '') = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Justificativa é obrigatória para devolver.');
  END IF;
  IF p_decisao = 'rejeitar' AND COALESCE(trim(p_justificativa), '') = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Justificativa é obrigatória para rejeitar.');
  END IF;

  IF p_decisao = 'resolver' THEN
    UPDATE public.prioridades_anotacoes
    SET status = 'upj-resolvida',
        observacao_adicional_upj = NULLIF(p_observacao_upj, ''),
        analisado_por_id = auth.uid(),
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'upj-pendente', 'upj-resolvida', 'resolucao_upj', p_observacao_upj);

    RETURN jsonb_build_object('sucesso', true, 'status', 'upj-resolvida');
  END IF;

  IF p_decisao = 'devolver' THEN
    UPDATE public.prioridades_anotacoes
    SET status = 'upj-devolvida',
        justificativa_devolucao_upj = p_justificativa,
        analisado_por_id = auth.uid(),
        devolvida_por = 'upj',
        data_devolucao = now(),
        prazo_resposta_em = now() + interval '24 hours',
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'upj-pendente', 'upj-devolvida', 'devolucao_upj', p_justificativa);

    RETURN jsonb_build_object('sucesso', true, 'status', 'upj-devolvida',
                              'prazo_resposta_em', now() + interval '24 hours');
  END IF;

  UPDATE public.prioridades_anotacoes
  SET status = 'upj-rejeitada',
      justificativa_rejeicao_upj = p_justificativa,
      arquivamento_automatico = COALESCE(p_arquivamento_automatico, false),
      analisado_por_id = auth.uid(),
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  PERFORM public.prioridades_registrar_historico(
    p_anotacao_id, 'upj-pendente', 'upj-rejeitada', 'rejeicao_upj', p_justificativa);

  RETURN jsonb_build_object('sucesso', true, 'status', 'upj-rejeitada');
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_analisar(bigint, text, text, text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_analisar(bigint, text, text, text, boolean)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. criar_anotacao — mesmo padrão no portão de perfil
-- ─────────────────────────────────────────────────────────────────────────

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

  v_status := CASE WHEN v_perfil = 'gestor' THEN 'upj-pendente'::public.prioridades_status
                   ELSE 'gestor-conferencia'::public.prioridades_status END;

  INSERT INTO public.prioridades_anotacoes (
    status, criador_id, criador_nome, criador_perfil,
    processo, vara, upj_id, plataforma,
    validacao_djen_status, validacao_djen_em, validacao_djen_detalhe,
    id_orgao_djen, nome_orgao_djen,
    tipo_solicitante, descricao_solicitante,
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

  RETURN jsonb_build_object('sucesso', true, 'anotacao_id', v_id, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_criar_anotacao(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_criar_anotacao(jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Varredura preventiva: nenhum outro portão com o mesmo padrão
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS assinatura, p.prosrc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'prioridades\_%'
      AND p.prosrc LIKE '%NOT (%'
      AND p.prosrc NOT LIKE '%COALESCE%'
  LOOP
    RAISE WARNING 'Portão de permissão sem COALESCE (risco de NULL): %', r.assinatura;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Limpeza das sondas de diagnóstico
-- ─────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.prioridades_diag_funcao(text);
DROP TABLE IF EXISTS public.prioridades_diag_log;

COMMIT;

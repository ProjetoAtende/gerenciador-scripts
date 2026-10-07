-- App "Prioridades e Urgências" — admin não escreve fora do fluxo (PU-14).
--
-- ────────────────────────────────────────────────────────────────────────────
-- INCONSISTÊNCIA CORRIGIDA
-- ────────────────────────────────────────────────────────────────────────────
-- O admin tem LEITURA TOTAL no módulo (decisão registrada na migration
-- 20261010180000). Mas as duas RPCs de decisão tratavam a ESCRITA de formas
-- diferentes, sem que houvesse decisão consciente para isso:
--
--   prioridades_conferir  → aceitava admin sem perfil no app
--   prioridades_analisar  → recusava admin sem perfil (exige coordenador/analista)
--
-- A documentação do projeto afirma que "nem o admin altera anotação alheia fora
-- do fluxo". Coerente com o RF-GER-03 e com o princípio de que a trilha de
-- auditoria precisa apontar quem agiu dentro do seu papel, a escolha é alinhar o
-- CÓDIGO à documentação: o admin pode LER tudo, mas para DECIDIR precisa do
-- perfil correspondente no app — como qualquer outro usuário.
--
-- Assim as duas RPCs passam a ter a mesma regra, e o admin que precisar operar
-- se atribui o perfil base (ação que só ele pode fazer) e age identificado.

BEGIN;

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
BEGIN
  SELECT p.perfil INTO v_perfil
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  -- Sem bypass de admin: para decidir, é preciso ter o perfil (RF-GES-02).
  -- O admin continua com leitura total; a escrita exige papel no fluxo.
  IF NOT (
    v_perfil IN ('gestor', 'conferente')
    OR public.prioridades_designacao_ativa(ARRAY['gestor', 'conferente']::public.prioridades_perfil_tipo[])
  ) THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Apenas Gestor ou Conferente Designado pode conferir. O acesso administrativo permite consultar, não decidir.');
  END IF;

  IF p_decisao NOT IN ('aprovar', 'devolver', 'rejeitar') THEN
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

  -- RF-GES-03: o original é anexado à observação, ao lado do motivo do Gestor.
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

COMMENT ON FUNCTION public.prioridades_conferir(bigint, text, text, boolean, boolean, text, jsonb) IS
  'RF-GES-02/03/04/05. Exige perfil de Gestor ou Conferente no app — o admin tem LEITURA total, mas não decide fora do fluxo. Valida tudo antes de gravar (PU-07) e preserva o texto original (RF-GES-03).';

COMMIT;

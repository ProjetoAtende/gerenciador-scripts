-- App "Prioridades e Urgências" — impede a perda silenciosa de anotação sem UPJ.
--
-- ────────────────────────────────────────────────────────────────────────────
-- DEFEITO REPRODUZIDO EM TESTE
-- ────────────────────────────────────────────────────────────────────────────
-- `upj_id` é opcional no formulário (correto: o DJEN pode não ter publicação e
-- a detecção falhar). Mas `prioridades_conferir` aprovava assim mesmo:
--
--   1. Atendente registra anotação sem UPJ        → status gestor-conferencia
--   2. Gestor aprova                              → status upj-pendente, upj_id NULL
--   3. Usuários da UPJ consultam                  → 0 linhas
--   4. Gestor continua vendo                      → 1 linha
--
-- Resultado: a anotação sai da fila de conferência, entra em "Pendentes (UPJ)",
-- ninguém na UPJ a enxerga (a RLS compara `upj_id = prioridades_minha_upj()`), e
-- nem o Atendente nem o Gestor percebem. Um pedido de prioridade urgente
-- simplesmente desaparece do fluxo.
--
-- A correção é recusar a aprovação sem UPJ, com mensagem que diz o que fazer.
-- Assim o Gestor resolve na hora — ele enxerga o nome do órgão devolvido pelo
-- DJEN e escolhe a UPJ no próprio formulário de conferência.
--
-- Alternativa descartada: atribuir uma UPJ padrão. Seria pior — entregaria a
-- anotação ao cartório errado, e erro de destino é mais grave do que erro
-- visível.

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
  v_novo public.prioridades_status;
  v_analista RECORD;
  v_upj uuid;
BEGIN
  SELECT p.perfil INTO v_perfil
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  IF v_perfil NOT IN ('gestor', 'conferente')
     AND NOT public.prioridades_designacao_ativa(ARRAY['gestor', 'conferente']::public.prioridades_perfil_tipo[])
     AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas Gestor ou Conferente Designado pode conferir.');
  END IF;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação não encontrada.');
  END IF;
  IF v_row.status <> 'gestor-conferencia' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A anotação não está aguardando conferência.');
  END IF;

  -- RF-GES-03: correção dos campos na conferência, preservando o texto original.
  IF p_alteracoes IS NOT NULL THEN
    UPDATE public.prioridades_anotacoes
    SET descricao_prioridade = COALESCE(NULLIF(p_alteracoes->>'descricao_prioridade', ''), descricao_prioridade),
        evento_folha = COALESCE(NULLIF(p_alteracoes->>'evento_folha', ''), evento_folha),
        observacao_adicional_gestor = COALESCE(NULLIF(p_alteracoes->>'observacao_adicional_gestor', ''),
                                                observacao_adicional_gestor),
        conferido_por_id = auth.uid(),
        atualizado_em = now()
    WHERE id = p_anotacao_id;
  ELSE
    UPDATE public.prioridades_anotacoes
    SET conferido_por_id = auth.uid(), atualizado_em = now()
    WHERE id = p_anotacao_id;
  END IF;

  IF p_decisao = 'aprovar' THEN
    -- O Gestor pode definir/corrigir a UPJ aqui: é a última chance antes da
    -- remessa, e ele tem o nome do órgão do DJEN na tela para decidir.
    v_upj := COALESCE(NULLIF(p_alteracoes->>'upj_id', '')::uuid, v_row.upj_id);

    IF v_upj IS NULL THEN
      RETURN jsonb_build_object(
        'sucesso', false,
        'erro', 'Defina a UPJ de destino antes de enviar. Sem UPJ a anotação não é visível por nenhum cartório.',
        'requer_upj', true
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.prioridades_upjs WHERE id = v_upj AND ativa) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'UPJ de destino inexistente ou inativa.');
    END IF;

    IF v_upj IS DISTINCT FROM v_row.upj_id THEN
      UPDATE public.prioridades_anotacoes SET upj_id = v_upj WHERE id = p_anotacao_id;
    END IF;

    v_novo := 'gestor-aprovada';

    -- RF-GES-04: Urgentíssimo só na aprovação.
    UPDATE public.prioridades_anotacoes
    SET urgentissimo = COALESCE(p_urgentissimo, false)
    WHERE id = p_anotacao_id;

    -- Remessa à UPJ. [DECISÃO] A pendência 2 do documento pergunta se
    -- "Aprovada (Gestor)" e "Pendente (UPJ)" são sequenciais ou equivalentes.
    -- Adotamos o modelo sequencial do diagrama da seção 5.1: grava a aprovação
    -- (com data/hora e histórico) e em seguida move para upj-pendente, que é o
    -- status operacional efetivamente visto pela UPJ.
    UPDATE public.prioridades_anotacoes
    SET data_remessa_upj = now(), atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-conferencia', 'gestor-aprovada', 'aprovacao', NULL);

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
    IF COALESCE(trim(p_justificativa), '') = '' THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Justificativa é obrigatória para devolver.');
    END IF;
    IF p_correcao_automatica AND COALESCE(trim(p_texto_correcao), '') = '' THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Informe o texto da Correção Automática.');
    END IF;

    v_novo := 'gestor-devolvida';

    UPDATE public.prioridades_anotacoes
    SET status = v_novo,
        justificativa_devolucao_gestor = p_justificativa,
        correcao_automatica = COALESCE(p_correcao_automatica, false),
        texto_correcao_automatica = NULLIF(p_texto_correcao, ''),
        devolvida_por = 'gestor',
        data_devolucao = now(),
        prazo_resposta_em = now() + interval '24 hours',
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-conferencia', v_novo, 'devolucao_gestor', p_justificativa);

    RETURN jsonb_build_object('sucesso', true, 'status', v_novo,
                              'prazo_resposta_em', now() + interval '24 hours');
  END IF;

  IF p_decisao = 'rejeitar' THEN
    IF COALESCE(trim(p_justificativa), '') = '' THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Justificativa é obrigatória para rejeitar.');
    END IF;

    v_novo := 'gestor-rejeitada';

    UPDATE public.prioridades_anotacoes
    SET status = v_novo,
        justificativa_rejeicao_gestor = p_justificativa,
        arquivamento_automatico = false,
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-conferencia', v_novo, 'rejeicao_gestor', p_justificativa);

    RETURN jsonb_build_object('sucesso', true, 'status', v_novo);
  END IF;

  RETURN jsonb_build_object('sucesso', false, 'erro', 'Decisão inválida.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_conferir(bigint, text, text, boolean, boolean, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.prioridades_conferir(bigint, text, text, boolean, boolean, text, jsonb) IS
  'RF-GES-02/03/04/05. Aprovar exige UPJ de destino definida (em p_alteracoes->>upj_id ou já na anotação) — sem isso a anotação ficaria invisível para todas as UPJs.';

COMMIT;

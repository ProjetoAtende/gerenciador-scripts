-- Prioridades e Urgências — correções finais (rodada 03/2026)
-- Atendente: visibilidade restrita ao criador; aceitar reprovação.
-- Gestor: aceitar rejeição de retorno pela UPJ.

BEGIN;

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
  v_tem_designacao_atende boolean;
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

  v_tem_designacao_atende := EXISTS (
    SELECT 1 FROM public.prioridades_designacoes d
    WHERE d.usuario_id = v_uid
      AND d.ativa
      AND d.inicio_em <= CURRENT_DATE
      AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
      AND d.perfil IN ('gestor', 'conferente')
  );

  -- Módulo Atendentes: perfil base Atendente sem designação Gestor/Conferente
  -- enxerga somente anotações da qual foi criador.
  IF v_perfil = 'atendente' AND NOT v_tem_designacao_atende THEN
    RETURN v_row.criador_id = v_uid;
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

  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND role::text = 'admin') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.prioridades_aceitar_reprovacao(p_anotacao_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row public.prioridades_anotacoes%ROWTYPE;
  v_msg text := 'Os motivos da reprovação foram compreendidos e serão utilizados para melhor triagem na inclusão de anotações no futuro. Aceito a reprovação da anotação, por não se considerar possível sua regularização no caso em questão.';
BEGIN
  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação não encontrada.');
  END IF;
  IF v_row.criador_id <> auth.uid() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas o autor da anotação pode aceitar a reprovação.');
  END IF;
  IF v_row.status <> 'gestor-devolvida' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A anotação não está devolvida pelo Gestor.');
  END IF;
  IF v_row.prazo_resposta_em IS NOT NULL AND now() > v_row.prazo_resposta_em THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prazo de resposta encerrado.');
  END IF;

  UPDATE public.prioridades_anotacoes
  SET status = 'gestor-rejeitada',
      justificativa_rejeicao_gestor = COALESCE(justificativa_rejeicao_gestor, v_msg),
      prazo_resposta_em = NULL,
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  PERFORM public.prioridades_registrar_historico(
    p_anotacao_id, v_row.status, 'gestor-rejeitada', 'aceite_reprovacao', v_msg);

  PERFORM public.prioridades_recalcular_especiais(v_row.processo);

  RETURN jsonb_build_object('sucesso', true, 'status', 'gestor-rejeitada');
END;
$$;

CREATE OR REPLACE FUNCTION public.prioridades_aceitar_rejeicao_retorno(p_anotacao_id bigint)
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
  v_eh_gestor boolean;
  v_eh_conferente boolean;
  v_msg text := 'Os motivos do retorno foram entendidos e serão utilizados para melhor triagem de anotações no futuro. Aceito a rejeição da anotação, por não se considerar possível sua regularização no caso em questão.';
BEGIN
  SELECT p.perfil INTO v_perfil
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  v_eh_gestor := COALESCE(
    v_perfil = 'gestor'
    OR public.prioridades_designacao_ativa(ARRAY['gestor']::public.prioridades_perfil_tipo[]),
    false
  );
  v_eh_conferente := COALESCE(
    v_perfil = 'conferente'
    OR public.prioridades_designacao_ativa(ARRAY['conferente']::public.prioridades_perfil_tipo[]),
    false
  );

  IF NOT (v_eh_gestor OR v_eh_conferente) THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Apenas Gestor ou Conferente Designado pode aceitar a rejeição do retorno.');
  END IF;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação não encontrada.');
  END IF;
  IF v_row.status <> 'upj-devolvida' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A anotação não está retornada pela UPJ.');
  END IF;

  IF NOT v_eh_gestor
     AND v_row.conferente_vinculado_id IS DISTINCT FROM auth.uid()
     AND v_row.conferido_por_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Esta anotação retornada está vinculada a outra pessoa.');
  END IF;

  UPDATE public.prioridades_anotacoes
  SET status = 'upj-rejeitada',
      justificativa_rejeicao_upj = COALESCE(
        justificativa_rejeicao_upj,
        'Rejeição aceita pelo Gestor/Conferente antes do prazo.'
      ),
      prazo_resposta_em = NULL,
      rejeicao_automatica = false,
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  PERFORM public.prioridades_registrar_historico(
    p_anotacao_id, v_row.status, 'upj-rejeitada', 'aceite_rejeicao_retorno', v_msg);

  PERFORM public.prioridades_recalcular_especiais(v_row.processo);

  RETURN jsonb_build_object('sucesso', true, 'status', 'upj-rejeitada');
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_aceitar_reprovacao(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_aceitar_reprovacao(bigint) TO authenticated;

REVOKE ALL ON FUNCTION public.prioridades_aceitar_rejeicao_retorno(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_aceitar_rejeicao_retorno(bigint) TO authenticated;

COMMIT;

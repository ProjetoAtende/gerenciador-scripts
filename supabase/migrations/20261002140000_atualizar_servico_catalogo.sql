-- Alinha atualizar_servico e servico_tipos_permitidos ao catálogo servico_tipos
-- (criar_servico já usava servico_tipo_ativo desde 20261002120000)

BEGIN;

CREATE OR REPLACE FUNCTION public.servico_tipos_permitidos()
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(t.codigo ORDER BY t.codigo),
    ARRAY[]::text[]
  )
  FROM public.servico_tipos t
  WHERE t.ativo = true;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_servico(
  p_servico_id uuid,
  p_tipo text DEFAULT NULL,
  p_quantidade integer DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_data_execucao timestamptz DEFAULT NULL,
  p_descricao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_user_role  text;
  v_servico    record;
  v_alteracoes jsonb := '{}';
BEGIN
  SELECT * INTO v_servico FROM public.servicos WHERE id = p_servico_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Servico nao encontrado');
  END IF;

  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id;

  IF v_servico.usuario_id != v_user_id AND COALESCE(v_user_role, 'user') != 'admin' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas o responsavel ou administrador pode editar o servico');
  END IF;

  IF p_tipo IS NOT NULL AND p_tipo != v_servico.tipo THEN
    IF NOT public.servico_tipo_ativo(p_tipo) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Tipo de servico invalido ou inativo');
    END IF;

    UPDATE public.servicos SET tipo = p_tipo, atualizado_em = now() WHERE id = p_servico_id;
    v_alteracoes := v_alteracoes || jsonb_build_object('tipo', true);
  END IF;

  IF p_quantidade IS NOT NULL AND p_quantidade != v_servico.quantidade THEN
    IF p_quantidade < 1 THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Quantidade deve ser um numero inteiro maior ou igual a 1');
    END IF;

    UPDATE public.servicos SET quantidade = p_quantidade, atualizado_em = now() WHERE id = p_servico_id;
    v_alteracoes := v_alteracoes || jsonb_build_object('quantidade', true);
  END IF;

  IF p_observacao IS NOT NULL AND COALESCE(p_observacao, '') != COALESCE(v_servico.observacao, '') THEN
    UPDATE public.servicos SET observacao = p_observacao, atualizado_em = now() WHERE id = p_servico_id;
    v_alteracoes := v_alteracoes || jsonb_build_object('observacao', true);
  END IF;

  IF p_data_execucao IS NOT NULL AND p_data_execucao != v_servico.data_execucao THEN
    IF p_data_execucao > now() + interval '1 minute' THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'A data de execucao nao pode ser no futuro');
    END IF;

    UPDATE public.servicos SET data_execucao = p_data_execucao, atualizado_em = now() WHERE id = p_servico_id;
    v_alteracoes := v_alteracoes || jsonb_build_object('data_execucao', true);
  END IF;

  IF p_descricao IS NOT NULL AND COALESCE(p_descricao, '') != COALESCE(v_servico.descricao, '') THEN
    UPDATE public.servicos SET descricao = p_descricao, atualizado_em = now() WHERE id = p_servico_id;
    v_alteracoes := v_alteracoes || jsonb_build_object('descricao', true);
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'alteracoes', v_alteracoes,
    'mensagem', 'Servico atualizado com sucesso'
  );

EXCEPTION
  WHEN check_violation THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Dados invalidos: verifique tipo e quantidade.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Erro ao atualizar servico. Tente novamente.');
END;
$$;

COMMIT;

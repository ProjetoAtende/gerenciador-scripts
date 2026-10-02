-- Permite gerenciar catálogo de serviços a supervisor, coordenador e admin (não user)

BEGIN;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_servico_tipos(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = COALESCE(p_user_id, auth.uid())
      AND u.role::text IN ('supervisor', 'coordenador', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.pode_gerenciar_servico_tipos(uuid) TO authenticated;

DROP POLICY IF EXISTS "servico_tipos_admin_write" ON public.servico_tipos;
CREATE POLICY "servico_tipos_gestores_write"
  ON public.servico_tipos FOR ALL TO authenticated
  USING (public.pode_gerenciar_servico_tipos())
  WITH CHECK (public.pode_gerenciar_servico_tipos());

CREATE OR REPLACE FUNCTION public.criar_servico_tipo(
  p_codigo text,
  p_label text,
  p_unidade text,
  p_icone text DEFAULT '📋',
  p_dica text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text;
BEGIN
  IF NOT public.pode_gerenciar_servico_tipos() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Acesso negado.');
  END IF;

  v_codigo := lower(trim(regexp_replace(coalesce(p_codigo, ''), '\s+', '_', 'g')));
  v_codigo := regexp_replace(v_codigo, '[^a-z0-9_]', '', 'g');

  IF v_codigo = '' OR length(v_codigo) > 80 THEN
    v_codigo := lower(trim(regexp_replace(coalesce(p_label, ''), '\s+', '_', 'g')));
    v_codigo := regexp_replace(v_codigo, '[^a-z0-9_]', '', 'g');
  END IF;

  IF v_codigo = '' OR length(v_codigo) > 80 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Código inválido. Use letras minúsculas, números e underscore.');
  END IF;

  IF p_label IS NULL OR trim(p_label) = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Nome do serviço é obrigatório.');
  END IF;

  IF p_unidade NOT IN ('unidades', 'horas') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Unidade deve ser unidades ou horas.');
  END IF;

  INSERT INTO public.servico_tipos (codigo, label, unidade, icone, dica, eh_personalizado)
  VALUES (v_codigo, trim(p_label), p_unidade, coalesce(nullif(trim(p_icone), ''), '📋'), coalesce(p_dica, ''), true);

  RETURN jsonb_build_object('sucesso', true, 'codigo', v_codigo);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Já existe um serviço com este código.');
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_servico_tipo(
  p_codigo text,
  p_label text DEFAULT NULL,
  p_unidade text DEFAULT NULL,
  p_icone text DEFAULT NULL,
  p_dica text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_gerenciar_servico_tipos() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Acesso negado.');
  END IF;

  IF p_codigo IS NULL OR trim(p_codigo) = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Código obrigatório.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.servico_tipos WHERE codigo = p_codigo) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Tipo de serviço não encontrado.');
  END IF;

  IF p_unidade IS NOT NULL AND p_unidade NOT IN ('unidades', 'horas') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Unidade deve ser unidades ou horas.');
  END IF;

  UPDATE public.servico_tipos
  SET
    label = COALESCE(NULLIF(trim(p_label), ''), label),
    unidade = COALESCE(p_unidade, unidade),
    icone = COALESCE(NULLIF(trim(p_icone), ''), icone),
    dica = COALESCE(p_dica, dica),
    ativo = COALESCE(p_ativo, ativo)
  WHERE codigo = p_codigo;

  RETURN jsonb_build_object('sucesso', true, 'codigo', p_codigo);
END;
$$;

COMMIT;

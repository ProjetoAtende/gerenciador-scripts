-- User vê o próprio nome na autoria; demais users continuam anônimos.

CREATE OR REPLACE FUNCTION public.stack_autor_json(p_user_id uuid, p_viewer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_staff := public.stack_is_staff(p_viewer_id);

  IF NOT v_staff AND p_user_id IS DISTINCT FROM p_viewer_id THEN
    RETURN jsonb_build_object('anonimo', true);
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'id', u.id,
      'nome', u.nome,
      'email', u.email
    )
    FROM public.users u
    WHERE u.id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_autor_json_for_view(p_user_id uuid, p_staff_view boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT p_staff_view AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('anonimo', true);
  END IF;

  RETURN (
    SELECT jsonb_build_object('id', u.id, 'nome', u.nome, 'email', u.email)
    FROM public.users u
    WHERE u.id = p_user_id
  );
END;
$$;

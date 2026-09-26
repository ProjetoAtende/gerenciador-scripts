CREATE TABLE IF NOT EXISTS public.usuario_funcoes_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  funcao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES public.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuario_funcoes_equipe_funcao_check CHECK (funcao IN ('supervisor')),
  CONSTRAINT usuario_funcoes_equipe_unique UNIQUE (user_id, equipe_id, funcao)
);

CREATE INDEX IF NOT EXISTS idx_usuario_funcoes_equipe_user
  ON public.usuario_funcoes_equipe (user_id)
  WHERE ativo = true;

ALTER TABLE public.usuario_funcoes_equipe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam funcoes equipe" ON public.usuario_funcoes_equipe;
CREATE POLICY "Admins gerenciam funcoes equipe"
  ON public.usuario_funcoes_equipe
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.usuario_funcoes_equipe TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_usuario_supervisor_equipes(
  p_user_id uuid,
  p_equipe_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_invalid integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário obrigatório');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  WITH equipe_ids AS (
    SELECT DISTINCT equipe_id
    FROM unnest(COALESCE(p_equipe_ids, '{}'::uuid[])) AS equipe_id
    WHERE equipe_id IS NOT NULL
  )
  SELECT COUNT(*) INTO v_total FROM equipe_ids;

  WITH equipe_ids AS (
    SELECT DISTINCT equipe_id
    FROM unnest(COALESCE(p_equipe_ids, '{}'::uuid[])) AS equipe_id
    WHERE equipe_id IS NOT NULL
  )
  SELECT COUNT(*) INTO v_invalid
  FROM equipe_ids ids
  LEFT JOIN public.equipes e ON e.id = ids.equipe_id
  WHERE e.id IS NULL;

  IF v_invalid > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Uma ou mais equipes informadas não existem');
  END IF;

  DELETE FROM public.usuario_funcoes_equipe
  WHERE user_id = p_user_id AND funcao = 'supervisor';

  INSERT INTO public.usuario_funcoes_equipe (user_id, equipe_id, funcao, ativo, criado_por)
  SELECT p_user_id, ids.equipe_id, 'supervisor', true, auth.uid()
  FROM (
    SELECT DISTINCT equipe_id
    FROM unnest(COALESCE(p_equipe_ids, '{}'::uuid[])) AS equipe_id
    WHERE equipe_id IS NOT NULL
  ) ids;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Funções de supervisor atualizadas com sucesso',
    'total', v_total
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_usuario_supervisor_equipes(uuid, uuid[]) TO authenticated;

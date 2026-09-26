-- Ajustes para o trigger de perfil em auth.users (signup admin via API)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

ALTER TABLE public.users
  ALTER COLUMN id DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.handle_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_nome text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Usuário'
  );
  v_role public.user_role := public.normalize_user_role(new.raw_user_meta_data ->> 'role');
BEGIN
  INSERT INTO public.users (id, email, nome, role, ativo, updated_at)
  VALUES (
    new.id,
    lower(coalesce(new.email, '')),
    v_nome,
    v_role,
    true,
    timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE
  SET email = excluded.email,
      nome = case
        when excluded.nome <> '' then excluded.nome
        else public.users.nome
      end,
      role = case
        when public.users.role is null then excluded.role
        when public.users.role = 'catequista'::public.user_role then excluded.role
        else public.users.role
      end,
      ativo = coalesce(public.users.ativo, true),
      updated_at = timezone('utc', now());

  RETURN new;
END;
$$;

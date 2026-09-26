-- Setores + vínculos mínimos do gerenciador (subset curado)

CREATE TABLE IF NOT EXISTS public.setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome varchar(255) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.equipes
  ADD CONSTRAINT equipes_setor_id_fkey
  FOREIGN KEY (setor_id) REFERENCES public.setores(id) ON DELETE SET NULL;

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.users
  ADD CONSTRAINT users_equipe_id_fkey
  FOREIGN KEY (equipe_id) REFERENCES public.equipes(id) ON DELETE SET NULL;

ALTER TABLE public.users
  ADD CONSTRAINT users_setor_id_fkey
  FOREIGN KEY (setor_id) REFERENCES public.setores(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON public.users (lower(email));

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON public.users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipes TO authenticated;

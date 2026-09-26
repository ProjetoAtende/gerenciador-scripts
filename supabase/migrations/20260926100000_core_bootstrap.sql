-- Base mínima preservada no repositório para que a cadeia de migrations
-- possa ser reconstruída localmente com `supabase db reset`.
--
-- A tabela já existia no banco remoto quando as migrations de evolução de
-- serviços foram registradas. O snapshot anterior, porém, foi salvo vazio,
-- deixando a primeira migration dependente sem sua tabela de origem.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('user', 'supervisor', 'coordenador', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  setor_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sgs_codigo text
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  nome text NOT NULL,
  created_at timestamptz DEFAULT now(),
  equipe_id uuid,
  setor_id uuid,
  role public.user_role DEFAULT 'user',
  ativo boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  quantidade integer NOT NULL,
  usuario_id uuid NOT NULL,
  usuario_nome text NOT NULL,
  equipe_id uuid NOT NULL,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  data_execucao timestamptz NOT NULL DEFAULT now()
);

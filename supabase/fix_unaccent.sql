-- Garantir que a extensão unaccent existe
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- Criar text search dictionary no schema public (necessario para funcoes que referenciam 'public.unaccent' como dictionary)
DO $$ BEGIN
  CREATE TEXT SEARCH DICTIONARY public.unaccent (
    TEMPLATE = simple
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Criar wrappers de unaccent necessários
CREATE OR REPLACE FUNCTION public.f_unaccent(text) RETURNS text AS $$
  SELECT extensions.unaccent($1);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

CREATE OR REPLACE FUNCTION public.unaccent(text) RETURNS text AS $$
  SELECT extensions.unaccent($1);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- Sobrecarga com 2 args (dict, text)
CREATE OR REPLACE FUNCTION public.unaccent(regdictionary, text) RETURNS text AS $$
  SELECT extensions.unaccent($2);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

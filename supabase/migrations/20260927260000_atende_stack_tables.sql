-- DB-7: Atende Stack — tabelas, índices, triggers

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ---------------------------------------------------------------------------
-- Helpers (sem dependência de tabelas stack)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stack_html_to_plain(p_html text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(COALESCE(p_html, ''), '<[^>]+>', ' ', 'g'),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.stack_tag_slug(p_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(
    both '-' FROM regexp_replace(
      regexp_replace(
        lower(unaccent(trim(COALESCE(p_input, '')))),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '-+',
      '-',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.stack_is_staff(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.ativo IS DISTINCT FROM false
      AND (
        u.role IN ('supervisor', 'coordenador', 'admin')
        OR public.is_admin(p_user_id)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.stack_html_to_plain(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_tag_slug(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_is_staff(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stack_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  rotulo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stack_tags_slug_nonempty CHECK (length(slug) > 0)
);

CREATE TABLE IF NOT EXISTS public.stack_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  corpo_html text NOT NULL DEFAULT '',
  corpo_plain text NOT NULL DEFAULT '',
  autor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  autor_equipe_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'fechada', 'oculta')),
  resposta_aceita_id uuid,
  upvote_count integer NOT NULL DEFAULT 0,
  resposta_count integer NOT NULL DEFAULT 0,
  ultima_atividade_em timestamptz NOT NULL DEFAULT now(),
  editado_em timestamptz,
  editado_por_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  search_vector tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stack_perguntas_titulo_len CHECK (char_length(titulo) <= 200)
);

CREATE TABLE IF NOT EXISTS public.stack_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta_id uuid NOT NULL REFERENCES public.stack_perguntas(id) ON DELETE CASCADE,
  corpo_html text NOT NULL DEFAULT '',
  corpo_plain text NOT NULL DEFAULT '',
  autor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  autor_equipe_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  upvote_count integer NOT NULL DEFAULT 0,
  editado_em timestamptz,
  editado_por_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stack_perguntas
  DROP CONSTRAINT IF EXISTS stack_perguntas_resposta_aceita_fkey;

ALTER TABLE public.stack_perguntas
  ADD CONSTRAINT stack_perguntas_resposta_aceita_fkey
  FOREIGN KEY (resposta_aceita_id) REFERENCES public.stack_respostas(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.stack_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  alvo_tipo text NOT NULL CHECK (alvo_tipo IN ('pergunta', 'resposta')),
  alvo_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, alvo_tipo, alvo_id)
);

CREATE TABLE IF NOT EXISTS public.stack_pergunta_tags (
  pergunta_id uuid NOT NULL REFERENCES public.stack_perguntas(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.stack_tags(id) ON DELETE RESTRICT,
  PRIMARY KEY (pergunta_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.stack_favoritos (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pergunta_id uuid NOT NULL REFERENCES public.stack_perguntas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pergunta_id)
);

CREATE TABLE IF NOT EXISTS public.stack_reaberturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta_id uuid NOT NULL REFERENCES public.stack_perguntas(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  motivo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stack_reaberturas_motivo_len CHECK (char_length(trim(motivo)) >= 3)
);

CREATE TABLE IF NOT EXISTS public.stack_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pergunta_id uuid NOT NULL REFERENCES public.stack_perguntas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  contador integer NOT NULL DEFAULT 1,
  mensagem text NOT NULL,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stack_perguntas_feed
  ON public.stack_perguntas (status, ultima_atividade_em DESC, upvote_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stack_perguntas_search
  ON public.stack_perguntas USING gin (search_vector);

CREATE INDEX IF NOT EXISTS idx_stack_respostas_pergunta
  ON public.stack_respostas (pergunta_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_stack_respostas_plain_fts
  ON public.stack_respostas USING gin (to_tsvector('portuguese', corpo_plain));

CREATE INDEX IF NOT EXISTS idx_stack_notificacoes_user
  ON public.stack_notificacoes (user_id, lida_em NULLS FIRST, updated_at DESC);

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS idx_stack_tags_rotulo_trgm
    ON public.stack_tags USING gin (rotulo gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- search_vector pergunta (título + corpo + tags)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stack_perguntas_refresh_search_vector(p_pergunta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text;
  v_plain text;
  v_tags text;
BEGIN
  SELECT p.titulo, p.corpo_plain
  INTO v_titulo, v_plain
  FROM public.stack_perguntas p
  WHERE p.id = p_pergunta_id;

  SELECT coalesce(string_agg(t.rotulo, ' '), '')
  INTO v_tags
  FROM public.stack_pergunta_tags pt
  JOIN public.stack_tags t ON t.id = pt.tag_id
  WHERE pt.pergunta_id = p_pergunta_id;

  UPDATE public.stack_perguntas p
  SET search_vector =
    setweight(to_tsvector('portuguese', coalesce(v_titulo, '')), 'A')
    || setweight(to_tsvector('portuguese', coalesce(v_tags, '')), 'A')
    || setweight(to_tsvector('portuguese', coalesce(v_plain, '')), 'B')
  WHERE p.id = p_pergunta_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_trg_pergunta_tags_search()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.stack_perguntas_refresh_search_vector(OLD.pergunta_id);
    RETURN OLD;
  END IF;
  PERFORM public.stack_perguntas_refresh_search_vector(NEW.pergunta_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stack_pergunta_tags_search_trg ON public.stack_pergunta_tags;
CREATE TRIGGER stack_pergunta_tags_search_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.stack_pergunta_tags
  FOR EACH ROW EXECUTE FUNCTION public.stack_trg_pergunta_tags_search();

CREATE OR REPLACE FUNCTION public.stack_trg_pergunta_search()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.corpo_plain := public.stack_html_to_plain(NEW.corpo_html);
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.ultima_atividade_em := coalesce(NEW.ultima_atividade_em, now());
  END IF;
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.titulo, '')), 'A')
    || setweight(to_tsvector('portuguese', coalesce(NEW.corpo_plain, '')), 'B');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stack_perguntas_search_trg ON public.stack_perguntas;
CREATE TRIGGER stack_perguntas_search_trg
  BEFORE INSERT OR UPDATE OF titulo, corpo_html ON public.stack_perguntas
  FOR EACH ROW EXECUTE FUNCTION public.stack_trg_pergunta_search();

CREATE OR REPLACE FUNCTION public.stack_trg_resposta_plain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.corpo_plain := public.stack_html_to_plain(NEW.corpo_html);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stack_respostas_plain_trg ON public.stack_respostas;
CREATE TRIGGER stack_respostas_plain_trg
  BEFORE INSERT OR UPDATE OF corpo_html ON public.stack_respostas
  FOR EACH ROW EXECUTE FUNCTION public.stack_trg_resposta_plain();

CREATE OR REPLACE FUNCTION public.stack_trg_resposta_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stack_perguntas p
    SET resposta_count = resposta_count + 1,
        ultima_atividade_em = now()
    WHERE p.id = NEW.pergunta_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.stack_perguntas p
    SET resposta_count = greatest(0, resposta_count - 1),
        ultima_atividade_em = now()
    WHERE p.id = OLD.pergunta_id;
    IF EXISTS (SELECT 1 FROM public.stack_perguntas p WHERE p.id = OLD.pergunta_id AND p.resposta_aceita_id = OLD.id) THEN
      UPDATE public.stack_perguntas SET resposta_aceita_id = NULL WHERE id = OLD.pergunta_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS stack_respostas_count_trg ON public.stack_respostas;
CREATE TRIGGER stack_respostas_count_trg
  AFTER INSERT OR DELETE ON public.stack_respostas
  FOR EACH ROW EXECUTE FUNCTION public.stack_trg_resposta_count();

-- RLS: leitura/escrita via RPC; bloquear acesso direto amador
ALTER TABLE public.stack_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_pergunta_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_reaberturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_notificacoes ENABLE ROW LEVEL SECURITY;

-- Tags legíveis para autocomplete
DROP POLICY IF EXISTS stack_tags_select ON public.stack_tags;
CREATE POLICY stack_tags_select ON public.stack_tags
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.stack_tags TO authenticated;

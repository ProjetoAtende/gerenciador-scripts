-- DB-3: Links Uteis (pastas_links + links_uteis)

CREATE OR REPLACE FUNCTION public.usuario_pode_acessar_equipe(p_equipe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_equipe_id IS NOT NULL
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.equipe_id = p_equipe_id
      )
      OR EXISTS (
        SELECT 1 FROM public.usuario_funcoes_equipe ufe
        WHERE ufe.user_id = auth.uid()
          AND ufe.equipe_id = p_equipe_id
          AND ufe.funcao = 'supervisor'
          AND coalesce(ufe.ativo, true)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.usuario_pode_acessar_equipe(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.pastas_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#3B82F6',
  icone text NOT NULL DEFAULT '🔗',
  ordem integer NOT NULL DEFAULT 0,
  equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.links_uteis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  url text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  pasta_id uuid REFERENCES public.pastas_links(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'Website',
  favicon_url text,
  site_title text,
  domain text,
  CONSTRAINT links_uteis_tipo_check CHECK (tipo IN ('Video', 'Documento', 'Website'))
);

CREATE INDEX IF NOT EXISTS idx_pastas_links_equipe_id ON public.pastas_links (equipe_id);
CREATE INDEX IF NOT EXISTS idx_pastas_links_ordem ON public.pastas_links (ordem);
CREATE INDEX IF NOT EXISTS idx_links_uteis_equipe ON public.links_uteis (equipe_id);
CREATE INDEX IF NOT EXISTS idx_links_uteis_pasta_id ON public.links_uteis (pasta_id);
CREATE INDEX IF NOT EXISTS idx_links_uteis_criado_em ON public.links_uteis (criado_em DESC);

ALTER TABLE public.pastas_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links_uteis ENABLE ROW LEVEL SECURITY;

-- pastas_links
DROP POLICY IF EXISTS pastas_links_select ON public.pastas_links;
CREATE POLICY pastas_links_select ON public.pastas_links
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_equipe(equipe_id));

DROP POLICY IF EXISTS pastas_links_insert ON public.pastas_links;
CREATE POLICY pastas_links_insert ON public.pastas_links
  FOR INSERT TO authenticated
  WITH CHECK (public.usuario_pode_acessar_equipe(equipe_id));

DROP POLICY IF EXISTS pastas_links_update ON public.pastas_links;
CREATE POLICY pastas_links_update ON public.pastas_links
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_equipe(equipe_id))
  WITH CHECK (public.usuario_pode_acessar_equipe(equipe_id));

DROP POLICY IF EXISTS pastas_links_delete ON public.pastas_links;
CREATE POLICY pastas_links_delete ON public.pastas_links
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_equipe(equipe_id));

-- links_uteis
DROP POLICY IF EXISTS links_uteis_select ON public.links_uteis;
CREATE POLICY links_uteis_select ON public.links_uteis
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_equipe(equipe_id));

DROP POLICY IF EXISTS links_uteis_insert ON public.links_uteis;
CREATE POLICY links_uteis_insert ON public.links_uteis
  FOR INSERT TO authenticated
  WITH CHECK (
    public.usuario_pode_acessar_equipe(equipe_id)
    AND (
      pasta_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pastas_links p
        WHERE p.id = pasta_id AND p.equipe_id = links_uteis.equipe_id
      )
    )
  );

DROP POLICY IF EXISTS links_uteis_update ON public.links_uteis;
CREATE POLICY links_uteis_update ON public.links_uteis
  FOR UPDATE TO authenticated
  USING (public.usuario_pode_acessar_equipe(equipe_id))
  WITH CHECK (
    public.usuario_pode_acessar_equipe(equipe_id)
    AND (
      pasta_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.pastas_links p
        WHERE p.id = pasta_id AND p.equipe_id = links_uteis.equipe_id
      )
    )
  );

DROP POLICY IF EXISTS links_uteis_delete ON public.links_uteis;
CREATE POLICY links_uteis_delete ON public.links_uteis
  FOR DELETE TO authenticated
  USING (public.usuario_pode_acessar_equipe(equipe_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pastas_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links_uteis TO authenticated;

COMMENT ON TABLE public.pastas_links IS 'Pastas de organizacao dos links uteis por equipe.';
COMMENT ON TABLE public.links_uteis IS 'Links uteis cadastrados pela equipe (URLs, metadados e tipo).';

-- Scripts Atende: coluna tem_conteudo_usuario_final + hierarquia de categorias (filtros/classificação)

-- ---------------------------------------------------------------------------
-- 1) Flag tem_conteudo_usuario_final (listagem / filtros de curadoria)
-- ---------------------------------------------------------------------------

ALTER TABLE public.scripts_customizados
  ADD COLUMN IF NOT EXISTS tem_conteudo_usuario_final boolean NOT NULL DEFAULT true;

UPDATE public.scripts_customizados
SET tem_conteudo_usuario_final = (
  conteudo_bruto IS NOT NULL
  AND TRIM(conteudo_bruto) != ''
  AND TRIM(conteudo_bruto) NOT IN ('<p></p>', '<p><br></p>', '<br>', '<p><br/></p>')
)
WHERE tem_conteudo_usuario_final IS DISTINCT FROM (
  conteudo_bruto IS NOT NULL
  AND TRIM(conteudo_bruto) != ''
  AND TRIM(conteudo_bruto) NOT IN ('<p></p>', '<p><br></p>', '<br>', '<p><br/></p>')
);

CREATE OR REPLACE FUNCTION public.sync_tem_conteudo_usuario_final()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.tem_conteudo_usuario_final := (
    NEW.conteudo_bruto IS NOT NULL
    AND TRIM(NEW.conteudo_bruto) != ''
    AND TRIM(NEW.conteudo_bruto) NOT IN ('<p></p>', '<p><br></p>', '<br>', '<p><br/></p>')
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_sync_tem_conteudo_usuario_final ON public.scripts_customizados;

CREATE TRIGGER trigger_sync_tem_conteudo_usuario_final
  BEFORE INSERT OR UPDATE OF conteudo_bruto
  ON public.scripts_customizados
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tem_conteudo_usuario_final();

CREATE INDEX IF NOT EXISTS idx_scripts_tem_conteudo_usuario_final
  ON public.scripts_customizados (tem_conteudo_usuario_final, curadoria_atuada, deletado)
  WHERE tem_conteudo_usuario_final = false;

COMMENT ON COLUMN public.scripts_customizados.tem_conteudo_usuario_final IS
  'Flag sincronizada por trigger. TRUE quando conteudo_bruto não é vazio/placeholder HTML.';

-- ---------------------------------------------------------------------------
-- 2) Hierarquia categorias_equipe → categorias_gse → subcategorias_gse
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.categorias_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  nome text NOT NULL,
  descricao text,
  equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  cor_hex text DEFAULT '#6B7280',
  icone text DEFAULT '📋',
  ativo boolean DEFAULT true,
  ordem_exibicao integer DEFAULT 99,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now(),
  CONSTRAINT uq_categoria_equipe_slug UNIQUE (equipe_id, slug)
);

CREATE TABLE IF NOT EXISTS public.categorias_gse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  nome text NOT NULL,
  descricao text,
  gse text NOT NULL,
  categoria_equipe_id uuid NOT NULL REFERENCES public.categorias_equipe(id) ON DELETE CASCADE,
  cor_hex text DEFAULT '#9CA3AF',
  icone text DEFAULT '🏷️',
  ativo boolean DEFAULT true,
  ordem_exibicao integer DEFAULT 99,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now(),
  CONSTRAINT uq_categoria_gse_slug UNIQUE (gse, slug)
);

CREATE TABLE IF NOT EXISTS public.subcategorias_gse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  nome text NOT NULL,
  descricao text,
  categoria_gse_id uuid NOT NULL REFERENCES public.categorias_gse(id) ON DELETE CASCADE,
  sinonimos text[] DEFAULT '{}',
  ativo boolean DEFAULT true,
  ordem_exibicao integer DEFAULT 99,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now(),
  CONSTRAINT uq_subcategoria_gse_slug UNIQUE (categoria_gse_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_categorias_equipe_equipe
  ON public.categorias_equipe (equipe_id) WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_categorias_gse_equipe
  ON public.categorias_gse (categoria_equipe_id) WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_subcategorias_gse_categoria
  ON public.subcategorias_gse (categoria_gse_id) WHERE ativo = true;

ALTER TABLE public.categorias_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_gse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategorias_gse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categorias_equipe_select ON public.categorias_equipe;
CREATE POLICY categorias_equipe_select ON public.categorias_equipe
  FOR SELECT TO authenticated USING (ativo = true);

DROP POLICY IF EXISTS categorias_gse_select ON public.categorias_gse;
CREATE POLICY categorias_gse_select ON public.categorias_gse
  FOR SELECT TO authenticated USING (ativo = true);

DROP POLICY IF EXISTS subcategorias_gse_select ON public.subcategorias_gse;
CREATE POLICY subcategorias_gse_select ON public.subcategorias_gse
  FOR SELECT TO authenticated USING (ativo = true);

GRANT SELECT ON public.categorias_equipe TO authenticated;
GRANT SELECT ON public.categorias_gse TO authenticated;
GRANT SELECT ON public.subcategorias_gse TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) RPC hierarquia (Scripts modal + auto-classificação)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.obter_hierarquia_categorias(p_equipe_id uuid)
RETURNS TABLE(
  categoria_equipe_id uuid,
  categoria_equipe_slug text,
  categoria_equipe_nome text,
  categoria_equipe_cor text,
  categoria_equipe_icone text,
  categoria_gse_id uuid,
  categoria_gse_slug text,
  categoria_gse_nome text,
  categoria_gse_gse text,
  subcategoria_gse_id uuid,
  subcategoria_gse_slug text,
  subcategoria_gse_nome text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ce.id, ce.slug, ce.nome, ce.cor_hex, ce.icone,
    cg.id, cg.slug, cg.nome, cg.gse,
    sg.id, sg.slug, sg.nome
  FROM categorias_equipe ce
  LEFT JOIN categorias_gse cg ON cg.categoria_equipe_id = ce.id AND cg.ativo = true
  LEFT JOIN subcategorias_gse sg ON sg.categoria_gse_id = cg.id AND sg.ativo = true
  WHERE ce.equipe_id = p_equipe_id AND ce.ativo = true
  ORDER BY ce.ordem_exibicao, cg.ordem_exibicao, sg.ordem_exibicao;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.obter_hierarquia_categorias(uuid) TO authenticated;

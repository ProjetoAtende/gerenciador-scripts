-- DB-5 (parte 1): Scripts — tabelas, índices, view, RLS base

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- Pastas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pastas_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text DEFAULT '#3B82F6',
  icone text DEFAULT '📁',
  ordem integer,
  equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  criado_em timestamptz DEFAULT now(),
  pasta_pai_id uuid REFERENCES public.pastas_scripts(id) ON DELETE SET NULL,
  habilitado_smith boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_pastas_scripts_equipe_id ON public.pastas_scripts (equipe_id);
CREATE INDEX IF NOT EXISTS idx_pastas_scripts_ordem ON public.pastas_scripts (ordem);
CREATE INDEX IF NOT EXISTS idx_pastas_scripts_pasta_pai_id ON public.pastas_scripts (pasta_pai_id);

-- ---------------------------------------------------------------------------
-- Scripts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scripts_customizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  conteudo_bruto text NOT NULL,
  criado_em timestamptz DEFAULT now(),
  ordem integer,
  equipe_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  pasta_id uuid REFERENCES public.pastas_scripts(id) ON DELETE SET NULL,
  curadoria_atuada boolean DEFAULT false,
  pergunta text,
  numero_chamado varchar(50),
  email_enviado boolean DEFAULT false,
  email_curadoria_enviado boolean DEFAULT false,
  habilitado_smith boolean DEFAULT true,
  criado_por uuid REFERENCES auth.users(id),
  equipe_autor_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  conteudo_original text,
  modificado_curadoria boolean DEFAULT false,
  data_curadoria timestamptz,
  deletado boolean DEFAULT false,
  deletado_em timestamptz,
  deletado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  motivo_exclusao text,
  exclusao_pendente boolean DEFAULT false,
  exclusao_solicitada_em timestamptz,
  exclusao_solicitada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  desativado_em timestamptz,
  temporario boolean DEFAULT false,
  tipo_requisitante text,
  curadoria_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conteudo_atendente text,
  tem_conteudo_atendente boolean DEFAULT false NOT NULL,
  criado_por_atendente uuid REFERENCES auth.users(id),
  categoria_equipe_slug text,
  subcategoria_gse_slug text,
  categoria_confianca numeric(3,2),
  subcategoria_confianca numeric(3,2),
  classificacao_origem text DEFAULT 'ia',
  classificacao_em timestamptz,
  classificacao_por uuid,
  classificacao_pendente boolean DEFAULT false,
  tem_proposta_pendente boolean DEFAULT false NOT NULL,
  numero_referencia integer NOT NULL,
  n1 boolean,
  validado_n1 boolean DEFAULT false,
  validado_n1_por uuid REFERENCES auth.users(id),
  validado_n1_em timestamptz,
  enviado_n1 boolean DEFAULT false,
  enviado_n1_por uuid REFERENCES auth.users(id),
  enviado_n1_em timestamptz,
  dominio text,
  instancia text,
  CONSTRAINT uq_scripts_numero_referencia UNIQUE (numero_referencia),
  CONSTRAINT chk_classificacao_origem CHECK (
    classificacao_origem = ANY (ARRAY['ia'::text, 'ia_incremental'::text, 'manual'::text])
  ),
  CONSTRAINT chk_scripts_dominio CHECK (dominio IS NULL OR dominio = ANY (ARRAY['externo'::text, 'interno'::text])),
  CONSTRAINT chk_scripts_instancia CHECK (
    instancia IS NULL
    OR instancia IN ('1G', '2G', 'ColRec', 'Externo (1G/2G)')
  )
);

CREATE INDEX IF NOT EXISTS idx_scripts_customizados_equipe ON public.scripts_customizados (equipe_id);
CREATE INDEX IF NOT EXISTS idx_scripts_customizados_pasta_id ON public.scripts_customizados (pasta_id);
CREATE INDEX IF NOT EXISTS idx_scripts_equipe_nao_deletado ON public.scripts_customizados (equipe_id)
  WHERE (deletado = false OR deletado IS NULL);
CREATE INDEX IF NOT EXISTS idx_scripts_exclusao_pendente ON public.scripts_customizados (exclusao_pendente)
  WHERE exclusao_pendente = true;
CREATE INDEX IF NOT EXISTS idx_scripts_curadoria_atuada ON public.scripts_customizados (curadoria_atuada)
  WHERE curadoria_atuada = false;
CREATE INDEX IF NOT EXISTS idx_scripts_conteudo_trgm ON public.scripts_customizados USING gin (conteudo_bruto gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_scripts_nome_trgm ON public.scripts_customizados USING gin (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_scripts_fts ON public.scripts_customizados USING gin (
  to_tsvector(
    'portuguese'::regconfig,
    COALESCE(nome, '') || ' ' || COALESCE(pergunta, '') || ' ' || COALESCE(conteudo_bruto, '')
  )
);

-- ---------------------------------------------------------------------------
-- Versionamento / curadoria
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.script_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES public.scripts_customizados(id) ON DELETE CASCADE,
  campo_alvo text NOT NULL,
  numero_versao integer NOT NULL,
  conteudo text NOT NULL,
  conteudo_anterior text,
  motivacao text NOT NULL,
  tipo_motivacao text NOT NULL,
  autor_id uuid NOT NULL REFERENCES auth.users(id),
  aprovado_por uuid REFERENCES auth.users(id),
  revisado_em timestamptz,
  criado_em timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT script_versoes_script_id_campo_alvo_numero_versao_key
    UNIQUE (script_id, campo_alvo, numero_versao),
  CONSTRAINT script_versoes_campo_alvo_check CHECK (
    campo_alvo = ANY (ARRAY['usuario_final'::text, 'atendente'::text])
  ),
  CONSTRAINT script_versoes_numero_versao_check CHECK (numero_versao >= 1),
  CONSTRAINT script_versoes_tipo_motivacao_check CHECK (
    tipo_motivacao = ANY (
      ARRAY[
        'criacao'::text, 'proposta_aprovada'::text, 'proposta_aprovada_editada'::text,
        'correcao_grafia'::text, 'substantiva'::text, 'atualizacao_normativa'::text, 'outro'::text
      ]
    )
  )
);

CREATE TABLE IF NOT EXISTS public.script_propostas_revisao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES public.scripts_customizados(id) ON DELETE CASCADE,
  campo_alvo text NOT NULL,
  conteudo_proposto text NOT NULL,
  motivacao text NOT NULL,
  autor_id uuid NOT NULL REFERENCES auth.users(id),
  status text DEFAULT 'pendente' NOT NULL,
  razao_rejeicao text,
  decidido_por uuid REFERENCES auth.users(id),
  decidido_em timestamptz,
  versao_gerada integer,
  tentativa integer DEFAULT 1 NOT NULL,
  criado_em timestamptz DEFAULT now() NOT NULL,
  atualizado_em timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT script_propostas_revisao_campo_alvo_check CHECK (
    campo_alvo = ANY (ARRAY['usuario_final'::text, 'atendente'::text])
  ),
  CONSTRAINT script_propostas_revisao_motivacao_check CHECK (char_length(motivacao) >= 20),
  CONSTRAINT script_propostas_revisao_status_check CHECK (
    status = ANY (ARRAY['pendente'::text, 'aprovada'::text, 'rejeitada'::text, 'em_revisao'::text])
  ),
  CONSTRAINT script_propostas_revisao_tentativa_check CHECK (tentativa >= 1 AND tentativa <= 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uma_proposta_ativa_por_script
  ON public.script_propostas_revisao (script_id)
  WHERE status = ANY (ARRAY['pendente'::text, 'em_revisao'::text]);

CREATE TABLE IF NOT EXISTS public.script_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id uuid NOT NULL REFERENCES auth.users(id),
  script_id uuid NOT NULL REFERENCES public.scripts_customizados(id) ON DELETE CASCADE,
  proposta_id uuid REFERENCES public.script_propostas_revisao(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  mensagem text NOT NULL,
  lida boolean DEFAULT false NOT NULL,
  lida_em timestamptz,
  acao_executada boolean DEFAULT false NOT NULL,
  acao_executada_em timestamptz,
  metadata jsonb,
  criado_em timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT script_notificacoes_tipo_check CHECK (
    tipo = ANY (
      ARRAY[
        'proposta_recebida'::text, 'proposta_aprovada'::text, 'proposta_rejeitada'::text,
        'nova_versao_curadoria'::text, 'proposta_reenviada'::text,
        'script_revisado_com_proposta_pendente'::text, 'curadoria_inicial'::text,
        'contestacao_revisao_inicial'::text, 'script_publicado'::text
      ]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_script_notif_destinatario
  ON public.script_notificacoes (destinatario_id, lida, criado_em DESC);

CREATE TABLE IF NOT EXISTS public.scripts_categorias_adicionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES public.scripts_customizados(id) ON DELETE CASCADE,
  categoria_equipe_slug text NOT NULL,
  subcategoria_gse_slug text,
  origem text DEFAULT 'ia',
  confianca numeric(3,2),
  criado_em timestamptz DEFAULT now(),
  CONSTRAINT scripts_categorias_adicionais_origem_check CHECK (
    origem = ANY (ARRAY['ia'::text, 'ia_incremental'::text, 'manual'::text])
  ),
  CONSTRAINT uq_scripts_cat_adicional_hierarquica
    UNIQUE (script_id, categoria_equipe_slug, subcategoria_gse_slug)
);

CREATE INDEX IF NOT EXISTS idx_scripts_cat_adicional_script ON public.scripts_categorias_adicionais (script_id);

-- ---------------------------------------------------------------------------
-- Exclusão
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificacoes_exclusao_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL,
  script_nome text NOT NULL,
  admin_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  solicitante_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  motivo text,
  lida boolean DEFAULT false,
  lida_em timestamptz,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scripts_exclusao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid REFERENCES public.scripts_customizados(id) ON DELETE SET NULL,
  tipo_exclusao varchar(20) NOT NULL,
  solicitante_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  motivo text,
  dados_script jsonb,
  criado_em timestamptz DEFAULT now(),
  CONSTRAINT scripts_exclusao_log_tipo_exclusao_check CHECK (
    tipo_exclusao::text = ANY (
      ARRAY['hard'::varchar, 'soft'::varchar, 'aprovada'::varchar, 'negada'::varchar, 'reativada'::varchar]::text[]
    )
  )
);

CREATE OR REPLACE VIEW public.scripts_pendentes_exclusao AS
SELECT
  s.id,
  s.nome,
  s.numero_chamado,
  s.equipe_id,
  s.exclusao_solicitada_em,
  s.motivo_exclusao,
  s.pasta_id,
  u.email AS solicitante_email,
  u.nome AS perfil_solicitante,
  e.nome AS equipe_nome,
  p.nome AS pasta_nome
FROM public.scripts_customizados s
LEFT JOIN public.users u ON s.exclusao_solicitada_por = u.id
LEFT JOIN public.equipes e ON s.equipe_id = e.id
LEFT JOIN public.pastas_scripts p ON s.pasta_id = p.id
WHERE s.exclusao_pendente = true
ORDER BY s.exclusao_solicitada_em DESC;

-- ---------------------------------------------------------------------------
-- Curadoria (permissoes, não equipes fixas)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_curadoria_team()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.tem_permissao('scripts.curadoria_acesso');
$$;

GRANT EXECUTE ON FUNCTION public.is_curadoria_team() TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.pastas_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts_customizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_propostas_revisao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts_categorias_adicionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_exclusao_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pastas_scripts_select ON public.pastas_scripts;
CREATE POLICY pastas_scripts_select ON public.pastas_scripts
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_equipe(equipe_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS pastas_scripts_write ON public.pastas_scripts;
CREATE POLICY pastas_scripts_write ON public.pastas_scripts
  FOR ALL TO authenticated
  USING (public.usuario_pode_acessar_equipe(equipe_id) OR public.is_admin(auth.uid()))
  WITH CHECK (public.usuario_pode_acessar_equipe(equipe_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS scripts_select_ativos ON public.scripts_customizados;
CREATE POLICY scripts_select_ativos ON public.scripts_customizados
  FOR SELECT TO authenticated
  USING (
    (deletado = false OR deletado IS NULL)
    AND (
      public.is_admin(auth.uid())
      OR equipe_id IS NULL
      OR public.usuario_pode_acessar_equipe(equipe_id)
    )
  );

DROP POLICY IF EXISTS scripts_select_desativados_curadoria ON public.scripts_customizados;
CREATE POLICY scripts_select_desativados_curadoria ON public.scripts_customizados
  FOR SELECT TO authenticated
  USING (public.is_curadoria_team() AND deletado = true);

DROP POLICY IF EXISTS scripts_select_exclusao_pendente ON public.scripts_customizados;
CREATE POLICY scripts_select_exclusao_pendente ON public.scripts_customizados
  FOR SELECT TO authenticated
  USING (exclusao_pendente = true AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS scripts_insert_equipe ON public.scripts_customizados;
CREATE POLICY scripts_insert_equipe ON public.scripts_customizados
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (equipe_id IS NOT NULL AND public.usuario_pode_acessar_equipe(equipe_id))
  );

DROP POLICY IF EXISTS scripts_update_equipe ON public.scripts_customizados;
CREATE POLICY scripts_update_equipe ON public.scripts_customizados
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (equipe_id IS NOT NULL AND public.usuario_pode_acessar_equipe(equipe_id))
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (equipe_id IS NOT NULL AND public.usuario_pode_acessar_equipe(equipe_id))
  );

DROP POLICY IF EXISTS scripts_delete_admin ON public.scripts_customizados;
CREATE POLICY scripts_delete_admin ON public.scripts_customizados
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS script_versoes_select ON public.script_versoes;
CREATE POLICY script_versoes_select ON public.script_versoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS propostas_select ON public.script_propostas_revisao;
CREATE POLICY propostas_select ON public.script_propostas_revisao
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS propostas_insert ON public.script_propostas_revisao;
CREATE POLICY propostas_insert ON public.script_propostas_revisao
  FOR INSERT TO authenticated WITH CHECK (autor_id = auth.uid());

DROP POLICY IF EXISTS notificacoes_select_proprio ON public.script_notificacoes;
CREATE POLICY notificacoes_select_proprio ON public.script_notificacoes
  FOR SELECT TO authenticated USING (destinatario_id = auth.uid());

DROP POLICY IF EXISTS notificacoes_update_lida ON public.script_notificacoes;
CREATE POLICY notificacoes_update_lida ON public.script_notificacoes
  FOR UPDATE TO authenticated
  USING (destinatario_id = auth.uid())
  WITH CHECK (destinatario_id = auth.uid());

DROP POLICY IF EXISTS scripts_cat_adicional_all ON public.scripts_categorias_adicionais;
CREATE POLICY scripts_cat_adicional_all ON public.scripts_categorias_adicionais
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scripts_customizados sc
      WHERE sc.id = script_id
        AND (
          public.is_admin(auth.uid())
          OR (sc.equipe_id IS NOT NULL AND public.usuario_pode_acessar_equipe(sc.equipe_id))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scripts_customizados sc
      WHERE sc.id = script_id
        AND (
          public.is_admin(auth.uid())
          OR (sc.equipe_id IS NOT NULL AND public.usuario_pode_acessar_equipe(sc.equipe_id))
        )
    )
  );

DROP POLICY IF EXISTS notif_exclusao_select ON public.notificacoes_exclusao_scripts;
CREATE POLICY notif_exclusao_select ON public.notificacoes_exclusao_scripts
  FOR SELECT TO authenticated USING (admin_id = auth.uid());

DROP POLICY IF EXISTS notif_exclusao_update ON public.notificacoes_exclusao_scripts;
CREATE POLICY notif_exclusao_update ON public.notificacoes_exclusao_scripts
  FOR UPDATE TO authenticated USING (admin_id = auth.uid());

DROP POLICY IF EXISTS notif_exclusao_insert ON public.notificacoes_exclusao_scripts;
CREATE POLICY notif_exclusao_insert ON public.notificacoes_exclusao_scripts
  FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pastas_scripts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scripts_customizados TO authenticated;
GRANT SELECT ON public.script_versoes TO authenticated;
GRANT SELECT, INSERT ON public.script_propostas_revisao TO authenticated;
GRANT SELECT, UPDATE ON public.script_notificacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scripts_categorias_adicionais TO authenticated;
GRANT SELECT, UPDATE, INSERT ON public.notificacoes_exclusao_scripts TO authenticated;
GRANT SELECT, INSERT ON public.scripts_exclusao_log TO authenticated;
GRANT SELECT ON public.scripts_pendentes_exclusao TO authenticated;

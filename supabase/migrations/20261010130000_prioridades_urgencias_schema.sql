-- App "Prioridades e Urgências" — schema do domínio.
--
-- Baseado na Especificação Técnica v1.0 (out/2026), seções 4, 5, 7 e 8.
-- Decisões tomadas onde o documento deixou lacuna estão marcadas com
-- [DECISÃO] e precisam de homologação da STI.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. UPJs (Unidades de Processamento Judicial)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prioridades_upjs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Código legível usado nos painéis e no roteamento (ex.: 'FCC-01-05').
  codigo        text NOT NULL UNIQUE,
  nome          text NOT NULL,
  -- Foro/comarca de atuação — compõe o nome exibido.
  foro          text,
  ativa         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.prioridades_upjs IS
  'UPJs destinatárias das anotações. Parametrizável para expansão a outras unidades (RNF-07).';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Correspondência Órgão/Vara → UPJ (RF-ATD-04)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prioridades_orgaos_upj (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- idOrgao devolvido pela API do DJEN (Comunica PJe) no campo `idOrgao`.
  -- É a chave estável: o nome do órgão varia de grafia entre unidades.
  id_orgao_djen bigint UNIQUE,
  -- Nome do órgão como devolvido pelo DJEN (campo `nomeOrgao`), preservado para auditoria.
  nome_orgao_djen text,
  -- Número da Vara (1 a 45 na unidade-piloto). Nulo quando o DJEN agrupa
  -- diretamente por UPJ e não há Vara individual identificável.
  vara          integer,
  upj_id        uuid NOT NULL REFERENCES public.prioridades_upjs(id) ON DELETE RESTRICT,
  ativo         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prioridades_orgaos_upj_vara_faixa
    CHECK (vara IS NULL OR vara BETWEEN 1 AND 999)
);

CREATE INDEX IF NOT EXISTS prioridades_orgaos_upj_upj_idx
  ON public.prioridades_orgaos_upj (upj_id);

COMMENT ON TABLE public.prioridades_orgaos_upj IS
  'RF-ATD-04. Tabela parametrizável de correspondência. ATENÇÃO: a especificação prevê lookup "Vara → UPJ", mas a API do DJEN devolve idOrgao + nomeOrgao. O nomeOrgao do Fórum Central Cível já vem no formato "UPJ da 26ª a 30ª Varas Cíveis - Foro Central Cível", ou seja, o próprio órgão já é a UPJ. Por isso a chave de detecção é id_orgao_djen, e `vara` fica como dado auxiliar de exibição/normalização.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Perfis de usuário no app (decisão: tabela própria, sem tocar em user_role)
-- ─────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.prioridades_perfil_tipo AS ENUM (
    'atendente',
    'gestor',
    'conferente',
    'coordenador',
    'analista'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.prioridades_usuarios_perfil (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Referencia public.users (Gerenciador). Um usuário tem no máximo um perfil no app.
  usuario_id        uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  perfil            public.prioridades_perfil_tipo NOT NULL,
  -- Vínculo à UPJ. Obrigatório para coordenador/analista; nulo para os demais.
  upj_id            uuid REFERENCES public.prioridades_upjs(id) ON DELETE RESTRICT,
  matricula         text,
  -- RF-GES-07: participação na distribuição round-robin.
  vinculacao_automatica boolean NOT NULL DEFAULT true,
  ativo             boolean NOT NULL DEFAULT true,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  -- [DECISÃO] O documento não define o vínculo usuário→UPJ (lacuna apontada na
  -- seção 8.4). Regra adotada: coordenador e analista exigem UPJ; os demais não.
  CONSTRAINT prioridades_usuarios_perfil_upj_obrigatoria
    CHECK (
      (perfil IN ('coordenador', 'analista') AND upj_id IS NOT NULL)
      OR (perfil IN ('atendente', 'gestor', 'conferente'))
    )
);

CREATE INDEX IF NOT EXISTS prioridades_usuarios_perfil_upj_idx
  ON public.prioridades_usuarios_perfil (upj_id)
  WHERE ativo;

CREATE INDEX IF NOT EXISTS prioridades_usuarios_perfil_perfil_idx
  ON public.prioridades_usuarios_perfil (perfil)
  WHERE ativo;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Anotações — entidade central (seção 8.1 + lacunas da 8.4)
-- ─────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.prioridades_status AS ENUM (
    'gestor-conferencia',
    'gestor-aprovada',
    'gestor-devolvida',
    'gestor-rejeitada',
    'upj-pendente',
    'upj-reiterada',
    'upj-analisada',
    'upj-resolvida',
    'upj-devolvida',
    'upj-rejeitada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.prioridades_anotacoes (
  id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status                    public.prioridades_status NOT NULL DEFAULT 'gestor-conferencia',

  -- Criador: atendente, gestor ou conferente (quem registrou).
  criador_id                uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  criador_nome              text NOT NULL,
  criador_perfil            public.prioridades_perfil_tipo NOT NULL,
  data_anotacao             timestamptz NOT NULL DEFAULT now(),

  -- Processo (RF-ATD-01/02/03)
  processo                  text NOT NULL,
  vara                      integer,
  upj_id                    uuid REFERENCES public.prioridades_upjs(id) ON DELETE RESTRICT,
  plataforma                text CHECK (plataforma IS NULL OR plataforma IN ('eproc', 'saj')),
  -- Rastreio da validação externa (RF-ATD-03).
  validacao_djen_status     text NOT NULL DEFAULT 'nao_consultado'
                            CHECK (validacao_djen_status IN
                              ('nao_consultado', 'localizado', 'sem_comunicacao', 'erro')),
  validacao_djen_em         timestamptz,
  validacao_djen_detalhe    text,
  id_orgao_djen             bigint,
  nome_orgao_djen           text,

  -- Classificação (RF-ATD-05/06/08/09)
  tipo_solicitante          text NOT NULL CHECK (tipo_solicitante IN
                              ('autor-exequente', 'reu-executado', 'perito-leiloeiro',
                               'arrematante-alienante', 'terceiro-interessado', 'outros')),
  -- Lacuna 8.4: campo exigido pelo RF-ATD-05 quando tipo_solicitante = 'outros'.
  descricao_solicitante     text,
  tipo_prioridade           text NOT NULL CHECK (tipo_prioridade IN
                              ('urgencia-determinada', 'prazo-excedido', 'fora-localizador',
                               'erro-material', 'medico-saude', 'prioridade-doenca',
                               'prioridade-pcd', 'prioridade-idoso', 'outros')),
  -- Lacuna 8.4 / pendência 7: rótulo diferenciado do campo principal.
  descricao_tipo_outros     text,
  evento_folha              text NOT NULL,
  descricao_prioridade      text NOT NULL,
  -- RF-ATD-10: uso interno do TJSP Atende, oculto à UPJ.
  observacao_adicional_atende text,

  -- Conferência (RF-GES-01..05)
  data_remessa_gestor       timestamptz,
  conferente_vinculado_id   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  conferente_vinculado_nome text,
  conferido_por_id          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  conferido_por_nome        text,
  justificativa_devolucao_gestor text,
  justificativa_rejeicao_gestor  text,
  correcao_automatica       boolean NOT NULL DEFAULT false,
  -- Lacuna 8.4: o schema mínimo só previa o boolean da correção automática.
  texto_correcao_automatica text,
  -- RF-GES-03: texto original preservado ao corrigir na conferência.
  observacao_adicional_gestor text,
  urgentissimo              boolean NOT NULL DEFAULT false,

  -- Remessa e análise na UPJ (RF-UPJ-01..04)
  data_remessa_upj          timestamptz,
  analista_vinculado_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  analista_vinculado_nome   text,
  analisado_por_id          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  analisado_por_nome        text,
  justificativa_devolucao_upj text,
  justificativa_rejeicao_upj  text,
  observacao_adicional_upj  text,
  arquivamento_automatico   boolean NOT NULL DEFAULT false,

  -- Prazo de 24 h (RF-ATD-15 / RF-UPJ-04 / RF-GER-06)
  devolvida_por             text CHECK (devolvida_por IS NULL OR devolvida_por IN ('gestor', 'upj')),
  data_devolucao            timestamptz,
  prazo_resposta_em         timestamptz,
  resposta_atendente        text,
  respondida_em             timestamptz,

  criado_em                 timestamptz NOT NULL DEFAULT now(),
  atualizado_em             timestamptz NOT NULL DEFAULT now()
);

-- RF-ATD-12: indicador de anotações prévias do mesmo processo nos últimos 120 dias.
CREATE INDEX IF NOT EXISTS prioridades_anotacoes_processo_data_idx
  ON public.prioridades_anotacoes (processo, data_anotacao DESC);

CREATE INDEX IF NOT EXISTS prioridades_anotacoes_status_idx
  ON public.prioridades_anotacoes (status);

CREATE INDEX IF NOT EXISTS prioridades_anotacoes_upj_status_idx
  ON public.prioridades_anotacoes (upj_id, status);

CREATE INDEX IF NOT EXISTS prioridades_anotacoes_criador_idx
  ON public.prioridades_anotacoes (criador_id, data_anotacao DESC);

CREATE INDEX IF NOT EXISTS prioridades_anotacoes_conferente_idx
  ON public.prioridades_anotacoes (conferente_vinculado_id)
  WHERE conferente_vinculado_id IS NOT NULL;

-- RF-GER-06: o temporizador varre apenas o que está devolvido e vencido.
CREATE INDEX IF NOT EXISTS prioridades_anotacoes_prazo_idx
  ON public.prioridades_anotacoes (prazo_resposta_em)
  WHERE status IN ('gestor-devolvida', 'upj-devolvida');

COMMENT ON COLUMN public.prioridades_anotacoes.processo IS
  'RF-ATD-01: armazenado como texto, 20 dígitos sem máscara. A máscara CNJ é aplicada na exibição.';

COMMENT ON COLUMN public.prioridades_anotacoes.observacao_adicional_atende IS
  'RF-ATD-10: nunca deve ser exposta no módulo UPJs (RF-GER-02). A RLS e a camada de serviço precisam garantir isso — a coluna não é filtrada automaticamente pelo Postgres.';

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Histórico de eventos (RF-GER-04, seção 8.5)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prioridades_anotacoes_historico (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  anotacao_id   bigint NOT NULL REFERENCES public.prioridades_anotacoes(id) ON DELETE CASCADE,
  status_anterior public.prioridades_status,
  status_novo   public.prioridades_status NOT NULL,
  evento        text NOT NULL,
  autor_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  autor_nome    text,
  autor_perfil  public.prioridades_perfil_tipo,
  -- Conteúdo da transição: justificativa, resposta, texto da correção.
  conteudo      text,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prioridades_historico_anotacao_idx
  ON public.prioridades_anotacoes_historico (anotacao_id, criado_em DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Designações (RF-GES-06 / RF-UPJ-05, seção 8.5)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prioridades_designacoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  designante_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  perfil        public.prioridades_perfil_tipo NOT NULL,
  upj_id        uuid REFERENCES public.prioridades_upjs(id) ON DELETE CASCADE,
  -- Período da designação: data final nula = "Indeterminado" no wireframe.
  inicio_em     date NOT NULL DEFAULT CURRENT_DATE,
  fim_em        date,
  ativa         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prioridades_designacoes_periodo
    CHECK (fim_em IS NULL OR fim_em >= inicio_em)
);

CREATE INDEX IF NOT EXISTS prioridades_designacoes_usuario_idx
  ON public.prioridades_designacoes (usuario_id)
  WHERE ativa;

CREATE INDEX IF NOT EXISTS prioridades_designacoes_upj_idx
  ON public.prioridades_designacoes (upj_id)
  WHERE ativa;

COMMIT;

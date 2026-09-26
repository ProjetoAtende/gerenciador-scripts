-- Fix tabelas com DEFAULT referenciando colunas (incompatível com DDL direto)
-- Aplica: tickets, insight, e re-executa funções/views que dependem deles

SET search_path TO public, extensions;

-- ============ TABELA: public.tickets ============
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero_chamado text NOT NULL,
  gse text NOT NULL,
  tempo_espera_origem timestamp without time zone NOT NULL,
  usuario_atual uuid,
  status text DEFAULT 'aguardando'::text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  version integer DEFAULT 1,
  descricao text,
  assigned_at timestamp with time zone,
  vip boolean NOT NULL DEFAULT false,
  email text,
  is_reopened boolean DEFAULT false,
  started_at timestamp without time zone,
  finished_at timestamp without time zone,
  suspenso boolean NOT NULL DEFAULT false,
  causa_suspensao text,
  comentario text,
  resposta_ia text,
  origem text DEFAULT 'email'::text,
  mantido_por uuid,
  mantido_at timestamp with time zone,
  search_vector_descricao tsvector,
  chamado_global_id uuid,
  resposta_ia_editado_por_id uuid,
  resposta_ia_editado_por_nome text,
  resposta_ia_editado_em timestamp with time zone,
  PRIMARY KEY (id)
);

-- Trigger para search_vector_descricao
CREATE OR REPLACE FUNCTION public.tickets_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector_descricao := to_tsvector('portuguese'::regconfig, extensions.unaccent(COALESCE(NEW.descricao, ''::text)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tickets_search_vector ON public.tickets;
CREATE TRIGGER trg_tickets_search_vector BEFORE INSERT OR UPDATE OF descricao ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.tickets_search_vector_trigger();

-- ============ TABELA: public.insight ============
CREATE TABLE IF NOT EXISTS public.insight (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero_processo text NOT NULL,
  classe text NOT NULL,
  assunto text NOT NULL,
  partes text NOT NULL,
  localidade text NOT NULL,
  secretaria text NOT NULL,
  data_autuacao timestamp without time zone NOT NULL,
  data_upload timestamp without time zone DEFAULT now(),
  user_id uuid,
  ano_autuacao integer,
  mes_autuacao integer,
  competencia text,
  jurisdicao text,
  PRIMARY KEY (id)
);

-- Trigger para preencher ano/mes automaticamente
CREATE OR REPLACE FUNCTION public.insight_auto_ano_mes() RETURNS trigger AS $$
BEGIN
  NEW.ano_autuacao := EXTRACT(year FROM NEW.data_autuacao);
  NEW.mes_autuacao := EXTRACT(month FROM NEW.data_autuacao);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insight_ano_mes ON public.insight;
CREATE TRIGGER trg_insight_ano_mes BEFORE INSERT OR UPDATE OF data_autuacao ON public.insight FOR EACH ROW EXECUTE FUNCTION public.insight_auto_ano_mes();

-- ============ Agora re-executar funções/views que dependiam dessas tabelas ============
-- As funções que falharam na primeira execução serão re-aplicadas

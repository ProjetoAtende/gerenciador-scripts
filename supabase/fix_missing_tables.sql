-- Fix: Criar schemas extras se não existirem 
-- NOTA: Schema oraculo migrado para public (tabelas oraculo_chamados, oraculo_configuracao, oraculo_mv_stats_diario)
-- NOTA: Schema knowledge_base migrado para public (tabelas kb_documentos, kb_segmentos, kb_qa_pairs)
CREATE SCHEMA IF NOT EXISTS task_manager;

GRANT USAGE ON SCHEMA task_manager TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA task_manager TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA task_manager TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA task_manager TO anon, authenticated, service_role;

-- Fix: oraculo_chamados (sem defaults com column reference)
CREATE SEQUENCE IF NOT EXISTS oraculo_chamados_id_seq;

CREATE TABLE IF NOT EXISTS oraculo_chamados (
  id bigint NOT NULL DEFAULT nextval('oraculo_chamados_id_seq'::regclass),
  numero_chamado text NOT NULL,
  data_abertura date NOT NULL,
  grupo_designado text NOT NULL,
  descricao text NOT NULL,
  solucao text NOT NULL DEFAULT ''::text,
  search_vector_descricao tsvector,
  search_vector_solucao tsvector,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  email text,
  cpf text,
  nome_designado text,
  designado_email text,
  designado_localizacao text,
  status_operacional text,
  qtd_rejeite integer DEFAULT 0,
  atendido_externo boolean DEFAULT false,
  PRIMARY KEY (id)
);

ALTER SEQUENCE oraculo_chamados_id_seq OWNED BY oraculo_chamados.id;

-- Fix: oraculo_configuracao (migrado de oraculo.configuracao)
CREATE TABLE IF NOT EXISTS oraculo_configuracao (
  id integer NOT NULL DEFAULT 1,
  data_criacao_lista timestamp with time zone,
  atualizado_por text,
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Unique constraint necessário
DO $$ BEGIN
  ALTER TABLE oraculo_chamados ADD CONSTRAINT chamados_numero_chamado_key UNIQUE (numero_chamado);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trigger para search vectors
CREATE OR REPLACE FUNCTION oraculo_chamados_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector_descricao := to_tsvector('portuguese'::regconfig, COALESCE(NEW.descricao, ''));
  NEW.search_vector_solucao := to_tsvector('portuguese'::regconfig, COALESCE(NEW.solucao, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chamados_search_vectors ON oraculo_chamados;
CREATE TRIGGER trg_chamados_search_vectors BEFORE INSERT OR UPDATE ON oraculo_chamados FOR EACH ROW EXECUTE FUNCTION oraculo_chamados_search_vector_trigger();

-- Materialized view oraculo_mv_stats_diario (depende de oraculo_chamados)
CREATE MATERIALIZED VIEW IF NOT EXISTS oraculo_mv_stats_diario AS
 SELECT c.data_abertura,
    c.grupo_designado,
    lower(TRIM(BOTH FROM c.nome_designado)) AS nome_designado_lower,
    min(initcap(TRIM(BOTH FROM c.nome_designado))) AS nome_designado_display,
    c.designado_localizacao,
    COALESCE(c.status_operacional, 'Sem Status'::text) AS status_operacional,
    lower(TRIM(BOTH FROM c.email)) AS email_lower,
    c.atendido_externo,
    (count(*))::integer AS total_tickets,
    (count(*) FILTER (WHERE ((c.solucao IS NOT NULL) AND (TRIM(BOTH FROM c.solucao) <> ''::text) AND (TRIM(BOTH FROM c.solucao) <> '-'::text))))::integer AS total_com_solucao,
    (count(*) FILTER (WHERE ((c.solucao IS NULL) OR (TRIM(BOTH FROM c.solucao) = ''::text) OR (TRIM(BOTH FROM c.solucao) = '-'::text))))::integer AS total_sem_solucao,
    (sum(COALESCE(c.qtd_rejeite, 0)))::integer AS total_rejeites,
    (count(*) FILTER (WHERE (c.qtd_rejeite > 0)))::integer AS tickets_com_rejeite,
    (count(*) FILTER (WHERE (c.status_operacional = ANY (ARRAY['Fechado'::text, 'Aguardando Aceite Definitivo'::text]))))::integer AS total_atendidos
   FROM oraculo_chamados c
  GROUP BY c.data_abertura, c.grupo_designado, (lower(TRIM(BOTH FROM c.nome_designado))), c.designado_localizacao, COALESCE(c.status_operacional, 'Sem Status'::text), (lower(TRIM(BOTH FROM c.email))), c.atendido_externo
WITH NO DATA;

-- Grants para tabelas oraculo migradas para public
GRANT SELECT ON oraculo_chamados TO anon, authenticated;
GRANT ALL ON oraculo_chamados TO service_role;
GRANT SELECT ON oraculo_configuracao TO anon, authenticated;
GRANT ALL ON oraculo_configuracao TO service_role;
GRANT SELECT ON oraculo_mv_stats_diario TO anon, authenticated;
GRANT ALL ON oraculo_mv_stats_diario TO service_role;
GRANT ALL ON SEQUENCE oraculo_chamados_id_seq TO anon, authenticated, service_role;

-- NOTA: Seção knowledge_base removida — tabelas migradas para public como kb_documentos, kb_segmentos, kb_qa_pairs
-- Triggers e FKs agora estão definidos em extra_schemas_dump.sql com prefixo kb_
-- Ver: docs/MIGRACAO_KNOWLEDGE_BASE_PARA_PUBLIC.md

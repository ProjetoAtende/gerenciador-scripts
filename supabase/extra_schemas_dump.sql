-- Extra schemas dump via Management API
-- Generated: 2026-04-01T14:14:18.412Z

SET search_path TO public, extensions;

-- =====================================================
-- NOTA: O schema `oraculo` foi migrado para `public`.
-- Tabelas: oraculo_chamados, oraculo_configuracao
-- MV: oraculo_mv_stats_diario
-- Data da migracao: 2026-04-01
-- Documento: docs/MIGRACAO_ORACULO_PARA_PUBLIC.md
-- =====================================================

-- =====================================================
-- NOTA: O schema `knowledge_base` foi migrado para `public`.
-- Tabelas: kb_documentos, kb_segmentos, kb_qa_pairs
-- Funções: kb_buscar_conhecimento, kb_obter_estatisticas, etc.
-- Data da migracao: 2026-04-01
-- Documento: docs/MIGRACAO_KNOWLEDGE_BASE_PARA_PUBLIC.md
-- =====================================================

-- ====== Tabelas kb_* (ex-knowledge_base) em public ======

CREATE TABLE IF NOT EXISTS public."kb_documentos" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "titulo" text NOT NULL,
  "tipo_documento" text NOT NULL,
  "categoria" text,
  "versao" text DEFAULT '1.0'::text,
  "arquivo_nome" text,
  "arquivo_tipo" text,
  "arquivo_caminho" text,
  "autor" text,
  "descricao" text,
  "data_criacao" date,
  "data_atualizacao" date,
  "tags" text[],
  "ativo" boolean DEFAULT true,
  "prioridade" integer DEFAULT 5,
  "total_segmentos" integer DEFAULT 0,
  "total_caracteres" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "url_fonte" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."kb_qa_pairs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "documento_id" uuid NOT NULL,
  "segmento_id" uuid,
  "pergunta" text NOT NULL,
  "resposta" text NOT NULL,
  "perguntas_similares" text[],
  "search_vector" tsvector,
  "tipo" text,
  "relevancia" integer DEFAULT 5,
  "vezes_retornada" integer DEFAULT 0,
  "avaliacao_positiva" integer DEFAULT 0,
  "avaliacao_negativa" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."kb_segmentos" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "documento_id" uuid NOT NULL,
  "titulo_secao" text,
  "conteudo" text NOT NULL,
  "contexto" text,
  "ordem" integer NOT NULL,
  "nivel" integer DEFAULT 1,
  "caracteres" integer,
  "palavras_chave" text[],
  "search_vector" tsvector,
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id")
);
DO $$ BEGIN ALTER TABLE public.kb_qa_pairs ADD CONSTRAINT "kb_qa_pairs_documento_id_fkey" FOREIGN KEY (documento_id) REFERENCES public.kb_documentos(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kb_qa_pairs ADD CONSTRAINT "kb_qa_pairs_segmento_id_fkey" FOREIGN KEY (segmento_id) REFERENCES public.kb_segmentos(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kb_segmentos ADD CONSTRAINT "kb_segmentos_documento_id_fkey" FOREIGN KEY (documento_id) REFERENCES public.kb_documentos(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_kb_docs_tipo ON public.kb_documentos USING btree (tipo_documento) WHERE (ativo = true);
CREATE INDEX IF NOT EXISTS idx_kb_docs_categoria ON public.kb_documentos USING btree (categoria) WHERE (ativo = true);
CREATE INDEX IF NOT EXISTS idx_kb_docs_ativo ON public.kb_documentos USING btree (ativo) WHERE (ativo = true);
CREATE INDEX IF NOT EXISTS idx_kb_docs_tags ON public.kb_documentos USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_kb_docs_prioridade ON public.kb_documentos USING btree (prioridade DESC) WHERE (ativo = true);
CREATE INDEX IF NOT EXISTS idx_kb_seg_doc_id ON public.kb_segmentos USING btree (documento_id);
CREATE INDEX IF NOT EXISTS idx_kb_seg_ordem ON public.kb_segmentos USING btree (documento_id, ordem);
CREATE INDEX IF NOT EXISTS idx_kb_seg_fts ON public.kb_segmentos USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_kb_seg_trgm_conteudo ON public.kb_segmentos USING gin (conteudo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_kb_seg_trgm_titulo ON public.kb_segmentos USING gin (titulo_secao gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_kb_seg_palavras ON public.kb_segmentos USING gin (palavras_chave);
CREATE INDEX IF NOT EXISTS idx_kb_qa_doc_id ON public.kb_qa_pairs USING btree (documento_id);
CREATE INDEX IF NOT EXISTS idx_kb_qa_seg_id ON public.kb_qa_pairs USING btree (segmento_id);
CREATE INDEX IF NOT EXISTS idx_kb_qa_fts ON public.kb_qa_pairs USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_kb_qa_trgm_pergunta ON public.kb_qa_pairs USING gin (pergunta gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_kb_qa_relevancia ON public.kb_qa_pairs USING btree (relevancia DESC);
CREATE OR REPLACE FUNCTION public.kb_buscar_conhecimento(p_query text, p_limit integer DEFAULT 5, p_tipo_documento text DEFAULT NULL::text, p_categoria text DEFAULT NULL::text, p_buscar_qa boolean DEFAULT true, p_buscar_segmentos boolean DEFAULT true, p_arquivo_nome text DEFAULT NULL::text)
 RETURNS TABLE(tipo text, id uuid, titulo text, conteudo text, documento_id uuid, documento_titulo text, documento_tipo text, documento_categoria text, arquivo_nome text, url_fonte text, relevancia real, contexto_adicional text, metadados jsonb)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_tsquery TSQUERY;
  v_clean_query TEXT;
  v_unaccent_query TEXT;
  v_stop_words TEXT[] := ARRAY['o', 'a', 'os', 'as', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'ao', 'aos', 'pelo', 'pela', 'pelos', 'pelas', 'que', 'qual', 'quais', 'como', 'quando', 'onde', 'se', 'mais', 'menos', 'muito', 'pouco', 'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas', 'aquele', 'aquela', 'aqueles', 'aquelas', 'um', 'uma', 'uns', 'umas', 'diz', 'disse', 'dizer', 'referente', 'referentes', 'numa', 'sao'];
  v_word TEXT;
  v_words TEXT[];
  v_important_words TEXT[];
BEGIN
  v_clean_query := lower(trim(regexp_replace(p_query, '[^\w\sáàâãéèêíïóôõöúçñ]', ' ', 'g')));
  v_clean_query := regexp_replace(v_clean_query, '\s+', ' ', 'g');
  v_unaccent_query := unaccent(v_clean_query);
  v_words := regexp_split_to_array(v_unaccent_query, '\s+');
  
  v_important_words := ARRAY[]::TEXT[];
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF length(v_word) >= 3 AND NOT (v_word = ANY(v_stop_words)) THEN
      v_important_words := array_append(v_important_words, v_word);
    END IF;
  END LOOP;

  IF array_length(v_important_words, 1) > 0 THEN
    v_unaccent_query := array_to_string(v_important_words, ' ');
  END IF;

  BEGIN
    IF array_length(v_important_words, 1) > 0 THEN
      v_tsquery := to_tsquery('portuguese', array_to_string(v_important_words, ' | '));
    ELSE
      v_tsquery := plainto_tsquery('portuguese', unaccent(p_query));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_tsquery := plainto_tsquery('portuguese', v_unaccent_query);
    EXCEPTION WHEN OTHERS THEN
      IF array_length(v_important_words, 1) > 0 THEN
        v_tsquery := plainto_tsquery('portuguese', v_important_words[1]);
      ELSE
        v_tsquery := plainto_tsquery('portuguese', unaccent(p_query));
      END IF;
    END;
  END;

  IF p_buscar_qa THEN
    RETURN QUERY
    SELECT 'qa'::TEXT, qa.id, qa.pergunta, qa.resposta, qa.documento_id,
      d.titulo, d.tipo_documento, d.categoria, d.arquivo_nome, d.url_fonte,
      ((ts_rank_cd(qa.search_vector, v_tsquery, 32) * 2.0) +
       (similarity(unaccent(qa.pergunta), v_unaccent_query) * 1.5) +
       (similarity(unaccent(qa.resposta), v_unaccent_query) * 0.5) +
       (qa.relevancia / 10.0) +
       (CASE WHEN qa.vezes_retornada > 0 THEN LEAST((qa.avaliacao_positiva::FLOAT / NULLIF(qa.vezes_retornada, 0)) * 0.5, 0.5) ELSE 0 END) +
       (d.prioridade / 20.0))::REAL,
      COALESCE(CASE WHEN qa.perguntas_similares IS NOT NULL AND array_length(qa.perguntas_similares, 1) > 0 THEN array_to_string(qa.perguntas_similares, ' | ') ELSE '' END, ''),
      jsonb_build_object('tipo_qa', qa.tipo, 'relevancia_config', qa.relevancia, 'vezes_retornada', qa.vezes_retornada, 'avaliacao_positiva', qa.avaliacao_positiva, 'avaliacao_negativa', qa.avaliacao_negativa, 'segmento_id', qa.segmento_id)
    FROM kb_qa_pairs qa
    JOIN kb_documentos d ON qa.documento_id = d.id
    WHERE d.ativo = true
      AND (p_tipo_documento IS NULL OR d.tipo_documento = p_tipo_documento)
      AND (p_categoria IS NULL OR d.categoria = p_categoria)
      AND (p_arquivo_nome IS NULL OR d.arquivo_nome = p_arquivo_nome)
      AND (qa.search_vector @@ v_tsquery OR similarity(unaccent(qa.pergunta), v_unaccent_query) > 0.2 OR similarity(unaccent(qa.resposta), v_unaccent_query) > 0.2);
  END IF;

  IF p_buscar_segmentos THEN
    RETURN QUERY
    SELECT 'segmento'::TEXT, seg.id, COALESCE(seg.titulo_secao, 'Sem título'), seg.conteudo, seg.documento_id,
      d.titulo, d.tipo_documento, d.categoria, d.arquivo_nome, d.url_fonte,
      ((ts_rank_cd(seg.search_vector, v_tsquery, 32) * 1.5) +
       (similarity(unaccent(seg.conteudo), v_unaccent_query) * 1.0) +
       (CASE WHEN seg.titulo_secao IS NOT NULL THEN similarity(unaccent(seg.titulo_secao), v_unaccent_query) * 0.8 ELSE 0 END) +
       (d.prioridade / 20.0) +
       (CASE WHEN seg.nivel <= 2 THEN 0.2 ELSE 0 END))::REAL,
      COALESCE(seg.contexto, ''),
      jsonb_build_object('ordem', seg.ordem, 'nivel', seg.nivel, 'caracteres', seg.caracteres, 'palavras_chave', seg.palavras_chave)
    FROM kb_segmentos seg
    JOIN kb_documentos d ON seg.documento_id = d.id
    WHERE d.ativo = true
      AND (p_tipo_documento IS NULL OR d.tipo_documento = p_tipo_documento)
      AND (p_categoria IS NULL OR d.categoria = p_categoria)
      AND (p_arquivo_nome IS NULL OR d.arquivo_nome = p_arquivo_nome)
      AND (seg.search_vector @@ v_tsquery OR similarity(unaccent(seg.conteudo), v_unaccent_query) > 0.2 OR (seg.titulo_secao IS NOT NULL AND similarity(unaccent(seg.titulo_secao), v_unaccent_query) > 0.2));
  END IF;

  RETURN;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.kb_buscar_por_palavras_chave(p_palavras text[], p_limit integer DEFAULT 10)
 RETURNS TABLE(tipo text, id uuid, titulo text, conteudo text, documento_titulo text, matches integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    'segmento'::TEXT,
    seg.id,
    COALESCE(seg.titulo_secao, 'Sem título'),
    seg.conteudo,
    d.titulo,
    (
      SELECT COUNT(*)::INTEGER
      FROM unnest(p_palavras) palavra
      WHERE seg.palavras_chave @> ARRAY[palavra]
    ) as matches
  FROM kb_segmentos seg
  JOIN kb_documentos d ON seg.documento_id = d.id
  WHERE
    d.ativo = true
    AND seg.palavras_chave && p_palavras

  UNION ALL

  SELECT
    'documento'::TEXT,
    d.id,
    d.titulo,
    COALESCE(d.descricao, ''),
    d.titulo,
    (
      SELECT COUNT(*)::INTEGER
      FROM unnest(p_palavras) palavra
      WHERE d.tags @> ARRAY[palavra]
    ) as matches
  FROM kb_documentos d
  WHERE
    d.ativo = true
    AND d.tags && p_palavras

  ORDER BY matches DESC
  LIMIT p_limit;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.kb_listar_documentos(p_tipo_documento text DEFAULT NULL::text, p_categoria text DEFAULT NULL::text, p_apenas_ativos boolean DEFAULT true)
 RETURNS TABLE(id uuid, titulo text, tipo_documento text, categoria text, arquivo_nome text, versao text, tags text[], total_segmentos integer, total_caracteres integer, prioridade integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.titulo,
    d.tipo_documento,
    d.categoria,
    d.arquivo_nome,
    d.versao,
    d.tags,
    d.total_segmentos,
    d.total_caracteres,
    d.prioridade,
    d.created_at
  FROM kb_documentos d
  WHERE
    (NOT p_apenas_ativos OR d.ativo = true)
    AND (p_tipo_documento IS NULL OR d.tipo_documento = p_tipo_documento)
    AND (p_categoria IS NULL OR d.categoria = p_categoria)
  ORDER BY d.prioridade DESC, d.created_at DESC;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.kb_obter_estatisticas()
 RETURNS TABLE(total_documentos bigint, documentos_ativos bigint, total_segmentos bigint, total_qa_pairs bigint, total_caracteres bigint, tipos_documento jsonb, categorias jsonb)
 LANGUAGE plpgsql
 STABLE
AS $function$
  BEGIN
    RETURN QUERY
    SELECT
      COUNT(*)::BIGINT as total_documentos,
      COUNT(*) FILTER (WHERE d.ativo = true)::BIGINT as documentos_ativos,
      SUM(d.total_segmentos)::BIGINT as total_segmentos,
      (SELECT COUNT(*)::BIGINT FROM kb_qa_pairs) as total_qa_pairs,
      SUM(d.total_caracteres)::BIGINT as total_caracteres,
      (
        SELECT jsonb_object_agg(tipo_documento, cnt)
        FROM (
          SELECT tipo_documento, COUNT(*) as cnt
          FROM kb_documentos
          WHERE ativo = true
          GROUP BY tipo_documento
        ) tipos
      ) as tipos_documento,
      (
        SELECT jsonb_object_agg(categoria, cnt)
        FROM (
          SELECT COALESCE(categoria, 'sem_categoria') as categoria, COUNT(*) as cnt
          FROM kb_documentos
          WHERE ativo = true
          GROUP BY categoria
        ) cats
      ) as categorias
    FROM kb_documentos d;
  END;
  $function$
;
CREATE OR REPLACE FUNCTION public.kb_registrar_feedback_qa(p_qa_id uuid, p_positivo boolean)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF p_positivo THEN
    UPDATE kb_qa_pairs
    SET avaliacao_positiva = avaliacao_positiva + 1
    WHERE id = p_qa_id;
  ELSE
    UPDATE kb_qa_pairs
    SET avaliacao_negativa = avaliacao_negativa + 1
    WHERE id = p_qa_id;
  END IF;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.kb_registrar_uso_qa(p_qa_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE kb_qa_pairs
  SET vezes_retornada = vezes_retornada + 1
  WHERE id = ANY(p_qa_ids);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.kb_update_documento_stats()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE kb_documentos
    SET
      total_segmentos = total_segmentos + 1,
      total_caracteres = total_caracteres + LENGTH(NEW.conteudo)
    WHERE id = NEW.documento_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE kb_documentos
    SET
      total_segmentos = GREATEST(total_segmentos - 1, 0),
      total_caracteres = GREATEST(total_caracteres - LENGTH(OLD.conteudo), 0)
    WHERE id = OLD.documento_id;
  END IF;
  RETURN NULL;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.kb_update_qa_search_vector()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.pergunta, '')), 'A') ||
    setweight(
      to_tsvector('portuguese',
        CASE
          WHEN NEW.perguntas_similares IS NOT NULL AND array_length(NEW.perguntas_similares, 1) > 0
          THEN array_to_string(NEW.perguntas_similares, ' ')
          ELSE ''
        END
      ),
      'A'
    ) ||
    setweight(to_tsvector('portuguese', coalesce(NEW.resposta, '')), 'B');
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.kb_update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.kb_segmentos_search_vector_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', COALESCE(NEW.titulo_secao, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.conteudo, '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.contexto, '')), 'C');
  RETURN NEW;
END;
$function$
;
CREATE TRIGGER "trigger_kb_docs_updated" BEFORE UPDATE ON public."kb_documentos" FOR EACH ROW EXECUTE FUNCTION public.kb_update_updated_at();
CREATE TRIGGER "trigger_kb_qa_search_vector" BEFORE INSERT OR UPDATE ON public."kb_qa_pairs" FOR EACH ROW EXECUTE FUNCTION public.kb_update_qa_search_vector();
CREATE TRIGGER "trigger_kb_qa_updated" BEFORE UPDATE ON public."kb_qa_pairs" FOR EACH ROW EXECUTE FUNCTION public.kb_update_updated_at();
CREATE TRIGGER "trigger_kb_seg_stats" AFTER INSERT OR DELETE ON public."kb_segmentos" FOR EACH ROW EXECUTE FUNCTION public.kb_update_documento_stats();
CREATE TRIGGER "trg_kb_seg_search_vector" BEFORE INSERT OR UPDATE ON public."kb_segmentos" FOR EACH ROW EXECUTE FUNCTION public.kb_segmentos_search_vector_trigger();
ALTER TABLE public."kb_documentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."kb_segmentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."kb_qa_pairs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir escrita autenticada kb_documentos" ON public."kb_documentos" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura autenticada kb_documentos" ON public."kb_documentos" AS PERMISSIVE FOR SELECT TO authenticated USING ((ativo = true));
CREATE POLICY "Permitir escrita autenticada kb_segmentos" ON public."kb_segmentos" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura autenticada kb_segmentos" ON public."kb_segmentos" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir escrita autenticada kb_qa_pairs" ON public."kb_qa_pairs" AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura autenticada kb_qa_pairs" ON public."kb_qa_pairs" AS PERMISSIVE FOR SELECT TO authenticated USING (true);

-- ====== Schema: task_manager ======
CREATE SCHEMA IF NOT EXISTS task_manager;


CREATE TABLE IF NOT EXISTS task_manager."activity_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "task_id" uuid,
  "project_id" uuid,
  "action" text NOT NULL,
  "details" jsonb,
  "timestamp" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS task_manager."comments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid,
  "user_id" uuid NOT NULL,
  "content" text NOT NULL,
  "parent_comment_id" uuid,
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS task_manager."notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "type" notification_type NOT NULL,
  "title" text NOT NULL,
  "message" text,
  "task_id" uuid,
  "project_id" uuid,
  "triggered_by" uuid,
  "is_read" boolean DEFAULT false,
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS task_manager."profiles" (
  "id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "avatar_url" text,
  "email" text NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS task_manager."project_members" (
  "project_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text DEFAULT 'member'::text,
  "joined_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("project_id", "user_id")
);

CREATE TABLE IF NOT EXISTS task_manager."projects" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "owner_id" uuid NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS task_manager."task_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid,
  "user_id" uuid,
  "assigned_by" uuid NOT NULL,
  "assigned_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS task_manager."task_dependencies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid,
  "depends_on_task_id" uuid,
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS task_manager."task_steps" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid,
  "name" text NOT NULL,
  "description" text,
  "is_completed" boolean DEFAULT false,
  "step_order" integer NOT NULL,
  "completed_by" uuid,
  "completed_at" timestamp without time zone,
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS task_manager."tasks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "project_id" uuid,
  "status" task_status DEFAULT 'não_iniciada'::task_status,
  "created_by" uuid NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS task_manager."user_metrics" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "project_id" uuid,
  "tasks_completed" integer DEFAULT 0,
  "tasks_in_progress" integer DEFAULT 0,
  "average_completion_time" interval,
  "last_activity" timestamp without time zone,
  "calculated_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS task_manager."webhooks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "events" text[] NOT NULL,
  "active" boolean DEFAULT true,
  "secret_key" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);
DO $$ BEGIN ALTER TABLE task_manager.activity_log ADD CONSTRAINT "activity_log_project_id_fkey" FOREIGN KEY (project_id) REFERENCES task_manager.projects(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.activity_log ADD CONSTRAINT "activity_log_task_id_fkey" FOREIGN KEY (task_id) REFERENCES task_manager.tasks(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.activity_log ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES task_manager.profiles(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.comments ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY (parent_comment_id) REFERENCES task_manager.comments(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.comments ADD CONSTRAINT "comments_task_id_fkey" FOREIGN KEY (task_id) REFERENCES task_manager.tasks(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.comments ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES task_manager.profiles(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.notifications ADD CONSTRAINT "notifications_project_id_fkey" FOREIGN KEY (project_id) REFERENCES task_manager.projects(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.notifications ADD CONSTRAINT "notifications_task_id_fkey" FOREIGN KEY (task_id) REFERENCES task_manager.tasks(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.notifications ADD CONSTRAINT "notifications_triggered_by_fkey" FOREIGN KEY (triggered_by) REFERENCES task_manager.profiles(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.notifications ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES task_manager.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.profiles ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.project_members ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY (project_id) REFERENCES task_manager.projects(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.project_members ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES task_manager.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.projects ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES task_manager.profiles(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.task_assignments ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY (task_id) REFERENCES task_manager.tasks(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.task_assignments ADD CONSTRAINT "task_assignments_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES task_manager.profiles(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.task_assignments ADD CONSTRAINT "task_assignments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES task_manager.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.task_dependencies ADD CONSTRAINT "task_dependencies_depends_on_task_id_fkey" FOREIGN KEY (depends_on_task_id) REFERENCES task_manager.tasks(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.task_dependencies ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY (task_id) REFERENCES task_manager.tasks(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.tasks ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY (created_by) REFERENCES task_manager.profiles(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.tasks ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY (project_id) REFERENCES task_manager.projects(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.task_steps ADD CONSTRAINT "task_steps_task_id_fkey" FOREIGN KEY (task_id) REFERENCES task_manager.tasks(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.task_steps ADD CONSTRAINT "task_steps_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES task_manager.profiles(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.user_metrics ADD CONSTRAINT "user_metrics_project_id_fkey" FOREIGN KEY (project_id) REFERENCES task_manager.projects(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.user_metrics ADD CONSTRAINT "user_metrics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES task_manager.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.webhooks ADD CONSTRAINT "webhooks_created_by_fkey" FOREIGN KEY (created_by) REFERENCES task_manager.profiles(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_manager.webhooks ADD CONSTRAINT "webhooks_project_id_fkey" FOREIGN KEY (project_id) REFERENCES task_manager.projects(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE task_manager."project_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_manager."activity_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_manager."task_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_manager."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_manager."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_manager."projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_manager."task_dependencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_manager."task_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_manager."comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_manager."webhooks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_manager."user_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_manager."tasks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON task_manager."project_members" AS PERMISSIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON task_manager."activity_log" AS PERMISSIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON task_manager."task_assignments" AS PERMISSIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON task_manager."profiles" AS PERMISSIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON task_manager."notifications" AS PERMISSIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON task_manager."projects" AS PERMISSIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON task_manager."task_dependencies" AS PERMISSIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON task_manager."task_steps" AS PERMISSIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON task_manager."comments" AS PERMISSIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON task_manager."webhooks" AS PERMISSIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON task_manager."user_metrics" AS PERMISSIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON task_manager."tasks" AS PERMISSIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA task_manager TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA task_manager TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA task_manager TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA task_manager TO anon, authenticated, service_role;

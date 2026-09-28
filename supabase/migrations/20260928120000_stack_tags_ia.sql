-- Atende Stack: tags por IA assíncronas, filtro AND, nuvem de chips, staff/regenerar

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

ALTER TABLE public.stack_perguntas
  ADD COLUMN IF NOT EXISTS tags_status text NOT NULL DEFAULT 'none'
  CONSTRAINT stack_perguntas_tags_status_check
  CHECK (tags_status IN ('none', 'pending', 'ready', 'failed'));

UPDATE public.stack_perguntas p
SET tags_status = 'ready'
WHERE tags_status = 'none'
  AND EXISTS (SELECT 1 FROM public.stack_pergunta_tags pt WHERE pt.pergunta_id = p.id);

INSERT INTO public.stack_tags (slug, rotulo)
VALUES ('sem-classificacao', 'Sem classificação')
ON CONFLICT (slug) DO UPDATE SET rotulo = EXCLUDED.rotulo;

CREATE TABLE IF NOT EXISTS public.stack_tag_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta_id uuid NOT NULL REFERENCES public.stack_perguntas(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed', 'superseded')),
  motivo text NOT NULL CHECK (motivo IN ('criacao', 'edicao', 'regeneracao')),
  content_hash text NOT NULL,
  tentativas int NOT NULL DEFAULT 0,
  ultimo_erro text,
  catalogo_snapshot jsonb,
  resposta_ia jsonb,
  tags_resolvidas uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_stack_tag_jobs_pending_created
  ON public.stack_tag_jobs (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_stack_tag_jobs_pergunta_created
  ON public.stack_tag_jobs (pergunta_id, created_at DESC);

ALTER TABLE public.stack_tag_jobs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stack_pergunta_corpo_hash(p_corpo_html text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(
    extensions.digest(coalesce(public.stack_html_to_plain(p_corpo_html), ''), 'sha256'),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.stack_tag_sem_classificacao_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.stack_tags WHERE slug = 'sem-classificacao' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.stack_deepseek_extract_content(p_resp jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(trim(p_resp #>> '{choices,0,message,content}'), ''),
    nullif(trim(p_resp #>> '{choices,0,message,reasoning_content}'), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.stack_ia_parse_json_object(p_raw text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := trim(coalesce(p_raw, ''));
  v_match text[];
BEGIN
  IF v = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN v::jsonb;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  v_match := regexp_match(v, '```(?:json)?\s*([\s\S]*?)```', 'i');
  IF v_match IS NOT NULL THEN
    BEGIN
      RETURN trim(v_match[1])::jsonb;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  v_match := regexp_match(v, '(\{[\s\S]*\})');
  IF v_match IS NOT NULL THEN
    BEGIN
      RETURN v_match[1]::jsonb;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_enqueue_tag_job(
  p_pergunta_id uuid,
  p_motivo text,
  p_content_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.stack_tag_jobs
  SET status = 'superseded', finished_at = now()
  WHERE pergunta_id = p_pergunta_id
    AND status IN ('pending', 'processing');

  INSERT INTO public.stack_tag_jobs (pergunta_id, motivo, content_hash)
  VALUES (p_pergunta_id, p_motivo, p_content_hash)
  RETURNING id INTO v_id;

  UPDATE public.stack_perguntas
  SET tags_status = 'pending'
  WHERE id = p_pergunta_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_montar_catalogo_tags(
  p_titulo text,
  p_corpo_plain text,
  p_limit int DEFAULT 120
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH needle AS (
    SELECT trim(coalesce(p_titulo, '') || ' ' || left(coalesce(p_corpo_plain, ''), 2000)) AS q
  ),
  ranked AS (
    SELECT
      t.id,
      t.slug,
      t.rotulo,
      count(pt.pergunta_id)::int AS uso_count,
      similarity(t.rotulo, (SELECT q FROM needle)) AS sim
    FROM public.stack_tags t
    LEFT JOIN public.stack_pergunta_tags pt ON pt.tag_id = t.id
    WHERE t.slug <> 'sem-classificacao'
    GROUP BY t.id, t.slug, t.rotulo
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'slug', r.slug,
        'rotulo', r.rotulo,
        'uso_count', r.uso_count
      )
      ORDER BY r.sim DESC NULLS LAST, r.uso_count DESC, r.rotulo
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT * FROM ranked
    ORDER BY sim DESC NULLS LAST, uso_count DESC, rotulo
    LIMIT least(greatest(coalesce(p_limit, 120), 1), 200)
  ) r;
$$;

CREATE OR REPLACE FUNCTION public.stack_resolver_tags_ia(
  p_parsed jsonb,
  p_catalogo jsonb
)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_elem jsonb;
  v_modo text;
  v_id uuid;
  v_rotulo text;
  v_slug text;
  v_out uuid[] := '{}';
  v_cat_id uuid;
BEGIN
  IF p_parsed IS NULL OR jsonb_typeof(p_parsed -> 'tags') <> 'array' THEN
    RETURN v_out;
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_parsed -> 'tags')
  LOOP
    v_modo := lower(trim(coalesce(v_elem ->> 'modo', '')));
    v_id := NULL;
    v_rotulo := trim(coalesce(v_elem ->> 'rotulo', ''));

    IF v_modo = 'existente' AND (v_elem ? 'id') THEN
      BEGIN
        v_cat_id := (v_elem ->> 'id')::uuid;
        IF EXISTS (
          SELECT 1 FROM jsonb_array_elements(p_catalogo) c
          WHERE (c ->> 'id')::uuid = v_cat_id
        ) THEN
          v_id := v_cat_id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_id := NULL;
      END;
    END IF;

    IF v_id IS NULL AND v_rotulo <> '' THEN
      SELECT t.id INTO v_id
      FROM public.stack_tags t
      WHERE t.slug <> 'sem-classificacao'
        AND (lower(t.rotulo) = lower(v_rotulo) OR t.slug = public.stack_tag_slug(v_rotulo))
      LIMIT 1;
    END IF;

    IF v_id IS NULL AND v_modo = 'nova' AND v_rotulo <> '' THEN
      v_id := public.stack_tag_obter_ou_criar(v_rotulo);
    END IF;

    IF v_id IS NOT NULL AND v_id IS DISTINCT FROM public.stack_tag_sem_classificacao_id() THEN
      IF NOT v_id = ANY (v_out) THEN
        v_out := array_append(v_out, v_id);
      END IF;
    END IF;
  END LOOP;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_aplicar_tags_pergunta(
  p_pergunta_id uuid,
  p_tag_ids uuid[],
  p_tags_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.stack_pergunta_tags WHERE pergunta_id = p_pergunta_id;

  IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) IS NOT NULL THEN
    INSERT INTO public.stack_pergunta_tags (pergunta_id, tag_id)
    SELECT p_pergunta_id, unnest(p_tag_ids)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.stack_perguntas
  SET tags_status = p_tags_status
  WHERE id = p_pergunta_id;

  PERFORM public.stack_perguntas_refresh_search_vector(p_pergunta_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_aplicar_fallback_sem_classificacao(p_pergunta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fallback uuid := public.stack_tag_sem_classificacao_id();
BEGIN
  PERFORM public.stack_aplicar_tags_pergunta(
    p_pergunta_id,
    ARRAY[v_fallback],
    'failed'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Worker IA
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stack_processar_tag_job(
  p_job_id uuid DEFAULT NULL,
  p_pergunta_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_job public.stack_tag_jobs%ROWTYPE;
  v_p public.stack_perguntas%ROWTYPE;
  v_plain text;
  v_catalog jsonb;
  v_messages jsonb;
  v_resp jsonb;
  v_raw text;
  v_parsed jsonb;
  v_tag_ids uuid[];
  v_max int := 3;
  v_system text;
  v_user text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_job_id IS NOT NULL THEN
    SELECT * INTO v_job FROM public.stack_tag_jobs WHERE id = p_job_id FOR UPDATE;
  ELSIF p_pergunta_id IS NOT NULL THEN
    SELECT * INTO v_job
    FROM public.stack_tag_jobs
    WHERE pergunta_id = p_pergunta_id AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT * INTO v_job
    FROM public.stack_tag_jobs
    WHERE status = 'pending'
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_pending_job');
  END IF;

  SELECT * INTO v_p FROM public.stack_perguntas WHERE id = v_job.pergunta_id;
  IF NOT FOUND THEN
    UPDATE public.stack_tag_jobs SET status = 'failed', ultimo_erro = 'pergunta_missing', finished_at = now()
    WHERE id = v_job.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'pergunta_missing');
  END IF;

  IF v_p.autor_id IS DISTINCT FROM auth.uid() AND NOT public.stack_is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para processar tags desta pergunta';
  END IF;

  IF public.stack_pergunta_corpo_hash(v_p.corpo_html) IS DISTINCT FROM v_job.content_hash THEN
    UPDATE public.stack_tag_jobs
    SET status = 'superseded', finished_at = now(), ultimo_erro = 'content_hash_obsoleto'
    WHERE id = v_job.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'superseded_hash');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.stack_tag_jobs j
    WHERE j.pergunta_id = v_job.pergunta_id
      AND j.status = 'pending'
      AND j.created_at > v_job.created_at
  ) THEN
    UPDATE public.stack_tag_jobs
    SET status = 'superseded', finished_at = now(), ultimo_erro = 'job_mais_novo'
    WHERE id = v_job.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'superseded_newer');
  END IF;

  UPDATE public.stack_tag_jobs
  SET status = 'processing', started_at = coalesce(started_at, now()), tentativas = tentativas + 1
  WHERE id = v_job.id;

  v_job.tentativas := v_job.tentativas + 1;

  v_plain := public.stack_html_to_plain(v_p.corpo_html);
  v_catalog := public.stack_montar_catalogo_tags(v_p.titulo, v_plain, 120);

  v_system := $s$Você classifica perguntas de suporte interno. Responda SOMENTE com JSON válido no formato:
{"tags":[{"modo":"existente","id":"uuid-opcional","rotulo":"opcional"},{"modo":"nova","rotulo":"..."}]}
Regras: exatamente 2 ou 3 tags; prefira tags do catálogo (modo existente); use modo nova só se necessário; tags curtas; não use a tag "Sem classificação".$s$;

  v_user := format(
    'Título: %s\n\nCorpo:\n%s\n\nCatálogo (preferir estes):\n%s',
    left(v_p.titulo, 500),
    left(v_plain, 4000),
    v_catalog::text
  );

  v_messages := jsonb_build_array(
    jsonb_build_object('role', 'system', 'content', v_system),
    jsonb_build_object('role', 'user', 'content', v_user)
  );

  v_resp := public.chamar_deepseek(
    v_messages,
    'deepseek-v4-flash',
    0.1,
    2048,
    jsonb_build_object('type', 'json_object'),
    NULL
  );

  UPDATE public.stack_tag_jobs
  SET catalogo_snapshot = v_catalog, resposta_ia = v_resp
  WHERE id = v_job.id;

  IF v_resp ? 'error' THEN
    UPDATE public.stack_tag_jobs
    SET ultimo_erro = coalesce(v_resp #>> '{error,message}', 'deepseek_error')
    WHERE id = v_job.id;

    IF v_job.tentativas >= v_max THEN
      UPDATE public.stack_tag_jobs SET status = 'failed', finished_at = now() WHERE id = v_job.id;
      PERFORM public.stack_aplicar_fallback_sem_classificacao(v_job.pergunta_id);
      RETURN jsonb_build_object('ok', false, 'reason', 'failed_fallback', 'pergunta_id', v_job.pergunta_id);
    END IF;

    UPDATE public.stack_tag_jobs SET status = 'pending' WHERE id = v_job.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'retry', 'tentativas', v_job.tentativas);
  END IF;

  v_raw := public.stack_deepseek_extract_content(v_resp);
  v_parsed := public.stack_ia_parse_json_object(v_raw);
  v_tag_ids := public.stack_resolver_tags_ia(v_parsed, v_catalog);

  IF array_length(v_tag_ids, 1) IS NULL OR array_length(v_tag_ids, 1) NOT BETWEEN 2 AND 3 THEN
    UPDATE public.stack_tag_jobs
    SET ultimo_erro = format('tag_count_invalid:%s', coalesce(array_length(v_tag_ids, 1), 0))
    WHERE id = v_job.id;

    IF v_job.tentativas >= v_max THEN
      UPDATE public.stack_tag_jobs SET status = 'failed', finished_at = now() WHERE id = v_job.id;
      PERFORM public.stack_aplicar_fallback_sem_classificacao(v_job.pergunta_id);
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_count_fallback', 'pergunta_id', v_job.pergunta_id);
    END IF;

    UPDATE public.stack_tag_jobs SET status = 'pending' WHERE id = v_job.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_count_retry');
  END IF;

  PERFORM public.stack_aplicar_tags_pergunta(v_job.pergunta_id, v_tag_ids, 'ready');

  UPDATE public.stack_tag_jobs
  SET status = 'done', tags_resolvidas = v_tag_ids, finished_at = now(), ultimo_erro = NULL
  WHERE id = v_job.id;

  RETURN jsonb_build_object(
    'ok', true,
    'job_id', v_job.id,
    'pergunta_id', v_job.pergunta_id,
    'tag_ids', to_jsonb(v_tag_ids)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Filtro AND + nuvem
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stack_feed_where(p_filtros jsonb, p_equipe_ctx uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_sql text := 'p.status IS DISTINCT FROM ''oculta''';
  v_status text;
  v_equipe_ativo boolean;
  v_equipe_modo text;
BEGIN
  v_status := coalesce(p_filtros #>> '{status}', 'todas');
  IF v_status = 'aberta' THEN
    v_sql := v_sql || ' AND p.status = ''aberta''';
  ELSIF v_status = 'fechada' THEN
    v_sql := v_sql || ' AND p.status = ''fechada''';
  END IF;

  IF coalesce((p_filtros #>> '{minhas,fiz}')::boolean, false) THEN
    v_sql := v_sql || format(' AND p.autor_id = %L', auth.uid());
  END IF;

  IF coalesce((p_filtros #>> '{minhas,respondi}')::boolean, false) THEN
    v_sql := v_sql || format(
      ' AND EXISTS (SELECT 1 FROM public.stack_respostas sr WHERE sr.pergunta_id = p.id AND sr.autor_id = %L)',
      auth.uid()
    );
  END IF;

  IF coalesce((p_filtros #>> '{minhas,favoritas}')::boolean, false) THEN
    v_sql := v_sql || format(
      ' AND EXISTS (SELECT 1 FROM public.stack_favoritos sf WHERE sf.pergunta_id = p.id AND sf.user_id = %L)',
      auth.uid()
    );
  END IF;

  v_equipe_ativo := coalesce((p_filtros #>> '{equipe,ativo}')::boolean, false);
  v_equipe_modo := coalesce(p_filtros #>> '{equipe,modo}', 'todas');

  IF v_equipe_ativo AND p_equipe_ctx IS NOT NULL THEN
    IF v_equipe_modo = 'criadas' THEN
      v_sql := v_sql || format(' AND p.autor_equipe_id = %L', p_equipe_ctx);
    ELSIF v_equipe_modo = 'com_resposta' THEN
      v_sql := v_sql || format(
        ' AND EXISTS (SELECT 1 FROM public.stack_respostas sr2 WHERE sr2.pergunta_id = p.id AND sr2.autor_equipe_id = %L)',
        p_equipe_ctx
      );
    END IF;
  END IF;

  IF jsonb_array_length(coalesce(p_filtros -> 'tag_ids', '[]'::jsonb)) > 0 THEN
    v_sql := v_sql || format(
      ' AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(%L::jsonb) AS req(tag_id_text)
          WHERE NOT EXISTS (
            SELECT 1 FROM public.stack_pergunta_tags spt
            WHERE spt.pergunta_id = p.id
              AND spt.tag_id = req.tag_id_text::uuid
          )
        )',
      (p_filtros -> 'tag_ids')::text
    );
  END IF;

  RETURN v_sql;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_listar_tags_nuvem(p_limit int DEFAULT 200)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'slug', x.slug,
        'rotulo', x.rotulo,
        'uso_count', x.uso_count
      )
      ORDER BY x.uso_count DESC, x.rotulo
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT
      t.id,
      t.slug,
      t.rotulo,
      count(pt.pergunta_id)::int AS uso_count
    FROM public.stack_tags t
    LEFT JOIN public.stack_pergunta_tags pt ON pt.tag_id = t.id
    GROUP BY t.id, t.slug, t.rotulo
    ORDER BY count(pt.pergunta_id) DESC, t.rotulo
    LIMIT least(greatest(coalesce(p_limit, 200), 1), 300)
  ) x;
$$;

-- ---------------------------------------------------------------------------
-- CRUD pergunta (sem tags do client)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stack_criar_pergunta(
  p_titulo text,
  p_corpo_html text,
  p_tag_ids uuid[] DEFAULT '{}',
  p_tag_novos text[] DEFAULT '{}',
  p_autor_equipe_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_equipe uuid;
BEGIN
  PERFORM public.stack_assert_html_seguro(p_corpo_html);

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF char_length(trim(coalesce(p_titulo, ''))) < 3 THEN
    RAISE EXCEPTION 'Título muito curto';
  END IF;
  IF char_length(public.stack_html_to_plain(p_corpo_html)) < 3 THEN
    RAISE EXCEPTION 'Corpo muito curto';
  END IF;

  v_equipe := public.stack_autor_equipe_efetiva(p_autor_equipe_id);

  INSERT INTO public.stack_perguntas (titulo, corpo_html, autor_id, autor_equipe_id, tags_status)
  VALUES (trim(p_titulo), coalesce(p_corpo_html, ''), auth.uid(), v_equipe, 'pending')
  RETURNING id INTO v_id;

  PERFORM public.stack_enqueue_tag_job(
    v_id,
    'criacao',
    public.stack_pergunta_corpo_hash(p_corpo_html)
  );

  PERFORM public.stack_perguntas_refresh_search_vector(v_id);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_editar_pergunta(
  p_pergunta_id uuid,
  p_titulo text,
  p_corpo_html text,
  p_tag_ids uuid[] DEFAULT NULL,
  p_tag_novos text[] DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.stack_perguntas%ROWTYPE;
  v_corpo_mudou boolean := false;
  v_mudou_notif boolean := false;
BEGIN
  PERFORM public.stack_assert_html_seguro(p_corpo_html);

  SELECT * INTO v_p FROM public.stack_perguntas WHERE id = p_pergunta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pergunta não encontrada'; END IF;
  IF v_p.autor_id <> auth.uid() AND NOT public.stack_is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  v_corpo_mudou := coalesce(p_corpo_html, '') IS DISTINCT FROM v_p.corpo_html;
  v_mudou_notif := trim(p_titulo) IS DISTINCT FROM v_p.titulo OR v_corpo_mudou;

  UPDATE public.stack_perguntas
  SET titulo = trim(p_titulo),
      corpo_html = coalesce(p_corpo_html, ''),
      editado_em = now(),
      editado_por_id = auth.uid(),
      ultima_atividade_em = now()
  WHERE id = p_pergunta_id;

  IF v_corpo_mudou THEN
    PERFORM public.stack_enqueue_tag_job(
      p_pergunta_id,
      'edicao',
      public.stack_pergunta_corpo_hash(p_corpo_html)
    );
  END IF;

  PERFORM public.stack_perguntas_refresh_search_vector(p_pergunta_id);

  IF v_mudou_notif THEN
    IF v_p.autor_id IS DISTINCT FROM auth.uid() THEN
      PERFORM public.stack_notificar_agregada(v_p.autor_id, p_pergunta_id, 'pergunta_editada', trim(p_titulo));
    END IF;
    PERFORM public.stack_notificar_favoritos_edicao(p_pergunta_id, trim(p_titulo), auth.uid());
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_staff_definir_tags(
  p_pergunta_id uuid,
  p_tag_ids uuid[] DEFAULT '{}',
  p_tag_novos text[] DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag uuid;
  v_novo text;
  v_all uuid[] := coalesce(p_tag_ids, '{}');
BEGIN
  IF NOT public.stack_is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stack_perguntas WHERE id = p_pergunta_id) THEN
    RAISE EXCEPTION 'Pergunta não encontrada';
  END IF;

  FOREACH v_novo IN ARRAY coalesce(p_tag_novos, '{}')
  LOOP
    v_tag := public.stack_tag_obter_ou_criar(v_novo);
    v_all := array_append(v_all, v_tag);
  END LOOP;

  UPDATE public.stack_tag_jobs
  SET status = 'superseded', finished_at = now()
  WHERE pergunta_id = p_pergunta_id AND status IN ('pending', 'processing');

  PERFORM public.stack_aplicar_tags_pergunta(p_pergunta_id, v_all, 'ready');
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_regenerar_tags(p_pergunta_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.stack_perguntas%ROWTYPE;
  v_job uuid;
BEGIN
  IF NOT public.stack_is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT * INTO v_p FROM public.stack_perguntas WHERE id = p_pergunta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pergunta não encontrada'; END IF;

  v_job := public.stack_enqueue_tag_job(
    p_pergunta_id,
    'regeneracao',
    public.stack_pergunta_corpo_hash(v_p.corpo_html)
  );

  RETURN v_job;
END;
$$;

-- ---------------------------------------------------------------------------
-- Feed + detalhe: tags_status
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stack_listar_feed(
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_equipe_ctx uuid DEFAULT NULL,
  p_cursor timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit int DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_where text;
  v_sql text;
  v_rows jsonb;
  v_lim int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  v_where := public.stack_feed_where(p_filtros, p_equipe_ctx);
  v_lim := least(greatest(coalesce(p_limit, 40), 1), 100);

  v_sql := format(
    $q$
    SELECT coalesce(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.ultima_atividade_em DESC), '[]'::jsonb)
    FROM (
      SELECT
        p.id,
        p.titulo,
        p.status,
        p.upvote_count,
        p.resposta_count,
        p.ultima_atividade_em,
        p.created_at,
        p.tags_status,
        (p.resposta_aceita_id IS NOT NULL) AS tem_solucao,
        EXISTS (
          SELECT 1 FROM public.stack_favoritos f
          WHERE f.pergunta_id = p.id AND f.user_id = %1$L
        ) AS favorito,
        EXISTS (
          SELECT 1 FROM public.stack_votes v
          WHERE v.alvo_tipo = 'pergunta' AND v.alvo_id = p.id AND v.user_id = %1$L
        ) AS usuario_votou,
        (
          SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'slug', t.slug, 'rotulo', t.rotulo) ORDER BY t.rotulo), '[]'::jsonb)
          FROM public.stack_pergunta_tags pt
          JOIN public.stack_tags t ON t.id = pt.tag_id
          WHERE pt.pergunta_id = p.id
        ) AS tags
      FROM public.stack_perguntas p
      WHERE %2$s
        AND (
          %3$L IS NULL
          OR (p.ultima_atividade_em, p.id) < (%3$L::timestamptz, coalesce(%4$L::uuid, '00000000-0000-0000-0000-000000000000'::uuid))
        )
      ORDER BY p.ultima_atividade_em DESC, p.id DESC
      LIMIT %5$s
    ) x
    $q$,
    auth.uid(),
    v_where,
    p_cursor,
    p_cursor_id,
    v_lim
  );

  EXECUTE v_sql INTO v_rows;
  RETURN coalesce(v_rows, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_obter_pergunta(
  p_pergunta_id uuid,
  p_preview_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p record;
  v_reabertura jsonb;
  v_respostas jsonb;
  v_tags jsonb;
  v_viewer uuid := auth.uid();
  v_staff_view boolean;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  v_staff_view := public.stack_viewer_staff_mode(p_preview_role);

  SELECT * INTO v_p
  FROM public.stack_perguntas p
  WHERE p.id = p_pergunta_id AND p.status IS DISTINCT FROM 'oculta';

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', r.id,
    'motivo', r.motivo,
    'created_at', r.created_at,
    'staff', CASE WHEN v_staff_view THEN public.stack_autor_json_for_view(r.staff_id, true) ELSE NULL END
  )
  INTO v_reabertura
  FROM public.stack_reaberturas r
  WHERE r.pergunta_id = p_pergunta_id
  ORDER BY r.created_at DESC
  LIMIT 1;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'slug', t.slug, 'rotulo', t.rotulo) ORDER BY t.rotulo), '[]'::jsonb)
  INTO v_tags
  FROM public.stack_pergunta_tags pt
  JOIN public.stack_tags t ON t.id = pt.tag_id
  WHERE pt.pergunta_id = p_pergunta_id;

  SELECT coalesce(jsonb_agg(resp ORDER BY
    CASE WHEN (resp->>'id')::uuid = v_p.resposta_aceita_id THEN 0 ELSE 1 END,
    (resp->>'upvote_count')::int DESC,
    (resp->>'created_at') DESC
  ), '[]'::jsonb)
  INTO v_respostas
  FROM (
    SELECT jsonb_build_object(
      'id', sr.id,
      'corpo_html', sr.corpo_html,
      'upvote_count', sr.upvote_count,
      'created_at', sr.created_at,
      'aceita', (sr.id = v_p.resposta_aceita_id),
      'autor', public.stack_autor_json_for_view(sr.autor_id, v_staff_view),
      'editado', public.stack_editor_json_for_view(sr.editado_por_id, sr.editado_em, v_staff_view),
      'usuario_votou', EXISTS (
        SELECT 1 FROM public.stack_votes v
        WHERE v.alvo_tipo = 'resposta' AND v.alvo_id = sr.id AND v.user_id = v_viewer
      ),
      'pode_editar', (sr.autor_id = v_viewer OR v_staff_view)
    ) AS resp
    FROM public.stack_respostas sr
    WHERE sr.pergunta_id = p_pergunta_id
  ) q;

  RETURN jsonb_build_object(
    'id', v_p.id,
    'titulo', v_p.titulo,
    'corpo_html', v_p.corpo_html,
    'status', v_p.status,
    'tags_status', v_p.tags_status,
    'upvote_count', v_p.upvote_count,
    'resposta_count', v_p.resposta_count,
    'ultima_atividade_em', v_p.ultima_atividade_em,
    'created_at', v_p.created_at,
    'resposta_aceita_id', v_p.resposta_aceita_id,
    'autor', public.stack_autor_json_for_view(v_p.autor_id, v_staff_view),
    'editado', public.stack_editor_json_for_view(v_p.editado_por_id, v_p.editado_em, v_staff_view),
    'tags', v_tags,
    'reabertura', v_reabertura,
    'favorito', EXISTS (SELECT 1 FROM public.stack_favoritos f WHERE f.pergunta_id = p_pergunta_id AND f.user_id = v_viewer),
    'usuario_votou', EXISTS (
      SELECT 1 FROM public.stack_votes v
      WHERE v.alvo_tipo = 'pergunta' AND v.alvo_id = p_pergunta_id AND v.user_id = v_viewer
    ),
    'pode_editar', (v_p.autor_id = v_viewer OR v_staff_view),
    'pode_fechar', v_staff_view,
    'pode_reabrir', v_staff_view AND v_p.status = 'fechada',
    'pode_responder', v_p.status = 'aberta',
    'pode_marcar_aceita', v_p.status = 'aberta' AND v_p.resposta_aceita_id IS NULL
      AND (v_p.autor_id = v_viewer OR v_staff_view),
    'pode_deletar', v_staff_view,
    'pode_gerenciar_tags', v_staff_view,
    'respostas', v_respostas
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.stack_pergunta_corpo_hash(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_enqueue_tag_job(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_ia_parse_json_object(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_resolver_tags_ia(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_aplicar_tags_pergunta(uuid, uuid[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_aplicar_fallback_sem_classificacao(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.stack_listar_tags_nuvem(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_processar_tag_job(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_staff_definir_tags(uuid, uuid[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_regenerar_tags(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_montar_catalogo_tags(text, text, int) TO authenticated;

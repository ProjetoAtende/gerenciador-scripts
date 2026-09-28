-- TIA-B1/B2/B3/B4: REVOKE helpers, worker caller, fallback autocurativo, rate limit

CREATE OR REPLACE FUNCTION public.stack_assert_tag_worker_caller()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_jwt_role text := coalesce(auth.jwt() ->> 'role', '');
BEGIN
  IF v_jwt_role = 'service_role' THEN
    RETURN;
  END IF;

  -- pg_cron / SQL direto (sem JWT PostgREST)
  IF auth.uid() IS NULL AND v_jwt_role = '' AND session_user IN ('postgres', 'supabase_admin') THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Somente worker (service_role ou cron do banco)';
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_aplicar_fallback_sem_classificacao(p_pergunta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fallback uuid;
BEGIN
  v_fallback := public.stack_tag_obter_ou_criar('Sem classificação');
  PERFORM public.stack_aplicar_tags_pergunta(p_pergunta_id, ARRAY[v_fallback], 'failed');
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.stack_perguntas
    SET tags_status = 'failed'
    WHERE id = p_pergunta_id;
    RAISE;
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
  v_autor uuid;
  v_recent int;
  v_max_por_hora int := 30;
BEGIN
  SELECT p.autor_id INTO v_autor
  FROM public.stack_perguntas p
  WHERE p.id = p_pergunta_id;

  IF v_autor IS NULL THEN
    RAISE EXCEPTION 'Pergunta não encontrada';
  END IF;

  IF auth.uid() IS NOT NULL AND v_autor IS DISTINCT FROM auth.uid() AND NOT public.stack_is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT count(*)::int INTO v_recent
    FROM public.stack_tag_jobs j
    JOIN public.stack_perguntas p ON p.id = j.pergunta_id
    WHERE p.autor_id = auth.uid()
      AND j.created_at > now() - interval '1 hour';

    IF v_recent >= v_max_por_hora THEN
      RAISE EXCEPTION 'Limite de classificações por IA nesta hora (%). Tente mais tarde.', v_max_por_hora;
    END IF;
  END IF;

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

CREATE OR REPLACE FUNCTION public._stack_processar_tag_job_core(p_job_id uuid)
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
  SELECT * INTO v_job FROM public.stack_tag_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'job_not_found');
  END IF;

  IF v_job.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'job_not_pending', 'status', v_job.status);
  END IF;

  SELECT * INTO v_p FROM public.stack_perguntas WHERE id = v_job.pergunta_id;
  IF NOT FOUND THEN
    UPDATE public.stack_tag_jobs SET status = 'failed', ultimo_erro = 'pergunta_missing', finished_at = now()
    WHERE id = v_job.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'pergunta_missing');
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
Regras: exatamente 2 ou 3 tags; prefira tags do catálogo (modo existente); use modo nova só se necessário; tags curtas (máx. 40 caracteres); não use a tag "Sem classificação".$s$;

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
      BEGIN
        PERFORM public.stack_aplicar_fallback_sem_classificacao(v_job.pergunta_id);
      EXCEPTION
        WHEN OTHERS THEN
          UPDATE public.stack_perguntas SET tags_status = 'failed' WHERE id = v_job.pergunta_id;
      END;
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
      BEGIN
        PERFORM public.stack_aplicar_fallback_sem_classificacao(v_job.pergunta_id);
      EXCEPTION
        WHEN OTHERS THEN
          UPDATE public.stack_perguntas SET tags_status = 'failed' WHERE id = v_job.pergunta_id;
      END;
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
  v_out uuid[] := '{}';
  v_cat_id uuid;
  v_trimmed text;
BEGIN
  IF p_parsed IS NULL OR jsonb_typeof(p_parsed -> 'tags') <> 'array' THEN
    RETURN v_out;
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_parsed -> 'tags')
  LOOP
    v_modo := lower(trim(coalesce(v_elem ->> 'modo', '')));
    v_id := NULL;
    v_rotulo := left(trim(coalesce(v_elem ->> 'rotulo', '')), 40);

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
      v_trimmed := regexp_replace(v_rotulo, '\s+', ' ', 'g');
      IF char_length(v_trimmed) >= 2 AND char_length(v_trimmed) <= 40 THEN
        v_id := public.stack_tag_obter_ou_criar(v_trimmed);
      END IF;
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

-- Garantir tag de fallback após wipes
INSERT INTO public.stack_tags (slug, rotulo)
VALUES ('sem-classificacao', 'Sem classificação')
ON CONFLICT (slug) DO UPDATE SET rotulo = EXCLUDED.rotulo;

-- BUG-04 pattern: REVOKE de anon/authenticated (grants default do Supabase)
REVOKE ALL ON FUNCTION public.stack_pergunta_corpo_hash(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_enqueue_tag_job(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_ia_parse_json_object(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_resolver_tags_ia(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_aplicar_tags_pergunta(uuid, uuid[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_aplicar_fallback_sem_classificacao(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_deepseek_extract_content(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_tag_sem_classificacao_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_assert_tag_worker_caller() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._stack_processar_tag_job_core(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_processar_tag_jobs_batch(int) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.stack_processar_tag_jobs_batch(int) TO service_role;

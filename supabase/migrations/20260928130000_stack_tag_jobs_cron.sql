-- Worker em lote: pg_cron (postgres) + Edge Function (service_role)

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
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'Somente worker (service_role ou cron do banco)';
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

CREATE OR REPLACE FUNCTION public.stack_processar_tag_job(
  p_job_id uuid DEFAULT NULL,
  p_pergunta_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.stack_tag_jobs%ROWTYPE;
  v_p public.stack_perguntas%ROWTYPE;
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
    RETURN jsonb_build_object('ok', false, 'reason', 'pergunta_missing');
  END IF;

  IF v_p.autor_id IS DISTINCT FROM auth.uid() AND NOT public.stack_is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para processar tags desta pergunta';
  END IF;

  RETURN public._stack_processar_tag_job_core(v_job.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_processar_tag_jobs_batch(p_limit int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lim int := least(greatest(coalesce(p_limit, 3), 1), 5);
  v_i int;
  v_job_id uuid;
  v_one jsonb;
  v_results jsonb := '[]'::jsonb;
  v_ok int := 0;
BEGIN
  PERFORM public.stack_assert_tag_worker_caller();

  FOR v_i IN 1..v_lim LOOP
    SELECT j.id INTO v_job_id
    FROM public.stack_tag_jobs j
    WHERE j.status = 'pending'
    ORDER BY j.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    EXIT WHEN NOT FOUND;

    v_one := public._stack_processar_tag_job_core(v_job_id);
    v_results := v_results || jsonb_build_array(v_one);
    IF coalesce((v_one ->> 'ok')::boolean, false) THEN
      v_ok := v_ok + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'attempted', jsonb_array_length(v_results),
    'ok_count', v_ok,
    'results', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.stack_assert_tag_worker_caller() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._stack_processar_tag_job_core(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_processar_tag_jobs_batch(int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.stack_processar_tag_jobs_batch(int) TO service_role;

-- pg_cron: a cada 2 min, até 2 jobs (DeepSeek pode levar ~30–120s cada)
DO $cron$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron indisponível neste ambiente: %', SQLERRM;
END;
$cron$;

DO $cron$
DECLARE
  v_jobid bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron não instalado — use Edge Function stack-process-tag-jobs';
    RETURN;
  END IF;

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'stack_processar_tag_jobs' LIMIT 1;
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'stack_processar_tag_jobs',
    '*/2 * * * *',
    $cmd$SELECT public.stack_processar_tag_jobs_batch(2);$cmd$
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Não foi possível agendar pg_cron stack_processar_tag_jobs: %', SQLERRM;
END;
$cron$;

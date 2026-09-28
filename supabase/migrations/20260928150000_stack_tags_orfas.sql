-- Tags órfãs: purge interno, limpeza ao deletar/reclassificar, nuvem e catálogo IA só com uso > 0

CREATE OR REPLACE FUNCTION public.stack_purge_tags_orfas()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
BEGIN
  DELETE FROM public.stack_tags t
  WHERE t.slug <> 'sem-classificacao'
    AND NOT EXISTS (
      SELECT 1 FROM public.stack_pergunta_tags pt WHERE pt.tag_id = t.id
    );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.stack_purge_tags_orfas() FROM PUBLIC, anon, authenticated;

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
  PERFORM public.stack_purge_tags_orfas();
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_deletar(p_pergunta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.stack_perguntas%ROWTYPE;
BEGIN
  IF NOT public.stack_is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO v_p FROM public.stack_perguntas WHERE id = p_pergunta_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_p.autor_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.stack_notificar_simples(
      v_p.autor_id, p_pergunta_id, 'conteudo_removido',
      format('Sua pergunta «%s» foi removida pela moderação', left(v_p.titulo, 80))
    );
  END IF;

  DELETE FROM public.stack_votes
  WHERE (alvo_tipo = 'pergunta' AND alvo_id = p_pergunta_id)
     OR (alvo_tipo = 'resposta' AND alvo_id IN (
           SELECT id FROM public.stack_respostas WHERE pergunta_id = p_pergunta_id
         ));

  DELETE FROM public.stack_perguntas WHERE id = p_pergunta_id;
  PERFORM public.stack_purge_tags_orfas();
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
    INNER JOIN public.stack_pergunta_tags pt ON pt.tag_id = t.id
    GROUP BY t.id, t.slug, t.rotulo
    HAVING count(pt.pergunta_id) > 0
    ORDER BY count(pt.pergunta_id) DESC, t.rotulo
    LIMIT least(greatest(coalesce(p_limit, 200), 1), 300)
  ) x;
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
    INNER JOIN public.stack_pergunta_tags pt ON pt.tag_id = t.id
    WHERE t.slug <> 'sem-classificacao'
    GROUP BY t.id, t.slug, t.rotulo
    HAVING count(pt.pergunta_id) > 0
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

SELECT public.stack_purge_tags_orfas();

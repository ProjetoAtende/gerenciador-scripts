-- Paginação na busca Atende Stack

CREATE OR REPLACE FUNCTION public.stack_buscar(
  p_query text,
  p_escopo text DEFAULT 'ambos',
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_equipe_ctx uuid DEFAULT NULL,
  p_limit int DEFAULT 40,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_where text;
  v_ts tsquery;
  v_rows jsonb;
  v_lim int;
  v_off int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF length(trim(coalesce(p_query, ''))) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;

  v_ts := websearch_to_tsquery('portuguese', trim(p_query));
  v_where := public.stack_feed_where(p_filtros, p_equipe_ctx);
  v_lim := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_off := greatest(coalesce(p_offset, 0), 0);

  EXECUTE format(
    $q$
    SELECT coalesce(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.score DESC), '[]'::jsonb)
    FROM (
      SELECT * FROM (
        SELECT p.id AS pergunta_id,
          'pergunta'::text AS match_tipo,
          p.titulo,
          ts_rank_cd(p.search_vector, $1)::real AS score,
          ts_headline('portuguese', coalesce(p.corpo_plain, ''), $1,
            'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=12') AS snippet_html
        FROM public.stack_perguntas p
        WHERE %s AND p.search_vector @@ $1
          AND ($2 IN ('perguntas', 'ambos'))
        UNION ALL
        SELECT sr.pergunta_id,
          'resposta'::text,
          p.titulo,
          ts_rank_cd(to_tsvector('portuguese', sr.corpo_plain), $1)::real,
          ts_headline('portuguese', coalesce(sr.corpo_plain, ''), $1,
            'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=12')
        FROM public.stack_respostas sr
        JOIN public.stack_perguntas p ON p.id = sr.pergunta_id
        WHERE %s AND to_tsvector('portuguese', sr.corpo_plain) @@ $1
          AND ($2 IN ('respostas', 'ambos'))
      ) u
      ORDER BY score DESC
      LIMIT $3 OFFSET $4
    ) sub
    $q$,
    v_where,
    v_where
  ) INTO v_rows USING v_ts, p_escopo, v_lim, v_off;

  RETURN coalesce(v_rows, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.stack_buscar(text, text, jsonb, uuid, int, int) TO authenticated;

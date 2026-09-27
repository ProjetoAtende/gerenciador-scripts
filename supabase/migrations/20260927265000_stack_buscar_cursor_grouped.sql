-- Busca: agrupamento por pergunta no servidor + paginação por cursor (score, pergunta_id)

DROP FUNCTION IF EXISTS public.stack_buscar(text, text, jsonb, uuid, int, int);

CREATE OR REPLACE FUNCTION public.stack_buscar(
  p_query text,
  p_escopo text DEFAULT 'ambos',
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_equipe_ctx uuid DEFAULT NULL,
  p_limit int DEFAULT 40,
  p_cursor_score real DEFAULT NULL,
  p_cursor_pergunta_id uuid DEFAULT NULL
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
  v_q text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF length(trim(coalesce(p_query, ''))) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;

  v_q := unaccent(trim(p_query));
  v_ts := websearch_to_tsquery('portuguese', v_q);
  v_where := public.stack_feed_where(p_filtros, p_equipe_ctx);
  v_lim := least(greatest(coalesce(p_limit, 40), 1), 100);

  EXECUTE format(
    $q$
    SELECT coalesce(jsonb_agg(row_to_json(g)::jsonb ORDER BY g.score DESC, g.pergunta_id DESC), '[]'::jsonb)
    FROM (
      WITH raw AS (
        SELECT p.id AS pergunta_id,
          NULL::uuid AS resposta_id,
          'pergunta'::text AS match_tipo,
          p.titulo,
          ts_rank_cd(p.search_vector, $1)::real AS score,
          ts_headline('portuguese', unaccent(coalesce(p.titulo, '')), $1,
            'StartSel=<mark>, StopSel=</mark>, MaxWords=12, MinWords=1') AS titulo_html,
          ts_headline('portuguese', unaccent(coalesce(p.corpo_plain, '')), $1,
            'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=12') AS snippet_html
        FROM public.stack_perguntas p
        WHERE %s AND p.search_vector @@ $1
          AND ($2 IN ('perguntas', 'ambos'))
        UNION ALL
        SELECT sr.pergunta_id,
          sr.id AS resposta_id,
          'resposta'::text,
          p.titulo,
          ts_rank_cd(public.stack_tsvector_pt(sr.corpo_plain), $1)::real,
          ts_headline('portuguese', unaccent(coalesce(p.titulo, '')), $1,
            'StartSel=<mark>, StopSel=</mark>, MaxWords=12, MinWords=1'),
          ts_headline('portuguese', unaccent(coalesce(sr.corpo_plain, '')), $1,
            'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=12')
        FROM public.stack_respostas sr
        JOIN public.stack_perguntas p ON p.id = sr.pergunta_id
        WHERE %s AND public.stack_tsvector_pt(sr.corpo_plain) @@ $1
          AND ($2 IN ('respostas', 'ambos'))
      ),
      counts AS (
        SELECT pergunta_id, count(*)::int AS match_count
        FROM raw
        GROUP BY pergunta_id
      ),
      best AS (
        SELECT DISTINCT ON (r.pergunta_id)
          r.pergunta_id,
          r.resposta_id,
          r.match_tipo,
          r.titulo,
          r.score,
          r.titulo_html,
          r.snippet_html
        FROM raw r
        ORDER BY r.pergunta_id, r.score DESC, r.resposta_id NULLS FIRST
      )
      SELECT
        b.pergunta_id,
        b.resposta_id,
        b.match_tipo,
        b.titulo,
        b.score,
        b.titulo_html,
        b.snippet_html,
        c.match_count
      FROM best b
      JOIN counts c ON c.pergunta_id = b.pergunta_id
      WHERE (
        $3 IS NULL
        OR (b.score, b.pergunta_id) < (
          $3::real,
          coalesce($4::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        )
      )
      ORDER BY b.score DESC, b.pergunta_id DESC
      LIMIT $5
    ) g
    $q$,
    v_where,
    v_where
  ) INTO v_rows USING v_ts, p_escopo, p_cursor_score, p_cursor_pergunta_id, v_lim;

  RETURN coalesce(v_rows, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.stack_buscar(text, text, jsonb, uuid, int, real, uuid) TO authenticated;

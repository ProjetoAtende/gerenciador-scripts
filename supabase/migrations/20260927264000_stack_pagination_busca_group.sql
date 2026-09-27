-- Paginação estável do feed e busca; destaque no título (BUG-19, BUG-20 parcial)

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
  v_off := greatest(coalesce(p_offset, 0), 0);

  EXECUTE format(
    $q$
    SELECT coalesce(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.score DESC, sub.pergunta_id DESC, sub.resposta_id NULLS FIRST), '[]'::jsonb)
    FROM (
      SELECT * FROM (
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
      ) u
      ORDER BY score DESC, pergunta_id DESC, resposta_id NULLS FIRST
      LIMIT $3 OFFSET $4
    ) sub
    $q$,
    v_where,
    v_where
  ) INTO v_rows USING v_ts, p_escopo, v_lim, v_off;

  RETURN coalesce(v_rows, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.stack_listar_feed(jsonb, uuid, timestamptz, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_buscar(text, text, jsonb, uuid, int, int) TO authenticated;

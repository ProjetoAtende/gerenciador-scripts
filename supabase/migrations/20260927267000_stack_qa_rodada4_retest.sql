-- Reteste QA rodada 3: BUG-28, 30, 31, 32, 29 (headlines)

CREATE OR REPLACE FUNCTION public.stack_assert_html_seguro(p_html text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := coalesce(p_html, '');
BEGIN
  IF v ~* '<(script|iframe|object|embed)(\s|>|/)' THEN
    RAISE EXCEPTION 'Conteúdo HTML não permitido';
  END IF;
  IF v ~* '(href|src)\s*=\s*[''"]?\s*javascript\s*:' THEN
    RAISE EXCEPTION 'Link não permitido';
  END IF;
  IF v ~* '<[^>]+[\s/]on[a-zA-Z]+\s*=' THEN
    RAISE EXCEPTION 'Conteúdo HTML não permitido';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_votar(p_alvo_tipo text, p_alvo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_count int;
  v_autor uuid;
  v_titulo text;
  v_pergunta_id uuid;
BEGIN
  IF p_alvo_tipo NOT IN ('pergunta', 'resposta') THEN
    RAISE EXCEPTION 'Tipo inválido';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.stack_votes
    WHERE user_id = auth.uid() AND alvo_tipo = p_alvo_tipo AND alvo_id = p_alvo_id
  ) INTO v_exists;

  IF NOT v_exists THEN
    IF p_alvo_tipo = 'pergunta' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.stack_perguntas p
        WHERE p.id = p_alvo_id AND p.status IS DISTINCT FROM 'oculta'
      ) THEN
        RAISE EXCEPTION 'Pergunta não encontrada';
      END IF;
    ELSIF NOT EXISTS (SELECT 1 FROM public.stack_respostas r WHERE r.id = p_alvo_id) THEN
      RAISE EXCEPTION 'Resposta não encontrada';
    END IF;
    INSERT INTO public.stack_votes (user_id, alvo_tipo, alvo_id)
    VALUES (auth.uid(), p_alvo_tipo, p_alvo_id);
  ELSE
    DELETE FROM public.stack_votes
    WHERE user_id = auth.uid() AND alvo_tipo = p_alvo_tipo AND alvo_id = p_alvo_id;
  END IF;

  IF p_alvo_tipo = 'pergunta' THEN
    SELECT count(*)::int INTO v_count FROM public.stack_votes WHERE alvo_tipo = 'pergunta' AND alvo_id = p_alvo_id;
    UPDATE public.stack_perguntas SET upvote_count = v_count WHERE id = p_alvo_id
    RETURNING autor_id, titulo INTO v_autor, v_titulo;
    v_pergunta_id := p_alvo_id;
    IF v_exists AND v_autor IS DISTINCT FROM auth.uid() THEN
      PERFORM public.stack_notificar_decrement_joinha(v_autor, v_pergunta_id, 'joinha_pergunta', v_titulo);
    ELSIF NOT v_exists AND v_autor IS DISTINCT FROM auth.uid() THEN
      PERFORM public.stack_notificar_agregada(v_autor, v_pergunta_id, 'joinha_pergunta', v_titulo);
    END IF;
  ELSE
    SELECT count(*)::int INTO v_count FROM public.stack_votes WHERE alvo_tipo = 'resposta' AND alvo_id = p_alvo_id;
    UPDATE public.stack_respostas SET upvote_count = v_count WHERE id = p_alvo_id
    RETURNING autor_id, pergunta_id INTO v_autor, v_pergunta_id;
    SELECT titulo INTO v_titulo FROM public.stack_perguntas WHERE id = v_pergunta_id;
    IF v_exists AND v_autor IS DISTINCT FROM auth.uid() THEN
      PERFORM public.stack_notificar_decrement_joinha(v_autor, v_pergunta_id, 'joinha_resposta', v_titulo);
    ELSIF NOT v_exists AND v_autor IS DISTINCT FROM auth.uid() THEN
      PERFORM public.stack_notificar_agregada(v_autor, v_pergunta_id, 'joinha_resposta', v_titulo);
    END IF;
  END IF;

  RETURN jsonb_build_object('upvote_count', v_count, 'usuario_votou', NOT v_exists);
END;
$$;

DROP FUNCTION IF EXISTS public.stack_obter_pergunta(uuid);

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
          round(ts_rank_cd(p.search_vector, $1)::numeric, 6)::real AS score,
          ts_headline('portuguese', coalesce(p.titulo, ''), $1,
            'StartSel=<mark>, StopSel=</mark>, MaxWords=12, MinWords=1') AS titulo_html,
          ts_headline('portuguese', coalesce(p.corpo_plain, ''), $1,
            'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=12') AS snippet_html
        FROM public.stack_perguntas p
        WHERE %s AND p.search_vector @@ $1
          AND ($2 IN ('perguntas', 'ambos'))
        UNION ALL
        SELECT sr.pergunta_id,
          sr.id AS resposta_id,
          'resposta'::text,
          p.titulo,
          round(ts_rank_cd(public.stack_tsvector_pt(sr.corpo_plain), $1)::numeric, 6)::real,
          ts_headline('portuguese', coalesce(p.titulo, ''), $1,
            'StartSel=<mark>, StopSel=</mark>, MaxWords=12, MinWords=1'),
          ts_headline('portuguese', coalesce(sr.corpo_plain, ''), $1,
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
        OR round(b.score::numeric, 6) < round($3::numeric, 6)
        OR (
          round(b.score::numeric, 6) = round($3::numeric, 6)
          AND b.pergunta_id < coalesce($4::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
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

GRANT EXECUTE ON FUNCTION public.stack_votar(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_buscar(text, text, jsonb, uuid, int, real, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_obter_pergunta(uuid, text) TO authenticated;

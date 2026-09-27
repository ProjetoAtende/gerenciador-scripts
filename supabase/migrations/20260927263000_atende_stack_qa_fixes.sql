-- Correções QA Atende Stack (relatório 2026-09-27)

-- ---------------------------------------------------------------------------
-- FTS insensível a acentos
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stack_tsvector_pt(p_text text)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT to_tsvector('portuguese', unaccent(coalesce(p_text, '')));
$$;

CREATE OR REPLACE FUNCTION public.stack_perguntas_refresh_search_vector(p_pergunta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text;
  v_plain text;
  v_tags text;
BEGIN
  SELECT p.titulo, p.corpo_plain
  INTO v_titulo, v_plain
  FROM public.stack_perguntas p
  WHERE p.id = p_pergunta_id;

  SELECT coalesce(string_agg(t.rotulo, ' '), '')
  INTO v_tags
  FROM public.stack_pergunta_tags pt
  JOIN public.stack_tags t ON t.id = pt.tag_id
  WHERE pt.pergunta_id = p_pergunta_id;

  UPDATE public.stack_perguntas p
  SET search_vector =
    setweight(public.stack_tsvector_pt(coalesce(v_titulo, '')), 'A')
    || setweight(public.stack_tsvector_pt(coalesce(v_tags, '')), 'A')
    || setweight(public.stack_tsvector_pt(coalesce(v_plain, '')), 'B')
  WHERE p.id = p_pergunta_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_trg_pergunta_search()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.corpo_plain := public.stack_html_to_plain(NEW.corpo_html);
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.ultima_atividade_em := coalesce(NEW.ultima_atividade_em, now());
  END IF;
  NEW.search_vector :=
    setweight(public.stack_tsvector_pt(coalesce(NEW.titulo, '')), 'A')
    || setweight(public.stack_tsvector_pt(coalesce(NEW.corpo_plain, '')), 'B');
  RETURN NEW;
END;
$$;

DROP INDEX IF EXISTS public.idx_stack_respostas_plain_fts;
CREATE INDEX idx_stack_respostas_plain_fts
  ON public.stack_respostas USING gin (public.stack_tsvector_pt(corpo_plain));

UPDATE public.stack_perguntas p
SET titulo = p.titulo;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.stack_perguntas
  LOOP
    PERFORM public.stack_perguntas_refresh_search_vector(r.id);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Notificações: sobreviver à exclusão da pergunta (BUG-08)
-- ---------------------------------------------------------------------------

ALTER TABLE public.stack_notificacoes
  ALTER COLUMN pergunta_id DROP NOT NULL;

ALTER TABLE public.stack_notificacoes
  DROP CONSTRAINT IF EXISTS stack_notificacoes_pergunta_id_fkey;

ALTER TABLE public.stack_notificacoes
  ADD CONSTRAINT stack_notificacoes_pergunta_id_fkey
  FOREIGN KEY (pergunta_id) REFERENCES public.stack_perguntas(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Validação mínima de HTML no servidor (XSS armazenado)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stack_assert_html_seguro(p_html text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF coalesce(p_html, '') ~* '<(script|iframe|object|embed)\b' THEN
    RAISE EXCEPTION 'Conteúdo HTML não permitido';
  END IF;
  IF coalesce(p_html, '') ~* 'javascript\s*:' THEN
    RAISE EXCEPTION 'Link não permitido';
  END IF;
  IF coalesce(p_html, '') ~* '\son[a-z]+\s*=' THEN
    RAISE EXCEPTION 'Conteúdo HTML não permitido';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Joinha: decrementar agregação ao desfazer voto (BUG-24)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stack_notificar_decrement_joinha(
  p_user_id uuid,
  p_pergunta_id uuid,
  p_tipo text,
  p_titulo_pergunta text,
  p_janela_minutos int DEFAULT 15
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text := left(coalesce(p_titulo_pergunta, ''), 80);
  v_row public.stack_notificacoes%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_tipo NOT IN ('joinha_pergunta', 'joinha_resposta') THEN
    RETURN;
  END IF;

  SELECT n.* INTO v_row
  FROM public.stack_notificacoes n
  WHERE n.user_id = p_user_id
    AND n.pergunta_id = p_pergunta_id
    AND n.tipo = p_tipo
    AND n.lida_em IS NULL
    AND n.updated_at > now() - (p_janela_minutos || ' minutes')::interval
  ORDER BY n.updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_row.contador <= 1 THEN
    DELETE FROM public.stack_notificacoes WHERE id = v_row.id;
    RETURN;
  END IF;

  UPDATE public.stack_notificacoes n
  SET contador = n.contador - 1,
      updated_at = now(),
      mensagem = CASE p_tipo
        WHEN 'joinha_pergunta' THEN format('Sua pergunta «%s» recebeu %s joinhas', v_titulo, n.contador - 1)
        WHEN 'joinha_resposta' THEN format('Sua resposta em «%s» recebeu %s joinhas', v_titulo, n.contador - 1)
        ELSE n.mensagem
      END
  WHERE n.id = v_row.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- stack_votar, stack_editar_pergunta, stack_deletar, stack_buscar
-- ---------------------------------------------------------------------------

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

  IF v_exists THEN
    DELETE FROM public.stack_votes
    WHERE user_id = auth.uid() AND alvo_tipo = p_alvo_tipo AND alvo_id = p_alvo_id;
  ELSE
    INSERT INTO public.stack_votes (user_id, alvo_tipo, alvo_id) VALUES (auth.uid(), p_alvo_tipo, p_alvo_id);
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
  v_tag uuid;
  v_novo text;
  v_all uuid[];
  v_tags_antigas uuid[];
  v_tags_novas uuid[];
  v_mudou boolean := false;
BEGIN
  PERFORM public.stack_assert_html_seguro(p_corpo_html);

  SELECT * INTO v_p FROM public.stack_perguntas WHERE id = p_pergunta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pergunta não encontrada'; END IF;
  IF v_p.autor_id <> auth.uid() AND NOT public.stack_is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  v_mudou := trim(p_titulo) IS DISTINCT FROM v_p.titulo
    OR coalesce(p_corpo_html, '') IS DISTINCT FROM v_p.corpo_html;

  UPDATE public.stack_perguntas
  SET titulo = trim(p_titulo),
      corpo_html = coalesce(p_corpo_html, ''),
      editado_em = now(),
      editado_por_id = auth.uid(),
      ultima_atividade_em = now()
  WHERE id = p_pergunta_id;

  IF p_tag_ids IS NOT NULL THEN
    SELECT coalesce(array_agg(pt.tag_id ORDER BY pt.tag_id), '{}')
    INTO v_tags_antigas
    FROM public.stack_pergunta_tags pt
    WHERE pt.pergunta_id = p_pergunta_id;

    v_all := coalesce(p_tag_ids, '{}');
    FOREACH v_novo IN ARRAY coalesce(p_tag_novos, '{}')
    LOOP
      v_tag := public.stack_tag_obter_ou_criar(v_novo);
      v_all := array_append(v_all, v_tag);
    END LOOP;

    SELECT coalesce(array_agg(DISTINCT x ORDER BY x), '{}')
    INTO v_tags_novas
    FROM unnest(v_all) AS x;

    IF v_tags_antigas IS DISTINCT FROM v_tags_novas THEN
      v_mudou := true;
    END IF;

    DELETE FROM public.stack_pergunta_tags WHERE pergunta_id = p_pergunta_id;
    IF array_length(v_all, 1) IS NOT NULL THEN
      INSERT INTO public.stack_pergunta_tags (pergunta_id, tag_id)
      SELECT p_pergunta_id, unnest(v_all)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  PERFORM public.stack_perguntas_refresh_search_vector(p_pergunta_id);

  IF v_mudou THEN
    IF v_p.autor_id IS DISTINCT FROM auth.uid() THEN
      PERFORM public.stack_notificar_agregada(v_p.autor_id, p_pergunta_id, 'pergunta_editada', trim(p_titulo));
    END IF;
    PERFORM public.stack_notificar_favoritos_edicao(p_pergunta_id, trim(p_titulo), auth.uid());
  END IF;
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
    SELECT coalesce(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.score DESC), '[]'::jsonb)
    FROM (
      SELECT * FROM (
        SELECT p.id AS pergunta_id,
          NULL::uuid AS resposta_id,
          'pergunta'::text AS match_tipo,
          p.titulo,
          ts_rank_cd(p.search_vector, $1)::real AS score,
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
          ts_headline('portuguese', unaccent(coalesce(sr.corpo_plain, '')), $1,
            'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=12')
        FROM public.stack_respostas sr
        JOIN public.stack_perguntas p ON p.id = sr.pergunta_id
        WHERE %s AND public.stack_tsvector_pt(sr.corpo_plain) @@ $1
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

-- HTML seguro em criar pergunta / resposta
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
  v_tag uuid;
  v_novo text;
  v_all_tags uuid[] := coalesce(p_tag_ids, '{}');
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

  INSERT INTO public.stack_perguntas (titulo, corpo_html, autor_id, autor_equipe_id)
  VALUES (trim(p_titulo), coalesce(p_corpo_html, ''), auth.uid(), p_autor_equipe_id)
  RETURNING id INTO v_id;

  FOREACH v_novo IN ARRAY coalesce(p_tag_novos, '{}')
  LOOP
    v_tag := public.stack_tag_obter_ou_criar(v_novo);
    v_all_tags := array_append(v_all_tags, v_tag);
  END LOOP;

  IF array_length(v_all_tags, 1) IS NOT NULL THEN
    INSERT INTO public.stack_pergunta_tags (pergunta_id, tag_id)
    SELECT v_id, unnest(v_all_tags)
    ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.stack_perguntas_refresh_search_vector(v_id);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_criar_resposta(
  p_pergunta_id uuid,
  p_corpo_html text,
  p_autor_equipe_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_p public.stack_perguntas%ROWTYPE;
BEGIN
  PERFORM public.stack_assert_html_seguro(p_corpo_html);

  SELECT * INTO v_p FROM public.stack_perguntas WHERE id = p_pergunta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pergunta não encontrada'; END IF;
  IF v_p.status <> 'aberta' THEN RAISE EXCEPTION 'Pergunta encerrada'; END IF;
  IF char_length(public.stack_html_to_plain(p_corpo_html)) < 1 THEN
    RAISE EXCEPTION 'Resposta vazia';
  END IF;

  INSERT INTO public.stack_respostas (pergunta_id, corpo_html, autor_id, autor_equipe_id)
  VALUES (p_pergunta_id, coalesce(p_corpo_html, ''), auth.uid(), p_autor_equipe_id)
  RETURNING id INTO v_id;

  PERFORM public.stack_notificar_agregada(v_p.autor_id, p_pergunta_id, 'nova_resposta', v_p.titulo);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_editar_resposta(
  p_resposta_id uuid,
  p_corpo_html text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_r public.stack_respostas%ROWTYPE;
BEGIN
  PERFORM public.stack_assert_html_seguro(p_corpo_html);

  SELECT * INTO v_r FROM public.stack_respostas WHERE id = p_resposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resposta não encontrada'; END IF;
  IF v_r.autor_id <> auth.uid() AND NOT public.stack_is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.stack_respostas
  SET corpo_html = coalesce(p_corpo_html, ''),
      editado_em = now(),
      editado_por_id = auth.uid()
  WHERE id = p_resposta_id;

  UPDATE public.stack_perguntas SET ultima_atividade_em = now() WHERE id = v_r.pergunta_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- REVOKE funções internas (BUG-04, BUG-23)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.stack_autor_json(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_editor_json(uuid, timestamptz, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_notificar_agregada(uuid, uuid, text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_notificar_simples(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_notificar_favoritos_edicao(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_notificar_decrement_joinha(uuid, uuid, text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_is_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_tag_obter_ou_criar(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_feed_where(jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_html_to_plain(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_tag_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_perguntas_refresh_search_vector(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_tsvector_pt(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_assert_html_seguro(text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.stack_autor_json(uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_editor_json(uuid, timestamptz, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_notificar_agregada(uuid, uuid, text, text, int) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_notificar_simples(uuid, uuid, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_notificar_favoritos_edicao(uuid, text, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_notificar_decrement_joinha(uuid, uuid, text, text, int) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_is_staff(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_tag_obter_ou_criar(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_feed_where(jsonb, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_html_to_plain(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_tag_slug(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_perguntas_refresh_search_vector(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_tsvector_pt(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_assert_html_seguro(text) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.stack_buscar(text, text, jsonb, uuid, int, int) TO authenticated;

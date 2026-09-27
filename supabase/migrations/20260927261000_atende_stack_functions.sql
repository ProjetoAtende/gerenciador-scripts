-- DB-7: Atende Stack — RPCs

-- ---------------------------------------------------------------------------
-- Autoria / notificações
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stack_autor_json(p_user_id uuid, p_viewer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  v_staff := public.stack_is_staff(p_viewer_id);
  IF NOT v_staff THEN
    RETURN jsonb_build_object('anonimo', true);
  END IF;
  RETURN (
    SELECT jsonb_build_object(
      'id', u.id,
      'nome', u.nome,
      'email', u.email
    )
    FROM public.users u
    WHERE u.id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_editor_json(p_user_id uuid, p_editado_em timestamptz, p_viewer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_editado_em IS NULL THEN
    RETURN NULL;
  END IF;
  IF public.stack_is_staff(p_viewer_id) THEN
    RETURN (
      SELECT jsonb_build_object(
        'editado_em', p_editado_em,
        'por', public.stack_autor_json(p_user_id, p_viewer_id)
      )
    );
  END IF;
  RETURN jsonb_build_object('editado_em', p_editado_em);
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_notificar_agregada(
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
  v_titulo text;
  v_msg text;
  v_existing uuid;
BEGIN
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RETURN;
  END IF;

  v_titulo := left(coalesce(p_titulo_pergunta, ''), 80);

  SELECT n.id INTO v_existing
  FROM public.stack_notificacoes n
  WHERE n.user_id = p_user_id
    AND n.pergunta_id = p_pergunta_id
    AND n.tipo = p_tipo
    AND n.lida_em IS NULL
    AND n.updated_at > now() - (p_janela_minutos || ' minutes')::interval
  ORDER BY n.updated_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.stack_notificacoes n
    SET contador = n.contador + 1,
        updated_at = now(),
        mensagem = CASE p_tipo
          WHEN 'nova_resposta' THEN format('Há %s novas respostas na sua pergunta «%s»', n.contador + 1, v_titulo)
          WHEN 'joinha_pergunta' THEN format('Sua pergunta «%s» recebeu %s joinhas', v_titulo, n.contador + 1)
          WHEN 'joinha_resposta' THEN format('Sua resposta em «%s» recebeu %s joinhas', v_titulo, n.contador + 1)
          WHEN 'pergunta_editada' THEN format('A pergunta «%s» foi atualizada (%s)', v_titulo, n.contador + 1)
          ELSE n.mensagem
        END
    WHERE n.id = v_existing;
    RETURN;
  END IF;

  v_msg := CASE p_tipo
    WHEN 'nova_resposta' THEN format('Há 1 nova resposta na sua pergunta «%s»', v_titulo)
    WHEN 'joinha_pergunta' THEN format('Sua pergunta «%s» recebeu 1 joinha', v_titulo)
    WHEN 'joinha_resposta' THEN format('Sua resposta em «%s» recebeu 1 joinha', v_titulo)
    WHEN 'pergunta_editada' THEN format('A pergunta «%s» foi atualizada', v_titulo)
    ELSE format('Atualização em «%s»', v_titulo)
  END;

  INSERT INTO public.stack_notificacoes (user_id, pergunta_id, tipo, contador, mensagem)
  VALUES (p_user_id, p_pergunta_id, p_tipo, 1, v_msg);
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_notificar_simples(
  p_user_id uuid,
  p_pergunta_id uuid,
  p_tipo text,
  p_mensagem text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RETURN;
  END IF;
  INSERT INTO public.stack_notificacoes (user_id, pergunta_id, tipo, contador, mensagem)
  VALUES (p_user_id, p_pergunta_id, p_tipo, 1, left(p_mensagem, 500));
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_notificar_favoritos_edicao(p_pergunta_id uuid, p_titulo text, p_editor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT f.user_id
    FROM public.stack_favoritos f
    WHERE f.pergunta_id = p_pergunta_id
      AND f.user_id IS DISTINCT FROM p_editor_id
  LOOP
    PERFORM public.stack_notificar_agregada(r.user_id, p_pergunta_id, 'pergunta_editada', p_titulo);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_tag_obter_ou_criar(p_rotulo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_rotulo text;
  v_id uuid;
BEGIN
  v_rotulo := trim(coalesce(p_rotulo, ''));
  IF v_rotulo = '' THEN
    RAISE EXCEPTION 'Tag inválida';
  END IF;
  v_slug := public.stack_tag_slug(v_rotulo);
  IF v_slug = '' THEN
    RAISE EXCEPTION 'Tag inválida';
  END IF;

  SELECT t.id INTO v_id FROM public.stack_tags t WHERE t.slug = v_slug;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.stack_tags (slug, rotulo)
  VALUES (v_slug, v_rotulo)
  ON CONFLICT (slug) DO UPDATE SET rotulo = EXCLUDED.rotulo
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Filtros feed / busca
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
      ' AND EXISTS (
          SELECT 1 FROM public.stack_pergunta_tags spt
          WHERE spt.pergunta_id = p.id
            AND spt.tag_id IN (
              SELECT (jsonb_array_elements_text(%L::jsonb))::uuid
            )
        )',
      (p_filtros -> 'tag_ids')::text
    );
  END IF;

  RETURN v_sql;
END;
$$;

-- ---------------------------------------------------------------------------
-- stack_listar_feed
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
      ORDER BY p.ultima_atividade_em DESC, p.upvote_count DESC, p.created_at DESC, p.id DESC
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

-- ---------------------------------------------------------------------------
-- stack_obter_pergunta
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stack_obter_pergunta(p_pergunta_id uuid)
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
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

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
    'staff', public.stack_autor_json(r.staff_id, v_viewer)
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
      'autor', public.stack_autor_json(sr.autor_id, v_viewer),
      'editado', public.stack_editor_json(sr.editado_por_id, sr.editado_em, v_viewer),
      'usuario_votou', EXISTS (
        SELECT 1 FROM public.stack_votes v
        WHERE v.alvo_tipo = 'resposta' AND v.alvo_id = sr.id AND v.user_id = v_viewer
      ),
      'pode_editar', (sr.autor_id = v_viewer OR public.stack_is_staff(v_viewer))
    ) AS resp
    FROM public.stack_respostas sr
    WHERE sr.pergunta_id = p_pergunta_id
  ) q;

  RETURN jsonb_build_object(
    'id', v_p.id,
    'titulo', v_p.titulo,
    'corpo_html', v_p.corpo_html,
    'status', v_p.status,
    'upvote_count', v_p.upvote_count,
    'resposta_count', v_p.resposta_count,
    'ultima_atividade_em', v_p.ultima_atividade_em,
    'created_at', v_p.created_at,
    'resposta_aceita_id', v_p.resposta_aceita_id,
    'autor', public.stack_autor_json(v_p.autor_id, v_viewer),
    'editado', public.stack_editor_json(v_p.editado_por_id, v_p.editado_em, v_viewer),
    'tags', v_tags,
    'reabertura', v_reabertura,
    'favorito', EXISTS (SELECT 1 FROM public.stack_favoritos f WHERE f.pergunta_id = p_pergunta_id AND f.user_id = v_viewer),
    'usuario_votou', EXISTS (
      SELECT 1 FROM public.stack_votes v
      WHERE v.alvo_tipo = 'pergunta' AND v.alvo_id = p_pergunta_id AND v.user_id = v_viewer
    ),
    'pode_editar', (v_p.autor_id = v_viewer OR public.stack_is_staff(v_viewer)),
    'pode_fechar', public.stack_is_staff(v_viewer),
    'pode_reabrir', public.stack_is_staff(v_viewer) AND v_p.status = 'fechada',
    'pode_responder', v_p.status = 'aberta',
    'pode_marcar_aceita', v_p.status = 'aberta' AND v_p.resposta_aceita_id IS NULL
      AND (v_p.autor_id = v_viewer OR public.stack_is_staff(v_viewer)),
    'pode_deletar', public.stack_is_staff(v_viewer),
    'respostas', v_respostas
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Escrita
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
  v_tag uuid;
  v_rotulo text;
  v_all_tags uuid[] := coalesce(p_tag_ids, '{}');
  v_novo text;
BEGIN
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
BEGIN
  SELECT * INTO v_p FROM public.stack_perguntas WHERE id = p_pergunta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pergunta não encontrada'; END IF;
  IF v_p.autor_id <> auth.uid() AND NOT public.stack_is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.stack_perguntas
  SET titulo = trim(p_titulo),
      corpo_html = coalesce(p_corpo_html, ''),
      editado_em = now(),
      editado_por_id = auth.uid(),
      ultima_atividade_em = now()
  WHERE id = p_pergunta_id;

  IF p_tag_ids IS NOT NULL THEN
    v_all := coalesce(p_tag_ids, '{}');
    FOREACH v_novo IN ARRAY coalesce(p_tag_novos, '{}')
    LOOP
      v_tag := public.stack_tag_obter_ou_criar(v_novo);
      v_all := array_append(v_all, v_tag);
    END LOOP;
    DELETE FROM public.stack_pergunta_tags WHERE pergunta_id = p_pergunta_id;
    IF array_length(v_all, 1) IS NOT NULL THEN
      INSERT INTO public.stack_pergunta_tags (pergunta_id, tag_id)
      SELECT p_pergunta_id, unnest(v_all)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  PERFORM public.stack_perguntas_refresh_search_vector(p_pergunta_id);

  IF v_p.autor_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.stack_notificar_agregada(v_p.autor_id, p_pergunta_id, 'pergunta_editada', trim(p_titulo));
  END IF;
  PERFORM public.stack_notificar_favoritos_edicao(p_pergunta_id, trim(p_titulo), auth.uid());
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
    IF NOT v_exists AND v_autor IS DISTINCT FROM auth.uid() THEN
      PERFORM public.stack_notificar_agregada(v_autor, v_pergunta_id, 'joinha_pergunta', v_titulo);
    END IF;
  ELSE
    SELECT count(*)::int INTO v_count FROM public.stack_votes WHERE alvo_tipo = 'resposta' AND alvo_id = p_alvo_id;
    UPDATE public.stack_respostas SET upvote_count = v_count WHERE id = p_alvo_id
    RETURNING autor_id, pergunta_id INTO v_autor, v_pergunta_id;
    SELECT titulo INTO v_titulo FROM public.stack_perguntas WHERE id = v_pergunta_id;
    IF NOT v_exists AND v_autor IS DISTINCT FROM auth.uid() THEN
      PERFORM public.stack_notificar_agregada(v_autor, v_pergunta_id, 'joinha_resposta', v_titulo);
    END IF;
  END IF;

  RETURN jsonb_build_object('upvote_count', v_count, 'usuario_votou', NOT v_exists);
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_favoritar(p_pergunta_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.stack_favoritos WHERE user_id = auth.uid() AND pergunta_id = p_pergunta_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.stack_favoritos WHERE user_id = auth.uid() AND pergunta_id = p_pergunta_id;
    RETURN false;
  END IF;
  INSERT INTO public.stack_favoritos (user_id, pergunta_id) VALUES (auth.uid(), p_pergunta_id);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_marcar_aceita(p_pergunta_id uuid, p_resposta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.stack_perguntas%ROWTYPE;
  v_r public.stack_respostas%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM public.stack_perguntas WHERE id = p_pergunta_id;
  SELECT * INTO v_r FROM public.stack_respostas WHERE id = p_resposta_id AND pergunta_id = p_pergunta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inválido'; END IF;
  IF v_p.status <> 'aberta' THEN RAISE EXCEPTION 'Pergunta não está aberta'; END IF;
  IF v_p.autor_id <> auth.uid() AND NOT public.stack_is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.stack_perguntas
  SET resposta_aceita_id = p_resposta_id,
      status = 'fechada',
      ultima_atividade_em = now()
  WHERE id = p_pergunta_id;

  PERFORM public.stack_notificar_simples(
    v_r.autor_id,
    p_pergunta_id,
    'resposta_aceita',
    format('Sua resposta foi marcada como solução em «%s»', left(v_p.titulo, 80))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_reabrir(p_pergunta_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.stack_perguntas%ROWTYPE;
  v_motivo text := trim(coalesce(p_motivo, ''));
  r record;
BEGIN
  IF NOT public.stack_is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF char_length(v_motivo) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo da reabertura';
  END IF;

  SELECT * INTO v_p FROM public.stack_perguntas WHERE id = p_pergunta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pergunta não encontrada'; END IF;

  INSERT INTO public.stack_reaberturas (pergunta_id, staff_id, motivo)
  VALUES (p_pergunta_id, auth.uid(), v_motivo);

  UPDATE public.stack_perguntas
  SET status = 'aberta',
      resposta_aceita_id = NULL,
      ultima_atividade_em = now()
  WHERE id = p_pergunta_id;

  PERFORM public.stack_notificar_simples(
    v_p.autor_id,
    p_pergunta_id,
    'pergunta_reaberta',
    format('Sua pergunta «%s» foi reaberta pela equipe', left(v_p.titulo, 80))
  );

  FOR r IN
    SELECT f.user_id FROM public.stack_favoritos f
    WHERE f.pergunta_id = p_pergunta_id AND f.user_id IS DISTINCT FROM v_p.autor_id
  LOOP
    PERFORM public.stack_notificar_simples(
      r.user_id,
      p_pergunta_id,
      'pergunta_reaberta',
      format('Pergunta favorita «%s» foi reaberta', left(v_p.titulo, 80))
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_fechar(p_pergunta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.stack_perguntas%ROWTYPE;
  r record;
BEGIN
  IF NOT public.stack_is_staff(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO v_p FROM public.stack_perguntas WHERE id = p_pergunta_id;
  UPDATE public.stack_perguntas SET status = 'fechada', ultima_atividade_em = now() WHERE id = p_pergunta_id;

  PERFORM public.stack_notificar_simples(
    v_p.autor_id, p_pergunta_id, 'pergunta_fechada',
    format('Sua pergunta «%s» foi fechada', left(v_p.titulo, 80))
  );
  FOR r IN
    SELECT f.user_id FROM public.stack_favoritos f
    WHERE f.pergunta_id = p_pergunta_id AND f.user_id IS DISTINCT FROM v_p.autor_id
  LOOP
    PERFORM public.stack_notificar_simples(
      r.user_id, p_pergunta_id, 'pergunta_fechada',
      format('Pergunta favorita «%s» foi fechada', left(v_p.titulo, 80))
    );
  END LOOP;
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
  IF FOUND AND v_p.autor_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.stack_notificar_simples(
      v_p.autor_id, p_pergunta_id, 'conteudo_removido',
      format('Sua pergunta «%s» foi removida pela moderação', left(v_p.titulo, 80))
    );
  END IF;
  DELETE FROM public.stack_perguntas WHERE id = p_pergunta_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tags / busca / notificações
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stack_listar_tags(p_q text DEFAULT '', p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'slug', t.slug, 'rotulo', t.rotulo) ORDER BY t.rotulo), '[]'::jsonb)
  FROM (
    SELECT t.*
    FROM public.stack_tags t
    WHERE (
      coalesce(trim(p_q), '') = ''
      OR t.rotulo ILIKE '%' || trim(p_q) || '%'
      OR t.slug ILIKE '%' || public.stack_tag_slug(p_q) || '%'
    )
    ORDER BY t.rotulo
    LIMIT least(greatest(coalesce(p_limit, 20), 1), 50)
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.stack_buscar(
  p_query text,
  p_escopo text DEFAULT 'ambos',
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_equipe_ctx uuid DEFAULT NULL,
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
  v_ts tsquery;
  v_rows jsonb;
  v_lim int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF length(trim(coalesce(p_query, ''))) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;

  v_ts := websearch_to_tsquery('portuguese', trim(p_query));
  v_where := public.stack_feed_where(p_filtros, p_equipe_ctx);
  v_lim := least(greatest(coalesce(p_limit, 40), 1), 100);

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
      LIMIT $3
    ) sub
    $q$,
    v_where,
    v_where
  ) INTO v_rows USING v_ts, p_escopo, v_lim;

  RETURN coalesce(v_rows, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_listar_notificacoes(p_limit int DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(row_to_json(n)::jsonb ORDER BY n.updated_at DESC), '[]'::jsonb)
  FROM (
    SELECT id, pergunta_id, tipo, contador, mensagem, lida_em, created_at, updated_at
    FROM public.stack_notificacoes
    WHERE user_id = auth.uid()
    ORDER BY updated_at DESC
    LIMIT least(greatest(coalesce(p_limit, 30), 1), 100)
  ) n;
$$;

CREATE OR REPLACE FUNCTION public.stack_marcar_notificacao_lida(p_notificacao_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.stack_notificacoes
  SET lida_em = now()
  WHERE id = p_notificacao_id AND user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.stack_contagem_notificacoes_nao_lidas()
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.stack_notificacoes
  WHERE user_id = auth.uid() AND lida_em IS NULL;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.stack_listar_feed(jsonb, uuid, timestamptz, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_obter_pergunta(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_criar_pergunta(text, text, uuid[], text[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_editar_pergunta(uuid, text, text, uuid[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_criar_resposta(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_editar_resposta(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_votar(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_favoritar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_marcar_aceita(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_reabrir(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_fechar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_deletar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_listar_tags(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_buscar(text, text, jsonb, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_listar_notificacoes(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_marcar_notificacao_lida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_contagem_notificacoes_nao_lidas() TO authenticated;

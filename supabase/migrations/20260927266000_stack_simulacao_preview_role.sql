-- Preview de simulação (admin): respostas RPC de leitura como perfil operacional

CREATE OR REPLACE FUNCTION public.stack_viewer_staff_mode(p_preview_role text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := lower(trim(coalesce(p_preview_role, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF NOT public.stack_is_staff(auth.uid()) THEN
    RETURN false;
  END IF;
  IF public.is_admin(auth.uid()) AND v_role = 'user' THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_autor_json_for_view(p_user_id uuid, p_staff_view boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT p_staff_view THEN
    RETURN jsonb_build_object('anonimo', true);
  END IF;
  RETURN (
    SELECT jsonb_build_object('id', u.id, 'nome', u.nome, 'email', u.email)
    FROM public.users u
    WHERE u.id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_editor_json_for_view(
  p_user_id uuid,
  p_editado_em timestamptz,
  p_staff_view boolean
)
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
  IF p_staff_view THEN
    RETURN jsonb_build_object(
      'editado_em', p_editado_em,
      'por', public.stack_autor_json_for_view(p_user_id, true)
    );
  END IF;
  RETURN jsonb_build_object('editado_em', p_editado_em);
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
    'respostas', v_respostas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.stack_viewer_staff_mode(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_autor_json_for_view(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_editor_json_for_view(uuid, timestamptz, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stack_viewer_staff_mode(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_autor_json_for_view(uuid, boolean) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_editor_json_for_view(uuid, timestamptz, boolean) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.stack_obter_pergunta(uuid, text) TO authenticated;

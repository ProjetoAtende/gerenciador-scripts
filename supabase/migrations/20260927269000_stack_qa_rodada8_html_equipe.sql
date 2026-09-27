-- Rodada 8: BUG-28 (decode/allowlist URL) e BUG-33 (autor_equipe_id)

CREATE OR REPLACE FUNCTION public.stack_entity_code_to_char(p_code int)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_code IS NULL OR p_code < 0 OR p_code > 1114111 THEN
    RETURN NULL;
  END IF;
  RETURN chr(p_code);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_html_decode_entities(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := coalesce(p_text, '');
  v_prev text;
  m text[];
  code int;
  rep text;
  hex text;
  i int := 0;
BEGIN
  v := regexp_replace(v, '&colon;', ':', 'gi');
  v := regexp_replace(v, '&tab;', chr(9), 'gi');
  v := regexp_replace(v, '&newline;', chr(10), 'gi');
  v := regexp_replace(v, '&sol;', '/', 'gi');

  LOOP
    i := i + 1;
    EXIT WHEN i > 512;
    v_prev := v;

    m := regexp_match(v, '&#x([0-9a-f]+);', 'i');
    IF m IS NOT NULL THEN
      hex := m[1];
      BEGIN
        code := to_number(hex, 'FMXXXXXXXXXXXXXXXX');
        rep := public.stack_entity_code_to_char(code);
        IF rep IS NOT NULL THEN
          v := regexp_replace(v, '&#x' || m[1] || ';', rep, 'i');
          CONTINUE;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END;
    END IF;

    m := regexp_match(v, '&#([0-9]{1,7});');
    IF m IS NOT NULL THEN
      code := m[1]::int;
      rep := public.stack_entity_code_to_char(code);
      IF rep IS NOT NULL THEN
        v := regexp_replace(v, '&#([0-9]{1,7});', rep, 1);
        CONTINUE;
      END IF;
    END IF;

    m := regexp_match(v, '&#([0-9]{1,7})(?=[^0-9;]|$)');
    IF m IS NOT NULL THEN
      code := m[1]::int;
      rep := public.stack_entity_code_to_char(code);
      IF rep IS NOT NULL THEN
        v := regexp_replace(v, '&#([0-9]{1,7})(?=[^0-9;]|$)', rep, 1);
        CONTINUE;
      END IF;
    END IF;

    EXIT WHEN v = v_prev;
  END LOOP;

  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_url_scheme_permitido(p_raw text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
  v_compact text;
BEGIN
  v := trim(both from public.stack_html_decode_entities(coalesce(p_raw, '')));
  IF v = '' OR v = '#' THEN
    RETURN true;
  END IF;

  v_compact := lower(regexp_replace(v, '[\x00-\x20]+', '', 'g'));
  IF v_compact ~ '^(javascript|vbscript|data):' THEN
    RETURN false;
  END IF;

  IF v ~* '^https?://' THEN
    RETURN true;
  END IF;
  IF v ~* '^mailto:' THEN
    RETURN true;
  END IF;
  IF v ~ '^\#' OR v ~ '^/' OR v ~ '^\./' THEN
    RETURN true;
  END IF;
  IF v !~ ':' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_assert_href_src_permitidos(p_html text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := coalesce(p_html, '');
  rem text;
  m text[];
  val text;
  n int := 0;
BEGIN
  rem := public.stack_html_decode_entities(v);

  LOOP
    n := n + 1;
    EXIT WHEN n > 256;

    m := regexp_match(rem, '(href|src)\s*=\s*"([^"]*)"', 'i');
    IF m IS NOT NULL THEN
      val := m[2];
      IF NOT public.stack_url_scheme_permitido(val) THEN
        RAISE EXCEPTION 'Link não permitido';
      END IF;
      rem := regexp_replace(rem, '(href|src)\s*=\s*"[^"]*"', ' ', 'i');
      CONTINUE;
    END IF;

    m := regexp_match(rem, '(href|src)\s*=\s*''([^'']*)''', 'i');
    IF m IS NOT NULL THEN
      val := m[2];
      IF NOT public.stack_url_scheme_permitido(val) THEN
        RAISE EXCEPTION 'Link não permitido';
      END IF;
      rem := regexp_replace(rem, '(href|src)\s*=\s*''[^'']*''', ' ', 'i');
      CONTINUE;
    END IF;

    m := regexp_match(rem, '(href|src)\s*=\s*([^\s>''"]+)', 'i');
    IF m IS NOT NULL THEN
      val := m[2];
      IF NOT public.stack_url_scheme_permitido(val) THEN
        RAISE EXCEPTION 'Link não permitido';
      END IF;
      rem := regexp_replace(rem, '(href|src)\s*=\s*[^\s>''"]+', ' ', 'i');
      CONTINUE;
    END IF;

    EXIT;
  END LOOP;
END;
$$;

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

  IF v ~* '<[^>]+[\s/]on[a-zA-Z]+\s*=' THEN
    RAISE EXCEPTION 'Conteúdo HTML não permitido';
  END IF;

  PERFORM public.stack_assert_href_src_permitidos(v);

  IF public.stack_html_decode_entities(v) ~* '<(script|iframe|object|embed)(\s|>|/)' THEN
    RAISE EXCEPTION 'Conteúdo HTML não permitido';
  END IF;

  IF public.stack_html_decode_entities(v) ~* '<[^>]+[\s/]on[a-zA-Z]+\s*=' THEN
    RAISE EXCEPTION 'Conteúdo HTML não permitido';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.stack_autor_equipe_efetiva(p_client uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT equipe_id INTO v_profile FROM public.users WHERE id = auth.uid();

  IF public.stack_is_staff(auth.uid()) THEN
    RETURN p_client;
  END IF;

  IF p_client IS NOT NULL AND p_client IS DISTINCT FROM v_profile THEN
    RAISE EXCEPTION 'Equipe inválida para este usuário';
  END IF;

  RETURN v_profile;
END;
$$;

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
  v_equipe uuid;
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

  v_equipe := public.stack_autor_equipe_efetiva(p_autor_equipe_id);

  INSERT INTO public.stack_perguntas (titulo, corpo_html, autor_id, autor_equipe_id)
  VALUES (trim(p_titulo), coalesce(p_corpo_html, ''), auth.uid(), v_equipe)
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
  v_equipe uuid;
BEGIN
  PERFORM public.stack_assert_html_seguro(p_corpo_html);

  SELECT * INTO v_p FROM public.stack_perguntas WHERE id = p_pergunta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pergunta não encontrada'; END IF;
  IF v_p.status <> 'aberta' THEN RAISE EXCEPTION 'Pergunta encerrada'; END IF;
  IF char_length(public.stack_html_to_plain(p_corpo_html)) < 1 THEN
    RAISE EXCEPTION 'Resposta vazia';
  END IF;

  v_equipe := public.stack_autor_equipe_efetiva(p_autor_equipe_id);

  INSERT INTO public.stack_respostas (pergunta_id, corpo_html, autor_id, autor_equipe_id)
  VALUES (p_pergunta_id, coalesce(p_corpo_html, ''), auth.uid(), v_equipe)
  RETURNING id INTO v_id;

  PERFORM public.stack_notificar_agregada(v_p.autor_id, p_pergunta_id, 'nova_resposta', v_p.titulo);
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.stack_entity_code_to_char(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_url_scheme_permitido(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_assert_href_src_permitidos(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stack_autor_equipe_efetiva(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.stack_criar_pergunta(text, text, uuid[], text[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stack_criar_resposta(uuid, text, uuid) TO authenticated;

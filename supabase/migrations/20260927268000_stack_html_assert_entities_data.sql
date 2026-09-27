-- BUG-28: decodificar entidades numéricas antes de validar href/src; bloquear data:

CREATE OR REPLACE FUNCTION public.stack_html_decode_entities(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := coalesce(p_text, '');
  m text[];
  code int;
  hex text;
  i int := 0;
BEGIN
  LOOP
    i := i + 1;
    EXIT WHEN i > 64;

    m := regexp_match(v, '&#(\d+);');
    IF m IS NOT NULL THEN
      code := m[1]::int;
      IF code BETWEEN 0 AND 1114111 THEN
        v := regexp_replace(v, '&#(\d+);', chr(code), 1);
        CONTINUE;
      END IF;
    END IF;

    m := regexp_match(v, '&#x([0-9a-fA-F]+);');
    IF m IS NOT NULL THEN
      hex := m[1];
      IF length(hex) % 2 = 1 THEN
        hex := '0' || hex;
      END IF;
      BEGIN
        v := regexp_replace(
          v,
          '&#x' || m[1] || ';',
          convert_from(decode(hex, 'hex'), 'UTF8'),
          1
        );
      EXCEPTION
        WHEN OTHERS THEN
          EXIT;
      END;
      CONTINUE;
    END IF;

    EXIT;
  END LOOP;

  RETURN v;
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
  v_dec text;
BEGIN
  IF v ~* '<(script|iframe|object|embed)(\s|>|/)' THEN
    RAISE EXCEPTION 'Conteúdo HTML não permitido';
  END IF;

  IF v ~* '(href|src)\s*=\s*[''"]?\s*data\s*:' THEN
    RAISE EXCEPTION 'Link não permitido';
  END IF;

  IF v ~* '<[^>]+[\s/]on[a-zA-Z]+\s*=' THEN
    RAISE EXCEPTION 'Conteúdo HTML não permitido';
  END IF;

  v_dec := public.stack_html_decode_entities(v);

  IF v_dec ~* '<(script|iframe|object|embed)(\s|>|/)' THEN
    RAISE EXCEPTION 'Conteúdo HTML não permitido';
  END IF;

  IF v_dec ~* '(href|src)\s*=\s*[''"]?\s*(javascript|data|vbscript)\s*:' THEN
    RAISE EXCEPTION 'Link não permitido';
  END IF;

  IF v_dec ~* '<[^>]+[\s/]on[a-zA-Z]+\s*=' THEN
    RAISE EXCEPTION 'Conteúdo HTML não permitido';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.stack_html_decode_entities(text) FROM PUBLIC, anon, authenticated;

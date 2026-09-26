-- fix_http_stubs.sql
-- Stubs para extensoes indisponiveis no Docker local (http, pg_similarity)
-- Cria tipos e funcoes necessarios para que o schema_dump possa criar funcoes que dependem deles

-- ==== HTTP extension types ====
DO $$ BEGIN
  CREATE DOMAIN http_method AS text;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE http_header AS (field varchar, value varchar);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE http_request AS (
    method http_method,
    uri varchar,
    headers http_header[],
    content_type varchar,
    content varchar
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE http_response AS (
    status integer,
    content_type varchar,
    headers http_header[],
    content varchar
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==== urlencode stubs (ANTES de http_get/http_post que dependem dele) ====
CREATE OR REPLACE FUNCTION public.urlencode(string bytea)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN encode(string, 'escape');
END;
$function$;

CREATE OR REPLACE FUNCTION public.urlencode(string varchar)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN string;
END;
$function$;

CREATE OR REPLACE FUNCTION public.urlencode(data jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  k text;
  v text;
  parts text[] := '{}';
BEGIN
  FOR k, v IN SELECT key, value #>> '{}' FROM jsonb_each(data)
  LOOP
    parts := array_append(parts, k || '=' || v);
  END LOOP;
  RETURN array_to_string(parts, '&');
END;
$function$;

-- ==== jaccard_distance stub ====
CREATE OR REPLACE FUNCTION public.jaccard_distance(bit, bit)
 RETURNS double precision
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN 0.5;
END;
$function$;

-- ==== HTTP stub functions ====

-- Main http() function (stub - raises error if actually called)
CREATE OR REPLACE FUNCTION public.http(request http_request)
 RETURNS http_response
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'http extension not available in local Docker environment';
END;
$function$;

CREATE OR REPLACE FUNCTION public.http_get(uri varchar)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('GET', $1, NULL, NULL, NULL)::public.http_request) $function$;

CREATE OR REPLACE FUNCTION public.http_get(uri varchar, data jsonb)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('GET', $1 || '?' || public.urlencode($2), NULL, NULL, NULL)::public.http_request) $function$;

CREATE OR REPLACE FUNCTION public.http_post(uri varchar, content varchar, content_type varchar)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('POST', $1, NULL, $3, $2)::public.http_request) $function$;

CREATE OR REPLACE FUNCTION public.http_post(uri varchar, data jsonb)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('POST', $1, NULL, 'application/x-www-form-urlencoded', public.urlencode($2))::public.http_request) $function$;

CREATE OR REPLACE FUNCTION public.http_put(uri varchar, content varchar, content_type varchar)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('PUT', $1, NULL, $3, $2)::public.http_request) $function$;

CREATE OR REPLACE FUNCTION public.http_delete(uri varchar)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('DELETE', $1, NULL, NULL, NULL)::public.http_request) $function$;

CREATE OR REPLACE FUNCTION public.http_delete(uri varchar, content varchar, content_type varchar)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('DELETE', $1, NULL, $3, $2)::public.http_request) $function$;

CREATE OR REPLACE FUNCTION public.http_patch(uri varchar, content varchar, content_type varchar)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('PATCH', $1, NULL, $3, $2)::public.http_request) $function$;

CREATE OR REPLACE FUNCTION public.http_head(uri varchar)
 RETURNS http_response
 LANGUAGE sql
AS $function$ SELECT public.http(('HEAD', $1, NULL, NULL, NULL)::public.http_request) $function$;

CREATE OR REPLACE FUNCTION public.http_header(field varchar, value varchar)
 RETURNS http_header
 LANGUAGE sql
AS $function$ SELECT $1, $2 $function$;

CREATE OR REPLACE FUNCTION public.http_list_curlopt()
 RETURNS TABLE(curlopt text, value text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'http extension not available in local Docker environment';
END;
$function$;

CREATE OR REPLACE FUNCTION public.http_set_curlopt(curlopt varchar, value varchar)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'http extension not available in local Docker environment';
END;
$function$;

CREATE OR REPLACE FUNCTION public.http_reset_curlopt()
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'http extension not available in local Docker environment';
END;
$function$;

-- EOF

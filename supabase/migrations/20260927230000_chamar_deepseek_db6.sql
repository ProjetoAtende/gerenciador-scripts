-- DB-6: RPC chamar_deepseek (Pasquale, Oráculo, classificação de scripts, etc.)
-- Requer: extensão http + secret DEEPSEEK_API_KEY no Vault do projeto.
--
-- Após o push, configure a chave (SQL Editor, role service):
--   SELECT vault.create_secret(
--     '<sua-chave-deepseek>',
--     'DEEPSEEK_API_KEY',
--     'API key DeepSeek para public.chamar_deepseek'
--   );

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

DROP FUNCTION IF EXISTS public.chamar_deepseek(jsonb, text, double precision, integer);
DROP FUNCTION IF EXISTS public.chamar_deepseek(jsonb, text, double precision, integer, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.chamar_deepseek(
  p_messages jsonb,
  p_model text DEFAULT 'deepseek-v4-flash'::text,
  p_temperature double precision DEFAULT 0.3,
  p_max_tokens integer DEFAULT 4096,
  p_response_format jsonb DEFAULT NULL::jsonb,
  p_thinking jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions, vault
SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_api_key text;
  v_response extensions.http_response;
  v_body jsonb;
BEGIN
  PERFORM set_config('http.timeout_msec', '120000', true);

  SELECT ds.decrypted_secret
  INTO v_api_key
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'DEEPSEEK_API_KEY'
  LIMIT 1;

  IF v_api_key IS NULL OR btrim(v_api_key) = '' THEN
    v_api_key := NULLIF(current_setting('app.settings.deepseek_api_key', true), '');
  END IF;

  IF v_api_key IS NULL OR btrim(v_api_key) = '' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'message',
        'DEEPSEEK_API_KEY não configurada. Use vault.create_secret ou app.settings.deepseek_api_key.'
      )
    );
  END IF;

  v_body := jsonb_build_object(
    'model', p_model,
    'messages', p_messages,
    'temperature', p_temperature,
    'max_tokens', p_max_tokens
  );

  IF p_response_format IS NOT NULL THEN
    v_body := v_body || jsonb_build_object('response_format', p_response_format);
  END IF;

  IF p_thinking IS NOT NULL THEN
    v_body := v_body || jsonb_build_object('thinking', p_thinking);
  END IF;

  SELECT * INTO v_response FROM extensions.http((
    'POST',
    'https://api.deepseek.com/chat/completions',
    ARRAY[
      extensions.http_header('Content-Type', 'application/json'),
      extensions.http_header('Authorization', 'Bearer ' || v_api_key)
    ],
    'application/json',
    v_body::text
  )::extensions.http_request);

  IF v_response.status != 200 THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Erro na API DeepSeek: ' || v_response.status,
        'details', v_response.content
      )
    );
  END IF;

  IF v_response.content IS NULL OR btrim(v_response.content) = '' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Resposta vazia da API DeepSeek'
      )
    );
  END IF;

  RETURN v_response.content::jsonb;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'Erro ao chamar DeepSeek: ' || SQLERRM,
      'sqlstate', SQLSTATE
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.chamar_deepseek(jsonb, text, double precision, integer, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chamar_deepseek(jsonb, text, double precision, integer, jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION public.chamar_deepseek(jsonb, text, double precision, integer, jsonb, jsonb) IS
  'Proxy DeepSeek (chat/completions) via extensão http. Chave em vault DEEPSEEK_API_KEY. Timeout HTTP/SQL: 120s.';

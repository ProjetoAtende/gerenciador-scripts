-- Smoke test Pasquale / chamar_deepseek (não versionar resultado com chaves)
SELECT public.chamar_deepseek(
  '[{"role":"user","content":"Responda com exatamente uma palavra: funcionando"}]'::jsonb,
  'deepseek-v4-flash'::text,
  0.1::double precision,
  256::integer,
  NULL::jsonb,
  NULL::jsonb
) AS result;

-- Mapeamento DJEN idOrgao 98526 → UPJ da 1ª a 5ª Varas (FCC-01-05 / UPJ VI).
-- Complementa o fallback por faixa de Varas no cliente; acelera consultas futuras.

BEGIN;

INSERT INTO public.prioridades_orgaos_upj (id_orgao_djen, nome_orgao_djen, vara, upj_id, ativo)
SELECT
  98526,
  'UPJ da 1ª a 5ª Varas Cíveis - Foro Central Cível',
  1,
  u.id,
  true
FROM public.prioridades_upjs u
WHERE u.codigo = 'FCC-01-05'
ON CONFLICT (id_orgao_djen) DO UPDATE
SET nome_orgao_djen = excluded.nome_orgao_djen,
    vara = excluded.vara,
    upj_id = excluded.upj_id,
    ativo = true,
    atualizado_em = now();

COMMIT;

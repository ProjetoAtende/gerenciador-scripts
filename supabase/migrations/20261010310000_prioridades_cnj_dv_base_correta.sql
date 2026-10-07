-- App "Prioridades e Urgências" — corrige de fato o cálculo do DV CNJ.
--
-- A migration 20261010300000 trocou a regra, mas a montagem da base estava
-- errada: `substring(v_d from 10 for 11)` devolvia 11 dígitos, produzindo uma
-- base de 21 dígitos. Resultado: TODO número válido continuava sendo recusado.
--
-- A base correta tem 20 dígitos e é montada assim:
--
--     NNNNNNN (1-7) + AAAA (10-13) + J (14) + TR (15-16) + OOOO (17-20) + "00"
--                    ^ o DV ocupa as posições 8-9 e é justamente o que se calcula
--
--     DV = 98 - (base mod 97)
--
-- Conferido com números reais:
--   1076547-84.2025.8.26.0100 → base 1076547202582600100 → 98 - 14 = 84 ✔
--   1008223-35.2025.8.26.0361 → DV calculado 35 ✔

BEGIN;

CREATE OR REPLACE FUNCTION public.prioridades_cnj_dv_valido(p_digitos text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_d text;
  v_base text;
  v_dv integer;
BEGIN
  v_d := regexp_replace(COALESCE(p_digitos, ''), '\D', '', 'g');
  IF length(v_d) <> 20 THEN
    RETURN FALSE;
  END IF;

  v_dv := substring(v_d from 8 for 2)::integer;

  -- Sequencial + ano + segmento + tribunal + órgão, sem o DV, e "00" no lugar.
  v_base := substring(v_d from 1 for 7)      -- NNNNNNN
         || substring(v_d from 10 for 4)     -- AAAA
         || substring(v_d from 14 for 1)     -- J
         || substring(v_d from 15 for 2)     -- TR
         || substring(v_d from 17 for 4)     -- OOOO
         || '00';                            -- posições do DV

  IF length(v_base) <> 20 THEN
    RETURN FALSE;
  END IF;

  RETURN v_dv = (98 - (v_base::numeric % 97));
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_cnj_dv_valido(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_cnj_dv_valido(text) TO authenticated;

COMMENT ON FUNCTION public.prioridades_cnj_dv_valido(text) IS
  'Dígito verificador do número único CNJ (Resolução 65/2008): DV = 98 - (NNNNNNN+AAAA+J+TR+OOOO+"00" mod 97).';

COMMIT;

-- App "Prioridades e Urgências" — corrige o cálculo do dígito verificador CNJ.
--
-- A migration 20261010280000 validou o DV com `mod 97 = 1`, que é a regra do
-- **número base** (sem o DV). Para o número COMPLETO, que é o que chega da tela,
-- a regra da Resolução CNJ nº 65/2008 é outra:
--
--     DV = 98 - (NNNNNNN + AAAA + J + TR + OOOO + "00"  mod 97)
--
-- Confirmado contra números reais:
--   1076547-84.2025.8.26.0100 → DV calculado 84 ✔
--   1008223-35.2025.8.26.0361 → DV calculado 35 ✔
--
-- Com a regra errada, **todo** processo legítimo era recusado com "dígito
-- verificador inválido" — pior do que não validar.
--
-- Nota: a validação não é obrigatória em nenhum requisito da especificação, mas
-- é barata e protege a base de erro de digitação. Fica condicionada a 20 dígitos.

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
  v_calculado integer;
BEGIN
  v_d := regexp_replace(COALESCE(p_digitos, ''), '\D', '', 'g');
  IF length(v_d) <> 20 THEN
    RETURN FALSE;
  END IF;

  v_dv := substring(v_d from 8 for 2)::integer;

  -- Mesmos 20 dígitos, com o DV zerado: é sobre esta base que o DV é calculado.
  v_base := substring(v_d from 1 for 7) || '00' || substring(v_d from 10 for 11);
  v_calculado := 98 - (v_base::numeric % 97);

  RETURN v_dv = v_calculado;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_cnj_dv_valido(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_cnj_dv_valido(text) TO authenticated;

COMMENT ON FUNCTION public.prioridades_cnj_dv_valido(text) IS
  'Dígito verificador do número único CNJ (Resolução 65/2008): DV = 98 - (base com DV zerado mod 97).';

COMMIT;

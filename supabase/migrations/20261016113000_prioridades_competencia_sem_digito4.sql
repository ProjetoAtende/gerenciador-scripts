-- PC-03b: remove exigência de sequencial iniciado em 4. Competência = CNJ 8.26.0100,
-- Vara 1–45 quando informada, órgão DJEN compatível (Câmara/Gab. recusados).

BEGIN;

CREATE OR REPLACE FUNCTION public.prioridades_processo_competencia_atende(
  p_processo text,
  p_vara integer,
  p_nome_orgao text,
  p_validacao text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_d text;
BEGIN
  v_d := regexp_replace(COALESCE(p_processo, ''), '\D', '', 'g');
  IF length(v_d) <> 20 THEN
    RETURN FALSE;
  END IF;

  IF substring(v_d FROM 14 FOR 3) <> '826'
     OR substring(v_d FROM 17 FOR 4) <> '0100' THEN
    RETURN FALSE;
  END IF;

  IF p_vara IS NOT NULL AND (p_vara < 1 OR p_vara > 45) THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(trim(p_nome_orgao), '') <> '' THEN
    IF p_nome_orgao ~* '(Câmara|Camara|Gab\.|Gabinete|Turma Recursal|Desembargador)'
       AND p_nome_orgao !~* '(Vara Cível|Varas Cíveis)' THEN
      RETURN FALSE;
    END IF;

    IF p_nome_orgao !~* '(Vara Cível|Varas Cíveis|UPJ da|Foro Central Cível)' THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.prioridades_processo_competencia_atende IS
  'Competência TJSP Atende: CNJ 8.26.0100, Vara 1–45, órgão DJEN incompatível recusado. O 1.º dígito do sequencial não define competência (SAJ/Eproc).';

COMMIT;

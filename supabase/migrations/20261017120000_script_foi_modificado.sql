-- SC-C1c-REG: marcar_curadoria_script dependia de script_foi_modificado (nunca criada nas migrations)

BEGIN;

CREATE OR REPLACE FUNCTION public.script_foi_modificado(p_script_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row public.scripts_customizados%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.scripts_customizados WHERE id = p_script_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_row.conteudo_original IS NOT NULL
     AND v_row.conteudo_bruto IS DISTINCT FROM v_row.conteudo_original THEN
    RETURN true;
  END IF;

  IF COALESCE(v_row.tem_conteudo_atendente, false)
     AND v_row.conteudo_atendente IS NOT NULL
     AND v_row.conteudo_original IS NOT NULL
     AND v_row.conteudo_atendente IS DISTINCT FROM v_row.conteudo_original THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.script_foi_modificado(uuid) IS
  'Indica se o conteúdo atual diverge do conteudo_original (snapshot no INSERT). Usado por marcar_curadoria_script.';

GRANT EXECUTE ON FUNCTION public.script_foi_modificado(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.script_foi_modificado(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.script_foi_modificado(uuid) FROM anon;

COMMIT;

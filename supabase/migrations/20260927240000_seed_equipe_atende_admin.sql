-- Equipe inicial Atende + lotação e admin para dpestilli@tjsp.jus.br
-- Idempotente: pode reaplicar sem duplicar setor/equipe.

DO $$
DECLARE
  v_setor_id uuid;
  v_equipe_id uuid;
BEGIN
  SELECT id INTO v_setor_id
  FROM public.setores
  WHERE nome = 'Atende'
  LIMIT 1;

  IF v_setor_id IS NULL THEN
    INSERT INTO public.setores (nome)
    VALUES ('Atende')
    RETURNING id INTO v_setor_id;
  END IF;

  SELECT id INTO v_equipe_id
  FROM public.equipes
  WHERE nome = 'Atende'
    AND setor_id = v_setor_id
  LIMIT 1;

  IF v_equipe_id IS NULL THEN
    INSERT INTO public.equipes (nome, setor_id, sgs_codigo)
    VALUES ('Atende', v_setor_id, 'ATENDE')
    RETURNING id INTO v_equipe_id;
  END IF;

  UPDATE public.users
  SET
    equipe_id = v_equipe_id,
    setor_id = v_setor_id,
    role = 'admin'::public.user_role,
    nome = COALESCE(NULLIF(trim(nome), ''), 'David Pestilli'),
    ativo = true,
    updated_at = timezone('utc', now())
  WHERE lower(email) = lower('dpestilli@tjsp.jus.br');
END;
$$;

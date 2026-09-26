-- DB-4: Escala por calendarios (generico por equipe, sem seeds legado 231/232/NAPE)

CREATE TABLE IF NOT EXISTS public.escala_calendarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text,
  grupo_compartilhamento text,
  ativo boolean NOT NULL DEFAULT true,
  desativado_em timestamptz,
  criado_por uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escala_calendario_equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id uuid NOT NULL REFERENCES public.escala_calendarios(id) ON DELETE CASCADE,
  equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendario_id, equipe_id)
);

CREATE TABLE IF NOT EXISTS public.escala_calendario_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id uuid NOT NULL REFERENCES public.escala_calendarios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  turno text NOT NULL CHECK (turno IN ('09:00-17:00', '11:00-19:00')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendario_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.escala_registros_dia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id uuid NOT NULL REFERENCES public.escala_calendarios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('presencial', 'extraordinario')),
  criado_por uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendario_id, user_id, data, tipo)
);

CREATE TABLE IF NOT EXISTS public.escala_afastamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id uuid NOT NULL REFERENCES public.escala_calendarios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('ferias', 'licenca', 'folga')),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  observacao text,
  criado_por uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);

CREATE TABLE IF NOT EXISTS public.escala_agenda_institucional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('feriado', 'emenda', 'recesso')),
  titulo text NOT NULL,
  descricao text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  criado_por uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);

CREATE TABLE IF NOT EXISTS public.escala_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id uuid NOT NULL REFERENCES public.escala_calendarios(id) ON DELETE CASCADE,
  ator_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  acao text NOT NULL,
  resumo text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escala_rotinas_semanais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id uuid NOT NULL REFERENCES public.escala_calendarios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('presencial')),
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
  data_inicio date NOT NULL,
  data_fim date,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);

CREATE TABLE IF NOT EXISTS public.escala_rotinas_excecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id uuid NOT NULL REFERENCES public.escala_calendarios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('presencial', 'extraordinario')),
  criado_por uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendario_id, user_id, data, tipo)
);

CREATE INDEX IF NOT EXISTS idx_escala_calendario_equipes_equipe_id ON public.escala_calendario_equipes (equipe_id);
CREATE INDEX IF NOT EXISTS idx_escala_membros_calendario_id ON public.escala_calendario_membros (calendario_id);
CREATE INDEX IF NOT EXISTS idx_escala_membros_user_id ON public.escala_calendario_membros (user_id);
CREATE INDEX IF NOT EXISTS idx_escala_registros_calendario_data ON public.escala_registros_dia (calendario_id, data);
CREATE INDEX IF NOT EXISTS idx_escala_afastamentos_calendario_periodo ON public.escala_afastamentos (calendario_id, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_escala_agenda_institucional_periodo ON public.escala_agenda_institucional (data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_escala_auditoria_calendario_id ON public.escala_auditoria (calendario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escala_rotinas_semanais_calendario_periodo ON public.escala_rotinas_semanais (calendario_id, dia_semana, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_escala_rotinas_excecoes_calendario_data ON public.escala_rotinas_excecoes (calendario_id, data);

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escala_calendarios_updated_at ON public.escala_calendarios;
CREATE TRIGGER trg_escala_calendarios_updated_at
BEFORE UPDATE ON public.escala_calendarios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_escala_membros_updated_at ON public.escala_calendario_membros;
CREATE TRIGGER trg_escala_membros_updated_at
BEFORE UPDATE ON public.escala_calendario_membros
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_escala_registros_dia_updated_at ON public.escala_registros_dia;
CREATE TRIGGER trg_escala_registros_dia_updated_at
BEFORE UPDATE ON public.escala_registros_dia
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_escala_afastamentos_updated_at ON public.escala_afastamentos;
CREATE TRIGGER trg_escala_afastamentos_updated_at
BEFORE UPDATE ON public.escala_afastamentos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_escala_agenda_institucional_updated_at ON public.escala_agenda_institucional;
CREATE TRIGGER trg_escala_agenda_institucional_updated_at
BEFORE UPDATE ON public.escala_agenda_institucional
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_escala_rotinas_semanais_updated_at ON public.escala_rotinas_semanais;
CREATE TRIGGER trg_escala_rotinas_semanais_updated_at
BEFORE UPDATE ON public.escala_rotinas_semanais
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE OR REPLACE FUNCTION public.user_tem_acesso_escala(p_calendario_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.escala_calendario_equipes ece
      WHERE ece.calendario_id = p_calendario_id
        AND public.usuario_pode_acessar_equipe(ece.equipe_id)
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_tem_acesso_escala(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.escala_validar_calendario_ativo_por_equipe()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_calendario_ativo boolean;
  v_equipe_id uuid;
BEGIN
  SELECT ativo INTO v_calendario_ativo
  FROM public.escala_calendarios
  WHERE id = NEW.calendario_id;

  IF coalesce(v_calendario_ativo, false) = false THEN
    RETURN NEW;
  END IF;

  v_equipe_id := NEW.equipe_id;

  IF EXISTS (
    SELECT 1
    FROM public.escala_calendario_equipes ece
    JOIN public.escala_calendarios ec ON ec.id = ece.calendario_id
    WHERE ece.equipe_id = v_equipe_id
      AND ec.ativo = true
      AND ece.calendario_id <> NEW.calendario_id
  ) THEN
    RAISE EXCEPTION 'Ja existe um calendario ativo para esta equipe.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.escala_validar_ativacao_calendario()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ativo = false THEN
    IF TG_OP = 'UPDATE' AND OLD.ativo = true AND NEW.desativado_em IS NULL THEN
      NEW.desativado_em := now();
    END IF;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.escala_calendario_equipes atual
    JOIN public.escala_calendario_equipes outro
      ON outro.equipe_id = atual.equipe_id
     AND outro.calendario_id <> atual.calendario_id
    JOIN public.escala_calendarios ec_outro ON ec_outro.id = outro.calendario_id
    WHERE atual.calendario_id = NEW.id
      AND ec_outro.ativo = true
  ) THEN
    RAISE EXCEPTION 'Ja existe um calendario ativo para ao menos uma das equipes vinculadas.'
      USING ERRCODE = '23505';
  END IF;

  NEW.desativado_em := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escala_validar_calendario_ativo_por_equipe ON public.escala_calendario_equipes;
CREATE TRIGGER trg_escala_validar_calendario_ativo_por_equipe
BEFORE INSERT OR UPDATE ON public.escala_calendario_equipes
FOR EACH ROW EXECUTE FUNCTION public.escala_validar_calendario_ativo_por_equipe();

DROP TRIGGER IF EXISTS trg_escala_validar_ativacao_calendario ON public.escala_calendarios;
CREATE TRIGGER trg_escala_validar_ativacao_calendario
BEFORE INSERT OR UPDATE OF ativo ON public.escala_calendarios
FOR EACH ROW EXECUTE FUNCTION public.escala_validar_ativacao_calendario();

ALTER TABLE public.escala_calendarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_calendario_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_calendario_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_registros_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_afastamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_agenda_institucional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_rotinas_semanais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_rotinas_excecoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS escala_calendarios_select ON public.escala_calendarios;
CREATE POLICY escala_calendarios_select ON public.escala_calendarios
  FOR SELECT TO authenticated
  USING (public.user_tem_acesso_escala(id));

DROP POLICY IF EXISTS escala_calendarios_write ON public.escala_calendarios;
CREATE POLICY escala_calendarios_write ON public.escala_calendarios
  FOR ALL TO authenticated
  USING (public.user_tem_acesso_escala(id) OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS escala_calendario_equipes_access ON public.escala_calendario_equipes;
CREATE POLICY escala_calendario_equipes_access ON public.escala_calendario_equipes
  FOR ALL TO authenticated
  USING (public.user_tem_acesso_escala(calendario_id) OR public.is_admin(auth.uid()))
  WITH CHECK (public.usuario_pode_acessar_equipe(equipe_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS escala_calendario_membros_access ON public.escala_calendario_membros;
CREATE POLICY escala_calendario_membros_access ON public.escala_calendario_membros
  FOR ALL TO authenticated
  USING (public.user_tem_acesso_escala(calendario_id))
  WITH CHECK (public.user_tem_acesso_escala(calendario_id));

DROP POLICY IF EXISTS escala_registros_dia_access ON public.escala_registros_dia;
CREATE POLICY escala_registros_dia_access ON public.escala_registros_dia
  FOR ALL TO authenticated
  USING (public.user_tem_acesso_escala(calendario_id))
  WITH CHECK (public.user_tem_acesso_escala(calendario_id));

DROP POLICY IF EXISTS escala_afastamentos_access ON public.escala_afastamentos;
CREATE POLICY escala_afastamentos_access ON public.escala_afastamentos
  FOR ALL TO authenticated
  USING (public.user_tem_acesso_escala(calendario_id))
  WITH CHECK (public.user_tem_acesso_escala(calendario_id));

DROP POLICY IF EXISTS escala_agenda_institucional_read ON public.escala_agenda_institucional;
CREATE POLICY escala_agenda_institucional_read ON public.escala_agenda_institucional
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS escala_agenda_institucional_write ON public.escala_agenda_institucional;
CREATE POLICY escala_agenda_institucional_write ON public.escala_agenda_institucional
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS escala_auditoria_access ON public.escala_auditoria;
CREATE POLICY escala_auditoria_access ON public.escala_auditoria
  FOR SELECT TO authenticated
  USING (public.user_tem_acesso_escala(calendario_id));

DROP POLICY IF EXISTS escala_auditoria_write ON public.escala_auditoria;
CREATE POLICY escala_auditoria_write ON public.escala_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS escala_rotinas_semanais_access ON public.escala_rotinas_semanais;
CREATE POLICY escala_rotinas_semanais_access ON public.escala_rotinas_semanais
  FOR ALL TO authenticated
  USING (public.user_tem_acesso_escala(calendario_id))
  WITH CHECK (public.user_tem_acesso_escala(calendario_id));

DROP POLICY IF EXISTS escala_rotinas_excecoes_access ON public.escala_rotinas_excecoes;
CREATE POLICY escala_rotinas_excecoes_access ON public.escala_rotinas_excecoes
  FOR ALL TO authenticated
  USING (public.user_tem_acesso_escala(calendario_id))
  WITH CHECK (public.user_tem_acesso_escala(calendario_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_calendarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_calendario_equipes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_calendario_membros TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_registros_dia TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_afastamentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_agenda_institucional TO authenticated;
GRANT SELECT, INSERT ON public.escala_auditoria TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_rotinas_semanais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_rotinas_excecoes TO authenticated;

COMMENT ON TABLE public.escala_calendarios IS 'Calendarios de escala por equipe ou compartilhados.';
COMMENT ON TABLE public.escala_registros_dia IS 'Registros diarios de presencial ou extraordinario.';
COMMENT ON TABLE public.escala_afastamentos IS 'Ferias, licenca e folga por calendario.';
COMMENT ON TABLE public.escala_agenda_institucional IS 'Feriados, emendas e recesso (global).';
COMMENT ON TABLE public.escala_rotinas_semanais IS 'Rotinas semanais reutilizaveis.';
COMMENT ON TABLE public.escala_rotinas_excecoes IS 'Excecoes pontuais de rotina semanal.';

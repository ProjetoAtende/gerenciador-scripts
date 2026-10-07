-- App "Prioridades e Urgências" — helpers de acesso, RLS e RPCs do fluxo.
--
-- Decisão do projeto: o isolamento é feito no banco (RLS), não apenas na UI.
-- Ver seção 9.3 da especificação ("Isolamento por UPJ e visibilidade restrita:
-- permissões em nível de registro").

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Helpers de identidade no app
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_meu_perfil()
RETURNS TABLE (
  usuario_id uuid,
  perfil public.prioridades_perfil_tipo,
  upj_id uuid,
  vinculacao_automatica boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.usuario_id, p.perfil, p.upj_id, p.vinculacao_automatica
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid()
    AND p.ativo;
$$;

CREATE OR REPLACE FUNCTION public.prioridades_minha_upj()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.upj_id
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid()
    AND p.ativo
    AND p.upj_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.prioridades_sou_atendente()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'atendente'
  );
$$;

CREATE OR REPLACE FUNCTION public.prioridades_sou_gestor_ou_conferente()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil IN ('gestor', 'conferente')
  );
$$;

CREATE OR REPLACE FUNCTION public.prioridades_sou_upj()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil IN ('coordenador', 'analista')
  );
$$;

-- RF-GER-02: visibilidade restrita.
--   TJSP Atende → criador, gestor/conferente vinculado ou conferente designado.
--   UPJ         → somente usuários da UPJ destinatária.
CREATE OR REPLACE FUNCTION public.prioridades_pode_ver(p_anotacao_id bigint)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_perfil public.prioridades_perfil_tipo;
  v_upj    uuid;
  v_row    public.prioridades_anotacoes%ROWTYPE;
  v_admin  boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Admin do Gerenciador tem visão total (suporte/auditoria).
  SELECT (u.role::text = 'admin') INTO v_admin FROM public.users u WHERE u.id = v_uid;
  IF COALESCE(v_admin, false) THEN
    RETURN TRUE;
  END IF;

  SELECT p.perfil, p.upj_id INTO v_perfil, v_upj
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = v_uid AND p.ativo;

  IF v_perfil IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_perfil IN ('coordenador', 'analista') THEN
    RETURN v_upj IS NOT NULL AND v_row.upj_id = v_upj;
  END IF;

  -- Módulo TJSP Atende.
  IF v_row.criador_id = v_uid THEN
    RETURN TRUE;
  END IF;
  IF v_row.conferente_vinculado_id = v_uid OR v_row.conferido_por_id = v_uid THEN
    RETURN TRUE;
  END IF;

  -- Gestor: enxerga as anotações que estão na fila de conferência (RF-GES-01).
  IF v_perfil = 'gestor' AND v_row.status = 'gestor-conferencia' THEN
    RETURN TRUE;
  END IF;

  -- Qualquer gestor/conferente com delegação ativa sobre a UPJ de destino.
  IF v_perfil IN ('gestor', 'conferente') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.prioridades_designacoes d
      WHERE d.usuario_id = v_uid AND d.ativa
        AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
        AND d.perfil IN ('gestor', 'conferente')
    );
  END IF;

  RETURN FALSE;
END;
$$;

-- RF-GER-03: não há exclusão. A alteração só é permitida a quem está na vez.
CREATE OR REPLACE FUNCTION public.prioridades_pode_editar(p_anotacao_id bigint)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil public.prioridades_perfil_tipo;
  v_upj    uuid;
  v_row    public.prioridades_anotacoes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT p.perfil, p.upj_id INTO v_perfil, v_upj
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  IF v_perfil IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- O criador só age quando a anotação está devolvida e é dele (RF-ATD-14).
  IF v_row.criador_id = auth.uid() THEN
    RETURN v_row.status IN ('gestor-devolvida', 'upj-devolvida');
  END IF;

  IF v_perfil IN ('gestor', 'conferente') THEN
    RETURN v_row.status = 'gestor-conferencia';
  END IF;

  IF v_perfil IN ('coordenador', 'analista') THEN
    RETURN v_upj IS NOT NULL AND v_row.upj_id = v_upj AND v_row.status = 'upj-pendente';
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_meu_perfil() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prioridades_minha_upj() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prioridades_sou_atendente() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prioridades_sou_gestor_ou_conferente() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prioridades_sou_upj() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prioridades_pode_ver(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prioridades_pode_editar(bigint) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.prioridades_upjs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prioridades_orgaos_upj ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prioridades_usuarios_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prioridades_anotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prioridades_anotacoes_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prioridades_designacoes ENABLE ROW LEVEL SECURITY;

-- Catálogos: leitura livre a autenticados, escrita apenas por admin.
DROP POLICY IF EXISTS "prioridades_upjs_select" ON public.prioridades_upjs;
CREATE POLICY "prioridades_upjs_select" ON public.prioridades_upjs
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "prioridades_upjs_admin_write" ON public.prioridades_upjs;
CREATE POLICY "prioridades_upjs_admin_write" ON public.prioridades_upjs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "prioridades_orgaos_upj_select" ON public.prioridades_orgaos_upj;
CREATE POLICY "prioridades_orgaos_upj_select" ON public.prioridades_orgaos_upj
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "prioridades_orgaos_upj_admin_write" ON public.prioridades_orgaos_upj;
CREATE POLICY "prioridades_orgaos_upj_admin_write" ON public.prioridades_orgaos_upj
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Perfis do app: o usuário vê o próprio perfil; gestores e admin veem todos.
DROP POLICY IF EXISTS "prioridades_perfil_select_proprio" ON public.prioridades_usuarios_perfil;
CREATE POLICY "prioridades_perfil_select_proprio" ON public.prioridades_usuarios_perfil
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.prioridades_sou_gestor_ou_conferente()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
DROP POLICY IF EXISTS "prioridades_perfil_admin_write" ON public.prioridades_usuarios_perfil;
CREATE POLICY "prioridades_perfil_admin_write" ON public.prioridades_usuarios_perfil
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Anotações: RF-GER-02 e RF-GER-03.
-- Sem policy de DELETE — exclusão não existe no fluxo.
DROP POLICY IF EXISTS "prioridades_anotacoes_select" ON public.prioridades_anotacoes;
CREATE POLICY "prioridades_anotacoes_select" ON public.prioridades_anotacoes
  FOR SELECT TO authenticated USING (public.prioridades_pode_ver(id));

DROP POLICY IF EXISTS "prioridades_anotacoes_insert" ON public.prioridades_anotacoes;
CREATE POLICY "prioridades_anotacoes_insert" ON public.prioridades_anotacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    criador_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.prioridades_usuarios_perfil p
      WHERE p.usuario_id = auth.uid() AND p.ativo
        AND p.perfil IN ('atendente', 'gestor', 'conferente')
    )
  );

DROP POLICY IF EXISTS "prioridades_anotacoes_update" ON public.prioridades_anotacoes;
CREATE POLICY "prioridades_anotacoes_update" ON public.prioridades_anotacoes
  FOR UPDATE TO authenticated
  USING (public.prioridades_pode_editar(id))
  WITH CHECK (public.prioridades_pode_ver(id));

-- Histórico: lê quem pode ver a anotação; gravação apenas via RPC (SECURITY DEFINER).
DROP POLICY IF EXISTS "prioridades_historico_select" ON public.prioridades_anotacoes_historico;
CREATE POLICY "prioridades_historico_select" ON public.prioridades_anotacoes_historico
  FOR SELECT TO authenticated USING (public.prioridades_pode_ver(anotacao_id));

DROP POLICY IF EXISTS "prioridades_historico_insert" ON public.prioridades_anotacoes_historico;
CREATE POLICY "prioridades_historico_insert" ON public.prioridades_anotacoes_historico
  FOR INSERT TO authenticated WITH CHECK (public.prioridades_pode_ver(anotacao_id));

-- Designações: leitura para o próprio designado, gestores e usuários da UPJ.
DROP POLICY IF EXISTS "prioridades_designacoes_select" ON public.prioridades_designacoes;
CREATE POLICY "prioridades_designacoes_select" ON public.prioridades_designacoes
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR designante_id = auth.uid()
    OR public.prioridades_sou_gestor_ou_conferente()
    OR (upj_id IS NOT NULL AND upj_id = public.prioridades_minha_upj())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "prioridades_designacoes_gestor_write" ON public.prioridades_designacoes;
CREATE POLICY "prioridades_designacoes_gestor_write" ON public.prioridades_designacoes
  FOR ALL TO authenticated
  USING (
    public.prioridades_sou_gestor_ou_conferente()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    public.prioridades_sou_gestor_ou_conferente()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

COMMIT;

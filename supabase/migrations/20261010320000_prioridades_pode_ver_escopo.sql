-- App "Prioridades e Urgências" — corrige a visibilidade por UPJ (PU-09).
--
-- ────────────────────────────────────────────────────────────────────────────
-- DEFEITO REPRODUZIDO
-- ────────────────────────────────────────────────────────────────────────────
-- Na migration 20261010250000 tentei estreitar `pode_ver` para relacionar a
-- designação ao escopo, mas deixei um `RETURN EXISTS (...)` no fim que aceitava
-- QUALQUER designação ativa de gestor/conferente com escopo global. O resultado:
--
--   uma Conferente designada COM UPJ (FCC-01-05) enxergava anotação destinada a
--   OUTRA UPJ (FCC-31-35).
--
-- O isolamento por unidade é o RF-UPJ-01/PU-09, então isto é vazamento.
--
-- ────────────────────────────────────────────────────────────────────────────
-- REGRA CORRIGIDA — explícita e sem caminho de escape
-- ────────────────────────────────────────────────────────────────────────────
--   1. admin                     → leitura total (desvio registrado)
--   2. coordenador/analista      → somente a própria UPJ
--   3. designação ativa          → somente o escopo dela:
--        · com UPJ → as anotações daquela UPJ
--        · sem UPJ → escopo TJSP Atende (conferência é atividade do Atende)
--   4. criador, conferente vinculado ou conferido por → sempre
--   5. gestor (perfil ou designação de escopo Atende)
--                                → a fila de conferência (RF-GES-01)
--
-- O ponto que faltava: quem é conferente por PERFIL, e não por designação, só vê
-- o que lhe foi atribuído (item 4) — não a operação inteira. Quem tem o escopo
-- amplo é o Gestor (item 5).
--
-- O módulo UPJ fecha em si mesmo: nenhum caminho desta função pode conceder a
-- usuário de uma UPJ acesso a anotação de outra.

BEGIN;

CREATE OR REPLACE FUNCTION public.prioridades_pode_ver(p_anotacao_id bigint)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_perfil public.prioridades_perfil_tipo;
  v_upj uuid;
  v_row public.prioridades_anotacoes%ROWTYPE;
  v_eh_upj boolean;
  v_eh_adm_ou_gestor boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Admin do Gerenciador: leitura total (decisão registrada na migration
  --    20261010180000). A ESCRITA continua restrita.
  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND role = 'admin') THEN
    RETURN TRUE;
  END IF;

  SELECT p.perfil, p.upj_id INTO v_perfil, v_upj
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = v_uid AND p.ativo;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_eh_upj := v_perfil IN ('coordenador', 'analista')
    OR public.prioridades_designacao_ativa(ARRAY['coordenador', 'analista']::public.prioridades_perfil_tipo[]);

  -- 2. Módulo UPJ: SOMENTE a própria UPJ de vinculação.
  IF v_eh_upj AND v_upj IS NOT NULL AND v_row.upj_id = v_upj THEN
    RETURN TRUE;
  END IF;

  -- 3. Designação ativa, restrita ao escopo dela.
  IF EXISTS (
    SELECT 1 FROM public.prioridades_designacoes d
    WHERE d.usuario_id = v_uid
      AND d.ativa
      AND d.inicio_em <= CURRENT_DATE
      AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
      AND d.perfil IN ('gestor', 'conferente')
      -- com UPJ: só a UPJ dela. Sem UPJ: escopo do TJSP Atende.
      AND (d.upj_id IS NULL OR d.upj_id = v_row.upj_id)
  ) THEN
    RETURN TRUE;
  END IF;

  -- 4. Vínculo direto com a anotação.
  IF v_row.criador_id = v_uid
     OR v_row.conferente_vinculado_id = v_uid
     OR v_row.conferido_por_id = v_uid THEN
    RETURN TRUE;
  END IF;

  -- 5. Gestor (perfil base, ou designação de escopo Atende): fila de conferência.
  v_eh_adm_ou_gestor := v_perfil = 'gestor'
    OR public.prioridades_designacao_ativa(ARRAY['gestor']::public.prioridades_perfil_tipo[]);

  IF v_eh_adm_ou_gestor AND v_row.status = 'gestor-conferencia' THEN
    RETURN TRUE;
  END IF;

  -- Usuário do módulo UPJ não recebe nada fora da própria UPJ.
  IF v_eh_upj THEN
    RETURN FALSE;
  END IF;

  -- Anotação encerrada e sem vínculo com o usuário: não é visível no Atende.
  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_pode_ver(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_pode_ver(bigint) TO authenticated;

COMMENT ON FUNCTION public.prioridades_pode_ver(bigint) IS
  'RF-GER-02 / RF-UPJ-01. Visibilidade restrita: admin (leitura total, desvio registrado), coordenador/analista apenas a própria UPJ, designação ativa restrita ao seu escopo (com UPJ = aquela UPJ; sem UPJ = TJSP Atende), vínculo direto com a anotação, e Gestor para a fila de conferência.';

COMMIT;

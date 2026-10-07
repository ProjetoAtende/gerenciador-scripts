-- App "Prioridades e Urgências" — visibilidade do Conferente (PU-09, correção final).
--
-- ────────────────────────────────────────────────────────────────────────────
-- O QUE AINDA VAZAVA
-- ────────────────────────────────────────────────────────────────────────────
-- A correção anterior continuava concedendo visão ampla ao Conferente por dois
-- caminhos: perfil base de conferente sem UPJ (que eu tratava como escopo do
-- TJSP Atende) e designação de conferente com escopo global.
--
-- ────────────────────────────────────────────────────────────────────────────
-- O QUE A ESPECIFICAÇÃO DIZ
-- ────────────────────────────────────────────────────────────────────────────
-- A tabela de transições da seção 5.1 é explícita:
--
--     Ag. Conferência → Aprovada (Gestor) → Pendente (UPJ)   | Ator: Gestor/Conferente
--
-- Ou seja, quem remete à UPJ é uma ATRIBUIÇÃO do Gestor. E a matriz da seção 4
-- dá ao Conferente "conferir anotações (aprovar/devolver/rejeitar)" — permissão
-- de agir, não de enxergar a fila inteira da operação.
--
-- Somado ao RF-GER-02 ("a anotação é visível ao Atendente criador e ao
-- Gestor/Conferente RESPONSÁVEL"), a leitura correta é:
--
--     o Conferente vê o que lhe foi atribuído e o que ele mesmo criou.
--     O Gestor vê a fila de conferência — ele é quem distribui (RF-GES-07).
--
-- Era essa a intenção original do `pode_ver`; a implementação é que havia
-- aberto atalhos. Esta migration fecha os dois.

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
  v_eh_gestor boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Admin do Gerenciador: leitura total (desvio registrado na migration
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

  -- 2. Vínculo direto com a anotação: criador, conferente vinculado pelo rodízio,
  --    ou quem já conferiu. É o vínculo que a especificação chama de
  --    "Gestor/Conferente responsável".
  IF v_row.criador_id = v_uid
     OR v_row.conferente_vinculado_id = v_uid
     OR v_row.conferido_por_id = v_uid THEN
    RETURN TRUE;
  END IF;

  -- 3. Módulo UPJ: SOMENTE a própria UPJ de vinculação (RF-UPJ-01).
  v_eh_upj := v_perfil IN ('coordenador', 'analista')
    OR public.prioridades_designacao_ativa(ARRAY['coordenador', 'analista']::public.prioridades_perfil_tipo[]);

  IF v_eh_upj AND v_upj IS NOT NULL AND v_row.upj_id = v_upj THEN
    RETURN TRUE;
  END IF;

  -- 4. Designação ativa, restrita ao escopo dela: com UPJ vale a UPJ; sem UPJ
  --    vale a operação do TJSP Atende.
  IF EXISTS (
    SELECT 1 FROM public.prioridades_designacoes d
    WHERE d.usuario_id = v_uid
      AND d.ativa
      AND d.inicio_em <= CURRENT_DATE
      AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
      AND d.perfil IN ('gestor', 'conferente')
      AND (d.upj_id IS NULL OR d.upj_id = v_row.upj_id)
  ) THEN
    RETURN TRUE;
  END IF;

  -- 5. Gestor — por perfil base ou designação de escopo Atende: enxerga a fila
  --    de conferência, porque é ele quem distribui e sobrepõe (RF-GES-01/07).
  --    O Conferente NÃO entra aqui: ele só age no que lhe foi atribuído.
  v_eh_gestor := v_perfil = 'gestor'
    OR public.prioridades_designacao_ativa(ARRAY['gestor']::public.prioridades_perfil_tipo[]);

  IF v_eh_gestor AND v_row.status = 'gestor-conferencia' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_pode_ver(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_pode_ver(bigint) TO authenticated;

COMMENT ON FUNCTION public.prioridades_pode_ver(bigint) IS
  'RF-GER-02 / RF-UPJ-01. Visibilidade restrita: admin (leitura total, desvio registrado); vínculo direto (criador, conferente vinculado, conferido por); coordenador/analista apenas a própria UPJ; designação ativa restrita ao seu escopo; e Gestor para a fila de conferência, por ser quem distribui. O Conferente vê apenas o que lhe foi atribuído e o que criou.';

COMMIT;

-- App "Prioridades e Urgências" — escrita só pelo fluxo (PU-03, PU-05, PU-09).
--
-- ────────────────────────────────────────────────────────────────────────────
-- PU-03 — ESCRITA DIRETA CONTORNA O FLUXO
-- ────────────────────────────────────────────────────────────────────────────
-- As policies de INSERT e UPDATE em `prioridades_anotacoes` e o INSERT em
-- `prioridades_anotacoes_historico` permitiam alterar QUALQUER coluna de qualquer
-- linha acessível, direto pela API, sem passar pelas RPCs e sem gerar histórico.
-- Reproduzido em teste: o Atendente marcou a própria anotação como Urgentíssimo
-- (atribuição exclusiva do Gestor) e mudou o próprio prazo; o Gestor apagou a
-- UPJ da anotação. Zero eventos no histórico.
--
-- Correção: **nenhuma** policy de escrita nessas tabelas. Toda mutação passa
-- pelas RPCs, que são SECURITY DEFINER e por isso seguem funcionando. O ganho
-- não é só bloquear: é garantir que toda transição de status gere histórico, que
-- é o RF-GER-04.
--
-- ────────────────────────────────────────────────────────────────────────────
-- PU-05 — CONFERENTE COM ALÇADA DE GESTOR
-- ────────────────────────────────────────────────────────────────────────────
-- `prioridades_sou_gestor_ou_conferente()` era usada como se fosse "é gestor".
-- Com isso um Conferente Designado podia designar outros Conferentes, e a policy
-- `prioridades_designacoes_gestor_write` (FOR ALL) deixava que ele criasse
-- qualquer designação — inclusive `gestor` ou `coordenador` para si mesmo.
-- Escalada de privilégio.
--
-- Correção: separar as duas perguntas. `prioridades_sou_gestor()` responde pela
-- alçada de designar; `prioridades_sou_conferente()` fica para o que é
-- operacionalmente comum aos dois (conferir anotação).
--
-- ────────────────────────────────────────────────────────────────────────────
-- PU-09 — `pode_ver` AMPLO DEMAIS
-- ────────────────────────────────────────────────────────────────────────────
-- O EXISTS de designação não relacionava a designação à anotação nem à UPJ:
-- qualquer gestor/conferente com QUALQUER designação ativa via TODAS as
-- anotações. O comentário dizia o contrário do que o código fazia.
--
-- Correção: a designação só amplia a visibilidade para as anotações da UPJ da
-- própria designação. Designação sem UPJ (escopo do TJSP Atende) continua
-- valendo para toda a operação, que é o seu significado.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Alçadas separadas (PU-05)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_sou_gestor()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'gestor'
  )
  OR public.prioridades_designacao_ativa(ARRAY['gestor']::public.prioridades_perfil_tipo[]);
$$;

CREATE OR REPLACE FUNCTION public.prioridades_sou_conferente()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'conferente'
  )
  OR public.prioridades_designacao_ativa(ARRAY['conferente']::public.prioridades_perfil_tipo[]);
$$;

-- Mantida por compatibilidade, mas agora ela é o OU explícito das duas — e o
-- código passa a usar `sou_gestor` onde a alçada é de Gestor.
CREATE OR REPLACE FUNCTION public.prioridades_sou_gestor_ou_conferente()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off AS $$
  SELECT public.prioridades_sou_gestor() OR public.prioridades_sou_conferente();
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_sou_gestor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prioridades_sou_conferente() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. `pode_ver` relaciona a designação ao escopo (PU-09)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_pode_ver(p_anotacao_id bigint)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
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

  -- Admin do Gerenciador: leitura total (decisão registrada na migration
  -- 20261010180000).
  SELECT (u.role::text = 'admin') INTO v_admin FROM public.users u WHERE u.id = v_uid;
  IF COALESCE(v_admin, false) THEN
    RETURN TRUE;
  END IF;

  SELECT p.perfil, p.upj_id INTO v_perfil, v_upj
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = v_uid AND p.ativo;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Módulo UPJ: apenas a própria UPJ (RF-UPJ-01).
  IF v_perfil IN ('coordenador', 'analista')
     OR public.prioridades_designacao_ativa(ARRAY['coordenador', 'analista']::public.prioridades_perfil_tipo[]) THEN
    IF v_upj IS NOT NULL AND v_row.upj_id = v_upj THEN
      RETURN TRUE;
    END IF;
    -- Designação de UPJ explícita também autoriza a UPJ dela.
    IF EXISTS (
      SELECT 1 FROM public.prioridades_designacoes d
      WHERE d.usuario_id = v_uid AND d.ativa
        AND d.inicio_em <= CURRENT_DATE
        AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
        AND d.perfil IN ('coordenador', 'analista')
        AND d.upj_id IS NOT NULL
        AND d.upj_id = v_row.upj_id
    ) THEN
      RETURN TRUE;
    END IF;
    IF v_perfil IN ('coordenador', 'analista') THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Módulo TJSP Atende: criador e responsáveis diretos.
  IF v_row.criador_id = v_uid THEN
    RETURN TRUE;
  END IF;
  IF v_row.conferente_vinculado_id = v_uid OR v_row.conferido_por_id = v_uid THEN
    RETURN TRUE;
  END IF;

  -- Gestor: enxerga a fila de conferência (RF-GES-01).
  IF v_perfil = 'gestor' OR public.prioridades_sou_gestor() THEN
    IF v_row.status = 'gestor-conferencia' THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Designação ativa de conferente/gestor com ESCOPO compatível (PU-09).
  --  - designação sem UPJ  → escopo do TJSP Atende, vale para toda a operação;
  --  - designação com UPJ  → vale apenas para as anotações daquela UPJ.
  -- Antes, qualquer designação ativa abria a visibilidade para tudo.
  RETURN EXISTS (
    SELECT 1 FROM public.prioridades_designacoes d
    WHERE d.usuario_id = v_uid
      AND d.ativa
      AND d.inicio_em <= CURRENT_DATE
      AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
      AND d.perfil IN ('gestor', 'conferente')
      AND (d.upj_id IS NULL OR d.upj_id = v_row.upj_id)
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Escrita só pelo fluxo (PU-03)
-- ─────────────────────────────────────────────────────────────────────────

-- Anotações: mantém apenas SELECT. Sem INSERT e sem UPDATE pelo cliente, toda
-- mutação passa por criar_anotacao / conferir / responder_devolucao / analisar,
-- que registram histórico.
DROP POLICY IF EXISTS "prioridades_anotacoes_insert" ON public.prioridades_anotacoes;
DROP POLICY IF EXISTS "prioridades_anotacoes_update" ON public.prioridades_anotacoes;

-- Histórico: somente leitura. Sem INSERT pelo cliente — nem para forjar trilha.
DROP POLICY IF EXISTS "prioridades_historico_insert" ON public.prioridades_anotacoes_historico;

-- Designações: escrita só pelas RPCs (designar / encerrar / alternar_vinculacao).
-- A policy era FOR ALL e permitia criar qualquer designação, inclusive
-- gestor/coordenador para si mesmo (PU-05).
DROP POLICY IF EXISTS "prioridades_designacoes_gestor_write" ON public.prioridades_designacoes;

-- Perfil: escrita só por RPC (designar / remover_perfil / alternar_vinculacao).
-- Sem esta remoção, o gestor podia promover alguém direto na tabela.
DROP POLICY IF EXISTS "prioridades_orgaos_upj_admin_write" ON public.prioridades_orgaos_upj;
DROP POLICY IF EXISTS "prioridades_orgaos_upj_admin_write" ON public.prioridades_orgaos_upj;

-- `pode_editar` existia para a policy de UPDATE que acabou de ser removida.
-- As RPCs fazem a própria verificação de quem está na vez.
DROP FUNCTION IF EXISTS public.prioridades_pode_editar(bigint);

COMMIT;

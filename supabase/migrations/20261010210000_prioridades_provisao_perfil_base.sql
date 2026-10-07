-- App "Prioridades e Urgências" — provisão do perfil base (bootstrap).
--
-- ────────────────────────────────────────────────────────────────────────────
-- A LACUNA QUE ESTA MIGRATION FECHA
-- ────────────────────────────────────────────────────────────────────────────
-- A especificação define QUEM designa quem:
--   RF-GES-06 — Gestor designa Conferentes
--   RF-UPJ-05 — Coordenador da UPJ designa Analistas
--
-- Mas ela NUNCA diz como um Gestor ou um Coordenador passa a existir. Sem isso o
-- fluxo não fecha no primeiro passo:
--
--   1. a distribuição round-robin do escopo `atende` (RF-GES-07) escolhe entre
--      perfis `gestor` e `conferente` habilitados;
--   2. sem nenhum Gestor, ninguém pode designar o primeiro Conferente;
--   3. e mesmo que houvesse Conferentes, a fila de conferência não teria gestor
--      para assumir nem para haver sobreposição (regra dos slides 87–89).
--
-- DECISÃO: o papel `admin` global provisiona o PERFIL BASE de Gestor e de
-- Coordenador da UPJ. É a única figura fora do fluxo operacional — o Boss Only já
-- existe para administração — então isso não conflita com as alçadas do
-- documento. Designação (com período) continua sendo ato de Gestor/Coordenador.
--
-- DUAS OPERAÇÕES DIFERENTES, DE PROPÓSITO:
--   perfil base  → permanente, define o módulo; provido pelo admin (aqui)
--   designação   → com período; feita por Gestor/Coordenador (já implementado)

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. prioridades_designar passa a aceitar gestor/coordenador pelo admin
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_designar(
  p_usuario_id uuid,
  p_perfil public.prioridades_perfil_tipo,
  p_inicio date DEFAULT CURRENT_DATE,
  p_fim date DEFAULT NULL,
  p_upj_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_eh_gestor boolean;
  v_eh_coordenador boolean;
  v_admin boolean;
  v_upj_alvo uuid;
  v_perfil_base public.prioridades_perfil_tipo;
  v_ja_existe boolean;
  v_nome text;
  -- Gestor e Coordenador definem o MÓDULO, não uma delegação com prazo: não
  -- geram designação.
  v_eh_perfil_base boolean := p_perfil IN ('gestor', 'coordenador');
BEGIN
  v_eh_gestor := public.prioridades_sou_gestor_ou_conferente();

  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'coordenador'
  ) OR public.prioridades_designacao_ativa(ARRAY['coordenador']::public.prioridades_perfil_tipo[])
  INTO v_eh_coordenador;

  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  INTO v_admin;

  IF p_perfil = 'conferente' THEN
    IF NOT (v_eh_gestor OR v_admin) THEN
      RETURN jsonb_build_object('sucesso', false,
        'erro', 'A designação de Conferentes cabe ao Gestor do TJSP Atende.');
    END IF;
  ELSIF p_perfil = 'analista' THEN
    IF NOT (v_eh_coordenador OR v_admin) THEN
      RETURN jsonb_build_object('sucesso', false,
        'erro', 'A designação de Analistas cabe ao Coordenador da UPJ.');
    END IF;
  ELSIF v_eh_perfil_base THEN
    -- Provisão de perfil base: exclusiva do admin (bootstrap do sistema).
    IF NOT v_admin THEN
      RETURN jsonb_build_object('sucesso', false,
        'erro', 'Definir o perfil de Gestor ou de Coordenador da UPJ cabe ao administrador do sistema.');
    END IF;
  ELSE
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Perfil inválido para esta operação.');
  END IF;

  SELECT u.nome INTO v_nome FROM public.users u
  WHERE u.id = p_usuario_id AND u.ativo IS DISTINCT FROM false;

  IF v_nome IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não encontrado ou inativo.');
  END IF;

  -- UPJ é obrigatória para Coordenador (isola a visibilidade, RF-UPJ-01) e para
  -- Analista. Gestor e Conferente atuam sobre toda a operação do TJSP Atende.
  IF p_perfil IN ('analista', 'coordenador') THEN
    v_upj_alvo := COALESCE(p_upj_id, public.prioridades_minha_upj());
    IF v_upj_alvo IS NULL THEN
      RETURN jsonb_build_object('sucesso', false,
        'erro', 'Informe a UPJ: sem ela o perfil não tem visibilidade sobre anotação alguma.');
    END IF;
  ELSE
    v_upj_alvo := NULL;
  END IF;

  IF NOT v_eh_perfil_base AND p_fim IS NOT NULL AND p_fim < COALESCE(p_inicio, CURRENT_DATE) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A data final não pode ser anterior à inicial.');
  END IF;

  SELECT p.perfil INTO v_perfil_base
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = p_usuario_id;

  IF v_perfil_base IS NULL THEN
    INSERT INTO public.prioridades_usuarios_perfil
      (usuario_id, perfil, upj_id, vinculacao_automatica, ativo)
    VALUES
      (p_usuario_id, p_perfil, v_upj_alvo, true, true);
  ELSIF v_perfil_base = 'atendente'::public.prioridades_perfil_tipo
     OR v_perfil_base = p_perfil THEN
    UPDATE public.prioridades_usuarios_perfil
    SET perfil = p_perfil,
        upj_id = COALESCE(v_upj_alvo, upj_id),
        ativo = true,
        atualizado_em = now()
    WHERE usuario_id = p_usuario_id;
  ELSE
    -- Já tem perfil de outra natureza: preserva o perfil base e garante a UPJ.
    UPDATE public.prioridades_usuarios_perfil
    SET upj_id = COALESCE(v_upj_alvo, upj_id),
        ativo = true,
        atualizado_em = now()
    WHERE usuario_id = p_usuario_id;
  END IF;

  -- Perfil base não gera designação; e ao virar Gestor/Coordenador o usuário
  -- deixa de precisar de delegação com prazo.
  IF v_eh_perfil_base THEN
    DELETE FROM public.prioridades_designacoes
    WHERE usuario_id = p_usuario_id
      AND perfil IN ('conferente', 'analista');

    RETURN jsonb_build_object(
      'sucesso', true,
      'usuario_id', p_usuario_id,
      'nome', v_nome,
      'perfil', p_perfil,
      'perfil_base', true
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_designacoes d
    WHERE d.usuario_id = p_usuario_id AND d.perfil = p_perfil
  ) INTO v_ja_existe;

  IF v_ja_existe THEN
    UPDATE public.prioridades_designacoes
    SET designante_id = auth.uid(),
        upj_id = COALESCE(v_upj_alvo, upj_id),
        inicio_em = COALESCE(p_inicio, CURRENT_DATE),
        fim_em = p_fim,
        ativa = true,
        atualizado_em = now()
    WHERE usuario_id = p_usuario_id AND perfil = p_perfil;
  ELSE
    INSERT INTO public.prioridades_designacoes
      (usuario_id, designante_id, perfil, upj_id, inicio_em, fim_em, ativa)
    VALUES
      (p_usuario_id, auth.uid(), p_perfil, v_upj_alvo,
       COALESCE(p_inicio, CURRENT_DATE), p_fim, true);
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'usuario_id', p_usuario_id,
    'nome', v_nome,
    'perfil', p_perfil,
    'perfil_base', false,
    'fim_em', p_fim,
    'indeterminado', p_fim IS NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_designar(uuid, public.prioridades_perfil_tipo, date, date, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Remover o perfil base (exclusivo do admin)
-- ─────────────────────────────────────────────────────────────────────────
--
-- Sem isso, um perfil de Gestor atribuído por engano seria irreversível pela
-- aplicação, e o perfil desativado continuaria participando do round-robin.

CREATE OR REPLACE FUNCTION public.prioridades_remover_perfil(p_usuario_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_admin boolean;
  v_perfil public.prioridades_perfil_tipo;
  v_pendentes integer;
  v_nome text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  INTO v_admin;

  IF NOT v_admin THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'A remoção de perfil cabe ao administrador do sistema.');
  END IF;

  SELECT p.perfil INTO v_perfil
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = p_usuario_id;

  IF v_perfil IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário sem perfil no app.');
  END IF;

  SELECT u.nome INTO v_nome FROM public.users u WHERE u.id = p_usuario_id;

  -- RF-GER-03: a integridade dos registros vem antes da conveniência
  -- administrativa. Um perfil com anotação em andamento não é removido.
  IF v_perfil IN ('gestor', 'conferente') THEN
    SELECT count(*) INTO v_pendentes
    FROM public.prioridades_anotacoes a
    WHERE a.status = 'gestor-conferencia'
      AND (a.conferente_vinculado_id = p_usuario_id OR a.conferido_por_id = p_usuario_id);
  ELSIF v_perfil IN ('coordenador', 'analista') THEN
    SELECT count(*) INTO v_pendentes
    FROM public.prioridades_anotacoes a
    WHERE a.status = 'upj-pendente'
      AND (a.analista_vinculado_id = p_usuario_id OR a.analisado_por_id = p_usuario_id);
  ELSE
    v_pendentes := 0;
  END IF;

  IF v_pendentes > 0 THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', format('Este usuário tem %s anotação(ões) em andamento. Conclua ou reatribua antes de remover o perfil.', v_pendentes),
      'anotacoes_pendentes', v_pendentes);
  END IF;

  DELETE FROM public.prioridades_designacoes WHERE usuario_id = p_usuario_id;

  DELETE FROM public.prioridades_usuarios_perfil WHERE usuario_id = p_usuario_id;

  RETURN jsonb_build_object('sucesso', true, 'nome', v_nome, 'perfil_removido', v_perfil);
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_remover_perfil(uuid) TO authenticated;

COMMENT ON FUNCTION public.prioridades_designar(uuid, public.prioridades_perfil_tipo, date, date, uuid) IS
  'RF-GES-06 / RF-UPJ-05. Designa Conferente (Gestor) ou Analista (Coordenador da UPJ), com período; cria o perfil base na mesma transação. Excepcionalmente aceita gestor/coordenador, mas apenas do admin, e nesse caso define o PERFIL BASE sem gerar designação (bootstrap do sistema).';

COMMENT ON FUNCTION public.prioridades_remover_perfil(uuid) IS
  'Exclusivo do admin. Remove o perfil base e as designações do usuário. Recusa quando há anotação em andamento vinculada (RF-GER-03).';

COMMIT;

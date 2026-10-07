-- App "Prioridades e Urgências" — alçada de designar é de Gestor (PU-05).
--
-- A migration anterior separou `sou_gestor()` de `sou_conferente()`. Faltava
-- trocar as RPCs que usavam a função composta para decidir quem pode designar.
-- A especificação é explícita (RF-GES-06): quem designa Conferentes é o
-- **Gestor**. Um Conferente Designado conferir anotações é diferente de ele
-- distribuir designações — e era por essa confusão que ele podia se autopromover.
--
-- Funções redefinidas aqui:
--   prioridades_buscar_usuarios    — buscar candidatos é ato de quem designa
--   prioridades_designar           — idem
--   prioridades_encerrar_designacao— idem
--   prioridades_alternar_vinculacao— idem (RF-GES-07)
--   prioridades_registrar_historico— passa a exigir sessão (defesa em profundidade)

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- Registrar histórico: exige sessão autenticada
-- ─────────────────────────────────────────────────────────────────────────
--
-- É interna (chamada pelas RPCs de fluxo, SEM GRANT para cliente), mas fica a
-- defesa em profundidade: se algum dia ganhar grant por engano, ainda recusa
-- chamada sem sessão. Sem isso, o histórico — que é a prova de auditoria do
-- RF-GER-04 — poderia ser escrito por anônimo.

CREATE OR REPLACE FUNCTION public.prioridades_registrar_historico(
  p_anotacao_id bigint,
  p_status_anterior public.prioridades_status,
  p_status_novo public.prioridades_status,
  p_evento text,
  p_conteudo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_perfil public.prioridades_perfil_tipo;
  v_nome text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Histórico só pode ser gravado em nome de um usuário autenticado.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT p.perfil INTO v_perfil
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  SELECT u.nome INTO v_nome FROM public.users u WHERE u.id = auth.uid();

  INSERT INTO public.prioridades_anotacoes_historico
    (anotacao_id, status_anterior, status_novo, evento, autor_id, autor_nome, autor_perfil, conteudo)
  VALUES
    (p_anotacao_id, p_status_anterior, p_status_novo, p_evento,
     auth.uid(), v_nome, v_perfil, p_conteudo);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_registrar_historico(
  bigint, public.prioridades_status, public.prioridades_status, text, text)
  FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Buscar usuários: alçada de quem designa
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_buscar_usuarios(
  p_termo text,
  p_upj_id uuid DEFAULT NULL
)
RETURNS TABLE (
  usuario_id uuid,
  nome text,
  email text,
  perfil_atual public.prioridades_perfil_tipo,
  upj_atual uuid,
  ja_designado boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_sou_gestor boolean;
  v_sou_coordenador boolean;
  v_admin boolean;
  v_upj uuid;
BEGIN
  v_sou_gestor := public.prioridades_sou_gestor();

  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'coordenador'
  ) OR public.prioridades_designacao_ativa(ARRAY['coordenador']::public.prioridades_perfil_tipo[])
  INTO v_sou_coordenador;

  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  INTO v_admin;

  IF NOT (v_sou_gestor OR v_sou_coordenador OR v_admin) THEN
    RAISE EXCEPTION 'Apenas Gestor ou Coordenador da UPJ pode buscar usuários para designação.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_upj := COALESCE(p_upj_id, public.prioridades_minha_upj());

  RETURN QUERY
  SELECT u.id, u.nome, u.email, pa.perfil, pa.upj_id,
         EXISTS (
           SELECT 1 FROM public.prioridades_designacoes d
           WHERE d.usuario_id = u.id AND d.ativa
             AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
         )
  FROM public.users u
  LEFT JOIN public.prioridades_usuarios_perfil pa
    ON pa.usuario_id = u.id AND pa.ativo
  WHERE u.ativo IS DISTINCT FROM false
    AND (v_sou_gestor OR v_admin OR v_upj IS NULL OR pa.upj_id = v_upj)
    AND (
      COALESCE(btrim(p_termo), '') = ''
      OR u.nome ILIKE '%' || btrim(p_termo) || '%'
      OR u.email ILIKE '%' || btrim(p_termo) || '%'
    )
  ORDER BY u.nome
  LIMIT 25;
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_buscar_usuarios(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_buscar_usuarios(text, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Designar: Gestor para Conferente; Coordenador para Analista; admin no resto
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
  v_eh_perfil_base boolean := p_perfil IN ('gestor', 'coordenador', 'atendente');
BEGIN
  v_eh_gestor := public.prioridades_sou_gestor();

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
    IF NOT v_admin THEN
      RETURN jsonb_build_object('sucesso', false,
        'erro', 'Definir o perfil base no app cabe ao administrador do sistema.');
    END IF;
  ELSE
    RETURN jsonb_build_object('sucesso', false,
      'erro', format('Perfil inválido para esta operação: %s.', p_perfil));
  END IF;

  SELECT u.nome INTO v_nome FROM public.users u
  WHERE u.id = p_usuario_id AND u.ativo IS DISTINCT FROM false;

  IF v_nome IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não encontrado ou inativo.');
  END IF;

  IF p_perfil IN ('analista', 'coordenador') THEN
    v_upj_alvo := COALESCE(p_upj_id, public.prioridades_minha_upj());
    IF v_upj_alvo IS NULL THEN
      RETURN jsonb_build_object('sucesso', false,
        'erro', 'Informe a UPJ: sem ela o perfil não tem visibilidade sobre anotação alguma.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.prioridades_upjs WHERE id = v_upj_alvo AND ativa) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'UPJ inexistente ou inativa.');
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
    VALUES (p_usuario_id, p_perfil, v_upj_alvo, true, true);
  ELSIF v_perfil_base = 'atendente'::public.prioridades_perfil_tipo
     OR v_perfil_base = p_perfil
     OR (p_perfil = 'atendente'::public.prioridades_perfil_tipo
         AND v_perfil_base IN ('conferente', 'analista')) THEN
    UPDATE public.prioridades_usuarios_perfil
    SET perfil = p_perfil,
        upj_id = CASE WHEN p_perfil = 'atendente'::public.prioridades_perfil_tipo
                      THEN NULL ELSE COALESCE(v_upj_alvo, upj_id) END,
        ativo = true,
        atualizado_em = now()
    WHERE usuario_id = p_usuario_id;

    IF p_perfil = 'atendente'::public.prioridades_perfil_tipo THEN
      DELETE FROM public.prioridades_designacoes
      WHERE usuario_id = p_usuario_id AND perfil IN ('conferente', 'analista');
    END IF;
  ELSE
    UPDATE public.prioridades_usuarios_perfil
    SET upj_id = COALESCE(v_upj_alvo, upj_id),
        ativo = true,
        atualizado_em = now()
    WHERE usuario_id = p_usuario_id;
  END IF;

  IF v_eh_perfil_base THEN
    DELETE FROM public.prioridades_designacoes
    WHERE usuario_id = p_usuario_id AND perfil IN ('conferente', 'analista');

    RETURN jsonb_build_object('sucesso', true, 'usuario_id', p_usuario_id,
                              'nome', v_nome, 'perfil', p_perfil, 'perfil_base', true);
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
    VALUES (p_usuario_id, auth.uid(), p_perfil, v_upj_alvo,
            COALESCE(p_inicio, CURRENT_DATE), p_fim, true);
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'usuario_id', p_usuario_id,
                            'nome', v_nome, 'perfil', p_perfil, 'perfil_base', false,
                            'fim_em', p_fim, 'indeterminado', p_fim IS NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_designar(uuid, public.prioridades_perfil_tipo, date, date, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_designar(uuid, public.prioridades_perfil_tipo, date, date, uuid)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Encerrar designação e alternar vinculação: alçada de quem designa
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_encerrar_designacao(p_designacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_designacao public.prioridades_designacoes%ROWTYPE;
  v_restantes integer;
  v_admin boolean;
BEGIN
  SELECT * INTO v_designacao
  FROM public.prioridades_designacoes WHERE id = p_designacao_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Designação não encontrada.');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  INTO v_admin;

  -- Designação de Conferente: alçada do Gestor. De Analista: do Coordenador.
  IF NOT (
    v_admin
    OR (v_designacao.perfil = 'conferente' AND public.prioridades_sou_gestor())
    OR (v_designacao.perfil = 'analista' AND public.prioridades_sou_upj())
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Sem permissão para encerrar esta designação.');
  END IF;

  UPDATE public.prioridades_designacoes
  SET ativa = false, fim_em = COALESCE(fim_em, CURRENT_DATE), atualizado_em = now()
  WHERE id = p_designacao_id;

  SELECT count(*) INTO v_restantes
  FROM public.prioridades_designacoes d
  WHERE d.usuario_id = v_designacao.usuario_id
    AND d.ativa
    AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE);

  IF v_restantes = 0 AND v_designacao.perfil IN ('conferente', 'analista') THEN
    DELETE FROM public.prioridades_usuarios_perfil
    WHERE usuario_id = v_designacao.usuario_id AND perfil = v_designacao.perfil;
  END IF;

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_encerrar_designacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_encerrar_designacao(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.prioridades_alternar_vinculacao(
  p_usuario_id uuid,
  p_habilitada boolean
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
  v_upj_alvo uuid;
BEGIN
  v_eh_gestor := public.prioridades_sou_gestor();

  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'coordenador'
  ) OR public.prioridades_designacao_ativa(ARRAY['coordenador']::public.prioridades_perfil_tipo[])
  INTO v_eh_coordenador;

  IF NOT (v_eh_gestor OR v_eh_coordenador
          OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Sem permissão para alterar a vinculação automática.');
  END IF;

  IF v_eh_coordenador AND NOT v_eh_gestor THEN
    SELECT p.upj_id INTO v_upj_alvo
    FROM public.prioridades_usuarios_perfil p WHERE p.usuario_id = p_usuario_id;

    IF v_upj_alvo IS DISTINCT FROM public.prioridades_minha_upj() THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário de outra UPJ.');
    END IF;
  END IF;

  UPDATE public.prioridades_usuarios_perfil
  SET vinculacao_automatica = p_habilitada, atualizado_em = now()
  WHERE usuario_id = p_usuario_id;

  RETURN jsonb_build_object('sucesso', true, 'vinculacao_automatica', p_habilitada);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_alternar_vinculacao(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_alternar_vinculacao(uuid, boolean) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Remover perfil e processar prazos: exigem perfil/admin de verdade
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_processar_prazos_vencidos()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row public.prioridades_anotacoes%ROWTYPE;
  v_rejeitadas integer := 0;
  v_corrigidas integer := 0;
  v_analista RECORD;
  v_novo public.prioridades_status;
  v_permitido boolean;
BEGIN
  -- Chamada pelo cron (sem sessão) ou por um usuário com perfil/admin. Nunca
  -- por anônimo.
  v_permitido := auth.uid() IS NULL
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.prioridades_usuarios_perfil p
               WHERE p.usuario_id = auth.uid() AND p.ativo);

  IF NOT v_permitido THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Sem permissão para processar os prazos.');
  END IF;

  FOR v_row IN
    SELECT * FROM public.prioridades_anotacoes
    WHERE status IN ('gestor-devolvida', 'upj-devolvida')
      AND prazo_resposta_em IS NOT NULL
      AND prazo_resposta_em < now()
    ORDER BY prazo_resposta_em
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_row.devolvida_por = 'gestor' AND v_row.correcao_automatica THEN
      UPDATE public.prioridades_anotacoes
      SET status = 'upj-pendente',
          descricao_prioridade = COALESCE(v_row.texto_correcao_automatica, v_row.descricao_prioridade),
          observacao_adicional_gestor = COALESCE(v_row.observacao_adicional_gestor,
                                                 v_row.descricao_prioridade),
          resposta_atendente = NULL, respondida_em = NULL,
          data_remessa_upj = now(), atualizado_em = now()
      WHERE id = v_row.id;

      INSERT INTO public.prioridades_anotacoes_historico
        (anotacao_id, status_anterior, status_novo, evento, autor_nome, conteudo)
      VALUES (v_row.id, v_row.status, 'upj-pendente', 'correcao_automatica',
              'sistema', v_row.texto_correcao_automatica);

      IF v_row.upj_id IS NOT NULL THEN
        SELECT * INTO v_analista FROM public.prioridades_proximo_da_fila('upj', v_row.upj_id);
        IF v_analista.usuario_id IS NOT NULL THEN
          UPDATE public.prioridades_anotacoes
          SET analista_vinculado_id = v_analista.usuario_id,
              analista_vinculado_nome = v_analista.usuario_nome
          WHERE id = v_row.id;
        END IF;
      END IF;

      v_corrigidas := v_corrigidas + 1;
    ELSE
      v_novo := CASE WHEN v_row.devolvida_por = 'upj'
                     THEN 'upj-rejeitada'::public.prioridades_status
                     ELSE 'gestor-rejeitada'::public.prioridades_status END;

      UPDATE public.prioridades_anotacoes
      SET status = v_novo,
          justificativa_rejeicao_gestor = CASE WHEN v_novo = 'gestor-rejeitada'
            THEN COALESCE(justificativa_rejeicao_gestor, 'Prazo de 24 h expirado sem resposta do Atendente.')
            ELSE justificativa_rejeicao_gestor END,
          justificativa_rejeicao_upj = CASE WHEN v_novo = 'upj-rejeitada'
            THEN COALESCE(justificativa_rejeicao_upj, 'Prazo de 24 h expirado sem resposta do Atendente.')
            ELSE justificativa_rejeicao_upj END,
          atualizado_em = now()
      WHERE id = v_row.id;

      INSERT INTO public.prioridades_anotacoes_historico
        (anotacao_id, status_anterior, status_novo, evento, autor_nome, conteudo)
      VALUES (v_row.id, v_row.status, v_novo, 'rejeicao_automatica_prazo',
              'sistema', 'Prazo de 24 h expirado sem resposta do Atendente.');

      v_rejeitadas := v_rejeitadas + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('sucesso', true, 'rejeitadas', v_rejeitadas,
                            'correcoes_aplicadas', v_corrigidas);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_processar_prazos_vencidos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prioridades_processar_prazos_vencidos() TO service_role;

COMMIT;

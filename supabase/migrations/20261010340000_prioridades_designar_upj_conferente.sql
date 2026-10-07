-- App "Prioridades e Urgências" — corrige o descarte da UPJ ao designar Conferente.
--
-- ────────────────────────────────────────────────────────────────────────────
-- DEFEITO (terceiro da mesma família)
-- ────────────────────────────────────────────────────────────────────────────
-- Em `prioridades_designar`, o ramo que tratava os perfis sem UPJ obrigatória
-- fazia:
--
--     IF p_perfil IN ('analista', 'coordenador') THEN
--       v_upj_alvo := COALESCE(p_upj_id, prioridades_minha_upj());
--     ELSE
--       v_upj_alvo := NULL;   -- <<< descartava a UPJ recebida
--     END IF;
--
-- Consequência: `p_upj_id` era **silenciosamente ignorado** para conferente. O
-- registro ficava com `upj_id = NULL`, e `NULL` significa escopo do TJSP Atende
-- (global). Foi isso que fez uma "Conferente com escopo de UPJ" enxergar
-- anotação de outro cartório no teste de PU-09.
--
-- Correção: a UPJ informada é sempre respeitada. Ela é OBRIGATÓRIA para
-- coordenador e analista (sem ela o perfil não tem o que enxergar) e OPCIONAL
-- para conferente — onde ausência significa escopo do TJSP Atende, que é uma
-- escolha legítima do Gestor.

BEGIN;

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
  v_upj_do_perfil uuid;
  v_upj_base uuid;
  v_perfil_base public.prioridades_perfil_tipo;
  v_ja_existe boolean;
  v_nome text;
  v_eh_perfil_base boolean := p_perfil IN ('gestor', 'coordenador', 'atendente');
BEGIN
  v_eh_gestor := public.prioridades_sou_gestor();
  v_admin := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');

  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'coordenador'
  ) OR public.prioridades_designacao_ativa(ARRAY['coordenador']::public.prioridades_perfil_tipo[])
  INTO v_eh_coordenador;

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

  -- UPJ: obrigatória para coordenador e analista (isolamento por UPJ, RF-UPJ-01);
  -- OPCIONAL para conferente — e quando informada, é RESPEITADA, restringindo o
  -- escopo dele àquela unidade. Conferente sem UPJ opera no escopo do TJSP
  -- Atende (toda a operação), que é o comportamento padrão.
  IF p_perfil IN ('analista', 'coordenador') THEN
    v_upj_do_perfil := COALESCE(p_upj_id, public.prioridades_minha_upj());
    IF v_upj_do_perfil IS NULL THEN
      RETURN jsonb_build_object('sucesso', false,
        'erro', 'Informe a UPJ: sem ela o perfil não tem visibilidade sobre anotação alguma.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.prioridades_upjs WHERE id = v_upj_do_perfil AND ativa) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'UPJ inexistente ou inativa.');
    END IF;
  ELSE
    v_upj_do_perfil := p_upj_id;
    IF v_upj_do_perfil IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.prioridades_upjs WHERE id = v_upj_do_perfil AND ativa) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'UPJ inexistente ou inativa.');
    END IF;
  END IF;

  -- Perfil base (atendente) não carrega UPJ: o vínculo é do perfil de UPJ.
  v_upj_base := CASE WHEN p_perfil = 'atendente'::public.prioridades_perfil_tipo
                     THEN NULL ELSE v_upj_do_perfil END;

  IF NOT v_eh_perfil_base AND p_fim IS NOT NULL AND p_fim < COALESCE(p_inicio, CURRENT_DATE) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A data final não pode ser anterior à inicial.');
  END IF;

  SELECT p.perfil INTO v_perfil_base
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = p_usuario_id;

  IF v_perfil_base IS NULL THEN
    INSERT INTO public.prioridades_usuarios_perfil
      (usuario_id, perfil, upj_id, vinculacao_automatica, ativo)
    VALUES (p_usuario_id, p_perfil, v_upj_base, true, true);
  ELSIF v_perfil_base = 'atendente'::public.prioridades_perfil_tipo
     OR v_perfil_base = p_perfil
     OR (p_perfil = 'atendente'::public.prioridades_perfil_tipo
         AND v_perfil_base IN ('conferente', 'analista')) THEN
    UPDATE public.prioridades_usuarios_perfil
    SET perfil = p_perfil,
        upj_id = v_upj_base,
        ativo = true,
        atualizado_em = now()
    WHERE usuario_id = p_usuario_id;

    IF p_perfil = 'atendente'::public.prioridades_perfil_tipo THEN
      DELETE FROM public.prioridades_designacoes
      WHERE usuario_id = p_usuario_id AND perfil IN ('conferente', 'analista');
    END IF;
  ELSE
    -- Já é gestor/coordenador: preserva o perfil base e apenas garante a UPJ.
    UPDATE public.prioridades_usuarios_perfil
    SET upj_id = COALESCE(v_upj_base, upj_id),
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
        upj_id = v_upj_do_perfil,
        inicio_em = COALESCE(p_inicio, CURRENT_DATE),
        fim_em = p_fim,
        ativa = true,
        atualizado_em = now()
    WHERE usuario_id = p_usuario_id AND perfil = p_perfil;
  ELSE
    INSERT INTO public.prioridades_designacoes
      (usuario_id, designante_id, perfil, upj_id, inicio_em, fim_em, ativa)
    VALUES (p_usuario_id, auth.uid(), p_perfil, v_upj_do_perfil,
            COALESCE(p_inicio, CURRENT_DATE), p_fim, true);
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'usuario_id', p_usuario_id,
                            'nome', v_nome, 'perfil', p_perfil, 'perfil_base', false,
                            'upj_id', v_upj_do_perfil,
                            'fim_em', p_fim, 'indeterminado', p_fim IS NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_designar(uuid, public.prioridades_perfil_tipo, date, date, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_designar(uuid, public.prioridades_perfil_tipo, date, date, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.prioridades_designar(uuid, public.prioridades_perfil_tipo, date, date, uuid) IS
  'RF-GES-06 / RF-UPJ-05 + bootstrap. Designa Conferente (Gestor) ou Analista (Coordenador), com período, criando o perfil base na mesma transação. UPJ: obrigatória para analista/coordenador; opcional e RESPEITADA para conferente (ausente = escopo do TJSP Atende). Aceita ainda gestor/coordenador/atendente, mas só do admin, definindo o perfil base sem gerar designação.';

COMMIT;

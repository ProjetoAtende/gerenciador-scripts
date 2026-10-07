-- App "Prioridades e Urgências" — corrige a provisão do perfil `atendente`.
--
-- FALHA ENCONTRADA EM TESTE: a tela "Designações → Perfil base" oferece três
-- perfis (Gestor, Coordenador, Atendente), mas a RPC `prioridades_designar`
-- aceitava apenas 'gestor' e 'coordenador' como perfil base. Escolher
-- "Atendente" na interface devolvia:
--
--   { "sucesso": false, "erro": "Perfil inválido para esta operação." }
--
-- Consequência prática: o admin não conseguia cadastrar ninguém como Atendente
-- — e Atendente é o perfil operacional padrão de quem atende no TJSP Atende.
-- Como o registro de anotação exige perfil, e sem perfil o servidor recusa, o
-- caminho mais comum de entrada no app ficava bloqueado.
--
-- Corrige também a mensagem, que agora cita o perfil recebido.

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
  v_upj_alvo uuid;
  v_perfil_base public.prioridades_perfil_tipo;
  v_ja_existe boolean;
  v_nome text;
  -- Perfis BASE: definem o módulo e são permanentes — não geram designação.
  -- `atendente` entra aqui porque é o perfil operacional padrão do TJSP Atende.
  v_eh_perfil_base boolean := p_perfil IN ('gestor', 'coordenador', 'atendente');
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

  -- UPJ é obrigatória para Coordenador (isola a visibilidade, RF-UPJ-01) e para
  -- Analista. Atendente, Gestor e Conferente atuam sobre toda a operação.
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
    VALUES
      (p_usuario_id, p_perfil, v_upj_alvo, true, true);
  ELSIF v_perfil_base = 'atendente'::public.prioridades_perfil_tipo
     OR v_perfil_base = p_perfil
     OR (p_perfil = 'atendente'::public.prioridades_perfil_tipo AND v_perfil_base IN ('conferente', 'analista')) THEN
    -- Promove a partir de 'atendente', confirma o mesmo perfil, ou REBAIXA um
    -- designado (conferente/analista) para atendente quando é isso que o admin
    -- pediu explicitamente. Nunca rebaixa gestor/coordenador.
    UPDATE public.prioridades_usuarios_perfil
    SET perfil = p_perfil,
        upj_id = CASE WHEN p_perfil = 'atendente'::public.prioridades_perfil_tipo
                      THEN NULL
                      ELSE COALESCE(v_upj_alvo, upj_id) END,
        ativo = true,
        atualizado_em = now()
    WHERE usuario_id = p_usuario_id;

    -- Ao deixar de ser designado, a designação correspondente perde sentido.
    IF p_perfil = 'atendente'::public.prioridades_perfil_tipo THEN
      DELETE FROM public.prioridades_designacoes
      WHERE usuario_id = p_usuario_id AND perfil IN ('conferente', 'analista');
    END IF;
  ELSE
    -- Já é gestor/coordenador: preserva o perfil base e apenas garante a UPJ.
    UPDATE public.prioridades_usuarios_perfil
    SET upj_id = COALESCE(v_upj_alvo, upj_id),
        ativo = true,
        atualizado_em = now()
    WHERE usuario_id = p_usuario_id;
  END IF;

  -- Perfil base não gera designação; e ao virar Gestor/Coordenador/Atendente o
  -- usuário deixa de precisar de delegação com prazo.
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

COMMENT ON FUNCTION public.prioridades_designar(uuid, public.prioridades_perfil_tipo, date, date, uuid) IS
  'RF-GES-06 / RF-UPJ-05, mais o bootstrap. Designa Conferente (Gestor) ou Analista (Coordenador da UPJ), com período, criando o perfil base na mesma transação. Aceita ainda gestor/coordenador/atendente, mas apenas do admin: nesse caso define o PERFIL BASE, sem gerar designação.';

COMMIT;

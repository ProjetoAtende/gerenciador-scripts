-- App "Prioridades e Urgências" — designação de Conferentes e Analistas.
--
-- Implementa o RF-GES-06 e o RF-UPJ-05 (telas "Designações", slides 133 e 136)
-- e fecha uma lacuna que impedia o uso real: até aqui não existia caminho para
-- CADASTRAR perfis, apenas para listá-los. Sem isso, todo usuário novo caía no
-- aviso "sem perfil cadastrado" e o app ficava inutilizável.
--
-- ────────────────────────────────────────────────────────────────────────────
-- MODELO: dois conceitos, um ato
-- ────────────────────────────────────────────────────────────────────────────
-- A especificação trata "designação" como algo com PERÍODO (data ou
-- "Indeterminado"), o que é diferente de um perfil base permanente:
--
--   prioridades_usuarios_perfil — perfil base do app; define o módulo e o
--                                 vínculo à UPJ. É o que permite abrir o app e
--                                 ver o módulo correto.
--   prioridades_designacoes     — delegação com período: quem designou, para
--                                 qual perfil, de quando até quando.
--
-- O ato de designar cria/ajusta os dois na mesma transação. Não há divergência
-- possível porque a autorização considera designação ativa em vigor.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Designação em vigor (definida ANTES de quem a consome)
-- ─────────────────────────────────────────────────────────────────────────
--
-- `row_security = off` é explícito de propósito: estas funções são SECURITY
-- DEFINER e são chamadas de dentro das próprias policies RLS de
-- prioridades_designacoes. Sem desligar a RLS aqui, a avaliação poderia
-- reentrar na policy e recursar.

CREATE OR REPLACE FUNCTION public.prioridades_designacao_ativa(p_perfis public.prioridades_perfil_tipo[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.prioridades_designacoes d
    WHERE d.usuario_id = auth.uid()
      AND d.ativa
      AND d.perfil = ANY (p_perfis)
      AND d.inicio_em <= CURRENT_DATE
      AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
  );
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_designacao_ativa(public.prioridades_perfil_tipo[]) TO authenticated;

-- Perfil efetivo = perfil base OU designação ativa em vigor.
CREATE OR REPLACE FUNCTION public.prioridades_sou_gestor_ou_conferente()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil IN ('gestor', 'conferente')
  )
  OR public.prioridades_designacao_ativa(ARRAY['gestor', 'conferente']::public.prioridades_perfil_tipo[]);
$$;

CREATE OR REPLACE FUNCTION public.prioridades_sou_upj()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil IN ('coordenador', 'analista')
  )
  OR public.prioridades_designacao_ativa(ARRAY['coordenador', 'analista']::public.prioridades_perfil_tipo[]);
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Perfil do usuário logado, já com as designações em vigor
-- ─────────────────────────────────────────────────────────────────────────
--
-- `DROP` antes do `CREATE`: a função existente devolvia 4 colunas e agora
-- devolve 5 (acrescentamos `designacoes_ativas`). O PostgreSQL recusa
-- CREATE OR REPLACE quando o row type definido pelos OUT parameters muda
-- (SQLSTATE 42P13), então é preciso remover a versão anterior.

DROP FUNCTION IF EXISTS public.prioridades_meu_perfil();

CREATE OR REPLACE FUNCTION public.prioridades_meu_perfil()
RETURNS TABLE (
  usuario_id uuid,
  perfil public.prioridades_perfil_tipo,
  upj_id uuid,
  vinculacao_automatica boolean,
  designacoes_ativas jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    p.usuario_id,
    p.perfil,
    p.upj_id,
    p.vinculacao_automatica,
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', d.id,
                   'perfil', d.perfil,
                   'upj_id', d.upj_id,
                   'inicio_em', d.inicio_em,
                   'fim_em', d.fim_em
                 )
                 ORDER BY d.perfil
               )
        FROM public.prioridades_designacoes d
        WHERE d.usuario_id = p.usuario_id
          AND d.ativa
          AND d.inicio_em <= CURRENT_DATE
          AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
      ),
      '[]'::jsonb
    )
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid()
    AND p.ativo;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_meu_perfil() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Busca de usuários elegíveis (RF-GES-06 / RF-UPJ-05)
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
  v_upj uuid;
BEGIN
  v_sou_gestor := public.prioridades_sou_gestor_ou_conferente();

  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'coordenador'
  ) OR public.prioridades_designacao_ativa(ARRAY['coordenador']::public.prioridades_perfil_tipo[])
  INTO v_sou_coordenador;

  IF NOT (v_sou_gestor OR v_sou_coordenador) THEN
    RAISE EXCEPTION 'Apenas Gestor ou Coordenador da UPJ pode buscar usuários para designação.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_upj := COALESCE(p_upj_id, public.prioridades_minha_upj());

  RETURN QUERY
  SELECT u.id,
         u.nome,
         u.email,
         pa.perfil,
         pa.upj_id,
         EXISTS (
           SELECT 1 FROM public.prioridades_designacoes d
           WHERE d.usuario_id = u.id
             AND d.ativa
             AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
         )
  FROM public.users u
  LEFT JOIN public.prioridades_usuarios_perfil pa
    ON pa.usuario_id = u.id AND pa.ativo
  WHERE u.ativo IS DISTINCT FROM false
    -- RF-UPJ-05: busca restrita a usuários vinculados à UPJ. O Gestor do TJSP
    -- Atende busca em toda a base, porque designa para a operação inteira.
    AND (v_sou_gestor OR v_upj IS NULL OR pa.upj_id = v_upj)
    AND (
      COALESCE(btrim(p_termo), '') = ''
      OR u.nome ILIKE '%' || btrim(p_termo) || '%'
      OR u.email ILIKE '%' || btrim(p_termo) || '%'
    )
  ORDER BY u.nome
  LIMIT 25;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_buscar_usuarios(text, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Designar (cria/ajusta o perfil base + registra a designação)
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
BEGIN
  v_eh_gestor := public.prioridades_sou_gestor_ou_conferente();

  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'coordenador'
  ) OR public.prioridades_designacao_ativa(ARRAY['coordenador']::public.prioridades_perfil_tipo[])
  INTO v_eh_coordenador;

  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  INTO v_admin;

  -- A especificação separa as alçadas: Gestor designa Conferente (RF-GES-06);
  -- Coordenador da UPJ designa Analista (RF-UPJ-05).
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
  ELSE
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'A tela de Designações inclui Conferentes (Gestor) e Analistas (Coordenador da UPJ).');
  END IF;

  SELECT u.nome INTO v_nome FROM public.users u
  WHERE u.id = p_usuario_id AND u.ativo IS DISTINCT FROM false;

  IF v_nome IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não encontrado ou inativo.');
  END IF;

  -- Analista exige UPJ: RF-UPJ-01 isola a visibilidade por UPJ, então um
  -- analista sem UPJ não teria o que enxergar.
  IF p_perfil = 'analista' THEN
    v_upj_alvo := COALESCE(p_upj_id, public.prioridades_minha_upj());
    IF v_upj_alvo IS NULL THEN
      RETURN jsonb_build_object('sucesso', false,
        'erro', 'Informe a UPJ: um Analista sem UPJ não tem visibilidade sobre anotação alguma.');
    END IF;
  ELSE
    v_upj_alvo := NULL;
  END IF;

  IF p_fim IS NOT NULL AND p_fim < COALESCE(p_inicio, CURRENT_DATE) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A data final não pode ser anterior à inicial.');
  END IF;

  -- Perfil base: nunca rebaixa um perfil de hierarquia maior.
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
    -- Já é gestor/coordenador: preserva o perfil base e apenas garante a UPJ.
    UPDATE public.prioridades_usuarios_perfil
    SET upj_id = COALESCE(v_upj_alvo, upj_id),
        ativo = true,
        atualizado_em = now()
    WHERE usuario_id = p_usuario_id;
  END IF;

  -- Designação: reaproveita o registro do mesmo perfil em vez de acumular.
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
    'fim_em', p_fim,
    'indeterminado', p_fim IS NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_designar(uuid, public.prioridades_perfil_tipo, date, date, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Encerrar designação
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
  FROM public.prioridades_designacoes
  WHERE id = p_designacao_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Designação não encontrada.');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  INTO v_admin;

  IF NOT (
    v_admin
    OR (v_designacao.perfil = 'conferente' AND public.prioridades_sou_gestor_ou_conferente())
    OR (v_designacao.perfil = 'analista' AND public.prioridades_sou_upj())
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Sem permissão para encerrar esta designação.');
  END IF;

  UPDATE public.prioridades_designacoes
  SET ativa = false,
      fim_em = COALESCE(fim_em, CURRENT_DATE),
      atualizado_em = now()
  WHERE id = p_designacao_id;

  -- Sem designação ativa restante, o perfil base de designado perde razão de
  -- existir: o usuário volta a não ter perfil no app, em vez de ficar com um
  -- perfil órfão que não corresponde a designação alguma.
  SELECT count(*) INTO v_restantes
  FROM public.prioridades_designacoes d
  WHERE d.usuario_id = v_designacao.usuario_id
    AND d.ativa
    AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE);

  IF v_restantes = 0 AND v_designacao.perfil IN ('conferente', 'analista') THEN
    DELETE FROM public.prioridades_usuarios_perfil
    WHERE usuario_id = v_designacao.usuario_id
      AND perfil = v_designacao.perfil;
  END IF;

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_encerrar_designacao(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Habilitar/desabilitar participação na distribuição (RF-GES-07)
-- ─────────────────────────────────────────────────────────────────────────
--
-- Vira RPC porque a policy de UPDATE de prioridades_usuarios_perfil concede
-- apenas a admin: o Gestor via a tela mas o clique falhava, e o Coordenador da
-- UPJ não tinha caminho nenhum.

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
  v_eh_gestor := public.prioridades_sou_gestor_ou_conferente();

  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'coordenador'
  ) OR public.prioridades_designacao_ativa(ARRAY['coordenador']::public.prioridades_perfil_tipo[])
  INTO v_eh_coordenador;

  IF NOT (v_eh_gestor OR v_eh_coordenador
          OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Sem permissão para alterar a vinculação automática.');
  END IF;

  -- O Coordenador só altera quem é da própria UPJ (RF-UPJ-01).
  IF v_eh_coordenador AND NOT v_eh_gestor THEN
    SELECT p.upj_id INTO v_upj_alvo
    FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = p_usuario_id;

    IF v_upj_alvo IS DISTINCT FROM public.prioridades_minha_upj() THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário de outra UPJ.');
    END IF;
  END IF;

  UPDATE public.prioridades_usuarios_perfil
  SET vinculacao_automatica = p_habilitada,
      atualizado_em = now()
  WHERE usuario_id = p_usuario_id;

  RETURN jsonb_build_object('sucesso', true, 'vinculacao_automatica', p_habilitada);
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_alternar_vinculacao(uuid, boolean) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Documentação no schema
-- ─────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.prioridades_designacoes IS
  'RF-GES-06 e RF-UPJ-05. Delegação com período; fim_em NULL = "Indeterminado" no wireframe. Uma designação ativa em vigor HABILITA o perfil correspondente além do perfil base (ver prioridades_designacao_ativa).';

COMMENT ON COLUMN public.prioridades_usuarios_perfil.perfil IS
  'Perfil base do app: define o módulo e o vínculo à UPJ. Criado/ajustado automaticamente por prioridades_designar. Escrever direto nesta tabela exige admin (RLS); o caminho normal é a RPC prioridades_designar.';

COMMIT;

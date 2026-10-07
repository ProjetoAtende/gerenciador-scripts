-- App "Prioridades e Urgências" — catálogos e RPCs do fluxo.
--
-- Catálogos parametrizáveis (RF-ATD-07 [SUGESTÃO]: textos editáveis sem nova
-- publicação) e as transições da máquina de estados da seção 5.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Catálogos
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prioridades_tipos_solicitante (
  codigo      text PRIMARY KEY,
  label       text NOT NULL,
  ordem       integer NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.prioridades_tipos_solicitante (codigo, label, ordem) VALUES
  ('autor-exequente',      'Autor/Exequente',            1),
  ('reu-executado',        'Réu/Executado',              2),
  ('perito-leiloeiro',     'Perito/Leiloeiro',           3),
  ('arrematante-alienante','Arrematante/Alienante',      4),
  ('terceiro-interessado', 'Terceiro Interessado',       5),
  ('outros',               'Outros',                     6)
ON CONFLICT (codigo) DO UPDATE
SET label = excluded.label, ordem = excluded.ordem, atualizado_em = now();

CREATE TABLE IF NOT EXISTS public.prioridades_tipos_prioridade (
  codigo            text PRIMARY KEY,
  label             text NOT NULL,
  ordem             integer NOT NULL DEFAULT 0,
  -- RF-ATD-07: aviso contextual exibido ao selecionar o tipo (Anexo A).
  aviso             text,
  -- Link para ferramenta interna citada no aviso, se houver.
  aviso_link_label  text,
  aviso_link_url    text,
  ativo             boolean NOT NULL DEFAULT true,
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.prioridades_tipos_prioridade
  (codigo, label, ordem, aviso, aviso_link_label, aviso_link_url) VALUES
  ('urgencia-determinada',
   'Consta "URGENTE" na decisão/sentença', 1,
   'Sem menção expressa a "urgente"/"com urgência", a anotação será rejeitada. Pedidos de apressamento de MLE por "verba alimentar" não se enquadram: orientar agendamento com o(a) Magistrado(a).',
   'Contatos – TJSP Atende', NULL),

  ('prazo-excedido',
   'Prazo previsto para cumprimento excedido', 2,
   'Verificar previamente os prazos de cada UPJ.',
   'Prazos para Cumprimento – TJSP Atende', NULL),

  ('fora-localizador',
   'Fora do(a) localizador/fila adequado(a)', 3,
   'Observar o trânsito em julgado; decisões muito recentes levam à rejeição.',
   NULL, NULL),

  ('erro-material',
   'Erro material em peça processual', 4,
   'Apenas peças expedidas pelo Cartório. Erro em decisão/sentença: peticionar e agendar com o(a) Magistrado(a).',
   'Contatos – TJSP Atende', NULL),

  ('medico-saude',
   'Tratamento médico / Fornecimento de medicamento / Cirurgia', 5,
   'Somente atos cartorários já determinados (ex.: bloqueio, expedição). Pedidos liminares ou de conclusão urgente: orientar contato com o Gabinete.',
   'Contatos – TJSP Atende', NULL),

  ('prioridade-doenca',
   'Tramitação prioritária – Doença Grave', 6,
   'Prioridade geral. Para cumprimento urgente de questão de saúde, usar o tipo "Tratamento médico...".',
   NULL, NULL),

  ('prioridade-pcd',
   'Tramitação prioritária – PCD', 7,
   'Prioridade geral em favor de PCD. Para cumprimento urgente de questão de saúde, usar o tipo "Tratamento médico...".',
   NULL, NULL),

  ('prioridade-idoso',
   'Tramitação prioritária – Idoso', 8,
   'Prioridade geral. Para decisões com urgência expressa, usar "Consta ''URGENTE''...".',
   NULL, NULL),

  ('outros',
   'Outros', 9,
   'Apenas situações realmente excepcionais (ex.: solicitações de outras Varas/Câmaras, problemas sistêmicos de tramitação/redistribuição de processos físicos).',
   NULL, NULL)
ON CONFLICT (codigo) DO UPDATE
SET label = excluded.label,
    ordem = excluded.ordem,
    aviso = excluded.aviso,
    aviso_link_label = excluded.aviso_link_label,
    atualizado_em = now();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Distribuição round-robin (RF-GES-07 / RF-UPJ-06)
-- ─────────────────────────────────────────────────────────────────────────

-- [DECISÃO] A especificação não diz como garantir atribuição consistente sob
-- concorrência (apontado na seção 9.3). Implementado com SELECT ... FOR UPDATE
-- sobre o cursor da fila, dentro da transação, para serializar o avanço.
--
-- Os parâmetros são prefixados com `p_` de propósito: em PL/pgSQL, um nome de
-- parâmetro de saída colidiria com o nome da coluna dentro do corpo (erro
-- 42702 — "column reference is ambiguous").
CREATE TABLE IF NOT EXISTS public.prioridades_round_robin_cursor (
  escopo        text PRIMARY KEY,
  ultimo_usuario_id uuid,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.prioridades_round_robin_cursor (escopo) VALUES
  ('atende'), ('upj')
ON CONFLICT (escopo) DO NOTHING;

CREATE OR REPLACE FUNCTION public.prioridades_proximo_da_fila(
  p_escopo text,
  p_upj    uuid DEFAULT NULL
)
RETURNS TABLE (usuario_id uuid, usuario_nome text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfis public.prioridades_perfil_tipo[];
  v_ultimo uuid;
  v_escolhido uuid;
  v_nome text;
BEGIN
  IF p_escopo = 'atende' THEN
    v_perfis := ARRAY['gestor', 'conferente']::public.prioridades_perfil_tipo[];
  ELSIF p_escopo = 'upj' THEN
    v_perfis := ARRAY['coordenador', 'analista']::public.prioridades_perfil_tipo[];
  ELSE
    RAISE EXCEPTION 'Escopo de distribuição inválido: %', p_escopo;
  END IF;

  -- Serializa o avanço do cursor entre transações concorrentes.
  SELECT c.ultimo_usuario_id INTO v_ultimo
  FROM public.prioridades_round_robin_cursor c
  WHERE c.escopo = p_escopo
  FOR UPDATE;

  -- Fila circular: quem vem depois do último escolhido, com volta ao início.
  WITH fila AS (
    SELECT p.usuario_id AS uid, u.nome AS unome,
           row_number() OVER (ORDER BY u.nome, p.usuario_id) AS pos
    FROM public.prioridades_usuarios_perfil p
    JOIN public.users u ON u.id = p.usuario_id
    WHERE p.ativo
      AND p.vinculacao_automatica
      AND p.perfil = ANY (v_perfis)
      AND (p_escopo = 'atende' OR (p.upj_id IS NOT NULL AND p.upj_id = p_upj))
  ),
  ultima_pos AS (
    SELECT COALESCE((SELECT f.pos FROM fila f WHERE f.uid = v_ultimo), 0) AS pos
  )
  SELECT f.uid, f.unome INTO v_escolhido, v_nome
  FROM fila f, ultima_pos u
  WHERE f.pos > u.pos
  ORDER BY f.pos
  LIMIT 1;

  -- Volta ao início da fila.
  IF v_escolhido IS NULL THEN
    SELECT f.uid, f.unome INTO v_escolhido, v_nome
    FROM (
      SELECT p.usuario_id AS uid, u.nome AS unome,
             row_number() OVER (ORDER BY u.nome, p.usuario_id) AS pos
      FROM public.prioridades_usuarios_perfil p
      JOIN public.users u ON u.id = p.usuario_id
      WHERE p.ativo AND p.vinculacao_automatica AND p.perfil = ANY (v_perfis)
        AND (p_escopo = 'atende' OR (p.upj_id IS NOT NULL AND p.upj_id = p_upj))
    ) f
    ORDER BY f.pos
    LIMIT 1;
  END IF;

  IF v_escolhido IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.prioridades_round_robin_cursor
  SET ultimo_usuario_id = v_escolhido, atualizado_em = now()
  WHERE escopo = p_escopo;

  usuario_id := v_escolhido;
  usuario_nome := v_nome;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_proximo_da_fila(text, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Registro e transições da anotação
-- ─────────────────────────────────────────────────────────────────────────

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
AS $$
DECLARE
  v_perfil public.prioridades_perfil_tipo;
  v_nome text;
BEGIN
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

-- RF-ATD-11: validação no envio e roteamento por perfil.
--   Gestor      → upj-pendente (dispensa a conferência — regra dos slides 87–89)
--   Conferente  → gestor-conferencia (NÃO tem dispensa)
--   Atendente   → gestor-conferencia
CREATE OR REPLACE FUNCTION public.prioridades_criar_anotacao(p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil public.prioridades_perfil_tipo;
  v_nome text;
  v_status public.prioridades_status;
  v_id bigint;
  v_upj uuid;
  v_vara integer;
  v_conferente RECORD;
  v_analista RECORD;
  v_pendentes text[] := ARRAY[]::text[];
BEGIN
  SELECT p.perfil INTO v_perfil
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  IF v_perfil IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário sem perfil no app de Prioridades e Urgências.');
  END IF;

  IF v_perfil NOT IN ('atendente', 'gestor', 'conferente') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Perfil sem permissão para registrar anotações.');
  END IF;

  -- RF-ATD-11: lista os campos obrigatórios pendentes em vez de falhar no primeiro.
  IF COALESCE(trim(p_dados->>'processo'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'N.º do Processo');
  ELSIF length(regexp_replace(p_dados->>'processo', '\D', '', 'g')) <> 20 THEN
    v_pendentes := array_append(v_pendentes, 'N.º do Processo (deve ter 20 dígitos no padrão CNJ)');
  END IF;

  IF COALESCE(trim(p_dados->>'tipo_solicitante'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Tipo de Solicitante');
  END IF;
  IF p_dados->>'tipo_solicitante' = 'outros'
     AND COALESCE(trim(p_dados->>'descricao_solicitante'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Descrição do(s) Solicitante');
  END IF;

  IF COALESCE(trim(p_dados->>'tipo_prioridade'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Tipo de Prioridade/Urgência');
  END IF;
  IF p_dados->>'tipo_prioridade' = 'outros'
     AND COALESCE(trim(p_dados->>'descricao_tipo_outros'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Descrição do Tipo de Prioridade/Urgência (Outros)');
  END IF;

  IF COALESCE(trim(p_dados->>'evento_folha'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Evento ou Folhas');
  END IF;
  IF COALESCE(trim(p_dados->>'descricao_prioridade'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Descrição da Prioridade/Urgência');
  END IF;

  IF array_length(v_pendentes, 1) > 0 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Preencha os campos obrigatórios.',
      'campos_pendentes', to_jsonb(v_pendentes)
    );
  END IF;

  SELECT u.nome INTO v_nome FROM public.users u WHERE u.id = auth.uid();

  v_upj := NULLIF(p_dados->>'upj_id', '')::uuid;
  v_vara := NULLIF(p_dados->>'vara', '')::integer;

  IF v_perfil = 'gestor' THEN
    v_status := 'upj-pendente';
  ELSE
    v_status := 'gestor-conferencia';
  END IF;

  INSERT INTO public.prioridades_anotacoes (
    status, criador_id, criador_nome, criador_perfil,
    processo, vara, upj_id, plataforma,
    validacao_djen_status, validacao_djen_em, validacao_djen_detalhe,
    id_orgao_djen, nome_orgao_djen,
    tipo_solicitante, descricao_solicitante,
    tipo_prioridade, descricao_tipo_outros,
    evento_folha, descricao_prioridade, observacao_adicional_atende,
    data_remessa_gestor, data_remessa_upj
  ) VALUES (
    v_status, auth.uid(), v_nome, v_perfil,
    regexp_replace(p_dados->>'processo', '\D', '', 'g'), v_vara, v_upj,
    NULLIF(p_dados->>'plataforma', ''),
    COALESCE(NULLIF(p_dados->>'validacao_djen_status', ''), 'nao_consultado'),
    NULLIF(p_dados->>'validacao_djen_em', '')::timestamptz,
    NULLIF(p_dados->>'validacao_djen_detalhe', ''),
    NULLIF(p_dados->>'id_orgao_djen', '')::bigint,
    NULLIF(p_dados->>'nome_orgao_djen', ''),
    p_dados->>'tipo_solicitante', NULLIF(p_dados->>'descricao_solicitante', ''),
    p_dados->>'tipo_prioridade', NULLIF(p_dados->>'descricao_tipo_outros', ''),
    p_dados->>'evento_folha', p_dados->>'descricao_prioridade',
    NULLIF(p_dados->>'observacao_adicional_atende', ''),
    CASE WHEN v_status = 'gestor-conferencia' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'upj-pendente' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_id;

  -- Distribuição automática (RF-GES-07). Só faz sentido na fila de conferência.
  IF v_status = 'gestor-conferencia' THEN
    SELECT * INTO v_conferente FROM public.prioridades_proximo_da_fila('atende', NULL);
    IF v_conferente.usuario_id IS NOT NULL THEN
      UPDATE public.prioridades_anotacoes
      SET conferente_vinculado_id = v_conferente.usuario_id,
          conferente_vinculado_nome = v_conferente.usuario_nome
      WHERE id = v_id;
    END IF;
  ELSE
    -- Remessa direta à UPJ: vincula analista da UPJ de destino.
    IF v_upj IS NOT NULL THEN
      SELECT * INTO v_analista FROM public.prioridades_proximo_da_fila('upj', v_upj);
      IF v_analista.usuario_id IS NOT NULL THEN
        UPDATE public.prioridades_anotacoes
        SET analista_vinculado_id = v_analista.usuario_id,
            analista_vinculado_nome = v_analista.usuario_nome
        WHERE id = v_id;
      END IF;
    END IF;
  END IF;

  PERFORM public.prioridades_registrar_historico(
    v_id, NULL, v_status, 'criacao', p_dados->>'descricao_prioridade');

  RETURN jsonb_build_object('sucesso', true, 'anotacao_id', v_id, 'status', v_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_criar_anotacao(jsonb) TO authenticated;

-- RF-GES-02/03/04/05: decisão da conferência.
CREATE OR REPLACE FUNCTION public.prioridades_conferir(
  p_anotacao_id bigint,
  p_decisao text,               -- 'aprovar' | 'devolver' | 'rejeitar'
  p_justificativa text DEFAULT NULL,
  p_urgentissimo boolean DEFAULT false,
  p_correcao_automatica boolean DEFAULT false,
  p_texto_correcao text DEFAULT NULL,
  p_alteracoes jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.prioridades_anotacoes%ROWTYPE;
  v_perfil public.prioridades_perfil_tipo;
  v_novo public.prioridades_status;
  v_analista RECORD;
BEGIN
  SELECT p.perfil INTO v_perfil
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  IF v_perfil NOT IN ('gestor', 'conferente') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas Gestor ou Conferente Designado pode conferir.');
  END IF;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação não encontrada.');
  END IF;
  IF v_row.status <> 'gestor-conferencia' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A anotação não está aguardando conferência.');
  END IF;

  -- RF-GES-03: correção dos campos na conferência, preservando o texto original.
  IF p_alteracoes IS NOT NULL THEN
    UPDATE public.prioridades_anotacoes
    SET descricao_prioridade = COALESCE(NULLIF(p_alteracoes->>'descricao_prioridade', ''), descricao_prioridade),
        evento_folha = COALESCE(NULLIF(p_alteracoes->>'evento_folha', ''), evento_folha),
        observacao_adicional_gestor = COALESCE(NULLIF(p_alteracoes->>'observacao_adicional_gestor', ''),
                                                observacao_adicional_gestor),
        conferido_por_id = auth.uid(),
        atualizado_em = now()
    WHERE id = p_anotacao_id;
  ELSE
    UPDATE public.prioridades_anotacoes
    SET conferido_por_id = auth.uid(), atualizado_em = now()
    WHERE id = p_anotacao_id;
  END IF;

  IF p_decisao = 'aprovar' THEN
    v_novo := 'gestor-aprovada';

    -- RF-GES-04: Urgentíssimo só na aprovação.
    UPDATE public.prioridades_anotacoes
    SET urgentissimo = COALESCE(p_urgentissimo, false)
    WHERE id = p_anotacao_id;

    -- Remessa à UPJ. [DECISÃO] A pendência 2 do documento pergunta se
    -- "Aprovada (Gestor)" e "Pendente (UPJ)" são sequenciais ou equivalentes.
    -- Adotamos o modelo sequencial do diagrama da seção 5.1: grava a aprovação
    -- (com data/hora e histórico) e em seguida move para upj-pendente, que é o
    -- status operacional efetivamente visto pela UPJ.
    UPDATE public.prioridades_anotacoes
    SET data_remessa_upj = now(), atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-conferencia', 'gestor-aprovada', 'aprovacao', NULL);

    IF v_row.upj_id IS NOT NULL THEN
      SELECT * INTO v_analista FROM public.prioridades_proximo_da_fila('upj', v_row.upj_id);
      IF v_analista.usuario_id IS NOT NULL THEN
        UPDATE public.prioridades_anotacoes
        SET analista_vinculado_id = v_analista.usuario_id,
            analista_vinculado_nome = v_analista.usuario_nome
        WHERE id = p_anotacao_id;
      END IF;
    END IF;

    UPDATE public.prioridades_anotacoes
    SET status = 'upj-pendente', atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-aprovada', 'upj-pendente', 'remessa_upj', NULL);

    RETURN jsonb_build_object('sucesso', true, 'status', 'upj-pendente');
  END IF;

  IF p_decisao = 'devolver' THEN
    IF COALESCE(trim(p_justificativa), '') = '' THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Justificativa é obrigatória para devolver.');
    END IF;
    IF p_correcao_automatica AND COALESCE(trim(p_texto_correcao), '') = '' THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Informe o texto da Correção Automática.');
    END IF;

    v_novo := 'gestor-devolvida';

    UPDATE public.prioridades_anotacoes
    SET status = v_novo,
        justificativa_devolucao_gestor = p_justificativa,
        correcao_automatica = COALESCE(p_correcao_automatica, false),
        texto_correcao_automatica = NULLIF(p_texto_correcao, ''),
        devolvida_por = 'gestor',
        data_devolucao = now(),
        prazo_resposta_em = now() + interval '24 hours',
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-conferencia', v_novo, 'devolucao_gestor', p_justificativa);

    RETURN jsonb_build_object('sucesso', true, 'status', v_novo,
                              'prazo_resposta_em', now() + interval '24 hours');
  END IF;

  IF p_decisao = 'rejeitar' THEN
    IF COALESCE(trim(p_justificativa), '') = '' THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Justificativa é obrigatória para rejeitar.');
    END IF;

    v_novo := 'gestor-rejeitada';

    UPDATE public.prioridades_anotacoes
    SET status = v_novo,
        justificativa_rejeicao_gestor = p_justificativa,
        arquivamento_automatico = false,
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-conferencia', v_novo, 'rejeicao_gestor', p_justificativa);

    RETURN jsonb_build_object('sucesso', true, 'status', v_novo);
  END IF;

  RETURN jsonb_build_object('sucesso', false, 'erro', 'Decisão inválida.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_conferir(bigint, text, text, boolean, boolean, text, jsonb) TO authenticated;

-- RF-ATD-14: resposta do Atendente à devolução.
-- A resposta retorna a anotação a Ag. Conferência (Gestor), inclusive quando a
-- devolução partiu da UPJ (a especificação é explícita nesse ponto).
CREATE OR REPLACE FUNCTION public.prioridades_responder_devolucao(
  p_anotacao_id bigint,
  p_resposta text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.prioridades_anotacoes%ROWTYPE;
BEGIN
  IF COALESCE(trim(p_resposta), '') = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A resposta é obrigatória.');
  END IF;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação não encontrada.');
  END IF;
  IF v_row.criador_id <> auth.uid() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas o autor da anotação pode responder à devolução.');
  END IF;
  IF v_row.status NOT IN ('gestor-devolvida', 'upj-devolvida') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A anotação não está devolvida.');
  END IF;
  IF v_row.prazo_resposta_em IS NOT NULL AND now() > v_row.prazo_resposta_em THEN
    -- RF-ATD-15: expirado o prazo, não cabe mais resposta — o temporizador já rejeitou.
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prazo de resposta encerrado.');
  END IF;

  UPDATE public.prioridades_anotacoes
  SET status = 'gestor-conferencia',
      resposta_atendente = p_resposta,
      respondida_em = now(),
      data_remessa_gestor = now(),
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  PERFORM public.prioridades_registrar_historico(
    p_anotacao_id, v_row.status, 'gestor-conferencia', 'resposta_devolucao', p_resposta);

  RETURN jsonb_build_object('sucesso', true, 'status', 'gestor-conferencia');
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_responder_devolucao(bigint, text) TO authenticated;

-- RF-UPJ-03/04: análise na UPJ.
CREATE OR REPLACE FUNCTION public.prioridades_analisar(
  p_anotacao_id bigint,
  p_decisao text,               -- 'resolver' | 'devolver' | 'rejeitar'
  p_observacao_upj text DEFAULT NULL,
  p_justificativa text DEFAULT NULL,
  p_arquivamento_automatico boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.prioridades_anotacoes%ROWTYPE;
  v_perfil public.prioridades_perfil_tipo;
  v_upj uuid;
  v_novo public.prioridades_status;
BEGIN
  SELECT p.perfil, p.upj_id INTO v_perfil, v_upj
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  IF v_perfil NOT IN ('coordenador', 'analista') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas Coordenador ou Analista Designado pode analisar.');
  END IF;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação não encontrada.');
  END IF;

  -- RF-UPJ-01: isolamento por UPJ.
  IF v_upj IS NULL OR v_row.upj_id IS DISTINCT FROM v_upj THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação de outra UPJ.');
  END IF;

  IF v_row.status <> 'upj-pendente' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A anotação não está pendente na UPJ.');
  END IF;

  IF p_decisao = 'resolver' THEN
    v_novo := 'upj-resolvida';
    UPDATE public.prioridades_anotacoes
    SET status = v_novo,
        observacao_adicional_upj = NULLIF(p_observacao_upj, ''),
        analisado_por_id = auth.uid(),
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'upj-pendente', v_novo, 'resolucao_upj', p_observacao_upj);

    RETURN jsonb_build_object('sucesso', true, 'status', v_novo);
  END IF;

  IF p_decisao = 'devolver' THEN
    IF COALESCE(trim(p_justificativa), '') = '' THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Justificativa é obrigatória para devolver.');
    END IF;

    v_novo := 'upj-devolvida';
    UPDATE public.prioridades_anotacoes
    SET status = v_novo,
        justificativa_devolucao_upj = p_justificativa,
        analisado_por_id = auth.uid(),
        devolvida_por = 'upj',
        data_devolucao = now(),
        prazo_resposta_em = now() + interval '24 hours',
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'upj-pendente', v_novo, 'devolucao_upj', p_justificativa);

    RETURN jsonb_build_object('sucesso', true, 'status', v_novo,
                              'prazo_resposta_em', now() + interval '24 hours');
  END IF;

  IF p_decisao = 'rejeitar' THEN
    IF COALESCE(trim(p_justificativa), '') = '' THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Justificativa é obrigatória para rejeitar.');
    END IF;

    v_novo := 'upj-rejeitada';
    UPDATE public.prioridades_anotacoes
    SET status = v_novo,
        justificativa_rejeicao_upj = p_justificativa,
        arquivamento_automatico = COALESCE(p_arquivamento_automatico, false),
        analisado_por_id = auth.uid(),
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'upj-pendente', v_novo, 'rejeicao_upj', p_justificativa);

    RETURN jsonb_build_object('sucesso', true, 'status', v_novo);
  END IF;

  RETURN jsonb_build_object('sucesso', false, 'erro', 'Decisão inválida.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_analisar(bigint, text, text, text, boolean) TO authenticated;

-- RF-ATD-15 / RF-UPJ-04 / RF-GER-06: temporizador de 24 h.
-- Executado por job agendado (pg_cron) ou por chamada explícita.
--   Sem resposta e SEM correção automática → Rejeitada (Gestor) ou Rejeitada (UPJ).
--   Sem resposta e COM correção automática → aplica a correção e remete à UPJ.
CREATE OR REPLACE FUNCTION public.prioridades_processar_prazos_vencidos()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.prioridades_anotacoes%ROWTYPE;
  v_rejeitadas integer := 0;
  v_corrigidas integer := 0;
  v_analista RECORD;
  v_novo public.prioridades_status;
BEGIN
  FOR v_row IN
    SELECT * FROM public.prioridades_anotacoes
    WHERE status IN ('gestor-devolvida', 'upj-devolvida')
      AND prazo_resposta_em IS NOT NULL
      AND prazo_resposta_em < now()
    ORDER BY prazo_resposta_em
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_row.devolvida_por = 'gestor' AND v_row.correcao_automatica THEN
      -- Aplica a correção engatilhada e remete à UPJ (correção silenciosa).
      UPDATE public.prioridades_anotacoes
      SET status = 'upj-pendente',
          descricao_prioridade = COALESCE(v_row.texto_correcao_automatica, v_row.descricao_prioridade),
          observacao_adicional_gestor = COALESCE(v_row.observacao_adicional_gestor,
                                                 v_row.descricao_prioridade),
          resposta_atendente = NULL,
          respondida_em = NULL,
          data_remessa_upj = now(),
          atualizado_em = now()
      WHERE id = v_row.id;

      PERFORM public.prioridades_registrar_historico(
        v_row.id, v_row.status, 'upj-pendente', 'correcao_automatica', v_row.texto_correcao_automatica);

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

      PERFORM public.prioridades_registrar_historico(
        v_row.id, v_row.status, v_novo, 'rejeicao_automatica_prazo',
        'Prazo de 24 h expirado sem resposta do Atendente.');

      v_rejeitadas := v_rejeitadas + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('sucesso', true,
                            'rejeitadas', v_rejeitadas,
                            'correcoes_aplicadas', v_corrigidas);
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_processar_prazos_vencidos() TO authenticated;

-- RF-ATD-12: anotações prévias do mesmo processo nos últimos 120 dias.
CREATE OR REPLACE FUNCTION public.prioridades_anteriores(p_processo text, p_dias integer DEFAULT 120)
RETURNS TABLE (
  id bigint,
  status public.prioridades_status,
  data_anotacao timestamptz,
  descricao_prioridade text,
  criador_nome text,
  tipo_prioridade text,
  upj_codigo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.status, a.data_anotacao, a.descricao_prioridade,
         a.criador_nome, a.tipo_prioridade, u.codigo
  FROM public.prioridades_anotacoes a
  LEFT JOIN public.prioridades_upjs u ON u.id = a.upj_id
  WHERE a.processo = regexp_replace(p_processo, '\D', '', 'g')
    AND a.data_anotacao >= now() - make_interval(days => GREATEST(p_dias, 1))
    AND public.prioridades_pode_ver(a.id)
  ORDER BY a.data_anotacao DESC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_anteriores(text, integer) TO authenticated;

COMMIT;

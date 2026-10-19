-- Prioridades e Urgências — Categoria da Anotação (out/2026)
-- RF: categoria na anotação, filtro UPJ, categorias habilitadas por analista.

BEGIN;

-- ── Domínio e colunas ─────────────────────────────────────────────────────

ALTER TABLE public.prioridades_anotacoes
  ADD COLUMN IF NOT EXISTS categoria text;

ALTER TABLE public.prioridades_anotacoes
  DROP CONSTRAINT IF EXISTS prioridades_anotacoes_categoria_chk;

ALTER TABLE public.prioridades_anotacoes
  ADD CONSTRAINT prioridades_anotacoes_categoria_chk
  CHECK (
    categoria IS NULL
    OR categoria IN (
      'mle', 'sisbajud', 'pesquisas', 'cadastro',
      'expedicao', 'movimentacao', 'publicacao', 'audiencias'
    )
  );

CREATE INDEX IF NOT EXISTS prioridades_anotacoes_categoria_idx
  ON public.prioridades_anotacoes (categoria)
  WHERE categoria IS NOT NULL;

ALTER TABLE public.prioridades_usuarios_perfil
  ADD COLUMN IF NOT EXISTS categorias_habilitadas text[];

COMMENT ON COLUMN public.prioridades_anotacoes.categoria IS
  'Categoria operacional da anotação na UPJ (direcionamento entre analistas).';

COMMENT ON COLUMN public.prioridades_usuarios_perfil.categorias_habilitadas IS
  'Analista: categorias visíveis. NULL = todas as categorias válidas.';

CREATE OR REPLACE FUNCTION public.prioridades_categorias_validas()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'mle', 'sisbajud', 'pesquisas', 'cadastro',
    'expedicao', 'movimentacao', 'publicacao', 'audiencias'
  ]::text[];
$$;

-- Anotações de teste anteriores: categoria MLE + nota na descrição.
UPDATE public.prioridades_anotacoes
SET
  categoria = 'mle',
  descricao_prioridade = descricao_prioridade || E'\n\n[Categoria MLE incluída por padrão — anotação anterior à implantação da Categoria da Anotação.]'
WHERE categoria IS NULL;

UPDATE public.prioridades_usuarios_perfil p
SET categorias_habilitadas = public.prioridades_categorias_validas(),
    atualizado_em = now()
WHERE p.perfil = 'analista'
  AND p.ativo
  AND (p.categorias_habilitadas IS NULL OR cardinality(p.categorias_habilitadas) = 0);

-- ── Helpers de visibilidade por categoria (Analista) ───────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_designacao_ativa_para(
  p_uid uuid,
  p_perfis public.prioridades_perfil_tipo[]
)
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
    WHERE d.usuario_id = p_uid
      AND d.ativa
      AND d.inicio_em <= CURRENT_DATE
      AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
      AND d.perfil = ANY (p_perfis)
  );
$$;

CREATE OR REPLACE FUNCTION public.prioridades_usuario_eh_coordenador(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.prioridades_usuarios_perfil p
      WHERE p.usuario_id = p_uid AND p.ativo AND p.perfil = 'coordenador'
    )
    OR public.prioridades_designacao_ativa_para(
         p_uid,
         ARRAY['coordenador']::public.prioridades_perfil_tipo[]
       ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.prioridades_analista_ve_categoria(
  p_uid uuid,
  p_categoria text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_cats text[];
BEGIN
  IF p_categoria IS NULL OR p_categoria = '' THEN
    RETURN FALSE;
  END IF;

  SELECT p.categorias_habilitadas INTO v_cats
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = p_uid AND p.ativo;

  IF v_cats IS NULL THEN
    v_cats := public.prioridades_categorias_validas();
  END IF;

  RETURN p_categoria = ANY (v_cats);
END;
$$;

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
  v_upj_usuario uuid;
  v_tem_designacao_atende boolean;
  v_eh_coord boolean;
  v_restricao_categoria boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT p.perfil, p.upj_id INTO v_perfil, v_upj
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = v_uid AND p.ativo;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_tem_designacao_atende := EXISTS (
    SELECT 1 FROM public.prioridades_designacoes d
    WHERE d.usuario_id = v_uid
      AND d.ativa
      AND d.inicio_em <= CURRENT_DATE
      AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
      AND d.perfil IN ('gestor', 'conferente')
  );

  IF v_perfil = 'atendente' AND NOT v_tem_designacao_atende THEN
    RETURN v_row.criador_id = v_uid;
  END IF;

  v_eh_upj := v_perfil IN ('coordenador', 'analista')
    OR public.prioridades_designacao_ativa(ARRAY['coordenador', 'analista']::public.prioridades_perfil_tipo[]);

  v_eh_coord := public.prioridades_usuario_eh_coordenador(v_uid);
  v_restricao_categoria := v_eh_upj
    AND NOT v_eh_coord
    AND (
      v_perfil = 'analista'
      OR public.prioridades_designacao_ativa(ARRAY['analista']::public.prioridades_perfil_tipo[])
    );

  v_upj_usuario := v_upj;
  IF v_eh_upj AND v_upj_usuario IS NULL THEN
    SELECT d.upj_id INTO v_upj_usuario
    FROM public.prioridades_designacoes d
    WHERE d.usuario_id = v_uid
      AND d.ativa
      AND d.perfil IN ('coordenador', 'analista')
      AND d.inicio_em <= CURRENT_DATE
      AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
      AND d.upj_id IS NOT NULL
    ORDER BY d.inicio_em DESC
    LIMIT 1;
  END IF;

  IF v_row.criador_id = v_uid
     OR v_row.conferente_vinculado_id = v_uid
     OR v_row.conferido_por_id = v_uid THEN
    RETURN TRUE;
  END IF;

  IF v_row.analista_vinculado_id = v_uid OR v_row.analisado_por_id = v_uid THEN
    IF v_upj_usuario IS NULL OR v_row.upj_id IS DISTINCT FROM v_upj_usuario THEN
      RETURN FALSE;
    END IF;
    IF v_restricao_categoria
       AND NOT public.prioridades_analista_ve_categoria(v_uid, v_row.categoria) THEN
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  END IF;

  IF v_perfil = 'gestor' THEN
    RETURN TRUE;
  END IF;

  IF v_eh_upj THEN
    IF v_upj_usuario IS NULL OR v_row.upj_id IS DISTINCT FROM v_upj_usuario THEN
      RETURN FALSE;
    END IF;
    IF v_restricao_categoria
       AND NOT public.prioridades_analista_ve_categoria(v_uid, v_row.categoria) THEN
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  END IF;

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

  IF public.prioridades_designacao_ativa(ARRAY['gestor']::public.prioridades_perfil_tipo[]) THEN
    RETURN v_row.status = 'gestor-conferencia';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND role::text = 'admin') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Rodízio UPJ: opcionalmente filtra analistas pela categoria da anotação.
DROP FUNCTION IF EXISTS public.prioridades_proximo_da_fila(text, uuid);

CREATE OR REPLACE FUNCTION public.prioridades_proximo_da_fila(
  p_escopo text,
  p_upj uuid DEFAULT NULL,
  p_categoria text DEFAULT NULL
)
RETURNS TABLE (usuario_id uuid, usuario_nome text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
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

  SELECT c.ultimo_usuario_id INTO v_ultimo
  FROM public.prioridades_round_robin_cursor c
  WHERE c.escopo = p_escopo
  FOR UPDATE;

  WITH fila AS (
    SELECT p.usuario_id AS uid, u.nome AS unome,
           row_number() OVER (ORDER BY u.nome, p.usuario_id) AS pos
    FROM public.prioridades_usuarios_perfil p
    JOIN public.users u ON u.id = p.usuario_id
    WHERE p.ativo
      AND p.vinculacao_automatica
      AND (
        (
          p.perfil = ANY (v_perfis)
          AND (p_escopo = 'atende' OR (p.upj_id IS NOT NULL AND p.upj_id = p_upj))
          AND (
            p_escopo <> 'upj'
            OR p.perfil = 'coordenador'
            OR p_categoria IS NULL
            OR public.prioridades_analista_ve_categoria(p.usuario_id, p_categoria)
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.prioridades_designacoes d
          WHERE d.usuario_id = p.usuario_id
            AND d.ativa
            AND d.inicio_em <= CURRENT_DATE
            AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
            AND d.perfil = ANY (v_perfis)
            AND (p_escopo = 'atende' OR d.upj_id = p_upj)
            AND (
              p_escopo <> 'upj'
              OR d.perfil = 'coordenador'
              OR p_categoria IS NULL
              OR public.prioridades_analista_ve_categoria(p.usuario_id, p_categoria)
            )
        )
      )
  ),
  ultima_pos AS (
    SELECT COALESCE((SELECT f.pos FROM fila f WHERE f.uid = v_ultimo), 0) AS pos
  )
  SELECT f.uid, f.unome INTO v_escolhido, v_nome
  FROM fila f, ultima_pos u
  WHERE f.pos > u.pos
  ORDER BY f.pos
  LIMIT 1;

  IF v_escolhido IS NULL THEN
    SELECT f.uid, f.unome INTO v_escolhido, v_nome
    FROM (
      SELECT p.usuario_id AS uid, u.nome AS unome,
             row_number() OVER (ORDER BY u.nome, p.usuario_id) AS pos
      FROM public.prioridades_usuarios_perfil p
      JOIN public.users u ON u.id = p.usuario_id
      WHERE p.ativo
        AND p.vinculacao_automatica
        AND (
          (
            p.perfil = ANY (v_perfis)
            AND (p_escopo = 'atende' OR (p.upj_id IS NOT NULL AND p.upj_id = p_upj))
            AND (
              p_escopo <> 'upj'
              OR p.perfil = 'coordenador'
              OR p_categoria IS NULL
              OR public.prioridades_analista_ve_categoria(p.usuario_id, p_categoria)
            )
          )
          OR EXISTS (
            SELECT 1
            FROM public.prioridades_designacoes d
            WHERE d.usuario_id = p.usuario_id
              AND d.ativa
              AND d.inicio_em <= CURRENT_DATE
              AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
              AND d.perfil = ANY (v_perfis)
              AND (p_escopo = 'atende' OR d.upj_id = p_upj)
              AND (
                p_escopo <> 'upj'
                OR d.perfil = 'coordenador'
                OR p_categoria IS NULL
                OR public.prioridades_analista_ve_categoria(p.usuario_id, p_categoria)
              )
          )
        )
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

REVOKE ALL ON FUNCTION public.prioridades_proximo_da_fila(text, uuid, text) FROM PUBLIC, anon, authenticated;

-- ── Criação: categoria obrigatória ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_criar_anotacao(p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_perfil public.prioridades_perfil_tipo;
  v_nome text;
  v_status public.prioridades_status;
  v_id bigint;
  v_upj uuid;
  v_vara integer;
  v_processo text;
  v_conferente RECORD;
  v_analista RECORD;
  v_pendentes text[] := ARRAY[]::text[];
  v_validacao_status text;
  v_upj_do_orgao uuid;
  v_id_orgao bigint;
  v_categoria text;
BEGIN
  SELECT p.perfil INTO v_perfil
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  IF v_perfil IS NULL THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Usuário sem perfil no app de Prioridades e Urgências.');
  END IF;

  IF NOT (v_perfil IN ('atendente', 'gestor', 'conferente')) THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Perfil sem permissão para registrar anotações.');
  END IF;

  v_processo := regexp_replace(COALESCE(p_dados->>'processo', ''), '\D', '', 'g');

  IF v_processo = '' THEN
    v_pendentes := array_append(v_pendentes, 'N.º do Processo');
  ELSIF length(v_processo) <> 20 THEN
    v_pendentes := array_append(v_pendentes, 'N.º do Processo (deve ter 20 dígitos no padrão CNJ)');
  ELSIF NOT public.prioridades_cnj_dv_valido(v_processo) THEN
    v_pendentes := array_append(v_pendentes, 'N.º do Processo (dígito verificador inválido no padrão CNJ)');
  END IF;

  IF COALESCE(trim(p_dados->>'tipo_solicitante'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Tipo de Solicitante');
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.prioridades_tipos_solicitante t
    WHERE t.codigo = p_dados->>'tipo_solicitante' AND t.ativo
  ) THEN
    v_pendentes := array_append(v_pendentes,
      format('Tipo de Solicitante (valor não reconhecido: %s)', p_dados->>'tipo_solicitante'));
  END IF;

  IF p_dados->>'tipo_solicitante' = 'outros'
     AND COALESCE(trim(p_dados->>'descricao_solicitante'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Descrição do(s) Solicitante');
  END IF;

  v_categoria := NULLIF(trim(p_dados->>'categoria'), '');
  IF v_categoria IS NULL THEN
    v_pendentes := array_append(v_pendentes, 'Categoria da Anotação');
  ELSIF NOT (v_categoria = ANY (public.prioridades_categorias_validas())) THEN
    v_pendentes := array_append(v_pendentes, 'Categoria da Anotação (valor inválido)');
  END IF;

  IF COALESCE(trim(p_dados->>'tipo_prioridade'), '') = '' THEN
    v_pendentes := array_append(v_pendentes, 'Tipo de Prioridade/Urgência');
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.prioridades_tipos_prioridade t
    WHERE t.codigo = p_dados->>'tipo_prioridade' AND t.ativo
  ) THEN
    v_pendentes := array_append(v_pendentes,
      format('Tipo de Prioridade/Urgência (valor não reconhecido: %s)', p_dados->>'tipo_prioridade'));
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

  IF COALESCE(p_dados->>'plataforma', '') NOT IN ('', 'eproc', 'saj') THEN
    v_pendentes := array_append(v_pendentes, 'Sistema (use Eproc ou SAJ)');
  END IF;

  v_upj := NULLIF(p_dados->>'upj_id', '')::uuid;
  v_id_orgao := NULLIF(p_dados->>'id_orgao_djen', '')::bigint;

  IF v_upj IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.prioridades_upjs WHERE id = v_upj AND ativa) THEN
    v_pendentes := array_append(v_pendentes, 'UPJ de destino (inexistente ou inativa)');
  END IF;

  IF v_upj IS NOT NULL AND v_id_orgao IS NOT NULL THEN
    SELECT o.upj_id INTO v_upj_do_orgao
    FROM public.prioridades_orgaos_upj o
    WHERE o.id_orgao_djen = v_id_orgao AND o.ativo;

    IF v_upj_do_orgao IS NOT NULL AND v_upj_do_orgao <> v_upj THEN
      v_pendentes := array_append(v_pendentes,
        'UPJ de destino (não corresponde ao órgão publicado no DJEN para este processo)');
    END IF;
  END IF;

  IF array_length(v_pendentes, 1) > 0 THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Preencha os campos obrigatórios.',
      'campos_pendentes', to_jsonb(v_pendentes));
  END IF;

  SELECT u.nome INTO v_nome FROM public.users u WHERE u.id = auth.uid();

  v_validacao_status := COALESCE(NULLIF(p_dados->>'validacao_djen_status', ''), 'nao_consultado');
  IF v_validacao_status NOT IN ('nao_consultado', 'localizado', 'sem_comunicacao', 'erro') THEN
    v_validacao_status := 'nao_consultado';
  END IF;
  IF v_validacao_status = 'localizado' AND v_id_orgao IS NULL THEN
    v_validacao_status := 'nao_consultado';
  END IF;

  v_vara := NULLIF(p_dados->>'vara', '')::integer;

  IF NOT public.prioridades_processo_competencia_atende(
    v_processo,
    v_vara,
    NULLIF(p_dados->>'nome_orgao_djen', ''),
    v_validacao_status
  ) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Este processo não está na competência do TJSP Atende (1ª a 45ª Varas Cíveis do Foro Central de São Paulo).',
      'campos_pendentes', to_jsonb(ARRAY['N.º do Processo'])
    );
  END IF;

  v_status := CASE WHEN v_perfil = 'gestor' THEN 'upj-pendente'::public.prioridades_status
                   ELSE 'gestor-conferencia'::public.prioridades_status END;

  INSERT INTO public.prioridades_anotacoes (
    status, criador_id, criador_nome, criador_perfil,
    processo, vara, upj_id, plataforma,
    validacao_djen_status, validacao_djen_em, validacao_djen_detalhe,
    id_orgao_djen, nome_orgao_djen,
    tipo_solicitante, descricao_solicitante, nome_solicitante,
    categoria,
    tipo_prioridade, descricao_tipo_outros,
    evento_folha, descricao_prioridade, observacao_adicional_atende,
    data_remessa_gestor, data_remessa_upj
  ) VALUES (
    v_status, auth.uid(), v_nome, v_perfil,
    v_processo, v_vara, v_upj, NULLIF(p_dados->>'plataforma', ''),
    v_validacao_status,
    CASE WHEN v_validacao_status = 'nao_consultado' THEN NULL
         ELSE NULLIF(p_dados->>'validacao_djen_em', '')::timestamptz END,
    NULLIF(p_dados->>'validacao_djen_detalhe', ''),
    v_id_orgao, NULLIF(p_dados->>'nome_orgao_djen', ''),
    p_dados->>'tipo_solicitante', NULLIF(p_dados->>'descricao_solicitante', ''),
    NULLIF(p_dados->>'nome_solicitante', ''),
    v_categoria,
    p_dados->>'tipo_prioridade', NULLIF(p_dados->>'descricao_tipo_outros', ''),
    p_dados->>'evento_folha', p_dados->>'descricao_prioridade',
    NULLIF(p_dados->>'observacao_adicional_atende', ''),
    CASE WHEN v_status = 'gestor-conferencia' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'upj-pendente' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_id;

  IF v_status = 'gestor-conferencia' THEN
    SELECT * INTO v_conferente FROM public.prioridades_proximo_da_fila('atende', NULL);
    IF v_conferente.usuario_id IS NOT NULL THEN
      UPDATE public.prioridades_anotacoes
      SET conferente_vinculado_id = v_conferente.usuario_id,
          conferente_vinculado_nome = v_conferente.usuario_nome
      WHERE id = v_id;
    END IF;
  ELSIF v_upj IS NOT NULL THEN
    SELECT * INTO v_analista FROM public.prioridades_proximo_da_fila('upj', v_upj, v_categoria);
    IF v_analista.usuario_id IS NOT NULL THEN
      UPDATE public.prioridades_anotacoes
      SET analista_vinculado_id = v_analista.usuario_id,
          analista_vinculado_nome = v_analista.usuario_nome
      WHERE id = v_id;
    END IF;
  END IF;

  PERFORM public.prioridades_registrar_historico(
    v_id, NULL, v_status, 'criacao', p_dados->>'descricao_prioridade');

  PERFORM public.prioridades_recalcular_especiais(v_processo);

  RETURN jsonb_build_object('sucesso', true, 'anotacao_id', v_id, 'status', v_status);
END;
$$;

-- ── Conferência: permite alterar categoria ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_conferir(
  p_anotacao_id bigint,
  p_decisao text,
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
SET row_security = off
AS $$
DECLARE
  v_row public.prioridades_anotacoes%ROWTYPE;
  v_perfil public.prioridades_perfil_tipo;
  v_analista RECORD;
  v_upj uuid;
  v_novo_texto text;
  v_nova_categoria text;
  v_auditoria jsonb;
  v_observacao_final text;
  v_pode_decidir boolean;
BEGIN
  SELECT p.perfil INTO v_perfil
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  v_pode_decidir := COALESCE(
    v_perfil IN ('gestor', 'conferente')
    OR public.prioridades_designacao_ativa(ARRAY['gestor', 'conferente']::public.prioridades_perfil_tipo[]),
    false
  );

  IF NOT v_pode_decidir THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Apenas Gestor ou Conferente Designado pode conferir.');
  END IF;

  IF p_decisao IS NULL OR p_decisao NOT IN ('aprovar', 'devolver', 'rejeitar') THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', format('Decisão inválida: %s.', COALESCE(p_decisao, '(vazia)')));
  END IF;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação não encontrada.');
  END IF;
  IF v_row.status <> 'gestor-conferencia' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A anotação não está aguardando conferência.');
  END IF;

  IF v_perfil IS DISTINCT FROM 'gestor'
     AND NOT public.prioridades_designacao_ativa(ARRAY['gestor']::public.prioridades_perfil_tipo[])
     AND v_row.conferente_vinculado_id IS DISTINCT FROM auth.uid()
     AND v_row.criador_id IS DISTINCT FROM auth.uid()
     AND v_row.conferido_por_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Esta anotação está vinculada a outro Conferente.');
  END IF;

  v_nova_categoria := COALESCE(NULLIF(trim(p_alteracoes->>'categoria'), ''), v_row.categoria);
  IF v_nova_categoria IS NULL OR NOT (v_nova_categoria = ANY (public.prioridades_categorias_validas())) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Categoria da Anotação inválida ou ausente.');
  END IF;

  IF p_decisao = 'aprovar' THEN
    v_upj := COALESCE(NULLIF(p_alteracoes->>'upj_id', '')::uuid, v_row.upj_id);

    IF v_upj IS NULL THEN
      RETURN jsonb_build_object('sucesso', false,
        'erro', 'Defina a UPJ de destino antes de enviar.',
        'requer_upj', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.prioridades_upjs WHERE id = v_upj AND ativa) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'UPJ de destino inexistente ou inativa.');
    END IF;

    IF v_row.id_orgao_djen IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.prioridades_orgaos_upj o
        WHERE o.id_orgao_djen = v_row.id_orgao_djen AND o.ativo
      ) AND NOT EXISTS (
        SELECT 1 FROM public.prioridades_orgaos_upj o
        WHERE o.id_orgao_djen = v_row.id_orgao_djen AND o.ativo AND o.upj_id = v_upj
      ) THEN
        RETURN jsonb_build_object('sucesso', false,
          'erro', 'A UPJ escolhida não corresponde ao órgão publicado no DJEN para este processo.');
      END IF;
    END IF;
  END IF;

  IF p_decisao IN ('devolver', 'rejeitar') AND COALESCE(trim(p_justificativa), '') = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Justificativa é obrigatória.');
  END IF;

  IF p_decisao = 'devolver' AND COALESCE(p_correcao_automatica, false)
     AND COALESCE(trim(p_texto_correcao), '') = '' THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Informe o texto da correção automática.');
  END IF;

  v_novo_texto := COALESCE(NULLIF(p_alteracoes->>'descricao_prioridade', ''), v_row.descricao_prioridade);

  v_auditoria := jsonb_strip_nulls(jsonb_build_object(
    'descricao_anterior', CASE WHEN v_novo_texto IS DISTINCT FROM v_row.descricao_prioridade
                               THEN v_row.descricao_prioridade END,
    'categoria_anterior', CASE WHEN v_nova_categoria IS DISTINCT FROM v_row.categoria
                               THEN v_row.categoria END,
    'categoria_nova', CASE WHEN v_nova_categoria IS DISTINCT FROM v_row.categoria
                           THEN v_nova_categoria END,
    'motivo', NULLIF(p_alteracoes->>'observacao_adicional_gestor', '')
  ));

  v_observacao_final := NULLIF(p_alteracoes->>'observacao_adicional_gestor', '');
  IF v_novo_texto IS DISTINCT FROM v_row.descricao_prioridade THEN
    v_observacao_final := concat_ws(
      E'\n\n',
      v_observacao_final,
      format('Texto original (preservado na conferência de %s):%s%s',
             to_char(now(), 'DD/MM/YYYY HH24:MI'),
             E'\n',
             v_row.descricao_prioridade)
    );
  END IF;

  UPDATE public.prioridades_anotacoes
  SET descricao_prioridade = v_novo_texto,
      evento_folha = COALESCE(NULLIF(p_alteracoes->>'evento_folha', ''), evento_folha),
      categoria = v_nova_categoria,
      observacao_adicional_gestor = COALESCE(v_observacao_final, observacao_adicional_gestor),
      conferido_por_id = auth.uid(),
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  IF p_decisao = 'aprovar' THEN
    IF v_upj IS DISTINCT FROM v_row.upj_id THEN
      UPDATE public.prioridades_anotacoes SET upj_id = v_upj WHERE id = p_anotacao_id;
    END IF;

    UPDATE public.prioridades_anotacoes
    SET urgentissimo = COALESCE(p_urgentissimo, false),
        data_remessa_upj = now(),
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-conferencia', 'gestor-aprovada', 'aprovacao',
      CASE WHEN v_auditoria = '{}'::jsonb THEN NULL ELSE v_auditoria::text END);

    SELECT * INTO v_analista FROM public.prioridades_proximo_da_fila('upj', v_upj, v_nova_categoria);
    IF v_analista.usuario_id IS NOT NULL THEN
      UPDATE public.prioridades_anotacoes
      SET analista_vinculado_id = v_analista.usuario_id,
          analista_vinculado_nome = v_analista.usuario_nome
      WHERE id = p_anotacao_id;
    END IF;

    UPDATE public.prioridades_anotacoes
    SET status = 'upj-pendente', atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-aprovada', 'upj-pendente', 'remessa_upj', NULL);

    RETURN jsonb_build_object('sucesso', true, 'status', 'upj-pendente');
  END IF;

  IF p_decisao = 'devolver' THEN
    UPDATE public.prioridades_anotacoes
    SET status = 'gestor-devolvida',
        justificativa_devolucao_gestor = p_justificativa,
        correcao_automatica = COALESCE(p_correcao_automatica, false),
        texto_correcao_automatica = NULLIF(p_texto_correcao, ''),
        devolvida_por = 'gestor',
        data_devolucao = now(),
        prazo_resposta_em = now() + interval '24 hours',
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-conferencia', 'gestor-devolvida', 'devolucao_gestor', p_justificativa);

    RETURN jsonb_build_object('sucesso', true, 'status', 'gestor-devolvida',
                              'prazo_resposta_em', now() + interval '24 hours');
  END IF;

  UPDATE public.prioridades_anotacoes
  SET status = 'gestor-rejeitada',
      justificativa_rejeicao_gestor = p_justificativa,
      arquivamento_automatico = false,
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  PERFORM public.prioridades_registrar_historico(
    p_anotacao_id, 'gestor-conferencia', 'gestor-rejeitada', 'rejeicao_gestor', p_justificativa);

  RETURN jsonb_build_object('sucesso', true, 'status', 'gestor-rejeitada');
END;
$$;

-- ── Perfil: categorias habilitadas do analista ─────────────────────────────

DROP FUNCTION IF EXISTS public.prioridades_meu_perfil();

CREATE FUNCTION public.prioridades_meu_perfil()
RETURNS TABLE (
  usuario_id uuid,
  perfil public.prioridades_perfil_tipo,
  upj_id uuid,
  vinculacao_automatica boolean,
  categorias_habilitadas text[],
  ver_somente_vinculadas boolean,
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
    p.categorias_habilitadas,
    p.ver_somente_vinculadas,
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

REVOKE ALL ON FUNCTION public.prioridades_meu_perfil() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_meu_perfil() TO authenticated;

CREATE OR REPLACE FUNCTION public.prioridades_atualizar_categorias_habilitadas(
  p_usuario_id uuid,
  p_categorias text[]
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
  v_perfil_alvo public.prioridades_perfil_tipo;
  v_upj_alvo uuid;
  v_cat text;
  v_normalizado text[] := ARRAY[]::text[];
BEGIN
  v_eh_gestor := COALESCE(public.prioridades_sou_gestor(), false);

  SELECT COALESCE(
           EXISTS (
             SELECT 1 FROM public.prioridades_usuarios_perfil p
             WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'coordenador'
           )
           OR public.prioridades_designacao_ativa(ARRAY['coordenador']::public.prioridades_perfil_tipo[]),
           false)
  INTO v_eh_coordenador;

  IF NOT (COALESCE(v_eh_gestor, false) OR COALESCE(v_eh_coordenador, false)) THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Sem permissão para alterar categorias habilitadas.');
  END IF;

  SELECT p.perfil, p.upj_id INTO v_perfil_alvo, v_upj_alvo
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = p_usuario_id AND p.ativo;

  IF v_perfil_alvo IS DISTINCT FROM 'analista' THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Categorias habilitadas aplicam-se apenas a Analistas Designados.');
  END IF;

  IF v_eh_coordenador AND NOT v_eh_gestor THEN
    IF v_upj_alvo IS DISTINCT FROM public.prioridades_minha_upj() THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário de outra UPJ.');
    END IF;
  END IF;

  FOREACH v_cat IN ARRAY COALESCE(p_categorias, ARRAY[]::text[])
  LOOP
    IF NOT (v_cat = ANY (public.prioridades_categorias_validas())) THEN
      RETURN jsonb_build_object('sucesso', false,
        'erro', format('Categoria inválida: %s', v_cat));
    END IF;
    IF NOT (v_cat = ANY (v_normalizado)) THEN
      v_normalizado := array_append(v_normalizado, v_cat);
    END IF;
  END LOOP;

  UPDATE public.prioridades_usuarios_perfil
  SET categorias_habilitadas = v_normalizado,
      atualizado_em = now()
  WHERE usuario_id = p_usuario_id;

  RETURN jsonb_build_object('sucesso', true, 'categorias_habilitadas', v_normalizado);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_atualizar_categorias_habilitadas(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_atualizar_categorias_habilitadas(uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.prioridades_listar_categorias_analistas()
RETURNS TABLE (usuario_id uuid, categorias_habilitadas text[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_eh_gestor boolean;
  v_eh_coordenador boolean;
  v_upj uuid;
BEGIN
  v_eh_gestor := COALESCE(public.prioridades_sou_gestor(), false);
  v_eh_coordenador := COALESCE(
    EXISTS (
      SELECT 1 FROM public.prioridades_usuarios_perfil p
      WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'coordenador'
    )
    OR public.prioridades_designacao_ativa(ARRAY['coordenador']::public.prioridades_perfil_tipo[]),
    false
  );

  IF NOT (v_eh_gestor OR v_eh_coordenador) THEN
    RETURN;
  END IF;

  v_upj := public.prioridades_minha_upj();

  RETURN QUERY
  SELECT p.usuario_id, p.categorias_habilitadas
  FROM public.prioridades_usuarios_perfil p
  WHERE p.ativo
    AND p.perfil = 'analista'
    AND (v_eh_gestor OR p.upj_id = v_upj);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_listar_categorias_analistas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_listar_categorias_analistas() TO authenticated;

REVOKE ALL ON FUNCTION public.prioridades_pode_ver(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_pode_ver(bigint) TO authenticated;

REVOKE ALL ON FUNCTION public.prioridades_criar_anotacao(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_criar_anotacao(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.prioridades_conferir(bigint, text, text, boolean, boolean, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_conferir(bigint, text, text, boolean, boolean, text, jsonb) TO authenticated;

COMMIT;

-- Prioridades e Urgências — reclassificação decidida pela área (out/2026).
--
-- O que esta migration fecha, a partir de
-- "Novas Especificações - Prioridades e Urgências":
--   * Reiterada e Urgentíssima automática são marcas cumulativas, não status
--     exclusivos. O status operacional continua sendo o de transição ou o final.
--   * Prazo de 24 h (PD-01, opção ideal): a contagem pausa o dia inteiro em
--     sábado, domingo e nos dias cadastrados em Configurações. Prazos já
--     gravados NÃO são recalculados (PD-14).
--   * Rejeição automática (PD-07): se a UPJ retorna a anotação com a marca e o
--     Gestor não corrige no prazo, o sistema rejeita pela UPJ.
--   * Conferente vê só o que lhe foi vinculado. O rodízio passa a incluir
--     designações, não apenas o perfil base.
--   * Log de leitura privilegiada do admin (PD-13, opção A), só escrita.
--
-- Não mexe em DataJud nem na pesquisa de processos.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Colunas e tabelas
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.prioridades_anotacoes
  ADD COLUMN IF NOT EXISTS nome_solicitante text,
  ADD COLUMN IF NOT EXISTS reiterada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgentissimo_auto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejeicao_automatica boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.prioridades_anotacoes.reiterada IS
  'Marca cumulativa. Verdadeira enquanto o processo tem 2 ou mais anotações em andamento.';
COMMENT ON COLUMN public.prioridades_anotacoes.urgentissimo_auto IS
  'Marca cumulativa objetiva. Verdadeira enquanto o processo tem 3 ou mais anotações em andamento. Não apaga a marcação manual (urgentissimo).';
COMMENT ON COLUMN public.prioridades_anotacoes.rejeicao_automatica IS
  'PD-07. Quando a UPJ retorna a anotação com esta marca, o vencimento do prazo rejeita pela UPJ se o Gestor não corrigir.';
COMMENT ON COLUMN public.prioridades_anotacoes.nome_solicitante IS
  'PD-08. Opcional. Só é preenchido se o Atendente pedir o campo na tela.';

ALTER TABLE public.prioridades_usuarios_perfil
  ADD COLUMN IF NOT EXISTS ver_somente_vinculadas boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.prioridades_usuarios_perfil.ver_somente_vinculadas IS
  'Preferência do Gestor: nas listas Ag. Conferência e Retornadas, mostrar só as anotações vinculadas a ele.';

CREATE TABLE IF NOT EXISTS public.prioridades_dias_sem_expediente (
  data        date PRIMARY KEY,
  descricao   text NOT NULL,
  origem      text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'escala')),
  criado_por  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.prioridades_dias_sem_expediente IS
  'PD-01. Dias em que a contagem do prazo de 24 h fica suspensa, além dos fins de semana. Mantido pelos Gestores em Configurações.';

CREATE TABLE IF NOT EXISTS public.prioridades_regras_especiais (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upj_id          uuid NOT NULL REFERENCES public.prioridades_upjs(id) ON DELETE CASCADE,
  tipo_prioridade text NOT NULL,
  texto           text NOT NULL,
  atualizado_por  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prioridades_regras_especiais_unica UNIQUE (upj_id, tipo_prioridade)
);

COMMENT ON TABLE public.prioridades_regras_especiais IS
  'Uma regra especial por tipo de prioridade e por UPJ. Exibida em modal ao Atendente depois da seleção do tipo.';

CREATE TABLE IF NOT EXISTS public.prioridades_log_acessos (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  anotacao_id bigint NOT NULL REFERENCES public.prioridades_anotacoes(id) ON DELETE CASCADE,
  usuario_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prioridades_log_acessos_anotacao_idx
  ON public.prioridades_log_acessos (anotacao_id, criado_em DESC);

COMMENT ON TABLE public.prioridades_log_acessos IS
  'PD-13 opção A. Só o sistema insere. Registra quando um admin abre anotação de outro usuário. Sem política de leitura: quem consulta e por quanto tempo guardar ainda não foi decidido.';

ALTER TABLE public.prioridades_dias_sem_expediente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prioridades_regras_especiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prioridades_log_acessos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.prioridades_dias_sem_expediente FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.prioridades_regras_especiais FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.prioridades_log_acessos FROM PUBLIC, anon, authenticated;

-- Carga inicial a partir do calendário já mantido no módulo Escala, quando existir.
-- O Gestor segue podendo incluir e remover dias em Configurações.
DO $$
BEGIN
  IF to_regclass('public.escala_agenda_institucional') IS NOT NULL THEN
    INSERT INTO public.prioridades_dias_sem_expediente (data, descricao, origem, criado_por)
    SELECT g.d::date,
           left(e.titulo, 200),
           'escala',
           e.criado_por
    FROM public.escala_agenda_institucional e
    CROSS JOIN LATERAL generate_series(e.data_inicio, e.data_fim, interval '1 day') AS g(d)
    WHERE e.tipo IN ('feriado', 'emenda', 'recesso')
    ON CONFLICT (data) DO NOTHING;
  END IF;
END $$;

-- Status que deixaram de ser estado de repouso.
-- gestor-aprovada: a aprovação já equivale a Nova (PD-04).
-- upj-reiterada: a reiteração passou a ser marca cumulativa.
UPDATE public.prioridades_anotacoes
SET status = 'upj-pendente',
    atualizado_em = now()
WHERE status = 'gestor-aprovada';

UPDATE public.prioridades_anotacoes
SET status = 'upj-pendente',
    reiterada = true,
    atualizado_em = now()
WHERE status = 'upj-reiterada';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Prazo de 24 h com pausa em fim de semana e dia sem expediente
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_prazo_24h(p_inicio timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_cursor timestamptz := p_inicio;
  v_restante interval := interval '24 hours';
  v_data date;
  v_proximo timestamptz;
  v_disponivel interval;
  v_guard integer := 0;
BEGIN
  -- O relógio corre 24 h, mas o dia inteiro não conta quando é sábado, domingo
  -- ou está em prioridades_dias_sem_expediente. O fuso é o de São Paulo:
  -- "sexta" e "feriado" são dias civis da unidade, não do servidor.
  WHILE v_restante > interval '0 seconds' LOOP
    v_guard := v_guard + 1;
    IF v_guard > 800 THEN
      RAISE EXCEPTION 'prioridades_prazo_24h: não foi possível achar dia com expediente';
    END IF;

    v_data := (v_cursor AT TIME ZONE 'America/Sao_Paulo')::date;

    IF EXTRACT(DOW FROM v_data) IN (0, 6)
       OR EXISTS (
         SELECT 1 FROM public.prioridades_dias_sem_expediente d WHERE d.data = v_data
       )
    THEN
      v_cursor := ((v_data + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');
    ELSE
      v_proximo := ((v_data + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');
      v_disponivel := v_proximo - v_cursor;
      IF v_disponivel >= v_restante THEN
        RETURN v_cursor + v_restante;
      END IF;
      v_restante := v_restante - v_disponivel;
      v_cursor := v_proximo;
    END IF;
  END LOOP;

  RETURN v_cursor;
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_prazo_24h(timestamptz) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Marcas cumulativas: Reiterada (2+) e Urgentíssima automática (3+)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_recalcular_especiais(p_processo text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_n integer;
BEGIN
  IF COALESCE(p_processo, '') = '' THEN
    RETURN;
  END IF;

  -- Em andamento: Ag. Conferência, Devolvida, Retornada, Nova, Em Análise.
  -- Finais (Reprovada, Resolvida, Rejeitada) não entram na conta.
  SELECT count(*)::integer INTO v_n
  FROM public.prioridades_anotacoes
  WHERE processo = p_processo
    AND status IN (
      'gestor-conferencia', 'gestor-devolvida', 'upj-devolvida',
      'upj-pendente', 'upj-analisada'
    );

  UPDATE public.prioridades_anotacoes
  SET reiterada = (v_n >= 2),
      urgentissimo_auto = (v_n >= 3),
      atualizado_em = now()
  WHERE processo = p_processo
    AND status IN (
      'gestor-conferencia', 'gestor-devolvida', 'upj-devolvida',
      'upj-pendente', 'upj-analisada'
    )
    AND (reiterada IS DISTINCT FROM (v_n >= 2)
         OR urgentissimo_auto IS DISTINCT FROM (v_n >= 3));

  UPDATE public.prioridades_anotacoes
  SET reiterada = false,
      urgentissimo_auto = false,
      atualizado_em = now()
  WHERE processo = p_processo
    AND status NOT IN (
      'gestor-conferencia', 'gestor-devolvida', 'upj-devolvida',
      'upj-pendente', 'upj-analisada'
    )
    AND (reiterada OR urgentissimo_auto);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_recalcular_especiais(text) FROM PUBLIC, anon, authenticated;

-- Recalcula o que já existe. Não altera prazo_resposta_em.
DO $$
DECLARE
  v_processo text;
BEGIN
  FOR v_processo IN
    SELECT DISTINCT processo FROM public.prioridades_anotacoes
  LOOP
    PERFORM public.prioridades_recalcular_especiais(v_processo);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Rodízio inclui designação, não só o perfil base
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_proximo_da_fila(
  p_escopo text,
  p_upj    uuid DEFAULT NULL
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

REVOKE ALL ON FUNCTION public.prioridades_proximo_da_fila(text, uuid) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Visibilidade
--    Conferente: só o que criou, o que lhe foi vinculado ou o que conferiu.
--    Gestor: enxerga a operação (a preferência "somente vinculadas" filtra
--    a exibição das duas filas, não a permissão).
--    Coordenador/Analista: somente a própria UPJ.
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
  v_uid uuid := auth.uid();
  v_perfil public.prioridades_perfil_tipo;
  v_upj uuid;
  v_row public.prioridades_anotacoes%ROWTYPE;
  v_eh_gestor boolean;
  v_eh_upj boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND role::text = 'admin') THEN
    RETURN TRUE;
  END IF;

  SELECT p.perfil, p.upj_id INTO v_perfil, v_upj
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = v_uid AND p.ativo;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_row.criador_id = v_uid
     OR v_row.conferente_vinculado_id = v_uid
     OR v_row.conferido_por_id = v_uid
     OR v_row.analista_vinculado_id = v_uid
     OR v_row.analisado_por_id = v_uid THEN
    RETURN TRUE;
  END IF;

  -- Perfil base de Gestor acompanha a operação inteira, mesmo que também
  -- tenha alguma designação antiga de UPJ.
  IF v_perfil = 'gestor' THEN
    RETURN TRUE;
  END IF;

  v_eh_upj := v_perfil IN ('coordenador', 'analista')
    OR public.prioridades_designacao_ativa(ARRAY['coordenador', 'analista']::public.prioridades_perfil_tipo[]);

  IF v_eh_upj THEN
    IF v_upj IS NULL THEN
      SELECT d.upj_id INTO v_upj
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
    RETURN v_upj IS NOT NULL AND v_row.upj_id = v_upj;
  END IF;

  v_eh_gestor := v_perfil = 'gestor'
    OR public.prioridades_designacao_ativa(ARRAY['gestor']::public.prioridades_perfil_tipo[]);

  -- Gestor acompanha a operação inteira. Conferente não entra aqui.
  IF v_eh_gestor THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_pode_ver(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_pode_ver(bigint) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Perfil: devolve a preferência de fila
-- ─────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.prioridades_meu_perfil();

CREATE FUNCTION public.prioridades_meu_perfil()
RETURNS TABLE (
  usuario_id uuid,
  perfil public.prioridades_perfil_tipo,
  upj_id uuid,
  vinculacao_automatica boolean,
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

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Criar anotação — nome do solicitante + marcas do processo
-- ─────────────────────────────────────────────────────────────────────────

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

  v_status := CASE WHEN v_perfil = 'gestor' THEN 'upj-pendente'::public.prioridades_status
                   ELSE 'gestor-conferencia'::public.prioridades_status END;

  INSERT INTO public.prioridades_anotacoes (
    status, criador_id, criador_nome, criador_perfil,
    processo, vara, upj_id, plataforma,
    validacao_djen_status, validacao_djen_em, validacao_djen_detalhe,
    id_orgao_djen, nome_orgao_djen,
    tipo_solicitante, descricao_solicitante, nome_solicitante,
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
    SELECT * INTO v_analista FROM public.prioridades_proximo_da_fila('upj', v_upj);
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

REVOKE ALL ON FUNCTION public.prioridades_criar_anotacao(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_criar_anotacao(jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Conferir — prazo pausável; aprovação segue direto para Nova
-- ─────────────────────────────────────────────────────────────────────────

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
  v_auditoria jsonb;
  v_observacao_final text;
  v_pode_decidir boolean;
  v_prazo timestamptz;
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
      'erro', 'Apenas Gestor ou Conferente Designado pode conferir. O acesso administrativo permite consultar, não decidir.');
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

  -- Conferente só decide o que lhe foi vinculado ou o que ele mesmo criou.
  IF v_perfil IS DISTINCT FROM 'gestor'
     AND NOT public.prioridades_designacao_ativa(ARRAY['gestor']::public.prioridades_perfil_tipo[])
     AND v_row.conferente_vinculado_id IS DISTINCT FROM auth.uid()
     AND v_row.criador_id IS DISTINCT FROM auth.uid()
     AND v_row.conferido_por_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Esta anotação está vinculada a outro Conferente.');
  END IF;

  IF p_decisao = 'aprovar' THEN
    v_upj := COALESCE(NULLIF(p_alteracoes->>'upj_id', '')::uuid, v_row.upj_id);

    IF v_upj IS NULL THEN
      RETURN jsonb_build_object('sucesso', false,
        'erro', 'Defina a UPJ de destino antes de enviar. Sem UPJ a anotação não é visível por nenhum cartório.',
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
    'descricao_nova', CASE WHEN v_novo_texto IS DISTINCT FROM v_row.descricao_prioridade
                           THEN v_novo_texto END,
    'evento_folha_anterior', CASE WHEN COALESCE(NULLIF(p_alteracoes->>'evento_folha', ''), v_row.evento_folha)
                                       IS DISTINCT FROM v_row.evento_folha
                                  THEN v_row.evento_folha END,
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
      observacao_adicional_gestor = COALESCE(v_observacao_final, observacao_adicional_gestor),
      conferido_por_id = auth.uid(),
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  IF p_decisao = 'aprovar' THEN
    IF v_upj IS DISTINCT FROM v_row.upj_id THEN
      UPDATE public.prioridades_anotacoes SET upj_id = v_upj WHERE id = p_anotacao_id;
    END IF;

    -- A marcação manual não é apagada pelo critério automático.
    UPDATE public.prioridades_anotacoes
    SET urgentissimo = COALESCE(p_urgentissimo, false),
        data_remessa_upj = now(),
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-conferencia', 'gestor-aprovada', 'aprovacao',
      CASE WHEN v_auditoria = '{}'::jsonb THEN NULL ELSE v_auditoria::text END);

    SELECT * INTO v_analista FROM public.prioridades_proximo_da_fila('upj', v_upj);
    IF v_analista.usuario_id IS NOT NULL THEN
      UPDATE public.prioridades_anotacoes
      SET analista_vinculado_id = v_analista.usuario_id,
          analista_vinculado_nome = v_analista.usuario_nome
      WHERE id = p_anotacao_id;
    END IF;

    -- PD-04: aprovar não deixa a anotação parada em gestor-aprovada.
    -- O estado visto pela UPJ é Nova.
    UPDATE public.prioridades_anotacoes
    SET status = 'upj-pendente', atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-aprovada', 'upj-pendente', 'remessa_upj', NULL);

    PERFORM public.prioridades_recalcular_especiais(v_row.processo);

    RETURN jsonb_build_object('sucesso', true, 'status', 'upj-pendente');
  END IF;

  IF p_decisao = 'devolver' THEN
    v_prazo := public.prioridades_prazo_24h(now());

    UPDATE public.prioridades_anotacoes
    SET status = 'gestor-devolvida',
        justificativa_devolucao_gestor = p_justificativa,
        correcao_automatica = COALESCE(p_correcao_automatica, false),
        texto_correcao_automatica = NULLIF(p_texto_correcao, ''),
        devolvida_por = 'gestor',
        data_devolucao = now(),
        prazo_resposta_em = v_prazo,
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-conferencia', 'gestor-devolvida', 'devolucao_gestor', p_justificativa);

    PERFORM public.prioridades_recalcular_especiais(v_row.processo);

    RETURN jsonb_build_object('sucesso', true, 'status', 'gestor-devolvida',
                              'prazo_resposta_em', v_prazo);
  END IF;

  UPDATE public.prioridades_anotacoes
  SET status = 'gestor-rejeitada',
      justificativa_rejeicao_gestor = p_justificativa,
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  PERFORM public.prioridades_registrar_historico(
    p_anotacao_id, 'gestor-conferencia', 'gestor-rejeitada', 'rejeicao_gestor', p_justificativa);

  PERFORM public.prioridades_recalcular_especiais(v_row.processo);

  RETURN jsonb_build_object('sucesso', true, 'status', 'gestor-rejeitada');
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_conferir(bigint, text, text, boolean, boolean, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_conferir(bigint, text, text, boolean, boolean, text, jsonb)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Análise da UPJ — Em Análise também decide; Retornar pode engatilhar
--    rejeição automática
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_analisar(
  p_anotacao_id bigint,
  p_decisao text,
  p_observacao_upj text DEFAULT NULL,
  p_justificativa text DEFAULT NULL,
  p_arquivamento_automatico boolean DEFAULT false
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
  v_upj uuid;
  v_pode_decidir boolean;
  v_prazo timestamptz;
BEGIN
  SELECT p.perfil, p.upj_id INTO v_perfil, v_upj
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  SELECT public.prioridades_sou_upj() INTO v_pode_decidir;

  IF NOT COALESCE(v_pode_decidir, false) THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Apenas Coordenador ou Analista Designado pode analisar.');
  END IF;

  IF v_upj IS NULL THEN
    SELECT d.upj_id INTO v_upj
    FROM public.prioridades_designacoes d
    WHERE d.usuario_id = auth.uid()
      AND d.ativa
      AND d.perfil IN ('coordenador', 'analista')
      AND d.inicio_em <= CURRENT_DATE
      AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
      AND d.upj_id IS NOT NULL
    ORDER BY d.inicio_em DESC
    LIMIT 1;
  END IF;

  IF p_decisao IS NULL OR p_decisao NOT IN ('resolver', 'devolver', 'rejeitar') THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', format('Decisão inválida: %s.', COALESCE(p_decisao, '(vazia)')));
  END IF;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação não encontrada.');
  END IF;

  IF v_upj IS NULL OR v_row.upj_id IS DISTINCT FROM v_upj THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação de outra UPJ.');
  END IF;

  -- Nova ou Em Análise. Em Análise é a leitura, não o desfecho.
  IF v_row.status NOT IN ('upj-pendente', 'upj-analisada') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A anotação não está na fila da UPJ.');
  END IF;

  IF p_decisao = 'devolver' AND COALESCE(trim(p_justificativa), '') = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Justificativa é obrigatória para retornar.');
  END IF;
  IF p_decisao = 'rejeitar' AND COALESCE(trim(p_justificativa), '') = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Justificativa é obrigatória para rejeitar.');
  END IF;

  IF p_decisao = 'resolver' THEN
    UPDATE public.prioridades_anotacoes
    SET status = 'upj-resolvida',
        observacao_adicional_upj = NULLIF(p_observacao_upj, ''),
        analisado_por_id = auth.uid(),
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, v_row.status, 'upj-resolvida', 'resolucao_upj', p_observacao_upj);

    PERFORM public.prioridades_recalcular_especiais(v_row.processo);

    RETURN jsonb_build_object('sucesso', true, 'status', 'upj-resolvida');
  END IF;

  IF p_decisao = 'devolver' THEN
    v_prazo := public.prioridades_prazo_24h(now());

    UPDATE public.prioridades_anotacoes
    SET status = 'upj-devolvida',
        justificativa_devolucao_upj = p_justificativa,
        analisado_por_id = auth.uid(),
        devolvida_por = 'upj',
        data_devolucao = now(),
        prazo_resposta_em = v_prazo,
        -- O parâmetro histórico p_arquivamento_automatico passou a significar
        -- "rejeição automática" na ação Retornar.
        rejeicao_automatica = COALESCE(p_arquivamento_automatico, false),
        atualizado_em = now()
    WHERE id = p_anotacao_id;

    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, v_row.status, 'upj-devolvida', 'retorno_upj', p_justificativa);

    PERFORM public.prioridades_recalcular_especiais(v_row.processo);

    RETURN jsonb_build_object('sucesso', true, 'status', 'upj-devolvida',
                              'prazo_resposta_em', v_prazo);
  END IF;

  UPDATE public.prioridades_anotacoes
  SET status = 'upj-rejeitada',
      justificativa_rejeicao_upj = p_justificativa,
      analisado_por_id = auth.uid(),
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  PERFORM public.prioridades_registrar_historico(
    p_anotacao_id, v_row.status, 'upj-rejeitada', 'rejeicao_upj', p_justificativa);

  PERFORM public.prioridades_recalcular_especiais(v_row.processo);

  RETURN jsonb_build_object('sucesso', true, 'status', 'upj-rejeitada');
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_analisar(bigint, text, text, text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_analisar(bigint, text, text, text, boolean)
  TO authenticated;

-- Abrir uma anotação Nova marca Em Análise. Não é desfecho e não pede parecer.
CREATE OR REPLACE FUNCTION public.prioridades_marcar_em_analise(p_anotacao_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row public.prioridades_anotacoes%ROWTYPE;
  v_upj uuid;
  v_nome text;
BEGIN
  IF NOT COALESCE(public.prioridades_sou_upj(), false) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas a UPJ marca a leitura.');
  END IF;

  SELECT p.upj_id INTO v_upj
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  IF v_upj IS NULL THEN
    SELECT d.upj_id INTO v_upj
    FROM public.prioridades_designacoes d
    WHERE d.usuario_id = auth.uid()
      AND d.ativa
      AND d.perfil IN ('coordenador', 'analista')
      AND d.inicio_em <= CURRENT_DATE
      AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
      AND d.upj_id IS NOT NULL
    ORDER BY d.inicio_em DESC
    LIMIT 1;
  END IF;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação não encontrada.');
  END IF;

  IF v_upj IS NULL OR v_row.upj_id IS DISTINCT FROM v_upj THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação de outra UPJ.');
  END IF;

  IF v_row.status = 'upj-analisada' THEN
    RETURN jsonb_build_object('sucesso', true, 'status', 'upj-analisada');
  END IF;

  IF v_row.status <> 'upj-pendente' THEN
    RETURN jsonb_build_object('sucesso', true, 'status', v_row.status);
  END IF;

  SELECT u.nome INTO v_nome FROM public.users u WHERE u.id = auth.uid();

  UPDATE public.prioridades_anotacoes
  SET status = 'upj-analisada',
      analisado_por_id = COALESCE(analisado_por_id, auth.uid()),
      analisado_por_nome = COALESCE(analisado_por_nome, v_nome),
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  PERFORM public.prioridades_registrar_historico(
    p_anotacao_id, 'upj-pendente', 'upj-analisada', 'leitura_upj', NULL);

  RETURN jsonb_build_object('sucesso', true, 'status', 'upj-analisada');
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_marcar_em_analise(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_marcar_em_analise(bigint) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. Correção do Atendente volta a Ag. Conferência.
--     Correção do Gestor sobre Retornada volta como Nova.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_responder_devolucao(
  p_anotacao_id bigint,
  p_resposta text
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
  IF v_row.status = 'upj-devolvida' THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Anotação retornada pela UPJ é corrigida pelo Gestor, não pelo Atendente.');
  END IF;
  IF v_row.status <> 'gestor-devolvida' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A anotação não está devolvida pelo Gestor.');
  END IF;
  IF v_row.prazo_resposta_em IS NOT NULL AND now() > v_row.prazo_resposta_em THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prazo de resposta encerrado.');
  END IF;

  UPDATE public.prioridades_anotacoes
  SET status = 'gestor-conferencia',
      resposta_atendente = p_resposta,
      respondida_em = now(),
      data_remessa_gestor = now(),
      prazo_resposta_em = NULL,
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  PERFORM public.prioridades_registrar_historico(
    p_anotacao_id, v_row.status, 'gestor-conferencia', 'resposta_devolucao', p_resposta);

  PERFORM public.prioridades_recalcular_especiais(v_row.processo);

  RETURN jsonb_build_object('sucesso', true, 'status', 'gestor-conferencia');
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_responder_devolucao(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_responder_devolucao(bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.prioridades_corrigir_retornada(
  p_anotacao_id bigint,
  p_descricao text DEFAULT NULL
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
  v_eh_gestor boolean;
  v_eh_conferente boolean;
  v_texto text;
  v_obs text;
BEGIN
  SELECT p.perfil INTO v_perfil
  FROM public.prioridades_usuarios_perfil p
  WHERE p.usuario_id = auth.uid() AND p.ativo;

  v_eh_gestor := COALESCE(
    v_perfil = 'gestor'
    OR public.prioridades_designacao_ativa(ARRAY['gestor']::public.prioridades_perfil_tipo[]),
    false
  );
  v_eh_conferente := COALESCE(
    v_perfil = 'conferente'
    OR public.prioridades_designacao_ativa(ARRAY['conferente']::public.prioridades_perfil_tipo[]),
    false
  );

  IF NOT (v_eh_gestor OR v_eh_conferente) THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Apenas Gestor ou Conferente Designado corrige anotação retornada.');
  END IF;

  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação não encontrada.');
  END IF;
  IF v_row.status <> 'upj-devolvida' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A anotação não está retornada pela UPJ.');
  END IF;

  IF NOT v_eh_gestor
     AND v_row.conferente_vinculado_id IS DISTINCT FROM auth.uid()
     AND v_row.conferido_por_id IS DISTINCT FROM auth.uid()
     AND v_row.criador_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Esta anotação retornada está vinculada a outra pessoa.');
  END IF;

  v_texto := COALESCE(NULLIF(trim(p_descricao), ''), v_row.descricao_prioridade);
  v_obs := v_row.observacao_adicional_gestor;
  IF v_texto IS DISTINCT FROM v_row.descricao_prioridade THEN
    v_obs := concat_ws(
      E'\n\n',
      v_obs,
      format('Texto anterior à correção do retorno (%s):%s%s',
             to_char(now(), 'DD/MM/YYYY HH24:MI'),
             E'\n',
             v_row.descricao_prioridade)
    );
  END IF;

  UPDATE public.prioridades_anotacoes
  SET status = 'upj-pendente',
      descricao_prioridade = v_texto,
      observacao_adicional_gestor = v_obs,
      data_remessa_upj = now(),
      prazo_resposta_em = NULL,
      rejeicao_automatica = false,
      conferido_por_id = auth.uid(),
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  PERFORM public.prioridades_registrar_historico(
    p_anotacao_id, 'upj-devolvida', 'upj-pendente', 'correcao_retorno', v_texto);

  PERFORM public.prioridades_recalcular_especiais(v_row.processo);

  RETURN jsonb_build_object('sucesso', true, 'status', 'upj-pendente');
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_corrigir_retornada(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_corrigir_retornada(bigint, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 11. Vencimento do prazo
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
  v_permitido := auth.uid() IS NULL
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'admin')
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
    IF v_row.status = 'upj-devolvida' THEN
      -- Sem a marca, a anotação permanece Retornada até o Gestor corrigir.
      IF NOT v_row.rejeicao_automatica THEN
        CONTINUE;
      END IF;

      UPDATE public.prioridades_anotacoes
      SET status = 'upj-rejeitada',
          justificativa_rejeicao_upj = COALESCE(
            justificativa_rejeicao_upj,
            'Prazo de 24 h encerrado sem correção do Gestor. Rejeição automática da UPJ.'
          ),
          atualizado_em = now()
      WHERE id = v_row.id;

      INSERT INTO public.prioridades_anotacoes_historico
        (anotacao_id, status_anterior, status_novo, evento, autor_nome, conteudo)
      VALUES (
        v_row.id, v_row.status, 'upj-rejeitada', 'rejeicao_automatica_prazo',
        'sistema',
        'Prazo de 24 h encerrado sem correção do Gestor. Rejeição automática da UPJ.'
      );

      PERFORM public.prioridades_recalcular_especiais(v_row.processo);
      v_rejeitadas := v_rejeitadas + 1;
      CONTINUE;
    END IF;

    IF v_row.correcao_automatica THEN
      UPDATE public.prioridades_anotacoes
      SET status = 'upj-pendente',
          descricao_prioridade = COALESCE(v_row.texto_correcao_automatica, v_row.descricao_prioridade),
          observacao_adicional_gestor = COALESCE(v_row.observacao_adicional_gestor,
                                                 v_row.descricao_prioridade),
          resposta_atendente = NULL, respondida_em = NULL,
          data_remessa_upj = now(),
          prazo_resposta_em = NULL,
          atualizado_em = now()
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

      PERFORM public.prioridades_recalcular_especiais(v_row.processo);
      v_corrigidas := v_corrigidas + 1;
    ELSE
      v_novo := 'gestor-rejeitada';

      UPDATE public.prioridades_anotacoes
      SET status = v_novo,
          justificativa_rejeicao_gestor = COALESCE(
            justificativa_rejeicao_gestor,
            'Prazo de 24 h expirado sem resposta do Atendente.'
          ),
          atualizado_em = now()
      WHERE id = v_row.id;

      INSERT INTO public.prioridades_anotacoes_historico
        (anotacao_id, status_anterior, status_novo, evento, autor_nome, conteudo)
      VALUES (v_row.id, v_row.status, v_novo, 'rejeicao_automatica_prazo',
              'sistema', 'Prazo de 24 h expirado sem resposta do Atendente.');

      PERFORM public.prioridades_recalcular_especiais(v_row.processo);
      v_rejeitadas := v_rejeitadas + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('sucesso', true, 'rejeitadas', v_rejeitadas,
                            'correcoes_aplicadas', v_corrigidas);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_processar_prazos_vencidos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prioridades_processar_prazos_vencidos() TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 12. Log de acesso privilegiado e Configurações
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_registrar_acesso_privilegiado(p_anotacao_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_criador uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('sucesso', false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'admin') THEN
    RETURN jsonb_build_object('sucesso', true, 'registrado', false);
  END IF;

  SELECT a.criador_id INTO v_criador
  FROM public.prioridades_anotacoes a
  WHERE a.id = p_anotacao_id;

  IF v_criador IS NULL OR v_criador = auth.uid() THEN
    RETURN jsonb_build_object('sucesso', true, 'registrado', false);
  END IF;

  INSERT INTO public.prioridades_log_acessos (anotacao_id, usuario_id)
  VALUES (p_anotacao_id, auth.uid());

  RETURN jsonb_build_object('sucesso', true, 'registrado', true);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_registrar_acesso_privilegiado(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_registrar_acesso_privilegiado(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.prioridades_sou_gestor_base()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'gestor'
  );
$$;

REVOKE ALL ON FUNCTION public.prioridades_sou_gestor_base() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prioridades_dias_listar()
RETURNS TABLE (data date, descricao text, origem text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NOT public.prioridades_sou_gestor_base() THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT d.data, d.descricao, d.origem
    FROM public.prioridades_dias_sem_expediente d
    ORDER BY d.data;
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_dias_listar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_dias_listar() TO authenticated;

CREATE OR REPLACE FUNCTION public.prioridades_dia_incluir(p_data date, p_descricao text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NOT public.prioridades_sou_gestor_base() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas o Gestor altera o calendário.');
  END IF;
  IF p_data IS NULL OR COALESCE(trim(p_descricao), '') = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Informe a data e a descrição.');
  END IF;

  INSERT INTO public.prioridades_dias_sem_expediente (data, descricao, origem, criado_por)
  VALUES (p_data, trim(p_descricao), 'manual', auth.uid())
  ON CONFLICT (data) DO UPDATE
  SET descricao = EXCLUDED.descricao,
      origem = 'manual',
      criado_por = EXCLUDED.criado_por;

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_dia_incluir(date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_dia_incluir(date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.prioridades_dia_remover(p_data date)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NOT public.prioridades_sou_gestor_base() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas o Gestor altera o calendário.');
  END IF;

  DELETE FROM public.prioridades_dias_sem_expediente WHERE data = p_data;
  RETURN jsonb_build_object('sucesso', true);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_dia_remover(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_dia_remover(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.prioridades_regras_listar()
RETURNS TABLE (id uuid, upj_id uuid, tipo_prioridade text, texto text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT r.id, r.upj_id, r.tipo_prioridade, r.texto
    FROM public.prioridades_regras_especiais r
    ORDER BY r.tipo_prioridade;
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_regras_listar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_regras_listar() TO authenticated;

CREATE OR REPLACE FUNCTION public.prioridades_regra_salvar(
  p_upj_id uuid,
  p_tipo text,
  p_texto text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NOT public.prioridades_sou_gestor_base() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas o Gestor cadastra regras especiais.');
  END IF;
  IF p_upj_id IS NULL OR COALESCE(trim(p_tipo), '') = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Informe a UPJ e o tipo.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.prioridades_upjs WHERE id = p_upj_id AND ativa) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'UPJ inexistente ou inativa.');
  END IF;

  IF COALESCE(trim(p_texto), '') = '' THEN
    DELETE FROM public.prioridades_regras_especiais
    WHERE upj_id = p_upj_id AND tipo_prioridade = p_tipo;
    RETURN jsonb_build_object('sucesso', true, 'removida', true);
  END IF;

  INSERT INTO public.prioridades_regras_especiais (upj_id, tipo_prioridade, texto, atualizado_por)
  VALUES (p_upj_id, p_tipo, trim(p_texto), auth.uid())
  ON CONFLICT (upj_id, tipo_prioridade) DO UPDATE
  SET texto = EXCLUDED.texto,
      atualizado_por = EXCLUDED.atualizado_por,
      atualizado_em = now();

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_regra_salvar(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_regra_salvar(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.prioridades_definir_visao_fila(p_somente_vinculadas boolean)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NOT public.prioridades_sou_gestor_base() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas o Gestor altera esta preferência.');
  END IF;

  UPDATE public.prioridades_usuarios_perfil
  SET ver_somente_vinculadas = COALESCE(p_somente_vinculadas, false),
      atualizado_em = now()
  WHERE usuario_id = auth.uid() AND ativo AND perfil = 'gestor';

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_definir_visao_fila(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_definir_visao_fila(boolean) TO authenticated;

COMMIT;

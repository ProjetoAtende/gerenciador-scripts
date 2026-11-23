-- ════════════════════════════════════════════════════════════════════════════
-- Prioridades e Urgências — v2, etapa 2 (funcionalidades novas e correções)
--
-- Regra do projeto: v1 e v2 usam o MESMO banco. Esta migration é ADITIVA:
--   - colunas novas, opcionais (a v1 as ignora);
--   - funções novas com prefixo prioridades_v2_ (a v1 continua com as dela);
--   - tabela nova de regras especiais por categoria (a v1 continua com a antiga);
--   - GRANT explícito em tudo (projetos novos não dão permissão automática).
-- As únicas mudanças que a v1 também enxerga são as pedidas pelo Celso:
--   - textos dos tipos (itens J e K) e o tipo novo "Perito" (item L);
--   - o nome de quem conferiu passa a ser gravado (item H), por gatilho.
--
-- Itens (lista do Celso, 22/11/2026):
--   A/C  competência pelo órgão atual + exceção do Gestor   → prioridades_v2_competencia,
--        prioridades_v2_criar_anotacao, prioridades_v2_completar_vara
--   B    Coordenador designa Analistas da própria UPJ       → prioridades_v2_designar
--   D    Gestor marca Urgentíssima ao criar                 → prioridades_v2_criar_anotacao
--   E    resposta da UPJ nas anotações anteriores           → prioridades_v2_anteriores
--   F    regras especiais por UPJ + categoria + tipo        → prioridades_regras_especiais_v2
--   G    Descrição Resumida (opcional, 100 caracteres)      → coluna descricao_resumida
--   H    nome de quem conferiu                               → gatilho
--   J/K/L textos dos tipos e tipo novo                      → prioridades_tipos_prioridade
--   N    Gestor/Conferente altera os campos na conferência  → prioridades_v2_conferir
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Colunas novas (todas opcionais)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.prioridades_anotacoes
  ADD COLUMN IF NOT EXISTS descricao_resumida text,
  ADD COLUMN IF NOT EXISTS vara_fonte text,
  ADD COLUMN IF NOT EXISTS competencia_excecao text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prioridades_anotacoes_descricao_resumida_chk') THEN
    ALTER TABLE public.prioridades_anotacoes
      ADD CONSTRAINT prioridades_anotacoes_descricao_resumida_chk
      CHECK (descricao_resumida IS NULL OR char_length(descricao_resumida) <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prioridades_anotacoes_vara_fonte_chk') THEN
    ALTER TABLE public.prioridades_anotacoes
      ADD CONSTRAINT prioridades_anotacoes_vara_fonte_chk
      CHECK (vara_fonte IS NULL OR vara_fonte IN ('datajud', 'djen', 'atendente', 'gestor'));
  END IF;
END $$;

COMMENT ON COLUMN public.prioridades_anotacoes.descricao_resumida IS
  'v2 (item G): título curto, opcional, até 100 caracteres. Preenchido pelo Atendente ou na conferência.';
COMMENT ON COLUMN public.prioridades_anotacoes.vara_fonte IS
  'v2: de onde veio a Vara (datajud, djen, atendente, gestor). Nulo nas anotações da v1.';
COMMENT ON COLUMN public.prioridades_anotacoes.competencia_excecao IS
  'v2 (item C): justificativa do Gestor ao enviar processo que o sistema não reconheceu como da competência.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Tipos de prioridade (J, K, L) — valem também para a v1, como pedido
-- ─────────────────────────────────────────────────────────────────────────

-- L: amplia a lista de códigos aceitos (só acrescenta 'prioridade-perito').
ALTER TABLE public.prioridades_anotacoes DROP CONSTRAINT IF EXISTS prioridades_anotacoes_tipo_prioridade_check;
ALTER TABLE public.prioridades_anotacoes ADD CONSTRAINT prioridades_anotacoes_tipo_prioridade_check
  CHECK (tipo_prioridade IN ('urgencia-determinada', 'prazo-excedido', 'fora-localizador',
                             'erro-material', 'medico-saude', 'prioridade-doenca',
                             'prioridade-pcd', 'prioridade-idoso', 'prioridade-perito', 'outros'));

-- J
UPDATE public.prioridades_tipos_prioridade
SET label = 'Possível erro material em peça processual', atualizado_em = now()
WHERE codigo = 'erro-material';

-- K (e os avisos que citam o nome antigo)
UPDATE public.prioridades_tipos_prioridade
SET label = 'Consta "URGENTE" OU "IMEDIATO" na determinação',
    aviso = replace(aviso, 'Sem menção expressa a "urgente"/"com urgência"',
                    'Sem menção expressa a "urgente", "com urgência", "imediato" ou "imediatamente"'),
    atualizado_em = now()
WHERE codigo = 'urgencia-determinada';

UPDATE public.prioridades_tipos_prioridade
SET aviso = replace(aviso, '"Consta ''URGENTE''..."', '"Consta ''URGENTE'' OU ''IMEDIATO''..."'),
    atualizado_em = now()
WHERE aviso LIKE '%Consta ''URGENTE''...%';

-- L: depois de "Idoso", antes de "Outros". Sem aviso por enquanto (decisão do Celso).
UPDATE public.prioridades_tipos_prioridade SET ordem = 10, atualizado_em = now()
WHERE codigo = 'outros' AND ordem < 10;

INSERT INTO public.prioridades_tipos_prioridade (codigo, label, ordem, aviso)
VALUES ('prioridade-perito', 'Tramitação prioritária – Perito', 9, NULL)
ON CONFLICT (codigo) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. H — nome de quem conferiu (vale para v1 e v2, sem mexer nas funções da v1)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_preencher_conferido_por_nome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.conferido_por_id IS NOT NULL
     AND (NEW.conferido_por_nome IS NULL OR NEW.conferido_por_id IS DISTINCT FROM OLD.conferido_por_id) THEN
    SELECT u.nome INTO NEW.conferido_por_nome FROM public.users u WHERE u.id = NEW.conferido_por_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_preencher_conferido_por_nome() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prioridades_conferido_por_nome ON public.prioridades_anotacoes;
CREATE TRIGGER prioridades_conferido_por_nome
  BEFORE UPDATE OF conferido_por_id ON public.prioridades_anotacoes
  FOR EACH ROW EXECUTE FUNCTION public.prioridades_preencher_conferido_por_nome();

-- Conferências antigas: preenche o nome a partir do cadastro.
UPDATE public.prioridades_anotacoes a
SET conferido_por_nome = u.nome
FROM public.users u
WHERE a.conferido_por_id = u.id
  AND a.conferido_por_nome IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Apoio: faixa de Varas de uma UPJ (código FCC-AA-BB)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_v2_vara_na_upj(p_vara integer, p_upj_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_vara IS NULL OR p_upj_id IS NULL THEN true
    ELSE COALESCE((
      SELECT p_vara BETWEEN split_part(u.codigo, '-', 2)::int AND split_part(u.codigo, '-', 3)::int
      FROM public.prioridades_upjs u
      WHERE u.id = p_upj_id AND u.codigo ~ '^FCC-\d{2}-\d{2}$'
    ), true)
  END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_v2_vara_na_upj(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_v2_vara_na_upj(integer, uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. A/C — competência pelo órgão onde o processo está hoje
-- ─────────────────────────────────────────────────────────────────────────
-- A v1 aceitava qualquer órgão com "Varas Cíveis" no nome (por isso aceitou o
-- 4189868-12.2026.8.26.0100, hoje em Santo Amaro) e recusava todo número sem final
-- 0100 (por isso recusou o 4000525-51.2026.8.26.0373, redistribuído à UPJ IX).
-- Aqui: órgão informado decide; sem órgão, decide o final do número.

CREATE OR REPLACE FUNCTION public.prioridades_v2_competencia(
  p_processo text,
  p_vara integer,
  p_nome_orgao text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_d text := regexp_replace(COALESCE(p_processo, ''), '\D', '', 'g');
  v_nome text := btrim(COALESCE(p_nome_orgao, ''));
BEGIN
  IF length(v_d) <> 20 OR substring(v_d FROM 14 FOR 3) <> '826' THEN
    RETURN false;
  END IF;
  IF p_vara IS NOT NULL AND (p_vara < 1 OR p_vara > 45) THEN
    RETURN false;
  END IF;

  IF v_nome <> '' THEN
    -- SAJ no Datajud: "07 CIVEL DE CENTRAL"
    IF v_nome ~* '^0*\d{1,2}\s+CIVEL\s+DE\s+CENTRAL$' THEN
      RETURN true;
    END IF;
    RETURN v_nome ~* 'Foro\s+Central\s+C[ií]vel'
       AND v_nome ~* '(Vara\s+C[ií]vel|Varas\s+(da\s+)?C[ií]veis)'
       AND v_nome !~* '(Regional|C[âa]mara|Turma|Desembargador|Gabinete)';
  END IF;

  RETURN substring(v_d FROM 17 FOR 4) = '0100';
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_v2_competencia(text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_v2_competencia(text, integer, text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Criação da anotação (v2) — cópia da v1 + C, D, G e Vara opcional
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prioridades_v2_criar_anotacao(p_dados jsonb)
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
  v_resumida text;
  v_excecao text;
  v_urgentissimo boolean;
  v_vara_fonte text;
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

  -- G: opcional, até 100 caracteres.
  v_resumida := NULLIF(btrim(COALESCE(p_dados->>'descricao_resumida', '')), '');
  IF v_resumida IS NOT NULL AND char_length(v_resumida) > 100 THEN
    v_pendentes := array_append(v_pendentes, 'Descrição Resumida (até 100 caracteres)');
  END IF;

  IF COALESCE(p_dados->>'plataforma', '') NOT IN ('', 'eproc', 'saj') THEN
    v_pendentes := array_append(v_pendentes, 'Sistema (use Eproc ou SAJ)');
  END IF;

  v_upj := NULLIF(p_dados->>'upj_id', '')::uuid;
  v_id_orgao := NULLIF(p_dados->>'id_orgao_djen', '')::bigint;
  v_vara := NULLIF(p_dados->>'vara', '')::integer;

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

  IF v_vara IS NOT NULL AND NOT public.prioridades_v2_vara_na_upj(v_vara, v_upj) THEN
    v_pendentes := array_append(v_pendentes, 'Vara (não pertence à UPJ de destino)');
  END IF;

  IF array_length(v_pendentes, 1) > 0 THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Preencha os campos obrigatórios.',
      'campos_pendentes', to_jsonb(v_pendentes));
  END IF;

  -- C: competência pelo órgão atual; fora dela, só o Gestor envia, com justificativa.
  v_excecao := NULLIF(btrim(COALESCE(p_dados->>'competencia_excecao', '')), '');
  IF public.prioridades_v2_competencia(v_processo, v_vara, NULLIF(p_dados->>'nome_orgao_djen', '')) THEN
    v_excecao := NULL;
  ELSIF v_perfil <> 'gestor' THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Este processo não está na competência do TJSP Atende (1ª a 45ª Varas Cíveis do Foro Central de São Paulo). Se ele foi redistribuído para cá, peça a um Gestor para registrá-lo.',
      'fora_competencia', true,
      'campos_pendentes', to_jsonb(ARRAY['N.º do Processo']));
  ELSIF v_excecao IS NULL THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Este processo não foi reconhecido como da competência do TJSP Atende. Para enviar mesmo assim, escreva a justificativa.',
      'fora_competencia', true,
      'pode_excecao', true);
  ELSIF v_upj IS NULL THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Preencha os campos obrigatórios.',
      'campos_pendentes', to_jsonb(ARRAY['UPJ de destino']));
  END IF;

  SELECT u.nome INTO v_nome FROM public.users u WHERE u.id = auth.uid();

  v_validacao_status := COALESCE(NULLIF(p_dados->>'validacao_djen_status', ''), 'nao_consultado');
  IF v_validacao_status NOT IN ('nao_consultado', 'localizado', 'sem_comunicacao', 'erro') THEN
    v_validacao_status := 'nao_consultado';
  END IF;
  IF v_validacao_status = 'localizado' AND v_id_orgao IS NULL THEN
    v_validacao_status := 'nao_consultado';
  END IF;

  v_vara_fonte := CASE WHEN v_vara IS NULL THEN NULL
                       WHEN p_dados->>'vara_fonte' IN ('datajud', 'djen') THEN p_dados->>'vara_fonte'
                       ELSE 'atendente' END;

  -- D: só o Gestor marca Urgentíssima ao criar (a anotação dele já vai direto à UPJ).
  v_urgentissimo := v_perfil = 'gestor' AND COALESCE((p_dados->>'urgentissimo')::boolean, false);

  v_status := CASE WHEN v_perfil = 'gestor' THEN 'upj-pendente'::public.prioridades_status
                   ELSE 'gestor-conferencia'::public.prioridades_status END;

  INSERT INTO public.prioridades_anotacoes (
    status, criador_id, criador_nome, criador_perfil,
    processo, vara, vara_fonte, upj_id, plataforma,
    validacao_djen_status, validacao_djen_em, validacao_djen_detalhe,
    id_orgao_djen, nome_orgao_djen,
    tipo_solicitante, descricao_solicitante, nome_solicitante,
    categoria,
    tipo_prioridade, descricao_tipo_outros,
    evento_folha, descricao_prioridade, descricao_resumida, observacao_adicional_atende,
    urgentissimo, competencia_excecao,
    data_remessa_gestor, data_remessa_upj
  ) VALUES (
    v_status, auth.uid(), v_nome, v_perfil,
    v_processo, v_vara, v_vara_fonte, v_upj, NULLIF(p_dados->>'plataforma', ''),
    v_validacao_status,
    CASE WHEN v_validacao_status = 'nao_consultado' THEN NULL
         ELSE NULLIF(p_dados->>'validacao_djen_em', '')::timestamptz END,
    NULLIF(p_dados->>'validacao_djen_detalhe', ''),
    v_id_orgao, NULLIF(p_dados->>'nome_orgao_djen', ''),
    p_dados->>'tipo_solicitante', NULLIF(p_dados->>'descricao_solicitante', ''),
    NULLIF(p_dados->>'nome_solicitante', ''),
    v_categoria,
    p_dados->>'tipo_prioridade', NULLIF(p_dados->>'descricao_tipo_outros', ''),
    p_dados->>'evento_folha', p_dados->>'descricao_prioridade', v_resumida,
    NULLIF(p_dados->>'observacao_adicional_atende', ''),
    v_urgentissimo, v_excecao,
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

  IF v_excecao IS NOT NULL THEN
    PERFORM public.prioridades_registrar_historico(
      v_id, v_status, v_status, 'excecao_competencia',
      'Enviada pelo Gestor fora da competência reconhecida pelo sistema. Justificativa: ' || v_excecao);
  END IF;

  PERFORM public.prioridades_recalcular_especiais(v_processo);

  RETURN jsonb_build_object('sucesso', true, 'anotacao_id', v_id, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_v2_criar_anotacao(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_v2_criar_anotacao(jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. A — Vara (e Sistema) completados depois do envio, pelo Datajud
-- ─────────────────────────────────────────────────────────────────────────
-- Chamada pela Edge Function prioridades-localizar com a sessão de quem criou a
-- anotação. Só preenche o que está VAZIO: nunca apaga o que alguém informou.

CREATE OR REPLACE FUNCTION public.prioridades_v2_completar_vara(
  p_anotacao_id bigint,
  p_vara integer,
  p_vara_fonte text DEFAULT 'datajud',
  p_plataforma text DEFAULT NULL
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
  v_vara integer;
  v_plataforma text;
BEGIN
  SELECT * INTO v_row FROM public.prioridades_anotacoes WHERE id = p_anotacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Anotação não encontrada.');
  END IF;
  IF v_row.criador_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Só quem criou a anotação pode completá-la.');
  END IF;

  v_vara := CASE WHEN v_row.vara IS NULL AND p_vara BETWEEN 1 AND 45
                      AND public.prioridades_v2_vara_na_upj(p_vara, v_row.upj_id)
                 THEN p_vara END;
  v_plataforma := CASE WHEN v_row.plataforma IS NULL AND p_plataforma IN ('eproc', 'saj')
                       THEN p_plataforma END;

  IF v_vara IS NULL AND v_plataforma IS NULL THEN
    RETURN jsonb_build_object('sucesso', true, 'alterou', false);
  END IF;

  UPDATE public.prioridades_anotacoes
  SET vara = COALESCE(v_vara, vara),
      vara_fonte = CASE WHEN v_vara IS NOT NULL
                        THEN CASE WHEN p_vara_fonte IN ('datajud', 'djen') THEN p_vara_fonte ELSE 'datajud' END
                        ELSE vara_fonte END,
      plataforma = COALESCE(v_plataforma, plataforma),
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  PERFORM public.prioridades_registrar_historico(
    p_anotacao_id, v_row.status, v_row.status, 'localizacao_completada',
    concat_ws(' · ',
      CASE WHEN v_vara IS NOT NULL THEN format('Vara identificada automaticamente: %sª', v_vara) END,
      CASE WHEN v_plataforma IS NOT NULL THEN format('Sistema: %s', CASE v_plataforma WHEN 'eproc' THEN 'Eproc' ELSE 'SAJ' END) END));

  RETURN jsonb_build_object('sucesso', true, 'alterou', true, 'vara', v_vara, 'plataforma', v_plataforma);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_v2_completar_vara(bigint, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_v2_completar_vara(bigint, integer, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Conferência (v2) — cópia da v1 + N (todos os campos do Atendente,
--    menos o número do processo) + G
-- ─────────────────────────────────────────────────────────────────────────
-- p_alteracoes: só as chaves PRESENTES são aplicadas; '' limpa um campo opcional.

CREATE OR REPLACE FUNCTION public.prioridades_v2_conferir(
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
  v_alt jsonb := COALESCE(p_alteracoes, '{}'::jsonb);
  v_novo_texto text;
  v_nova_categoria text;
  v_tipo_sol text;
  v_desc_sol text;
  v_nome_sol text;
  v_tipo_pri text;
  v_desc_outros text;
  v_plataforma text;
  v_vara integer;
  v_obs_atende text;
  v_resumida text;
  v_evento text;
  v_mudancas text[] := ARRAY[]::text[];
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
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas Gestor ou Conferente Designado pode conferir.');
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
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Esta anotação está vinculada a outro Conferente.');
  END IF;

  -- ── Valores finais (o que veio em p_alteracoes ou o que já estava) ──
  v_nova_categoria := COALESCE(NULLIF(trim(v_alt->>'categoria'), ''), v_row.categoria);
  IF v_nova_categoria IS NULL OR NOT (v_nova_categoria = ANY (public.prioridades_categorias_validas())) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Categoria da Anotação inválida ou ausente.');
  END IF;

  v_tipo_sol := COALESCE(NULLIF(trim(v_alt->>'tipo_solicitante'), ''), v_row.tipo_solicitante);
  IF NOT EXISTS (SELECT 1 FROM public.prioridades_tipos_solicitante t WHERE t.codigo = v_tipo_sol AND t.ativo) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Solicitante inválido.');
  END IF;
  v_desc_sol := CASE WHEN v_alt ? 'descricao_solicitante' THEN NULLIF(btrim(v_alt->>'descricao_solicitante'), '')
                     ELSE v_row.descricao_solicitante END;
  IF v_tipo_sol = 'outros' AND v_desc_sol IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Descreva o(s) Solicitante(s) quando o tipo for "Outros".');
  END IF;
  v_nome_sol := CASE WHEN v_alt ? 'nome_solicitante' THEN NULLIF(btrim(v_alt->>'nome_solicitante'), '')
                     ELSE v_row.nome_solicitante END;

  v_tipo_pri := COALESCE(NULLIF(trim(v_alt->>'tipo_prioridade'), ''), v_row.tipo_prioridade);
  IF NOT EXISTS (SELECT 1 FROM public.prioridades_tipos_prioridade t WHERE t.codigo = v_tipo_pri AND t.ativo) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Tipo de Prioridade/Urgência inválido.');
  END IF;
  v_desc_outros := CASE WHEN v_alt ? 'descricao_tipo_outros' THEN NULLIF(btrim(v_alt->>'descricao_tipo_outros'), '')
                        ELSE v_row.descricao_tipo_outros END;
  IF v_tipo_pri = 'outros' AND v_desc_outros IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Descreva o Tipo de Prioridade/Urgência quando for "Outros".');
  END IF;

  v_plataforma := CASE WHEN v_alt ? 'plataforma' THEN NULLIF(v_alt->>'plataforma', '') ELSE v_row.plataforma END;
  IF v_plataforma IS NOT NULL AND v_plataforma NOT IN ('eproc', 'saj') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Sistema inválido (use Eproc ou SAJ).');
  END IF;

  v_vara := CASE WHEN v_alt ? 'vara' THEN NULLIF(v_alt->>'vara', '')::integer ELSE v_row.vara END;
  IF v_vara IS NOT NULL AND (v_vara < 1 OR v_vara > 45) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Vara inválida (1ª a 45ª).');
  END IF;

  v_obs_atende := CASE WHEN v_alt ? 'observacao_adicional_atende' THEN NULLIF(btrim(v_alt->>'observacao_adicional_atende'), '')
                       ELSE v_row.observacao_adicional_atende END;

  v_resumida := CASE WHEN v_alt ? 'descricao_resumida' THEN NULLIF(btrim(v_alt->>'descricao_resumida'), '')
                     ELSE v_row.descricao_resumida END;
  IF v_resumida IS NOT NULL AND char_length(v_resumida) > 100 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A Descrição Resumida aceita até 100 caracteres.');
  END IF;

  v_evento := COALESCE(NULLIF(btrim(v_alt->>'evento_folha'), ''), v_row.evento_folha);
  v_novo_texto := COALESCE(NULLIF(v_alt->>'descricao_prioridade', ''), v_row.descricao_prioridade);

  IF p_decisao = 'aprovar' THEN
    v_upj := COALESCE(NULLIF(v_alt->>'upj_id', '')::uuid, v_row.upj_id);
    IF v_upj IS NULL THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Defina a UPJ de destino antes de enviar.', 'requer_upj', true);
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
    IF NOT public.prioridades_v2_vara_na_upj(v_vara, v_upj) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'A Vara informada não pertence à UPJ de destino.');
    END IF;
  END IF;

  IF p_decisao IN ('devolver', 'rejeitar') AND COALESCE(trim(p_justificativa), '') = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Justificativa é obrigatória.');
  END IF;
  IF p_decisao = 'devolver' AND COALESCE(p_correcao_automatica, false)
     AND COALESCE(trim(p_texto_correcao), '') = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Informe o texto da correção automática.');
  END IF;

  -- ── Registro legível do que mudou (vai para o histórico) ──
  IF v_tipo_sol IS DISTINCT FROM v_row.tipo_solicitante THEN
    v_mudancas := v_mudancas || format('Solicitante: %s → %s',
      (SELECT label FROM public.prioridades_tipos_solicitante WHERE codigo = v_row.tipo_solicitante),
      (SELECT label FROM public.prioridades_tipos_solicitante WHERE codigo = v_tipo_sol));
  END IF;
  IF v_desc_sol IS DISTINCT FROM v_row.descricao_solicitante THEN
    v_mudancas := v_mudancas || format('Descrição do Solicitante: "%s" → "%s"', COALESCE(v_row.descricao_solicitante, ''), COALESCE(v_desc_sol, ''));
  END IF;
  IF v_nome_sol IS DISTINCT FROM v_row.nome_solicitante THEN
    v_mudancas := v_mudancas || format('Nome do Solicitante: "%s" → "%s"', COALESCE(v_row.nome_solicitante, ''), COALESCE(v_nome_sol, ''));
  END IF;
  IF v_nova_categoria IS DISTINCT FROM v_row.categoria THEN
    v_mudancas := v_mudancas || format('Categoria: %s → %s', COALESCE(v_row.categoria, '—'), v_nova_categoria);
  END IF;
  IF v_tipo_pri IS DISTINCT FROM v_row.tipo_prioridade THEN
    v_mudancas := v_mudancas || format('Tipo: %s → %s',
      (SELECT label FROM public.prioridades_tipos_prioridade WHERE codigo = v_row.tipo_prioridade),
      (SELECT label FROM public.prioridades_tipos_prioridade WHERE codigo = v_tipo_pri));
  END IF;
  IF v_desc_outros IS DISTINCT FROM v_row.descricao_tipo_outros THEN
    v_mudancas := v_mudancas || format('Descrição do Tipo (Outros): "%s" → "%s"', COALESCE(v_row.descricao_tipo_outros, ''), COALESCE(v_desc_outros, ''));
  END IF;
  IF v_plataforma IS DISTINCT FROM v_row.plataforma THEN
    v_mudancas := v_mudancas || format('Sistema: %s → %s', COALESCE(v_row.plataforma, '—'), COALESCE(v_plataforma, '—'));
  END IF;
  IF v_vara IS DISTINCT FROM v_row.vara THEN
    v_mudancas := v_mudancas || format('Vara: %s → %s',
      COALESCE(v_row.vara::text || 'ª', '—'), COALESCE(v_vara::text || 'ª', '—'));
  END IF;
  IF v_evento IS DISTINCT FROM v_row.evento_folha THEN
    v_mudancas := v_mudancas || format('Evento/Folhas: "%s" → "%s"', v_row.evento_folha, v_evento);
  END IF;
  IF v_resumida IS DISTINCT FROM v_row.descricao_resumida THEN
    v_mudancas := v_mudancas || format('Descrição Resumida: "%s" → "%s"', COALESCE(v_row.descricao_resumida, ''), COALESCE(v_resumida, ''));
  END IF;
  IF v_obs_atende IS DISTINCT FROM v_row.observacao_adicional_atende THEN
    v_mudancas := array_append(v_mudancas, 'Observação do TJSP Atende alterada');
  END IF;
  IF v_novo_texto IS DISTINCT FROM v_row.descricao_prioridade THEN
    v_mudancas := array_append(v_mudancas, 'Descrição Detalhada alterada (texto original preservado na observação do Gestor)');
  END IF;

  v_observacao_final := NULLIF(v_alt->>'observacao_adicional_gestor', '');
  IF v_novo_texto IS DISTINCT FROM v_row.descricao_prioridade THEN
    v_observacao_final := concat_ws(
      E'\n\n',
      v_observacao_final,
      format('Texto original (preservado na conferência de %s):%s%s',
             to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), E'\n', v_row.descricao_prioridade));
  END IF;

  UPDATE public.prioridades_anotacoes
  SET descricao_prioridade = v_novo_texto,
      evento_folha = v_evento,
      categoria = v_nova_categoria,
      tipo_solicitante = v_tipo_sol,
      descricao_solicitante = v_desc_sol,
      nome_solicitante = v_nome_sol,
      tipo_prioridade = v_tipo_pri,
      descricao_tipo_outros = v_desc_outros,
      plataforma = v_plataforma,
      vara = v_vara,
      vara_fonte = CASE WHEN v_vara IS DISTINCT FROM v_row.vara
                        THEN CASE WHEN v_vara IS NULL THEN NULL ELSE 'gestor' END
                        ELSE vara_fonte END,
      observacao_adicional_atende = v_obs_atende,
      descricao_resumida = v_resumida,
      observacao_adicional_gestor = COALESCE(v_observacao_final, observacao_adicional_gestor),
      conferido_por_id = auth.uid(),
      conferido_por_nome = (SELECT u.nome FROM public.users u WHERE u.id = auth.uid()),
      atualizado_em = now()
  WHERE id = p_anotacao_id;

  IF array_length(v_mudancas, 1) > 0 THEN
    PERFORM public.prioridades_registrar_historico(
      p_anotacao_id, 'gestor-conferencia', 'gestor-conferencia', 'alteracao_conferencia',
      'Alterações na conferência: ' || array_to_string(v_mudancas, '; ')
        || COALESCE('. Motivo: ' || NULLIF(v_alt->>'observacao_adicional_gestor', ''), ''));
  END IF;

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
      p_anotacao_id, 'gestor-conferencia', 'gestor-aprovada', 'aprovacao', NULL);

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

    -- O tipo pode ter mudado: refaz as marcas automáticas do processo.
    PERFORM public.prioridades_recalcular_especiais(v_row.processo);

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

REVOKE ALL ON FUNCTION public.prioridades_v2_conferir(bigint, text, text, boolean, boolean, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_v2_conferir(bigint, text, text, boolean, boolean, text, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. E — anotações anteriores (120 dias) com a resposta da UPJ
-- ─────────────────────────────────────────────────────────────────────────
-- Mesma visibilidade da v1 (prioridades_pode_ver). O motivo da reprovação do
-- Gestor não vai para quem é da UPJ (eles não o veem na anotação).

CREATE OR REPLACE FUNCTION public.prioridades_v2_anteriores(p_processo text, p_dias integer DEFAULT 120)
RETURNS TABLE (
  id bigint,
  status public.prioridades_status,
  data_anotacao timestamptz,
  descricao_prioridade text,
  descricao_resumida text,
  criador_nome text,
  tipo_prioridade text,
  upj_codigo text,
  observacao_adicional_upj text,
  justificativa_devolucao_upj text,
  justificativa_rejeicao_upj text,
  justificativa_rejeicao_gestor text,
  data_resolucao_upj timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.status, a.data_anotacao, a.descricao_prioridade, a.descricao_resumida,
         a.criador_nome, a.tipo_prioridade, u.codigo,
         a.observacao_adicional_upj, a.justificativa_devolucao_upj, a.justificativa_rejeicao_upj,
         CASE WHEN public.prioridades_sou_gestor()
                OR EXISTS (SELECT 1 FROM public.prioridades_usuarios_perfil p
                           WHERE p.usuario_id = auth.uid() AND p.ativo
                             AND p.perfil IN ('atendente', 'gestor', 'conferente'))
              THEN a.justificativa_rejeicao_gestor END,
         (SELECT max(h.criado_em) FROM public.prioridades_anotacoes_historico h
          WHERE h.anotacao_id = a.id AND h.evento IN ('resolucao_upj', 'rejeicao_upj', 'retorno_upj'))
  FROM public.prioridades_anotacoes a
  LEFT JOIN public.prioridades_upjs u ON u.id = a.upj_id
  WHERE a.processo = regexp_replace(p_processo, '\D', '', 'g')
    AND a.data_anotacao >= now() - make_interval(days => GREATEST(p_dias, 1))
    AND public.prioridades_pode_ver(a.id)
  ORDER BY a.data_anotacao DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.prioridades_v2_anteriores(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_v2_anteriores(text, integer) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. B — Coordenador designa Analistas, só da própria UPJ
-- ─────────────────────────────────────────────────────────────────────────
-- A função da v1 já deixava o Coordenador designar Analistas, mas aceitava QUALQUER
-- UPJ vinda do navegador. Esta trava a UPJ do Coordenador que não é admin nem Gestor
-- e depois delega à função da v1 (mesma sessão, mesmo auth.uid()).

CREATE OR REPLACE FUNCTION public.prioridades_v2_designar(
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
  v_admin boolean := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
  v_minha_upj uuid;
  v_upj_alvo uuid;
BEGIN
  IF NOT v_admin AND NOT public.prioridades_sou_gestor() AND p_perfil = 'analista' THEN
    v_minha_upj := public.prioridades_minha_upj();
    IF v_minha_upj IS NULL THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Sua UPJ não está definida no app. Fale com o administrador.');
    END IF;
    IF p_upj_id IS NOT NULL AND p_upj_id <> v_minha_upj THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'O Coordenador designa Analistas apenas da própria UPJ.');
    END IF;
    SELECT p.upj_id INTO v_upj_alvo
    FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = p_usuario_id AND p.ativo;
    IF v_upj_alvo IS DISTINCT FROM v_minha_upj THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Esta pessoa não está cadastrada na sua UPJ.');
    END IF;
    RETURN public.prioridades_designar(p_usuario_id, p_perfil, p_inicio, p_fim, v_minha_upj);
  END IF;

  RETURN public.prioridades_designar(p_usuario_id, p_perfil, p_inicio, p_fim, p_upj_id);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_v2_designar(uuid, public.prioridades_perfil_tipo, date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_v2_designar(uuid, public.prioridades_perfil_tipo, date, date, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 11. F — Regras especiais por UPJ + Categoria + Tipo (tabela nova da v2)
-- ─────────────────────────────────────────────────────────────────────────
-- Tabela nova porque a v1 grava na antiga com ON CONFLICT (upj_id, tipo_prioridade):
-- mudar a unicidade da antiga quebraria a v1. Categoria NULA = "todas as categorias".
-- As regras atuais são copiadas como "todas" (nada muda até o Gestor ajustar).
-- Enquanto a v1 existir, as duas tabelas são independentes.

CREATE TABLE IF NOT EXISTS public.prioridades_regras_especiais_v2 (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upj_id          uuid NOT NULL REFERENCES public.prioridades_upjs(id) ON DELETE CASCADE,
  tipo_prioridade text NOT NULL,
  categoria       text,
  texto           text NOT NULL,
  atualizado_por  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS prioridades_regras_especiais_v2_unica
  ON public.prioridades_regras_especiais_v2 (upj_id, tipo_prioridade, COALESCE(categoria, '*'));

COMMENT ON TABLE public.prioridades_regras_especiais_v2 IS
  'v2 (item F): regra especial por UPJ, tipo de prioridade e categoria (nula = todas). Exibida ao Atendente na Nova Anotação.';

ALTER TABLE public.prioridades_regras_especiais_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.prioridades_regras_especiais_v2 FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.prioridades_regras_especiais_v2 TO service_role;

INSERT INTO public.prioridades_regras_especiais_v2 (upj_id, tipo_prioridade, categoria, texto, atualizado_por, atualizado_em)
SELECT r.upj_id, r.tipo_prioridade, NULL, r.texto, r.atualizado_por, r.atualizado_em
FROM public.prioridades_regras_especiais r
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.prioridades_v2_regras_listar()
RETURNS TABLE (id uuid, upj_id uuid, tipo_prioridade text, categoria text, texto text)
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
    SELECT r.id, r.upj_id, r.tipo_prioridade, r.categoria, r.texto
    FROM public.prioridades_regras_especiais_v2 r
    ORDER BY r.tipo_prioridade, r.categoria NULLS FIRST;
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_v2_regras_listar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_v2_regras_listar() TO authenticated;

CREATE OR REPLACE FUNCTION public.prioridades_v2_regra_salvar(
  p_upj_id uuid,
  p_tipo text,
  p_categoria text,
  p_texto text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_categoria text := NULLIF(btrim(COALESCE(p_categoria, '')), '');
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
  IF NOT EXISTS (SELECT 1 FROM public.prioridades_tipos_prioridade WHERE codigo = p_tipo) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Tipo de prioridade inexistente.');
  END IF;
  IF v_categoria IS NOT NULL AND NOT (v_categoria = ANY (public.prioridades_categorias_validas())) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Categoria inválida.');
  END IF;

  IF COALESCE(trim(p_texto), '') = '' THEN
    DELETE FROM public.prioridades_regras_especiais_v2
    WHERE upj_id = p_upj_id AND tipo_prioridade = p_tipo AND categoria IS NOT DISTINCT FROM v_categoria;
    RETURN jsonb_build_object('sucesso', true, 'removida', true);
  END IF;

  UPDATE public.prioridades_regras_especiais_v2
  SET texto = trim(p_texto), atualizado_por = auth.uid(), atualizado_em = now()
  WHERE upj_id = p_upj_id AND tipo_prioridade = p_tipo AND categoria IS NOT DISTINCT FROM v_categoria;

  IF NOT FOUND THEN
    INSERT INTO public.prioridades_regras_especiais_v2 (upj_id, tipo_prioridade, categoria, texto, atualizado_por)
    VALUES (p_upj_id, p_tipo, v_categoria, trim(p_texto), auth.uid());
  END IF;

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_v2_regra_salvar(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_v2_regra_salvar(uuid, text, text, text) TO authenticated;

COMMIT;

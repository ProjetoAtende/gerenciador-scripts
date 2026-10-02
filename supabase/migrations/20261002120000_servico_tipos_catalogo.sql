-- Catálogo dinâmico de tipos de serviço (Outros Serviços + reflexo em Tarefas via slug)

BEGIN;

ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS descricao text;

CREATE TABLE IF NOT EXISTS public.servico_tipos (
  codigo        text PRIMARY KEY,
  label         text NOT NULL,
  unidade       text NOT NULL CHECK (unidade IN ('unidades', 'horas')),
  icone         text NOT NULL DEFAULT '📋',
  dica          text NOT NULL DEFAULT '',
  ativo         boolean NOT NULL DEFAULT true,
  eh_personalizado boolean NOT NULL DEFAULT false,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_servico_tipos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_servico_tipos_updated_at ON public.servico_tipos;
CREATE TRIGGER trg_servico_tipos_updated_at
  BEFORE UPDATE ON public.servico_tipos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_servico_tipos_updated_at();

ALTER TABLE public.servico_tipos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "servico_tipos_select_authenticated" ON public.servico_tipos;
CREATE POLICY "servico_tipos_select_authenticated"
  ON public.servico_tipos FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "servico_tipos_admin_write" ON public.servico_tipos;
CREATE POLICY "servico_tipos_admin_write"
  ON public.servico_tipos FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.servico_tipos TO authenticated;

CREATE OR REPLACE FUNCTION public.servico_tipo_ativo(p_codigo text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.servico_tipos t
    WHERE t.codigo = p_codigo AND t.ativo = true
  );
$$;

-- Semeia catálogo padrão (mesmo conteúdo de SERVICOS_CONFIG no frontend)
INSERT INTO public.servico_tipos (codigo, label, unidade, icone, dica, eh_personalizado) VALUES
  ('email', 'Criação e Resposta a E-mails', 'unidades', '📧', 'Informe o total de e-mails respondidos ou enviados.', false),
  ('homologacao', 'Homologação', 'horas', '✅', 'Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro (ex: 1h20min → 2).', false),
  ('reuniao_interna', 'Acompanhamento de Reunião Interna', 'horas', '👥', 'Horas dedicadas a reuniões internas. Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.', false),
  ('reuniao_externa', 'Acompanhamento de Reunião Externa', 'horas', '🤝', 'Horas dedicadas a reuniões externas. Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.', false),
  ('ouvidoria', 'Ouvidoria', 'horas', '📢', 'Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro (ex: 2h05min → 3).', false),
  ('cpa', 'CPA', 'horas', '📋', 'Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro (ex: 0h45min → 1).', false),
  ('chamado_smax', 'Chamado direto no SMAX', 'unidades', '🎫', 'Informe o total de chamados respondidos diretamente no SMAX.', false),
  ('encerrar_ticket_gerenciador', 'Encerrar ticket no Gerenciador', 'unidades', '🗃️', 'Informe o total de tickets encerrados no Gerenciador.', false),
  ('criacao_script', 'Criação de Script', 'unidades', '🧩', 'Informe o total de scripts criados ou finalizados.', false),
  ('atendimento_teams', 'Atendimento via Teams', 'unidades', '💬', 'Informe o total de atendimentos realizados via Teams.', false),
  ('atendimento_balcao', 'Atendimento via Balcão Virtual', 'unidades', '🏪', 'Informe o total de atendimentos realizados via Balcão Virtual.', false),
  ('dev_aplicacao', 'Desenvolvimento de Aplicação/Sistema', 'horas', '🖥️', 'Horas trabalhadas em desenvolvimento de aplicação. Se menos de 1 hora, registre 1.', false),
  ('resp_chamado_complexo', 'Resposta a Chamado Complexo', 'horas', '🔧', 'Horas trabalhadas em chamado complexo. Se menos de 1 hora, registre 1.', false),
  ('analise_rejeites', 'Resolução de rejeites', 'unidades', '🧾', 'Informe o total de rejeites resolvidos.', false),
  ('analise_chamados_antigos', 'Resolução de chamados antigos', 'unidades', '🗂️', 'Informe o total de chamados antigos resolvidos.', false),
  ('criacao_apresentacao', 'Produção de Apresentação (PPT)', 'horas', '📊', 'Horas trabalhadas na criação de apresentação. Se menos de 1 hora, registre 1.', false),
  ('elaboracao_relatorio', 'Produção de Relatório', 'horas', '📄', 'Horas dedicadas à elaboração de relatório. Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.', false),
  ('agendamento_visitas', 'Agendamento de Visitas', 'horas', '📅', 'Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.', false),
  ('visitas_virtuais', 'Visitas Virtuais', 'horas', '🖥️', 'Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.', false),
  ('visitas_presenciais', 'Visitas Presenciais', 'horas', '🏢', 'Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.', false),
  ('configuracao_sistema', 'Configuração do Sistema', 'unidades', '⚙️', 'Informe o total de configurações de sistema realizadas.', false),
  ('lotacao_usuarios', 'Lotação de Usuários', 'unidades', '👥', 'Informe o total de lotações de usuários realizadas.', false),
  ('cadastro_radar', 'Cadastro na Radar', 'unidades', '📡', 'Informe o total de cadastros realizados na Radar.', false),
  ('cadastro_melhoria', 'Cadastro de Melhoria', 'unidades', '💡', 'Informe o total de cadastros de melhoria realizados.', false),
  ('estudos_atualizacao', 'Estudos/Atualização', 'horas', '📚', 'Horas dedicadas a estudos ou atualização profissional. Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.', false),
  ('atendimento_chamados', 'Atendimento de chamados', 'unidades', '📞', 'Informe o total de chamados atendidos.', false),
  ('monitoramento_qualidade', 'Monitoramento e controle de qualidade', 'horas', '🔍', 'Horas dedicadas ao monitoramento e controle de qualidade. Se menos de 1 hora, registre 1.', false),
  ('producao_documento', 'Produção de documento', 'horas', '📝', 'Horas dedicadas à produção de documentos. Se menos de 1 hora, registre 1.', false),
  ('nape_ciclos_implantacao', 'Planejamento e execução dos ciclos de implantação do NAPE', 'horas', '🔄', 'Horas dedicadas ao planejamento e execução dos ciclos de implantação do NAPE. Se menos de 1 hora, registre 1.', false),
  ('nape_levantamento_gestores', 'Levantamento e validação de gestores e unidades participantes', 'unidades', '✔️', 'Informe a quantidade de gestores ou unidades levantados/validados.', false),
  ('nape_divulgacao_institucional', 'Divulgação institucional (banner, e-mails e convites)', 'unidades', '📣', 'Informe o total de ações de divulgação realizadas (banners, e-mails, convites).', false),
  ('nape_reunioes_orientadoras', 'Organização e apoio às reuniões orientadoras', 'horas', '🗓️', 'Horas dedicadas à organização e apoio às reuniões orientadoras. Se menos de 1 hora, registre 1.', false),
  ('nape_pos_implantacao', 'Acompanhamento pós-implantação das unidades', 'horas', '🏥', 'Horas dedicadas ao acompanhamento pós-implantação. Se menos de 1 hora, registre 1.', false),
  ('atendimento_pr_chat_portal', 'Atendimento de dúvidas pelo P&R, chat e portal de chamados', 'unidades', '💭', 'Informe o total de atendamentos de dúvidas via P&R, chat ou portal.', false),
  ('respostas_padronizadas', 'Elaboração e revisão de respostas padronizadas', 'unidades', '📋', 'Informe o total de respostas padronizadas elaboradas ou revisadas.', false),
  ('nape_suporte_operacional', 'Suporte operacional às unidades usuárias do NAPE', 'horas', '🛟', 'Horas de suporte operacional às unidades. Se menos de 1 hora, registre 1.', false),
  ('nape_monitoramento_utilizacao', 'Monitoramento diário da utilização do NAPE', 'unidades', '📈', 'Informe a quantidade de dias ou ciclos de monitoramento registrados.', false),
  ('nape_unidades_sem_uso', 'Identificação de unidades sem utilização do sistema', 'unidades', '⚠️', 'Informe o total de unidades identificadas sem utilização.', false),
  ('nape_baixa_adesao', 'Busca ativa de unidades com baixa adesão', 'unidades', '🎯', 'Informe o total de unidades contatadas ou mapeadas por baixa adesão.', false),
  ('monitoramento_erros_operacionais', 'Monitoramento de erros e inconsistências operacionais', 'unidades', '🐛', 'Informe o total de erros ou inconsistências monitorados/tratados.', false),
  ('acompanhamento_painel_watcher', 'Acompanhamento de informações do painel Watcher', 'horas', '👁️', 'Horas dedicadas ao acompanhamento do painel Watcher. Se menos de 1 hora, registre 1.', false),
  ('revisao_scripts_atendimento', 'Revisão e criação de scripts de atendimento', 'unidades', '📜', 'Informe o total de scripts de atendimento criados ou revisados.', false),
  ('duvidas_recorrentes', 'Levantamento e tratamento de dúvidas recorrentes', 'unidades', '❓', 'Informe o total de dúvidas recorrentes levantadas ou tratadas.', false),
  ('oportunidades_automacao', 'Identificação de oportunidades de automação', 'unidades', '🤖', 'Informe o total de oportunidades de automação identificadas.', false),
  ('melhorias_fluxos_operacionais', 'Proposição de melhorias nos fluxos operacionais', 'unidades', '🔀', 'Informe o total de melhorias propostas nos fluxos operacionais.', false),
  ('divergencias_entre_sistemas', 'Identificação e análise de divergências entre sistemas', 'unidades', '⚖️', 'Informe o total de divergências identificadas ou analisadas.', false),
  ('contato_areas_tecnicas', 'Contato com áreas técnicas para esclarecimentos', 'unidades', '🔌', 'Informe o total de contatos realizados com áreas técnicas.', false),
  ('padronizacao_orientacoes', 'Padronização de orientações fornecidas às unidades', 'unidades', '📐', 'Informe o total de orientações padronizadas ou revisadas.', false),
  ('validacao_procedimentos', 'Validação de procedimentos operacionais', 'horas', '✅', 'Horas dedicadas à validação de procedimentos operacionais. Se menos de 1 hora, registre 1.', false),
  ('diagnostico_otimizacao_python', 'Diagnóstico e Otimização de Código-Fonte Python', 'horas', '🐍', 'Horas dedicadas a diagnóstico e otimização de código Python. Se menos de 1 hora, registre 1.', false),
  ('modelagem_regras_negocio', 'Modelagem e Parametrização de Regras de Negócio', 'horas', '🧠', 'Horas dedicadas à modelagem e parametrização de regras de negócio. Se menos de 1 hora, registre 1.', false),
  ('desenvolvimento', 'Desenvolvimento (legado)', 'horas', '🖥️', 'Tipo legado mantido por compatibilidade.', false)
ON CONFLICT (codigo) DO NOTHING;

-- Tipos já usados em servicos mas ausentes do catálogo
INSERT INTO public.servico_tipos (codigo, label, unidade, icone, dica, eh_personalizado)
SELECT DISTINCT s.tipo,
  initcap(replace(s.tipo, '_', ' ')),
  'unidades',
  '📋',
  '',
  true
FROM public.servicos s
WHERE NOT EXISTS (SELECT 1 FROM public.servico_tipos t WHERE t.codigo = s.tipo);

ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_tipo_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'servicos_tipo_fkey'
  ) THEN
    ALTER TABLE public.servicos
      ADD CONSTRAINT servicos_tipo_fkey
      FOREIGN KEY (tipo) REFERENCES public.servico_tipos (codigo)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.listar_servico_tipos(p_incluir_inativos boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_itens jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'codigo', t.codigo,
      'label', t.label,
      'unidade', t.unidade,
      'icone', t.icone,
      'dica', t.dica,
      'ativo', t.ativo,
      'eh_personalizado', t.eh_personalizado
    ) ORDER BY t.label
  ), '[]'::jsonb)
  INTO v_itens
  FROM public.servico_tipos t
  WHERE p_incluir_inativos OR t.ativo = true;

  RETURN jsonb_build_object('sucesso', true, 'tipos', v_itens);
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_servico_tipos(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.criar_servico_tipo(
  p_codigo text,
  p_label text,
  p_unidade text,
  p_icone text DEFAULT '📋',
  p_dica text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Acesso negado.');
  END IF;

  v_codigo := lower(trim(regexp_replace(coalesce(p_codigo, ''), '\s+', '_', 'g')));
  v_codigo := regexp_replace(v_codigo, '[^a-z0-9_]', '', 'g');

  IF v_codigo = '' OR length(v_codigo) > 80 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Código inválido. Use letras minúsculas, números e underscore.');
  END IF;

  IF p_label IS NULL OR trim(p_label) = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Nome do serviço é obrigatório.');
  END IF;

  IF p_unidade NOT IN ('unidades', 'horas') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Unidade deve ser unidades ou horas.');
  END IF;

  INSERT INTO public.servico_tipos (codigo, label, unidade, icone, dica, eh_personalizado)
  VALUES (v_codigo, trim(p_label), p_unidade, coalesce(nullif(trim(p_icone), ''), '📋'), coalesce(p_dica, ''), true);

  RETURN jsonb_build_object('sucesso', true, 'codigo', v_codigo);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Já existe um serviço com este código.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_servico_tipo(text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.atualizar_servico_tipo(
  p_codigo text,
  p_label text DEFAULT NULL,
  p_unidade text DEFAULT NULL,
  p_icone text DEFAULT NULL,
  p_dica text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Acesso negado.');
  END IF;

  IF p_codigo IS NULL OR trim(p_codigo) = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Código obrigatório.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.servico_tipos WHERE codigo = p_codigo) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Tipo de serviço não encontrado.');
  END IF;

  IF p_unidade IS NOT NULL AND p_unidade NOT IN ('unidades', 'horas') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Unidade deve ser unidades ou horas.');
  END IF;

  UPDATE public.servico_tipos
  SET
    label = COALESCE(NULLIF(trim(p_label), ''), label),
    unidade = COALESCE(p_unidade, unidade),
    icone = COALESCE(NULLIF(trim(p_icone), ''), icone),
    dica = COALESCE(p_dica, dica),
    ativo = COALESCE(p_ativo, ativo)
  WHERE codigo = p_codigo;

  RETURN jsonb_build_object('sucesso', true, 'codigo', p_codigo);
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_servico_tipo(text, text, text, text, text, boolean) TO authenticated;

-- Atualiza validação de criar_servico (overload com data_execucao)
CREATE OR REPLACE FUNCTION public.criar_servico(
  p_tipo text,
  p_quantidade integer,
  p_usuario_id uuid,
  p_equipe_id uuid,
  p_observacao text DEFAULT NULL::text,
  p_data_execucao timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_descricao text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servico_id uuid;
  v_usuario_nome text;
  v_data_exec timestamptz;
BEGIN
  IF NOT public.servico_tipo_ativo(p_tipo) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Tipo de serviço inválido ou inativo.');
  END IF;

  IF p_quantidade IS NULL OR p_quantidade < 1 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Quantidade deve ser um número inteiro maior ou igual a 1');
  END IF;

  IF p_equipe_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Equipe é obrigatória');
  END IF;

  v_data_exec := COALESCE(p_data_execucao, NOW());
  IF v_data_exec > NOW() + INTERVAL '1 minute' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A data de execução não pode ser no futuro');
  END IF;

  SELECT COALESCE(nome, email, 'Usuário') INTO v_usuario_nome
  FROM public.users
  WHERE id = p_usuario_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não encontrado');
  END IF;

  INSERT INTO public.servicos (tipo, quantidade, usuario_id, usuario_nome, equipe_id, observacao, data_execucao, descricao)
  VALUES (p_tipo, p_quantidade, p_usuario_id, v_usuario_nome, p_equipe_id, p_observacao, v_data_exec, p_descricao)
  RETURNING id INTO v_servico_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'servico_id', v_servico_id,
    'mensagem', 'Serviço registrado com sucesso'
  );
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário, equipe ou tipo de serviço não encontrados.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Erro ao registrar serviço. Tente novamente.');
END;
$$;

COMMIT;

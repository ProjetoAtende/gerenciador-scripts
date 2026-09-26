-- DB-2: Outros Servicos (subset curado — sem tarefas/distribuidor)

ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS descricao text;
COMMENT ON COLUMN public.servicos.descricao IS 'Descricao HTML (editor rico).';

ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_tipo_check;
ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_quantidade_check;
ALTER TABLE public.servicos ADD CONSTRAINT servicos_quantidade_check CHECK (quantidade >= 1);

ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_equipe_id_fkey;
ALTER TABLE public.servicos ADD CONSTRAINT servicos_equipe_id_fkey
  FOREIGN KEY (equipe_id) REFERENCES public.equipes(id) ON DELETE RESTRICT;

ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_usuario_id_fkey;
ALTER TABLE public.servicos ADD CONSTRAINT servicos_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_servicos_data_execucao ON public.servicos (data_execucao DESC);
CREATE INDEX IF NOT EXISTS idx_servicos_equipe ON public.servicos (equipe_id);
CREATE INDEX IF NOT EXISTS idx_servicos_usuario ON public.servicos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_servicos_tipo ON public.servicos (tipo);
CREATE INDEX IF NOT EXISTS idx_servicos_criado_em ON public.servicos (criado_em DESC);

ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicos_select_equipe ON public.servicos;
CREATE POLICY servicos_select_equipe ON public.servicos
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR usuario_id = auth.uid()
    OR equipe_id IN (SELECT u.equipe_id FROM public.users u WHERE u.id = auth.uid())
    OR equipe_id IN (
      SELECT ufe.equipe_id FROM public.usuario_funcoes_equipe ufe
      WHERE ufe.user_id = auth.uid() AND ufe.funcao = 'supervisor' AND ufe.ativo = true
    )
  );

DROP POLICY IF EXISTS servicos_insert_proprio ON public.servicos;
CREATE POLICY servicos_insert_proprio ON public.servicos
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS servicos_update_dono_ou_admin ON public.servicos;
CREATE POLICY servicos_update_dono_ou_admin ON public.servicos
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS servicos_delete_dono_ou_admin ON public.servicos;
CREATE POLICY servicos_delete_dono_ou_admin ON public.servicos
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicos TO authenticated;
-- Dois tipos adicionais: Python e regras de negocio
-- Data: 2026-09-22

CREATE OR REPLACE FUNCTION public.servico_tipos_permitidos()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
  'email',
  'homologacao',
  'reuniao_interna',
  'reuniao_externa',
  'ouvidoria',
  'cpa',
  'chamado_smax',
  'encerrar_ticket_gerenciador',
  'criacao_script',
  'agendamento_visitas',
  'visitas_virtuais',
  'visitas_presenciais',
  'atendimento_teams',
  'atendimento_balcao',
  'dev_aplicacao',
  'resp_chamado_complexo',
  'analise_rejeites',
  'analise_chamados_antigos',
  'criacao_apresentacao',
  'elaboracao_relatorio',
  'configuracao_sistema',
  'lotacao_usuarios',
  'cadastro_radar',
  'cadastro_melhoria',
  'estudos_atualizacao',
  'atendimento_chamados',
  'monitoramento_qualidade',
  'producao_documento',
  'nape_ciclos_implantacao',
  'nape_levantamento_gestores',
  'nape_divulgacao_institucional',
  'nape_reunioes_orientadoras',
  'nape_pos_implantacao',
  'atendimento_pr_chat_portal',
  'respostas_padronizadas',
  'nape_suporte_operacional',
  'nape_monitoramento_utilizacao',
  'nape_unidades_sem_uso',
  'nape_baixa_adesao',
  'monitoramento_erros_operacionais',
  'acompanhamento_painel_watcher',
  'revisao_scripts_atendimento',
  'duvidas_recorrentes',
  'oportunidades_automacao',
  'melhorias_fluxos_operacionais',
  'divergencias_entre_sistemas',
  'contato_areas_tecnicas',
  'padronizacao_orientacoes',
  'validacao_procedimentos',
  'diagnostico_otimizacao_python',
  'modelagem_regras_negocio'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public.servico_tipos_hora_gamificacao()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
  'homologacao',
  'reuniao_interna',
  'reuniao_externa',
  'ouvidoria',
  'cpa',
  'agendamento_visitas',
  'visitas_virtuais',
  'visitas_presenciais',
  'dev_aplicacao',
  'resp_chamado_complexo',
  'criacao_apresentacao',
  'elaboracao_relatorio',
  'estudos_atualizacao',
  'monitoramento_qualidade',
  'producao_documento',
  'nape_ciclos_implantacao',
  'nape_reunioes_orientadoras',
  'nape_pos_implantacao',
  'nape_suporte_operacional',
  'acompanhamento_painel_watcher',
  'validacao_procedimentos',
  'diagnostico_otimizacao_python',
  'modelagem_regras_negocio'
  ]::text[];
$$;
ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_tipo_check;
ALTER TABLE public.servicos ADD CONSTRAINT servicos_tipo_check CHECK (tipo = ANY (public.servico_tipos_permitidos()));

CREATE OR REPLACE FUNCTION public.criar_servico(
  p_tipo          TEXT,
  p_quantidade    INTEGER,
  p_usuario_id    UUID,
  p_equipe_id     UUID,
  p_observacao    TEXT        DEFAULT NULL,
  p_data_execucao TIMESTAMPTZ DEFAULT NULL,
  p_descricao     TEXT        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servico_id   UUID;
  v_usuario_nome TEXT;
  v_data_exec    TIMESTAMPTZ;
BEGIN
  IF NOT p_tipo = ANY(public.servico_tipos_permitidos()) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Tipo de servico invalido.');
  END IF;

  IF p_quantidade IS NULL OR p_quantidade < 1 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Quantidade deve ser um numero inteiro maior ou igual a 1');
  END IF;

  IF p_equipe_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Equipe e obrigatoria');
  END IF;

  v_data_exec := COALESCE(p_data_execucao, NOW());
  IF v_data_exec > NOW() + INTERVAL '1 minute' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'A data de execucao nao pode ser no futuro');
  END IF;

  SELECT COALESCE(nome, email, 'Usuario') INTO v_usuario_nome
  FROM public.users
  WHERE id = p_usuario_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuario nao encontrado');
  END IF;

  INSERT INTO public.servicos (tipo, quantidade, usuario_id, usuario_nome, equipe_id, observacao, data_execucao, descricao)
  VALUES (p_tipo, p_quantidade, p_usuario_id, v_usuario_nome, p_equipe_id, p_observacao, v_data_exec, p_descricao)
  RETURNING id INTO v_servico_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'servico_id', v_servico_id,
    'mensagem', 'Servico registrado com sucesso'
  );

EXCEPTION
  WHEN check_violation THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Dados invalidos: verifique tipo e quantidade.');
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuario ou equipe nao encontrados.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Erro ao registrar servico. Tente novamente.');
END;
$$;



CREATE OR REPLACE FUNCTION public.atualizar_servico(
  p_servico_id    UUID,
  p_tipo          TEXT        DEFAULT NULL,
  p_quantidade    INTEGER     DEFAULT NULL,
  p_observacao    TEXT        DEFAULT NULL,
  p_data_execucao TIMESTAMPTZ DEFAULT NULL,
  p_descricao     TEXT        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_user_role  TEXT;
  v_servico    RECORD;
  v_alteracoes JSONB := '{}';
BEGIN
  SELECT * INTO v_servico FROM public.servicos WHERE id = p_servico_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Servico nao encontrado');
  END IF;

  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id;

  IF v_servico.usuario_id != v_user_id AND COALESCE(v_user_role, 'user') != 'admin' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas o responsavel ou administrador pode editar o servico');
  END IF;

  IF p_tipo IS NOT NULL AND p_tipo != v_servico.tipo THEN
    IF NOT p_tipo = ANY(public.servico_tipos_permitidos()) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Tipo de servico invalido');
    END IF;

    UPDATE public.servicos SET tipo = p_tipo, atualizado_em = NOW() WHERE id = p_servico_id;
    v_alteracoes := v_alteracoes || jsonb_build_object('tipo', true);
  END IF;

  IF p_quantidade IS NOT NULL AND p_quantidade != v_servico.quantidade THEN
    IF p_quantidade < 1 THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Quantidade deve ser um numero inteiro maior ou igual a 1');
    END IF;

    UPDATE public.servicos SET quantidade = p_quantidade, atualizado_em = NOW() WHERE id = p_servico_id;
    v_alteracoes := v_alteracoes || jsonb_build_object('quantidade', true);
  END IF;

  IF p_observacao IS NOT NULL AND COALESCE(p_observacao, '') != COALESCE(v_servico.observacao, '') THEN
    UPDATE public.servicos SET observacao = p_observacao, atualizado_em = NOW() WHERE id = p_servico_id;
    v_alteracoes := v_alteracoes || jsonb_build_object('observacao', true);
  END IF;

  IF p_data_execucao IS NOT NULL AND p_data_execucao != v_servico.data_execucao THEN
    IF p_data_execucao > NOW() + INTERVAL '1 minute' THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'A data de execucao nao pode ser no futuro');
    END IF;

    UPDATE public.servicos SET data_execucao = p_data_execucao, atualizado_em = NOW() WHERE id = p_servico_id;
    v_alteracoes := v_alteracoes || jsonb_build_object('data_execucao', true);
  END IF;

  IF p_descricao IS NOT NULL AND COALESCE(p_descricao, '') != COALESCE(v_servico.descricao, '') THEN
    UPDATE public.servicos SET descricao = p_descricao, atualizado_em = NOW() WHERE id = p_servico_id;
    v_alteracoes := v_alteracoes || jsonb_build_object('descricao', true);
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'alteracoes', v_alteracoes,
    'mensagem', 'Servico atualizado com sucesso'
  );

EXCEPTION
  WHEN check_violation THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Dados invalidos: verifique tipo e quantidade.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Erro ao atualizar servico. Tente novamente.');
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_servico(p_servico_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id   UUID := auth.uid();
  v_user_role TEXT;
  v_servico   RECORD;
BEGIN
  -- Buscar registro
  SELECT * INTO v_servico FROM servicos WHERE id = p_servico_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Serviço não encontrado');
  END IF;

  -- Verificar permissão
  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id;

  IF v_servico.usuario_id != v_user_id AND COALESCE(v_user_role, 'user') != 'admin' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Apenas o responsável ou administrador pode excluir o serviço');
  END IF;

  -- Excluir
  DELETE FROM servicos WHERE id = p_servico_id;

  RETURN jsonb_build_object(
    'sucesso',  true,
    'mensagem', 'Serviço excluído com sucesso'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Erro ao excluir serviço. Tente novamente.');
END;
$function$
;
CREATE OR REPLACE FUNCTION public.obter_servicos_estatisticas(
  p_equipe_id UUID,
  p_periodo   TEXT DEFAULT '30d'
)
RETURNS JSONB AS $$
DECLARE
  v_data_inicio TIMESTAMPTZ;
  v_resultados  JSONB;
BEGIN
  -- Calcular data de início
  v_data_inicio := CASE p_periodo
    WHEN '24h' THEN NOW() - INTERVAL '24 hours'
    WHEN '48h' THEN NOW() - INTERVAL '48 hours'
    WHEN '72h' THEN NOW() - INTERVAL '72 hours'
    WHEN '7d'  THEN NOW() - INTERVAL '7 days'
    WHEN '30d' THEN NOW() - INTERVAL '30 days'
    ELSE             NOW() - INTERVAL '30 days'
  END;

  -- Agregar por usuário, tipo e período
  -- FIX: Usar data_execucao (consistente com filtros das abas Serviços da Equipe e Meus Serviços)
  WITH periodos AS (
    SELECT
      usuario_nome,
      usuario_id,
      tipo,
      quantidade,
      CASE
        -- Para períodos curtos, agrupar por hora
        WHEN p_periodo IN ('24h', '48h', '72h') THEN
          TO_CHAR(data_execucao AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24"h"')
        -- Para períodos longos, agrupar por dia
        ELSE
          TO_CHAR(data_execucao AT TIME ZONE 'America/Sao_Paulo', 'DD/MM')
      END AS periodo_key
    FROM servicos
    WHERE
      equipe_id = p_equipe_id
      AND data_execucao >= v_data_inicio
  ),
  agrupado AS (
    SELECT
      usuario_nome,
      usuario_id,
      tipo,
      periodo_key,
      SUM(quantidade) AS total_quantidade
    FROM periodos
    GROUP BY usuario_nome, usuario_id, tipo, periodo_key
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'usuario_nome',    usuario_nome,
      'usuario_id',      usuario_id,
      'tipo',            tipo,
      'periodo',         periodo_key,
      'total_quantidade', total_quantidade
    )
    ORDER BY usuario_nome, periodo_key
  )
  INTO v_resultados
  FROM agrupado;

  RETURN jsonb_build_object(
    'sucesso', true,
    'dados',   COALESCE(v_resultados, '[]'::jsonb),
    'periodo', p_periodo
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Erro ao obter estatísticas de serviços. Tente novamente.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.obter_servicos_estatisticas_completas(
  p_equipe_id UUID,
  p_periodo   TEXT DEFAULT '30d'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data_inicio TIMESTAMPTZ;
  v_resultado   JSONB;
BEGIN
  v_data_inicio := CASE p_periodo
    WHEN '24h' THEN NOW() - INTERVAL '24 hours'
    WHEN '48h' THEN NOW() - INTERVAL '48 hours'
    WHEN '72h' THEN NOW() - INTERVAL '72 hours'
    WHEN '7d'  THEN NOW() - INTERVAL '7 days'
    WHEN '30d' THEN NOW() - INTERVAL '30 days'
    WHEN 'all' THEN NULL
    ELSE             NOW() - INTERVAL '30 days'
  END;

  WITH filtrado AS (
    SELECT *
    FROM public.servicos
    WHERE equipe_id = p_equipe_id
      AND (v_data_inicio IS NULL OR data_execucao >= v_data_inicio)
  ),

  kpis AS (
    SELECT jsonb_build_object(
      'total_registros', COUNT(*),
      'total_horas', COALESCE(SUM(quantidade) FILTER (
        WHERE tipo IN ('homologacao','reuniao_interna','reuniao_externa','ouvidoria','cpa','dev_aplicacao',
                        'resp_chamado_complexo','criacao_apresentacao',
                        'elaboracao_relatorio','agendamento_visitas',
                        'visitas_virtuais','visitas_presenciais','estudos_atualizacao')
      ), 0),
      'total_unidades', COALESCE(SUM(quantidade) FILTER (
        WHERE tipo IN ('email','chamado_smax','criacao_script',
                        'atendimento_teams','atendimento_balcao',
                        'analise_rejeites','analise_chamados_antigos',
                        'configuracao_sistema','lotacao_usuarios',
                        'cadastro_radar','cadastro_melhoria')
      ), 0),
      'primeiro_registro', MIN(data_execucao),
      'ultimo_registro', MAX(data_execucao),
      'membros_distintos', COUNT(DISTINCT usuario_id)
    ) AS val FROM filtrado
  ),

  por_tipo AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'tipo', tipo,
        'total_qtd', total_qtd,
        'total_regs', total_regs
      )
      ORDER BY total_qtd DESC
    ) AS val
    FROM (
      SELECT tipo,
             SUM(quantidade)::INTEGER AS total_qtd,
             COUNT(*)::INTEGER AS total_regs
      FROM filtrado
      GROUP BY tipo
    ) sub
  ),

  por_membro AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'usuario_id', usuario_id,
        'usuario_nome', usuario_nome,
        'total_qtd', total_qtd,
        'total_regs', total_regs,
        'tipos_distintos', tipos_distintos
      )
      ORDER BY total_qtd DESC
    ) AS val
    FROM (
      SELECT usuario_id,
             usuario_nome,
             SUM(quantidade)::INTEGER AS total_qtd,
             COUNT(*)::INTEGER AS total_regs,
             COUNT(DISTINCT tipo)::INTEGER AS tipos_distintos
      FROM filtrado
      GROUP BY usuario_id, usuario_nome
    ) sub
  ),

  por_dia_semana AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'dia_semana', dia,
        'dia_label', CASE dia
          WHEN 0 THEN 'Dom' WHEN 1 THEN 'Seg' WHEN 2 THEN 'Ter'
          WHEN 3 THEN 'Qua' WHEN 4 THEN 'Qui' WHEN 5 THEN 'Sex'
          WHEN 6 THEN 'Sáb'
        END,
        'total_qtd', total_qtd,
        'total_regs', total_regs
      )
      ORDER BY dia
    ) AS val
    FROM (
      SELECT EXTRACT(DOW FROM data_execucao AT TIME ZONE 'America/Sao_Paulo')::INTEGER AS dia,
             SUM(quantidade)::INTEGER AS total_qtd,
             COUNT(*)::INTEGER AS total_regs
      FROM filtrado
      GROUP BY dia
    ) sub
  ),

  por_faixa_horaria AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'dia_semana', dia,
        'faixa', faixa,
        'faixa_label', CASE faixa
          WHEN 0 THEN 'Madrugada (0h-6h)'
          WHEN 1 THEN 'Manhã (6h-12h)'
          WHEN 2 THEN 'Tarde (12h-18h)'
          WHEN 3 THEN 'Noite (18h-24h)'
        END,
        'total_qtd', total_qtd
      )
      ORDER BY dia, faixa
    ) AS val
    FROM (
      SELECT
        EXTRACT(DOW FROM data_execucao AT TIME ZONE 'America/Sao_Paulo')::INTEGER AS dia,
        (EXTRACT(HOUR FROM data_execucao AT TIME ZONE 'America/Sao_Paulo')::INTEGER / 6) AS faixa,
        SUM(quantidade)::INTEGER AS total_qtd
      FROM filtrado
      GROUP BY dia, faixa
    ) sub
  ),

  serie_temporal AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'periodo', periodo_key,
        'tipo', tipo,
        'usuario_id', usuario_id,
        'usuario_nome', usuario_nome,
        'total_quantidade', total_quantidade
      )
      ORDER BY periodo_key, usuario_nome
    ) AS val
    FROM (
      SELECT
        CASE
          WHEN p_periodo IN ('24h', '48h', '72h') THEN
            TO_CHAR(data_execucao AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24"h"')
          ELSE
            TO_CHAR(data_execucao AT TIME ZONE 'America/Sao_Paulo', 'DD/MM')
        END AS periodo_key,
        tipo,
        usuario_id,
        usuario_nome,
        SUM(quantidade)::INTEGER AS total_quantidade
      FROM filtrado
      GROUP BY periodo_key, tipo, usuario_id, usuario_nome
    ) sub
  ),

  volume_diario AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'data', dia,
        'total_qtd', total_qtd,
        'total_regs', total_regs
      )
      ORDER BY dia
    ) AS val
    FROM (
      SELECT
        TO_CHAR(data_execucao AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia,
        SUM(quantidade)::INTEGER AS total_qtd,
        COUNT(*)::INTEGER AS total_regs
      FROM filtrado
      GROUP BY dia
    ) sub
  )

  SELECT jsonb_build_object(
    'sucesso', true,
    'periodo', p_periodo,
    'kpis', (SELECT val FROM kpis),
    'por_tipo', COALESCE((SELECT val FROM por_tipo), '[]'::jsonb),
    'por_membro', COALESCE((SELECT val FROM por_membro), '[]'::jsonb),
    'por_dia_semana', COALESCE((SELECT val FROM por_dia_semana), '[]'::jsonb),
    'por_faixa_horaria', COALESCE((SELECT val FROM por_faixa_horaria), '[]'::jsonb),
    'serie_temporal', COALESCE((SELECT val FROM serie_temporal), '[]'::jsonb),
    'volume_diario', COALESCE((SELECT val FROM volume_diario), '[]'::jsonb)
  )
  INTO v_resultado;

  RETURN v_resultado;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Erro ao obter estatísticas completas de serviços: ' || SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_servicos_estatisticas_completas(UUID, TEXT) TO authenticated;
CREATE OR REPLACE FUNCTION public.listar_servicos_equipe(p_equipe_id uuid, p_limite integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_servicos jsonb;
  v_total integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.servicos WHERE equipe_id = p_equipe_id;

  SELECT jsonb_agg(row_to_json(s.*) ORDER BY s.data_execucao DESC)
  INTO v_servicos
  FROM (
    SELECT id, tipo, quantidade, usuario_id, usuario_nome, equipe_id, observacao, descricao, data_execucao, criado_em, atualizado_em
    FROM public.servicos
    WHERE equipe_id = p_equipe_id
    ORDER BY data_execucao DESC
    LIMIT p_limite OFFSET p_offset
  ) s;

  RETURN jsonb_build_object('sucesso', true, 'servicos', COALESCE(v_servicos, '[]'::jsonb), 'total', v_total);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('sucesso', false, 'erro', 'Erro ao listar servicos da equipe.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.listar_servicos_usuario(p_usuario_id uuid, p_limite integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_servicos jsonb;
  v_total integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.servicos WHERE usuario_id = p_usuario_id;

  SELECT jsonb_agg(row_to_json(s.*) ORDER BY s.data_execucao DESC)
  INTO v_servicos
  FROM (
    SELECT id, tipo, quantidade, usuario_id, usuario_nome, equipe_id, observacao, descricao, data_execucao, criado_em, atualizado_em
    FROM public.servicos
    WHERE usuario_id = p_usuario_id
    ORDER BY data_execucao DESC
    LIMIT p_limite OFFSET p_offset
  ) s;

  RETURN jsonb_build_object('sucesso', true, 'servicos', COALESCE(v_servicos, '[]'::jsonb), 'total', v_total);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('sucesso', false, 'erro', 'Erro ao listar servicos.');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.servico_tipos_permitidos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.servico_tipos_hora_gamificacao() TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_servico(text, integer, uuid, uuid, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_servico(uuid, text, integer, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_servico(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_servicos_equipe(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_servicos_usuario(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obter_servicos_estatisticas(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obter_servicos_estatisticas_completas(uuid, text) TO authenticated;

INSERT INTO public.permissoes_objetos (codigo, nome, descricao, categoria, origem)
VALUES ('home.card.outros_servicos', 'Home — Outros Servicos', 'Card Outros Servicos na Home.', 'home', 'src/pages/Home.tsx')
ON CONFLICT (codigo) DO NOTHING;


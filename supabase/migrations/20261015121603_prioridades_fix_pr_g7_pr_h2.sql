-- PR-G7: correção automática por prazo preserva texto original em observação do gestor
-- PR-H2: listar regras especiais só para quem tem perfil ativo no app Prioridades

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
  v_obs text;
  v_novo_texto text;
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
      v_novo_texto := COALESCE(v_row.texto_correcao_automatica, v_row.descricao_prioridade);
      v_obs := v_row.observacao_adicional_gestor;
      IF v_novo_texto IS DISTINCT FROM v_row.descricao_prioridade THEN
        v_obs := concat_ws(
          E'\n\n',
          v_obs,
          format(
            'Texto original (correção automática por prazo em %s):%s%s',
            to_char(now(), 'DD/MM/YYYY HH24:MI'),
            E'\n',
            v_row.descricao_prioridade
          )
        );
      END IF;

      UPDATE public.prioridades_anotacoes
      SET status = 'upj-pendente',
          descricao_prioridade = v_novo_texto,
          observacao_adicional_gestor = v_obs,
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

  IF NOT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo
  ) THEN
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

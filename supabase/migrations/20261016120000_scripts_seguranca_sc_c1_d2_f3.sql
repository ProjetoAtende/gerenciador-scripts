-- Scripts — correções do teste de segurança (16/10/2026)
-- SC-C1, SC-D2, SC-D3, SC-F3, SC-E2 (nome), notif_exclusao insert

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- SC-E2 — limite de tamanho do nome
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.scripts_customizados
  DROP CONSTRAINT IF EXISTS chk_scripts_nome_tamanho;

ALTER TABLE public.scripts_customizados
  ADD CONSTRAINT chk_scripts_nome_tamanho CHECK (char_length(nome) <= 200);

-- ─────────────────────────────────────────────────────────────────────────
-- SC-C1 — colunas de fluxo não alteráveis pelo cliente (REST autenticado)
-- SECURITY DEFINER (owner) continua podendo atualizar via RPCs.
-- ─────────────────────────────────────────────────────────────────────────
REVOKE UPDATE (
  criado_por,
  criado_por_atendente,
  curadoria_atuada,
  curadoria_por,
  data_curadoria,
  modificado_curadoria,
  conteudo_original,
  email_enviado,
  email_curadoria_enviado,
  deletado,
  deletado_em,
  deletado_por,
  motivo_exclusao,
  exclusao_pendente,
  exclusao_solicitada_em,
  exclusao_solicitada_por,
  desativado_em,
  tem_proposta_pendente,
  numero_referencia
) ON public.scripts_customizados FROM authenticated;

CREATE OR REPLACE FUNCTION public.fn_scripts_forcar_autoria_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.criado_por := auth.uid();
  END IF;

  IF current_setting('app.scripts_fluxo_interno', true) IS DISTINCT FROM 'on' THEN
    NEW.email_enviado := false;
    NEW.curadoria_atuada := false;
    NEW.tem_proposta_pendente := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scripts_forcar_autoria_insert ON public.scripts_customizados;
CREATE TRIGGER trg_scripts_forcar_autoria_insert
  BEFORE INSERT ON public.scripts_customizados
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_scripts_forcar_autoria_insert();

-- Publicação (substitui UPDATE direto de email_enviado)
CREATE OR REPLACE FUNCTION public.publicar_script_customizado(p_script_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipe_id uuid;
  v_deletado boolean;
BEGIN
  SELECT equipe_id, COALESCE(deletado, false)
  INTO v_equipe_id, v_deletado
  FROM public.scripts_customizados
  WHERE id = p_script_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Script % não encontrado', p_script_id;
  END IF;

  IF v_deletado THEN
    RAISE EXCEPTION 'Script % está deletado', p_script_id;
  END IF;

  IF NOT (
    public.is_admin(auth.uid())
    OR (v_equipe_id IS NOT NULL AND public.usuario_pode_acessar_equipe(v_equipe_id))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para publicar este script';
  END IF;

  UPDATE public.scripts_customizados
  SET email_enviado = true
  WHERE id = p_script_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publicar_script_customizado(uuid) TO authenticated;

-- Curadoria: exige permissão de curadoria; corrige data ao desmarcar
CREATE OR REPLACE FUNCTION public.marcar_curadoria_script(
  p_script_id uuid,
  p_curado boolean DEFAULT true,
  p_curador_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_foi_modificado boolean;
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  IF NOT (public.is_admin(auth.uid()) OR public.is_curadoria_team()) THEN
    RAISE EXCEPTION 'Sem permissão de curadoria';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.scripts_customizados WHERE id = p_script_id) THEN
    RAISE EXCEPTION 'Script % não encontrado', p_script_id;
  END IF;

  v_foi_modificado := public.script_foi_modificado(p_script_id);

  UPDATE public.scripts_customizados
  SET
    curadoria_atuada = p_curado,
    modificado_curadoria = CASE WHEN p_curado THEN v_foi_modificado ELSE modificado_curadoria END,
    data_curadoria = CASE WHEN p_curado THEN now() ELSE NULL END,
    curadoria_por = CASE WHEN p_curado THEN COALESCE(p_curador_id, auth.uid()) ELSE NULL END
  WHERE id = p_script_id;

  v_resultado := jsonb_build_object(
    'script_id', p_script_id,
    'curadoria_atuada', p_curado,
    'modificado', v_foi_modificado,
    'data_curadoria', CASE WHEN p_curado THEN now() ELSE NULL END,
    'curadoria_por', CASE WHEN p_curado THEN COALESCE(p_curador_id, auth.uid()) ELSE NULL END
  );

  RETURN v_resultado;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- SC-D2 / SC-D3 — leitura alinhada ao script pai e participantes
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS script_versoes_select ON public.script_versoes;
CREATE POLICY script_versoes_select ON public.script_versoes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.scripts_customizados sc
      WHERE sc.id = script_versoes.script_id
        AND (
          public.is_admin(auth.uid())
          OR (public.is_curadoria_team() AND sc.deletado = true)
          OR (sc.exclusao_pendente = true AND public.is_admin(auth.uid()))
          OR (
            (sc.deletado = false OR sc.deletado IS NULL)
            AND (
              sc.equipe_id IS NULL
              OR public.usuario_pode_acessar_equipe(sc.equipe_id)
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS propostas_select ON public.script_propostas_revisao;
CREATE POLICY propostas_select ON public.script_propostas_revisao
  FOR SELECT TO authenticated
  USING (
    (
      public.is_admin(auth.uid())
      OR public.is_curadoria_team()
      OR autor_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.scripts_customizados sc
      WHERE sc.id = script_propostas_revisao.script_id
        AND (
          public.is_admin(auth.uid())
          OR public.is_curadoria_team()
          OR sc.equipe_id IS NULL
          OR public.usuario_pode_acessar_equipe(sc.equipe_id)
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- SC-F3 — notificações só para participantes do fluxo
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notificar_script_participante(
  p_destinatario_id uuid,
  p_script_id uuid,
  p_tipo text,
  p_mensagem text,
  p_proposta_id uuid DEFAULT NULL::uuid,
  p_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_script public.scripts_customizados%ROWTYPE;
  v_dest_ok boolean := false;
  v_caller_ok boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  SELECT * INTO v_script FROM public.scripts_customizados WHERE id = p_script_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Script % não encontrado', p_script_id;
  END IF;

  v_dest_ok := p_destinatario_id IN (
    v_script.criado_por,
    v_script.criado_por_atendente,
    v_script.curadoria_por
  );

  IF NOT v_dest_ok AND p_proposta_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.script_propostas_revisao pr
      WHERE pr.id = p_proposta_id
        AND pr.script_id = p_script_id
        AND (
          pr.autor_id = p_destinatario_id
          OR pr.decidido_por = p_destinatario_id
        )
    ) INTO v_dest_ok;
  END IF;

  IF NOT v_dest_ok THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.notificacoes_destinatarios('scripts.curadoria_acesso', v_script.equipe_id) d
      WHERE d.user_id = p_destinatario_id
    ) INTO v_dest_ok;
  END IF;

  IF NOT v_dest_ok AND p_metadata IS NOT NULL AND (p_metadata ? 'curador_id') THEN
    v_dest_ok := NULLIF(p_metadata->>'curador_id', '')::uuid = p_destinatario_id;
  END IF;

  IF NOT v_dest_ok THEN
    RAISE EXCEPTION 'Destinatário não autorizado para este script';
  END IF;

  IF public.is_admin(v_uid) OR public.is_curadoria_team() THEN
    v_caller_ok := true;
  ELSIF v_uid IN (v_script.criado_por, v_script.criado_por_atendente) THEN
    v_caller_ok := true;
  ELSIF p_proposta_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.script_propostas_revisao pr
    WHERE pr.id = p_proposta_id
      AND pr.script_id = p_script_id
      AND pr.autor_id = v_uid
  ) THEN
    v_caller_ok := true;
  END IF;

  IF NOT v_caller_ok THEN
    RAISE EXCEPTION 'Sem permissão para enviar esta notificação';
  END IF;

  RETURN public.criar_notificacao_script(
    p_destinatario_id,
    p_script_id,
    p_tipo,
    p_mensagem,
    p_proposta_id,
    p_metadata
  );
END;
$$;

REVOKE ALL ON FUNCTION public.criar_notificacao_script(uuid, uuid, text, text, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.criar_notificacao_script(uuid, uuid, text, text, uuid, jsonb) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.notificar_script_participante(uuid, uuid, text, text, uuid, jsonb) TO authenticated;

-- Alinha documentação ao comportamento desejado (insert só via RPC)
DROP POLICY IF EXISTS notif_exclusao_insert ON public.notificacoes_exclusao_scripts;

COMMIT;

-- Scripts — reteste Grok 16/10/2026: SC-C1, SC-F3-DEST/META, SC-RPC-GRANT, purge incidente

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- SC-C1 — PostgREST ignora REVOKE por coluna; trigger + GRANT só colunas editáveis
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_scripts_proteger_colunas_fluxo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user = 'postgres'
     OR current_setting('app.scripts_fluxo_interno', true) = 'on' THEN
    RETURN NEW;
  END IF;

  NEW.criado_por := OLD.criado_por;
  NEW.criado_por_atendente := OLD.criado_por_atendente;
  NEW.curadoria_atuada := OLD.curadoria_atuada;
  NEW.curadoria_por := OLD.curadoria_por;
  NEW.data_curadoria := OLD.data_curadoria;
  NEW.modificado_curadoria := OLD.modificado_curadoria;
  NEW.conteudo_original := OLD.conteudo_original;
  NEW.email_enviado := OLD.email_enviado;
  NEW.email_curadoria_enviado := OLD.email_curadoria_enviado;
  NEW.deletado := OLD.deletado;
  NEW.deletado_em := OLD.deletado_em;
  NEW.deletado_por := OLD.deletado_por;
  NEW.motivo_exclusao := OLD.motivo_exclusao;
  NEW.exclusao_pendente := OLD.exclusao_pendente;
  NEW.exclusao_solicitada_em := OLD.exclusao_solicitada_em;
  NEW.exclusao_solicitada_por := OLD.exclusao_solicitada_por;
  NEW.desativado_em := OLD.desativado_em;
  NEW.tem_proposta_pendente := OLD.tem_proposta_pendente;
  NEW.numero_referencia := OLD.numero_referencia;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scripts_proteger_colunas_fluxo ON public.scripts_customizados;
CREATE TRIGGER trg_scripts_proteger_colunas_fluxo
  BEFORE UPDATE ON public.scripts_customizados
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_scripts_proteger_colunas_fluxo();

REVOKE UPDATE ON TABLE public.scripts_customizados FROM PUBLIC, anon, authenticated;

GRANT UPDATE (
  nome,
  conteudo_bruto,
  conteudo_atendente,
  criado_em,
  ordem,
  equipe_id,
  pasta_id,
  pergunta,
  numero_chamado,
  habilitado_smith,
  equipe_autor_id,
  categoria_equipe_slug,
  subcategoria_gse_slug,
  categoria_confianca,
  subcategoria_confianca,
  classificacao_origem,
  classificacao_em,
  classificacao_por,
  classificacao_pendente,
  temporario,
  tipo_requisitante,
  tem_conteudo_atendente,
  tem_conteudo_usuario_final,
  n1,
  validado_n1,
  validado_n1_por,
  validado_n1_em,
  enviado_n1,
  enviado_n1_por,
  enviado_n1_em,
  dominio,
  instancia
) ON TABLE public.scripts_customizados TO authenticated;

-- RPCs de fluxo podem alterar colunas protegidas
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

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

  PERFORM set_config('app.scripts_fluxo_interno', 'on', true);

  UPDATE public.scripts_customizados
  SET email_enviado = true
  WHERE id = p_script_id;
END;
$$;

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

  PERFORM set_config('app.scripts_fluxo_interno', 'on', true);

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
-- SC-F3-DEST / SC-F3-META — destinatário sem NULL-trap; sem metadata.curador_id
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

  IF p_destinatario_id IS NULL THEN
    RAISE EXCEPTION 'Destinatário obrigatório';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_destinatario_id) THEN
    RAISE EXCEPTION 'Destinatário inválido';
  END IF;

  SELECT * INTO v_script FROM public.scripts_customizados WHERE id = p_script_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Script % não encontrado', p_script_id;
  END IF;

  IF v_script.criado_por IS NOT NULL AND p_destinatario_id = v_script.criado_por THEN
    v_dest_ok := true;
  END IF;

  IF NOT v_dest_ok
     AND v_script.criado_por_atendente IS NOT NULL
     AND p_destinatario_id = v_script.criado_por_atendente THEN
    v_dest_ok := true;
  END IF;

  IF NOT v_dest_ok
     AND v_script.curadoria_por IS NOT NULL
     AND p_destinatario_id = v_script.curadoria_por THEN
    v_dest_ok := true;
  END IF;

  IF NOT v_dest_ok AND p_proposta_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.script_propostas_revisao pr
      WHERE pr.id = p_proposta_id
        AND pr.script_id = p_script_id
        AND (
          (pr.autor_id IS NOT NULL AND p_destinatario_id = pr.autor_id)
          OR (pr.decidido_por IS NOT NULL AND p_destinatario_id = pr.decidido_por)
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

  IF COALESCE(v_dest_ok, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Destinatário não autorizado para este script';
  END IF;

  IF public.is_admin(v_uid) OR public.is_curadoria_team() THEN
    v_caller_ok := true;
  ELSIF v_script.criado_por IS NOT NULL AND v_uid = v_script.criado_por THEN
    v_caller_ok := true;
  ELSIF v_script.criado_por_atendente IS NOT NULL AND v_uid = v_script.criado_por_atendente THEN
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

  IF COALESCE(v_caller_ok, false) IS NOT TRUE THEN
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

-- ─────────────────────────────────────────────────────────────────────────
-- SC-RPC-GRANT / A3 — somente authenticated
-- ─────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.publicar_script_customizado(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.publicar_script_customizado(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.publicar_script_customizado(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.marcar_curadoria_script(uuid, boolean, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.marcar_curadoria_script(uuid, boolean, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.marcar_curadoria_script(uuid, boolean, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.notificar_script_participante(uuid, uuid, text, text, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notificar_script_participante(uuid, uuid, text, text, uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.notificar_script_participante(uuid, uuid, text, text, uuid, jsonb) TO authenticated;

-- Incidente reteste: notificações [TESTE] enviadas indevidamente a usuário real
DELETE FROM public.script_notificacoes
WHERE id IN (
  '405233ed-bc63-40dc-a6d0-d774976ccd6d',
  '9cf6176f-16af-49c9-bb1d-d87e097e00a4'
);

COMMIT;

-- App "Prioridades e Urgências" — mesmo portão NULL em alternar_vinculacao.
--
-- A varredura preventiva da migration anterior acusou:
--
--   WARNING: Portão de permissão sem COALESCE (risco de NULL):
--            prioridades_alternar_vinculacao(uuid, boolean)
--
-- A função fazia:
--
--   v_eh_gestor := public.prioridades_sou_gestor();          -- false sem perfil
--   ... v_eh_coordenador := ... OR designacao_ativa(...)     -- pode ser NULL
--   IF NOT (v_eh_gestor OR v_eh_coordenador OR admin) THEN ...
--
-- Com `v_eh_coordenador` NULL e os outros dois false, a expressão vira NULL e o
-- `IF NOT (NULL)` NÃO entra — ou seja, **qualquer usuário autenticado sem perfil
-- conseguia alterar a vinculação automática** (RF-GES-07), que decide quem
-- participa da distribuição de trabalho.
--
-- Havia ainda um segundo defeito na mesma linha: o `OR admin` reconcedia ao
-- administrador exatamente a capacidade de decisão que as demais RPCs passaram a
-- exigir perfil. O admin tem LEITURA total; para decidir, precisa do perfil no
-- app — a mesma regra do conferir e do analisar.
--
-- Correção: COALESCE em cada termo, sem bypass de admin.

BEGIN;

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
  v_permitido boolean;
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

  -- Sem bypass de admin: leitura total não implica decidir (mesma regra de
  -- `conferir` e `analisar`).
  v_permitido := COALESCE(v_eh_gestor, false) OR COALESCE(v_eh_coordenador, false);

  IF NOT v_permitido THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Sem permissão para alterar a vinculação automática.');
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

REVOKE ALL ON FUNCTION public.prioridades_alternar_vinculacao(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_alternar_vinculacao(uuid, boolean) TO authenticated;

COMMIT;

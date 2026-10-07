-- App "Prioridades e Urgências" — escrita do mapeamento órgão→UPJ só por RPC.
--
-- A migration 20261010250000 tentou remover a policy de escrita desta tabela,
-- mas repetiu o nome errado (o correto é `..._admin_write`, e o DROP executou
-- sobre uma policy da tabela de UPJs). Resultado: o mapeamento continuava
-- gravável direto pela API, o que permitiria redirecionar deliberadamente
-- anotações para o cartório errado.
--
-- Aqui a policy é removida de fato e a escrita passa a existir apenas pela RPC
-- `prioridades_registrar_mapeamento_orgao`, que exige Gestor ou admin.

BEGIN;

DROP POLICY IF EXISTS "prioridades_orgaos_upj_admin_write" ON public.prioridades_orgaos_upj;
DROP POLICY IF EXISTS "prioridades_orgaos_upj_gestor_write" ON public.prioridades_orgaos_upj;

-- Leitura continua livre a autenticados (a detecção de UPJ precisa dela).
DROP POLICY IF EXISTS "prioridades_orgaos_upj_select" ON public.prioridades_orgaos_upj;
CREATE POLICY "prioridades_orgaos_upj_select"
  ON public.prioridades_orgaos_upj FOR SELECT TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.prioridades_orgaos_upj FROM authenticated;
REVOKE ALL ON public.prioridades_orgaos_upj FROM anon;

-- ─────────────────────────────────────────────────────────────────────────
-- RPC: registrar o mapeamento (substitui a escrita direta)
-- ─────────────────────────────────────────────────────────────────────────
--
-- O mapeamento é incremental por desenho: cada confirmação de "este órgão do
-- DJEN é esta UPJ" alimenta a detecção automática para todos. Quem confirma é
-- quem opera a distribuição — Gestor do TJSP Atende — ou o admin.

CREATE OR REPLACE FUNCTION public.prioridades_registrar_mapeamento_orgao(
  p_id_orgao bigint,
  p_nome_orgao text,
  p_vara integer,
  p_upj_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_permitido boolean;
BEGIN
  v_permitido := public.prioridades_sou_gestor()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');

  IF NOT v_permitido THEN
    RETURN jsonb_build_object('sucesso', false,
      'erro', 'Confirmar o mapeamento de órgão para UPJ cabe ao Gestor do TJSP Atende.');
  END IF;

  IF p_id_orgao IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Informe o idOrgao devolvido pelo DJEN.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.prioridades_upjs WHERE id = p_upj_id AND ativa) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'UPJ inexistente ou inativa.');
  END IF;

  INSERT INTO public.prioridades_orgaos_upj (id_orgao_djen, nome_orgao_djen, vara, upj_id, ativo)
  VALUES (p_id_orgao, p_nome_orgao, p_vara, p_upj_id, true)
  ON CONFLICT (id_orgao_djen) DO UPDATE
  SET nome_orgao_djen = excluded.nome_orgao_djen,
      vara = excluded.vara,
      upj_id = excluded.upj_id,
      ativo = true,
      atualizado_em = now();

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

REVOKE ALL ON FUNCTION public.prioridades_registrar_mapeamento_orgao(bigint, text, integer, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prioridades_registrar_mapeamento_orgao(bigint, text, integer, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.prioridades_registrar_mapeamento_orgao(bigint, text, integer, uuid) IS
  'RF-ATD-04 (mapeamento incremental). Substitui a escrita direta em prioridades_orgaos_upj, que ficou somente leitura para o cliente.';

COMMIT;

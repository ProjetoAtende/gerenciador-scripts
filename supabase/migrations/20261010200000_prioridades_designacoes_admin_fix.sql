-- App "Prioridades e Urgências" — corrige a alçada do admin nas RPCs de designação.
--
-- Falha encontrada em teste com o papel `admin` global: `prioridades_designar`
-- concedia a alçada ao admin, mas `prioridades_buscar_usuarios` não. Como o
-- admin normalmente NÃO tem perfil no app (ele não é atendente, gestor nem
-- coordenador de UPJ), a função caía no ramo de recusa e a tela "Designações"
-- respondia "Apenas Gestor ou Coordenador da UPJ pode buscar usuários" — sem
-- que houvesse como designar ninguém.
--
-- Aqui as duas funções passam a considerar o admin de forma explícita e
-- consistente. A regra final de alçada fica:
--
--   conferente → Gestor do TJSP Atende, ou admin
--   analista   → Coordenador da UPJ, ou admin
--   busca      → qualquer uma das duas alçadas, ou admin
--
-- O desvio de leitura total concedido ao admin (ver migration
-- 20261010180000_prioridades_decisoes_registradas.sql) é o que fundamenta essa
-- capacidade de administração.

BEGIN;

CREATE OR REPLACE FUNCTION public.prioridades_buscar_usuarios(
  p_termo text,
  p_upj_id uuid DEFAULT NULL
)
RETURNS TABLE (
  usuario_id uuid,
  nome text,
  email text,
  perfil_atual public.prioridades_perfil_tipo,
  upj_atual uuid,
  ja_designado boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_sou_gestor boolean;
  v_sou_coordenador boolean;
  v_admin boolean;
  v_upj uuid;
BEGIN
  v_sou_gestor := public.prioridades_sou_gestor_ou_conferente();

  SELECT EXISTS (
    SELECT 1 FROM public.prioridades_usuarios_perfil p
    WHERE p.usuario_id = auth.uid() AND p.ativo AND p.perfil = 'coordenador'
  ) OR public.prioridades_designacao_ativa(ARRAY['coordenador']::public.prioridades_perfil_tipo[])
  INTO v_sou_coordenador;

  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  INTO v_admin;

  IF NOT (v_sou_gestor OR v_sou_coordenador OR v_admin) THEN
    RAISE EXCEPTION 'Apenas Gestor ou Coordenador da UPJ pode buscar usuários para designação.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_upj := COALESCE(p_upj_id, public.prioridades_minha_upj());

  RETURN QUERY
  SELECT u.id,
         u.nome,
         u.email,
         pa.perfil,
         pa.upj_id,
         EXISTS (
           SELECT 1 FROM public.prioridades_designacoes d
           WHERE d.usuario_id = u.id
             AND d.ativa
             AND (d.fim_em IS NULL OR d.fim_em >= CURRENT_DATE)
         )
  FROM public.users u
  LEFT JOIN public.prioridades_usuarios_perfil pa
    ON pa.usuario_id = u.id AND pa.ativo
  WHERE u.ativo IS DISTINCT FROM false
    -- RF-UPJ-05: o Coordenador busca apenas quem está vinculado à sua UPJ.
    -- O Gestor do TJSP Atende e o admin buscam em toda a base.
    AND (v_sou_gestor OR v_admin OR v_upj IS NULL OR pa.upj_id = v_upj)
    AND (
      COALESCE(btrim(p_termo), '') = ''
      OR u.nome ILIKE '%' || btrim(p_termo) || '%'
      OR u.email ILIKE '%' || btrim(p_termo) || '%'
    )
  ORDER BY u.nome
  LIMIT 25;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prioridades_buscar_usuarios(text, uuid) TO authenticated;

COMMIT;

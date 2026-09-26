-- sync_from_production.sql
-- Gerado em: 2026-04-01T13:24:03.411Z
-- Fonte: produção rdkvvigjmowtvhxqlrnp
-- Propósito: sincronizar DDL local com produção

SET search_path TO public, extensions;
SET client_min_messages TO 'warning';
SET check_function_bodies = false;

-- ═══════════════════════════════════════════════════
-- SEÇÃO 0: Colunas faltantes em tabelas existentes
-- ═══════════════════════════════════════════════════

ALTER TABLE public.scripts_customizados ADD COLUMN IF NOT EXISTS categoria_equipe_slug text;
ALTER TABLE public.scripts_customizados ADD COLUMN IF NOT EXISTS dominio text;
ALTER TABLE public.scripts_customizados ADD COLUMN IF NOT EXISTS subcategoria_gse_slug text;
ALTER TABLE public.scripts_categorias_adicionais ADD COLUMN IF NOT EXISTS categoria_equipe_slug text;
ALTER TABLE public.scripts_categorias_adicionais ADD COLUMN IF NOT EXISTS subcategoria_gse_slug text;


-- ═══════════════════════════════════════════════════
-- SEÇÃO 1: Funções APP ausentes no banco local
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_select_bases_by_keywords(question_text text, max_bases integer DEFAULT 3)
 RETURNS TABLE(base_id uuid, relevance_score bigint, assuntos_relacionados text[])
 LANGUAGE sql
AS $function$
    WITH palavras AS (
      SELECT unnest(string_to_array(lower(question_text), ' ')) as palavra
    ),
    assuntos_relevantes AS (
      SELECT
        c.base_id,
        c.assunto,
        COUNT(*) as freq
      FROM cards c
      CROSS JOIN palavras p
      WHERE
        c.base_id IS NOT NULL
        AND c.assunto IS NOT NULL
        AND (
          lower(c.assunto) LIKE '%' || p.palavra || '%'
          OR lower(c.pergunta) LIKE '%' || p.palavra || '%'
        )
        AND length(p.palavra) > 2  -- ignora palavras muito pequenas
      GROUP BY c.base_id, c.assunto
    ),
    bases_rankeadas AS (
      SELECT
        base_id,
        SUM(freq) as relevance_score,
        ARRAY_AGG(DISTINCT assunto) as assuntos_relacionados
      FROM assuntos_relevantes
      GROUP BY base_id
    )
    SELECT
      base_id,
      relevance_score,
      assuntos_relacionados
    FROM bases_rankeadas
    ORDER BY relevance_score DESC
    LIMIT max_bases;
  $function$
;

CREATE OR REPLACE FUNCTION public.auto_select_bases_by_question(query_embedding vector, match_threshold double precision DEFAULT 0.5, max_bases integer DEFAULT 3)
 RETURNS TABLE(base_id uuid, relevance_score double precision, assuntos_relacionados text[])
 LANGUAGE sql
AS $function$
    WITH cards_similares AS (
      SELECT
        base_id,
        assunto,
        1 - (embedding <#> query_embedding) as similarity
      FROM cards
      WHERE
        embedding IS NOT NULL
        AND base_id IS NOT NULL
      ORDER BY embedding <#> query_embedding
      LIMIT 100  -- Limita a busca inicial para performance
    ),
    cards_relevantes AS (
      SELECT *
      FROM cards_similares
      WHERE similarity > match_threshold
    ),
    bases_relevantes AS (
      SELECT
        base_id,
        AVG(similarity) as relevance_score,
        ARRAY_AGG(DISTINCT assunto) FILTER (WHERE assunto IS NOT NULL) as assuntos_relacionados,
        COUNT(*) as cards_count
      FROM cards_relevantes
      GROUP BY base_id
      HAVING COUNT(*) > 0
    )
    SELECT
      base_id,
      relevance_score,
      assuntos_relacionados
    FROM bases_relevantes
    ORDER BY relevance_score DESC, cards_count DESC
    LIMIT max_bases;
  $function$
;

CREATE OR REPLACE FUNCTION public.auto_select_bases_by_question_simple(query_embedding vector, match_threshold double precision DEFAULT 0.7, max_bases integer DEFAULT 3)
 RETURNS TABLE(base_id uuid, relevance_score double precision)
 LANGUAGE sql
AS $function$
    SELECT
      base_id,
      AVG(1 - (embedding <#> query_embedding)) as relevance_score
    FROM cards
    WHERE
      embedding IS NOT NULL
      AND base_id IS NOT NULL
      AND (1 - (embedding <#> query_embedding)) > match_threshold
    GROUP BY base_id
    ORDER BY relevance_score DESC
    LIMIT max_bases;
  $function$
;

CREATE OR REPLACE FUNCTION public.determinar_dominio_script(p_equipe_id uuid, p_pasta_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  -- Equipe 2.3.2 → sempre externo
  IF p_equipe_id = '11111111-1111-1111-1111-111111111111' THEN 
    RETURN 'externo'; 
  END IF;

  -- Equipe 2.2.2, verificar se está na pasta Advogados (recursivo)
  IF p_equipe_id = '2299bffb-48ce-45eb-9e46-bcbc4d15c964' THEN
    IF p_pasta_id IS NOT NULL AND EXISTS (
      WITH RECURSIVE ancestors AS (
        SELECT id, pasta_pai_id, nome FROM pastas_scripts WHERE id = p_pasta_id
        UNION ALL
        SELECT p.id, p.pasta_pai_id, p.nome 
        FROM pastas_scripts p 
        JOIN ancestors a ON p.id = a.pasta_pai_id
      )
      SELECT 1 FROM ancestors WHERE LOWER(nome) = 'advogados'
    ) THEN 
      RETURN 'externo'; 
    END IF;
  END IF;

  -- Demais equipes (2.3.1, 2.2.1, 2.2.2 sem Advogados) → interno
  RETURN 'interno';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.match_cards_multiplas_bases(query_embedding vector, base_ids_param uuid[], match_threshold double precision, match_count integer)
 RETURNS TABLE(id uuid, pergunta text, resposta text, origem text, assunto text, similarity double precision)
 LANGUAGE sql
AS $function$
  with candidatos as (
    select *
    from cards
    where
      embedding is not null
      and base_id = any(base_ids_param)
    order by criado_em desc
    limit 500
  )
  select
    id,
    pergunta,
    resposta,
    origem,
    assunto,
    1 - (embedding <#> query_embedding) as similarity
  from candidatos
  where (1 - (embedding <#> query_embedding)) > match_threshold
  order by embedding <#> query_embedding
  limit match_count;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_categorias_por_dominio(p_dominio text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_equipe_ids UUID[];
BEGIN
  IF p_dominio = 'externo' THEN
    v_equipe_ids := ARRAY['11111111-1111-1111-1111-111111111111'::UUID];
  ELSIF p_dominio = 'interno' THEN
    v_equipe_ids := ARRAY[
      '22222222-2222-2222-2222-222222222222'::UUID,
      '90c2ed6a-bf56-4081-b4d6-63f37855ec12'::UUID
    ];
  ELSE
    v_equipe_ids := ARRAY[
      '11111111-1111-1111-1111-111111111111'::UUID,
      '22222222-2222-2222-2222-222222222222'::UUID,
      '90c2ed6a-bf56-4081-b4d6-63f37855ec12'::UUID
    ];
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(cat_obj ORDER BY cat_ordem, cat_nome), '[]'::JSONB)
    FROM (
      SELECT DISTINCT ON (ce.slug)
        ce.slug AS cat_slug,
        ce.nome AS cat_nome,
        COALESCE(ce.icone, '🏷️') AS cat_icone,
        COALESCE(ce.cor_hex, '#6B7280') AS cat_cor,
        COALESCE(ce.ordem_exibicao, 99) AS cat_ordem,
        jsonb_build_object(
          'slug', ce.slug,
          'nome', ce.nome,
          'icone', COALESCE(ce.icone, '🏷️'),
          'cor_hex', COALESCE(ce.cor_hex, '#6B7280'),
          'ordem', COALESCE(ce.ordem_exibicao, 99),
          'subcategorias', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('slug', s.slug, 'nome', s.nome) ORDER BY s.slug)
            FROM (
              SELECT DISTINCT ON (sub.slug) sub.slug, sub.nome
              FROM subcategorias_gse sub
              INNER JOIN categorias_gse cg ON cg.id = sub.categoria_gse_id
              INNER JOIN categorias_equipe ce2 ON ce2.id = cg.categoria_equipe_id
              WHERE ce2.slug = ce.slug
                AND ce2.equipe_id = ANY(v_equipe_ids)
                AND sub.ativo = TRUE
                AND cg.ativo = TRUE
              ORDER BY sub.slug, sub.nome
            ) s
          ), '[]'::JSONB)
        ) AS cat_obj
      FROM categorias_equipe ce
      WHERE ce.equipe_id = ANY(v_equipe_ids)
        AND ce.ativo = TRUE
      ORDER BY ce.slug, ce.ordem_exibicao
    ) cats
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_contagem_tickets_pendentes_periodo(p_periodo text, p_dias integer DEFAULT NULL::integer, p_status text[] DEFAULT NULL::text[], p_gse text DEFAULT NULL::text, p_usuario text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_total BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO v_total
  FROM oraculo_chamados c
  WHERE
    (p_dias IS NULL OR c.data_abertura >= CURRENT_DATE - (p_dias || ' days')::INTERVAL)
    AND CASE
      WHEN p_dias IS NULL OR p_dias > 90 THEN TO_CHAR(c.data_abertura, 'Mon/YY')
      WHEN p_dias > 30 THEN TO_CHAR(c.data_abertura, 'DD/Mon')
      ELSE TO_CHAR(c.data_abertura, 'DD/MM')
    END = p_periodo
    AND c.status_operacional NOT IN ('Fechado', 'Aguardando Aceite Definitivo')
    AND (p_status IS NULL OR c.status_operacional = ANY(p_status))
    AND (p_gse IS NULL OR c.grupo_designado = p_gse)
    AND (p_usuario IS NULL OR INITCAP(TRIM(c.nome_designado)) = p_usuario);

  RETURN v_total;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_contagem_tickets_por_equipe_status(p_equipe text, p_status text[] DEFAULT NULL::text[], p_grupo_designado text DEFAULT NULL::text, p_nome_designado text DEFAULT NULL::text, p_dias integer DEFAULT NULL::integer, p_modo text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_total BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO v_total
  FROM oraculo_chamados c
  WHERE
    (
      (p_modo IS NULL AND c.designado_localizacao = p_equipe)
      OR
      (p_modo IN ('externo', 'vazio') AND c.grupo_designado IN (
        SELECT ge.gse
        FROM public.gse_equipes ge
        JOIN public.equipes e ON ge.equipe_id = e.id
        WHERE e.sgs_codigo = p_equipe
      ))
    )
    AND (p_status IS NULL          OR c.status_operacional = ANY(p_status))
    AND (p_grupo_designado IS NULL OR c.grupo_designado    = p_grupo_designado)
    AND (
      p_modo = 'externo' AND COALESCE(c.atendido_externo, FALSE) = TRUE
                         AND c.nome_designado IS NOT NULL AND TRIM(c.nome_designado) <> ''
      OR p_modo = 'vazio' AND (c.nome_designado IS NULL OR TRIM(c.nome_designado) = '')
      OR p_modo IS NULL   AND (
        p_nome_designado IS NULL
        OR (p_nome_designado = '(Sem usuário)' AND (c.nome_designado IS NULL OR TRIM(c.nome_designado) = ''))
        OR (p_nome_designado <> '(Sem usuário)' AND LOWER(TRIM(c.nome_designado)) = LOWER(TRIM(p_nome_designado)))
      )
    )
    AND (p_dias IS NULL            OR c.data_abertura >= CURRENT_DATE - p_dias);

  RETURN COALESCE(v_total, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_contagem_tickets_por_equipe_status(p_equipe text, p_status text, p_grupo_designado text DEFAULT NULL::text, p_dias integer DEFAULT NULL::integer)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_total BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO v_total
  FROM oraculo_chamados c
  WHERE c.designado_localizacao = p_equipe
    AND c.status_operacional    = p_status
    AND (p_grupo_designado IS NULL OR c.grupo_designado = p_grupo_designado)
    AND (p_dias IS NULL OR c.data_abertura >= CURRENT_DATE - p_dias);

  RETURN COALESCE(v_total, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_contagem_tickets_por_respondente_status_drill(p_nome_designado text, p_status text[] DEFAULT NULL::text[], p_grupo_designado text DEFAULT NULL::text, p_dias integer DEFAULT NULL::integer)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_total BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO v_total
  FROM oraculo_chamados c
  WHERE LOWER(TRIM(c.nome_designado)) = LOWER(TRIM(p_nome_designado))
    AND (p_status          IS NULL OR c.status_operacional = ANY(p_status))
    AND (p_grupo_designado IS NULL OR c.grupo_designado    = p_grupo_designado)
    AND (p_dias            IS NULL OR c.data_abertura >= CURRENT_DATE - p_dias);

  RETURN COALESCE(v_total, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_contagem_tickets_rejeite_por_equipe_sgs(p_equipe text, p_grupo_designado text DEFAULT NULL::text, p_dias integer DEFAULT NULL::integer, p_status_operacional text[] DEFAULT NULL::text[], p_nome_designado text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_total BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO v_total
  FROM oraculo_chamados c
  WHERE
    c.designado_localizacao = p_equipe
    AND c.qtd_rejeite > 0
    AND (p_grupo_designado IS NULL OR c.grupo_designado = p_grupo_designado)
    AND (p_dias IS NULL OR c.data_abertura >= CURRENT_DATE - (p_dias || ' days')::INTERVAL)
    AND (p_status_operacional IS NULL OR c.status_operacional = ANY(p_status_operacional))
    AND (p_nome_designado IS NULL OR LOWER(TRIM(c.nome_designado)) = LOWER(TRIM(p_nome_designado)));

  RETURN COALESCE(v_total, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_filtros_pendentes_periodo(p_periodo text, p_dias integer DEFAULT NULL::integer)
 RETURNS TABLE(tipo text, valor text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  -- Status operacionais distintos
  RETURN QUERY
  SELECT 'status'::TEXT AS tipo, c.status_operacional AS valor
  FROM oraculo_chamados c
  WHERE
    (p_dias IS NULL OR c.data_abertura >= CURRENT_DATE - (p_dias || ' days')::INTERVAL)
    AND CASE
      WHEN p_dias IS NULL OR p_dias > 90 THEN TO_CHAR(c.data_abertura, 'Mon/YY')
      WHEN p_dias > 30 THEN TO_CHAR(c.data_abertura, 'DD/Mon')
      ELSE TO_CHAR(c.data_abertura, 'DD/MM')
    END = p_periodo
    AND c.status_operacional NOT IN ('Fechado', 'Aguardando Aceite Definitivo')
  GROUP BY c.status_operacional
  ORDER BY c.status_operacional;

  -- GSEs distintos
  RETURN QUERY
  SELECT 'gse'::TEXT AS tipo, c.grupo_designado AS valor
  FROM oraculo_chamados c
  WHERE
    (p_dias IS NULL OR c.data_abertura >= CURRENT_DATE - (p_dias || ' days')::INTERVAL)
    AND CASE
      WHEN p_dias IS NULL OR p_dias > 90 THEN TO_CHAR(c.data_abertura, 'Mon/YY')
      WHEN p_dias > 30 THEN TO_CHAR(c.data_abertura, 'DD/Mon')
      ELSE TO_CHAR(c.data_abertura, 'DD/MM')
    END = p_periodo
    AND c.status_operacional NOT IN ('Fechado', 'Aguardando Aceite Definitivo')
    AND c.grupo_designado IS NOT NULL
    AND c.grupo_designado != ''
  GROUP BY c.grupo_designado
  ORDER BY c.grupo_designado;

  -- Usuários/designados distintos
  RETURN QUERY
  SELECT 'usuario'::TEXT AS tipo, INITCAP(TRIM(c.nome_designado)) AS valor
  FROM oraculo_chamados c
  WHERE
    (p_dias IS NULL OR c.data_abertura >= CURRENT_DATE - (p_dias || ' days')::INTERVAL)
    AND CASE
      WHEN p_dias IS NULL OR p_dias > 90 THEN TO_CHAR(c.data_abertura, 'Mon/YY')
      WHEN p_dias > 30 THEN TO_CHAR(c.data_abertura, 'DD/Mon')
      ELSE TO_CHAR(c.data_abertura, 'DD/MM')
    END = p_periodo
    AND c.status_operacional NOT IN ('Fechado', 'Aguardando Aceite Definitivo')
    AND c.nome_designado IS NOT NULL
    AND TRIM(c.nome_designado) != ''
  GROUP BY INITCAP(TRIM(c.nome_designado))
  ORDER BY INITCAP(TRIM(c.nome_designado));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_tickets_pendentes_periodo(p_periodo text, p_dias integer DEFAULT NULL::integer, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_status text[] DEFAULT NULL::text[], p_gse text DEFAULT NULL::text, p_usuario text DEFAULT NULL::text)
 RETURNS TABLE(numero_chamado text, data_abertura date, grupo_designado text, descricao text, status_operacional text, nome_designado text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.numero_chamado,
    c.data_abertura,
    c.grupo_designado,
    LEFT(c.descricao, 200) as descricao,
    c.status_operacional,
    INITCAP(TRIM(c.nome_designado)) as nome_designado
  FROM oraculo_chamados c
  WHERE
    (p_dias IS NULL OR c.data_abertura >= CURRENT_DATE - (p_dias || ' days')::INTERVAL)
    AND CASE
      WHEN p_dias IS NULL OR p_dias > 90 THEN TO_CHAR(c.data_abertura, 'Mon/YY')
      WHEN p_dias > 30 THEN TO_CHAR(c.data_abertura, 'DD/Mon')
      ELSE TO_CHAR(c.data_abertura, 'DD/MM')
    END = p_periodo
    AND c.status_operacional NOT IN ('Fechado', 'Aguardando Aceite Definitivo')
    AND (p_status IS NULL OR c.status_operacional = ANY(p_status))
    AND (p_gse IS NULL OR c.grupo_designado = p_gse)
    AND (p_usuario IS NULL OR INITCAP(TRIM(c.nome_designado)) = p_usuario)
  ORDER BY c.data_abertura DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_tickets_por_categoria_hierarquica(p_dominio text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_equipe_ids UUID[];
BEGIN
  -- Determinar equipe_ids pelo domínio
  IF p_dominio = 'externo' THEN
    v_equipe_ids := ARRAY['11111111-1111-1111-1111-111111111111'::UUID];
  ELSIF p_dominio = 'interno' THEN
    v_equipe_ids := ARRAY[
      '22222222-2222-2222-2222-222222222222'::UUID,
      '90c2ed6a-bf56-4081-b4d6-63f37855ec12'::UUID
    ];
  ELSE
    v_equipe_ids := ARRAY[
      '11111111-1111-1111-1111-111111111111'::UUID,
      '22222222-2222-2222-2222-222222222222'::UUID,
      '90c2ed6a-bf56-4081-b4d6-63f37855ec12'::UUID
    ];
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'categoria_equipe_slug', agg.cat_slug,
        'subcategoria_gse_slug', agg.sub_slug,
        'total_tickets', agg.total
      )
    ), '[]'::JSONB)
    FROM (
      SELECT
        ce.slug AS cat_slug,
        COALESCE(sg.slug, '__sem_sub__') AS sub_slug,
        COUNT(*) AS total
      FROM ticket_analises ta
      INNER JOIN categorias_equipe ce ON ce.id = ta.categoria_equipe_id
      LEFT JOIN subcategorias_gse sg ON sg.id = ta.subcategoria_gse_id
      WHERE ta.categoria_equipe_id IS NOT NULL
        AND ce.equipe_id = ANY(v_equipe_ids)
      GROUP BY ce.slug, COALESCE(sg.slug, '__sem_sub__')
      ORDER BY ce.slug, sub_slug
    ) agg
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_tickets_por_equipe_status(p_equipe text, p_status text[] DEFAULT NULL::text[], p_grupo_designado text DEFAULT NULL::text, p_nome_designado text DEFAULT NULL::text, p_dias integer DEFAULT NULL::integer, p_modo text DEFAULT NULL::text, p_ordenacao text DEFAULT 'desc'::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(numero_chamado text, data_abertura date, grupo_designado text, nome_designado text, status_operacional text, atendido_externo boolean)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.numero_chamado,
    c.data_abertura::DATE,
    c.grupo_designado,
    CASE
      WHEN c.nome_designado IS NOT NULL AND TRIM(c.nome_designado) <> ''
        THEN INITCAP(TRIM(c.nome_designado))
      ELSE NULL
    END AS nome_designado,
    c.status_operacional,
    COALESCE(c.atendido_externo, FALSE) AS atendido_externo
  FROM oraculo_chamados c
  WHERE
    (
      (p_modo IS NULL AND c.designado_localizacao = p_equipe)
      OR
      (p_modo IN ('externo', 'vazio') AND c.grupo_designado IN (
        SELECT ge.gse
        FROM public.gse_equipes ge
        JOIN public.equipes e ON ge.equipe_id = e.id
        WHERE e.sgs_codigo = p_equipe
      ))
    )
    AND (p_status IS NULL               OR c.status_operacional = ANY(p_status))
    AND (p_grupo_designado IS NULL      OR c.grupo_designado    = p_grupo_designado)
    AND (
      p_modo = 'externo' AND COALESCE(c.atendido_externo, FALSE) = TRUE
                         AND c.nome_designado IS NOT NULL AND TRIM(c.nome_designado) <> ''
      OR p_modo = 'vazio' AND (c.nome_designado IS NULL OR TRIM(c.nome_designado) = '')
      OR p_modo IS NULL   AND (
        p_nome_designado IS NULL
        OR (p_nome_designado = '(Sem usuário)' AND (c.nome_designado IS NULL OR TRIM(c.nome_designado) = ''))
        OR (p_nome_designado <> '(Sem usuário)' AND LOWER(TRIM(c.nome_designado)) = LOWER(TRIM(p_nome_designado)))
      )
    )
    AND (p_dias IS NULL                 OR c.data_abertura >= CURRENT_DATE - p_dias)
  ORDER BY
    CASE WHEN p_ordenacao = 'asc'  THEN c.data_abertura END ASC,
    CASE WHEN p_ordenacao != 'asc' THEN c.data_abertura END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_tickets_por_equipe_status(p_equipe text, p_status text, p_grupo_designado text DEFAULT NULL::text, p_dias integer DEFAULT NULL::integer, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(numero_chamado text, data_abertura date, grupo_designado text, nome_designado text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.numero_chamado,
    c.data_abertura::DATE,
    c.grupo_designado,
    CASE
      WHEN c.nome_designado IS NOT NULL AND TRIM(c.nome_designado) <> ''
        THEN INITCAP(TRIM(c.nome_designado))
      ELSE NULL
    END AS nome_designado
  FROM oraculo_chamados c
  WHERE c.designado_localizacao = p_equipe
    AND c.status_operacional    = p_status
    AND (p_grupo_designado IS NULL OR c.grupo_designado = p_grupo_designado)
    AND (p_dias IS NULL OR c.data_abertura >= CURRENT_DATE - p_dias)
  ORDER BY c.data_abertura DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_tickets_por_respondente_status_drill(p_nome_designado text, p_status text[] DEFAULT NULL::text[], p_grupo_designado text DEFAULT NULL::text, p_dias integer DEFAULT NULL::integer, p_ordenacao text DEFAULT 'desc'::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(numero_chamado text, data_abertura date, grupo_designado text, nome_designado text, status_operacional text, atendido_externo boolean)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.numero_chamado,
    c.data_abertura::DATE,
    c.grupo_designado,
    CASE
      WHEN c.nome_designado IS NOT NULL AND TRIM(c.nome_designado) <> ''
        THEN INITCAP(TRIM(c.nome_designado))
      ELSE NULL
    END AS nome_designado,
    c.status_operacional,
    COALESCE(c.atendido_externo, FALSE) AS atendido_externo
  FROM oraculo_chamados c
  WHERE LOWER(TRIM(c.nome_designado)) = LOWER(TRIM(p_nome_designado))
    AND (p_status          IS NULL OR c.status_operacional = ANY(p_status))
    AND (p_grupo_designado IS NULL OR c.grupo_designado    = p_grupo_designado)
    AND (p_dias            IS NULL OR c.data_abertura >= CURRENT_DATE - p_dias)
  ORDER BY
    CASE WHEN p_ordenacao = 'asc'  THEN c.data_abertura END ASC,
    CASE WHEN p_ordenacao != 'asc' THEN c.data_abertura END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_tickets_rejeite_por_equipe_sgs(p_equipe text, p_grupo_designado text DEFAULT NULL::text, p_dias integer DEFAULT NULL::integer, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_ordenacao text DEFAULT 'desc'::text, p_status_operacional text[] DEFAULT NULL::text[], p_nome_designado text DEFAULT NULL::text)
 RETURNS TABLE(numero_chamado text, data_abertura date, grupo_designado text, descricao text, qtd_rejeite integer, status_operacional text, nome_designado text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.numero_chamado,
    c.data_abertura,
    c.grupo_designado,
    LEFT(c.descricao, 200) AS descricao,
    c.qtd_rejeite::INT,
    c.status_operacional,
    INITCAP(TRIM(c.nome_designado)) AS nome_designado
  FROM oraculo_chamados c
  WHERE
    c.designado_localizacao = p_equipe
    AND c.qtd_rejeite > 0
    AND (p_grupo_designado IS NULL OR c.grupo_designado = p_grupo_designado)
    AND (p_dias IS NULL OR c.data_abertura >= CURRENT_DATE - (p_dias || ' days')::INTERVAL)
    AND (p_status_operacional IS NULL OR c.status_operacional = ANY(p_status_operacional))
    AND (p_nome_designado IS NULL OR LOWER(TRIM(c.nome_designado)) = LOWER(TRIM(p_nome_designado)))
  ORDER BY
    CASE WHEN p_ordenacao = 'desc' THEN c.qtd_rejeite END DESC,
    CASE WHEN p_ordenacao = 'asc'  THEN c.qtd_rejeite END ASC,
    c.data_abertura DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_top_usuarios_email(p_limit integer DEFAULT 10, p_grupo_designado text DEFAULT NULL::text)
 RETURNS TABLE(email text, total_chamados bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT 
    c.email,
    COUNT(*)::BIGINT AS total_chamados
  FROM oraculo_chamados c
  WHERE c.email IS NOT NULL 
    AND c.email != ''
    AND (p_grupo_designado IS NULL OR c.grupo_designado = p_grupo_designado)
  GROUP BY c.email
  ORDER BY total_chamados DESC
  LIMIT p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.smart_base_selection(question_text text, max_bases integer DEFAULT 3)
 RETURNS TABLE(base_id uuid, relevance_score numeric, match_type text)
 LANGUAGE sql
AS $function$
    WITH expanded_query AS (
      SELECT expand_query_terms(question_text) as query
    ),
    keyword_matches AS (
      SELECT
        c.base_id,
        COUNT(*) * 2 as score,
        'keyword' as match_type
      FROM cards c, expanded_query eq
      WHERE c.base_id IS NOT NULL
      AND (
        lower(c.pergunta) SIMILAR TO '%(' || replace(lower(eq.query), ' ', '|') || ')%'
        OR lower(c.resposta) SIMILAR TO '%(' || replace(lower(eq.query), ' ', '|') || ')%'
      )
      GROUP BY c.base_id
    ),
    semantic_matches AS (
      SELECT
        c.base_id,
        COUNT(*) as score,
        'semantic' as match_type
      FROM cards c
      WHERE c.base_id IS NOT NULL
      AND to_tsvector('portuguese', c.pergunta || ' ' || c.resposta)
          @@ plainto_tsquery('portuguese', question_text)
      GROUP BY c.base_id
    )
    SELECT
      base_id,
      SUM(score) as relevance_score,
      string_agg(DISTINCT match_type, '+') as match_type
    FROM (
      SELECT * FROM keyword_matches
      UNION ALL
      SELECT * FROM semantic_matches
    ) combined
    GROUP BY base_id
    ORDER BY relevance_score DESC
    LIMIT max_bases;
  $function$
;

CREATE OR REPLACE FUNCTION public.subcategorias_contar_por_categoria()
 RETURNS TABLE(categoria_slug text, total bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    ta.categoria_slug,
    COUNT(*) as total
  FROM ticket_analises ta
  WHERE ta.categoria_slug IS NOT NULL
    AND ta.categoria_slug <> 'indefinido'
    AND ta.categoria_origem = 'ia'
  GROUP BY ta.categoria_slug
  ORDER BY total DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.subcategorias_listar(p_categoria_slug text)
 RETURNS TABLE(id uuid, slug text, nome text, descricao text, sinonimos text[], total_tickets bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    sc.id,
    sc.slug,
    sc.nome,
    sc.descricao,
    sc.sinonimos,
    COALESCE(counts.total, 0) as total_tickets
  FROM subcategorias_chamado sc
  LEFT JOIN (
    SELECT subcategoria_slug, COUNT(*) as total
    FROM ticket_analises
    WHERE categoria_slug = p_categoria_slug
      AND subcategoria_slug IS NOT NULL
    GROUP BY subcategoria_slug
  ) counts ON counts.subcategoria_slug = sc.slug
  WHERE sc.categoria_slug = p_categoria_slug
  ORDER BY COALESCE(counts.total, 0) DESC, sc.nome;
$function$
;

CREATE OR REPLACE FUNCTION public.subcategorias_listar_tickets_categorizados(p_categoria text DEFAULT NULL::text, p_limite integer DEFAULT NULL::integer)
 RETURNS TABLE(ticket_id uuid, numero_chamado text, categoria_slug text, categoria_confianca numeric, descricao text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    ta.ticket_id,
    ta.numero_chamado,
    ta.categoria_slug,
    ta.categoria_confianca,
    COALESCE(t.descricao, '') as descricao
  FROM ticket_analises ta
  LEFT JOIN public.tickets t ON t.id = ta.ticket_id
  WHERE ta.categoria_slug IS NOT NULL
    AND ta.categoria_slug <> 'indefinido'
    AND ta.categoria_origem = 'ia'
    AND (p_categoria IS NULL OR ta.categoria_slug = p_categoria)
  ORDER BY ta.categoria_slug, ta.numero_chamado
  LIMIT p_limite;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_script_categoria_hierarquica()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'distribuidor'
AS $function$
DECLARE
  v_cat_slug TEXT;
  v_subcat_slug TEXT;
  v_dominio TEXT;
BEGIN
  -- Extrair campos conforme a tabela de origem
  IF TG_TABLE_NAME = 'scripts_customizados' THEN
    v_cat_slug := NEW.categoria_equipe_slug;
    v_subcat_slug := NEW.subcategoria_gse_slug;
    v_dominio := NEW.dominio;
  ELSE -- scripts_categorias_adicionais
    v_cat_slug := NEW.categoria_equipe_slug;
    v_subcat_slug := NEW.subcategoria_gse_slug;
    -- Buscar domínio do script pai
    SELECT dominio INTO v_dominio 
    FROM scripts_customizados 
    WHERE id = NEW.script_id;
  END IF;

  -- Se categoria é NULL, não validar (script sem classificação)
  IF v_cat_slug IS NULL THEN
    -- Subcategoria não pode existir sem categoria
    IF v_subcat_slug IS NOT NULL THEN
      RAISE EXCEPTION 'subcategoria_gse_slug não pode ser definido sem categoria_equipe_slug';
    END IF;
    RETURN NEW;
  END IF;

  -- Validar categoria contra equipes do domínio
  IF v_dominio = 'externo' THEN
    IF NOT EXISTS (
      SELECT 1 FROM categorias_equipe
      WHERE slug = v_cat_slug
        AND equipe_id = '11111111-1111-1111-1111-111111111111'
        AND ativo = TRUE
    ) THEN
      RAISE EXCEPTION 'Categoria "%" inválida no domínio externo (equipe 2.3.2)', v_cat_slug;
    END IF;
  ELSIF v_dominio = 'interno' THEN
    IF NOT EXISTS (
      SELECT 1 FROM categorias_equipe
      WHERE slug = v_cat_slug
        AND equipe_id IN (
          '22222222-2222-2222-2222-222222222222',  -- 2.3.1
          '90c2ed6a-bf56-4081-b4d6-63f37855ec12'   -- 2.2.1
        )
        AND ativo = TRUE
    ) THEN
      RAISE EXCEPTION 'Categoria "%" inválida no domínio interno (equipes 2.3.1/2.2.1)', v_cat_slug;
    END IF;
  ELSIF v_dominio IS NULL THEN
    -- Se domínio é NULL mas categoria não é, validar genericamente 
    -- (aceita qualquer equipe — para scripts sem domínio definido)
    IF NOT EXISTS (
      SELECT 1 FROM categorias_equipe
      WHERE slug = v_cat_slug AND ativo = TRUE
    ) THEN
      RAISE EXCEPTION 'Categoria "%" não encontrada em nenhuma equipe', v_cat_slug;
    END IF;
  END IF;

  -- Validar subcategoria na categoria (se informada)
  IF v_subcat_slug IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM subcategorias_gse sg
      JOIN categorias_gse cg ON cg.id = sg.categoria_gse_id
      JOIN categorias_equipe ce ON ce.id = cg.categoria_equipe_id
      WHERE sg.slug = v_subcat_slug 
        AND ce.slug = v_cat_slug 
        AND sg.ativo = TRUE
    ) THEN
      RAISE EXCEPTION 'Subcategoria "%" inválida na categoria "%"', v_subcat_slug, v_cat_slug;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;






-- ═══════════════════════════════════════════════════
-- SEÇÃO 7: 3 índices public faltantes
-- ═══════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_scripts_cat_adicional_equipe_slug ON public.scripts_categorias_adicionais USING btree (categoria_equipe_slug, subcategoria_gse_slug);
CREATE INDEX IF NOT EXISTS idx_scripts_subcat_gse ON public.scripts_customizados USING btree (categoria_equipe_slug, subcategoria_gse_slug) WHERE (deletado IS NOT TRUE);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scripts_cat_adicional_hierarquica ON public.scripts_categorias_adicionais USING btree (script_id, categoria_equipe_slug, subcategoria_gse_slug);
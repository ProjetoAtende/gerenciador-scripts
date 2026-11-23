-- Dados FICTÍCIOS do projeto de TESTES — rodar só via seed-testes.mjs (que trava na produção).
--
-- Usa as RPCs do próprio app, "vestindo" cada usuário de teste (request.jwt.claims),
-- para que perfis, designações, histórico e status saiam exatamente como no uso real.
-- Números de processo: série fictícia 99001xx/2026, com dígito verificador válido.
-- Idempotente: se já houver anotações da série 99001xx, não cria de novo.

BEGIN;

CREATE FUNCTION pg_temp.uid(p_email text) RETURNS uuid LANGUAGE sql AS
$$ SELECT id FROM public.users WHERE email = p_email $$;

CREATE FUNCTION pg_temp.como(p_email text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pg_temp.uid(p_email) IS NULL THEN
    RAISE EXCEPTION 'Usuário de teste inexistente: %', p_email;
  END IF;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(p_email), 'role', 'authenticated', 'email', p_email)::text, true);
END $$;

CREATE FUNCTION pg_temp.ok(p jsonb, p_passo text) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE((p->>'sucesso')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION '% falhou: %', p_passo, p;
  END IF;
  RETURN p;
END $$;

CREATE FUNCTION pg_temp.upj(p_codigo text) RETURNS uuid LANGUAGE sql AS
$$ SELECT id FROM public.prioridades_upjs WHERE codigo = p_codigo $$;

-- Cria uma anotação como `p_email` e devolve o id.
CREATE FUNCTION pg_temp.anotar(p_email text, p_processo text, p_vara int, p_upj text, p_plataforma text,
                              p_categoria text, p_tipo text, p_solicitante text, p_evento text,
                              p_resumo text, p_descricao text, p_obs text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.como(p_email);
  r := pg_temp.ok(public.prioridades_criar_anotacao(jsonb_build_object(
    'processo', p_processo, 'vara', p_vara, 'upj_id', pg_temp.upj(p_upj), 'plataforma', p_plataforma,
    'categoria', p_categoria, 'tipo_prioridade', p_tipo, 'tipo_solicitante', p_solicitante,
    'evento_folha', p_evento, 'descricao_prioridade', p_descricao,
    -- O resumo também preenche a descrição exigida quando o tipo é "Outros".
    'descricao_tipo_outros', CASE WHEN p_tipo = 'outros' THEN p_resumo END,
    'descricao_solicitante', CASE WHEN p_solicitante = 'outros' THEN 'Parente da parte, sem procuração' END,
    'observacao_adicional_atende', p_obs,
    'validacao_djen_status', 'nao_consultado')), 'criar ' || p_processo);
  -- Etapa 2 (item G): "Descrição Resumida" (coluna nova; a função da v1 não a recebe).
  UPDATE public.prioridades_anotacoes SET descricao_resumida = left(p_resumo, 100)
  WHERE id = (r->>'anotacao_id')::bigint;
  RETURN (r->>'anotacao_id')::bigint;
END $$;

CREATE FUNCTION pg_temp.conferir(p_id bigint, p_decisao text, p_just text DEFAULT NULL, p_urg boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.como('gestor.teste@example.com');
  PERFORM pg_temp.ok(public.prioridades_conferir(p_id, p_decisao, p_just, p_urg), format('conferir %s (%s)', p_id, p_decisao));
END $$;

CREATE FUNCTION pg_temp.analisar(p_email text, p_id bigint, p_decisao text, p_obs text, p_just text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.como(p_email);
  PERFORM pg_temp.ok(public.prioridades_analisar(p_id, p_decisao, p_obs, p_just), format('analisar %s (%s)', p_id, p_decisao));
END $$;

DO $$
DECLARE
  a bigint;
BEGIN
  -- ── 1. Perfis (admin provisiona os perfis base; gestor e coordenador designam) ──
  PERFORM pg_temp.como('admin.teste@example.com');
  PERFORM pg_temp.ok(public.prioridades_designar(pg_temp.uid('gestor.teste@example.com'), 'gestor'), 'perfil gestor');
  PERFORM pg_temp.ok(public.prioridades_designar(pg_temp.uid('atendente.teste@example.com'), 'atendente'), 'perfil atendente');
  PERFORM pg_temp.ok(public.prioridades_designar(pg_temp.uid('atendente2.teste@example.com'), 'atendente'), 'perfil atendente2');
  PERFORM pg_temp.ok(public.prioridades_designar(pg_temp.uid('coord.upj9.teste@example.com'), 'coordenador', CURRENT_DATE, NULL, pg_temp.upj('FCC-11-15')), 'perfil coord IX');
  PERFORM pg_temp.ok(public.prioridades_designar(pg_temp.uid('coord.upj6.teste@example.com'), 'coordenador', CURRENT_DATE, NULL, pg_temp.upj('FCC-01-05')), 'perfil coord VI');

  PERFORM pg_temp.como('gestor.teste@example.com');
  PERFORM pg_temp.ok(public.prioridades_designar(pg_temp.uid('conferente.teste@example.com'), 'conferente'), 'designar conferente');

  PERFORM pg_temp.como('coord.upj9.teste@example.com');
  PERFORM pg_temp.ok(public.prioridades_designar(pg_temp.uid('analista.upj9.teste@example.com'), 'analista', CURRENT_DATE, NULL, pg_temp.upj('FCC-11-15')), 'designar analista IX');

  IF EXISTS (SELECT 1 FROM public.prioridades_anotacoes WHERE processo LIKE '99001%') THEN
    RAISE NOTICE 'Anotações fictícias já existem; nada criado.';
    RETURN;
  END IF;

  -- ── 2. Anotações em vários pontos do fluxo ──
  -- Nova + Urgentíssima (UPJ IX)
  a := pg_temp.anotar('atendente.teste@example.com', '99001013920268260100', 14, 'FCC-11-15', 'saj', 'mle', 'urgencia-determinada', 'autor-exequente', '326',
       'Honorários advocatícios',
       'A decisão determinou o levantamento imediato do valor por se tratar de quantia incontroversa, mas o agendamento saiu sem o localizador "MLE - Imediata"; favor verificar.',
       'O advogado informou que acionará a Corregedoria se o MLE não sair nesta semana.');
  PERFORM pg_temp.conferir(a, 'aprovar', NULL, true);

  -- Em análise (UPJ IX)
  a := pg_temp.anotar('atendente.teste@example.com', '99001022420268260100', 12, 'FCC-11-15', 'eproc', 'movimentacao', 'prazo-excedido', 'perito-leiloeiro', '88',
       'Intimação do perito', 'Prazo previsto para cumprimento excedido: intimar o perito nomeado, decisão de julho/2026.');
  PERFORM pg_temp.conferir(a, 'aprovar');
  PERFORM pg_temp.como('coord.upj9.teste@example.com');
  PERFORM pg_temp.ok(public.prioridades_marcar_em_analise(a), 'marcar em análise');

  -- Reiterada: duas anotações do mesmo processo na fila da UPJ IX
  a := pg_temp.anotar('atendente2.teste@example.com', '99001030920268260100', 13, 'FCC-11-15', 'eproc', 'sisbajud', 'urgencia-determinada', 'reu-executado', '41',
       'Desbloqueio de valores', 'Desbloqueio de valores reconhecidos impenhoráveis determinado "com urgência".');
  PERFORM pg_temp.conferir(a, 'aprovar');
  a := pg_temp.anotar('atendente.teste@example.com', '99001030920268260100', 13, 'FCC-11-15', 'eproc', 'sisbajud', 'urgencia-determinada', 'reu-executado', '41',
       'Desbloqueio de valores (reiteração)', 'A parte retornou: o desbloqueio ainda não foi cumprido.');
  PERFORM pg_temp.conferir(a, 'aprovar');

  -- Nova na UPJ VI
  a := pg_temp.anotar('atendente2.teste@example.com', '99001049120268260100', 4, 'FCC-01-05', 'saj', 'expedicao', 'fora-localizador', 'autor-exequente', 'fls. 210',
       'Ofício ao INSS', 'O ofício ao INSS foi determinado há 40 dias e o processo está fora do localizador de expedição.');
  PERFORM pg_temp.conferir(a, 'aprovar');

  -- Nova criada direto pelo Gestor (vai direto à UPJ IX)
  a := pg_temp.anotar('gestor.teste@example.com', '99001135320268260100', 11, 'FCC-11-15', 'eproc', 'publicacao', 'erro-material', 'terceiro-interessado', '57',
       'Publicação com nome errado', 'A publicação do evento 57 saiu com o nome do advogado grafado de forma errada.');

  -- Resolvida (UPJ IX, pelo Analista)
  a := pg_temp.anotar('atendente.teste@example.com', '99001057620268260100', 11, 'FCC-11-15', 'eproc', 'publicacao', 'prioridade-idoso', 'autor-exequente', '12',
       'Prioridade de idoso', 'Parte com 82 anos; pedido de tramitação prioritária deferido e não anotado.');
  PERFORM pg_temp.conferir(a, 'aprovar');
  PERFORM pg_temp.analisar('analista.upj9.teste@example.com', a, 'resolver', 'Tarja de prioridade incluída e processo remetido à conclusão.');

  -- Rejeitada pela UPJ IX
  a := pg_temp.anotar('atendente2.teste@example.com', '99001066120268260100', 15, 'FCC-11-15', 'saj', 'cadastro', 'outros', 'autor-exequente', 'fls. 3',
       'Endereço desatualizado', 'A parte pede atualização do próprio endereço no cadastro.');
  PERFORM pg_temp.conferir(a, 'aprovar');
  PERFORM pg_temp.analisar('coord.upj9.teste@example.com', a, 'rejeitar', NULL, 'Atualização de endereço deve ser pedida por petição nos autos.');

  -- Retornada pela UPJ IX
  a := pg_temp.anotar('atendente.teste@example.com', '99001074620268260100', 12, 'FCC-11-15', 'eproc', 'audiencias', 'medico-saude', 'reu-executado', '102',
       'Redesignar audiência', 'Réu internado; pede redesignação da audiência de 25/11/2026 (atestado no evento 102).');
  PERFORM pg_temp.conferir(a, 'aprovar');
  PERFORM pg_temp.analisar('coord.upj9.teste@example.com', a, 'devolver', NULL, 'O atestado juntado não tem CRM legível; confirmar com o solicitante.');

  -- Devolvida pelo Gestor ao Atendente
  a := pg_temp.anotar('atendente.teste@example.com', '99001083120268260100', 18, 'FCC-16-20', 'saj', 'mle', 'urgencia-determinada', 'autor-exequente', 'fls. 455',
       'Levantamento de depósito', 'Pedido de urgência no levantamento do depósito judicial.');
  PERFORM pg_temp.conferir(a, 'devolver', 'Não localizei menção a "urgente" na decisão de fls. 455; confirme a folha.');

  -- Rejeitada pelo Gestor
  a := pg_temp.anotar('atendente2.teste@example.com', '99001091620268260100', 2, 'FCC-01-05', 'saj', 'movimentacao', 'outros', 'outros', 'fls. 88',
       'Andamento geral', 'Parte quer saber quando o processo vai andar.');
  PERFORM pg_temp.conferir(a, 'rejeitar', 'Pedido de andamento genérico não se enquadra como prioridade ou urgência.');

  -- Aguardando conferência
  PERFORM pg_temp.anotar('atendente.teste@example.com', '99001109820268260100', 14, 'FCC-11-15', 'eproc', 'pesquisas', 'prazo-excedido', 'autor-exequente', '230',
       'Pesquisa SISBAJUD/RENAJUD', 'Pesquisas patrimoniais deferidas há 60 dias e ainda não realizadas.');
  PERFORM pg_temp.anotar('atendente2.teste@example.com', '99001118320268260100', 21, 'FCC-21-25', 'saj', 'expedicao', 'prioridade-pcd', 'autor-exequente', 'fls. 77',
       'Prioridade PCD', 'Parte com deficiência; alvará pendente de expedição.');
  PERFORM pg_temp.anotar('atendente.teste@example.com', '99001126820268260100', 43, 'FCC-41-45', 'eproc', 'mle', 'urgencia-determinada', 'perito-leiloeiro', '19',
       'Honorários periciais', 'Decisão do evento 19 manda expedir MLE dos honorários periciais "com urgência".');
END $$;

-- Card da versão nova (v2) para todos os usuários de teste, se a permissão já existir.
INSERT INTO public.permissoes_grants (objeto_codigo, target_type, target_id)
SELECT 'home.card.prioridades_urgencias_v2', 'usuario', u.id::text
FROM public.users u
WHERE u.email LIKE '%.teste@example.com'
  AND EXISTS (SELECT 1 FROM public.permissoes_objetos o WHERE o.codigo = 'home.card.prioridades_urgencias_v2')
ON CONFLICT (objeto_codigo, target_type, target_id) DO NOTHING;

-- Resumo para conferência
SELECT a.status, count(*) AS quantidade,
       count(*) FILTER (WHERE a.urgentissimo OR a.urgentissimo_auto) AS urgentissimas,
       count(*) FILTER (WHERE a.reiterada) AS reiteradas
FROM public.prioridades_anotacoes a
WHERE a.processo LIKE '99001%'
GROUP BY a.status ORDER BY a.status;

COMMIT;

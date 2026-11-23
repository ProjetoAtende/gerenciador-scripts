-- Teste das funções da etapa 2 da v2 — SÓ no projeto de TESTES.
--
--   node_modules/supabase/bin/supabase db query --linked -f scripts/prioridades-v2/teste-etapa2.sql
--
-- Tudo roda dentro de um único bloco que termina com um erro proposital
-- ("RESULTADO: ..."): o erro DESFAZ tudo, então nada fica gravado no banco.
-- Se algum passo falhar, a mensagem diz qual. Usa os usuários de seed-testes.mjs.

DO $$
DECLARE
  r jsonb;
  v_id bigint;
  v_id2 bigint;
  v_txt text;
  v_ok text[] := ARRAY[]::text[];
  v_row public.prioridades_anotacoes%ROWTYPE;
  v_upj9 uuid := (SELECT id FROM public.prioridades_upjs WHERE codigo = 'FCC-11-15');
  v_upj6 uuid := (SELECT id FROM public.prioridades_upjs WHERE codigo = 'FCC-01-05');
  base jsonb := jsonb_build_object(
    'tipo_solicitante', 'autor-exequente', 'categoria', 'mle', 'tipo_prioridade', 'prazo-excedido',
    'evento_folha', '12', 'descricao_prioridade', 'Teste automático da etapa 2.');
BEGIN
  -- "Veste" um usuário de teste.
  CREATE TEMP TABLE IF NOT EXISTS _como (email text);
  PERFORM 1;

  -- ── C: competência pelo órgão atual ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM users WHERE email = 'atendente.teste@example.com'), 'role', 'authenticated')::text, true);

  r := public.prioridades_v2_criar_anotacao(base || jsonb_build_object('processo', '40005255120268260373'));
  IF (r->>'sucesso')::boolean OR NOT COALESCE((r->>'fora_competencia')::boolean, false) THEN
    RAISE EXCEPTION 'C1 falhou (0373 sem órgão deveria ser recusado): %', r;
  END IF;
  v_ok := array_append(v_ok, 'C1 Atendente: 0373 sem órgão conhecido é recusado');

  r := public.prioridades_v2_criar_anotacao(base || jsonb_build_object('processo', '41898681220268260100',
         'nome_orgao_djen', 'UPJ da 1ª a 4ª e 16ª Varas Cíveis - Regional II - Santo Amaro'));
  IF (r->>'sucesso')::boolean THEN RAISE EXCEPTION 'C2 falhou (Santo Amaro aceito): %', r; END IF;
  v_ok := array_append(v_ok, 'C2 Atendente: 0100 hoje em Santo Amaro é recusado');

  r := public.prioridades_v2_criar_anotacao(base || jsonb_build_object('processo', '40005255120268260373',
         'nome_orgao_djen', 'UPJ da 11ª a 15ª Varas Cíveis - Foro Central Cível', 'upj_id', v_upj9,
         'urgentissimo', true, 'descricao_resumida', 'Resumo do teste'));
  IF NOT (r->>'sucesso')::boolean THEN RAISE EXCEPTION 'C3 falhou (redistribuído à UPJ IX recusado): %', r; END IF;
  v_id := (r->>'anotacao_id')::bigint;
  SELECT * INTO v_row FROM prioridades_anotacoes WHERE id = v_id;
  IF v_row.urgentissimo THEN RAISE EXCEPTION 'D1 falhou: Atendente conseguiu marcar Urgentíssima'; END IF;
  IF v_row.descricao_resumida IS DISTINCT FROM 'Resumo do teste' THEN RAISE EXCEPTION 'G1 falhou: resumida = %', v_row.descricao_resumida; END IF;
  IF v_row.vara IS NOT NULL THEN RAISE EXCEPTION 'A1 falhou: Vara deveria ficar vazia'; END IF;
  v_ok := array_append(v_ok, 'C3 Atendente: 0373 hoje na UPJ IX é aceito (Vara vazia, sem Urgentíssima, com Resumida)');

  r := public.prioridades_v2_criar_anotacao(base || jsonb_build_object('processo', '99001013920268260100',
         'descricao_resumida', repeat('x', 101)));
  IF (r->>'sucesso')::boolean THEN RAISE EXCEPTION 'G2 falhou: aceitou 101 caracteres'; END IF;
  v_ok := array_append(v_ok, 'G2 Descrição Resumida com 101 caracteres é recusada');

  r := public.prioridades_v2_criar_anotacao(base || jsonb_build_object('processo', '99001013920268260100',
         'upj_id', v_upj9, 'vara', 3));
  IF (r->>'sucesso')::boolean THEN RAISE EXCEPTION 'A2 falhou: aceitou 3.ª Vara na UPJ IX'; END IF;
  v_ok := array_append(v_ok, 'A2 Vara fora da UPJ escolhida é recusada');

  -- ── A: Vara completada depois (só quem criou, só Vara vazia, só dentro da UPJ) ──
  r := public.prioridades_v2_completar_vara(v_id, 3, 'datajud', NULL);
  IF COALESCE((r->>'alterou')::boolean, false) THEN RAISE EXCEPTION 'A3 falhou: gravou 3.ª Vara na UPJ IX'; END IF;
  r := public.prioridades_v2_completar_vara(v_id, 13, 'datajud', 'eproc');
  SELECT * INTO v_row FROM prioridades_anotacoes WHERE id = v_id;
  IF v_row.vara IS DISTINCT FROM 13 OR v_row.vara_fonte IS DISTINCT FROM 'datajud' OR v_row.plataforma IS DISTINCT FROM 'eproc' THEN
    RAISE EXCEPTION 'A4 falhou: %', r;
  END IF;
  r := public.prioridades_v2_completar_vara(v_id, 14, 'datajud', NULL);
  IF COALESCE((r->>'alterou')::boolean, false) THEN RAISE EXCEPTION 'A5 falhou: sobrescreveu a Vara'; END IF;
  v_ok := array_append(v_ok, 'A3-A5 Completar Vara: recusa fora da UPJ, grava 13.ª + Eproc, não sobrescreve');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM users WHERE email = 'atendente2.teste@example.com'), 'role', 'authenticated')::text, true);
  r := public.prioridades_v2_completar_vara(v_id, 13, 'datajud', NULL);
  IF (r->>'sucesso')::boolean THEN RAISE EXCEPTION 'A6 falhou: outro Atendente completou'; END IF;
  v_ok := array_append(v_ok, 'A6 Completar Vara: só quem criou');

  -- ── C + D: Gestor ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM users WHERE email = 'gestor.teste@example.com'), 'role', 'authenticated')::text, true);
  r := public.prioridades_v2_criar_anotacao(base || jsonb_build_object('processo', '40005255120268260373'));
  IF NOT COALESCE((r->>'pode_excecao')::boolean, false) THEN RAISE EXCEPTION 'C4 falhou: Gestor não recebeu a opção de exceção: %', r; END IF;
  r := public.prioridades_v2_criar_anotacao(base || jsonb_build_object('processo', '40005255120268260373',
         'competencia_excecao', 'Redistribuído; ainda sem publicação.', 'upj_id', v_upj9, 'urgentissimo', true));
  IF NOT (r->>'sucesso')::boolean THEN RAISE EXCEPTION 'C5 falhou: %', r; END IF;
  v_id2 := (r->>'anotacao_id')::bigint;
  SELECT * INTO v_row FROM prioridades_anotacoes WHERE id = v_id2;
  IF NOT v_row.urgentissimo OR v_row.status <> 'upj-pendente' OR v_row.competencia_excecao IS NULL THEN
    RAISE EXCEPTION 'C5/D2 falhou: urg=% status=% exc=%', v_row.urgentissimo, v_row.status, v_row.competencia_excecao;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM prioridades_anotacoes_historico WHERE anotacao_id = v_id2 AND evento = 'excecao_competencia') THEN
    RAISE EXCEPTION 'C6 falhou: exceção não foi ao histórico';
  END IF;
  v_ok := array_append(v_ok, 'C4-C6 Gestor: recebe a opção, envia com justificativa (vai ao histórico) e marca Urgentíssima');

  -- ── N + H: conferência com alteração de campos ──
  r := public.prioridades_v2_conferir(v_id, 'aprovar', NULL, false, false, NULL, jsonb_build_object(
         'tipo_prioridade', 'prioridade-perito', 'tipo_solicitante', 'perito-leiloeiro', 'vara', '12',
         'descricao_resumida', 'Resumo corrigido', 'categoria', 'sisbajud', 'plataforma', 'eproc'));
  IF NOT (r->>'sucesso')::boolean THEN RAISE EXCEPTION 'N1 falhou: %', r; END IF;
  SELECT * INTO v_row FROM prioridades_anotacoes WHERE id = v_id;
  IF v_row.tipo_prioridade <> 'prioridade-perito' OR v_row.tipo_solicitante <> 'perito-leiloeiro' OR v_row.vara <> 12
     OR v_row.vara_fonte <> 'gestor' OR v_row.categoria <> 'sisbajud' OR v_row.descricao_resumida <> 'Resumo corrigido' THEN
    RAISE EXCEPTION 'N1 falhou: campos não mudaram';
  END IF;
  IF v_row.conferido_por_nome IS NULL THEN RAISE EXCEPTION 'H1 falhou: conferido_por_nome vazio'; END IF;
  SELECT conteudo INTO v_txt FROM prioridades_anotacoes_historico WHERE anotacao_id = v_id AND evento = 'alteracao_conferencia';
  IF v_txt IS NULL OR v_txt NOT LIKE '%Perito%' THEN RAISE EXCEPTION 'N2 falhou: histórico = %', v_txt; END IF;
  v_ok := array_append(v_ok, ('N1-N2 Conferência altera Tipo, Solicitante, Vara, Categoria e Resumida; histórico: ' || left(v_txt, 120)));
  v_ok := array_append(v_ok, ('H1 Conferido por: ' || v_row.conferido_por_nome));

  -- ── E: anteriores ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM users WHERE email = 'atendente.teste@example.com'), 'role', 'authenticated')::text, true);
  IF (SELECT count(*) FROM public.prioridades_v2_anteriores('40005255120268260373', 120)) < 1 THEN
    RAISE EXCEPTION 'E1 falhou: anteriores vazias';
  END IF;
  v_ok := array_append(v_ok, 'E1 Anteriores (120 dias) trazem as anotações do processo');

  -- ── F: regras por categoria ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM users WHERE email = 'gestor.teste@example.com'), 'role', 'authenticated')::text, true);
  r := public.prioridades_v2_regra_salvar(v_upj6, 'fora-localizador', 'mle', 'MLE da UPJ VI: fila Ag. Encerramento do Ato.');
  IF NOT (r->>'sucesso')::boolean THEN RAISE EXCEPTION 'F1 falhou: %', r; END IF;
  r := public.prioridades_v2_regra_salvar(v_upj6, 'fora-localizador', NULL, 'Vale para todas.');
  r := public.prioridades_v2_regra_salvar(v_upj6, 'fora-localizador', 'mle', 'MLE (texto novo).');
  IF (SELECT count(*) FROM public.prioridades_v2_regras_listar() WHERE upj_id = v_upj6) <> 2 THEN
    RAISE EXCEPTION 'F2 falhou: esperava 2 regras (MLE + todas)';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM users WHERE email = 'atendente.teste@example.com'), 'role', 'authenticated')::text, true);
  r := public.prioridades_v2_regra_salvar(v_upj6, 'fora-localizador', NULL, 'x');
  IF (r->>'sucesso')::boolean THEN RAISE EXCEPTION 'F3 falhou: Atendente salvou regra'; END IF;
  v_ok := array_append(v_ok, 'F1-F3 Regras por categoria: MLE e "todas" convivem; atualizar não duplica; Atendente não salva');

  -- ── B: Coordenador designa Analista só na própria UPJ ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM users WHERE email = 'coord.upj9.teste@example.com'), 'role', 'authenticated')::text, true);
  r := public.prioridades_v2_designar((SELECT id FROM users WHERE email = 'analista.upj9.teste@example.com'), 'analista', CURRENT_DATE, NULL, v_upj6);
  IF (r->>'sucesso')::boolean THEN RAISE EXCEPTION 'B1 falhou: designou na UPJ VI'; END IF;
  r := public.prioridades_v2_designar((SELECT id FROM users WHERE email = 'atendente.teste@example.com'), 'analista', CURRENT_DATE, NULL, NULL);
  IF (r->>'sucesso')::boolean THEN RAISE EXCEPTION 'B2 falhou: transformou Atendente em Analista'; END IF;
  r := public.prioridades_v2_designar((SELECT id FROM users WHERE email = 'analista.upj9.teste@example.com'), 'analista', CURRENT_DATE, NULL, NULL);
  IF NOT (r->>'sucesso')::boolean THEN RAISE EXCEPTION 'B3 falhou: %', r; END IF;
  v_ok := array_append(v_ok, 'B1-B3 Coordenador: recusa outra UPJ e pessoa de fora; designa Analista da própria UPJ');

  RAISE EXCEPTION E'RESULTADO: TODOS OS % TESTES PASSARAM (nada foi gravado)\n- %', array_length(v_ok, 1), array_to_string(v_ok, E'\n- ');
END $$;

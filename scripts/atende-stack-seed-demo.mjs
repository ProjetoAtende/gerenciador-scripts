/**
 * Seed de demonstração do Atende Stack — perguntas, réplicas e tréplicas variadas.
 * Todo conteúdo usa o prefixo [TESTE DEMO] no título e a tag teste-demo.
 *
 * Uso (raiz do repo, .env com Supabase + credenciais):
 *   node scripts/atende-stack-seed-demo.mjs
 *   node scripts/atende-stack-seed-demo.mjs --clean
 *   node scripts/atende-stack-seed-demo.mjs --clean --seed
 *   node scripts/atende-stack-seed-demo.mjs --list
 *
 * Variáveis:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *   SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD — conta principal (cria perguntas; staff para --clean)
 *   SMOKE_TEST_USER_EMAIL, SMOKE_TEST_USER_PASSWORD — opcional; segunda conta para algumas respostas
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

function loadEnv() {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.SMOKE_TEST_EMAIL;
const password = process.env.SMOKE_TEST_PASSWORD;
const userEmail = process.env.SMOKE_TEST_USER_EMAIL;
const userPassword = process.env.SMOKE_TEST_USER_PASSWORD;

const args = process.argv.slice(2);
const CLEAN = args.includes('--clean');
const LIST = args.includes('--list');
const RESeed = args.includes('--seed');

/** Prefixo visível — use na busca ou filtro para achar tudo. */
const PREFIX = '[TESTE DEMO]';
const TAG = 'teste-demo';
const MARKER = 'teste-demo-seed-v1';

if (!url || !anon) {
  console.error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no .env');
  process.exit(1);
}
if (!email || !password) {
  console.error('Defina SMOKE_TEST_EMAIL e SMOKE_TEST_PASSWORD no .env');
  process.exit(1);
}

function client() {
  return createClient(url, anon);
}

async function signIn(supabase, mail, pass) {
  const { error } = await supabase.auth.signInWithPassword({ email: mail, password: pass });
  if (error) throw new Error(`AUTH_FAIL ${mail}: ${error.message}`);
}

/** Cenários: pergunta + 0..N respostas (1ª = réplica, 2ª+ = tréplicas no fio). */
const SCENARIOS = [
  {
    titulo: `${PREFIX} Texto simples e lista`,
    corpo: `<p>Como registrar um atendimento no sistema? ${MARKER}</p><ul><li>Abrir o módulo</li><li>Preencher o formulário</li></ul>`,
    respostas: [
      `<p><strong>Réplica:</strong> use o menu lateral e salve como rascunho se precisar revisar depois.</p>`,
      `<p><strong>Tréplica:</strong> se o rascunho sumir, verifique se a sessão não expirou — faça login de novo.</p>`,
    ],
  },
  {
    titulo: `${PREFIX} Link externo e mailto`,
    corpo: `<p>Documentação oficial: <a href="https://www.tjsp.jus.br">Portal TJSP</a>. Dúvidas: <a href="mailto:exemplo@tjsp.jus.br">exemplo@tjsp.jus.br</a>. ${MARKER}</p>`,
    respostas: [
      `<p>Réplica com link relativo interno: <a href="/home">voltar ao início</a> (só demonstração).</p>`,
    ],
  },
  {
    titulo: `${PREFIX} Imagem HTTPS e legenda`,
    corpo: `<p>Exemplo de captura de tela ilustrativa:</p><p><img src="https://picsum.photos/seed/atende-demo-q3/480/180" alt="Imagem de teste demo" width="480" height="180"></p><p>${MARKER}</p>`,
    respostas: [
      `<p>Tréplica com outra imagem menor:</p><p><img src="https://picsum.photos/seed/atende-demo-r1/320/120" alt="Miniatura demo"></p>`,
    ],
  },
  {
    titulo: `${PREFIX} Riscado, alinhamento e ênfase`,
    corpo: `<p style="text-align: center">Texto centralizado</p><p><s>Procedimento antigo</s> — use o <strong>novo fluxo</strong> e <em>confira o prazo</em>. ${MARKER}</p>`,
    respostas: [
      `<p style="text-align: right"><strike>Réplica alinhada à direita</strike> → corrigido para o processo atual.</p>`,
      `<p style="text-align: left">Tréplica: <del>item removido</del> substituído na circular de 2026.</p>`,
    ],
  },
  {
    titulo: `${PREFIX} Precatórios e acentuação (busca)`,
    corpo: `<p>Dúvida sobre <strong>precatórios</strong>, <strong>certidões negativas</strong> e prazos de <strong>emissão</strong>. ${MARKER}</p>`,
    respostas: [
      `<p>Réplica: consulte o setor de precatórios antes de protocolar certidões.</p>`,
      `<p>Tréplica: prazos de emissão variam conforme a comarca — confirme na intranet.</p>`,
      `<p>Tréplica 2: anexe sempre cópia autenticada quando solicitado.</p>`,
    ],
  },
  {
    titulo: `${PREFIX} Código e citação`,
    corpo: `<blockquote>Regra interna: todo chamado deve ter categoria preenchida.</blockquote><pre><code>SELECT id, titulo FROM chamados LIMIT 5;</code></pre><p>${MARKER}</p>`,
    respostas: [],
  },
  {
    titulo: `${PREFIX} Lista numerada (checklist)`,
    corpo: `<ol><li>Validar documentos</li><li>Registrar no sistema</li><li>Arquivar comprovante</li></ol><p>${MARKER}</p>`,
    respostas: [
      `<p>Réplica — checklist extra:</p><ol><li>Conferir CPF</li><li>Conferir número do processo</li></ol>`,
    ],
  },
  {
    titulo: `${PREFIX} Thread longa — três réplicas`,
    corpo: `<p>Pergunta aberta para simular conversa longa no detalhe. ${MARKER}</p>`,
    respostas: [
      `<p><strong>1ª réplica:</strong> primeiro esclarecimento da equipe.</p>`,
      `<p><strong>2ª réplica (tréplica):</strong> complemento com detalhe técnico.</p>`,
      `<p><strong>3ª tréplica:</strong> encerramento do esclarecimento — qualquer dúvida, reabra.</p>`,
    ],
    respostasAsUser: true,
  },
  {
    titulo: `${PREFIX} Misto — imagem + link + lista`,
    corpo: `<p>Guia rápido ${MARKER}:</p><ul><li><a href="https://example.com/doc">Manual (example.com)</a></li></ul><p><img src="https://picsum.photos/seed/atende-demo-q9/400/150" alt="Fluxograma fictício"></p>`,
    respostas: [
      `<p>Réplica: imagem acima é só placeholder; substitua pelo fluxograma oficial quando publicado.</p>`,
    ],
  },
  {
    titulo: `${PREFIX} Pergunta sem resposta (feed)`,
    corpo: `<p>Ficará só no feed até alguém responder. ${MARKER}</p>`,
    respostas: [],
  },
  {
    titulo: `${PREFIX} Duas tréplicas com formatação diferente`,
    corpo: `<p>Comparar formatação entre respostas consecutivas. ${MARKER}</p>`,
    respostas: [
      `<p>Réplica em <strong>negrito</strong> e <u>sublinhado</u>.</p>`,
      `<p>Tréplica só com <em>itálico</em> e link <a href="https://httpbin.org/get">httpbin (teste)</a>.</p>`,
    ],
  },
  {
    titulo: `${PREFIX} Tag ${TAG} — metadados`,
    corpo: `<p>Pergunta marcada com tag <code>${TAG}</code> para filtros. ${MARKER}</p>`,
    respostas: [
      `<p>Réplica confirmando leitura da tag de teste.</p>`,
    ],
    tags: [TAG, 'demo-stack'],
  },
];

async function listTestIds(supabase) {
  const ids = [];
  let cursor = null;
  let cursorId = null;
  for (;;) {
    const { data, error } = await supabase.rpc('stack_listar_feed', {
      p_filtros: {},
      p_equipe_ctx: null,
      p_cursor: cursor,
      p_cursor_id: cursorId,
      p_limit: 100,
    });
    if (error) throw error;
    const batch = data ?? [];
    for (const row of batch) {
      if (row.titulo?.startsWith(PREFIX)) ids.push({ id: row.id, titulo: row.titulo });
    }
    if (batch.length < 100) break;
    const last = batch[batch.length - 1];
    cursor = last.ultima_atividade_em;
    cursorId = last.id;
  }
  return ids;
}

async function clean(supabase) {
  const rows = await listTestIds(supabase);
  console.log(`Removendo ${rows.length} perguntas ${PREFIX}…`);
  for (const { id, titulo } of rows) {
    const { error } = await supabase.rpc('stack_deletar', { p_pergunta_id: id });
    if (error) console.warn('  falha', titulo.slice(0, 50), error.message);
    else console.log('  ok', titulo.slice(0, 60));
  }
}

async function criarPergunta(supabase, scenario) {
  const { data, error } = await supabase.rpc('stack_criar_pergunta', {
    p_titulo: scenario.titulo,
    p_corpo_html: scenario.corpo,
    p_tag_ids: [],
    p_tag_novos: scenario.tags ?? [TAG],
    p_autor_equipe_id: null,
  });
  if (error) throw new Error(`criar_pergunta: ${scenario.titulo}: ${error.message}`);
  return data;
}

async function criarResposta(supabase, perguntaId, html) {
  const { data, error } = await supabase.rpc('stack_criar_resposta', {
    p_pergunta_id: perguntaId,
    p_corpo_html: html,
    p_autor_equipe_id: null,
  });
  if (error) throw new Error(`criar_resposta: ${error.message}`);
  return data;
}

async function seed() {
  const supabase = client();
  await signIn(supabase, email, password);

  let userSupabase = null;
  if (userEmail && userPassword) {
    userSupabase = client();
    await signIn(userSupabase, userEmail, userPassword);
    console.log('Conta secundária:', userEmail, '(algumas réplicas/tréplicas)');
  } else {
    console.log('Dica: SMOKE_TEST_USER_EMAIL/PASSWORD opcionais para respostas como user.');
  }

  console.log(`Criando ${SCENARIOS.length} perguntas ${PREFIX}…`);
  const summary = [];

  for (const scenario of SCENARIOS) {
    const perguntaId = await criarPergunta(supabase, scenario);
    let replyCount = 0;
    for (let i = 0; i < (scenario.respostas?.length ?? 0); i++) {
      const html = scenario.respostas[i];
      const asUser = scenario.respostasAsUser && userSupabase && i > 0;
      const sb = asUser ? userSupabase : supabase;
      await criarResposta(sb, perguntaId, html);
      replyCount += 1;
    }
    summary.push({ titulo: scenario.titulo, id: perguntaId, respostas: replyCount });
    console.log(`  + ${scenario.titulo.slice(0, 55)}… (${replyCount} resposta(s))`);
  }

  console.log('\nResumo:');
  console.table(summary.map((s) => ({ titulo: s.titulo.slice(0, 48), respostas: s.respostas })));
  console.log(`\nTotal: ${summary.length} perguntas, ${summary.reduce((n, s) => n + s.respostas, 0)} respostas.`);
  console.log(`Limpar: npm run stack:seed-demo:clean  ou  busca por "${PREFIX}" / tag "${TAG}"`);
}

const supabaseMain = client();

if (LIST) {
  await signIn(supabaseMain, email, password);
  const rows = await listTestIds(supabaseMain);
  console.log(`${rows.length} item(ns) ${PREFIX}:`);
  for (const r of rows) console.log(' ', r.id, r.titulo);
  process.exit(0);
}

if (CLEAN) {
  await signIn(supabaseMain, email, password);
  await clean(supabaseMain);
  if (!RESeed) process.exit(0);
}

await seed();

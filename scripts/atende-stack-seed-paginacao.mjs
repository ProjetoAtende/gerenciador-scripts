/**
 * Seed [TESTE PAG] para validar paginação do feed (F-02).
 *
 * Uso (na raiz do repo, com .env):
 *   node scripts/atende-stack-seed-paginacao.mjs
 *   node scripts/atende-stack-seed-paginacao.mjs --count=45
 *   node scripts/atende-stack-seed-paginacao.mjs --clean
 *   node scripts/atende-stack-seed-paginacao.mjs --verify
 *
 * Requer: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD
 * (conta staff recomendada para --clean via stack_deletar)
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

const args = process.argv.slice(2);
const countArg = args.find((a) => a.startsWith('--count='));
const COUNT = countArg ? Math.max(1, parseInt(countArg.split('=')[1], 10)) : 45;
const CLEAN = args.includes('--clean');
const VERIFY = args.includes('--verify');

const PREFIX = '[TESTE PAG]';

if (!url || !anon) {
  console.error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no .env');
  process.exit(1);
}
if (!email || !password) {
  console.error('Defina SMOKE_TEST_EMAIL e SMOKE_TEST_PASSWORD no .env');
  process.exit(1);
}

const supabase = createClient(url, anon);
const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) {
  console.error('AUTH_FAIL', authError.message);
  process.exit(1);
}

async function listTestIds() {
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
      if (row.titulo?.startsWith(PREFIX)) ids.push(row.id);
    }
    if (batch.length < 100) break;
    const last = batch[batch.length - 1];
    cursor = last.ultima_atividade_em;
    cursorId = last.id;
  }
  return ids;
}

async function clean() {
  const ids = await listTestIds();
  console.log(`Removendo ${ids.length} perguntas ${PREFIX}…`);
  for (const id of ids) {
    const { error } = await supabase.rpc('stack_deletar', { p_pergunta_id: id });
    if (error) console.warn('  falha', id, error.message);
  }
}

async function seed() {
  console.log(`Criando ${COUNT} perguntas ${PREFIX}…`);
  const created = [];
  for (let i = 1; i <= COUNT; i++) {
    const titulo = `${PREFIX} ${String(i).padStart(3, '0')} — paginação feed`;
    const { data, error } = await supabase.rpc('stack_criar_pergunta', {
      p_titulo: titulo,
      p_corpo_html: `<p>Conteúdo de teste para paginação (#${i}).</p>`,
      p_tag_ids: [],
      p_tag_novos: [],
      p_autor_equipe_id: null,
    });
    if (error) {
      console.error('Erro ao criar', i, error.message);
      process.exit(1);
    }
    created.push(data);
    if (i % 10 === 0) console.log(`  … ${i}/${COUNT}`);
  }
  console.log('Criadas:', created.length);
  return created;
}

async function verify() {
  const page1 = await supabase.rpc('stack_listar_feed', {
    p_filtros: {},
    p_equipe_ctx: null,
    p_cursor: null,
    p_cursor_id: null,
    p_limit: 40,
  });
  if (page1.error) throw page1.error;
  const a = page1.data ?? [];
  if (a.length === 0) {
    console.log('VERIFY: feed vazio — rode o seed primeiro.');
    process.exit(1);
  }
  const last = a[a.length - 1];
  const page2 = await supabase.rpc('stack_listar_feed', {
    p_filtros: {},
    p_equipe_ctx: null,
    p_cursor: last.ultima_atividade_em,
    p_cursor_id: last.id,
    p_limit: 40,
  });
  if (page2.error) throw page2.error;
  const b = page2.data ?? [];
  const ids1 = new Set(a.map((x) => x.id));
  const dup = b.filter((x) => ids1.has(x.id));
  const testCount = [...ids1, ...b.map((x) => x.id)].filter((id, idx, arr) => {
    const row = idx < a.length ? a[idx] : b[idx - a.length];
    return row?.titulo?.startsWith(PREFIX);
  }).length;

  console.log('VERIFY feed paginação:');
  console.log('  página 1:', a.length, 'itens');
  console.log('  página 2:', b.length, 'itens');
  console.log('  duplicatas entre páginas:', dup.length, dup.length === 0 ? 'OK' : 'FALHOU');
  const totalTest = (await listTestIds()).length;
  console.log('  total', PREFIX, 'no feed:', totalTest);
  if (dup.length > 0) process.exit(1);
  console.log('VERIFY: OK');
}

if (CLEAN) {
  await clean();
  if (!args.includes('--seed')) process.exit(0);
}

if (VERIFY) {
  await verify();
  process.exit(0);
}

if (!CLEAN || args.includes('--seed')) {
  await seed();
  await verify();
}

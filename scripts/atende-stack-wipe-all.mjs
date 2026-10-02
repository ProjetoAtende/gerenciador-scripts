/**
 * Remove TODAS as perguntas/respostas do Atende Stack e tags do catálogo (preserva «Sem classificação»).
 * Requer VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no .env
 *
 *   node scripts/atende-stack-wipe-all.mjs
 *   node scripts/atende-stack-wipe-all.mjs --dry-run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { readSupabaseServiceRoleKey, SERVICE_ROLE_ENV_HINT } from './lib/serviceRoleEnv.mjs';

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
const serviceRole = readSupabaseServiceRoleKey();
const dryRun = process.argv.includes('--dry-run');

if (!url || !serviceRole) {
  console.error(`Faltam VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env. ${SERVICE_ROLE_ENV_HINT}`);
  process.exit(1);
}

const admin = createClient(url, serviceRole);

async function count(table) {
  const { count: n, error } = await admin.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return n ?? 0;
}

/** PostgREST exige filtro no DELETE; uuid dummy nunca igual a linhas reais. */
const DUMMY = '00000000-0000-0000-0000-000000000001';

async function deleteAll(table, idColumn = 'id') {
  const { error } = await admin.from(table).delete().neq(idColumn, DUMMY);
  if (error) throw error;
}

/** Preserva tag de fallback IA (TIA-B3). */
async function deleteAllTagsExceptFallback() {
  const { error } = await admin.from('stack_tags').delete().neq('slug', 'sem-classificacao');
  if (error) throw error;
  const { error: upsertErr } = await admin.from('stack_tags').upsert(
    { slug: 'sem-classificacao', rotulo: 'Sem classificação' },
    { onConflict: 'slug' },
  );
  if (upsertErr) throw upsertErr;
}

async function main() {
  const before = {
    perguntas: await count('stack_perguntas'),
    respostas: await count('stack_respostas'),
    tags: await count('stack_tags'),
    votos: await count('stack_votes'),
    notificacoes: await count('stack_notificacoes'),
  };

  console.log('Antes:', before);

  if (dryRun) {
    console.log('Dry-run — nada foi apagado.');
    process.exit(0);
  }

  if (before.perguntas === 0 && before.tags === 0) {
    console.log('Stack já vazio.');
  }

  // Ordem: votos e jobs → perguntas (cascade respostas, favoritos, vínculos) → notificações → tags
  await deleteAll('stack_votes', 'user_id');
  try {
    await deleteAll('stack_tag_jobs', 'id');
  } catch (e) {
    console.warn('stack_tag_jobs:', e.message ?? e);
  }
  await deleteAll('stack_perguntas', 'id');
  await deleteAll('stack_notificacoes', 'id');
  await deleteAllTagsExceptFallback();

  const after = {
    perguntas: await count('stack_perguntas'),
    respostas: await count('stack_respostas'),
    tags: await count('stack_tags'),
    votos: await count('stack_votes'),
    notificacoes: await count('stack_notificacoes'),
  };

  console.log('Depois:', after);
  const { data: tagsLeft } = await admin.from('stack_tags').select('slug, rotulo');
  console.log('Tags restantes:', tagsLeft ?? []);
}

await main();

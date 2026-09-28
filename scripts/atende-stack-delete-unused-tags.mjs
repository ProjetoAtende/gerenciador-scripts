/**
 * Remove tags do catálogo sem vínculo em stack_pergunta_tags (exceto sem-classificacao).
 * Requer VITE_SUPABASE_URL + VITE_SUPABASE_SERVICE_ROLE_KEY no .env
 *
 *   node scripts/atende-stack-delete-unused-tags.mjs
 *   node scripts/atende-stack-delete-unused-tags.mjs --dry-run
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
const serviceRole = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry-run');

if (!url || !serviceRole) {
  console.error('Faltam VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const admin = createClient(url, serviceRole);

async function main() {
  const { data: tags, error } = await admin.from('stack_tags').select('id, slug, rotulo');
  if (error) throw error;

  const { data: usedRows, error: usedErr } = await admin.from('stack_pergunta_tags').select('tag_id');
  if (usedErr) throw usedErr;

  const used = new Set((usedRows ?? []).map((r) => r.tag_id));
  const orphans = (tags ?? []).filter((t) => t.slug !== 'sem-classificacao' && !used.has(t.id));

  console.log(`Tags órfãs (${orphans.length}):`, orphans.map((t) => t.rotulo));

  if (dryRun || orphans.length === 0) {
    if (dryRun) console.log('Dry-run — nada apagado.');
    return;
  }

  const ids = orphans.map((t) => t.id);
  const { error: delErr } = await admin.from('stack_tags').delete().in('id', ids);
  if (delErr) throw delErr;

  const { error: upsertErr } = await admin.from('stack_tags').upsert(
    { slug: 'sem-classificacao', rotulo: 'Sem classificação' },
    { onConflict: 'slug' },
  );
  if (upsertErr) throw upsertErr;

  console.log('Removidas', ids.length, 'tags; sem-classificacao garantida.');
}

await main();

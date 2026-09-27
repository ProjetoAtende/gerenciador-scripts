/**
 * Verifica stack_obter_pergunta com p_preview_role=user (admin only).
 * Requer SMOKE_TEST_EMAIL/PASSWORD de conta admin e uma pergunta id (--pergunta=uuid).
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

const perguntaArg = process.argv.find((a) => a.startsWith('--pergunta='));
const perguntaId = perguntaArg?.split('=')[1];
if (!perguntaId) {
  console.error('Uso: node scripts/atende-stack-verify-simulacao.mjs --pergunta=<uuid>');
  process.exit(1);
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { error: authError } = await supabase.auth.signInWithPassword({
  email: process.env.SMOKE_TEST_EMAIL,
  password: process.env.SMOKE_TEST_PASSWORD,
});
if (authError) {
  console.error(authError.message);
  process.exit(1);
}

const normal = await supabase.rpc('stack_obter_pergunta', { p_pergunta_id: perguntaId });
const preview = await supabase.rpc('stack_obter_pergunta', {
  p_pergunta_id: perguntaId,
  p_preview_role: 'user',
});

if (normal.error || preview.error) {
  console.error(normal.error || preview.error);
  process.exit(1);
}

const nAutor = normal.data?.autor;
const pAutor = preview.data?.autor;
console.log('autor (normal):', JSON.stringify(nAutor));
console.log('autor (preview user):', JSON.stringify(pAutor));
console.log('pode_deletar normal:', normal.data?.pode_deletar, 'preview:', preview.data?.pode_deletar);

const ok =
  pAutor?.anonimo === true &&
  preview.data?.pode_deletar === false &&
  preview.data?.pode_fechar === false;

console.log(ok ? 'SIMULACAO RPC: OK' : 'SIMULACAO RPC: FALHOU');
process.exit(ok ? 0 : 1);

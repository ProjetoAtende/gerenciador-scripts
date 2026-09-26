/**
 * Smoke test RPC chamar_deepseek como usuário autenticado (PostgREST).
 * Opcional: SMOKE_TEST_EMAIL + SMOKE_TEST_PASSWORD no .env
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
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

if (!url || !anon) {
  console.error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no .env');
  process.exit(1);
}

if (!email || !password) {
  console.log('SKIP: defina SMOKE_TEST_EMAIL e SMOKE_TEST_PASSWORD no .env para testar RPC autenticado.');
  process.exit(0);
}

const supabase = createClient(url, anon);
const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) {
  console.error('AUTH_FAIL', authError.message);
  process.exit(1);
}

const { data, error } = await supabase.rpc('chamar_deepseek', {
  p_messages: [{ role: 'user', content: 'Responda apenas: OK' }],
  p_model: 'deepseek-v4-flash',
  p_temperature: 0.1,
  p_max_tokens: 128,
  p_response_format: null,
  p_thinking: null,
});

if (error) {
  console.error('RPC_FAIL', error.message);
  process.exit(1);
}

if (data?.error) {
  console.error('RPC_ERROR', data.error.message);
  process.exit(1);
}

const msg = data?.choices?.[0]?.message;
const preview = (msg?.content || msg?.reasoning_content || '').trim().slice(0, 80);
console.log('AUTH_RPC_OK', { preview, finishReason: data?.choices?.[0]?.finish_reason });

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = path.join(root, '.env');

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

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log('SKIP: sem service role no .env');
  process.exit(0);
}

const supabase = createClient(url, key);
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
console.log('SERVICE_RPC_OK', {
  contentLen: (msg?.content || '').length,
  reasoningLen: (msg?.reasoning_content || '').length,
});

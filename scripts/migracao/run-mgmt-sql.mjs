/**
 * Executa SQL no projeto linkado via Supabase Management API.
 * Uso: node scripts/migracao/run-mgmt-sql.mjs "SELECT 1"
 * Token: PAT_SUPABASE ou SUPABASE_ACCESS_TOKEN no .env ou ambiente.
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
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

const TOKEN =
  process.env.SUPABASE_ACCESS_TOKEN ||
  process.env.SUPABASE_PAT ||
  process.env.PAT_SUPABASE ||
  process.env.SUPABASE_MANAGEMENT_API_TOKEN;

const url = process.env.VITE_SUPABASE_URL || '';
const projectRef = process.env.SUPABASE_PROJECT_REF || url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

const sqlArg = process.argv[2];
const fileArg = process.argv.find((a) => a.startsWith('--file='))?.slice(7);
const sql = fileArg ? fs.readFileSync(fileArg, 'utf8') : sqlArg;

if (!TOKEN || !projectRef || !sql) {
  console.error('Uso: node run-mgmt-sql.mjs "<sql>" | --file=path.sql');
  console.error('Requer PAT_SUPABASE (ou SUPABASE_ACCESS_TOKEN) e VITE_SUPABASE_URL no .env');
  process.exit(1);
}

const body = JSON.stringify({ query: sql });

const req = https.request(
  {
    hostname: 'api.supabase.com',
    path: `/v1/projects/${projectRef}/database/query`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  },
  (res) => {
    let data = '';
    res.on('data', (c) => {
      data += c;
    });
    res.on('end', () => {
      console.log('HTTP', res.statusCode);
      try {
        console.log(JSON.stringify(JSON.parse(data), null, 2));
      } catch {
        console.log(data.slice(0, 4000));
      }
      process.exit(res.statusCode >= 400 ? 1 : 0);
    });
  },
);

req.on('error', (e) => {
  console.error(e);
  process.exit(1);
});
req.write(body);
req.end();

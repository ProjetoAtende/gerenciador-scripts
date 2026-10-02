#!/usr/bin/env node
/**
 * Falha se o client (src/ ou dist/assets) referenciar service role ou padrões perigosos.
 * Uso: após `npm run build` — também roda no CI (GitHub Pages).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');
const distAssets = path.join(root, 'dist', 'assets');

const FORBIDDEN_IN_SRC = [
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'import.meta.env.VITE_SUPABASE_SERVICE_ROLE',
];

/** Nomes de env / literais que só aparecem se alguém embutir a secret no client */
const FORBIDDEN_IN_BUNDLE = [
  /VITE_SUPABASE_SERVICE_ROLE/i,
  /SUPABASE_SERVICE_ROLE_KEY/i,
];

function walkFiles(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkFiles(full, ext, out);
    else if (!ext || full.endsWith(ext)) out.push(full);
  }
  return out;
}

let failed = false;

for (const file of walkFiles(srcDir, '.ts')) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of FORBIDDEN_IN_SRC) {
    if (text.includes(needle)) {
      console.error(`[src] ${path.relative(root, file)}: contém "${needle}"`);
      failed = true;
    }
  }
}
for (const file of walkFiles(srcDir, '.tsx')) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of FORBIDDEN_IN_SRC) {
    if (text.includes(needle)) {
      console.error(`[src] ${path.relative(root, file)}: contém "${needle}"`);
      failed = true;
    }
  }
}

if (fs.existsSync(distAssets)) {
  for (const file of fs.readdirSync(distAssets)) {
    if (!file.endsWith('.js')) continue;
    const text = fs.readFileSync(path.join(distAssets, file), 'utf8');
    for (const re of FORBIDDEN_IN_BUNDLE) {
      if (re.test(text)) {
        console.error(`[dist] assets/${file}: padrão proibido ${re}`);
        failed = true;
      }
    }
  }
} else {
  console.warn('dist/assets não encontrado — pulando verificação do bundle (rode npm run build antes).');
}

if (failed) {
  console.error('\nService role não pode aparecer no frontend. Use Edge Functions ou scripts Node com SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

console.log('OK: nenhum indício de service role no client.');

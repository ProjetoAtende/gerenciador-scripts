/**
 * Remove arquivos em src/ não alcançáveis a partir dos entrypoints do Gerenciador Atende.
 * Uso: node scripts/migracao/prune-src.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const SRC = path.join(ROOT, 'src');
const dryRun = process.argv.includes('--dry-run');

const SEEDS = [
  'main.tsx',
  'vite-env.d.ts',
  'cloudflare-workers.d.ts',
  'pages/Home.tsx',
  'components/ScriptsModal.tsx',
  'components/ScriptsEmNumerosModal.tsx',
  'components/BossOnlyModal.tsx',
  'components/OutrosServicosModal.tsx',
  'components/LinksModal.tsx',
  'components/GeradorModal.tsx',
  'components/MelhorarTextoModal.tsx',
  'components/ConfiguracoesModal.tsx',
  'components/escala/EscalaModal.tsx',
];

function listAllTsFiles(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) listAllTsFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(ent.name)) acc.push(full);
  }
  return acc;
}

function resolveRelative(fromRel, spec) {
  if (!spec.startsWith('.')) return null;
  const fromDir = path.dirname(path.join(SRC, fromRel));
  let target = path.normalize(path.join(fromDir, spec));
  const exts = ['.tsx', '.ts', '/index.tsx', '/index.ts'];
  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    return path.relative(SRC, target).replace(/\\/g, '/');
  }
  for (const ext of exts) {
    const cand = target + ext;
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      return path.relative(SRC, cand).replace(/\\/g, '/');
    }
  }
  return null;
}

const importRe =
  /(?:import\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+|import\s+|export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+)['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function collectImports(fileRel) {
  const full = path.join(SRC, fileRel);
  if (!fs.existsSync(full)) return [];
  const text = fs.readFileSync(full, 'utf8');
  const specs = [];
  let m;
  while ((m = importRe.exec(text)) !== null) {
    const spec = m[1] || m[2];
    if (spec) specs.push(spec);
  }
  return specs;
}

function reachableFrom(seeds) {
  const seen = new Set();
  const queue = [...seeds];
  while (queue.length) {
    const rel = queue.pop();
    if (!rel || seen.has(rel)) continue;
    const full = path.join(SRC, rel);
    if (!fs.existsSync(full)) continue;
    seen.add(rel);
    for (const spec of collectImports(rel)) {
      const resolved = resolveRelative(rel, spec);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

// Testes: manter só os que compilam com o grafo Atende (+ setup)
const testSeeds = [];
const testsDir = path.join(SRC, '__tests__');
if (fs.existsSync(testsDir)) {
  for (const f of listAllTsFiles(testsDir)) {
    const rel = path.relative(SRC, f).replace(/\\/g, '/');
    if (
      rel.includes('/favoritos/') ||
      rel.includes('/distribuidor/') ||
      rel.includes('/oraculo') ||
      rel.includes('/upload/') ||
      rel === '__tests__/oracleAnalysisV2Service.test.ts'
    ) {
      continue;
    }
    testSeeds.push(rel);
  }
}

const keep = reachableFrom([...SEEDS, ...testSeeds]);
const all = listAllTsFiles(SRC).map((f) => path.relative(SRC, f).replace(/\\/g, '/'));
const remove = all.filter((f) => !keep.has(f));

console.log(`Keep: ${keep.size} files, remove: ${remove.length} files`);
if (dryRun) {
  remove.slice(0, 40).forEach((f) => console.log('  -', f));
  if (remove.length > 40) console.log(`  ... and ${remove.length - 40} more`);
  process.exit(0);
}

for (const rel of remove) {
  fs.unlinkSync(path.join(SRC, rel));
}

// Remove empty directories (bottom-up)
function pruneEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) pruneEmptyDirs(path.join(dir, ent.name));
  }
  if (dir === SRC) return;
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

pruneEmptyDirs(SRC);
console.log('Prune complete.');

#!/usr/bin/env node
/**
 * Roda o localizador da v2 (o mesmo código da Edge Function prioridades-localizar)
 * contra a DJEN e o Datajud de verdade, aqui no computador. Precisa do Node 23.6+
 * (lê TypeScript direto).
 *
 *   node scripts/prioridades-v2/localizar-ao-vivo.mjs 4189868-12.2026.8.26.0100 ...
 *   node scripts/prioridades-v2/localizar-ao-vivo.mjs --sem-datajud <números>
 *
 * Chave do Datajud: variável DATAJUD_API_KEY ou, na falta, a do backend do chatbot
 * (chatbot/backend/.env). Ela não é impressa.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { interpretarNumero, resolver } from '../../supabase/functions/_shared/localizador.ts';
import { consultarDatajud, consultarDjen } from '../../supabase/functions/_shared/fontes.ts';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const semDatajud = args.includes('--sem-datajud');
const numeros = args.filter((a) => !a.startsWith('--'));

function chaveDatajud() {
  if (process.env.DATAJUD_API_KEY) return process.env.DATAJUD_API_KEY;
  try {
    const env = fs.readFileSync(path.join(raiz, '..', '..', 'backend', '.env'), 'utf8');
    return (env.match(/^DATAJUD_API_KEY\s*=\s*(.*)$/m)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
  } catch {
    return '';
  }
}

if (numeros.length === 0) {
  console.log('Uso: node scripts/prioridades-v2/localizar-ao-vivo.mjs [--sem-datajud] <número> [...]');
  process.exit(1);
}

const chave = semDatajud ? '' : chaveDatajud();

for (const entrada of numeros) {
  const numero = interpretarNumero(entrada);
  if (!numero.ok) {
    console.log(`\n${entrada}: ${numero.mensagem}`);
    continue;
  }
  const djen = await consultarDjen(numero.digitos);
  const rapido = resolver({ numero, djen, datajud: null });
  const datajud = semDatajud || rapido.vara !== null || rapido.escopo.situacao === 'fora'
    ? { status: 'dispensado' }
    : await consultarDatajud(numero.digitos, chave);
  const r = resolver({ numero, djen, datajud });

  console.log(`\n═══ ${r.numero}`);
  console.log(`  DJEN ${r.fontes.djen.status} (${r.fontes.djen.ms ?? '-'} ms) · Datajud ${r.fontes.datajud.status} (${r.fontes.datajud.ms ?? '-'} ms)`);
  console.log(`  Competência: ${r.escopo.situacao.toUpperCase()} — ${r.escopo.motivo}`);
  console.log(`  Órgão atual: ${r.orgao?.original ?? '—'}`);
  console.log(`  UPJ: ${r.upj ? `UPJ ${r.upj.numeral} (${r.upj.codigo})` : '—'} · Vara: ${r.vara ? `${r.vara}ª (${r.varaFonte})` : r.varasPossiveis ? `a escolher entre ${r.varasPossiveis.join(', ')}` : '—'}`);
  console.log(`  Sistema: ${r.sistema.valor ?? '—'}${r.sistema.origem ? ` (${r.sistema.origem})` : ''}`);
  for (const a of r.avisos) console.log(`  [${a.nivel}] ${a.texto}`);
}

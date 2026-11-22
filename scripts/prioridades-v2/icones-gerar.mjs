// Gera src/components/prioridades-v2/icones.ts a partir dos pacotes @iconify-json e de SVGs do Penpot.
import fs from 'node:fs'; import path from 'node:path';
const [iconifyDir, penpotDir, saida] = process.argv.slice(2);
const MAPA = {
  nova: 'el:plus-sign', voltar: 'akar-icons:triangle-left-fill', avancar: 'akar-icons:triangle-right-fill',
  aviso: 'bi:exclamation-octagon-fill', info: 'bi:info-circle', fechar: 'mdi:refresh', copiar: 'mdi:content-copy',
  check: 'mdi:checkbox-marked', alerta: 'mdi:alert-circle', 'radio-on': 'mdi:radiobox-marked', 'radio-off': 'mdi:radiobox-blank',
  'ag-conferencia': 'ix:eye-magnifying-glass', devolvidas: 'akar-icons:arrow-back-thick-fill',
  aprovadas: 'ic:round-thumb-up-off-alt', reprovadas: 'ic:round-thumb-down-alt',
  urgentissimas: 'mdi:fire', reiteradas: 'penpot:Item_-_Reiteradas__svg__14',
  novas: 'boxicons:sparkles-alt-filled', 'em-analise': 'mingcute:loading-4-fill', retornadas: 'glyphs:stop-hand-bold',
  resolvidas: 'penpot:Item_-_Resolvidas__svg__19', rejeitadas: 'penpot:Item_-_Rejeitadas__svg__18',
  historico: 'hugeicons:transaction-history', designacoes: 'carbon:user-filled',
  configuracoes: 'material-symbols:manufacturing-rounded', 'log-acessos': 'icon-park-outline:log',
  creditos: 'streamline-sharp:attribution-solid',
  'cat-mle': 'fa6-solid:money-check-dollar', 'cat-sisbajud': 'lets-icons:lock-fill', 'cat-pesquisas': 'ant-design:home-filled',
  'cat-cadastro': 'fa6-solid:user-tag', 'cat-expedicao': 'reicon:award-certificate-filled',
  'cat-movimentacao': 'fa6-solid:arrow-right-arrow-left', 'cat-publicacao': 'boxicons:newspaper-filled',
  'cat-audiencias': 'fluent-mdl2:decision-solid',
};
const sets = {}; const creditos = new Map();
const out = {};
for (const [nome, ref] of Object.entries(MAPA)) {
  const [prefixo, icone] = ref.split(':');
  if (prefixo === 'penpot') {
    const svg = fs.readFileSync(path.join(penpotDir, icone + '.svg'), 'utf8');
    const vb = svg.match(/viewBox="([^"]+)"/)[1];
    const corpo = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
      .replace(/fill="#(?:ffffff|fff)"/gi, 'fill="currentColor"').replace(/stroke="#(?:ffffff|fff)"/gi, 'stroke="currentColor"');
    out[nome] = { viewBox: vb, body: corpo };
    creditos.set('Desenhos do Penpot (TJSP Atende)', 'maquete');
    continue;
  }
  const j = sets[prefixo] ??= JSON.parse(fs.readFileSync(path.join(iconifyDir, 'node_modules/@iconify-json', prefixo, 'icons.json'), 'utf8'));
  let ic = j.icons[icone]; let base = icone;
  if (!ic && j.aliases?.[icone]) { base = j.aliases[icone].parent; ic = j.icons[base]; }
  if (!ic) throw new Error('Ícone não encontrado: ' + ref);
  const w = ic.width ?? j.width ?? 16, h = ic.height ?? j.height ?? 16, l = ic.left ?? 0, t = ic.top ?? 0;
  out[nome] = { viewBox: `${l} ${t} ${w} ${h}`, body: ic.body };
  { const info = JSON.parse(fs.readFileSync(path.join(iconifyDir, 'node_modules/@iconify-json', prefixo, 'info.json'), 'utf8')); creditos.set(info.name ?? prefixo, `${info.author?.name ?? ''} — ${info.license?.title ?? ''}`); }
}
const ts = `/* Arquivo GERADO por scripts de apoio (não editar à mão).
 * Ícones da v2 de Prioridades e Urgências, embutidos (sem chamadas externas).
 * Origem: conjuntos do Iconify indicados no guia de ícones das maquetes, e alguns desenhos do próprio Penpot.
 */
export const ICONES = ${JSON.stringify(out, null, 1)} as const;

export type NomeIcone = keyof typeof ICONES;

/** Conjuntos usados e licenças (exibidos na tela Créditos). */
export const CREDITOS_ICONES: { conjunto: string; autorLicenca: string }[] = ${JSON.stringify([...creditos].map(([conjunto, autorLicenca]) => ({ conjunto, autorLicenca })), null, 1)};
`;
fs.writeFileSync(saida, ts);
console.log(Object.keys(out).length, 'ícones;', [...creditos.keys()].join(', '));

import fs from 'node:fs'; import path from 'node:path';
const pagesDir = process.argv[2], outDir = process.argv[3];
fs.mkdirSync(outDir, { recursive: true });
const shapes = {};
for (const d of fs.readdirSync(pagesDir).filter(f => !f.endsWith('.json')))
  for (const f of fs.readdirSync(path.join(pagesDir, d))) { const s = JSON.parse(fs.readFileSync(path.join(pagesDir, d, f))); s._page = d; shapes[s.id] = s; }
const kids = {}; for (const s of Object.values(shapes)) (kids[s.parentId] ??= []).push(s);
const ehIcone = s => (s.type === 'group' || s.type === 'frame') && (s.name === 'svg' || /^[a-z0-9-]+:[a-z0-9-]+$/.test(s.name));
const descend = s => (kids[s.id] || []).flatMap(k => [k, ...descend(k)]);
const ancestral = s => { const nomes = []; let p = shapes[s.parentId]; while (p && p.id !== p.parentId && nomes.length < 6) { nomes.push(p.name); p = shapes[p.parentId]; } return nomes; };
const vistos = new Map();
for (const s of Object.values(shapes)) {
  if (!ehIcone(s)) continue; { let q = s; let oculto = false; while (q && q.id !== q.parentId) { if (q.hidden) { oculto = true; break; } q = shapes[q.parentId]; } if (oculto) continue; }
  if (ehIcone(shapes[s.parentId] || {})) continue; // só o grupo mais externo
  const paths = descend(s).filter(k => k.type === 'path' && typeof k.content === 'string' && !(k.svgAttrs?.fill === 'none' && !(k.strokes||[]).length && /^M[\d.]+,[\d.]+L/.test(k.content) && k.content.split('L').length === 5));
  if (!paths.length) continue;
  const anc = ancestral(s).find(n => !/^(svg|svg-g|Group|Grupo|Board)$/i.test(n)) || '?';
  const chave = `${anc} | ${s.name} | ${Math.round(s.selrect.width)}x${Math.round(s.selrect.height)} | ${paths.map(p=>p.content.length).join("-")}`;
  if (vistos.has(chave)) continue;
  const { x, y, width: w, height: h } = s.selrect;
  const corpo = paths.map(p => {
    const fill = p.fills?.[0]?.fillColor; const st = p.strokes?.[0];
    const attrs = [`d="${p.content}"`, `fill="${fill ?? 'none'}"`];
    if (p.fills?.[0]?.fillOpacity != null && p.fills[0].fillOpacity !== 1) attrs.push(`fill-opacity="${p.fills[0].fillOpacity}"`);
    if (st) attrs.push(`stroke="${st.strokeColor}"`, `stroke-width="${st.strokeWidth}"`);
    if (p.svgAttrs?.fillRule || p.svgAttrs?.['fill-rule']) attrs.push(`fill-rule="${p.svgAttrs.fillRule || p.svgAttrs['fill-rule']}"`);
    return `<path ${attrs.join(' ')}/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}">${corpo}</svg>`;
  const arq = (anc + "__" + s.name + "__" + vistos.size).replace(/[^\w\-]+/g, '_').slice(0, 80) + '.svg';
  fs.writeFileSync(path.join(outDir, arq), svg);
  vistos.set(chave, { arq, w: Math.round(w), h: Math.round(h), n: paths.length, cores: [...new Set(paths.map(p => p.fills?.[0]?.fillColor || p.strokes?.[0]?.strokeColor))].join(',') });
}
const linhas = [...vistos].map(([k, v]) => `${k} -> ${v.arq} (${v.w}x${v.h}, ${v.n} paths, ${v.cores})`).sort();
console.log(linhas.join('\n'));
const html = `<html><body style="font-family:sans-serif;display:flex;flex-wrap:wrap;gap:12px;background:#ddd">${[...vistos].map(([k, v]) => `<figure style="width:120px;margin:0;text-align:center;font-size:10px;background:#fff;padding:6px"><img src="${v.arq}" style="width:48px;height:48px;object-fit:contain"><figcaption>${k}</figcaption></figure>`).join('')}</body></html>`;
fs.writeFileSync(path.join(outDir, 'index.html'), html);

/** Índice normalizado (sem acento, minúsculas) → índice UTF-16 no texto original. */
function buildNormMap(text: string): { norm: string; normToOrig: number[] } {
  const normToOrig: number[] = [];
  let norm = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    for (const part of ch.normalize('NFD')) {
      if (/\p{M}/u.test(part)) continue;
      norm += part.toLowerCase();
      normToOrig.push(i);
    }
  }
  return { norm, normToOrig };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur[0] <= last[1]) {
      last[1] = Math.max(last[1], cur[1]);
    } else {
      out.push(cur);
    }
  }
  return out;
}

/** Destaca termos da busca no texto original, ignorando diferença de acentos. */
export function highlightSearchTermsHtml(plain: string, query: string): string {
  const q = query.trim();
  if (!plain || q.length < 2) return escapeHtml(plain);

  const terms = q.split(/\s+/).filter((t) => t.length >= 2);
  if (!terms.length) return escapeHtml(plain);

  const { norm, normToOrig } = buildNormMap(plain);
  const ranges: [number, number][] = [];

  for (const term of terms) {
    const { norm: termNorm } = buildNormMap(term);
    if (!termNorm.length) continue;
    let idx = 0;
    while (idx <= norm.length - termNorm.length) {
      if (norm.slice(idx, idx + termNorm.length) === termNorm) {
        const startOrig = normToOrig[idx];
        const endOrig = normToOrig[idx + termNorm.length - 1] + 1;
        ranges.push([startOrig, endOrig]);
        idx += termNorm.length;
      } else {
        idx += 1;
      }
    }
  }

  const merged = mergeRanges(ranges);
  if (!merged.length) return escapeHtml(plain);

  let out = '';
  let cursor = 0;
  for (const [start, end] of merged) {
    out += escapeHtml(plain.slice(cursor, start));
    out += `<mark>${escapeHtml(plain.slice(start, end))}</mark>`;
    cursor = end;
  }
  out += escapeHtml(plain.slice(cursor));
  return out;
}

/** Texto plano a partir de snippet FTS (remove tags). */
export function stripHighlightMarkup(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

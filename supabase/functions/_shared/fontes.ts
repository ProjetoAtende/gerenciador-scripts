/**
 * Consultas às fontes (DJEN e Datajud), só com fetch: rodam no Deno (Edge Function)
 * e no Node (scripts/prioridades-v2/localizar-ao-vivo.mjs).
 */
import type { FonteDatajud, FonteDjen } from './localizador.ts';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── DJEN ──────────────────────────────────────────────────────────────────────

const URL_DJEN = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';

export async function consultarDjen(digitos: string): Promise<FonteDjen> {
  const inicio = Date.now();
  let ultimoErro = 'falha desconhecida';
  for (let t = 1; t <= 3; t++) {
    try {
      // 100 itens: com 5 (o máximo do djen-proxy) a publicação mais recente pode ficar de fora.
      const r = await fetch(`${URL_DJEN}?siglaTribunal=TJSP&numeroProcesso=${digitos}&itensPorPagina=100&pagina=1`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      const tipo = r.headers.get('content-type') ?? '';
      if (r.status === 429) {
        return { status: 'erro', erro: 'A DJEN limitou as consultas. Aguarde 1 minuto.', ms: Date.now() - inicio };
      }
      if (r.ok && tipo.includes('json')) {
        const dados = (await r.json()) as { items?: FonteDjen['comunicacoes'] };
        const itens = Array.isArray(dados.items) ? dados.items : [];
        return itens.length
          ? { status: 'ok', comunicacoes: itens, ms: Date.now() - inicio }
          : { status: 'vazio', ms: Date.now() - inicio };
      }
      ultimoErro = `HTTP ${r.status}${tipo.includes('json') ? '' : ', resposta não-JSON'}`;
    } catch (e) {
      ultimoErro = e instanceof Error && e.name === 'TimeoutError' ? 'tempo esgotado' : String(e);
    }
    if (t < 3) await esperar(400 * t);
  }
  return { status: 'erro', erro: `A DJEN não respondeu (${ultimoErro}).`, ms: Date.now() - inicio };
}

// ── Datajud ───────────────────────────────────────────────────────────────────

const URL_DATAJUD = 'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search';
const CAMPOS_DATAJUD = ['numeroProcesso', 'sistema', 'grau', 'orgaoJulgador', 'dataAjuizamento', 'classe'];

export async function consultarDatajud(digitos: string, chave: string): Promise<FonteDatajud> {
  const inicio = Date.now();
  if (!chave) return { status: 'erro', erro: 'Chave do Datajud não configurada no servidor.', ms: 0 };

  let ultimoErro = 'falha desconhecida';
  for (let t = 1; t <= 2; t++) {
    try {
      const r = await fetch(URL_DATAJUD, {
        method: 'POST',
        headers: { Authorization: `APIKey ${chave}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ size: 5, _source: CAMPOS_DATAJUD, query: { term: { numeroProcesso: digitos } } }),
        // Margem dentro do limite de 150 s de uma Edge Function.
        signal: AbortSignal.timeout(60_000),
      });
      if (r.ok) {
        const dados = (await r.json()) as { hits?: { hits?: { _source: NonNullable<FonteDatajud['hits']>[number] }[] } };
        const hits = (dados.hits?.hits ?? []).map((h) => h._source);
        return hits.length ? { status: 'ok', hits, ms: Date.now() - inicio } : { status: 'vazio', ms: Date.now() - inicio };
      }
      ultimoErro = r.status === 429 ? 'limite de consultas (HTTP 429)' : `HTTP ${r.status}`;
      if (![429, 502, 503, 504].includes(r.status)) break;
    } catch (e) {
      // Tempo esgotado já gastou 60 s: não repete.
      ultimoErro = e instanceof Error && e.name === 'TimeoutError' ? 'tempo esgotado' : String(e);
      break;
    }
    await esperar(4_000);
  }
  return { status: 'erro', erro: `O Datajud não respondeu (${ultimoErro}).`, ms: Date.now() - inicio };
}

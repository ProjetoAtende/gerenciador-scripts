import { createClient } from 'npm:@supabase/supabase-js@2.57.2';

/**
 * djen-proxy — consulta o DJEN (Comunica PJe) em nome do usuário autenticado.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTA FUNÇÃO EXISTE
 * ────────────────────────────────────────────────────────────────────────────
 * A API do DJEN devolve, na MESMA resposta:
 *     Access-Control-Allow-Origin: *
 *     Access-Control-Allow-Credentials: true
 * Essa combinação é rejeitada pelo Chromium, e o resultado é `net::ERR_FAILED` —
 * a chamada nunca chega ao JavaScript. Verificado em out/2026 contra a API real.
 * Consequência: não é possível consultar o DJEN direto do navegador.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ACESSO — fecha o achado PU-11 do relatório de teste
 * ────────────────────────────────────────────────────────────────────────────
 * A primeira versão rodava sem checagem de usuário e com CORS `*`: qualquer site
 * ou pessoa usava a função como proxy do DJEN, consumindo a cota (429) e as
 * invocações do projeto.
 *
 * Agora **toda** chamada exige sessão de usuário válida (`auth.getUser`). A anon
 * key não serve, porque não identifica ninguém. A checagem é feita aqui, e não
 * pelo gateway (`verify_jwt`), porque o cliente precisa enviar a anon key no
 * cabeçalho `apikey` — exigência do gateway do Supabase — e o gateway não
 * distingue anon de sessão de usuário.
 *
 * O diagnóstico de geo-bloqueio que existia aqui (`?diagnostico=1`) foi
 * removido: cumpriu o papel de medir o egress (IP brasileiro, DJEN em HTTP 200) e
 * manter um caminho privilegiado só aumentaria a superfície. Para refazer a
 * medição, use `SELECT ... FROM extensions.http_get(...)` no SQL Editor, que roda
 * como owner e não expõe nada por HTTP.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SOBRE O DJEN
 * ────────────────────────────────────────────────────────────────────────────
 * É uma API de DIÁRIO, não de consulta processual: só conhece processo que tenha
 * comunicação publicada, então `count = 0` NÃO prova que o processo não existe.
 * `itensPorPagina` aceita apenas 5 ou 100 (OpenAPI v1.0.4). Em 429, a orientação
 * oficial é aguardar 1 minuto.
 */

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS[0] : '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  Vary: 'Origin',
};

/** Reflete a origem quando ela está na lista permitida. */
function corsPara(req: Request): Record<string, string> {
  const origem = req.headers.get('Origin') ?? '';
  if (ALLOWED_ORIGINS.length === 0) {
    return { ...corsHeaders };
  }
  if (ALLOWED_ORIGINS.includes(origem)) {
    return { ...corsHeaders, 'Access-Control-Allow-Origin': origem };
  }
  return { ...corsHeaders, 'Access-Control-Allow-Origin': 'null' };
}

const DJEN_BASE = 'https://comunicaapi.pje.jus.br';
const TIMEOUT_MS = 15_000;
const SUFIXO_PADRAO = '8260100';

type Json = Record<string, unknown>;

const json = (body: Json, status = 200, cors: Record<string, string> = corsHeaders) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

/** Exige sessão de usuário autenticado. */
async function usuarioAutenticado(req: Request): Promise<{ ok: boolean; motivo?: string }> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return { ok: false, motivo: 'Informe o token de sessão no cabeçalho Authorization.' };
  }

  try {
    const cliente = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data, error } = await cliente.auth.getUser(token);
    if (error || !data?.user) {
      return { ok: false, motivo: 'Sessão inválida ou expirada.' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : 'Falha ao validar a sessão.' };
  }
}

const somenteDigitos = (v: unknown): string =>
  typeof v === 'string' ? v.replace(/\D/g, '') : '';

const formatarCnj = (d: string): string => {
  const s = d.slice(0, 20);
  if (s.length !== 20) return s;
  return `${s.slice(0, 7)}-${s.slice(7, 9)}.${s.slice(9, 13)}.${s.slice(13, 14)}.${s.slice(14, 16)}.${s.slice(16, 20)}`;
};

const extrairVara = (nome: string | null | undefined): number | null => {
  if (!nome) return null;
  const faixa = nome.match(/(\d{1,3})\s*ª?\s*a\s*(\d{1,3})\s*ª?\s*Varas?/i);
  if (faixa) {
    const n = Number.parseInt(faixa[1], 10);
    if (Number.isFinite(n)) return n;
  }
  const ind = nome.match(/(\d{1,3})\s*ª?\s*Vara\b/i);
  if (!ind) return null;
  const n = Number.parseInt(ind[1], 10);
  return Number.isFinite(n) ? n : null;
};

const complementar = (d: string): string => (d.length === 13 ? `${d}${SUFIXO_PADRAO}` : d);

async function comTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req: Request) => {
  const cors = corsPara(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const sessao = await usuarioAutenticado(req);
    if (!sessao.ok) {
      return json({ status: 'erro', detalhe: sessao.motivo ?? 'Não autorizado.' }, 401, cors);
    }

    const url = new URL(req.url);
    const corpo = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const bruto = somenteDigitos((corpo as Json).processo ?? url.searchParams.get('processo'));
    const numero = complementar(bruto);

    if (numero.length !== 20) {
      return json(
        {
          status: 'erro',
          detalhe:
            'Informe os 20 dígitos do padrão CNJ (ou até o ano, para complementação automática).',
        },
        400,
        cors
      );
    }

    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 730);

    const alvo = new URL(`${DJEN_BASE}/api/v1/comunicacao`);
    alvo.searchParams.set('numeroProcesso', numero);
    alvo.searchParams.set('itensPorPagina', '5');
    alvo.searchParams.set('pagina', '1');
    alvo.searchParams.set('dataDisponibilizacaoInicio', inicio.toISOString().slice(0, 10));
    alvo.searchParams.set('dataDisponibilizacaoFim', new Date().toISOString().slice(0, 10));

    const r = await comTimeout(alvo.toString(), TIMEOUT_MS);

    if (r.status === 429) {
      return json(
        { status: 'erro', detalhe: 'Limite de requisições do DJEN atingido. Aguarde 1 minuto.' },
        429,
        cors
      );
    }

    if (r.status === 403) {
      return json(
        {
          status: 'erro',
          detalhe:
            'O DJEN recusou a requisição (HTTP 403). A API restringe IPs fora do Brasil — verifique a origem de saída.',
          geoBloqueio: true,
        },
        403,
        cors
      );
    }

    if (!r.ok) {
      return json({ status: 'erro', detalhe: `DJEN respondeu HTTP ${r.status}.` }, 502, cors);
    }

    const dados = (await r.json()) as { count?: number; items?: Json[] };
    const itens = Array.isArray(dados.items) ? dados.items : [];

    if (itens.length === 0) {
      return json(
        {
          status: 'sem_comunicacao',
          processo: numero,
          processoFormatado: formatarCnj(numero),
          totalComunicacoes: 0,
          detalhe:
            'Nenhuma comunicação publicada no DJEN na janela consultada. Isso NÃO confirma que o processo não existe.',
        },
        200,
        cors
      );
    }

    const ordenados = [...itens].sort((a, b) =>
      String(b.data_disponibilizacao ?? '').localeCompare(String(a.data_disponibilizacao ?? ''))
    );
    const principal = ordenados[0];
    const nomeOrgao = (principal.nomeOrgao as string | undefined) ?? null;

    return json(
      {
        status: 'localizado',
        processo: numero,
        processoFormatado: (principal.numeroprocessocommascara as string) || formatarCnj(numero),
        vara: extrairVara(nomeOrgao),
        nomeOrgao,
        idOrgao: typeof principal.idOrgao === 'number' ? principal.idOrgao : null,
        siglaTribunal: (principal.siglaTribunal as string) ?? null,
        nomeClasse: (principal.nomeClasse as string) ?? null,
        totalComunicacoes: typeof dados.count === 'number' ? dados.count : itens.length,
        ultimaDisponibilizacao: (principal.data_disponibilizacao as string) ?? null,
        tiposDocumento: Array.from(
          new Set(
            ordenados.map((i) => i.tipoDocumento).filter((t): t is string => typeof t === 'string')
          )
        ),
      },
      200,
      cors
    );
  } catch (e) {
    return json(
      {
        status: 'erro',
        detalhe: e instanceof Error ? e.message : 'Falha inesperada no proxy do DJEN.',
      },
      500,
      cors
    );
  }
});

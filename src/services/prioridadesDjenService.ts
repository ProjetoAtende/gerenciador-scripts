/**
 * prioridadesDjenService.ts
 *
 * Integração com o DJEN (Comunica PJe) para validar o número do processo e
 * detectar a UPJ — RF-ATD-02, RF-ATD-03 e RF-ATD-04.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE A CONSULTA PASSA POR UMA EDGE FUNCTION, E NÃO DIRETO DO NAVEGADOR
 * ────────────────────────────────────────────────────────────────────────────
 * A API do DJEN devolve, na MESMA resposta:
 *     Access-Control-Allow-Origin: *
 *     Access-Control-Allow-Credentials: true
 * Essa combinação é rejeitada pelo Chromium. Verificado em out/2026, no app
 * rodando de verdade: o servidor responde HTTP 200 com os headers acima e o
 * navegador ainda assim aborta com `net::ERR_FAILED`. Ou seja, chamar o DJEN
 * direto do cliente NÃO funciona, por mais correto que o código esteja.
 *
 * A Edge Function `djen-proxy` resolve o CORS e ainda centraliza cache futuro.
 *
 * GEO-BLOQUEIO — MEDIDO, NÃO SUPOSTO
 * ────────────────────────────────────────────────────────────────────────────
 * Havia o risco de o DJEN bloquear IPs fora do Brasil (HTTP 403) e de esta
 * função ser bloqueada por rodar em região internacional. O diagnóstico
 * embutido no proxy (`?diagnostico=1`) mostrou que o egress deste projeto sai
 * por IP brasileiro (15.228.149.169) e o DJEN respondeu HTTP 200. O bloqueio
 * NÃO se aplica hoje. Como isso depende do roteamento de saída do provedor,
 * trate como dependência monitorável: se um dia voltar 403, a resposta é migrar
 * o projeto para região brasileira.
 *
 * ARQUITETURA
 * ────────────────────────────────────────────────────────────────────────────
 * A Edge Function devolve a resposta já normalizada. Esta camada mantém, ainda
 * assim, a normalização como fallback: se o proxy antigo estiver em cache no
 * navegador, ou se o contrato mudar, o cliente continua funcionando a partir dos
 * campos crus do DJEN.
 *
 * Demais notas verificadas contra a API real:
 *  - É uma API de DIÁRIO, não de consulta processual. Só "conhece" processo que
 *    tenha comunicação publicada; `count = 0` NÃO prova que o processo não existe.
 *  - O campo `nomeOrgao` do Fórum Central Cível já vem como a UPJ
 *    ("UPJ da 26ª a 30ª Varas Cíveis - Foro Central Cível"). A chave estável é
 *    `idOrgao` (numérico) — mais rico que o inteiro "Vara 1 a 45" previsto na
 *    especificação.
 *  - `itensPorPagina` aceita apenas 5 ou 100 (OpenAPI v1.0.4).
 *  - Em 429, a orientação oficial é aguardar 1 minuto.
 * ────────────────────────────────────────────────────────────────────────────
 */

import type {
  DjenResultado,
  PlataformaProcessual,
  ValidacaoDjenStatus,
} from '../types/Prioridades';

/** URL da Edge Function que faz proxy da consulta (evita o CORS quebrado do DJEN). */
const DJEN_PROXY_URL =
  (import.meta.env.VITE_DJEN_PROXY_URL as string | undefined)?.replace(/\/+$/, '') ||
  (() => {
    const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
    return base ? `${base}/functions/v1/djen-proxy` : '';
  })();

import { supabase } from './supabaseClient';

const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

const TIMEOUT_MS = 20_000;
const TTL_CACHE_MS = 5 * 60 * 1000;

/** Janela de consulta: publicações dos últimos N dias. */
const JANELA_DIAS_PADRAO = 730;

// ──────────────────────────────────────────────────────────────
// Máscara e normalização do número CNJ (RF-ATD-01/02)
// ──────────────────────────────────────────────────────────────

/** Remove tudo que não é dígito. Formato de armazenamento (RF-ATD-01). */
export function somenteDigitos(valor: string): string {
  return (valor ?? '').replace(/\D/g, '');
}

/**
 * Aplica a máscara CNJ progressiva: NNNNNNN-DD.AAAA.J.TR.OOOO
 * Aceita entrada parcial e devolve o que já é possível formatar — é o que
 * permite usar a função direto em um input controlado.
 */
export function formatarProcessoCnj(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 20);

  const p1 = d.slice(0, 7);
  const p2 = d.slice(7, 9);
  const p3 = d.slice(9, 13);
  const p4 = d.slice(13, 14);
  const p5 = d.slice(14, 16);
  const p6 = d.slice(16, 20);

  let out = p1;
  if (p2) out += `-${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `.${p4}`;
  if (p5) out += `.${p5}`;
  if (p6) out += `.${p6}`;
  return out;
}

/** Número completo: 20 dígitos. */
export function processoCompleto(valor: string): boolean {
  return somenteDigitos(valor).length === 20;
}

/**
 * RF-ATD-02: complementação de número truncado.
 *
 * "Se informado apenas até o ano (ex.: 0123456-12.2026), o sistema acrescenta
 * o sufixo 8.26.0100 e tenta a verificação com o número completo."
 *
 * O gatilho é 13 dígitos: sequencial (7) + dígito verificador (2) + ano (4).
 * É exatamente o recorte do exemplo da especificação — sem o bloco J.TR.OOOO.
 * Faltam, portanto, 7 dígitos, e não 5.
 */
export const SUFIXO_CNJ_PADRAO_TJSP_CENTRAL = '8260100';

/** Dígitos presentes em "NNNNNNN-DD.AAAA" — o recorte "até o ano". */
const DIGITOS_ATE_O_ANO = 13;
const DIGITOS_CNJ_COMPLETO = 20;

export function complementarProcesso(valor: string): { numero: string; complementado: boolean } {
  const d = somenteDigitos(valor);

  if (d.length === DIGITOS_CNJ_COMPLETO) return { numero: d, complementado: false };

  if (d.length === DIGITOS_ATE_O_ANO) {
    return { numero: `${d}${SUFIXO_CNJ_PADRAO_TJSP_CENTRAL}`, complementado: true };
  }

  return { numero: d, complementado: false };
}

/**
 * Extrai o número da Vara a partir do nome do órgão do DJEN, quando presente.
 *
 * Dois formatos coexistem na base do DJEN:
 *   1. Órgão que É uma Vara:        "3ª Vara Cível - Birigui", "Foro Central Cível - 34ª Vara Cível"
 *   2. Órgão que agrupa uma UPJ:    "UPJ da 26ª a 30ª Varas Cíveis - Foro Central Cível"
 *
 * No formato (2) devolvemos a PRIMEIRA Vara da faixa, que é o que identifica o
 * grupo. É sempre um dado auxiliar: a detecção da UPJ usa `idOrgao`.
 */
export function extrairVara(nomeOrgao: string | null | undefined): number | null {
  if (!nomeOrgao) return null;

  // Formato agrupado: "UPJ da 26ª a 30ª Varas ..."
  const faixa = nomeOrgao.match(/(\d{1,3})\s*ª?\s*a\s*(\d{1,3})\s*ª?\s*Varas?/i);
  if (faixa) {
    const n = Number.parseInt(faixa[1], 10);
    if (Number.isFinite(n)) return n;
  }

  // Formato individual: "3ª Vara Cível"
  const individual = nomeOrgao.match(/(\d{1,3})\s*ª?\s*Vara\b/i);
  if (!individual) return null;
  const n = Number.parseInt(individual[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** Sigla do tribunal a partir dos dígitos do CNJ (posições J.TR). */
export function tribunalDoProcesso(valor: string): string | null {
  const d = somenteDigitos(valor);
  if (d.length !== 20) return null;
  return d.slice(13, 16);
}

/**
 * Plataforma processual — NÃO é detectável a partir do DJEN.
 *
 * [LACUNA FECHADA POR DECISÃO] A especificação previa exibir o sistema
 * (Eproc ou SAJ) como retorno da consulta (RF-ATD-03). O DJEN não informa em
 * qual sistema o processo tramita, e o número CNJ não carrega essa informação.
 *
 * Decisão do projeto: o campo é de preenchimento opcional pelo atendente, na
 * tela "Nova Anotação". O DJEN só fornece o que é capaz de fornecer — número,
 * Vara (quando houver) e órgão. Por isso `DjenResultado.plataforma` permanece
 * sempre `null` e a UI usa o valor informado no formulário.
 */
export const PLATAFORMAS_DISPONIVEIS: ReadonlyArray<PlataformaProcessual> = ['eproc', 'saj'];

// ──────────────────────────────────────────────────────────────
// Cache e controle de taxa
// ──────────────────────────────────────────────────────────────

interface EntradaCache {
  expiraEm: number;
  valor: DjenResultado;
}

const cache = new Map<string, EntradaCache>();

/** Instante em que a API sinalizou 429 — novas consultas ficam suspensas até lá. */
let bloqueadoAte = 0;

export function djenEmEsperaDeTaxa(): { bloqueado: boolean; liberaEm: number | null } {
  if (Date.now() >= bloqueadoAte) return { bloqueado: false, liberaEm: null };
  return { bloqueado: true, liberaEm: bloqueadoAte };
}

/** Limpa o cache — usado nos testes. */
export function limparCacheDjen(): void {
  cache.clear();
  bloqueadoAte = 0;
}

// ──────────────────────────────────────────────────────────────
// Consulta
// ──────────────────────────────────────────────────────────────

export interface ComunicacaoDjen {
  id?: number;
  data_disponibilizacao?: string;
  siglaTribunal?: string;
  tipoComunicacao?: string;
  tipoDocumento?: string;
  nomeOrgao?: string;
  idOrgao?: number;
  nomeClasse?: string;
  numero_processo?: string;
  numeroprocessocommascara?: string;
  status?: string;
  motivo_cancelamento?: string | null;
}

interface RespostaDjen {
  status?: string;
  message?: string;
  count?: number;
  items?: ComunicacaoDjen[];
}

/**
 * Contrato de retorno da Edge Function `djen-proxy`. Os campos crus do DJEN
 * (`items`, `count`, `message`) são aceitos junto para que esta camada funcione
 * também se um proxy antigo estiver em cache no navegador.
 */
interface RespostaProxyDjen extends RespostaDjen {
  detalhe?: string;
  geoBloqueio?: boolean;
  processo?: string;
  processoFormatado?: string;
  vara?: number | null;
  nomeOrgao?: string | null;
  idOrgao?: number | null;
  siglaTribunal?: string | null;
  nomeClasse?: string | null;
  totalComunicacoes?: number;
  ultimaDisponibilizacao?: string | null;
  tiposDocumento?: string[];
}

function vazio(processo: string, status: ValidacaoDjenStatus, detalhe: string | null): DjenResultado {
  return {
    status,
    processo: somenteDigitos(processo),
    processoFormatado: formatarProcessoCnj(processo),
    vara: null,
    nomeOrgao: null,
    idOrgao: null,
    plataforma: null,
    siglaTribunal: null,
    nomeClasse: null,
    totalComunicacoes: 0,
    ultimaDisponibilizacao: null,
    tiposDocumento: [],
    detalhe,
  };
}

/**
 * Consulta o processo no DJEN e normaliza a resposta.
 *
 * Nunca lança: devolve `status: 'erro'` com detalhe legível. O registro da
 * anotação não pode ser bloqueado por indisponibilidade da API (RNF-05).
 */
export async function consultarProcesso(
  processoInformado: string,
  opcoes: { usarCache?: boolean; janelaDias?: number } = {}
): Promise<DjenResultado> {
  const { usarCache = true, janelaDias = JANELA_DIAS_PADRAO } = opcoes;

  const bruto = somenteDigitos(processoInformado);
  if (!bruto) {
    return vazio(bruto, 'erro', 'Informe o número do processo.');
  }

  const { numero } = complementarProcesso(bruto);

  if (numero.length !== 20) {
    return vazio(numero, 'erro',
      'Número incompleto. Informe os 20 dígitos do padrão CNJ ou até o ano para complementação automática.');
  }

  const chaveCache = numero;
  if (usarCache) {
    const hit = cache.get(chaveCache);
    if (hit && hit.expiraEm > Date.now()) return hit.valor;
  }

  const espera = djenEmEsperaDeTaxa();
  if (espera.bloqueado) {
    return vazio(numero, 'erro',
      `A API do DJEN recusou novas consultas por limite de requisições. Tente novamente em ${Math.max(
        1,
        Math.ceil(((espera.liberaEm ?? Date.now()) - Date.now()) / 1000)
      )}s.`);
  }

  const inicio = new Date();
  inicio.setDate(inicio.getDate() - janelaDias);

  if (!DJEN_PROXY_URL) {
    return vazio(numero, 'erro',
      'Proxy do DJEN não configurado. Defina VITE_SUPABASE_URL (ou VITE_DJEN_PROXY_URL).');
  }

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    // PU-11: o proxy exige SESSÃO de usuário. Enviamos o access_token da sessão
    // (não a anon key, que não identifica ninguém) e a anon key como `apikey`,
    // que é o que o gateway do Supabase espera.
    const { data: sessao } = await supabase.auth.getSession();
    const tokenSessao = sessao?.session?.access_token;

    if (!tokenSessao) {
      return vazio(numero, 'erro',
        'Sessão expirada. Entre novamente para consultar o processo no DJEN.');
    }

    const resposta = await fetch(DJEN_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${tokenSessao}`,
      },
      body: JSON.stringify({
        processo: numero,
        dataDisponibilizacaoInicio: inicio.toISOString().slice(0, 10),
        dataDisponibilizacaoFim: new Date().toISOString().slice(0, 10),
      }),
      signal: controlador.signal,
    });

    const corpo = (await resposta.json().catch(() => ({}))) as RespostaProxyDjen;

    if (resposta.status === 401) {
      return vazio(numero, 'erro',
        corpo.detalhe ?? 'Sessão inválida ou expirada. Entre novamente para consultar o DJEN.');
    }

    if (resposta.status === 429) {
      bloqueadoAte = Date.now() + 60_000;
      return vazio(numero, 'erro',
        'Limite de requisições do DJEN atingido. Aguarde 1 minuto e tente novamente.');
    }

    if (resposta.status === 403 || corpo.geoBloqueio) {
      return vazio(numero, 'erro',
        corpo.detalhe ??
          'O DJEN recusou a requisição (HTTP 403): a API restringe IPs fora do Brasil.');
    }

    if (!resposta.ok) {
      return vazio(numero, 'erro',
        corpo.detalhe ?? `A consulta ao DJEN falhou (HTTP ${resposta.status}).`);
    }

    const status = corpo.status as ValidacaoDjenStatus | undefined;

    if (status === 'sem_comunicacao') {
      const resultado = vazio(numero, 'sem_comunicacao', corpo.detalhe ?? null);
      resultado.processoFormatado = corpo.processoFormatado || formatarProcessoCnj(numero);
      if (usarCache) cache.set(chaveCache, { expiraEm: Date.now() + TTL_CACHE_MS, valor: resultado });
      return resultado;
    }

    if (status === 'localizado') {
      // A Edge Function já normaliza; o fallback abaixo cobre resposta crua do DJEN.
      const itens = Array.isArray(corpo.items) ? corpo.items : [];
      const ordenados = [...itens].sort((a, b) =>
        (b.data_disponibilizacao ?? '').localeCompare(a.data_disponibilizacao ?? '')
      );
      const principal = ordenados[0];

      const nomeOrgao = corpo.nomeOrgao ?? principal?.nomeOrgao ?? null;
      const idOrgao =
        typeof corpo.idOrgao === 'number'
          ? corpo.idOrgao
          : typeof principal?.idOrgao === 'number'
            ? principal.idOrgao
            : null;

      const tiposDocumento =
        corpo.tiposDocumento && corpo.tiposDocumento.length > 0
          ? corpo.tiposDocumento
          : Array.from(
              new Set(ordenados.map((i) => i.tipoDocumento).filter((t): t is string => !!t))
            );

      const resultado: DjenResultado = {
        status: 'localizado',
        processo: numero,
        processoFormatado:
          corpo.processoFormatado || principal?.numeroprocessocommascara || formatarProcessoCnj(numero),
        vara: typeof corpo.vara === 'number' ? corpo.vara : extrairVara(nomeOrgao),
        nomeOrgao,
        idOrgao,
        // Sempre null: o DJEN não informa a plataforma (ver nota acima).
        plataforma: null,
        siglaTribunal: corpo.siglaTribunal ?? principal?.siglaTribunal ?? null,
        nomeClasse: corpo.nomeClasse ?? principal?.nomeClasse ?? null,
        totalComunicacoes:
          typeof corpo.totalComunicacoes === 'number'
            ? corpo.totalComunicacoes
            : typeof corpo.count === 'number'
              ? corpo.count
              : itens.length,
        ultimaDisponibilizacao:
          corpo.ultimaDisponibilizacao ?? principal?.data_disponibilizacao ?? null,
        tiposDocumento,
        detalhe: null,
      };

      if (usarCache) cache.set(chaveCache, { expiraEm: Date.now() + TTL_CACHE_MS, valor: resultado });
      return resultado;
    }

    return vazio(numero, 'erro', corpo.detalhe ?? 'Resposta inesperada do proxy do DJEN.');
  } catch (erro) {
    const mensagem =
      erro instanceof DOMException && erro.name === 'AbortError'
        ? 'A consulta ao DJEN excedeu o tempo limite.'
        : erro instanceof Error
          ? erro.message
          : 'Falha desconhecida na consulta ao DJEN.';
    return vazio(numero, 'erro', mensagem);
  } finally {
    clearTimeout(timer);
  }
}

/** Sugestão de tipo de prioridade a partir da comunicação mais recente (RF-ATD-06). */
export function sugerirTipoPrioridade(resultado: DjenResultado): string | null {
  if (resultado.status !== 'localizado') return null;
  const doc = (resultado.tiposDocumento[0] ?? '').toLowerCase();
  if (doc.includes('senten')) return 'urgencia-determinada';
  return null;
}

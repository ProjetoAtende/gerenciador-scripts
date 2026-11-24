/**
 * Serviços próprios da v2 (etapa 2). Usam as funções `prioridades_v2_*` do banco e a
 * Edge Function `prioridades-localizar`; a v1 continua com `prioridadesService.ts`.
 */
import type {
  NovaAnotacaoPayload,
  PrioridadePerfil,
  PrioridadeStatus,
  RespostaRpc,
} from '../types/Prioridades';
import type { ResultadoLocalizacao } from '../../supabase/functions/_shared/localizador';
import { supabase } from './supabaseClient';

export type { ResultadoLocalizacao } from '../../supabase/functions/_shared/localizador';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
const URL_LOCALIZAR = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/prioridades-localizar` : '';

async function rpc(nome: string, args: Record<string, unknown>): Promise<RespostaRpc> {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) {
    console.error(`[prioridadesV2Service] ${nome}:`, error);
    if (error.code === 'PGRST202' || /could not find/i.test(error.message)) {
      return { sucesso: false, erro: 'Esta função da versão nova ainda não foi instalada no banco.' };
    }
    return { sucesso: false, erro: error.message };
  }
  return data && typeof data === 'object' ? (data as RespostaRpc) : { sucesso: false, erro: 'Resposta inesperada do servidor.' };
}

// ── A: localização (Datajud + DJEN) ─────────────────────────────────────────

async function chamarLocalizar(corpo: Record<string, unknown>, timeoutMs: number): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre novamente.');
  if (!URL_LOCALIZAR) throw new Error('Endereço do servidor não configurado (VITE_SUPABASE_URL).');
  return fetch(URL_LOCALIZAR, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * 'rapido'  : só a DJEN (fração de segundo).
 * 'completo': DJEN + Datajud — pode levar até 2 minutos; a tela chama em segundo plano.
 * Nunca lança: falha vira { ok: false, erro }.
 */
export async function localizarProcesso(
  processo: string,
  modo: 'rapido' | 'completo'
): Promise<{ ok: true; resultado: ResultadoLocalizacao } | { ok: false; erro: string }> {
  try {
    const r = await chamarLocalizar({ processo, modo }, modo === 'rapido' ? 25_000 : 150_000);
    const corpo = (await r.json().catch(() => ({}))) as ResultadoLocalizacao & { erro?: string };
    if (!r.ok) return { ok: false, erro: corpo.erro ?? `A localização falhou (HTTP ${r.status}).` };
    return { ok: true, resultado: corpo };
  } catch (e) {
    const tempo = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return { ok: false, erro: tempo ? 'A consulta demorou demais.' : e instanceof Error ? e.message : 'Falha na localização.' };
  }
}

/**
 * Anotação enviada antes de o Datajud responder: o servidor termina a consulta
 * sozinho e grava a Vara (só se ela estiver vazia). Não espera o resultado.
 */
export function completarLocalizacaoDepois(anotacaoId: number): void {
  void chamarLocalizar({ modo: 'completar', anotacao_id: anotacaoId }, 30_000).catch((e) =>
    console.warn('[prioridadesV2Service] completar localização:', e)
  );
}

// ── Criação (C, D, G) ───────────────────────────────────────────────────────

export interface NovaAnotacaoPayloadV2 extends NovaAnotacaoPayload {
  descricao_resumida?: string;
  vara_fonte?: 'datajud' | 'djen' | 'atendente' | null;
  urgentissimo?: boolean;
  competencia_excecao?: string;
}

export interface RespostaCriacaoV2 extends RespostaRpc {
  fora_competencia?: boolean;
  pode_excecao?: boolean;
}

export async function criarAnotacaoV2(payload: NovaAnotacaoPayloadV2): Promise<RespostaCriacaoV2> {
  return rpc('prioridades_v2_criar_anotacao', { p_dados: payload });
}

// ── Conferência (N) ─────────────────────────────────────────────────────────

/** Só as chaves presentes são aplicadas; '' limpa um campo opcional. */
export interface AlteracoesConferenciaV2 {
  descricao_prioridade?: string;
  descricao_resumida?: string;
  evento_folha?: string;
  categoria?: string;
  tipo_solicitante?: string;
  descricao_solicitante?: string;
  nome_solicitante?: string;
  tipo_prioridade?: string;
  descricao_tipo_outros?: string;
  plataforma?: string;
  vara?: string;
  observacao_adicional_atende?: string;
  observacao_adicional_gestor?: string;
  upj_id?: string;
}

export async function conferirAnotacaoV2(d: {
  anotacaoId: number;
  decisao: 'aprovar' | 'devolver' | 'rejeitar';
  justificativa?: string;
  urgentissimo?: boolean;
  correcaoAutomatica?: boolean;
  textoCorrecao?: string;
  alteracoes: AlteracoesConferenciaV2;
}): Promise<RespostaRpc> {
  return rpc('prioridades_v2_conferir', {
    p_anotacao_id: d.anotacaoId,
    p_decisao: d.decisao,
    p_justificativa: d.justificativa ?? null,
    p_urgentissimo: d.urgentissimo ?? false,
    p_correcao_automatica: d.correcaoAutomatica ?? false,
    p_texto_correcao: d.textoCorrecao ?? null,
    p_alteracoes: d.alteracoes,
  });
}

// ── E: anotações anteriores com a resposta da UPJ ───────────────────────────

export interface AnotacaoAnteriorV2 {
  id: number;
  status: PrioridadeStatus;
  data_anotacao: string;
  descricao_prioridade: string;
  descricao_resumida: string | null;
  criador_nome: string;
  tipo_prioridade: string;
  upj_codigo: string | null;
  observacao_adicional_upj: string | null;
  justificativa_devolucao_upj: string | null;
  justificativa_rejeicao_upj: string | null;
  justificativa_rejeicao_gestor: string | null;
  data_resolucao_upj: string | null;
}

export async function listarAnterioresV2(processo: string, dias = 120): Promise<AnotacaoAnteriorV2[]> {
  const { data, error } = await supabase.rpc('prioridades_v2_anteriores', { p_processo: processo, p_dias: dias });
  if (error) {
    console.error('[prioridadesV2Service] listarAnterioresV2:', error);
    return [];
  }
  return (data ?? []) as AnotacaoAnteriorV2[];
}

/** O que a UPJ (ou o Gestor, na reprovação) respondeu — para repassar ao público. */
export function respostasDaAnterior(a: AnotacaoAnteriorV2): { rotulo: string; texto: string }[] {
  const lista: { rotulo: string; texto: string }[] = [];
  if (a.observacao_adicional_upj?.trim()) lista.push({ rotulo: 'Informação a ser repassada ao Solicitante', texto: a.observacao_adicional_upj });
  if (a.justificativa_rejeicao_upj?.trim()) lista.push({ rotulo: 'Motivo da rejeição pela UPJ', texto: a.justificativa_rejeicao_upj });
  if (a.justificativa_devolucao_upj?.trim()) lista.push({ rotulo: 'Retorno da UPJ', texto: a.justificativa_devolucao_upj });
  if (a.justificativa_rejeicao_gestor?.trim()) lista.push({ rotulo: 'Motivo da reprovação pelo Gestor', texto: a.justificativa_rejeicao_gestor });
  return lista;
}

// ── F: regras especiais por UPJ + Categoria + Tipo ──────────────────────────

export interface RegraEspecialV2 {
  id: string;
  upj_id: string;
  tipo_prioridade: string;
  /** null = todas as categorias */
  categoria: string | null;
  texto: string;
}

export async function listarRegrasV2(): Promise<RegraEspecialV2[]> {
  const { data, error } = await supabase.rpc('prioridades_v2_regras_listar');
  if (error) {
    console.error('[prioridadesV2Service] listarRegrasV2:', error);
    return [];
  }
  return (data ?? []) as RegraEspecialV2[];
}

export async function salvarRegraV2(upjId: string, tipo: string, categoria: string | null, texto: string): Promise<RespostaRpc> {
  return rpc('prioridades_v2_regra_salvar', { p_upj_id: upjId, p_tipo: tipo, p_categoria: categoria, p_texto: texto });
}

/** Regras que valem para a combinação escolhida: as da categoria primeiro, depois as de "todas". */
export function regrasAplicaveis(
  regras: RegraEspecialV2[],
  upjId: string | null,
  tipo: string,
  categoria: string
): RegraEspecialV2[] {
  if (!upjId || !tipo) return [];
  return regras
    .filter((r) => r.upj_id === upjId && r.tipo_prioridade === tipo && r.texto.trim() && (r.categoria === null || r.categoria === categoria))
    .sort((x, y) => (x.categoria === null ? 1 : 0) - (y.categoria === null ? 1 : 0));
}

// ── B: designações (com a trava da UPJ do Coordenador) ──────────────────────

export async function designarUsuarioV2(params: {
  usuarioId: string;
  perfil: PrioridadePerfil;
  inicio?: string | null;
  fim?: string | null;
  upjId?: string | null;
}): Promise<RespostaRpc> {
  return rpc('prioridades_v2_designar', {
    p_usuario_id: params.usuarioId,
    p_perfil: params.perfil,
    p_inicio: params.inicio || undefined,
    p_fim: params.fim || null,
    p_upj_id: params.upjId || null,
  });
}

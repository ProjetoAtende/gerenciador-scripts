import { supabase } from './supabaseClient';

// --- Tipos ---

export interface ScriptsResumo {
  total: number;
  revisados: number;
  pendentes_revisao: number;
}

export interface TopCriador {
  user_id: string;
  nome: string;
  equipe_nome: string | null;
  total: number;
}

export interface DadosPorPeriodo {
  data: string; // YYYY-MM-DD
  total: number;
}

export interface CriadorPorPeriodo {
  user_id: string;
  nome: string;
  data: string;
  total: number;
}

export interface TopRevisor {
  user_id: string;
  nome: string;
  total_revisoes: number;
  total_aprovacoes: number;
}

export interface PropostaPorPeriodo {
  data: string;
  total: number;
  aprovadas: number;
  rejeitadas: number;
  pendentes: number;
}

export interface EquipeCriadora {
  equipe_id: string;
  equipe_nome: string;
  total_scripts: number;
  total_usuarios: number;
}

export type PeriodoFiltro = '24h' | '48h' | '72h' | '7d' | '30d' | '60d' | '3m' | 'all';

// --- Helpers ---

function periodoParaTimestamp(periodo: PeriodoFiltro): string {
  const now = new Date();
  switch (periodo) {
    case '24h': now.setHours(now.getHours() - 24); break;
    case '48h': now.setHours(now.getHours() - 48); break;
    case '72h': now.setHours(now.getHours() - 72); break;
    case '7d':  now.setDate(now.getDate() - 7); break;
    case '30d': now.setDate(now.getDate() - 30); break;
    case '60d': now.setDate(now.getDate() - 60); break;
    case '3m':  now.setMonth(now.getMonth() - 3); break;
    case 'all': return '2020-01-01T00:00:00Z';
  }
  return now.toISOString();
}

// --- Service Functions ---

export async function fetchResumo(): Promise<ScriptsResumo> {
  const { data, error } = await supabase.rpc('stats_scripts_resumo');
  if (error) throw error;
  return data as ScriptsResumo;
}

export async function fetchTopCriadores(limit = 15): Promise<TopCriador[]> {
  const { data, error } = await supabase.rpc('stats_scripts_top_criadores', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as TopCriador[];
}

export async function fetchCriacaoPorPeriodo(periodo: PeriodoFiltro): Promise<DadosPorPeriodo[]> {
  const { data, error } = await supabase.rpc('stats_scripts_criacao_por_periodo', {
    p_desde: periodoParaTimestamp(periodo),
  });
  if (error) throw error;
  return (data ?? []) as DadosPorPeriodo[];
}

export async function fetchRevisaoPorPeriodo(periodo: PeriodoFiltro): Promise<DadosPorPeriodo[]> {
  const { data, error } = await supabase.rpc('stats_scripts_revisao_por_periodo', {
    p_desde: periodoParaTimestamp(periodo),
  });
  if (error) throw error;
  return (data ?? []) as DadosPorPeriodo[];
}

export async function fetchCriadoresPorPeriodo(periodo: PeriodoFiltro, limit = 10): Promise<CriadorPorPeriodo[]> {
  const { data, error } = await supabase.rpc('stats_scripts_criadores_por_periodo', {
    p_desde: periodoParaTimestamp(periodo),
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as CriadorPorPeriodo[];
}

export async function fetchTopRevisores(periodo: PeriodoFiltro, limit = 15): Promise<TopRevisor[]> {
  const { data, error } = await supabase.rpc('stats_scripts_top_revisores', {
    p_desde: periodoParaTimestamp(periodo),
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as TopRevisor[];
}

export async function fetchPropostasPorPeriodo(periodo: PeriodoFiltro): Promise<PropostaPorPeriodo[]> {
  const { data, error } = await supabase.rpc('stats_scripts_propostas_por_periodo', {
    p_desde: periodoParaTimestamp(periodo),
  });
  if (error) throw error;
  return (data ?? []) as PropostaPorPeriodo[];
}

export async function fetchEquipesCriadoras(limit = 15): Promise<EquipeCriadora[]> {
  const { data, error } = await supabase.rpc('stats_scripts_equipes_criadoras', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as EquipeCriadora[];
}

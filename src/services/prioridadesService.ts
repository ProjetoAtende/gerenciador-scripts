/**
 * prioridadesService.ts
 *
 * Camada de dados do app "Prioridades e Urgências".
 *
 * Todas as escritas passam por RPCs SECURITY DEFINER (mesmo padrão de
 * servicosService.ts): a máquina de estados da especificação não pode ser
 * contornada por um UPDATE solto do cliente, e o histórico precisa ser gravado
 * junto com a transição. Leituras usam o client com RLS
 * (prioridades_pode_ver, definida na migration de RLS).
 */

import { supabase } from './supabaseClient';
import type {
  AnotacaoAnterior,
  AnotacaoPrioridade,
  DesignacaoListada,
  HistoricoAnotacao,
  NovaAnotacaoPayload,
  PerfilBase,
  PerfilUsuarioPrioridades,
  PrioridadeModulo,
  PrioridadePerfil,
  PrioridadeStatus,
  RespostaRpc,
  Upj,
  UsuarioElegivel,
} from '../types/Prioridades';
import { MODULO_DO_PERFIL, STATUS_DEVOLVIDA } from '../types/Prioridades';

const COLUNAS_ANOTACAO = '*';

// ──────────────────────────────────────────────────────────────
// Perfil do usuário no app
// ──────────────────────────────────────────────────────────────

/**
 * Perfil do usuário logado no app de Prioridades, já considerando as designações
 * em vigor.
 *
 * RPC em vez de select direto para tolerar com clareza o caso "usuário ainda
 * não cadastrado no app" — que é o esperado no primeiro acesso e não deve
 * aparecer como erro.
 *
 * O módulo é derivado do PERFIL EFETIVO (perfil base ou designação ativa). É o
 * que faz um atendente designado Conferente passar a ver o módulo Gestores.
 */
export async function obterMeuPerfil(): Promise<{
  sucesso: boolean;
  perfil: PerfilUsuarioPrioridades | null;
  modulo: PrioridadeModulo | null;
  /** Perfil que de fato habilita o módulo (base ou designação). */
  perfilEfetivo: PrioridadePerfil | null;
  erro?: string;
}> {
  const { data, error } = await supabase.rpc('prioridades_meu_perfil');

  if (error) {
    if (error.code === 'PGRST202' || /could not find/i.test(error.message)) {
      return {
        sucesso: false,
        perfil: null,
        modulo: null,
        perfilEfetivo: null,
        erro: 'Módulo de Prioridades ainda não instalado no banco.',
      };
    }
    console.error('[prioridadesService] obterMeuPerfil error:', error);
    return { sucesso: false, perfil: null, modulo: null, perfilEfetivo: null, erro: error.message };
  }

  const linhas = (data ?? []) as PerfilUsuarioPrioridades[];
  if (linhas.length === 0) {
    return { sucesso: true, perfil: null, modulo: null, perfilEfetivo: null };
  }

  const perfil = linhas[0];
  const designacoes = perfil.designacoes_ativas ?? [];

  // A designação prevalece sobre o perfil base quando habilita um módulo
  // diferente: é ela que concede a capacidade operacional no momento.
  const primeiro = (p: PrioridadePerfil) => designacoes.some((d) => d.perfil === p);

  let perfilEfetivo: PrioridadePerfil = perfil.perfil;
  if (primeiro('gestor')) perfilEfetivo = 'gestor';
  else if (primeiro('conferente')) perfilEfetivo = 'conferente';
  else if (primeiro('coordenador')) perfilEfetivo = 'coordenador';
  else if (primeiro('analista')) perfilEfetivo = 'analista';

  return {
    sucesso: true,
    perfil,
    modulo: MODULO_DO_PERFIL[perfilEfetivo],
    perfilEfetivo,
  };
}

// ──────────────────────────────────────────────────────────────
// Catálogos
// ──────────────────────────────────────────────────────────────

export interface CatalogoItem {
  codigo: string;
  label: string;
  ordem: number;
  aviso?: string | null;
  aviso_link_label?: string | null;
  aviso_link_url?: string | null;
}

export async function listarTiposSolicitante(): Promise<CatalogoItem[]> {
  const { data, error } = await supabase
    .from('prioridades_tipos_solicitante')
    .select('codigo, label, ordem')
    .eq('ativo', true)
    .order('ordem');

  if (error) {
    console.error('[prioridadesService] listarTiposSolicitante error:', error);
    return [];
  }
  return (data ?? []) as CatalogoItem[];
}

export async function listarTiposPrioridade(): Promise<CatalogoItem[]> {
  const { data, error } = await supabase
    .from('prioridades_tipos_prioridade')
    .select('codigo, label, ordem, aviso, aviso_link_label, aviso_link_url')
    .eq('ativo', true)
    .order('ordem');

  if (error) {
    console.error('[prioridadesService] listarTiposPrioridade error:', error);
    return [];
  }
  return (data ?? []) as CatalogoItem[];
}

export async function listarUpjs(): Promise<Upj[]> {
  const { data, error } = await supabase
    .from('prioridades_upjs')
    .select('id, codigo, nome, foro, ativa')
    .eq('ativa', true)
    .order('codigo');

  if (error) {
    console.error('[prioridadesService] listarUpjs error:', error);
    return [];
  }
  return (data ?? []) as Upj[];
}

/**
 * RF-ATD-04: resolve a UPJ a partir do órgão devolvido pelo DJEN.
 * A chave é `idOrgao`; `vara` fica como dado auxiliar.
 *
 * O embed de `prioridades_upjs` é declarado como array na tipagem gerada pelo
 * PostgREST mesmo sendo N:1 — daí a normalização em `extrairUpj`.
 */
function extrairUpj(valor: unknown): { codigo: string | null; nome: string | null } {
  const rel = Array.isArray(valor) ? valor[0] : valor;
  if (!rel || typeof rel !== 'object') return { codigo: null, nome: null };
  const r = rel as { codigo?: unknown; nome?: unknown };
  return {
    codigo: typeof r.codigo === 'string' ? r.codigo : null,
    nome: typeof r.nome === 'string' ? r.nome : null,
  };
}

export async function resolverUpjPorOrgao(
  idOrgao: number | null,
  vara: number | null
): Promise<{ upj_id: string | null; upj_codigo: string | null; upj_nome: string | null }> {
  if (idOrgao !== null) {
    const { data, error } = await supabase
      .from('prioridades_orgaos_upj')
      .select('upj_id, prioridades_upjs(codigo, nome)')
      .eq('id_orgao_djen', idOrgao)
      .eq('ativo', true)
      .maybeSingle();

    if (error) {
      console.error('[prioridadesService] resolverUpjPorOrgao (orgao) error:', error);
    } else if (data) {
      const registro = data as { upj_id: string; prioridades_upjs?: unknown };
      const upj = extrairUpj(registro.prioridades_upjs);
      return { upj_id: registro.upj_id, upj_codigo: upj.codigo, upj_nome: upj.nome };
    }
  }

  if (vara !== null) {
    const { data, error } = await supabase
      .from('prioridades_orgaos_upj')
      .select('upj_id, prioridades_upjs(codigo, nome)')
      .eq('vara', vara)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[prioridadesService] resolverUpjPorOrgao (vara) error:', error);
    } else if (data) {
      const registro = data as { upj_id: string; prioridades_upjs?: unknown };
      const upj = extrairUpj(registro.prioridades_upjs);
      return { upj_id: registro.upj_id, upj_codigo: upj.codigo, upj_nome: upj.nome };
    }
  }

  return { upj_id: null, upj_codigo: null, upj_nome: null };
}

/**
 * RF-ATD-04 — mapeamento incremental órgão → UPJ.
 *
 * Por que incremental: o espaço de `idOrgao` do DJEN é amplo e mutável, e a
 * varredura completa pela API pública é instável. Semeá-lo "no chute" geraria
 * anotação entregue à UPJ errada, que é pior do que não ter mapeamento.
 *
 * Fluxo: ao validar um processo cujo órgão ainda não está mapeado, a tela pede
 * a UPJ ao usuário e grava o par aqui. A partir daí a detecção é automática
 * para todos.
 */
export async function registrarMapeamentoOrgao(params: {
  idOrgao: number | null;
  nomeOrgao: string | null;
  vara: number | null;
  upjId: string;
}): Promise<{ sucesso: boolean; erro?: string }> {
  const { idOrgao, nomeOrgao, vara, upjId } = params;

  if (idOrgao === null) {
    return {
      sucesso: false,
      erro:
        'Não é possível gravar o mapeamento sem o idOrgao devolvido pelo DJEN. Use a seleção manual de UPJ nesta anotação.',
    };
  }

  const { error } = await supabase
    .from('prioridades_orgaos_upj')
    .upsert(
      {
        id_orgao_djen: idOrgao,
        nome_orgao_djen: nomeOrgao,
        vara,
        upj_id: upjId,
        ativo: true,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'id_orgao_djen' }
    );

  if (error) {
    console.error('[prioridadesService] registrarMapeamentoOrgao error:', error);
    return { sucesso: false, erro: error.message };
  }
  return { sucesso: true };
}

/**
 * RF-GES-06 / RF-UPJ-05: busca de usuários elegíveis para designação.
 *
 * A RPC valida a alçada no servidor — Gestor busca em toda a base, Coordenador
 * apenas na própria UPJ, e quem não tem alçada recebe erro.
 */
export async function buscarUsuariosElegiveis(
  termo: string,
  upjId?: string | null
): Promise<{ sucesso: boolean; usuarios: UsuarioElegivel[]; erro?: string }> {
  const { data, error } = await supabase.rpc('prioridades_buscar_usuarios', {
    p_termo: termo,
    p_upj_id: upjId ?? null,
  });

  if (error) {
    if (error.code === 'PGRST202' || /could not find/i.test(error.message)) {
      return { sucesso: false, usuarios: [], erro: 'Módulo de Prioridades ainda não instalado no banco.' };
    }
    console.error('[prioridadesService] buscarUsuariosElegiveis error:', error);
    return { sucesso: false, usuarios: [], erro: error.message };
  }

  return { sucesso: true, usuarios: (data ?? []) as UsuarioElegivel[] };
}

/**
 * RF-GES-06 / RF-UPJ-05: inclui a designação.
 *
 * A RPC cria/ajusta o perfil base do designado na mesma transação, para que ele
 * consiga efetivamente abrir o app e ver o módulo. `fim` nulo = "Indeterminado".
 */
export async function designarUsuario(params: {
  usuarioId: string;
  perfil: PrioridadePerfil;
  inicio?: string | null;
  fim?: string | null;
  upjId?: string | null;
}): Promise<RespostaRpc> {
  return chamarRpc('prioridades_designar', {
    p_usuario_id: params.usuarioId,
    p_perfil: params.perfil,
    p_inicio: params.inicio || undefined,
    p_fim: params.fim || null,
    p_upj_id: params.upjId || null,
  });
}

/** Encerra a designação e, se não restar nenhuma, remove o perfil base de designado. */
export async function encerrarDesignacao(designacaoId: string): Promise<RespostaRpc> {
  return chamarRpc('prioridades_encerrar_designacao', { p_designacao_id: designacaoId });
}

/**
 * Remove o perfil base do usuário (exclusivo do admin).
 *
 * Recusa quando o usuário tem anotação em andamento vinculada — RF-GER-03 vem
 * antes da conveniência administrativa.
 */
export async function removerPerfil(usuarioId: string): Promise<RespostaRpc> {
  return chamarRpc('prioridades_remover_perfil', { p_usuario_id: usuarioId });
}

/** Perfis base providos pelo admin (bootstrap). */
export async function listarPerfisBase(): Promise<{ sucesso: boolean; perfis: PerfilBase[]; erro?: string }> {
  const { data, error } = await supabase
    .from('prioridades_usuarios_perfil')
    .select('usuario_id, perfil, upj_id, vinculacao_automatica')
    .eq('ativo', true);

  if (error) {
    console.error('[prioridadesService] listarPerfisBase error:', error);
    return { sucesso: false, perfis: [], erro: error.message };
  }

  const lista = (data ?? []) as Array<{
    usuario_id: string;
    perfil: PrioridadePerfil;
    upj_id: string | null;
    vinculacao_automatica: boolean;
  }>;

  if (lista.length === 0) return { sucesso: true, perfis: [] };

  const ids = Array.from(new Set(lista.map((p) => p.usuario_id)));
  const { data: usuarios } = await supabase.from('users').select('id, nome, email').in('id', ids);
  const mapa = new Map(
    ((usuarios ?? []) as Array<{ id: string; nome: string | null; email: string | null }>).map((u) => [
      u.id,
      { nome: u.nome ?? '', email: u.email ?? '' },
    ])
  );

  return {
    sucesso: true,
    perfis: lista.map((p) => ({
      ...p,
      usuario_nome: mapa.get(p.usuario_id)?.nome ?? null,
      usuario_email: mapa.get(p.usuario_id)?.email ?? null,
    })),
  };
}

/** RF-GES-07: participa ou não da distribuição round-robin. */
export async function alternarVinculacaoAutomatica(
  usuarioId: string,
  habilitada: boolean
): Promise<RespostaRpc> {
  return chamarRpc('prioridades_alternar_vinculacao', {
    p_usuario_id: usuarioId,
    p_habilitada: habilitada,
  });
}

/** Lista as designações com o nome do designado, para a tela Designações. */
export async function listarDesignacoes(): Promise<{
  sucesso: boolean;
  designacoes: DesignacaoListada[];
  erro?: string;
}> {
  const { data, error } = await supabase
    .from('prioridades_designacoes')
    .select('id, usuario_id, designante_id, perfil, upj_id, inicio_em, fim_em, ativa')
    .order('ativa', { ascending: false })
    .order('inicio_em', { ascending: false });

  if (error) {
    console.error('[prioridadesService] listarDesignacoes error:', error);
    return { sucesso: false, designacoes: [], erro: error.message };
  }

  const lista = (data ?? []) as Array<Omit<DesignacaoListada, 'usuario_nome' | 'usuario_email'>>;
  if (lista.length === 0) return { sucesso: true, designacoes: [] };

  // Nome do designado em consulta separada: a relação com `users` não é
  // resolvida por embed do PostgREST, e a RLS de `users` já é a do Gerenciador.
  const ids = Array.from(new Set(lista.map((d) => d.usuario_id)));
  const { data: usuarios } = await supabase.from('users').select('id, nome, email').in('id', ids);

  const mapa = new Map(
    ((usuarios ?? []) as Array<{ id: string; nome: string | null; email: string | null }>).map((u) => [
      u.id,
      { nome: u.nome ?? '', email: u.email ?? '' },
    ])
  );

  return {
    sucesso: true,
    designacoes: lista.map((d) => ({
      ...d,
      usuario_nome: mapa.get(d.usuario_id)?.nome ?? null,
      usuario_email: mapa.get(d.usuario_id)?.email ?? null,
    })),
  };
}

/**
 * Mapa usuario_id → vinculacao_automatica (RF-GES-07).
 *
 * A vinculação vive no perfil base, não na designação; por isso a tela de
 * Designações consulta este mapa para exibir e alternar o estado.
 */
export async function listarPerfisComVinculacao(): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from('prioridades_usuarios_perfil')
    .select('usuario_id, vinculacao_automatica')
    .eq('ativo', true);

  if (error) {
    console.error('[prioridadesService] listarPerfisComVinculacao error:', error);
    return {};
  }

  const mapa: Record<string, boolean> = {};
  for (const linha of (data ?? []) as Array<{ usuario_id: string; vinculacao_automatica: boolean }>) {
    mapa[linha.usuario_id] = linha.vinculacao_automatica;
  }
  return mapa;
}

// ──────────────────────────────────────────────────────────────
// Leituras
// ──────────────────────────────────────────────────────────────

export interface FiltroListagem {
  status?: PrioridadeStatus[];
  modulo?: PrioridadeModulo;
  upjId?: string | null;
  somenteUrgentissimos?: boolean;
  busca?: string;
  limite?: number;
  offset?: number;
}

/**
 * Lista anotações visíveis ao usuário. O recorte por módulo é explícito porque
 * a RLS já limita o conjunto, mas o painel lateral precisa de contadores
 * coerentes com o módulo em uso.
 */
export async function listarAnotacoes(filtro: FiltroListagem = {}): Promise<{
  sucesso: boolean;
  anotacoes: AnotacaoPrioridade[];
  total: number;
  erro?: string;
}> {
  const { status, upjId, somenteUrgentissimos, busca, limite = 50, offset = 0 } = filtro;

  let query = supabase
    .from('prioridades_anotacoes')
    .select(COLUNAS_ANOTACAO, { count: 'exact' })
    .order('data_anotacao', { ascending: false })
    .range(offset, offset + limite - 1);

  if (status && status.length > 0) query = query.in('status', status);
  if (upjId) query = query.eq('upj_id', upjId);
  if (somenteUrgentissimos) query = query.eq('urgentissimo', true);
  if (busca && busca.trim()) {
    query = query.ilike('processo', `%${busca.replace(/\D/g, '')}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('[prioridadesService] listarAnotacoes error:', error);
    return { sucesso: false, anotacoes: [], total: 0, erro: error.message };
  }

  return { sucesso: true, anotacoes: (data ?? []) as AnotacaoPrioridade[], total: count ?? 0 };
}

export async function obterAnotacao(id: number): Promise<{
  sucesso: boolean;
  anotacao: AnotacaoPrioridade | null;
  erro?: string;
}> {
  const { data, error } = await supabase
    .from('prioridades_anotacoes')
    .select(COLUNAS_ANOTACAO)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[prioridadesService] obterAnotacao error:', error);
    return { sucesso: false, anotacao: null, erro: error.message };
  }
  return { sucesso: true, anotacao: (data as AnotacaoPrioridade | null) ?? null };
}

export async function listarHistorico(anotacaoId: number): Promise<HistoricoAnotacao[]> {
  const { data, error } = await supabase
    .from('prioridades_anotacoes_historico')
    .select('*')
    .eq('anotacao_id', anotacaoId)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('[prioridadesService] listarHistorico error:', error);
    return [];
  }
  return (data ?? []) as HistoricoAnotacao[];
}

/** RF-ATD-12: anotações do mesmo processo nos últimos 120 dias. */
export async function listarAnotacoesAnteriores(
  processo: string,
  dias = 120
): Promise<AnotacaoAnterior[]> {
  const { data, error } = await supabase.rpc('prioridades_anteriores', {
    p_processo: processo,
    p_dias: dias,
  });

  if (error) {
    if (error.code === 'PGRST202' || /could not find/i.test(error.message)) return [];
    console.error('[prioridadesService] listarAnotacoesAnteriores error:', error);
    return [];
  }
  return (data ?? []) as AnotacaoAnterior[];
}

/** Contadores do painel lateral (RF-GES-08 / RF-UPJ-02). */
export async function contarPorStatus(): Promise<{
  porStatus: Record<string, number>;
  urgentissimos: number;
}> {
  const [resStatus, resUrgentes] = await Promise.all([
    supabase.from('prioridades_anotacoes').select('status'),
    // PU-12: "Urgentíssimas" é recorte por marcação, não um status. Contado
    // separadamente para o painel não somar todas as `upj-pendente`.
    supabase
      .from('prioridades_anotacoes')
      .select('id', { count: 'exact', head: true })
      .eq('urgentissimo', true)
      .eq('status', 'upj-pendente'),
  ]);

  if (resStatus.error) {
    console.error('[prioridadesService] contarPorStatus error:', resStatus.error);
    return { porStatus: {}, urgentissimos: 0 };
  }

  const porStatus: Record<string, number> = {};
  for (const linha of (resStatus.data ?? []) as Array<{ status: PrioridadeStatus }>) {
    porStatus[linha.status] = (porStatus[linha.status] ?? 0) + 1;
  }

  return { porStatus, urgentissimos: resUrgentes.count ?? 0 };
}

/** Conta quantas devoluções pendentes o Atendente tem (RF-ATD-13). */
export async function contarDevolvidasPendentes(usuarioId: string): Promise<number> {
  const { count, error } = await supabase
    .from('prioridades_anotacoes')
    .select('id', { count: 'exact', head: true })
    .eq('criador_id', usuarioId)
    .in('status', STATUS_DEVOLVIDA);

  if (error) {
    console.error('[prioridadesService] contarDevolvidasPendentes error:', error);
    return 0;
  }
  return count ?? 0;
}

// ──────────────────────────────────────────────────────────────
// Escritas (RPCs)
// ──────────────────────────────────────────────────────────────

function normalizarResposta(data: unknown): RespostaRpc {
  if (data && typeof data === 'object') return data as RespostaRpc;
  return { sucesso: false, erro: 'Resposta inesperada do servidor.' };
}

async function chamarRpc(nome: string, args: Record<string, unknown>): Promise<RespostaRpc> {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) {
    if (error.code === 'PGRST202' || /could not find/i.test(error.message)) {
      return { sucesso: false, erro: 'Módulo de Prioridades ainda não instalado no banco.' };
    }
    console.error(`[prioridadesService] ${nome} error:`, error);
    return { sucesso: false, erro: error.message };
  }
  return normalizarResposta(data);
}

/** RF-ATD-11: registra a anotação. O status inicial depende do perfil. */
export async function criarAnotacao(payload: NovaAnotacaoPayload): Promise<RespostaRpc> {
  return chamarRpc('prioridades_criar_anotacao', { p_dados: payload });
}

export interface DecisaoConferencia {
  anotacaoId: number;
  decisao: 'aprovar' | 'devolver' | 'rejeitar';
  justificativa?: string;
  urgentissimo?: boolean;
  correcaoAutomatica?: boolean;
  textoCorrecao?: string;
  alteracoes?: {
    descricao_prioridade?: string;
    evento_folha?: string;
    observacao_adicional_gestor?: string;
    /** Permite ao Gestor definir o destino quando a detecção automática falha. */
    upj_id?: string;
  };
}

/** RF-GES-02/03/04/05. */
export async function conferirAnotacao(d: DecisaoConferencia): Promise<RespostaRpc> {
  return chamarRpc('prioridades_conferir', {
    p_anotacao_id: d.anotacaoId,
    p_decisao: d.decisao,
    p_justificativa: d.justificativa ?? null,
    p_urgentissimo: d.urgentissimo ?? false,
    p_correcao_automatica: d.correcaoAutomatica ?? false,
    p_texto_correcao: d.textoCorrecao ?? null,
    p_alteracoes: d.alteracoes ?? null,
  });
}

/** RF-ATD-14. */
export async function responderDevolucao(anotacaoId: number, resposta: string): Promise<RespostaRpc> {
  return chamarRpc('prioridades_responder_devolucao', {
    p_anotacao_id: anotacaoId,
    p_resposta: resposta,
  });
}

export interface DecisaoUpj {
  anotacaoId: number;
  decisao: 'resolver' | 'devolver' | 'rejeitar';
  observacaoUpj?: string;
  justificativa?: string;
  arquivamentoAutomatico?: boolean;
}

/** RF-UPJ-03/04. */
export async function analisarAnotacao(d: DecisaoUpj): Promise<RespostaRpc> {
  return chamarRpc('prioridades_analisar', {
    p_anotacao_id: d.anotacaoId,
    p_decisao: d.decisao,
    p_observacao_upj: d.observacaoUpj ?? null,
    p_justificativa: d.justificativa ?? null,
    p_arquivamento_automatico: d.arquivamentoAutomatico ?? false,
  });
}

/**
 * RF-GER-06: dispara a varredura dos prazos de 24 h.
 * Em produção quem executa é o pg_cron; aqui permite teste manual e também
 * serve de fallback quando pg_cron não está disponível no ambiente.
 */
export async function processarPrazosVencidos(): Promise<RespostaRpc> {
  return chamarRpc('prioridades_processar_prazos_vencidos', {});
}

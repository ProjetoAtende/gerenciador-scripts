/**
 * Serviço de Tarefas
 * 
 * Gerencia operações CRUD de tarefas, fases, threads e histórico.
 * Usa RPCs do Supabase para operações que requerem SECURITY DEFINER.
 */

import { supabase } from './supabaseClient';
import {
  TarefaComDetalhes,
  TarefaFase,
  TarefaHistoricoComUsuario,
  TarefaThreadComAutor,
  TarefaThreadRespostaComAutor,
  TarefaComentario,
  CriarTarefaParams,
  AtualizarTarefaParams,
  AlterarEstadoParams,
  FaseParams,
  CriarThreadParams,
  CriarRespostaParams,
  CriarTarefaResponse,
  AlterarEstadoResponse,
  TransferirTarefaResponse,
  TarefasFiltros,
  TarefasOrdenacao,
  OrdenacaoDirecao,
  obterTiposTarefaEquivalentes,
  ResponsavelTransferenciaDestino,
  ResponsavelEquipeSimples,
  ResponsavelUsuarioSimples,
} from '../types/Tarefa';

// ============================================================================
// Constantes
// ============================================================================

/** Número padrão de tarefas por página */
export const TAREFAS_POR_PAGINA = 50;

/** Resultado paginado de tarefas */
export interface TarefasPaginadas {
  tarefas: TarefaComDetalhes[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

// ============================================================================
// CRUD de Tarefas
// ============================================================================

/**
 * Criar nova tarefa
 */
export async function criarTarefa(params: CriarTarefaParams): Promise<CriarTarefaResponse> {
  try {
    const { data, error } = await supabase.rpc('criar_tarefa', {
      p_titulo: params.titulo,
      p_descricao: params.descricao || null,
      p_equipe_id: params.equipe_id || null,
      p_tipo: params.tipo || null,
      p_data_limite: params.data_limite || null,
      p_responsavel_tipo: params.responsavel_tipo || 'usuario',
      p_responsavel_usuario_id: params.responsavel_usuario_id || null,
      p_responsavel_equipe_id: params.responsavel_equipe_id || null
    });

    if (error) {
      console.error('[tarefaService] Erro ao criar tarefa:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as CriarTarefaResponse;
  } catch (error) {
    console.error('[tarefaService] Exceção ao criar tarefa:', error);
    return { sucesso: false, erro: 'Erro ao criar tarefa' };
  }
}

/**
 * Atualizar tarefa (título/descrição)
 */
export async function atualizarTarefa(params: AtualizarTarefaParams): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('atualizar_tarefa', {
      p_tarefa_id: params.tarefa_id,
      p_titulo: params.titulo || null,
      p_descricao: params.descricao || null,
      p_tipo: params.tipo !== undefined ? (params.tipo ?? '') : null,
      p_data_limite: params.data_limite !== undefined ? params.data_limite : null,
      p_remover_prazo: params.remover_prazo ?? false
    });

    if (error) {
      console.error('[tarefaService] Erro ao atualizar tarefa:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as { sucesso: boolean; erro?: string };
  } catch (error) {
    console.error('[tarefaService] Exceção ao atualizar tarefa:', error);
    return { sucesso: false, erro: 'Erro ao atualizar tarefa' };
  }
}

/**
 * Alterar estado da tarefa
 */
export async function alterarEstadoTarefa(params: AlterarEstadoParams): Promise<AlterarEstadoResponse> {
  try {
    const { data, error } = await supabase.rpc('alterar_estado_tarefa', {
      p_tarefa_id: params.tarefa_id,
      p_novo_estado: params.novo_estado,
      p_justificativa: params.justificativa || null,
      p_resumo: params.resumo || null
    });

    if (error) {
      console.error('[tarefaService] Erro ao alterar estado:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as AlterarEstadoResponse;
  } catch (error) {
    console.error('[tarefaService] Exceção ao alterar estado:', error);
    return { sucesso: false, erro: 'Erro ao alterar estado' };
  }
}

/**
 * Transferir tarefa para outro usuário
 */
export async function transferirTarefa(
  tarefaId: string,
  destino: ResponsavelTransferenciaDestino
): Promise<TransferirTarefaResponse> {
  try {
    const { data, error } = await supabase.rpc('transferir_tarefa', {
      p_tarefa_id: tarefaId,
      p_novo_dono_id: destino.tipo === 'usuario' ? destino.usuario_id : null,
      p_novo_responsavel_tipo: destino.tipo,
      p_novo_responsavel_equipe_id: destino.tipo === 'equipe' ? destino.equipe_id : null
    });

    if (error) {
      console.error('[tarefaService] Erro ao transferir tarefa:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as TransferirTarefaResponse;
  } catch (error) {
    console.error('[tarefaService] Exceção ao transferir tarefa:', error);
    return { sucesso: false, erro: 'Erro ao transferir tarefa' };
  }
}

/**
 * Buscar tarefa por ID
 */
export async function buscarTarefa(tarefaId: string): Promise<TarefaComDetalhes | null> {
  try {
    const { data, error } = await supabase
      .from('view_tarefas_resumo')
      .select('*')
      .eq('id', tarefaId)
      .single();

    if (error) {
      console.error('[tarefaService] Erro ao buscar tarefa:', error);
      return null;
    }

    return data as TarefaComDetalhes;
  } catch (error) {
    console.error('[tarefaService] Exceção ao buscar tarefa:', error);
    return null;
  }
}

/**
 * Busca tarefas por título (ILIKE), ignorando filtros de estado e tipo.
 * Retorna todas as tarefas da equipe cujo título contém o termo.
 */
export async function buscarTarefasPorTitulo(
  termo: string,
  equipeId?: string
): Promise<TarefaComDetalhes[]> {
  if (!termo || termo.trim().length < 2) return [];

  try {
    let query = supabase
      .from('view_tarefas_resumo')
      .select('*')
      .ilike('titulo', `%${termo.trim()}%`)
      .order('atualizado_em', { ascending: false })
      .limit(20);

    if (equipeId) {
      query = query.eq('equipe_id', equipeId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[tarefaService] Erro ao buscar tarefas por título:', error);
      return [];
    }
    return data as TarefaComDetalhes[];
  } catch (error) {
    console.error('[tarefaService] Exceção ao buscar por título:', error);
    return [];
  }
}

/**
 * Listar tarefas com filtros (sem paginação - para compatibilidade)
 * @deprecated Usar listarTarefasPaginadas para melhor performance em datasets grandes
 */
export async function listarTarefas(
  filtros?: TarefasFiltros,
  ordenacao: TarefasOrdenacao = 'atualizado_em',
  direcao: OrdenacaoDirecao = 'desc'
): Promise<TarefaComDetalhes[]> {
  try {
    let query = supabase
      .from('view_tarefas_resumo')
      .select('*');

    // Aplicar filtros
    if (filtros?.estado && filtros.estado !== 'todos') {
      query = query.eq('estado', filtros.estado);
    }

    if (filtros?.tipo && filtros.tipo !== 'todos') {
      const tiposEquivalentes = obterTiposTarefaEquivalentes(filtros.tipo);
      query = tiposEquivalentes.length > 1
        ? query.in('tipo', tiposEquivalentes)
        : query.eq('tipo', tiposEquivalentes[0]);
    }

    if (filtros?.dono_id) {
      query = query.eq('dono_id', filtros.dono_id);
    }

    if (filtros?.equipe_id) {
      query = query.eq('equipe_id', filtros.equipe_id);
    }

    // Aplicar ordenação
    query = query.order(ordenacao, { ascending: direcao === 'asc' });

    const { data, error } = await query;

    if (error) {
      console.error('[tarefaService] Erro ao listar tarefas:', error);
      return [];
    }

    return data as TarefaComDetalhes[];
  } catch (error) {
    console.error('[tarefaService] Exceção ao listar tarefas:', error);
    return [];
  }
}

/**
 * Listar tarefas com filtros e paginação
 * Use esta função para melhor performance em datasets grandes
 */
export async function listarTarefasPaginadas(
  filtros?: TarefasFiltros,
  ordenacao: TarefasOrdenacao = 'atualizado_em',
  direcao: OrdenacaoDirecao = 'desc',
  pagina: number = 1,
  itensPorPagina: number = TAREFAS_POR_PAGINA
): Promise<TarefasPaginadas> {
  try {
    let query = supabase
      .from('view_tarefas_resumo')
      .select('*', { count: 'exact' });

    // Aplicar filtros
    if (filtros?.estado && filtros.estado !== 'todos') {
      query = query.eq('estado', filtros.estado);
    }

    if (filtros?.tipo && filtros.tipo !== 'todos') {
      const tiposEquivalentes = obterTiposTarefaEquivalentes(filtros.tipo);
      query = tiposEquivalentes.length > 1
        ? query.in('tipo', tiposEquivalentes)
        : query.eq('tipo', tiposEquivalentes[0]);
    }

    if (filtros?.dono_id) {
      query = query.eq('dono_id', filtros.dono_id);
    }

    if (filtros?.equipe_id) {
      query = query.eq('equipe_id', filtros.equipe_id);
    }

    // Aplicar ordenação
    query = query.order(ordenacao, { ascending: direcao === 'asc' });

    // Aplicar paginação
    const inicio = (pagina - 1) * itensPorPagina;
    query = query.range(inicio, inicio + itensPorPagina - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[tarefaService] Erro ao listar tarefas paginadas:', error);
      return { tarefas: [], total: 0, pagina: 1, totalPaginas: 0 };
    }

    const total = count || 0;
    const totalPaginas = Math.ceil(total / itensPorPagina);

    return {
      tarefas: data as TarefaComDetalhes[],
      total,
      pagina,
      totalPaginas
    };
  } catch (error) {
    console.error('[tarefaService] Exceção ao listar tarefas paginadas:', error);
    return { tarefas: [], total: 0, pagina: 1, totalPaginas: 0 };
  }
}

// ============================================================================
// Fases
// ============================================================================

/**
 * Adicionar fase à tarefa
 */
export async function adicionarFase(params: FaseParams): Promise<{ sucesso: boolean; fase_id?: string; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('adicionar_fase', {
      p_tarefa_id: params.tarefa_id,
      p_titulo: params.titulo,
      p_descricao: params.descricao || null
    });

    if (error) {
      console.error('[tarefaService] Erro ao adicionar fase:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as { sucesso: boolean; fase_id?: string; erro?: string };
  } catch (error) {
    console.error('[tarefaService] Exceção ao adicionar fase:', error);
    return { sucesso: false, erro: 'Erro ao adicionar fase' };
  }
}

/**
 * Toggle estado de conclusão da fase
 */
export async function toggleFaseConcluida(faseId: string): Promise<{ sucesso: boolean; concluida?: boolean; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('toggle_fase_concluida', {
      p_fase_id: faseId
    });

    if (error) {
      console.error('[tarefaService] Erro ao toggle fase:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as { sucesso: boolean; concluida?: boolean; erro?: string };
  } catch (error) {
    console.error('[tarefaService] Exceção ao toggle fase:', error);
    return { sucesso: false, erro: 'Erro ao alterar fase' };
  }
}

/**
 * Listar fases de uma tarefa
 */
export async function listarFases(tarefaId: string): Promise<TarefaFase[]> {
  try {
    const { data, error } = await supabase
      .from('tarefa_fases')
      .select('*, usuario_vinculado:usuario_vinculado_id(nome)')
      .eq('tarefa_id', tarefaId)
      .order('ordem', { ascending: true });

    if (error) {
      console.error('[tarefaService] Erro ao listar fases:', error);
      return [];
    }

    return (data || []).map((f: any) => ({
      ...f,
      usuario_vinculado_nome: f.usuario_vinculado?.nome || null,
    })) as TarefaFase[];
  } catch (error) {
    console.error('[tarefaService] Exceção ao listar fases:', error);
    return [];
  }
}

/**
 * Remover fase
 */
export async function removerFase(faseId: string): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { error } = await supabase
      .from('tarefa_fases')
      .delete()
      .eq('id', faseId);

    if (error) {
      console.error('[tarefaService] Erro ao remover fase:', error);
      return { sucesso: false, erro: error.message };
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[tarefaService] Exceção ao remover fase:', error);
    return { sucesso: false, erro: 'Erro ao remover fase' };
  }
}

/**
 * Editar título de uma fase
 */
export async function editarFase(faseId: string, titulo: string): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('editar_fase', {
      p_fase_id: faseId,
      p_titulo: titulo
    });

    if (error) {
      console.error('[tarefaService] Erro ao editar fase:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as { sucesso: boolean; erro?: string };
  } catch (error) {
    console.error('[tarefaService] Exceção ao editar fase:', error);
    return { sucesso: false, erro: 'Erro ao editar fase' };
  }
}

/**
 * Reordenar fases de uma tarefa
 */
export async function reordenarFases(tarefaId: string, fasesOrdenadas: string[]): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('reordenar_fases', {
      p_tarefa_id: tarefaId,
      p_fases_ordenadas: fasesOrdenadas
    });

    if (error) {
      console.error('[tarefaService] Erro ao reordenar fases:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as { sucesso: boolean; erro?: string };
  } catch (error) {
    console.error('[tarefaService] Exceção ao reordenar fases:', error);
    return { sucesso: false, erro: 'Erro ao reordenar fases' };
  }
}

// ============================================================================
// Exclusão de Tarefa
// ============================================================================

/**
 * Excluir tarefa (dono ou admin)
 * Remove a tarefa e todos os dados associados (fases, threads, histórico, docs)
 */
export async function excluirTarefa(tarefaId: string): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('excluir_tarefa', {
      p_tarefa_id: tarefaId
    });

    if (error) {
      console.error('[tarefaService] Erro ao excluir tarefa:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as { sucesso: boolean; erro?: string };
  } catch (error) {
    console.error('[tarefaService] Exceção ao excluir tarefa:', error);
    return { sucesso: false, erro: 'Erro ao excluir tarefa' };
  }
}

// ============================================================================
// Histórico
// ============================================================================

/**
 * Listar histórico de uma tarefa
 */
export async function listarHistorico(tarefaId: string): Promise<TarefaHistoricoComUsuario[]> {
  try {
    const { data, error } = await supabase
      .from('tarefa_historico')
      .select(`
        *,
        usuario:users!tarefa_historico_usuario_id_fkey (
          nome,
          email
        )
      `)
      .eq('tarefa_id', tarefaId)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('[tarefaService] Erro ao listar histórico:', error);
      return [];
    }

    // Mapear para formato esperado
    return (data || []).map((item: any) => ({
      ...item,
      usuario_nome: item.usuario?.nome || 'Desconhecido',
      usuario_email: item.usuario?.email || ''
    })) as TarefaHistoricoComUsuario[];
  } catch (error) {
    console.error('[tarefaService] Exceção ao listar histórico:', error);
    return [];
  }
}

// ============================================================================
// Threads
// ============================================================================

/**
 * Criar thread de discussão
 */
export async function criarThread(params: CriarThreadParams): Promise<{ sucesso: boolean; thread_id?: string; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('criar_thread_tarefa', {
      p_tarefa_id: params.tarefa_id,
      p_titulo: params.titulo,
      p_conteudo: params.conteudo,
      p_mencoes: params.mencoes || null
    });

    if (error) {
      console.error('[tarefaService] Erro ao criar thread:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as { sucesso: boolean; thread_id?: string; erro?: string };
  } catch (error) {
    console.error('[tarefaService] Exceção ao criar thread:', error);
    return { sucesso: false, erro: 'Erro ao criar tópico' };
  }
}

/**
 * Criar resposta em thread
 */
export async function criarResposta(params: CriarRespostaParams): Promise<{ sucesso: boolean; resposta_id?: string; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('criar_resposta_thread', {
      p_thread_id: params.thread_id,
      p_conteudo: params.conteudo,
      p_resposta_pai_id: params.resposta_pai_id || null,
      p_mencoes: params.mencoes || null
    });

    if (error) {
      console.error('[tarefaService] Erro ao criar resposta:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as { sucesso: boolean; resposta_id?: string; erro?: string };
  } catch (error) {
    console.error('[tarefaService] Exceção ao criar resposta:', error);
    return { sucesso: false, erro: 'Erro ao criar resposta' };
  }
}

/**
 * Listar threads de uma tarefa
 */
export async function listarThreads(tarefaId: string): Promise<TarefaThreadComAutor[]> {
  try {
    const { data, error } = await supabase
      .from('tarefa_threads')
      .select(`
        *,
        autor:users!tarefa_threads_autor_id_fkey (
          nome,
          email
        )
      `)
      .eq('tarefa_id', tarefaId)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('[tarefaService] Erro ao listar threads:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      ...item,
      autor_nome: item.autor?.nome || 'Desconhecido',
      autor_email: item.autor?.email || ''
    })) as TarefaThreadComAutor[];
  } catch (error) {
    console.error('[tarefaService] Exceção ao listar threads:', error);
    return [];
  }
}

/**
 * Listar respostas de uma thread (com aninhamento)
 */
export async function listarRespostas(threadId: string): Promise<TarefaThreadRespostaComAutor[]> {
  try {
    const { data, error } = await supabase
      .from('tarefa_thread_respostas')
      .select(`
        *,
        autor:users!tarefa_thread_respostas_autor_id_fkey (
          nome,
          email
        )
      `)
      .eq('thread_id', threadId)
      .order('criado_em', { ascending: true });

    if (error) {
      console.error('[tarefaService] Erro ao listar respostas:', error);
      return [];
    }

    // Mapear e construir árvore de respostas
    const respostasFlat = (data || []).map((item: any) => ({
      ...item,
      autor_nome: item.autor?.nome || 'Desconhecido',
      autor_email: item.autor?.email || '',
      respostas: []
    })) as TarefaThreadRespostaComAutor[];

    // Construir árvore hierárquica
    const respostasMap = new Map<string, TarefaThreadRespostaComAutor>();
    const raizes: TarefaThreadRespostaComAutor[] = [];

    for (const resposta of respostasFlat) {
      respostasMap.set(resposta.id, resposta);
    }

    for (const resposta of respostasFlat) {
      if (resposta.resposta_pai_id) {
        const pai = respostasMap.get(resposta.resposta_pai_id);
        if (pai) {
          pai.respostas = pai.respostas || [];
          pai.respostas.push(resposta);
        }
      } else {
        raizes.push(resposta);
      }
    }

    return raizes;
  } catch (error) {
    console.error('[tarefaService] Exceção ao listar respostas:', error);
    return [];
  }
}

// ============================================================================
// Realtime Subscriptions
// ============================================================================

/**
 * Criar subscription para mudanças em tarefas
 */
export function subscribeTarefas(
  callback: (payload: any) => void,
  equipeId?: string
) {
  const channel = supabase
    .channel('tarefas-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tarefas',
        ...(equipeId ? { filter: `equipe_id=eq.${equipeId}` } : {})
      },
      (payload) => {
        console.log('[tarefaService] Mudança em tarefas:', payload);
        callback(payload);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Criar subscription para mudanças em fases
 */
export function subscribeFases(
  tarefaId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel(`fases-${tarefaId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tarefa_fases',
        filter: `tarefa_id=eq.${tarefaId}`
      },
      (payload) => {
        console.log('[tarefaService] Mudança em fases:', payload);
        callback(payload);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Criar subscription para mudanças em threads
 */
export function subscribeThreads(
  tarefaId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel(`threads-${tarefaId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tarefa_threads',
        filter: `tarefa_id=eq.${tarefaId}`
      },
      (payload) => {
        console.log('[tarefaService] Mudança em threads:', payload);
        callback(payload);
      }
    )
    .subscribe();

  return channel;
}

// ============================================================================
// Utilitários
// ============================================================================

/** Usuário para transferência/menção */
export type UsuarioSimples = ResponsavelUsuarioSimples;
export type EquipeSimples = ResponsavelEquipeSimples;

/**
 * Listar usuários disponíveis para transferência/atribuição de tarefa
 * Inclui o próprio usuário (para que ele possa atribuir/transferir para si mesmo).
 * Filtra por equipe quando fornecida e oculta usuários inativos.
 *
 * O parâmetro `usuarioAtualId` é mantido para compatibilidade da assinatura,
 * mas não é mais usado para filtrar a lista — o frontend pode realçar/ordenar
 * o usuário atual conforme necessário.
 */
export async function listarUsuariosParaTransferencia(
  _usuarioAtualId: string,
  equipeId?: string
): Promise<UsuarioSimples[]> {
  try {
    let query = supabase
      .from('users')
      .select('id, nome, email')
      .neq('ativo', false)
      .order('nome');

    if (equipeId) {
      query = query.eq('equipe_id', equipeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[tarefaService] Erro ao listar usuários para transferência:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[tarefaService] Exceção ao listar usuários:', error);
    return [];
  }
}

// ============================================================================
// Subscriptions adicionais (Correção Problema #14-15)
// ============================================================================

/**
 * Criar subscription para mudanças em respostas de uma thread
 * Usado para invalidar cache quando outras pessoas respondem
 */
export function subscribeRespostas(
  threadId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel(`respostas-${threadId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tarefa_thread_respostas',
        filter: `thread_id=eq.${threadId}`
      },
      (payload) => {
        console.log('[tarefaService] Mudança em respostas:', payload);
        callback(payload);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Criar subscription para mudanças no histórico de uma tarefa
 * Usado para atualizar timeline em tempo real
 */
export function subscribeHistorico(
  tarefaId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel(`historico-${tarefaId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'tarefa_historico',
        filter: `tarefa_id=eq.${tarefaId}`
      },
      (payload) => {
        console.log('[tarefaService] Novo evento no histórico:', payload);
        callback(payload);
      }
    )
    .subscribe();

  return channel;
}

// ============================================================================
// Documentos
// ============================================================================

import { TarefaDocumento, DocumentoResponse } from '../types/Tarefa';

/**
 * Listar documentos de uma tarefa
 */
export async function listarDocumentos(tarefaId: string): Promise<TarefaDocumento[]> {
  try {
    const { data, error } = await supabase.rpc('listar_documentos_tarefa', {
      p_tarefa_id: tarefaId
    });

    if (error) {
      console.error('[tarefaService] Erro ao listar documentos:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[tarefaService] Exceção ao listar documentos:', error);
    return [];
  }
}

/**
 * Adicionar documento a uma tarefa
 */
export async function adicionarDocumento(
  tarefaId: string,
  titulo: string,
  url: string
): Promise<DocumentoResponse> {
  try {
    const { data, error } = await supabase.rpc('adicionar_documento_tarefa', {
      p_tarefa_id: tarefaId,
      p_titulo: titulo,
      p_url: url
    });

    if (error) {
      console.error('[tarefaService] Erro ao adicionar documento:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as DocumentoResponse;
  } catch (error) {
    console.error('[tarefaService] Exceção ao adicionar documento:', error);
    return { sucesso: false, erro: 'Erro ao adicionar documento' };
  }
}

/**
 * Atualizar documento existente
 */
export async function atualizarDocumento(
  documentoId: string,
  titulo: string,
  url: string
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('atualizar_documento_tarefa', {
      p_documento_id: documentoId,
      p_titulo: titulo,
      p_url: url
    });

    if (error) {
      console.error('[tarefaService] Erro ao atualizar documento:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as { sucesso: boolean; erro?: string };
  } catch (error) {
    console.error('[tarefaService] Exceção ao atualizar documento:', error);
    return { sucesso: false, erro: 'Erro ao atualizar documento' };
  }
}

/**
 * Remover documento
 */
export async function removerDocumento(
  documentoId: string
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('remover_documento_tarefa', {
      p_documento_id: documentoId
    });

    if (error) {
      console.error('[tarefaService] Erro ao remover documento:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as { sucesso: boolean; erro?: string };
  } catch (error) {
    console.error('[tarefaService] Exceção ao remover documento:', error);
    return { sucesso: false, erro: 'Erro ao remover documento' };
  }
}

/**
 * Subscription para mudanças nos documentos de uma tarefa
 */
export function subscribeDocumentos(
  tarefaId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel(`documentos-${tarefaId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tarefa_documentos',
        filter: `tarefa_id=eq.${tarefaId}`
      },
      (payload) => {
        console.log('[tarefaService] Mudança em documentos:', payload);
        callback(payload);
      }
    )
    .subscribe();

  return channel;
}

// ============================================================================
// Reordenação de Tarefas
// ============================================================================

/**
 * Reordenar tarefas de um dono após drag-and-drop
 */
export async function reordenarTarefas(
  tarefasOrdenadas: string[]
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('reordenar_tarefas_dono', {
      p_tarefas_ordenadas: tarefasOrdenadas
    });

    if (error) {
      console.error('[tarefaService] Erro ao reordenar tarefas:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as { sucesso: boolean; erro?: string };
  } catch (error) {
    console.error('[tarefaService] Exceção ao reordenar tarefas:', error);
    return { sucesso: false, erro: 'Erro ao reordenar tarefas' };
  }
}

// ============================================================================
// Comentários por Fase / Documento
// ============================================================================

export interface CriarComentarioParams {
  tarefa_id: string;
  conteudo: string;
  fase_id?: string;
  documento_id?: string;
  mencoes?: string[];
}

/**
 * Criar comentário em uma fase ou documento
 */
export async function criarComentario(
  params: CriarComentarioParams
): Promise<{ sucesso: boolean; comentario_id?: string; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('criar_comentario_tarefa', {
      p_tarefa_id: params.tarefa_id,
      p_conteudo: params.conteudo,
      p_fase_id: params.fase_id || null,
      p_documento_id: params.documento_id || null,
      p_mencoes: params.mencoes || null
    });

    if (error) {
      console.error('[tarefaService] Erro ao criar comentário:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as { sucesso: boolean; comentario_id?: string; erro?: string };
  } catch (error) {
    console.error('[tarefaService] Exceção ao criar comentário:', error);
    return { sucesso: false, erro: 'Erro ao criar comentário' };
  }
}

/**
 * Listar comentários de uma fase
 */
export async function listarComentariosFase(faseId: string): Promise<TarefaComentario[]> {
  try {
    const { data, error } = await supabase.rpc('listar_comentarios_fase', {
      p_fase_id: faseId
    });

    if (error) {
      console.error('[tarefaService] Erro ao listar comentários da fase:', error);
      return [];
    }

    return (data || []) as TarefaComentario[];
  } catch (error) {
    console.error('[tarefaService] Exceção ao listar comentários da fase:', error);
    return [];
  }
}

/**
 * Listar comentários de um documento
 */
export async function listarComentariosDocumento(documentoId: string): Promise<TarefaComentario[]> {
  try {
    const { data, error } = await supabase.rpc('listar_comentarios_documento', {
      p_documento_id: documentoId
    });

    if (error) {
      console.error('[tarefaService] Erro ao listar comentários do documento:', error);
      return [];
    }

    return (data || []) as TarefaComentario[];
  } catch (error) {
    console.error('[tarefaService] Exceção ao listar comentários do documento:', error);
    return [];
  }
}

/**
 * Excluir comentário (autor ou admin)
 */
export async function excluirComentario(
  comentarioId: string
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('excluir_comentario_tarefa', {
      p_comentario_id: comentarioId
    });

    if (error) {
      console.error('[tarefaService] Erro ao excluir comentário:', error);
      return { sucesso: false, erro: error.message };
    }

    return (data as { sucesso: boolean; erro?: string }) || { sucesso: true };
  } catch (error) {
    console.error('[tarefaService] Exceção ao excluir comentário:', error);
    return { sucesso: false, erro: 'Erro ao excluir comentário' };
  }
}

/**
 * Criar subscription para comentários de uma tarefa
 */
/**
 * Vincular ou desvincular usuário de uma fase
 */
export async function vincularUsuarioFase(
  faseId: string,
  usuarioId: string | null
): Promise<{ sucesso: boolean; usuario_nome?: string; erro?: string }> {
  const { data, error } = await supabase.rpc('vincular_usuario_fase', {
    p_fase_id: faseId,
    p_usuario_id: usuarioId
  });
  if (error) return { sucesso: false, erro: error.message };
  return data;
}

export function subscribeComentarios(
  tarefaId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel(`comentarios-${tarefaId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tarefa_comentarios',
        filter: `tarefa_id=eq.${tarefaId}`
      },
      (payload) => {
        console.log('[tarefaService] Mudança em comentários:', payload);
        callback(payload);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Conclui uma tarefa e registra o serviço equivalente em Outros Serviços.
 * A operação é executada no banco em uma única RPC para evitar conclusão sem serviço.
 */
export async function concluirTarefaComServico(params: {
  tarefa_id: string;
  resumo?: string | null;
  quantidade: number;
}): Promise<AlterarEstadoResponse & { servico_id?: string; tipo_servico?: string }> {
  try {
    const { data, error } = await supabase.rpc('concluir_tarefa_com_servico', {
      p_tarefa_id: params.tarefa_id,
      p_resumo: params.resumo ?? null,
      p_quantidade: params.quantidade,
    });

    if (error) {
      console.error('[tarefaService] Erro ao concluir tarefa com serviço:', error);
      return { sucesso: false, erro: error.message };
    }

    return data as AlterarEstadoResponse & { servico_id?: string; tipo_servico?: string };
  } catch (error) {
    console.error('[tarefaService] Exceção ao concluir tarefa com serviço:', error);
    return { sucesso: false, erro: 'Erro ao concluir tarefa e registrar serviço' };
  }
}

export async function listarEquipesParaTransferencia(
  equipeId?: string
): Promise<EquipeSimples[]> {
  try {
    let query = supabase
      .from('equipes')
      .select('id, nome')
      .order('nome');

    if (equipeId) {
      query = query.eq('id', equipeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[tarefaService] Erro ao listar equipes para transferência:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[tarefaService] Exceção ao listar equipes:', error);
    return [];
  }
}

import { supabase } from './supabaseClient';

function formatLocalTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getCurrentLocalTimestamp(): string {
  return formatLocalTimestamp(new Date());
}

function getCurrentTimezoneAwareTimestamp(): string {
  return new Date().toISOString();
}
import { Ticket, GSEEquipe, TicketStatus, TicketOrigem } from '../types/Ticket';
import { reevaluateTicketVipStatus } from '../utils/vipUtils';
import { compararTicketsDistribuidor } from '../utils/gseUtils';

// Limite de linhas por request do PostgREST (max_rows configurado no Supabase)
const POSTGREST_PAGE_SIZE = 1000;

export interface DistribuidorBatchActionResult {
  success: boolean;
  acao: string;
  total_solicitado: number;
  total_alterado: number;
  total_bloqueado: number;
  total_ignorado: number;
  target_user_id?: string;
}

const emptyBatchActionResult = (acao: string): DistribuidorBatchActionResult => ({
  success: true,
  acao,
  total_solicitado: 0,
  total_alterado: 0,
  total_bloqueado: 0,
  total_ignorado: 0
});

const parseBatchActionResult = (data: unknown, acao: string): DistribuidorBatchActionResult => {
  const payload = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};

  return {
    success: Boolean(payload.success ?? true),
    acao: String(payload.acao ?? acao),
    total_solicitado: Number(payload.total_solicitado ?? 0),
    total_alterado: Number(payload.total_alterado ?? 0),
    total_bloqueado: Number(payload.total_bloqueado ?? 0),
    total_ignorado: Number(payload.total_ignorado ?? 0),
    target_user_id: payload.target_user_id ? String(payload.target_user_id) : undefined
  };
};

export interface DistribuicaoTempoEsperaLivreBucket {
  bucket_id: string;
  label: string;
  horas_min: number;
  horas_max: number | null;
  cor: string;
  ordem: number;
  total: number;
  percentual: number;
  total_geral: number;
  total_vip: number;
  total_sos: number;
  tempo_medio_horas: number;
  ticket_mais_antigo_em: string | null;
  atualizado_em: string;
}

export interface DistribuicaoDiasEsperaLivreItem {
  dia_espera: number;
  label: string;
  cor: string;
  ordem: number;
  total: number;
  percentual: number;
  total_geral: number;
  total_vip: number;
  total_sos: number;
  tempo_medio_horas: number;
  ticket_mais_antigo_em: string | null;
  atualizado_em: string;
}

export interface MapaSimilaridadeLivreNode {
  ticket_id: string;
  numero_chamado: string;
  gse: string | null;
  descricao: string | null;
  email: string | null;
  vip: boolean;
  sos: boolean;
  origem: TicketOrigem | null;
  tempo_espera_origem: string | null;
  espera_horas: number;
  categoria_id: string | null;
  categoria_nome: string | null;
  categoria_cor: string | null;
  subcategoria_id: string | null;
  subcategoria_nome: string | null;
  grau: number;
  similaridade_media: number;
}

export interface MapaSimilaridadeLivreEdge {
  source: string;
  target: string;
  similaridade: number;
}

export interface MapaSimilaridadeLivresMetricas {
  total_candidatos: number;
  total_exibidos: number;
  total_com_conexao: number;
  total_isolados: number;
  total_arestas: number;
  total_vip: number;
  total_sos: number;
  total_vip_base: number;
  total_sos_base: number;
  tempo_medio_horas: number;
  tempo_medio_base_horas: number;
  ticket_mais_antigo_em: string | null;
  ticket_mais_antigo_exibido_em: string | null;
  limite_aplicado: boolean;
}

export interface MapaSimilaridadeLivresParams {
  equipe_id: string;
  origem: TicketOrigem | null;
  min_similarity: number;
  top_k: number;
  max_tickets: number;
}

export interface MapaSimilaridadeLivresResult {
  nodes: MapaSimilaridadeLivreNode[];
  edges: MapaSimilaridadeLivreEdge[];
  metricas: MapaSimilaridadeLivresMetricas;
  params: MapaSimilaridadeLivresParams;
  atualizado_em: string;
}

export interface MapaSimilaridadeLivresOptions {
  minSimilarity?: number;
  topK?: number;
  maxTickets?: number;
}

export interface ExcluirTicketResult {
  sucesso: boolean;
  erro?: string;
  ticket_id?: string;
  numero_chamado?: string;
  gse?: string;
}

export interface TicketHistoricoEncerradoItem {
  numero_chamado: string;
  descricao: string | null;
  data: string | null;
}

export interface TicketHistoricoEncerradoResult {
  email: string;
  total: number;
  ultimo_chamado: string | null;
  ultimo_data: string | null;
  chamados: TicketHistoricoEncerradoItem[];
  has_more: boolean;
}

function normalizarEmailConsulta(email?: string | null): string {
  return email?.trim().toLowerCase() || '';
}

export const ticketsService = {
  async obterDistribuicaoTempoEsperaLivres(
    equipeId: string,
    origem?: TicketOrigem
  ): Promise<DistribuicaoTempoEsperaLivreBucket[]> {
    const { data, error } = await supabase.rpc('dist_obter_distribuicao_tempo_espera_livres', {
      p_equipe_id: equipeId,
      p_origem: origem ?? null,
    });

    if (error) {
      throw error;
    }

    return (data || []).map((row: any) => ({
      bucket_id: row.bucket_id,
      label: row.label,
      horas_min: Number(row.horas_min ?? 0),
      horas_max: row.horas_max === null ? null : Number(row.horas_max),
      cor: row.cor,
      ordem: Number(row.ordem ?? 0),
      total: Number(row.total ?? 0),
      percentual: Number(row.percentual ?? 0),
      total_geral: Number(row.total_geral ?? 0),
      total_vip: Number(row.total_vip ?? 0),
      total_sos: Number(row.total_sos ?? 0),
      tempo_medio_horas: Number(row.tempo_medio_horas ?? 0),
      ticket_mais_antigo_em: row.ticket_mais_antigo_em ?? null,
      atualizado_em: row.atualizado_em,
    }));
  },

  async obterDistribuicaoDiasEsperaLivres(
    equipeId: string,
    origem?: TicketOrigem
  ): Promise<DistribuicaoDiasEsperaLivreItem[]> {
    const { data, error } = await supabase.rpc('dist_obter_distribuicao_dias_espera_livres', {
      p_equipe_id: equipeId,
      p_origem: origem ?? null,
    });

    if (error) {
      throw error;
    }

    return (data || []).map((row: any) => ({
      dia_espera: Number(row.dia_espera ?? 0),
      label: row.label,
      cor: row.cor,
      ordem: Number(row.ordem ?? 0),
      total: Number(row.total ?? 0),
      percentual: Number(row.percentual ?? 0),
      total_geral: Number(row.total_geral ?? 0),
      total_vip: Number(row.total_vip ?? 0),
      total_sos: Number(row.total_sos ?? 0),
      tempo_medio_horas: Number(row.tempo_medio_horas ?? 0),
      ticket_mais_antigo_em: row.ticket_mais_antigo_em ?? null,
      atualizado_em: row.atualizado_em,
    }));
  },

  async obterMapaSimilaridadeLivres(
    equipeId: string,
    origem?: TicketOrigem,
    options: MapaSimilaridadeLivresOptions = {}
  ): Promise<MapaSimilaridadeLivresResult> {
    const { data, error } = await supabase.rpc('dist_obter_mapa_similaridade_livres', {
      p_equipe_id: equipeId,
      p_origem: origem ?? null,
      p_min_similarity: options.minSimilarity ?? 0.88,
      p_top_k: options.topK ?? 8,
      p_max_tickets: options.maxTickets ?? 800,
    });

    if (error) {
      throw error;
    }

    const payload = (data ?? {}) as Record<string, any>;
    const metricas = (payload.metricas ?? {}) as Record<string, any>;
    const params = (payload.params ?? {}) as Record<string, any>;

    return {
      nodes: Array.isArray(payload.nodes)
        ? payload.nodes.map((row: any) => ({
          ticket_id: String(row.ticket_id),
          numero_chamado: String(row.numero_chamado ?? ''),
          gse: row.gse ?? null,
          descricao: row.descricao ?? null,
          email: row.email ?? null,
          vip: Boolean(row.vip),
          sos: Boolean(row.sos),
          origem: row.origem ?? null,
          tempo_espera_origem: row.tempo_espera_origem ?? null,
          espera_horas: Number(row.espera_horas ?? 0),
          categoria_id: row.categoria_id ?? null,
          categoria_nome: row.categoria_nome ?? null,
          categoria_cor: row.categoria_cor ?? null,
          subcategoria_id: row.subcategoria_id ?? null,
          subcategoria_nome: row.subcategoria_nome ?? null,
          grau: Number(row.grau ?? 0),
          similaridade_media: Number(row.similaridade_media ?? 0),
        }))
        : [],
      edges: Array.isArray(payload.edges)
        ? payload.edges.map((row: any) => ({
          source: String(row.source),
          target: String(row.target),
          similaridade: Number(row.similaridade ?? 0),
        }))
        : [],
      metricas: {
        total_candidatos: Number(metricas.total_candidatos ?? 0),
        total_exibidos: Number(metricas.total_exibidos ?? 0),
        total_com_conexao: Number(metricas.total_com_conexao ?? 0),
        total_isolados: Number(metricas.total_isolados ?? 0),
        total_arestas: Number(metricas.total_arestas ?? 0),
        total_vip: Number(metricas.total_vip ?? 0),
        total_sos: Number(metricas.total_sos ?? 0),
        total_vip_base: Number(metricas.total_vip_base ?? 0),
        total_sos_base: Number(metricas.total_sos_base ?? 0),
        tempo_medio_horas: Number(metricas.tempo_medio_horas ?? 0),
        tempo_medio_base_horas: Number(metricas.tempo_medio_base_horas ?? 0),
        ticket_mais_antigo_em: metricas.ticket_mais_antigo_em ?? null,
        ticket_mais_antigo_exibido_em: metricas.ticket_mais_antigo_exibido_em ?? null,
        limite_aplicado: Boolean(metricas.limite_aplicado),
      },
      params: {
        equipe_id: String(params.equipe_id ?? equipeId),
        origem: params.origem ?? null,
        min_similarity: Number(params.min_similarity ?? options.minSimilarity ?? 0.88),
        top_k: Number(params.top_k ?? options.topK ?? 8),
        max_tickets: Number(params.max_tickets ?? options.maxTickets ?? 800),
      },
      atualizado_em: payload.atualizado_em ?? new Date().toISOString(),
    };
  },

  // Buscar fila de tickets da equipe:
  // - Livres/mantidos reais: aguardando + sem usuario_atual
  // - Em atendimento visível: atribuido/em_atendimento + com usuario_atual
  async getTicketsByEquipe(equipeId: string, origem?: TicketOrigem): Promise<Ticket[]> {
    try {
      // Primeiro verificar se há GSEs para esta equipe
      const { data: gseData, error: gseError } = await supabase
        .from('gse_equipes')
        .select('gse')
        .eq('equipe_id', equipeId);

      if (gseError) {
        throw gseError;
      }

      if (!gseData || gseData.length === 0) {
        return [];
      }

      const gseList = gseData.map(item => item.gse);

      // Buscar tickets usando IN com a lista de GSEs, filtrando apenas tickets não suspensos.
      // Evita mostrar registros inconsistentes no estado "aguardando" com usuario_atual preenchido.
      // Ordenação: VIPs primeiro (descendente), depois por tempo de espera (ascendente)
      // Paginação: busca em lotes de POSTGREST_PAGE_SIZE para contornar o max_rows do PostgREST
      let allData: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('tickets')
          .select(`
            *,
            mantido_por_user:users!tickets_mantido_por_fkey(id, nome, email),
            usuario_atual_user:users!tickets_usuario_atual_fkey(id, nome, email),
            chamado_global:chamados_globais!tickets_chamado_global_id_fkey(id, nome, numero)
          `)
          .in('gse', gseList)
          .eq('suspenso', false)
          .or('and(status.eq.aguardando,usuario_atual.is.null),and(status.eq.atribuido,usuario_atual.not.is.null),and(status.eq.em_atendimento,usuario_atual.not.is.null)');
        
        // Filtrar por origem se especificado
        if (origem) {
          query = query.eq('origem', origem);
        }
        
        const { data, error } = await query
          .order('vip', { ascending: false })
          .order('sos', { ascending: false })
          .order('tempo_espera_origem', { ascending: true })
          .range(offset, offset + POSTGREST_PAGE_SIZE - 1);

        if (error) {
          throw error;
        }

        const page = (data || []).filter(ticket => isVisibleInDistributorFreeQueue(ticket));
        allData = allData.concat(page);

        if (page.length < POSTGREST_PAGE_SIZE) {
          hasMore = false;
        } else {
          offset += POSTGREST_PAGE_SIZE;
        }
      }

      // Reavalia status VIP baseado no email para tickets que podem não ter essa informação
      const ticketsWithUpdatedVip = allData.map(ticket => ({
        ...ticket,
        vip: reevaluateTicketVipStatus(ticket)
      }));

      const sortedTickets = sortTicketsForQueue(ticketsWithUpdatedVip);

      return sortedTickets;
    } catch (err) {
      throw err;
    }
  },

  // Buscar fila de tickets suspensos da equipe
  async getSuspendedTicketsByEquipe(equipeId: string, origem?: TicketOrigem): Promise<Ticket[]> {
    try {
      // Primeiro verificar se há GSEs para esta equipe
      const { data: gseData, error: gseError } = await supabase
        .from('gse_equipes')
        .select('gse')
        .eq('equipe_id', equipeId);

      if (gseError) {
        throw gseError;
      }

      if (!gseData || gseData.length === 0) {
        return [];
      }

      const gseList = gseData.map(item => item.gse);

      // Buscar tickets suspensos (inclui mantido_por_user pois tickets suspensos podem ter reserva)
      let query = supabase
        .from('tickets')
        .select(`
          *,
          mantido_por_user:users!tickets_mantido_por_fkey(id, nome, email),
          chamado_global:chamados_globais!tickets_chamado_global_id_fkey(id, nome, numero)
        `)
        .in('gse', gseList)
        .eq('status', 'aguardando')
        .eq('suspenso', true)  // Apenas tickets suspensos
        .is('usuario_atual', null);
      
      // Filtrar por origem se especificado
      if (origem) {
        query = query.eq('origem', origem);
      }
      
      const { data, error } = await query
        .order('vip', { ascending: false })
        .order('tempo_espera_origem', { ascending: true });

      if (error) {
        throw error;
      }

      // Reavalia status VIP baseado no email para tickets que podem não ter essa informação
      const ticketsWithUpdatedVip = (data || []).map(ticket => ({
        ...ticket,
        vip: reevaluateTicketVipStatus(ticket)
      }));

      const sortedTickets = ticketsWithUpdatedVip.sort(compararTicketsDistribuidor);

      return sortedTickets;
    } catch (err) {
      throw err;
    }
  },

  // Buscar ticket atual do usuário
  // IMPORTANTE: Usa .limit() ao invés de .maybeSingle() para evitar erro quando
  // há múltiplos tickets ativos (estado de bug). Nesse caso, retorna o mais recente
  // e libera os extras automaticamente.
  async getCurrentTicketByUser(userId: string): Promise<Ticket | null> {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('usuario_atual', userId)
        .in('status', ['atribuido', 'em_atendimento'])
        .order('assigned_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Se há mais de um ticket ativo, liberar os extras automaticamente
      if (data.length > 1) {
        console.warn(
          `[TICKETS] Usuário ${userId} tem ${data.length} tickets ativos simultâneos! Liberando extras...`
        );
        const ticketPrincipal = data[0]; // O mais recente
        const ticketsExtras = data.slice(1);

        // Liberar os tickets extras de volta para a fila
        for (const extra of ticketsExtras) {
          try {
            await supabase
              .from('tickets')
              .update({
                usuario_atual: null,
                status: 'aguardando',
                assigned_at: null,
                started_at: null,
                finished_at: null,
                updated_at: getCurrentLocalTimestamp()
              })
              .eq('id', extra.id);
            console.warn(
              `[TICKETS] Ticket extra ${extra.numero_chamado} (${extra.id}) liberado automaticamente.`
            );
          } catch (releaseErr) {
            console.error(`[TICKETS] Falha ao liberar ticket extra ${extra.id}:`, releaseErr);
          }
        }

        return ticketPrincipal;
      }

      return data[0];
    } catch (err) {
      throw err;
    }
  },

  // Atribuir ticket ao usuário
  // GUARD: Verifica se o usuário já tem um ticket ativo antes de atribuir
  async assignTicket(ticketId: string, userId: string): Promise<{ success: boolean; reason?: string }> {
    // Verificar se o usuário já tem um ticket ativo no banco
    const { data: activeTickets, error: checkError } = await supabase
      .from('tickets')
      .select('id, numero_chamado')
      .eq('usuario_atual', userId)
      .in('status', ['atribuido', 'em_atendimento'])
      .limit(1);

    if (checkError) {
      console.error('[TICKETS] Erro ao verificar ticket ativo:', checkError);
      throw checkError;
    }

    if (activeTickets && activeTickets.length > 0) {
      console.warn(
        `[TICKETS] Usuário ${userId} já tem ticket ativo: ${activeTickets[0].numero_chamado}. Bloqueando nova atribuição.`
      );
      return { success: false, reason: 'Você já está atendendo um chamado. Finalize ou devolva o chamado atual antes de pegar outro.' };
    }

    const assignedAt = getCurrentTimezoneAwareTimestamp();
    const updatedAt = getCurrentLocalTimestamp();
    const { data, error } = await supabase
      .from('tickets')
      .update({
        usuario_atual: userId,
        status: 'atribuido',
        mantido_por: null,        // Limpa reserva ao atribuir
        mantido_at: null,
        assigned_at: assignedAt,
        updated_at: updatedAt
      })
      .eq('id', ticketId)
      .in('status', ['aguardando', 'suspenso'])
      .is('usuario_atual', null)
      .select('id');

    if (error) throw error;

    // Verificar se o update realmente afetou alguma linha
    if (!data || data.length === 0) {
      console.warn(`[TICKETS] assignTicket não afetou nenhuma linha. Ticket ${ticketId} já foi pego por outro usuário.`);
      return { success: false, reason: 'Este chamado já foi pego por outro usuário.' };
    }

    return { success: true };
  },

  // Atualizar status do ticket
  async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<Ticket> {
    const now = getCurrentLocalTimestamp();
    const updateData: any = {
      status,
      updated_at: now
    };

    // Adicionar timestamps específicos baseados no status
    if (status === 'em_atendimento') {
      updateData.started_at = now;
    } else if (status === 'finalizado') {
      updateData.finished_at = now;
    }

    const { data, error } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  // Devolver ticket para a fila (e liberar qualquer reserva)
  async returnTicketToQueue(ticketId: string): Promise<void> {
    const { error } = await supabase
      .from('tickets')
      .update({
        usuario_atual: null,
        status: 'aguardando',
        mantido_por: null,        // Também limpa reserva
        mantido_at: null,
        assigned_at: null,
        started_at: null,
        finished_at: null,
        updated_at: getCurrentLocalTimestamp()
      })
      .eq('id', ticketId);

    if (error) throw error;
  },

  // Buscar todos os tickets (para admin)
  async getAllTickets(): Promise<Ticket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .order('vip', { ascending: false })
      .order('tempo_espera_origem', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async contarTicketsEncerradosPorEmail(emails: string[]): Promise<Record<string, number>> {
    const emailsNormalizados = [...new Set(emails.map(normalizarEmailConsulta).filter(Boolean))];

    if (emailsNormalizados.length === 0) {
      return {};
    }

    const { data, error } = await supabase.rpc('dist_contar_tickets_encerrados_por_email', {
      p_emails: emailsNormalizados,
    });

    if (error) throw error;

    const contadores: Record<string, number> = {};

    (data || []).forEach((row: any) => {
      const email = normalizarEmailConsulta(row?.email);
      if (!email) return;
      contadores[email] = Number(row?.total ?? 0);
    });

    emailsNormalizados.forEach((email) => {
      if (contadores[email] === undefined) {
        contadores[email] = 0;
      }
    });

    return contadores;
  },

  async buscarTicketsEncerradosPorSolicitante(
    email: string,
    excluirChamado?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<TicketHistoricoEncerradoResult | null> {
    const emailNormalizado = normalizarEmailConsulta(email);
    if (!emailNormalizado) return null;

    const { data, error } = await supabase.rpc('dist_buscar_tickets_encerrados_solicitante', {
      p_email: emailNormalizado,
      p_excluir_chamado: excluirChamado || null,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw error;

    const payload = (data ?? {}) as Record<string, any>;
    const chamados = Array.isArray(payload.chamados) ? payload.chamados : [];

    return {
      email: normalizarEmailConsulta(payload.email ?? emailNormalizado),
      total: Number(payload.total ?? 0),
      ultimo_chamado: payload.ultimo_chamado ? String(payload.ultimo_chamado) : null,
      ultimo_data: payload.ultimo_data ? String(payload.ultimo_data) : null,
      chamados: chamados.map((chamado: any) => ({
        numero_chamado: String(chamado.numero_chamado ?? ''),
        descricao: chamado.descricao ? String(chamado.descricao) : null,
        data: chamado.data ? String(chamado.data) : null,
      })),
      has_more: Boolean(payload.has_more),
    };
  },

  // Buscar GSEs por equipe
  async getGSEsByEquipe(equipeId: string): Promise<GSEEquipe[]> {
    const { data, error } = await supabase
      .from('gse_equipes')
      .select('*')
      .eq('equipe_id', equipeId);

    if (error) throw error;
    return data || [];
  },

  // Suspender TODOS os tickets mantidos (livres) da equipe em lote
  async suspendAllHeldTickets(equipeId: string, origem?: TicketOrigem): Promise<number> {
    // Buscar GSEs da equipe
    const { data: gseData, error: gseError } = await supabase
      .from('gse_equipes')
      .select('gse')
      .eq('equipe_id', equipeId);

    if (gseError) throw gseError;
    if (!gseData || gseData.length === 0) return 0;

    const gseList = gseData.map(item => item.gse);

    let query = supabase
      .from('tickets')
      .update({
        suspenso: true,
        updated_at: getCurrentLocalTimestamp()
      }, { count: 'exact' })
      .in('gse', gseList)
      .eq('status', 'aguardando')
      .eq('suspenso', false)
      .not('mantido_por', 'is', null)
      .is('usuario_atual', null);

    if (origem) {
      query = query.eq('origem', origem);
    }

    const { error, count } = await query;
    if (error) throw error;
    return count ?? 0;
  },

  // Suspender ticket (preserva mantido_por — ticket muda de contexto mas reserva é mantida)
  async suspendTicket(ticketId: string): Promise<void> {
    const { error } = await supabase
      .from('tickets')
      .update({
        suspenso: true,
        updated_at: getCurrentLocalTimestamp()
      })
      .eq('id', ticketId)
      .eq('status', 'aguardando')
      .is('usuario_atual', null);

    if (error) throw error;
  },

  async suspendMultipleTickets(ticketIds: string[], origem?: TicketOrigem): Promise<DistribuidorBatchActionResult> {
    if (ticketIds.length === 0) return emptyBatchActionResult('suspender_lote');

    const { data, error } = await supabase.rpc('distribuidor_suspender_lote', {
      p_ticket_ids: ticketIds,
      p_origem: origem || null
    });

    if (error) throw error;
    return parseBatchActionResult(data, 'suspender_lote');
  },

  // Liberar ticket (remover suspensão)
  async releaseTicket(ticketId: string): Promise<void> {
    const { error } = await supabase
      .from('tickets')
      .update({
        suspenso: false,
        updated_at: getCurrentLocalTimestamp()
      })
      .eq('id', ticketId)
      .eq('status', 'aguardando')
      .is('usuario_atual', null);

    if (error) throw error;
  },

  async releaseMultipleTickets(ticketIds: string[], origem?: TicketOrigem): Promise<DistribuidorBatchActionResult> {
    if (ticketIds.length === 0) return emptyBatchActionResult('liberar_chamados_lote');

    const { data, error } = await supabase.rpc('distribuidor_liberar_chamados_lote', {
      p_ticket_ids: ticketIds,
      p_origem: origem || null
    });

    if (error) throw error;
    return parseBatchActionResult(data, 'liberar_chamados_lote');
  },

  async excluirTicket(ticketId: string): Promise<ExcluirTicketResult> {
    const { data, error } = await supabase.rpc('distribuidor_excluir_ticket', {
      p_ticket_id: ticketId,
    });

    if (error) throw error;

    const result = (data ?? {}) as ExcluirTicketResult;
    if (!result.sucesso) {
      throw new Error(result.erro || 'Erro ao excluir ticket');
    }

    return result;
  },

  // ========================================
  // SISTEMA DE RESERVA (MANTER/HOLD)
  // ========================================

  // Devolver ticket e manter reserva (ticket volta pra fila mas fica reservado)
  async holdTicket(ticketId: string, userId: string): Promise<void> {
    const mantidoAt = getCurrentTimezoneAwareTimestamp();
    const updatedAt = getCurrentLocalTimestamp();
    const { error } = await supabase
      .from('tickets')
      .update({
        usuario_atual: null,      // Libera o ticket (volta pra fila)
        status: 'aguardando',
        mantido_por: userId,      // Mas fica reservado para este usuário
        mantido_at: mantidoAt,
        assigned_at: null,
        started_at: null,
        finished_at: null,
        updated_at: updatedAt
      })
      .eq('id', ticketId);

    if (error) throw error;
  },

  // Marcar ticket da fila como mantido (sem alterar status/atribuição — ticket já está aguardando)
  async markAsHeld(ticketId: string, userId: string): Promise<boolean> {
    const mantidoAt = getCurrentTimezoneAwareTimestamp();
    const updatedAt = getCurrentLocalTimestamp();
    const { error, count } = await supabase
      .from('tickets')
      .update({
        mantido_por: userId,
        mantido_at: mantidoAt,
        updated_at: updatedAt
      }, { count: 'exact' })
      .eq('id', ticketId)
      .is('mantido_por', null);

    if (error) throw error;
    // Retorna true se o ticket foi efetivamente reservado (não capturado por outro usuário)
    return (count ?? 0) > 0;
  },

  // Marcar múltiplos tickets da fila como mantidos (batch)
  async markMultipleAsHeld(ticketIds: string[], userId: string): Promise<number> {
    const mantidoAt = getCurrentTimezoneAwareTimestamp();
    const updatedAt = getCurrentLocalTimestamp();
    const { error, count } = await supabase
      .from('tickets')
      .update({
        mantido_por: userId,
        mantido_at: mantidoAt,
        updated_at: updatedAt
      }, { count: 'exact' })
      .in('id', ticketIds)
      .is('mantido_por', null);

    if (error) throw error;
    // Retorna a quantidade efetivamente reservada (pode ser menor que ticketIds.length)
    return count ?? 0;
  },

  // Responder e finalizar múltiplos tickets de uma vez (Sistema Solar do Distribuidor).
  // Salva resposta_ia, marca como finalizado, registra usuário responsável.
  async responderEFinalizarLote(ticketIds: string[], userId: string, resposta: string): Promise<number> {
    if (ticketIds.length === 0) return 0;
    const now = getCurrentLocalTimestamp();
    // started_at: usa COALESCE no banco — fazemos via 2 updates? Não:
    // simplificação: setamos started_at sempre como now se for nulo via RPC seria ideal,
    // mas para minimizar superfície, atualizamos started_at apenas quando ainda nulo via segundo update.
    const { error: e1 } = await supabase
      .from('tickets')
      .update({
        resposta_ia: resposta,
        status: 'finalizado',
        finished_at: now,
        usuario_atual: userId,
        updated_at: now
      })
      .in('id', ticketIds);
    if (e1) throw e1;
    // Garante started_at preenchido para tickets que nunca foram iniciados
    const { error: e2 } = await supabase
      .from('tickets')
      .update({ started_at: now })
      .in('id', ticketIds)
      .is('started_at', null);
    if (e2) throw e2;
    return ticketIds.length;
  },

  // Liberar reserva de múltiplos tickets mantidos (batch, sem restrição de dono)
  async releaseMultipleHeld(ticketIds: string[]): Promise<number> {
    const result = await this.releaseMultipleReservations(ticketIds);
    return result.total_alterado;
  },

  async releaseMultipleReservations(ticketIds: string[], origem?: TicketOrigem): Promise<DistribuidorBatchActionResult> {
    if (ticketIds.length === 0) return emptyBatchActionResult('liberar_reservas_lote');

    const { data, error } = await supabase.rpc('distribuidor_liberar_reservas_lote', {
      p_ticket_ids: ticketIds,
      p_origem: origem || null
    });

    if (error) throw error;
    return parseBatchActionResult(data, 'liberar_reservas_lote');
  },

  async reserveMultipleForUser(ticketIds: string[], targetUserId: string, origem?: TicketOrigem): Promise<DistribuidorBatchActionResult> {
    if (ticketIds.length === 0) return emptyBatchActionResult('reservar_para_usuario_lote');

    const { data, error } = await supabase.rpc('distribuidor_reservar_para_usuario_lote', {
      p_ticket_ids: ticketIds,
      p_target_user_id: targetUserId,
      p_origem: origem || null
    });

    if (error) throw error;
    return parseBatchActionResult(data, 'reservar_para_usuario_lote');
  },

  async finalizeMultipleHeldByUser(ticketIds: string[], userId: string): Promise<DistribuidorBatchActionResult> {
    if (ticketIds.length === 0) return emptyBatchActionResult('finalizar_chamados_lote');

    const { data: elegiveis, error: elegiveisError } = await supabase
      .from('tickets')
      .select('id')
      .in('id', ticketIds)
      .eq('mantido_por', userId)
      .eq('status', 'aguardando')
      .is('usuario_atual', null);

    if (elegiveisError) throw elegiveisError;

    const elegiveisIds = (elegiveis ?? []).map(ticket => ticket.id);
    if (elegiveisIds.length === 0) {
      return {
        success: false,
        acao: 'finalizar_chamados_lote',
        total_solicitado: ticketIds.length,
        total_alterado: 0,
        total_bloqueado: ticketIds.length,
        total_ignorado: 0,
        target_user_id: userId
      };
    }

    const now = getCurrentLocalTimestamp();
    const { error } = await supabase
      .from('tickets')
      .update({
        usuario_atual: userId,
        status: 'finalizado',
        assigned_at: now,
        started_at: now,
        finished_at: now,
        mantido_por: null,
        mantido_at: null,
        updated_at: now
      })
      .in('id', elegiveisIds);

    if (error) throw error;

    return {
      success: true,
      acao: 'finalizar_chamados_lote',
      total_solicitado: ticketIds.length,
      total_alterado: elegiveisIds.length,
      total_bloqueado: ticketIds.length - elegiveisIds.length,
      total_ignorado: 0,
      target_user_id: userId
    };
  },

  // Retomar ticket mantido (apenas quem mantém pode retomar)
  async resumeHeldTicket(ticketId: string, userId: string): Promise<void> {
    const assignedAt = getCurrentTimezoneAwareTimestamp();
    const updatedAt = getCurrentLocalTimestamp();
    const { error } = await supabase
      .from('tickets')
      .update({
        usuario_atual: userId,
        status: 'atribuido',
        mantido_por: null,        // Limpa a reserva
        mantido_at: null,
        assigned_at: assignedAt,
        updated_at: updatedAt
      })
      .eq('id', ticketId)
      .eq('mantido_por', userId); // Só quem mantém pode retomar

    if (error) throw error;
  },

  // Liberar reserva de um ticket mantido (apenas quem mantém)
  async releaseHeldTicket(ticketId: string, userId: string): Promise<void> {
    const now = getCurrentLocalTimestamp();
    const { error } = await supabase
      .from('tickets')
      .update({
        mantido_por: null,
        mantido_at: null,
        updated_at: now
      })
      .eq('id', ticketId)
      .eq('mantido_por', userId); // Só quem mantém pode liberar

    if (error) throw error;
  },

  // Liberar reserva de qualquer ticket mantido (qualquer usuário pode liberar)
  async releaseAnyHeldTicket(ticketId: string): Promise<void> {
    const now = getCurrentLocalTimestamp();
    const { error } = await supabase
      .from('tickets')
      .update({
        mantido_por: null,
        mantido_at: null,
        updated_at: now
      })
      .eq('id', ticketId);

    if (error) throw error;
  },

  // Liberar ticket em atendimento (desaloca do usuário atual e retorna para fila livre)
  async releaseInServiceTicket(ticketId: string): Promise<void> {
    const { data, error } = await supabase.rpc('dist_liberar_ticket_atendimento', {
      p_ticket_id: ticketId
    });

    if (error) throw error;

    if (!data?.success) {
      throw new Error(data?.reason || 'Não foi possível liberar ticket em atendimento');
    }
  },

  // Atualizar causa da suspensão
  async updateCausaSuspensao(ticketId: string, causa: string): Promise<void> {
    const { error } = await supabase
      .from('tickets')
      .update({
        causa_suspensao: causa,
        updated_at: getCurrentLocalTimestamp()
      })
      .eq('id', ticketId);

    if (error) throw error;
  },

  // Atualizar comentário do ticket
  async updateComentario(ticketId: string, comentario: string): Promise<void> {
    const { error } = await supabase
      .from('tickets')
      .update({
        comentario: comentario,
        updated_at: getCurrentLocalTimestamp()
      })
      .eq('id', ticketId);

    if (error) throw error;
  },

  // Salvar resposta da IA no ticket
  async saveRespostaIA(ticketId: string, respostaIA: string): Promise<void> {
    const { error } = await supabase
      .from('tickets')
      .update({
        resposta_ia: respostaIA,
        updated_at: getCurrentLocalTimestamp()
      })
      .eq('id', ticketId);

    if (error) throw error;
  },

  // Busca FTS (Full-Text Search) na descrição dos tickets da fila atual
  async buscarTicketsFTS(
    query: string,
    equipeId: string,
    origem?: TicketOrigem,
    queueContext: 'livres' | 'suspensos' = 'livres'
  ): Promise<Ticket[]> {
    const { data, error } = await supabase.rpc('buscar_tickets_fts', {
      p_query: query,
      p_equipe_id: equipeId,
      p_origem: origem || null,
      p_suspenso: queueContext === 'suspensos',
      p_limit: 100
    });

    if (error) {
      console.error('Erro na busca FTS de tickets:', error);
      throw new Error(`Erro na busca textual: ${error.message}`);
    }

    // A RPC retorna JSONB (array de objetos), parse direto
    const resultados = Array.isArray(data) ? data : [];
    
    // Mapear resultado para o tipo Ticket
    return resultados.map((row: any) => ({
      ...row,
      // Garante que campos opcionais estejam presentes
      mantido_por_user: undefined, // RPC não faz join com users
      _fts_rank: row.fts_rank,
      _fts_match_type: row.match_type
    })) as Ticket[];
  },

  // Importar tickets de planilha Excel (apenas Boss)
  async importarTicketsExcel(tickets: {
    numero_chamado: string;
    gse: string;
    tempo_espera_origem: string;
    descricao?: string;
    email?: string;
  }[]): Promise<{
    success: boolean;
    inserted_count?: number;
    error_count?: number;
    errors?: Array<{ numero_chamado: string; error: string }>;
    message?: string;
    error?: string;
  }> {
    const { data, error } = await supabase
      .rpc('admin_importar_tickets_excel', {
        p_tickets: tickets
      });

    if (error) {
      throw new Error(`Erro ao importar tickets: ${error.message}`);
    }

    return data;
  },

  // ========================================
  // FUNÇÕES DE PAGINAÇÃO E FILTROS
  // ========================================

  /**
   * Conta tickets na fila (livres e suspensos) independente de paginação
   */
  async contarTicketsFila(equipeId: string, origem?: TicketOrigem): Promise<{
    total_livres: number;
    total_suspensos: number;
  }> {
    const { data, error } = await supabase.rpc('dist_contar_tickets_fila', {
      p_equipe_id: equipeId,
      p_origem: origem || null
    });

    if (error) {
      console.error('Erro ao contar tickets:', error);
      throw error;
    }

    // A função retorna um array com uma linha
    const result = Array.isArray(data) && data.length > 0 ? data[0] : { total_livres: 0, total_suspensos: 0 };
    return {
      total_livres: Number(result.total_livres) || 0,
      total_suspensos: Number(result.total_suspensos) || 0
    };
  },

  async contarFacetasFila(params: {
    equipeId: string;
    origem?: TicketOrigem;
    suspenso?: boolean;
    filtroMantido?: string;
    filtroNumero?: string;
    filtroTempoHoras?: number;
    filtroTempoOperador?: 'maior' | 'menor';
    filtroSos?: string;
    filtroGse?: string;
    filtroCategoriaEquipeId?: string;
    filtroCategoriaSlug?: string;
    filtroSubcategoriaSlug?: string;
    filtroSubcategoriaGseNome?: string;
    filtroSemCategoria?: boolean;
  }): Promise<import('../utils/distribuidorQueueParams').DistribuidorFacetasFila> {
    const { data, error } = await supabase.rpc('dist_contar_facetas_fila', {
      p_equipe_id: params.equipeId,
      p_origem: params.origem || null,
      p_suspenso: params.suspenso ?? false,
      p_filtro_mantido: params.filtroMantido || null,
      p_filtro_numero: params.filtroNumero || null,
      p_filtro_tempo_horas: params.filtroTempoHoras ?? null,
      p_filtro_tempo_operador: params.filtroTempoOperador || 'maior',
      p_filtro_sos: params.filtroSos || null,
      p_filtro_gse: params.filtroGse || null,
      p_filtro_categoria_equipe_id: params.filtroCategoriaEquipeId || null,
      p_filtro_categoria_slug: params.filtroCategoriaSlug || null,
      p_filtro_subcategoria_slug: params.filtroSubcategoriaSlug || null,
      p_filtro_subcategoria_gse_nome: params.filtroSubcategoriaGseNome || null,
      p_filtro_sem_categoria: params.filtroSemCategoria ?? false,
    });

    if (error) {
      console.error('Erro ao contar facetas da fila:', error);
      throw error;
    }

    const payload = (data ?? {}) as Record<string, unknown>;
    const globaisRaw = Array.isArray(payload.globais) ? payload.globais : [];
    return {
      sem_categoria: Number(payload.sem_categoria) || 0,
      categorias: (payload.categorias as Record<string, number>) || {},
      subcategorias: (payload.subcategorias as Record<string, number>) || {},
      gses: (payload.gses as Record<string, number>) || {},
      globais: globaisRaw
        .map((item) => {
          const row = item as Record<string, unknown>;
          const id = typeof row.id === 'string' ? row.id : '';
          if (!id) return null;
          return {
            id,
            numero: typeof row.numero === 'string' ? row.numero : '',
            nome: typeof row.nome === 'string' ? row.nome : '',
            count: Number(row.count) || 0,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    };
  },

  /**
   * Busca tickets paginados com filtros avançados
   */
  async buscarTicketsPaginado(params: {
    equipeId: string;
    origem?: TicketOrigem;
    suspenso?: boolean;
    limit?: number;
    offset?: number;
    filtroCategoria?: string;
    filtroMantido?: string; // 'todos', 'livres', 'mantidos', ou UUID do usuário
    filtroNumero?: string;
    filtroTempoHoras?: number;
    filtroTempoOperador?: 'maior' | 'menor';
    filtroSubcategoria?: string;
    filtroSos?: string;
    filtroGse?: string;
    filtroCategoriaEquipeId?: string;
    filtroSubcategoriaGseNome?: string;
    filtroSemCategoria?: boolean;
  }): Promise<{
    tickets: Ticket[];
    totalCount: number;
  }> {
    const { data, error } = await supabase.rpc('dist_buscar_tickets_paginado', {
      p_equipe_id: params.equipeId,
      p_origem: params.origem || null,
      p_suspenso: params.suspenso || false,
      p_limit: params.limit || 50,
      p_offset: params.offset || 0,
      p_filtro_categoria: params.filtroCategoria || null,
      p_filtro_mantido: params.filtroMantido || null,
      p_filtro_numero: params.filtroNumero || null,
      p_filtro_tempo_horas: params.filtroTempoHoras || null,
      p_filtro_tempo_operador: params.filtroTempoOperador || 'maior',
      p_filtro_subcategoria: params.filtroSubcategoria || null,
      p_filtro_sos: params.filtroSos || null,
      p_filtro_gse: params.filtroGse || null,
      p_filtro_categoria_equipe_id: params.filtroCategoriaEquipeId || null,
      p_filtro_subcategoria_gse_nome: params.filtroSubcategoriaGseNome || null,
      p_filtro_sem_categoria: params.filtroSemCategoria ?? false,
    });

    if (error) {
      console.error('Erro ao buscar tickets paginado:', error);
      throw error;
    }

    const result = Array.isArray(data) ? data : [];
    const totalCount = result.length > 0 ? Number(result[0].total_count) : 0;

    // Mapear resultados para o tipo Ticket com VIP reavaliado
    const tickets = result.map((row: any) => ({
      id: row.id,
      numero_chamado: row.numero_chamado,
      gse: row.gse,
      email: row.email,
      descricao: row.descricao,
      usuario_atual: row.usuario_atual,
      status: row.status,
      origem: row.origem,
      vip: reevaluateTicketVipStatus(row),
      sos: !!row.sos,
      sos_palavras: row.sos_palavras || [],
      sos_override: !!row.sos_override,
      tempo_espera_origem: row.tempo_espera_origem,
      suspenso: row.suspenso,
      causa_suspensao: row.causa_suspensao,
      mantido_por: row.mantido_por,
      mantido_at: row.mantido_at,
      mantido_por_user: row.mantido_por ? {
        id: row.mantido_por,
        nome: row.mantido_por_nome,
        email: row.mantido_por_email
      } : undefined,
      usuario_atual_user: row.usuario_atual ? {
        id: row.usuario_atual,
        nome: row.usuario_atual_nome,
        email: row.usuario_atual_email
      } : undefined,
      chamado_global_id: row.chamado_global_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    })) as Ticket[];

    const sortedTickets = sortTicketsForQueue(tickets);
    const withGlobais = await ticketsService.enrichChamadosGlobais(sortedTickets);

    return { tickets: withGlobais, totalCount };
  },

  async enrichChamadosGlobais(ticketsList: Ticket[]): Promise<Ticket[]> {
    const globalIds = [
      ...new Set(
        ticketsList
          .map((ticket) => ticket.chamado_global_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    if (globalIds.length === 0) {
      return ticketsList;
    }

    const { data, error } = await supabase
      .from('chamados_globais')
      .select('id, nome, numero')
      .in('id', globalIds);

    if (error) {
      console.error('Erro ao enriquecer chamados globais:', error);
      return ticketsList;
    }

    const globalMap = new Map((data || []).map((row) => [row.id, row]));

    return ticketsList.map((ticket) => {
      if (!ticket.chamado_global_id) {
        return ticket;
      }

      const global = globalMap.get(ticket.chamado_global_id);
      if (!global) {
        return ticket;
      }

      return {
        ...ticket,
        chamado_global: {
          id: global.id,
          nome: global.nome,
          numero: global.numero,
        },
      };
    });
  },

  /**
   * Lista usuários que têm tickets mantidos (reservados)
   */
  async listarUsuariosMantendo(equipeId: string, origem?: TicketOrigem, suspenso: boolean = false): Promise<Array<{
    user_id: string;
    nome: string;
    email: string;
    quantidade: number;
  }>> {
    // Tenta com p_suspenso (assinatura nova), fallback para assinatura antiga
    const { data, error } = await supabase.rpc('dist_listar_usuarios_mantendo', {
      p_equipe_id: equipeId,
      p_origem: origem || null,
      p_suspenso: suspenso
    });

    if (error) {
      // Fallback: função antiga sem p_suspenso (retorna apenas livres)
      if (error.message?.includes('Could not find the function')) {
        const { data: fallbackData, error: fallbackError } = await supabase.rpc('dist_listar_usuarios_mantendo', {
          p_equipe_id: equipeId,
          p_origem: origem || null
        });
        if (fallbackError) {
          console.error('Erro ao listar usuários mantendo (fallback):', fallbackError);
          throw fallbackError;
        }
        return (fallbackData || []).map((row: any) => ({
          user_id: row.user_id,
          nome: row.nome || row.email,
          email: row.email,
          quantidade: Number(row.quantidade)
        }));
      }
      console.error('Erro ao listar usuários mantendo:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      user_id: row.user_id,
      nome: row.nome || row.email,
      email: row.email,
      quantidade: Number(row.quantidade)
    }));
  },

  /**
   * Lista categorias utilizadas nos tickets da equipe com contagem
   */
  async listarCategoriasEquipe(equipeId: string, origem?: TicketOrigem): Promise<Array<{
    slug: string;
    nome: string;
    icone: string;
    cor_hex: string;
    quantidade: number;
  }>> {
    const { data, error } = await supabase.rpc('dist_listar_categorias_equipe', {
      p_equipe_id: equipeId,
      p_origem: origem || null
    });

    if (error) {
      console.error('Erro ao listar categorias da equipe:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      slug: row.slug,
      nome: row.nome,
      icone: row.icone,
      cor_hex: row.cor_hex,
      quantidade: Number(row.quantidade)
    }));
  },

  /**
   * Lista subcategorias de uma categoria nos tickets da equipe com contagem
   */
  async listarSubcategoriasEquipe(equipeId: string, categoriaSlug: string, origem?: TicketOrigem): Promise<Array<{
    slug: string;
    nome: string;
    icone: string;
    cor_hex: string;
    quantidade: number;
  }>> {
    const { data, error } = await supabase.rpc('dist_listar_subcategorias_equipe', {
      p_equipe_id: equipeId,
      p_categoria_slug: categoriaSlug,
      p_origem: origem || null
    });

    if (error) {
      console.error('Erro ao listar subcategorias da equipe:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      slug: row.slug,
      nome: row.nome,
      icone: row.icone,
      cor_hex: row.cor_hex,
      quantidade: Number(row.quantidade)
    }));
  }
};

const isInServiceTicket = (ticket: Pick<Ticket, 'usuario_atual' | 'status'>): boolean => {
  return !!ticket.usuario_atual && (ticket.status === 'atribuido' || ticket.status === 'em_atendimento');
};

const isVisibleInDistributorFreeQueue = (
  ticket: Pick<Ticket, 'suspenso' | 'usuario_atual' | 'status'>
): boolean => {
  if (ticket.suspenso) return false;

  if (ticket.status === 'aguardando') {
    return !ticket.usuario_atual;
  }

  return isInServiceTicket(ticket);
};

const sortTicketsForQueue = (tickets: Ticket[], ordenacaoTempo: 'antigos' | 'recentes' = 'antigos'): Ticket[] => {
  return [...tickets].sort((a, b) => {
    const aInService = isInServiceTicket(a);
    const bInService = isInServiceTicket(b);

    if (aInService && !bInService) return -1;
    if (!aInService && bInService) return 1;

    return compararTicketsDistribuidor(a, b, ordenacaoTempo);
  });
};

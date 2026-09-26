import { supabase } from './supabaseClient';
import { User, UserStatus } from '../types/Ticket';

export const usersService = {
  async listByEquipe(equipeId?: string): Promise<Pick<User, 'id' | 'nome'>[]> {
    let query = supabase.from('users').select('id, nome').order('nome');
    if (equipeId) {
      query = query.eq('equipe_id', equipeId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Pick<User, 'id' | 'nome'>[];
  },

  // Buscar usuário por ID
  async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  // Buscar usuário por email
  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  // Criar novo usuário
  async createUser(userData: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Buscar todos os usuários (para admin)
  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('nome');

    if (error) throw error;
    return data || [];
  },

  async getActiveUsersByEquipe(equipeId: string): Promise<Array<Pick<User, 'id' | 'nome' | 'email'>>> {
    const { data, error } = await supabase
      .from('users')
      .select('id, nome, email')
      .eq('equipe_id', equipeId)
      .or('ativo.is.null,ativo.eq.true')
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Atualizar usuário
  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Verificar se usuário tem ticket ativo
  async hasActiveTicket(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('tickets')
      .select('id')
      .eq('usuario_atual', userId)
      .in('status', ['atribuido', 'em_atendimento'])
      .limit(1);

    if (error) throw error;
    return (data?.length || 0) > 0;
  },

  // Buscar status dos usuários da equipe (versão simplificada sem presença)
  async getTeamUsersStatus(equipeId: string): Promise<UserStatus[]> {
    try {
      // 1. Buscar todos os usuários da equipe
      const { data: teamUsers, error: usersError } = await supabase
        .from('users')
        .select('id, nome, email')
        .eq('equipe_id', equipeId)
        .or('ativo.is.null,ativo.eq.true');

      if (usersError) {
        throw usersError;
      }

      if (!teamUsers || teamUsers.length === 0) {
        return [];
      }

      const userIds = teamUsers.map(u => u.id);

      // 2. Buscar tickets ativos
      const { data: activeTickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('usuario_atual, numero_chamado, assigned_at, status')
        .in('status', ['atribuido', 'em_atendimento'])
        .not('usuario_atual', 'is', null)
        .in('usuario_atual', userIds);

      if (ticketsError) {
        throw ticketsError;
      }

      // 3. Combinar dados (todos usuários são considerados disponíveis)
      const userStatuses: UserStatus[] = teamUsers.map(user => {
        const activeTicket = activeTickets?.find(ticket => ticket.usuario_atual === user.id);
        
        return {
          id: user.id,
          nome: user.nome,
          email: user.email,
          status: activeTicket ? 'atendendo' : 'disponivel',
          presenceStatus: 'online', // Sempre online na versão simplificada
          currentTicket: activeTicket ? {
            numero_chamado: activeTicket.numero_chamado,
            assigned_at: activeTicket.assigned_at
          } : undefined
        };
      });

      return userStatuses;
      
    } catch (err) {
      throw err;
    }
  }
};
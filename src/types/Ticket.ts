export interface Ticket {
  id: string;
  numero_chamado: string;
  gse: string;
  tempo_espera_origem: string;
  descricao?: string;
  usuario_atual?: string;
  email?: string;
  vip: boolean;
  // Sistema SOS — classificação de urgência por palavras-chave
  sos?: boolean;
  sos_palavras?: string[];
  sos_override?: boolean;
  is_reopened?: boolean;
  suspenso: boolean;      // Indica se o ticket está suspenso da distribuição
  fila_finalizacao_contexto?: 'livres' | 'suspensos' | null;
  causa_suspensao?: string; // Motivo/causa da suspensão do ticket
  comentario?: string;    // Comentários sobre o ticket
  resposta_ia?: string;   // Resposta formatada gerada pela IA
  origem: 'email' | 'inserido_diretamente'; // Origem do ticket: email ou inserido diretamente via planilha
  status: 'aguardando' | 'atribuido' | 'em_atendimento' | 'finalizado';
  created_at: string;
  updated_at: string;
  assigned_at?: string;
  started_at?: string;    // Timestamp quando o usuário clica "Iniciar Atendimento"
  finished_at?: string;   // Timestamp quando o usuário clica "Finalizar Chamado"
  version: number;
  
  // Sistema de Reserva (Manter)
  mantido_por?: string;   // ID do usuário que está mantendo/reservando o ticket
  mantido_at?: string;    // Timestamp de quando foi mantido
  mantido_por_user?: {    // Dados do usuário que mantém (via join)
    id: string;
    nome: string;
    email: string;
  };

  // Dados do usuário atualmente atendendo (via join)
  usuario_atual_user?: {
    id: string;
    nome: string;
    email: string;
  };
  
  // Sistema de Chamados Globais
  chamado_global_id?: string; // ID do chamado global ao qual este ticket está anexado
  chamado_global?: {          // Dados do global via join
    id: string;
    nome?: string;
    numero: string;
  };
}

export type TicketOrigem = 'email' | 'inserido_diretamente';

export interface User {
  id: string;
  email: string;
  nome: string;
  role: 'user' | 'supervisor' | 'coordenador' | 'admin';
  equipe_id?: string;
  setor_id?: string;
  created_at: string;
}

export interface Equipe {
  id: string;
  nome: string;
  setor_id: string;
  created_at: string;
}

export interface Setor {
  id: string;
  nome: string;
  created_at: string;
}

export interface GSEEquipe {
  id: string;
  gse: string;
  equipe_id: string;
  created_at: string;
}

export type TicketStatus = 'aguardando' | 'atribuido' | 'em_atendimento' | 'finalizado';

export interface TicketWithUser extends Ticket {
  user?: User;
}

export interface UserStatus {
  id: string;
  nome: string;
  email: string;
  status: 'disponivel' | 'atendendo' | 'ausente';
  presenceStatus?: 'online' | 'ausente' | 'offline';
  currentTicket?: {
    numero_chamado: string;
    assigned_at: string;
  };
  lastActivity?: string;
}

// ============================================================================
// Sistema de Chat (Mensagens do Ticket)
// ============================================================================

export interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  message: string;
  created_at: string;
  updated_at: string;
}

export interface TicketChatRead {
  id: string;
  ticket_id: string;
  user_id: string;
  last_read_at: string;
}

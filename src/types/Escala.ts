export type EscalaTurno = '09:00-17:00' | '11:00-19:00';
export type EscalaRegistroTipo = 'presencial' | 'extraordinario';
export type EscalaAfastamentoTipo = 'ferias' | 'licenca' | 'folga';
export type EscalaEventoInstitucionalTipo = 'feriado' | 'emenda' | 'recesso';
export type EscalaRotinaSemanalTipo = 'presencial';

export interface EscalaCalendario {
  id: string;
  nome: string;
  slug: string | null;
  grupo_compartilhamento: string | null;
  ativo: boolean;
  desativado_em?: string | null;
  criado_por: string;
  created_at: string;
  updated_at: string;
}

export interface EscalaCalendarioEquipe {
  id: string;
  calendario_id: string;
  equipe_id: string;
  created_at: string;
}

export interface EscalaMembro {
  id: string;
  calendario_id: string;
  user_id: string;
  turno: EscalaTurno;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    nome: string;
    email: string;
    equipe_id?: string | null;
  };
  origemEscala?: 'manual' | 'rotina';
}

export interface EscalaRegistroDia {
  id: string;
  calendario_id: string;
  user_id: string;
  data: string;
  tipo: EscalaRegistroTipo;
  criado_por: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    nome: string;
    email: string;
  };
}

export interface EscalaAfastamento {
  id: string;
  calendario_id: string;
  user_id: string;
  tipo: EscalaAfastamentoTipo;
  data_inicio: string;
  data_fim: string;
  observacao: string | null;
  criado_por: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    nome: string;
    email: string;
  };
}

export interface EscalaEventoInstitucional {
  id: string;
  tipo: EscalaEventoInstitucionalTipo;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  criado_por: string;
  created_at: string;
  updated_at: string;
}

export interface EscalaRotinaSemanal {
  id: string;
  calendario_id: string;
  user_id: string;
  tipo: EscalaRotinaSemanalTipo;
  dia_semana: number;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
  criado_por: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    nome: string;
    email: string;
    equipe_id?: string | null;
  };
}

export interface EscalaRotinaExcecao {
  id: string;
  calendario_id: string;
  user_id: string;
  data: string;
  tipo: EscalaRegistroTipo;
  criado_por: string;
  created_at: string;
}

export interface EscalaAuditoriaItem {
  id: string;
  calendario_id: string;
  ator_user_id: string;
  entidade: string;
  entidade_id: string;
  acao: string;
  resumo: string;
  payload: Record<string, unknown>;
  created_at: string;
  ator_user?: {
    id: string;
    nome: string;
    email: string;
  };
}

export interface EscalaDiaResumo {
  date: string;
  presencialCount: number;
  extraordinarioCount: number;
  afastamentosCount: number;
  currentUserLabels: Array<{
    tipo: EscalaRegistroTipo | EscalaAfastamentoTipo;
    texto: string;
    destaque?: boolean;
  }>;
  institucional: EscalaEventoInstitucional[];
}

export interface EscalaMesResumo {
  calendario: EscalaCalendario;
  dias: EscalaDiaResumo[];
  totais: {
    diasUteis: number;
    diasPresenciaisUsuario: number;
    diasExtraordinariosUsuario: number;
  };
  proximosAfastamentos: EscalaAfastamento[];
  ultimaAlteracao: EscalaAuditoriaItem | null;
}

export interface EscalaDiaDetalhe {
  date: string;
  presencial: EscalaMembro[];
  extraordinario: EscalaMembro[];
  ferias: EscalaMembro[];
  licenca: EscalaMembro[];
  folga: EscalaMembro[];
  institucional: EscalaEventoInstitucional[];
}

export interface CriarEscalaCalendarioInput {
  nome: string;
  equipeId: string;
  userId: string;
}

import { supabase } from './supabaseClient';
import type {
  CriarEscalaCalendarioInput,
  EscalaAuditoriaItem,
  EscalaAfastamentoTipo,
  EscalaCalendario,
  EscalaDiaDetalhe,
  EscalaDiaResumo,
  EscalaEventoInstitucionalTipo,
  EscalaEventoInstitucional,
  EscalaMembro,
  EscalaMesResumo,
  EscalaAfastamento,
  EscalaRotinaExcecao,
  EscalaRegistroDia,
  EscalaRotinaSemanal,
  EscalaRotinaSemanalTipo,
  EscalaTurno,
} from '../types/Escala';

const DEFAULT_TURNO = '09:00-17:00' as const;

function formatCalendarTechnicalName(baseName: string, createdAt = new Date()) {
  return `${baseName} · criado em ${createdAt.toLocaleString('pt-BR')}`;
}

function toDateOnly(value: Date | string) {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function expandDateRange(start: string, end: string) {
  const result: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  while (cursor <= endDate) {
    result.push(toDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function buildUserMap(members: EscalaMembro[]) {
  const map = new Map<string, EscalaMembro>();
  members.forEach((member) => {
    map.set(member.user_id, member);
  });
  return map;
}

type EscalaRegistroCombinado = ReturnType<typeof buildCombinedRegistros>[number];

function filterRegistrosByActiveMembers(registros: EscalaRegistroCombinado[], members: EscalaMembro[]) {
  const activeMemberIds = new Set(members.map((member) => member.user_id));
  return registros.filter((registro) => activeMemberIds.has(registro.user_id));
}

function isWeekend(date: string) {
  const day = new Date(`${date}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

function getIsoWeekday(date: string) {
  const day = new Date(`${date}T00:00:00`).getDay();
  return day === 0 ? 7 : day;
}

function rotinaKey(userId: string, date: string, tipo: string) {
  return `${userId}:${date}:${tipo}`;
}

function buildCombinedRegistros(params: {
  start: string;
  end: string;
  registros: EscalaRegistroDia[];
  rotinas: EscalaRotinaSemanal[];
  excecoes?: EscalaRotinaExcecao[];
  institucionalDates?: Set<string>;
}) {
  const { start, end, registros, rotinas, excecoes = [], institucionalDates = new Set<string>() } = params;
  const map = new Map<string, { user_id: string; data: string; tipo: 'presencial' | 'extraordinario'; origem: 'manual' | 'rotina' }>();
  const excecaoSet = new Set(excecoes.map((item) => rotinaKey(item.user_id, item.data, item.tipo)));

  rotinas.forEach((rotina) => {
    if (!rotina.ativo) return;
    expandDateRange(start, end).forEach((date) => {
      if (getIsoWeekday(date) !== rotina.dia_semana) return;
      if (date < rotina.data_inicio) return;
      if (rotina.data_fim && date > rotina.data_fim) return;
      if (excecaoSet.has(rotinaKey(rotina.user_id, date, rotina.tipo))) return;
      if (rotina.tipo === 'presencial' && institucionalDates.has(date)) return;
      map.set(rotinaKey(rotina.user_id, date, rotina.tipo), {
        user_id: rotina.user_id,
        data: date,
        tipo: rotina.tipo,
        origem: 'rotina',
      });
    });
  });

  registros.forEach((registro) => {
    map.set(rotinaKey(registro.user_id, registro.data, registro.tipo), {
      user_id: registro.user_id,
      data: registro.data,
      tipo: registro.tipo,
      origem: 'manual',
    });
  });

  return Array.from(map.values());
}

function mergeMemberWithOrigem(member: EscalaMembro | undefined, origem: 'manual' | 'rotina') {
  if (!member) return null;
  return {
    ...member,
    origemEscala: origem,
  } as EscalaMembro;
}

function buildAfastamentoDateUserSet(afastamentos: EscalaAfastamento[]) {
  const set = new Set<string>();
  afastamentos.forEach((afastamento) => {
    expandDateRange(afastamento.data_inicio, afastamento.data_fim).forEach((date) => {
      set.add(`${afastamento.user_id}:${date}`);
    });
  });
  return set;
}

function buildInstitucionalDateSet(eventos: EscalaEventoInstitucional[]) {
  const set = new Set<string>();
  eventos.forEach((evento) => {
    expandDateRange(evento.data_inicio, evento.data_fim).forEach((date) => {
      set.add(date);
    });
  });
  return set;
}

async function rollbackRotinaExcecao(excecaoId: string) {
  const { error } = await supabase
    .from('escala_rotinas_excecoes')
    .delete()
    .eq('id', excecaoId);
  if (error) {
    console.error('Erro ao desfazer exceção de rotina após falha:', error);
  }
}

async function logAudit(params: {
  calendarioId: string;
  atorUserId: string;
  entidade: string;
  entidadeId: string;
  acao: string;
  resumo: string;
  payload?: Record<string, unknown>;
}) {
  const { calendarioId, atorUserId, entidade, entidadeId, acao, resumo, payload } = params;
  const { error } = await supabase
    .from('escala_auditoria')
    .insert({
      calendario_id: calendarioId,
      ator_user_id: atorUserId,
      entidade,
      entidade_id: entidadeId,
      acao,
      resumo,
      payload: payload ?? {},
    });

  if (error) {
    console.error('Erro ao registrar auditoria da escala:', error);
  }
}

async function syncCalendarioMembros(calendarioId: string): Promise<void> {
  const { data: calendarioEquipes, error: calendarioEquipesError } = await supabase
    .from('escala_calendario_equipes')
    .select('equipe_id')
    .eq('calendario_id', calendarioId);
  if (calendarioEquipesError) throw calendarioEquipesError;

  const equipeIds = Array.from(new Set((calendarioEquipes ?? []).map((item) => item.equipe_id).filter(Boolean)));
  if (equipeIds.length === 0) return;

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id')
    .in('equipe_id', equipeIds)
    .or('ativo.is.null,ativo.eq.true');
  if (usersError) throw usersError;

  const eligibleUserIds = new Set((users ?? []).map((user) => user.id));

  const { data: existingMembers, error: existingMembersError } = await supabase
    .from('escala_calendario_membros')
    .select('id, user_id, ativo')
    .eq('calendario_id', calendarioId);
  if (existingMembersError) throw existingMembersError;

  const existingByUserId = new Map((existingMembers ?? []).map((member) => [member.user_id, member]));

  const missingUsers = (users ?? []).filter((user) => !existingByUserId.has(user.id));
  if (missingUsers.length > 0) {
    const { error: insertMembersError } = await supabase
      .from('escala_calendario_membros')
      .insert(
        missingUsers.map((user) => ({
          calendario_id: calendarioId,
          user_id: user.id,
          turno: DEFAULT_TURNO,
          ativo: true,
        })),
      );
    if (insertMembersError) throw insertMembersError;
  }

  const membersToReactivate = (existingMembers ?? [])
    .filter((member) => eligibleUserIds.has(member.user_id) && member.ativo === false)
    .map((member) => member.id);
  if (membersToReactivate.length > 0) {
    const { error: reactivateError } = await supabase
      .from('escala_calendario_membros')
      .update({ ativo: true })
      .in('id', membersToReactivate);
    if (reactivateError) throw reactivateError;
  }

  const membersToDeactivate = (existingMembers ?? [])
    .filter((member) => !eligibleUserIds.has(member.user_id) && member.ativo !== false)
    .map((member) => member.id);
  if (membersToDeactivate.length > 0) {
    const { error: deactivateError } = await supabase
      .from('escala_calendario_membros')
      .update({ ativo: false })
      .in('id', membersToDeactivate);
    if (deactivateError) throw deactivateError;
  }
}

export const escalaService = {
  async getCalendarioByEquipe(equipeId: string): Promise<EscalaCalendario | null> {
    const query = supabase
      .from('escala_calendario_equipes')
      .select('calendario:escala_calendarios!inner(*)')
      .eq('equipe_id', equipeId)
      .eq('calendario.ativo', true)
      .limit(1)
      .maybeSingle();

    const { data, error } = await query;
    if (error) throw error;
    const calendario = data?.calendario;
    if (!calendario || Array.isArray(calendario)) return null;
    return calendario as EscalaCalendario;
  },

  async createCalendario(input: CriarEscalaCalendarioInput): Promise<EscalaCalendario> {
    const { nome, equipeId, userId } = input;

    const existing = await this.getCalendarioByEquipe(equipeId);
    if (existing) return existing;

    const calendarioId = crypto.randomUUID();
    const technicalName = formatCalendarTechnicalName(nome);

    const { error: insertError } = await supabase
      .from('escala_calendarios')
      .insert({
        id: calendarioId,
        nome: technicalName,
        grupo_compartilhamento: null,
        criado_por: userId,
      });

    if (insertError) throw insertError;

    const equipesToLink = [equipeId];
    const { error: linksError } = await supabase
      .from('escala_calendario_equipes')
      .insert(equipesToLink.map((teamId) => ({ calendario_id: calendarioId, equipe_id: teamId })));
    if (linksError) throw linksError;

    const { data: calendario, error: calendarioError } = await supabase
      .from('escala_calendarios')
      .select('*')
      .eq('id', calendarioId)
      .single();
    if (calendarioError) throw calendarioError;

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .in('equipe_id', equipesToLink)
      .or('ativo.is.null,ativo.eq.true');
    if (usersError) throw usersError;

    if ((users ?? []).length > 0) {
      const { error: membersError } = await supabase
        .from('escala_calendario_membros')
        .upsert(
          (users ?? []).map((user) => ({
            calendario_id: calendarioId,
            user_id: user.id,
            turno: DEFAULT_TURNO,
            ativo: true,
          })),
          { onConflict: 'calendario_id,user_id' },
        );
      if (membersError) throw membersError;
    }

    await logAudit({
      calendarioId,
      atorUserId: userId,
      entidade: 'calendario',
      entidadeId: calendarioId,
      acao: 'create',
      resumo: `Calendário "${calendario.nome}" criado.`,
      payload: {
        nome: calendario.nome,
        grupo_compartilhamento: calendario.grupo_compartilhamento,
        equipes_vinculadas: equipesToLink,
      },
    });

    return calendario as EscalaCalendario;
  },

  async deactivateCalendario(calendarioId: string, atorUserId: string): Promise<void> {
    const { data: before, error: beforeError } = await supabase
      .from('escala_calendarios')
      .select('*')
      .eq('id', calendarioId)
      .single();
    if (beforeError) throw beforeError;

    const { error } = await supabase
      .from('escala_calendarios')
      .update({ ativo: false, desativado_em: new Date().toISOString() })
      .eq('id', calendarioId);
    if (error) throw error;

    await logAudit({
      calendarioId,
      atorUserId,
      entidade: 'calendario',
      entidadeId: calendarioId,
      acao: 'deactivate',
      resumo: `Calendário "${before.nome}" desativado.`,
      payload: {
        nome: before.nome,
        grupo_compartilhamento: before.grupo_compartilhamento,
        ativo_anterior: before.ativo,
        ativo_novo: false,
        desativado_em: new Date().toISOString(),
      },
    });
  },

  async listInactiveCalendariosByEquipe(equipeId: string): Promise<EscalaCalendario[]> {
    const equipeIds = [equipeId];
    const { data, error } = await supabase
      .from('escala_calendario_equipes')
      .select('calendario:escala_calendarios!inner(*)')
      .in('equipe_id', equipeIds)
      .eq('calendario.ativo', false)
      .order('created_at', { ascending: false, referencedTable: 'escala_calendarios' });
    if (error) throw error;

    const map = new Map<string, EscalaCalendario>();
    (data ?? []).forEach((item) => {
      const calendario = item.calendario as EscalaCalendario | EscalaCalendario[] | null | undefined;
      if (!calendario || Array.isArray(calendario)) return;
      map.set(calendario.id, calendario);
    });
    return Array.from(map.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async reactivateCalendario(calendarioId: string, atorUserId: string): Promise<EscalaCalendario> {
    const { data: before, error: beforeError } = await supabase
      .from('escala_calendarios')
      .select('*')
      .eq('id', calendarioId)
      .single();
    if (beforeError) throw beforeError;

    const { data: updated, error } = await supabase
      .from('escala_calendarios')
      .update({ ativo: true, desativado_em: null })
      .eq('id', calendarioId)
      .select('*')
      .single();
    if (error) throw error;

    await logAudit({
      calendarioId,
      atorUserId,
      entidade: 'calendario',
      entidadeId: calendarioId,
      acao: 'reactivate',
      resumo: `Calendário "${before.nome}" reativado.`,
      payload: {
        nome: before.nome,
        grupo_compartilhamento: before.grupo_compartilhamento,
        ativo_anterior: before.ativo,
        ativo_novo: true,
      },
    });

    return updated as EscalaCalendario;
  },

  async getMembros(calendarioId: string): Promise<EscalaMembro[]> {
    await syncCalendarioMembros(calendarioId);

    const { data, error } = await supabase
      .from('escala_calendario_membros')
      .select('*, user:users(id, nome, email, equipe_id)')
      .eq('calendario_id', calendarioId)
      .eq('ativo', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as EscalaMembro[];
  },

  async getEquipeNamesByIds(equipeIds: string[]): Promise<Record<string, string>> {
    const uniqueIds = Array.from(new Set(equipeIds.filter(Boolean)));
    if (uniqueIds.length === 0) return {};

    const { data, error } = await supabase
      .from('equipes')
      .select('id, nome')
      .in('id', uniqueIds);

    if (error) throw error;

    return (data ?? []).reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.nome;
      return acc;
    }, {});
  },

  async listAuditoria(calendarioId: string, limit = 30): Promise<EscalaAuditoriaItem[]> {
    const { data, error } = await supabase
      .from('escala_auditoria')
      .select('*, ator_user:users(id, nome, email)')
      .eq('calendario_id', calendarioId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as EscalaAuditoriaItem[];
  },

  async updateTurnoMembro(membroId: string, turno: EscalaTurno, atorUserId: string): Promise<EscalaMembro> {
    const { data: before, error: beforeError } = await supabase
      .from('escala_calendario_membros')
      .select('id, calendario_id, user_id, turno')
      .eq('id', membroId)
      .single();
    if (beforeError) throw beforeError;

    const { data, error } = await supabase
      .from('escala_calendario_membros')
      .update({ turno })
      .eq('id', membroId)
      .select('*, user:users(id, nome, email, equipe_id)')
      .single();
    if (error) throw error;

    await logAudit({
      calendarioId: before.calendario_id,
      atorUserId,
      entidade: 'membro',
      entidadeId: data.id,
      acao: 'update_turno',
      resumo: `Turno atualizado para ${turno}.`,
      payload: {
        user_id: before.user_id,
        turno_anterior: before.turno,
        turno_novo: turno,
      },
    });

    return data as EscalaMembro;
  },

  async listAfastamentos(calendarioId: string): Promise<EscalaAfastamento[]> {
    const { data, error } = await supabase
      .from('escala_afastamentos')
      .select('*, user:users!escala_afastamentos_user_id_fkey(id, nome, email)')
      .eq('calendario_id', calendarioId)
      .order('data_inicio', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as EscalaAfastamento[];
  },

  async listRotinasSemanais(calendarioId: string): Promise<EscalaRotinaSemanal[]> {
    const { data, error } = await supabase
      .from('escala_rotinas_semanais')
      .select('*, user:users!escala_rotinas_semanais_user_id_fkey(id, nome, email, equipe_id)')
      .eq('calendario_id', calendarioId)
      .order('dia_semana', { ascending: true })
      .order('data_inicio', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as EscalaRotinaSemanal[];
  },

  async createRotinaSemanal(params: {
    calendarioId: string;
    userId: string;
    tipo: EscalaRotinaSemanalTipo;
    diaSemana: number;
    dataInicio: string;
    dataFim?: string | null;
    criadoPor: string;
  }): Promise<EscalaRotinaSemanal> {
    const { calendarioId, userId, tipo, diaSemana, dataInicio, dataFim, criadoPor } = params;

    if (tipo !== 'presencial') {
      throw new Error('No momento, a rotina semanal suporta apenas trabalho presencial.');
    }
    if (diaSemana < 1 || diaSemana > 5) {
      throw new Error('A rotina semanal de presencial deve ser registrada entre segunda e sexta.');
    }
    if (dataFim && dataFim < dataInicio) {
      throw new Error('A data final não pode ser anterior à data inicial.');
    }

    const { data: membro, error: memberError } = await supabase
      .from('escala_calendario_membros')
      .select('id')
      .eq('calendario_id', calendarioId)
      .eq('user_id', userId)
      .eq('ativo', true)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!membro) {
      throw new Error('Este usuário não participa do calendário atual.');
    }

    const { data, error } = await supabase
      .from('escala_rotinas_semanais')
      .insert({
        calendario_id: calendarioId,
        user_id: userId,
        tipo,
        dia_semana: diaSemana,
        data_inicio: dataInicio,
        data_fim: dataFim ?? null,
        ativo: true,
        criado_por: criadoPor,
      })
      .select('*, user:users!escala_rotinas_semanais_user_id_fkey(id, nome, email, equipe_id)')
      .single();
    if (error) throw error;

    await logAudit({
      calendarioId,
      atorUserId: criadoPor,
      entidade: 'rotina_semanal',
      entidadeId: data.id,
      acao: 'create',
      resumo: `Rotina semanal de ${tipo} criada para o dia ${diaSemana}.`,
      payload: {
        user_id: userId,
        tipo,
        dia_semana: diaSemana,
        data_inicio: dataInicio,
        data_fim: dataFim ?? null,
      },
    });

    return data as EscalaRotinaSemanal;
  },

  async createRotinaExcecao(params: {
    calendarioId: string;
    userId: string;
    data: string;
    tipo: 'presencial' | 'extraordinario';
    criadoPor: string;
  }): Promise<EscalaRotinaExcecao> {
    const { calendarioId, userId, data, tipo, criadoPor } = params;

    const { data: created, error } = await supabase
      .from('escala_rotinas_excecoes')
      .insert({
        calendario_id: calendarioId,
        user_id: userId,
        data,
        tipo,
        criado_por: criadoPor,
      })
      .select('*')
      .single();
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new Error('Essa exceção já foi registrada para esse usuário nesse dia.');
      }
      throw error;
    }

    await logAudit({
      calendarioId,
      atorUserId: criadoPor,
      entidade: 'rotina_excecao',
      entidadeId: created.id,
      acao: 'create',
      resumo: `Ocorrência de rotina removida de ${data}.`,
      payload: {
        user_id: userId,
        data,
        tipo,
      },
    });

    return created as EscalaRotinaExcecao;
  },

  async moverOcorrenciaRotina(params: {
    calendarioId: string;
    userId: string;
    dataOrigem: string;
    dataDestino: string;
    tipoOrigem: 'presencial' | 'extraordinario';
    tipoDestino: 'presencial' | 'extraordinario';
    criadoPor: string;
  }): Promise<void> {
    const { calendarioId, userId, dataOrigem, dataDestino, tipoOrigem, tipoDestino, criadoPor } = params;

    await this.validateRegistroDia({
      calendarioId,
      userId,
      data: dataDestino,
      tipo: tipoDestino,
    });

    const excecao = await this.createRotinaExcecao({
      calendarioId,
      userId,
      data: dataOrigem,
      tipo: tipoOrigem,
      criadoPor,
    });

    try {
      await this.createRegistroDia({
        calendarioId,
        userId,
        data: dataDestino,
        tipo: tipoDestino,
        criadoPor,
      });
    } catch (error) {
      await rollbackRotinaExcecao(excecao.id);
      throw error;
    }
  },

  async deleteRotinaSemanal(rotinaId: string, atorUserId: string): Promise<void> {
    const { data: before, error: beforeError } = await supabase
      .from('escala_rotinas_semanais')
      .select('*')
      .eq('id', rotinaId)
      .single();
    if (beforeError) throw beforeError;

    const { error } = await supabase
      .from('escala_rotinas_semanais')
      .delete()
      .eq('id', rotinaId);
    if (error) throw error;

    await logAudit({
      calendarioId: before.calendario_id,
      atorUserId,
      entidade: 'rotina_semanal',
      entidadeId: before.id,
      acao: 'delete',
      resumo: `Rotina semanal removida para o dia ${before.dia_semana}.`,
      payload: {
        user_id: before.user_id,
        tipo: before.tipo,
        dia_semana: before.dia_semana,
        data_inicio: before.data_inicio,
        data_fim: before.data_fim,
      },
    });
  },

  async listAgendaInstitucional(): Promise<EscalaEventoInstitucional[]> {
    const { data, error } = await supabase
      .from('escala_agenda_institucional')
      .select('*')
      .order('data_inicio', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as EscalaEventoInstitucional[];
  },

  async createEventoInstitucional(params: {
    tipo: EscalaEventoInstitucionalTipo;
    titulo: string;
    descricao?: string | null;
    dataInicio: string;
    dataFim: string;
    criadoPor: string;
  }): Promise<EscalaEventoInstitucional> {
    const { tipo, titulo, descricao, dataInicio, dataFim, criadoPor } = params;
    if (!titulo.trim()) {
      throw new Error('Informe um título para o evento institucional.');
    }
    if (dataFim < dataInicio) {
      throw new Error('A data final não pode ser anterior à data inicial.');
    }

    const { data, error } = await supabase
      .from('escala_agenda_institucional')
      .insert({
        tipo,
        titulo: titulo.trim(),
        descricao: descricao?.trim() || null,
        data_inicio: dataInicio,
        data_fim: dataFim,
        criado_por: criadoPor,
      })
      .select('*')
      .single();
    if (error) throw error;

    const { data: calendarios, error: calendariosError } = await supabase
      .from('escala_calendarios')
      .select('id')
      .eq('ativo', true);
    if (calendariosError) throw calendariosError;

    await Promise.all(
      (calendarios ?? []).map((calendario) =>
        logAudit({
          calendarioId: calendario.id,
          atorUserId: criadoPor,
          entidade: 'agenda_institucional',
          entidadeId: data.id,
          acao: 'create',
          resumo: `Evento institucional "${data.titulo}" registrado.`,
          payload: {
            tipo: data.tipo,
            data_inicio: data.data_inicio,
            data_fim: data.data_fim,
          },
        }),
      ),
    );

    return data as EscalaEventoInstitucional;
  },

  async updateEventoInstitucional(params: {
    eventoId: string;
    tipo: EscalaEventoInstitucionalTipo;
    titulo: string;
    descricao?: string | null;
    dataInicio: string;
    dataFim: string;
    atualizadoPor: string;
  }): Promise<EscalaEventoInstitucional> {
    const { eventoId, tipo, titulo, descricao, dataInicio, dataFim, atualizadoPor } = params;
    if (!titulo.trim()) {
      throw new Error('Informe um título para o evento institucional.');
    }
    if (dataFim < dataInicio) {
      throw new Error('A data final não pode ser anterior à data inicial.');
    }

    const { data: before, error: beforeError } = await supabase
      .from('escala_agenda_institucional')
      .select('*')
      .eq('id', eventoId)
      .single();
    if (beforeError) throw beforeError;

    const { data, error } = await supabase
      .from('escala_agenda_institucional')
      .update({
        tipo,
        titulo: titulo.trim(),
        descricao: descricao?.trim() || null,
        data_inicio: dataInicio,
        data_fim: dataFim,
      })
      .eq('id', eventoId)
      .select('*')
      .single();
    if (error) throw error;

    const { data: calendarios, error: calendariosError } = await supabase
      .from('escala_calendarios')
      .select('id')
      .eq('ativo', true);
    if (calendariosError) throw calendariosError;

    await Promise.all(
      (calendarios ?? []).map((calendario) =>
        logAudit({
          calendarioId: calendario.id,
          atorUserId: atualizadoPor,
          entidade: 'agenda_institucional',
          entidadeId: data.id,
          acao: 'update',
          resumo: `Evento institucional "${before.titulo}" atualizado para "${data.titulo}".`,
          payload: {
            before: {
              tipo: before.tipo,
              titulo: before.titulo,
              descricao: before.descricao,
              data_inicio: before.data_inicio,
              data_fim: before.data_fim,
            },
            after: {
              tipo: data.tipo,
              titulo: data.titulo,
              descricao: data.descricao,
              data_inicio: data.data_inicio,
              data_fim: data.data_fim,
            },
          },
        }),
      ),
    );

    return data as EscalaEventoInstitucional;
  },

  async deleteEventoInstitucional(eventoId: string, atorUserId: string): Promise<void> {
    const { data: before, error: beforeError } = await supabase
      .from('escala_agenda_institucional')
      .select('*')
      .eq('id', eventoId)
      .single();
    if (beforeError) throw beforeError;

    const { error } = await supabase
      .from('escala_agenda_institucional')
      .delete()
      .eq('id', eventoId);
    if (error) throw error;

    const { data: calendarios, error: calendariosError } = await supabase
      .from('escala_calendarios')
      .select('id')
      .eq('ativo', true);
    if (calendariosError) throw calendariosError;

    await Promise.all(
      (calendarios ?? []).map((calendario) =>
        logAudit({
          calendarioId: calendario.id,
          atorUserId,
          entidade: 'agenda_institucional',
          entidadeId: before.id,
          acao: 'delete',
          resumo: `Evento institucional "${before.titulo}" removido.`,
          payload: {
            tipo: before.tipo,
            data_inicio: before.data_inicio,
            data_fim: before.data_fim,
          },
        }),
      ),
    );
  },

  async createAfastamento(params: {
    calendarioId: string;
    userId: string;
    tipo: EscalaAfastamentoTipo;
    dataInicio: string;
    dataFim: string;
    observacao?: string | null;
    criadoPor: string;
  }): Promise<EscalaAfastamento> {
    const { calendarioId, userId, tipo, dataInicio, dataFim, observacao, criadoPor } = params;

    if (dataFim < dataInicio) {
      throw new Error('A data final não pode ser anterior à data inicial.');
    }

    const { data: membro, error: memberError } = await supabase
      .from('escala_calendario_membros')
      .select('id')
      .eq('calendario_id', calendarioId)
      .eq('user_id', userId)
      .eq('ativo', true)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!membro) {
      throw new Error('Este usuário não participa do calendário atual.');
    }

    const intervalo = expandDateRange(dataInicio, dataFim);
    const { data: conflitos, error: conflitosError } = await supabase
      .from('escala_registros_dia')
      .select('data, tipo')
      .eq('calendario_id', calendarioId)
      .eq('user_id', userId)
      .in('data', intervalo);
    if (conflitosError) throw conflitosError;
    if ((conflitos ?? []).length > 0) {
      const primeiro = conflitos?.[0];
      throw new Error(`Conflito encontrado: já existe registro de ${primeiro?.tipo} em ${new Date(`${primeiro?.data}T00:00:00`).toLocaleDateString('pt-BR')}.`);
    }

    const { data, error } = await supabase
      .from('escala_afastamentos')
      .insert({
        calendario_id: calendarioId,
        user_id: userId,
        tipo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        observacao: observacao ?? null,
        criado_por: criadoPor,
      })
      .select('*, user:users!escala_afastamentos_user_id_fkey(id, nome, email)')
      .single();
    if (error) throw error;

    await logAudit({
      calendarioId,
      atorUserId: criadoPor,
      entidade: 'afastamento',
      entidadeId: data.id,
      acao: 'create',
      resumo: `${tipo} registrado para o período ${dataInicio} a ${dataFim}.`,
      payload: {
        user_id: userId,
        tipo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        observacao: observacao ?? null,
      },
    });

    return data as EscalaAfastamento;
  },

  async deleteAfastamento(afastamentoId: string, atorUserId: string): Promise<void> {
    const { data: before, error: beforeError } = await supabase
      .from('escala_afastamentos')
      .select('*')
      .eq('id', afastamentoId)
      .single();
    if (beforeError) throw beforeError;

    const { error } = await supabase
      .from('escala_afastamentos')
      .delete()
      .eq('id', afastamentoId);
    if (error) throw error;

    await logAudit({
      calendarioId: before.calendario_id,
      atorUserId,
      entidade: 'afastamento',
      entidadeId: before.id,
      acao: 'delete',
      resumo: `${before.tipo} removido do período ${before.data_inicio} a ${before.data_fim}.`,
      payload: {
        user_id: before.user_id,
        tipo: before.tipo,
        data_inicio: before.data_inicio,
        data_fim: before.data_fim,
        observacao: before.observacao,
      },
    });
  },

  async validateRegistroDia(params: {
    calendarioId: string;
    userId: string;
    data: string;
    tipo: 'presencial' | 'extraordinario';
  }): Promise<void> {
    const { calendarioId, userId, data, tipo } = params;

    const weekend = isWeekend(data);
    const { data: institucionalEventos, error: institucionalError } = await supabase
      .from('escala_agenda_institucional')
      .select('id')
      .lte('data_inicio', data)
      .gte('data_fim', data)
      .limit(1);
    if (institucionalError) throw institucionalError;
    const institutionalDay = (institucionalEventos ?? []).length > 0;

    if (tipo === 'presencial' && weekend) {
      throw new Error('Presencial só pode ser lançado de segunda a sexta.');
    }
    if (tipo === 'presencial' && institutionalDay) {
      throw new Error('Presencial não pode ser lançado em dias de agenda institucional.');
    }
    if (tipo === 'extraordinario' && !weekend && !institutionalDay) {
      throw new Error('Extraordinário só pode ser lançado em sábado, domingo ou dia de agenda institucional.');
    }

    const { data: afastamentos, error } = await supabase
      .from('escala_afastamentos')
      .select('id, tipo')
      .eq('calendario_id', calendarioId)
      .eq('user_id', userId)
      .lte('data_inicio', data)
      .gte('data_fim', data)
      .limit(1);
    if (error) throw error;
    if ((afastamentos ?? []).length > 0) {
      throw new Error('Não é possível lançar trabalho para um dia em que o usuário está afastado.');
    }

    const { data: registrosExistentes, error: registrosError } = await supabase
      .from('escala_registros_dia')
      .select('id')
      .eq('calendario_id', calendarioId)
      .eq('user_id', userId)
      .eq('data', data)
      .eq('tipo', tipo)
      .limit(1);
    if (registrosError) throw registrosError;
    if ((registrosExistentes ?? []).length > 0) {
      throw new Error('Já existe um lançamento manual desse usuário para essa data.');
    }

    const weekday = getIsoWeekday(data);
    const { data: excecoes, error: excecoesError } = await supabase
      .from('escala_rotinas_excecoes')
      .select('id')
      .eq('calendario_id', calendarioId)
      .eq('user_id', userId)
      .eq('data', data)
      .eq('tipo', tipo)
      .limit(1);
    if (excecoesError) throw excecoesError;
    const temExcecao = (excecoes ?? []).length > 0;

    if (!temExcecao) {
      const { data: rotinas, error: rotinasError } = await supabase
        .from('escala_rotinas_semanais')
        .select('id')
        .eq('calendario_id', calendarioId)
        .eq('user_id', userId)
        .eq('tipo', tipo)
        .eq('ativo', true)
        .eq('dia_semana', weekday)
        .lte('data_inicio', data)
        .or(`data_fim.is.null,data_fim.gte.${data}`)
        .limit(1);
      if (rotinasError) throw rotinasError;
      if ((rotinas ?? []).length > 0) {
        throw new Error('Esse usuário já está coberto por uma rotina ativa nessa data.');
      }
    }
  },

  async createRegistroDia(params: {
    calendarioId: string;
    userId: string;
    data: string;
    tipo: 'presencial' | 'extraordinario';
    criadoPor: string;
  }): Promise<EscalaRegistroDia> {
    const { calendarioId, userId, data, tipo, criadoPor } = params;

    await this.validateRegistroDia({ calendarioId, userId, data, tipo });

    const { data: membro, error: memberError } = await supabase
      .from('escala_calendario_membros')
      .select('id')
      .eq('calendario_id', calendarioId)
      .eq('user_id', userId)
      .eq('ativo', true)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!membro) {
      throw new Error('Este usuário não participa do calendário atual.');
    }

    const { data: created, error } = await supabase
      .from('escala_registros_dia')
      .insert({
        calendario_id: calendarioId,
        user_id: userId,
        data,
        tipo,
        criado_por: criadoPor,
      })
      .select('*')
      .single();
    if (error) throw error;

    await logAudit({
      calendarioId,
      atorUserId: criadoPor,
      entidade: 'registro_dia',
      entidadeId: created.id,
      acao: 'create',
      resumo: `${tipo} registrado para ${data}.`,
      payload: {
        user_id: userId,
        data,
        tipo,
      },
    });

    return created as EscalaRegistroDia;
  },

  async deleteRegistroDia(registroId: string, atorUserId: string): Promise<void> {
    const { data: before, error: beforeError } = await supabase
      .from('escala_registros_dia')
      .select('*')
      .eq('id', registroId)
      .single();
    if (beforeError) throw beforeError;

    const { error } = await supabase
      .from('escala_registros_dia')
      .delete()
      .eq('id', registroId);
    if (error) throw error;

    await logAudit({
      calendarioId: before.calendario_id,
      atorUserId,
      entidade: 'registro_dia',
      entidadeId: before.id,
      acao: 'delete',
      resumo: `${before.tipo} removido de ${before.data}.`,
      payload: {
        user_id: before.user_id,
        data: before.data,
        tipo: before.tipo,
      },
    });
  },

  async findRegistroDiaId(params: {
    calendarioId: string;
    userId: string;
    data: string;
    tipo: 'presencial' | 'extraordinario';
  }): Promise<string | null> {
    const { calendarioId, userId, data, tipo } = params;
    const { data: registros, error } = await supabase
      .from('escala_registros_dia')
      .select('id')
      .eq('calendario_id', calendarioId)
      .eq('user_id', userId)
      .eq('data', data)
      .eq('tipo', tipo)
      .limit(1);
    if (error) throw error;
    return registros?.[0]?.id ?? null;
  },

  async getMonthSummary(
    calendario: EscalaCalendario,
    userId: string,
    monthDate: Date,
    currentUserDisplayName = 'Você',
  ): Promise<EscalaMesResumo> {
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const start = toDateOnly(monthStart);
    const end = toDateOnly(monthEnd);

    const [members, rotinasResp, registrosResp, excecoesResp, afastamentosResp, institucionalResp, auditoriaResp] = await Promise.all([
      this.getMembros(calendario.id),
      supabase
        .from('escala_rotinas_semanais')
        .select('*')
        .eq('calendario_id', calendario.id)
        .eq('ativo', true)
        .lte('data_inicio', end)
        .or(`data_fim.is.null,data_fim.gte.${start}`),
      supabase
        .from('escala_registros_dia')
        .select('*')
        .eq('calendario_id', calendario.id)
        .gte('data', start)
        .lte('data', end),
      supabase
        .from('escala_rotinas_excecoes')
        .select('*')
        .eq('calendario_id', calendario.id)
        .gte('data', start)
        .lte('data', end),
      supabase
        .from('escala_afastamentos')
        .select('*, user:users!escala_afastamentos_user_id_fkey(id, nome, email)')
        .eq('calendario_id', calendario.id)
        .lte('data_inicio', end)
        .gte('data_fim', start),
      supabase
        .from('escala_agenda_institucional')
        .select('*')
        .lte('data_inicio', end)
        .gte('data_fim', start),
      supabase
        .from('escala_auditoria')
        .select('*, ator_user:users(id, nome, email)')
        .eq('calendario_id', calendario.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (rotinasResp.error) throw rotinasResp.error;
    if (registrosResp.error) throw registrosResp.error;
    if (excecoesResp.error) throw excecoesResp.error;
    if (afastamentosResp.error) throw afastamentosResp.error;
    if (institucionalResp.error) throw institucionalResp.error;
    if (auditoriaResp.error) throw auditoriaResp.error;

    const rotinas = (rotinasResp.data ?? []) as EscalaRotinaSemanal[];
    const registros = (registrosResp.data ?? []) as EscalaRegistroDia[];
    const excecoes = (excecoesResp.data ?? []) as EscalaRotinaExcecao[];
    const afastamentos = (afastamentosResp.data ?? []) as EscalaAfastamento[];
    const institucional = (institucionalResp.data ?? []) as EscalaEventoInstitucional[];
    const institucionalDateSet = buildInstitucionalDateSet(institucional);
    const afastamentoDateUserSet = buildAfastamentoDateUserSet(afastamentos);
    const activeMemberIds = new Set(members.map((member) => member.user_id));
    const registrosCombinados = filterRegistrosByActiveMembers(
      buildCombinedRegistros({
        start,
        end,
        registros,
        rotinas,
        excecoes,
        institucionalDates: institucionalDateSet,
      }).filter((registro) => !afastamentoDateUserSet.has(`${registro.user_id}:${registro.data}`)),
      members,
    );
    const ultimaAlteracao = (auditoriaResp.data ?? null) as EscalaAuditoriaItem | null;
    const diasPresenciaisUsuario = new Set(
      registrosCombinados
        .filter((registro) => registro.user_id === userId && registro.tipo === 'presencial')
        .map((registro) => registro.data),
    ).size;
    const diasExtraordinariosUsuario = new Set(
      registrosCombinados
        .filter((registro) => registro.user_id === userId && registro.tipo === 'extraordinario')
        .map((registro) => registro.data),
    ).size;

    const dayMap = new Map<string, EscalaDiaResumo>();
    let diasUteis = 0;
    for (let day = 1; day <= monthEnd.getDate(); day += 1) {
      const date = toDateOnly(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
      if (!isWeekend(date) && !institucionalDateSet.has(date)) {
        diasUteis += 1;
      }
      dayMap.set(date, {
        date,
        presencialCount: 0,
        extraordinarioCount: 0,
        afastamentosCount: 0,
        currentUserLabels: [],
        institucional: [],
      });
    }

    registrosCombinados.forEach((registro) => {
      const day = dayMap.get(registro.data);
      if (!day) return;
      if (registro.tipo === 'presencial') day.presencialCount += 1;
      if (registro.tipo === 'extraordinario') day.extraordinarioCount += 1;
      if (registro.user_id === userId) {
        day.currentUserLabels.push({
          tipo: registro.tipo,
          texto: currentUserDisplayName,
          destaque: true,
        });
      }
    });

    afastamentos.forEach((afastamento) => {
      if (!activeMemberIds.has(afastamento.user_id)) return;
      expandDateRange(afastamento.data_inicio, afastamento.data_fim).forEach((date) => {
        const day = dayMap.get(date);
        if (!day) return;
        day.afastamentosCount += 1;
        if (afastamento.user_id === userId) {
          const tipoLabel = afastamento.tipo === 'ferias' ? 'Férias' : afastamento.tipo === 'licenca' ? 'Licença' : 'Folga';
          day.currentUserLabels.push({
            tipo: afastamento.tipo,
            texto: `${currentUserDisplayName} · ${tipoLabel}`,
            destaque: true,
          });
        }
      });
    });

    institucional.forEach((evento) => {
      expandDateRange(evento.data_inicio, evento.data_fim).forEach((date) => {
        const day = dayMap.get(date);
        if (!day) return;
        day.institucional.push(evento);
      });
    });

    const today = new Date();
    const todayDate = toDateOnly(today);
    const nextWeekDate = toDateOnly(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7));
    const proximosAfastamentos = afastamentos
      .filter((item) => item.data_inicio >= todayDate && item.data_inicio <= nextWeekDate)
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

    return {
      calendario,
      dias: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      totais: {
        diasUteis,
        diasPresenciaisUsuario,
        diasExtraordinariosUsuario,
      },
      proximosAfastamentos,
      ultimaAlteracao,
    };
  },

  async getDayDetail(calendarioId: string, date: string): Promise<EscalaDiaDetalhe> {
    const isoWeekday = getIsoWeekday(date);

    const [members, rotinasResp, registrosResp, excecoesResp, afastamentosResp, institucionalResp] = await Promise.all([
      this.getMembros(calendarioId),
      supabase
        .from('escala_rotinas_semanais')
        .select('*')
        .eq('calendario_id', calendarioId)
        .eq('ativo', true)
        .eq('dia_semana', isoWeekday)
        .lte('data_inicio', date)
        .or(`data_fim.is.null,data_fim.gte.${date}`),
      supabase
        .from('escala_registros_dia')
        .select('*')
        .eq('calendario_id', calendarioId)
        .eq('data', date),
      supabase
        .from('escala_rotinas_excecoes')
        .select('*')
        .eq('calendario_id', calendarioId)
        .eq('data', date),
      supabase
        .from('escala_afastamentos')
        .select('*')
        .eq('calendario_id', calendarioId)
        .lte('data_inicio', date)
        .gte('data_fim', date),
      supabase
        .from('escala_agenda_institucional')
        .select('*')
        .lte('data_inicio', date)
        .gte('data_fim', date),
    ]);

    if (rotinasResp.error) throw rotinasResp.error;
    if (registrosResp.error) throw registrosResp.error;
    if (excecoesResp.error) throw excecoesResp.error;
    if (afastamentosResp.error) throw afastamentosResp.error;
    if (institucionalResp.error) throw institucionalResp.error;

    const rotinas = (rotinasResp.data ?? []) as EscalaRotinaSemanal[];
    const registros = (registrosResp.data ?? []) as EscalaRegistroDia[];
    const excecoes = (excecoesResp.data ?? []) as EscalaRotinaExcecao[];
    const afastamentos = (afastamentosResp.data ?? []) as EscalaAfastamento[];
    const institucional = (institucionalResp.data ?? []) as EscalaEventoInstitucional[];
    const institucionalDateSet = buildInstitucionalDateSet(institucional);
    const afastamentoDateUserSet = buildAfastamentoDateUserSet(afastamentos);
    const registrosCombinados = filterRegistrosByActiveMembers(
      buildCombinedRegistros({
        start: date,
        end: date,
        registros,
        rotinas,
        excecoes,
        institucionalDates: institucionalDateSet,
      }).filter((registro) => !afastamentoDateUserSet.has(`${registro.user_id}:${registro.data}`)),
      members,
    );
    const memberMap = buildUserMap(members);

    const fromCombinedRegistros = (tipo: 'presencial' | 'extraordinario') =>
      registrosCombinados
        .filter((item) => item.tipo === tipo)
        .map((item) => mergeMemberWithOrigem(memberMap.get(item.user_id), item.origem))
        .filter(Boolean) as EscalaMembro[];

    const fromUserIds = (ids: string[]) => ids
      .map((id) => memberMap.get(id))
      .filter(Boolean) as EscalaMembro[];

    return {
      date,
      presencial: fromCombinedRegistros('presencial'),
      extraordinario: fromCombinedRegistros('extraordinario'),
      ferias: fromUserIds(afastamentos.filter((item) => item.tipo === 'ferias').map((item) => item.user_id)),
      licenca: fromUserIds(afastamentos.filter((item) => item.tipo === 'licenca').map((item) => item.user_id)),
      folga: fromUserIds(afastamentos.filter((item) => item.tipo === 'folga').map((item) => item.user_id)),
      institucional,
    };
  },
};

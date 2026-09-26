import { supabase } from './supabaseClient';

export type NotificationPreferenceMode = 'all' | 'selected';

export interface NotificationPreference {
  objeto_codigo: string;
  modo: NotificationPreferenceMode;
  equipes_ids: string[];
}

export interface EquipeNotificacaoOption {
  id: string;
  nome: string;
}

export interface NotificationPreferenceDefinition {
  codigo: string;
  nome: string;
  descricao: string;
}

export const NOTIFICATION_PREFERENCE_DEFINITIONS: NotificationPreferenceDefinition[] = [
  {
    codigo: 'notificacoes.ticket_duplicado',
    nome: 'Tickets duplicados',
    descricao: 'Controla as notificacoes automaticas quando chega tentativa de inserir ticket ja existente.',
  },
  {
    codigo: 'notificacoes.tarefa_concluida',
    nome: 'Tarefas concluidas',
    descricao: 'Controla as notificacoes geradas quando uma tarefa da equipe e concluida.',
  },
  {
    codigo: 'notificacoes.anomalia_categorias',
    nome: 'Anomalias de categorias',
    descricao: 'Controla as notificacoes geradas quando a analise horaria encontra anomalias em categorias ou subcategorias.',
  },
];

export const DEFAULT_NOTIFICATION_PREFERENCES: Record<string, NotificationPreference> =
  Object.fromEntries(
    NOTIFICATION_PREFERENCE_DEFINITIONS.map((definition) => [
      definition.codigo,
      {
        objeto_codigo: definition.codigo,
        modo: 'selected' as NotificationPreferenceMode,
        equipes_ids: [],
      },
    ]),
  );

export async function fetchNotificationPreferences(): Promise<Record<string, NotificationPreference>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }

    const [{ data, error }, { data: userData }] = await Promise.all([
      supabase
        .from('notificacoes_preferencias')
        .select('objeto_codigo, modo, equipes_ids')
        .eq('user_id', user.id)
        .in('objeto_codigo', NOTIFICATION_PREFERENCE_DEFINITIONS.map((item) => item.codigo)),
      supabase
        .from('users')
        .select('equipe_id')
        .eq('id', user.id)
        .single(),
    ]);

    if (error) {
      console.error('[notificacaoPreferenciasService] Erro ao buscar preferencias:', error);
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }

    const homeEquipeId = userData?.equipe_id ?? null;
    const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES };

    if ((!data || data.length === 0) && homeEquipeId) {
      for (const definition of NOTIFICATION_PREFERENCE_DEFINITIONS) {
        merged[definition.codigo] = {
          objeto_codigo: definition.codigo,
          modo: 'selected',
          equipes_ids: [homeEquipeId],
        };
      }
      return merged;
    }

    for (const row of data || []) {
      merged[row.objeto_codigo] = {
        objeto_codigo: row.objeto_codigo,
        modo: row.modo === 'selected' ? 'selected' : 'all',
        equipes_ids: Array.isArray(row.equipes_ids) ? row.equipes_ids.filter(Boolean) : [],
      };
    }

    return merged;
  } catch (err) {
    console.error('[notificacaoPreferenciasService] Erro inesperado ao buscar preferencias:', err);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

export async function fetchEquipesNotificacaoOptions(): Promise<EquipeNotificacaoOption[]> {
  try {
    const { data, error } = await supabase
      .from('equipes')
      .select('id, nome')
      .order('nome');

    if (error) {
      console.error('[notificacaoPreferenciasService] Erro ao listar equipes:', error);
      return [];
    }

    return (data || []).map((row) => ({ id: row.id, nome: row.nome }));
  } catch (err) {
    console.error('[notificacaoPreferenciasService] Erro inesperado ao listar equipes:', err);
    return [];
  }
}

export async function saveNotificationPreference(
  preference: NotificationPreference,
): Promise<NotificationPreference> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Usuario nao autenticado');
  }

  const payload = {
    user_id: user.id,
    objeto_codigo: preference.objeto_codigo,
    modo: preference.modo,
    equipes_ids: preference.modo === 'selected' ? preference.equipes_ids : [],
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('notificacoes_preferencias')
    .upsert(payload, { onConflict: 'user_id,objeto_codigo' })
    .select('objeto_codigo, modo, equipes_ids')
    .single();

  if (error) {
    console.error('[notificacaoPreferenciasService] Erro ao salvar preferencia:', error);
    throw error;
  }

  return {
    objeto_codigo: data.objeto_codigo,
    modo: data.modo === 'selected' ? 'selected' : 'all',
    equipes_ids: Array.isArray(data.equipes_ids) ? data.equipes_ids.filter(Boolean) : [],
  };
}

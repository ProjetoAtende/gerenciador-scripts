// src/services/userPreferencesService.ts
import { supabase } from './supabaseClient';

export interface UserPreferences {
  dark_mode: boolean;
  open_cards_in_new_tab: boolean;
  gamificacao_avatar_id: string | null;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  dark_mode: false,
  open_cards_in_new_tab: false,
  gamificacao_avatar_id: null,
};

function normalizePreferences(data: Partial<UserPreferences> | null | undefined): UserPreferences {
  return {
    dark_mode: data?.dark_mode ?? DEFAULT_PREFERENCES.dark_mode,
    open_cards_in_new_tab: data?.open_cards_in_new_tab ?? DEFAULT_PREFERENCES.open_cards_in_new_tab,
    gamificacao_avatar_id:
      typeof data?.gamificacao_avatar_id === 'string'
        ? data.gamificacao_avatar_id
        : DEFAULT_PREFERENCES.gamificacao_avatar_id,
  };
}

/**
 * Busca as preferências do usuário autenticado na tabela user_preferences.
 * Se não encontrar registro, retorna os defaults.
 */
export async function fetchUserPreferences(userId?: string | null): Promise<UserPreferences> {
  try {
    if (!userId) {
      console.warn('[userPreferencesService] Usuário não autenticado, retornando defaults');
      return { ...DEFAULT_PREFERENCES };
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('dark_mode, open_cards_in_new_tab, gamificacao_avatar_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[userPreferencesService] Erro ao buscar preferências:', error);
      return { ...DEFAULT_PREFERENCES };
    }

    return normalizePreferences(data);
  } catch (err) {
    console.error('[userPreferencesService] Erro inesperado ao buscar preferências:', err);
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Persiste as preferências do usuário via RPC upsert_user_preferences.
 * Retorna as preferências atualizadas.
 */
export async function saveUserPreferences(
  prefs: UserPreferences,
  userId?: string | null,
): Promise<UserPreferences> {
  try {
    if (!userId) {
      console.warn('[userPreferencesService] Usuário não autenticado, mantendo preferências apenas em memória');
      return { ...prefs };
    }

    const { data, error } = await supabase.rpc('upsert_user_preferences', {
      p_dark_mode: prefs.dark_mode,
      p_open_cards_in_new_tab: prefs.open_cards_in_new_tab,
      p_gamificacao_avatar_id: prefs.gamificacao_avatar_id,
    });

    if (error) {
      console.error('[userPreferencesService] Erro ao salvar preferências:', error);
      return { ...prefs };
    }

    // A RPC retorna o registro atualizado
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return normalizePreferences(data as Partial<UserPreferences>);
    }

    return { ...prefs };
  } catch (err) {
    console.error('[userPreferencesService] Erro inesperado ao salvar preferências:', err);
    return { ...prefs };
  }
}

/**
 * Atualiza apenas o avatar da Arena para o usuário informado.
 * O backend valida se o ator pode editar o alvo.
 */
export async function saveGamificacaoAvatarForUser(
  targetUserId: string,
  avatarId: string | null,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('definir_avatar_gamificacao_usuario', {
      p_target_user_id: targetUserId,
      p_gamificacao_avatar_id: avatarId,
    });

    if (error) {
      console.error('[userPreferencesService] Erro ao salvar avatar de outro usuário:', error);
      throw error;
    }

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const normalized = normalizePreferences(data as Partial<UserPreferences>);
      return normalized.gamificacao_avatar_id;
    }

    return avatarId;
  } catch (err) {
    console.error('[userPreferencesService] Erro inesperado ao salvar avatar de outro usuário:', err);
    throw err;
  }
}

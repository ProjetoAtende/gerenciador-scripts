// src/contexts/SettingsContext.tsx
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  UserPreferences,
  DEFAULT_PREFERENCES,
  fetchUserPreferences,
  saveUserPreferences,
} from '../services/userPreferencesService';

const STORAGE_KEY = 'user-preferences';

interface SettingsContextType {
  darkMode: boolean;
  openCardsInNewTab: boolean;
  gamificacaoAvatarId: string | null;
  loading: boolean;
  toggleDarkMode: () => void;
  toggleOpenCardsInNewTab: () => void;
  setGamificacaoAvatarId: (avatarId: string | null) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

/**
 * Lê o cache local do localStorage.
 */
function readLocalCache(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        dark_mode: parsed.dark_mode ?? DEFAULT_PREFERENCES.dark_mode,
        open_cards_in_new_tab: parsed.open_cards_in_new_tab ?? DEFAULT_PREFERENCES.open_cards_in_new_tab,
        gamificacao_avatar_id:
          typeof parsed.gamificacao_avatar_id === 'string' ? parsed.gamificacao_avatar_id : DEFAULT_PREFERENCES.gamificacao_avatar_id,
      };
    }
  } catch {
    // Cache corrompido — ignora
  }
  return { ...DEFAULT_PREFERENCES };
}

/**
 * Salva no cache local do localStorage.
 */
function writeLocalCache(prefs: UserPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage cheio ou indisponível — ignora
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const [darkMode, setDarkMode] = useState<boolean>(() => readLocalCache().dark_mode);
  const [openCardsInNewTab, setOpenCardsInNewTab] = useState<boolean>(() => readLocalCache().open_cards_in_new_tab);
  const [gamificacaoAvatarId, setGamificacaoAvatarIdState] = useState<string | null>(() => readLocalCache().gamificacao_avatar_id);
  const [loading, setLoading] = useState(true);

  // Aplica/remove classe `dark` no <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Carrega preferências do banco quando o usuário autentica
  useEffect(() => {
    if (!user) {
      // Se a auth ainda está resolvendo a sessão, não faz nada.
      // Respeita o cache do localStorage para evitar flash de tema claro.
      if (authLoading) return;

      // Auth já resolveu e não há usuário (logout real) — reseta para defaults
      setDarkMode(DEFAULT_PREFERENCES.dark_mode);
      setOpenCardsInNewTab(DEFAULT_PREFERENCES.open_cards_in_new_tab);
      setGamificacaoAvatarIdState(DEFAULT_PREFERENCES.gamificacao_avatar_id);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const userId = user.id;

    async function loadFromDB() {
      setLoading(true);
      const prefs = await fetchUserPreferences(userId);
      if (!cancelled) {
        setDarkMode(prefs.dark_mode);
        setOpenCardsInNewTab(prefs.open_cards_in_new_tab);
        setGamificacaoAvatarIdState(prefs.gamificacao_avatar_id);
        writeLocalCache(prefs);
        setLoading(false);
      }
    }

    loadFromDB();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      const newPrefs: UserPreferences = {
        dark_mode: next,
        open_cards_in_new_tab: openCardsInNewTab,
        gamificacao_avatar_id: gamificacaoAvatarId,
      };
      // Atualiza cache local imediatamente
      writeLocalCache(newPrefs);
      // Salva no banco em background (sem bloquear UI)
      saveUserPreferences(newPrefs, user?.id).catch((err) => {
        console.error('[SettingsContext] Falha ao salvar dark_mode no banco:', err);
      });
      return next;
    });
  }, [gamificacaoAvatarId, openCardsInNewTab, user?.id]);

  const toggleOpenCardsInNewTab = useCallback(() => {
    setOpenCardsInNewTab((prev) => {
      const next = !prev;
      const newPrefs: UserPreferences = {
        dark_mode: darkMode,
        open_cards_in_new_tab: next,
        gamificacao_avatar_id: gamificacaoAvatarId,
      };
      // Atualiza cache local imediatamente
      writeLocalCache(newPrefs);
      // Salva no banco em background (sem bloquear UI)
      saveUserPreferences(newPrefs, user?.id).catch((err) => {
        console.error('[SettingsContext] Falha ao salvar open_cards_in_new_tab no banco:', err);
      });
      return next;
    });
  }, [darkMode, gamificacaoAvatarId, user?.id]);

  const setGamificacaoAvatarId = useCallback(async (avatarId: string | null) => {
    const optimisticPrefs: UserPreferences = {
      dark_mode: darkMode,
      open_cards_in_new_tab: openCardsInNewTab,
      gamificacao_avatar_id: avatarId,
    };

    setGamificacaoAvatarIdState(avatarId);
    writeLocalCache(optimisticPrefs);

    try {
      const savedPrefs = await saveUserPreferences(optimisticPrefs, user?.id);
      setDarkMode(savedPrefs.dark_mode);
      setOpenCardsInNewTab(savedPrefs.open_cards_in_new_tab);
      setGamificacaoAvatarIdState(savedPrefs.gamificacao_avatar_id);
      writeLocalCache(savedPrefs);
    } catch (err) {
      console.error('[SettingsContext] Falha ao salvar gamificacao_avatar_id no banco:', err);
    }
  }, [darkMode, openCardsInNewTab, user?.id]);

  return (
    <SettingsContext.Provider
      value={{
        darkMode,
        openCardsInNewTab,
        gamificacaoAvatarId,
        loading,
        toggleDarkMode,
        toggleOpenCardsInNewTab,
        setGamificacaoAvatarId,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings deve ser usado dentro de um SettingsProvider');
  }
  return context;
}

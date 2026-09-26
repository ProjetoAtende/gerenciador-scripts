import { useEffect, useState, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { useEffectiveAuth } from './useEffectiveAuth';
import { useIdleDetection } from './useIdleDetection';

interface PresenceUser {
  user_id: string;
  username: string;
  equipe_id: string;
  online_at: number;
  status: 'online' | 'idle' | 'away';
}

type PresenceListener = (state: {
  onlineUsers: PresenceUser[];
  isConnected: boolean;
  userStatus: 'online' | 'idle' | 'away';
}) => void;

/**
 * Singleton de presença em escopo de módulo.
 * Garante que existe apenas UM canal Realtime de presença por aba do navegador,
 * mesmo que múltiplos componentes (PresenceManager, TeamStatusWidget) chamem
 * `useRealtimePresence()` simultaneamente.
 */
const presenceSingleton = (() => {
  let channel: RealtimeChannel | null = null;
  let currentUserId: string | null = null;
  let currentEquipeId: string | null = null;
  let currentEmail: string | null = null;
  let userStatus: 'online' | 'idle' | 'away' = 'online';
  let onlineUsers: PresenceUser[] = [];
  let isConnected = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let isConnecting = false;
  let listenersAttached = false;

  const listeners = new Set<PresenceListener>();

  const notify = () => {
    const snapshot = { onlineUsers, isConnected, userStatus };
    listeners.forEach((l) => {
      try { l(snapshot); } catch { /* ignore */ }
    });
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (!currentUserId || !currentEquipeId) return;
    clearReconnectTimer();
    // Backoff exponencial limitado: 1s, 2s, 4s, 8s, 16s, 30s (cap)
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30_000);
    reconnectAttempts += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  };

  const teardownChannel = async () => {
    if (!channel) return;
    const ch = channel;
    channel = null;
    isConnected = false;
    try { await ch.untrack(); } catch { /* ignore */ }
    try { await ch.unsubscribe(); } catch { /* ignore */ }
    try { await supabase.removeChannel(ch); } catch { /* ignore */ }
  };

  const handlePresenceSync = (state: Record<string, unknown[]>) => {
    const users: PresenceUser[] = [];
    Object.keys(state).forEach((key) => {
      const presences = state[key];
      if (presences && presences.length > 0) {
        users.push(presences[0] as PresenceUser);
      }
    });
    onlineUsers = users;
    notify();
  };

  const connect = async (): Promise<void> => {
    if (!currentUserId || !currentEquipeId) return;
    if (isConnecting) return;
    if (channel) return; // já existe canal ativo

    isConnecting = true;
    try {
      const newChannel = supabase.channel('team-presence', {
        config: { presence: { key: currentUserId } },
      });

      newChannel.on('presence', { event: 'sync' }, () => {
        handlePresenceSync(newChannel.presenceState() as Record<string, unknown[]>);
      });

      newChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          reconnectAttempts = 0;
          try {
            await newChannel.track({
              user_id: currentUserId!,
              username: currentEmail || 'Usuário',
              equipe_id: currentEquipeId!,
              online_at: Date.now(),
              status: userStatus,
            });
          } catch (err) {
            console.error('[Presence] Erro ao registrar track:', err);
          }
          isConnected = true;
          notify();
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          isConnected = false;
          notify();
          // Limpa o canal morto e agenda reconexão
          await teardownChannel();
          if (currentUserId && currentEquipeId) {
            scheduleReconnect();
          }
        }
      });

      channel = newChannel;
    } catch (err) {
      console.error('[Presence] Falha ao criar canal:', err);
      await teardownChannel();
      scheduleReconnect();
    } finally {
      isConnecting = false;
    }
  };

  const setIdentity = (
    userId: string | null,
    equipeId: string | null,
    email: string | null,
  ) => {
    const changed = userId !== currentUserId || equipeId !== currentEquipeId;
    currentUserId = userId;
    currentEquipeId = equipeId;
    currentEmail = email;

    if (!userId || !equipeId) {
      // Logout / equipe não selecionada → desconectar
      clearReconnectTimer();
      reconnectAttempts = 0;
      void teardownChannel().then(() => {
        onlineUsers = [];
        notify();
      });
      return;
    }

    if (changed) {
      // Identidade mudou → reconectar do zero
      clearReconnectTimer();
      reconnectAttempts = 0;
      void teardownChannel().then(() => {
        void connect();
      });
    } else if (!channel && !isConnecting) {
      void connect();
    }
  };

  const updateStatus = async (status: 'online' | 'idle' | 'away') => {
    userStatus = status;
    if (channel && currentUserId && currentEquipeId) {
      try {
        await channel.track({
          user_id: currentUserId,
          username: currentEmail || 'Usuário',
          equipe_id: currentEquipeId,
          online_at: Date.now(),
          status,
        });
      } catch (err) {
        console.error('[Presence] Erro ao atualizar status:', err);
      }
    }
    notify();
  };

  const forceReconnect = () => {
    if (!currentUserId || !currentEquipeId) return;
    clearReconnectTimer();
    reconnectAttempts = 0;
    void teardownChannel().then(() => connect());
  };

  const disconnect = async () => {
    clearReconnectTimer();
    reconnectAttempts = 0;
    await teardownChannel();
    onlineUsers = [];
    notify();
  };

  const disconnectForLogout = async () => {
    currentUserId = null;
    currentEquipeId = null;
    currentEmail = null;
    userStatus = 'online';
    await disconnect();
  };

  const subscribe = (listener: PresenceListener) => {
    listeners.add(listener);
    // Emite estado atual imediatamente
    listener({ onlineUsers, isConnected, userStatus });
    return () => {
      listeners.delete(listener);
    };
  };

  // Listeners globais (registrados uma única vez) para reconectar quando
  // a aba volta ao foco ou a rede retorna.
  const attachGlobalListeners = () => {
    if (listenersAttached || typeof window === 'undefined') return;
    listenersAttached = true;

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !isConnected && currentUserId && currentEquipeId) {
        forceReconnect();
      }
    };
    const onOnline = () => {
      if (currentUserId && currentEquipeId) forceReconnect();
    };
    const onOffline = () => {
      isConnected = false;
      notify();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  };

  return {
    setIdentity,
    updateStatus,
    forceReconnect,
    disconnect,
    disconnectForLogout,
    subscribe,
    attachGlobalListeners,
    getSnapshot: () => ({ onlineUsers, isConnected, userStatus }),
  };
})();

/**
 * Hook React que expõe o estado do singleton de presença.
 * Mantém a API pública compatível com a versão anterior.
 */
export const useRealtimePresence = () => {
  const { user, equipeId } = useEffectiveAuth();
  const initial = presenceSingleton.getSnapshot();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>(initial.onlineUsers);
  const [isConnected, setIsConnected] = useState<boolean>(initial.isConnected);
  const [userStatus, setUserStatusState] = useState<'online' | 'idle' | 'away'>(initial.userStatus);

  // Anexar listeners globais (uma vez) e inscrever-se no singleton
  useEffect(() => {
    presenceSingleton.attachGlobalListeners();
    const unsubscribe = presenceSingleton.subscribe((snap) => {
      setOnlineUsers(snap.onlineUsers);
      setIsConnected(snap.isConnected);
      setUserStatusState(snap.userStatus);
    });
    return unsubscribe;
  }, []);

  // Sincronizar identidade do usuário com o singleton
  useEffect(() => {
    presenceSingleton.setIdentity(user?.id ?? null, equipeId ?? null, user?.email ?? null);
  }, [user?.id, user?.email, equipeId]);

  // Detecção de inatividade (callback aponta para o singleton — seguro com múltiplas instâncias)
  const idleRef = useRef({ idle: false });
  useIdleDetection({
    idleTime: 5 * 60 * 1000,
    onIdle: () => {
      if (idleRef.current.idle) return;
      idleRef.current.idle = true;
      void presenceSingleton.updateStatus('away');
    },
    onActive: () => {
      if (!idleRef.current.idle) return;
      idleRef.current.idle = false;
      void presenceSingleton.updateStatus('online');
    },
  });

  const teamOnlineUsers = onlineUsers.filter((u) => u.equipe_id === equipeId);

  const updatePresenceStatus = useCallback(
    (status: 'online' | 'idle' | 'away') => presenceSingleton.updateStatus(status),
    [],
  );
  const disconnect = useCallback(() => presenceSingleton.disconnect(), []);
  const disconnectForLogout = useCallback(() => presenceSingleton.disconnectForLogout(), []);
  const reconnect = useCallback(() => presenceSingleton.forceReconnect(), []);

  // Expor função de desconexão para logout no window (compat. com AuthContext)
  useEffect(() => {
    (window as any).disconnectPresence = disconnectForLogout;
    return () => {
      if ((window as any).disconnectPresence === disconnectForLogout) {
        delete (window as any).disconnectPresence;
      }
    };
  }, [disconnectForLogout]);

  return {
    onlineUsers: teamOnlineUsers,
    allOnlineUsers: onlineUsers,
    isConnected,
    disconnect,
    disconnectForLogout,
    reconnect,
    totalOnline: teamOnlineUsers.length,
    userStatus,
    updatePresenceStatus,
  };
};

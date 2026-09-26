import { useEffect } from 'react';
import { useRealtimePresence } from '../hooks/useRealtimePresence';
import { useAuth } from '../contexts/AuthContext';

// Componente para gerenciar presença globalmente
export const PresenceManager = () => {
  const { disconnect } = useRealtimePresence();
  const { user } = useAuth();

  // Disponibilizar função de disconnect globalmente para o AuthContext
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).disconnectPresence = disconnect;
    }
  }, [disconnect]);

  // Cleanup quando usuário muda
  useEffect(() => {
    if (!user) {
      disconnect();
    }
  }, [user, disconnect]);

  return null; // Componente invisível
};
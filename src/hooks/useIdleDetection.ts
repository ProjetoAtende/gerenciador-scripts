import { useEffect, useCallback, useRef } from 'react';

interface UseIdleDetectionProps {
  idleTime?: number; // Tempo em ms para considerar idle (padrão: 5 minutos)
  onIdle: () => void; // Callback quando usuário fica idle
  onActive: () => void; // Callback quando usuário volta a ser ativo
}

export const useIdleDetection = ({ 
  idleTime = 5 * 60 * 1000, // 5 minutos padrão
  onIdle, 
  onActive 
}: UseIdleDetectionProps) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isIdleRef = useRef(false);

  const resetTimer = useCallback(() => {
    // Se estava idle e agora está ativo, chama onActive
    if (isIdleRef.current) {
      isIdleRef.current = false;
      onActive();
    }

    // Limpa timer anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Define novo timer
    timeoutRef.current = setTimeout(() => {
      if (!isIdleRef.current) {
        isIdleRef.current = true;
        onIdle();
      }
    }, idleTime);
  }, [idleTime, onIdle, onActive]);

  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    // Eventos que indicam atividade do usuário
    const events = [
      'mousedown',
      'mousemove', 
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Adiciona listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Inicia o timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleActivity, resetTimer]);

  // Função para forçar estado idle (útil para testes)
  const forceIdle = useCallback(() => {
    if (!isIdleRef.current) {
      isIdleRef.current = true;
      onIdle();
    }
  }, [onIdle]);

  // Função para forçar estado ativo
  const forceActive = useCallback(() => {
    if (isIdleRef.current) {
      isIdleRef.current = false;
      onActive();
    }
    resetTimer();
  }, [onActive, resetTimer]);

  return {
    isIdle: isIdleRef.current,
    forceIdle,
    forceActive
  };
};
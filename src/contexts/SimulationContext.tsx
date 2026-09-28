import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

export type SimulacaoRole = 'user' | 'supervisor' | 'coordenador' | 'admin';

interface SimulationState {
  setorId: string;
  equipeId: string;
  role: SimulacaoRole | '';
}

interface SimulationContextValue {
  canSimulate: boolean;
  isSimulating: boolean;
  simulation: SimulationState;
  effectiveEquipeId: string | null;
  effectiveRole: SimulacaoRole | null;
  setSetorId: (setorId: string) => void;
  setEquipeId: (equipeId: string) => void;
  setRole: (role: SimulacaoRole | '') => void;
  reset: () => void;
}

/** Reative para exibir a barra de simulação na home e afetar permissões simuladas. */
export const HOME_VISUALIZACAO_SIMULACAO_ENABLED = false;

const STORAGE_KEY = 'home-visualizacao-simulada';

const DEFAULT_STATE: SimulationState = {
  setorId: '',
  equipeId: '',
  role: '',
};

const SimulationContext = createContext<SimulationContextValue | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userRole, equipeId } = useAuth();
  const canSimulate = HOME_VISUALIZACAO_SIMULACAO_ENABLED && userRole === 'admin';
  const [simulation, setSimulation] = useState<SimulationState>(() => {
    if (typeof window === 'undefined') return DEFAULT_STATE;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_STATE;
      return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<SimulationState>) };
    } catch {
      return DEFAULT_STATE;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!canSimulate) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(simulation));
  }, [canSimulate, simulation]);

  useEffect(() => {
    if (!canSimulate) {
      setSimulation(DEFAULT_STATE);
    }
  }, [canSimulate]);

  const isSimulating = canSimulate && Boolean(simulation.equipeId || simulation.role);

  const value = useMemo<SimulationContextValue>(() => ({
    canSimulate,
    isSimulating,
    simulation,
    effectiveEquipeId: isSimulating ? (simulation.equipeId || equipeId) : equipeId,
    effectiveRole: isSimulating ? (simulation.role || userRole) : userRole,
    setSetorId: (setorId: string) => setSimulation((prev) => {
      const keepEquipe = !setorId || prev.setorId === setorId ? prev.equipeId : '';
      return { ...prev, setorId, equipeId: keepEquipe };
    }),
    setEquipeId: (simEquipeId: string) => setSimulation((prev) => ({ ...prev, equipeId: simEquipeId })),
    setRole: (role: SimulacaoRole | '') => setSimulation((prev) => ({ ...prev, role })),
    reset: () => setSimulation(DEFAULT_STATE),
  }), [canSimulate, equipeId, isSimulating, simulation, userRole]);

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
};

export function useSimulation(): SimulationContextValue {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useSimulation deve ser usado dentro de SimulationProvider');
  return context;
}

import { useAuth } from '../contexts/AuthContext';
import { useSimulation } from '../contexts/SimulationContext';

export function useEffectiveAuth() {
  const auth = useAuth();
  const simulation = useSimulation();

  return {
    ...auth,
    equipeId: simulation.effectiveEquipeId,
    userRole: simulation.effectiveRole,
    isSimulatingView: simulation.isSimulating,
    canSimulateView: simulation.canSimulate,
  };
}

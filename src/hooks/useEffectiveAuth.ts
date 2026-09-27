import { useAuth } from '../contexts/AuthContext';
import { useSimulation } from '../contexts/SimulationContext';

export function useEffectiveAuth() {
  const auth = useAuth();
  const simulation = useSimulation();

  const previewStackRole =
    simulation.canSimulate && simulation.isSimulating && simulation.simulation.role
      ? simulation.simulation.role
      : null;

  return {
    ...auth,
    equipeId: simulation.effectiveEquipeId,
    userRole: simulation.effectiveRole,
    realUserRole: auth.userRole,
    isSimulatingView: simulation.isSimulating,
    canSimulateView: simulation.canSimulate,
    previewStackRole,
  };
}

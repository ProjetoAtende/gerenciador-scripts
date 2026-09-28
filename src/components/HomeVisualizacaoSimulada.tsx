import { useEffect, useMemo, useState } from 'react';
import { listarEquipes, listarSetores, type EquipeWithSetor, type SetorWithCount } from '../services/adminService';
import { useAuth } from '../contexts/AuthContext';
import { HOME_VISUALIZACAO_SIMULACAO_ENABLED, useSimulation } from '../contexts/SimulationContext';

/**
 * Barra de simulação de visualização (setor/equipe/papel) na home.
 * Mantido no código, mas desligado por padrão via {@link HOME_VISUALIZACAO_SIMULACAO_ENABLED}.
 */
export function HomeVisualizacaoSimulada() {
  const { equipeId } = useAuth();
  const {
    canSimulate,
    isSimulating,
    simulation,
    effectiveEquipeId,
    effectiveRole,
    setSetorId: setSimulationSetorId,
    setEquipeId: setSimulationEquipeId,
    setRole: setSimulationRole,
    reset: resetSimulation,
  } = useSimulation();
  const [setoresSimulacao, setSetoresSimulacao] = useState<SetorWithCount[]>([]);
  const [equipesSimulacao, setEquipesSimulacao] = useState<EquipeWithSetor[]>([]);
  const [loadingSimulacao, setLoadingSimulacao] = useState(false);

  useEffect(() => {
    if (!HOME_VISUALIZACAO_SIMULACAO_ENABLED || !canSimulate) return;
    let cancelado = false;

    const carregarOpcoesSimulacao = async () => {
      setLoadingSimulacao(true);
      try {
        const [setores, equipes] = await Promise.all([listarSetores(), listarEquipes()]);
        if (cancelado) return;
        setSetoresSimulacao(setores);
        setEquipesSimulacao(equipes);
      } catch (error) {
        console.error('[HomeVisualizacaoSimulada] erro ao carregar opções de simulação', error);
      } finally {
        if (!cancelado) setLoadingSimulacao(false);
      }
    };

    void carregarOpcoesSimulacao();
    return () => {
      cancelado = true;
    };
  }, [canSimulate]);

  const equipesFiltradasSimulacao = useMemo(
    () =>
      simulation.setorId
        ? equipesSimulacao.filter((equipe) => equipe.setor_id === simulation.setorId)
        : equipesSimulacao,
    [equipesSimulacao, simulation.setorId],
  );

  if (!HOME_VISUALIZACAO_SIMULACAO_ENABLED || !canSimulate) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
        Visualização
      </span>
      <select
        value={simulation.setorId}
        onChange={(e) => {
          const nextSetorId = e.target.value;
          setSimulationSetorId(nextSetorId);
          if (simulation.equipeId) {
            const equipeSelecionada = equipesSimulacao.find((equipe) => equipe.id === simulation.equipeId);
            if (equipeSelecionada && nextSetorId && equipeSelecionada.setor_id !== nextSetorId) {
              setSimulationEquipeId('');
            }
          }
        }}
        disabled={loadingSimulacao}
        className="min-w-[160px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      >
        <option value="">Todos os setores</option>
        {setoresSimulacao.map((setor) => (
          <option key={setor.id} value={setor.id}>
            {setor.nome}
          </option>
        ))}
      </select>
      <select
        value={simulation.equipeId}
        onChange={(e) => setSimulationEquipeId(e.target.value)}
        disabled={loadingSimulacao}
        className="min-w-[180px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      >
        <option value="">Equipe real ({equipeId || 'sem equipe'})</option>
        {equipesFiltradasSimulacao.map((equipe) => (
          <option key={equipe.id} value={equipe.id}>
            {equipe.nome}
          </option>
        ))}
      </select>
      <select
        value={simulation.role}
        onChange={(e) => setSimulationRole(e.target.value as '' | 'user' | 'supervisor' | 'coordenador' | 'admin')}
        className="min-w-[160px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      >
        <option value="">Papel real (admin)</option>
        <option value="user">Usuário</option>
        <option value="supervisor">Supervisor</option>
        <option value="coordenador">Coordenador</option>
        <option value="admin">Admin</option>
      </select>
      <button
        type="button"
        onClick={resetSimulation}
        disabled={!isSimulating}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        Resetar
      </button>
      {isSimulating && (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          Simulando: {effectiveRole || 'admin'}{' '}
          {effectiveEquipeId
            ? `· ${equipesSimulacao.find((equipe) => equipe.id === effectiveEquipeId)?.nome || effectiveEquipeId}`
            : ''}
        </span>
      )}
    </div>
  );
}

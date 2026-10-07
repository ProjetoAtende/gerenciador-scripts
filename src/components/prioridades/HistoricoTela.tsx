import React, { useMemo, useState } from 'react';
import type { AnotacaoPrioridade } from '../../types/Prioridades';
import { formatarProcessoCnj } from '../../services/prioridadesDjenService';
import { AnotacaoCard, StatusBadge } from './PrioridadesUi';
import { formatarDataHora } from './prioridadesUtils';
import { listarHistorico } from '../../services/prioridadesService';
import type { HistoricoAnotacao } from '../../types/Prioridades';

interface Props {
  usuarioId: string | null;
  anotacoes: AnotacaoPrioridade[];
  onAbrir: (a: AnotacaoPrioridade) => void;
  onVoltar: () => void;
}

/**
 * Menu "Histórico" — presente em todos os módulos (RF-GER-04).
 *
 * Aqui o histórico é apresentado em dois níveis: a lista consolidada das
 * anotações visíveis ao usuário e, ao expandir, a trilha completa de eventos
 * daquela anotação (transições, devoluções, respostas e correções).
 */
export const HistoricoTela: React.FC<Props> = ({ usuarioId, anotacoes, onAbrir, onVoltar }) => {
  const [filtro, setFiltro] = useState('');
  const [somenteMinhas, setSomenteMinhas] = useState(false);
  const [expandida, setExpandida] = useState<number | null>(null);
  const [eventos, setEventos] = useState<HistoricoAnotacao[]>([]);
  const [carregandoEventos, setCarregandoEventos] = useState(false);

  const filtradas = useMemo(() => {
    const termo = filtro.replace(/\D/g, '');
    return anotacoes.filter((a) => {
      if (somenteMinhas && usuarioId && a.criador_id !== usuarioId) return false;
      if (termo && !a.processo.includes(termo)) return false;
      return true;
    });
  }, [anotacoes, filtro, somenteMinhas, usuarioId]);

  const alternar = async (id: number) => {
    if (expandida === id) {
      setExpandida(null);
      setEventos([]);
      return;
    }
    setExpandida(id);
    setCarregandoEventos(true);
    try {
      setEventos(await listarHistorico(id));
    } finally {
      setCarregandoEventos(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Histórico</h2>
        <button type="button" onClick={onVoltar} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          Voltar ao painel
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Filtrar por número do processo"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input
            type="checkbox"
            checked={somenteMinhas}
            onChange={(e) => setSomenteMinhas(e.target.checked)}
            className="h-4 w-4"
          />
          Somente as minhas
        </label>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {filtradas.length} anotação(ões). ID sequencial por anotação, com preservação de todas as transições,
        devoluções, respostas e correções.
      </p>

      <div className="space-y-2">
        {filtradas.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
            Nenhuma anotação encontrada.
          </p>
        )}

        {filtradas.map((a) => (
          <div key={a.id} className="space-y-1">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <AnotacaoCard anotacao={a} onAbrir={onAbrir} />
              </div>
              <button
                type="button"
                onClick={() => void alternar(a.id)}
                className="mt-3 shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                title="Ver trilha de eventos"
              >
                {expandida === a.id ? 'Ocultar trilha' : 'Trilha'}
              </button>
            </div>

            {expandida === a.id && (
              <div className="ml-4 rounded-lg border-l-2 border-blue-300 bg-white p-3 dark:border-blue-700 dark:bg-gray-800">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-mono">#{a.id}</span>
                  <span className="font-mono">{formatarProcessoCnj(a.processo)}</span>
                  <StatusBadge status={a.status} />
                </div>
                {carregandoEventos ? (
                  <p className="text-sm text-gray-500">Carregando trilha…</p>
                ) : eventos.length === 0 ? (
                  <p className="text-sm text-gray-500">Sem eventos registrados.</p>
                ) : (
                  <ol className="space-y-2">
                    {eventos.map((h) => (
                      <li key={h.id} className="border-l-2 border-gray-200 pl-3 dark:border-gray-600">
                        <p className="text-sm text-gray-800 dark:text-gray-100">
                          <strong>{h.evento}</strong> · {h.autor_nome ?? 'sistema'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatarDataHora(h.criado_em)}
                          {h.status_anterior ? ` · ${h.status_anterior} → ${h.status_novo}` : ` · ${h.status_novo}`}
                        </p>
                        {h.conteudo && (
                          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{h.conteudo}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

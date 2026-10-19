import React, { useEffect, useState } from 'react';
import type { AnotacaoPrioridade, HistoricoAnotacao } from '../../types/Prioridades';
import { listarHistorico, obterAnotacao } from '../../services/prioridadesService';
import { formatarProcessoCnj } from '../../services/prioridadesDjenService';
import { CampoLeitura, StatusBadge } from './PrioridadesUi';
import { formatarDataHora } from './prioridadesUtils';

interface Props {
  anotacaoId: number | null;
  onFechar: () => void;
}

/** Consulta somente leitura de anotação anterior (avisos de 120 dias). */
export const AnotacaoConsultaModal: React.FC<Props> = ({ anotacaoId, onFechar }) => {
  const [anotacao, setAnotacao] = useState<AnotacaoPrioridade | null>(null);
  const [historico, setHistorico] = useState<HistoricoAnotacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (anotacaoId == null) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const res = await obterAnotacao(anotacaoId);
        if (cancelado) return;
        if (!res.sucesso || !res.anotacao) {
          setErro(res.erro ?? 'Não foi possível carregar a anotação.');
          setAnotacao(null);
          return;
        }
        setAnotacao(res.anotacao);
        setHistorico(await listarHistorico(anotacaoId));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [anotacaoId]);

  if (anotacaoId == null) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-600 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Anotação #{anotacaoId}</h3>
            {anotacao && <StatusBadge status={anotacao.status} />}
          </div>
          <button type="button" onClick={onFechar} className="text-sm font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            Fechar
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {carregando && <p className="text-sm text-gray-500">Carregando…</p>}
          {erro && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">{erro}</p>}
          {anotacao && (
            <div className="space-y-4">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CampoLeitura label="Processo" valor={<span className="font-mono">{formatarProcessoCnj(anotacao.processo)}</span>} />
                <CampoLeitura label="Data da anotação" valor={formatarDataHora(anotacao.data_anotacao)} />
                <CampoLeitura label="Criador" valor={anotacao.criador_nome} />
                <CampoLeitura label="Tipo" valor={anotacao.tipo_prioridade} />
              </dl>
              <CampoLeitura label="Descrição da Prioridade/Urgência" valor={anotacao.descricao_prioridade} />
              {historico.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Histórico</p>
                  <ol className="mt-2 space-y-2">
                    {historico.slice(0, 8).map((h) => (
                      <li key={h.id} className="border-l-2 border-gray-200 pl-3 text-sm dark:border-gray-600">
                        <span className="font-medium">{h.evento}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400"> · {formatarDataHora(h.criado_em)}</span>
                        {h.conteudo && <p className="mt-0.5 text-gray-600 dark:text-gray-300">{h.conteudo}</p>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

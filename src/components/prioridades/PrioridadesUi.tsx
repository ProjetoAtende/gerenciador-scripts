import React from 'react';
import type { AnotacaoPrioridade, PrioridadeStatus } from '../../types/Prioridades';
import { STATUS_CLASSE, STATUS_LABEL } from '../../types/Prioridades';
import { formatarProcessoCnj } from '../../services/prioridadesDjenService';
import { formatarDataHora, prazoRestante } from './prioridadesUtils';

/** Etiqueta de status da anotação. */
export const StatusBadge: React.FC<{ status: PrioridadeStatus; className?: string }> = ({
  status,
  className = '',
}) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_CLASSE[status]} ${className}`}
  >
    {STATUS_LABEL[status]}
  </span>
);

/** RF-GES-04: anotações marcadas aparecem em destaque para a UPJ. */
export const UrgentissimoBadge: React.FC = () => (
  <span
    className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white"
    title="Marcação de maior criticidade (RF-GES-04)"
  >
    ⚡ Urgentíssimo
  </span>
);

/** Bloco de campo somente leitura para as telas de conferência/análise. */
export const CampoLeitura: React.FC<{ label: string; valor: React.ReactNode }> = ({ label, valor }) => (
  <div>
    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">{valor || '—'}</dd>
  </div>
);

interface AnotacaoCardProps {
  anotacao: AnotacaoPrioridade;
  onAbrir: (a: AnotacaoPrioridade) => void;
  /** Nome da UPJ, quando conhecido pela lista carregada. */
  upjNome?: string | null;
}

export const AnotacaoCard: React.FC<AnotacaoCardProps> = ({ anotacao, onAbrir, upjNome }) => {
  const devolvida = anotacao.status === 'gestor-devolvida' || anotacao.status === 'upj-devolvida';
  const prazo = devolvida ? prazoRestante(anotacao.prazo_resposta_em) : null;

  return (
    <button
      type="button"
      onClick={() => onAbrir(anotacao)}
      className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60 ${
        devolvida
          ? 'border-red-300 bg-red-50/60 dark:border-red-800 dark:bg-red-900/20'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-100">
          {formatarProcessoCnj(anotacao.processo)}
        </span>
        <StatusBadge status={anotacao.status} />
        {anotacao.urgentissimo && <UrgentissimoBadge />}
        {anotacao.correcao_automatica && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/40 dark:text-orange-200">
            Correção automática engatilhada
          </span>
        )}
      </div>

      <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
        {anotacao.descricao_prioridade}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>Anotada em {formatarDataHora(anotacao.data_anotacao)}</span>
        <span>por {anotacao.criador_nome}</span>
        {upjNome && <span>→ {upjNome}</span>}
        {anotacao.nome_orgao_djen && !upjNome && <span>→ {anotacao.nome_orgao_djen}</span>}
        {prazo && (
          <span
            className={
              prazo.expirado
                ? 'font-semibold text-red-600'
                : 'font-semibold text-amber-700 dark:text-amber-300'
            }
          >
            Prazo para resposta: {prazo.texto}
          </span>
        )}
      </div>
    </button>
  );
};

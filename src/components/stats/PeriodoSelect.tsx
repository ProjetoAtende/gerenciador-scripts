import React from 'react';
import type { PeriodoFiltro } from '../../services/scriptStatsService';

interface Props {
  value: PeriodoFiltro;
  onChange: (v: PeriodoFiltro) => void;
  label?: string;
}

const PERIODOS: { value: PeriodoFiltro; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '48h', label: '48h' },
  { value: '72h', label: '72h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '60d', label: '60d' },
  { value: '3m', label: '3m' },
  { value: 'all', label: 'Tudo' },
];

export const PeriodoSelect: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-slate-200/80 bg-slate-100/90 p-0.5 dark:border-slate-700/80 dark:bg-slate-800/80">
      {PERIODOS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
            value === p.value
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
              : 'text-slate-500 hover:bg-white/80 dark:text-slate-400 dark:hover:bg-slate-700/60'
          }`}
          aria-pressed={value === p.value}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
};

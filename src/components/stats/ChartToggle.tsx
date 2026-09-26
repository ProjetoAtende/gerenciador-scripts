import React from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';

export type ChartMode = 'bar' | 'line';

interface Props {
  value: ChartMode;
  onChange: (v: ChartMode) => void;
}

export const ChartToggle: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="flex gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-800/80 rounded-lg border border-gray-200 dark:border-gray-700/60">
      <button
        onClick={() => onChange('bar')}
        className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
          value === 'bar'
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700/60'
        }`}
        aria-pressed={value === 'bar'}
        title="Gráfico de barras"
      >
        <BarChart3 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onChange('line')}
        className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
          value === 'line'
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700/60'
        }`}
        aria-pressed={value === 'line'}
        title="Gráfico de linha"
      >
        <TrendingUp className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

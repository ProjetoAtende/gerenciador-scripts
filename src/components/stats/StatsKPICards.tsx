import React from 'react';
import type { ScriptsResumo } from '../../services/scriptStatsService';
import { FileText, CheckCircle2, Clock } from 'lucide-react';

interface Props {
  resumo: ScriptsResumo | null;
  loading: boolean;
  compact?: boolean;
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const duration = 600;
    const steps = 24;
    const increment = value / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), value);
      setDisplay(current);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toLocaleString('pt-BR')}</>;
}

const kpiCards = [
  {
    key: 'total',
    label: 'Total',
    icon: FileText,
    getValue: (r: ScriptsResumo) => r.total,
    accent: 'from-indigo-500 to-blue-500',
    ring: 'ring-indigo-500/20',
    iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  {
    key: 'revisados',
    label: 'Revisados',
    icon: CheckCircle2,
    getValue: (r: ScriptsResumo) => r.revisados,
    accent: 'from-emerald-500 to-teal-500',
    ring: 'ring-emerald-500/20',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    key: 'pendentes',
    label: 'Pendentes',
    icon: Clock,
    getValue: (r: ScriptsResumo) => r.pendentes_revisao,
    accent: 'from-amber-500 to-orange-500',
    ring: 'ring-amber-500/20',
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
] as const;

export const StatsKPICards: React.FC<Props> = ({ resumo, loading, compact }) => {
  if (loading || !resumo) {
    return (
      <div className="grid shrink-0 grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[4.25rem] animate-pulse rounded-xl border border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/40"
          />
        ))}
      </div>
    );
  }

  const pctRevisados = resumo.total > 0 ? Math.round((resumo.revisados / resumo.total) * 100) : 0;

  return (
    <div className={`grid shrink-0 grid-cols-3 gap-2 ${compact ? '' : ''}`}>
      {kpiCards.map((card) => {
        const Icon = card.icon;
        const value = card.getValue(resumo);
        return (
          <div
            key={card.key}
            className={`relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2.5 ring-1 ${card.ring} dark:border-slate-700/80 dark:bg-slate-800/50`}
          >
            <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${card.accent}`} />
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {card.label}
                </p>
                <p className="text-xl font-bold tabular-nums leading-none text-slate-900 dark:text-white">
                  <AnimatedNumber value={value} />
                </p>
              </div>
            </div>
            {card.key === 'revisados' && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${card.accent} transition-all duration-700`}
                    style={{ width: `${pctRevisados}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                  {pctRevisados}%
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

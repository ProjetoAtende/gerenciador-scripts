import React from 'react';
import { ChartSkeleton } from './Skeletons';

export const STATS_CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#10b981', '#06b6d4', '#f59e0b',
  '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#ef4444',
];

export const statsTooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  borderRadius: '10px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
  color: '#f8fafc',
  fontSize: '12px',
};

export function StatsPanel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/80 to-indigo-50/30 shadow-sm dark:border-slate-700/80 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 ${className}`}
    >
      {children}
    </div>
  );
}

export function StatsSectionHeader({
  title,
  hint,
  actions,
  badge,
}: {
  title: string;
  hint?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-2.5 dark:border-slate-700/70">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          {badge}
        </div>
        {hint && (
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatsPanelBody({
  children,
  className = '',
  layout = 'column',
}: {
  children: React.ReactNode;
  className?: string;
  /** column = stack; split = gráfico + coluna lateral fixa */
  layout?: 'column' | 'split';
}) {
  const layoutClass =
    layout === 'split'
      ? 'grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_240px]'
      : 'flex min-h-0 flex-1 flex-col gap-2';

  return (
    <div className={`p-3 pt-2 ${layoutClass} ${className}`}>
      {children}
    </div>
  );
}

/** Área principal (coluna 1 do layout split). */
export function StatsSplitMain({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex h-full min-h-0 min-w-0 flex-col ${className}`}>
      {children}
    </div>
  );
}

export function StatsSplitAside({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside className={`flex h-full min-h-0 min-w-0 flex-col lg:max-h-full ${className}`}>
      {children}
    </aside>
  );
}

export function StatsChartArea({
  loading,
  empty,
  emptyLabel = 'Nenhum dado no período',
  children,
}: {
  loading: boolean;
  empty: boolean;
  emptyLabel?: string;
  children?: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="h-full min-h-0 min-w-0 flex-1">
        <ChartSkeleton className="h-full min-h-[120px]" />
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[200px] min-w-0 w-full flex-1">
      <div className="absolute inset-0 min-h-[200px]">{children}</div>
    </div>
  );
}

export function StatsMetricStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>
  );
}

export function StatsMetricPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const tones = {
    neutral: 'text-slate-800 dark:text-slate-100',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-rose-600 dark:text-rose-400',
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-center dark:border-slate-700/80 dark:bg-slate-800/50">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`text-lg font-bold tabular-nums leading-tight ${tones[tone]}`}>{value}</p>
    </div>
  );
}

export function StatsRankList({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white/60 dark:border-slate-700/80 dark:bg-slate-800/40">
      <p className="shrink-0 border-b border-slate-200/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {title}
      </p>
      <ul className="min-h-0 flex-1 space-y-1 overflow-hidden p-2">{children}</ul>
    </div>
  );
}

export function StatsRankRow({
  rank,
  name,
  value,
  sub,
  color,
}: {
  rank: number;
  name: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100/80 dark:hover:bg-slate-700/30">
      <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-400">{rank}</span>
      {color && (
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">{name}</p>
        {sub && <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
      <span className="shrink-0 text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
        {value}
      </span>
    </li>
  );
}

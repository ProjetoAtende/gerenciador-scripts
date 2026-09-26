import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { STATS_CHART_COLORS, statsTooltipStyle } from './scriptsEmNumerosLayout';

export type HorizontalBarItem = {
  id: string;
  label: string;
  value: number;
  sub?: string;
};

interface Props {
  data: HorizontalBarItem[];
  valueLabel?: string;
  emptyLabel?: string;
  /** Poucos itens: barras CSS preenchem a altura (Recharts fica vazio com 1 linha). */
  preferLeaderboard?: boolean;
}

/** Barras horizontais em CSS — preenche bem com 1–5 itens. */
export function StatsLeaderboardBars({
  data,
  valueLabel = 'Total',
}: {
  data: HorizontalBarItem[];
  valueLabel?: string;
}) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-3 px-1 py-2">
      {data.map((item, i) => (
        <div
          key={item.id}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)_auto] items-center gap-3 sm:grid-cols-[180px_1fr_auto]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {item.label}
            </p>
            {item.sub && (
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{item.sub}</p>
            )}
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/90 sm:h-4">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.max(8, Math.round((item.value / maxVal) * 100))}%`,
                backgroundColor: STATS_CHART_COLORS[i % STATS_CHART_COLORS.length],
              }}
            />
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
              {item.value}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">{valueLabel}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export const StatsHorizontalBars: React.FC<Props> = ({
  data,
  valueLabel = 'Total',
  emptyLabel = 'Sem dados',
  preferLeaderboard,
}) => {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  if (preferLeaderboard || data.length <= 5) {
    return (
      <div className="h-full min-h-[160px] w-full">
        <StatsLeaderboardBars data={data} valueLabel={valueLabel} />
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    shortLabel: d.label.length > 28 ? `${d.label.slice(0, 26)}…` : d.label,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="opacity-15" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
        <YAxis
          type="category"
          dataKey="shortLabel"
          width={110}
          tick={{ fontSize: 10 }}
          interval={0}
        />
        <Tooltip
          formatter={(value: number) => [value, valueLabel]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
          contentStyle={statsTooltipStyle}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={chartData.length <= 4 ? 28 : 22}>
          {chartData.map((_, i) => (
            <Cell key={chartData[i].id} fill={STATS_CHART_COLORS[i % STATS_CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

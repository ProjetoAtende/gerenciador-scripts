import React, { useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DadosPorPeriodo, PeriodoFiltro } from '../../services/scriptStatsService';
import { PeriodoSelect } from './PeriodoSelect';
import { ChartToggle, type ChartMode } from './ChartToggle';
import {
  StatsChartArea,
  StatsPanelBody,
  StatsSectionHeader,
  statsTooltipStyle,
} from './scriptsEmNumerosLayout';

interface Props {
  dados: DadosPorPeriodo[];
  loading: boolean;
  periodo: PeriodoFiltro;
  setPeriodo: (p: PeriodoFiltro) => void;
}

function formatDate(d: string): string {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export const StatsRevisaoChart: React.FC<Props> = ({ dados, loading, periodo, setPeriodo }) => {
  const [chartMode, setChartMode] = useState<ChartMode>('line');
  const total = dados.reduce((s, d) => s + d.total, 0);

  const labelFormatter = (label: string) => {
    const date = new Date(label + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <>
      <StatsSectionHeader
        title="Revisão de scripts"
        hint="Curadoria e edições por dia"
        badge={
          !loading && dados.length > 0 ? (
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
              {total} no período
            </span>
          ) : undefined
        }
        actions={
          <>
            <ChartToggle value={chartMode} onChange={setChartMode} />
            <PeriodoSelect value={periodo} onChange={setPeriodo} />
          </>
        }
      />
      <StatsPanelBody>
        <StatsChartArea loading={loading} empty={dados.length === 0} emptyLabel="Sem revisões no período">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'line' ? (
              <AreaChart data={dados} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="data" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                <Tooltip
                  labelFormatter={labelFormatter}
                  formatter={(value: number) => [value, 'Revisões']}
                  contentStyle={statsTooltipStyle}
                />
                <defs>
                  <linearGradient id="gradientRevisao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.75} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fill="url(#gradientRevisao)" />
              </AreaChart>
            ) : (
              <BarChart data={dados} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="data" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                <Tooltip
                  labelFormatter={labelFormatter}
                  formatter={(value: number) => [value, 'Revisões']}
                  contentStyle={statsTooltipStyle}
                />
                <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </StatsChartArea>
      </StatsPanelBody>
    </>
  );
};

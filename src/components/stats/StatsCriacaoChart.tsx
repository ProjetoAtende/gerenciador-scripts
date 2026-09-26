import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

export const StatsCriacaoChart: React.FC<Props> = ({ dados, loading, periodo, setPeriodo }) => {
  const [chartMode, setChartMode] = useState<ChartMode>('bar');
  const total = dados.reduce((s, d) => s + d.total, 0);

  const labelFormatter = (label: string) => {
    const date = new Date(label + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <>
      <StatsSectionHeader
        title="Criação de scripts"
        hint="Novos scripts por dia"
        badge={
          !loading && dados.length > 0 ? (
            <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
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
        <StatsChartArea loading={loading} empty={dados.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'bar' ? (
              <BarChart data={dados} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="data" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                <Tooltip
                  labelFormatter={labelFormatter}
                  formatter={(value: number) => [value, 'Criados']}
                  contentStyle={statsTooltipStyle}
                />
                <Bar dataKey="total" fill="url(#gradientCriacao)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <defs>
                  <linearGradient id="gradientCriacao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
              </BarChart>
            ) : (
              <LineChart data={dados} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="data" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                <Tooltip
                  labelFormatter={labelFormatter}
                  formatter={(value: number) => [value, 'Criados']}
                  contentStyle={statsTooltipStyle}
                />
                <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </StatsChartArea>
      </StatsPanelBody>
    </>
  );
};

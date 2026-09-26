import React, { useState } from 'react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { PropostaPorPeriodo, PeriodoFiltro } from '../../services/scriptStatsService';
import { PeriodoSelect } from './PeriodoSelect';
import { ChartToggle, type ChartMode } from './ChartToggle';
import {
  StatsChartArea,
  StatsMetricPill,
  StatsMetricStrip,
  StatsPanelBody,
  StatsSectionHeader,
  statsTooltipStyle,
} from './scriptsEmNumerosLayout';

interface Props {
  dados: PropostaPorPeriodo[];
  loading: boolean;
  periodo: PeriodoFiltro;
  setPeriodo: (p: PeriodoFiltro) => void;
}

function formatDate(d: string): string {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export const StatsPropostasChart: React.FC<Props> = ({ dados, loading, periodo, setPeriodo }) => {
  const [chartMode, setChartMode] = useState<ChartMode>('bar');

  const totais = dados.reduce(
    (acc, d) => ({
      total: acc.total + d.total,
      aprovadas: acc.aprovadas + d.aprovadas,
      rejeitadas: acc.rejeitadas + d.rejeitadas,
      pendentes: acc.pendentes + d.pendentes,
    }),
    { total: 0, aprovadas: 0, rejeitadas: 0, pendentes: 0 }
  );

  const labelFormatter = (label: string) => {
    const date = new Date(label + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <>
      <StatsSectionHeader
        title="Propostas de modificação"
        hint="Status por dia"
        actions={
          <>
            <ChartToggle value={chartMode} onChange={setChartMode} />
            <PeriodoSelect value={periodo} onChange={setPeriodo} />
          </>
        }
      />
      <StatsPanelBody>
        {!loading && dados.length > 0 && (
          <StatsMetricStrip>
            <StatsMetricPill label="Total" value={totais.total} />
            <StatsMetricPill label="Aprovadas" value={totais.aprovadas} tone="success" />
            <StatsMetricPill label="Rejeitadas" value={totais.rejeitadas} tone="danger" />
            <StatsMetricPill label="Pendentes" value={totais.pendentes} tone="warning" />
          </StatsMetricStrip>
        )}

        <StatsChartArea loading={loading} empty={dados.length === 0} emptyLabel="Sem propostas no período">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'bar' ? (
              <BarChart data={dados} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="data" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                <Tooltip labelFormatter={labelFormatter} contentStyle={statsTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="aprovadas" name="Aprovadas" stackId="a" fill="#10b981" />
                <Bar dataKey="rejeitadas" name="Rejeitadas" stackId="a" fill="#ef4444" />
                <Bar dataKey="pendentes" name="Pendentes" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={dados} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="data" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                <Tooltip labelFormatter={labelFormatter} contentStyle={statsTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="aprovadas" name="Aprovadas" stackId="a" stroke="#10b981" fill="#10b981" fillOpacity={0.55} />
                <Area type="monotone" dataKey="rejeitadas" name="Rejeitadas" stackId="a" stroke="#ef4444" fill="#ef4444" fillOpacity={0.45} />
                <Area type="monotone" dataKey="pendentes" name="Pendentes" stackId="a" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.45} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </StatsChartArea>
      </StatsPanelBody>
    </>
  );
};

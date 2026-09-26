import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { TopCriador } from '../../services/scriptStatsService';
import {
  STATS_CHART_COLORS,
  StatsChartArea,
  StatsPanelBody,
  StatsSectionHeader,
  statsTooltipStyle,
} from './scriptsEmNumerosLayout';

interface Props {
  dados: TopCriador[];
  loading: boolean;
}

export const StatsTopCriadoresChart: React.FC<Props> = ({ dados, loading }) => {
  const chartData = dados.slice(0, 8).map((d) => ({
    ...d,
    label: d.nome.split(' ').slice(0, 2).join(' '),
  }));

  return (
    <>
      <StatsSectionHeader title="Top criadores" hint="Quem mais publicou scripts" />
      <StatsPanelBody>
        <StatsChartArea loading={loading} empty={chartData.length === 0} emptyLabel="Sem criadores">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-20" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="label" width={72} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value: number) => [value, 'Scripts']}
                contentStyle={statsTooltipStyle}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={STATS_CHART_COLORS[i % STATS_CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </StatsChartArea>
      </StatsPanelBody>
    </>
  );
};

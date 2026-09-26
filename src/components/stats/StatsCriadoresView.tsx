import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { CriadorPorPeriodo, PeriodoFiltro } from '../../services/scriptStatsService';
import { PeriodoSelect } from './PeriodoSelect';
import {
  STATS_CHART_COLORS,
  StatsChartArea,
  StatsPanelBody,
  StatsRankList,
  StatsRankRow,
  StatsSectionHeader,
  StatsSplitAside,
  StatsSplitMain,
  statsTooltipStyle,
} from './scriptsEmNumerosLayout';
import { StatsHorizontalBars } from './StatsHorizontalBars';
import { ChartSkeleton } from './Skeletons';

interface Props {
  dados: CriadorPorPeriodo[];
  loading: boolean;
  periodo: PeriodoFiltro;
  setPeriodo: (p: PeriodoFiltro) => void;
}

export const StatsCriadoresView: React.FC<Props> = ({ dados, loading, periodo, setPeriodo }) => {
  const totaisPorUsuario = useMemo(() => {
    const map = new Map<string, { nome: string; total: number }>();
    dados.forEach((d) => {
      const existing = map.get(d.user_id) || { nome: d.nome, total: 0 };
      existing.total += d.total;
      map.set(d.user_id, existing);
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ user_id: id, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [dados]);

  const { chartData, userNames, useTimeline } = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    const nameMap = new Map<string, string>();

    dados.forEach((d) => {
      const key = d.nome.split(' ')[0];
      nameMap.set(d.user_id, key);
      const entry = dateMap.get(d.data) || {};
      entry[d.user_id] = (entry[d.user_id] || 0) + d.total;
      dateMap.set(d.data, entry);
    });

    const chartData = Array.from(dateMap.entries())
      .map(([data, users]) => ({ data, ...users }))
      .sort((a, b) => a.data.localeCompare(b.data));

    const userNames = Array.from(nameMap.entries())
      .slice(0, 6)
      .map(([id, nome]) => ({ id, nome }));

    const useTimeline = chartData.length >= 2 && userNames.length >= 1;

    return { chartData, userNames, useTimeline };
  }, [dados]);

  function formatDate(d: string): string {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  const barItems = totaisPorUsuario.map((u) => ({
    id: u.user_id,
    label: u.nome,
    value: u.total,
  }));

  return (
    <>
      <StatsSectionHeader
        title="Criadores por data"
        hint={
          useTimeline
            ? 'Evolução diária (empilhado) + ranking'
            : 'Poucos dias no filtro — volume por autor'
        }
        actions={<PeriodoSelect value={periodo} onChange={setPeriodo} />}
      />
      <StatsPanelBody layout="split">
        {loading ? (
          <ChartSkeleton className="h-full min-h-[120px] flex-1" />
        ) : dados.length === 0 ? (
          <StatsChartArea loading={false} empty emptyLabel="Sem criações no período" />
        ) : (
          <>
            <StatsSplitMain>
              <StatsChartArea loading={false} empty={false}>
                {useTimeline ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis
                        dataKey="data"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                      <Tooltip
                        labelFormatter={(label) => {
                          const date = new Date(String(label) + 'T00:00:00');
                          return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
                        }}
                        contentStyle={statsTooltipStyle}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {userNames.map((u, i) => (
                        <Bar
                          key={u.id}
                          dataKey={u.id}
                          name={u.nome}
                          stackId="a"
                          fill={STATS_CHART_COLORS[i % STATS_CHART_COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <StatsHorizontalBars data={barItems} valueLabel="Scripts" />
                )}
              </StatsChartArea>
            </StatsSplitMain>

            <StatsSplitAside>
              <StatsRankList title="Ranking">
                {totaisPorUsuario.map((u, i) => (
                  <StatsRankRow
                    key={u.user_id}
                    rank={i + 1}
                    name={u.nome}
                    value={u.total}
                    color={STATS_CHART_COLORS[i % STATS_CHART_COLORS.length]}
                  />
                ))}
              </StatsRankList>
            </StatsSplitAside>
          </>
        )}
      </StatsPanelBody>
    </>
  );
};

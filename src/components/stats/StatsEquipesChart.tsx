import React from 'react';
import type { EquipeCriadora } from '../../services/scriptStatsService';
import {
  STATS_CHART_COLORS,
  StatsChartArea,
  StatsPanelBody,
  StatsRankList,
  StatsRankRow,
  StatsSectionHeader,
  StatsSplitAside,
  StatsSplitMain,
} from './scriptsEmNumerosLayout';
import { StatsHorizontalBars } from './StatsHorizontalBars';

interface Props {
  dados: EquipeCriadora[];
  loading: boolean;
  variant?: 'overview' | 'detail';
}

export const StatsEquipesChart: React.FC<Props> = ({ dados, loading, variant = 'detail' }) => {
  const slice = dados.slice(0, variant === 'overview' ? 8 : 12);
  const barItems = slice.map((d) => ({
    id: d.equipe_id,
    label: d.equipe_nome,
    value: d.total_scripts,
    sub: `${d.total_usuarios} autor(es)`,
  }));

  return (
    <>
      <StatsSectionHeader
        title="Equipes criadoras"
        hint={variant === 'overview' ? 'Volume por equipe' : 'Scripts e autores distintos'}
      />
      <StatsPanelBody layout={variant === 'detail' && slice.length > 0 ? 'split' : 'column'}>
        <StatsSplitMain>
          <StatsChartArea loading={loading} empty={slice.length === 0} emptyLabel="Sem equipes">
            <StatsHorizontalBars data={barItems} valueLabel="Scripts" />
          </StatsChartArea>
        </StatsSplitMain>

        {variant === 'detail' && !loading && slice.length > 0 && (
          <StatsSplitAside>
            <StatsRankList title="Autores">
              {slice.map((eq, i) => (
                <StatsRankRow
                  key={eq.equipe_id}
                  rank={i + 1}
                  name={eq.equipe_nome}
                  value={eq.total_scripts}
                  sub={`${eq.total_usuarios} autor(es)`}
                  color={STATS_CHART_COLORS[i % STATS_CHART_COLORS.length]}
                />
              ))}
            </StatsRankList>
          </StatsSplitAside>
        )}
      </StatsPanelBody>
    </>
  );
};

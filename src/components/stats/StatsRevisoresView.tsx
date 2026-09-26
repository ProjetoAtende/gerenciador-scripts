import React, { useMemo } from 'react';
import type { TopRevisor, PeriodoFiltro } from '../../services/scriptStatsService';
import { PeriodoSelect } from './PeriodoSelect';
import {
  StatsChartArea,
  StatsMetricPill,
  StatsMetricStrip,
  StatsPanelBody,
  StatsSectionHeader,
  StatsSplitMain,
} from './scriptsEmNumerosLayout';
import { StatsHorizontalBars } from './StatsHorizontalBars';
import { ChartSkeleton } from './Skeletons';

interface Props {
  dados: TopRevisor[];
  loading: boolean;
  periodo: PeriodoFiltro;
  setPeriodo: (p: PeriodoFiltro) => void;
}

export const StatsRevisoresView: React.FC<Props> = ({ dados, loading, periodo, setPeriodo }) => {
  const visible = dados.slice(0, 15);

  const totais = useMemo(
    () =>
      visible.reduce(
        (acc, r) => ({
          revisoes: acc.revisoes + r.total_revisoes,
          aprovacoes: acc.aprovacoes + r.total_aprovacoes,
          geral: acc.geral + r.total_revisoes + r.total_aprovacoes,
        }),
        { revisoes: 0, aprovacoes: 0, geral: 0 }
      ),
    [visible]
  );

  const barItems = visible.map((r) => ({
    id: r.user_id,
    label: r.nome,
    value: r.total_revisoes + r.total_aprovacoes,
    sub: `${r.total_revisoes} revisões · ${r.total_aprovacoes} aprovações`,
  }));

  return (
    <>
      <StatsSectionHeader
        title="Ranking de revisores"
        hint="Cada barra = revisões diretas + aprovações de propostas no período"
        actions={<PeriodoSelect value={periodo} onChange={setPeriodo} />}
      />
      <StatsPanelBody className="min-h-0 flex-1">
        {!loading && visible.length > 0 && (
          <StatsMetricStrip>
            <StatsMetricPill label="Revisores" value={visible.length} />
            <StatsMetricPill label="Revisões" value={totais.revisoes} tone="success" />
            <StatsMetricPill label="Aprovações" value={totais.aprovacoes} tone="neutral" />
            <StatsMetricPill label="Total ações" value={totais.geral} />
          </StatsMetricStrip>
        )}

        <StatsSplitMain className="min-h-0 flex-1">
          {loading ? (
            <ChartSkeleton className="h-full min-h-[160px]" />
          ) : (
            <StatsChartArea loading={false} empty={visible.length === 0} emptyLabel="Nenhuma revisão no período">
              <StatsHorizontalBars
                data={barItems}
                valueLabel="Ações"
                preferLeaderboard={visible.length <= 8}
              />
            </StatsChartArea>
          )}
        </StatsSplitMain>
      </StatsPanelBody>
    </>
  );
};

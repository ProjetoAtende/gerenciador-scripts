/**
 * Exporta estatísticas de Outros Serviços para .xlsx (uma aba por sub-aba do dashboard).
 * Apenas dados tabulares — sem formatação de gráficos ou estilos.
 */

import * as XLSX from 'xlsx';
import {
  getServicoConfig,
  type EstatisticasCompletasResult,
  type TipoServico,
} from '../services/servicosService';

const DIA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const FAIXA_LABELS = ['Madrugada (0h–6h)', 'Manhã (6h–12h)', 'Tarde (12h–18h)', 'Noite (18h–0h)'];

export interface ExportServicosEstatisticasMeta {
  equipeNome: string;
  periodoLabel: string;
}

function metaRows(meta: ExportServicosEstatisticasMeta): (string | number)[][] {
  const agora = new Date().toLocaleString('pt-BR');
  return [
    ['Outros Serviços — Estatísticas'],
    ['Equipe', meta.equipeNome],
    ['Período', meta.periodoLabel],
    ['Exportado em', agora],
    [],
  ];
}

function labelTipo(tipo: TipoServico): string {
  try {
    const c = getServicoConfig(tipo);
    return `${c.icone} ${c.label}`.trim();
  } catch {
    return tipo;
  }
}

function diasNoPeriodo(kpis: EstatisticasCompletasResult['kpis']): number {
  if (!kpis.primeiro_registro || !kpis.ultimo_registro) return 1;
  const diff =
    new Date(kpis.ultimo_registro).getTime() - new Date(kpis.primeiro_registro).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function sheetVisaoGeral(dados: EstatisticasCompletasResult, meta: ExportServicosEstatisticasMeta) {
  const k = dados.kpis;
  const totalGeral = k.total_horas + k.total_unidades;
  const pctHoras = totalGeral > 0 ? (k.total_horas / totalGeral) * 100 : 0;
  const pctUnidades = totalGeral > 0 ? (k.total_unidades / totalGeral) * 100 : 0;
  const dias = diasNoPeriodo(k);

  let topTipoLabel = '—';
  if (dados.por_tipo.length > 0) {
    topTipoLabel = labelTipo(dados.por_tipo[0].tipo);
  }

  let topMembroLabel = '—';
  if (dados.por_membro.length > 0) {
    const m = dados.por_membro[0];
    topMembroLabel = `${m.usuario_nome} (${m.total_qtd} serviços)`;
  }

  const mediaDiaria = Number((k.total_registros / dias).toFixed(1));

  return XLSX.utils.aoa_to_sheet([
    ...metaRows(meta),
    ['Indicador', 'Valor'],
    ['Total Registros', k.total_registros],
    ['Total Horas', k.total_horas],
    ['Total Unidades', k.total_unidades],
    ['Tipo Mais Usado', topTipoLabel],
    ['Membro Mais Ativo', topMembroLabel],
    ['Média Diária (registros)', mediaDiaria],
    ['Membros distintos no período', k.membros_distintos],
    ['Primeiro registro', k.primeiro_registro ?? '—'],
    ['Último registro', k.ultimo_registro ?? '—'],
    [],
    ['Distribuição Horas vs Unidades'],
    ['', 'Horas', 'Unidades'],
    ['Total', k.total_horas, k.total_unidades],
    ['% do total (horas+unidades)', `${pctHoras.toFixed(1)}%`, `${pctUnidades.toFixed(1)}%`],
  ]);
}

function sheetPorTipo(dados: EstatisticasCompletasResult, meta: ExportServicosEstatisticasMeta) {
  const porTipo = dados.por_tipo ?? [];
  const totalQtd = porTipo.reduce((s, t) => s + t.total_qtd, 0);

  const rows: (string | number)[][] = [
    ...metaRows(meta),
    ['Ranking / Detalhamento por Tipo'],
    ['Tipo', 'Quantidade', '% do total'],
  ];

  if (porTipo.length === 0) {
    rows.push(['(sem dados no período)', '', '']);
  } else {
    porTipo.forEach(t => {
      const pct = totalQtd > 0 ? ((t.total_qtd / totalQtd) * 100).toFixed(1) + '%' : '0%';
      rows.push([labelTipo(t.tipo), t.total_qtd, pct]);
    });
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

function sheetPorMembro(dados: EstatisticasCompletasResult, meta: ExportServicosEstatisticasMeta) {
  const porMembro = dados.por_membro ?? [];
  const totalQtd = porMembro.reduce((s, m) => s + m.total_qtd, 0);

  const rows: (string | number)[][] = [
    ...metaRows(meta),
    ['Ranking por Membro'],
    ['Membro', 'Quantidade', '% do total', 'Tipos distintos', 'Registros'],
  ];

  if (porMembro.length === 0) {
    rows.push(['(sem dados no período)', '', '', '', '']);
  } else {
    porMembro.forEach(m => {
      const pct = totalQtd > 0 ? ((m.total_qtd / totalQtd) * 100).toFixed(1) + '%' : '0%';
      rows.push([m.usuario_nome, m.total_qtd, pct, m.tipos_distintos, m.total_regs]);
    });
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

function sheetLinhaTempo(dados: EstatisticasCompletasResult, meta: ExportServicosEstatisticasMeta) {
  const rows: (string | number)[][] = [...metaRows(meta)];

  rows.push(['Volume por Dia da Semana']);
  rows.push(['Dia', 'Quantidade', 'Registros']);
  if ((dados.por_dia_semana ?? []).length === 0) {
    rows.push(['(sem dados)', '', '']);
  } else {
    dados.por_dia_semana.forEach(d => {
      rows.push([d.dia_label, d.total_qtd, d.total_regs]);
    });
  }

  rows.push([]);
  rows.push(['Volume Diário']);
  rows.push(['Data', 'Quantidade', 'Registros']);
  if ((dados.volume_diario ?? []).length === 0) {
    rows.push(['(sem dados)', '', '']);
  } else {
    dados.volume_diario.forEach(v => {
      rows.push([v.data, v.total_qtd, v.total_regs]);
    });
  }

  rows.push([]);
  rows.push(['Mapa de Calor — Dia × Faixa Horária (quantidade)']);
  const header = ['Dia', ...FAIXA_LABELS];
  rows.push(header);

  const grid: number[][] = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  dados.por_faixa_horaria?.forEach(f => {
    if (grid[f.dia_semana]) grid[f.dia_semana][f.faixa] = f.total_qtd;
  });

  DIA_LABELS.forEach((dia, dIdx) => {
    rows.push([dia, ...grid[dIdx]]);
  });

  return XLSX.utils.aoa_to_sheet(rows);
}

function safeFilePart(s: string): string {
  return s.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 40);
}

export function exportServicosEstatisticasExcel(
  dados: EstatisticasCompletasResult,
  meta: ExportServicosEstatisticasMeta,
): void {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, sheetVisaoGeral(dados, meta), 'Visão Geral');
  XLSX.utils.book_append_sheet(wb, sheetPorTipo(dados, meta), 'Por Tipo');
  XLSX.utils.book_append_sheet(wb, sheetPorMembro(dados, meta), 'Por Membro');
  XLSX.utils.book_append_sheet(wb, sheetLinhaTempo(dados, meta), 'Linha do Tempo');

  const stamp = new Date().toISOString().slice(0, 10);
  const nome = `estatisticas_outros_servicos_${safeFilePart(meta.equipeNome)}_${meta.periodoLabel}_${stamp}.xlsx`;

  XLSX.writeFile(wb, nome);
}

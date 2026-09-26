/**
 * ServicosEstatisticasTab.tsx
 *
 * Aba "Estatísticas" dentro do OutrosServicosModal.
 * Dashboard analítico com 4 sub-abas:
 *   - Visão Geral: KPIs + donut horas vs unidades
 *   - Por Tipo: ranking dos 18 tipos + evolução temporal
 *   - Por Membro: ranking + gráfico comparativo + detalhe
 *   - Linha do Tempo: dia da semana, heatmap, volume diário
 *
 * Carrega dados de qualquer equipe (seletor de equipe pills).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area,
} from 'recharts';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../services/supabaseClient';
import {
  SERVICOS_CONFIG,
  getServicoConfig,
  type TipoServico,
  type PeriodoEstatistica,
  type EstatisticasCompletasResult,
  obterEstatisticasCompletas,
  detalharServicosMembro,
  type ServicoDetalheMembroItem,
} from '../services/servicosService';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type SubAba = 'visaoGeral' | 'porTipo' | 'porMembro' | 'linhaTempo';

interface ServicosEstatisticasTabProps {
  equipeIdInicial: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SUB_ABAS: { id: SubAba; label: string; icon: string }[] = [
  { id: 'visaoGeral', label: 'Visão Geral', icon: '🏠' },
  { id: 'porTipo',    label: 'Por Tipo',    icon: '📋' },
  { id: 'porMembro',  label: 'Por Membro',  icon: '👥' },
  { id: 'linhaTempo', label: 'Linha do Tempo', icon: '📅' },
];

const PERIOD_OPTIONS: { value: PeriodoEstatistica; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '48h', label: '48h' },
  { value: '72h', label: '72h' },
  { value: '7d',  label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'all', label: 'Todo Período' },
];

const CHART_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1',
  '#84CC16', '#E11D48', '#0EA5E9', '#D946EF', '#A3E635',
  '#FB923C', '#2DD4BF', '#818CF8',
];

const DIA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const FAIXA_LABELS = ['Madrugada (0h–6h)', 'Manhã (6h–12h)', 'Tarde (12h–18h)', 'Noite (18h–0h)'];

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const ServicosEstatisticasTab: React.FC<ServicosEstatisticasTabProps> = ({ equipeIdInicial }) => {
  useAuth();
  const { darkMode } = useSettings();

  // Tema dos gráficos (dark/light)
  const chartTheme = useMemo(() => ({
    grid: darkMode ? '#1e293b' : '#e5e7eb',
    tick: darkMode ? '#94a3b8' : '#6b7280',
    tooltipBg: darkMode ? 'rgba(15, 23, 42, 0.95)' : '#ffffff',
    tooltipBorder: darkMode ? '#334155' : '#e5e7eb',
    tooltipText: darkMode ? '#f1f5f9' : '#111827',
    cursor: darkMode ? '#475569' : '#cbd5e1',
    cursorBar: darkMode ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)',
  }), [darkMode]);

  const tooltipStyle = useMemo(() => ({
    backgroundColor: chartTheme.tooltipBg,
    border: `1px solid ${chartTheme.tooltipBorder}`,
    borderRadius: '10px',
    fontSize: '12px',
    color: chartTheme.tooltipText,
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
    backdropFilter: 'blur(6px)',
  }), [chartTheme]);

  const tooltipLabelStyle = useMemo(() => ({
    color: chartTheme.tooltipText,
    fontWeight: 600,
    marginBottom: 4,
  }), [chartTheme]);

  const tooltipItemStyle = useMemo(() => ({
    color: chartTheme.tooltipText,
  }), [chartTheme]);

  // ── State ──
  const [equipeId, setEquipeId] = useState(equipeIdInicial);
  const [periodo, setPeriodo] = useState<PeriodoEstatistica>('30d');
  const [subAba, setSubAba] = useState<SubAba>('visaoGeral');
  const [isLoading, setIsLoading] = useState(false);
  const [dados, setDados] = useState<EstatisticasCompletasResult | null>(null);

  const [equipes, setEquipes] = useState<{ id: string; nome: string }[]>([]);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoServico | null>(null);

  // Modal detalhe membro
  const [membroModal, setMembroModal] = useState<{ nome: string; itens: ServicoDetalheMembroItem[] } | null>(null);

  // ── Load teams ──
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('equipes')
        .select('id, nome')
        .order('nome');
      if (data) setEquipes(data);
    };
    load();
  }, []);

  // ── Load stats ──
  const loadData = useCallback(async () => {
    if (!equipeId) return;
    setIsLoading(true);
    try {
      const res = await obterEstatisticasCompletas(equipeId, periodo);
      setDados(res);
    } catch (err) {
      console.error('[EstatisticasTab] Erro:', err);
    } finally {
      setIsLoading(false);
    }
  }, [equipeId, periodo]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ──
  const kpis = dados?.kpis;
  const totalGeral = (kpis?.total_horas ?? 0) + (kpis?.total_unidades ?? 0);

  const diasPeriodo = useMemo(() => {
    if (!kpis?.primeiro_registro || !kpis?.ultimo_registro) return 1;
    const diff = new Date(kpis.ultimo_registro).getTime() - new Date(kpis.primeiro_registro).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [kpis]);

  // Top tipo
  const topTipo = useMemo(() => {
    if (!dados?.por_tipo?.length) return null;
    const t = dados.por_tipo[0];
    try { return { ...t, config: getServicoConfig(t.tipo) }; }
    catch { return null; }
  }, [dados]);

  // Top membro
  const topMembro = useMemo(() => {
    if (!dados?.por_membro?.length) return null;
    return dados.por_membro[0];
  }, [dados]);

  // Evolução por tipo selecionado
  const evolucaoTipo = useMemo(() => {
    if (!tipoSelecionado || !dados?.serie_temporal?.length) return [];
    const filtrado = dados.serie_temporal.filter(s => s.tipo === tipoSelecionado);
    const map = new Map<string, number>();
    filtrado.forEach(s => map.set(s.periodo, (map.get(s.periodo) ?? 0) + s.total_quantidade));
    return Array.from(map.entries())
      .map(([periodo, valor]) => ({ periodo, valor }))
      .sort((a, b) => {
        const parse = (s: string) => {
          const [datePart, timePart] = s.split(' ');
          const [d, m] = datePart.split('/').map(Number);
          const h = timePart ? parseInt(timePart) : 0;
          return m * 10000 + d * 100 + h;
        };
        return parse(a.periodo) - parse(b.periodo);
      });
  }, [tipoSelecionado, dados]);

  // Heatmap data (7 × 4 grid)
  const heatmapGrid = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
    dados?.por_faixa_horaria?.forEach(f => {
      if (grid[f.dia_semana]) grid[f.dia_semana][f.faixa] = f.total_qtd;
    });
    return grid;
  }, [dados]);



  // ── Render helpers ──
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <Loader2 size={32} className="animate-spin mb-3" />
      <span className="text-sm">Carregando estatísticas...</span>
    </div>
  );

  const renderEmpty = (msg: string) => (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
      <span className="text-5xl mb-4">📊</span>
      <p className="text-sm font-medium">{msg}</p>
    </div>
  );

  // ─── Sub-aba: Visão Geral ───────────────────────────────
  const renderVisaoGeral = () => {
    if (!kpis) return renderEmpty('Sem dados para o período selecionado.');

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard label="Total Registros" value={kpis.total_registros} icon="📝" />
          <KpiCard label="Total Horas" value={kpis.total_horas} icon="⏱️" suffix="h" />
          <KpiCard label="Total Unidades" value={kpis.total_unidades} icon="🔢" />
          <KpiCard label="Tipo Mais Usado" value={topTipo ? topTipo.config.icone : '—'} subtitle={topTipo?.config.label} icon="" isText />
          <KpiCard label="Mais Ativo" value={topMembro?.usuario_nome.split(' ')[0] ?? '—'} subtitle={topMembro ? `${topMembro.total_qtd} serviços` : ''} icon="🏆" isText />
          <KpiCard label="Média Diária" value={Number((kpis.total_registros / diasPeriodo).toFixed(1))} icon="📈" />
        </div>

        {/* Distribuição: Horas vs Unidades — Barra horizontal */}
        {totalGeral > 0 && (() => {
          const pctHoras = (kpis.total_horas / totalGeral) * 100;
          const pctUnidades = (kpis.total_unidades / totalGeral) * 100;
          return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Distribuição: Horas vs Unidades</h3>
              <div className="relative w-full h-9 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex">
                <div
                  className="h-full rounded-l-full flex items-center justify-center text-xs font-bold text-white transition-all duration-500"
                  style={{ width: `${Math.max(pctHoras, 6)}%`, background: '#14b8a6' }}
                >
                  {pctHoras >= 12 ? `${pctHoras.toFixed(0)}%` : ''}
                </div>
                <div
                  className="h-full rounded-r-full flex items-center justify-center text-xs font-bold text-white transition-all duration-500 ml-auto"
                  style={{ width: `${Math.max(pctUnidades, 6)}%`, background: '#8B5CF6' }}
                >
                  {pctUnidades >= 12 ? `${pctUnidades.toFixed(0)}%` : ''}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: '#14b8a6' }} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">⏱️ Horas: <strong>{kpis.total_horas}</strong> ({pctHoras.toFixed(0)}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: '#8B5CF6' }} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">🔢 Unidades: <strong>{kpis.total_unidades}</strong> ({pctUnidades.toFixed(0)}%)</span>
                </div>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 pt-2 mt-2 border-t border-gray-100 dark:border-gray-700 text-center">
                {kpis.membros_distintos} membro{kpis.membros_distintos !== 1 ? 's' : ''} ativos no período
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ─── Sub-aba: Por Tipo ──────────────────────────────────
  const renderPorTipo = () => {
    const porTipo = dados?.por_tipo ?? [];
    if (porTipo.length === 0) return renderEmpty('Nenhum serviço registrado no período.');

    const totalQtd = porTipo.reduce((sum, t) => sum + t.total_qtd, 0);

    // Enrich with config
    const enriched = porTipo.map(t => {
      try {
        const cfg = getServicoConfig(t.tipo);
        return { ...t, label: cfg.label, icone: cfg.icone, unidade: cfg.unidade };
      } catch {
        return { ...t, label: t.tipo, icone: '❓', unidade: 'unidades' as const };
      }
    });

    // Tipos não utilizados
    const tiposUsados = new Set(porTipo.map(t => t.tipo));
    const tiposNaoUsados = SERVICOS_CONFIG.filter(c => !tiposUsados.has(c.tipo));

    // Chart data for bar chart
    const barData = enriched.slice(0, 12).map(t => ({
      name: t.label,
      tipo: t.tipo,
      quantidade: t.total_qtd,
    }));

    return (
      <div className="space-y-6">
        {/* Ranking - barras horizontais */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Ranking por Tipo de Serviço</h3>
          <div style={{ height: Math.max(320, barData.length * 38) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="0" stroke={chartTheme.grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={230} tick={{ fontSize: 11, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: chartTheme.cursorBar }}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  labelFormatter={(label: string) => label}
                  formatter={(value: number) => [`${value}`, 'Quantidade']}
                />
                <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} cursor="pointer" maxBarSize={26}
                  onClick={(d: { tipo?: TipoServico }) => { if (d.tipo) setTipoSelecionado(d.tipo); }}>
                  {barData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabela detalhada */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Detalhamento por Tipo</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Tipo</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Registros</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Quantidade</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">%</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((t) => {
                  const pct = totalQtd > 0 ? ((t.total_qtd / totalQtd) * 100) : 0;
                  return (
                    <tr
                      key={t.tipo}
                      onClick={() => setTipoSelecionado(t.tipo)}
                      className={`border-b border-gray-50 dark:border-gray-700/50 cursor-pointer transition-colors
                        ${tipoSelecionado === t.tipo ? 'bg-teal-50 dark:bg-teal-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
                    >
                      <td className="px-4 py-2.5 flex items-center gap-2">
                        <span>{t.icone}</span>
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{t.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">{t.total_regs}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-700 dark:text-gray-200">{t.total_qtd}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          pct >= 10 ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tipos sem registro */}
          {tiposNaoUsados.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Sem registros no período:</p>
              <div className="flex flex-wrap gap-1.5">
                {tiposNaoUsados.map(c => (
                  <span key={c.tipo} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-full">
                    {c.icone} {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Evolução temporal do tipo selecionado */}
        {tipoSelecionado && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Evolução: {(() => { try { return getServicoConfig(tipoSelecionado).icone + ' ' + getServicoConfig(tipoSelecionado).label; } catch { return tipoSelecionado; } })()}
              </h3>
              <button
                onClick={() => setTipoSelecionado(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={16} />
              </button>
            </div>
            {evolucaoTipo.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolucaoTipo} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="servicos-evolucao-tipo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0" stroke={chartTheme.grid} vertical={false} />
                    <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ stroke: chartTheme.cursor, strokeWidth: 1, strokeDasharray: '4 4' }}
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      formatter={(value: number) => [`${value}`, 'Quantidade']}
                    />
                    <Area type="monotone" dataKey="valor" stroke="#14b8a6" strokeWidth={2.5} fill="url(#servicos-evolucao-tipo)" dot={false} activeDot={{ r: 5, stroke: '#14b8a6', strokeWidth: 2, fill: darkMode ? '#0f172a' : '#ffffff' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Sem dados temporais para este tipo.</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Sub-aba: Por Membro ────────────────────────────────
  const renderPorMembro = () => {
    const porMembro = dados?.por_membro ?? [];
    if (porMembro.length === 0) return renderEmpty('Nenhum serviço registrado no período.');

    const totalQtd = porMembro.reduce((sum, m) => sum + m.total_qtd, 0);

    // Ranking bar data
    const barData = porMembro.map(m => ({
      name: m.usuario_nome.split(' ')[0],
      usuario_id: m.usuario_id,
      quantidade: m.total_qtd,
    }));

    return (
      <div className="space-y-6">
        {/* Ranking de membros */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Ranking por Membro</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="0" stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: chartTheme.tick }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: chartTheme.cursorBar }}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  formatter={(value: number) => [`${value}`, 'Total']}
                />
                <Bar dataKey="quantidade" radius={[6, 6, 0, 0]} maxBarSize={36}>
                  {barData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cards de membros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {porMembro.map((m, i) => (
            <button
              key={m.usuario_id}
              onClick={() => {
                if (dados?.serie_temporal) {
                  const itens = detalharServicosMembro(
                    dados.serie_temporal.map(s => ({
                      usuario_nome: s.usuario_nome,
                      usuario_id: s.usuario_id,
                      tipo: s.tipo,
                      periodo: s.periodo,
                      total_quantidade: s.total_quantidade,
                    })),
                    m.usuario_id,
                  );
                  setMembroModal({ nome: m.usuario_nome, itens });
                }
              }}
              className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-teal-300 dark:hover:border-teal-700 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}>
                {m.usuario_nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">{m.usuario_nome}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {m.tipos_distintos} tipo{m.tipos_distintos !== 1 ? 's' : ''} · {m.total_regs} registro{m.total_regs !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-teal-600 dark:text-teal-400">{m.total_qtd}</p>
                <p className="text-[10px] text-gray-400">{totalQtd > 0 ? ((m.total_qtd / totalQtd) * 100).toFixed(0) : 0}%</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ─── Sub-aba: Linha do Tempo ────────────────────────────
  const renderLinhaTempo = () => {
    const diaSemana = dados?.por_dia_semana ?? [];
    const volumeDiario = dados?.volume_diario ?? [];

    if (diaSemana.length === 0 && volumeDiario.length === 0)
      return renderEmpty('Nenhum dado temporal disponível no período.');

    return (
      <div className="space-y-6">
        {/* Volume por dia da semana */}
        {diaSemana.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Volume por Dia da Semana</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diaSemana.map(d => ({ ...d, name: d.dia_label }))} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="0" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartTheme.tick }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: chartTheme.cursorBar }}
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(value: number) => [`${value}`, 'Quantidade']}
                  />
                  <Bar dataKey="total_qtd" radius={[6, 6, 0, 0]} fill="#14b8a6" maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Volume diário (gráfico de área) */}
        {volumeDiario.length > 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Volume Diário</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeDiario.map(d => ({ ...d, label: d.data.substring(8, 10) + '/' + d.data.substring(5, 7) }))} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="servicos-volume-diario" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ stroke: chartTheme.cursor, strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(value: number, name: string) => [`${value}`, name === 'total_qtd' ? 'Quantidade' : 'Registros']}
                  />
                  <Area type="monotone" dataKey="total_qtd" stroke="#14b8a6" fill="url(#servicos-volume-diario)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: '#14b8a6', strokeWidth: 2, fill: darkMode ? '#0f172a' : '#ffffff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Heatmap: dia da semana × faixa horária */}
        {(() => {
          const maxVal = Math.max(...heatmapGrid.flat()) || 1;

          return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Mapa de Calor — Dia × Faixa Horária</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                Total de serviços por dia da semana e turno no período
              </p>

              <div className="heatmap-container relative space-y-1.5">
                {/* Header */}
                <div className="flex items-center">
                  <div className="w-12 flex-shrink-0" />
                  {FAIXA_LABELS.map(f => (
                    <div key={f} className="flex-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-1">{f}</div>
                  ))}
                </div>

                {/* Rows */}
                {DIA_LABELS.map((dia, dIdx) => (
                  <div key={dia} className="flex items-center gap-1.5">
                    <div className="w-12 flex-shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 text-right pr-2">{dia}</div>
                    {heatmapGrid[dIdx].map((val, fIdx) => {
                      const intensity = maxVal > 0 ? val / maxVal : 0;
                      return (
                        <div
                          key={fIdx}
                          className="group relative flex-1 h-12 rounded-lg flex items-center justify-center text-xs font-bold transition-transform hover:scale-110 hover:z-10 cursor-default"
                          style={{
                            backgroundColor: val === 0
                              ? 'rgba(55, 65, 81, 0.3)'
                              : intensity < 0.2 ? 'rgba(59, 130, 246, 0.3)'
                              : intensity < 0.4 ? 'rgba(59, 130, 246, 0.5)'
                              : intensity < 0.6 ? 'rgba(16, 185, 129, 0.6)'
                              : intensity < 0.8 ? 'rgba(245, 158, 11, 0.7)'
                              : 'rgba(239, 68, 68, 0.8)',
                            color: intensity > 0.4 ? '#fff' : intensity > 0 ? '#93c5fd' : '#6b7280',
                          }}
                        >
                          {val > 0 ? val : ''}
                          {/* Tooltip */}
                          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                            <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                              <div className="font-semibold">{dia} · {FAIXA_LABELS[fIdx]}</div>
                              <div className="text-gray-300">{val} serviço{val !== 1 ? 's' : ''} no período</div>
                              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Legenda */}
              <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-400 dark:text-gray-500">Menos</span>
                <div className="w-5 h-3.5 rounded" style={{ backgroundColor: 'rgba(55, 65, 81, 0.3)' }} />
                <div className="w-5 h-3.5 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 0.3)' }} />
                <div className="w-5 h-3.5 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 0.5)' }} />
                <div className="w-5 h-3.5 rounded" style={{ backgroundColor: 'rgba(16, 185, 129, 0.6)' }} />
                <div className="w-5 h-3.5 rounded" style={{ backgroundColor: 'rgba(245, 158, 11, 0.7)' }} />
                <div className="w-5 h-3.5 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)' }} />
                <span className="text-xs text-gray-400 dark:text-gray-500">Mais</span>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ────────────────────────────────────────────────────────
  // Main render
  // ────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 space-y-5">
      {/* ── Header: Seletor de Equipe + Período ── */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-xl border border-teal-200 dark:border-teal-800 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Estatísticas — Outros Serviços</h2>
        </div>

        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          {/* Equipe pills */}
          {equipes.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Equipe:</span>
              {equipes.map(e => (
                <button
                  key={e.id}
                  onClick={() => setEquipeId(e.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 transform hover:scale-105 ${
                    equipeId === e.id
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {e.nome}
                </button>
              ))}
            </div>
          )}

          {/* Período pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Período:</span>
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 transform hover:scale-105 ${
                  periodo === p.value
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Navbar sub-abas ── */}
      <div className="flex bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1 gap-1">
        {SUB_ABAS.map(sa => (
          <button
            key={sa.id}
            onClick={() => setSubAba(sa.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              subAba === sa.id
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <span>{sa.icon}</span>
            <span className="hidden sm:inline">{sa.label}</span>
          </button>
        ))}
      </div>

      {/* ── Conteúdo ── */}
      {isLoading ? renderLoading() : (
        <>
          {subAba === 'visaoGeral' && renderVisaoGeral()}
          {subAba === 'porTipo'    && renderPorTipo()}
          {subAba === 'porMembro'  && renderPorMembro()}
          {subAba === 'linhaTempo' && renderLinhaTempo()}
        </>
      )}

      {/* ── Modal: Detalhes do Membro ── */}
      {membroModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setMembroModal(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔧</span>
                <div>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    Serviços — {membroModal.nome.split(' ')[0]}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Composição do total no período
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMembroModal(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              {membroModal.itens.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Nenhum serviço registrado no período.
                </p>
              ) : (
                <div className="space-y-2">
                  {membroModal.itens.map(item => (
                    <div
                      key={item.tipo}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
                    >
                      <span className="text-2xl flex-shrink-0">{item.icone}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 leading-tight truncate">{item.label}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{item.unidade}</p>
                      </div>
                      <span className="text-lg font-bold text-teal-600 dark:text-teal-400 flex-shrink-0">{item.totalQuantidade}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 pt-2 border-t border-gray-200 dark:border-gray-600 mt-2">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total</span>
                    <span className="text-base font-bold text-gray-800 dark:text-gray-200">
                      {membroModal.itens.reduce((a, i) => a + i.totalQuantidade, 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Sub-component: KPI Card
// ─────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string;
  value: number | string;
  icon: string;
  suffix?: string;
  subtitle?: string;
  isText?: boolean;
}> = ({ label, value, icon, suffix, subtitle, isText }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-center gap-2 mb-2">
      {icon && <span className="text-base">{icon}</span>}
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-tight">{label}</span>
    </div>
    {isText ? (
      <p className="text-base font-bold text-gray-800 dark:text-gray-200 truncate">{value}</p>
    ) : (
      <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
        {value}{suffix}
      </p>
    )}
    {subtitle && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{subtitle}</p>}
  </div>
);

export default ServicosEstatisticasTab;

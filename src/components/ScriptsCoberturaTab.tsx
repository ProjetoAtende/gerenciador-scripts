// src/components/ScriptsCoberturaTab.tsx
// =====================================================
// Dashboard de Cobertura de Scripts por Categoria (v2 — Hierárquico)
// Fase 7 — Estatísticas por domínio (externo/interno) usando
// categorias_equipe + subcategorias_gse
// =====================================================

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import CoberturaHelpModal from './CoberturaHelpModal';

// =====================================================
// TIPOS
// =====================================================

interface TicketsPorCategoriaRow {
  categoria_equipe_slug: string;
  subcategoria_gse_slug: string | null;
  total_tickets: number;
}

interface CoberturaCategoria {
  slug: string;
  nome: string;
  icone: string;
  cor_hex: string;
  ordem: number;
  qtdScripts: number;
  qtdTickets: number;
  subcategorias: CoberturaSubcategoria[];
}

interface CoberturaSubcategoria {
  slug: string;
  nome: string;
  categoriaSlug: string;
  qtdScripts: number;
  qtdTickets: number;
}

interface ScriptsCoberturaTabProps {
  equipeId: string | null;
  visible: boolean;
}

type Ordenacao = 'mais-scripts' | 'mais-tickets' | 'mais-gaps' | 'menos-cobertura';
type FiltroDominio = 'todos' | 'externo' | 'interno';

// =====================================================
// COMPONENTE
// =====================================================

export const ScriptsCoberturaTab: React.FC<ScriptsCoberturaTabProps> = ({ visible }) => {
  const [cobertura, setCobertura] = useState<CoberturaCategoria[]>([]);
  const [totalScriptsUnicos, setTotalScriptsUnicos] = useState(0);
  const [totalTickets, setTotalTickets] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('mais-scripts');
  const [showHelp, setShowHelp] = useState(false);

  // ─── Filtro de domínio (v2 hierárquico) ──────────
  const [filtroDominio] = useState<FiltroDominio>('todos');

  // ─── Carregar dados ─────────────────────────────────────────
  const carregarCobertura = useCallback(async () => {
    setLoading(true);

    try {
      // Determinar domínio para queries
      const dominioParam = filtroDominio === 'todos' ? null : filtroDominio;
      const dominioScriptFilter = filtroDominio === 'todos' ? null : filtroDominio;

      // 1. Buscar em paralelo: categorias hierárquicas, scripts, scripts N:N, tickets
      let qPrimarios = supabase
        .from('scripts_customizados')
        .select('id, categoria_equipe_slug, subcategoria_gse_slug, dominio')
        .eq('deletado', false)
        .is('desativado_em', null)
        .not('categoria_equipe_slug', 'is', null);
      if (dominioScriptFilter) qPrimarios = qPrimarios.eq('dominio', dominioScriptFilter);

      let qSecundarios = supabase
        .from('scripts_categorias_adicionais')
        .select('script_id, categoria_equipe_slug, subcategoria_gse_slug, scripts_customizados!inner(dominio)')
        .eq('scripts_customizados.deletado', false)
        .is('scripts_customizados.desativado_em', null);
      if (dominioScriptFilter) qSecundarios = qSecundarios.eq('scripts_customizados.dominio', dominioScriptFilter);

      const [categoriasResult, scriptsPrimariosResult, categoriasSecResult, ticketsResult] = await Promise.all([
        supabase.rpc('obter_categorias_por_dominio', { p_dominio: dominioParam }),
        qPrimarios,
        qSecundarios,
        supabase.rpc('obter_tickets_por_categoria_hierarquica', { p_dominio: dominioParam }),
      ]);

      // Parse categorias hierárquicas do RPC
      const categoriasRaw: { slug: string; nome: string; icone: string; cor_hex: string; ordem: number; subcategorias: { slug: string; nome: string }[] }[] =
        categoriasResult.data
          ? (typeof categoriasResult.data === 'string' ? JSON.parse(categoriasResult.data) : categoriasResult.data)
          : [];

      const scriptsPrimarios = scriptsPrimariosResult.data || [];
      const categoriasAdicionais: { script_id: string; categoria_equipe_slug: string; subcategoria_gse_slug: string | null }[] =
        (categoriasSecResult.data || []).map((row: Record<string, unknown>) => ({
          script_id: row.script_id as string,
          categoria_equipe_slug: row.categoria_equipe_slug as string,
          subcategoria_gse_slug: row.subcategoria_gse_slug as string | null,
        }));

      // Parse tickets hierárquicos
      const ticketsRaw: TicketsPorCategoriaRow[] = ticketsResult.data
        ? (typeof ticketsResult.data === 'string' ? JSON.parse(ticketsResult.data) : ticketsResult.data)
        : [];
      const ticketsPorCat: Record<string, number> = {};
      const ticketsPorSubcat: Record<string, number> = {};
      let totalTicketsCalc = 0;
      ticketsRaw.forEach(t => {
        ticketsPorCat[t.categoria_equipe_slug] = (ticketsPorCat[t.categoria_equipe_slug] || 0) + t.total_tickets;
        totalTicketsCalc += t.total_tickets;
        if (t.subcategoria_gse_slug && t.subcategoria_gse_slug !== '__sem_sub__') {
          const key = `${t.categoria_equipe_slug}:${t.subcategoria_gse_slug}`;
          ticketsPorSubcat[key] = (ticketsPorSubcat[key] || 0) + t.total_tickets;
        }
      });
      setTotalTickets(totalTicketsCalc);

      // 2. Montar mapa: scripts por categoria e subcategoria (primárias + N:N)
      const scriptsPorCat: Record<string, Set<string>> = {};
      const scriptsPorSubcat: Record<string, Set<string>> = {};

      scriptsPrimarios.forEach((s: { id: string; categoria_equipe_slug: string | null; subcategoria_gse_slug: string | null }) => {
        if (!s.categoria_equipe_slug) return;
        if (!scriptsPorCat[s.categoria_equipe_slug]) scriptsPorCat[s.categoria_equipe_slug] = new Set();
        scriptsPorCat[s.categoria_equipe_slug].add(s.id);

        if (s.subcategoria_gse_slug) {
          const key = `${s.categoria_equipe_slug}:${s.subcategoria_gse_slug}`;
          if (!scriptsPorSubcat[key]) scriptsPorSubcat[key] = new Set();
          scriptsPorSubcat[key].add(s.id);
        }
      });

      categoriasAdicionais.forEach(sa => {
        if (!sa.categoria_equipe_slug) return;
        if (!scriptsPorCat[sa.categoria_equipe_slug]) scriptsPorCat[sa.categoria_equipe_slug] = new Set();
        scriptsPorCat[sa.categoria_equipe_slug].add(sa.script_id);

        if (sa.subcategoria_gse_slug) {
          const key = `${sa.categoria_equipe_slug}:${sa.subcategoria_gse_slug}`;
          if (!scriptsPorSubcat[key]) scriptsPorSubcat[key] = new Set();
          scriptsPorSubcat[key].add(sa.script_id);
        }
      });

      // 3. Montar resultado final
      const resultados: CoberturaCategoria[] = categoriasRaw.map((cat, idx) => {
        const subcats = cat.subcategorias || [];

        // Deduplicate subcategorias by slug
        const seenSubs = new Set<string>();
        const subcatsDedup = subcats.filter(s => {
          if (seenSubs.has(s.slug)) return false;
          seenSubs.add(s.slug);
          return true;
        });

        const subcoberturas: CoberturaSubcategoria[] = subcatsDedup.map(sub => ({
          slug: sub.slug,
          nome: sub.nome,
          categoriaSlug: cat.slug,
          qtdScripts: scriptsPorSubcat[`${cat.slug}:${sub.slug}`]?.size || 0,
          qtdTickets: ticketsPorSubcat[`${cat.slug}:${sub.slug}`] || 0,
        }));

        // Scripts sem subcategoria (na categoria mas sem sub atribuída)
        const idsNaCat = scriptsPorCat[cat.slug] || new Set<string>();
        const idsNasSubs = new Set<string>();
        subcatsDedup.forEach(sub => {
          const key = `${cat.slug}:${sub.slug}`;
          scriptsPorSubcat[key]?.forEach(id => idsNasSubs.add(id));
        });
        const idsSemSub = [...idsNaCat].filter(id => !idsNasSubs.has(id));

        if (idsSemSub.length > 0) {
          subcoberturas.push({
            slug: '__sem_subcategoria__',
            nome: 'Sem subcategoria',
            categoriaSlug: cat.slug,
            qtdScripts: idsSemSub.length,
            qtdTickets: 0,
          });
        }

        return {
          slug: cat.slug,
          nome: cat.nome,
          icone: cat.icone || '🏷️',
          cor_hex: cat.cor_hex || '#6B7280',
          ordem: cat.ordem ?? idx,
          qtdScripts: scriptsPorCat[cat.slug]?.size || 0,
          qtdTickets: ticketsPorCat[cat.slug] || 0,
          subcategorias: subcoberturas,
        };
      });

      // Contar scripts únicos globais
      const todosIds = new Set<string>();
      Object.values(scriptsPorCat).forEach(s => s.forEach(id => todosIds.add(id)));
      setTotalScriptsUnicos(todosIds.size);

      setCobertura(resultados);
    } catch (err) {
      console.error('[Cobertura] Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, [filtroDominio]);

  // Recarregar quando domínio muda ou aba fica visível
  useEffect(() => {
    if (visible) {
      carregarCobertura();
    }
  }, [visible, carregarCobertura]);

  // ─── Ordenação ──────────────────────────────────────────────
  const coberturaOrdenada = useMemo(() => {
    const lista = [...cobertura];
    switch (ordenacao) {
      case 'mais-scripts':
        return lista.sort((a, b) => b.qtdScripts - a.qtdScripts || a.ordem - b.ordem);
      case 'mais-tickets':
        return lista.sort((a, b) => b.qtdTickets - a.qtdTickets || a.ordem - b.ordem);
      case 'menos-cobertura': {
        const getPct = (c: CoberturaCategoria) => {
          const reais = c.subcategorias.filter(s => s.slug !== '__sem_subcategoria__');
          if (reais.length === 0) return 0;
          return reais.filter(s => s.qtdScripts > 0).length / reais.length;
        };
        return lista.sort((a, b) => getPct(a) - getPct(b) || a.ordem - b.ordem);
      }
      case 'mais-gaps': {
        const getGapScore = (c: CoberturaCategoria) =>
          c.subcategorias.filter(s => s.slug !== '__sem_subcategoria__' && s.qtdScripts === 0).length * 1000 + (c.qtdScripts === 0 ? 1 : 0);
        return lista.sort((a, b) => getGapScore(b) - getGapScore(a) || a.ordem - b.ordem);
      }
      default:
        return lista.sort((a, b) => a.ordem - b.ordem);
    }
  }, [cobertura, ordenacao]);

  // ─── Toggle expansão ───────────────────────────────────────
  const toggleExpandir = (slug: string) => {
    setExpandidas(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const expandirTodas = () => {
    setExpandidas(new Set(cobertura.map(c => c.slug)));
  };

  const recolherTodas = () => {
    setExpandidas(new Set());
  };

  // ─── Métricas globais ──────────────────────────────────────
  const metricas = useMemo(() => {
    const totalSubcats = cobertura.reduce((acc, c) => acc + c.subcategorias.filter(s => s.slug !== '__sem_subcategoria__').length, 0);
    const subcatsCom = cobertura.reduce(
      (acc, c) => acc + c.subcategorias.filter(s => s.slug !== '__sem_subcategoria__' && s.qtdScripts > 0).length, 0
    );
    const catsSemScripts = cobertura.filter(c => c.qtdScripts === 0).length;
    const pctCobertura = totalSubcats > 0 ? Math.round((subcatsCom / totalSubcats) * 100) : 0;

    return { totalSubcats, subcatsCom, catsSemScripts, pctCobertura };
  }, [cobertura]);

  // ─── Helpers visuais ───────────────────────────────────────

  function getStatusBadge(qtdScripts: number): { label: string; className: string } {
    if (qtdScripts === 0) {
      return { label: 'VAZIO', className: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-700' };
    }
    if (qtdScripts < 3) {
      return { label: 'BAIXO', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' };
    }
    return { label: 'OK', className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' };
  }

  function getProgressBar(subcategorias: CoberturaSubcategoria[]): { cobertas: number; total: number; pct: number } {
    const reais = subcategorias.filter(s => s.slug !== '__sem_subcategoria__');
    if (reais.length === 0) return { cobertas: 0, total: 0, pct: 0 };
    const cobertas = reais.filter(s => s.qtdScripts > 0).length;
    return { cobertas, total: reais.length, pct: Math.round((cobertas / reais.length) * 100) };
  }

  // ─── Loading / hidden ──────────────────────────────────────
  if (!visible) return null;

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-4 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-64" />
          <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-12" />
            </div>
          ))}
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded w-48" />
              <div className="flex-1" />
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24" />
              <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-16" />
            </div>
            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-6 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          📊 Cobertura de Scripts por Categoria
          <button
            onClick={() => setShowHelp(true)}
            className="ml-1 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-gray-500 dark:text-gray-300 hover:text-indigo-600 text-xs font-bold transition-colors"
            title="Ajuda sobre esta aba"
          >
            ?
          </button>
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
            className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-200 cursor-pointer focus:ring-2 focus:ring-blue-500"
          >
            <option value="mais-scripts">📜 Mais scripts</option>
            <option value="mais-tickets">🎫 Mais tickets</option>
            <option value="menos-cobertura">📊 Menor cobertura</option>
            <option value="mais-gaps">⚠️ Mais gaps</option>
          </select>
          <button
            onClick={expandidas.size > 0 ? recolherTodas : expandirTodas}
            className="px-2.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
          >
            {expandidas.size > 0 ? '▼ Recolher' : '▶ Expandir'}
          </button>
        </div>
      </div>

      {/* Cards de métricas globais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center">
          <div className="text-xs text-blue-500 dark:text-blue-400 font-medium">Scripts classificados</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalScriptsUnicos}</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-center">
          <div className="text-xs text-purple-500 dark:text-purple-400 font-medium">Tickets categorizados</div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{totalTickets.toLocaleString('pt-BR')}</div>
        </div>
        <div className={`border rounded-lg p-3 text-center ${
          metricas.pctCobertura > 50 ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800'
        }`}>
          <div className={`text-xs font-medium ${metricas.pctCobertura > 50 ? 'text-green-500 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
            Cobertura subcats
          </div>
          <div className={`text-2xl font-bold ${metricas.pctCobertura > 50 ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
            {metricas.pctCobertura}%
          </div>
          <div className="text-[10px] text-gray-400 dark:text-gray-500">{metricas.subcatsCom}/{metricas.totalSubcats}</div>
        </div>
        <div className={`border rounded-lg p-3 text-center ${
          metricas.catsSemScripts > 0 ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800' : 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
        }`}>
          <div className={`text-xs font-medium ${metricas.catsSemScripts > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-green-500 dark:text-green-400'}`}>
            Cats sem scripts
          </div>
          <div className={`text-2xl font-bold ${metricas.catsSemScripts > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-green-700 dark:text-green-300'}`}>
            {metricas.catsSemScripts}
          </div>
          <div className="text-[10px] text-gray-400 dark:text-gray-500">de {cobertura.length} categorias</div>
        </div>
      </div>

      {/* Lista de categorias */}
      {coberturaOrdenada.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-300">
          <div className="text-4xl mb-3">📭</div>
          <p className="font-medium">Nenhum dado de cobertura disponível</p>
          <p className="text-sm mt-1">Verifique se os scripts estão classificados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {coberturaOrdenada.map((cat) => {
            const status = getStatusBadge(cat.qtdScripts);
            const progress = getProgressBar(cat.subcategorias);
            const isExpanded = expandidas.has(cat.slug);

            return (
              <div
                key={cat.slug}
                className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 rounded-lg overflow-hidden transition-colors"
              >
                {/* Linha da categoria */}
                <button
                  onClick={() => toggleExpandir(cat.slug)}
                  className="w-full flex items-center gap-2 md:gap-3 p-3 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg"
                >
                  {/* Seta */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`shrink-0 transition-transform duration-200 text-gray-400 dark:text-gray-500 ${isExpanded ? 'rotate-90' : ''}`}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>

                  {/* Ícone + nome */}
                  <span className="text-lg shrink-0">{cat.icone}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 truncate">{cat.nome}</span>

                  {/* Spacer */}
                  <div className="flex-1 min-w-0" />

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md text-xs font-medium" title="Scripts nesta categoria">
                      <span>📜</span>
                      <span>{cat.qtdScripts}</span>
                    </div>

                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                      cat.qtdTickets > 0 ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500'
                    }`} title="Tickets nesta categoria">
                      <span>🎫</span>
                      <span>{cat.qtdTickets.toLocaleString('pt-BR')}</span>
                    </div>

                    {cat.subcategorias.length > 0 && (
                      <div className="hidden md:flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md shrink-0" title={`${progress.cobertas}/${progress.total} subcategorias cobertas`}>
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              progress.pct >= 80 ? 'bg-green-500'
                                : progress.pct >= 40 ? 'bg-yellow-500'
                                  : progress.pct > 0 ? 'bg-orange-500'
                                    : 'bg-gray-300'
                            }`}
                            style={{ width: `${progress.pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-300 font-medium w-7 text-right">{progress.pct}%</span>
                      </div>
                    )}
                  </div>

                  {/* Badge de status */}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${status.className}`}>
                    {status.label}
                  </span>
                </button>

                {/* Subcategorias expandidas */}
                {isExpanded && cat.subcategorias.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50">
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {cat.subcategorias
                        .sort((a, b) => b.qtdScripts - a.qtdScripts)
                        .map((sub) => {
                          const subStatus = getStatusBadge(sub.qtdScripts);
                          const isVirtual = sub.slug === '__sem_subcategoria__';

                          return (
                            <div key={sub.slug} className={`flex items-center gap-2 px-4 py-2 text-sm ${isVirtual ? 'bg-gray-100/60 dark:bg-gray-700/60 border-t border-dashed border-gray-200 dark:border-gray-600' : ''}`}>
                              <span className="text-gray-300 dark:text-gray-600 text-xs shrink-0 w-5 text-center select-none">{isVirtual ? '└─' : '├─'}</span>
                              <span className={`truncate ${isVirtual ? 'italic text-gray-400 dark:text-gray-500' : sub.qtdScripts > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                                {sub.nome}
                              </span>
                              <div className="flex-1" />
                              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                                {sub.qtdScripts} script{sub.qtdScripts !== 1 ? 's' : ''}
                              </span>
                              {sub.qtdTickets > 0 && (
                                <span className="text-xs text-purple-400 shrink-0" title="Tickets nesta subcategoria">
                                  🎫 {sub.qtdTickets.toLocaleString('pt-BR')}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${subStatus.className}`}>
                                {subStatus.label}
                              </span>
                            </div>
                          );
                        })}
                    </div>

                    {/* Resumo de subcategorias */}
                    <div className="flex items-center gap-2 px-4 py-2 text-[11px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                      <span>{progress.cobertas} de {progress.total} subcategorias com script(s)</span>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <span>{cat.subcategorias.filter(s => s.qtdScripts === 0 && s.slug !== '__sem_subcategoria__').length} sem cobertura</span>
                    </div>
                  </div>
                )}

                {/* Caso sem subcategorias */}
                {isExpanded && cat.subcategorias.length === 0 && (
                  <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 text-sm text-gray-400 dark:text-gray-500 italic bg-gray-50/50 dark:bg-gray-700/50">
                    Nenhuma subcategoria cadastrada para esta categoria.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legenda */}
      <div className="flex items-center gap-4 text-[11px] text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-700 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-full" /> OK = ≥3 scripts
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 bg-yellow-500 rounded-full" /> BAIXO = 1-2 scripts
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 bg-gray-400 rounded-full" /> VAZIO = 0 scripts
        </span>
      </div>

      {/* Modal de ajuda */}
      <CoberturaHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
};

export default ScriptsCoberturaTab;

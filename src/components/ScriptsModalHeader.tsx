// src/components/ScriptsModalHeader.tsx — Header + busca + filtros do ScriptsModal
import React from 'react';
import type { FiltroCuradoria, ViewMode } from '../hooks/useScriptsModal';
import { SCRIPT_INSTANCIA_OPTIONS } from '../types/Script';
import type { ScriptInstancia } from '../types/Script';

interface ScriptsModalHeaderProps {
  busca: string;
  setBusca: (v: string) => void;
  executarBuscaSemantica: () => void;
  semanticLoading?: boolean;
  semanticActive?: boolean;
  semanticCount?: number;
  semanticError?: string | null;
  buscaReferencia: string;
  setBuscaReferencia: (v: string) => void;
  buscaAutor: string;
  setBuscaAutor: (v: string) => void;
  showAutorSuggestions: boolean;
  setShowAutorSuggestions: (v: boolean) => void;
  sugestoesAutor: { nome: string; userId: string }[];
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  showFiltrosPanel: boolean;
  setShowFiltrosPanel: (v: boolean) => void;
  setShowHelpModal: (v: boolean) => void;
  onClose: () => void;
  // Filter state
  ordenacaoData: 'mais-novo' | 'mais-antigo';
  setOrdenacaoData: (v: 'mais-novo' | 'mais-antigo') => void;
  filtroTipo: 'todos' | 'temporario' | 'permanente';
  setFiltroTipo: (v: 'todos' | 'temporario' | 'permanente') => void;
  filtroAtendente: 'todos' | 'com-atendente' | 'sem-atendente';
  setFiltroAtendente: (v: 'todos' | 'com-atendente' | 'sem-atendente') => void;
  filtroN1: 'todos' | 'n1' | 'nao-n1';
  setFiltroN1: (v: 'todos' | 'n1' | 'nao-n1') => void;
  filtroValidacaoEnvio: 'todos' | 'validado-n1' | 'enviado-n1';
  setFiltroValidacaoEnvio: (v: 'todos' | 'validado-n1' | 'enviado-n1') => void;
  isEquipe21OuAdmin: boolean;
  filtroEquipeId: string | null;
  setFiltroEquipeId: (v: string | null) => void;
  equipesDisponiveis: { id: string; nome: string }[];
  filtroCategoria: string;
  setFiltroCategoria: (v: string) => void;
  filtroSubcategoria: string;
  setFiltroSubcategoria: (v: string) => void;
  filtroDominio: string;
  setFiltroDominio: (v: string) => void;
  filtroInstancia: 'todos' | ScriptInstancia;
  setFiltroInstancia: (v: 'todos' | ScriptInstancia) => void;
  categoriasDisponiveis: { slug: string; nome: string; icone: string }[];
  subcategoriasDisponiveis: { slug: string; nome: string }[];
  contagemPorCategoria: Map<string, number>;
  contagemPorSubcategoria: Map<string, number>;
  filtroTipoRequisitante: string;
  setFiltroTipoRequisitante: (v: string) => void;
  tiposRequisitanteDisponiveis: string[];
  filtroCuradoria: FiltroCuradoria;
  setFiltroCuradoria: (v: FiltroCuradoria) => void;
  // Count labels
  countCuradoria: number;
  countCuradoriaTotal: number;
  countTemporarios: number;
  countComAtendente: number;
  countNaoRevisadosLabel: string;
  countRevisadosLabel: string;
  countRevisaoSolicitadaLabel: string;
  countExclusaoSolicitadaLabel: string;
  scripts: { deletado?: boolean; equipe_id?: string; instancia?: string | null }[];
}

export const ScriptsModalHeader = React.memo<ScriptsModalHeaderProps>(function ScriptsModalHeader(props) {
  const {
    busca, setBusca, executarBuscaSemantica, buscaReferencia, setBuscaReferencia,
    semanticLoading, semanticActive, semanticCount, semanticError,
    buscaAutor, setBuscaAutor, showAutorSuggestions, setShowAutorSuggestions, sugestoesAutor,
    viewMode, setViewMode, showFiltrosPanel, setShowFiltrosPanel,
    setShowHelpModal, onClose,
    ordenacaoData, setOrdenacaoData, filtroTipo, setFiltroTipo,
    filtroAtendente, setFiltroAtendente, filtroN1, setFiltroN1,
    filtroValidacaoEnvio, setFiltroValidacaoEnvio, isEquipe21OuAdmin,
    filtroEquipeId, setFiltroEquipeId, equipesDisponiveis,
    filtroCategoria, setFiltroCategoria, filtroSubcategoria, setFiltroSubcategoria,
    setFiltroDominio,
    filtroInstancia, setFiltroInstancia,
    categoriasDisponiveis, subcategoriasDisponiveis, contagemPorCategoria, contagemPorSubcategoria,
    filtroTipoRequisitante, setFiltroTipoRequisitante, tiposRequisitanteDisponiveis,
    filtroCuradoria, setFiltroCuradoria,
    countCuradoria, countCuradoriaTotal, countTemporarios, countComAtendente,
    countNaoRevisadosLabel, countRevisadosLabel, countRevisaoSolicitadaLabel, countExclusaoSolicitadaLabel,
    scripts,
  } = props;

  const activeFilterCount = [
    ordenacaoData !== 'mais-novo',
    filtroTipo !== 'todos',
    filtroAtendente !== 'todos',
    filtroTipoRequisitante !== 'todos',
    filtroInstancia !== 'todos',
    filtroEquipeId !== null,
    filtroCuradoria !== 'todos',
    filtroCategoria !== 'todos',
    filtroSubcategoria !== 'todos',
    filtroN1 !== 'todos',
    filtroValidacaoEnvio !== 'todos',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setOrdenacaoData('mais-novo');
    setFiltroTipo('todos');
    setFiltroAtendente('todos');
    setFiltroTipoRequisitante('todos');
    setFiltroInstancia('todos');
    setFiltroEquipeId(null);
    setFiltroCuradoria('todos');
    setFiltroDominio('todos');
    setFiltroCategoria('todos');
    setFiltroSubcategoria('todos');
    setFiltroN1('todos');
    setFiltroValidacaoEnvio('todos');
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700">
      {/* Linha principal: Título + Busca + Botão Filtros + Fechar */}
      <div className="flex items-center gap-2 lg:gap-3 p-3 lg:p-4">
        <div className="flex items-center gap-1.5 shrink-0">
          <h2 className="text-lg lg:text-xl font-bold">Scripts</h2>
          <button
            onClick={() => setShowHelpModal(true)}
            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            title="Ajuda - Como usar Scripts"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <path d="M12 17h.01"/>
            </svg>
          </button>
        </div>

        {/* Campos de busca */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[260px] max-w-2xl">
            <input
              type="text"
              placeholder="Buscar por título ou conteúdo (semântica)..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  executarBuscaSemantica();
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                  setBusca('');
                }
              }}
              className="w-full pl-2.5 pr-20 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              title="Digite e pressione Enter para executar a busca semântica (embeddings) sobre todo o conteúdo dos scripts ativos."
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
              {semanticLoading && (
                <span
                  className="inline-block w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
                  title="Buscando por similaridade..."
                />
              )}
              {!semanticLoading && semanticActive && busca.trim().length >= 3 && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  title={`Busca semântica retornou ${semanticCount ?? 0} resultados`}
                >
                  ✨{semanticCount ?? 0}
                </span>
              )}
              {!semanticLoading && semanticError && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  title={`Erro na busca semântica (usando filtro local): ${semanticError}`}
                >
                  ⚠︎
                </span>
              )}
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  className="pointer-events-auto text-gray-400 hover:text-gray-600 text-sm"
                  title="Limpar"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="relative">
            <input type="text" placeholder="Ref #..." value={buscaReferencia}
              onChange={(e) => setBuscaReferencia(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter' && buscaReferencia) e.currentTarget.blur(); if (e.key === 'Escape') setBuscaReferencia(''); }}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent w-20 lg:w-24 text-center text-sm dark:bg-gray-700 dark:text-gray-200"
              title="Digite o número de referência e pressione Enter" />
            {buscaReferencia && (
              <button onClick={() => setBuscaReferencia('')} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600" title="Limpar">✕</button>
            )}
          </div>
          <div className="relative">
            <input type="text" placeholder="Buscar autor..." value={buscaAutor}
              onChange={(e) => { setBuscaAutor(e.target.value); setShowAutorSuggestions(true); }}
              onFocus={() => setShowAutorSuggestions(true)}
              onBlur={() => setTimeout(() => setShowAutorSuggestions(false), 200)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setBuscaAutor(''); setShowAutorSuggestions(false); } }}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent w-32 lg:w-40 text-sm dark:bg-gray-700 dark:text-gray-200" />
            {buscaAutor && (
              <button onClick={() => setBuscaAutor('')} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10" title="Limpar">✕</button>
            )}
            {showAutorSuggestions && sugestoesAutor.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 max-h-40 overflow-y-auto">
                {sugestoesAutor.map((autor) => (
                  <button key={autor.userId} className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm transition-colors"
                    onClick={() => { setBuscaAutor(autor.nome); setShowAutorSuggestions(false); }}>
                    <span className="text-purple-600">👤</span> {autor.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Toggle Lista / Cobertura */}
        <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-md p-0.5 shrink-0">
          <button onClick={() => setViewMode('lista')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${viewMode === 'lista' ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-200 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'}`}
            title="Lista de Scripts">📜 Scripts</button>
          <button onClick={() => { setViewMode('cobertura'); setShowFiltrosPanel(false); }}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${viewMode === 'cobertura' ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-200 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'}`}
            title="Dashboard de Cobertura">📊 Cobertura</button>
        </div>

        {/* Botão Filtros */}
        {viewMode === 'lista' && <button
          onClick={() => setShowFiltrosPanel(!showFiltrosPanel)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shrink-0 ${
            showFiltrosPanel ? 'bg-blue-100 text-blue-700 border border-blue-300'
            : activeFilterCount > 0 ? 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title={showFiltrosPanel ? 'Recolher filtros' : 'Expandir filtros'}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="12" y1="18" x2="20" y2="18"/>
          </svg>
          Filtros
          {activeFilterCount > 0 && (
            <span className="bg-blue-500 text-white text-[10px] font-bold w-4.5 h-4.5 flex items-center justify-center rounded-full leading-none min-w-[18px] min-h-[18px]">{activeFilterCount}</span>
          )}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-200 ${showFiltrosPanel ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>}

        <button onClick={onClose} className="bg-gray-300 dark:bg-gray-600 dark:text-gray-100 px-3 py-1.5 rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm shrink-0">Fechar</button>
      </div>

      {/* Painel de filtros colapsável */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showFiltrosPanel && viewMode === 'lista' ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="flex items-center gap-2 lg:gap-3 flex-wrap px-3 lg:px-4 pb-3 lg:pb-4 pt-1">
          {/* Ordenação */}
          <div className="flex flex-col">
            <span className="app-filter-label">Ordenação</span>
            <select value={ordenacaoData} onChange={(e) => setOrdenacaoData(e.target.value as any)}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 dark:text-gray-200 cursor-pointer">
              <option value="mais-novo">📅 Mais novos</option>
              <option value="mais-antigo">📅 Mais antigos</option>
            </select>
          </div>

          {/* Tipo */}
          <div className="flex flex-col">
            <span className="app-filter-label">Permanência</span>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as any)}
              className={`px-2.5 py-1.5 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 dark:text-gray-200 cursor-pointer ${filtroTipo === 'temporario' ? 'border-orange-400 bg-orange-50' : filtroTipo === 'permanente' ? 'border-blue-400 bg-blue-50' : 'border-gray-300 dark:border-gray-600'}`}>
              <option value="todos">📋 Todos</option>
              <option value="temporario">⏳ Temporários{countTemporarios > 0 ? ` (${countTemporarios})` : ''}</option>
              <option value="permanente">📌 Permanentes</option>
            </select>
          </div>

          {/* Atendente */}
          <div className="flex flex-col">
            <span className="app-filter-label">Scripts para Atendente</span>
            <select value={filtroAtendente} onChange={(e) => setFiltroAtendente(e.target.value as any)}
              className={`px-2.5 py-1.5 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 dark:text-gray-200 cursor-pointer ${filtroAtendente === 'com-atendente' ? 'border-orange-400 bg-orange-50' : filtroAtendente === 'sem-atendente' ? 'border-gray-400 bg-gray-50' : 'border-gray-300 dark:border-gray-600'}`}>
              <option value="todos">🛠️ Todos</option>
              <option value="com-atendente">🛠️ Com Script{countComAtendente > 0 ? ` (${countComAtendente})` : ''}</option>
              <option value="sem-atendente">📋 Sem Script</option>
            </select>
          </div>

          {/* N1 */}
          <div className="flex flex-col">
            <span className="app-filter-label">N1</span>
            <select value={filtroN1} onChange={(e) => { const val = e.target.value as any; setFiltroN1(val); if (val !== 'n1') setFiltroValidacaoEnvio('todos'); }}
              className={`px-2.5 py-1.5 border rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 dark:text-gray-200 cursor-pointer ${filtroN1 === 'n1' ? 'border-cyan-400 bg-cyan-50' : filtroN1 === 'nao-n1' ? 'border-gray-400 bg-gray-50' : 'border-gray-300 dark:border-gray-600'}`}>
              <option value="todos">🏷️ Todos</option>
              <option value="n1">✅ N1</option>
              <option value="nao-n1">❌ Não N1</option>
            </select>
          </div>

          {/* Validação e Envio N1 */}
          {filtroN1 === 'n1' && isEquipe21OuAdmin && (
            <div className="flex flex-col">
              <span className="app-filter-label">Validação e Envio</span>
              <select value={filtroValidacaoEnvio} onChange={(e) => setFiltroValidacaoEnvio(e.target.value as any)}
                className={`px-2.5 py-1.5 border rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 dark:text-gray-200 cursor-pointer ${filtroValidacaoEnvio === 'validado-n1' ? 'border-teal-400 bg-teal-50' : filtroValidacaoEnvio === 'enviado-n1' ? 'border-green-400 bg-green-50' : 'border-gray-300 dark:border-gray-600'}`}>
                <option value="todos">📋 Todos</option>
                <option value="validado-n1">✅ Validado N1</option>
                <option value="enviado-n1">📤 Enviado N1</option>
              </select>
            </div>
          )}

          {/* Equipe */}
          <div className="flex flex-col">
            <span className="app-filter-label">Equipe</span>
            <select value={filtroEquipeId || ''} onChange={(e) => setFiltroEquipeId(e.target.value || null)}
              className={`px-2.5 py-1.5 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 dark:text-gray-200 cursor-pointer ${filtroEquipeId ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 dark:border-gray-600'}`}>
              <option value="">🏢 Todas as equipes</option>
              {equipesDisponiveis.map((equipe) => (<option key={equipe.id} value={equipe.id}>{equipe.nome}</option>))}
            </select>
          </div>

          {/* Instância */}
          <div className="flex flex-col">
            <span className="app-filter-label">Instância</span>
            <select value={filtroInstancia} onChange={(e) => setFiltroInstancia(e.target.value as 'todos' | ScriptInstancia)}
              className={`px-2.5 py-1.5 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 dark:text-gray-200 cursor-pointer ${filtroInstancia !== 'todos' ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-500 dark:text-indigo-100' : 'border-gray-300 dark:border-gray-600'}`}>
              <option value="todos">⚖️ Todas</option>
              {SCRIPT_INSTANCIA_OPTIONS.map((instancia) => (
                <option key={instancia} value={instancia}>{instancia}</option>
              ))}
            </select>
          </div>

          {/* Categoria */}
          <div className="flex flex-col">
            <span className="app-filter-label">Categoria</span>
            <select value={filtroCategoria} onChange={(e) => { setFiltroCategoria(e.target.value); setFiltroSubcategoria('todos'); }}
              className={`px-2.5 py-1.5 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 dark:text-gray-200 cursor-pointer ${filtroCategoria !== 'todos' ? 'border-purple-400 bg-purple-50' : 'border-gray-300 dark:border-gray-600'}`}>
              <option value="todos">🏷️ Todas ({scripts.filter(s => !s.deletado && (!filtroEquipeId || s.equipe_id === filtroEquipeId) && (filtroInstancia === 'todos' || s.instancia === filtroInstancia)).length})</option>
              <option value="sem_categoria">⚠️ Sem categoria{contagemPorCategoria.get('sem_categoria') ? ` (${contagemPorCategoria.get('sem_categoria')})` : ''}</option>
              {categoriasDisponiveis.map((cat) => (<option key={cat.slug} value={cat.slug}>{cat.icone} {cat.nome}{contagemPorCategoria.get(cat.slug) ? ` (${contagemPorCategoria.get(cat.slug)})` : ''}</option>))}
            </select>
          </div>

          {/* Subcategoria */}
          <div className="flex flex-col">
            <span className="app-filter-label">Subcategoria</span>
            <select value={filtroSubcategoria} onChange={(e) => setFiltroSubcategoria(e.target.value)}
              disabled={filtroCategoria === 'sem_categoria'}
              className={`px-2.5 py-1.5 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 dark:text-gray-200 cursor-pointer ${filtroSubcategoria !== 'todos' ? 'border-purple-400 bg-purple-50' : 'border-gray-300 dark:border-gray-600'} ${filtroCategoria === 'sem_categoria' ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <option value="todos">📑 Todas</option>
              <option value="sem_subcategoria">⚠️ Sem subcategoria{contagemPorSubcategoria.get('sem_subcategoria') ? ` (${contagemPorSubcategoria.get('sem_subcategoria')})` : ''}</option>
              {subcategoriasDisponiveis.map((sub) => (<option key={sub.slug} value={sub.slug}>{sub.nome}{contagemPorSubcategoria.get(sub.slug) ? ` (${contagemPorSubcategoria.get(sub.slug)})` : ''}</option>))}
            </select>
          </div>

          {/* Tipo Requisitante */}
          <div className="flex flex-col">
            <span className="app-filter-label">Tipo Requisitante</span>
            <select value={filtroTipoRequisitante} onChange={(e) => setFiltroTipoRequisitante(e.target.value)}
              className={`px-2.5 py-1.5 border rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 dark:text-gray-200 cursor-pointer ${filtroTipoRequisitante !== 'todos' ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 dark:border-gray-600'}`}>
              <option value="todos">🛡️ Todos</option>
              {tiposRequisitanteDisponiveis.map((tipo) => (<option key={tipo} value={tipo}>{tipo}</option>))}
            </select>
          </div>

          {/* Curadoria */}
          <div className="flex flex-col">
            <span className="app-filter-label">Revisão</span>
            <div className="flex items-center gap-2">
              <select value={filtroCuradoria} onChange={(e) => setFiltroCuradoria(e.target.value as any)}
                className={`px-2.5 py-1.5 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 dark:text-gray-200 cursor-pointer ${
                  filtroCuradoria === 'nao-revisados' ? 'border-orange-400 bg-orange-50'
                  : filtroCuradoria === 'revisados' ? 'border-green-400 bg-green-50'
                  : filtroCuradoria === 'revisao-solicitada' ? 'border-yellow-400 bg-yellow-50 text-yellow-800'
                  : filtroCuradoria === 'exclusao-solicitada' ? 'border-red-400 bg-red-50 text-red-800'
                  : 'border-gray-300 dark:border-gray-600'}`}>
                <option value="todos">🔖 Curadoria</option>
                <option value="nao-revisados">🔍 Não Revisados{countNaoRevisadosLabel}</option>
                <option value="revisados">✅ Revisados{countRevisadosLabel}</option>
                <option value="revisao-solicitada">⏳ Revisão Solicitada{countRevisaoSolicitadaLabel}</option>
                <option value="exclusao-solicitada">🗑️ Exclusão{countExclusaoSolicitadaLabel}</option>
              </select>
              {filtroCuradoria !== 'todos' && countCuradoriaTotal > 0 && (
                <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-full ${filtroCuradoria === 'nao-revisados' ? 'bg-orange-500' : filtroCuradoria === 'revisao-solicitada' ? 'bg-yellow-500' : filtroCuradoria === 'exclusao-solicitada' ? 'bg-red-500' : 'bg-green-500'}`}
                  title={filtroEquipeId ? `${countCuradoria} de ${countCuradoriaTotal} total` : `${countCuradoria} scripts`}>
                  {filtroEquipeId ? `${countCuradoria}/${countCuradoriaTotal}` : countCuradoria}
                </span>
              )}
            </div>
          </div>

          {/* Limpar Filtros */}
          {activeFilterCount > 0 && (
            <div className="flex flex-col justify-end">
              <span className="text-[10px] text-transparent mb-0.5 leading-tight select-none">&nbsp;</span>
              <button onClick={clearFilters}
                className="px-2.5 py-1.5 text-sm text-red-600 hover:bg-red-50 border border-red-300 rounded-md transition-colors whitespace-nowrap">
                ✕ Limpar filtros
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

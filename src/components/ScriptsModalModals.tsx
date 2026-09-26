// src/components/ScriptsModalModals.tsx — Todos os sub-modais do ScriptsModal
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScriptFolderWithChildren, ScriptItem } from '../types/Script';
import type { ScriptSavePayload } from './ScriptEditorFullscreen';
import type { PropostaRevisao, RevisaoCuradoriaData, ContestacaoCuradoriaData } from '../hooks/useScriptsModal';
import { supabase } from '../services/supabaseClient';
import { buscarPropostaPorId } from '../services/scriptVersioningService';

// Lazy imports para modais (tree-shaking)
import { OrientacaoPosSalvarScriptModal } from './OrientacaoPosSalvarScriptModal';
import { ConfirmPublicarScriptModal } from './ConfirmPublicarScriptModal';
import { scriptExigeAprovacaoExclusao } from '../services/scriptExclusaoService';
import { ConfirmLocationModal } from './ConfirmLocationModal';
import { SelecionarTipoEdicaoModal } from './SelecionarTipoEdicaoModal';
import { PropostaMotivacaoModal } from './PropostaMotivacaoModal';
import { AnalisarPropostaModal } from './AnalisarPropostaModal';
import { PropostaRejeitadaModal } from './PropostaRejeitadaModal';
import { HistoricoVersoesModal } from './HistoricoVersoesModal';
import { ClassificarEdicaoCuradoriaModal } from './ClassificarEdicaoCuradoriaModal';
import { RevisarAlteracaoCuradoriaModal } from './RevisarAlteracaoCuradoriaModal';
import { AnalisarContestacaoModal } from './AnalisarContestacaoModal';
import { ConfirmarExclusaoScriptModal } from './ConfirmarExclusaoScriptModal';
import { AprovarExclusaoScriptModal } from './AprovarExclusaoScriptModal';
import { ScriptsHelpModal } from './ScriptsHelpModal';
import { ScriptEditorFullscreen } from './ScriptEditorFullscreen';

interface ScriptsModalModalsProps {
  // Folder modals
  showCreateFolderModal: boolean; setShowCreateFolderModal: (v: boolean) => void;
  newFolderName: string; setNewFolderName: (v: string) => void;
  newFolderIcon: string; setNewFolderIcon: (v: string) => void;
  handleCreateFolder: () => void;
  selectedFolderId: string | null;
  folders: any[];
  showEditFolderModal: boolean; setShowEditFolderModal: (v: boolean) => void;
  editFolderName: string; setEditFolderName: (v: string) => void;
  editFolderIcon: string; setEditFolderIcon: (v: string) => void;
  handleEditFolder: () => void;
  editFolderId: string | null;
  showMoveModal: boolean; setShowMoveModal: (v: boolean) => void;
  moveScriptToFolder: (folderId: string | null) => void;
  showDeleteFolderModal: boolean; setShowDeleteFolderModal: (v: boolean) => void;
  folderToDelete: { id: string; name: string; scriptCount: number } | null;
  setFolderToDelete: (v: any) => void;
  confirmDeleteFolder: (deleteContent: boolean) => void;
  // Edit type modals
  showEditTypeModal: boolean; setShowEditTypeModal: (v: boolean) => void;
  pendingEditScript: ScriptItem | null; setPendingEditScript: (v: ScriptItem | null) => void;
  modoPropostaAtivo: boolean; setModoPropostaAtivo: (v: boolean) => void;
  propostaPendenteInfo: any; setPropostaPendenteInfo: (v: any) => void;
  showCuradoriaControls: boolean;
  openScriptEditor: (script: ScriptItem, mode?: 'usuario_final' | 'atendente') => void;
  setPropostaCampoAlvo: (v: 'usuario_final' | 'atendente') => void;
  showNewScriptEditTypeModal: boolean; setShowNewScriptEditTypeModal: (v: boolean) => void;
  pendingNewScriptLocationId: string | null;
  handleNewScriptEditTypeSelect: (tipo: 'usuario_final' | 'atendente') => void;
  // Proposal modals
  showAnalisarPropostaModal: boolean; setShowAnalisarPropostaModal: (v: boolean) => void;
  propostaParaAnalisar: PropostaRevisao | null; setPropostaParaAnalisar: (v: PropostaRevisao | null) => void;
  scriptParaAnalisarProposta: any; setScriptParaAnalisarProposta: (v: any) => void;
  autorPropostaNome: string;
  setAutorPropostaNome: (v: string) => void;
  finalizarNotificacaoPendente: () => Promise<void>;
  fetchScripts: () => void;
  autoresMap: Map<string, string>;
  // Revision modals
  showRevisarCuradoriaModal: boolean; setShowRevisarCuradoriaModal: (v: boolean) => void;
  revisarCuradoriaData: RevisaoCuradoriaData | null; setRevisarCuradoriaData: (v: RevisaoCuradoriaData | null) => void;
  showAnalisarContestacaoModal: boolean; setShowAnalisarContestacaoModal: (v: boolean) => void;
  contestacaoData: ContestacaoCuradoriaData | null; setContestacaoData: (v: ContestacaoCuradoriaData | null) => void;
  handleAceitarContestacao: () => void;
  handleEditarNovamenteContestacao: () => void;
  // Proposal rejected
  showPropostaRejeitadaModal: boolean; setShowPropostaRejeitadaModal: (v: boolean) => void;
  propostaRejeitada: PropostaRevisao | null; setPropostaRejeitada: (v: PropostaRevisao | null) => void;
  scriptNomeRejeitada: string;
  scripts: ScriptItem[];
  setEditingScript: (v: ScriptItem | null) => void;
  setEditMode: (v: 'usuario_final' | 'atendente') => void;
  setEditingContent: (v: string) => void;
  setEditorKey: (fn: (prev: number) => number) => void;
  setPropostaConteudo: (v: string) => void;
  setPropostaScriptId: (v: string) => void;
  setPropostaScriptNome: (v: string) => void;
  setPropostaIdParaReenvio: (v: string | null) => void;
  setPropostaCuradorAnteriorId: (v: string | null) => void;
  // Classification
  showClassificarEdicaoModal: boolean; setShowClassificarEdicaoModal: (v: boolean) => void;
  handleClassificarEdicaoConfirm: (tipo: 'correcao_grafia' | 'substantiva' | 'atualizacao_normativa' | 'outro', motivacao: string) => void;
  classifContexto: 'revisao_inicial' | 'edicao_posterior';
  // History
  showHistoricoVersoesModal: boolean; setShowHistoricoVersoesModal: (v: boolean) => void;
  historicoScriptId: string;
  historicoScriptNome: string;
  // Proposal motivation
  showPropostaMotivacaoModal: boolean; setShowPropostaMotivacaoModal: (v: boolean) => void;
  propostaScriptId: string;
  propostaScriptNome: string;
  propostaCampoAlvo: 'usuario_final' | 'atendente';
  propostaConteudo: string;
  propostaIdParaReenvio: string | null;
  propostaCuradorAnteriorId: string | null;
  // Editor
  editingScript: ScriptItem | null;
  editorKey: number;
  isCreatingNew: boolean;
  editMode: 'usuario_final' | 'atendente';
  scriptsComReferencia: Map<string, number>;
  usuariosParaEditor: { id: string; nome: string }[];
  versoesMap: Record<string, { usuario_final: number; atendente: number }>;
  equipeId: string | null;
  saveScript: (payload: ScriptSavePayload) => Promise<void>;
  savePergunta: (scriptId: string, pergunta: string, numeroChamado: string) => Promise<void>;
  closeScriptEditor: () => void;
  showOrientacaoPosSalvarModal: boolean; setShowOrientacaoPosSalvarModal: (v: boolean) => void;
  orientacaoScriptNome: string;
  showConfirmPublicarModal: boolean; setShowConfirmPublicarModal: (v: boolean) => void;
  scriptForPublicar: ScriptItem | null; setScriptForPublicar: (v: ScriptItem | null) => void;
  publicarLoading: boolean;
  handleConfirmPublicar: () => void;
  // Location modals
  showConfirmScriptLocationModal: boolean; setShowConfirmScriptLocationModal: (v: boolean) => void;
  handleConfirmScriptLocation: (locationId: string | null) => void;
  showConfirmFolderLocationModal: boolean; setShowConfirmFolderLocationModal: (v: boolean) => void;
  handleConfirmFolderLocation: (parentFolderId: string | null) => void;
  folderHierarchy: ScriptFolderWithChildren[];
  mainDesativadosFolderId: string | null;
  // Delete script
  showDeleteScriptModal: boolean; setShowDeleteScriptModal: (v: boolean) => void;
  scriptToDelete: ScriptItem | null; setScriptToDelete: (v: ScriptItem | null) => void;
  isDeleting: boolean;
  handleConfirmarExclusao: (motivo?: string) => Promise<void>;
  showAprovarExclusaoModal: boolean;
  setShowAprovarExclusaoModal: (v: boolean) => void;
  scriptToAprovarExclusao: ScriptItem | null;
  setScriptToAprovarExclusao: (v: ScriptItem | null) => void;
  isProcessingAprovarExclusao: boolean;
  handleAprovarExclusaoScript: () => Promise<void>;
  handleNegarExclusaoScript: () => Promise<void>;
  // Help
  showHelpModal: boolean; setShowHelpModal: (v: boolean) => void;
}

const FOLDER_ICONS = ['📁', '📂', '🗂️', '📋', '📊', '💼', '🔧', '⚙️', '🔬', '📈', '🎯', '⭐'];

export const ScriptsModalModals = React.memo<ScriptsModalModalsProps>(function ScriptsModalModals(props) {
  const [expandedMoveFolderIds, setExpandedMoveFolderIds] = React.useState<Set<string>>(new Set());

  const moveFolderHierarchy = React.useMemo(() => {
    let desativadosFound = false;

    const filterFolders = (folders: ScriptFolderWithChildren[]): ScriptFolderWithChildren[] => {
      return folders.flatMap((folder) => {
        const isDesativados = folder.nome === '🗑️ Desativados';
        const isDuplicatedDesativados = isDesativados && (
          props.mainDesativadosFolderId
            ? folder.id !== props.mainDesativadosFolderId
            : desativadosFound
        );

        if (isDuplicatedDesativados) return [];
        if (isDesativados) desativadosFound = true;

        return [{
          ...folder,
          children: filterFolders(folder.children || []),
        }];
      });
    };

    return filterFolders(props.folderHierarchy || []);
  }, [props.folderHierarchy, props.mainDesativadosFolderId]);

  const toggleMoveFolder = (folderId: string) => {
    setExpandedMoveFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const renderMoveFolderNode = (folder: ScriptFolderWithChildren, level: number = 0): React.ReactNode => {
    const hasChildren = folder.children.length > 0;
    const isExpanded = expandedMoveFolderIds.has(folder.id);

    return (
      <React.Fragment key={folder.id}>
        <div
          className="flex items-center gap-1 min-w-0 w-full"
          style={{ paddingLeft: `${level * 18}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleMoveFolder(folder.id)}
              className="w-7 h-8 flex-shrink-0 flex items-center justify-center rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
              aria-label={isExpanded ? `Recolher ${folder.nome}` : `Expandir ${folder.nome}`}
              aria-expanded={isExpanded}
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className="w-7 h-8 flex-shrink-0" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => props.moveScriptToFolder(folder.id)}
            className={`min-w-0 flex-1 text-left p-2 rounded transition-colors flex items-center gap-2 overflow-hidden ${
              level === 0
                ? 'font-semibold text-gray-900 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={`Mover para ${folder.nome}`}
          >
            <span className="flex-shrink-0">{folder.icone}</span>
            <span className="block min-w-0 flex-1 truncate">{folder.nome}</span>
          </button>
        </div>
        {hasChildren && isExpanded && folder.children.map((child) => renderMoveFolderNode(child, level + 1))}
      </React.Fragment>
    );
  };

  return (
    <>
      {/* Modal criar pasta */}
      <AnimatePresence>
        {props.showCreateFolderModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">Nova Pasta</h3>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-blue-700">📍 Será criada em:</span>
                  <span className="text-gray-800">
                    {props.selectedFolderId ? (() => { const f = props.folders.find(f => f.id === props.selectedFolderId); return f ? `${f.icone} ${f.nome}` : 'Pasta'; })() : '📄 Raiz'}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{props.selectedFolderId ? 'Será uma subpasta' : 'Será uma pasta principal'}</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ícone da pasta</label>
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {FOLDER_ICONS.map((icon) => (
                    <button key={icon} type="button" onClick={() => props.setNewFolderIcon(icon)}
                      className={`p-2 text-lg rounded border-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${props.newFolderIcon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-200 dark:border-gray-700'}`}>{icon}</button>
                  ))}
                </div>
              </div>
              <input type="text" placeholder="Nome da pasta" value={props.newFolderName} onChange={(e) => props.setNewFolderName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                autoFocus onKeyDown={(e) => { if (e.key === 'Enter') props.handleCreateFolder(); if (e.key === 'Escape') props.setShowCreateFolderModal(false); }} />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { props.setShowCreateFolderModal(false); props.setNewFolderName(''); props.setNewFolderIcon('📁'); }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">Cancelar</button>
                <button onClick={props.handleCreateFolder} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">Criar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal editar pasta */}
      <AnimatePresence>
        {props.showEditFolderModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">Editar Pasta</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ícone da pasta</label>
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {FOLDER_ICONS.map((icon) => (
                    <button key={icon} type="button" onClick={() => props.setEditFolderIcon(icon)}
                      className={`p-2 text-lg rounded border-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${props.editFolderIcon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-200 dark:border-gray-700'}`}>{icon}</button>
                  ))}
                </div>
              </div>
              <input type="text" placeholder="Nome da pasta" value={props.editFolderName} onChange={(e) => props.setEditFolderName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                autoFocus onKeyDown={(e) => { if (e.key === 'Enter') props.handleEditFolder(); if (e.key === 'Escape') props.setShowEditFolderModal(false); }} />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { props.setShowEditFolderModal(false); props.setEditFolderName(''); props.setEditFolderIcon('📁'); }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">Cancelar</button>
                <button onClick={props.handleEditFolder} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">Salvar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal mover script */}
      <AnimatePresence>
        {props.showMoveModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-h-[80vh] flex flex-col">
              <h3 className="text-lg font-semibold mb-4">Mover Script</h3>
              <div className="space-y-2 mb-4 overflow-y-auto overflow-x-hidden flex-1 max-h-[60vh] pr-2">
                <button onClick={() => props.moveScriptToFolder(null)} className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">📄 Scripts (sem pasta)</button>
                {moveFolderHierarchy.map((folder) => renderMoveFolderNode(folder))}
              </div>
              <div className="flex justify-end pt-2 border-t">
                <button onClick={() => props.setShowMoveModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal excluir pasta */}
      <AnimatePresence>
        {props.showDeleteFolderModal && props.folderToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md">
              <h3 className="text-lg font-semibold mb-4 text-red-600">⚠️ Excluir Pasta</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Deseja excluir a pasta "<strong>{props.folderToDelete.name}</strong>"
                {props.folderToDelete.scriptCount > 0 && (<> que contém <strong>{props.folderToDelete.scriptCount}</strong> {props.folderToDelete.scriptCount === 1 ? 'script' : 'scripts'}</>)}?
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                {props.folderToDelete.scriptCount > 0 ? 'O que deseja fazer com o conteúdo da pasta?' : 'Confirme a exclusão da pasta vazia:'}
              </p>
              <div className="space-y-3">
                {props.folderToDelete.scriptCount > 0 ? (
                  <>
                    <button onClick={() => props.confirmDeleteFolder(false)} className="w-full p-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-left">
                      <div className="font-medium">📄 Mover para raiz</div>
                      <div className="text-sm text-blue-100">Os scripts serão movidos para "Scripts (sem pasta)"</div>
                    </button>
                    <button onClick={() => props.confirmDeleteFolder(true)} className="w-full p-3 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-left">
                      <div className="font-medium">🗑️ Excluir tudo</div>
                      <div className="text-sm text-red-100">A pasta e todos os scripts serão excluídos permanentemente</div>
                    </button>
                  </>
                ) : (
                  <button onClick={() => props.confirmDeleteFolder(false)} className="w-full p-3 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-left">
                    <div className="font-medium">🗑️ Excluir pasta vazia</div>
                    <div className="text-sm text-red-100">A pasta será excluída permanentemente</div>
                  </button>
                )}
              </div>
              <div className="flex justify-end mt-4 pt-4 border-t">
                <button onClick={() => { props.setShowDeleteFolderModal(false); props.setFolderToDelete(null); }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de seleção do tipo de edição */}
      <SelecionarTipoEdicaoModal
        isOpen={props.showEditTypeModal}
        onClose={() => { props.setShowEditTypeModal(false); props.setPendingEditScript(null); props.setModoPropostaAtivo(false); props.setPropostaPendenteInfo(null); }}
        onSelect={(tipo) => {
          props.setShowEditTypeModal(false);
          if (props.pendingEditScript) {
            if (props.modoPropostaAtivo) props.setPropostaCampoAlvo(tipo);
            if (tipo === 'usuario_final') {
              props.openScriptEditor(props.pendingEditScript);
            } else {
              props.openScriptEditor(props.pendingEditScript, 'atendente');
            }
          }
          props.setPendingEditScript(null);
          props.setPropostaPendenteInfo(null);
        }}
        isCuradoria={props.showCuradoriaControls}
        propostaPendente={props.propostaPendenteInfo}
        onSelectProposta={async (propostaId) => {
          const scriptAlvo = props.pendingEditScript;
          props.setShowEditTypeModal(false);
          props.setPropostaPendenteInfo(null);
          props.setPendingEditScript(null);
          try {
            const proposta = await buscarPropostaPorId(propostaId);
            if (!proposta || !scriptAlvo) return;
            const { data: conteudos } = await supabase.from('scripts_customizados').select('conteudo_bruto, conteudo_atendente').eq('id', scriptAlvo.id).single();
            props.setScriptParaAnalisarProposta({
              id: scriptAlvo.id,
              nome: scriptAlvo.nome,
              conteudo_bruto: conteudos?.conteudo_bruto || '',
              conteudo_atendente: conteudos?.conteudo_atendente || undefined,
              curadoria_atuada: scriptAlvo.curadoria_atuada ?? false,
              numero_chamado: scriptAlvo.numero_chamado || undefined,
            });
            const nomeAutor = props.autoresMap.get(proposta.autor_id) || 'Usuário desconhecido';
            props.setPropostaParaAnalisar(proposta);
            props.setAutorPropostaNome(nomeAutor);
            props.setShowAnalisarPropostaModal(true);
          } catch (e) {
            console.warn('Erro ao abrir proposta para análise:', e);
          }
        }}
      />

      {/* Modal novo script tipo edição */}
      <SelecionarTipoEdicaoModal
        isOpen={props.showNewScriptEditTypeModal}
        onClose={() => { props.setShowNewScriptEditTypeModal(false); }}
        onSelect={props.handleNewScriptEditTypeSelect}
      />

      {/* Modal análise de proposta */}
      {props.propostaParaAnalisar && props.scriptParaAnalisarProposta && (
        <AnalisarPropostaModal
          isOpen={props.showAnalisarPropostaModal}
          onClose={() => { props.setShowAnalisarPropostaModal(false); props.setPropostaParaAnalisar(null); props.setScriptParaAnalisarProposta(null); }}
          proposta={props.propostaParaAnalisar}
          scriptAtual={props.scriptParaAnalisarProposta}
          autorPropostaNome={props.autorPropostaNome}
          onAprovada={() => { props.finalizarNotificacaoPendente(); props.setShowAnalisarPropostaModal(false); props.setPropostaParaAnalisar(null); props.setScriptParaAnalisarProposta(null); props.fetchScripts(); }}
          onRejeitada={() => { props.finalizarNotificacaoPendente(); props.setShowAnalisarPropostaModal(false); props.setPropostaParaAnalisar(null); props.setScriptParaAnalisarProposta(null); props.fetchScripts(); }}
        />
      )}

      {/* Modal revisão curadoria */}
      {props.revisarCuradoriaData && (
        <RevisarAlteracaoCuradoriaModal
          isOpen={props.showRevisarCuradoriaModal}
          onClose={() => { props.setShowRevisarCuradoriaModal(false); props.setRevisarCuradoriaData(null); }}
          dados={props.revisarCuradoriaData}
          onAceita={() => { props.finalizarNotificacaoPendente(); props.setShowRevisarCuradoriaModal(false); props.setRevisarCuradoriaData(null); }}
          onContestada={() => { props.finalizarNotificacaoPendente(); props.setShowRevisarCuradoriaModal(false); props.setRevisarCuradoriaData(null); props.fetchScripts(); }}
        />
      )}

      {/* Modal análise contestação */}
      {props.contestacaoData && (
        <AnalisarContestacaoModal
          isOpen={props.showAnalisarContestacaoModal}
          onClose={() => { props.setShowAnalisarContestacaoModal(false); props.setContestacaoData(null); }}
          dados={props.contestacaoData}
          onAceitarContestacao={props.handleAceitarContestacao}
          onEditarNovamente={props.handleEditarNovamenteContestacao}
        />
      )}

      {/* Modal proposta rejeitada */}
      {props.propostaRejeitada && (
        <PropostaRejeitadaModal
          isOpen={props.showPropostaRejeitadaModal}
          onClose={() => { props.setShowPropostaRejeitadaModal(false); props.setPropostaRejeitada(null); }}
          proposta={props.propostaRejeitada}
          scriptNome={props.scriptNomeRejeitada}
          onReenviar={async () => {
            await props.finalizarNotificacaoPendente();
            props.setShowPropostaRejeitadaModal(false);
            props.setModoPropostaAtivo(true);
            props.setPropostaConteudo(props.propostaRejeitada!.conteudo_proposto);
            props.setPropostaCampoAlvo(props.propostaRejeitada!.campo_alvo);
            props.setPropostaScriptId(props.propostaRejeitada!.script_id);
            props.setPropostaScriptNome(props.scriptNomeRejeitada);
            props.setPropostaIdParaReenvio(props.propostaRejeitada!.id);
            props.setPropostaCuradorAnteriorId((props.propostaRejeitada as any)?.decidido_por || null);
            const scriptAlvo = props.scripts.find(s => s.id === props.propostaRejeitada!.script_id);
            if (scriptAlvo) {
              const { data: conteudos } = await supabase.from('scripts_customizados').select('conteudo_bruto, conteudo_atendente, criado_por_atendente').eq('id', scriptAlvo.id).single();
              const scriptComConteudo = { ...scriptAlvo, ...conteudos } as any;
              if (props.propostaRejeitada!.campo_alvo === 'atendente') { scriptComConteudo.conteudo_atendente = props.propostaRejeitada!.conteudo_proposto; }
              else { scriptComConteudo.conteudo_bruto = props.propostaRejeitada!.conteudo_proposto; }
              props.setEditingScript(scriptComConteudo);
              props.setEditMode(props.propostaRejeitada!.campo_alvo);
              props.setEditingContent(props.propostaRejeitada!.conteudo_proposto);
              props.setEditorKey(prev => prev + 1);
            }
            props.setPropostaRejeitada(null);
          }}
        />
      )}

      {/* Modal classificação edição curadoria */}
      <ClassificarEdicaoCuradoriaModal
        isOpen={props.showClassificarEdicaoModal}
        onClose={() => props.setShowClassificarEdicaoModal(false)}
        onConfirm={props.handleClassificarEdicaoConfirm}
        contexto={props.classifContexto}
      />

      {/* Modal histórico versões */}
      <HistoricoVersoesModal
        isOpen={props.showHistoricoVersoesModal}
        onClose={() => props.setShowHistoricoVersoesModal(false)}
        scriptId={props.historicoScriptId}
        scriptNome={props.historicoScriptNome}
      />

      {/* Modal motivação proposta */}
      <PropostaMotivacaoModal
        isOpen={props.showPropostaMotivacaoModal}
        onClose={() => { props.setShowPropostaMotivacaoModal(false); props.setPropostaConteudo(''); props.setPropostaIdParaReenvio(null); props.setPropostaCuradorAnteriorId(null); }}
        scriptId={props.propostaScriptId}
        scriptNome={props.propostaScriptNome}
        campoAlvo={props.propostaCampoAlvo}
        conteudoProposto={props.propostaConteudo}
        propostaIdReenvio={props.propostaIdParaReenvio}
        curadorAnteriorId={props.propostaCuradorAnteriorId}
        onSuccess={() => { props.setShowPropostaMotivacaoModal(false); props.setPropostaConteudo(''); props.setPropostaIdParaReenvio(null); props.setPropostaCuradorAnteriorId(null); props.fetchScripts(); }}
      />

      {/* Editor Fullscreen */}
      <ScriptEditorFullscreen
        key={props.editorKey}
        isOpen={!!props.editingScript}
        script={props.editingScript}
        isNew={props.isCreatingNew}
        editMode={props.editMode}
        referenceNumber={props.editingScript ? props.scriptsComReferencia.get(props.editingScript.id) : undefined}
        usuariosExternos={props.usuariosParaEditor}
        versaoAtual={props.editingScript ? (props.versoesMap[props.editingScript.id]?.[props.editMode] || 0) : undefined}
        onSave={props.saveScript}
        onSavePergunta={props.savePergunta}
        onClose={props.closeScriptEditor}
      />

      <OrientacaoPosSalvarScriptModal isOpen={props.showOrientacaoPosSalvarModal} scriptNome={props.orientacaoScriptNome} onClose={() => props.setShowOrientacaoPosSalvarModal(false)} />

      <ConfirmPublicarScriptModal
        isOpen={props.showConfirmPublicarModal}
        scriptNome={props.scriptForPublicar?.nome || ''}
        loading={props.publicarLoading}
        onConfirm={props.handleConfirmPublicar}
        onCancel={() => {
          if (!props.publicarLoading) {
            props.setShowConfirmPublicarModal(false);
            props.setScriptForPublicar(null);
          }
        }}
      />

      {/* Modal confirmação localização script */}
      <ConfirmLocationModal
        isOpen={props.showConfirmScriptLocationModal}
        type="script"
        currentLocation={props.selectedFolderId}
        folders={props.folderHierarchy || []}
        onConfirm={props.handleConfirmScriptLocation}
        onCancel={() => props.setShowConfirmScriptLocationModal(false)}
      />

      {/* Modal confirmação localização pasta */}
      <ConfirmLocationModal
        isOpen={props.showConfirmFolderLocationModal}
        type="folder"
        currentLocation={props.selectedFolderId}
        folders={props.folderHierarchy || []}
        onConfirm={props.handleConfirmFolderLocation}
        onCancel={() => props.setShowConfirmFolderLocationModal(false)}
      />

      {/* Modal exclusão script */}
      <ConfirmarExclusaoScriptModal
        isOpen={props.showDeleteScriptModal}
        scriptNome={props.scriptToDelete?.nome || ''}
        tipoExclusao={props.scriptToDelete && scriptExigeAprovacaoExclusao(props.scriptToDelete) ? 'soft' : 'hard'}
        loading={props.isDeleting}
        onConfirm={props.handleConfirmarExclusao}
        onCancel={() => { props.setShowDeleteScriptModal(false); props.setScriptToDelete(null); }}
      />

      <AprovarExclusaoScriptModal
        isOpen={props.showAprovarExclusaoModal}
        scriptNome={props.scriptToAprovarExclusao?.nome || ''}
        motivo={props.scriptToAprovarExclusao?.motivo_exclusao}
        loading={props.isProcessingAprovarExclusao}
        onAprovar={props.handleAprovarExclusaoScript}
        onNegar={props.handleNegarExclusaoScript}
        onCancel={() => {
          props.setShowAprovarExclusaoModal(false);
          props.setScriptToAprovarExclusao(null);
        }}
      />

      {/* Modal ajuda */}
      <ScriptsHelpModal isOpen={props.showHelpModal} onClose={() => props.setShowHelpModal(false)} />
    </>
  );
});

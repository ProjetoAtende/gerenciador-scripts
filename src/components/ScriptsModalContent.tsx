// src/components/ScriptsModalContent.tsx — Grid de scripts + DnD + Sidebar
import React from 'react';
import {
  DndContext,
  closestCenter,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { ScriptItem, scriptPublicado } from '../types/Script';
import { ScriptCard } from './ScriptCard';
import { ScriptSidebar } from './ScriptSidebar';
import { buscarPropostaAtiva } from '../services/scriptVersioningService';

// Componente para pasta que aceita drop
function DroppableFolder({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef}
      className={`${className} relative ${isOver ? 'bg-gradient-to-r from-blue-100 to-blue-200 border-blue-500 border-2 border-dashed scale-105 shadow-lg' : 'border-2 border-transparent hover:border-blue-200'} transition-all duration-300 rounded-lg`}>
      {children}
      {isOver && (
        <>
          <div className="absolute inset-0 bg-blue-300 opacity-20 rounded-lg pointer-events-none animate-pulse"></div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="text-blue-600 text-lg animate-pulse">📂➕</div>
          </div>
        </>
      )}
    </div>
  );
}

interface ScriptsModalContentProps {
  // Data
  scripts: ScriptItem[];
  filteredScripts: ScriptItem[];
  folders: any[];
  folderHierarchy: any[];
  foldersLoading: boolean;
  // Selection
  selectedFolderId: string | null;
  setSelectedFolderId: (v: string | null) => void;
  selectedScriptId: string | null;
  setSelectedScriptId: (v: string | null) => void;
  scriptsWithoutFolder: number;
  scriptCountByFolder: Map<string, number>;
  canViewDesativados: boolean;
  // Editing
  editingScriptId: string | null;
  editingTitle: string;
  setEditingTitle: (v: string) => void;
  // DnD
  sensors: any;
  activeId: string | null;
  handleDragStart: (e: any) => void;
  handleDragEnd: (e: any) => void;
  // Curadoria
  showCuradoriaControls: boolean;
  canToggleCuradoria: boolean;
  // Handlers
  scriptsComReferencia: Map<string, number>;
  autoresMap: Map<string, string>;
  versoesMap: Record<string, { usuario_final: number; atendente: number }>;
  handleOpenGerador: (script: ScriptItem) => void;
  startEditScript: (script: ScriptItem) => void;
  saveEditScript: () => void;
  cancelEditScript: () => void;
  toggleCuradoria: (scriptId: string, currentValue: boolean) => void;
  handleDelete: (id: string) => void;
  handleMoveScript: (id: string) => void;
  openPublicarModal: (script: ScriptItem) => void;
  handleReativar?: (id: string) => void;
  handleExportarDocumento: (script: ScriptItem) => void;
  createScriptDirect: () => void;
  handleOpenCreateFolderModal: () => void;
  handleOpenEditFolder: (folder: any) => void;
  handleDeleteFolder: (folder: any) => void;
  busca: string;
  // Edit type modal trigger
  modoPropostaAtivo: boolean;
  setModoPropostaAtivo: (v: boolean) => void;
  propostaPendenteInfo: any;
  setPropostaPendenteInfo: (v: any) => void;
  setPendingEditScript: (v: ScriptItem | null) => void;
  setShowEditTypeModal: (v: boolean) => void;
  setPropostaScriptId: (v: string) => void;
  setPropostaScriptNome: (v: string) => void;
  setHistoricoScriptId: (v: string) => void;
  setHistoricoScriptNome: (v: string) => void;
  setShowHistoricoVersoesModal: (v: boolean) => void;
  setScripts: React.Dispatch<React.SetStateAction<ScriptItem[]>>;
}

export const ScriptsModalContent = React.memo<ScriptsModalContentProps>(function ScriptsModalContent(props) {
  const {
    scripts, filteredScripts, folders, folderHierarchy, foldersLoading,
    selectedFolderId, setSelectedFolderId, selectedScriptId, setSelectedScriptId,
    scriptsWithoutFolder, scriptCountByFolder, canViewDesativados,
    editingScriptId, editingTitle, setEditingTitle,
    sensors, activeId, handleDragStart, handleDragEnd,
    showCuradoriaControls, canToggleCuradoria,
    scriptsComReferencia, autoresMap, versoesMap,
    handleOpenGerador, startEditScript, saveEditScript, cancelEditScript,
    toggleCuradoria, handleDelete, handleMoveScript,
    openPublicarModal, handleReativar,
    handleExportarDocumento, createScriptDirect,
    handleOpenCreateFolderModal, handleOpenEditFolder, handleDeleteFolder,
    busca, setModoPropostaAtivo,
    setPropostaPendenteInfo,
    setPendingEditScript, setShowEditTypeModal,
    setPropostaScriptId, setPropostaScriptNome,
    setHistoricoScriptId, setHistoricoScriptNome, setShowHistoricoVersoesModal,
    setScripts,
  } = props;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex-1 flex overflow-hidden">
        <ScriptSidebar
          folders={folders}
          folderHierarchy={folderHierarchy}
          selectedFolderId={selectedFolderId}
          scriptsWithoutFolder={scriptsWithoutFolder}
          scriptCountByFolder={scriptCountByFolder}
          onFolderSelect={setSelectedFolderId}
          onCreateFolder={handleOpenCreateFolderModal}
          onEditFolder={handleOpenEditFolder}
          onDeleteFolder={handleDeleteFolder}
          onCreateScriptDirect={createScriptDirect}
          loading={foldersLoading}
          showDesativados={canViewDesativados}
          DroppableFolder={DroppableFolder}
        />

        <div className="flex-1 overflow-y-auto p-3 lg:p-6">
          <SortableContext
            items={[...filteredScripts.map(s => s.id), 'root-folder', ...folders.map(f => `folder-${f.id}`)]}
            strategy={rectSortingStrategy}>
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-6">
              <AnimatePresence>
                {filteredScripts.map((script) => {
                  const folder = script.pasta_id ? folders.find(f => f.id === script.pasta_id) : null;
                  const refNumber = scriptsComReferencia.get(script.id);
                  const authorName = script.criado_por ? autoresMap.get(script.criado_por) || null : null;
                  const curadorName = script.curadoria_por ? autoresMap.get(script.curadoria_por) || null : null;

                  return (
                    <ScriptCard
                      key={script.id}
                      script={script}
                      folder={folder}
                      allFolders={folders}
                      isSelected={selectedScriptId === script.id}
                      isEditing={editingScriptId === script.id}
                      editingTitle={editingTitle}
                      showCuradoriaControls={showCuradoriaControls}
                      canToggleCuradoria={canToggleCuradoria}
                      referenceNumber={refNumber}
                      authorName={authorName}
                      curadorName={curadorName}
                      onGenerate={() => handleOpenGerador(script)}
                      onEdit={() => {
                        if (script.tem_proposta_pendente && !showCuradoriaControls) {
                          const { toast } = require('sonner');
                          toast.error('Há uma proposta de revisão pendente para este script. Aguarde a decisão da Curadoria.');
                          return;
                        }
                        if (script.tem_proposta_pendente && showCuradoriaControls) {
                          buscarPropostaAtiva(script.id).then(proposta => {
                            if (proposta) {
                              setPropostaPendenteInfo({ campo_alvo: proposta.campo_alvo, id: proposta.id });
                            } else {
                              setPropostaPendenteInfo(null);
                            }
                            setPendingEditScript(script);
                            setShowEditTypeModal(true);
                          }).catch(() => {
                            setPropostaPendenteInfo(null);
                            setPendingEditScript(script);
                            setShowEditTypeModal(true);
                          });
                          return;
                        }
                        if (scriptPublicado(script) && !showCuradoriaControls) {
                          setModoPropostaAtivo(true);
                          setPropostaScriptId(script.id);
                          setPropostaScriptNome(script.nome);
                        }
                        setPropostaPendenteInfo(null);
                        setPendingEditScript(script);
                        setShowEditTypeModal(true);
                      }}
                      onDelete={() => handleDelete(script.id)}
                      canAprovarExclusaoPendente={canToggleCuradoria}
                      onMove={() => handleMoveScript(script.id)}
                      onPublicar={() => openPublicarModal(script)}
                      onStartEdit={() => startEditScript(script)}
                      onSaveEdit={saveEditScript}
                      onCancelEdit={cancelEditScript}
                      onTitleChange={setEditingTitle}
                      onSelect={() => setSelectedScriptId(script.id)}
                      onToggleCuradoria={() => toggleCuradoria(script.id, script.curadoria_atuada)}
                      onReativar={script.deletado ? () => handleReativar?.(script.id) : undefined}
                      onExportarDocumento={() => handleExportarDocumento(script)}
                      versaoInfo={versoesMap[script.id] || null}
                      onShowHistorico={() => {
                        setHistoricoScriptId(script.id);
                        setHistoricoScriptNome(script.nome);
                        setShowHistoricoVersoesModal(true);
                      }}
                      onCategoriaAtualizada={(dados) => {
                        setScripts(prev => prev.map(s =>
                          s.id === script.id
                            ? { ...s, categoria_equipe_slug: dados.categoria_equipe_slug, subcategoria_gse_slug: dados.subcategoria_gse_slug, classificacao_origem: dados.origem, classificacao_pendente: false }
                            : s
                        ));
                      }}
                    />
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </SortableContext>

          {filteredScripts.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📜</div>
              <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
                {busca ? 'Nenhum script encontrado' : 'Nenhum script nesta pasta'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {busca ? 'Tente uma busca diferente' : 'Clique em "Novo Script" para adicionar'}
              </p>
            </div>
          )}
        </div>

        <DragOverlay>
          {activeId ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 opacity-95 transform rotate-2">
              <div className="p-3 text-center">
                <div className="text-lg mb-1">📜</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {scripts.find(s => s.id === activeId)?.nome || 'Script'}
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
});

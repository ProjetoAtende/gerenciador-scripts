// components/ConfirmLocationModal.tsx - Modal para confirmar localização de criação
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { ScriptFolderWithChildren } from '../types/Script';

interface ConfirmLocationModalProps {
  isOpen: boolean;
  type: 'script' | 'folder';
  currentLocation: string | null; // ID da pasta ou null para raiz
  folders: ScriptFolderWithChildren[];
  onConfirm: (locationId: string | null) => void;
  onCancel: () => void;
}

export const ConfirmLocationModal: React.FC<ConfirmLocationModalProps> = ({
  isOpen,
  type,
  currentLocation,
  folders,
  onConfirm,
  onCancel,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(currentLocation);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleExpand = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const getLocationName = (folderId: string | null): string => {
    if (!folderId) return '📄 Raiz (sem pasta)';
    
    const findFolder = (folderList: ScriptFolderWithChildren[]): ScriptFolderWithChildren | null => {
      for (const folder of folderList) {
        if (folder.id === folderId) return folder;
        if (folder.children) {
          const found = findFolder(folder.children);
          if (found) return found;
        }
      }
      return null;
    };

    const folder = findFolder(folders);
    return folder ? `${folder.icone} ${folder.nome}` : '📄 Raiz (sem pasta)';
  };

  // Filtrar pastas Desativados (não se deve criar scripts nelas)
  const filterDesativados = (folderList: ScriptFolderWithChildren[]): ScriptFolderWithChildren[] => {
    return folderList
      .filter(folder => folder.nome !== '🗑️ Desativados')
      .map(folder => ({
        ...folder,
        children: folder.children ? filterDesativados(folder.children) : [],
      }));
  };

  const filteredFolders = React.useMemo(() => filterDesativados(folders), [folders]);

  // Construir caminho (breadcrumb) de uma pasta
  const buildPath = (folderList: ScriptFolderWithChildren[], targetId: string, path: string[] = []): string[] | null => {
    for (const folder of folderList) {
      const currentPath = [...path, folder.nome];
      if (folder.id === targetId) return currentPath;
      if (folder.children && folder.children.length > 0) {
        const found = buildPath(folder.children, targetId, currentPath);
        if (found) return found;
      }
    }
    return null;
  };

  // Renderizar opções de pasta recursivamente com hierarquia visual e colapso
  const renderFolderOptions = (folderList: ScriptFolderWithChildren[], level: number = 0, parentPath: string[] = []) => {
    return folderList.map((folder, index) => {
      const isLast = index === folderList.length - 1;
      const hasChildren = folder.children && folder.children.length > 0;
      const isExpanded = expandedFolders.has(folder.id);
      const currentPath = [...parentPath, folder.nome];

      return (
        <React.Fragment key={folder.id}>
          <div className="flex items-stretch" style={{ marginLeft: level > 0 ? `${(level - 1) * 24 + 8}px` : '0' }}>
            {/* Linhas de conexão para subpastas */}
            {level > 0 && (
              <div className="flex items-center mr-1 flex-shrink-0">
                <div className={`w-4 border-l-2 border-b-2 border-gray-300 dark:border-gray-600 h-5 rounded-bl-md ${isLast ? '' : ''}`} />
              </div>
            )}

            <button
              onClick={() => setSelectedLocation(folder.id)}
              className={`flex-1 text-left p-3 rounded-lg transition-all flex items-center gap-2 ${
                selectedLocation === folder.id
                  ? level === 0
                    ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500 shadow-sm'
                    : 'bg-indigo-50 dark:bg-indigo-900/40 border-2 border-indigo-400 shadow-sm'
                  : level === 0
                    ? 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-2 border-transparent'
              }`}
            >
              {/* Botão expandir/colapsar para pastas com filhos */}
              {hasChildren && (
                <span
                  onClick={(e) => toggleExpand(folder.id, e)}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer text-gray-500 dark:text-gray-400"
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
              )}
              {!hasChildren && level > 0 && <span className="w-5" />}
              <span className={level === 0 ? 'text-lg' : 'text-base'}>{folder.icone}</span>
              <div className="flex-1 min-w-0">
                <div className={`font-medium truncate ${
                  level === 0 ? 'text-gray-800 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300 text-sm'
                }`}>
                  {folder.nome}
                </div>
                {level > 0 && (
                  <div className="text-xs text-gray-400 truncate">
                    {currentPath.join(' \u203a ')}
                  </div>
                )}
                {hasChildren && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {folder.children!.length} subpasta{folder.children!.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
              {selectedLocation === folder.id && (
                <span className="text-blue-600 font-bold flex-shrink-0">{'\u2713'}</span>
              )}
            </button>
          </div>

          {/* Renderizar subpastas recursivamente (com colapso) */}
          {hasChildren && isExpanded && (
            <div className="mt-1 mb-1">
              {renderFolderOptions(folder.children!, level + 1, currentPath)}
            </div>
          )}
        </React.Fragment>
      );
    });
  };

  if (!isOpen) return null;

  const title = type === 'script' ? '📝 Criar Novo Script' : '📁 Criar Nova Pasta';
  const description = type === 'script' 
    ? 'Selecione onde o script será criado:'
    : 'Selecione a pasta pai (ou raiz para criar pasta principal):';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
          </div>

          {/* Localização atual */}
          <div className="px-6 py-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-700">
            <div className="flex items-center gap-2">
              <span className="text-yellow-700 dark:text-yellow-400 font-medium">📍 Localização atual:</span>
              <span className="text-gray-800 dark:text-gray-100 font-semibold">
                {getLocationName(currentLocation)}
              </span>
            </div>
          </div>

          {/* Lista de opções */}
          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {/* Opção Raiz */}
            <button
              onClick={() => setSelectedLocation(null)}
              className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-2 ${
                selectedLocation === null
                  ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500'
                  : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
              }`}
            >
              <span className="text-lg">📄</span>
              <div className="flex-1">
                <div className="font-medium text-gray-800 dark:text-gray-100">Raiz (sem pasta)</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {type === 'script' ? 'Script ficará na raiz' : 'Criar pasta principal'}
                </div>
              </div>
              {selectedLocation === null && (
                <span className="text-blue-600 font-bold">✓</span>
              )}
            </button>

            {/* Pastas */}
            {filteredFolders.length > 0 && (
              <div className="pt-2">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                  Pastas disponíveis
                </div>
                {renderFolderOptions(filteredFolders)}
              </div>
            )}

            {filteredFolders.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Nenhuma pasta criada ainda.</p>
                <p className="text-sm mt-1">
                  {type === 'script' ? 'O script será criado na raiz.' : 'A pasta será criada na raiz.'}
                </p>
              </div>
            )}
          </div>

          {/* Footer com ações */}
          <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selectedLocation !== currentLocation && (
                <span className="text-orange-600 font-medium">
                  ⚠️ Local alterado
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => onConfirm(selectedLocation)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md"
              >
                {type === 'script' ? '📝 Criar Script' : '📁 Criar Pasta'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

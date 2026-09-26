// src/components/ScriptSidebar.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { ScriptFolder, ScriptFolderWithChildren } from '../types/Script';

// Mapeamento de nomes de equipes para descrições completas
const EQUIPES_DESCRICAO: Record<string, string> = {
  '2.2.1': 'Atendimento do Público Interno de 1º Grau',
  '2.2.2': 'Atendimento aos Advogados, Peritos e JusPostulandi',
  '2.3.1': 'Atendimento do Público Interno de 2º Grau',
  '2.3.2': 'Atendimento aos Entes Conveniados (MP, DEF, PGMs, etc)',
  '3.2.1': 'Serviço de Curadoria I',
  '3.2.2': 'Serviço de Gestão de Curadoria II',
  '3.2.3': 'Serviço de Gestão de Portfólio e Inovação',
};

// Função para obter a descrição completa da equipe
const getEquipeDescricao = (nome: string): string | null => {
  return EQUIPES_DESCRICAO[nome] || null;
};

// Componente recursivo para renderizar pastas com hierarquia
interface FolderItemProps {
  folder: ScriptFolderWithChildren;
  level: number;
  selectedFolderId: string | null;
  expandedFolders: Set<string>;
  scriptCountByFolder: Map<string, number>;
  onFolderSelect: (folderId: string | null) => void;
  onToggleExpand: (folderId: string) => void;
  onEditFolder: (folder: ScriptFolder) => void;
  onDeleteFolder: (folder: ScriptFolder) => void;
  DroppableFolder?: React.ComponentType<{
    id: string;
    children: React.ReactNode;
    className?: string;
  }>;
}

const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  level,
  selectedFolderId,
  expandedFolders,
  scriptCountByFolder,
  onFolderSelect,
  onToggleExpand,
  onEditFolder,
  onDeleteFolder,
  DroppableFolder,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  
  const hasChildren = folder.children && folder.children.length > 0;
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;

  // Contagem de scripts: diretamente na pasta + total das subpastas
  const directCount = scriptCountByFolder.get(folder.id) || 0;
  const getTotalCount = (f: ScriptFolderWithChildren): number => {
    const direct = scriptCountByFolder.get(f.id) || 0;
    const childrenTotal = f.children?.reduce((acc, child) => acc + getTotalCount(child), 0) || 0;
    return direct + childrenTotal;
  };
  const totalCount = getTotalCount(folder);

  // Handler para mostrar tooltip com posição calculada
  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (getEquipeDescricao(folder.nome)) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 8
      });
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  const folderContent = (
    <>
      {/* Ícone de expandir/colapsar para pastas com subpastas */}
      {hasChildren ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(folder.id);
          }}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      ) : (
        <span className="w-3" /> // Espaçador para alinhar
      )}

      <span className="text-lg">{folder.icone}</span>

      <div className="flex-1 min-w-0">
        <div
          className="font-medium text-sm truncate"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onEditFolder(folder);
          }}
        >
          {folder.nome}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {hasChildren ? (
            <>{totalCount} scripts ({folder.children.length} subpastas)</>
          ) : (
            <>{directCount} scripts</>
          )}
        </div>
      </div>

      {/* Ações da pasta */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditFolder(folder);
          }}
          className="p-1 text-yellow-600 hover:bg-yellow-100 rounded text-xs"
          title="Renomear pasta"
        >
          ✏️
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteFolder(folder);
          }}
          className="p-1 text-red-600 hover:bg-red-100 rounded text-xs"
          title="Excluir pasta"
        >
          🗑️
        </button>
      </div>

      {/* Tooltip com descrição da equipe - renderizado via Portal no body */}
      {showTooltip && getEquipeDescricao(folder.nome) && createPortal(
        <div
          className="fixed px-2 py-1 bg-gray-900 text-white text-xs rounded pointer-events-none whitespace-nowrap shadow-lg"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translateY(-50%)',
            zIndex: 99999
          }}
        >
          {getEquipeDescricao(folder.nome)}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
        </div>,
        document.body
      )}
    </>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="mb-1"
      style={{ paddingLeft: level > 0 ? `${level * 12}px` : 0 }}
    >
      {DroppableFolder ? (
        <DroppableFolder id={`folder-${folder.id}`}>
          <motion.div
            whileHover={{ x: 2 }}
            className={`
              group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
              ${isSelected ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
            `}
            onClick={() => onFolderSelect(folder.id)}
          >
            {folderContent}
          </motion.div>
        </DroppableFolder>
      ) : (
        <motion.div
          whileHover={{ x: 2 }}
          className={`
            group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
            ${isSelected ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
          `}
          onClick={() => onFolderSelect(folder.id)}
        >
          {folderContent}
        </motion.div>
      )}

      {/* Subpastas (renderização recursiva) */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {folder.children.map((child) => (
              <FolderItem
                key={child.id}
                folder={child}
                level={level + 1}
                selectedFolderId={selectedFolderId}
                expandedFolders={expandedFolders}
                scriptCountByFolder={scriptCountByFolder}
                onFolderSelect={onFolderSelect}
                onToggleExpand={onToggleExpand}
                onEditFolder={onEditFolder}
                onDeleteFolder={onDeleteFolder}
                DroppableFolder={DroppableFolder}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface ScriptSidebarProps {
  folders: ScriptFolder[];
  folderHierarchy?: ScriptFolderWithChildren[];
  selectedFolderId: string | null;
  scriptsWithoutFolder: number;
  scriptCountByFolder: Map<string, number>;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder: () => void;
  onEditFolder: (folder: ScriptFolder) => void;
  onDeleteFolder: (folder: ScriptFolder) => void;
  onCreateScriptDirect: () => void;
  loading?: boolean;
  showDesativados?: boolean;
  DroppableFolder?: React.ComponentType<{
    id: string;
    children: React.ReactNode;
    className?: string;
  }>;
}

export const ScriptSidebar: React.FC<ScriptSidebarProps> = ({
  folders,
  folderHierarchy,
  selectedFolderId,
  scriptsWithoutFolder,
  scriptCountByFolder,
  onFolderSelect,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onCreateScriptDirect,
  loading = false,
  showDesativados = false,
  DroppableFolder,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Filtrar pasta Desativados da hierarquia se usuário não tem permissão
  // Se tem permissão, consolidar múltiplas pastas Desativados em apenas uma
  const filteredFolderHierarchy = React.useMemo(() => {
    let desativadosFound = false;
    
    const filterDesativados = (items: ScriptFolderWithChildren[]): ScriptFolderWithChildren[] => {
      return items.filter(folder => {
        if (folder.nome === '🗑️ Desativados') {
          if (!showDesativados) {
            return false;
          }
          // Se já encontramos uma pasta Desativados, esconder as duplicatas
          if (desativadosFound) {
            return false;
          }
          desativadosFound = true;
        }
        if (folder.children && folder.children.length > 0) {
          folder.children = filterDesativados(folder.children);
        }
        return true;
      });
    };
    return folderHierarchy ? filterDesativados([...folderHierarchy]) : undefined;
  }, [folderHierarchy, showDesativados]);

  // Filtrar também a lista de folders (consolidando pastas Desativados)
  const filteredFolders = React.useMemo(() => {
    let desativadosFound = false;
    return folders.filter(f => {
      if (f.nome === '🗑️ Desativados') {
        if (!showDesativados) return false;
        if (desativadosFound) return false;
        desativadosFound = true;
      }
      return true;
    });
  }, [folders, showDesativados]);

  // Toggle para expandir/colapsar pastas
  const toggleExpand = (folderId: string) => {
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

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header da sidebar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Organização</h3>
          <div className="flex gap-1">
            <button
              onClick={onCreateScriptDirect}
              className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
              title="Criar script no editor"
            >
              ✏️➕
            </button>
            <button
              onClick={onCreateFolder}
              className="p-1 text-purple-600 hover:bg-purple-100 rounded transition-colors"
              title="Nova pasta"
            >
              📁➕
            </button>
          </div>
        </div>


      </div>

      {/* Lista de pastas */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4">
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <div className="p-2">
            {/* Scripts sem pasta */}
            {DroppableFolder ? (
              <DroppableFolder
                id="root-folder"
                className="mb-2"
              >
                <motion.div
                  whileHover={{ x: 2 }}
                  className={`
                    flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
                    ${selectedFolderId === null ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                  `}
                  onClick={() => onFolderSelect(null)}
                >
                  <span className="text-lg">📄</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">Scripts</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{scriptsWithoutFolder} itens</div>
                  </div>
                </motion.div>
              </DroppableFolder>
            ) : (
              <motion.div
                whileHover={{ x: 2 }}
                className={`
                  flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors mb-2
                  ${selectedFolderId === null ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                `}
                onClick={() => onFolderSelect(null)}
              >
                <span className="text-lg">📄</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">Scripts</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{scriptsWithoutFolder} itens</div>
                </div>
              </motion.div>
            )}

            {/* Pastas hierárquicas */}
            <AnimatePresence>
              {(filteredFolderHierarchy || filteredFolders.filter(f => !f.pasta_pai_id)).map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder as ScriptFolderWithChildren}
                  level={0}
                  selectedFolderId={selectedFolderId}
                  expandedFolders={expandedFolders}
                  scriptCountByFolder={scriptCountByFolder}
                  onFolderSelect={onFolderSelect}
                  onToggleExpand={toggleExpand}
                  onEditFolder={onEditFolder}
                  onDeleteFolder={onDeleteFolder}
                  DroppableFolder={DroppableFolder}
                />
              ))}
            </AnimatePresence>

            {/* Estado vazio */}
            {filteredFolders.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-2xl mb-2">📁</div>
                <div className="text-sm">Nenhuma pasta</div>
                <div className="text-xs">Clique em 📁➕ para criar</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
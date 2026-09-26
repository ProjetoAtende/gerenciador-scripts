// src/components/LinkSidebar.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LinkFolder } from '../types/Link';

interface LinkSidebarProps {
  folders: LinkFolder[];
  selectedFolderId: string | null;
  linksWithoutFolder: number;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder: () => void;
  onEditFolder: (folder: LinkFolder) => void;
  onDeleteFolder: (folder: LinkFolder) => void;
  onCreateLink: () => void;
  loading?: boolean;
  DroppableFolder?: React.ComponentType<{
    id: string;
    children: React.ReactNode;
    className?: string;
  }>;
}

export const LinkSidebar: React.FC<LinkSidebarProps> = ({
  folders,
  selectedFolderId,
  linksWithoutFolder,
  onFolderSelect,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onCreateLink,
  loading = false,
  DroppableFolder,
}) => {
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const startEditFolder = (folder: LinkFolder) => {
    setEditingFolderId(folder.id);
    setEditingName(folder.nome);
  };

  const saveEditFolder = () => {
    if (editingFolderId && editingName.trim()) {
      const folder = folders.find(f => f.id === editingFolderId);
      if (folder) {
        onEditFolder({ ...folder, nome: editingName.trim() });
      }
    }
    setEditingFolderId(null);
    setEditingName('');
  };

  const cancelEditFolder = () => {
    setEditingFolderId(null);
    setEditingName('');
  };

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header da sidebar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Organização</h3>
          <div className="flex gap-1">
            <button
              onClick={onCreateLink}
              className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
              title="Novo link"
            >
              🔗➕
            </button>
            <button
              onClick={onCreateFolder}
              className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
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
                <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <div className="p-2">
            {/* Links sem pasta */}
            {DroppableFolder ? (
              <DroppableFolder
                id="root-folder"
                className="mb-2"
              >
                <motion.div
                  whileHover={{ x: 2 }}
                  className={`
                    flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
                    ${selectedFolderId === null ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                  `}
                  onClick={() => onFolderSelect(null)}
                >
                  <span className="text-lg">🔗</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">Links</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{linksWithoutFolder} itens</div>
                  </div>
                </motion.div>
              </DroppableFolder>
            ) : (
              <motion.div
                whileHover={{ x: 2 }}
                className={`
                  flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors mb-2
                  ${selectedFolderId === null ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                `}
                onClick={() => onFolderSelect(null)}
              >
                <span className="text-lg">🔗</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">Links</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{linksWithoutFolder} itens</div>
                </div>
              </motion.div>
            )}

            {/* Pastas */}
            <AnimatePresence>
              {folders.map((folder) => {
                const folderContent = (
                  <>
                    <span className="text-lg">{folder.icone}</span>
                    
                    <div className="flex-1 min-w-0">
                      {editingFolderId === folder.id ? (
                        <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="w-full px-1 py-0.5 text-xs border border-blue-300 dark:border-blue-500 dark:bg-gray-700 dark:text-gray-100 rounded focus:ring-1 focus:ring-blue-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditFolder();
                              if (e.key === 'Escape') cancelEditFolder();
                            }}
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={saveEditFolder}
                              className="px-1 py-0.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                            >
                              ✓
                            </button>
                            <button
                              onClick={cancelEditFolder}
                              className="px-1 py-0.5 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div 
                            className="font-medium text-sm truncate"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              startEditFolder(folder);
                            }}
                          >
                            {folder.nome}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Pasta</div>
                        </>
                      )}
                    </div>

                    {/* Ações da pasta */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditFolder(folder);
                        }}
                        className="p-1 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded text-xs"
                        title="Renomear pasta"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFolder(folder);
                        }}
                        className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-xs"
                        title="Excluir pasta"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                );

                return (
                  <motion.div
                    key={folder.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="mb-1"
                  >
                    {DroppableFolder ? (
                      <DroppableFolder
                        id={`folder-${folder.id}`}
                      >
                        <motion.div
                          whileHover={{ x: 2 }}
                          className={`
                            group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
                            ${selectedFolderId === folder.id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
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
                          ${selectedFolderId === folder.id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                        `}
                        onClick={() => onFolderSelect(folder.id)}
                      >
                        {folderContent}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Estado vazio */}
            {folders.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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
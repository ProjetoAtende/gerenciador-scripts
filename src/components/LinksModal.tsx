import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { toast } from 'sonner';
import { DndContext, closestCenter, useDroppable, DragOverlay } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { extractMetadata } from '../utils/metaExtractor';
import { LinkItem, LinkFolder, LINK_TYPE_OPTIONS, LinkType } from '../types/Link';
import { LinkSidebar } from './LinkSidebar';
import { useLinkFolders } from '../hooks/useLinkFolders';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const hasMissingColumnError = (error: { message?: string } | null | undefined) =>
  Boolean(error?.message && error.message.includes('schema cache'));

const buildMetadataUpdates = async (rawUrl: string) => {
  const metadata = await extractMetadata(rawUrl.trim());
  return {
    favicon_url: metadata.favicon_url,
    site_title: metadata.title,
    domain: metadata.domain,
  };
};

const getTodayDateInputValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatLinkDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value));

const toCreatedAtTimestamp = (dateValue: string) => `${dateValue}T12:00:00.000Z`;

function SortableLinkCard({ 
  link,
  folder,
  onClick, 
  onDelete,
  onMove, 
  onEdit,
}: { 
  link: LinkItem;
  folder?: LinkFolder | null; 
  onClick: () => void; 
  onDelete: () => void;
  onMove: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const domain = link.domain || new URL(link.url.startsWith('http') ? link.url : `https://${link.url}`).hostname.replace('www.', '');
  const faviconUrl = link.favicon_url || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  const typeColorMap: Record<LinkType, string> = {
    Video: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
    Documento: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
    Website: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200',
  };
  const typeLabel = (link.tipo || 'Website') as LinkType;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden group cursor-pointer relative"
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10 bg-white/80 dark:bg-gray-800/80 rounded p-1"
      >
        ☰
      </div>

      {/* Conteúdo compacto */}
      <div 
        className="p-4 cursor-pointer"
        onClick={onClick}
      >
        {/* Header com pasta, favicon e domínio */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{folder?.icone || '🔗'}</span>
          <img 
            src={faviconUrl} 
            alt="" 
            className="w-4 h-4 flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
            }}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">
            {domain}
          </span>
        </div>

        <div>
          <h3 
            className="font-medium text-gray-800 dark:text-gray-200 truncate mb-2"
            title={link.nome}
          >
            {link.nome}
          </h3>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="flex flex-wrap gap-2">
            <div className={`text-xs px-2 py-1 rounded-full inline-block ${typeColorMap[typeLabel]}`}>
              {typeLabel}
            </div>
            {folder && (
              <div 
                className="text-xs px-2 py-1 rounded-full inline-block"
                style={{ 
                  backgroundColor: folder.cor ? `${folder.cor}20` : '#e5e7eb',
                  color: folder.cor || '#6b7280'
                }}
              >
                {folder.nome}
              </div>
            )}
            </div>
            <div className="text-right text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {formatLinkDate(link.criado_em)}
            </div>
          </div>
        </div>
      </div>

      {/* Actions overlay */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onMove(); }}
          className="bg-blue-500 text-white p-1 rounded text-xs hover:bg-blue-600"
          title="Mover para pasta"
        >
          📁
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="bg-yellow-500 text-white p-1 rounded text-xs hover:bg-yellow-600"
          title="Editar"
        >
          ✏️
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="bg-red-500 text-white p-1 rounded text-xs hover:bg-red-600"
          title="Excluir"
        >
          🗑️
        </button>
      </div>
    </motion.div>
  );
}

// Componente para pasta que aceita drop
function DroppableFolder({ 
  id, 
  children, 
  className 
}: { 
  id: string; 
  children: React.ReactNode; 
  className?: string; 
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} relative ${
        isOver 
          ? 'bg-gradient-to-r from-blue-100 to-blue-200 border-blue-500 border-2 border-dashed scale-105 shadow-lg' 
          : 'border-2 border-transparent hover:border-blue-200'
      } transition-all duration-300 rounded-lg`}
    >
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

export const LinksModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [nome, setNome] = useState('');
  const [url, setUrl] = useState('');
  const [tipo, setTipo] = useState<LinkType>('Website');
  const [dataCriacao, setDataCriacao] = useState(getTodayDateInputValue());
  const [formFolderId, setFormFolderId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<LinkType[]>([]);
  const [dateSortOrder, setDateSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState('📁');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [linkToMove, setLinkToMove] = useState<string | null>(null);
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{id: string, name: string, linkCount: number} | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Hook para gerenciar pastas
  const { folders, loading: foldersLoading, createFolder, updateFolder, deleteFolder, getFolderLinkCount } = useLinkFolders();

  const resetForm = () => {
    setNome('');
    setUrl('');
    setTipo('Website');
    setDataCriacao(getTodayDateInputValue());
    setFormFolderId(selectedFolderId);
    setEditandoId(null);
    setShowAddForm(false);
  };

  const openCreateForm = () => {
    setEditandoId(null);
    setNome('');
    setUrl('');
    setTipo('Website');
    setDataCriacao(getTodayDateInputValue());
    setFormFolderId(selectedFolderId);
    setShowAddForm(true);
  };

  const openEditForm = (link: LinkItem) => {
    setEditandoId(link.id);
    setNome(link.nome);
    setUrl(link.url);
    setTipo((link.tipo || 'Website') as LinkType);
    setDataCriacao(link.criado_em.slice(0, 10));
    setFormFolderId(link.pasta_id || null);
    setShowAddForm(true);
  };

  const toggleTypeFilter = (value: LinkType) => {
    setSelectedTypes((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  };

  const fetchLinks = async () => {
    setCarregando(true);
    const equipeId = localStorage.getItem("equipeId");

    const { data, error } = await supabase
      .from('links_uteis')
      .select(`
        *,
        pasta:pastas_links(*)
      `)
      .eq('equipe_id', equipeId)
      .order('criado_em', { ascending: true });
    
    if (error) toast.error('Erro ao carregar links');
    else setLinks(data || []);
    setCarregando(false);
  };

  useEffect(() => {
    if (isOpen) fetchLinks();
  }, [isOpen]);

  const salvarLink = async () => {
    if (!nome || !url) return toast.error('Preencha nome e URL');
    const equipeId = localStorage.getItem("equipeId");
    
    if (!equipeId) {
      toast.error('Equipe não selecionada');
      return;
    }
    
    try {
      // Primeiro, tentar com campos básicos
      const basicLink = { 
        nome: nome.trim(), 
        url: url.trim(), 
        equipe_id: equipeId,
        tipo,
        criado_em: toCreatedAtTimestamp(dataCriacao),
      };
      
      console.log('Dados básicos do link:', basicLink);
      
      if (editandoId) {
        const metadataUpdates = await buildMetadataUpdates(url);
        let { error } = await supabase
          .from('links_uteis')
          .update({
            nome: nome.trim(),
            url: url.trim(),
            tipo,
            ...metadataUpdates,
            pasta_id: formFolderId,
            criado_em: toCreatedAtTimestamp(dataCriacao),
          })
          .eq('id', editandoId);

        if (hasMissingColumnError(error)) {
          const fallback = await supabase
            .from('links_uteis')
            .update({
              nome: nome.trim(),
              url: url.trim(),
              tipo,
              pasta_id: formFolderId,
              criado_em: toCreatedAtTimestamp(dataCriacao),
            })
            .eq('id', editandoId);
          error = fallback.error;
        }
        
        if (error) {
          console.error('Erro detalhado ao atualizar link:', error);
          toast.error(`Erro ao atualizar link: ${error.message}`);
          return;
        }
      } else {
        // Para novos links, tentar inserir com campos básicos primeiro
        const { error: basicError, data: basicData } = await supabase
          .from('links_uteis')
          .insert(basicLink)
          .select();
        
        if (basicError) {
          console.error('Erro detalhado ao criar link:', basicError);
          toast.error(`Erro ao criar link: ${basicError.message}`);
          return;
        }
        
        // Se inserção básica funcionou, tentar atualizar com metadata
        if (basicData && basicData[0]) {
          try {
            const updates: Record<string, string | null> = {
              ...(await buildMetadataUpdates(url)),
              pasta_id: formFolderId,
            };

            let metadataUpdateResult = await supabase
              .from('links_uteis')
              .update(updates)
              .eq('id', basicData[0].id);

            if (hasMissingColumnError(metadataUpdateResult.error)) {
              metadataUpdateResult = await supabase
                .from('links_uteis')
                .update({ pasta_id: formFolderId })
                .eq('id', basicData[0].id);
            }

            if (metadataUpdateResult.error) {
              console.warn('Erro ao atualizar metadata do link criado:', metadataUpdateResult.error);
            }
          } catch (metaError) {
            console.warn('Erro ao atualizar metadata, mas link foi criado:', metaError);
          }
        }
      }
      
      toast.success(editandoId ? 'Link atualizado' : 'Link criado');
      resetForm();
      fetchLinks();
    } catch (err) {
      console.error('Erro inesperado ao salvar link:', err);
      toast.error('Erro inesperado ao salvar link');
    }
  };

  const excluirLink = async (id: string) => {
    const confirmar = confirm('Deseja excluir este link?');
    if (!confirmar) return;
    const { error } = await supabase.from('links_uteis').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir link');
    else {
      toast.success('Link excluído');
      fetchLinks();
    }
  };

  const scopedLinks = useMemo(() => links.filter(link => {
    const normalizedType = (link.tipo || 'Website') as LinkType;
    const matchesFolder = selectedFolderId === null 
      ? !link.pasta_id 
      : link.pasta_id === selectedFolderId;
    
    const matchesSearch = busca === '' || 
      link.nome.toLowerCase().includes(busca.toLowerCase()) ||
      link.url.toLowerCase().includes(busca.toLowerCase()) ||
      normalizedType.toLowerCase().includes(busca.toLowerCase());

    return matchesFolder && matchesSearch;
  }), [links, selectedFolderId, busca]);

  const visibleTypeCounts = useMemo(() => {
    return scopedLinks.reduce<Record<LinkType, number>>((acc, link) => {
      const normalizedType = (link.tipo || 'Website') as LinkType;
      acc[normalizedType] += 1;
      return acc;
    }, {
      Video: 0,
      Documento: 0,
      Website: 0,
    });
  }, [scopedLinks]);

  const filteredLinks = useMemo(() => {
    const filtered = scopedLinks.filter((link) => {
      const normalizedType = (link.tipo || 'Website') as LinkType;
      return selectedTypes.length === 0 || selectedTypes.includes(normalizedType);
    });

    return [...filtered].sort((a, b) => {
      const timeA = new Date(a.criado_em).getTime();
      const timeB = new Date(b.criado_em).getTime();
      return dateSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });
  }, [scopedLinks, selectedTypes, dateSortOrder]);

  // Contar links sem pasta
  const linksWithoutFolder = links.filter(l => !l.pasta_id).length;

  // Funções para criação de pasta
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    const success = await createFolder(newFolderName.trim(), '#3B82F6', newFolderIcon);
    if (success) {
      setNewFolderName('');
      setNewFolderIcon('📁');
      setShowCreateFolderModal(false);
    }
  };

  // Função para mover link
  const handleMoveLink = (linkId: string) => {
    setLinkToMove(linkId);
    setShowMoveModal(true);
  };

  const moveLinkToFolder = async (folderId: string | null) => {
    if (!linkToMove) return;
    
    const { error } = await supabase
      .from('links_uteis')
      .update({ pasta_id: folderId })
      .eq('id', linkToMove);

    if (error) {
      toast.error('Erro ao mover link');
    } else {
      toast.success('Link movido com sucesso');
      setLinkToMove(null);
      setShowMoveModal(false);
      fetchLinks();
    }
  };

  // Função para confirmar exclusão de pasta
  const handleDeleteFolder = async (folder: LinkFolder) => {
    const linkCount = await getFolderLinkCount(folder.id);
    
    setFolderToDelete({
      id: folder.id,
      name: folder.nome,
      linkCount
    });
    setShowDeleteFolderModal(true);
  };

  const confirmDeleteFolder = async (deleteContent: boolean) => {
    if (!folderToDelete) return;
    
    const success = await deleteFolder(folderToDelete.id, deleteContent);
    if (success) {
      setShowDeleteFolderModal(false);
      setFolderToDelete(null);
      // Atualizar links se necessário
      if (selectedFolderId === folderToDelete.id) {
        setSelectedFolderId(null);
      }
      fetchLinks();
    }
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: any) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Verificar se está sendo arrastado para uma pasta
    if (over.id.toString().startsWith('folder-') || over.id === 'root-folder') {
      const linkId = active.id;
      const folderId = over.id === 'root-folder' ? null : over.id.toString().replace('folder-', '');
      
      const { error } = await supabase
        .from('links_uteis')
        .update({ pasta_id: folderId })
        .eq('id', linkId);

      if (error) {
        toast.error('Erro ao mover link');
      } else {
        const linkName = links.find(l => l.id === linkId)?.nome || 'Link';
        const folderName = folderId 
          ? folders.find(f => f.id === folderId)?.nome || 'Pasta'
          : 'Links (sem pasta)';
        toast.success(`"${linkName}" movido para "${folderName}"`);
        fetchLinks();
      }
      return;
    }

    // Reordenação dentro da mesma pasta (comportamento original)
    const oldIndex = filteredLinks.findIndex(link => link.id === active.id);
    const newIndex = filteredLinks.findIndex(link => link.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reordered = arrayMove(filteredLinks, oldIndex, newIndex);

    // Atualizar apenas a ordem dos links filtrados
    for (let i = 0; i < reordered.length; i++) {
      await supabase.from('links_uteis').update({ criado_em: new Date(2000 + i, 0, 1).toISOString() }).eq('id', reordered[i].id);
    }

    const linkName = links.find(l => l.id === active.id)?.nome || 'Link';
    toast.success(`"${linkName}" movido para a posição ${newIndex + 1}.`);
    fetchLinks();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black bg-opacity-40 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-900 w-full h-full flex flex-col">
        {/* Header fixo */}
        <div className="flex justify-between items-center p-6 bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-30">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Links Úteis</h2>
          <div className="flex items-center gap-4">
            <div className="flex flex-wrap items-center gap-2 max-w-[700px] justify-end">
              <button
                onClick={() => setDateSortOrder((current) => current === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-1.5 rounded-full border text-sm transition-colors bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400"
              >
                {dateSortOrder === 'asc' ? 'Mais antigo primeiro' : 'Mais novo primeiro'}
              </button>
              {LINK_TYPE_OPTIONS.map((option) => {
                const active = selectedTypes.includes(option);
                return (
                  <button
                    key={option}
                    onClick={() => toggleTypeFilter(option)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                      active
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400'
                    }`}
                  >
                    {option} ({visibleTypeCounts[option]})
                  </button>
                );
              })}
              {selectedTypes.length > 0 && (
                <button
                  onClick={() => setSelectedTypes([])}
                  className="px-3 py-1.5 rounded-full border border-transparent text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600"
                >
                  Limpar filtros
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="Buscar links..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button 
              onClick={onClose} 
              className="bg-gray-300 dark:bg-gray-600 px-4 py-2 rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
        
        {/* Layout principal - Sidebar + Conteúdo */}
        <DndContext 
          collisionDetection={closestCenter} 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar com pastas */}
            <LinkSidebar
              folders={folders}
              selectedFolderId={selectedFolderId}
              linksWithoutFolder={linksWithoutFolder}
              onFolderSelect={setSelectedFolderId}
              onCreateFolder={() => setShowCreateFolderModal(true)}
              onEditFolder={(folder) => updateFolder(folder.id, { nome: folder.nome })}
              onDeleteFolder={handleDeleteFolder}
              onCreateLink={openCreateForm}
              loading={foldersLoading}
              DroppableFolder={DroppableFolder}
            />

            {/* Área principal com conteúdo */}
            <div className="flex-1 overflow-y-auto p-6">
          {/* Formulário de adição */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6"
              >
                <h3 className="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-300">
                  {editandoId ? 'Editar Link' : 'Novo Link'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    className="border border-blue-300 dark:border-blue-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nome do link"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                  <input
                    className="border border-blue-300 dark:border-blue-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="URL (https://...)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as LinkType)}
                    className="border border-blue-300 dark:border-blue-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {LINK_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={dataCriacao}
                    onChange={(e) => setDataCriacao(e.target.value)}
                    className="border border-blue-300 dark:border-blue-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <select
                    value={formFolderId || ''}
                    onChange={(e) => setFormFolderId(e.target.value || null)}
                    className="border border-blue-300 dark:border-blue-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sem pasta</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.icone} {folder.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={salvarLink} 
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {editandoId ? 'Salvar Edição' : 'Criar Link'}
                  </button>
                  <button 
                    onClick={resetForm}
                    className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid de cards */}
          {carregando ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-xl h-32 animate-pulse" />
              ))}
            </div>
          ) : (
            <SortableContext 
              items={[
                ...filteredLinks.map(l => l.id),
                'root-folder',
                ...folders.map(f => `folder-${f.id}`)
              ]} 
              strategy={rectSortingStrategy}
            >
              <motion.div 
                layout
                className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
              >
                <AnimatePresence>
                  {filteredLinks.map((link) => {
                    const folder = link.pasta_id ? 
                      folders.find(f => f.id === link.pasta_id) : null;
                    
                    return (
                      <SortableLinkCard
                        key={link.id}
                        link={link}
                        folder={folder}
                        onClick={() => window.open(link.url, '_blank')}
                        onDelete={() => excluirLink(link.id)}
                        onMove={() => handleMoveLink(link.id)}
                        onEdit={() => openEditForm(link)}
                      />
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </SortableContext>
          )}

          {/* Estado vazio */}
          {filteredLinks.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔗</div>
              <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
                {busca ? 'Nenhum link encontrado' : 'Nenhum link nesta pasta'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {busca || selectedTypes.length > 0 ? 'Ajuste a busca ou os filtros combinados' : 'Clique em 🔗➕ na barra lateral para adicionar'}
              </p>
            </div>
          )}
          </div>
          
          <DragOverlay>
            {activeId ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 opacity-95 transform rotate-2">
                <div className="p-3 text-center">
                  <div className="text-lg mb-1">🔗</div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {links.find(l => l.id === activeId)?.nome || 'Link'}
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </div>
        </DndContext>

        {/* Modal para criar pasta */}
        <AnimatePresence>
          {showCreateFolderModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96"
              >
                <h3 className="text-lg font-semibold mb-4">Nova Pasta</h3>
                
                {/* Seleção de ícone */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ícone da pasta
                  </label>
                  <div className="grid grid-cols-6 gap-2 mb-3">
                    {['📁', '📂', '🗂️', '📋', '📊', '💼', '🔧', '⚙️', '🔬', '📈', '🎯', '⭐'].map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setNewFolderIcon(icon)}
                        className={`p-2 text-lg rounded border-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          newFolderIcon === icon 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Nome da pasta"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') setShowCreateFolderModal(false);
                  }}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowCreateFolderModal(false);
                      setNewFolderName('');
                      setNewFolderIcon('📁');
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateFolder}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Criar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal para mover link */}
        <AnimatePresence>
          {showMoveModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96"
              >
                <h3 className="text-lg font-semibold mb-4">Mover Link</h3>
                <div className="space-y-2 mb-4">
                  <button
                    onClick={() => moveLinkToFolder(null)}
                    className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    🔗 Links (sem pasta)
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => moveLinkToFolder(folder.id)}
                      className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-2"
                    >
                      <span>{folder.icone}</span>
                      <span>{folder.nome}</span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowMoveModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal para confirmar exclusão de pasta com conteúdo */}
        <AnimatePresence>
          {showDeleteFolderModal && folderToDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md"
              >
                <h3 className="text-lg font-semibold mb-4 text-red-600">
                  ⚠️ Excluir Pasta
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Deseja excluir a pasta "<strong>{folderToDelete.name}</strong>"
                  {folderToDelete.linkCount > 0 && (
                    <>
                      {' '}que contém <strong>{folderToDelete.linkCount}</strong>{' '}
                      {folderToDelete.linkCount === 1 ? 'link' : 'links'}
                    </>
                  )}?
                </p>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                  {folderToDelete.linkCount > 0 
                    ? 'O que deseja fazer com o conteúdo da pasta?' 
                    : 'Confirme a exclusão da pasta vazia:'
                  }
                </p>
                
                <div className="space-y-3">
                  {folderToDelete.linkCount > 0 ? (
                    <>
                      <button
                        onClick={() => confirmDeleteFolder(false)}
                        className="w-full p-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-left"
                      >
                        <div className="font-medium">🔗 Mover para raiz</div>
                        <div className="text-sm text-blue-100">
                          Os links serão movidos para "Links (sem pasta)"
                        </div>
                      </button>
                      
                      <button
                        onClick={() => confirmDeleteFolder(true)}
                        className="w-full p-3 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-left"
                      >
                        <div className="font-medium">🗑️ Excluir tudo</div>
                        <div className="text-sm text-red-100">
                          A pasta e todos os links serão excluídos permanentemente
                        </div>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => confirmDeleteFolder(false)}
                      className="w-full p-3 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-left"
                    >
                      <div className="font-medium">🗑️ Excluir pasta vazia</div>
                      <div className="text-sm text-red-100">
                        A pasta será excluída permanentemente
                      </div>
                    </button>
                  )}
                </div>

                <div className="flex justify-end mt-4 pt-4 border-t">
                  <button
                    onClick={() => {
                      setShowDeleteFolderModal(false);
                      setFolderToDelete(null);
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// src/hooks/useLinkFolders.ts
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { LinkFolder } from '../types/Link';
import { toast } from 'sonner';

export const useLinkFolders = () => {
  const [folders, setFolders] = useState<LinkFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = async () => {
    const equipeId = localStorage.getItem("equipeId");
    if (!equipeId) {
      setFolders([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('pastas_links')
        .select('*')
        .eq('equipe_id', equipeId)
        .order('ordem', { ascending: true })
        .order('criado_em', { ascending: true });

      if (error) {
        console.error('Erro ao carregar pastas de links:', error);
        setError('Erro ao carregar pastas');
        setFolders([]);
      } else {
        setFolders(data || []);
      }
    } catch (err) {
      console.error('Erro inesperado:', err);
      setError('Erro inesperado ao carregar pastas');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  const createFolder = async (nome: string, cor: string = '#3B82F6', icone: string = '🔗') => {
    const equipeId = localStorage.getItem("equipeId");
    if (!equipeId) {
      toast.error("Equipe não selecionada");
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('pastas_links')
        .insert({
          nome,
          cor,
          icone,
          equipe_id: equipeId,
          ordem: folders.length
        })
        .select()
        .single();

      if (error) {
        toast.error('Erro ao criar pasta');
        return null;
      }

      toast.success('Pasta criada com sucesso');
      fetchFolders();
      return data;
    } catch (err) {
      toast.error('Erro inesperado ao criar pasta');
      return null;
    }
  };

  const updateFolder = async (id: string, updates: Partial<LinkFolder>) => {
    try {
      const { error } = await supabase
        .from('pastas_links')
        .update(updates)
        .eq('id', id);

      if (error) {
        toast.error('Erro ao atualizar pasta');
        return false;
      }

      toast.success('Pasta atualizada');
      fetchFolders();
      return true;
    } catch (err) {
      toast.error('Erro inesperado ao atualizar pasta');
      return false;
    }
  };

  const deleteFolder = async (id: string, deleteContent: boolean = false) => {
    try {
      if (deleteContent) {
        // Excluir todos os links da pasta
        await supabase
          .from('links_uteis')
          .delete()
          .eq('pasta_id', id);
      } else {
        // Mover todos os links da pasta para "sem pasta"
        await supabase
          .from('links_uteis')
          .update({ pasta_id: null })
          .eq('pasta_id', id);
      }

      // Depois excluir a pasta
      const { error } = await supabase
        .from('pastas_links')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error('Erro ao excluir pasta');
        return false;
      }

      toast.success('Pasta excluída');
      fetchFolders();
      return true;
    } catch (err) {
      toast.error('Erro inesperado ao excluir pasta');
      return false;
    }
  };

  const getFolderLinkCount = async (folderId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('links_uteis')
        .select('*', { count: 'exact', head: true })
        .eq('pasta_id', folderId);

      if (error) {
        console.error('Erro ao contar links da pasta:', error);
        return 0;
      }

      return count || 0;
    } catch (err) {
      console.error('Erro inesperado ao contar links:', err);
      return 0;
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  return {
    folders,
    loading,
    error,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    getFolderLinkCount
  };
};
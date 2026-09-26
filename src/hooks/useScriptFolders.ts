// src/hooks/useScriptFolders.ts
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { ScriptFolder, ScriptFolderWithChildren } from '../types/Script';
import { toast } from 'sonner';

// Função para organizar pastas em hierarquia
const buildFolderHierarchy = (folders: ScriptFolder[]): ScriptFolderWithChildren[] => {
  const folderMap = new Map<string, ScriptFolderWithChildren>();

  // Criar mapa com todas as pastas
  folders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] });
  });

  const rootFolders: ScriptFolderWithChildren[] = [];

  // Organizar hierarquia
  folders.forEach(folder => {
    const folderWithChildren = folderMap.get(folder.id)!;

    if (folder.pasta_pai_id && folderMap.has(folder.pasta_pai_id)) {
      // É uma subpasta - adicionar ao pai
      folderMap.get(folder.pasta_pai_id)!.children.push(folderWithChildren);
    } else {
      // É uma pasta raiz
      rootFolders.push(folderWithChildren);
    }
  });

  return rootFolders;
};

export const useScriptFolders = () => {
  const [folders, setFolders] = useState<ScriptFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hierarquia de pastas calculada
  const folderHierarchy = useMemo(() => buildFolderHierarchy(folders), [folders]);

  const fetchFolders = async () => {
    // Carrega todas as pastas de todas as equipes
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('pastas_scripts')
        .select('*')
        .order('ordem', { ascending: true })
        .order('criado_em', { ascending: true });

      if (error) {
        console.error('Erro ao carregar pastas:', error);
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

  const createFolder = async (
    nome: string, 
    cor: string = '#3B82F6', 
    icone: string = '📁',
    pasta_pai_id: string | null = null
  ) => {
    // Usar equipe do localStorage
    const equipeId = localStorage.getItem("equipeId");
    
    if (!equipeId) {
      toast.error('Erro: Equipe não identificada. Faça login novamente.');
      return null;
    }

    try {
      const insertData: any = {
        nome,
        cor,
        icone,
        equipe_id: equipeId,
        ordem: folders.length
      };

      // Adicionar pasta_pai_id apenas se fornecido
      if (pasta_pai_id) {
        insertData.pasta_pai_id = pasta_pai_id;
      }

      const { data, error } = await supabase
        .from('pastas_scripts')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        toast.error('Erro ao criar pasta');
        return null;
      }

      const tipoMsg = pasta_pai_id ? 'Subpasta criada com sucesso' : 'Pasta criada com sucesso';
      toast.success(tipoMsg);
      fetchFolders();
      return data;
    } catch (err) {
      toast.error('Erro inesperado ao criar pasta');
      return null;
    }
  };

  const updateFolder = async (id: string, updates: Partial<ScriptFolder>) => {
    try {
      const { error } = await supabase
        .from('pastas_scripts')
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
        // Excluir todos os scripts da pasta
        await supabase
          .from('scripts_customizados')
          .delete()
          .eq('pasta_id', id);
      } else {
        // Mover todos os scripts da pasta para "sem pasta"
        await supabase
          .from('scripts_customizados')
          .update({ pasta_id: null })
          .eq('pasta_id', id);
      }

      // Depois excluir a pasta
      const { error } = await supabase
        .from('pastas_scripts')
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

  const getFolderScriptCount = async (folderId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('scripts_customizados')
        .select('*', { count: 'exact', head: true })
        .eq('pasta_id', folderId);

      if (error) {
        console.error('Erro ao contar scripts da pasta:', error);
        return 0;
      }

      return count || 0;
    } catch (err) {
      console.error('Erro inesperado ao contar scripts:', err);
      return 0;
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  return {
    folders,
    folderHierarchy,
    loading,
    error,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    getFolderScriptCount
  };
};
/**
 * Permissões Service
 * Gestão do catálogo de objetos de autorização e respectivos grants
 * (equipe / role / usuário). Apenas admin pode escrever.
 */

import { supabase } from './supabaseClient';

export type PermissaoTargetType = 'equipe' | 'role' | 'usuario';

export interface PermissaoObjeto {
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  origem: string | null;
  total_grants: number;
}

export interface PermissaoGrant {
  id: string;
  objeto_codigo: string;
  target_type: PermissaoTargetType;
  target_id: string;
  target_nome: string | null;
  created_at: string;
}

export async function listarObjetosPermissao(): Promise<PermissaoObjeto[]> {
  const { data, error } = await supabase.rpc('permissoes_listar_objetos');
  if (error) throw error;
  return (data || []) as PermissaoObjeto[];
}

export async function listarGrantsObjeto(objetoCodigo: string): Promise<PermissaoGrant[]> {
  const { data, error } = await supabase.rpc('permissoes_listar_grants', {
    p_objeto_codigo: objetoCodigo,
  });
  if (error) throw error;
  return (data || []) as PermissaoGrant[];
}

export async function setGrant(
  objetoCodigo: string,
  targetType: PermissaoTargetType,
  targetId: string,
  granted: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('permissoes_set_grant', {
    p_objeto_codigo: objetoCodigo,
    p_target_type: targetType,
    p_target_id: targetId,
    p_granted: granted,
  });
  if (error) throw error;
}

export async function temPermissao(codigo: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('tem_permissao', { p_codigo: codigo });
  if (error) throw error;
  return Boolean(data);
}

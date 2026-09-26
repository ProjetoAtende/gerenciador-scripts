/**
 * Admin Service
 * Gerenciamento de Usuários, Equipes, Setores e GSEs
 * Permissão de escrita: Apenas usuários com role = 'admin'
 */

import { supabase } from './supabaseClient';
import { User, Equipe, Setor, GSEEquipe } from '../types/Ticket';

// =====================================================
// CONSTANTES E TIPOS
// =====================================================

const BOSS_EMAIL = 'dpestilli@tjsp.jus.br';

export interface UserWithStatus extends User {
  ativo?: boolean;
  supervisor_equipe_ids?: string[];
  supervisor_equipes?: Equipe[];
}

export interface EquipeWithSetor extends Equipe {
  setor?: Setor;
  _count?: {
    users: number;
    gses: number;
  };
}

export interface SetorWithCount extends Setor {
  _count?: {
    equipes: number;
  };
}

export interface GSEWithEquipe extends GSEEquipe {
  equipe?: Equipe;
}

export interface CreateUserData {
  email: string;
  senha: string;
  nome: string;
  role?: 'user' | 'supervisor' | 'coordenador' | 'admin';
  equipe_id?: string | null;
  setor_id?: string | null;
  supervisor_equipe_ids?: string[];
}

export interface UpdateUserData {
  nome?: string;
  role?: 'user' | 'supervisor' | 'coordenador' | 'admin';
  equipe_id?: string | null;
  setor_id?: string | null;
  supervisor_equipe_ids?: string[];
}

interface UsuarioFuncaoEquipeRow {
  user_id: string;
  equipe_id: string;
}

interface RpcResponse {
  success: boolean;
  error?: string;
  message?: string;
  id?: string;
  user_id?: string;
  senha?: string; // ✅ Adicionar senha para retornar ao criar usuário
  ativo?: boolean;
}

type AdminUsersAction = 'create' | 'toggle-active' | 'reset-password';

interface EdgeFunctionErrorLike {
  message?: string;
  context?: Response;
}

// =====================================================
// VERIFICAÇÃO DE PERMISSÃO
// =====================================================

/**
 * Verifica se o usuário possui role de admin
 */
export const isAdmin = (role: string | null | undefined): boolean => {
  return role === 'admin';
};

/**
 * Verifica se o email é do Boss (administrador)
 * @deprecated Use isAdmin(role) instead
 */
export const isBoss = (email: string | null | undefined): boolean => {
  return email === BOSS_EMAIL;
};

const extractEdgeFunctionError = async (error: unknown): Promise<string> => {
  if (error && typeof error === 'object') {
    const maybeError = error as EdgeFunctionErrorLike;

    if (maybeError.context) {
      try {
        const body = await maybeError.context.json() as { error?: string; message?: string };
        if (body?.error) return body.error;
        if (body?.message) return body.message;
      } catch {
        // Ignora falha ao parsear o corpo e usa a mensagem fallback abaixo.
      }
    }

    if (typeof maybeError.message === 'string' && maybeError.message.trim() !== '') {
      return maybeError.message;
    }
  }

  return 'Falha ao executar ação administrativa';
};

const invokeAdminUsersAction = async (
  action: AdminUsersAction,
  payload: Record<string, unknown>
): Promise<RpcResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action, payload }
    });

    if (error) {
      const message = await extractEdgeFunctionError(error);
      console.error(`Erro edge function admin-users (${action}):`, error);
      return { success: false, error: message };
    }

    return (data || { success: false, error: 'Resposta vazia da função administrativa' }) as RpcResponse;
  } catch (error) {
    const message = await extractEdgeFunctionError(error);
    console.error(`Erro ao invocar admin-users (${action}):`, error);
    return { success: false, error: message };
  }
};

// =====================================================
// CRUD - SETORES
// =====================================================

/**
 * Lista todos os setores
 */
export const listarSetores = async (): Promise<SetorWithCount[]> => {
  const { data, error } = await supabase
    .from('setores')
    .select('*')
    .order('nome');

  if (error) {
    console.error('Erro ao listar setores:', error);
    throw error;
  }

  // Buscar contagem de equipes por setor
  const setoresComContagem = await Promise.all(
    (data || []).map(async (setor) => {
      const { count } = await supabase
        .from('equipes')
        .select('*', { count: 'exact', head: true })
        .eq('setor_id', setor.id);

      return {
        ...setor,
        _count: { equipes: count || 0 }
      };
    })
  );

  return setoresComContagem;
};

/**
 * Cria um novo setor (apenas Boss)
 */
export const criarSetor = async (nome: string): Promise<RpcResponse> => {
  const { data, error } = await supabase.rpc('admin_criar_setor', {
    p_nome: nome
  });

  if (error) {
    console.error('Erro RPC criar setor:', error);
    return { success: false, error: error.message };
  }

  return data as RpcResponse;
};

/**
 * Atualiza um setor (apenas Boss)
 */
export const editarSetor = async (id: string, nome: string): Promise<RpcResponse> => {
  const { data, error } = await supabase.rpc('admin_atualizar_setor', {
    p_id: id,
    p_nome: nome
  });

  if (error) {
    console.error('Erro RPC atualizar setor:', error);
    return { success: false, error: error.message };
  }

  return data as RpcResponse;
};

/**
 * Deleta um setor (apenas Boss)
 */
export const deletarSetor = async (id: string): Promise<RpcResponse> => {
  const { data, error } = await supabase.rpc('admin_deletar_setor', {
    p_id: id
  });

  if (error) {
    console.error('Erro RPC deletar setor:', error);
    return { success: false, error: error.message };
  }

  return data as RpcResponse;
};

// =====================================================
// CRUD - EQUIPES
// =====================================================

/**
 * Lista equipes, opcionalmente filtradas por setor
 */
export const listarEquipes = async (setorId?: string): Promise<EquipeWithSetor[]> => {
  // Buscar equipes
  let query = supabase
    .from('equipes')
    .select('*')
    .order('nome');

  if (setorId) {
    query = query.eq('setor_id', setorId);
  }

  const { data: equipes, error } = await query;

  if (error) {
    console.error('Erro ao listar equipes:', error);
    throw error;
  }

  if (!equipes || equipes.length === 0) {
    return [];
  }

  // Buscar setores relacionados
  const setorIds = [...new Set(equipes.map(e => e.setor_id).filter(Boolean))];

  let setoresMap = new Map();
  if (setorIds.length > 0) {
    const { data: setores } = await supabase
      .from('setores')
      .select('*')
      .in('id', setorIds);
    setoresMap = new Map((setores || []).map(s => [s.id, s]));
  }

  // Buscar contagens
  const equipesComContagem = await Promise.all(
    equipes.map(async (equipe) => {
      const [usersCount, gsesCount] = await Promise.all([
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('equipe_id', equipe.id),
        supabase
          .from('gse_equipes')
          .select('*', { count: 'exact', head: true })
          .eq('equipe_id', equipe.id)
      ]);

      return {
        ...equipe,
        setor: equipe.setor_id ? setoresMap.get(equipe.setor_id) : undefined,
        _count: {
          users: usersCount.count || 0,
          gses: gsesCount.count || 0
        }
      };
    })
  );

  return equipesComContagem;
};

/**
 * Cria uma nova equipe (apenas Boss)
 */
export const criarEquipe = async (nome: string, setorId: string): Promise<RpcResponse> => {
  const { data, error } = await supabase.rpc('admin_criar_equipe', {
    p_nome: nome,
    p_setor_id: setorId
  });

  if (error) {
    console.error('Erro RPC criar equipe:', error);
    return { success: false, error: error.message };
  }

  return data as RpcResponse;
};

/**
 * Atualiza uma equipe (apenas Boss)
 */
export const editarEquipe = async (id: string, nome: string, setorId: string): Promise<RpcResponse> => {
  const { data, error } = await supabase.rpc('admin_atualizar_equipe', {
    p_id: id,
    p_nome: nome,
    p_setor_id: setorId
  });

  if (error) {
    console.error('Erro RPC atualizar equipe:', error);
    return { success: false, error: error.message };
  }

  return data as RpcResponse;
};

/**
 * Deleta uma equipe (apenas Boss)
 */
export const deletarEquipe = async (id: string): Promise<RpcResponse> => {
  const { data, error } = await supabase.rpc('admin_deletar_equipe', {
    p_id: id
  });

  if (error) {
    console.error('Erro RPC deletar equipe:', error);
    return { success: false, error: error.message };
  }

  return data as RpcResponse;
};

// =====================================================
// CRUD - USUÁRIOS
// =====================================================

/**
 * Lista usuários com filtros opcionais
 */
export const listarUsuarios = async (filtros?: {
  setorId?: string;
  equipeId?: string;
  role?: string;
  ativo?: boolean;
}): Promise<UserWithStatus[]> => {
  // Buscar usuários
  let query = supabase
    .from('users')
    .select('*')
    .order('nome');

  if (filtros?.setorId) {
    query = query.eq('setor_id', filtros.setorId);
  }

  if (filtros?.equipeId) {
    query = query.eq('equipe_id', filtros.equipeId);
  }

  if (filtros?.role) {
    query = query.eq('role', filtros.role);
  }

  if (filtros?.ativo !== undefined) {
    query = query.eq('ativo', filtros.ativo);
  }

  const { data: usuarios, error } = await query;

  if (error) {
    console.error('Erro ao listar usuários:', error);
    throw error;
  }

  if (!usuarios || usuarios.length === 0) {
    return [];
  }

  const usuarioIds = usuarios.map(u => u.id);

  // Buscar funções adicionais de supervisor por equipe
  let funcoesSupervisor: UsuarioFuncaoEquipeRow[] = [];
  if (usuarioIds.length > 0) {
    const { data: funcoes, error: funcoesError } = await supabase
      .from('usuario_funcoes_equipe')
      .select('user_id, equipe_id')
      .in('user_id', usuarioIds)
      .eq('funcao', 'supervisor')
      .eq('ativo', true);

    if (funcoesError) {
      console.warn('Aviso ao listar funções adicionais de usuários:', funcoesError.message);
    } else {
      funcoesSupervisor = (funcoes || []) as UsuarioFuncaoEquipeRow[];
    }
  }

  // Buscar equipes relacionadas
  const equipeIds = [
    ...new Set([
      ...usuarios.map(u => u.equipe_id).filter(Boolean),
      ...funcoesSupervisor.map(f => f.equipe_id).filter(Boolean)
    ])
  ];
  let equipesMap = new Map();
  if (equipeIds.length > 0) {
    const { data: equipes } = await supabase
      .from('equipes')
      .select('*')
      .in('id', equipeIds);
    equipesMap = new Map((equipes || []).map(e => [e.id, e]));
  }

  // Buscar setores relacionados
  const setorIds = [...new Set(usuarios.map(u => u.setor_id).filter(Boolean))];
  let setoresMap = new Map();
  if (setorIds.length > 0) {
    const { data: setores } = await supabase
      .from('setores')
      .select('*')
      .in('id', setorIds);
    setoresMap = new Map((setores || []).map(s => [s.id, s]));
  }

  const supervisorEquipeIdsPorUsuario = new Map<string, string[]>();
  funcoesSupervisor.forEach((funcao) => {
    const atuais = supervisorEquipeIdsPorUsuario.get(funcao.user_id) || [];
    atuais.push(funcao.equipe_id);
    supervisorEquipeIdsPorUsuario.set(funcao.user_id, atuais);
  });

  // Combinar dados
  return usuarios.map(u => ({
    ...u,
    equipe: u.equipe_id ? equipesMap.get(u.equipe_id) : undefined,
    setor: u.setor_id ? setoresMap.get(u.setor_id) : undefined,
    supervisor_equipe_ids: supervisorEquipeIdsPorUsuario.get(u.id) || [],
    supervisor_equipes: (supervisorEquipeIdsPorUsuario.get(u.id) || [])
      .map((equipeId) => equipesMap.get(equipeId))
      .filter(Boolean)
  })) as UserWithStatus[];
};

/**
 * Define as equipes em que o usuário atua como supervisor adicional.
 * Preserva o role principal do usuário.
 */
export const salvarSupervisorEquipesUsuario = async (
  userId: string,
  equipeIds: string[]
): Promise<RpcResponse> => {
  const { data, error } = await supabase.rpc('admin_set_usuario_supervisor_equipes', {
    p_user_id: userId,
    p_equipe_ids: equipeIds
  });

  if (error) {
    console.error('Erro RPC salvar supervisorias do usuário:', error);
    return { success: false, error: error.message };
  }

  return data as RpcResponse;
};

/**
 * Cria um novo usuário (apenas Boss)
 * Executa via Edge Function para que Auth + public.users sejam sincronizados no backend.
 */
export const criarUsuario = async (dados: CreateUserData): Promise<RpcResponse> => {
  return invokeAdminUsersAction('create', {
    email: dados.email,
    senha: dados.senha,
    nome: dados.nome,
    role: dados.role || 'user',
    equipe_id: dados.equipe_id || null,
    setor_id: dados.setor_id || null,
    supervisor_equipe_ids: dados.supervisor_equipe_ids ?? []
  });
};

/**
 * Atualiza um usuário (apenas Boss)
 */
export const editarUsuario = async (id: string, dados: UpdateUserData): Promise<RpcResponse> => {
  // Diferenciar "campo ausente" (não atualizar) de "explicitamente null" (limpar).
  // O RPC usa COALESCE por padrão; flags p_clear_* forçam NULL no UPDATE.
  const clearEquipe = Object.prototype.hasOwnProperty.call(dados, 'equipe_id') && dados.equipe_id === null;
  const clearSetor = Object.prototype.hasOwnProperty.call(dados, 'setor_id') && dados.setor_id === null;

  const { data, error } = await supabase.rpc('admin_atualizar_usuario', {
    p_user_id: id,
    p_nome: dados.nome || null,
    p_role: dados.role || null,
    p_equipe_id: dados.equipe_id || null,
    p_setor_id: dados.setor_id || null,
    p_clear_equipe_id: clearEquipe,
    p_clear_setor_id: clearSetor
  });

  if (error) {
    console.error('Erro RPC atualizar usuário:', error);
    return { success: false, error: error.message };
  }

  const result = data as RpcResponse;

  if (!result.success) {
    return result;
  }

  if (dados.supervisor_equipe_ids !== undefined) {
    const supervisorResult = await salvarSupervisorEquipesUsuario(id, dados.supervisor_equipe_ids);
    if (!supervisorResult.success) {
      return supervisorResult;
    }
  }

  return result;
};

/**
 * Ativa/desativa um usuário (apenas Boss)
 */
export const toggleUsuarioAtivo = async (id: string): Promise<RpcResponse> => {
  const { data, error } = await supabase.rpc('admin_toggle_usuario_ativo', {
    p_user_id: id
  });

  if (error) {
    console.error('Erro RPC toggle usuário ativo:', error);
    return { success: false, error: error.message };
  }

  return data as RpcResponse;
};

/**
 * Ativa/desativa um usuário sincronizando public.users e ban/unban no Auth.
 */
export const toggleUsuarioAtivoComBan = async (id: string): Promise<RpcResponse> => {
  return invokeAdminUsersAction('toggle-active', { userId: id });
};

/**
 * Reseta a senha de um usuário (apenas Boss)
 */
export const resetarSenhaUsuario = async (id: string, novaSenha: string): Promise<RpcResponse> => {
  return invokeAdminUsersAction('reset-password', {
    userId: id,
    newPassword: novaSenha
  });
};

/**
 * Deleta um usuário completamente (apenas Boss)
 * Remove o usuário do auth e do banco de dados
 */
export const deletarUsuario = async (id: string): Promise<RpcResponse> => {
  const { data, error } = await supabase.rpc('admin_deletar_usuario', {
    p_user_id: id
  });

  if (error) {
    console.error('Erro RPC deletar usuário:', error);
    return { success: false, error: error.message };
  }

  return data as RpcResponse;
};

// =====================================================
// CRUD - GSEs
// =====================================================

/**
 * Lista GSEs, opcionalmente filtrados por equipe
 */
export const listarGSEs = async (equipeId?: string): Promise<GSEWithEquipe[]> => {
  // Buscar GSEs
  let query = supabase
    .from('gse_equipes')
    .select('*')
    .order('gse');

  if (equipeId) {
    query = query.eq('equipe_id', equipeId);
  }

  const { data: gses, error } = await query;

  if (error) {
    console.error('Erro ao listar GSEs:', error);
    throw error;
  }

  if (!gses || gses.length === 0) {
    return [];
  }

  // Buscar equipes relacionadas
  const equipeIds = [...new Set(gses.map(g => g.equipe_id).filter(Boolean))];

  if (equipeIds.length === 0) {
    return gses.map(g => ({ ...g, equipe: undefined })) as GSEWithEquipe[];
  }

  const { data: equipes } = await supabase
    .from('equipes')
    .select('*')
    .in('id', equipeIds);

  const equipesMap = new Map((equipes || []).map(e => [e.id, e]));

  // Combinar dados
  return gses.map(g => ({
    ...g,
    equipe: g.equipe_id ? equipesMap.get(g.equipe_id) : undefined
  })) as GSEWithEquipe[];
};

/**
 * Cria um novo GSE (apenas Boss)
 */
export const criarGSE = async (gse: string, equipeId: string): Promise<RpcResponse> => {
  const { data, error } = await supabase.rpc('admin_criar_gse', {
    p_gse: gse,
    p_equipe_id: equipeId
  });

  if (error) {
    console.error('Erro RPC criar GSE:', error);
    return { success: false, error: error.message };
  }

  return data as RpcResponse;
};

/**
 * Atualiza um GSE (apenas Boss)
 */
export const editarGSE = async (id: string, gse: string, equipeId: string): Promise<RpcResponse> => {
  const { data, error } = await supabase.rpc('admin_atualizar_gse', {
    p_id: id,
    p_gse: gse,
    p_equipe_id: equipeId
  });

  if (error) {
    console.error('Erro RPC atualizar GSE:', error);
    return { success: false, error: error.message };
  }

  return data as RpcResponse;
};

/**
 * Deleta um GSE (apenas Boss)
 */
export const deletarGSE = async (id: string): Promise<RpcResponse> => {
  const { data, error } = await supabase.rpc('admin_deletar_gse', {
    p_id: id
  });

  if (error) {
    console.error('Erro RPC deletar GSE:', error);
    return { success: false, error: error.message };
  }

  return data as RpcResponse;
};

// =====================================================
// EXPORT DEFAULT
// =====================================================

export default {
  isBoss,
  // Setores
  listarSetores,
  criarSetor,
  editarSetor,
  deletarSetor,
  // Equipes
  listarEquipes,
  criarEquipe,
  editarEquipe,
  deletarEquipe,
  // Usuários
  listarUsuarios,
  criarUsuario,
  editarUsuario,
  salvarSupervisorEquipesUsuario,
  toggleUsuarioAtivo,
  toggleUsuarioAtivoComBan,
  resetarSenhaUsuario,
  // GSEs
  listarGSEs,
  criarGSE,
  editarGSE,
  deletarGSE
};

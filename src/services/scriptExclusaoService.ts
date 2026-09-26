/**
 * Serviço para gerenciar exclusão de scripts customizados
 * Implementa lógica de exclusão hard/soft baseada em publicação ou revisão pela curadoria
 */

import { supabase } from './supabaseClient';

export interface ResultadoExclusao {
  sucesso: boolean;
  tipoExclusao: 'hard' | 'soft' | null;
  mensagem: string;
  erro?: string;
  requireApproval?: boolean;
}

export interface ScriptPendenteExclusao {
  id: string;
  nome: string;
  numero_chamado: string | null;
  equipe_id: string;
  exclusao_solicitada_em: string;
  motivo_exclusao: string | null;
  solicitante_email: string;
  perfil_solicitante: string;
  equipe_nome: string;
}

/**
 * Solicita exclusão de um script
 * - Rascunho (não publicado e não revisado) → Exclusão permanente (hard)
 * - Publicado ou revisado pela curadoria → Marca para aprovação (soft)
 */
export function scriptExigeAprovacaoExclusao(script: {
  email_enviado?: boolean;
  curadoria_atuada?: boolean;
}): boolean {
  return !!(script.email_enviado || script.curadoria_atuada);
}

export async function solicitarExclusaoScript(
  scriptId: string,
  motivo?: string
): Promise<ResultadoExclusao> {
  try {
    // Obter user_id atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        sucesso: false,
        tipoExclusao: null,
        mensagem: 'Usuário não autenticado',
        erro: 'AUTH_ERROR',
      };
    }

    // Chamar RPC function para processar exclusão
    const { data, error } = await supabase.rpc('solicitar_exclusao_script', {
      p_script_id: scriptId,
      p_usuario_id: user.id,
      p_motivo: motivo || null,
    });

    if (error) {
      console.error('Erro ao solicitar exclusão:', error);
      return {
        sucesso: false,
        tipoExclusao: null,
        mensagem: 'Erro ao processar solicitação de exclusão',
        erro: error.message,
      };
    }

    const resultado = data as {
      sucesso: boolean;
      tipo_exclusao: 'hard' | 'soft';
      mensagem: string;
      erro?: string;
    };

    // Se foi exclusão soft, o script fica pendente na view scripts_pendentes_exclusao
    // A curadoria verá no filtro Revisão → Exclusão e no sininho de notificações
    if (resultado.sucesso && resultado.tipo_exclusao === 'soft') {
      return {
        sucesso: true,
        tipoExclusao: 'soft',
        mensagem: resultado.mensagem,
        requireApproval: true,
      };
    }

    // Se foi exclusão hard
    if (resultado.sucesso && resultado.tipo_exclusao === 'hard') {
      return {
        sucesso: true,
        tipoExclusao: 'hard',
        mensagem: resultado.mensagem,
        requireApproval: false,
      };
    }

    return {
      sucesso: false,
      tipoExclusao: null,
      mensagem: resultado.erro || 'Erro desconhecido',
    };

  } catch (error) {
    console.error('Erro inesperado ao solicitar exclusão:', error);
    return {
      sucesso: false,
      tipoExclusao: null,
      mensagem: 'Erro inesperado ao processar solicitação',
      erro: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Lista scripts pendentes de exclusão (para admin)
 */
export async function listarScriptsPendentesExclusao(): Promise<{
  scripts: ScriptPendenteExclusao[];
  erro?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('scripts_pendentes_exclusao')
      .select('*')
      .order('exclusao_solicitada_em', { ascending: false });

    if (error) {
      console.error('Erro ao listar scripts pendentes:', error);
      return { scripts: [], erro: error.message };
    }

    return { scripts: data || [] };

  } catch (error) {
    console.error('Erro ao listar scripts pendentes:', error);
    return {
      scripts: [],
      erro: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Aprovar ou negar exclusão de script (admin)
 */
export async function aprovarNegarExclusao(
  scriptId: string,
  aprovar: boolean,
  observacao?: string
): Promise<{ sucesso: boolean; mensagem: string; erro?: string }> {
  try {
    // Obter user_id atual (admin)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        sucesso: false,
        mensagem: 'Usuário não autenticado',
        erro: 'AUTH_ERROR',
      };
    }

    // Chamar RPC function
    const { data, error } = await supabase.rpc('aprovar_exclusao_script', {
      p_script_id: scriptId,
      p_admin_id: user.id,
      p_aprovar: aprovar,
      p_observacao: observacao || null,
    });

    if (error) {
      console.error('Erro ao processar aprovação:', error);
      return {
        sucesso: false,
        mensagem: 'Erro ao processar aprovação/negação',
        erro: error.message,
      };
    }

    const resultado = data as {
      sucesso: boolean;
      acao: 'aprovada' | 'negada';
      mensagem: string;
      erro?: string;
    };

    return {
      sucesso: resultado.sucesso,
      mensagem: resultado.mensagem,
      erro: resultado.erro,
    };

  } catch (error) {
    console.error('Erro ao aprovar/negar exclusão:', error);
    return {
      sucesso: false,
      mensagem: 'Erro inesperado',
      erro: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Verificar se um script pode ser excluído diretamente (hard delete)
 */
export async function podeExcluirDiretamente(scriptId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('scripts_customizados')
      .select('email_enviado, curadoria_atuada')
      .eq('id', scriptId)
      .single();

    if (error || !data) {
      return false;
    }

    return !scriptExigeAprovacaoExclusao(data);
  } catch {
    return false;
  }
}

export interface ResultadoReativacao {
  sucesso: boolean;
  mensagem: string;
  pastaId?: string | null;
  erro?: string;
}

/**
 * Reativa um script que foi desativado (movido para pasta Desativados)
 * Restaura o script para sua pasta original
 */
export async function reativarScript(scriptId: string): Promise<ResultadoReativacao> {
  try {
    // Obter user_id atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        sucesso: false,
        mensagem: 'Usuário não autenticado',
        erro: 'AUTH_ERROR',
      };
    }

    // Chamar RPC function para reativar
    const { data, error } = await supabase.rpc('reativar_script', {
      p_script_id: scriptId,
      p_user_id: user.id,
    });

    if (error) {
      console.error('Erro ao reativar script:', error);
      return {
        sucesso: false,
        mensagem: 'Erro ao reativar script',
        erro: error.message,
      };
    }

    const resultado = data as {
      sucesso: boolean;
      mensagem?: string;
      pasta_id?: string | null;
      erro?: string;
    };

    return {
      sucesso: resultado.sucesso,
      mensagem: resultado.mensagem || 'Script reativado',
      pastaId: resultado.pasta_id,
      erro: resultado.erro,
    };

  } catch (error) {
    console.error('Erro ao reativar script:', error);
    return {
      sucesso: false,
      mensagem: 'Erro inesperado',
      erro: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
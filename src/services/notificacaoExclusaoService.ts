/**
 * Serviço de Notificações para Exclusão de Scripts
 * Usa diretamente a view scripts_pendentes_exclusao
 */

import { supabase } from './supabaseClient';

export interface NotificacaoExclusaoScript {
  tipo: 'exclusao_script';
  scriptId: string;
  scriptNome: string;
  solicitanteId: string;
  solicitanteNome: string;
  solicitanteEmail: string;
  equipeName: string;
  motivo?: string;
  dataHora: string;
}

/**
 * Verifica se o usuário logado pode aprovar exclusões.
 * @deprecated Usar `temPermissao('scripts.curadoria_acesso')` diretamente no componente.
 *             Esta função agora apenas repassa o booleano recebido.
 */
export async function isAdminExclusaoScripts(canApprove?: boolean | string): Promise<boolean> {
  if (typeof canApprove === 'boolean') return canApprove;
  // Compat: chamadas antigas passavam o role como string.
  return canApprove === 'admin';
}

/**
 * Lista todas as solicitações de exclusão pendentes usando a view do banco.
 * @param canApprove permissão `scripts.curadoria_acesso` do usuário corrente.
 */
export async function listarNotificacoesExclusaoPendentes(canApprove?: boolean | string): Promise<{
  notificacoes: NotificacaoExclusaoScript[];
  erro?: string;
}> {
  try {
    const podeAprovar =
      typeof canApprove === 'boolean' ? canApprove : canApprove === 'admin';
    // Só quem tem permissão pode ver as notificações de exclusão pendentes
    if (!podeAprovar) {
      return { notificacoes: [] };
    }

    // Buscar da tabela de notificações (não da view de scripts pendentes)
    // Isso garante que ao arquivar, a notificação não volta
    const { data, error } = await supabase
      .from('notificacoes_exclusao_scripts')
      .select(`
        id,
        script_id,
        script_nome,
        motivo,
        criado_em,
        solicitante_id
      `)
      .eq('lida', false)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('Erro ao listar pendentes:', error);
      return { notificacoes: [], erro: error.message };
    }

    // Buscar nomes dos solicitantes
    const solicitanteIds = [...new Set((data || []).map((n: any) => n.solicitante_id))];
    let solicitantesMap: Record<string, string> = {};
    
    if (solicitanteIds.length > 0) {
      const { data: usuarios } = await supabase
        .from('users')
        .select('id, nome')
        .in('id', solicitanteIds);
      
      solicitantesMap = (usuarios || []).reduce((acc: Record<string, string>, u: any) => {
        acc[u.id] = u.nome;
        return acc;
      }, {});
    }

    // Mapear para o formato esperado pelo componente
    const notificacoes: NotificacaoExclusaoScript[] = (data || []).map((item: any) => ({
      tipo: 'exclusao_script',
      scriptId: item.script_id,
      scriptNome: item.script_nome,
      solicitanteId: item.solicitante_id,
      solicitanteNome: solicitantesMap[item.solicitante_id] || 'Desconhecido',
      solicitanteEmail: '',
      equipeName: 'N/A',
      motivo: item.motivo,
      dataHora: item.criado_em,
    }));

    return { notificacoes };

  } catch (error) {
    console.error('Erro ao listar notificações:', error);
    return { 
      notificacoes: [], 
      erro: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Lista scripts pendentes de exclusão (filtro Revisão → Exclusão no modal Scripts)
 * Usa a view scripts_pendentes_exclusao que mostra scripts com exclusao_pendente = true
 * Diferente do sininho que mostra notificações não lidas
 */
export async function listarScriptsPendentesExclusao(): Promise<{
  notificacoes: NotificacaoExclusaoScript[];
  erro?: string;
}> {
  try {
    // Buscar da view que lista scripts com exclusao_pendente = true
    const { data, error } = await supabase
      .from('scripts_pendentes_exclusao')
      .select('*')
      .order('exclusao_solicitada_em', { ascending: false });

    if (error) {
      console.error('Erro ao listar scripts pendentes:', error);
      return { notificacoes: [], erro: error.message };
    }

    // Mapear para o formato esperado pelo componente
    const notificacoes: NotificacaoExclusaoScript[] = (data || []).map((item: any) => ({
      tipo: 'exclusao_script',
      scriptId: item.id,
      scriptNome: item.nome,
      solicitanteId: '',
      solicitanteNome: item.perfil_solicitante || 'Desconhecido',
      solicitanteEmail: item.solicitante_email || '',
      equipeName: item.equipe_nome || 'N/A',
      motivo: item.motivo_exclusao,
      dataHora: item.exclusao_solicitada_em,
    }));

    return { notificacoes };

  } catch (error) {
    console.error('Erro ao listar scripts pendentes:', error);
    return { 
      notificacoes: [], 
      erro: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Arquiva/remove uma notificação de exclusão do sininho
 * Marca como lida na tabela notificacoes_exclusao_scripts
 */
export async function arquivarNotificacaoExclusao(scriptId: string): Promise<{
  sucesso: boolean;
  erro?: string;
}> {
  try {
    // Marcar como lida na tabela de notificações
    // A RLS exige que admin_id = auth.uid(), então o update só funciona para o admin
    const { data, error } = await supabase
      .from('notificacoes_exclusao_scripts')
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq('script_id', scriptId)
      .eq('lida', false)
      .select();

    if (error) {
      console.error('Erro ao arquivar notificação:', error);
      return { sucesso: false, erro: error.message };
    }

    console.log('Notificação arquivada:', data);
    return { sucesso: true };
  } catch (error) {
    console.error('Erro ao arquivar notificação:', error);
    return { 
      sucesso: false, 
      erro: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

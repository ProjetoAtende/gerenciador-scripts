import { supabase } from './supabaseClient';

// --- Tipos ---

export interface PropostaRevisao {
  id: string;
  script_id: string;
  campo_alvo: 'usuario_final' | 'atendente';
  conteudo_proposto: string;
  motivacao: string;
  autor_id: string;
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'em_revisao';
  razao_rejeicao?: string | null;
  decidido_por?: string | null;
  decidido_em?: string | null;
  versao_gerada?: number | null;
  tentativa: number;
  criado_em: string;
  atualizado_em: string;
}

export interface ScriptVersao {
  id: string;
  script_id: string;
  campo_alvo: 'usuario_final' | 'atendente';
  numero_versao: number;
  conteudo: string;
  conteudo_anterior: string | null;  // ⭐ Conteúdo ANTES desta versão (NULL em V1)
  motivacao: string;
  tipo_motivacao: string;
  autor_id: string;
  aprovado_por: string | null;
  revisado_em: string | null;
  criado_em: string;
}

export interface VersaoResumo {
  script_id: string;
  campo_alvo: 'usuario_final' | 'atendente';
  max_versao: number;
}

export interface ScriptNotificacao {
  id: string;
  destinatario_id: string;
  script_id: string;
  proposta_id?: string | null;
  tipo: 'proposta_recebida' | 'proposta_aprovada' | 'proposta_rejeitada' | 'nova_versao_curadoria' | 'proposta_reenviada' | 'script_revisado_com_proposta_pendente' | 'curadoria_inicial' | 'contestacao_revisao_inicial' | 'script_publicado';
  mensagem: string;
  lida: boolean;
  lida_em?: string | null;
  /** true quando o usuário dispensou ou o sistema considerou a ação concluída */
  acao_executada: boolean;
  acao_executada_em?: string | null;
  criado_em: string;
  metadata?: Record<string, unknown> | null;
}

// --- Propostas ---

export async function criarProposta(scriptId: string, campoAlvo: 'usuario_final' | 'atendente', conteudoProposto: string, motivacao: string): Promise<string> {
  const { data, error } = await supabase.rpc('criar_proposta_script', {
    p_script_id: scriptId,
    p_campo_alvo: campoAlvo,
    p_conteudo_proposto: conteudoProposto,
    p_motivacao: motivacao
  });
  if (error) throw error;
  return data as string;
}

export async function aprovarProposta(propostaId: string): Promise<{ versao: number; script_id: string; campo_alvo: string; autor_proposta_id: string }> {
  const { data, error } = await supabase.rpc('aprovar_proposta_script', {
    p_proposta_id: propostaId
  });
  if (error) throw error;
  return data as { versao: number; script_id: string; campo_alvo: string; autor_proposta_id: string };
}

export async function aprovarPropostaComEdicao(propostaId: string, conteudoEditado: string): Promise<{ versao: number; script_id: string; campo_alvo: string; autor_proposta_id: string }> {
  const { data, error } = await supabase.rpc('aprovar_proposta_com_edicao', {
    p_proposta_id: propostaId,
    p_conteudo_editado: conteudoEditado
  });
  if (error) throw error;
  return data as { versao: number; script_id: string; campo_alvo: string; autor_proposta_id: string };
}

export async function rejeitarProposta(propostaId: string, razaoRejeicao: string): Promise<{ script_id: string; campo_alvo: string; autor_proposta_id: string; tentativa: number }> {
  const { data, error } = await supabase.rpc('rejeitar_proposta_script', {
    p_proposta_id: propostaId,
    p_razao_rejeicao: razaoRejeicao
  });
  if (error) throw error;
  return data as { script_id: string; campo_alvo: string; autor_proposta_id: string; tentativa: number };
}

export async function reenviarProposta(propostaId: string, conteudoProposto: string, motivacao: string): Promise<{ script_id: string; tentativa: number }> {
  const { data, error } = await supabase.rpc('reenviar_proposta_script', {
    p_proposta_id: propostaId,
    p_conteudo_proposto: conteudoProposto,
    p_motivacao: motivacao
  });
  if (error) throw error;
  return data as { script_id: string; tentativa: number };
}

// --- Versões Curadoria ---

export async function criarVersaoCuradoria(scriptId: string, campoAlvo: 'usuario_final' | 'atendente', conteudo: string, motivacao: string, tipoMotivacao: string): Promise<{ versao: number }> {
  const { data, error } = await supabase.rpc('criar_versao_curadoria', {
    p_script_id: scriptId,
    p_campo_alvo: campoAlvo,
    p_conteudo: conteudo,
    p_motivacao: motivacao,
    p_tipo_motivacao: tipoMotivacao
  });
  if (error) throw error;
  return data as { versao: number };
}

export async function revisarScriptInicial(scriptId: string, campoAlvo: 'usuario_final' | 'atendente', conteudo: string, tipoAlteracao: 'correcao_menor' | 'substantiva', motivacao: string): Promise<{ versao: number; tipo: string }> {
  const { data, error } = await supabase.rpc('revisar_script_inicial', {
    p_script_id: scriptId,
    p_campo_alvo: campoAlvo,
    p_conteudo: conteudo,
    p_tipo_alteracao: tipoAlteracao,
    p_motivacao: motivacao
  });
  if (error) throw error;
  return data as { versao: number; tipo: string };
}

export async function aceitarContestacaoScript(scriptId: string, campoAlvo: 'usuario_final' | 'atendente'): Promise<{ sucesso: boolean; versoes_deletadas: number; conteudo_revertido: string }> {
  const { data, error } = await supabase.rpc('aceitar_contestacao_script', {
    p_script_id: scriptId,
    p_campo_alvo: campoAlvo
  });
  if (error) throw error;
  return data as { sucesso: boolean; versoes_deletadas: number; conteudo_revertido: string };
}

// --- Consultas ---

export async function buscarPropostaAtiva(scriptId: string): Promise<PropostaRevisao | null> {
  const { data, error } = await supabase
    .from('script_propostas_revisao')
    .select('*')
    .eq('script_id', scriptId)
    .in('status', ['pendente', 'em_revisao'])
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function buscarPropostaPorId(propostaId: string): Promise<PropostaRevisao | null> {
  const { data, error } = await supabase
    .from('script_propostas_revisao')
    .select('*')
    .eq('id', propostaId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function buscarVersoes(scriptId: string, campoAlvo?: 'usuario_final' | 'atendente'): Promise<ScriptVersao[]> {
  let query = supabase
    .from('script_versoes')
    .select('*')
    .eq('script_id', scriptId)
    .order('numero_versao', { ascending: true });
  if (campoAlvo) query = query.eq('campo_alvo', campoAlvo);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function buscarMaxVersao(scriptId: string, campoAlvo: 'usuario_final' | 'atendente'): Promise<number> {
  const { data, error } = await supabase
    .from('script_versoes')
    .select('numero_versao')
    .eq('script_id', scriptId)
    .eq('campo_alvo', campoAlvo)
    .order('numero_versao', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.numero_versao || 0;
}

export async function buscarVersoesResumo(scriptIds?: string[]): Promise<VersaoResumo[]> {
  const { data, error } = await supabase.rpc('buscar_versoes_resumo', {
    p_script_ids: scriptIds && scriptIds.length > 0 ? scriptIds : null
  });
  if (error) throw error;
  return (data || []) as VersaoResumo[];
}

// --- Notificações ---

export async function buscarNotificacoesScript(userId: string): Promise<ScriptNotificacao[]> {
  const { data, error } = await supabase
    .from('script_notificacoes')
    .select('*')
    .eq('destinatario_id', userId)
    .eq('acao_executada', false)  // mostra lidas E não-lidas enquanto ação não concluída
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function marcarNotificacaoLida(notificacaoId: string): Promise<void> {
  const { error } = await supabase
    .from('script_notificacoes')
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq('id', notificacaoId);
  if (error) throw error;
}

/**
 * Marca a notificação como ação executada (remove da lista do usuário).
 * Também marca como lida se ainda não estiver.
 */
export async function marcarAcaoExecutada(notificacaoId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('script_notificacoes')
    .update({
      acao_executada:    true,
      acao_executada_em: now,
      lida:              true,
      lida_em:           now,
    })
    .eq('id', notificacaoId);
  if (error) throw error;
}

export async function criarNotificacao(destinatarioId: string, scriptId: string, tipo: ScriptNotificacao['tipo'], mensagem: string, propostaId?: string, metadata?: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc('criar_notificacao_script', {
    p_destinatario_id: destinatarioId,
    p_script_id: scriptId,
    p_tipo: tipo,
    p_mensagem: mensagem,
    p_proposta_id: propostaId || null,
    p_metadata: metadata || null
  });
  if (error) throw error;
}

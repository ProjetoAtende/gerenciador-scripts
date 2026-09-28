import { supabase } from './supabaseClient';
import type {
  StackBuscaEscopo,
  StackBuscaItem,
  StackFeedItem,
  StackFiltros,
  StackNotificacao,
  StackPerguntaDetalhe,
  StackTag,
} from '../types/atendeStack';

function filtrosToJson(f: StackFiltros) {
  return {
    minhas: f.minhas,
    status: f.status,
    equipe: f.equipe,
    tag_ids: f.tag_ids,
  };
}

export async function stackListarFeed(params: {
  filtros: StackFiltros;
  equipeCtx: string | null;
  cursor?: { at: string; id: string } | null;
  limit?: number;
}): Promise<StackFeedItem[]> {
  const { data, error } = await supabase.rpc('stack_listar_feed', {
    p_filtros: filtrosToJson(params.filtros),
    p_equipe_ctx: params.equipeCtx,
    p_cursor: params.cursor?.at ?? null,
    p_cursor_id: params.cursor?.id ?? null,
    p_limit: params.limit ?? 40,
  });
  if (error) throw error;
  return (data ?? []) as StackFeedItem[];
}

export async function stackObterPergunta(
  id: string,
  previewRole?: string | null,
): Promise<StackPerguntaDetalhe | null> {
  const { data, error } = await supabase.rpc('stack_obter_pergunta', {
    p_pergunta_id: id,
    p_preview_role: previewRole ?? null,
  });
  if (error) throw error;
  return (data as StackPerguntaDetalhe | null) ?? null;
}

export async function stackBuscar(params: {
  query: string;
  escopo: StackBuscaEscopo;
  filtros: StackFiltros;
  equipeCtx: string | null;
  limit?: number;
  cursor?: { score: number; perguntaId: string } | null;
}): Promise<StackBuscaItem[]> {
  const { data, error } = await supabase.rpc('stack_buscar', {
    p_query: params.query,
    p_escopo: params.escopo,
    p_filtros: filtrosToJson(params.filtros),
    p_equipe_ctx: params.equipeCtx,
    p_limit: params.limit ?? 40,
    p_cursor_score: params.cursor?.score ?? null,
    p_cursor_pergunta_id: params.cursor?.perguntaId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as StackBuscaItem[];
}

export async function stackListarTags(q: string, limit = 20): Promise<StackTag[]> {
  const { data, error } = await supabase.rpc('stack_listar_tags', { p_q: q, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as StackTag[];
}

export type StackTagNuvemItem = StackTag & { uso_count: number };

export async function stackListarTagsNuvem(limit = 200): Promise<StackTagNuvemItem[]> {
  const { data, error } = await supabase.rpc('stack_listar_tags_nuvem', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as StackTagNuvemItem[];
}

export async function stackCriarPergunta(params: {
  titulo: string;
  corpoHtml: string;
  autorEquipeId: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('stack_criar_pergunta', {
    p_titulo: params.titulo,
    p_corpo_html: params.corpoHtml,
    p_tag_ids: [],
    p_tag_novos: [],
    p_autor_equipe_id: params.autorEquipeId,
  });
  if (error) throw error;
  return data as string;
}

export async function stackEditarPergunta(params: {
  perguntaId: string;
  titulo: string;
  corpoHtml: string;
}): Promise<void> {
  const { error } = await supabase.rpc('stack_editar_pergunta', {
    p_pergunta_id: params.perguntaId,
    p_titulo: params.titulo,
    p_corpo_html: params.corpoHtml,
    p_tag_ids: null,
    p_tag_novos: [],
  });
  if (error) throw error;
}

/** Best-effort (W3): processa job de tags IA para a pergunta. */
export async function stackProcessarTagJob(perguntaId: string): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc('stack_processar_tag_job', {
    p_job_id: null,
    p_pergunta_id: perguntaId,
  });
  if (error) throw error;
  const row = (data ?? {}) as { ok?: boolean; reason?: string };
  return { ok: !!row.ok, reason: row.reason };
}

export async function stackRegenerarTags(perguntaId: string): Promise<void> {
  const { error } = await supabase.rpc('stack_regenerar_tags', { p_pergunta_id: perguntaId });
  if (error) throw error;
}

export async function stackStaffDefinirTags(params: {
  perguntaId: string;
  tagIds: string[];
  tagNovos: string[];
}): Promise<void> {
  const { error } = await supabase.rpc('stack_staff_definir_tags', {
    p_pergunta_id: params.perguntaId,
    p_tag_ids: params.tagIds,
    p_tag_novos: params.tagNovos,
  });
  if (error) throw error;
}

export async function stackCriarResposta(params: {
  perguntaId: string;
  corpoHtml: string;
  autorEquipeId: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('stack_criar_resposta', {
    p_pergunta_id: params.perguntaId,
    p_corpo_html: params.corpoHtml,
    p_autor_equipe_id: params.autorEquipeId,
  });
  if (error) throw error;
  return data as string;
}

export async function stackEditarResposta(respostaId: string, corpoHtml: string): Promise<void> {
  const { error } = await supabase.rpc('stack_editar_resposta', {
    p_resposta_id: respostaId,
    p_corpo_html: corpoHtml,
  });
  if (error) throw error;
}

export async function stackVotar(
  alvoTipo: 'pergunta' | 'resposta',
  alvoId: string,
): Promise<{ upvote_count: number; usuario_votou: boolean }> {
  const { data, error } = await supabase.rpc('stack_votar', {
    p_alvo_tipo: alvoTipo,
    p_alvo_id: alvoId,
  });
  if (error) throw error;
  return data as { upvote_count: number; usuario_votou: boolean };
}

export async function stackFavoritar(perguntaId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('stack_favoritar', { p_pergunta_id: perguntaId });
  if (error) throw error;
  return data as boolean;
}

export async function stackMarcarAceita(perguntaId: string, respostaId: string): Promise<void> {
  const { error } = await supabase.rpc('stack_marcar_aceita', {
    p_pergunta_id: perguntaId,
    p_resposta_id: respostaId,
  });
  if (error) throw error;
}

export async function stackReabrir(perguntaId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('stack_reabrir', {
    p_pergunta_id: perguntaId,
    p_motivo: motivo,
  });
  if (error) throw error;
}

export async function stackFechar(perguntaId: string): Promise<void> {
  const { error } = await supabase.rpc('stack_fechar', { p_pergunta_id: perguntaId });
  if (error) throw error;
}

export async function stackDeletar(perguntaId: string): Promise<void> {
  const { error } = await supabase.rpc('stack_deletar', { p_pergunta_id: perguntaId });
  if (error) throw error;
}

export async function stackListarNotificacoes(limit = 30): Promise<StackNotificacao[]> {
  const { data, error } = await supabase.rpc('stack_listar_notificacoes', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as StackNotificacao[];
}

export async function stackMarcarNotificacaoLida(id: string): Promise<void> {
  const { error } = await supabase.rpc('stack_marcar_notificacao_lida', { p_notificacao_id: id });
  if (error) throw error;
}

export async function stackContagemNotificacoesNaoLidas(): Promise<number> {
  const { data, error } = await supabase.rpc('stack_contagem_notificacoes_nao_lidas');
  if (error) throw error;
  return (data as number) ?? 0;
}

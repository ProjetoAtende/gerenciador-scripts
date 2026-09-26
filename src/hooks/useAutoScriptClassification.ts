// =====================================================
// HOOK: useAutoScriptClassification (v2 — Hierárquico)
// Classifica scripts automaticamente via IA (incremental)
// Usa vocabulário hierárquico por domínio (externo/interno)
// Modelado no useAutoOracleAnalysis.ts
// =====================================================

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { callDeepseekRpc } from '../services/deepseekRpcClient';
import { RealtimeChannel } from '@supabase/supabase-js';

// =====================================================
// CONSTANTES
// =====================================================

/** Cooldown entre classificações do mesmo script em minutos */
const COOLDOWN_MINUTOS = 15;

/** Delay antes do batch inicial (ms) */
const BATCH_DELAY_MS = 3000;

/** Delay entre scripts no batch (ms) */
const DELAY_ENTRE_SCRIPTS_MS = 500;

/** Máximo de scripts por batch inicial */
const BATCH_LIMIT = 20;

/** Máximo de caracteres do conteúdo do usuário enviado à IA */
const MAX_CONTEUDO_USUARIO = 1500;

/** Máximo de caracteres do conteúdo do atendente enviado à IA */
const MAX_CONTEUDO_ATENDENTE = 800;

/** Limiar abaixo do qual o conteúdo do usuário é considerado pouco descritivo */
const LIMIAR_CONTEUDO_CURTO = 100;

/** IDs das equipes por domínio */
const EQUIPE_232_ID = '11111111-1111-1111-1111-111111111111'; // externo
const EQUIPE_231_ID = '22222222-2222-2222-2222-222222222222'; // interno
const EQUIPE_221_ID = '90c2ed6a-bf56-4081-b4d6-63f37855ec12'; // interno

// =====================================================
// TIPOS
// =====================================================

interface UseAutoScriptClassificationOptions {
  equipeId: string | null;
  enabled: boolean; // ativo apenas quando ScriptsModal está aberto
}

/** Payload mínimo de um script para classificação */
interface ScriptPendente {
  id: string;
  nome: string;
  conteudo_bruto?: string | null;
  conteudo_atendente?: string | null;
  classificacao_origem?: string | null;
  dominio?: string | null;
  pasta_id?: string | null;
  equipe_id?: string | null;
}

interface CategoriaVocab {
  slug: string;
  nome: string;
}

interface SubcategoriaVocab {
  slug: string;
  nome: string;
  descricao: string;
}

interface ClassificacaoCategoria {
  categoria_equipe_slug: string;
  confianca: number;
  conteudo_principal_usado?: string;
  justificativa?: string;
}

interface ClassificacaoSubcategoria {
  subcategoria_gse_slug: string | null;
  subcategoria_sugerida?: { slug: string; nome: string; descricao: string } | null;
  confianca: number;
  justificativa?: string;
}

// =====================================================
// UTILIDADES
// =====================================================

/**
 * Remove tags HTML, decodifica entidades comuns e normaliza espaços.
 * Versão leve para o frontend (sem dependência de DOM parser).
 */
function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  let texto = html;
  // <br>, </p>, </div> → \n
  texto = texto.replace(/<br\s*\/?>/gi, '\n');
  texto = texto.replace(/<\/(?:p|div|li|tr)>/gi, '\n');
  // Remover todas as tags
  texto = texto.replace(/<[^>]*>/g, '');
  // Entidades comuns
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
  };
  for (const [ent, char] of Object.entries(entities)) {
    texto = texto.split(ent).join(char);
  }
  // Normalizar espaços
  texto = texto.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
  return texto;
}

/**
 * Trunca texto para um tamanho máximo, cortando na última palavra inteira.
 */
function truncar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const cortado = texto.slice(0, max);
  const ultimoEspaco = cortado.lastIndexOf(' ');
  return ultimoEspaco > max * 0.8 ? cortado.slice(0, ultimoEspaco) + '...' : cortado + '...';
}

// =====================================================
// COOLDOWN (localStorage)
// =====================================================

function getCooldownKey(scriptId: string): string {
  return `script_classificacao_${scriptId}`;
}

function estaDentroDoCooldown(scriptId: string): boolean {
  const key = getCooldownKey(scriptId);
  const timestamp = localStorage.getItem(key);
  if (!timestamp) return false;
  const diferenca = Date.now() - parseInt(timestamp, 10);
  return diferenca < COOLDOWN_MINUTOS * 60 * 1000;
}

function gravarCooldown(scriptId: string): void {
  localStorage.setItem(getCooldownKey(scriptId), Date.now().toString());
}

// =====================================================
// CACHE DE VOCABULÁRIO
// =====================================================

/** Cache de categorias por domínio (evita recarregar do banco a cada script) */
const cacheVocabulario: Record<string, { categorias: CategoriaVocab[]; slugs: Set<string>; ts: number }> = {};

/** Cache de subcategorias por (domínio + categoria_equipe_slug) */
const cacheSubcategorias: Record<string, { subcategorias: SubcategoriaVocab[]; ts: number }> = {};

/** TTL do cache: 10 minutos */
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Carrega categorias de equipe por domínio a partir do banco.
 * Usa RPC obter_hierarquia_categorias + cache local.
 */
async function carregarCategoriasPorDominio(dominio: string): Promise<CategoriaVocab[]> {
  const cached = cacheVocabulario[dominio];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.categorias;

  const equipeIds = dominio === 'externo'
    ? [EQUIPE_232_ID]
    : [EQUIPE_231_ID, EQUIPE_221_ID];

  // Carregar categorias_equipe do banco via Supabase client
  // Nota: o schema distribuidor não é exposto via PostgREST, mas a RPC obter_hierarquia_categorias
  // pode não retornar apenas categorias. Usamos query direta a categorias_equipe que deve estar
  // acessível via view ou RPC. Usamos a RPC existente.
  const allCategorias: CategoriaVocab[] = [];

  for (const equipeId of equipeIds) {
    const { data, error } = await supabase.rpc('obter_hierarquia_categorias', {
      p_equipe_id: equipeId,
    });

    if (error) {
      console.error(`[AutoClassif] Erro ao carregar categorias para ${equipeId}:`, error.message);
      continue;
    }

    if (data && Array.isArray(data)) {
      for (const row of data) {
        const slug = row.categoria_equipe_slug || row.slug;
        const nome = row.categoria_equipe_nome || row.nome;
        if (slug && !allCategorias.some(c => c.slug === slug)) {
          allCategorias.push({ slug, nome });
        }
      }
    }
  }

  const slugs = new Set(allCategorias.map(c => c.slug));
  cacheVocabulario[dominio] = { categorias: allCategorias, slugs, ts: Date.now() };

  console.log(`[AutoClassif] Vocabulário ${dominio}: ${allCategorias.length} categorias carregadas`);
  return allCategorias;
}

/**
 * Carrega subcategorias de uma categoria_equipe_slug no domínio, deduplicadas por slug.
 */
async function carregarSubcategorias(dominio: string, categoriaEquipeSlug: string): Promise<SubcategoriaVocab[]> {
  const cacheKey = `${dominio}:${categoriaEquipeSlug}`;
  const cached = cacheSubcategorias[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.subcategorias;

  const equipeIds = dominio === 'externo'
    ? [EQUIPE_232_ID]
    : [EQUIPE_231_ID, EQUIPE_221_ID];

  const allSubcats: SubcategoriaVocab[] = [];

  for (const equipeId of equipeIds) {
    const { data, error } = await supabase.rpc('obter_hierarquia_categorias', {
      p_equipe_id: equipeId,
    });

    if (error) continue;

    if (data && Array.isArray(data)) {
      for (const row of data) {
        const catSlug = row.categoria_equipe_slug || row.slug;
        if (catSlug === categoriaEquipeSlug && row.subcategoria_gse_slug) {
          if (!allSubcats.some(s => s.slug === row.subcategoria_gse_slug)) {
            allSubcats.push({
              slug: row.subcategoria_gse_slug,
              nome: row.subcategoria_gse_nome || row.subcategoria_gse_slug,
              descricao: row.subcategoria_gse_descricao || '',
            });
          }
        }
      }
    }
  }

  cacheSubcategorias[cacheKey] = { subcategorias: allSubcats, ts: Date.now() };
  return allSubcats;
}

/**
 * Determina o domínio de um script com base no campo dominio já preenchido
 * ou inferido via a função RPC determinar_dominio_script.
 */
async function determinarDominio(script: ScriptPendente): Promise<string> {
  // Se já tem domínio preenchido, usar
  if (script.dominio === 'externo' || script.dominio === 'interno') {
    return script.dominio;
  }

  // Chamar a função SQL para determinar
  const { data, error } = await supabase.rpc('determinar_dominio_script', {
    p_equipe_id: script.equipe_id,
    p_pasta_id: script.pasta_id,
  });

  if (error || !data) {
    console.warn(`[AutoClassif] Falha ao determinar domínio, usando 'interno' como fallback`);
    return 'interno';
  }

  return data as string;
}

// =====================================================
// PROMPTS (v2 — Hierárquico por domínio)
// =====================================================

function buildPromptCategoria(script: ScriptPendente, dominio: string, categorias: CategoriaVocab[]): string {
  const conteudoUsuario = stripHtml(script.conteudo_bruto);
  const conteudoAtendente = stripHtml(script.conteudo_atendente);
  const conteudoUsuarioCurto = conteudoUsuario.length <= LIMIAR_CONTEUDO_CURTO;

  let notaConteudo = '';
  if (conteudoUsuarioCurto && conteudoAtendente) {
    notaConteudo = `
NOTA: O conteúdo para o usuário final é muito curto/genérico (${conteudoUsuario.length} chars).
Use o CONTEÚDO PARA ATENDENTE como referência PRINCIPAL para classificar.`;
  }

  const listaCateg = categorias.map(c => `- ${c.slug}: ${c.nome}`).join('\n');

  return `Você é um especialista em classificação de scripts de atendimento ao cliente para um sistema judiciário/processual (e-Proc, PJe, SEEU, etc.).

CONTEXTO: Cada script contém instruções que o atendente usa para responder tickets de suporte. Você deve classificar o script na categoria mais adequada.

IMPORTANTE SOBRE O CONTEÚDO:
- O script pode ter dois conteúdos: um para o USUÁRIO FINAL e outro para o ATENDENTE.
- O conteúdo para o usuário final às vezes é pouco descritivo.
- Quando a resposta ao usuário final for genérica/curta demais, utilize o conteúdo para o atendente como referência PRINCIPAL.
${notaConteudo}

DOMÍNIO: ${dominio} (externo = atendimento a advogados/entes conveniados; interno = atendimento a servidores/magistrados do TJ)

CATEGORIAS DISPONÍVEIS (para o domínio ${dominio}):
${listaCateg}

SCRIPT (título): ${script.nome}

CONTEÚDO PARA USUÁRIO FINAL:
${truncar(conteudoUsuario, MAX_CONTEUDO_USUARIO) || '(vazio)'}

CONTEÚDO PARA ATENDENTE (se houver):
${truncar(conteudoAtendente, MAX_CONTEUDO_ATENDENTE) || '(vazio)'}

TAREFA: Escolha a CATEGORIA mais adequada do domínio ${dominio}.
Responda APENAS em JSON:
{
  "categoria_equipe_slug": "slug-da-categoria",
  "confianca": 0.0-1.0,
  "conteudo_principal_usado": "usuario_final" | "atendente" | "ambos",
  "justificativa": "Uma frase explicando a escolha"
}`;
}

function buildPromptSubcategoria(
  script: ScriptPendente,
  categoriaEquipeSlug: string,
  categoriaNome: string,
  dominio: string,
  subcategorias: SubcategoriaVocab[]
): string {
  const conteudo = stripHtml(script.conteudo_bruto) || stripHtml(script.conteudo_atendente);
  const listaSubcats = subcategorias
    .map(s => `- ${s.slug} — ${s.nome}${s.descricao ? ` — ${s.descricao}` : ''}`)
    .join('\n');

  return `Classifique o script na SUBCATEGORIA mais adequada da categoria "${categoriaEquipeSlug}".

DOMÍNIO: ${dominio}

SUBCATEGORIAS DISPONÍVEIS para "${categoriaNome}" (domínio ${dominio}):
${listaSubcats}

SCRIPT (título): ${script.nome}
CONTEÚDO RESUMIDO: ${truncar(conteudo, MAX_CONTEUDO_ATENDENTE)}

TAREFA: Escolha a subcategoria. Se NENHUMA se encaixar, sugira uma nova.

Responda APENAS em JSON:
{
  "subcategoria_gse_slug": "slug-existente" ou null,
  "subcategoria_sugerida": null ou {"slug": "...", "nome": "...", "descricao": "..."},
  "confianca": 0.0-1.0,
  "justificativa": "..."
}`;
}

// =====================================================
// CLASSIFICAÇÃO
// =====================================================

/**
 * Parseia resposta JSON da IA, tolerando markdown fences e texto extra.
 */
function parseJsonResponse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    if (match?.[1]) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Chama DeepSeek via RPC do Supabase.
 * Em produção a extensão http está disponível; em Docker local, esta chamada falhará.
 */
async function chamarIA(prompt: string): Promise<string | null> {
  const { data, error } = await callDeepseekRpc([{ role: 'user', content: prompt }], {
      model: 'deepseek-v4-flash',
      temperature: 0.1,
      maxTokens: 4096,
      responseFormat: null,
      thinking: null,
    });

  if (error) {
    console.error('[AutoClassif] Erro ao chamar DeepSeek:', error.message);
    return null;
  }

  if (data?.error) {
    console.error('[AutoClassif] Erro retornado pelo provider LLM:', data.error);
    return null;
  }

  return data?.choices?.[0]?.message?.content ?? null;
}

/**
 * Classifica um script em 2 passos: categoria + subcategoria.
 * Usa vocabulário hierárquico filtrado pelo domínio do script.
 */
async function classificarScript(script: ScriptPendente): Promise<boolean> {
  console.log(`[AutoClassif] Classificando: "${script.nome}" (${script.id.slice(0, 8)})`);

  // ─── Determinar domínio ───────────────────────────────────────
  const dominio = await determinarDominio(script);
  console.log(`[AutoClassif] Domínio: ${dominio}`);

  // ─── Carregar vocabulário por domínio ──────────────────────────
  const categorias = await carregarCategoriasPorDominio(dominio);
  if (categorias.length === 0) {
    console.warn(`[AutoClassif] Nenhuma categoria disponível para domínio ${dominio}`);
    return false;
  }

  // ─── Passo 1: Categoria ───────────────────────────────────────
  const promptCat = buildPromptCategoria(script, dominio, categorias);
  const respostaCat = await chamarIA(promptCat);
  if (!respostaCat) {
    console.warn('[AutoClassif] IA não retornou resposta para categoria');
    return false;
  }

  const parsedCat = parseJsonResponse<ClassificacaoCategoria>(respostaCat);
  if (!parsedCat?.categoria_equipe_slug) {
    console.warn('[AutoClassif] Resposta de categoria inválida:', respostaCat.slice(0, 200));
    return false;
  }

  const categoriaEquipeSlug = parsedCat.categoria_equipe_slug;

  // Validar que o slug pertence ao vocabulário do domínio
  const cached = cacheVocabulario[dominio];
  if (cached && !cached.slugs.has(categoriaEquipeSlug)) {
    console.warn(`[AutoClassif] Categoria "${categoriaEquipeSlug}" não pertence ao domínio ${dominio} — rejeitando`);
    return false;
  }

  console.log(`[AutoClassif] Categoria: ${categoriaEquipeSlug} (${(parsedCat.confianca * 100).toFixed(0)}%) — ${parsedCat.justificativa || ''}`);

  // ─── Passo 2: Subcategoria ────────────────────────────────────
  const subcategorias = await carregarSubcategorias(dominio, categoriaEquipeSlug);

  let subcategoriaGseSlug: string | null = null;
  let subcategoriaConfianca: number | null = null;

  if (subcategorias.length > 0) {
    const categoriaNome = categorias.find(c => c.slug === categoriaEquipeSlug)?.nome || categoriaEquipeSlug;
    const promptSubcat = buildPromptSubcategoria(script, categoriaEquipeSlug, categoriaNome, dominio, subcategorias);
    const respostaSubcat = await chamarIA(promptSubcat);

    if (respostaSubcat) {
      const parsedSubcat = parseJsonResponse<ClassificacaoSubcategoria>(respostaSubcat);
      if (parsedSubcat) {
        subcategoriaGseSlug = parsedSubcat.subcategoria_gse_slug || null;
        subcategoriaConfianca = parsedSubcat.confianca ?? null;
        console.log(`[AutoClassif] Subcategoria: ${subcategoriaGseSlug || 'nenhuma'} (${((subcategoriaConfianca ?? 0) * 100).toFixed(0)}%)`);
      }
    }
  }

  // ─── Salvar no banco ──────────────────────────────────────────
  const { error: updateError } = await supabase
    .from('scripts_customizados')
    .update({
      categoria_equipe_slug: categoriaEquipeSlug,
      subcategoria_gse_slug: subcategoriaGseSlug,
      dominio,
      categoria_confianca: parsedCat.confianca ?? null,
      subcategoria_confianca: subcategoriaConfianca,
      classificacao_origem: 'ia_incremental',
      classificacao_em: new Date().toISOString(),
      classificacao_pendente: false,
    })
    .eq('id', script.id);

  if (updateError) {
    console.error(`[AutoClassif] Erro ao salvar classificação: ${updateError.message}`);
    return false;
  }

  console.log(`[AutoClassif] ✅ Classificado: "${script.nome}" → [${dominio}] ${categoriaEquipeSlug}/${subcategoriaGseSlug || '—'}`);
  return true;
}

/**
 * Processa script com proteção manual e cooldown.
 */
async function processarScript(script: ScriptPendente): Promise<void> {
  // Proteção: não sobrescrever classificação manual
  if (script.classificacao_origem === 'manual') {
    console.log(`[AutoClassif] Script "${script.nome}" tem classificação manual — apenas limpando pendência`);
    await supabase
      .from('scripts_customizados')
      .update({ classificacao_pendente: false })
      .eq('id', script.id);
    return;
  }

  // Cooldown: evitar loop edição → trigger → IA → edição
  if (estaDentroDoCooldown(script.id)) {
    console.log(`[AutoClassif] Script "${script.nome}" em cooldown (${COOLDOWN_MINUTOS}min) — pulando`);
    return;
  }

  try {
    const sucesso = await classificarScript(script);
    if (sucesso) {
      gravarCooldown(script.id);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error(`[AutoClassif] Erro ao classificar "${script.nome}": ${msg}`);
  }
}

// =====================================================
// HOOK
// =====================================================

/**
 * Hook para classificação automática incremental de scripts via IA (v2 hierárquico).
 *
 * - Subscreve Realtime para detectar scripts com classificacao_pendente = true
 * - Processa batch inicial de scripts pendentes ao montar
 * - Usa vocabulário hierárquico por domínio (externo: 2.3.2, interno: 2.3.1+2.2.1)
 * - Protege classificações manuais (não sobrescreve)
 * - Cooldown de 15 minutos por script via localStorage
 *
 * @example
 * ```tsx
 * useAutoScriptClassification({ equipeId, enabled: isOpen });
 * ```
 */
export function useAutoScriptClassification(options: UseAutoScriptClassificationOptions): void {
  const { enabled, equipeId } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const processandoRef = useRef<Set<string>>(new Set());

  // ─── Processar um script do Realtime ────────────────────────
  const handleRealtimeScript = useCallback(async (scriptId: string) => {
    if (processandoRef.current.has(scriptId)) return;
    processandoRef.current.add(scriptId);

    try {
      const { data: script, error } = await supabase
        .from('scripts_customizados')
        .select('id, nome, conteudo_bruto, conteudo_atendente, classificacao_origem, dominio, pasta_id, equipe_id')
        .eq('id', scriptId)
        .eq('classificacao_pendente', true)
        .single();

      if (error || !script) return;

      await processarScript(script);
    } finally {
      setTimeout(() => {
        processandoRef.current.delete(scriptId);
      }, 10000);
    }
  }, []);

  // ─── Realtime Subscription ──────────────────────────────────
  useEffect(() => {
    if (!enabled || !equipeId) {
      if (channelRef.current) {
        console.log('[AutoClassif] Desativando monitoramento');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    if (channelRef.current) return;

    console.log(`[AutoClassif] Iniciando monitoramento v2 para equipe ${equipeId}`);

    const channelName = `auto-script-classif-${equipeId}`;

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scripts_customizados',
          filter: `equipe_id=eq.${equipeId}`,
        },
        (payload) => {
          const record = (payload.new || {}) as Record<string, unknown>;
          if (record.classificacao_pendente === true && record.deletado !== true) {
            setTimeout(() => {
              handleRealtimeScript(record.id as string);
            }, 1000);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[AutoClassif] Conectado ao Realtime');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn(`[AutoClassif] Conexão Realtime: ${status}`);
        }
      });

    return () => {
      if (channelRef.current) {
        console.log('[AutoClassif] Removendo subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      processandoRef.current.clear();
    };
  }, [enabled, equipeId, handleRealtimeScript]);

  // ─── Batch Inicial ──────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !equipeId) return;

    const timer = setTimeout(async () => {
      console.log('[AutoClassif] Iniciando batch de scripts pendentes...');

      const { data: pendentes, error } = await supabase
        .from('scripts_customizados')
        .select('id, nome, conteudo_bruto, conteudo_atendente, classificacao_origem, dominio, pasta_id, equipe_id')
        .eq('equipe_id', equipeId)
        .eq('classificacao_pendente', true)
        .eq('deletado', false)
        .is('desativado_em', null)
        .limit(BATCH_LIMIT)
        .order('criado_em', { ascending: false });

      if (error) {
        console.error('[AutoClassif] Erro ao buscar pendentes:', error.message);
        return;
      }

      if (!pendentes || pendentes.length === 0) {
        console.log('[AutoClassif] Nenhum script pendente encontrado');
        return;
      }

      console.log(`[AutoClassif] ${pendentes.length} script(s) pendente(s) encontrado(s)`);

      for (const script of pendentes) {
        if (!processandoRef.current.has(script.id)) {
          await processarScript(script);
          await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_SCRIPTS_MS));
        }
      }

      console.log('[AutoClassif] Batch inicial concluído');
    }, BATCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [enabled, equipeId]);
}

export default useAutoScriptClassification;

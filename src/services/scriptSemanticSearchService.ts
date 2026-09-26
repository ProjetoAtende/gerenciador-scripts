// ===================================================================
// SERVICE — Busca semantica de scripts ("Buscar Titulos" do ScriptsModal)
// ===================================================================
// Gera embedding da query (OpenAI text-embedding-3-large, 2000d) e
// chama RPC `buscar_scripts_por_embedding_texto` no Supabase para
// obter os IDs dos scripts mais similares entre todos os scripts
// ativos do sistema.
//
// O filtro local por substring continua sendo usado apenas como
// fallback quando o termo e' curto (< 3 chars) ou quando a busca
// semantica falha.
// ===================================================================

import { supabase } from './supabaseClient';

const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIM = 2000;

const queryEmbeddingCache = new Map<string, number[]>();

export interface ScriptSemanticMatch {
  script_id: string;
  similarity: number;
}

/**
 * Gera o embedding de um texto de busca, usando cache em memoria.
 */
async function gerarEmbeddingQuery(texto: string): Promise<number[]> {
  const chave = texto.trim().toLowerCase();
  const cached = queryEmbeddingCache.get(chave);
  if (cached) return cached;

  const apiKey = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) || '';
  if (!apiKey) {
    throw new Error('VITE_OPENAI_API_KEY nao configurada.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(OPENAI_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texto,
        dimensions: EMBEDDING_DIM,
        encoding_format: 'float',
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const body = await res.json();
    const embedding = body?.data?.[0]?.embedding as number[] | undefined;
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
      throw new Error('Embedding da OpenAI invalido.');
    }

    // Mantem cache pequeno (max 50 queries)
    if (queryEmbeddingCache.size >= 50) {
      const primeira = queryEmbeddingCache.keys().next().value;
      if (primeira) queryEmbeddingCache.delete(primeira);
    }
    queryEmbeddingCache.set(chave, embedding);
    return embedding;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Converte um array JS de floats em string compativel com pgvector.
 */
function vectorToPgString(v: number[]): string {
  return `[${v.join(',')}]`;
}

/**
 * Busca scripts por similaridade semantica.
 *
 * Cobre todos os scripts ativos do sistema (independente de equipe).
 *
 * @param query texto digitado pelo usuario
 * @param opts opcoes (limit, minSimilarity, signal)
 */
export async function buscarScriptsPorSimilaridade(
  query: string,
  opts: { limit?: number; minSimilarity?: number; signal?: AbortSignal } = {}
): Promise<ScriptSemanticMatch[]> {
  const texto = (query || '').trim();
  if (texto.length < 3) return [];

  const embedding = await gerarEmbeddingQuery(texto);
  if (opts.signal?.aborted) return [];

  const { data, error } = await supabase.rpc('buscar_scripts_por_embedding_texto', {
    p_query_embedding: vectorToPgString(embedding),
    p_equipe_id_referencia: null,
    p_limit: opts.limit ?? 80,
    p_min_similarity: opts.minSimilarity ?? 0.20,
  });

  if (error) {
    console.error('[scriptSemanticSearch] erro RPC:', error);
    throw error;
  }

  return (data as ScriptSemanticMatch[]) || [];
}

// ===================================================================
// SERVICE — Busca semântica de scripts (desativada no Atende)
// ===================================================================
// O módulo Scripts usa filtro local por substring no título. Busca por
// embedding/OpenAI não faz parte deste projeto.
// ===================================================================

export interface ScriptSemanticMatch {
  script_id: string;
  similarity: number;
}

/** Retorna vazio: busca semântica não está habilitada neste projeto. */
export async function buscarScriptsPorSimilaridade(
  _query: string,
  _opts: { limit?: number; minSimilarity?: number; signal?: AbortSignal } = {}
): Promise<ScriptSemanticMatch[]> {
  return [];
}

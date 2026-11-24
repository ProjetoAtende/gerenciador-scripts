import type { TelaPrioridades } from '../../hooks/usePrioridadesModal';

/**
 * Sessão da v2, com chave PRÓPRIA: a versão atual (v1) usa
 * `atende.prioridades.sessao`. Se as duas compartilhassem a chave, recarregar a
 * página com a v2 aberta reabriria a v1 (e vice-versa).
 */
const CHAVE = 'atende.prioridades.v2.sessao';

export interface PrioridadesV2SessaoPersistida {
  reabrir: boolean;
  tela: TelaPrioridades;
}

export function lerPrioridadesV2Sessao(): PrioridadesV2SessaoPersistida | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    if (!bruto) return null;
    const parsed = JSON.parse(bruto) as PrioridadesV2SessaoPersistida;
    if (!parsed || typeof parsed !== 'object' || !parsed.tela) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function salvarPrioridadesV2Sessao(sessao: PrioridadesV2SessaoPersistida): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(sessao));
  } catch {
    /* quota / modo privado */
  }
}

export function limparPrioridadesV2Sessao(): void {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    /* ignore */
  }
}

/** Recarrega a página mantendo a v2 aberta na mesma tela. */
export function recarregarPrioridadesV2(tela: TelaPrioridades): void {
  salvarPrioridadesV2Sessao({ reabrir: true, tela });
  window.location.reload();
}

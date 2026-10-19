import type { TelaPrioridades } from '../../hooks/usePrioridadesModal';

const CHAVE = 'atende.prioridades.sessao';

export interface PrioridadesSessaoPersistida {
  reabrir: boolean;
  tela: TelaPrioridades;
}

export function lerPrioridadesSessao(): PrioridadesSessaoPersistida | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    if (!bruto) return null;
    const parsed = JSON.parse(bruto) as PrioridadesSessaoPersistida;
    if (!parsed || typeof parsed !== 'object' || !parsed.tela) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function salvarPrioridadesSessao(sessao: PrioridadesSessaoPersistida): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(sessao));
  } catch {
    /* quota / modo privado */
  }
}

export function limparPrioridadesSessao(): void {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    /* ignore */
  }
}

/** Recarrega a página mantendo o app Prioridades aberto na mesma tela. */
export function recarregarPrioridades(tela: TelaPrioridades): void {
  salvarPrioridadesSessao({ reabrir: true, tela });
  window.location.reload();
}

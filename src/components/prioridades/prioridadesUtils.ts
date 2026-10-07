/**
 * Utilitários de apresentação do app "Prioridades e Urgências".
 *
 * Mantidos fora dos componentes para não misturar exports de funções com
 * exports de componentes (regra react-refresh/only-export-components).
 */

/** Formata data/hora ISO em pt-BR; devolve "—" para valores ausentes ou inválidos. */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * RF-ATD-15: contagem regressiva do prazo de 24 h, no formato hh:mm.
 */
export function prazoRestante(prazoIso: string | null): { texto: string; expirado: boolean } {
  if (!prazoIso) return { texto: '—', expirado: false };
  const alvo = new Date(prazoIso).getTime();
  if (Number.isNaN(alvo)) return { texto: '—', expirado: false };

  const diff = alvo - Date.now();
  if (diff <= 0) return { texto: 'Prazo encerrado', expirado: true };

  const totalMin = Math.floor(diff / 60000);
  const horas = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;
  return {
    texto: `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`,
    expirado: false,
  };
}

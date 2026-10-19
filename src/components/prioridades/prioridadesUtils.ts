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
 * RF-ATD-15: contagem regressiva do prazo, no formato hh:mm:ss.
 */
export function prazoRestante(prazoIso: string | null): { texto: string; expirado: boolean } {
  if (!prazoIso) return { texto: '—', expirado: false };
  const alvo = new Date(prazoIso).getTime();
  if (Number.isNaN(alvo)) return { texto: '—', expirado: false };

  const diff = alvo - Date.now();
  if (diff <= 0) return { texto: 'Prazo encerrado', expirado: true };

  const totalSeg = Math.floor(diff / 1000);
  const horas = Math.floor(totalSeg / 3600);
  const minutos = Math.floor((totalSeg % 3600) / 60);
  const segundos = totalSeg % 60;
  return {
    texto: `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`,
    expirado: false,
  };
}

/** Data/hora de término do prazo, ex.: "Segunda-feira, dia 19, 18:13". */
export function formatarTerminoPrazo(prazoIso: string | null): string | null {
  if (!prazoIso) return null;
  const d = new Date(prazoIso);
  if (Number.isNaN(d.getTime())) return null;
  const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const dia = d.getDate();
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const diaCap = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  return `${diaCap}, dia ${dia}, ${hora}`;
}

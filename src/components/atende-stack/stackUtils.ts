import { isStackAutorStaff, type StackAutor } from '../../types/atendeStack';

/** Ex.: 27/09/26 15:40 (horário local do navegador). */
export function formatStackDateTime(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

export function stackAutorRotulo(autor: StackAutor | null | undefined): string {
  if (isStackAutorStaff(autor)) return autor.nome;
  return 'anônimo';
}

export function stackPublicadoPorLine(autor: StackAutor | null | undefined, createdAt: string): string {
  return `por ${stackAutorRotulo(autor)} em ${formatStackDateTime(createdAt)}`;
}

export function formatStackTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  if (hours < 24) return `há ${hours}h`;
  return `há ${days}d`;
}

export function stackStatusLabel(item: { status: string; tem_solucao?: boolean }) {
  if (item.tem_solucao) return 'Solucionada';
  if (item.status === 'fechada') return 'Fechada';
  return 'Aberta';
}

export function stackStatusClass(item: { status: string; tem_solucao?: boolean }) {
  if (item.tem_solucao) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (item.status === 'fechada') return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
  return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200';
}

export const STACK_PAGE_SIZE = 40;

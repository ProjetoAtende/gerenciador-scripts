/**
 * Rótulos curtos usados na v2 ("UPJ IX", "11.ª a 15.ª Varas Cíveis", "14.ª Vara Cível").
 *
 * A numeração romana das UPJs não segue a ordem das Varas: ela vem do quadro
 * oficial do Fórum Central Cível (docs/PRIORIDADES_URGENCIAS_DUVIDAS.md, item 1).
 */
import type { PrioridadePerfil, Upj } from '../../types/Prioridades';

const ROMANO_POR_CODIGO: Record<string, string> = {
  'FCC-01-05': 'VI',
  'FCC-06-10': 'VIII',
  'FCC-11-15': 'IX',
  'FCC-16-20': 'V',
  'FCC-21-25': 'III',
  'FCC-26-30': 'II',
  'FCC-31-35': 'IV',
  'FCC-36-40': 'VII',
  'FCC-41-45': 'I',
};

export function upjRomano(upj: Pick<Upj, 'codigo'> | null | undefined): string | null {
  if (!upj) return null;
  return ROMANO_POR_CODIGO[upj.codigo] ?? null;
}

/** "UPJ IX" (ou o nome cadastrado, se a UPJ não estiver no quadro). */
export function upjCurta(upj: Pick<Upj, 'codigo' | 'nome'> | null | undefined): string {
  if (!upj) return 'UPJ não definida';
  const romano = upjRomano(upj);
  return romano ? `UPJ ${romano}` : upj.nome;
}

/** "11.ª a 15.ª Varas Cíveis", a partir do código FCC-11-15. */
export function faixaVaras(upj: Pick<Upj, 'codigo'> | null | undefined): string | null {
  const m = upj?.codigo.match(/^FCC-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${Number(m[1])}.ª a ${Number(m[2])}.ª Varas Cíveis`;
}

export function varaOrdinal(vara: number | null | undefined): string | null {
  return vara ? `${vara}.ª` : null;
}

/**
 * Perfil para o painel lateral. Forma neutra ("Coordenador(a)"): o app não
 * sabe o gênero da pessoa, e o nome não serve para deduzi-lo.
 */
export const PERFIL_CURTO: Record<PrioridadePerfil, string> = {
  atendente: 'Atendente',
  gestor: 'Gestor(a)',
  conferente: 'Conferente',
  coordenador: 'Coordenador(a)',
  analista: 'Analista',
};

export function ehPerfilUpj(perfil: PrioridadePerfil | null): boolean {
  return perfil === 'coordenador' || perfil === 'analista';
}

export function ehPerfilGestao(perfil: PrioridadePerfil | null): boolean {
  return perfil === 'gestor' || perfil === 'conferente';
}

/** "6 anotações" / "1 anotação". */
export function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

/**
 * Rótulos curtos usados na v2 ("UPJ IX", "11.ª a 15.ª Varas Cíveis", "14.ª Vara Cível").
 *
 * A numeração romana das UPJs não segue a ordem das Varas: ela vem do quadro
 * oficial do Fórum Central Cível (docs/PRIORIDADES_URGENCIAS_DUVIDAS.md, item 1).
 */
import type { CategoriaAnotacao, PrioridadePerfil, PrioridadeStatus, Upj } from '../../types/Prioridades';
import type { NomeIcone } from './icones';

/** Ícone de cada categoria (cartões, listas e detalhe). */
export const ICONE_CATEGORIA: Record<CategoriaAnotacao, NomeIcone> = {
  mle: 'cat-mle',
  sisbajud: 'cat-sisbajud',
  pesquisas: 'cat-pesquisas',
  cadastro: 'cat-cadastro',
  expedicao: 'cat-expedicao',
  movimentacao: 'cat-movimentacao',
  publicacao: 'cat-publicacao',
  audiencias: 'cat-audiencias',
};

/** Sigla curta da categoria, na etiqueta vermelha dos cartões (maquetes 003/004). */
export const SIGLA_CATEGORIA: Record<CategoriaAnotacao, string> = {
  mle: 'MLE',
  sisbajud: 'SBJ',
  pesquisas: 'PSQ',
  cadastro: 'CAD',
  expedicao: 'EXP',
  movimentacao: 'MOV',
  publicacao: 'PUB',
  audiencias: 'AUD',
};

/** Cor da etiqueta de status: as que pedem ação têm cor própria; as encerradas, cinza. */
export function classeEtiquetaStatus(status: PrioridadeStatus): string {
  switch (status) {
    case 'upj-pendente':
      return 'pu2-etiqueta-nova';
    case 'gestor-conferencia':
    case 'upj-analisada':
      return 'pu2-etiqueta-conferencia';
    case 'gestor-devolvida':
    case 'upj-devolvida':
      return 'pu2-etiqueta-alerta';
    case 'upj-resolvida':
      return 'pu2-etiqueta-sucesso';
    default:
      return 'pu2-etiqueta-neutra';
  }
}

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

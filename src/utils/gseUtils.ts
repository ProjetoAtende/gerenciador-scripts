import type { Ticket } from '../types/Ticket';

export const GSE_HOMOLOGACAO = 'GSE - SGS - EPROC - HOMOLOGACAO';
export const GSE_PUB_EXT_HOMOLOGACAO = 'GSE - SGS - EPROC PUB EXT - HOMOLOGACAO';
export const GSE_HOMOLOGACAO_LABEL = 'HML';

type TicketOrdenavel = Pick<Ticket, 'gse' | 'tempo_espera_origem' | 'vip'> & {
  sos?: boolean | null;
  prioridadeHistoricoAberto?: boolean | null;
};

type DirecaoTempo = 'antigos' | 'recentes';

const DASH_VARIANTS = /[\u2010-\u2015\u2212]/g;
const SPACE_VARIANTS = /[\u00a0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000]/g;
const ZERO_WIDTH = /[\u200b-\u200d\ufeff]/g;
const DIACRITICS = /[\u0300-\u036f]/g;

const CORRUPTED_GSE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bAUXJUSTI(?:\?{2}A|Ã‡A|├ÇA)\b/g, 'AUXJUSTICA'],
  [/\bMIGRA(?:\?{4}O|Ã‡ÃƒO|├Ç├ÃO)\b/g, 'MIGRACAO'],
  [/\bDISTRIBUI(?:\?{4}O|Ã‡ÃƒO|├Ç├ÃO)\b/g, 'DISTRIBUICAO'],
];

function repairCorruptedGseTokens(value: string): string {
  let normalized = value;

  for (const [pattern, replacement] of CORRUPTED_GSE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
}

export function normalizarGse(gse?: string | null): string {
  if (!gse) return '';

  const normalized = gse
    .replace(SPACE_VARIANTS, ' ')
    .replace(ZERO_WIDTH, '')
    .replace(DASH_VARIANTS, '-')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/\uFFFD/g, '?')
    .replace(/HOMOLOGA\u00c7\u00c3O/g, 'HOMOLOGACAO');

  return repairCorruptedGseTokens(normalized);
}

export function isGseHomologacao(gse?: string | null): boolean {
  const normalized = normalizarGse(gse);
  return normalized === GSE_HOMOLOGACAO || normalized === GSE_PUB_EXT_HOMOLOGACAO;
}

export function compararTicketsDistribuidor(
  a: TicketOrdenavel,
  b: TicketOrdenavel,
  direcaoTempo: DirecaoTempo = 'antigos'
): number {
  const aHomologacao = isGseHomologacao(a.gse);
  const bHomologacao = isGseHomologacao(b.gse);

  if (aHomologacao !== bHomologacao) {
    return aHomologacao ? -1 : 1;
  }

  if (a.vip !== b.vip) {
    return a.vip ? -1 : 1;
  }

  const aSos = !!a.sos;
  const bSos = !!b.sos;
  if (aSos !== bSos) {
    return aSos ? -1 : 1;
  }

  const aHistoricoAberto = !!a.prioridadeHistoricoAberto;
  const bHistoricoAberto = !!b.prioridadeHistoricoAberto;
  if (aHistoricoAberto !== bHistoricoAberto) {
    return aHistoricoAberto ? -1 : 1;
  }

  const timeA = new Date(a.tempo_espera_origem).getTime();
  const timeB = new Date(b.tempo_espera_origem).getTime();

  if (Number.isNaN(timeA) && Number.isNaN(timeB)) return 0;
  if (Number.isNaN(timeA)) return 1;
  if (Number.isNaN(timeB)) return -1;

  return direcaoTempo === 'recentes' ? timeB - timeA : timeA - timeB;
}

import type { ValidacaoDjenStatus } from '../types/Prioridades';
import { somenteDigitos } from './prioridadesDjenService';

/** Comarca Foro Central (0100) e tribunal TJSP (826) no CNJ. */
export function processoCnjCompetenciaAtende(processo: string): boolean {
  const d = somenteDigitos(processo);
  if (d.length !== 20) return false;
  return d.slice(13, 16) === '826' && d.slice(16, 20) === '0100';
}

/** Órgão publicado no DJEN indica Varas/UPJ do Fórum Central Cível. */
export function orgaoDjenIndicaCompetenciaAtende(nomeOrgao: string | null | undefined): boolean {
  const n = (nomeOrgao ?? '').trim();
  if (!n) return true;

  if (/câmara|camara|gab\.|gabinete|turma recursal|desembargador/i.test(n) && !/vara cível|varas cíveis/i.test(n)) {
    return false;
  }

  return /vara cível|varas cíveis|upj da|foro central cível/i.test(n);
}

export function avaliarCompetenciaAtende(
  processo: string,
  vara: number | null,
  nomeOrgao: string | null,
  _status: ValidacaoDjenStatus
): { competente: boolean; motivo: string | null } {
  const mensagem =
    'Este processo não está na competência do TJSP Atende (1ª a 45ª Varas Cíveis do Foro Central de São Paulo).';

  if (!processoCnjCompetenciaAtende(processo)) {
    return { competente: false, motivo: mensagem };
  }

  if (vara != null && (vara < 1 || vara > 45)) {
    return { competente: false, motivo: mensagem };
  }

  if (nomeOrgao?.trim() && !orgaoDjenIndicaCompetenciaAtende(nomeOrgao)) {
    return { competente: false, motivo: mensagem };
  }

  return { competente: true, motivo: null };
}

import type { PlataformaProcessual } from '../types/Prioridades';
import { somenteDigitos } from './prioridadesDjenService';

/** Competência no Eproc inferida pelo 1.º dígito do sequencial CNJ (TJSP). */
export type CompetenciaEprocCnj = 'civel' | 'fiscal' | 'criminal';

export interface InferenciaSistemaCnj {
  plataforma: PlataformaProcessual | null;
  competencia: CompetenciaEprocCnj | null;
  /** Texto curto para o indicador de localização. */
  textoIndicador: string;
}

const ROTULO_COMPETENCIA: Record<CompetenciaEprocCnj, string> = {
  civel: 'Cível',
  fiscal: 'Fiscal',
  criminal: 'Criminal',
};

/**
 * Regra operacional TJSP Atende: sequencial CNJ iniciado em 4, 5 ou 6 → Eproc,
 * com competência Cível, Fiscal ou Criminal, respectivamente. Demais prefixos
 * não permitem distinguir Eproc de SAJ.
 */
export function inferirSistemaPorCnj(processo: string): InferenciaSistemaCnj {
  const d = somenteDigitos(processo);
  if (d.length === 0) {
    return {
      plataforma: null,
      competencia: null,
      textoIndicador:
        'Informe o número do processo. O DJEN não informa o sistema de distribuição (Eproc ou SAJ).',
    };
  }

  const primeiro = d[0];

  if (primeiro === '4') {
    return {
      plataforma: 'eproc',
      competencia: 'civel',
      textoIndicador: `Eproc · competência ${ROTULO_COMPETENCIA.civel} (inferido pelo número do processo).`,
    };
  }
  if (primeiro === '5') {
    return {
      plataforma: 'eproc',
      competencia: 'fiscal',
      textoIndicador: `Eproc · competência ${ROTULO_COMPETENCIA.fiscal} (inferido pelo número do processo).`,
    };
  }
  if (primeiro === '6') {
    return {
      plataforma: 'eproc',
      competencia: 'criminal',
      textoIndicador: `Eproc · competência ${ROTULO_COMPETENCIA.criminal} (inferido pelo número do processo).`,
    };
  }

  return {
    plataforma: null,
    competencia: null,
    textoIndicador:
      'Não foi possível identificar se o processo tramita no Eproc ou no SAJ a partir do número — informe abaixo, se souber.',
  };
}

export function rotuloCompetenciaEproc(competencia: CompetenciaEprocCnj | null): string | null {
  return competencia ? ROTULO_COMPETENCIA[competencia] : null;
}

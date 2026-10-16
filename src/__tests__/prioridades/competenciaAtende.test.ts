import { describe, expect, it } from 'vitest';
import {
  avaliarCompetenciaAtende,
  orgaoDjenIndicaCompetenciaAtende,
  processoCnjCompetenciaAtende,
} from '../../services/prioridadesCompetencia';

describe('competência TJSP Atende', () => {
  /** Exemplo da área (UPJ 6ª–10ª): sequencial começa com 1 — deve ser aceito. */
  const processoCentral = '11002212820248260100';

  it('aceita CNJ 8.26.0100', () => {
    expect(processoCnjCompetenciaAtende(processoCentral)).toBe(true);
  });

  it('rejeita órgão de Câmara/Gabinete', () => {
    expect(orgaoDjenIndicaCompetenciaAtende('Gab. 03 - 31ª Câmara de Direito Privado')).toBe(false);
  });

  it('aceita órgão de UPJ do Fórum Central', () => {
    expect(orgaoDjenIndicaCompetenciaAtende('UPJ da 6ª a 10ª Varas Cíveis - Foro Central Cível')).toBe(true);
  });

  it('bloqueia processo localizado fora da competência', () => {
    const r = avaliarCompetenciaAtende(
      processoCentral,
      null,
      'Gab. 03 - 31ª Câmara de Direito Privado',
      'localizado'
    );
    expect(r.competente).toBe(false);
  });

  it('permite sem comunicação no DJEN com CNJ central', () => {
    const r = avaliarCompetenciaAtende(processoCentral, null, null, 'sem_comunicacao');
    expect(r.competente).toBe(true);
  });

  it('rejeita Câmara mesmo com status sem_comunicacao (PC-03)', () => {
    const r = avaliarCompetenciaAtende(
      processoCentral,
      null,
      'Gab. 03 - 31ª Câmara de Direito Privado',
      'sem_comunicacao'
    );
    expect(r.competente).toBe(false);
  });

  it('aceita sequencial 5 com CNJ central (Eproc Fiscal — sistema inferido à parte)', () => {
    expect(avaliarCompetenciaAtende('51234566620268260100', null, null, 'sem_comunicacao').competente).toBe(
      true
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  codigoUpjPorOrgaoDjen,
  codigoUpjPorVara,
  faixaVarasDoNomeOrgao,
} from '../../services/prioridadesUpjFaixa';

describe('faixa UPJ FCC', () => {
  it('Vara 1 → FCC-01-05 (UPJ VI)', () => {
    expect(codigoUpjPorVara(1)).toBe('FCC-01-05');
  });

  it('Vara 6 → FCC-06-10', () => {
    expect(codigoUpjPorVara(6)).toBe('FCC-06-10');
  });

  it('nome do órgão UPJ da 1ª a 5ª', () => {
    const faixa = faixaVarasDoNomeOrgao('UPJ da 1ª a 5ª Varas Cíveis - Foro Central Cível');
    expect(faixa).toEqual({ inicio: 1, fim: 5 });
    expect(codigoUpjPorOrgaoDjen(null, 'UPJ da 1ª a 5ª Varas Cíveis - Foro Central Cível')).toBe('FCC-01-05');
  });

  it('idOrgao 98526 scenario: vara 1', () => {
    expect(codigoUpjPorOrgaoDjen(1, 'UPJ da 1ª a 5ª Varas Cíveis - Foro Central Cível')).toBe('FCC-01-05');
  });
});

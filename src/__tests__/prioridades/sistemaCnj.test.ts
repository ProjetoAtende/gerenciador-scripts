import { describe, expect, it } from 'vitest';
import { inferirSistemaPorCnj } from '../../services/prioridadesSistemaCnj';

describe('inferência Eproc pelo CNJ', () => {
  it('sequencial 4 → Eproc Cível', () => {
    const r = inferirSistemaPorCnj('4193948-19.2026.8.26.0100');
    expect(r.plataforma).toBe('eproc');
    expect(r.competencia).toBe('civel');
  });

  it('sequencial 5 → Eproc Fiscal', () => {
    const r = inferirSistemaPorCnj('5123456-66.2026.8.26.0100');
    expect(r.plataforma).toBe('eproc');
    expect(r.competencia).toBe('fiscal');
  });

  it('sequencial 6 → Eproc Criminal', () => {
    const r = inferirSistemaPorCnj('6123456-66.2026.8.26.0100');
    expect(r.plataforma).toBe('eproc');
    expect(r.competencia).toBe('criminal');
  });

  it('outro prefixo → desconhecido', () => {
    const r = inferirSistemaPorCnj('0123456-66.2026.8.26.0100');
    expect(r.plataforma).toBeNull();
    expect(r.competencia).toBeNull();
  });
});

import type { Upj } from '../../types/Prioridades';

/** Rótulo de UPJ na UI: nome da faixa, sem código interno FCC-XX-YY. */
export function rotuloUpj(upj: Pick<Upj, 'nome'> | null | undefined): string {
  return upj?.nome?.trim() || '—';
}

export function rotuloUpjPorId(upjs: Upj[], upjId: string | null | undefined): string | null {
  if (!upjId) return null;
  const u = upjs.find((x) => x.id === upjId);
  return u ? rotuloUpj(u) : null;
}

/**
 * Faixas oficiais das 9 UPJs do Fórum Central Cível (resposta área 15/10/2026).
 * O rótulo romano (UPJ VI, etc.) é nomenclatura institucional; no banco a chave
 * é o código FCC-XX-YY e o nome "UPJ da Xª a Yª Varas Cíveis".
 */

/** Código interno (ex.: FCC-01-05) a partir do número da Vara (1–45). */
export function codigoUpjPorVara(vara: number): string | null {
  if (!Number.isFinite(vara) || vara < 1 || vara > 45) return null;
  const inicio = Math.floor((vara - 1) / 5) * 5 + 1;
  const fim = inicio + 4;
  return `FCC-${String(inicio).padStart(2, '0')}-${String(fim).padStart(2, '0')}`;
}

/** Extrai a faixa "UPJ da Xª a Yª Varas" do nome do órgão no DJEN. */
export function faixaVarasDoNomeOrgao(nomeOrgao: string | null | undefined): { inicio: number; fim: number } | null {
  const n = (nomeOrgao ?? '').trim();
  if (!n) return null;

  const faixa = n.match(/(\d{1,2})\s*ª?\s*a\s*(\d{1,2})\s*ª?\s*Varas?\s*C[ií]ve/i);
  if (!faixa) return null;

  const inicio = Number.parseInt(faixa[1], 10);
  const fim = Number.parseInt(faixa[2], 10);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || inicio < 1 || fim > 45 || inicio > fim) {
    return null;
  }
  return { inicio, fim };
}

export function codigoUpjPorFaixa(inicio: number, fim: number): string | null {
  if (inicio < 1 || fim > 45 || inicio > fim || fim - inicio !== 4) return null;
  return `FCC-${String(inicio).padStart(2, '0')}-${String(fim).padStart(2, '0')}`;
}

/** Resolve o código FCC a partir de Vara e/ou nome do órgão DJEN. */
export function codigoUpjPorOrgaoDjen(vara: number | null, nomeOrgao: string | null | undefined): string | null {
  if (vara != null) {
    const porVara = codigoUpjPorVara(vara);
    if (porVara) return porVara;
  }

  const faixa = faixaVarasDoNomeOrgao(nomeOrgao);
  if (faixa) return codigoUpjPorFaixa(faixa.inicio, faixa.fim);

  return null;
}

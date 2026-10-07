import { describe, expect, it } from 'vitest';
import {
  complementarProcesso,
  extrairVara,
  formatarProcessoCnj,
  processoCompleto,
  somenteDigitos,
  tribunalDoProcesso,
  SUFIXO_CNJ_PADRAO_TJSP_CENTRAL,
} from '../../services/prioridadesDjenService';
import { prazoRestante } from '../../components/prioridades/prioridadesUtils';

/**
 * RF-ATD-01: máscara do número do processo no padrão CNJ.
 * "Campo com máscara no padrão CNJ (ex.: 0123456-66.12.2026.8.26.0100).
 *  Impedir formatos alternativos não reconhecidos pelo Eproc/SAJ.
 *  Armazenar como string."
 */
describe('RF-ATD-01 — máscara do número do processo', () => {
  it('remove tudo que não é dígito', () => {
    expect(somenteDigitos('0123456-66.2026.8.26.0100')).toBe('01234566620268260100');
    expect(somenteDigitos('abc')).toBe('');
    expect(somenteDigitos('')).toBe('');
  });

  it('formata o número completo no padrão CNJ', () => {
    expect(formatarProcessoCnj('01234566620268260100')).toBe('0123456-66.2026.8.26.0100');
  });

  it('formata a partir de entrada já mascarada sem duplicar separadores', () => {
    expect(formatarProcessoCnj('0123456-66.2026.8.26.0100')).toBe('0123456-66.2026.8.26.0100');
  });

  it('formata entrada parcial progressivamente (uso em input controlado)', () => {
    expect(formatarProcessoCnj('0123456')).toBe('0123456');
    expect(formatarProcessoCnj('012345666')).toBe('0123456-66');
    expect(formatarProcessoCnj('0123456662026')).toBe('0123456-66.2026');
    expect(formatarProcessoCnj('01234566620268')).toBe('0123456-66.2026.8');
    expect(formatarProcessoCnj('0123456662026826')).toBe('0123456-66.2026.8.26');
  });

  it('descarta dígitos excedentes em vez de gerar máscara inválida', () => {
    expect(formatarProcessoCnj('012345666202682601009999')).toBe('0123456-66.2026.8.26.0100');
  });

  it('reconhece apenas 20 dígitos como número completo', () => {
    expect(processoCompleto('0123456-66.2026.8.26.0100')).toBe(true);
    expect(processoCompleto('0123456-66.2026')).toBe(false);
    expect(processoCompleto('')).toBe(false);
  });
});

/**
 * RF-ATD-02: complementação de número truncado.
 * "Se informado apenas até o ano (ex.: 0123456-12.2026), o sistema acrescenta
 *  o sufixo 8.26.0100 e tenta a verificação com o número completo."
 */
describe('RF-ATD-02 — complementação de número truncado', () => {
  it('complementa 13 dígitos (sequencial + DV + ano) com o sufixo 8.26.0100', () => {
    const resultado = complementarProcesso('0123456-12.2026');
    expect(resultado.complementado).toBe(true);
    expect(resultado.numero).toBe(`0123456122026${SUFIXO_CNJ_PADRAO_TJSP_CENTRAL}`);
    expect(resultado.numero).toBe('01234561220268260100');
  });

  it('não altera um número já completo', () => {
    const resultado = complementarProcesso('0123456-66.2026.8.26.0100');
    expect(resultado.complementado).toBe(false);
    expect(resultado.numero).toBe('01234566620268260100');
  });

  it('não tenta complementar comprimentos ambíguos', () => {
    expect(complementarProcesso('0123456').complementado).toBe(false);
    expect(complementarProcesso('012345666202').complementado).toBe(false);
    expect(complementarProcesso('01234566620268').complementado).toBe(false);
    expect(complementarProcesso('012345666202682601').complementado).toBe(false);
  });

  it('mantém o sufixo esperado da unidade-piloto (TJSP / Foro Central)', () => {
    expect(SUFIXO_CNJ_PADRAO_TJSP_CENTRAL).toBe('8260100');
  });
});

/**
 * RF-ATD-04: detecção da UPJ.
 *
 * A UPJ é resolvida por idOrgao (chave estável). O número da Vara é extraído do
 * nome do órgão apenas como dado auxiliar de exibição — e nem todo nomeOrgao do
 * DJEN traz uma Vara, porque o próprio órgão já pode ser a UPJ agrupada
 * (ex.: "UPJ da 26ª a 30ª Varas Cíveis - Foro Central Cível").
 */
describe('RF-ATD-04 — extração auxiliar do número da Vara', () => {
  it('extrai a Vara de nomes no padrão "Nª Vara Cível"', () => {
    expect(extrairVara('3ª Vara Cível - Birigui')).toBe(3);
    expect(extrairVara('21ª Vara Cível')).toBe(21);
    expect(extrairVara('Foro Central Cível - 34ª Vara Cível')).toBe(34);
  });

  it('extrai a primeira Vara citada em órgão que agrupa uma UPJ inteira', () => {
    expect(extrairVara('UPJ da 26ª a 30ª Varas Cíveis - Foro Central Cível')).toBe(26);
    expect(extrairVara('UPJ da 1ª a 5ª Varas Cíveis - Foro Central Cível')).toBe(1);
  });

  it('devolve null quando não há Vara identificável no nome', () => {
    expect(extrairVara('Vara Única - Taquarituba')).toBeNull();
    expect(extrairVara('Central de Mandados - Foro Central Cível')).toBeNull();
    expect(extrairVara(null)).toBeNull();
    expect(extrairVara(undefined)).toBeNull();
    expect(extrairVara('')).toBeNull();
  });

  it('não confunde números que não são de Vara com o número da Vara', () => {
    expect(extrairVara('Foro de Mogi das Cruzes - Vara da Fazenda Pública')).toBeNull();
    expect(extrairVara('SEF - Setor de Execuções Fiscais - Valinhos')).toBeNull();
  });
});

describe('tribunalDoProcesso', () => {
  it('devolve o segmento J.TR do número CNJ', () => {
    expect(tribunalDoProcesso('01234566620268260100')).toBe('826');
  });

  it('devolve null para número incompleto', () => {
    expect(tribunalDoProcesso('0123456662026')).toBeNull();
  });
});

/**
 * RF-ATD-15: contagem regressiva (hh:mm) e expiração do prazo de 24 h.
 */
describe('RF-ATD-15 — prazo de resposta de 24 h', () => {
  it('devolve "—" quando não há prazo', () => {
    expect(prazoRestante(null)).toEqual({ texto: '—', expirado: false });
  });

  it('marca como expirado quando o prazo já passou', () => {
    const passado = new Date(Date.now() - 60_000).toISOString();
    const resultado = prazoRestante(passado);
    expect(resultado.expirado).toBe(true);
    expect(resultado.texto).toBe('Prazo encerrado');
  });

  it('formata a contagem restante em hh:mm com dois dígitos', () => {
    const futuro = new Date(Date.now() + 2 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString();
    const resultado = prazoRestante(futuro);
    expect(resultado.expirado).toBe(false);
    // Tolera a passagem de alguns segundos entre a criação e a asserção.
    expect(resultado.texto).toMatch(/^0[12]:0[0-5]$/);
  });

  it('trata valor inválido sem lançar', () => {
    expect(prazoRestante('não é data')).toEqual({ texto: '—', expirado: false });
  });
});

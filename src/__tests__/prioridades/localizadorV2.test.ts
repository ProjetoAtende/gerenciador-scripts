/**
 * Localizador da v2 (etapa 2): regras puras de supabase/functions/_shared/localizador.ts,
 * com publicações no formato real da DJEN e do Datajud (casos medidos em 22/11/2026).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  interpretarNumero,
  interpretarOrgao,
  resolver,
  sistemaPeloLink,
  type ComunicacaoDjen,
  type NumeroCnj,
} from '../../../supabase/functions/_shared/localizador';

vi.mock('../../services/supabaseClient', () => ({ supabase: {} }));
import { regrasAplicaveis, respostasDaAnterior, type AnotacaoAnteriorV2, type RegraEspecialV2 } from '../../services/prioridadesV2Service';

const num = (n: string): NumeroCnj => {
  const r = interpretarNumero(n);
  if (!r.ok) throw new Error(r.mensagem);
  return r;
};

const pub = (data: string, nomeOrgao: string, link: string | null = null, idOrgao = 1): ComunicacaoDjen => ({
  data_disponibilizacao: data,
  nomeOrgao,
  idOrgao,
  link,
});

const EPROC = 'https://eproc1g.tjsp.jus.br/eproc/externo_controlador.php?acao=consulta_publica_documento';

describe('número CNJ', () => {
  it('aceita número válido e informa a origem', () => {
    const r = interpretarNumero('4000525-51.2026.8.26.0373');
    expect(r.ok && r.origem).toBe('0373');
  });
  it('completa o número até o ano com 8.26.0100', () => {
    const r = interpretarNumero('4189868-12.2026');
    expect(r.ok && r.numero).toBe('4189868-12.2026.8.26.0100');
    expect(r.ok && r.completado).toBe(true);
  });
  it('recusa dígito verificador errado', () => {
    expect(interpretarNumero('4189868-13.2026.8.26.0100').ok).toBe(false);
  });
});

describe('nomes de órgão', () => {
  it.each([
    ['Juízo Titular I - 30ª Vara Cível - Foro Central Cível', 'vara'],
    ['07 CIVEL DE CENTRAL', 'vara'],
    ['Foro Central Cível - 7ª Vara Cível', 'vara'],
    ['UPJ da 11ª a 15ª Varas Cíveis - Foro Central Cível', 'upj'],
    ['UPJ da 1ª a 4ª e 16ª Varas Cíveis - Regional II - Santo Amaro', 'outro'],
    ['Foro Central Cível - 1ª Vara de Registros Públicos', 'outro'],
    ['Vara Reg. Comp. Empresarial e Conflitos à Arbitragem Foro Espec. 3ªe 6ª RAJs', 'outro'],
  ])('%s → %s', (nome, tipo) => {
    expect(interpretarOrgao(nome).tipo).toBe(tipo);
  });
  it('sistema pelo link da publicação', () => {
    expect(sistemaPeloLink(EPROC)).toBe('eproc');
    expect(sistemaPeloLink('https://dje.tjsp.jus.br/cdje/x')).toBe('saj');
    expect(sistemaPeloLink(null)).toBeNull();
  });
});

describe('competência pelo órgão atual (casos reais)', () => {
  it('4189868 (final 0100), hoje em Santo Amaro → fora', () => {
    const r = resolver({
      numero: num('4189868-12.2026.8.26.0100'),
      djen: {
        status: 'ok',
        comunicacoes: [
          pub('2026-10-05', 'UPJ da 41ª a 45ª Varas Cíveis - Foro Central Cível'),
          pub('2026-10-07', 'UPJ da 1ª a 4ª e 16ª Varas Cíveis - Regional II - Santo Amaro', EPROC),
        ],
      },
    });
    expect(r.escopo.situacao).toBe('fora');
    expect(r.escopo.motivo).toMatch(/Santo Amaro/);
  });

  it('4000525 (final 0373), redistribuído à UPJ IX → dentro, Vara em aberto', () => {
    const r = resolver({
      numero: num('4000525-51.2026.8.26.0373'),
      djen: {
        status: 'ok',
        comunicacoes: [
          pub('2026-10-26', 'Vara Reg. Comp. Empresarial e Conflitos à Arbitragem Foro Espec. 3ªe 6ª RAJs', EPROC),
          pub('2026-11-19', 'UPJ da 11ª a 15ª Varas Cíveis - Foro Central Cível', EPROC, 98510),
        ],
      },
    });
    expect(r.escopo.situacao).toBe('dentro');
    expect(r.upj?.codigo).toBe('FCC-11-15');
    expect(r.upj?.numeral).toBe('IX');
    expect(r.vara).toBeNull();
    expect(r.varasPossiveis).toEqual([11, 12, 13, 14, 15]);
    expect(r.sistema.valor).toBe('eproc');
    expect(r.idOrgaoDjen).toBe(98510);
    expect(r.aguardandoDatajud).toBe(true);
    expect(r.avisos.some((a) => /termina em 0373/.test(a.texto))).toBe(true);
  });

  it('publicação de 2.º grau mais recente não muda onde o processo está', () => {
    const r = resolver({
      numero: num('4000525-51.2026.8.26.0373'),
      djen: {
        status: 'ok',
        comunicacoes: [
          pub('2026-11-01', 'UPJ da 11ª a 15ª Varas Cíveis - Foro Central Cível'),
          pub('2026-11-20', '12ª Câmara de Direito Privado'),
        ],
      },
    });
    expect(r.escopo.situacao).toBe('dentro');
  });

  it('nenhuma fonte sabe: final 0100 → indeterminado; outro final → fora', () => {
    const vazio = { status: 'vazio' as const };
    expect(resolver({ numero: num('4189868-12.2026.8.26.0100'), djen: vazio, datajud: vazio }).escopo.situacao).toBe('indeterminado');
    expect(resolver({ numero: num('4000525-51.2026.8.26.0373'), djen: vazio, datajud: vazio }).escopo.situacao).toBe('fora');
  });
});

describe('Vara', () => {
  const djenUpj = { status: 'ok' as const, comunicacoes: [pub('2026-11-19', 'UPJ da 11ª a 15ª Varas Cíveis - Foro Central Cível', EPROC)] };

  it('Datajud dentro da UPJ da DJEN → Vara do Datajud', () => {
    const r = resolver({
      numero: num('4000525-51.2026.8.26.0373'),
      djen: djenUpj,
      datajud: { status: 'ok', hits: [{ grau: 'G1', sistema: { nome: 'Eproc' }, orgaoJulgador: { nome: 'Juízo Titular I - 13ª Vara Cível - Foro Central Cível' } }] },
    });
    expect(r.vara).toBe(13);
    expect(r.varaFonte).toBe('datajud');
    expect(r.varasPossiveis).toBeNull();
    expect(r.nivel).toBe('completo');
  });

  it('Datajud fora da UPJ da DJEN → Vara em aberto, com aviso (sem "primeira Vara da faixa")', () => {
    const r = resolver({
      numero: num('4000525-51.2026.8.26.0373'),
      djen: djenUpj,
      datajud: { status: 'ok', hits: [{ grau: 'G1', orgaoJulgador: { nome: '30ª Vara Cível - Foro Central Cível' } }] },
    });
    expect(r.vara).toBeNull();
    expect(r.avisos.some((a) => a.nivel === 'atencao')).toBe(true);
  });

  it('DJEN do SAJ já traz a Vara', () => {
    const r = resolver({
      numero: num('4189868-12.2026.8.26.0100'),
      djen: { status: 'ok', comunicacoes: [pub('2026-11-19', 'Foro Central Cível - 7ª Vara Cível', 'https://dje.tjsp.jus.br/x')] },
    });
    expect(r.vara).toBe(7);
    expect(r.varaFonte).toBe('djen');
    expect(r.upj?.numeral).toBe('VIII');
    expect(r.sistema.valor).toBe('saj');
  });

  it('só o Datajud responde (DJEN vazia)', () => {
    const r = resolver({
      numero: num('4189868-12.2026.8.26.0100'),
      djen: { status: 'vazio' },
      datajud: { status: 'ok', hits: [{ grau: 'G1', sistema: { nome: 'SAJ' }, orgaoJulgador: { nome: '07 CIVEL DE CENTRAL' } }] },
    });
    expect(r.vara).toBe(7);
    expect(r.varaFonte).toBe('datajud');
    expect(r.sistema.valor).toBe('saj');
    expect(r.escopo.situacao).toBe('dentro');
  });
});

describe('regras especiais por categoria (item F)', () => {
  const regras: RegraEspecialV2[] = [
    { id: '1', upj_id: 'u6', tipo_prioridade: 'fora-localizador', categoria: 'mle', texto: 'MLE da UPJ VI: fila Ag. Encerramento do Ato.' },
    { id: '2', upj_id: 'u6', tipo_prioridade: 'fora-localizador', categoria: null, texto: 'Vale para todas.' },
    { id: '3', upj_id: 'u9', tipo_prioridade: 'fora-localizador', categoria: 'mle', texto: 'Outra UPJ.' },
  ];
  it('categoria MLE: a específica primeiro, depois a geral', () => {
    expect(regrasAplicaveis(regras, 'u6', 'fora-localizador', 'mle').map((r) => r.id)).toEqual(['1', '2']);
  });
  it('outra categoria: só a geral', () => {
    expect(regrasAplicaveis(regras, 'u6', 'fora-localizador', 'sisbajud').map((r) => r.id)).toEqual(['2']);
  });
  it('sem UPJ, nada', () => {
    expect(regrasAplicaveis(regras, null, 'fora-localizador', 'mle')).toEqual([]);
  });
});

describe('resposta das anotações anteriores (item E)', () => {
  const base: AnotacaoAnteriorV2 = {
    id: 1,
    status: 'upj-resolvida',
    data_anotacao: '2026-11-01T10:00:00Z',
    descricao_prioridade: 'x',
    descricao_resumida: null,
    criador_nome: 'A',
    tipo_prioridade: 'prazo-excedido',
    upj_codigo: 'FCC-11-15',
    observacao_adicional_upj: null,
    justificativa_devolucao_upj: null,
    justificativa_rejeicao_upj: null,
    justificativa_rejeicao_gestor: null,
    data_resolucao_upj: null,
  };
  it('resolvida: mostra a informação a repassar', () => {
    expect(respostasDaAnterior({ ...base, observacao_adicional_upj: 'Mandado expedido em 05/11.' })).toEqual([
      { rotulo: 'Informação a ser repassada ao Solicitante', texto: 'Mandado expedido em 05/11.' },
    ]);
  });
  it('sem resposta: lista vazia', () => {
    expect(respostasDaAnterior({ ...base, status: 'upj-pendente' })).toEqual([]);
  });
});

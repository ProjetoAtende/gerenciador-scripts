import { describe, expect, it } from 'vitest';
import type { AnotacaoPrioridade } from '../../types/Prioridades';
import { anotacaoNaLista, type ContextoLista } from './prioridadesListas';

function anotacao(parcial: Partial<AnotacaoPrioridade>): AnotacaoPrioridade {
  return {
    id: 1,
    status: 'upj-pendente',
    criador_id: 'criador',
    criador_nome: 'Ana',
    criador_perfil: 'atendente',
    data_anotacao: '2026-10-01T12:00:00Z',
    processo: '00000000000000000000',
    vara: null,
    upj_id: null,
    plataforma: null,
    validacao_djen_status: 'nao_consultado',
    validacao_djen_em: null,
    validacao_djen_detalhe: null,
    id_orgao_djen: null,
    nome_orgao_djen: null,
    tipo_solicitante: 'autor-exequente',
    descricao_solicitante: null,
    nome_solicitante: null,
    tipo_prioridade: 'fora-localizador',
    descricao_tipo_outros: null,
    evento_folha: '1',
    descricao_prioridade: 'texto',
    observacao_adicional_atende: null,
    data_remessa_gestor: null,
    conferente_vinculado_id: 'conf-a',
    conferente_vinculado_nome: null,
    conferido_por_id: null,
    conferido_por_nome: null,
    justificativa_devolucao_gestor: null,
    justificativa_rejeicao_gestor: null,
    correcao_automatica: false,
    texto_correcao_automatica: null,
    observacao_adicional_gestor: null,
    urgentissimo: false,
    urgentissimo_auto: false,
    data_remessa_upj: null,
    analista_vinculado_id: null,
    analista_vinculado_nome: null,
    analisado_por_id: null,
    analisado_por_nome: null,
    justificativa_devolucao_upj: null,
    justificativa_rejeicao_upj: null,
    observacao_adicional_upj: null,
    arquivamento_automatico: false,
    rejeicao_automatica: false,
    reiterada: false,
    devolvida_por: null,
    data_devolucao: null,
    prazo_resposta_em: null,
    resposta_atendente: null,
    respondida_em: null,
    criado_em: '2026-10-01T12:00:00Z',
    atualizado_em: '2026-10-01T12:00:00Z',
    ...parcial,
  };
}

const gestor: ContextoLista = {
  perfilEfetivo: 'gestor',
  usuarioId: 'gestor-1',
  somenteVinculadas: false,
};

describe('anotacaoNaLista', () => {
  it('trata Reiterada como marca, sem tirar a anotação de Novas', () => {
    const item = anotacao({ status: 'upj-pendente', reiterada: true });
    expect(anotacaoNaLista(item, 'novas', gestor)).toBe(true);
    expect(anotacaoNaLista(item, 'reiteradas', gestor)).toBe(true);
  });

  it('mostra Urgentíssima automática junto com Em Análise', () => {
    const item = anotacao({ status: 'upj-analisada', urgentissimo_auto: true });
    expect(anotacaoNaLista(item, 'em-analise', gestor)).toBe(true);
    expect(anotacaoNaLista(item, 'urgentissimas', gestor)).toBe(true);
  });

  it('não leva anotação ainda em conferência para a fila da UPJ', () => {
    const item = anotacao({ status: 'gestor-conferencia', urgentissimo_auto: true, reiterada: true });
    const upj: ContextoLista = { perfilEfetivo: 'coordenador', usuarioId: 'c', somenteVinculadas: false };
    expect(anotacaoNaLista(item, 'urgentissimas', upj)).toBe(false);
    expect(anotacaoNaLista(item, 'reiteradas', upj)).toBe(false);
    expect(anotacaoNaLista(item, 'urgentissimas', gestor)).toBe(true);
  });

  it('restringe Ag. Conferência do Conferente ao que lhe foi vinculado', () => {
    const item = anotacao({ status: 'gestor-conferencia', conferente_vinculado_id: 'outro' });
    const conferente: ContextoLista = {
      perfilEfetivo: 'conferente',
      usuarioId: 'conf-a',
      somenteVinculadas: false,
    };
    expect(anotacaoNaLista(item, 'ag-conferencia', conferente)).toBe(false);
    expect(
      anotacaoNaLista(
        anotacao({ status: 'gestor-conferencia', conferente_vinculado_id: 'conf-a' }),
        'ag-conferencia',
        conferente
      )
    ).toBe(true);
  });

  it('aplica a preferência do Gestor só em Ag. Conferência e Retornadas', () => {
    const ctx: ContextoLista = { perfilEfetivo: 'gestor', usuarioId: 'gestor-1', somenteVinculadas: true };
    const deOutro = anotacao({
      status: 'gestor-conferencia',
      conferente_vinculado_id: 'outro',
      conferido_por_id: null,
    });
    expect(anotacaoNaLista(deOutro, 'ag-conferencia', ctx)).toBe(false);
    expect(anotacaoNaLista({ ...deOutro, status: 'upj-pendente' }, 'novas', ctx)).toBe(true);
    expect(
      anotacaoNaLista(
        anotacao({ status: 'upj-devolvida', conferido_por_id: 'gestor-1' }),
        'retornadas',
        ctx
      )
    ).toBe(true);
  });

  it('separa Aprovadas do Gestor de Reprovadas e de Rejeitadas da UPJ', () => {
    expect(anotacaoNaLista(anotacao({ status: 'upj-pendente' }), 'aprovadas', gestor)).toBe(true);
    expect(anotacaoNaLista(anotacao({ status: 'gestor-rejeitada' }), 'reprovadas', gestor)).toBe(true);
    expect(anotacaoNaLista(anotacao({ status: 'gestor-rejeitada' }), 'rejeitadas', gestor)).toBe(false);
    expect(anotacaoNaLista(anotacao({ status: 'upj-rejeitada' }), 'rejeitadas', gestor)).toBe(true);
    expect(anotacaoNaLista(anotacao({ status: 'upj-devolvida' }), 'devolvidas', gestor)).toBe(false);
    expect(anotacaoNaLista(anotacao({ status: 'gestor-devolvida' }), 'devolvidas', gestor)).toBe(true);
  });
});

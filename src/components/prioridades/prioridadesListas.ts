/**
 * Listas do painel depois da reclassificação de status.
 *
 * O status da anotação é exclusivo (transição ou final). Reiterada e
 * Urgentíssima são marcas que convivem com esse status.
 */
import type { AnotacaoPrioridade, PrioridadePerfil, PrioridadeStatus } from '../../types/Prioridades';

export type ChaveLista =
  | 'ag-conferencia'
  | 'devolvidas'
  | 'aprovadas'
  | 'reprovadas'
  | 'urgentissimas'
  | 'reiteradas'
  | 'retornadas'
  | 'novas'
  | 'em-analise'
  | 'resolvidas'
  | 'rejeitadas';

export interface ContextoLista {
  perfilEfetivo: PrioridadePerfil | null;
  usuarioId: string | null;
  /** Preferência do Gestor para Ag. Conferência e Retornadas. */
  somenteVinculadas: boolean;
}

type AnotacaoLista = Pick<
  AnotacaoPrioridade,
  | 'status'
  | 'reiterada'
  | 'urgentissimo'
  | 'urgentissimo_auto'
  | 'conferente_vinculado_id'
  | 'conferido_por_id'
>;

const STATUS_EM_ANDAMENTO: PrioridadeStatus[] = [
  'gestor-conferencia',
  'gestor-devolvida',
  'upj-devolvida',
  'upj-pendente',
  'upj-analisada',
];

/** O que a UPJ já recebeu — a lista "Aprovadas" do Atendente e do Gestor. */
const STATUS_APOS_APROVACAO: PrioridadeStatus[] = [
  'upj-pendente',
  'upj-analisada',
  'upj-devolvida',
  'upj-resolvida',
  'upj-rejeitada',
];

/** Filas da UPJ: não incluem o que ainda está na conferência do TJSP Atende. */
const STATUS_VISIVEL_UPJ: PrioridadeStatus[] = ['upj-pendente', 'upj-analisada', 'upj-devolvida'];

export function ehUrgentissima(anotacao: Pick<AnotacaoPrioridade, 'urgentissimo' | 'urgentissimo_auto'>): boolean {
  return anotacao.urgentissimo || anotacao.urgentissimo_auto;
}

function vinculadaAoUsuario(anotacao: AnotacaoLista, usuarioId: string | null): boolean {
  if (!usuarioId) return false;
  return anotacao.conferente_vinculado_id === usuarioId || anotacao.conferido_por_id === usuarioId;
}

function restringeVinculo(chave: ChaveLista, ctx: ContextoLista): boolean {
  if (chave !== 'ag-conferencia' && chave !== 'retornadas') return false;
  if (ctx.perfilEfetivo === 'conferente') return true;
  return ctx.perfilEfetivo === 'gestor' && ctx.somenteVinculadas;
}

export function anotacaoNaLista(anotacao: AnotacaoLista, chave: ChaveLista, ctx: ContextoLista): boolean {
  if (restringeVinculo(chave, ctx) && !vinculadaAoUsuario(anotacao, ctx.usuarioId)) {
    return false;
  }

  switch (chave) {
    case 'ag-conferencia':
      return anotacao.status === 'gestor-conferencia';
    case 'devolvidas':
      return anotacao.status === 'gestor-devolvida';
    case 'aprovadas':
      return STATUS_APOS_APROVACAO.includes(anotacao.status);
    case 'reprovadas':
      return anotacao.status === 'gestor-rejeitada';
    case 'retornadas':
      return anotacao.status === 'upj-devolvida';
    case 'novas':
      return anotacao.status === 'upj-pendente';
    case 'em-analise':
      return anotacao.status === 'upj-analisada';
    case 'resolvidas':
      return anotacao.status === 'upj-resolvida';
    case 'rejeitadas':
      return anotacao.status === 'upj-rejeitada';
    case 'reiteradas':
      return (
        anotacao.reiterada &&
        STATUS_EM_ANDAMENTO.includes(anotacao.status) &&
        (ctx.perfilEfetivo === 'coordenador' || ctx.perfilEfetivo === 'analista'
          ? STATUS_VISIVEL_UPJ.includes(anotacao.status)
          : true)
      );
    case 'urgentissimas':
      return (
        ehUrgentissima(anotacao) &&
        STATUS_EM_ANDAMENTO.includes(anotacao.status) &&
        (ctx.perfilEfetivo === 'coordenador' || ctx.perfilEfetivo === 'analista'
          ? STATUS_VISIVEL_UPJ.includes(anotacao.status)
          : true)
      );
    default:
      return false;
  }
}

export function contagemDaLista(anotacoes: AnotacaoLista[], chave: ChaveLista, ctx: ContextoLista): {
  total: number;
  reiteradas: number;
  urgentissimas: number;
} {
  const itens = anotacoes.filter((a) => anotacaoNaLista(a, chave, ctx));
  return {
    total: itens.length,
    reiteradas: itens.filter((a) => a.reiterada).length,
    urgentissimas: itens.filter((a) => ehUrgentissima(a)).length,
  };
}

export const LISTAS_COM_SELOS: ChaveLista[] = ['novas', 'em-analise', 'reiteradas'];

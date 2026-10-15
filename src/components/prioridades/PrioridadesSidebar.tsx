import React from 'react';
import type { PerfilUsuarioPrioridades, PrioridadePerfil, Upj } from '../../types/Prioridades';
import { PERFIL_LABEL } from '../../types/Prioridades';
import type { TelaPrioridades } from '../../hooks/usePrioridadesModal';
import { LISTAS_COM_SELOS, type ChaveLista } from './prioridadesListas';

interface Contagem {
  total: number;
  reiteradas: number;
  urgentissimas: number;
}

interface ItemMenu {
  chave: string;
  label: string;
  tela: TelaPrioridades;
  realce?: 'vermelho' | 'laranja' | 'dourado';
  selos?: boolean;
}

interface BlocoMenu {
  /** Seção maior, como "Atendentes" ou "UPJs". */
  grupo?: string;
  titulo?: string;
  itens: ItemMenu[];
}

interface PrioridadesSidebarProps {
  perfil: PerfilUsuarioPrioridades | null;
  perfilEfetivo: PrioridadePerfil | null;
  nomeUsuario: string;
  upjs: Upj[];
  contadores: Record<string, Contagem>;
  tela: TelaPrioridades;
  irPara: (t: TelaPrioridades) => void;
  temDesignacoes: boolean;
  temConfiguracoes: boolean;
  recolhido: boolean;
  alternarRecolhido: () => void;
}

function lista(chave: ChaveLista, label: string, realce?: ItemMenu['realce'], selos = false): ItemMenu {
  return { chave, label, tela: { tipo: 'lista', grupo: chave }, realce, selos };
}

function blocosDoPerfil(
  perfilEfetivo: PrioridadePerfil | null,
  temDesignacoes: boolean,
  temConfiguracoes: boolean
): BlocoMenu[] {
  const nova: ItemMenu = { chave: 'nova', label: 'Nova Anotação', tela: { tipo: 'nova' } };
  const historico: ItemMenu = { chave: 'historico', label: 'Histórico Geral', tela: { tipo: 'historico' } };

  if (perfilEfetivo === 'coordenador' || perfilEfetivo === 'analista') {
    const blocos: BlocoMenu[] = [
      {
        titulo: 'Especiais',
        itens: [
          lista('urgentissimas', 'Urgentíssimas', 'vermelho'),
          lista('reiteradas', 'Reiteradas', 'laranja', true),
        ],
      },
      {
        titulo: 'Em Andamento',
        itens: [lista('novas', 'Novas', 'dourado', true), lista('em-analise', 'Em Análise', undefined, true)],
      },
      {
        titulo: 'Arquivadas',
        itens: [lista('resolvidas', 'Resolvidas'), lista('rejeitadas', 'Rejeitadas'), historico],
      },
    ];
    if (temDesignacoes && (perfilEfetivo === 'coordenador' || perfilEfetivo === 'analista')) {
      blocos.push({
        itens: [{ chave: 'designacoes', label: 'Designações', tela: { tipo: 'designacoes' } }],
      });
    }
    return blocos;
  }

  if (perfilEfetivo === 'gestor' || perfilEfetivo === 'conferente') {
    const blocos: BlocoMenu[] = [
      { itens: [nova] },
      {
        grupo: 'Atendentes',
        titulo: 'Em Andamento',
        itens: [lista('ag-conferencia', 'Ag. Conferência'), lista('devolvidas', 'Devolvidas', 'vermelho')],
      },
      {
        grupo: 'Atendentes',
        titulo: 'Arquivadas',
        itens: [lista('aprovadas', 'Aprovadas'), lista('reprovadas', 'Reprovadas')],
      },
      {
        grupo: 'UPJs',
        titulo: 'Especiais',
        itens: [lista('urgentissimas', 'Urgentíssimas', 'vermelho'), lista('reiteradas', 'Reiteradas', 'laranja', true)],
      },
      {
        grupo: 'UPJs',
        titulo: 'Em Andamento',
        itens: [
          lista('retornadas', 'Retornadas', 'vermelho'),
          lista('novas', 'Novas', 'dourado', true),
          lista('em-analise', 'Em Análise', undefined, true),
        ],
      },
      {
        grupo: 'UPJs',
        titulo: 'Arquivadas',
        itens: [lista('resolvidas', 'Resolvidas'), lista('rejeitadas', 'Rejeitadas'), historico],
      },
    ];
    const rodape: ItemMenu[] = [];
    if (temDesignacoes) {
      rodape.push({ chave: 'designacoes', label: 'Designações', tela: { tipo: 'designacoes' } });
    }
    if (perfilEfetivo === 'gestor' && temConfiguracoes) {
      rodape.push({ chave: 'configuracoes', label: 'Configurações', tela: { tipo: 'configuracoes' } });
    }
    if (rodape.length > 0) blocos.push({ itens: rodape });
    return blocos;
  }

  const blocos: BlocoMenu[] = [
    { itens: [nova] },
    {
      titulo: 'Em Andamento',
      itens: [lista('devolvidas', 'Devolvidas', 'vermelho'), lista('ag-conferencia', 'Ag. Conferência')],
    },
    {
      titulo: 'Arquivadas',
      itens: [lista('aprovadas', 'Aprovadas'), lista('reprovadas', 'Reprovadas'), historico],
    },
  ];
  if (temDesignacoes) {
    blocos.push({
      itens: [{ chave: 'designacoes', label: 'Designações', tela: { tipo: 'designacoes' } }],
    });
  }
  return blocos;
}

function telaAtiva(tela: TelaPrioridades, item: ItemMenu): boolean {
  if (item.tela.tipo === 'lista') {
    return tela.tipo === 'lista' && tela.grupo === item.tela.grupo;
  }
  return tela.tipo === item.tela.tipo;
}

const REALCE: Record<NonNullable<ItemMenu['realce']>, string> = {
  vermelho: 'text-red-700 dark:text-red-300',
  laranja: 'text-orange-700 dark:text-orange-300',
  dourado: 'text-yellow-800 dark:text-yellow-200',
};

const SELO_REALCE: Record<NonNullable<ItemMenu['realce']>, string> = {
  vermelho: 'bg-red-600 text-white',
  laranja: 'bg-orange-500 text-white',
  dourado: 'bg-yellow-600 text-white',
};

/**
 * Painel limitado ao perfil de quem entrou. Não há alternância entre
 * Atendente, Gestor e UPJ.
 */
export const PrioridadesSidebar: React.FC<PrioridadesSidebarProps> = ({
  perfil,
  perfilEfetivo,
  nomeUsuario,
  upjs,
  contadores,
  tela,
  irPara,
  temDesignacoes,
  temConfiguracoes,
  recolhido,
  alternarRecolhido,
}) => {
  const blocos = blocosDoPerfil(perfilEfetivo, temDesignacoes, temConfiguracoes);
  const upj = perfil?.upj_id ? upjs.find((u) => u.id === perfil.upj_id) : null;
  const mostraUpj = perfilEfetivo === 'coordenador' || perfilEfetivo === 'analista';

  return (
    <aside
      className={`relative flex h-full shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] dark:border-gray-700 dark:bg-gray-800 ${
        recolhido ? 'w-10' : 'w-64'
      }`}
    >
      <button
        type="button"
        onClick={alternarRecolhido}
        aria-expanded={!recolhido}
        aria-label={recolhido ? 'Expandir painel' : 'Recolher painel'}
        className="absolute top-1/2 -right-3 z-10 flex h-8 w-6 -translate-y-1/2 items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-bold text-gray-600 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        {recolhido ? '>' : '<'}
      </button>

      {recolhido ? null : (
        <>
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden>
                🏛️
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-800 dark:text-gray-100">Prioridades e Urgências</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">TJSP Atende</p>
              </div>
            </div>
            <div className="mt-3 text-xs">
              <p className="truncate font-medium text-gray-700 dark:text-gray-200" title={nomeUsuario}>
                {nomeUsuario || 'Usuário'}
              </p>
              <p className="text-gray-500 dark:text-gray-400">
                {perfilEfetivo ? PERFIL_LABEL[perfilEfetivo] : 'Sem perfil no app'}
              </p>
              {mostraUpj && (
                <p className="mt-0.5 font-medium text-gray-700 dark:text-gray-200">
                  {upj?.nome ?? 'UPJ não vinculada'}
                </p>
              )}
              {perfil && perfilEfetivo && perfilEfetivo !== perfil.perfil && (
                <p className="mt-0.5 text-[11px] text-blue-600 dark:text-blue-300">
                  por designação (base: {PERFIL_LABEL[perfil.perfil]})
                </p>
              )}
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3">
            {blocos.map((bloco, indice) => {
              const grupoAnterior = indice > 0 ? blocos[indice - 1].grupo : undefined;
              const abreGrupo = bloco.grupo && bloco.grupo !== grupoAnterior;
              return (
              <div key={`${bloco.grupo ?? ''}-${bloco.titulo ?? indice}`} className={indice > 0 ? 'mt-3 border-t border-gray-200 pt-3 dark:border-gray-700' : ''}>
                {abreGrupo && (
                  <p className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    {bloco.grupo}
                  </p>
                )}
                {bloco.titulo && (
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {bloco.titulo}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {bloco.itens.map((item) => {
                    const contagem = contadores[item.chave] ?? { total: 0, reiteradas: 0, urgentissimas: 0 };
                    const ativo = telaAtiva(tela, item);
                    const cor = item.realce && !ativo ? REALCE[item.realce] : '';
                    const mostraSelos = item.selos && LISTAS_COM_SELOS.includes(item.chave as ChaveLista);
                    return (
                      <li key={item.chave}>
                        <button
                          type="button"
                          onClick={() => irPara(item.tela)}
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                            ativo
                              ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                              : `${cor} hover:bg-gray-100 dark:hover:bg-gray-700`
                          } ${!ativo && !cor ? 'text-gray-700 dark:text-gray-200' : ''}`}
                        >
                          <span className="truncate">{item.label}</span>
                          {item.tela.tipo === 'lista' && contagem.total > 0 && (
                            <span className="flex shrink-0 items-center gap-1">
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                                  item.realce ? SELO_REALCE[item.realce] : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-100'
                                }`}
                              >
                                {contagem.total}
                              </span>
                              {mostraSelos && contagem.reiteradas > 0 && item.chave !== 'reiteradas' && (
                                <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[11px] font-bold text-orange-800 dark:bg-orange-900/40 dark:text-orange-200" title="Também reiteradas">
                                  🔁 {contagem.reiteradas}
                                </span>
                              )}
                              {mostraSelos && contagem.urgentissimas > 0 && (
                                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-800 dark:bg-red-900/40 dark:text-red-200" title="Também urgentíssimas">
                                  ⚡ {contagem.urgentissimas}
                                </span>
                              )}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              );
            })}
          </nav>
        </>
      )}
    </aside>
  );
};

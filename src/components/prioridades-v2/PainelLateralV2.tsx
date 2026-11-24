import React from 'react';
import type { TelaPrioridades } from '../../hooks/usePrioridadesModal';
import type { PerfilUsuarioPrioridades, PrioridadePerfil, Upj } from '../../types/Prioridades';
import type { ChaveLista } from '../prioridades/prioridadesListas';
import { Icone } from './Icone';
import type { NomeIcone } from './icones';
import { PERFIL_CURTO, ehPerfilGestao, ehPerfilUpj, upjCurta } from './prioridadesV2Rotulos';
import logo from './assets/logo-prioridades.png';

interface Contagem {
  total: number;
  reiteradas: number;
  urgentissimas: number;
}

interface Item {
  chave: string;
  rotulo: string;
  icone: NomeIcone;
  tela: TelaPrioridades;
  /** Pede atenção quando há itens (rótulo e contador em vermelho). */
  alerta?: boolean;
  /** Mostra, ao lado do total, quantas são também urgentíssimas e reiteradas. */
  selos?: boolean;
  /** Item sem contador (telas que não são listas). */
  semContador?: boolean;
  /** Abre algo que não é uma tela (ex.: o diálogo de Créditos). */
  acao?: 'creditos';
}

/** Faixa branca ("ATENDENTES", "UPJs", "PAINEL DE CONTROLE") com divisórias e itens. */
interface Secao {
  faixa?: string;
  grupos: { divisor?: string; itens: Item[] }[];
}

interface Props {
  perfil: PerfilUsuarioPrioridades | null;
  perfilEfetivo: PrioridadePerfil | null;
  nomeCompleto: string;
  upjs: Upj[];
  contadores: Record<string, Contagem>;
  tela: TelaPrioridades;
  irPara: (t: TelaPrioridades) => void;
  podeCriar: boolean;
  temDesignacoes: boolean;
  temConfiguracoes: boolean;
  temLogAcessos: boolean;
  recolhido: boolean;
  alternarRecolhido: () => void;
  abrirCreditos: () => void;
  creditosAtivo: boolean;
}

const lista = (chave: ChaveLista, rotulo: string, icone: NomeIcone, extra: Partial<Item> = {}): Item => ({
  chave,
  rotulo,
  icone,
  tela: { tipo: 'lista', grupo: chave },
  ...extra,
});

function secoesDoPerfil(p: PrioridadePerfil | null, props: Pick<Props, 'temDesignacoes' | 'temConfiguracoes' | 'temLogAcessos'>): Secao[] {
  const gestao = ehPerfilGestao(p);
  const upj = ehPerfilUpj(p);

  // Atendente (e quem ainda não tem perfil): só o bloco ATENDENTES, do ponto de vista de quem anota.
  const atendentes: Secao = {
    faixa: 'Atendentes',
    grupos: [
      {
        divisor: 'Em andamento',
        itens: gestao
          ? [lista('ag-conferencia', 'Ag. Conferência', 'ag-conferencia', { alerta: true }), lista('devolvidas', 'Devolvidas', 'devolvidas')]
          : [lista('ag-conferencia', 'Ag. Conferência', 'ag-conferencia'), lista('devolvidas', 'Devolvidas', 'devolvidas', { alerta: true })],
      },
      { divisor: 'Arquivadas', itens: [lista('aprovadas', 'Aprovadas', 'aprovadas'), lista('reprovadas', 'Reprovadas', 'reprovadas')] },
    ],
  };

  const upjs: Secao = {
    faixa: 'UPJs',
    grupos: [
      {
        divisor: 'Especiais',
        itens: [
          lista('urgentissimas', 'Urgentíssimas', 'urgentissimas', { alerta: true }),
          lista('reiteradas', 'Reiteradas', 'reiteradas', { alerta: true }),
        ],
      },
      {
        divisor: 'Em andamento',
        itens: [
          lista('novas', 'Novas', 'novas', { selos: true, alerta: upj }),
          lista('em-analise', 'Em Análise', 'em-analise', { selos: true }),
          lista('retornadas', 'Retornadas', 'retornadas', { alerta: gestao }),
        ],
      },
      { divisor: 'Arquivadas', itens: [lista('resolvidas', 'Resolvidas', 'resolvidas'), lista('rejeitadas', 'Rejeitadas', 'rejeitadas')] },
    ],
  };

  const historico: Item = { chave: 'historico', rotulo: 'Histórico Geral', icone: 'historico', tela: { tipo: 'historico' }, semContador: true };

  const controle: Item[] = [];
  if (props.temDesignacoes) {
    controle.push({ chave: 'designacoes', rotulo: 'Designações', icone: 'designacoes', tela: { tipo: 'designacoes' }, semContador: true });
  }
  if (props.temConfiguracoes) {
    controle.push({ chave: 'configuracoes', rotulo: 'Configurações', icone: 'configuracoes', tela: { tipo: 'configuracoes' }, semContador: true });
  }
  if (props.temLogAcessos) {
    controle.push({ chave: 'log-acessos', rotulo: 'Log de Acessos', icone: 'log-acessos', tela: { tipo: 'log-acessos' }, semContador: true });
  }

  const secoes: Secao[] = [];
  if (upj) {
    secoes.push({ ...upjs, grupos: [...upjs.grupos, { divisor: 'Histórico', itens: [historico] }] });
  } else if (gestao) {
    secoes.push(atendentes, { ...upjs, grupos: [...upjs.grupos, { divisor: 'Histórico', itens: [historico] }] });
  } else {
    secoes.push({ ...atendentes, grupos: [...atendentes.grupos, { divisor: 'Histórico', itens: [historico] }] });
  }
  controle.push({ chave: 'creditos', rotulo: 'Créditos', icone: 'creditos', tela: { tipo: 'inicial' }, semContador: true, acao: 'creditos' });
  secoes.push({ faixa: 'Painel de Controle', grupos: [{ itens: controle }] });
  return secoes;
}

function estaAtivo(tela: TelaPrioridades, item: Item, creditosAtivo: boolean): boolean {
  if (item.acao === 'creditos' || creditosAtivo) return item.acao === 'creditos' && creditosAtivo;
  if (item.tela.tipo === 'lista') return tela.tipo === 'lista' && tela.grupo === item.tela.grupo;
  return tela.tipo === item.tela.tipo;
}

export const PainelLateralV2: React.FC<Props> = (props) => {
  const { perfil, perfilEfetivo, nomeCompleto, upjs, contadores, tela, irPara, podeCriar, recolhido, alternarRecolhido } = props;
  const secoes = secoesDoPerfil(perfilEfetivo, props);

  const minhaUpj = perfil?.upj_id ? upjs.find((u) => u.id === perfil.upj_id) : null;
  const lotacao = ehPerfilUpj(perfilEfetivo) ? upjCurta(minhaUpj) : 'TJSP Atende';
  const papel = perfilEfetivo ? `${PERFIL_CURTO[perfilEfetivo]} · ${lotacao}` : 'Sem perfil no app';
  const porDesignacao = perfil && perfilEfetivo && perfilEfetivo !== perfil.perfil;

  return (
    <aside className={`pu2-lateral${recolhido ? ' recolhido' : ''}`} aria-label="Menu do aplicativo">
      <button
        type="button"
        className="pu2-recolher"
        onClick={alternarRecolhido}
        aria-expanded={!recolhido}
        aria-label={recolhido ? 'Mostrar o menu' : 'Esconder o menu'}
        title={recolhido ? 'Mostrar o menu' : 'Esconder o menu'}
      >
        <Icone nome={recolhido ? 'avancar' : 'voltar'} tamanho={14} />
      </button>

      <div className="pu2-lateral-rolagem">
        <div className="pu2-perfil">
          <button
            type="button"
            className="pu2-perfil-logo"
            onClick={() => irPara({ tipo: 'inicial' })}
            title="Voltar à tela inicial"
            aria-label="Voltar à tela inicial"
          >
            <img src={logo} alt="" />
          </button>
          <div className="pu2-perfil-nome">{nomeCompleto}</div>
          <div className="pu2-perfil-papel">{papel}</div>
          {porDesignacao && <div className="pu2-perfil-papel">(por designação)</div>}
        </div>

        {podeCriar && (
          <button type="button" className="pu2-botao pu2-botao-primario pu2-lateral-nova" onClick={() => irPara({ tipo: 'nova' })}>
            <Icone nome="nova" tamanho={20} />
            Nova Anotação
          </button>
        )}

        <nav>
          {secoes.map((secao) => (
            <div key={secao.faixa ?? 'sem-faixa'}>
              {secao.faixa && <div className="pu2-faixa">{secao.faixa}</div>}
              {secao.grupos.map((grupo, i) => (
                <div key={grupo.divisor ?? i}>
                  {grupo.divisor && <div className="pu2-divisor">{grupo.divisor}</div>}
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {grupo.itens.map((item) => {
                      const c = contadores[item.chave] ?? { total: 0, reiteradas: 0, urgentissimas: 0 };
                      const temAlerta = Boolean(item.alerta && c.total > 0);
                      const ativo = estaAtivo(tela, item, props.creditosAtivo);
                      return (
                        <li key={item.chave}>
                          <button
                            type="button"
                            className={`pu2-item${ativo ? ' ativo' : ''}${temAlerta ? ' realce' : ''}`}
                            onClick={() => (item.acao === 'creditos' ? props.abrirCreditos() : irPara(item.tela))}
                            aria-current={ativo ? 'page' : undefined}
                          >
                            <Icone nome={item.icone} tamanho={18} />
                            <span className="pu2-item-rotulo">
                              <span>{item.rotulo}</span>
                            </span>
                            {!item.semContador && (
                              <span className="pu2-contadores">
                                {item.selos && c.urgentissimas > 0 && (
                                  <span className="pu2-contador alerta" title={`${c.urgentissimas} também urgentíssima(s)`}>
                                    <Icone nome="urgentissimas" tamanho={12} />
                                    {c.urgentissimas}
                                  </span>
                                )}
                                {item.selos && c.reiteradas > 0 && (
                                  <span className="pu2-contador alerta" title={`${c.reiteradas} também reiterada(s)`}>
                                    <Icone nome="reiteradas" tamanho={11} />
                                    {c.reiteradas}
                                  </span>
                                )}
                                <span className={`pu2-contador${temAlerta ? ' alerta' : ''}`}>{c.total}</span>
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
};

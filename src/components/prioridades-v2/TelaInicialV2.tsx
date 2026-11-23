import React from 'react';
import type { TelaPrioridades } from '../../hooks/usePrioridadesModal';
import type { PrioridadePerfil } from '../../types/Prioridades';
import { Icone } from './Icone';
import { ehPerfilGestao, ehPerfilUpj, plural } from './prioridadesV2Rotulos';
import logo from './assets/logo-prioridades.png';

interface Contagem {
  total: number;
  reiteradas: number;
  urgentissimas: number;
}

interface Props {
  primeiroNome: string;
  perfilEfetivo: PrioridadePerfil | null;
  contadores: Record<string, Contagem>;
  podeCriar: boolean;
  irPara: (t: TelaPrioridades) => void;
}

interface Pendencia {
  grupo: string;
  /** Trecho em vermelho, clicável (leva à lista). */
  destaque: string;
  complemento: string;
}

/**
 * Tela inicial (maquete 001): saudação, botão grande de Nova Anotação e um
 * resumo do que pede ação de quem entrou. Cada linha do resumo leva à lista.
 */
export const TelaInicialV2: React.FC<Props> = ({ primeiroNome, perfilEfetivo, contadores, podeCriar, irPara }) => {
  const n = (grupo: string) => contadores[grupo]?.total ?? 0;
  const pendencias: Pendencia[] = [];

  if (ehPerfilUpj(perfilEfetivo)) {
    if (n('urgentissimas') > 0) {
      pendencias.push({ grupo: 'urgentissimas', destaque: plural(n('urgentissimas'), 'anotação urgentíssima', 'anotações urgentíssimas'), complemento: 'para analisar.' });
    }
    // M: mesma ordem do painel lateral (Urgentíssimas, Reiteradas, Novas).
    if (n('reiteradas') > 0) {
      pendencias.push({ grupo: 'reiteradas', destaque: plural(n('reiteradas'), 'anotação reiterada', 'anotações reiteradas'), complemento: 'em andamento.' });
    }
    if (n('novas') > 0) {
      pendencias.push({ grupo: 'novas', destaque: plural(n('novas'), 'anotação nova', 'anotações novas'), complemento: 'aguardando a UPJ.' });
    }
  } else if (ehPerfilGestao(perfilEfetivo)) {
    if (n('ag-conferencia') > 0) {
      pendencias.push({ grupo: 'ag-conferencia', destaque: plural(n('ag-conferencia'), 'anotação', 'anotações'), complemento: 'aguardando conferência.' });
    }
    if (n('retornadas') > 0) {
      pendencias.push({ grupo: 'retornadas', destaque: plural(n('retornadas'), 'anotação retornada', 'anotações retornadas'), complemento: 'pela UPJ para correção.' });
    }
  } else if (n('devolvidas') > 0) {
    pendencias.push({ grupo: 'devolvidas', destaque: plural(n('devolvidas'), 'anotação devolvida', 'anotações devolvidas'), complemento: 'pendentes de verificação.' });
  }

  return (
    <div className="pu2-inicial">
      <div className="pu2-marca">
        <div className="pu2-marca-sup">
          TJSP <span>ATENDE</span>
        </div>
        <div className="pu2-marca-inf">PRIORIDADES e URGÊNCIAS</div>
      </div>

      <img className="pu2-inicial-logo" src={logo} alt="" />
      <h2 className="pu2-saudacao">Olá, {primeiroNome}!</h2>

      {podeCriar ? (
        <button type="button" className="pu2-botao pu2-botao-primario pu2-botao-gigante" onClick={() => irPara({ tipo: 'nova' })}>
          <Icone nome="nova" tamanho="1.1em" />
          Nova Anotação
        </button>
      ) : (
        ehPerfilUpj(perfilEfetivo) && (
          <button
            type="button"
            className="pu2-botao pu2-botao-primario pu2-botao-gigante"
            onClick={() => irPara({ tipo: 'lista', grupo: 'novas' })}
          >
            <Icone nome="novas" tamanho="1.1em" />
            Ver Anotações Novas
          </button>
        )
      )}

      <div className="pu2-resumo" aria-live="polite">
        {pendencias.length === 0 ? (
          <p className="pu2-resumo-ok">Tudo em dia: nenhuma anotação esperando por você.</p>
        ) : (
          pendencias.map((p) => (
            <p key={p.grupo} style={{ margin: 0 }}>
              Você tem{' '}
              <button type="button" onClick={() => irPara({ tipo: 'lista', grupo: p.grupo })}>
                {p.destaque}
              </button>{' '}
              {p.complemento}
            </p>
          ))
        )}
      </div>
    </div>
  );
};

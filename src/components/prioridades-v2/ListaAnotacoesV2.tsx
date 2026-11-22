/**
 * Lista de anotações (maquetes 003 e 004): barra de filtro, título com o total
 * e um cartão por anotação.
 */
import React, { useMemo, useState } from 'react';
import type { AnotacaoPrioridade, CategoriaAnotacao, Upj } from '../../types/Prioridades';
import { STATUS_LABEL } from '../../types/Prioridades';
import { formatarProcessoCnj, somenteDigitos } from '../../services/prioridadesDjenService';
import { CATEGORIAS_ANOTACAO, rotuloCategoria } from '../prioridades/prioridadesCategorias';
import { ehUrgentissima } from '../prioridades/prioridadesListas';
import { prazoRestante } from '../prioridades/prioridadesUtils';
import { EtiquetaReiterada, EtiquetaStatus, EtiquetaUrgentissima } from './EtiquetasV2';
import { Icone } from './Icone';
import type { NomeIcone } from './icones';
import { ICONE_CATEGORIA, SIGLA_CATEGORIA, faixaVaras, upjCurta, varaOrdinal } from './prioridadesV2Rotulos';

interface Props {
  titulo: string;
  icone: NomeIcone;
  itens: AnotacaoPrioridade[];
  upjs: Upj[];
  rotuloTipo: (codigo: string) => string;
  onAbrir: (a: AnotacaoPrioridade) => void;
  carregando: boolean;
}

/** Texto em que a busca procura: número (com e sem máscara), descrição, tipo, UPJ, Vara, autor etc. */
function textoDeBusca(a: AnotacaoPrioridade, upj: Upj | null, rotuloTipo: (c: string) => string): string {
  return [
    a.processo,
    formatarProcessoCnj(a.processo),
    String(a.id),
    a.descricao_prioridade,
    rotuloTipo(a.tipo_prioridade),
    a.descricao_tipo_outros,
    a.evento_folha,
    rotuloCategoria(a.categoria),
    a.categoria ? SIGLA_CATEGORIA[a.categoria as CategoriaAnotacao] : '',
    upj ? `${upjCurta(upj)} ${faixaVaras(upj) ?? ''}` : '',
    a.vara ? `${a.vara}ª vara ${a.vara}.ª vara ${a.vara} vara` : '',
    a.criador_nome,
    a.nome_solicitante,
    STATUS_LABEL[a.status],
  ]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const CartaoAnotacao: React.FC<{
  a: AnotacaoPrioridade;
  upj: Upj | null;
  rotuloTipo: (c: string) => string;
  onAbrir: (a: AnotacaoPrioridade) => void;
}> = ({ a, upj, rotuloTipo, onAbrir }) => {
  const urgentissima = ehUrgentissima(a);
  const devolvida = a.status === 'gestor-devolvida' || a.status === 'upj-devolvida';
  const prazo = devolvida ? prazoRestante(a.prazo_resposta_em) : null;
  const data = new Date(a.data_anotacao);
  const cat = a.categoria as CategoriaAnotacao | null;

  return (
    <button type="button" className={`pu2-cartao${urgentissima ? ' destaque' : ''}`} onClick={() => onAbrir(a)}>
      <span className="pu2-cartao-cat" aria-hidden>
        {cat ? (
          <>
            <Icone nome={ICONE_CATEGORIA[cat]} tamanho={46} />
            <span className="pu2-cartao-sigla">{SIGLA_CATEGORIA[cat]}</span>
          </>
        ) : (
          <span className="pu2-cartao-sigla">—</span>
        )}
      </span>
      <span className="pu2-cartao-corpo">
        <span className="pu2-cartao-linha1">
          <span className="pu2-cartao-numero">{formatarProcessoCnj(a.processo)}</span>
          {urgentissima && <EtiquetaUrgentissima />}
          {a.reiterada && <EtiquetaReiterada />}
          <EtiquetaStatus status={a.status} />
        </span>
        <span className="pu2-cartao-titulo">{rotuloTipo(a.tipo_prioridade)}</span>
        <span className="pu2-cartao-descricao">{a.descricao_prioridade}</span>
        <span className="pu2-cartao-meta">
          <span>
            <strong>{data.toLocaleDateString('pt-BR')}</strong>, {data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="sep">|</span>
          <span>
            <strong>{upjCurta(upj)}</strong>
            {faixaVaras(upj) && ` (${faixaVaras(upj)})`}
          </span>
          {a.vara && (
            <>
              <span className="sep">|</span>
              <span>
                <strong>{varaOrdinal(a.vara)}</strong> Vara Cível
              </span>
            </>
          )}
          {prazo && (
            <>
              <span className="sep">|</span>
              <span className={prazo.expirado ? 'prazo expirado' : 'prazo'}>
                {prazo.expirado ? 'Prazo encerrado' : `Prazo para resposta: ${prazo.texto}`}
              </span>
            </>
          )}
        </span>
      </span>
      <span className="pu2-cartao-numero-anotacao" title="Número da anotação">
        n.º {a.id}
      </span>
    </button>
  );
};

export const ListaAnotacoesV2: React.FC<Props> = ({ titulo, icone, itens, upjs, rotuloTipo, onAbrir, carregando }) => {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<CategoriaAnotacao | ''>('');

  const upjPorId = useMemo(() => new Map(upjs.map((u) => [u.id, u])), [upjs]);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    const termoDigitos = somenteDigitos(busca);
    // Urgentíssimas primeiro, depois reiteradas; dentro de cada grupo, a ordem do servidor.
    const peso = (a: AnotacaoPrioridade) => (ehUrgentissima(a) ? 0 : a.reiterada ? 1 : 2);
    const ordenados = [...itens].sort((x, y) => peso(x) - peso(y));
    return ordenados.filter((a) => {
      if (categoria && a.categoria !== categoria) return false;
      if (!termo) return true;
      const texto = textoDeBusca(a, a.upj_id ? upjPorId.get(a.upj_id) ?? null : null, rotuloTipo);
      // Número de processo digitado em parte, com ou sem pontuação.
      if (termoDigitos.length >= 4 && a.processo.includes(termoDigitos)) return true;
      return termo.split(/\s+/).every((p) => texto.includes(p));
    });
  }, [itens, busca, categoria, upjPorId, rotuloTipo]);

  return (
    <div>
      <div className="pu2-filtro">
        <input
          className="pu2-entrada"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar por número de processo, descrição, detalhes, UPJ, Vara etc."
          aria-label="Filtrar anotações"
        />
        <select
          className="pu2-selecao"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaAnotacao | '')}
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas as categorias</option>
          {CATEGORIAS_ANOTACAO.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="pu2-titulo-tela">
        <h2>
          <Icone nome={icone} tamanho="0.9em" />
          {titulo}
          <span className="pu2-titulo-total">
            (<span>{filtrados.length}</span>)
          </span>
        </h2>
      </div>

      {carregando && itens.length === 0 ? (
        <p className="pu2-carregando">Carregando anotações…</p>
      ) : filtrados.length === 0 ? (
        <div className="pu2-vazio">
          {busca || categoria ? 'Nenhuma anotação encontrada com esse filtro.' : 'Nenhuma anotação nesta lista.'}
        </div>
      ) : (
        <div className="pu2-cartoes">
          {filtrados.map((a) => (
            <CartaoAnotacao
              key={a.id}
              a={a}
              upj={a.upj_id ? upjPorId.get(a.upj_id) ?? null : null}
              rotuloTipo={rotuloTipo}
              onAbrir={onAbrir}
            />
          ))}
        </div>
      )}
    </div>
  );
};

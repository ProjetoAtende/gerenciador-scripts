/**
 * Configurações do Gestor no visual da v2: visão da fila, dias sem expediente
 * e regras especiais por UPJ. Mesmas chamadas ao servidor da v1.
 */
import React, { useCallback, useEffect, useState } from 'react';
import type { CatalogoItem } from '../../services/prioridadesService';
import {
  definirVisaoFila,
  incluirDiaSemExpediente,
  listarDiasSemExpediente,
  listarRegrasEspeciais,
  listarTiposPrioridade,
  removerDiaSemExpediente,
  salvarRegraEspecial,
  type DiaSemExpediente,
  type RegraEspecial,
} from '../../services/prioridadesService';
import type { Upj } from '../../types/Prioridades';
import { Icone } from './Icone';
import { faixaVaras, upjCurta } from './prioridadesV2Rotulos';

interface Props {
  upjs: Upj[];
  somenteVinculadas: boolean;
  onVoltar: () => void;
  onAtualizar: () => Promise<void>;
}

export const ConfiguracoesV2: React.FC<Props> = ({ upjs, somenteVinculadas, onVoltar, onAtualizar }) => {
  const [dias, setDias] = useState<DiaSemExpediente[]>([]);
  const [regras, setRegras] = useState<RegraEspecial[]>([]);
  const [tipos, setTipos] = useState<CatalogoItem[]>([]);
  const [data, setData] = useState('');
  const [descricao, setDescricao] = useState('');
  const [upjId, setUpjId] = useState('');
  const [tipo, setTipo] = useState('');
  const [textoRegra, setTextoRegra] = useState('');
  const [filaRestrita, setFilaRestrita] = useState(somenteVinculadas);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [d, r, t] = await Promise.all([listarDiasSemExpediente(), listarRegrasEspeciais(), listarTiposPrioridade()]);
    setDias(d);
    setRegras(r);
    setTipos(t);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setTextoRegra(regras.find((r) => r.upj_id === upjId && r.tipo_prioridade === tipo)?.texto ?? '');
  }, [regras, upjId, tipo]);

  const mostrar = (ok: string | null, falha: string | null) => {
    setAviso(ok);
    setErro(falha);
  };

  const incluirDia = async () => {
    if (!data) {
      mostrar(null, 'Escolha a data.');
      return;
    }
    const r = await incluirDiaSemExpediente(data, descricao);
    if (!r.sucesso) {
      mostrar(null, r.erro ?? 'Não foi possível incluir o dia.');
      return;
    }
    setData('');
    setDescricao('');
    mostrar('Dia sem expediente incluído. Prazos que já estavam correndo não mudam.', null);
    await carregar();
  };

  const removerDia = async (dia: string) => {
    const r = await removerDiaSemExpediente(dia);
    if (!r.sucesso) {
      mostrar(null, r.erro ?? 'Não foi possível remover o dia.');
      return;
    }
    mostrar('Dia removido.', null);
    await carregar();
  };

  const salvarRegra = async () => {
    const r = await salvarRegraEspecial(upjId, tipo, textoRegra);
    if (!r.sucesso) {
      mostrar(null, r.erro ?? 'Não foi possível salvar a regra.');
      return;
    }
    mostrar(textoRegra.trim() ? 'Regra especial salva.' : 'Regra especial removida.', null);
    await carregar();
  };

  const salvarFila = async (valor: boolean) => {
    setFilaRestrita(valor);
    const r = await definirVisaoFila(valor);
    if (!r.sucesso) {
      setFilaRestrita(!valor);
      mostrar(null, r.erro ?? 'Não foi possível salvar a preferência.');
      return;
    }
    mostrar('Preferência salva.', null);
    await onAtualizar();
  };

  return (
    <div>
      <div className="pu2-titulo-tela">
        <h2>
          <Icone nome="configuracoes" tamanho="0.9em" />
          Configurações
        </h2>
        <button type="button" className="pu2-botao pu2-botao-link" onClick={onVoltar}>
          <Icone nome="voltar" tamanho={14} />
          Voltar
        </button>
      </div>

      {erro && (
        <div className="pu2-caixa pu2-caixa-erro" role="alert">
          {erro}
        </div>
      )}
      {aviso && (
        <div className="pu2-caixa pu2-caixa-sucesso pu2-retorno" role="status">
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      )}

      <section className="pu2-secao">
        <h3 className="pu2-secao-rotulo">Fila de conferência</h3>
        <div className="pu2-bloco pu2-bloco-esquerda">
          <label className="pu2-marcacao" style={{ margin: 0, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={filaRestrita} onChange={(e) => void salvarFila(e.target.checked)} style={{ marginTop: 2 }} />
            <span>
              Em Ag. Conferência e Retornadas, mostrar só as anotações vinculadas a mim
              <span className="pu2-ajuda" style={{ display: 'block', fontWeight: 500 }}>
                Desmarcado, as duas listas mostram também as anotações vinculadas aos Conferentes.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="pu2-secao">
        <h3 className="pu2-secao-rotulo">Dias sem expediente</h3>
        <div className="pu2-bloco pu2-bloco-esquerda">
          <p className="pu2-ajuda" style={{ margin: 0 }}>
            O prazo de 24 h fica parado nestes dias, assim como aos sábados e domingos. Um prazo já mostrado ao Atendente não é
            recalculado.
          </p>
          <div className="pu2-linha-processo">
            <input className="pu2-entrada" type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Data" style={{ flex: '0 0 200px' }} />
            <input
              className="pu2-entrada"
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Motivo (feriado, suspensão, recesso)"
              aria-label="Motivo"
            />
            <button type="button" className="pu2-botao pu2-botao-primario" onClick={() => void incluirDia()}>
              Incluir
            </button>
          </div>
          {dias.length === 0 ? (
            <p className="pu2-ajuda" style={{ margin: 0 }}>
              Nenhum dia cadastrado.
            </p>
          ) : (
            <ul className="pu2-lista-simples">
              {dias.map((d) => (
                <li key={d.data}>
                  <span>
                    <strong>{d.data.split('-').reverse().join('/')}</strong> {d.descricao}
                  </span>
                  <button type="button" className="pu2-botao pu2-botao-link" onClick={() => void removerDia(d.data)}>
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="pu2-secao">
        <h3 className="pu2-secao-rotulo">Regras especiais das UPJs</h3>
        <div className="pu2-bloco pu2-bloco-esquerda">
          <p className="pu2-ajuda" style={{ margin: 0 }}>
            Uma regra por UPJ e por tipo de prioridade. O Atendente vê o texto num aviso ao escolher o tipo.
          </p>
          <div className="pu2-linha-processo">
            <select className="pu2-selecao" value={upjId} onChange={(e) => setUpjId(e.target.value)} aria-label="UPJ">
              <option value="">UPJ…</option>
              {upjs.map((u) => (
                <option key={u.id} value={u.id}>
                  {upjCurta(u)} {faixaVaras(u) ? `(${faixaVaras(u)})` : ''}
                </option>
              ))}
            </select>
            <select className="pu2-selecao" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo da Prioridade ou Urgência">
              <option value="">Tipo da Prioridade ou Urgência…</option>
              {tipos.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="pu2-area"
            rows={4}
            value={textoRegra}
            onChange={(e) => setTextoRegra(e.target.value)}
            placeholder="Texto do aviso. Para remover a regra, apague o texto e salve."
            aria-label="Texto da regra"
            disabled={!upjId || !tipo}
          />
          <div className="pu2-acoes" style={{ marginTop: 0 }}>
            <button type="button" className="pu2-botao pu2-botao-primario" disabled={!upjId || !tipo} onClick={() => void salvarRegra()}>
              Salvar regra
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

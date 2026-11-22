/**
 * Detalhe da anotação (maquete 005), em caixas, com o painel de ação de quem
 * a abriu:
 *  - UPJ: Resolver / Retornar / Rejeitar            (modo 'analise')
 *  - Gestor/Conferente: Aprovar / Devolver / Rejeitar (modo 'conferencia')
 *  - Atendente: responder à devolução               (modo 'resposta')
 *  - Gestor: corrigir anotação retornada pela UPJ   (modo 'correcao')
 *  - demais casos: só leitura                       (modo 'consulta')
 *
 * As chamadas ao servidor e as validações são as mesmas da v1.
 */
import React, { useEffect, useState } from 'react';
import type { AnotacaoPrioridade, CategoriaAnotacao, HistoricoAnotacao, PrioridadePerfil, Upj } from '../../types/Prioridades';
import { STATUS_LABEL } from '../../types/Prioridades';
import {
  aceitarRejeicaoRetorno,
  aceitarReprovacao,
  analisarAnotacao,
  conferirAnotacao,
  corrigirRetornada,
  listarHistorico,
  responderDevolucao,
} from '../../services/prioridadesService';
import { formatarProcessoCnj } from '../../services/prioridadesDjenService';
import { CATEGORIAS_ANOTACAO, rotuloCategoria } from '../prioridades/prioridadesCategorias';
import { ehUrgentissima } from '../prioridades/prioridadesListas';
import { formatarDataHora, formatarTerminoPrazo, prazoRestante } from '../prioridades/prioridadesUtils';
import { EtiquetaReiterada, EtiquetaStatus, EtiquetaUrgentissima } from './EtiquetasV2';
import { Icone } from './Icone';
import type { NomeIcone } from './icones';
import { ICONE_CATEGORIA, ehPerfilUpj, faixaVaras, upjCurta, varaOrdinal } from './prioridadesV2Rotulos';
import { LogoPlataforma } from './LogoPlataforma';

export type ModoDetalhe = 'conferencia' | 'analise' | 'resposta' | 'correcao' | 'consulta';

interface Props {
  anotacao: AnotacaoPrioridade;
  modo: ModoDetalhe;
  upjs: Upj[];
  perfilEfetivo: PrioridadePerfil | null;
  rotuloTipo: (codigo: string) => string;
  rotuloSolicitante: (codigo: string) => string;
  onConcluir: (mensagem: string) => void | Promise<void>;
  onVoltar: () => void;
}

/* ── Peças de apresentação ─────────────────────────────────────────── */

const Bloco: React.FC<{ titulo: string; children: React.ReactNode; destaque?: 'alerta' | 'aviso' }> = ({ titulo, children, destaque }) => (
  <section className="pu2-secao">
    <h3 className="pu2-secao-rotulo">{titulo}</h3>
    <div className={`pu2-bloco${destaque ? ` ${destaque}` : ''}`}>{children}</div>
  </section>
);

const Dado: React.FC<{ rotulo: string; children: React.ReactNode; largo?: boolean }> = ({ rotulo, children, largo }) => (
  <div className={`pu2-dado${largo ? ' largo' : ''}`}>
    <div className="pu2-dado-rotulo">{rotulo}</div>
    <div className="pu2-dado-valor">{children || '—'}</div>
  </div>
);

const Dialogo: React.FC<{
  titulo: string;
  texto: string;
  confirmar: string;
  ocupado: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}> = ({ titulo, texto, confirmar, ocupado, onConfirmar, onCancelar }) => (
  <div className="pu2-dialogo-fundo" role="alertdialog" aria-modal="true" aria-labelledby="pu2-dialogo-titulo">
    <div className="pu2-dialogo">
      <h3 id="pu2-dialogo-titulo">{titulo}</h3>
      <p style={{ margin: '0 0 18px', lineHeight: 1.5 }}>{texto}</p>
      <div className="pu2-acoes">
        <button type="button" className="pu2-botao pu2-botao-secundario" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </button>
        <button type="button" className="pu2-botao pu2-botao-primario" onClick={onConfirmar} disabled={ocupado}>
          {ocupado ? 'Registrando…' : confirmar}
        </button>
      </div>
    </div>
  </div>
);

function Opcoes<T extends string>({
  legenda,
  valor,
  opcoes,
  onChange,
}: {
  legenda: string;
  valor: T;
  opcoes: { valor: T; rotulo: string; icone: NomeIcone }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="pu2-campo" style={{ border: 0, padding: 0, margin: '0 0 20px' }}>
      <legend className="pu2-rotulo">{legenda}</legend>
      <div className="pu2-opcoes">
        {opcoes.map((o) => {
          const marcada = valor === o.valor;
          return (
            <label key={o.valor} className={`pu2-categoria pu2-opcao${marcada ? ' marcada' : ''}`}>
              <input type="radio" name={legenda} value={o.valor} checked={marcada} onChange={() => onChange(o.valor)} />
              <Icone className="radio" nome={marcada ? 'radio-on' : 'radio-off'} tamanho={20} />
              <Icone className="icone-cat" nome={o.icone} tamanho={20} />
              <span>{o.rotulo}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Contagem regressiva que se atualiza a cada segundo. */
function usePrazo(iso: string | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return { prazo: prazoRestante(iso), termino: formatarTerminoPrazo(iso) };
}

const CaixaPrazo: React.FC<{ iso: string | null; titulo: string; justificativa: string | null }> = ({ iso, titulo, justificativa }) => {
  const { prazo, termino } = usePrazo(iso);
  return (
    <div className={`pu2-caixa ${prazo.expirado ? 'pu2-caixa-erro' : 'pu2-caixa-aviso'} pu2-prazo`}>
      <div>
        <div className="pu2-caixa-titulo">
          <Icone nome="aviso" tamanho={20} />
          {titulo}
        </div>
        {justificativa && <p style={{ margin: '4px 0 0' }}>{justificativa}</p>}
      </div>
      <div className="pu2-prazo-relogio">
        <span>{prazo.expirado ? 'Prazo' : 'Prazo para resposta'}</span>
        <strong>{prazo.texto}</strong>
        {termino && !prazo.expirado && <small>até {termino}</small>}
      </div>
    </div>
  );
};

/* ── Painéis de ação ───────────────────────────────────────────────── */

const PainelUpj: React.FC<{ a: AnotacaoPrioridade; onConcluir: Props['onConcluir']; onVoltar: () => void }> = ({ a, onConcluir, onVoltar }) => {
  type D = 'resolver' | 'devolver' | 'rejeitar';
  const [decisao, setDecisao] = useState<D>('resolver');
  const [texto, setTexto] = useState(a.observacao_adicional_upj ?? '');
  const [rejeicaoAutomatica, setRejeicaoAutomatica] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const exigeJustificativa = decisao !== 'resolver';

  const enviar = async () => {
    setErro(null);
    if (exigeJustificativa && !texto.trim()) {
      setErro(decisao === 'devolver' ? 'Escreva a justificativa para retornar.' : 'Escreva a justificativa para rejeitar.');
      return;
    }
    setEnviando(true);
    try {
      const r = await analisarAnotacao({
        anotacaoId: a.id,
        decisao,
        observacaoUpj: decisao === 'resolver' ? texto : a.observacao_adicional_upj ?? '',
        justificativa: exigeJustificativa ? texto : '',
        arquivamentoAutomatico: decisao === 'devolver' ? rejeicaoAutomatica : false,
      });
      if (!r.sucesso) {
        setErro(r.erro ?? 'Não foi possível concluir a análise.');
        return;
      }
      await onConcluir(
        decisao === 'resolver'
          ? `Anotação n.º ${a.id} resolvida.`
          : decisao === 'devolver'
            ? `Anotação n.º ${a.id} retornada ao TJSP Atende, com prazo de 24 h para correção.`
            : `Anotação n.º ${a.id} rejeitada.`
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="pu2-secao">
      <Opcoes<D>
        legenda="Decisão da UPJ"
        valor={decisao}
        onChange={(v) => {
          setDecisao(v);
          setErro(null);
        }}
        opcoes={[
          { valor: 'resolver', rotulo: 'Resolver', icone: 'resolvidas' },
          { valor: 'devolver', rotulo: 'Retornar', icone: 'retornadas' },
          { valor: 'rejeitar', rotulo: 'Rejeitar', icone: 'rejeitadas' },
        ]}
      />
      <div className="pu2-campo">
        <label htmlFor="pu2-upj-texto" className="pu2-rotulo">
          {exigeJustificativa ? 'Justificativa' : 'Observação'}
          {exigeJustificativa && <span className="obrigatorio"> *</span>}
          <span className="nota">(Informação a ser repassada ao Solicitante)</span>
        </label>
        <textarea id="pu2-upj-texto" className="pu2-area" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      {decisao === 'devolver' && (
        <label className="pu2-marcacao">
          <input type="checkbox" checked={rejeicaoAutomatica} onChange={(e) => setRejeicaoAutomatica(e.target.checked)} />
          Rejeitar automaticamente se não for corrigida em 24 h
        </label>
      )}
      {erro && (
        <div className="pu2-caixa pu2-caixa-erro" role="alert">
          {erro}
        </div>
      )}
      <div className="pu2-acoes">
        <button type="button" className="pu2-botao pu2-botao-secundario" onClick={onVoltar}>
          Cancelar
        </button>
        <button type="button" className="pu2-botao pu2-botao-primario" onClick={() => void enviar()} disabled={enviando}>
          {enviando ? 'Registrando…' : 'Confirmar'}
        </button>
      </div>
    </section>
  );
};

const PainelConferencia: React.FC<{
  a: AnotacaoPrioridade;
  upjs: Upj[];
  onConcluir: Props['onConcluir'];
  onVoltar: () => void;
}> = ({ a, upjs, onConcluir, onVoltar }) => {
  type D = 'aprovar' | 'devolver' | 'rejeitar';
  const [decisao, setDecisao] = useState<D>('aprovar');
  const [justificativa, setJustificativa] = useState('');
  const [urgentissimo, setUrgentissimo] = useState(a.urgentissimo);
  const [correcaoAutomatica, setCorrecaoAutomatica] = useState(false);
  const [textoCorrecao, setTextoCorrecao] = useState('');
  const [upjDestino, setUpjDestino] = useState(a.upj_id ?? '');
  const [categoria, setCategoria] = useState<CategoriaAnotacao | ''>(a.categoria ?? '');
  const [eventoFolha, setEventoFolha] = useState(a.evento_folha);
  const [descricao, setDescricao] = useState(a.descricao_prioridade);
  const [obsGestor, setObsGestor] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async () => {
    setErro(null);
    if (decisao === 'aprovar' && !upjDestino) {
      setErro('Escolha a UPJ de destino antes de aprovar: sem ela, nenhum cartório vê a anotação.');
      return;
    }
    if (!categoria) {
      setErro('Escolha a Categoria da Anotação.');
      return;
    }
    if (decisao !== 'aprovar' && !justificativa.trim()) {
      setErro('Escreva a justificativa.');
      return;
    }
    if (decisao === 'devolver' && correcaoAutomatica && !textoCorrecao.trim()) {
      setErro('Escreva o texto da correção automática.');
      return;
    }
    setEnviando(true);
    try {
      const r = await conferirAnotacao({
        anotacaoId: a.id,
        decisao,
        justificativa,
        urgentissimo,
        correcaoAutomatica,
        textoCorrecao,
        alteracoes: {
          descricao_prioridade: descricao,
          evento_folha: eventoFolha,
          categoria: categoria || undefined,
          observacao_adicional_gestor: obsGestor || undefined,
          upj_id: upjDestino || undefined,
        },
      });
      if (!r.sucesso) {
        setErro(r.erro ?? 'Não foi possível concluir a conferência.');
        return;
      }
      await onConcluir(
        decisao === 'aprovar'
          ? `Anotação n.º ${a.id} aprovada e enviada à UPJ.`
          : decisao === 'devolver'
            ? `Anotação n.º ${a.id} devolvida ao Atendente, com prazo de 24 h.`
            : `Anotação n.º ${a.id} reprovada e arquivada.`
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="pu2-secao">
      <h3 className="pu2-secao-rotulo">Conferir antes de enviar</h3>
      <div className="pu2-bloco pu2-bloco-formulario">
        <fieldset className="pu2-campo" style={{ border: 0, padding: 0, margin: '0 0 18px' }}>
          <legend className="pu2-rotulo">
            Categoria da Anotação <span className="obrigatorio">*</span>
          </legend>
          <div className="pu2-categorias">
            {CATEGORIAS_ANOTACAO.map((c) => {
              const marcada = categoria === c.codigo;
              return (
                <label key={c.codigo} className={`pu2-categoria${marcada ? ' marcada' : ''}`} title={c.dica}>
                  <input type="radio" name="pu2-conf-cat" checked={marcada} onChange={() => setCategoria(c.codigo)} />
                  <Icone className="radio" nome={marcada ? 'radio-on' : 'radio-off'} tamanho={20} />
                  <Icone className="icone-cat" nome={ICONE_CATEGORIA[c.codigo]} tamanho={22} />
                  <span>{c.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="pu2-campo">
          <label htmlFor="pu2-conf-upj" className="pu2-rotulo">
            UPJ de destino <span className="obrigatorio">*</span>
          </label>
          <select id="pu2-conf-upj" className="pu2-selecao" value={upjDestino} onChange={(e) => setUpjDestino(e.target.value)}>
            <option value="">Selecione…</option>
            {upjs.map((u) => (
              <option key={u.id} value={u.id}>
                {upjCurta(u)} {faixaVaras(u) ? `(${faixaVaras(u)})` : ''}
              </option>
            ))}
          </select>
          {a.nome_orgao_djen && <p className="pu2-ajuda">Órgão publicado no Diário Eletrônico: {a.nome_orgao_djen}</p>}
        </div>
        <div className="pu2-campo">
          <label htmlFor="pu2-conf-evento" className="pu2-rotulo">
            Evento(s) ou Folha(s)
          </label>
          <input id="pu2-conf-evento" className="pu2-entrada" value={eventoFolha} onChange={(e) => setEventoFolha(e.target.value)} />
        </div>
        <div className="pu2-campo">
          <label htmlFor="pu2-conf-descricao" className="pu2-rotulo">
            Descrição Detalhada
          </label>
          <textarea id="pu2-conf-descricao" className="pu2-area" rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          {descricao !== a.descricao_prioridade && (
            <p className="pu2-ajuda">O texto original fica guardado no histórico da anotação.</p>
          )}
        </div>
        <div className="pu2-campo" style={{ marginBottom: 0 }}>
          <label htmlFor="pu2-conf-obs" className="pu2-rotulo">
            Motivo da correção <span className="nota">(opcional)</span>
          </label>
          <textarea id="pu2-conf-obs" className="pu2-area" rows={2} value={obsGestor} onChange={(e) => setObsGestor(e.target.value)} />
        </div>
      </div>

      <Opcoes<D>
        legenda="Decisão do Gestor"
        valor={decisao}
        onChange={(v) => {
          setDecisao(v);
          setErro(null);
        }}
        opcoes={[
          { valor: 'aprovar', rotulo: 'Aprovar', icone: 'aprovadas' },
          { valor: 'devolver', rotulo: 'Devolver', icone: 'devolvidas' },
          { valor: 'rejeitar', rotulo: 'Reprovar', icone: 'reprovadas' },
        ]}
      />

      {decisao === 'aprovar' && (
        <label className="pu2-marcacao pu2-marcacao-urgente">
          <input type="checkbox" checked={urgentissimo} onChange={(e) => setUrgentissimo(e.target.checked)} />
          <Icone nome="urgentissimas" tamanho={18} />
          Marcar como Urgentíssima (aparece em destaque para a UPJ)
        </label>
      )}

      {decisao !== 'aprovar' && (
        <div className="pu2-campo">
          <label htmlFor="pu2-conf-just" className="pu2-rotulo">
            Justificativa <span className="obrigatorio">*</span>
            <span className="nota">({decisao === 'devolver' ? 'o Atendente verá este texto' : 'registrada na anotação'})</span>
          </label>
          <textarea id="pu2-conf-just" className="pu2-area" rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
        </div>
      )}

      {decisao === 'devolver' && (
        <div className="pu2-campo">
          <label className="pu2-marcacao">
            <input type="checkbox" checked={correcaoAutomatica} onChange={(e) => setCorrecaoAutomatica(e.target.checked)} />
            Incluir correção automática
          </label>
          {correcaoAutomatica && (
            <>
              <textarea
                className="pu2-area"
                rows={3}
                aria-label="Texto da correção automática"
                value={textoCorrecao}
                onChange={(e) => setTextoCorrecao(e.target.value)}
                placeholder="Texto que substituirá a Descrição Detalhada"
              />
              <p className="pu2-ajuda">
                Se o Atendente não responder em 24 h, este texto substitui a descrição e a anotação segue para a UPJ, em vez de ser
                reprovada. O Atendente não vê a correção antes disso.
              </p>
            </>
          )}
        </div>
      )}

      {erro && (
        <div className="pu2-caixa pu2-caixa-erro" role="alert">
          {erro}
        </div>
      )}
      <div className="pu2-acoes">
        <button type="button" className="pu2-botao pu2-botao-secundario" onClick={onVoltar}>
          Cancelar
        </button>
        <button type="button" className="pu2-botao pu2-botao-primario" onClick={() => void enviar()} disabled={enviando}>
          {enviando ? 'Registrando…' : decisao === 'aprovar' ? 'Enviar à UPJ' : decisao === 'devolver' ? 'Devolver' : 'Reprovar'}
        </button>
      </div>
    </section>
  );
};

const MSG_ACEITE_REPROVACAO =
  'Os motivos da reprovação foram compreendidos e serão utilizados para melhor triagem na inclusão de anotações no futuro. Aceito a reprovação da anotação, por não se considerar possível sua regularização no caso em questão.';
const MSG_ACEITE_REJEICAO =
  'Os motivos do retorno foram entendidos e serão utilizados para melhor triagem de anotações no futuro. Aceito a rejeição da anotação, por não se considerar possível sua regularização no caso em questão.';

const PainelResposta: React.FC<{ a: AnotacaoPrioridade; onConcluir: Props['onConcluir']; onVoltar: () => void }> = ({ a, onConcluir, onVoltar }) => {
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState(false);
  const { prazo } = usePrazo(a.prazo_resposta_em);

  const enviar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const r = await responderDevolucao(a.id, resposta);
      if (!r.sucesso) {
        setErro(r.erro ?? 'Não foi possível enviar a resposta.');
        return;
      }
      await onConcluir(`Resposta enviada. A anotação n.º ${a.id} voltou para a conferência do Gestor.`);
    } finally {
      setEnviando(false);
    }
  };

  const aceitar = async () => {
    setEnviando(true);
    try {
      const r = await aceitarReprovacao(a.id);
      if (!r.sucesso) {
        setErro(r.erro ?? 'Não foi possível registrar a aceitação.');
        setDialogo(false);
        return;
      }
      await onConcluir(`Reprovação aceita. A anotação n.º ${a.id} foi arquivada como Reprovada.`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="pu2-secao">
      <div className="pu2-campo">
        <label htmlFor="pu2-resposta" className="pu2-rotulo">
          Sua resposta ao Gestor <span className="obrigatorio">*</span>
        </label>
        <textarea
          id="pu2-resposta"
          className="pu2-area"
          rows={4}
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          disabled={prazo.expirado}
          placeholder="Explique o que foi verificado ou corrigido"
        />
      </div>
      {erro && (
        <div className="pu2-caixa pu2-caixa-erro" role="alert">
          {erro}
        </div>
      )}
      <div className="pu2-acoes">
        <button type="button" className="pu2-botao pu2-botao-link" onClick={onVoltar}>
          Voltar
        </button>
        <button type="button" className="pu2-botao pu2-botao-secundario" onClick={() => setDialogo(true)} disabled={prazo.expirado}>
          Aceitar a reprovação
        </button>
        <button
          type="button"
          className="pu2-botao pu2-botao-primario"
          onClick={() => void enviar()}
          disabled={enviando || prazo.expirado || !resposta.trim()}
        >
          {enviando ? 'Enviando…' : 'Enviar resposta'}
        </button>
      </div>
      {dialogo && (
        <Dialogo
          titulo="Aceitar a reprovação"
          texto={MSG_ACEITE_REPROVACAO}
          confirmar="Aceitar"
          ocupado={enviando}
          onConfirmar={() => void aceitar()}
          onCancelar={() => setDialogo(false)}
        />
      )}
    </section>
  );
};

const PainelCorrecao: React.FC<{ a: AnotacaoPrioridade; onConcluir: Props['onConcluir']; onVoltar: () => void }> = ({ a, onConcluir, onVoltar }) => {
  const [descricao, setDescricao] = useState(a.descricao_prioridade);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState(false);

  const enviar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const r = await corrigirRetornada(a.id, descricao);
      if (!r.sucesso) {
        setErro(r.erro ?? 'Não foi possível reenviar a anotação.');
        return;
      }
      await onConcluir(`Anotação n.º ${a.id} corrigida e reenviada à UPJ como Nova.`);
    } finally {
      setEnviando(false);
    }
  };

  const aceitar = async () => {
    setEnviando(true);
    try {
      const r = await aceitarRejeicaoRetorno(a.id);
      if (!r.sucesso) {
        setErro(r.erro ?? 'Não foi possível registrar a aceitação.');
        setDialogo(false);
        return;
      }
      await onConcluir(`Rejeição aceita. A anotação n.º ${a.id} foi arquivada como Rejeitada.`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="pu2-secao">
      <div className="pu2-campo">
        <label htmlFor="pu2-correcao" className="pu2-rotulo">
          Descrição Detalhada corrigida <span className="obrigatorio">*</span>
        </label>
        <textarea id="pu2-correcao" className="pu2-area" rows={5} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        {a.rejeicao_automatica && (
          <p className="pu2-ajuda">A UPJ marcou rejeição automática: se o prazo vencer sem correção, a anotação é rejeitada.</p>
        )}
      </div>
      {erro && (
        <div className="pu2-caixa pu2-caixa-erro" role="alert">
          {erro}
        </div>
      )}
      <div className="pu2-acoes">
        <button type="button" className="pu2-botao pu2-botao-link" onClick={onVoltar}>
          Voltar
        </button>
        <button type="button" className="pu2-botao pu2-botao-secundario" onClick={() => setDialogo(true)}>
          Aceitar a rejeição
        </button>
        <button type="button" className="pu2-botao pu2-botao-primario" onClick={() => void enviar()} disabled={enviando || !descricao.trim()}>
          {enviando ? 'Reenviando…' : 'Reenviar à UPJ'}
        </button>
      </div>
      {dialogo && (
        <Dialogo
          titulo="Aceitar a rejeição"
          texto={MSG_ACEITE_REJEICAO}
          confirmar="Aceitar"
          ocupado={enviando}
          onConfirmar={() => void aceitar()}
          onCancelar={() => setDialogo(false)}
        />
      )}
    </section>
  );
};

const Historico: React.FC<{ id: number }> = ({ id }) => {
  const [itens, setItens] = useState<HistoricoAnotacao[] | null>(null);
  useEffect(() => {
    let ativo = true;
    void listarHistorico(id).then((h) => {
      if (ativo) setItens(h);
    });
    return () => {
      ativo = false;
    };
  }, [id]);
  if (!itens || itens.length === 0) return null;
  return (
    <details className="pu2-historico">
      <summary>
        <Icone nome="historico" tamanho={18} />
        Histórico da anotação ({itens.length})
      </summary>
      <ol>
        {itens.map((h) => (
          <li key={h.id}>
            <div>
              <strong>{h.status_anterior ? `${STATUS_LABEL[h.status_anterior]} → ` : ''}{STATUS_LABEL[h.status_novo]}</strong>
              {' · '}
              {h.autor_nome ?? 'sistema'} · {formatarDataHora(h.criado_em)}
            </div>
            {h.conteudo && <p>{h.conteudo}</p>}
          </li>
        ))}
      </ol>
    </details>
  );
};

/* ── Tela ──────────────────────────────────────────────────────────── */

export const DetalheAnotacaoV2: React.FC<Props> = ({
  anotacao: a,
  modo,
  upjs,
  perfilEfetivo,
  rotuloTipo,
  rotuloSolicitante,
  onConcluir,
  onVoltar,
}) => {
  const [copiado, setCopiado] = useState(false);
  const upj = a.upj_id ? upjs.find((u) => u.id === a.upj_id) ?? null : null;
  const visaoUpj = ehPerfilUpj(perfilEfetivo);
  const cat = a.categoria as CategoriaAnotacao | null;
  const numero = formatarProcessoCnj(a.processo);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(numero);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* navegador sem permissão de área de transferência */
    }
  };

  const solicitante = [
    rotuloSolicitante(a.tipo_solicitante),
    a.descricao_solicitante ? `(${a.descricao_solicitante})` : '',
    a.nome_solicitante ? `· ${a.nome_solicitante}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <div className="pu2-titulo-tela">
        <h2 className="pu2-titulo-anotacao">
          Anotação n.º <span className="vermelho">{a.id}</span>
          <span className="pu2-titulo-etiquetas">
            <EtiquetaStatus status={a.status} />
            {ehUrgentissima(a) && <EtiquetaUrgentissima />}
            {a.reiterada && <EtiquetaReiterada />}
          </span>
        </h2>
        <button type="button" className="pu2-botao pu2-botao-link" onClick={onVoltar}>
          <Icone nome="voltar" tamanho={14} />
          Voltar
        </button>
      </div>

      {modo === 'resposta' && (
        <CaixaPrazo
          iso={a.prazo_resposta_em}
          titulo="Anotação devolvida pelo Gestor"
          justificativa={a.devolvida_por === 'upj' ? a.justificativa_devolucao_upj : a.justificativa_devolucao_gestor}
        />
      )}
      {modo === 'correcao' && (
        <CaixaPrazo iso={a.prazo_resposta_em} titulo="Anotação retornada pela UPJ" justificativa={a.justificativa_devolucao_upj} />
      )}

      <Bloco titulo="Processo">
        {/* UPJ, Vara e Plataforma sempre na mesma linha (cabem em qualquer tela usada no TJSP). */}
        <div className="pu2-grade linha-fixa">
          <Dado rotulo="Número" largo>
            <span className="pu2-numero-processo">
              {numero}
              <button type="button" className="pu2-copiar" onClick={() => void copiar()} title="Copiar o número" aria-label="Copiar o número do processo">
                <Icone nome="copiar" tamanho={18} />
              </button>
              {copiado && <span className="pu2-copiado">copiado!</span>}
            </span>
          </Dado>
          <Dado rotulo="UPJ">{upj ? upjCurta(upj) : 'Não definida'}</Dado>
          <Dado rotulo="Vara">{a.vara ? `${varaOrdinal(a.vara)} Vara Cível` : 'Não identificada'}</Dado>
          <Dado rotulo="Plataforma">
            {a.plataforma ? (
              <LogoPlataforma className="pu2-logo-plataforma" plataforma={a.plataforma} />
            ) : (
              'Não informada'
            )}
          </Dado>
        </div>
      </Bloco>

      <Bloco titulo="Anotação">
        <div className="pu2-grade quatro">
          <Dado rotulo="Anotado por">{a.criador_nome}</Dado>
          <Dado rotulo="Data da Anotação">{formatarDataHora(a.data_anotacao)}</Dado>
          {/* O servidor grava conferido_por_id, mas não o nome (pendência da etapa 2):
              quando quem conferiu é o próprio vinculado, o nome vem do vínculo. */}
          <Dado rotulo="Conferido por">
            {a.conferido_por_nome ??
              (a.conferido_por_id && a.conferido_por_id === a.conferente_vinculado_id ? a.conferente_vinculado_nome : null) ??
              (a.status === 'gestor-conferencia' ? 'Aguardando' : '—')}
          </Dado>
          <Dado rotulo="Data da Conferência">{a.data_remessa_upj ? formatarDataHora(a.data_remessa_upj) : '—'}</Dado>
        </div>
      </Bloco>

      <Bloco titulo="Prioridade ou Urgência">
        {/* Um item por linha, centralizados (maquete 005). */}
        <div className="pu2-grade">
          <Dado rotulo="Categoria" largo>
            {cat ? (
              <span className="pu2-com-icone">
                <Icone nome={ICONE_CATEGORIA[cat]} tamanho={22} />
                {rotuloCategoria(cat)}
              </span>
            ) : (
              '—'
            )}
          </Dado>
          <Dado rotulo="Tipo" largo>
            {rotuloTipo(a.tipo_prioridade)}
            {a.descricao_tipo_outros ? `: ${a.descricao_tipo_outros}` : ''}
          </Dado>
          <Dado rotulo="Evento(s) ou Folha(s)" largo>
            {a.evento_folha}
          </Dado>
          <Dado rotulo="Solicitante" largo>
            {solicitante}
          </Dado>
        </div>
      </Bloco>

      <Bloco titulo="Descrição">
        <Dado rotulo="Detalhada" largo>
          <span className="pu2-texto-longo">{a.descricao_prioridade}</span>
        </Dado>
      </Bloco>

      {/* Observação interna do TJSP Atende: nunca é mostrada à UPJ (RF-GER-02). */}
      {!visaoUpj && (a.observacao_adicional_atende || a.observacao_adicional_gestor) && (
        <Bloco titulo="Observações internas do TJSP Atende" destaque="aviso">
          {a.observacao_adicional_atende && (
            <Dado rotulo="Do Atendente" largo>
              <span className="pu2-texto-longo">{a.observacao_adicional_atende}</span>
            </Dado>
          )}
          {a.observacao_adicional_gestor && (
            <Dado rotulo="Do Gestor" largo>
              <span className="pu2-texto-longo">{a.observacao_adicional_gestor}</span>
            </Dado>
          )}
        </Bloco>
      )}

      {(a.resposta_atendente || a.justificativa_devolucao_gestor || a.justificativa_rejeicao_gestor || a.justificativa_devolucao_upj || a.justificativa_rejeicao_upj || a.observacao_adicional_upj) &&
        modo !== 'resposta' &&
        modo !== 'correcao' && (
          <Bloco titulo="Respostas e justificativas">
            {a.justificativa_devolucao_gestor && !visaoUpj && (
              <Dado rotulo="Devolução do Gestor" largo>
                <span className="pu2-texto-longo">{a.justificativa_devolucao_gestor}</span>
              </Dado>
            )}
            {a.resposta_atendente && (
              <Dado rotulo="Resposta do Atendente" largo>
                <span className="pu2-texto-longo">{a.resposta_atendente}</span>
              </Dado>
            )}
            {a.justificativa_rejeicao_gestor && !visaoUpj && (
              <Dado rotulo="Motivo da reprovação" largo>
                <span className="pu2-texto-longo">{a.justificativa_rejeicao_gestor}</span>
              </Dado>
            )}
            {a.justificativa_devolucao_upj && (
              <Dado rotulo="Retorno da UPJ" largo>
                <span className="pu2-texto-longo">{a.justificativa_devolucao_upj}</span>
              </Dado>
            )}
            {a.justificativa_rejeicao_upj && (
              <Dado rotulo="Rejeição da UPJ" largo>
                <span className="pu2-texto-longo">{a.justificativa_rejeicao_upj}</span>
              </Dado>
            )}
            {a.observacao_adicional_upj && (
              <Dado rotulo="Observação da UPJ" largo>
                <span className="pu2-texto-longo">{a.observacao_adicional_upj}</span>
              </Dado>
            )}
          </Bloco>
        )}

      {modo === 'analise' && <PainelUpj a={a} onConcluir={onConcluir} onVoltar={onVoltar} />}
      {modo === 'conferencia' && <PainelConferencia a={a} upjs={upjs} onConcluir={onConcluir} onVoltar={onVoltar} />}
      {modo === 'resposta' && <PainelResposta a={a} onConcluir={onConcluir} onVoltar={onVoltar} />}
      {modo === 'correcao' && <PainelCorrecao a={a} onConcluir={onConcluir} onVoltar={onVoltar} />}

      {/* O histórico registra textos internos (devoluções do Gestor, correções): fica só com o TJSP Atende. */}
      {!visaoUpj && <Historico id={a.id} />}
    </div>
  );
};

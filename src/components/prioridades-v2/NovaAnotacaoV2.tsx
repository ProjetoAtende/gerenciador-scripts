/**
 * Nova Anotação — visual da v2 (maquete 002), com as regras da etapa 2:
 *
 *  A  Localização pela Edge Function `prioridades-localizar` (DJEN na hora; Datajud em
 *     segundo plano, só quando a Vara é desconhecida). A Vara e o Sistema se completam
 *     sozinhos quando o Datajud responde; se a anotação já tiver sido enviada, o
 *     servidor completa depois (sem apagar o que alguém informou).
 *     A competência é decidida pelo órgão onde o processo está HOJE, não pelo final
 *     do número.
 *  C  Fora da competência, só o Gestor envia, com justificativa.
 *  D  O Gestor pode marcar Urgentíssima ao criar.
 *  E  Anotações dos últimos 120 dias com a resposta da UPJ em destaque e botão Copiar.
 *  F  Regras especiais por UPJ + Categoria + Tipo.
 *  G  Descrição Resumida, opcional (até 100 caracteres).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PerfilUsuarioPrioridades, TipoPrioridade, TipoSolicitante, Upj } from '../../types/Prioridades';
import { complementarProcesso, formatarProcessoCnj, processoCompleto, somenteDigitos } from '../../services/prioridadesDjenService';
import { inferirSistemaPorCnj } from '../../services/prioridadesSistemaCnj';
import { listarTiposPrioridade, listarTiposSolicitante, listarUpjs } from '../../services/prioridadesService';
import type { CatalogoItem } from '../../services/prioridadesService';
import {
  completarLocalizacaoDepois,
  criarAnotacaoV2,
  listarAnterioresV2,
  listarRegrasV2,
  localizarProcesso,
  regrasAplicaveis,
  respostasDaAnterior,
  type AnotacaoAnteriorV2,
  type NovaAnotacaoPayloadV2,
  type RegraEspecialV2,
  type ResultadoLocalizacao,
} from '../../services/prioridadesV2Service';
import { StatusBadge } from '../prioridades/PrioridadesUi';
import { AnotacaoConsultaModal } from '../prioridades/AnotacaoConsultaModal';
import { CATEGORIAS_ANOTACAO } from '../prioridades/prioridadesCategorias';
import { Icone } from './Icone';
import { ICONE_CATEGORIA, faixaVaras, upjCurta, varaOrdinal, varasDaUpjV2 } from './prioridadesV2Rotulos';
import { LogoPlataforma } from './LogoPlataforma';

interface Props {
  perfil: PerfilUsuarioPrioridades | null;
  onCriada: (mensagem: string) => void;
  onVoltar: () => void;
}

const LIMITE_RESUMIDA = 100;

const ESTADO_INICIAL: NovaAnotacaoPayloadV2 = {
  processo: '',
  vara: null,
  vara_fonte: null,
  upj_id: null,
  plataforma: null,
  validacao_djen_status: 'nao_consultado',
  validacao_djen_em: null,
  validacao_djen_detalhe: null,
  id_orgao_djen: null,
  nome_orgao_djen: null,
  tipo_solicitante: '',
  descricao_solicitante: '',
  nome_solicitante: '',
  categoria: '',
  tipo_prioridade: '',
  descricao_tipo_outros: '',
  evento_folha: '',
  descricao_prioridade: '',
  descricao_resumida: '',
  observacao_adicional_atende: '',
};

const Obrigatorio = () => (
  <span className="obrigatorio" aria-hidden>
    *
  </span>
);

const STATUS_DJEN: Record<string, NovaAnotacaoPayloadV2['validacao_djen_status']> = {
  ok: 'localizado',
  vazio: 'sem_comunicacao',
};

/** Resposta da UPJ de uma anotação anterior, com botão Copiar (item E). */
const RespostaAnterior: React.FC<{ rotulo: string; texto: string }> = ({ rotulo, texto }) => {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* navegador sem permissão de área de transferência */
    }
  };
  return (
    <div className="pu2-resposta-anterior">
      <div className="pu2-resposta-anterior-rotulo">
        {rotulo}
        <button type="button" className="pu2-copiar" onClick={() => void copiar()} title="Copiar o texto" aria-label={`Copiar: ${rotulo}`}>
          <Icone nome="copiar" tamanho={16} />
        </button>
        {copiado && <span className="pu2-copiado">copiado!</span>}
      </div>
      <p className="pu2-texto-longo">{texto}</p>
    </div>
  );
};

export const NovaAnotacaoV2: React.FC<Props> = ({ perfil, onCriada, onVoltar }) => {
  const souGestor = perfil?.perfil === 'gestor';

  const [form, setForm] = useState<NovaAnotacaoPayloadV2>(ESTADO_INICIAL);
  const [tiposSolicitante, setTiposSolicitante] = useState<CatalogoItem[]>([]);
  const [tiposPrioridade, setTiposPrioridade] = useState<CatalogoItem[]>([]);
  const [upjs, setUpjs] = useState<Upj[]>([]);

  const [consultando, setConsultando] = useState(false);
  const [localizacao, setLocalizacao] = useState<ResultadoLocalizacao | null>(null);
  const [falhaLocalizacao, setFalhaLocalizacao] = useState<string | null>(null);
  const [datajudPendente, setDatajudPendente] = useState(false);
  const [avisoDatajud, setAvisoDatajud] = useState<string | null>(null);

  const [excecaoAberta, setExcecaoAberta] = useState(false);
  const [excecaoTexto, setExcecaoTexto] = useState('');
  const [urgentissimo, setUrgentissimo] = useState(false);

  const [anteriores, setAnteriores] = useState<AnotacaoAnteriorV2[]>([]);
  const [consultaAnteriorId, setConsultaAnteriorId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState<string[]>([]);
  const [incluirNomeSolicitante, setIncluirNomeSolicitante] = useState(false);
  const [regras, setRegras] = useState<RegraEspecialV2[]>([]);
  const [regraModal, setRegraModal] = useState<string[] | null>(null);

  const ultimaConsulta = useRef<string>('');
  /** Cada consulta ganha um número; respostas de consultas antigas são descartadas. */
  const consultaAtual = useRef(0);
  /** O Atendente escolheu a Vara: o Datajud não a substitui. */
  const varaEscolhida = useRef(false);
  const upjsRef = useRef<Upj[]>([]);
  const topoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [ts, tp, us, rs] = await Promise.all([listarTiposSolicitante(), listarTiposPrioridade(), listarUpjs(), listarRegrasV2()]);
      setTiposSolicitante(ts);
      setTiposPrioridade(tp);
      setUpjs(us);
      upjsRef.current = us;
      setRegras(rs);
    })();
  }, []);

  const atualizar = useCallback(<K extends keyof NovaAnotacaoPayloadV2>(campo: K, valor: NovaAnotacaoPayloadV2[K]) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  const tipoPrioridadeSelecionado = useMemo(
    () => tiposPrioridade.find((t) => t.codigo === form.tipo_prioridade) ?? null,
    [tiposPrioridade, form.tipo_prioridade]
  );

  const digitosAtuais = somenteDigitos(form.processo).length;
  const podeVerificar = digitosAtuais === 20 || digitosAtuais === 13;
  const precisaComplementar = digitosAtuais === 13;
  const consultaConcluida = localizacao !== null || falhaLocalizacao !== null;

  // Competência: pelo órgão atual; se a localização falhou, pelo final do número.
  const situacao: 'dentro' | 'fora' | 'indeterminado' | null = localizacao
    ? localizacao.escopo.situacao
    : falhaLocalizacao
      ? somenteDigitos(form.processo).endsWith('0100')
        ? 'indeterminado'
        : 'fora'
      : null;
  const foraCompetencia = situacao === 'fora';
  const liberado = consultaConcluida && (!foraCompetencia || (souGestor && excecaoAberta));

  const mostrarSolicitante = liberado;
  const mostrarCategoria = mostrarSolicitante && form.tipo_solicitante !== '';
  const mostrarTipo = mostrarCategoria && form.categoria !== '';
  const mostrarRestante = mostrarTipo && form.tipo_prioridade !== '';

  const upjDoForm = form.upj_id ? upjs.find((u) => u.id === form.upj_id) ?? null : null;
  const upjAutomatica = Boolean(localizacao?.upj && upjDoForm && upjDoForm.codigo === localizacao.upj.codigo && !excecaoAberta);
  const plataforma = form.plataforma ?? null;
  const varaDasFontes = form.vara !== null && (form.vara_fonte === 'datajud' || form.vara_fonte === 'djen');
  const opcoesVara = varasDaUpjV2(upjDoForm);

  const abrirRegra = useCallback(
    (upj: string | null, tipo: string, categoria: string) => {
      const aplicaveis = regrasAplicaveis(regras, upj, tipo, categoria);
      setRegraModal(aplicaveis.length > 0 ? aplicaveis.map((r) => r.texto) : null);
    },
    [regras]
  );

  const upjIdDoResultado = (r: ResultadoLocalizacao, lista: Upj[]) =>
    r.upj ? lista.find((u) => u.codigo === r.upj?.codigo)?.id ?? null : null;

  /** A: localiza (DJEN) e, se a Vara ficou em aberto, consulta o Datajud em segundo plano. */
  const consultar = useCallback(async (numeroDigitado: string) => {
    const { numero, complementado } = complementarProcesso(numeroDigitado);
    const digitos = somenteDigitos(numeroDigitado).length;
    if (digitos !== 20 && digitos !== 13) return;
    if (ultimaConsulta.current === numero) return;
    ultimaConsulta.current = numero;

    const id = ++consultaAtual.current;
    varaEscolhida.current = false;
    setConsultando(true);
    setErroGeral(null);
    setFalhaLocalizacao(null);
    setLocalizacao(null);
    setAvisoDatajud(null);
    setDatajudPendente(false);
    setExcecaoAberta(false);

    try {
      const lista = upjsRef.current.length > 0 ? upjsRef.current : await listarUpjs();
      const [loc, ant] = await Promise.all([localizarProcesso(numero, 'rapido'), listarAnterioresV2(numero)]);
      if (id !== consultaAtual.current) return;
      setAnteriores(ant);

      const detalheComplemento = complementado ? 'Número complementado automaticamente com o final 8.26.0100.' : null;

      if (!loc.ok) {
        setFalhaLocalizacao(loc.erro);
        setForm((prev) => ({
          ...prev,
          processo: numero,
          vara: null,
          vara_fonte: null,
          upj_id: null,
          plataforma: inferirSistemaPorCnj(numero).plataforma,
          validacao_djen_status: 'erro',
          validacao_djen_em: new Date().toISOString(),
          validacao_djen_detalhe: detalheComplemento ?? loc.erro,
          id_orgao_djen: null,
          nome_orgao_djen: null,
        }));
        return;
      }

      const r = loc.resultado;
      setLocalizacao(r);
      setForm((prev) => ({
        ...prev,
        processo: numero,
        vara: r.vara,
        vara_fonte: r.vara !== null ? r.varaFonte : null,
        upj_id: upjIdDoResultado(r, lista),
        plataforma: r.sistema.valor ?? inferirSistemaPorCnj(numero).plataforma,
        validacao_djen_status: STATUS_DJEN[r.fontes.djen.status] ?? 'erro',
        validacao_djen_em: new Date().toISOString(),
        validacao_djen_detalhe: detalheComplemento ?? r.fontes.djen.erro,
        id_orgao_djen: r.idOrgaoDjen,
        nome_orgao_djen: r.orgao?.original ?? null,
      }));

      if (r.vara === null && r.escopo.situacao !== 'fora') {
        setDatajudPendente(true);
        void localizarProcesso(numero, 'completo').then((res) => {
          if (id !== consultaAtual.current) return;
          setDatajudPendente(false);
          if (!res.ok) return;
          const r2 = res.resultado;
          setLocalizacao(r2);
          setForm((prev) => {
            const novo = { ...prev };
            if (r2.vara !== null && prev.vara === null && !varaEscolhida.current) {
              novo.vara = r2.vara;
              novo.vara_fonte = r2.varaFonte;
              novo.upj_id = prev.upj_id ?? upjIdDoResultado(r2, upjsRef.current);
            }
            if (!prev.plataforma && r2.sistema.valor) novo.plataforma = r2.sistema.valor;
            return novo;
          });
          if (r2.vara !== null && !varaEscolhida.current) {
            setAvisoDatajud(`Vara identificada pelo Datajud: ${r2.vara}.ª Vara Cível.`);
          }
        });
      }
    } finally {
      if (id === consultaAtual.current) setConsultando(false);
    }
  }, []);

  const processoExibicao = useMemo(() => formatarProcessoCnj(form.processo), [form.processo]);

  const handleProcessoChange = (valorDigitado: string) => {
    const formatado = formatarProcessoCnj(valorDigitado);
    const digitos = somenteDigitos(formatado).length;
    setPendentes((p) => p.filter((c) => !c.startsWith('N.º do Processo')));

    // Qualquer mudança no número invalida o que foi apurado para o anterior.
    ultimaConsulta.current = '';
    consultaAtual.current += 1;
    setLocalizacao(null);
    setFalhaLocalizacao(null);
    setDatajudPendente(false);
    setAvisoDatajud(null);
    setExcecaoAberta(false);
    setAnteriores([]);
    setErroGeral(null);
    setForm((prev) => ({
      ...prev,
      processo: formatado,
      upj_id: null,
      vara: null,
      vara_fonte: null,
      id_orgao_djen: null,
      nome_orgao_djen: null,
      plataforma: null,
      validacao_djen_status: 'nao_consultado',
      validacao_djen_em: null,
      validacao_djen_detalhe: null,
    }));

    if (digitos === 20) void consultar(formatado);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroGeral(null);

    if (!liberado) {
      setErroGeral('Localize o processo antes de enviar.');
      topoRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const faltando: string[] = [];
    if (!processoCompleto(form.processo)) faltando.push('N.º do Processo');
    if (excecaoAberta && !excecaoTexto.trim()) faltando.push('Justificativa para enviar fora da competência');
    if (excecaoAberta && !form.upj_id) faltando.push('UPJ de destino');
    if (!form.tipo_solicitante) faltando.push('Solicitante');
    if (form.tipo_solicitante === 'outros' && !form.descricao_solicitante.trim()) faltando.push('Descrição do(s) Solicitante');
    if (!form.categoria) faltando.push('Categoria da Anotação');
    if (!form.tipo_prioridade) faltando.push('Tipo da Prioridade ou Urgência');
    if (form.tipo_prioridade === 'outros' && !form.descricao_tipo_outros.trim()) faltando.push('Descrição do Tipo (Outros)');
    if (!form.evento_folha.trim()) faltando.push('Evento(s) ou Folha(s)');
    if (!form.descricao_prioridade.trim()) faltando.push('Descrição Detalhada');
    if (faltando.length > 0) {
      setPendentes(faltando);
      topoRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setSalvando(true);
    try {
      const resposta = await criarAnotacaoV2({
        ...form,
        processo: somenteDigitos(form.processo),
        nome_solicitante: incluirNomeSolicitante ? form.nome_solicitante.trim() : '',
        descricao_resumida: form.descricao_resumida?.trim() ?? '',
        vara_fonte: form.vara === null ? null : varaEscolhida.current ? 'atendente' : form.vara_fonte ?? 'atendente',
        urgentissimo: souGestor && urgentissimo,
        competencia_excecao: excecaoAberta ? excecaoTexto.trim() : '',
      });

      if (!resposta.sucesso) {
        if (resposta.pode_excecao && souGestor) setExcecaoAberta(true);
        setErroGeral(resposta.erro ?? 'Não foi possível registrar a anotação.');
        if (resposta.campos_pendentes) setPendentes(resposta.campos_pendentes);
        topoRef.current?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      // Vara ainda em aberto e o Datajud não terminou (ou a consulta falhou): o servidor completa depois.
      const completarDepois =
        resposta.anotacao_id !== undefined && form.vara === null && (datajudPendente || falhaLocalizacao !== null);
      if (completarDepois && resposta.anotacao_id !== undefined) completarLocalizacaoDepois(resposta.anotacao_id);

      const destino =
        resposta.status === 'upj-pendente'
          ? 'remetida diretamente à UPJ (como Gestor, você dispensa a conferência)'
          : 'enviada para conferência do Gestor';
      onCriada(
        `Anotação n.º ${resposta.anotacao_id} registrada e ${destino}.` +
          (completarDepois ? ' A Vara será completada sozinha quando o Datajud responder.' : '')
      );
    } finally {
      setSalvando(false);
    }
  };

  const notaEnvio = souGestor
    ? 'Como Gestor(a), o envio vai direto à UPJ.'
    : perfil?.perfil === 'conferente'
      ? 'Como Conferente, a anotação também passa pela conferência.'
      : 'A anotação será enviada para conferência do Gestor.';

  const avisosLocalizacao = (localizacao?.avisos ?? []).filter((a) => !/Datajud não respondeu/.test(a.texto));

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div ref={topoRef} className="pu2-titulo-tela">
        <h2>
          <Icone nome="nova" tamanho="0.9em" />
          Nova Anotação
        </h2>
        <button type="button" className="pu2-botao pu2-botao-link" onClick={onVoltar}>
          <Icone nome="voltar" tamanho={14} />
          Voltar
        </button>
      </div>

      {pendentes.length > 0 && (
        <div className="pu2-caixa pu2-caixa-erro" role="alert">
          <div className="pu2-caixa-titulo">
            <Icone nome="alerta" tamanho={20} />
            Falta preencher:
          </div>
          <ul>
            {pendentes.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Processo ───────────────────────────────────────────── */}
      <div className="pu2-campo">
        <label htmlFor="pu2-processo" className="pu2-rotulo">
          N.º do Processo <Obrigatorio />
        </label>
        <div className="pu2-linha-processo">
          <input
            id="pu2-processo"
            className="pu2-entrada"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={processoExibicao}
            onChange={(e) => handleProcessoChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void consultar(form.processo);
              }
            }}
            placeholder="Digite o número do processo"
          />
          <button
            type="button"
            className="pu2-botao pu2-botao-primario"
            onClick={() => void consultar(form.processo)}
            disabled={consultando || !podeVerificar}
          >
            {consultando ? 'Localizando…' : 'Localizar Processo'}
          </button>
        </div>
        <p className="pu2-ajuda">
          {precisaComplementar && !consultaConcluida
            ? 'Número até o ano: clique em Localizar Processo para completar com 8.26.0100.'
            : 'Pode digitar só até o ano (ex.: 1076547-84.2025): o final 8.26.0100 é completado sozinho.'}
        </p>
      </div>

      {/* ── Resultado da localização ───────────────────────────── */}
      {consultaConcluida && foraCompetencia && (
        <div className="pu2-caixa pu2-caixa-erro" role="alert">
          <div className="pu2-caixa-titulo">
            <Icone nome="alerta" tamanho={20} />
            Processo fora do atendimento do TJSP Atende
          </div>
          <p style={{ margin: 0 }}>
            {localizacao?.escopo.motivo ?? falhaLocalizacao ?? ''} O TJSP Atende cuida apenas da 1.ª à 45.ª Vara Cível do Foro
            Central de São Paulo.
          </p>
          {souGestor ? (
            excecaoAberta ? (
              <div className="pu2-campo" style={{ margin: '12px 0 0' }}>
                <label htmlFor="pu2-excecao" className="pu2-rotulo">
                  Por que enviar mesmo assim? <Obrigatorio />
                </label>
                <textarea
                  id="pu2-excecao"
                  className="pu2-area"
                  rows={2}
                  value={excecaoTexto}
                  onChange={(e) => setExcecaoTexto(e.target.value)}
                  placeholder="Ex.: redistribuído da Vara de Conflitos de Arbitragem para a 13.ª Vara Cível"
                />
                <p className="pu2-ajuda">A justificativa fica no histórico da anotação. Escolha a UPJ de destino mais abaixo.</p>
              </div>
            ) : (
              <button type="button" className="pu2-botao pu2-botao-secundario" style={{ marginTop: 12 }} onClick={() => setExcecaoAberta(true)}>
                Enviar mesmo assim (processo redistribuído)
              </button>
            )
          ) : (
            <p style={{ margin: '8px 0 0' }}>Se o processo foi redistribuído para cá, peça a um Gestor para registrar a anotação.</p>
          )}
        </div>
      )}

      {localizacao && !foraCompetencia && localizacao.orgao && (
        <div className="pu2-caixa pu2-caixa-sucesso pu2-caixa-centro" role="status">
          <div className="pu2-caixa-titulo">
            <Icone nome="check" tamanho={22} />
            Processo localizado!
          </div>
          <div className="pu2-processo-local">
            {varaOrdinal(form.vara) ? (
              <span>
                <strong>{varaOrdinal(form.vara)}</strong> Vara Cível ·
              </span>
            ) : (
              <span>{datajudPendente ? 'Vara: consultando o Datajud…' : 'Vara a confirmar'} ·</span>
            )}
            {upjDoForm ? (
              <span>
                <strong>{upjCurta(upjDoForm)}</strong> {faixaVaras(upjDoForm) && `(${faixaVaras(upjDoForm)})`}
              </span>
            ) : (
              <span>UPJ não identificada: escolha abaixo</span>
            )}
          </div>
          {plataforma && <LogoPlataforma className="pu2-processo-plataforma" plataforma={plataforma} />}
          {avisoDatajud && <p className="pu2-ajuda" style={{ marginTop: 8 }}>{avisoDatajud}</p>}
        </div>
      )}

      {consultaConcluida && !foraCompetencia && !localizacao?.orgao && (
        <div className="pu2-caixa pu2-caixa-aviso" role="status">
          <div className="pu2-caixa-titulo">
            <Icone nome="aviso" tamanho={20} />
            {falhaLocalizacao ? 'Consulta indisponível no momento' : datajudPendente ? 'Procurando o processo…' : 'Processo sem publicações'}
          </div>
          {falhaLocalizacao
            ? 'Não foi possível consultar o processo agora. Se o número estiver correto, você pode seguir com a anotação e escolher a UPJ abaixo.'
            : datajudPendente
              ? 'Não há publicações deste processo no Diário Eletrônico. O Datajud está sendo consultado em segundo plano: você já pode preencher a anotação e escolher a UPJ abaixo.'
              : 'Não há publicações deste processo no Diário Eletrônico nem dados no Datajud. Isso não quer dizer que ele não exista: confira o número e, se estiver correto, siga com a anotação escolhendo a UPJ abaixo.'}
        </div>
      )}

      {liberado && avisosLocalizacao.length > 0 && (
        <ul className="pu2-avisos-localizacao">
          {avisosLocalizacao.map((a) => (
            <li key={a.texto} className={a.nivel}>
              <Icone nome="info" tamanho={14} />
              {a.texto}
            </li>
          ))}
        </ul>
      )}

      {/* ── E: anotações anteriores com a resposta da UPJ ──────── */}
      {anteriores.length > 0 && (
        <div className="pu2-caixa pu2-caixa-aviso">
          <div className="pu2-caixa-titulo">
            <Icone nome="aviso" tamanho={20} />
            Este processo já tem {anteriores.length === 1 ? '1 anotação' : `${anteriores.length} anotações`} nos últimos 120 dias
          </div>
          <ul className="pu2-anteriores">
            {anteriores.map((a) => {
              const respostas = respostasDaAnterior(a);
              return (
                <li key={a.id} className="pu2-anterior">
                  <div className="pu2-anterior-cabeca">
                    <strong>n.º {a.id}</strong> · {new Date(a.data_anotacao).toLocaleDateString('pt-BR')} · <StatusBadge status={a.status} />
                    <button
                      type="button"
                      className="pu2-botao pu2-botao-link"
                      style={{ padding: 0, marginLeft: 'auto', color: 'var(--pu2-vermelho)' }}
                      onClick={() => setConsultaAnteriorId(a.id)}
                    >
                      Ver anotação
                    </button>
                  </div>
                  <div className="pu2-anterior-desc">{a.descricao_resumida || a.descricao_prioridade}</div>
                  {respostas.length > 0 ? (
                    respostas.map((r) => <RespostaAnterior key={r.rotulo} rotulo={r.rotulo} texto={r.texto} />)
                  ) : (
                    <div className="pu2-resposta-anterior vazia">Ainda sem resposta da UPJ.</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Solicitante ────────────────────────────────────────── */}
      {mostrarSolicitante && (
        <div className="pu2-campo">
          <label htmlFor="pu2-solicitante" className="pu2-rotulo">
            Solicitante <Obrigatorio />
          </label>
          <select
            id="pu2-solicitante"
            className="pu2-selecao"
            value={form.tipo_solicitante}
            onChange={(e) => atualizar('tipo_solicitante', e.target.value as TipoSolicitante)}
          >
            <option value="">Selecione…</option>
            {tiposSolicitante.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="pu2-marcacao">
            <input
              type="checkbox"
              checked={incluirNomeSolicitante}
              onChange={(e) => {
                setIncluirNomeSolicitante(e.target.checked);
                if (!e.target.checked) atualizar('nome_solicitante', '');
              }}
            />
            Incluir o nome do(s) Solicitante
          </label>
          {incluirNomeSolicitante && (
            <input
              className="pu2-entrada"
              type="text"
              aria-label="Nome do(s) Solicitante"
              value={form.nome_solicitante}
              onChange={(e) => atualizar('nome_solicitante', e.target.value)}
              placeholder="Nome do(s) solicitante(s)"
            />
          )}
        </div>
      )}

      {mostrarSolicitante && form.tipo_solicitante === 'outros' && (
        <div className="pu2-campo">
          <label htmlFor="pu2-solicitante-outros" className="pu2-rotulo">
            Quem é o Solicitante? <Obrigatorio />
          </label>
          <input
            id="pu2-solicitante-outros"
            className="pu2-entrada"
            type="text"
            value={form.descricao_solicitante}
            onChange={(e) => atualizar('descricao_solicitante', e.target.value)}
            placeholder="Ex.: parente da parte, sem procuração"
          />
        </div>
      )}

      {/* ── Categoria ──────────────────────────────────────────── */}
      {mostrarCategoria && (
        <fieldset className="pu2-campo" style={{ border: 0, padding: 0, margin: '0 0 20px' }}>
          <legend className="pu2-rotulo">
            Categoria da Anotação <Obrigatorio />
          </legend>
          <div className="pu2-categorias">
            {CATEGORIAS_ANOTACAO.map((cat) => {
              const marcada = form.categoria === cat.codigo;
              return (
                <label key={cat.codigo} className={`pu2-categoria${marcada ? ' marcada' : ''}`} title={cat.dica}>
                  <input
                    type="radio"
                    name="pu2-categoria"
                    value={cat.codigo}
                    checked={marcada}
                    onChange={() => {
                      atualizar('categoria', cat.codigo);
                      if (form.tipo_prioridade) abrirRegra(form.upj_id, form.tipo_prioridade, cat.codigo);
                    }}
                  />
                  <Icone className="radio" nome={marcada ? 'radio-on' : 'radio-off'} tamanho={20} />
                  <Icone className="icone-cat" nome={ICONE_CATEGORIA[cat.codigo]} tamanho={22} />
                  <span>{cat.label}</span>
                  <span className="dica">
                    <Icone nome="info" tamanho={13} rotulo={cat.dica} />
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* ── Tipo ───────────────────────────────────────────────── */}
      {mostrarTipo && (
        <div className="pu2-campo">
          <label htmlFor="pu2-tipo" className="pu2-rotulo">
            Tipo da Prioridade ou Urgência <Obrigatorio />
          </label>
          <select
            id="pu2-tipo"
            className="pu2-selecao"
            value={form.tipo_prioridade}
            onChange={(e) => {
              const valor = e.target.value as TipoPrioridade;
              atualizar('tipo_prioridade', valor);
              abrirRegra(form.upj_id, valor, form.categoria);
            }}
          >
            <option value="">Selecione…</option>
            {tiposPrioridade.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {mostrarTipo && tipoPrioridadeSelecionado?.aviso && (
        <div className="pu2-caixa pu2-caixa-aviso">
          <div className="pu2-caixa-titulo">
            <Icone nome="aviso" tamanho={20} />
            Aviso
          </div>
          {tipoPrioridadeSelecionado.aviso}
          {tipoPrioridadeSelecionado.aviso_link_label && (
            <div style={{ marginTop: 6, fontWeight: 700 }}>
              {tipoPrioridadeSelecionado.aviso_link_url ? (
                <a href={tipoPrioridadeSelecionado.aviso_link_url} target="_blank" rel="noreferrer" style={{ color: 'var(--pu2-vermelho)' }}>
                  {tipoPrioridadeSelecionado.aviso_link_label}
                </a>
              ) : (
                tipoPrioridadeSelecionado.aviso_link_label
              )}
            </div>
          )}
        </div>
      )}

      {mostrarRestante && form.tipo_prioridade === 'outros' && (
        <div className="pu2-campo">
          <label htmlFor="pu2-tipo-outros" className="pu2-rotulo">
            Qual é o tipo? <Obrigatorio />
          </label>
          <input
            id="pu2-tipo-outros"
            className="pu2-entrada"
            type="text"
            value={form.descricao_tipo_outros}
            onChange={(e) => atualizar('descricao_tipo_outros', e.target.value)}
          />
        </div>
      )}

      {mostrarRestante && (
        <>
          {!localizacao?.sistema.valor && (
            <div className="pu2-campo">
              <label htmlFor="pu2-plataforma" className="pu2-rotulo">
                Sistema
              </label>
              <select
                id="pu2-plataforma"
                className="pu2-selecao"
                value={form.plataforma ?? ''}
                onChange={(e) => atualizar('plataforma', (e.target.value || null) as NovaAnotacaoPayloadV2['plataforma'])}
              >
                <option value="">Não sei</option>
                <option value="eproc">Eproc</option>
                <option value="saj">SAJ</option>
              </select>
              <p className="pu2-ajuda">Escolha se souber. Não impede o envio.</p>
            </div>
          )}

          {!upjAutomatica && (
            <div className="pu2-campo">
              <label htmlFor="pu2-upj" className="pu2-rotulo">
                UPJ de destino {excecaoAberta && <Obrigatorio />}
              </label>
              <select
                id="pu2-upj"
                className="pu2-selecao"
                value={form.upj_id ?? ''}
                onChange={(e) => {
                  const valor = e.target.value || null;
                  setForm((prev) => ({ ...prev, upj_id: valor, ...(varaDasFontes ? {} : { vara: null, vara_fonte: null }) }));
                  abrirRegra(valor, form.tipo_prioridade, form.categoria);
                }}
              >
                <option value="">Selecione…</option>
                {upjs.map((u) => (
                  <option key={u.id} value={u.id}>
                    {upjCurta(u)} {faixaVaras(u) ? `(${faixaVaras(u)})` : ''}
                  </option>
                ))}
              </select>
              <p className="pu2-ajuda">
                {excecaoAberta ? 'Escolha a UPJ que vai receber a anotação.' : 'Aparece porque a consulta não identificou a UPJ sozinha.'}
              </p>
            </div>
          )}

          {/* A: Vara opcional, quando as fontes só informam a UPJ (decisão do Celso, opção b). */}
          {!varaDasFontes && opcoesVara.length > 0 && (
            <div className="pu2-campo">
              <label htmlFor="pu2-vara" className="pu2-rotulo">
                Vara <span className="nota">(opcional)</span>
              </label>
              <select
                id="pu2-vara"
                className="pu2-selecao"
                value={form.vara ?? ''}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  varaEscolhida.current = v !== null;
                  setForm((prev) => ({ ...prev, vara: v, vara_fonte: v !== null ? 'atendente' : null }));
                }}
              >
                <option value="">Não sei</option>
                {opcoesVara.map((v) => (
                  <option key={v} value={v}>
                    {v}.ª Vara Cível
                  </option>
                ))}
              </select>
              <p className="pu2-ajuda">
                {datajudPendente
                  ? 'O Datajud está sendo consultado: se ele informar a Vara, ela aparece aqui sozinha.'
                  : 'Escolha se souber. Se ficar em branco, a UPJ vê "Vara a confirmar".'}
              </p>
            </div>
          )}

          <div className="pu2-campo">
            <label htmlFor="pu2-evento" className="pu2-rotulo">
              Evento(s) ou Folha(s) <Obrigatorio />
            </label>
            <input
              id="pu2-evento"
              className="pu2-entrada"
              type="text"
              value={form.evento_folha}
              onChange={(e) => atualizar('evento_folha', e.target.value)}
              placeholder="Eventos (Eproc) ou folhas (SAJ) da decisão ou da peça"
            />
          </div>

          <div className="pu2-campo">
            <label htmlFor="pu2-descricao" className="pu2-rotulo">
              Descrição Detalhada <Obrigatorio />
            </label>
            <textarea
              id="pu2-descricao"
              className="pu2-area"
              rows={4}
              value={form.descricao_prioridade}
              onChange={(e) => atualizar('descricao_prioridade', e.target.value)}
              placeholder="O que foi determinado e o que precisa ser feito"
            />
          </div>

          <div className="pu2-campo">
            <label htmlFor="pu2-resumida" className="pu2-rotulo">
              Descrição Resumida <span className="nota">(opcional)</span>
            </label>
            <input
              id="pu2-resumida"
              className="pu2-entrada"
              type="text"
              maxLength={LIMITE_RESUMIDA}
              value={form.descricao_resumida ?? ''}
              onChange={(e) => atualizar('descricao_resumida', e.target.value)}
              placeholder="Um título curto (o Gestor também pode preencher na conferência)"
            />
            <p className="pu2-ajuda">
              {(form.descricao_resumida ?? '').length}/{LIMITE_RESUMIDA} caracteres
            </p>
          </div>

          <div className="pu2-campo">
            <label htmlFor="pu2-obs" className="pu2-rotulo">
              Observação Adicional <span className="nota">(Uso Interno Exclusivo do TJSP Atende)</span>
            </label>
            <textarea
              id="pu2-obs"
              className="pu2-area"
              rows={3}
              value={form.observacao_adicional_atende}
              onChange={(e) => atualizar('observacao_adicional_atende', e.target.value)}
              placeholder="Opcional. Não é repassada à UPJ."
            />
          </div>

          {souGestor && (
            <label className="pu2-marcacao pu2-marcacao-urgente">
              <input type="checkbox" checked={urgentissimo} onChange={(e) => setUrgentissimo(e.target.checked)} />
              <Icone nome="urgentissimas" tamanho={18} />
              Marcar como Urgentíssima (aparece em destaque para a UPJ)
            </label>
          )}
        </>
      )}

      {erroGeral && (
        <div className="pu2-caixa pu2-caixa-erro" role="alert">
          {erroGeral}
        </div>
      )}

      <div className="pu2-acoes">
        <span className="pu2-acoes-nota">{notaEnvio}</span>
        <button type="button" className="pu2-botao pu2-botao-secundario" onClick={onVoltar}>
          Cancelar
        </button>
        <button type="submit" className="pu2-botao pu2-botao-primario" disabled={salvando}>
          {salvando ? 'Enviando…' : 'Enviar Anotação'}
        </button>
      </div>

      {regraModal && (
        <div className="pu2-dialogo-fundo" role="alertdialog" aria-modal="true" aria-labelledby="pu2-regra-titulo">
          <div className="pu2-dialogo">
            <h3 id="pu2-regra-titulo">{regraModal.length > 1 ? 'Regras especiais desta UPJ' : 'Regra especial desta UPJ'}</h3>
            {regraModal.map((t) => (
              <p key={t} style={{ whiteSpace: 'pre-wrap', margin: '0 0 16px' }}>
                {t}
              </p>
            ))}
            <div style={{ textAlign: 'right' }}>
              <button type="button" className="pu2-botao pu2-botao-primario" onClick={() => setRegraModal(null)}>
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      <AnotacaoConsultaModal anotacaoId={consultaAnteriorId} onFechar={() => setConsultaAnteriorId(null)} />
    </form>
  );
};

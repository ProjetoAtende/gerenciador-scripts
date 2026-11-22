/**
 * Nova Anotação — visual da v2 (maquete 002).
 *
 * As REGRAS são as da v1 (`prioridades/NovaAnotacaoForm.tsx`), copiadas sem
 * alteração: consulta ao DJEN, complementação do número, competência, UPJ
 * detectada, anotações prévias de 120 dias, regras especiais e validação no
 * envio. Mudanças de regra ficam para a etapa 2, com teste próprio.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AnotacaoAnterior,
  DjenResultado,
  NovaAnotacaoPayload,
  PerfilUsuarioPrioridades,
  TipoPrioridade,
  TipoSolicitante,
  Upj,
} from '../../types/Prioridades';
import {
  complementarProcesso,
  consultarProcesso,
  formatarProcessoCnj,
  processoCompleto,
  somenteDigitos,
} from '../../services/prioridadesDjenService';
import { avaliarCompetenciaAtende } from '../../services/prioridadesCompetencia';
import { inferirSistemaPorCnj } from '../../services/prioridadesSistemaCnj';
import {
  criarAnotacao,
  listarAnotacoesAnteriores,
  listarRegrasEspeciais,
  listarTiposPrioridade,
  listarTiposSolicitante,
  listarUpjs,
  resolverUpjPorOrgao,
} from '../../services/prioridadesService';
import type { CatalogoItem, RegraEspecial } from '../../services/prioridadesService';
import { StatusBadge } from '../prioridades/PrioridadesUi';
import { AnotacaoConsultaModal } from '../prioridades/AnotacaoConsultaModal';
import { CATEGORIAS_ANOTACAO } from '../prioridades/prioridadesCategorias';
import { Icone } from './Icone';
import { ICONE_CATEGORIA, faixaVaras, upjCurta, varaOrdinal } from './prioridadesV2Rotulos';
import logoEproc from './assets/logo-eproc.png';
import logoSaj from './assets/logo-saj.png';

interface Props {
  perfil: PerfilUsuarioPrioridades | null;
  onCriada: (mensagem: string) => void;
  onVoltar: () => void;
}

const ESTADO_INICIAL: NovaAnotacaoPayload = {
  processo: '',
  vara: null,
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
  observacao_adicional_atende: '',
};

const Obrigatorio = () => (
  <span className="obrigatorio" aria-hidden>
    *
  </span>
);

export const NovaAnotacaoV2: React.FC<Props> = ({ perfil, onCriada, onVoltar }) => {
  const [form, setForm] = useState<NovaAnotacaoPayload>(ESTADO_INICIAL);
  const [tiposSolicitante, setTiposSolicitante] = useState<CatalogoItem[]>([]);
  const [tiposPrioridade, setTiposPrioridade] = useState<CatalogoItem[]>([]);
  const [upjs, setUpjs] = useState<Upj[]>([]);

  const [consultando, setConsultando] = useState(false);
  const [resultadoDjen, setResultadoDjen] = useState<DjenResultado | null>(null);
  const [upjDetectada, setUpjDetectada] = useState<{ codigo: string | null; nome: string | null } | null>(null);

  const [anteriores, setAnteriores] = useState<AnotacaoAnterior[]>([]);
  const [consultaAnteriorId, setConsultaAnteriorId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState<string[]>([]);
  const [incluirNomeSolicitante, setIncluirNomeSolicitante] = useState(false);
  const [regras, setRegras] = useState<RegraEspecial[]>([]);
  const [regraModal, setRegraModal] = useState<string | null>(null);
  const [processoCompetente, setProcessoCompetente] = useState(true);

  const ultimaConsulta = useRef<string>('');
  const topoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [ts, tp, us, rs] = await Promise.all([
        listarTiposSolicitante(),
        listarTiposPrioridade(),
        listarUpjs(),
        listarRegrasEspeciais(),
      ]);
      setTiposSolicitante(ts);
      setTiposPrioridade(tp);
      setUpjs(us);
      setRegras(rs);
    })();
  }, []);

  const atualizar = useCallback(<K extends keyof NovaAnotacaoPayload>(campo: K, valor: NovaAnotacaoPayload[K]) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  const tipoPrioridadeSelecionado = useMemo(
    () => tiposPrioridade.find((t) => t.codigo === form.tipo_prioridade) ?? null,
    [tiposPrioridade, form.tipo_prioridade]
  );

  const digitosAtuais = somenteDigitos(form.processo).length;
  const podeVerificar = digitosAtuais === 20 || digitosAtuais === 13;
  const precisaComplementar = digitosAtuais === 13;
  const consultaConcluida = resultadoDjen !== null;
  const djenIndisponivel = resultadoDjen?.status === 'erro';
  const mostrarSolicitante = consultaConcluida && processoCompetente;
  const mostrarCategoria = mostrarSolicitante && form.tipo_solicitante !== '';
  const mostrarTipo = mostrarCategoria && form.categoria !== '';
  const mostrarRestante = mostrarTipo && form.tipo_prioridade !== '';
  const upjDetectadaAutomaticamente = Boolean(form.upj_id && upjDetectada?.nome);
  const inferenciaSistema = useMemo(() => inferirSistemaPorCnj(form.processo), [form.processo]);
  const upjDoForm = form.upj_id ? upjs.find((u) => u.id === form.upj_id) ?? null : null;
  const plataforma = form.plataforma ?? inferenciaSistema.plataforma ?? null;

  const abrirRegra = useCallback(
    (upj: string | null, tipoPrioridade: string) => {
      if (!upj || !tipoPrioridade) {
        setRegraModal(null);
        return;
      }
      const regra = regras.find((r) => r.upj_id === upj && r.tipo_prioridade === tipoPrioridade && r.texto.trim());
      setRegraModal(regra?.texto ?? null);
    },
    [regras]
  );

  /** RF-ATD-03/04: consulta o DJEN e resolve a UPJ (mesma regra da v1). */
  const consultar = useCallback(
    async (numeroDigitado: string) => {
      const { numero, complementado } = complementarProcesso(numeroDigitado);
      // Conta os dígitos do número RECEBIDO. A v1 usava `podeVerificar` do render
      // anterior, que ainda tinha 19 dígitos quando o 20.º era digitado: a
      // consulta automática nunca disparava e era preciso clicar no botão.
      const digitos = somenteDigitos(numeroDigitado).length;
      if (digitos !== 20 && digitos !== 13) return;
      if (ultimaConsulta.current === numero) return;
      ultimaConsulta.current = numero;

      setConsultando(true);
      setErroGeral(null);
      try {
        const resultado = await consultarProcesso(numero);
        setResultadoDjen(resultado);

        const competencia = avaliarCompetenciaAtende(
          numero,
          resultado.status === 'localizado' ? resultado.vara : null,
          resultado.status === 'localizado' ? resultado.nomeOrgao : null,
          resultado.status === 'erro' ? 'sem_comunicacao' : resultado.status
        );
        setProcessoCompetente(competencia.competente);
        if (!competencia.competente && competencia.motivo) {
          setErroGeral(competencia.motivo);
        } else if (resultado.status === 'erro') {
          setErroGeral(null);
        }

        setAnteriores(await listarAnotacoesAnteriores(numero));

        const sistema = inferirSistemaPorCnj(numero);
        const detalheComplemento = complementado
          ? 'Número complementado automaticamente com o sufixo 8.26.0100 (RF-ATD-02).'
          : null;

        if (resultado.status === 'localizado') {
          const upj = await resolverUpjPorOrgao(resultado.idOrgao, resultado.vara, resultado.nomeOrgao);
          setUpjDetectada(upj.upj_id ? { codigo: upj.upj_codigo, nome: upj.upj_nome } : null);
          setForm((prev) => ({
            ...prev,
            processo: numero,
            vara: resultado.vara,
            upj_id: upj.upj_id,
            plataforma: sistema.plataforma ?? resultado.plataforma,
            validacao_djen_status: resultado.status,
            validacao_djen_em: new Date().toISOString(),
            validacao_djen_detalhe: detalheComplemento,
            id_orgao_djen: resultado.idOrgao,
            nome_orgao_djen: resultado.nomeOrgao,
          }));
        } else {
          setUpjDetectada(null);
          setForm((prev) => ({
            ...prev,
            processo: numero,
            validacao_djen_status: resultado.status,
            validacao_djen_em: new Date().toISOString(),
            validacao_djen_detalhe: detalheComplemento ?? resultado.detalhe,
            id_orgao_djen: null,
            nome_orgao_djen: null,
            vara: null,
            plataforma: sistema.plataforma,
            upj_id: null,
          }));
        }
      } finally {
        setConsultando(false);
      }
    },
    []
  );

  const processoExibicao = useMemo(() => formatarProcessoCnj(form.processo), [form.processo]);

  const handleProcessoChange = (valorDigitado: string) => {
    const formatado = formatarProcessoCnj(valorDigitado);
    const digitos = somenteDigitos(formatado).length;
    setPendentes((p) => p.filter((c) => !c.startsWith('N.º do Processo')));

    // Qualquer mudança no número invalida o que foi apurado para o anterior (PU-04).
    ultimaConsulta.current = '';
    setResultadoDjen(null);
    setUpjDetectada(null);
    setProcessoCompetente(true);
    setAnteriores([]);
    setErroGeral(null);
    setForm((prev) => ({
      ...prev,
      processo: formatado,
      upj_id: null,
      vara: null,
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

    const faltando: string[] = [];
    if (!processoCompleto(form.processo)) faltando.push('N.º do Processo');
    if (!form.tipo_solicitante) faltando.push('Solicitante');
    if (form.tipo_solicitante === 'outros' && !form.descricao_solicitante.trim()) faltando.push('Descrição do(s) Solicitante');
    if (!form.categoria) faltando.push('Categoria da Anotação');
    if (!form.tipo_prioridade) faltando.push('Tipo da Prioridade ou Urgência');
    if (form.tipo_prioridade === 'outros' && !form.descricao_tipo_outros.trim()) {
      faltando.push('Descrição do Tipo (Outros)');
    }
    if (!form.evento_folha.trim()) faltando.push('Evento(s) ou Folha(s)');
    if (!form.descricao_prioridade.trim()) faltando.push('Descrição Detalhada');

    const competencia = avaliarCompetenciaAtende(
      somenteDigitos(form.processo),
      form.vara,
      form.nome_orgao_djen,
      form.validacao_djen_status
    );
    if (!competencia.competente) {
      setErroGeral(competencia.motivo ?? 'Processo fora da competência do TJSP Atende.');
      topoRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (faltando.length > 0) {
      setPendentes(faltando);
      topoRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setSalvando(true);
    try {
      const resposta = await criarAnotacao({
        ...form,
        processo: somenteDigitos(form.processo),
        nome_solicitante: incluirNomeSolicitante ? form.nome_solicitante.trim() : '',
      });

      if (!resposta.sucesso) {
        setErroGeral(resposta.erro ?? 'Não foi possível registrar a anotação.');
        if (resposta.campos_pendentes) setPendentes(resposta.campos_pendentes);
        topoRef.current?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      const destino =
        resposta.status === 'upj-pendente'
          ? 'remetida diretamente à UPJ (como Gestor, você dispensa a conferência)'
          : 'enviada para conferência do Gestor';
      onCriada(`Anotação n.º ${resposta.anotacao_id} registrada e ${destino}.`);
    } finally {
      setSalvando(false);
    }
  };

  const notaEnvio =
    perfil?.perfil === 'gestor'
      ? 'Como Gestor(a), o envio vai direto à UPJ.'
      : perfil?.perfil === 'conferente'
        ? 'Como Conferente, a anotação também passa pela conferência.'
        : 'A anotação será enviada para conferência do Gestor.';

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
          {precisaComplementar && !resultadoDjen
            ? 'Número até o ano: clique em Localizar Processo para completar com 8.26.0100.'
            : 'Pode digitar só até o ano (ex.: 1076547-84.2025): o final 8.26.0100 é completado sozinho.'}
        </p>
      </div>

      {/* ── Resultado da localização ───────────────────────────── */}
      {resultadoDjen && !processoCompetente && (
        <div className="pu2-caixa pu2-caixa-erro" role="alert">
          <div className="pu2-caixa-titulo">
            <Icone nome="alerta" tamanho={20} />
            Processo fora do atendimento do TJSP Atende
          </div>
          {erroGeral ?? 'O TJSP Atende cuida apenas da 1.ª à 45.ª Vara Cível do Foro Central de São Paulo.'}
        </div>
      )}

      {resultadoDjen && processoCompetente && resultadoDjen.status === 'localizado' && (
        <div className="pu2-caixa pu2-caixa-sucesso" role="status">
          <div className="pu2-caixa-titulo">
            <Icone nome="check" tamanho={22} />
            Processo localizado!
          </div>
          <div className="pu2-processo-local">
            {varaOrdinal(resultadoDjen.vara) ? (
              <span>
                <strong>{varaOrdinal(resultadoDjen.vara)}</strong> Vara Cível ·
              </span>
            ) : (
              <span>Vara não identificada ·</span>
            )}
            {upjDoForm ? (
              <span>
                <strong>{upjCurta(upjDoForm)}</strong> {faixaVaras(upjDoForm) && `(${faixaVaras(upjDoForm)})`}
              </span>
            ) : (
              <span>UPJ não identificada: escolha abaixo</span>
            )}
          </div>
          {plataforma && (
            <img
              className="pu2-processo-plataforma"
              src={plataforma === 'eproc' ? logoEproc : logoSaj}
              alt={plataforma === 'eproc' ? 'Eproc' : 'SAJ'}
            />
          )}
        </div>
      )}

      {resultadoDjen && processoCompetente && resultadoDjen.status !== 'localizado' && (
        <div className="pu2-caixa pu2-caixa-aviso" role="status">
          <div className="pu2-caixa-titulo">
            <Icone nome="aviso" tamanho={20} />
            {djenIndisponivel ? 'Consulta indisponível no momento' : 'Processo sem publicações'}
          </div>
          {djenIndisponivel
            ? 'Não foi possível consultar o processo agora. Se o número estiver correto, você pode seguir com a anotação e escolher a UPJ abaixo.'
            : 'Não há publicações deste processo no Diário Eletrônico. Isso não quer dizer que ele não exista: confira o número e, se estiver correto, siga com a anotação escolhendo a UPJ abaixo.'}
        </div>
      )}

      {anteriores.length > 0 && (
        <div className="pu2-caixa pu2-caixa-aviso">
          <div className="pu2-caixa-titulo">
            <Icone nome="aviso" tamanho={20} />
            Este processo já tem {anteriores.length === 1 ? '1 anotação' : `${anteriores.length} anotações`} nos últimos 120 dias
          </div>
          <ul>
            {anteriores.map((a) => (
              <li key={a.id} style={{ marginTop: 4 }}>
                <strong>n.º {a.id}</strong> · {new Date(a.data_anotacao).toLocaleDateString('pt-BR')} · <StatusBadge status={a.status} /> ·{' '}
                {a.descricao_prioridade}{' '}
                <button
                  type="button"
                  className="pu2-botao pu2-botao-link"
                  style={{ padding: 0, color: 'var(--pu2-vermelho)' }}
                  onClick={() => setConsultaAnteriorId(a.id)}
                >
                  Ver anotação
                </button>
              </li>
            ))}
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
                    onChange={() => atualizar('categoria', cat.codigo)}
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
              abrirRegra(form.upj_id, valor);
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
          {!inferenciaSistema.plataforma && (
            <div className="pu2-campo">
              <label htmlFor="pu2-plataforma" className="pu2-rotulo">
                Sistema
              </label>
              <select
                id="pu2-plataforma"
                className="pu2-selecao"
                value={form.plataforma ?? ''}
                onChange={(e) => atualizar('plataforma', (e.target.value || null) as NovaAnotacaoPayload['plataforma'])}
              >
                <option value="">Não sei</option>
                <option value="eproc">Eproc</option>
                <option value="saj">SAJ</option>
              </select>
              <p className="pu2-ajuda">Escolha se souber. Não impede o envio.</p>
            </div>
          )}

          {!upjDetectadaAutomaticamente && (
            <div className="pu2-campo">
              <label htmlFor="pu2-upj" className="pu2-rotulo">
                UPJ de destino
              </label>
              <select
                id="pu2-upj"
                className="pu2-selecao"
                value={form.upj_id ?? ''}
                onChange={(e) => {
                  const valor = e.target.value || null;
                  atualizar('upj_id', valor);
                  abrirRegra(valor, form.tipo_prioridade);
                }}
              >
                <option value="">Selecione…</option>
                {upjs.map((u) => (
                  <option key={u.id} value={u.id}>
                    {upjCurta(u)} {faixaVaras(u) ? `(${faixaVaras(u)})` : ''}
                  </option>
                ))}
              </select>
              <p className="pu2-ajuda">Aparece porque a consulta não identificou a UPJ sozinha.</p>
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
        </>
      )}

      {erroGeral && processoCompetente && (
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
            <h3 id="pu2-regra-titulo">Regra especial desta UPJ</h3>
            <p style={{ whiteSpace: 'pre-wrap', margin: '0 0 16px' }}>{regraModal}</p>
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

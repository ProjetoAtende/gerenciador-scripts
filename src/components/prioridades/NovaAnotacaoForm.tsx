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
  SUFIXO_CNJ_PADRAO_TJSP_CENTRAL,
} from '../../services/prioridadesDjenService';
import {
  criarAnotacao,
  listarAnotacoesAnteriores,
  listarTiposPrioridade,
  listarTiposSolicitante,
  listarUpjs,
  resolverUpjPorOrgao,
} from '../../services/prioridadesService';
import type { CatalogoItem } from '../../services/prioridadesService';
import { StatusBadge } from './PrioridadesUi';

interface NovaAnotacaoProps {
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
  tipo_prioridade: '',
  descricao_tipo_outros: '',
  evento_folha: '',
  descricao_prioridade: '',
  observacao_adicional_atende: '',
};

/**
 * Tela "Nova Anotação" (seção 7.2, slide 129).
 *
 * Pré-requisitos atendidos: RF-ATD-01 (máscara), 02 (complementação),
 * 03 (validação por API), 04 (UPJ automática), 05, 06 (listas fechadas com
 * campo condicional "Outros"), 07 (avisos), 08, 09, 10, 11 (validação no envio)
 * e 12 (indicador de anotações prévias de 120 dias).
 */
export const NovaAnotacaoForm: React.FC<NovaAnotacaoProps> = ({ perfil, onCriada, onVoltar }) => {
  const [form, setForm] = useState<NovaAnotacaoPayload>(ESTADO_INICIAL);
  const [tiposSolicitante, setTiposSolicitante] = useState<CatalogoItem[]>([]);
  const [tiposPrioridade, setTiposPrioridade] = useState<CatalogoItem[]>([]);
  const [upjs, setUpjs] = useState<Upj[]>([]);

  const [consultando, setConsultando] = useState(false);
  const [resultadoDjen, setResultadoDjen] = useState<DjenResultado | null>(null);
  const [upjDetectada, setUpjDetectada] = useState<{ codigo: string | null; nome: string | null } | null>(null);

  const [anteriores, setAnteriores] = useState<AnotacaoAnterior[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState<string[]>([]);

  const ultimaConsulta = useRef<string>('');

  useEffect(() => {
    (async () => {
      const [ts, tp, us] = await Promise.all([
        listarTiposSolicitante(),
        listarTiposPrioridade(),
        listarUpjs(),
      ]);
      setTiposSolicitante(ts);
      setTiposPrioridade(tp);
      setUpjs(us);
    })();
  }, []);

  const atualizar = useCallback(<K extends keyof NovaAnotacaoPayload>(campo: K, valor: NovaAnotacaoPayload[K]) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  const tipoPrioridadeSelecionado = useMemo(
    () => tiposPrioridade.find((t) => t.codigo === form.tipo_prioridade) ?? null,
    [tiposPrioridade, form.tipo_prioridade]
  );

  /**
   * RF-ATD-02/03: o número é verificável com 20 dígitos (completo) ou com 13
   * (até o ano), que é quando o sistema complementa o sufixo 8.26.0100.
   *
   * Antes, só 20 dígitos habilitavam a verificação: o botão "Verificar" ficava
   * desabilitado com 13 dígitos e o RF-ATD-02 era inalcançável pela tela.
   */
  const digitosAtuais = somenteDigitos(form.processo).length;
  const podeVerificar = digitosAtuais === 20 || digitosAtuais === 13;
  const precisaComplementar = digitosAtuais === 13;

  /**
   * RF-ATD-03/04: consulta o DJEN e resolve a UPJ.
   * Disparado automaticamente só com o número completo (20 dígitos) — nunca a
   * cada tecla, para respeitar o rate limit da API. Com 13 dígitos a verificação
   * é explícita, pelo botão, porque o número complementado precisa ser conferido
   * pelo atendente.
   */
  const consultar = useCallback(async (numeroDigitado: string) => {
    const { numero, complementado } = complementarProcesso(numeroDigitado);
    if (!podeVerificar) return;
    if (ultimaConsulta.current === numero) return;
    ultimaConsulta.current = numero;

    setConsultando(true);
    setErroGeral(null);
    try {
      const resultado = await consultarProcesso(numero);
      setResultadoDjen(resultado);

      // Busca anotações prévias do processo (RF-ATD-12), independente do DJEN.
      const antigas = await listarAnotacoesAnteriores(numero);
      setAnteriores(antigas);

      // PU-04: TODOS os campos derivados da consulta são zerados antes de
      // receber o resultado. Antes, o ramo `sem_comunicacao` preservava
      // `prev.upj_id`, então a UPJ do processo anterior ficava "presa" e a
      // anotação ia para o cartório errado, exibindo o texto "Detectada
      // automaticamente pelo órgão publicado no DJEN".
      if (resultado.status === 'localizado') {
        const upj = await resolverUpjPorOrgao(resultado.idOrgao, resultado.vara);
        setUpjDetectada(upj.upj_id ? { codigo: upj.upj_codigo, nome: upj.upj_nome } : null);
        setForm((prev) => ({
          ...prev,
          processo: numero,
          vara: resultado.vara,
          upj_id: upj.upj_id,
          plataforma: resultado.plataforma,
          validacao_djen_status: resultado.status,
          validacao_djen_em: new Date().toISOString(),
          validacao_djen_detalhe: complementado
            ? 'Número complementado automaticamente com o sufixo 8.26.0100 (RF-ATD-02).'
            : null,
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
          validacao_djen_detalhe: complementado
            ? 'Número complementado automaticamente com o sufixo 8.26.0100 (RF-ATD-02).'
            : resultado.detalhe,
          // Nada de destino herdado: a consulta não confirmou a UPJ.
          id_orgao_djen: null,
          nome_orgao_djen: null,
          vara: null,
          plataforma: null,
          upj_id: null,
        }));
      }
    } finally {
      setConsultando(false);
    }
  }, [podeVerificar]);

  /**
   * RF-ATD-01: o valor do input é sempre DERIVADO do estado (dígitos) e
   * remascarado a cada render.
   *
   * Isso é necessário porque a resposta do DJEN grava `form.processo` já em
   * dígitos crus (é o formato de armazenamento exigido por RF-ATD-01). Sem
   * derivar, o campo perderia a máscara assim que a consulta retornasse.
   */
  const processoExibicao = useMemo(() => formatarProcessoCnj(form.processo), [form.processo]);

  const handleProcessoChange = (valorDigitado: string) => {
    const formatado = formatarProcessoCnj(valorDigitado);
    const digitos = somenteDigitos(formatado).length;
    atualizar('processo', formatado);
    setPendentes((p) => p.filter((c) => c.startsWith('N.º do Processo') === false));

    // Qualquer mudança no número invalida o que foi apurado para o anterior.
    // PU-04: sem isto, a UPJ (e o órgão) do processo anterior permaneciam no
    // formulário e eram gravados na anotação do processo novo.
    ultimaConsulta.current = '';
    setResultadoDjen(null);
    setUpjDetectada(null);
    setAnteriores([]);
    setForm((prev) => ({
      ...prev,
      processo: formatado,
      upj_id: null,
      vara: null,
      id_orgao_djen: null,
      nome_orgao_djen: null,
      plataforma: prev.plataforma,
      validacao_djen_status: 'nao_consultado',
      validacao_djen_em: null,
      validacao_djen_detalhe: null,
    }));

    if (digitos === 20) {
      void consultar(formatado);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroGeral(null);

    // Validação local (RF-ATD-11) — o servidor repete a checagem.
    const faltando: string[] = [];
    if (!processoCompleto(form.processo)) faltando.push('N.º do Processo');
    if (!form.tipo_solicitante) faltando.push('Tipo de Solicitante');
    if (form.tipo_solicitante === 'outros' && !form.descricao_solicitante.trim()) {
      faltando.push('Descrição do(s) Solicitante');
    }
    if (!form.tipo_prioridade) faltando.push('Tipo de Prioridade/Urgência');
    if (form.tipo_prioridade === 'outros' && !form.descricao_tipo_outros.trim()) {
      faltando.push('Descrição do Tipo de Prioridade/Urgência');
    }
    if (!form.evento_folha.trim()) faltando.push('Evento ou Folhas');
    if (!form.descricao_prioridade.trim()) faltando.push('Descrição da Prioridade/Urgência');

    if (faltando.length > 0) {
      setPendentes(faltando);
      return;
    }

    setSalvando(true);
    try {
      const resposta = await criarAnotacao({
        ...form,
        processo: somenteDigitos(form.processo),
      });

      if (!resposta.sucesso) {
        setErroGeral(resposta.erro ?? 'Não foi possível registrar a anotação.');
        if (resposta.campos_pendentes) setPendentes(resposta.campos_pendentes);
        return;
      }

      // RF-ATD-11: indicador de sucesso no envio.
      const destino =
        resposta.status === 'upj-pendente'
          ? 'remetida diretamente à UPJ (perfil Gestor dispensa a conferência)'
          : 'enviada para conferência do Gestor';
      onCriada(`Anotação ${resposta.anotacao_id} registrada e ${destino}.`);
      setForm(ESTADO_INICIAL);
      setResultadoDjen(null);
      setAnteriores([]);
      setPendentes([]);
      ultimaConsulta.current = '';
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Nova Anotação</h2>
        <button type="button" onClick={onVoltar} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          Voltar
        </button>
      </div>

      {/* RF-ATD-12: indicador realçado de anotações prévias (120 dias). */}
      {anteriores.length > 0 && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 dark:border-amber-600 dark:bg-amber-900/20">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            ⚠️ Este processo já possui {anteriores.length} anotação(ões) nos últimos 120 dias
          </p>
          <ul className="mt-2 space-y-1">
            {anteriores.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-mono">#{a.id}</span>
                <StatusBadge status={a.status} />
                <span>{new Date(a.data_anotacao).toLocaleDateString('pt-BR')}</span>
                <span className="truncate">· {a.descricao_prioridade}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* RF-ATD-11: lista dos campos obrigatórios pendentes. */}
      {pendentes.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">Preencha os campos obrigatórios:</p>
          <ul className="mt-1 list-inside list-disc text-sm text-red-700 dark:text-red-300">
            {pendentes.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {erroGeral && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {erroGeral}
        </div>
      )}

      {/* ── Processo ─────────────────────────────────────────── */}
      <div>
        <label htmlFor="pu-processo" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          N.º do Processo <span className="text-red-600">*</span>
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="pu-processo"
            type="text"
            inputMode="numeric"
            value={processoExibicao}
            onChange={(e) => handleProcessoChange(e.target.value)}
            placeholder="0123456-66.2026.8.26.0100"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={() => void consultar(form.processo)}
            disabled={consultando || !podeVerificar}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {consultando ? 'Consultando…' : 'Verificar'}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Padrão CNJ. Se informar apenas até o ano (ex.: <span className="font-mono">1076547-84.2025</span>), o
          botão Verificar completa o número com o sufixo{' '}
          <span className="font-mono">8.26.0100</span> e consulta o processo completo.
        </p>
        {precisaComplementar && !resultadoDjen && (
          <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            Número até o ano. Clique em <strong>Verificar</strong> para completar com{' '}
            <span className="font-mono">{SUFIXO_CNJ_PADRAO_TJSP_CENTRAL}</span> e consultar o DJEN.
          </p>
        )}
      </div>

      {/* Indicador de localização (RF-ATD-03) */}
      {resultadoDjen && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            resultadoDjen.status === 'localizado'
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20'
              : resultadoDjen.status === 'sem_comunicacao'
                ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                : 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/40'
          }`}
        >
          <p className="font-semibold text-gray-800 dark:text-gray-100">Indicador de Localização do Processo</p>

          {resultadoDjen.status === 'localizado' ? (
            <div className="mt-1 space-y-1 text-gray-700 dark:text-gray-200">
              <p>
                Localizado no DJEN · {resultadoDjen.totalComunicacoes} comunicação(ões)
                {resultadoDjen.ultimaDisponibilizacao ? ` · última em ${resultadoDjen.ultimaDisponibilizacao}` : ''}
              </p>
              <p>
                <strong>Vara:</strong> {resultadoDjen.vara ? `${resultadoDjen.vara}ª` : 'não identificada no nome do órgão'}
              </p>
              <p>
                <strong>Órgão:</strong> {resultadoDjen.nomeOrgao ?? '—'}
                {resultadoDjen.idOrgao ? ` (idOrgao ${resultadoDjen.idOrgao})` : ''}
              </p>
              <p>
                <strong>UPJ:</strong>{' '}
                {upjDetectada?.nome ? (
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                    {upjDetectada.codigo ? `${upjDetectada.codigo} — ` : ''}
                    {upjDetectada.nome}
                  </span>
                ) : (
                  <span className="text-amber-800 dark:text-amber-300">
                    órgão não mapeado na tabela Vara/Órgão → UPJ — selecione a UPJ manualmente
                  </span>
                )}
              </p>
              <p>
                <strong>Sistema:</strong> informe abaixo — o DJEN não informa se o processo tramita no Eproc
                ou no SAJ.
              </p>
            </div>
          ) : (
            <p className="mt-1 text-gray-700 dark:text-gray-200">
              {resultadoDjen.status === 'sem_comunicacao'
                ? 'Nenhuma comunicação publicada no DJEN para este processo na janela consultada. Isso não confirma que o processo não existe — a anotação pode seguir normalmente.'
                : resultadoDjen.detalhe}
            </p>
          )}
        </div>
      )}

      {/* ── Solicitante (RF-ATD-05) ──────────────────────────── */}
      <div>
        <label htmlFor="pu-solicitante" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Solicitante <span className="text-red-600">*</span>
        </label>
        <select
          id="pu-solicitante"
          value={form.tipo_solicitante}
          onChange={(e) => atualizar('tipo_solicitante', e.target.value as TipoSolicitante)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="">Selecione…</option>
          {tiposSolicitante.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {form.tipo_solicitante === 'outros' && (
        <div>
          <label htmlFor="pu-solicitante-outros" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Descrição do(s) Solicitante <span className="text-red-600">*</span>
          </label>
          <input
            id="pu-solicitante-outros"
            type="text"
            value={form.descricao_solicitante}
            onChange={(e) => atualizar('descricao_solicitante', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
      )}

      {/* ── Tipo de Prioridade (RF-ATD-06/07) ────────────────── */}
      <div>
        <label htmlFor="pu-prioridade" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Tipo de Prioridade/Urgência <span className="text-red-600">*</span>
        </label>
        <select
          id="pu-prioridade"
          value={form.tipo_prioridade}
          onChange={(e) => atualizar('tipo_prioridade', e.target.value as TipoPrioridade)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="">Selecione…</option>
          {tiposPrioridade.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* RF-ATD-07: aviso contextual do tipo selecionado. */}
      {tipoPrioridadeSelecionado?.aviso && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-100">
          <p className="font-semibold">Aviso</p>
          <p className="mt-1">{tipoPrioridadeSelecionado.aviso}</p>
          {tipoPrioridadeSelecionado.aviso_link_label && (
            <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
              🔗 {tipoPrioridadeSelecionado.aviso_link_label}
              {!tipoPrioridadeSelecionado.aviso_link_url && ' — endereço a cadastrar no catálogo'}
            </p>
          )}
        </div>
      )}

      {form.tipo_prioridade === 'outros' && (
        <div>
          <label htmlFor="pu-prioridade-outros" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Descrição do Tipo de Prioridade/Urgência (Outros) <span className="text-red-600">*</span>
          </label>
          <input
            id="pu-prioridade-outros"
            type="text"
            value={form.descricao_tipo_outros}
            onChange={(e) => atualizar('descricao_tipo_outros', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Rótulo diferenciado do campo principal para evitar a ambiguidade apontada na pendência 7 da especificação.
          </p>
        </div>
      )}

      {/* ── Eproc / SAJ ──────────────────────────────────────────
          A especificação previa este campo como retorno da API (RF-ATD-03,
          "indicadores de UPJ, Vara e Sistema"). O DJEN não informa em qual
          sistema o processo tramita, e o número CNJ não carrega essa
          informação — então o dado passa a ser fornecido pelo atendente.
          Opcional: não bloqueia o envio. */}
      <div>
        <label htmlFor="pu-plataforma" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Sistema
        </label>
        <select
          id="pu-plataforma"
          value={form.plataforma ?? ''}
          onChange={(e) =>
            atualizar('plataforma', (e.target.value || null) as NovaAnotacaoPayload['plataforma'])
          }
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="">Não informado</option>
          <option value="eproc">Eproc</option>
          <option value="saj">SAJ</option>
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          O DJEN não é capaz de informar o sistema de distribuição. Preencha se souber.
        </p>
      </div>

      {/* ── UPJ (RF-ATD-04) ──────────────────────────────────── */}
      <div>
        <label htmlFor="pu-upj" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          UPJ de destino
        </label>
        <select
          id="pu-upj"
          value={form.upj_id ?? ''}
          onChange={(e) => atualizar('upj_id', e.target.value || null)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="">Não definida</option>
          {upjs.map((u) => (
            <option key={u.id} value={u.id}>
              {u.codigo} — {u.nome}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Detectada automaticamente pelo órgão publicado no DJEN. Ajuste apenas se a detecção falhar.
        </p>
      </div>

      {/* ── Evento/Folha (RF-ATD-08) ─────────────────────────── */}
      <div>
        <label htmlFor="pu-evento" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Evento(s) ou Folha(s) <span className="text-red-600">*</span>
        </label>
        <input
          id="pu-evento"
          type="text"
          value={form.evento_folha}
          onChange={(e) => atualizar('evento_folha', e.target.value)}
          placeholder="Eventos (Eproc) ou folhas (SAJ) das decisões/peças relacionadas"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      {/* ── Descrição (RF-ATD-09) ────────────────────────────── */}
      <div>
        <label htmlFor="pu-descricao" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Descrição da Prioridade/Urgência <span className="text-red-600">*</span>
        </label>
        <textarea
          id="pu-descricao"
          rows={4}
          value={form.descricao_prioridade}
          onChange={(e) => atualizar('descricao_prioridade', e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      {/* ── Observações internas (RF-ATD-10) ─────────────────── */}
      <div>
        <label htmlFor="pu-obs" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Observações Adicionais (uso interno do TJSP Atende)
        </label>
        <textarea
          id="pu-obs"
          rows={2}
          value={form.observacao_adicional_atende}
          onChange={(e) => atualizar('observacao_adicional_atende', e.target.value)}
          placeholder="Ex.: solicitante relatou que o prazo vence nesta semana."
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Anotações internas do TJSP Atende (não serão repassadas às UPJs).
        </p>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
        <span className="mr-auto text-xs text-gray-500 dark:text-gray-400">
          {perfil?.perfil === 'gestor'
            ? 'Como Gestor, o envio remete diretamente à UPJ (dispensa a conferência).'
            : perfil?.perfil === 'conferente'
              ? 'Conferente Designado não tem dispensa: a anotação passa pela conferência.'
              : 'A anotação será enviada para conferência do Gestor.'}
        </span>
        <button
          type="button"
          onClick={onVoltar}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={salvando}
          className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {salvando ? 'Enviando…' : 'Enviar Anotação'}
        </button>
      </div>
    </form>
  );
};

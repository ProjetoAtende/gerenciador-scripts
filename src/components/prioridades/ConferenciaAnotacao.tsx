import React, { useEffect, useState } from 'react';
import type { AnotacaoPrioridade, HistoricoAnotacao, Upj } from '../../types/Prioridades';
import { conferirAnotacao, listarHistorico } from '../../services/prioridadesService';
import { formatarProcessoCnj } from '../../services/prioridadesDjenService';
import { CampoLeitura, StatusBadge } from './PrioridadesUi';
import { formatarDataHora } from './prioridadesUtils';

interface Props {
  anotacao: AnotacaoPrioridade;
  /** UPJs disponíveis, para o Gestor definir o destino quando a detecção falhar. */
  upjs: Upj[];
  /** Modo consulta: sem decisão, apenas leitura (histórico e itens encerrados). */
  somenteLeitura?: boolean;
  onConcluir: (mensagem: string) => void | Promise<void>;
  onVoltar: () => void;
}

type Decisao = 'aprovar' | 'devolver' | 'rejeitar';

/**
 * Tela "Conferência de Anotação" (seção 7.3, slide 132).
 *
 * RF-GES-01 fila imediata; RF-GES-02 decisão com justificativa e botões
 * condicionais; RF-GES-03 edição/correção na conferência; RF-GES-04 marcação
 * de Urgentíssimo (só em "Aprovar"); RF-GES-05 correção automática engatilhada.
 */
export const ConferenciaAnotacao: React.FC<Props> = ({ anotacao, upjs, somenteLeitura, onConcluir, onVoltar }) => {
  const [decisao, setDecisao] = useState<Decisao>('aprovar');
  const [justificativa, setJustificativa] = useState('');
  const [urgentissimo, setUrgentissimo] = useState(anotacao.urgentissimo);
  const [correcaoAutomatica, setCorrecaoAutomatica] = useState(false);
  const [textoCorrecao, setTextoCorrecao] = useState('');
  const [descricao, setDescricao] = useState(anotacao.descricao_prioridade);
  const [eventoFolha, setEventoFolha] = useState(anotacao.evento_folha);
  const [obsGestor, setObsGestor] = useState('');
  const [upjDestino, setUpjDestino] = useState(anotacao.upj_id ?? '');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoAnotacao[]>([]);

  useEffect(() => {
    void listarHistorico(anotacao.id).then(setHistorico);
  }, [anotacao.id]);

  const houveRetornoDeDevolucao = Boolean(anotacao.resposta_atendente);

  const nomeUpjSelecionada = (() => {
    const u = upjs.find((x) => x.id === upjDestino);
    if (u) return `${u.codigo} — ${u.nome}`;
    // Fallback: o registro pode estar fora da lista carregada (UPJ inativada).
    return anotacao.nome_orgao_djen ?? 'UPJ selecionada';
  })();

  const enviar = async () => {
    setErro(null);

    // O servidor recusa aprovação sem UPJ, mas avisar aqui evita a ida e volta.
    if (decisao === 'aprovar' && !upjDestino) {
      setErro(
        'Defina a UPJ de destino antes de enviar. Sem UPJ a anotação não fica visível para nenhum cartório.'
      );
      return;
    }

    setEnviando(true);
    try {
      const resposta = await conferirAnotacao({
        anotacaoId: anotacao.id,
        decisao,
        justificativa,
        urgentissimo,
        correcaoAutomatica,
        textoCorrecao,
        alteracoes:
          descricao !== anotacao.descricao_prioridade ||
          eventoFolha !== anotacao.evento_folha ||
          obsGestor.trim() !== '' ||
          upjDestino !== (anotacao.upj_id ?? '')
            ? {
                descricao_prioridade: descricao,
                evento_folha: eventoFolha,
                observacao_adicional_gestor: obsGestor || undefined,
                upj_id: upjDestino || undefined,
              }
            : undefined,
      });

      if (!resposta.sucesso) {
        setErro(resposta.erro ?? 'Não foi possível concluir a conferência.');
        return;
      }

      const rotulo =
        decisao === 'aprovar'
          ? `Anotação ${anotacao.id} enviada para a UPJ.`
          : decisao === 'devolver'
            ? `Anotação ${anotacao.id} devolvida ao Atendente com prazo de 24 h.`
            : `Anotação ${anotacao.id} arquivada (rejeitada).`;
      await onConcluir(rotulo);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {somenteLeitura ? 'Anotação' : 'Conferência de Anotação'}
          </h2>
          <StatusBadge status={anotacao.status} />
          {houveRetornoDeDevolucao && (
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900/40 dark:text-purple-200">
              Retorno de Devolução
            </span>
          )}
        </div>
        <button type="button" onClick={onVoltar} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          Voltar ao painel
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-4 dark:border-gray-700 dark:bg-gray-800">
        <CampoLeitura label="Data da Anotação" valor={formatarDataHora(anotacao.data_anotacao)} />
        <CampoLeitura label="Nome do Atendente" valor={anotacao.criador_nome} />
        <CampoLeitura label="Processo" valor={<span className="font-mono">{formatarProcessoCnj(anotacao.processo)}</span>} />
        <CampoLeitura label="UPJ de destino" valor={anotacao.nome_orgao_djen ?? '—'} />
        <CampoLeitura label="Conferente vinculado" valor={anotacao.conferente_vinculado_nome ?? '—'} />
        <CampoLeitura label="Conferido por" valor={anotacao.conferido_por_nome ?? '—'} />
        <CampoLeitura label="Solicitante" valor={anotacao.tipo_solicitante} />
        <CampoLeitura label="Tipo de Prioridade" valor={anotacao.tipo_prioridade} />
      </dl>

      {erro && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {erro}
        </div>
      )}

      {/* Resposta do Atendente, quando a anotação voltou de devolução. */}
      {houveRetornoDeDevolucao && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-900/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
            Resposta do Atendente
          </p>
          <p className="mt-1 text-sm text-purple-900 dark:text-purple-100">{anotacao.resposta_atendente}</p>
        </div>
      )}

      {/* Campos da anotação original — ativos para correção (RF-GES-03). */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Campos da anotação original
        </h3>

        <div>
          <label htmlFor="conf-evento" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Evento(s) ou Folha(s)
          </label>
          <input
            id="conf-evento"
            type="text"
            value={eventoFolha}
            onChange={(e) => setEventoFolha(e.target.value)}
            disabled={somenteLeitura}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:disabled:bg-gray-800"
          />
        </div>

        <div>
          <label htmlFor="conf-descricao" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Descrição da Prioridade/Urgência
          </label>
          <textarea
            id="conf-descricao"
            rows={4}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            disabled={somenteLeitura}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:disabled:bg-gray-800"
          />
          {!somenteLeitura && descricao !== anotacao.descricao_prioridade && (
            <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
              <p className="font-semibold">Texto original preservado em "Observação Adicional" (RF-GES-03):</p>
              <p className="mt-0.5 italic">{anotacao.descricao_prioridade}</p>
            </div>
          )}
        </div>

        {!somenteLeitura && (
          <div>
            <label htmlFor="conf-obs" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Observação Adicional (registro da correção)
            </label>
            <textarea
              id="conf-obs"
              rows={2}
              value={obsGestor}
              onChange={(e) => setObsGestor(e.target.value)}
              placeholder="Descreva o motivo da correção, se houver."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        )}

        {/* RF-ATD-10 / RF-GER-02: uso interno, não vai à UPJ. */}
        {anotacao.observacao_adicional_atende && (
          <div className="rounded-md border border-gray-300 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Observações internas do TJSP Atende (não repassadas às UPJs)
            </p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{anotacao.observacao_adicional_atende}</p>
          </div>
        )}

        {/*
          UPJ de destino: editável porque a detecção automática pode falhar
          (processo sem publicação no DJEN, ou órgão ainda não mapeado). Esta é a
          última chance de definir o destino — a aprovação exige UPJ, já que sem
          ela a anotação não fica visível para nenhum cartório.
        */}
        {!somenteLeitura && (
          <div>
            <label htmlFor="conf-upj" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              UPJ de destino <span className="text-red-600">*</span>
            </label>
            <select
              id="conf-upj"
              value={upjDestino}
              onChange={(e) => setUpjDestino(e.target.value)}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-700 dark:text-gray-100 ${
                upjDestino
                  ? 'border-gray-300 dark:border-gray-600'
                  : 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20'
              }`}
            >
              <option value="">Selecione a UPJ…</option>
              {upjs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.codigo} — {u.nome}
                </option>
              ))}
            </select>
            {/* PU-14: quando a UPJ já está definida, a orientação mostra a UPJ
                escolhida — antes exibia o nome do órgão do DJEN, que não é a UPJ. */}
            {upjDestino ? (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Destino: <strong>{nomeUpjSelecionada}</strong>
                {anotacao.nome_orgao_djen && (
                  <> · órgão publicado no DJEN: {anotacao.nome_orgao_djen}</>
                )}
              </p>
            ) : (
              <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                A detecção automática não definiu a UPJ
                {anotacao.nome_orgao_djen ? ` (órgão do DJEN: ${anotacao.nome_orgao_djen})` : ''}. Escolha a UPJ
                antes de enviar.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Decisão */}
      {!somenteLeitura && (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <fieldset>
            <legend className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Decisão de conferência
            </legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {(
                [
                  ['aprovar', 'Aprovar'],
                  ['devolver', 'Devolver'],
                  ['rejeitar', 'Rejeitar'],
                ] as Array<[Decisao, string]>
              ).map(([valor, label]) => (
                <label key={valor} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                  <input
                    type="radio"
                    name="decisao-conferencia"
                    value={valor}
                    checked={decisao === valor}
                    onChange={() => setDecisao(valor)}
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* RF-GES-04: Urgentíssimo só aparece em "Aprovar". */}
          {decisao === 'aprovar' && (
            <label className="flex items-center gap-2 rounded-md bg-red-50 p-2 text-sm text-red-900 dark:bg-red-900/20 dark:text-red-200">
              <input
                type="checkbox"
                checked={urgentissimo}
                onChange={(e) => setUrgentissimo(e.target.checked)}
                className="h-4 w-4"
              />
              Marcar como <strong>Urgentíssimo</strong> — aparece em lista própria e em destaque para a UPJ
            </label>
          )}

          {(decisao === 'devolver' || decisao === 'rejeitar') && (
            <div>
              <label htmlFor="conf-justificativa" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Justificativa <span className="text-red-600">*</span>
              </label>
              <textarea
                id="conf-justificativa"
                rows={3}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          )}

          {/* RF-GES-05: correção automática engatilhada. */}
          {decisao === 'devolver' && (
            <div className="space-y-2 rounded-md border border-orange-300 bg-orange-50 p-3 dark:border-orange-700 dark:bg-orange-900/20">
              <label className="flex items-center gap-2 text-sm text-orange-900 dark:text-orange-200">
                <input
                  type="checkbox"
                  checked={correcaoAutomatica}
                  onChange={(e) => setCorrecaoAutomatica(e.target.checked)}
                  className="h-4 w-4"
                />
                Incluir Correção Automática
              </label>
              {correcaoAutomatica && (
                <>
                  <textarea
                    rows={3}
                    value={textoCorrecao}
                    onChange={(e) => setTextoCorrecao(e.target.value)}
                    placeholder="Texto que substituirá a Descrição da Prioridade/Urgência."
                    className="w-full rounded-lg border border-orange-300 px-3 py-2 text-sm dark:border-orange-700 dark:bg-gray-700 dark:text-gray-100"
                  />
                  <p className="text-xs text-orange-800 dark:text-orange-300">
                    Se o Atendente não responder em 24 h, o sistema aplica esta correção e remete à UPJ, em vez de
                    rejeitar. A correção é silenciosa: não é visível ao Atendente antes da remessa.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
            <button
              type="button"
              onClick={onVoltar}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={enviando}
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:bg-gray-400"
            >
              {enviando
                ? 'Processando…'
                : decisao === 'aprovar'
                  ? 'Enviar para UPJ'
                  : decisao === 'devolver'
                    ? 'Enviar Devolução'
                    : 'Arquivar'}
            </button>
          </div>
        </div>
      )}

      {/* Histórico preservado (RF-GER-04) */}
      {historico.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Histórico da anotação
          </h3>
          <ol className="mt-2 space-y-2">
            {historico.map((h) => (
              <li key={h.id} className="border-l-2 border-gray-300 pl-3 dark:border-gray-600">
                <p className="text-sm text-gray-800 dark:text-gray-100">
                  <strong>{h.evento}</strong> · {h.autor_nome ?? 'sistema'} · {formatarDataHora(h.criado_em)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {h.status_anterior ? `${h.status_anterior} → ` : ''}
                  {h.status_novo}
                </p>
                {h.conteudo && <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{h.conteudo}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

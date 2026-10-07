import React, { useState } from 'react';
import type { AnotacaoPrioridade } from '../../types/Prioridades';
import { analisarAnotacao } from '../../services/prioridadesService';
import { formatarProcessoCnj } from '../../services/prioridadesDjenService';
import { CampoLeitura, StatusBadge } from './PrioridadesUi';
import { formatarDataHora } from './prioridadesUtils';

interface Props {
  anotacao: AnotacaoPrioridade;
  onConcluir: (mensagem: string) => void | Promise<void>;
  onVoltar: () => void;
}

type Decisao = 'resolver' | 'devolver' | 'rejeitar';

/**
 * Tela "Análise de Anotação" (seção 7.4, slide 135).
 *
 * RF-UPJ-03: rádio Resolver / Devolver / Rejeitar, com campos condicionais.
 * Observações Adicionais são de uso interno da UPJ e, por isso, o bloco de
 * observações internas do TJSP Atende (RF-ATD-10) NÃO é exibido aqui.
 */
export const AnaliseAnotacao: React.FC<Props> = ({ anotacao, onConcluir, onVoltar }) => {
  const [decisao, setDecisao] = useState<Decisao>('resolver');
  const [observacaoUpj, setObservacaoUpj] = useState(anotacao.observacao_adicional_upj ?? '');
  const [justificativa, setJustificativa] = useState('');
  const [arquivamentoAutomatico, setArquivamentoAutomatico] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await analisarAnotacao({
        anotacaoId: anotacao.id,
        decisao,
        observacaoUpj,
        justificativa,
        arquivamentoAutomatico,
      });

      if (!resposta.sucesso) {
        setErro(resposta.erro ?? 'Não foi possível concluir a análise.');
        return;
      }

      const rotulo =
        decisao === 'resolver'
          ? `Anotação ${anotacao.id} resolvida pela UPJ.`
          : decisao === 'devolver'
            ? `Anotação ${anotacao.id} devolvida ao TJSP Atende com prazo de 24 h.`
            : `Anotação ${anotacao.id} arquivada (rejeitada pela UPJ).`;
      await onConcluir(rotulo);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Análise de Anotação</h2>
          <StatusBadge status={anotacao.status} />
          {anotacao.urgentissimo && (
            <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">
              ⚡ Urgentíssimo
            </span>
          )}
          {anotacao.resposta_atendente && (
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
        <CampoLeitura label="Data" valor={formatarDataHora(anotacao.data_anotacao)} />
        <CampoLeitura label="Atendente" valor={anotacao.criador_nome} />
        <CampoLeitura label="Gestor/Conferente" valor={anotacao.conferido_por_nome ?? anotacao.conferente_vinculado_nome ?? '—'} />
        <CampoLeitura label="Analista vinculado" valor={anotacao.analista_vinculado_nome ?? '—'} />
        <CampoLeitura label="Processo" valor={<span className="font-mono">{formatarProcessoCnj(anotacao.processo)}</span>} />
        <CampoLeitura label="Vara" valor={anotacao.vara ? `${anotacao.vara}ª` : '—'} />
        <CampoLeitura label="Órgão (DJEN)" valor={anotacao.nome_orgao_djen ?? '—'} />
        <CampoLeitura label="Evento(s)/Folha(s)" valor={anotacao.evento_folha} />
      </dl>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Teor da anotação
        </h3>
        <CampoLeitura label="Solicitante" valor={anotacao.tipo_solicitante} />
        {anotacao.descricao_solicitante && (
          <CampoLeitura label="Descrição do Solicitante" valor={anotacao.descricao_solicitante} />
        )}
        <CampoLeitura label="Tipo de Prioridade/Urgência" valor={anotacao.tipo_prioridade} />
        {anotacao.descricao_tipo_outros && (
          <CampoLeitura label="Descrição do Tipo (Outros)" valor={anotacao.descricao_tipo_outros} />
        )}
        <CampoLeitura label="Descrição da Prioridade/Urgência" valor={anotacao.descricao_prioridade} />

        {anotacao.resposta_atendente && (
          <div className="rounded-md border border-purple-200 bg-purple-50 p-2 dark:border-purple-800 dark:bg-purple-900/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
              Resposta do Atendente à devolução
            </p>
            <p className="mt-1 text-sm text-purple-900 dark:text-purple-100">{anotacao.resposta_atendente}</p>
          </div>
        )}
      </div>

      {erro && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {erro}
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <fieldset>
          <legend className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Decisão da UPJ
          </legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {(
              [
                ['resolver', 'Resolver'],
                ['devolver', 'Devolver'],
                ['rejeitar', 'Rejeitar'],
              ] as Array<[Decisao, string]>
            ).map(([valor, label]) => (
              <label key={valor} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                <input
                  type="radio"
                  name="decisao-upj"
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

        {decisao === 'resolver' && (
          <div>
            <label htmlFor="upj-obs" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Observações Adicionais (uso interno da UPJ)
            </label>
            <textarea
              id="upj-obs"
              rows={3}
              value={observacaoUpj}
              onChange={(e) => setObservacaoUpj(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        )}

        {(decisao === 'devolver' || decisao === 'rejeitar') && (
          <div>
            <label htmlFor="upj-justificativa" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Justificativa <span className="text-red-600">*</span>
            </label>
            <textarea
              id="upj-justificativa"
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        )}

        {decisao === 'rejeitar' && (
          <div className="rounded-md border border-stone-300 bg-stone-50 p-3 dark:border-stone-600 dark:bg-stone-700/40">
            <label className="flex items-center gap-2 text-sm text-stone-800 dark:text-stone-200">
              <input
                type="checkbox"
                checked={arquivamentoAutomatico}
                onChange={(e) => setArquivamentoAutomatico(e.target.checked)}
                className="h-4 w-4"
              />
              Incluir Arquivamento Automático
            </label>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              ⚠️ Comportamento não definido na especificação (pendência 5). O valor é registrado, mas nenhuma ação
              automática é executada até a regra ser homologada.
            </p>
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
            {enviando ? 'Processando…' : decisao === 'devolver' ? 'Enviar Devolução' : 'Arquivar'}
          </button>
        </div>
      </div>
    </div>
  );
};

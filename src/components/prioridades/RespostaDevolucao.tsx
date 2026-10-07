import React, { useEffect, useState } from 'react';
import type { AnotacaoPrioridade } from '../../types/Prioridades';
import { responderDevolucao } from '../../services/prioridadesService';
import { formatarProcessoCnj } from '../../services/prioridadesDjenService';
import { CampoLeitura } from './PrioridadesUi';
import { formatarDataHora, prazoRestante } from './prioridadesUtils';

interface Props {
  anotacao: AnotacaoPrioridade;
  onConcluir: (mensagem: string) => void | Promise<void>;
  onVoltar: () => void;
}

/**
 * Tela "Anotação Devolvida" (seção 7.2, slide 130).
 *
 * RF-ATD-14: justificativa somente leitura, campo de resposta, prazo restante
 * e campos originais em modo somente leitura.
 * RF-ATD-15: contagem regressiva hh:mm e bloqueio do aceite antes do prazo.
 */
export const RespostaDevolucao: React.FC<Props> = ({ anotacao, onConcluir, onVoltar }) => {
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Reavalia o prazo a cada 30 s para a contagem regressiva andar.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const prazo = prazoRestante(anotacao.prazo_resposta_em);
  const justificativa =
    anotacao.devolvida_por === 'upj'
      ? anotacao.justificativa_devolucao_upj
      : anotacao.justificativa_devolucao_gestor;
  const origem = anotacao.devolvida_por === 'upj' ? 'da UPJ' : 'do Gestor';

  const enviar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const r = await responderDevolucao(anotacao.id, resposta);
      if (!r.sucesso) {
        setErro(r.erro ?? 'Não foi possível enviar a resposta.');
        return;
      }
      await onConcluir(
        `Resposta enviada. A anotação ${anotacao.id} retornou para Ag. Conferência do Gestor.`
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Anotação Devolvida</h2>
        <button type="button" onClick={onVoltar} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          Voltar ao painel
        </button>
      </div>

      {/* RF-ATD-15: contagem regressiva abaixo da justificativa. */}
      <div
        className={`rounded-lg border p-3 ${
          prazo.expirado
            ? 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
            : 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
          Prazo para Resposta
        </p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${prazo.expirado ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-200'}`}>
          {prazo.texto}
        </p>
      </div>

      <div>
        <label htmlFor="dev-justificativa" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Justificativa {origem}
        </label>
        <textarea
          id="dev-justificativa"
          rows={3}
          value={justificativa ?? ''}
          readOnly
          disabled
          className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        />
      </div>

      {erro && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {erro}
        </div>
      )}

      <div>
        <label htmlFor="dev-resposta" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Resposta do Atendente <span className="text-red-600">*</span>
        </label>
        <textarea
          id="dev-resposta"
          rows={4}
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          disabled={prazo.expirado}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:disabled:bg-gray-800"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Ao enviar a resposta, a anotação volta para Ag. Conferência (Gestor), mesmo quando a devolução partiu da UPJ.
          Todo o histórico é preservado.
        </p>
      </div>

      {anotacao.correcao_automatica && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-200">
          Existe uma <strong>correção automática engatilhada</strong> pelo Gestor. Se o prazo expirar sem resposta, o
          sistema aplica a correção e remete a anotação à UPJ em vez de rejeitar.
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
          disabled={enviando || prazo.expirado || !resposta.trim()}
          className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {enviando ? 'Enviando…' : 'Enviar Resposta'}
        </button>
      </div>

      {/* Campos originais — inativos, para orientação do Atendente. */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 border-b border-gray-200 pb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Campos da anotação original
        </h3>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoLeitura label="Processo" valor={<span className="font-mono">{formatarProcessoCnj(anotacao.processo)}</span>} />
          <CampoLeitura label="Data da Anotação" valor={formatarDataHora(anotacao.data_anotacao)} />
          <CampoLeitura label="Solicitante" valor={anotacao.tipo_solicitante} />
          <CampoLeitura label="Tipo de Prioridade" valor={anotacao.tipo_prioridade} />
          <CampoLeitura label="Evento(s)/Folha(s)" valor={anotacao.evento_folha} />
          <CampoLeitura label="UPJ" valor={anotacao.nome_orgao_djen ?? '—'} />
          <div className="sm:col-span-2">
            <CampoLeitura label="Descrição da Prioridade/Urgência" valor={anotacao.descricao_prioridade} />
          </div>
        </dl>
      </div>
    </div>
  );
};

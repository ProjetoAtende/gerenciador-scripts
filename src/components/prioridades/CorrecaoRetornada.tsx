import React, { useState } from 'react';
import type { AnotacaoPrioridade } from '../../types/Prioridades';
import { corrigirRetornada } from '../../services/prioridadesService';
import { formatarProcessoCnj } from '../../services/prioridadesDjenService';
import { CampoLeitura, StatusBadge } from './PrioridadesUi';
import { formatarDataHora, prazoRestante } from './prioridadesUtils';

interface Props {
  anotacao: AnotacaoPrioridade;
  onConcluir: (mensagem: string) => void | Promise<void>;
  onVoltar: () => void;
}

/**
 * Correção, pelo Gestor, de anotação Retornada pela UPJ.
 * O reenvio volta à UPJ como Nova e preserva o histórico.
 */
export const CorrecaoRetornada: React.FC<Props> = ({ anotacao, onConcluir, onVoltar }) => {
  const [descricao, setDescricao] = useState(anotacao.descricao_prioridade);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const prazo = prazoRestante(anotacao.prazo_resposta_em);

  const enviar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await corrigirRetornada(anotacao.id, descricao);
      if (!resposta.sucesso) {
        setErro(resposta.erro ?? 'Não foi possível reenviar a anotação.');
        return;
      }
      await onConcluir(`Anotação ${anotacao.id} reenviada à UPJ como Nova.`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Corrigir anotação retornada</h2>
          <StatusBadge status={anotacao.status} />
        </div>
        <button type="button" onClick={onVoltar} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          Voltar ao painel
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <CampoLeitura label="Processo" valor={<span className="font-mono">{formatarProcessoCnj(anotacao.processo)}</span>} />
        <CampoLeitura label="Prazo para correção" valor={prazo.texto} />
        <CampoLeitura label="Retornada em" valor={formatarDataHora(anotacao.data_devolucao)} />
        <CampoLeitura
          label="Rejeição automática"
          valor={anotacao.rejeicao_automatica ? 'Engatilhada se o prazo vencer sem correção' : 'Não'}
        />
      </dl>

      {anotacao.justificativa_devolucao_upj && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100">
          <p className="font-semibold">Justificativa da UPJ</p>
          <p className="mt-1">{anotacao.justificativa_devolucao_upj}</p>
        </div>
      )}

      {erro && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {erro}
        </p>
      )}

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <label htmlFor="correcao-descricao" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Descrição da Prioridade/Urgência
        </label>
        <textarea
          id="correcao-descricao"
          rows={5}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          O reenvio entra na UPJ como Nova. O histórico de movimentações permanece.
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={enviando || !descricao.trim()}
            onClick={() => void enviar()}
            className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-gray-400"
          >
            {enviando ? 'Reenviando…' : 'Reenviar como Nova'}
          </button>
        </div>
      </div>
    </div>
  );
};

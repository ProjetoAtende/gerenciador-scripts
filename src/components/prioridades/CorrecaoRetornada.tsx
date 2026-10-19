import React, { useEffect, useState } from 'react';
import type { AnotacaoPrioridade } from '../../types/Prioridades';
import { aceitarRejeicaoRetorno, corrigirRetornada } from '../../services/prioridadesService';
import { formatarProcessoCnj } from '../../services/prioridadesDjenService';
import { AceitarConfirmacaoDialog } from './AceitarConfirmacaoDialog';
import { CampoLeitura, StatusBadge } from './PrioridadesUi';
import { formatarDataHora, formatarTerminoPrazo, prazoRestante } from './prioridadesUtils';

interface Props {
  anotacao: AnotacaoPrioridade;
  onConcluir: (mensagem: string) => void | Promise<void>;
  onVoltar: () => void;
}

const MSG_ACEITE =
  'Os motivos do retorno foram entendidos e serão utilizados para melhor triagem de anotações no futuro. Aceito a rejeição da anotação, por não se considerar possível sua regularização no caso em questão.';

export const CorrecaoRetornada: React.FC<Props> = ({ anotacao, onConcluir, onVoltar }) => {
  const [descricao, setDescricao] = useState(anotacao.descricao_prioridade);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [dialogAceite, setDialogAceite] = useState(false);
  const [aceitando, setAceitando] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const prazo = prazoRestante(anotacao.prazo_resposta_em);
  const termino = formatarTerminoPrazo(anotacao.prazo_resposta_em);

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

  const confirmarAceite = async () => {
    setErro(null);
    setAceitando(true);
    try {
      const r = await aceitarRejeicaoRetorno(anotacao.id);
      if (!r.sucesso) {
        setErro(r.erro ?? 'Não foi possível registrar a aceitação.');
        return;
      }
      setDialogAceite(false);
      await onConcluir(`Rejeição aceita. A anotação ${anotacao.id} foi arquivada como Rejeitada (UPJ).`);
    } finally {
      setAceitando(false);
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

      <div
        className={`rounded-lg border p-3 ${
          prazo.expirado
            ? 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
            : 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
          Prazo para correção
        </p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${prazo.expirado ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-200'}`}>
          {prazo.texto}
        </p>
        {termino && !prazo.expirado && (
          <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-100/90">{termino}</p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <CampoLeitura label="Processo" valor={<span className="font-mono">{formatarProcessoCnj(anotacao.processo)}</span>} />
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
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={enviando || !descricao.trim()}
            onClick={() => void enviar()}
            className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-gray-400"
          >
            {enviando ? 'Reenviando…' : 'Reenviar como Nova'}
          </button>
          <button
            type="button"
            onClick={() => setDialogAceite(true)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-900/20"
          >
            Aceitar Rejeição
          </button>
        </div>
      </div>

      <AceitarConfirmacaoDialog
        aberto={dialogAceite}
        titulo="Aceitar rejeição"
        mensagem={MSG_ACEITE}
        rotuloConfirmar="Confirmar aceitação"
        enviando={aceitando}
        onCancelar={() => setDialogAceite(false)}
        onConfirmar={confirmarAceite}
      />
    </div>
  );
};

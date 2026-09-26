import React, { useEffect } from 'react';
import { X, RefreshCw, AlertTriangle } from 'lucide-react';
import { PropostaRevisao } from '../services/scriptVersioningService';
import { renderHtmlReadonly } from '../utils/renderHtmlReadonly';
import { BaseAnimatedModal } from './BaseAnimatedModal';

interface PropostaRejeitadaModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposta: PropostaRevisao;
  scriptNome: string;
  onReenviar: () => void;
}

export const PropostaRejeitadaModal: React.FC<PropostaRejeitadaModalProps> = ({
  isOpen,
  onClose,
  proposta,
  scriptNome,
  onReenviar,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const campoLabel = proposta.campo_alvo === 'usuario_final' ? 'Usuário Final' : 'Atendente';
  const dataProposta = new Date(proposta.criado_em).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const limiteAtingido = proposta.tentativa >= 3;

  return (
    <BaseAnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden my-4"
      overlayClassName="items-start pt-8 overflow-y-auto"
      zIndex="z-50"
    >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Proposta Rejeitada — {scriptNome}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Campo: <span className="font-medium">{campoLabel}</span>
                {' · '}{dataProposta}
                {' · '}Tentativa {proposta.tentativa} de 3
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-800/50 rounded-lg transition-colors"
              title="Fechar"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Conteúdo proposto */}
          <div className="px-6 pt-4 pb-2">
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              Sua Proposta (Tentativa {proposta.tentativa})
            </h4>
            <div className="overflow-y-auto max-h-[40vh] border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              {proposta.conteudo_proposto
                ? renderHtmlReadonly(proposta.conteudo_proposto)
                : <em className="text-gray-400">Sem conteúdo</em>
              }
            </div>
          </div>

          {/* Motivação */}
          <div className="px-6 pb-2">
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              Sua Motivação
            </h4>
            <div className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-r-lg p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                "{proposta.motivacao}"
              </p>
            </div>
          </div>

          {/* Razão da rejeição */}
          <div className="px-6 pb-4">
            <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mb-2">
              Razão da Rejeição
            </h4>
            <div className="border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 rounded-r-lg p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {proposta.razao_rejeicao || 'Nenhuma razão informada.'}
              </p>
            </div>
          </div>

          {/* Aviso limite de tentativas */}
          {limiteAtingido && (
            <div className="mx-6 mb-4 flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <span className="text-sm text-yellow-700 dark:text-yellow-300">
                O limite de tentativas foi atingido para esta proposta.
              </span>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
            >
              Fechar
            </button>

            {!limiteAtingido && (
              <button
                onClick={onReenviar}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Revisar e Reenviar (Tentativa {proposta.tentativa + 1} de 3)
              </button>
            )}
          </div>
    </BaseAnimatedModal>
  );
};

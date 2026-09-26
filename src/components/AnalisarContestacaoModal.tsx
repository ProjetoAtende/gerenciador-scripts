import React, { useState, useEffect } from 'react';
import { X, Check, Pencil, MessageSquareWarning } from 'lucide-react';
import { renderHtmlReadonly } from '../utils/renderHtmlReadonly';
import { BaseAnimatedModal } from './BaseAnimatedModal';

export interface ContestacaoCuradoriaData {
  scriptId: string;
  scriptNome: string;
  conteudoOriginal: string;
  conteudoModificado: string;
  campoAlvo: string;
  tipoAlteracao: string;
  motivacaoCuradoria: string;
  razaoContestacao: string;
}

interface AnalisarContestacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  dados: ContestacaoCuradoriaData;
  onAceitarContestacao: () => void;
  onEditarNovamente: () => void;
}

export const AnalisarContestacaoModal: React.FC<AnalisarContestacaoModalProps> = ({
  isOpen,
  onClose,
  dados,
  onAceitarContestacao,
  onEditarNovamente,
}) => {
  const [confirmandoAceite, setConfirmandoAceite] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmandoAceite(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const campoLabel = dados.campoAlvo === 'usuario_final' ? 'Usuário Final' : 'Atendente';
  const tipoLabel =
    dados.tipoAlteracao === 'correcao_grafia' ? 'Correção de grafia' :
    dados.tipoAlteracao === 'substantiva' ? 'Alteração substantiva' :
    dados.tipoAlteracao === 'atualizacao_normativa' ? 'Atualização normativa' :
    dados.tipoAlteracao === 'outro' ? 'Outro' :
    dados.tipoAlteracao === 'correcao_menor' ? 'Correção menor' :
    'Revisão';

  return (
    <BaseAnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden my-4"
      overlayClassName="items-start pt-8 overflow-y-auto"
      zIndex="z-50"
    >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-orange-50 dark:bg-orange-900/30 border-b border-orange-200 dark:border-orange-800">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Contestação Recebida — {dados.scriptNome}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Campo: <span className="font-medium">{campoLabel}</span>
                {' · '}Tipo da revisão: <span className="font-medium">{tipoLabel}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-orange-100 dark:hover:bg-orange-800/50 rounded-lg transition-colors"
              title="Fechar"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Banner de contestação */}
          <div className="mx-6 mt-4 flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg">
            <MessageSquareWarning size={20} className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-1">
                Razão da contestação do autor:
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                "{dados.razaoContestacao}"
              </p>
            </div>
          </div>

          {/* Diff View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-gray-200 dark:divide-gray-700 px-6 py-4">
            {/* Texto Original do Autor */}
            <div className="pr-0 md:pr-4 pb-4 md:pb-0">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                Texto Original do Autor
              </h4>
              <div className="overflow-y-auto max-h-[50vh] border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {dados.conteudoOriginal
                  ? renderHtmlReadonly(dados.conteudoOriginal)
                  : <em className="text-gray-400">Sem conteúdo</em>
                }
              </div>
            </div>

            {/* Sua Revisão (Curadoria) */}
            <div className="pl-0 md:pl-4">
              <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Sua Revisão
              </h4>
              <div className="overflow-y-auto max-h-[50vh] border border-blue-200 dark:border-blue-700 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/10 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {dados.conteudoModificado
                  ? renderHtmlReadonly(dados.conteudoModificado)
                  : <em className="text-gray-400">Sem conteúdo</em>
                }
              </div>
            </div>
          </div>

          {/* Motivação original da curadoria */}
          <div className="px-6 pb-4">
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              Sua Motivação Original
            </h4>
            <div className="border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-r-lg p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                "{dados.motivacaoCuradoria}"
              </p>
            </div>
          </div>

          {/* Confirmação de aceite */}
          {confirmandoAceite && (
            <div className="px-6 pb-4">
              <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  <strong>Confirmar:</strong> O conteúdo do script será revertido ao texto original do autor e a revisão será desfeita. Clique novamente para confirmar.
                </p>
              </div>
            </div>
          )}

          {/* Footer com botões */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <button
              onClick={() => {
                if (confirmandoAceite) { setConfirmandoAceite(false); }
                else { onClose(); }
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
            >
              {confirmandoAceite ? 'Voltar' : 'Fechar'}
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (!confirmandoAceite) { setConfirmandoAceite(true); return; }
                  onAceitarContestacao();
                }}
                disabled={false}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <Check size={16} />
                {confirmandoAceite ? 'Confirmar Reversão' : 'Aceitar Contestação'}
              </button>

              <button
                onClick={onEditarNovamente}
                disabled={confirmandoAceite}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <Pencil size={16} />
                Editar Novamente
              </button>
            </div>
          </div>
    </BaseAnimatedModal>
  );
};

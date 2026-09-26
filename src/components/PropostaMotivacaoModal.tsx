import React, { useState, useEffect } from 'react';
import { X, Send, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { criarProposta, reenviarProposta, criarNotificacao } from '../services/scriptVersioningService';
import { BaseAnimatedModal } from './BaseAnimatedModal';

interface PropostaMotivacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptId: string;
  scriptNome: string;
  campoAlvo: 'usuario_final' | 'atendente';
  conteudoProposto: string;
  propostaIdReenvio?: string | null;
  curadorAnteriorId?: string | null;
  onSuccess: () => void;
}

export const PropostaMotivacaoModal: React.FC<PropostaMotivacaoModalProps> = ({
  isOpen,
  onClose,
  scriptId,
  scriptNome,
  campoAlvo,
  conteudoProposto,
  propostaIdReenvio,
  curadorAnteriorId,
  onSuccess,
}) => {
  const [motivacao, setMotivacao] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (isOpen) setMotivacao('');
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleEnviar = async () => {
    if (motivacao.trim().length < 20) {
      toast.error('A motivação deve ter pelo menos 20 caracteres.');
      return;
    }
    setEnviando(true);
    try {
      if (propostaIdReenvio) {
        await reenviarProposta(propostaIdReenvio, conteudoProposto, motivacao.trim());
        // Notificar curador que rejeitou sobre o reenvio
        if (curadorAnteriorId) {
          try {
            await criarNotificacao(
              curadorAnteriorId,
              scriptId,
              'proposta_reenviada',
              `Proposta de revisão reenviada para o script "${scriptNome}" (campo ${campoAlvo === 'usuario_final' ? 'Usuário Final' : 'Atendente'}).`,
              propostaIdReenvio
            );
          } catch (e) {
            console.warn('Erro ao notificar curador sobre reenvio (não crítico):', e);
          }
        }
        toast.success('Proposta reenviada com sucesso! A Curadoria será notificada.');
      } else {
        const novaPropostaId = await criarProposta(scriptId, campoAlvo, conteudoProposto, motivacao.trim());
        // Notificar apenas o curador que já revisou este script anteriormente
        if (curadorAnteriorId) {
          try {
            await criarNotificacao(
              curadorAnteriorId,
              scriptId,
              'proposta_recebida',
              `Nova proposta de revisão para o script "${scriptNome}" (campo ${campoAlvo === 'usuario_final' ? 'Usuário Final' : 'Atendente'}).`,
              novaPropostaId
            );
          } catch (e) {
            console.warn('Erro ao notificar curador anterior (não crítico):', e);
          }
        }
        toast.success('Proposta de revisão enviada com sucesso!');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao criar proposta:', error);
      toast.error(error.message || 'Erro ao enviar proposta de revisão.');
    } finally {
      setEnviando(false);
    }
  };

  const campoLabel = campoAlvo === 'usuario_final' ? 'Usuário Final' : 'Atendente';

  return (
    <BaseAnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
    >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <FileText size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Proposta de Revisão</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Campo: {campoLabel}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-800/50 rounded-lg transition-colors"
              title="Fechar"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                📋 Sua proposta será analisada pela Curadoria. O script atual permanecerá inalterado até a aprovação.
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Script: <strong className="text-gray-800 dark:text-gray-100">{scriptNome}</strong>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Motivação da proposta <span className="text-red-500">*</span>
              </label>
              <textarea
                value={motivacao}
                onChange={(e) => setMotivacao(e.target.value)}
                placeholder="Descreva por que esta alteração é necessária (mínimo 20 caracteres)..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 resize-none"
              />
              <p className={`text-xs mt-1 ${motivacao.trim().length < 20 ? 'text-gray-400 dark:text-gray-500' : 'text-green-600 dark:text-green-400'}`}>
                {motivacao.trim().length}/20 caracteres mínimos
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleEnviar}
              disabled={enviando || motivacao.trim().length < 20}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 dark:disabled:bg-amber-800 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
            >
              {enviando ? 'Enviando...' : 'Enviar Proposta'}
              {!enviando && <Send size={16} />}
            </button>
          </div>
    </BaseAnimatedModal>
  );
};

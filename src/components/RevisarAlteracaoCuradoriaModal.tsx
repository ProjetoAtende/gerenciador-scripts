import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';
import { criarNotificacao } from '../services/scriptVersioningService';
import { renderHtmlReadonly } from '../utils/renderHtmlReadonly';

export interface RevisaoCuradoriaData {
  scriptId: string;
  scriptNome: string;
  conteudoOriginal: string;
  conteudoModificado: string;
  campoAlvo: string;
  tipoAlteracao: string;
  motivacao: string;
  curadorId: string;
  curadorNome: string;
}

interface RevisarAlteracaoCuradoriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  dados: RevisaoCuradoriaData;
  onAceita: () => void;
  onContestada: () => void;
}

export const RevisarAlteracaoCuradoriaModal: React.FC<RevisarAlteracaoCuradoriaModalProps> = ({
  isOpen,
  onClose,
  dados,
  onAceita,
  onContestada,
}) => {
  const [modoContestacao, setModoContestacao] = useState(false);
  const [razaoContestacao, setRazaoContestacao] = useState('');
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setModoContestacao(false);
      setRazaoContestacao('');
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

  const handleAceitar = () => {
    toast.success('Revisão da curadoria aceita.');
    onAceita();
    onClose();
  };

  const handleContestar = async () => {
    if (!modoContestacao) {
      setModoContestacao(true);
      return;
    }
    if (razaoContestacao.trim().length < 10) {
      toast.error('A contestação deve ter pelo menos 10 caracteres.');
      return;
    }
    setProcessando(true);
    try {
      await criarNotificacao(
        dados.curadorId,
        dados.scriptId,
        'contestacao_revisao_inicial',
        `O autor do script "${dados.scriptNome}" contestou a revisão (${tipoLabel}): "${razaoContestacao.trim()}"`,
        undefined,
        {
          campo_alvo: dados.campoAlvo,
          tipo_motivacao: dados.tipoAlteracao,
          motivacao_curadoria: dados.motivacao,
          curador_id: dados.curadorId,
          razao_contestacao: razaoContestacao.trim(),
        }
      );
      toast.success('Contestação enviada ao curador.');
      onContestada();
      onClose();
    } catch (error) {
      console.error('Erro ao enviar contestação:', error);
      toast.error('Erro ao enviar contestação.');
    } finally {
      setProcessando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden my-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Revisão da Curadoria — {dados.scriptNome}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Campo: <span className="font-medium">{campoLabel}</span>
                {' · '}Tipo: <span className="font-medium">{tipoLabel}</span>
                {' · '}Revisado por: <span className="font-medium">{dados.curadorNome}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded-lg transition-colors"
              title="Fechar"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Diff View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-gray-200 dark:divide-gray-700 px-6 py-4">
            {/* Versão Original */}
            <div className="pr-0 md:pr-4 pb-4 md:pb-0">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                Seu Texto Original
              </h4>
              <div className="overflow-y-auto max-h-[60vh] border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {dados.conteudoOriginal
                  ? renderHtmlReadonly(dados.conteudoOriginal)
                  : <em className="text-gray-400">Sem conteúdo</em>
                }
              </div>
            </div>

            {/* Versão da Curadoria */}
            <div className="pl-0 md:pl-4">
              <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Versão da Curadoria
              </h4>
              <div className="overflow-y-auto max-h-[60vh] border border-blue-200 dark:border-blue-700 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/10 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {dados.conteudoModificado
                  ? renderHtmlReadonly(dados.conteudoModificado)
                  : <em className="text-gray-400">Sem conteúdo</em>
                }
              </div>
            </div>
          </div>

          {/* Motivação da Curadoria */}
          <div className="px-6 pb-4">
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              Motivação da Curadoria
            </h4>
            <div className="border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-r-lg p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                "{dados.motivacao}"
              </p>
            </div>
          </div>

          {/* Área de contestação (expandível) */}
          {modoContestacao && (
            <div className="px-6 pb-4">
              <div className="border border-orange-200 dark:border-orange-800 rounded-lg p-4 bg-orange-50 dark:bg-orange-900/20">
                <label className="block text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">
                  Razão da contestação <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={razaoContestacao}
                  onChange={(e) => setRazaoContestacao(e.target.value)}
                  placeholder="Explique por que discorda da alteração feita pela curadoria (mínimo 10 caracteres)..."
                  rows={3}
                  className="w-full px-3 py-2 border border-orange-300 dark:border-orange-700 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                />
                <p className={`text-xs mt-1 ${razaoContestacao.trim().length < 10 ? 'text-gray-400' : 'text-green-600 dark:text-green-400'}`}>
                  {razaoContestacao.trim().length}/10 caracteres mínimos
                </p>
              </div>
            </div>
          )}

          {/* Footer com botões */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <button
              onClick={() => {
                if (modoContestacao) { setModoContestacao(false); setRazaoContestacao(''); }
                else { onClose(); }
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
            >
              {modoContestacao ? 'Voltar' : 'Fechar'}
            </button>

            <div className="flex gap-3">
              <button
                onClick={handleContestar}
                disabled={processando}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 dark:disabled:bg-orange-800 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <MessageSquareWarning size={16} />
                {modoContestacao ? 'Confirmar Contestação' : 'Contestar'}
              </button>

              <button
                onClick={handleAceitar}
                disabled={processando || modoContestacao}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 dark:disabled:bg-green-800 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <Check size={16} />
                Aceitar
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, AlertCircle } from 'lucide-react';

interface ConfirmPublicarScriptModalProps {
  isOpen: boolean;
  scriptNome: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmPublicarScriptModal: React.FC<ConfirmPublicarScriptModalProps> = ({
  isOpen,
  scriptNome,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
        onClick={() => !loading && onCancel()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <Send size={22} />
              <h2 className="text-lg font-bold">Publicar script</h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-white/20 disabled:opacity-50"
              title="Fechar"
            >
              <X size={20} className="text-white" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              O script <strong className="break-words">{scriptNome}</strong> ficará disponível como
              referência oficial para a equipe. A curadoria será avisada no sininho de notificações.
            </p>
            <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                Após publicado, alterações de usuários comuns passam pelo fluxo de proposta de revisão.
              </span>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Publicando…' : 'Confirmar publicação'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

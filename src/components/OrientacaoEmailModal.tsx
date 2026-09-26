// src/components/OrientacaoEmailModal.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Send, Pencil, ArrowRight } from 'lucide-react';

interface OrientacaoEmailModalProps {
  isOpen: boolean;
  scriptNome: string;
  onClose: () => void;
}

export const OrientacaoEmailModal: React.FC<OrientacaoEmailModalProps> = ({
  isOpen,
  scriptNome,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header com ícone de sucesso */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white dark:bg-gray-100 rounded-full mb-3">
              <CheckCircle className="text-green-500" size={36} />
            </div>
            <h2 className="text-xl font-bold text-white">Script Salvo com Sucesso!</h2>
            <p className="text-green-100 text-sm mt-1 truncate px-4">{scriptNome}</p>
          </div>

          {/* Conteúdo */}
          <div className="p-6">
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Send className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                <div>
                  <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-1">
                    Publique o script
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    Preencha o chamado e a pergunta no card, depois use <strong>Publicar script</strong>.
                    A curadoria será avisada no sininho de notificações.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-center mb-4">
              <ArrowRight className="text-gray-400" size={20} />
            </div>

            {/* Sugestão: Script para atendente */}
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Pencil className="text-orange-600 flex-shrink-0 mt-1" size={20} />
                <div>
                  <h3 className="font-medium text-orange-800 dark:text-orange-300 mb-1">
                    Sugestão: Script para o Atendente
                  </h3>
                  <p className="text-sm text-orange-700 dark:text-orange-400 mb-2">
                    Quando aplicável, considere criar também um script para o atendente. Ele serve para orientar o serventuário do tribunal sobre os procedimentos necessários para viabilizar a solução da demanda do usuário.
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-400">
                    Para isso, clique no botão <strong>✏️</strong> (lápis) no card do script e selecione <strong>"Script para o Atendente"</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-600 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Entendi
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

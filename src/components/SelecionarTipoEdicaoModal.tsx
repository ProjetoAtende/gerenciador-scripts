import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Wrench, ClipboardList } from 'lucide-react';

interface SelecionarTipoEdicaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (tipo: 'usuario_final' | 'atendente') => void;
  /** Se o usuário é curadoria (admin ou coord 3.2) */
  isCuradoria?: boolean;
  /** Proposta pendente ativa no script (se houver) */
  propostaPendente?: { campo_alvo: 'usuario_final' | 'atendente'; id: string } | null;
  /** Callback ao selecionar "Analisar proposta" (curadoria) */
  onSelectProposta?: (propostaId: string) => void;
}

export const SelecionarTipoEdicaoModal: React.FC<SelecionarTipoEdicaoModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  isCuradoria,
  propostaPendente,
  onSelectProposta,
}) => {
  // Fechar com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Qual conteúdo deseja editar?</h3>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Fechar"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Cards de seleção */}
          <div className="p-6 space-y-3">
            {/* Botão: Script para o usuário final */}
            {(() => {
              const desabilitado = isCuradoria && propostaPendente?.campo_alvo === 'usuario_final';
              return (
                <button
                  onClick={() => !desabilitado && onSelect('usuario_final')}
                  disabled={desabilitado}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left group ${
                    desabilitado
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60 cursor-not-allowed'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                  }`}
                  title={desabilitado ? 'Resolva a proposta de revisão pendente antes de editar este campo.' : undefined}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    desabilitado
                      ? 'bg-gray-100 dark:bg-gray-700'
                      : 'bg-blue-100 dark:bg-blue-900/50 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50'
                  }`}>
                    <Users size={24} className={desabilitado ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'} />
                  </div>
                  <div>
                    <p className={`font-medium transition-colors ${
                      desabilitado
                        ? 'text-gray-400 dark:text-gray-500'
                        : 'text-gray-800 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-400'
                    }`}>Script para o usuário final</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {desabilitado ? 'Proposta de revisão pendente neste campo' : 'Editar o conteúdo que será enviado ao usuário'}
                    </p>
                  </div>
                </button>
              );
            })()}

            {/* Botão: Script para o atendente */}
            {(() => {
              const desabilitado = isCuradoria && propostaPendente?.campo_alvo === 'atendente';
              return (
                <button
                  onClick={() => !desabilitado && onSelect('atendente')}
                  disabled={desabilitado}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left group ${
                    desabilitado
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60 cursor-not-allowed'
                      : 'border-gray-200 dark:border-gray-600 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30'
                  }`}
                  title={desabilitado ? 'Resolva a proposta de revisão pendente antes de editar este campo.' : undefined}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    desabilitado
                      ? 'bg-gray-100 dark:bg-gray-700'
                      : 'bg-orange-100 dark:bg-orange-900/50 group-hover:bg-orange-200 dark:group-hover:bg-orange-800/50'
                  }`}>
                    <Wrench size={24} className={desabilitado ? 'text-gray-400' : 'text-orange-600 dark:text-orange-400'} />
                  </div>
                  <div>
                    <p className={`font-medium transition-colors ${
                      desabilitado
                        ? 'text-gray-400 dark:text-gray-500'
                        : 'text-gray-800 dark:text-gray-200 group-hover:text-orange-700 dark:group-hover:text-orange-400'
                    }`}>Script para o atendente</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {desabilitado ? 'Proposta de revisão pendente neste campo' : 'Editar orientações internas para resolução'}
                    </p>
                  </div>
                </button>
              );
            })()}

            {/* Botão: Analisar proposta (curadoria apenas) */}
            {isCuradoria && propostaPendente && onSelectProposta && (
              <button
                onClick={() => onSelectProposta(propostaPendente.id)}
                className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-amber-300 dark:border-amber-700 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all text-left group"
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-200 dark:group-hover:bg-amber-800/50 transition-colors">
                  <ClipboardList size={24} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                    📋 Proposta de revisão – {propostaPendente.campo_alvo === 'usuario_final' ? 'Usuário final' : 'Atendente'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Analisar a proposta de revisão pendente</p>
                </div>
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
            >
              Cancelar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

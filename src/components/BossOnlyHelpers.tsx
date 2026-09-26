import React from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, AlertCircle } from 'lucide-react';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  loading?: boolean;
  confirmText?: string;
}

export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  onConfirm,
  loading = false,
  confirmText = 'Salvar'
}) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10001] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {children}
        </div>
        <div className="flex justify-end gap-3 p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {confirmText}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const ConfirmDeleteModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  itemName: string;
}> = ({ isOpen, onClose, onConfirm, loading, itemName }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10001] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full">
            <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Confirmar exclusao</h3>
        </div>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Tem certeza que deseja excluir <strong>{itemName}</strong>? Esta acao nao pode ser desfeita.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Excluir
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

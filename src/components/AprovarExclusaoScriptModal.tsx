/**
 * Modal para curadoria aprovar ou negar exclusão de script solicitada
 */

import { Check, X } from 'lucide-react';

interface AprovarExclusaoScriptModalProps {
  isOpen: boolean;
  scriptNome: string;
  motivo?: string | null;
  loading: boolean;
  onCancel: () => void;
  onAprovar: () => Promise<void>;
  onNegar: () => Promise<void>;
}

export function AprovarExclusaoScriptModal({
  isOpen,
  scriptNome,
  motivo,
  loading,
  onCancel,
  onAprovar,
  onNegar,
}: AprovarExclusaoScriptModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Aprovar Exclusão
          </h3>
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 rounded">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Este script possui solicitação de exclusão pendente. Aprove para desativá-lo ou negue para mantê-lo ativo.
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Script:</p>
            <p className="font-medium text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 p-2 rounded border dark:border-gray-600">
              {scriptNome}
            </p>
          </div>

          {motivo && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo informado:</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-700/50 p-3 rounded border dark:border-gray-600">
                &ldquo;{motivo}&rdquo;
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onNegar}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-500 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <X size={16} />
            Negar
          </button>
          <button
            onClick={onAprovar}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Check size={16} />
            {loading ? 'Processando...' : 'Aprovar Exclusão'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal de confirmação de exclusão de script
 * Mostra diferentes mensagens conforme o tipo de exclusão (hard/soft)
 */

import { useState } from 'react';
import { X } from 'lucide-react';

interface ConfirmarExclusaoScriptModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: (motivo?: string) => Promise<void>;
  scriptNome: string;
  tipoExclusao: 'hard' | 'soft';
  loading: boolean;
}

export function ConfirmarExclusaoScriptModal({
  isOpen,
  onCancel,
  onConfirm,
  scriptNome,
  tipoExclusao,
  loading,
}: ConfirmarExclusaoScriptModalProps) {
  const [motivo, setMotivo] = useState('');

  if (!isOpen) return null;

  const handleConfirmar = async () => {
    await onConfirm(motivo.trim() || undefined);
    setMotivo(''); // Limpar campo após confirmação
  };

  const handleClose = () => {
    if (!loading) {
      setMotivo('');
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {tipoExclusao === 'hard' ? 'Confirmar Exclusão' : 'Solicitar Exclusão'}
          </h3>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-4">
          {/* Mensagem de alerta conforme tipo de exclusão */}
          {tipoExclusao === 'hard' ? (
            <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">Exclusão Permanente</h4>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    Este script será <strong>excluído permanentemente</strong> e não poderá ser recuperado.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-4 rounded">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Aprovação Necessária</h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                    Este script já foi publicado ou revisado pela curadoria. Sua solicitação será enviada para aprovação da curadoria de scripts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Nome do script */}
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Script:</p>
            <p className="font-medium text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 p-2 rounded border dark:border-gray-600">
              {scriptNome}
            </p>
          </div>

          {/* Campo de motivo (obrigatório para soft delete, opcional para hard) */}
          <div>
            <label htmlFor="motivo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tipoExclusao === 'soft' ? 'Motivo da exclusão *' : 'Motivo da exclusão (opcional)'}
            </label>
            <textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explique por que este script deve ser excluído..."
              rows={3}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed resize-none dark:bg-gray-700 dark:text-gray-200"
              required={tipoExclusao === 'soft'}
            />
            {tipoExclusao === 'soft' && motivo.trim().length === 0 && (
              <p className="text-xs text-gray-500 mt-1">
                * Campo obrigatório para solicitações de exclusão
              </p>
            )}
          </div>
        </div>

        {/* Footer com botões */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={loading || (tipoExclusao === 'soft' && motivo.trim().length === 0)}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
              tipoExclusao === 'hard'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-yellow-600 hover:bg-yellow-700'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processando...
              </>
            ) : tipoExclusao === 'hard' ? (
              'Excluir Permanentemente'
            ) : (
              'Solicitar Exclusão'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';

interface Props {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  rotuloConfirmar: string;
  enviando: boolean;
  onCancelar: () => void;
  onConfirmar: () => void | Promise<void>;
}

/**
 * Confirmação com digitação expressa de "ACEITO" (correções finais 03/2026).
 */
export const AceitarConfirmacaoDialog: React.FC<Props> = ({
  aberto,
  titulo,
  mensagem,
  rotuloConfirmar,
  enviando,
  onCancelar,
  onConfirmar,
}) => {
  const [texto, setTexto] = useState('');

  if (!aberto) return null;

  const aceito = texto.trim() === 'ACEITO';

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-600 dark:bg-gray-800">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{titulo}</h3>
        <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200">{mensagem}</p>
        <label htmlFor="aceitar-texto" className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-200">
          Digite <span className="font-mono">ACEITO</span> para confirmar
        </label>
        <input
          id="aceitar-texto"
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setTexto('');
              onCancelar();
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!aceito || enviando}
            onClick={() => {
              void Promise.resolve(onConfirmar()).finally(() => setTexto(''));
            }}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {enviando ? 'Processando…' : rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
};

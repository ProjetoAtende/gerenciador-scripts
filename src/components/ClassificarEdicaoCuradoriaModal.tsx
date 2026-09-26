import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { BaseAnimatedModal } from './BaseAnimatedModal';

type TipoAlteracao = 'correcao_grafia' | 'substantiva' | 'atualizacao_normativa' | 'outro';

interface ClassificarEdicaoCuradoriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tipo: TipoAlteracao, motivacao: string) => void;
  contexto?: 'revisao_inicial' | 'edicao_posterior';
}

const OPCOES: { valor: TipoAlteracao; titulo: string; descricao: string }[] = [
  {
    valor: 'correcao_grafia',
    titulo: 'Correção menor',
    descricao: 'Pontuação, grafia, formatação — sem mudança de conteúdo.',
  },
  {
    valor: 'substantiva',
    titulo: 'Alteração substantiva',
    descricao: 'Mudança significativa no conteúdo do script.',
  },
  {
    valor: 'atualizacao_normativa',
    titulo: 'Atualização normativa',
    descricao: 'Alteração motivada por mudança de norma ou regulamento.',
  },
  {
    valor: 'outro',
    titulo: 'Outro',
    descricao: 'Motivo não contemplado nas opções acima.',
  },
];

export const ClassificarEdicaoCuradoriaModal: React.FC<ClassificarEdicaoCuradoriaModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  contexto = 'revisao_inicial',
}) => {
  const [tipo, setTipo] = useState<TipoAlteracao | null>(null);
  const [motivacao, setMotivacao] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTipo(null);
      setMotivacao('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const canConfirm = tipo !== null && motivacao.trim().length >= 20;
  const titulo = contexto === 'edicao_posterior' ? 'Classificar Edição' : 'Classificar Revisão Inicial';

  return (
    <BaseAnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
    >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {titulo}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded-lg transition-colors"
              title="Fechar"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Opções */}
          <div className="px-6 py-4 space-y-3">
            {OPCOES.map((opcao) => (
              <label
                key={opcao.valor}
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  tipo === opcao.valor
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="tipo_alteracao"
                  value={opcao.valor}
                  checked={tipo === opcao.valor}
                  onChange={() => setTipo(opcao.valor)}
                  className="mt-1 accent-blue-600"
                />
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{opcao.titulo}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{opcao.descricao}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Motivação */}
          <div className="px-6 pb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Motivação <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motivacao}
              onChange={(e) => setMotivacao(e.target.value)}
              placeholder="Descreva a alteração realizada (mínimo 20 caracteres)..."
              rows={3}
              className={`w-full px-3 py-2 border-2 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500 resize-none ${
                motivacao.trim().length < 20
                  ? 'border-red-400 dark:border-red-500 focus:border-red-500'
                  : 'border-green-400 dark:border-green-500 focus:border-green-500'
              }`}
            />
            <p className={`text-xs mt-1 ${motivacao.trim().length < 20 ? 'text-gray-400' : 'text-green-600 dark:text-green-400'}`}>
              {motivacao.trim().length}/20 caracteres mínimos
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={() => tipo && canConfirm && onConfirm(tipo, motivacao.trim())}
              disabled={!canConfirm}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white rounded-lg transition-colors font-medium"
            >
              Confirmar
            </button>
          </div>
    </BaseAnimatedModal>
  );
};

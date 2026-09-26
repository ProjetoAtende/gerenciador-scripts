import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, XCircle, AlertTriangle, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import { PropostaRevisao, aprovarProposta, aprovarPropostaComEdicao, rejeitarProposta, criarNotificacao } from '../services/scriptVersioningService';
import { renderHtmlReadonly } from '../utils/renderHtmlReadonly';
import { RichTextEditor } from './RichTextEditor';

interface AnalisarPropostaModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposta: PropostaRevisao;
  scriptAtual: {
    id: string;
    nome: string;
    conteudo_bruto?: string;
    conteudo_atendente?: string;
    curadoria_atuada: boolean;
    numero_chamado?: string;
  };
  autorPropostaNome: string;
  onAprovada: () => void;
  onRejeitada: () => void;
}

export const AnalisarPropostaModal: React.FC<AnalisarPropostaModalProps> = ({
  isOpen,
  onClose,
  proposta,
  scriptAtual,
  autorPropostaNome,
  onAprovada,
  onRejeitada,
}) => {
  const [modoRejeicao, setModoRejeicao] = useState(false);
  const [razaoRejeicao, setRazaoRejeicao] = useState('');
  const [confirmandoAprovacao, setConfirmandoAprovacao] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [conteudoEditado, setConteudoEditado] = useState('');
  const [confirmandoEdicao, setConfirmandoEdicao] = useState(false);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setModoRejeicao(false);
      setRazaoRejeicao('');
      setConfirmandoAprovacao(false);
      setModoEdicao(false);
      setConteudoEditado('');
      setConfirmandoEdicao(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const conteudoAtual = proposta.campo_alvo === 'usuario_final'
    ? scriptAtual.conteudo_bruto || ''
    : scriptAtual.conteudo_atendente || '';

  const campoLabel = proposta.campo_alvo === 'usuario_final' ? 'Usuário Final' : 'Atendente';
  const dataProposta = new Date(proposta.criado_em).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const handleAprovar = async () => {
    if (!confirmandoAprovacao) {
      setConfirmandoAprovacao(true);
      return;
    }
    setProcessando(true);
    try {
      const resultado = await aprovarProposta(proposta.id);
      try {
        await criarNotificacao(
          proposta.autor_id,
          resultado.script_id,
          'proposta_aprovada',
          `Sua proposta de revisão para o campo "${campoLabel}" do script "${scriptAtual.nome}" foi revisada e aceita! Versão ${resultado.versao} criada.`,
          proposta.id
        );
      } catch (e) {
        console.warn('Erro ao criar notificação de aprovação (não crítico):', e);
      }
      toast.success('Proposta revisada com sucesso! Nova versão criada.');
      onAprovada();
      onClose();
    } catch (error: any) {
      console.error('Erro ao aprovar proposta:', error);
      toast.error(error.message || 'Erro ao revisar proposta.');
    } finally {
      setProcessando(false);
      setConfirmandoAprovacao(false);
    }
  };

  const handleAceitarComEdicao = () => {
    setModoEdicao(true);
    setConteudoEditado(proposta.conteudo_proposto);
    setConfirmandoAprovacao(false);
    setModoRejeicao(false);
  };

  const handleConfirmarEdicao = async () => {
    if (!confirmandoEdicao) {
      setConfirmandoEdicao(true);
      return;
    }
    if (!conteudoEditado.trim()) {
      toast.error('O conteúdo editado não pode ficar vazio.');
      return;
    }
    setProcessando(true);
    try {
      const resultado = await aprovarPropostaComEdicao(proposta.id, conteudoEditado);
      try {
        await criarNotificacao(
          proposta.autor_id,
          resultado.script_id,
          'proposta_aprovada',
          `Sua proposta de revisão para o campo "${campoLabel}" do script "${scriptAtual.nome}" foi aprovada com modificações pelo revisor. Versão ${resultado.versao} criada.`,
          proposta.id
        );
      } catch (e) {
        console.warn('Erro ao criar notificação de aprovação editada (não crítico):', e);
      }
      toast.success('Proposta aprovada com edições! Nova versão criada.');
      onAprovada();
      onClose();
    } catch (error: any) {
      console.error('Erro ao aprovar proposta com edição:', error);
      toast.error(error.message || 'Erro ao aprovar proposta com edição.');
    } finally {
      setProcessando(false);
      setConfirmandoEdicao(false);
    }
  };

  const handleRejeitar = async () => {
    if (!modoRejeicao) {
      setModoRejeicao(true);
      return;
    }
    if (razaoRejeicao.trim().length < 10) {
      toast.error('A razão da rejeição deve ter pelo menos 10 caracteres.');
      return;
    }
    setProcessando(true);
    try {
      const resultado = await rejeitarProposta(proposta.id, razaoRejeicao.trim());
      try {
        await criarNotificacao(
          proposta.autor_id,
          resultado.script_id,
          'proposta_rejeitada',
          `Sua proposta de revisão para o campo "${campoLabel}" do script "${scriptAtual.nome}" foi rejeitada. Tentativa ${resultado.tentativa} de 3.`,
          proposta.id
        );
      } catch (e) {
        console.warn('Erro ao criar notificação de rejeição (não crítico):', e);
      }
      toast.success('Proposta rejeitada.');
      onRejeitada();
      onClose();
    } catch (error: any) {
      console.error('Erro ao rejeitar proposta:', error);
      toast.error(error.message || 'Erro ao rejeitar proposta.');
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
          <div className="flex items-center justify-between px-6 py-4 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Proposta de Revisão — {scriptAtual.nome}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Campo: <span className="font-medium">{campoLabel}</span>
                {' · '}Proposta por: <span className="font-medium">{autorPropostaNome}</span>
                {' · '}{dataProposta}
                {' · '}Tentativa {proposta.tentativa} de 3
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-800/50 rounded-lg transition-colors"
              title="Fechar"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Banner script não revisado */}
          {!scriptAtual.curadoria_atuada && (
            <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <span className="text-sm text-yellow-700 dark:text-yellow-300">
                Este script ainda não foi revisado pela Curadoria.
              </span>
            </div>
          )}

          {/* Diff View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-gray-200 dark:divide-gray-700 px-6 py-4">
            {/* Versão Atual */}
            <div className="pr-0 md:pr-4 pb-4 md:pb-0">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                Versão Atual
              </h4>
              <div className="overflow-y-auto max-h-[60vh] border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {conteudoAtual
                  ? renderHtmlReadonly(conteudoAtual)
                  : <em className="text-gray-400">Sem conteúdo</em>
                }
              </div>
            </div>

            {/* Versão Proposta / Editor */}
            <div className="pl-0 md:pl-4">
              <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${modoEdicao ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                {modoEdicao ? 'Editando Proposta' : 'Versão Proposta'}
              </h4>
              {modoEdicao ? (
                <div className="border border-blue-300 dark:border-blue-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900" style={{ maxHeight: '60vh', overflow: 'auto' }}>
                  <RichTextEditor
                    value={conteudoEditado}
                    onChange={setConteudoEditado}
                    placeholder="Edite o conteúdo da proposta..."
                  />
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[60vh] border border-amber-200 dark:border-amber-700 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-900/10 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {proposta.conteudo_proposto
                    ? renderHtmlReadonly(proposta.conteudo_proposto)
                    : <em className="text-gray-400">Sem conteúdo</em>
                  }
                </div>
              )}
            </div>
          </div>

          {/* Motivação */}
          <div className="px-6 pb-4">
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              Motivação
            </h4>
            <div className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-r-lg p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                "{proposta.motivacao}"
              </p>
            </div>
          </div>

          {/* Área de rejeição (expandível) */}
          {modoRejeicao && (
            <div className="px-6 pb-4">
              <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
                <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                  Razão da rejeição <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={razaoRejeicao}
                  onChange={(e) => setRazaoRejeicao(e.target.value)}
                  placeholder="Explique por que a proposta está sendo rejeitada (mínimo 10 caracteres)..."
                  rows={3}
                  className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                />
                <p className={`text-xs mt-1 ${razaoRejeicao.trim().length < 10 ? 'text-gray-400' : 'text-green-600 dark:text-green-400'}`}>
                  {razaoRejeicao.trim().length}/10 caracteres mínimos
                </p>
              </div>
            </div>
          )}

          {/* Confirmação de aprovação integral */}
          {confirmandoAprovacao && !modoRejeicao && !modoEdicao && (
            <div className="px-6 pb-4">
              <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
                <p className="text-sm text-green-700 dark:text-green-300">
                  <strong>Confirmar revisão?</strong> O conteúdo do script será atualizado e uma nova versão será criada. Clique em "Confirmar Revisão" para prosseguir.
                </p>
              </div>
            </div>
          )}

          {/* Confirmação de aprovação com edição */}
          {confirmandoEdicao && modoEdicao && (
            <div className="px-6 pb-4">
              <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Confirmar aprovação com edição?</strong> A proposta será aprovada com as suas modificações. O autor será notificado que a proposta foi aprovada com alterações. Clique em "Confirmar" para prosseguir.
                </p>
              </div>
            </div>
          )}

          {/* Footer com botões */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <button
              onClick={() => {
                if (modoRejeicao) { setModoRejeicao(false); setRazaoRejeicao(''); }
                else if (confirmandoEdicao) { setConfirmandoEdicao(false); }
                else if (modoEdicao) { setModoEdicao(false); setConteudoEditado(''); setConfirmandoEdicao(false); }
                else if (confirmandoAprovacao) { setConfirmandoAprovacao(false); }
                else { onClose(); }
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
            >
              {modoRejeicao || confirmandoAprovacao || modoEdicao ? 'Voltar' : 'Fechar'}
            </button>

            <div className="flex gap-3">
              {!modoEdicao && (
                <button
                  onClick={handleRejeitar}
                  disabled={processando || confirmandoAprovacao}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 dark:disabled:bg-red-800 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                >
                  <XCircle size={16} />
                  {modoRejeicao ? 'Confirmar Rejeição' : 'Rejeitar'}
                </button>
              )}

              {!modoEdicao && (
                <button
                  onClick={handleAceitarComEdicao}
                  disabled={processando || modoRejeicao || confirmandoAprovacao}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 dark:disabled:bg-amber-800 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                >
                  <Edit3 size={16} />
                  Aceitar com Edição
                </button>
              )}

              {modoEdicao ? (
                <button
                  onClick={handleConfirmarEdicao}
                  disabled={processando}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                >
                  <Check size={16} />
                  {confirmandoEdicao ? 'Confirmar' : 'Aprovar com Edição'}
                </button>
              ) : (
                <button
                  onClick={handleAprovar}
                  disabled={processando || modoRejeicao}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 dark:disabled:bg-green-800 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                >
                  <Check size={16} />
                  {confirmandoAprovacao ? 'Confirmar Revisão' : 'Aceitar'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

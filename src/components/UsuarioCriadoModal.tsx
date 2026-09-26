import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UsuarioCriadoData } from '../services/adminService';
import { Copy, X, Check } from 'lucide-react';
import { toast } from 'sonner';

interface UsuarioCriadoModalProps {
  open: boolean;
  onClose: () => void;
  usuario: UsuarioCriadoData;
}

export function UsuarioCriadoModal({
  open,
  onClose,
  usuario,
}: UsuarioCriadoModalProps) {
  const [copiado, setCopiado] = useState(false);

  if (!open) return null;

  const rolePtBr: Record<string, string> = {
    user: 'Usuário',
    supervisor: 'Supervisor',
    coordenador: 'Coordenador',
    admin: 'Administrador',
  };

  const handleCopiarCredenciais = async () => {
    const credenciais = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🎉 CREDENCIAIS DE ACESSO - SISTEMA ATENDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 Nome: ${usuario.nome}
📧 Email (Login): ${usuario.email}
🔑 Senha: ${usuario.senha}

${usuario.role ? `👥 Perfil: ${rolePtBr[usuario.role] || 'Usuário'}\n` : ''}${usuario.setor_nome ? `🏢 Setor: ${usuario.setor_nome}\n` : ''}${usuario.equipe_nome ? `🎯 Equipe: ${usuario.equipe_nome}\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    try {
      await navigator.clipboard.writeText(credenciais);
      setCopiado(true);
      toast.success('Credenciais copiadas para a área de transferência!');
      setTimeout(() => setCopiado(false), 3000);
    } catch (error) {
      toast.error('Erro ao copiar credenciais');
      console.error('Erro ao copiar:', error);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10002] bg-black/60 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span className="text-2xl">👤</span>
              Usuário Criado com Sucesso!
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-900 dark:text-green-200">
                O usuário <strong>{usuario.nome}</strong> foi criado no sistema.
                Copie as credenciais abaixo e compartilhe pelo canal que a equipe usar (Teams, presencial, etc.).
              </p>
            </div>

            <div className="border dark:border-gray-600 rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span>📋</span>
                Credenciais de Acesso
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white dark:bg-gray-800 p-3 rounded border dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Nome Completo</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{usuario.nome}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-3 rounded border dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email (Login)</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100 break-all">{usuario.email}</p>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded border border-yellow-200 dark:border-yellow-700 md:col-span-2">
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 font-semibold mb-1">🔑 Senha</p>
                  <p className="font-mono text-lg font-bold text-yellow-900 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-800/50 p-2 rounded border border-yellow-300 dark:border-yellow-600">
                    {usuario.senha}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-3 rounded border dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Perfil de Acesso</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{rolePtBr[usuario.role] || 'Usuário'}</p>
                </div>

                {usuario.setor_nome && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Setor</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{usuario.setor_nome}</p>
                  </div>
                )}

                {usuario.equipe_nome && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Equipe</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{usuario.equipe_nome}</p>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopiarCredenciais}
              className="w-full flex items-center justify-center gap-3 p-4 border-2 border-purple-200 dark:border-purple-700 rounded-lg hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all"
            >
              {copiado ? (
                <Check className="w-6 h-6 text-purple-700" />
              ) : (
                <Copy className="w-6 h-6 text-purple-700" />
              )}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {copiado ? 'Copiado!' : 'Copiar credenciais'}
              </span>
            </button>
          </div>

          <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Fechar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

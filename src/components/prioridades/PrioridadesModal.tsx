import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissoes } from '../../contexts/PermissoesContext';
import { usePrioridadesModal } from '../../hooks/usePrioridadesModal';
import { PrioridadesContent } from './PrioridadesContent';
import { PrioridadesSidebar } from './PrioridadesSidebar';

interface PrioridadesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal fullscreen do app "Prioridades e Urgências".
 *
 * Segue o padrão de modal fullscreen já usado na Home (Pasquale) — container
 * `fixed inset-0` com painel lateral fixo e área de conteúdo rolável, em vez do
 * BaseAnimatedModal, que é dimensionado para diálogos.
 */
const PrioridadesModal: React.FC<PrioridadesModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { temPermissao, isAdmin } = usePermissoes();
  const estado = usePrioridadesModal(isOpen);

  // Fecha com Esc.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const temDesignacoes =
    temPermissao('prioridades.designacoes') ||
    estado.perfil?.perfil === 'gestor' ||
    estado.perfil?.perfil === 'coordenador';

  const nomeUsuario = user?.email ?? '';

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-50 dark:bg-gray-900" role="dialog" aria-modal="true">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-gray-800 dark:text-gray-100">Prioridades e Urgências</h1>
          <span className="hidden rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 sm:inline dark:bg-blue-900/40 dark:text-blue-200">
            TJSP Atende · Fórum Central Cível
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-red-600 dark:text-gray-300 dark:hover:bg-gray-700"
          title="Fechar (Esc)"
        >
          Fechar
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <PrioridadesSidebar
          modulo={estado.modulo}
          setModulo={estado.setModulo}
          perfil={estado.perfil}
          perfilEfetivo={estado.perfilEfetivo}
          nomeUsuario={nomeUsuario}
          contadores={estado.contadores}
          tela={estado.tela}
          irPara={estado.irPara}
          temDesignacoes={temDesignacoes}
          ehAdmin={isAdmin}
        />
        <PrioridadesContent {...estado} nomeUsuario={nomeUsuario} />
      </div>
    </div>
  );
};

export default PrioridadesModal;

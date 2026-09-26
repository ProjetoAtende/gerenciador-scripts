// src/components/ScriptsModal.tsx — Orquestrador fino (lógica em useScriptsModal)
import React from 'react';
import { useScriptsModal } from '../hooks/useScriptsModal';
import type { ScriptNotificacao } from '../hooks/useScriptsModal';
import { ScriptsModalHeader } from './ScriptsModalHeader';
import { ScriptsModalContent } from './ScriptsModalContent';
import { ScriptsModalModals } from './ScriptsModalModals';
import { ScriptsCoberturaTab } from './ScriptsCoberturaTab';

interface ScriptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGerador: (script: { nome: string; conteudo_bruto: string; conteudo_atendente?: string | null }) => void;
  notificacaoPendente?: ScriptNotificacao | null;
  onNotificacaoProcessada?: () => void;
}

export const ScriptsModal: React.FC<ScriptsModalProps> = (props) => {
  const h = useScriptsModal(props);

  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40">
      <div className="bg-white dark:bg-gray-900 w-full h-full flex flex-col overflow-hidden">
        {/* Header com busca e filtros */}
        <ScriptsModalHeader
          {...h}
          onClose={props.onClose}
        />

        {/* Input oculto para upload de scripts */}
        <input
          id="file-upload-input"
          type="file"
          accept=".txt"
          onChange={h.handleFileUpload}
          className="hidden"
          disabled={h.uploading}
        />

        {/* Dashboard de Cobertura */}
        {h.viewMode === 'cobertura' && (
          <div className="flex-1 overflow-hidden">
            <ScriptsCoberturaTab equipeId={h.equipeId} visible={h.viewMode === 'cobertura'} />
          </div>
        )}

        {/* Layout principal - Sidebar + Grid */}
        {h.viewMode === 'lista' && (
          <ScriptsModalContent {...h} />
        )}

        {/* Todos os sub-modais */}
        <ScriptsModalModals
          {...h}
        />
      </div>
    </div>
  );
};

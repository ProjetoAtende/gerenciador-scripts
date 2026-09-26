// components/ScriptsHelpModal.tsx - Modal de ajuda do sistema de Scripts
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, HelpCircle, ChevronDown,
  FolderPlus, FileText, Edit3, Send, CheckCircle2,
  Wand2, Bold, Image, Video, Link, Palette,
  GripVertical, Sparkles, Eye, Search, Trash2, ShieldCheck,
  Bell, History, MessageSquare, RotateCcw
} from 'lucide-react';

interface ScriptsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  content: React.ReactNode;
}

// Card de seção expansível
const HelpCard: React.FC<{
  section: HelpSection;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ section, isExpanded, onToggle }) => {
  return (
    <motion.div
      layout
      className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      <button
        onClick={onToggle}
        className={`w-full p-4 flex items-center gap-3 transition-colors ${
          isExpanded ? 'bg-gray-50 dark:bg-gray-700/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        <div className={`p-2 rounded-lg ${section.color}`}>
          {section.icon}
        </div>
        <span className="flex-1 text-left font-semibold text-gray-800 dark:text-gray-200">
          {section.title}
        </span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={20} className="text-gray-500 dark:text-gray-400" />
        </motion.div>
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-gray-100 dark:border-gray-700">
              {section.content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Componente para item de lista com ícone
const HelpItem: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({
  icon, title, description
}) => (
  <div className="flex items-start gap-3 py-2">
    <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 flex-shrink-0">
      {icon}
    </div>
    <div>
      <div className="font-medium text-gray-800 dark:text-gray-200">{title}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400">{description}</div>
    </div>
  </div>
);

// Componente para passo numerado
const Step: React.FC<{ number: number; title: string; description: string }> = ({
  number, title, description
}) => (
  <div className="flex items-start gap-3 py-2">
    <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
      {number}
    </div>
    <div>
      <div className="font-medium text-gray-800 dark:text-gray-200">{title}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400">{description}</div>
    </div>
  </div>
);

// Componente para destaque de tecla
const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">
    {children}
  </kbd>
);

// Componente para botão de exemplo
const ButtonExample: React.FC<{ icon: React.ReactNode; label: string; color: string }> = ({
  icon, label, color
}) => (
  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${color}`}>
    {icon} {label}
  </span>
);

export const ScriptsHelpModal: React.FC<ScriptsHelpModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSections(new Set(sections.map(s => s.id)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  const sections: HelpSection[] = [
    // SEÇÃO 1: SIDEBAR E ORGANIZAÇÃO
    {
      id: 'sidebar',
      title: 'Sidebar e Organização',
      icon: <FolderPlus size={20} className="text-purple-600" />,
      color: 'bg-purple-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            O sidebar à esquerda permite organizar seus scripts em pastas e subpastas.
          </p>

          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
            <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-3">📍 Indicador de Destino</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              O badge "📍 Destino" no topo do sidebar mostra onde novos scripts e pastas serão criados.
              Clique em uma pasta para selecioná-la como destino.
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Botões do Sidebar</h4>
          <div className="space-y-2">
            <HelpItem
              icon={<span className="text-sm">✏️➕</span>}
              title="Criar Script"
              description="Abre o modal de confirmação de local e depois o editor para criar um novo script."
            />
            <HelpItem
              icon={<span className="text-sm">📁➕</span>}
              title="Criar Pasta"
              description="Permite criar uma pasta ou subpasta. Primeiro escolha o local, depois defina nome e ícone."
            />
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Gerenciando Pastas</h4>
          <div className="space-y-2">
            <HelpItem
              icon={<span className="text-sm">▶/▼</span>}
              title="Expandir/Colapsar"
              description="Clique na seta para ver ou ocultar subpastas."
            />
            <HelpItem
              icon={<span className="text-sm">✏️</span>}
              title="Renomear Pasta"
              description="Aparece ao passar o mouse sobre a pasta. Duplo-clique também funciona."
            />
            <HelpItem
              icon={<span className="text-sm">🗑️</span>}
              title="Excluir Pasta"
              description="Remove a pasta. Se houver scripts dentro, você pode movê-los para a raiz ou excluí-los."
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>💡 Dica:</strong> Arraste scripts diretamente para pastas no sidebar para movê-los rapidamente.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 2: FLUXO DE CRIAÇÃO E PUBLICAÇÃO
    {
      id: 'fluxo',
      title: 'Fluxo de Criação e Curadoria',
      icon: <FileText size={20} className="text-blue-600" />,
      color: 'bg-blue-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            O sistema de scripts possui um fluxo completo de criação, notificação e curadoria.
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Etapas do Fluxo</h4>
          <div className="space-y-1">
            <Step
              number={1}
              title="Criar o Script e Definir Autor"
              description="Use o botão ✏️➕ no sidebar ou importe um arquivo .txt. É obrigatório selecionar o autor do script antes de salvar."
            />
            <Step
              number={2}
              title="Marcar como Temporário (Opcional)"
              description="Se o script for uma solução temporária para o e-Proc, marque-o como 'Temporário' no editor. Ele ficará com cor laranja."
            />
            <Step
              number={3}
              title="Preencher Pergunta e Chamado (obrigatório)"
              description="Ainda no editor, informe o número do chamado que originou o script e a pergunta que ele responde. Esses campos são obrigatórios para scripts de usuário final — o sistema bloqueia o salvamento e abre o formulário automaticamente se estiverem vazios."
            />
            <Step
              number={4}
              title="V1 registrada automaticamente"
              description="Ao salvar, a versão V1 é registrada automaticamente no histórico. O botão de histórico (🕐) fica disponível no card."
            />
            <Step
              number={5}
              title="Publicar script"
              description="O botão 'Publicar script' aparece no card quando chamado e pergunta estão preenchidos. A curadoria é avisada no sininho (notificação in-app)."
            />
            <Step
              number={6}
              title="Revisão pela Curadoria"
              description="Um membro da Curadoria revisa o script. Três desfechos possíveis: aprovação sem alterações, correção menor (grafia/pontuação) ou alteração substantiva (muda o sentido do texto)."
            />
            <Step
              number={7}
              title="Notificações Automáticas"
              description="O autor recebe notificação (🔔) sobre o resultado da revisão. Se houve alteração, pode visualizar a comparação e, no caso de alteração substantiva, contestar."
            />
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-purple-800 dark:text-purple-300">
              <strong>👤 Obrigatório:</strong> Todo script precisa ter um autor definido. Use o campo "Autor" no editor
              para selecionar quem criou o script. Isso garante rastreabilidade e facilita a identificação.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mt-3">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>💡 Dica:</strong> O script pode ser editado livremente antes de ser revisado pela Curadoria.
              Após a revisão, qualquer modificação precisa ser proposta e aprovada (veja a seção "Propostas de Revisão").
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Status do Script</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-400 dark:text-gray-500">⭕</span>
                <span className="font-medium">Não Revisado</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Script ainda não foi revisado pela curadoria. Edição livre.</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={16} className="text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-300">Revisado pela Curadoria</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Script revisado. Alterações só via propostas.</p>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>⚠️ Importante:</strong> O botão de publicação só aparece no card quando o script já possui número do chamado e pergunta preenchidos. Scripts antigos sem essas informações não exibem o botão.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 3: CARD DO SCRIPT
    {
      id: 'card',
      title: 'Card do Script',
      icon: <FileText size={20} className="text-green-600" />,
      color: 'bg-green-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Cada script é exibido como um card com diversas funcionalidades acessíveis.
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Elementos do Card</h4>
          <div className="space-y-2">
            <HelpItem
              icon={<GripVertical size={16} />}
              title="Alça de Arraste (☰)"
              description="No canto superior esquerdo. Segure e arraste para reordenar ou mover para outra pasta."
            />
            <HelpItem
              icon={<CheckCircle2 size={16} />}
              title="Status de Curadoria"
              description="No canto superior direito. Clique para alternar entre curado/não curado. Somente membros da coordenadoria 3.2 podem marcar scripts como curados."
            />
            <HelpItem
              icon={<span className="text-sm">🕐</span>}
              title="Histórico de Versões"
              description="Botão de relógio no card. Abre o modal com todo o histórico de versões do script, mostrando V1, V2, etc."
            />
            <HelpItem
              icon={<Bell size={16} />}
              title="Notificações (🔔)"
              description="O ícone de sino no topo do modal indica notificações pendentes. O badge vermelho mostra a quantidade de notificações não lidas."
            />
            <HelpItem
              icon={<span className="text-sm font-mono">#N</span>}
              title="Número de Referência Fixo"
              description="Cada script possui um número de referência permanente (#N) que nunca muda, mesmo que outros scripts sejam excluídos. Facilita a identificação e comunicação entre a equipe."
            />
            <HelpItem
              icon={<span className="text-sm">#123456</span>}
              title="Número do Chamado"
              description="Link clicável que abre o chamado no sistema de suporte."
            />
            <HelpItem
              icon={<span className="text-sm">📅</span>}
              title="Data de Criação"
              description="Exibida no rodapé do card no formato dd/mm/aa, mostrando quando o script foi criado."
            />
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Ações do Card (aparecem ao passar o mouse)</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded flex items-center gap-2">
              <ButtonExample icon="▶️" label="Gerar" color="bg-blue-100 text-blue-700" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Abre o gerador</span>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded flex items-center gap-2">
              <ButtonExample icon="📁" label="" color="bg-blue-50 text-blue-600" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Mover para pasta</span>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded flex items-center gap-2">
              <ButtonExample icon="📤" label="Publicar script" color="bg-green-50 text-green-600" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Notificar equipe (quando chamado e pergunta preenchidos)</span>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded flex items-center gap-2">
              <ButtonExample icon="✏️" label="" color="bg-yellow-50 text-yellow-600" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Editar conteúdo</span>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded flex items-center gap-2">
              <ButtonExample icon="🗑️" label="" color="bg-red-50 text-red-600" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Excluir script</span>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>💡 Dica:</strong> Dê duplo-clique no título do script para editá-lo rapidamente.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 4: EDITOR DE SCRIPTS
    {
      id: 'editor',
      title: 'Editor de Scripts',
      icon: <Edit3 size={20} className="text-yellow-600" />,
      color: 'bg-yellow-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            O editor fullscreen permite criar e editar scripts com formatação rica.
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Barra de Ferramentas</h4>
          <div className="grid grid-cols-2 gap-2">
            <HelpItem
              icon={<Bold size={14} />}
              title="Formatação de Texto"
              description="Negrito, itálico, sublinhado, riscado. Use Ctrl+B/I/U."
            />
            <HelpItem
              icon={<Palette size={14} />}
              title="Cores"
              description="Altere a cor do texto ou do fundo do texto selecionado."
            />
            <HelpItem
              icon={<span className="text-xs">H1-H4</span>}
              title="Títulos"
              description="Dropdown para aplicar estilos de título/parágrafo."
            />
            <HelpItem
              icon={<span className="text-xs">Aa</span>}
              title="Fonte e Tamanho"
              description="Escolha a família de fonte e o tamanho do texto."
            />
            <HelpItem
              icon={<Image size={14} />}
              title="Imagem"
              description="Insira imagens. Elas são arrastáveis para reposicionar."
            />
            <HelpItem
              icon={<Video size={14} />}
              title="Vídeo"
              description="Escolha entre upload ou URL. Vídeos são inseridos como links clicáveis (limitação do SMAX)."
            />
            <HelpItem
              icon={<Link size={14} />}
              title="Link"
              description="Transforme texto em link clicável."
            />
            <HelpItem
              icon={<span className="text-xs">📋 Lista</span>}
              title="Listas"
              description="Crie listas com marcadores ou numeradas."
            />
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Atalhos de Teclado</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><Key>Ctrl</Key> + <Key>S</Key> — Salvar</div>
            <div><Key>Ctrl</Key> + <Key>B</Key> — Negrito</div>
            <div><Key>Ctrl</Key> + <Key>I</Key> — Itálico</div>
            <div><Key>Ctrl</Key> + <Key>U</Key> — Sublinhado</div>
            <div><Key>Ctrl</Key> + <Key>Z</Key> — Desfazer</div>
            <div><Key>Ctrl</Key> + <Key>Y</Key> — Refazer</div>
            <div><Key>Esc</Key> — Fechar editor</div>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Edição de Pergunta e Chamado</h4>
          <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-600">✏️</span>
              <span className="font-medium text-green-800 dark:text-green-300">Editar no Próprio Editor</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              No topo do editor, clique no botão com ícone ❓ para abrir o modal de edição.
              Você pode adicionar ou modificar tanto a pergunta quanto o número do chamado sem sair do editor.
            </p>
            <div className="flex gap-2 text-xs mt-2">
              <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-green-300 dark:border-green-700">
                <Key>Ctrl</Key> + <Key>Enter</Key> para salvar
              </span>
              <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-green-300 dark:border-green-700">
                <Key>Esc</Key> para fechar
              </span>
            </div>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Modos do Editor</h4>
          <div className="flex gap-3">
            <div className="flex-1 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Edit3 size={16} className="text-blue-600" />
                <span className="font-medium">Modo Edição</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Edite o conteúdo livremente.</p>
            </div>
            <div className="flex-1 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Eye size={16} className="text-green-600" />
                <span className="font-medium">Modo Preview</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Veja como o script ficará. Variáveis são destacadas.</p>
            </div>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Header do Editor (Novo Layout)</h4>
          <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">✨</span>
              <span className="font-semibold text-blue-900 dark:text-blue-300">Layout Compacto em 2 Linhas</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              O header agora exibe todas as informações de forma horizontal e organizada:
            </p>
            <div className="space-y-2 text-sm">
              <div className="p-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-800">
                <strong className="text-blue-800 dark:text-blue-300">Linha 1:</strong> Fechar | Título + #Número + Nome | Editar/Preview + Salvar
              </div>
              <div className="p-2 bg-white dark:bg-gray-800 rounded border border-purple-200 dark:border-purple-800">
                <strong className="text-purple-800 dark:text-purple-300">Linha 2:</strong> Pergunta | Autor | Tipo Requisitante | Temporário/Permanente
              </div>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
              💡 Separadores verticais | deixam o layout mais profissional e economizam espaço na tela
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Tipo do Requisitante (Obrigatório)</h4>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-lg border-2 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-600 text-xl">👤</span>
              <span className="font-semibold text-amber-900 dark:text-amber-300">Campo Obrigatório</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              Novo campo no header que deve ser preenchido antes de salvar. Contém 77 perfis do eProc extraídos das imagens fornecidas.
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-300 dark:border-amber-700">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Como usar:</p>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                <li>• Clique no campo "Tipo Requisitante" no header</li>
                <li>• Modal com busca aparece com todos os 77 perfis</li>
                <li>• Digite para filtrar e autocomplete encontra rapidamente</li>
                <li>• Clique no perfil desejado ou use ↑↓ + Enter</li>
                <li>• Scripts não salvam sem este campo preenchido</li>
              </ul>
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
              ⚠️ Importante: Scripts criados antes desta atualização podem ter este campo vazio (legado)
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Número do Script Visível</h4>
          <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              O número de referência do script (ex: <span className="font-mono bg-white dark:bg-gray-800 px-1 py-0.5 rounded">#556</span>) 
              agora aparece no header ao lado do título, facilitando a identificação durante a edição.
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-purple-800 dark:text-purple-300">
              <strong>🖼️ Imagens arrastáveis:</strong> Clique e arraste imagens/vídeos para reposicioná-los no texto.
              Uma linha roxa indica onde será inserido.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 5: ASSISTENTE DE IA
    {
      id: 'ia',
      title: 'Assistente de IA',
      icon: <Sparkles size={20} className="text-pink-600" />,
      color: 'bg-pink-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            O botão <ButtonExample icon={<Sparkles size={12} />} label="IA" color="bg-purple-100 text-purple-700" /> na barra de ferramentas abre o menu do assistente de IA.
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Funcionalidades da IA</h4>
          <div className="space-y-3">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Wand2 size={16} className="text-purple-600" />
                <span className="font-medium text-purple-800 dark:text-purple-300">Melhorar Texto</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Adiciona formatação HTML, títulos, emojis, listas e melhora a estrutura visual.
                Ideal para transformar texto simples em conteúdo profissional.
              </p>
            </div>

            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={16} className="text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-300">Corrigir Gramática</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Corrige erros de gramática, pontuação, ortografia e concordância.
                Mantém a estrutura original sem adicionar formatação.
              </p>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Edit3 size={16} className="text-blue-600" />
                <span className="font-medium text-blue-800 dark:text-blue-300">Continuar Escrevendo</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Continua o texto mantendo o mesmo estilo e contexto.
                Útil quando você precisa expandir o conteúdo.
              </p>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-amber-600">📋</span>
                <span className="font-medium text-amber-800 dark:text-amber-300">Formatar Texto</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Organiza o texto com estrutura profissional: parágrafos, listas,
                links clicáveis e formatação de texto profissional.
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
                Mantém saudações como "Prezado usuário" e preserva estruturas especiais
                (ex: {'{[Prezado][Prezada]}'}, {'{[opção][opção]}'}, ()).
              </p>
            </div>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Opções de Aplicação</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="font-medium">Texto Selecionado</span>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Processa apenas o trecho que você selecionou no editor.
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="font-medium">Texto Completo</span>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Processa todo o conteúdo do editor de uma vez.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>💡 Dica:</strong> Se o texto contém imagens, elas são preservadas automaticamente
              durante o processamento pela IA.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 6: VARIÁVEIS DO SCRIPT
    {
      id: 'variaveis',
      title: 'Variáveis e Dropdowns',
      icon: <span className="text-lg">🔧</span>,
      color: 'bg-cyan-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Scripts podem conter variáveis especiais que são processadas ao gerar.
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Tipos de Variáveis</h4>
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="font-mono text-blue-800 dark:text-blue-300 mb-1">{'{[opção1][opção2][opção3]}'}</div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Dropdown:</strong> Ao gerar o script, aparece um menu para escolher uma das opções.
                Exemplo: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{[Prezado][Prezada]}'}</code>
              </p>
            </div>

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="font-mono text-yellow-800 dark:text-yellow-300 mb-1">()</div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Campo Editável:</strong> Ao gerar, você pode digitar texto personalizado.
                Exemplo: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Prezado (), segue...</code>
              </p>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-300">
              <strong>⚠️ Campos livres obrigatórios:</strong> Se houver () vazio, o botão "Copiar"
              é bloqueado e o campo fica destacado em vermelho até o preenchimento.
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Visualização no Preview</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No modo preview do editor, as variáveis são destacadas com cores diferentes
            para fácil identificação:
          </p>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded text-sm font-mono">
              {'{[opção]}'}
            </span>
            <span className="text-gray-500 dark:text-gray-400">=</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">Fundo azul</span>
          </div>
          <div className="flex gap-2 mt-1">
            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 rounded text-sm font-mono">
              ()
            </span>
            <span className="text-gray-500 dark:text-gray-400">=</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">Fundo amarelo</span>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>⚠️ Atenção:</strong> A IA está configurada para NÃO modificar estas variáveis.
              Elas serão preservadas ao usar qualquer funcionalidade de IA.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 7: CURADORIA E PRIVILÉGIOS
    {
      id: 'curadoria',
      title: 'Curadoria e Revisão Inicial',
      icon: <CheckCircle2 size={20} className="text-green-600" />,
      color: 'bg-green-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            O sistema de curadoria garante a qualidade dos scripts. Após a criação,
            um membro da Curadoria revisa o texto. Existem <strong>três desfechos possíveis</strong> na revisão inicial:
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Permissões de Curadoria</h4>
          <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={18} className="text-green-600" />
              <span className="font-medium text-green-800 dark:text-green-300">Coordenadoria 3.2</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Apenas membros das equipes da coordenadoria 3.2 (equipes 3.2.1, 3.2.2 e 3.2.3) 
              têm permissão para revisar scripts, marcar como curados e registrar aprovações (com notificação in-app ao autor).
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">✅ Situação A — Texto está correto</h4>
          <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              O revisor clica no ícone de revisão (✓) no card. O script é marcado como <em>"Revisado"</em>.
              No histórico, a V1 mostrará duas fases: a <strong>criação original</strong> e a <strong>aprovação sem alterações</strong>.
            </p>
            <p className="text-xs text-green-800 dark:text-green-300 mt-2">
              ✅ O autor recebe uma notificação informando que o texto foi revisado sem alterações.
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">📝 Situação B — Correção menor (grafia, pontuação)</h4>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              O revisor edita o texto e salva. Um modal de classificação aparece, onde seleciona <strong>"Correção menor"</strong>.
              A V1 é atualizada com o texto corrigido. O texto original é preservado internamente.
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
              📝 O autor recebe notificação com visualização lado a lado (texto original × texto corrigido).
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">📑 Situação C — Alteração substantiva (muda o sentido)</h4>
          <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              O revisor edita e seleciona <strong>"Alteração substantiva"</strong>. A V1 original é preservada e uma nova <strong>V2</strong>
              é criada. O autor permanece sendo o criador original do script, e o revisor aparece como <em>"Revisado por"</em>.
            </p>
            <p className="text-xs text-purple-800 dark:text-purple-300 mt-2">
              ⚡ O autor recebe notificação com a comparação entre as versões e pode <strong>aceitar ou contestar</strong> a alteração.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>📝 Sobre a autoria:</strong> Em todas as situações, o <strong>autor</strong> exibido no histórico
              é sempre quem criou ou propôs a modificação — nunca o revisor. O revisor aparece separadamente
              como <em>"Revisado por"</em>.
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 mt-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>⚠️ Toggle bloqueado:</strong> O botão de curadoria (✓) é bloqueado automaticamente
              quando há uma proposta de revisão pendente para o script, evitando conflitos no fluxo.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 8: VERSIONAMENTO E HISTÓRICO
    {
      id: 'versionamento',
      title: 'Versionamento e Histórico',
      icon: <History size={20} className="text-purple-600" />,
      color: 'bg-purple-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Cada alteração no script cria um registro permanente. O botão <strong>🕐</strong> no card abre o histórico completo de versões.
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Como as versões são criadas</h4>
          <div className="space-y-2">
            <HelpItem
              icon={<span className="text-sm font-bold text-blue-600">V1</span>}
              title="V1 — Criação do script"
              description="Registrada automaticamente ao salvar o script pela primeira vez."
            />
            <HelpItem
              icon={<span className="text-sm font-bold text-purple-600">V2</span>}
              title="V2+ — Alterações posteriores"
              description="Criada quando a Curadoria faz alteração substantiva ou quando uma proposta do usuário é aprovada."
            />
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Exibição da V1 (duas fases)</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Quando a Curadoria revisa a V1, o histórico mostra <strong>duas fases</strong> para essa mesma versão:
          </p>
          <div className="grid grid-cols-1 gap-2">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">V1</span>
                <span className="font-medium text-blue-800 dark:text-blue-300">Fase 1 — Criação</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 ml-8">O texto original enviado pelo autor, com a data de criação.</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">V1</span>
                <span className="font-medium text-green-800 dark:text-green-300">Fase 2 — Revisão</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 ml-8">O resultado da revisão (com ou sem alterações), data da revisão e nome do revisor.</p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mt-3">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>💡 Nota:</strong> Quando a revisão não altera o texto, a fase 2 mostra <em>"Conteúdo mantido sem alterações"</em>.
              Quando há correção menor, é possível expandir para ver o texto corrigido.
              Se houve alteração substantiva, a V2 é exibida separadamente.
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">O que cada informação significa</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="text-left p-2 border border-gray-200 dark:border-gray-600 font-medium">Campo</th>
                  <th className="text-left p-2 border border-gray-200 dark:border-gray-600 font-medium">Significado</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                <tr><td className="p-2 border border-gray-200 dark:border-gray-600 font-medium">V1, V2, V3...</td><td className="p-2 border border-gray-200 dark:border-gray-600">Número da versão (ordem cronológica)</td></tr>
                <tr><td className="p-2 border border-gray-200 dark:border-gray-600 font-medium">Autor</td><td className="p-2 border border-gray-200 dark:border-gray-600">Quem criou ou propôs aquela versão</td></tr>
                <tr><td className="p-2 border border-gray-200 dark:border-gray-600 font-medium">Revisado por</td><td className="p-2 border border-gray-200 dark:border-gray-600">O membro da Curadoria que revisou/aprovou</td></tr>
                <tr><td className="p-2 border border-gray-200 dark:border-gray-600 font-medium">Revisado sem alterações</td><td className="p-2 border border-gray-200 dark:border-gray-600">Curadoria aprovou sem modificar o texto</td></tr>
                <tr><td className="p-2 border border-gray-200 dark:border-gray-600 font-medium">Correção menor</td><td className="p-2 border border-gray-200 dark:border-gray-600">Ajustes de grafia, pontuação ou formatação</td></tr>
                <tr><td className="p-2 border border-gray-200 dark:border-gray-600 font-medium">Proposta revisada</td><td className="p-2 border border-gray-200 dark:border-gray-600">Modificação proposta pelo usuário e aceita</td></tr>
                <tr><td className="p-2 border border-gray-200 dark:border-gray-600 font-medium">Correção pós-rejeição</td><td className="p-2 border border-gray-200 dark:border-gray-600">Proposta reenviada após rejeição e aceita</td></tr>
              </tbody>
            </table>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-purple-800 dark:text-purple-300">
              <strong>💡 Abas separadas:</strong> O histórico é dividido por tipo de conteúdo: <strong>Usuário Final</strong>
              e <strong>Atendente</strong>. Cada aba mostra as versões independentes daquele campo.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 9: PROPOSTAS DE REVISÃO
    {
      id: 'propostas',
      title: 'Propostas de Revisão',
      icon: <MessageSquare size={20} className="text-amber-600" />,
      color: 'bg-amber-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Após um script ser revisado pela Curadoria, o usuário <strong>não pode mais editar livremente</strong>.
            Toda alteração precisa ser proposta e aprovada.
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Como funciona</h4>
          <div className="space-y-1">
            <Step
              number={1}
              title="Editar o texto"
              description="O usuário abre o editor e faz as alterações desejadas no script revisado."
            />
            <Step
              number={2}
              title="Escrever motivação"
              description="Uma justificativa com no mínimo 20 caracteres é obrigatória, explicando a razão da mudança."
            />
            <Step
              number={3}
              title="Proposta criada"
              description="A proposta fica em análise. O revisor recebe uma notificação (🔔) para avaliar."
            />
            <Step
              number={4}
              title="Revisor decide"
              description="O revisor compara a versão atual com o texto proposto e aceita ou rejeita."
            />
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Se aprovada</h4>
          <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>• O texto do script é atualizado com o conteúdo proposto</li>
              <li>• Uma <strong>nova versão</strong> é criada no histórico (ex: V2, V3...)</li>
              <li>• O autor recebe notificação confirmando a aprovação</li>
            </ul>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Se rejeitada</h4>
          <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>• O revisor informa o motivo da rejeição (mín. 10 caracteres)</li>
              <li>• O autor recebe notificação com o motivo</li>
              <li>• O autor pode <strong>revisar e reenviar</strong> (até 3 tentativas no total)</li>
            </ul>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Reenvio após rejeição</h4>
          <div className="space-y-1">
            <Step
              number={1}
              title="Clique na notificação"
              description="Um modal exibe o motivo da rejeição e o texto da proposta rejeitada."
            />
            <Step
              number={2}
              title='Clique em "Revisar e Reenviar"'
              description="O editor abre com o texto da proposta anterior já preenchido. Faça os ajustes necessários."
            />
            <Step
              number={3}
              title="Escreva nova motivação e envie"
              description="O revisor recebe nova notificação e repete a análise."
            />
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>⚠️ Limite de tentativas:</strong> Cada proposta permite no máximo <strong>3 tentativas</strong>.
              Se todas forem rejeitadas, é necessário criar uma nova proposta.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mt-3">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>💡 Nota:</strong> Propostas rejeitadas <strong>não aparecem</strong> no histórico de versões —
              apenas propostas aprovadas geram novas versões. Os detalhes de rejeições ficam no sistema de notificações.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 10: CONTESTAÇÃO
    {
      id: 'contestacao',
      title: 'Contestação de Alterações',
      icon: <RotateCcw size={20} className="text-red-600" />,
      color: 'bg-red-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Quando o revisor faz uma <strong>alteração substantiva</strong> (cria V2), o autor pode contestar se discordar da mudança.
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Fluxo de Contestação</h4>
          <div className="space-y-1">
            <Step
              number={1}
              title="Clique na notificação de revisão"
              description="Abre um modal mostrando o texto original vs. o texto modificado pela Curadoria, com a motivação da alteração."
            />
            <Step
              number={2}
              title='Clique em "Contestar" e escreva o motivo'
              description="Uma justificativa com no mínimo 20 caracteres é obrigatória para a contestação."
            />
            <Step
              number={3}
              title="Revisor recebe a contestação"
              description="Ao clicar na notificação, o revisor vê a razão da contestação, os textos comparados e a motivação original."
            />
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Decisão do Revisor</h4>
          <div className="grid grid-cols-1 gap-3">
            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-green-600">✅</span>
                <span className="font-medium text-green-800 dark:text-green-300">Aceitar a contestação</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                O texto é revertido ao original. A V2 é <strong>removida do histórico</strong> e o script volta ao estado
                de antes da revisão. O autor é notificado.
              </p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-amber-600">✏️</span>
                <span className="font-medium text-amber-800 dark:text-amber-300">Editar novamente</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                A V2 anterior é removida. O editor reabre com o <strong>texto original do autor</strong> (V1).
                O revisor pode fazer uma nova edição e reclassificar (correção menor ou nova alteração substantiva).
              </p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>🔄 Ciclo repetível:</strong> Ao escolher "Editar novamente", o revisor sempre parte do texto
              original do autor. Após salvar, o autor recebe nova notificação e pode aceitar ou contestar novamente.
              O ciclo se repete até haver acordo.
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3 mt-3">
            <p className="text-sm text-purple-800 dark:text-purple-300">
              <strong>💡 Importante:</strong> Em ambos os casos (aceitar contestação ou editar novamente), a V2
              anterior é removida do histórico. Uma nova V2 só é criada se o revisor fizer uma nova alteração substantiva.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 11: NOTIFICAÇÕES
    {
      id: 'notificacoes',
      title: 'Sistema de Notificações',
      icon: <Bell size={20} className="text-amber-600" />,
      color: 'bg-amber-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            O sistema envia <strong>notificações automáticas</strong> em cada etapa do processo de revisão.
            O ícone de sino (🔔) com badge vermelho indica notificações pendentes.
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Notificações para o Autor</h4>
          <div className="space-y-2">
            <HelpItem
              icon={<span className="text-sm">🔍</span>}
              title="Revisão inicial"
              description="Seu script foi revisado pela Curadoria. Clique para ver as alterações (se houver)."
            />
            <HelpItem
              icon={<span className="text-sm text-green-600">✅</span>}
              title="Proposta aceita"
              description="Sua proposta de revisão foi aceita. Clique para ver a versão final."
            />
            <HelpItem
              icon={<span className="text-sm text-red-600">❌</span>}
              title="Proposta rejeitada"
              description="Sua proposta foi rejeitada com motivo informado. Clique para revisar e reenviar."
            />
            <HelpItem
              icon={<span className="text-sm text-green-600">✅</span>}
              title="Contestação aceita"
              description="O revisor aceitou sua contestação e o texto original foi restaurado."
            />
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Notificações para o Revisor</h4>
          <div className="space-y-2">
            <HelpItem
              icon={<span className="text-sm">📋</span>}
              title="Nova proposta"
              description="Um usuário quer modificar um script que você revisou. Clique para analisar."
            />
            <HelpItem
              icon={<span className="text-sm">🔄</span>}
              title="Proposta reenviada"
              description="O usuário revisou e reenviou a proposta. Clique para analisar novamente."
            />
            <HelpItem
              icon={<span className="text-sm">⚡</span>}
              title="Contestação recebida"
              description="O autor contestou sua alteração. Clique para ver o motivo e decidir."
            />
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Tipos de notificação</h4>
          <div className="grid grid-cols-1 gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-blue-600">ℹ️</span>
                <span className="font-medium text-blue-800 dark:text-blue-300">Informativas</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Desaparecem imediatamente após o clique.
                Ex: proposta aceita, contestação aceita, nova versão da curadoria.
              </p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-amber-600">⚡</span>
                <span className="font-medium text-amber-800 dark:text-amber-300">Acionáveis</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Permanecem visíveis até que a ação seja concluída (aprovar, rejeitar, contestar, reenviar).
                Ex: nova proposta, proposta rejeitada, contestação recebida, revisão inicial.
              </p>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-green-800 dark:text-green-300">
              <strong>✅ Tempo real:</strong> Notificações aparecem em tempo real, sem necessidade de recarregar a página.
              Os cards de scripts também se atualizam automaticamente quando há mudanças.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mt-3">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>💡 Comportamento:</strong> Notificações acionáveis ficam marcadas como "lidas" (sem destaque visual) após o
              primeiro clique, mas <strong>continuam na lista</strong> até que a ação seja concluída. O botão <strong>✕</strong>
              descarta a notificação manualmente a qualquer momento.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 12: PUBLICAÇÃO
    {
      id: 'publicacao',
      title: 'Publicação de Scripts',
      icon: <Send size={20} className="text-blue-600" />,
      color: 'bg-blue-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            A publicação substitui qualquer envio externo: tudo acontece dentro do gerenciador via sininho (🔔).
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Como publicar</h4>
          <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-300 space-y-2">
            <li>Salve o script com autor, chamado e pergunta preenchidos.</li>
            <li>No card, clique em <strong>Publicar script</strong> (aparece quando chamado e pergunta existem).</li>
            <li>O card passa a exibir o selo <strong>Publicado</strong>.</li>
            <li>A curadoria recebe notificação <em>script publicado</em> no sininho.</li>
          </ol>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Após a curadoria</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            O autor e demais envolvidos são avisados pelo sininho quando o script é revisado (com ou sem alterações).
            Não há disparo de e-mail pelo sistema — use Teams ou outro canal institucional se precisar avisar alguém fora do app.
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>💡 Dica:</strong> Scripts ainda não publicados continuam como rascunho interno; a exclusão pode ser imediata.
              Scripts publicados ou já revisados exigem fluxo de aprovação para desativar.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 13: BUSCA E FILTROS
    {
      id: 'busca',
      title: 'Busca e Filtros',
      icon: <Search size={20} className="text-indigo-600" />,
      color: 'bg-indigo-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Encontre scripts rapidamente usando a barra de busca e os filtros disponíveis.
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Barra de Busca</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Digite para buscar scripts pelos títulos. A busca é feita em tempo real e percorre todos os scripts do sistema.
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Filtro de Tipo</h4>
          <div className="space-y-2">
            <HelpItem
              icon={<span className="text-sm">📋</span>}
              title="Todos"
              description="Exibe todos os scripts, temporários e permanentes (padrão)."
            />
            <HelpItem
              icon={<span className="text-sm">⏳</span>}
              title="Temporários"
              description="Mostra apenas scripts marcados como temporários - soluções de contorno para implantação do e-Proc. Aparecem com fundo laranja no card."
            />
            <HelpItem
              icon={<span className="text-sm">📌</span>}
              title="Permanentes"
              description="Exibe apenas scripts permanentes (não temporários)."
            />
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-orange-800 dark:text-orange-300">
              <strong>⏳ Scripts Temporários:</strong> Use para documentar workarounds da implantação do e-Proc.
              Eles ficam visíveis com cor diferenciada para lembrar que devem ser removidos futuramente.
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Filtro de Equipe 🏢</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Disponível para todos os usuários. Filtra scripts pela equipe responsável, 
            <strong> independentemente</strong> dos outros filtros ativos — inclusive ignora a pasta selecionada
            no sidebar, exibindo scripts da equipe em todas as pastas.
          </p>
          <div className="space-y-2">
            <HelpItem
              icon={<span className="text-sm">🏢</span>}
              title="Selecionar equipe"
              description="Escolha uma equipe na lista para ver apenas os scripts vinculados a ela. Pode ser combinado com busca, curadoria e tipo simultaneamente."
            />
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 mt-2">
            <p className="text-sm text-indigo-800 dark:text-indigo-300">
              <strong>💡 Dica:</strong> Ao selecionar uma equipe, os contadores do filtro de curadoria
              (ex.: "Não Revisados (66)") se adaptam automaticamente para refletir apenas os scripts
              daquela equipe.
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Filtro de Curadoria 🔖</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Visível apenas para membros da coordenadoria 3.2 e administradores. Permite filtrar scripts
            pelo status de revisão. Os contadores entre parênteses se atualizam conforme o filtro de equipe
            ativo.
          </p>
          <div className="space-y-2">
            <HelpItem
              icon={<span className="text-sm">⚡</span>}
              title="Curadoria (padrão)"
              description="Sem filtro de revisão aplicado — exibe todos os scripts da pasta ou equipe selecionada."
            />
            <HelpItem
              icon={<span className="text-sm">🔍</span>}
              title="Não Revisados (n)"
              description="Mostra apenas scripts que ainda não passaram pela curadoria. O número entre parênteses indica a quantidade, filtrada pela equipe selecionada."
            />
            <HelpItem
              icon={<span className="text-sm">✅</span>}
              title="Revisados (n)"
              description="Mostra apenas scripts já curados. O número entre parênteses indica a quantidade, filtrada pela equipe selecionada."
            />
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 mt-2">
            <p className="text-sm text-green-800 dark:text-green-300">
              <strong>Combinação recomendada:</strong> Selecione uma equipe (ex.: 2.3.1) e depois
              escolha "Não Revisados" para ver exatamente o que ainda precisa de revisão naquela equipe,
              com contagem precisa já exibida no próprio select.
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Busca por Referência e Autor</h4>
          <div className="space-y-2">
            <HelpItem
              icon={<span className="text-sm">#️⃣</span>}
              title="Ref #"
              description="Digite o número de referência do script (número sequencial único)."
            />
            <HelpItem
              icon={<span className="text-sm">👤</span>}
              title="Buscar autor"
              description="Digite o nome do autor para filtrar scripts criados por uma pessoa específica."
            />
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Ordenação por Data</h4>
          <div className="space-y-2">
            <HelpItem
              icon={<span className="text-sm">📅↑</span>}
              title="Mais Antigo Primeiro"
              description="Ordena os scripts do mais antigo para o mais novo (ordem crescente de data de criação)."
            />
            <HelpItem
              icon={<span className="text-sm">📅↓</span>}
              title="Mais Novo Primeiro"
              description="Ordena os scripts do mais novo para o mais antigo (ordem decrescente de data de criação)."
            />
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Navegação por Pastas</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Clique em uma pasta no sidebar para ver apenas os scripts daquela pasta.
            Clique em "📄 Scripts" para ver scripts sem pasta.
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mt-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>💡 Dica:</strong> O contador em cada pasta mostra quantos scripts ela contém,
              incluindo subpastas.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 14: SCRIPT PARA O ATENDENTE
    {
      id: 'atendente',
      title: 'Script para o Atendente',
      icon: <span className="text-lg">🛠️</span>,
      color: 'bg-orange-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Cada script pode ter dois conteúdos independentes: a <strong>resposta para o usuário</strong> — o texto que será
            copiado e enviado — e as <strong>orientações internas para o atendente</strong>, que guiam o técnico
            na resolução antes de comunicar a resposta. Ambos compartilham os mesmos metadados (nome, autor,
            chamado, pergunta), mas são editados e visualizados de forma separada.
          </p>

          <div className="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-xl border-2 border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🎯</span>
              <span className="font-bold text-orange-900 dark:text-orange-300">Por que existe?</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Alguns atendimentos exigem passos técnicos antes de responder ao usuário: navegar em um sistema,
              executar uma consulta, confirmar um dado. O script para o atendente documenta esse caminho
              interno — separado e sem risco de ser enviado ao usuário por engano.
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-2">Como criar o script para o atendente</h4>
          <div className="space-y-1">
            <Step
              number={1}
              title="Abra o modal de Scripts"
              description="O script precisa já existir no sistema (crie normalmente pelo fluxo padrão)."
            />
            <Step
              number={2}
              title="Clique no lápis ✏️ do card"
              description="Ao invés de abrir o editor diretamente, um modal intermediário perguntará qual conteúdo você quer editar."
            />
            <Step
              number={3}
              title="Selecione 'Script para o atendente'"
              description="O editor abrirá com tema laranja, deixando imediatamente claro que você está editando o conteúdo interno."
            />
            <Step
              number={4}
              title="Escreva as orientações internas"
              description="Use o mesmo editor rico (TipTap) com IA, variáveis '{[]}' e campos editáveis '()'. O campo Tipo Requisitante não aparece neste modo, pois não é aplicável."
            />
            <Step
              number={5}
              title="Salve"
              description="O conteúdo do atendente é salvo independentemente — o script para o usuário não é alterado."
            />
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Indicadores visuais</h4>
          <div className="space-y-2">
            <div className="flex items-start gap-3 py-2">
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                🛠️
              </span>
              <div>
                <div className="font-medium text-gray-800 dark:text-gray-200">Badge no card</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Cards com conteúdo para o atendente exibem o badge 🛠️ no header. Passe o mouse para ver o tooltip explicativo.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2">
              <div className="p-1.5 bg-orange-100 rounded-lg text-orange-600 flex-shrink-0">
                <span className="text-sm font-bold">AB</span>
              </div>
              <div>
                <div className="font-medium text-gray-800 dark:text-gray-200">Abas no gerador</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  No modal "Gerar Script", dois abas aparecem: <em>"Script para o usuário final"</em> e <em>"Script para o atendente"</em>.
                  Cada aba tem seus próprios campos preenchíveis e botão Copiar independente.
                  Se o script não tiver conteúdo para o atendente, a aba mostra um estado vazio.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2">
              <div className="p-1.5 bg-orange-100 rounded-lg text-orange-600 flex-shrink-0">
                <span className="text-sm">🎨</span>
              </div>
              <div>
                <div className="font-medium text-gray-800 dark:text-gray-200">Editor com tema laranja</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  O editor no modo atendente usa gradiente laranja (ao invés do azul padrão) e exibe
                  o badge "Atendente" no header — diferenciação visual clara para evitar confusão
                  sobre qual conteúdo está sendo editado.
                </div>
              </div>
            </div>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Filtro de scripts por atendente</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Na barra de filtros, o select <strong>"Script atendente"</strong> permite três opções:
          </p>
          <div className="space-y-2">
            <HelpItem
              icon={<span className="text-sm">🛠️</span>}
              title="Todos (padrão)"
              description="Exibe todos os scripts, independentemente de terem ou não conteúdo para o atendente."
            />
            <HelpItem
              icon={<span className="text-sm">🛠️</span>}
              title="Com atendente (n)"
              description="Mostra apenas scripts que possuem script para o atendente cadastrado. O número em parênteses indica a quantidade total."
            />
            <HelpItem
              icon={<span className="text-sm">📋</span>}
              title="Sem atendente"
              description="Mostra scripts que ainda não têm orientações para o atendente — útil para identificar o que ainda precisa ser complementado."
            />
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Conteúdo para o atendente</h4>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
              No editor, a aba <strong>Script para o Atendente</strong> guarda orientações internas (procedimentos para o serventuário).
              Esse texto fica separado do script para o usuário final e não é compartilhado automaticamente por e-mail.
            </p>
            <div className="text-xs bg-white dark:bg-gray-800 rounded border border-orange-300 dark:border-orange-700 p-2 font-mono text-orange-800 dark:text-orange-300">
              🛠️ Orientações para o Atendente
            </div>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Campos compartilhados entre os dois modos</h4>
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              Os campos <strong>nome, autor, número do chamado, pergunta</strong> e <strong>temporário</strong>
              são os mesmos para os dois conteúdos — eles pertencem ao script, não ao conteúdo.
              Alterar o nome pelo editor do atendente refletirá quando abrir pelo modo usuário final, e vice-versa.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              O campo "Tipo Requisitante" é exclusivo do modo usuário final e não aparece no modo atendente.
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 mt-4 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>⚠️ Curadoria:</strong> O processo de curadoria atua apenas sobre o conteúdo para o usuário final.
              O conteúdo do atendente não é afetado pela curadoria e pode ser editado livremente a qualquer momento.
            </p>
          </div>
        </div>
      ),
    },

    // SEÇÃO 15: DESATIVAÇÃO DE SCRIPTS
    {
      id: 'exclusao',
      title: 'Desativação de Scripts',
      icon: <Trash2 size={20} className="text-red-600" />,
      color: 'bg-red-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            O sistema possui um controle de desativação para proteger scripts importantes. 
            <strong> Scripts nunca são deletados permanentemente</strong> - são movidos para a pasta "Desativados".
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Tipos de Desativação</h4>
          
          <div className="space-y-3">
            <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-green-600">✅</span>
                <span className="font-semibold text-green-800 dark:text-green-300">Desativação Direta</span>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                Scripts <strong>não publicados</strong> e <strong>sem revisão da curadoria</strong> podem ser excluídos/desativados diretamente (hard delete).
                Ideal para rascunhos ou scripts de teste.
              </p>
            </div>

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={18} className="text-yellow-600" />
                <span className="font-semibold text-yellow-800 dark:text-yellow-300">Desativação com Aprovação</span>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Scripts <strong>publicados</strong> ou <strong>já revisados pela curadoria</strong> exigem aprovação para desativação.
                Ao tentar desativar, uma solicitação será enviada ao responsável para análise.
                O script <strong>permanece visível</strong> enquanto aguarda aprovação.
              </p>
            </div>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Fluxo de Aprovação</h4>
          <div className="space-y-2">
            <Step
              number={1}
              title="Solicitação de Desativação"
              description="Ao clicar em desativar um script revisado, você deve informar o motivo."
            />
            <Step
              number={2}
              title="Script Permanece Visível"
              description="O script continua visível e funcional enquanto aguarda a decisão do responsável."
            />
            <Step
              number={3}
              title="Análise pela Curadoria"
              description="Quem tem Curadoria de Scripts (Autorizações no Boss) recebe notificação no sininho e trata em Scripts → Revisão → Exclusão, pela lixeira do card."
            />
            <Step
              number={4}
              title="Resultado"
              description="Se aprovada, o script é movido para a pasta '🗑️ Desativados'. Se negada, o script volta ao estado normal."
            />
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Pasta "Desativados"</h4>
          <div className="p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-purple-600">🗑️</span>
              <span className="font-semibold text-purple-800 dark:text-purple-300">Visibilidade Restrita</span>
            </div>
            <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
              <li>• A pasta "Desativados" só é visível para membros da <strong>Coordenadoria 3.2</strong></li>
              <li>• Scripts desativados mostram a <strong>data de desativação</strong> no header do card</li>
              <li>• Os scripts ficam preservados para consulta histórica e possível restauração futura</li>
            </ul>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 mt-4 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>⚠️ Importante:</strong> Sempre forneça um motivo claro para a desativação. 
              Isso ajuda o responsável a tomar uma decisão informada e agiliza o processo.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mt-2">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>💡 Dica:</strong> Se você criou um script por engano ou para teste, 
              evite publicar o script. Assim, poderá removê-lo diretamente sem precisar de aprovação.
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Reativando Scripts</h4>
          <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600">♻️</span>
              <span className="font-semibold text-green-800 dark:text-green-300">Botão Reativar</span>
            </div>
            <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
              <li>• Scripts na pasta "Desativados" possuem o botão <strong>♻️ Reativar</strong> no lugar da lixeira</li>
              <li>• Ao clicar, o script é <strong>restaurado para sua pasta original</strong></li>
              <li>• Todos os outros botões (Gerar, Mover, Editar) continuam disponíveis</li>
              <li>• O script volta a aparecer normalmente para todos os usuários</li>
            </ul>
          </div>
        </div>
      ),
    },

    // SEÇÃO 16: SISTEMA N1 — VALIDAÇÃO E ENVIO
    {
      id: 'n1',
      title: 'N1 — Validação e Envio',
      icon: <ShieldCheck size={20} className="text-cyan-600" />,
      color: 'bg-cyan-100',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            O sistema N1 permite classificar scripts quanto à sua relevância para o atendimento de primeiro nível,
            além de controlar o fluxo de validação e envio pela equipe de Qualidade.
          </p>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200">Permissões</h4>
          <div className="space-y-3">
            <div className="p-3 bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-cyan-600">🔒</span>
                <span className="font-semibold text-cyan-800 dark:text-cyan-300">Quem pode usar</span>
              </div>
              <ul className="text-sm text-cyan-700 dark:text-cyan-300 space-y-1">
                <li>• <strong>Select N1 (Sim/Não):</strong> Visível para todos os usuários no editor</li>
                <li>• <strong>Selects Validado N1 e Enviado N1:</strong> Visíveis apenas para membros da <strong>Equipe 2.1 (Qualidade)</strong> e <strong>administradores</strong></li>
                <li>• <strong>Filtros N1:</strong> Visíveis para todos; filtro de Validação/Envio visível apenas para Equipe 2.1 e admins</li>
              </ul>
            </div>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Select N1 no Editor</h4>
          <div className="p-4 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/30 dark:to-blue-900/30 rounded-lg border-2 border-cyan-200 dark:border-cyan-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🏷️</span>
              <span className="font-semibold text-cyan-900 dark:text-cyan-300">Campo Obrigatório — 3 Estados</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              Ao salvar um script (novo ou existente), o campo N1 deve ser preenchido. Ele cicla entre 3 estados ao clicar:
            </p>
            <div className="space-y-2 text-sm">
              <div className="p-2 bg-white dark:bg-gray-800 rounded border border-cyan-200 dark:border-cyan-800 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 rounded font-mono text-xs">N1: Sim</span>
                <span className="text-gray-600 dark:text-gray-400">— Script relevante para o N1</span>
              </div>
              <div className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-mono text-xs">N1: Não</span>
                <span className="text-gray-600 dark:text-gray-400">— Script não é N1</span>
              </div>
              <div className="p-2 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-800 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded font-mono text-xs animate-pulse">N1: ?</span>
                <span className="text-gray-600 dark:text-gray-400">— Não definido (bloqueia o salvamento)</span>
              </div>
            </div>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Validação e Envio N1</h4>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              Quando o N1 está marcado como <strong>Sim</strong>, a Equipe 2.1 e admins veem dois controles adicionais:
            </p>
            <div className="space-y-2">
              <HelpItem
                icon={<span className="text-sm">✅</span>}
                title="Validado N1"
                description="Marca o script como validado pela Qualidade. Registra automaticamente quem validou e quando."
              />
              <HelpItem
                icon={<span className="text-sm">📤</span>}
                title="Enviado N1"
                description="Marca que o script já foi enviado ao N1. Registra automaticamente quem enviou e quando."
              />
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
              Esses controles só aparecem quando N1 = Sim. Se o N1 for alterado para Não, ambos são automaticamente desmarcados.
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Filtros N1</h4>
          <div className="space-y-2">
            <HelpItem
              icon={<span className="text-sm">🏷️</span>}
              title="Filtro N1"
              description="Permite filtrar por: Todos, Apenas N1 (sim), Apenas Não-N1. Ativa busca cross-folder (ignora pasta selecionada)."
            />
            <HelpItem
              icon={<span className="text-sm">📋</span>}
              title="Filtro Validação/Envio"
              description="Disponível apenas quando N1 está filtrado como 'Sim'. Permite filtrar por: Validados, Não Validados, Enviados, Não Enviados. Visível apenas para Equipe 2.1 e admins."
            />
          </div>
          <div className="bg-cyan-50 dark:bg-cyan-900/30 rounded-lg p-3 mt-2">
            <p className="text-sm text-cyan-800 dark:text-cyan-300">
              <strong>💡 Dica:</strong> O badge no botão de filtros indica quantos filtros N1 estão ativos.
              O botão "Limpar" reseta todos os filtros de uma vez, incluindo os de N1.
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Exceção: Sem Proposta para Alterações N1</h4>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-600">⚡</span>
              <span className="font-semibold text-amber-800 dark:text-amber-300">Regra Especial</span>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Quando um membro da <strong>Equipe 2.1</strong> ou um <strong>administrador</strong> altera <strong>apenas</strong> os campos
              N1, Validado N1 ou Enviado N1 — sem modificar conteúdo ou nome — a alteração é salva diretamente,
              <strong> sem exigir proposta de revisão</strong> e <strong>sem gerar versionamento</strong>.
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              Se o conteúdo ou nome também forem modificados, o fluxo normal (proposta/curadoria) é aplicado.
            </p>
          </div>

          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mt-4">Exportação de Documento</h4>
          <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600">📄</span>
              <span className="font-semibold text-green-800 dark:text-green-300">Botão no Card</span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300">
              O botão 📄 no card do script gera um documento HTML formatado (layout A4 corporativo) que
              pode ser salvo como PDF via <strong>Ctrl+P</strong> no navegador. Inclui metadados como nome,
              referência, categoria, pergunta e tipo do requisitante.
            </p>
          </div>
        </div>
      ),
    },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <HelpCircle className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Central de Ajuda - Scripts</h2>
                <p className="text-blue-100 text-sm">Aprenda a usar todas as funcionalidades</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              title="Fechar (ESC)"
            >
              <X size={24} />
            </button>
          </div>

          {/* Controles */}
          <div className="px-6 py-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Clique nos cards para expandir/recolher as seções
            </p>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
              >
                Expandir Tudo
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                Recolher Tudo
              </button>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-3">
              {sections.map((section) => (
                <HelpCard
                  key={section.id}
                  section={section}
                  isExpanded={expandedSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Pressione <Key>ESC</Key> para fechar • Dúvidas? Consulte a equipe de suporte
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

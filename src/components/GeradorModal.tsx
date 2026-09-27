import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, CheckCircle, FileText, Check, Users, Wrench, Info } from 'lucide-react';
import { toast } from 'sonner';

interface GeradorModalProps {
  isOpen: boolean;
  onClose: () => void;
  script: { nome: string; conteudo_bruto: string; conteudo_atendente?: string | null };
}

interface FieldToken {
  tipo: 'dropdown' | 'input';
  opcoes?: string[];
}

const TOKEN_REGEX = /\{\[((?:[^\[\]]+)(?:\]\[.*?)*?)\]\}|\(\)/g;

function parseTokens(conteudo: string): FieldToken[] {
  const tokens: FieldToken[] = [];
  let match;

  TOKEN_REGEX.lastIndex = 0;

  while ((match = TOKEN_REGEX.exec(conteudo))) {
    if (match[0].startsWith('{[')) {
      const opcoes = match[1].split('][');
      tokens.push({ tipo: 'dropdown', opcoes });
    } else if (match[0] === '()') {
      tokens.push({ tipo: 'input' });
    }
  }

  return tokens;
}

function replaceTokensInHtml(
  html: string,
  tokens: FieldToken[],
  valores: { [id: number]: string },
  mode: 'html' | 'text'
): string {
  let tokenIndex = 0;

  TOKEN_REGEX.lastIndex = 0;

  return html.replace(TOKEN_REGEX, () => {
    const token = tokens[tokenIndex];
    const valor = valores[tokenIndex] ?? '';
    const fallback = token?.tipo === 'dropdown' ? '(selecione)' : '(preencha)';
    tokenIndex += 1;

    if (mode === 'html') {
      return valor || `<span style="color: #d97706;">${fallback}</span>`;
    }

    return valor || fallback;
  });
}

// Componente de chip editável com popover
interface EditableChipProps {
  tipo: 'dropdown' | 'input';
  valor: string;
  opcoes?: string[];
  onChange: (valor: string) => void;
  numero: number;
}

const EditableChip: React.FC<EditableChipProps> = ({ tipo, valor, opcoes, onChange, numero }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempValor, setTempValor] = useState(valor);
  const chipRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEmpty = !valor.trim();
  const isDropdown = tipo === 'dropdown';
  const isInput = tipo === 'input';

  // Sincronizar tempValor quando valor externo muda
  useEffect(() => {
    setTempValor(valor);
  }, [valor]);

  // Fechar popover ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(e.target as Node) &&
        chipRef.current &&
        !chipRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focar no input quando abrir
      setTimeout(() => inputRef.current?.focus(), 50);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleConfirm = () => {
    onChange(tempValor);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      setTempValor(valor);
      setIsOpen(false);
    }
  };

  return (
    <span className="relative inline">
      {/* Chip clicável */}
      <span
        ref={chipRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline cursor-pointer transition-all duration-150
          ${isEmpty && isInput
            ? 'bg-red-50 text-red-700 border-b-2 border-dashed border-red-400 hover:bg-red-100 ring-2 ring-red-300 ring-offset-1'
            : isEmpty
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-b-2 border-dashed border-amber-400'
              : isDropdown
                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                : 'text-inherit'
          }
          ${isOpen ? 'ring-2 ring-amber-400 ring-offset-1 rounded' : ''}
        `}
        style={{ 
          padding: isEmpty ? '0 4px' : '0 1px',
          borderRadius: isEmpty ? '3px' : '0',
        }}
        title={`Campo ${numero}: Clique para ${isDropdown ? 'selecionar' : 'editar'}`}
      >
        {isEmpty ? `📝 ${numero}` : valor}
      </span>

      {/* Popover de edição */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[200px]"
            style={{ top: '100%' }}
          >
            <div className="text-xs text-gray-500 dark:text-gray-300 mb-2 font-medium">
              Campo {numero} {isDropdown ? '(selecione)' : '(digite)'}
            </div>
            
            {isDropdown && opcoes ? (
              <select
                value={tempValor}
                onChange={(e) => {
                  setTempValor(e.target.value);
                  onChange(e.target.value);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              >
                {opcoes.map((opt, idx) => (
                  <option key={idx} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <>
                <input
                  ref={inputRef}
                  type="text"
                  value={tempValor}
                  onChange={(e) => setTempValor(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite o valor..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => {
                      setTempValor(valor);
                      setIsOpen(false);
                    }}
                    className="px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors flex items-center gap-1"
                  >
                    <Check size={12} />
                    OK
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};

export const GeradorModal: React.FC<GeradorModalProps> = ({ isOpen, onClose, script }) => {
  const [activeTab, setActiveTab] = useState<'usuario_final' | 'atendente'>('usuario_final');

  // Estado independente por aba
  const [tokensUsuario, setTokensUsuario] = useState<FieldToken[]>([]);
  const [valoresUsuario, setValoresUsuario] = useState<{ [id: number]: string }>({});
  const [tokensAtendente, setTokensAtendente] = useState<FieldToken[]>([]);
  const [valoresAtendente, setValoresAtendente] = useState<{ [id: number]: string }>({});
  const [copied, setCopied] = useState(false);

  // Tokens/valores da aba ativa
  const tokens = activeTab === 'usuario_final' ? tokensUsuario : tokensAtendente;
  const valores = activeTab === 'usuario_final' ? valoresUsuario : valoresAtendente;
  const conteudoAtivo = activeTab === 'usuario_final' ? script.conteudo_bruto : (script.conteudo_atendente ?? '');
  const hasConteudoAtendente = !!(script.conteudo_atendente && script.conteudo_atendente.trim());

  // Contador de campos editáveis para numeração
  const camposEditaveis = tokens;

  // Inicializar tokens do usuário final
  useEffect(() => {
    if (!script?.conteudo_bruto) return;
    
    const novosTokens = parseTokens(script.conteudo_bruto);
    setTokensUsuario(novosTokens);
    
    const inicial: { [id: number]: string } = {};
    novosTokens.forEach((token, index) => {
      if (token.tipo === 'dropdown' && token.opcoes) inicial[index] = token.opcoes[0];
      else if (token.tipo === 'input') inicial[index] = '';
    });
    setValoresUsuario(inicial);
    setCopied(false);
    setActiveTab('usuario_final');
  }, [script]);

  // Inicializar tokens do atendente
  useEffect(() => {
    if (!script?.conteudo_atendente) {
      setTokensAtendente([]);
      setValoresAtendente({});
      return;
    }
    
    const novosTokens = parseTokens(script.conteudo_atendente);
    setTokensAtendente(novosTokens);
    
    const inicial: { [id: number]: string } = {};
    novosTokens.forEach((token, index) => {
      if (token.tipo === 'dropdown' && token.opcoes) inicial[index] = token.opcoes[0];
      else if (token.tipo === 'input') inicial[index] = '';
    });
    setValoresAtendente(inicial);
  }, [script]);

  const handleChange = (id: number, novo: string) => {
    if (activeTab === 'usuario_final') {
      setValoresUsuario((prev) => ({ ...prev, [id]: novo }));
    } else {
      setValoresAtendente((prev) => ({ ...prev, [id]: novo }));
    }
  };

  // Gerar texto final limpo para cópia (sem HTML de elementos interativos)
  const gerarTextoFinal = (): string => {
    const htmlComValores = replaceTokensInHtml(
      conteudoAtivo,
      tokens,
      valores,
      'text'
    );

    // Converter HTML para texto, preservando quebras de linha
    return htmlComValores
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/div>/gi, '\n')
      .replace(/<div[^>]*>/gi, '')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/?[uo]l[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
  };

  // Gerar HTML limpo para cópia rica
  const gerarHtmlFinal = (): string => {
    const htmlComValores = replaceTokensInHtml(
      conteudoAtivo,
      tokens,
      valores,
      'html'
    );

    return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">${htmlComValores}</div>`;
  };

  const handleCopy = async () => {
    try {
      const camposLivresVazios = tokens.filter((token, index) => {
        if (token.tipo !== 'input') return false;
        return !valores[index]?.trim();
      });

      if (camposLivresVazios.length > 0) {
        toast.error('Preencha todos os campos livres antes de copiar o script.');
        return;
      }

      const textoPlano = gerarTextoFinal();
      const htmlFormatado = gerarHtmlFinal();
      
      try {
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([htmlFormatado], { type: 'text/html' }),
          'text/plain': new Blob([textoPlano], { type: 'text/plain' })
        });
        await navigator.clipboard.write([clipboardItem]);
      } catch {
        // Fallback: copiar apenas texto plano
        await navigator.clipboard.writeText(textoPlano);
      }
      
      setCopied(true);
      toast.success('Script copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
      toast.error('Erro ao copiar texto');
    }
  };

  // Renderizar HTML com chips editáveis dentro da estrutura do documento
  const renderHtmlWithChips = (html: string): React.ReactNode[] => {
    if (typeof window === 'undefined') return [html];

    // Tags HTML void (não podem ter children)
    const VOID_ELEMENTS = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr',
    ]);

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    let fieldIndex = 0;
    let nodeKeyCounter = 0;

    const mapNode = (node: ChildNode): React.ReactNode => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? '';
        const parts: React.ReactNode[] = [];
        let lastIdx = 0;
        let match;
        let partKey = 0;

        TOKEN_REGEX.lastIndex = 0;
        while ((match = TOKEN_REGEX.exec(text))) {
          if (match.index > lastIdx) {
            parts.push(<React.Fragment key={`txt-${nodeKeyCounter}-${partKey++}`}>{text.slice(lastIdx, match.index)}</React.Fragment>);
          }

          const tokenText = match[0];
          const token: FieldToken = tokenText.startsWith('{[')
            ? { tipo: 'dropdown', opcoes: match[1].split('][') }
            : { tipo: 'input' };

          const currentIndex = fieldIndex;
          fieldIndex += 1;

          parts.push(
            <EditableChip
              key={`chip-${currentIndex}`}
              tipo={token.tipo}
              valor={valores[currentIndex] ?? ''}
              opcoes={token.opcoes}
              onChange={(v) => handleChange(currentIndex, v)}
              numero={currentIndex + 1}
            />
          );

          lastIdx = TOKEN_REGEX.lastIndex;
        }

        if (lastIdx < text.length) {
          parts.push(<React.Fragment key={`txt-${nodeKeyCounter}-${partKey++}`}>{text.slice(lastIdx)}</React.Fragment>);
        }

        nodeKeyCounter++;
        return parts.length === 1 ? parts[0] : parts;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tag = element.tagName.toLowerCase();
        const key = `el-${nodeKeyCounter++}`;

        if (tag === 'script' || tag === 'style') return null;

        // Void elements: não podem ter children
        if (VOID_ELEMENTS.has(tag)) {
          if (tag === 'br') return <br key={key} />;
          if (tag === 'hr') return <hr key={key} />;
          if (tag === 'img') {
            return (
              <img
                key={key}
                src={element.getAttribute('src') ?? ''}
                alt={element.getAttribute('alt') ?? ''}
                title={element.getAttribute('title') ?? undefined}
                style={{ maxWidth: '100%' }}
              />
            );
          }
          // Outros void elements genéricos
          return React.createElement(tag, { key });
        }

        const children = Array.from(element.childNodes).map(mapNode);

        if (tag === 'a') {
          return (
            <a
              key={key}
              href={element.getAttribute('href') ?? undefined}
              target={element.getAttribute('target') ?? undefined}
              rel={element.getAttribute('rel') ?? 'noopener noreferrer'}
            >
              {children}
            </a>
          );
        }

        return React.createElement(tag, { key }, children);
      }

      return null;
    };

    return Array.from(doc.body.childNodes).map(mapNode);
  };

  if (!isOpen) return null;

  // Verificar se há campos não preenchidos
  const camposVazios = camposEditaveis.filter((_, index) => !valores[index]?.trim()).length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={24} />
                <div>
                  <h2 className="text-xl font-semibold">Gerar Script</h2>
                  <p className="text-green-100 text-sm">{script.nome}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Fechar"
              >
                <X size={24} />
              </button>
            </div>

            {/* Abas pill-style */}
            <div className="flex bg-white/20 rounded-lg p-1 mt-3 w-fit">
              <button
                onClick={() => setActiveTab('usuario_final')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  activeTab === 'usuario_final' ? 'bg-white text-green-700 font-medium shadow-sm' : 'text-white hover:bg-white/10'
                }`}
              >
                <Users size={14} />
                Usuário final
              </button>
              <button
                onClick={() => setActiveTab('atendente')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  activeTab === 'atendente' ? 'bg-white text-green-700 font-medium shadow-sm' : 'text-white hover:bg-white/10'
                }`}
              >
                <Wrench size={14} />
                Atendente
              </button>
            </div>
          </div>

          {/* Instruções */}
          {camposEditaveis.length > 0 && (
            <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 flex items-center gap-3">
              <span className="text-amber-600 text-lg">💡</span>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Clique nos campos <span className="bg-amber-100 px-1.5 py-0.5 rounded border-b-2 border-dashed border-amber-400 text-amber-700 font-medium">📝 1</span> para preencher. 
                {camposVazios > 0 && (
                  <span className="ml-1 text-amber-600 font-medium">
                    ({camposVazios} campo{camposVazios > 1 ? 's' : ''} pendente{camposVazios > 1 ? 's' : ''})
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Conteúdo com scroll - Texto com chips integrados */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'atendente' && !hasConteudoAtendente ? (
              /* Estado vazio — sem conteúdo de atendente */
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Info size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">Nenhum script para o atendente</h3>
                <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm">
                  Este script ainda não possui orientações para o atendente. Use o editor (ícone de lápis) para adicionar conteúdo.
                </p>
              </div>
            ) : (
              <div
                className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-gray-800 dark:text-gray-200"
                style={{ lineHeight: '1.8' }}
              >
                {renderHtmlWithChips(conteudoAtivo)}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex items-center justify-between shrink-0">
            <div className="text-sm text-gray-500 dark:text-gray-300">
              {activeTab === 'atendente' && !hasConteudoAtendente
                ? 'Sem conteúdo para copiar nesta aba'
                : 'Preencha os campos e clique em "Copiar" para usar o texto'
              }
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
              >
                Fechar
              </button>
              <button
                onClick={handleCopy}
                disabled={activeTab === 'atendente' && !hasConteudoAtendente}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                  activeTab === 'atendente' && !hasConteudoAtendente
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : copied 
                      ? 'bg-green-600 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

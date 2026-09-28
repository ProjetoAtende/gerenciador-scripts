// components/RichTextEditor.tsx - Editor de texto rico para scripts
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Link, Palette, Undo2, Redo2, Image, Video, Type
} from 'lucide-react';
import { isHtmlEmpty, normalizeEmptyHtml } from '../utils/htmlUtils';
import { ImageOperations } from '../services/imageOperations';
import { VideoOperations } from '../services/videoOperations';
import { useDarkModeColorFixEditable } from '../hooks/useDarkModeColorFix';
import { toast } from 'sonner';
import { AIAssistantMenu, type AIContext } from './AIAssistantMenu';
import { isAllowedLinkUrl } from '../utils/sanitizeStackHtml';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  scriptId?: string;
  aiContext?: AIContext;
  /** Oculta o menu de IA (ex.: Atende Stack). */
  hideAssistant?: boolean;
  /** Área editável cresce com o container (modal Stack). */
  fillHeight?: boolean;
}

const FONT_FAMILIES = [
  // Fontes Sans-Serif (sem serifa)
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Arial Black', value: 'Arial Black, sans-serif' },
  { name: 'Arial Narrow', value: 'Arial Narrow, sans-serif' },
  { name: 'Calibri', value: 'Calibri, sans-serif' },
  { name: 'Candara', value: 'Candara, sans-serif' },
  { name: 'Century Gothic', value: 'Century Gothic, sans-serif' },
  { name: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
  { name: 'Corbel', value: 'Corbel, sans-serif' },
  { name: 'Franklin Gothic Medium', value: 'Franklin Gothic Medium, sans-serif' },
  { name: 'Helvetica', value: 'Helvetica, sans-serif' },
  { name: 'Impact', value: 'Impact, sans-serif' },
  { name: 'Lucida Sans Unicode', value: 'Lucida Sans Unicode, sans-serif' },
  { name: 'Microsoft Sans Serif', value: 'Microsoft Sans Serif, sans-serif' },
  { name: 'Segoe UI', value: 'Segoe UI, sans-serif' },
  { name: 'Tahoma', value: 'Tahoma, sans-serif' },
  { name: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
  
  // Fontes Serif (com serifa)
  { name: 'Book Antiqua', value: 'Book Antiqua, serif' },
  { name: 'Cambria', value: 'Cambria, serif' },
  { name: 'Constantia', value: 'Constantia, serif' },
  { name: 'Garamond', value: 'Garamond, serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Palatino Linotype', value: 'Palatino Linotype, serif' },
  { name: 'Times New Roman', value: 'Times New Roman, serif' },
  
  // Fontes Monospace (monoespaçadas)
  { name: 'Consolas', value: 'Consolas, monospace' },
  { name: 'Courier New', value: 'Courier New, monospace' },
  { name: 'Lucida Console', value: 'Lucida Console, monospace' },
  
  // Fontes Web/Modernas populares
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Lato', value: 'Lato, sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Open Sans', value: 'Open Sans, sans-serif' },
  { name: 'Poppins', value: 'Poppins, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Source Sans Pro', value: 'Source Sans Pro, sans-serif' },
];

const FONT_SIZES = [
  { name: 'Pequeno', value: '12px' },
  { name: 'Normal', value: '14px' },
  { name: 'Médio', value: '16px' },
  { name: 'Grande', value: '18px' },
  { name: 'Extra Grande', value: '24px' },
];

const HEADING_STYLES = [
  { name: 'Parágrafo', value: 'p' },
  { name: 'Título 1', value: 'h1' },
  { name: 'Título 2', value: 'h2' },
  { name: 'Título 3', value: 'h3' },
];

const TEXT_COLORS = [
  '#000000', '#333333', '#666666', '#999999',
  '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500',
  '#800080', '#008000', '#800000', '#008080',
  '#000080', '#C0C0C0'
];

const BACKGROUND_COLORS = [
  'transparent', '#FFFFFF', '#F0F0F0', '#E0E0E0',
  '#FFE4E1', '#E1FFE1', '#E1E1FF', '#FFFFE1',
  '#FFE1FF', '#E1FFFF', '#FFE1B5', '#E1B5FF'
];

export const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  className = '',
  scriptId,
  aiContext,
  hideAssistant = false,
  fillHeight = false,
}: RichTextEditorProps) => {
  const tb = (label: string) =>
    hideAssistant ? { title: label, 'aria-label': label } : { title: label };

  const toolbarBtn =
    'rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors' +
    (hideAssistant
      ? ' p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center'
      : ' p-1.5');

  const toolbarSelect =
    'px-2 text-sm border rounded dark:border-gray-600 dark:bg-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500' +
    (hideAssistant ? ' min-h-[44px] py-2' : ' py-1');

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { getCleanHtml, reapplyFix } = useDarkModeColorFixEditable(editorRef);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Rastreia o scriptId anterior para detectar mudança de script
  const prevScriptIdRef = useRef<string | undefined>(undefined);
  // Flag para indicar se já foi inicializado
  const initializedRef = useRef<boolean>(false);
  
  // Estado para modal de escolha de fonte de vídeo (upload ou URL)
  const [showVideoSourceModal, setShowVideoSourceModal] = useState(false);
  // Estado para modal de input de URL de vídeo
  const [showVideoUrlModal, setShowVideoUrlModal] = useState(false);
  // Estado para modal de texto do link do vídeo
  const [showVideoLinkTextModal, setShowVideoLinkTextModal] = useState(false);
  const [pendingVideoUrl, setPendingVideoUrl] = useState<string | null>(null);
  const [videoLinkText, setVideoLinkText] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  // Ref para salvar a seleção/posição do cursor antes de abrir o modal
  const savedSelectionRef = useRef<Range | null>(null);

  // Estados para drag-and-drop de mídia
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const draggedMediaRef = useRef<HTMLElement | null>(null);

  // Estados para rastrear a formatação atual na posição do cursor
  const [currentFontFamily, setCurrentFontFamily] = useState('');
  const [currentFontSize, setCurrentFontSize] = useState('');
  
  // Estados para formatação de texto (negrito, itálico, etc.)
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  
  // Estados para parágrafo/título, alinhamento e listas
  const [currentBlockFormat, setCurrentBlockFormat] = useState('p');
  const [currentAlignment, setCurrentAlignment] = useState('left');
  const [isUnorderedList, setIsUnorderedList] = useState(false);
  const [isOrderedList, setIsOrderedList] = useState(false);
  
  // Estados para cor atual do texto e fundo
  const [currentTextColor, setCurrentTextColor] = useState('#000000');
  const [currentBgColor, setCurrentBgColor] = useState('transparent');

  // Função para detectar a formatação atual na posição do cursor
  const detectCurrentFormatting = useCallback(() => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    
    // Verificar se a seleção está dentro do editor
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;
    
    // Obter o elemento na posição do cursor
    let targetNode: Node | null = range.startContainer;
    let targetElement: HTMLElement | null = null;
    
    // Se for um nó de texto, pegar o elemento pai
    if (targetNode.nodeType === Node.TEXT_NODE) {
      targetElement = targetNode.parentElement;
    } else if (targetNode.nodeType === Node.ELEMENT_NODE) {
      targetElement = targetNode as HTMLElement;
    }
    
    if (!targetElement) return;
    
    // Obter estilos computados
    const computedStyle = window.getComputedStyle(targetElement);
    
    // Detectar fonte
    const fontFamily = computedStyle.fontFamily;
    // Normalizar a fonte removendo aspas e pegando apenas a primeira
    const normalizedFont = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    
    // Encontrar a fonte correspondente na lista (busca flexível)
    let matchedFont = FONT_FAMILIES.find(f => {
      const fontValue = f.value.split(',')[0].replace(/['"]/g, '').trim();
      return fontValue.toLowerCase() === normalizedFont.toLowerCase();
    });
    
    // Se não encontrar match exato, tentar match parcial
    if (!matchedFont) {
      matchedFont = FONT_FAMILIES.find(f => {
        const fontValue = f.value.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
        const normalized = normalizedFont.toLowerCase();
        return fontValue.includes(normalized) || normalized.includes(fontValue);
      });
    }
    
    setCurrentFontFamily(matchedFont?.value || '');
    
    // Detectar tamanho da fonte
    const fontSize = computedStyle.fontSize;
    const fontSizeNum = parseFloat(fontSize);
    
    // Mapear tamanho para o índice (fontSize command usa 1-7)
    let sizeIndex = '';
    if (fontSizeNum <= 12) sizeIndex = '1';
    else if (fontSizeNum <= 14) sizeIndex = '2';
    else if (fontSizeNum <= 16) sizeIndex = '3';
    else if (fontSizeNum <= 18) sizeIndex = '4';
    else sizeIndex = '5';
    
    setCurrentFontSize(sizeIndex);
    
    // Detectar formatação de texto (negrito, itálico, sublinhado, riscado)
    // Usar queryCommandState para detecção mais precisa
    setIsBold(document.queryCommandState('bold'));
    setIsItalic(document.queryCommandState('italic'));
    setIsUnderline(document.queryCommandState('underline'));
    setIsStrikethrough(document.queryCommandState('strikeThrough'));
    
    // Detectar formato de bloco (parágrafo, título)
    let blockElement: HTMLElement | null = targetElement;
    while (blockElement && blockElement !== editorRef.current) {
      const tagName = blockElement.tagName.toLowerCase();
      if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        setCurrentBlockFormat(tagName);
        break;
      }
      const parent: HTMLElement | null = blockElement.parentElement;
      if (!parent) break;
      blockElement = parent;
    }
    
    // Detectar alinhamento
    const textAlign = computedStyle.textAlign;
    setCurrentAlignment(textAlign === 'start' ? 'left' : textAlign);
    
    // Detectar listas
    setIsUnorderedList(document.queryCommandState('insertUnorderedList'));
    setIsOrderedList(document.queryCommandState('insertOrderedList'));
    
    // Detectar cor do texto
    const textColor = computedStyle.color;
    setCurrentTextColor(rgbToHex(textColor));
    
    // Detectar cor de fundo
    const bgColor = computedStyle.backgroundColor;
    if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
      setCurrentBgColor('transparent');
    } else {
      setCurrentBgColor(rgbToHex(bgColor));
    }
  }, []);

  // Helper: converter rgb(r, g, b) para hex
  const rgbToHex = (rgb: string): string => {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgb;
    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  };

  // Função para salvar a seleção atual
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  // Função para restaurar a seleção salva
  const restoreSelection = () => {
    const selection = window.getSelection();
    if (selection && savedSelectionRef.current) {
      selection.removeAllRanges();
      selection.addRange(savedSelectionRef.current);
    }
  };

  // Sincronizar conteúdo do editor com o valor recebido
  useEffect(() => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const isNewScript = scriptId !== prevScriptIdRef.current;
    const isFirstRender = !initializedRef.current;

    // Atualizar conteúdo se for um script diferente OU primeira renderização
    if (isNewScript || isFirstRender) {
      // Configurar estilos na primeira vez
      if (isFirstRender) {
        editor.style.direction = 'ltr';
        editor.style.textAlign = 'left';
        initializedRef.current = true;
      }

      // Atualizar conteúdo
      editor.innerHTML = value || '<p><br></p>';
      prevScriptIdRef.current = scriptId;
      // Re-aplicar fix de cores escuras no novo conteúdo
      reapplyFix();
    }
  }, [scriptId, value, reapplyFix]);

  // Listener para detectar mudanças na seleção e atualizar os controles de formatação
  useEffect(() => {
    const handleSelectionChange = () => {
      detectCurrentFormatting();
    };

    // Escutar mudanças de seleção no documento
    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [detectCurrentFormatting]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      // Usa getCleanHtml() para obter innerHTML SEM modificações de dark mode
      const htmlContent = getCleanHtml();

      if (isHtmlEmpty(htmlContent)) {
        editorRef.current.innerHTML = '<p><br></p>';
        reapplyFix();
        onChange('');
      } else {
        onChange(normalizeEmptyHtml(htmlContent));
      }
    }
  }, [onChange, getCleanHtml, reapplyFix]);

  const executeCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Atalhos de teclado
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          executeCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          executeCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          executeCommand('underline');
          break;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            executeCommand('redo');
          } else {
            executeCommand('undo');
          }
          break;
        case 'y':
          e.preventDefault();
          executeCommand('redo');
          break;
      }
    }
  };

  const insertLink = () => {
    const url = prompt('Digite a URL do link:');
    if (!url) return;
    if (!isAllowedLinkUrl(url)) {
      window.alert('URL não permitida. Use http(s):// ou mailto:.');
      return;
    }
    executeCommand('createLink', url);
  };

  // Handler de paste para interceptar imagens coladas do clipboard
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Verificar se há imagens no clipboard
    const imageItems: DataTransferItem[] = [];
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.type.startsWith('image/')) {
        imageItems.push(item);
      }
    }

    // Se não há imagens, deixar o paste padrão acontecer (texto/html)
    if (imageItems.length === 0) return;

    // Se há scriptId, fazer upload para o storage
    if (scriptId) {
      e.preventDefault();
      setUploading(true);
      try {
        for (const item of imageItems) {
          const file = item.getAsFile();
          if (!file) continue;

          const result = await ImageOperations.uploadImage(file, scriptId);
          if (result.success && result.imageUrl) {
            const imgHtml = `<img src="${result.imageUrl}" alt="imagem colada" style="max-width: 100%; height: auto; margin: 8px 0;" />`;
            document.execCommand('insertHTML', false, imgHtml + '<p><br></p>');
            handleInput();
            toast.success('Imagem colada e enviada com sucesso');
          } else {
            toast.error(result.error || 'Erro ao fazer upload da imagem colada');
          }
        }
      } catch (error) {
        console.error('Erro ao processar imagem colada:', error);
        toast.error('Erro ao processar imagem colada');
      } finally {
        setUploading(false);
      }
    }
    // Se não tem scriptId, deixar o browser inserir como base64 (comportamento padrão)
  }, [scriptId, handleInput]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !scriptId) return;

    setUploading(true);
    try {
      const result = await ImageOperations.uploadImage(file, scriptId);
      if (result.success && result.imageUrl) {
        const imgHtml = `<img src="${result.imageUrl}" alt="${file.name}" style="max-width: 100%; height: auto; margin: 8px 0;" />`;
        // Adicionar parágrafo vazio após a imagem para permitir continuar digitando
        document.execCommand('insertHTML', false, imgHtml + '<p><br></p>');
        handleInput();
        toast.success('Imagem inserida com sucesso');
      } else {
        toast.error(result.error || 'Erro ao fazer upload da imagem');
      }
    } catch (error) {
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !scriptId) return;

    // Salvar a posição do cursor antes do upload
    saveSelection();

    setUploading(true);
    try {
      const result = await VideoOperations.uploadVideo(file, scriptId);
      if (result.success && result.videoUrl) {
        // Salvar URL e abrir modal para definir texto do link
        setPendingVideoUrl(result.videoUrl);
        setVideoLinkText('Clique aqui para assistir ao vídeo');
        setShowVideoLinkTextModal(true);
      } else {
        toast.error(result.error || 'Erro ao fazer upload do vídeo');
      }
    } catch (error) {
      toast.error('Erro ao fazer upload do vídeo');
    } finally {
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  // Inserir link do vídeo no script
  const insertVideoLink = () => {
    if (!pendingVideoUrl || !videoLinkText.trim()) {
      toast.error('Digite um texto para o link');
      return;
    }
    
    // Restaurar a posição do cursor no editor
    editorRef.current?.focus();
    restoreSelection();
    
    const linkHtml = `<a href="${pendingVideoUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${videoLinkText.trim()}</a>`;
    // Adicionar espaço após o link para permitir continuar digitando
    document.execCommand('insertHTML', false, linkHtml + '&nbsp;');
    handleInput();
    toast.success('Link do vídeo inserido com sucesso');
    
    // Limpar estados
    setShowVideoLinkTextModal(false);
    setPendingVideoUrl(null);
    setVideoLinkText('');
  };

  // Abrir modal para inserir URL do vídeo
  const openVideoUrlModal = () => {
    setShowVideoSourceModal(false);
    setVideoUrlInput('');
    setShowVideoUrlModal(true);
  };

  // Processar URL de vídeo inserida
  const processVideoUrl = () => {
    const url = videoUrlInput.trim();
    if (!url) {
      toast.error('Digite uma URL válida');
      return;
    }

    // Salvar URL e abrir modal para texto do link
    setPendingVideoUrl(url);
    setVideoLinkText('Clique aqui para assistir ao vídeo');
    setShowVideoUrlModal(false);
    setShowVideoLinkTextModal(true);
  };



  // Funções para o assistente de IA
  const getFullText = useCallback((): string => {
    if (editorRef.current) {
      return editorRef.current.innerHTML;
    }
    return '';
  }, []);

  const handleAIInsertText = useCallback((newText: string) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = newText;
      handleInput();
    }
  }, [handleInput]);

  // ============================================================================
  // SISTEMA DE DRAG-AND-DROP PARA MÍDIAS (IMAGENS, VÍDEOS, IFRAMES)
  // ============================================================================

  // Configurar handlers de drag nas mídias dentro do editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const setupDraggableMedia = () => {
      // Selecionar todas as mídias no editor
      const mediaElements = editor.querySelectorAll('img, video, iframe');
      
      mediaElements.forEach((media) => {
        const element = media as HTMLElement;
        
        // Configurar como arrastável
        element.setAttribute('draggable', 'true');
        element.style.cursor = 'grab';
        
        // Adicionar classe para identificação e estilo
        if (!element.classList.contains('draggable-media')) {
          element.classList.add('draggable-media');
        }
      });
    };

    // Configurar inicialmente
    setupDraggableMedia();

    // Observar mudanças no conteúdo do editor para reconfigurar mídias
    const observer = new MutationObserver(() => {
      setupDraggableMedia();
    });

    observer.observe(editor, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Handler para início do arraste
  const handleMediaDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    
    // Verificar se é uma mídia arrastável
    if (target.tagName === 'IMG' || target.tagName === 'VIDEO' || target.tagName === 'IFRAME') {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', target.outerHTML);
      
      draggedMediaRef.current = target;
      setIsDraggingMedia(true);
      
      // Adicionar classe visual de arraste
      target.classList.add('dragging');
      target.style.opacity = '0.5';
    }
  }, []);

  // Handler para fim do arraste
  const handleMediaDragEnd = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    
    // Remover estilos de arraste
    target.classList.remove('dragging');
    target.style.opacity = '1';
    
    setIsDraggingMedia(false);
    draggedMediaRef.current = null;

    // Remover indicadores de drop
    const editor = editorRef.current;
    if (editor) {
      const dropIndicators = editor.querySelectorAll('.drop-indicator');
      dropIndicators.forEach(el => el.remove());
    }
  }, []);

  // Handler para arraste sobre o editor
  const handleMediaDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (!isDraggingMedia || !editorRef.current) return;

    const editor = editorRef.current;
    const rect = editor.getBoundingClientRect();
    const y = e.clientY - rect.top + editor.scrollTop;

    // Encontrar o elemento mais próximo para inserir antes/depois
    const elements = Array.from(editor.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, ul, ol, img, video, iframe, br'));
    
    let closestElement: Element | null = null;
    let closestDistance = Infinity;
    let insertBefore = true;

    elements.forEach((el) => {
      if (el === draggedMediaRef.current) return;
      
      const elRect = el.getBoundingClientRect();
      const elY = elRect.top - rect.top + editor.scrollTop;
      const elMiddle = elY + elRect.height / 2;
      const distance = Math.abs(y - elMiddle);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestElement = el;
        insertBefore = y < elMiddle;
      }
    });

    // Atualizar indicador visual
    const existingIndicator = editor.querySelector('.drop-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    if (closestElement && closestElement !== draggedMediaRef.current) {
      const targetElement = closestElement as Element;
      const indicator = document.createElement('div');
      indicator.className = 'drop-indicator';
      indicator.style.cssText = `
        height: 3px;
        background: linear-gradient(90deg, #8b5cf6, #a78bfa);
        border-radius: 2px;
        margin: 4px 0;
        pointer-events: none;
        animation: pulse 1s infinite;
      `;
      
      const parent = targetElement.parentNode;
      if (parent) {
        if (insertBefore) {
          parent.insertBefore(indicator, targetElement);
        } else {
          parent.insertBefore(indicator, targetElement.nextSibling);
        }
      }
    }
  }, [isDraggingMedia]);

  // Handler para drop
  const handleMediaDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (!isDraggingMedia || !draggedMediaRef.current || !editorRef.current) return;

    const editor = editorRef.current;
    const draggedMedia = draggedMediaRef.current;
    
    // Encontrar o indicador de drop
    const indicator = editor.querySelector('.drop-indicator');
    
    if (indicator && indicator.parentNode) {
      // Mover a mídia para a posição do indicador
      indicator.parentNode.insertBefore(draggedMedia, indicator);
      indicator.remove();
      
      // Notificar a mudança
      handleInput();
      toast.success('Mídia movida com sucesso!');
    }

    // Limpar estados
    setIsDraggingMedia(false);
    draggedMediaRef.current = null;
  }, [isDraggingMedia, handleInput]);

  // Handler para drag leave
  const handleMediaDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Verificar se realmente saiu do editor
    const relatedTarget = e.relatedTarget as Node;
    if (editorRef.current && !editorRef.current.contains(relatedTarget)) {
      const indicator = editorRef.current.querySelector('.drop-indicator');
      if (indicator) {
        indicator.remove();
      }
    }
  }, []);

  return (
    <div
      className={`rich-text-editor border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800 flex flex-col ${fillHeight ? 'min-h-0 h-full' : ''} ${className}`}
    >
      {/* Toolbar */}
      <div className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 p-2 flex flex-wrap gap-1 items-center shrink-0">
        {/* Histórico */}
        <div className="flex border-r dark:border-gray-600 pr-2 mr-2">
          <button
            type="button"
            onClick={() => executeCommand('undo')}
            className={toolbarBtn}
            {...tb('Desfazer (Ctrl+Z)')}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('redo')}
            className={toolbarBtn}
            {...tb('Refazer (Ctrl+Y)')}
          >
            <Redo2 size={16} />
          </button>
        </div>

        {/* Estilos de cabeçalho */}
        <div className="border-r dark:border-gray-600 pr-2 mr-2">
          <select
            value={currentBlockFormat}
            onChange={(e) => {
              executeCommand('formatBlock', e.target.value);
              setCurrentBlockFormat(e.target.value);
            }}
            className={toolbarSelect}
            aria-label={hideAssistant ? 'Estilo de parágrafo' : undefined}
          >
            {HEADING_STYLES.map(style => (
              <option key={style.value} value={style.value}>
                {style.name}
              </option>
            ))}
          </select>
        </div>

        {/* Fonte e Tamanho */}
        <div className="border-r dark:border-gray-600 pr-2 mr-2 flex gap-1">
          <select
            value={currentFontFamily}
            onChange={(e) => {
              executeCommand('fontName', e.target.value);
              setCurrentFontFamily(e.target.value);
            }}
            className={toolbarSelect}
            aria-label={hideAssistant ? 'Fonte' : undefined}
          >
            <option value="">Fonte</option>
            {FONT_FAMILIES.map(font => (
              <option key={font.value} value={font.value}>
                {font.name}
              </option>
            ))}
          </select>
          <select
            value={currentFontSize}
            onChange={(e) => {
              executeCommand('fontSize', e.target.value);
              setCurrentFontSize(e.target.value);
            }}
            className={toolbarSelect}
            aria-label={hideAssistant ? 'Tamanho da fonte' : undefined}
          >
            <option value="">Tamanho</option>
            {FONT_SIZES.map((size, index) => (
              <option key={size.value} value={String(index + 1)}>
                {size.name}
              </option>
            ))}
          </select>
        </div>

        {/* Formatação */}
        <div className="flex border-r dark:border-gray-600 pr-2 mr-2">
          <button
            type="button"
            onClick={() => executeCommand('bold')}
            className={`${toolbarBtn} transition-colors ${isBold ? 'bg-blue-200 text-blue-700' : ''}`}
            {...tb('Negrito (Ctrl+B)')}
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('italic')}
            className={`${toolbarBtn} transition-colors ${isItalic ? 'bg-blue-200 text-blue-700' : ''}`}
            {...tb('Itálico (Ctrl+I)')}
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('underline')}
            className={`${toolbarBtn} transition-colors ${isUnderline ? 'bg-blue-200 text-blue-700' : ''}`}
            {...tb('Sublinhado (Ctrl+U)')}
          >
            <Underline size={16} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('strikeThrough')}
            className={`${toolbarBtn} transition-colors ${isStrikethrough ? 'bg-blue-200 text-blue-700' : ''}`}
            {...tb('Riscado')}
          >
            <Strikethrough size={16} />
          </button>
        </div>

        {/* Cores */}
        <div className="flex border-r dark:border-gray-600 pr-2 mr-2 relative">
          {/* Cor do texto */}
          <button
            type="button"
            onClick={() => {
              setShowTextColorPicker(!showTextColorPicker);
              setShowBgColorPicker(false);
            }}
            className={`${toolbarBtn} flex flex-col items-center justify-center`}
            {...(hideAssistant
              ? { title: 'Cor do texto', 'aria-label': 'Cor do texto' }
              : { title: `Cor do texto (${currentTextColor})` })}
          >
            <Type size={16} />
            <div
              className="w-4 h-1 rounded-sm mt-0.5 border border-gray-300 dark:border-gray-500"
              style={{ backgroundColor: currentTextColor }}
            />
          </button>
          {showTextColorPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg p-2 z-50 grid grid-cols-6 gap-1">
              {TEXT_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    executeCommand('foreColor', color);
                    setCurrentTextColor(color);
                    setShowTextColorPicker(false);
                  }}
                  className={`w-6 h-6 rounded border hover:scale-110 transition-transform ${
                    currentTextColor.toUpperCase() === color.toUpperCase()
                      ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-500 scale-110'
                      : 'border-gray-300 dark:border-gray-500'
                  } ${color === '#FFFFFF' ? 'bg-white' : ''}`}
                  style={{ backgroundColor: color }}
                  title={color === '#FFFFFF' ? 'Branco' : color}
                />
              ))}
            </div>
          )}
          {/* Cor de fundo */}
          <button
            type="button"
            onClick={() => {
              setShowBgColorPicker(!showBgColorPicker);
              setShowTextColorPicker(false);
            }}
            className={`${toolbarBtn} flex flex-col items-center justify-center`}
            {...(hideAssistant
              ? { title: 'Cor de fundo', 'aria-label': 'Cor de fundo' }
              : { title: `Cor de fundo (${currentBgColor})` })}
          >
            <Palette size={16} />
            <div
              className="w-4 h-1 rounded-sm mt-0.5 border border-gray-300 dark:border-gray-500"
              style={{
                backgroundColor: currentBgColor === 'transparent' ? 'transparent' : currentBgColor,
                backgroundImage: currentBgColor === 'transparent'
                  ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)'
                  : 'none',
                backgroundSize: '4px 4px',
                backgroundPosition: '0 0, 2px 2px',
              }}
            />
          </button>
          {showBgColorPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg p-2 z-50 grid grid-cols-4 gap-1">
              {BACKGROUND_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    executeCommand('hiliteColor', color);
                    setCurrentBgColor(color);
                    setShowBgColorPicker(false);
                  }}
                  className={`w-6 h-6 rounded border hover:scale-110 transition-transform ${
                    currentBgColor === color
                      ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-500 scale-110'
                      : 'border-gray-300 dark:border-gray-500'
                  }`}
                  style={{
                    backgroundColor: color === 'transparent' ? '#fff' : color,
                    backgroundImage: color === 'transparent'
                      ? 'linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%), linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%)'
                      : 'none',
                    backgroundSize: '4px 4px',
                    backgroundPosition: '0 0, 2px 2px',
                  }}
                  title={color === 'transparent' ? 'Sem fundo' : color}
                />
              ))}
            </div>
          )}
        </div>

        {/* Alinhamento */}
        <div className="flex border-r dark:border-gray-600 pr-2 mr-2">
          <button
            type="button"
            onClick={() => executeCommand('justifyLeft')}
            className={`${toolbarBtn} transition-colors ${currentAlignment === 'left' ? 'bg-blue-200 text-blue-700' : ''}`}
            {...tb('Alinhar à esquerda')}
          >
            <AlignLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('justifyCenter')}
            className={`${toolbarBtn} transition-colors ${currentAlignment === 'center' ? 'bg-blue-200 text-blue-700' : ''}`}
            {...tb('Centralizar')}
          >
            <AlignCenter size={16} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('justifyRight')}
            className={`${toolbarBtn} transition-colors ${currentAlignment === 'right' ? 'bg-blue-200 text-blue-700' : ''}`}
            {...tb('Alinhar à direita')}
          >
            <AlignRight size={16} />
          </button>
        </div>

        {/* Listas */}
        <div className="flex border-r dark:border-gray-600 pr-2 mr-2">
          <button
            type="button"
            onClick={() => executeCommand('insertUnorderedList')}
            className={`${toolbarBtn} transition-colors ${isUnorderedList ? 'bg-blue-200 text-blue-700' : ''}`}
            {...tb('Lista com marcadores')}
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('insertOrderedList')}
            className={`${toolbarBtn} transition-colors ${isOrderedList ? 'bg-blue-200 text-blue-700' : ''}`}
            {...tb('Lista numerada')}
          >
            <ListOrdered size={16} />
          </button>
        </div>

        {/* Links e Mídia */}
        <div className="flex gap-1 border-r dark:border-gray-600 pr-2 mr-2">
          <button
            type="button"
            onClick={insertLink}
            className={toolbarBtn}
            {...tb('Inserir link')}
          >
            <Link size={16} />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={toolbarBtn}
            {...tb('Inserir imagem')}
            disabled={uploading || !scriptId}
          >
            <Image size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShowVideoSourceModal(true)}
            className={toolbarBtn}
            {...tb('Inserir vídeo')}
            disabled={uploading}
          >
            <Video size={16} />
          </button>
        </div>

        {!hideAssistant && (
          <AIAssistantMenu
            onInsertText={handleAIInsertText}
            getFullText={getFullText}
            aiContext={aiContext}
          />
        )}

        {uploading && (
          <span className="ml-2 text-sm text-blue-600 animate-pulse">
            Fazendo upload...
          </span>
        )}

        {/* Indicador de modo drag-and-drop ativo */}
        {isDraggingMedia && (
          <span className="ml-2 text-sm text-purple-600 font-medium animate-pulse flex items-center gap-1">
            <span>🎯</span>
            <span>Arraste para reposicionar</span>
          </span>
        )}
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onClick={() => {
          setShowTextColorPicker(false);
          setShowBgColorPicker(false);
        }}
        onDragStart={handleMediaDragStart}
        onDragEnd={handleMediaDragEnd}
        onDragOver={handleMediaDragOver}
        onDrop={handleMediaDrop}
        onDragLeave={handleMediaDragLeave}
        className={`flex-1 p-4 focus:outline-none prose prose-sm dark:prose-invert max-w-none overflow-y-auto text-gray-900 dark:text-gray-100 ${
          fillHeight ? 'min-h-0' : 'min-h-[300px]'
        } ${
          isDraggingMedia ? 'bg-purple-50 dark:bg-purple-900/30 border-2 border-dashed border-purple-300 dark:border-purple-600' : ''
        }`}
        style={{
          direction: 'ltr',
          textAlign: 'left',
        }}
        data-placeholder={placeholder}
      />

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoUpload}
        className="hidden"
      />

      {/* Estilos do placeholder e dark mode */}
      <style>{`
        .rich-text-editor [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        .dark .rich-text-editor [contenteditable]:empty:before {
          color: #6b7280;
        }
        /* Dark mode: forçar cor legível para texto sem cor explícita */
        .dark .rich-text-editor [contenteditable] {
          color: #e5e7eb;
          caret-color: #e5e7eb;
        }
        /* Cores escuras inline são tratadas via useDarkModeColorFixEditable (JS) */
        .rich-text-editor [contenteditable] ul {
          list-style-type: disc;
          padding-left: 2rem;
          margin: 0.5em 0;
        }
        .rich-text-editor [contenteditable] ol {
          list-style-type: decimal;
          padding-left: 2rem;
          margin: 0.5em 0;
        }
        .rich-text-editor [contenteditable] li {
          margin: 0.25em 0;
        }
        .rich-text-editor [contenteditable] a {
          color: #2563eb;
          text-decoration: underline;
        }
        .rich-text-editor [contenteditable] img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
        }
        .rich-text-editor [contenteditable] video,
        .rich-text-editor [contenteditable] iframe {
          max-width: 100%;
          border-radius: 4px;
        }

        /* Estilos para drag-and-drop de mídias */
        .rich-text-editor [contenteditable] .draggable-media {
          cursor: grab;
          transition: all 0.2s ease;
          position: relative;
        }
        .rich-text-editor [contenteditable] .draggable-media:hover {
          outline: 3px solid #8b5cf6;
          outline-offset: 2px;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);
        }
        .rich-text-editor [contenteditable] .draggable-media:active {
          cursor: grabbing;
        }
        .rich-text-editor [contenteditable] .draggable-media.dragging {
          opacity: 0.5;
          outline: 3px dashed #8b5cf6;
        }
        .rich-text-editor [contenteditable] .drop-indicator {
          height: 3px;
          background: linear-gradient(90deg, #8b5cf6, #a78bfa);
          border-radius: 2px;
          margin: 4px 0;
          pointer-events: none;
          animation: pulse-indicator 1s infinite;
        }
        @keyframes pulse-indicator {
          0%, 100% { opacity: 1; transform: scaleX(1); }
          50% { opacity: 0.7; transform: scaleX(0.98); }
        }
      `}</style>

      {/* Modal de escolha de fonte de vídeo (Upload ou URL) */}
      {showVideoSourceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Inserir Vídeo no Script
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
              Escolha como deseja adicionar o vídeo ao script:
            </p>
            
            <div className="space-y-3 mb-5">
              {/* Opção 1: Upload de arquivo */}
              <button
                onClick={() => {
                  setShowVideoSourceModal(false);
                  videoInputRef.current?.click();
                }}
                disabled={!scriptId}
                className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">Fazer upload de arquivo</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      O vídeo será salvo no repositório próprio do sistema e inserido como um <strong>link clicável</strong> no script. 
                      Você poderá personalizar o texto do link.
                    </p>
                  </div>
                </div>
              </button>

              {/* Opção 2: Inserir URL */}
              <button
                onClick={openVideoUrlModal}
                className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors flex-shrink-0">
                    <Link size={20} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-100 mb-1">Inserir URL de vídeo</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      O vídeo permanecerá na fonte original (YouTube, Vimeo, etc.) e será inserido como um <strong>link clicável</strong> no script. 
                      Você poderá personalizar o texto do link.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Informação importante */}
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-medium mb-1">Sobre a exibição de vídeos:</p>
                  <p className="leading-relaxed">
                    A exibição direta de vídeos no corpo do script foi desabilitada devido a limitações técnicas do SMAX. 
                    Os vídeos serão sempre inseridos como links clicáveis que abrem em nova aba.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowVideoSourceModal(false)}
              className="w-full px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal para inserir URL do vídeo */}
      {showVideoUrlModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Inserir URL do Vídeo
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Cole o link do vídeo que deseja adicionar ao script:
            </p>
            
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                URL do vídeo:
              </label>
              <input
                type="url"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    processVideoUrl();
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">
                Suporta YouTube, Vimeo ou URLs diretas de vídeos
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowVideoUrlModal(false);
                  setVideoUrlInput('');
                }}
                className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={processVideoUrl}
                disabled={!videoUrlInput.trim()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para definir texto do link do vídeo */}
      {showVideoLinkTextModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Personalizar Link do Vídeo
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Defina o texto que será exibido como link clicável no script:
            </p>
            
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Texto do link:
              </label>
              <input
                type="text"
                value={videoLinkText}
                onChange={(e) => setVideoLinkText(e.target.value)}
                placeholder="Ex: Clique aqui para assistir ao vídeo"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    insertVideoLink();
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">
                Este texto aparecerá como link clicável no corpo do script
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowVideoLinkTextModal(false);
                  setPendingVideoUrl(null);
                  setVideoLinkText('');
                }}
                className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={insertVideoLink}
                disabled={!videoLinkText.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Inserir Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

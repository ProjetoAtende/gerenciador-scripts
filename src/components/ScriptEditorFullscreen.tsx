// components/ScriptEditorFullscreen.tsx - Editor de scripts em tela cheia
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Eye, Edit3, Pencil, HelpCircle, Ticket, MessageCircleQuestion, User, Clock, Shield, Search, Check, ChevronDown } from 'lucide-react';
import { ScriptItem, SCRIPT_INSTANCIA_OPTIONS, ScriptInstancia, inferirInstanciaPorEquipe } from '../types/Script';
import { RichTextEditor } from './RichTextEditor';
import { usePermissoes } from '../contexts/PermissoesContext';
import { CategoriaEditavelScript } from './CategoriaEditavelScript';
import { supabase } from '../services/supabaseClient';
import { toast } from 'sonner';
import { useDarkModeColorFix } from '../hooks/useDarkModeColorFix';

interface UserOption {
  id: string;
  nome: string;
}

// Lista completa de perfis eProc
const PERFIS_EPROC: string[] = [
  'ACESSO À CERTIDÃO',
  'ACESSO AO ROL DE CULPADOS',
  'ADMINISTRADOR DE NEGÓCIO',
  'ADMINISTRADOR DO FORO',
  'ADMINISTRADOR DO SISTEMA',
  'ADVOGADO',
  'AG. PREV. SOCIAL',
  'ANALISTA AG. PREV. SOCIAL',
  'ANALISTA PROCURADORIA',
  'ASSISTENTE - ADVOGADO',
  'ASSISTENTE - SOCIEDADE ADVOGADOS',
  'ASSISTENTE PROCURADOR',
  'AUTORIDADE',
  'AUTORIDADE CHEFE',
  'AUXILIAR - UNIDADE EXTERNA',
  'CADASTRADOR DE CONCILIADORES - CEJUSC',
  'CHEFE DE CARTÓRIO',
  'CONCILIADOR',
  'CONCILIADOR EXTERNO',
  'CONSULTA CARTAS AR',
  'CONSULTA PROCESSO',
  'CONSULTA PROCESSO SIGILO 1',
  'CONSULTA TJSP',
  'CONSULTA TRF4',
  'CONTADORIA',
  'CONTADORIA ADM',
  'CORREGEDOR PROCURADORIA',
  'CORREGEDORIA',
  'CORREGEDORIA DA POLÍCIA',
  'DELEGADO/OFICIAL',
  'DELEGADO/OFICIAL - CHEFE',
  'DIREÇÃO DO FORO',
  'DIRETOR',
  'DIRETOR CENTRAL DE MANDADOS',
  'DIRETOR DE GABINETE',
  'DIRETOR DISTRIBUIÇÃO',
  'DIRETOR PRECATÓRIOS',
  'DIRETOR/SERVIDOR JUDICIÁRIA',
  'DISTRIBUIÇÃO',
  'ENTIDADE ASSISTENCIAL',
  'ESCRIVÃO/ENCARREGADO',
  'ESCRIVÃO/ENCARREGADO - CHEFE',
  'ESTAGIÁRIO',
  'ESTAGIÁRIO (CENTRAL DE MANDADOS)',
  'ESTAGIÁRIO (VARA 1º GRAU)',
  'ESTAGIÁRIO OUTRAS BASES',
  'ESTATÍSTICA',
  'ESTATÍSTICA - 1G',
  'ESTATÍSTICA - 2G',
  'GERENTE - SOCIEDADE ADVOGADOS',
  'GERENTE DE ACESSO AO ROL/CERTIDÃO',
  'GERENTE DE AUTOMATIZAÇÕES',
  'GERENTE DE AUTORIDADE',
  'GERENTE DE CADASTROS OAB',
  'GERENTE DE ENTIDADES',
  'GERENTE DE USUÁRIOS',
  'GERENTE PROCURADORIA',
  'IMPRENSA',
  'INSPEÇÃO',
  'JUS POSTULANDI',
  'MAGISTRADO',
  'MEDIADOR',
  'MIGRA PROCESSOS PARA ENTIDADE',
  'MIGRAÇÃO DE SISTEMA',
  'MIGRADOR DE PROCESSOS',
  'OFICIAL DE GABINETE',
  'OFICIAL DE JUSTIÇA',
  'PARTE',
  'PERITO',
  'PERITO CRIMINAL FEDERAL',
  'PLANTÃO',
  'PROCURADOR',
  'PROCURADOR PLANTÃO MP',
  'REPRESENTANTE LEGAL PJ',
  'SECRETÁRIO',
  'SECRETÁRIO SUBSTITUTO',
  'SERVIDOR',
  'SERVIDOR CENTRAL CONVÊNIOS',
  'SERVIDOR CENTRAL DE MANDADOS',
  'SERVIDOR CONCILIAÇÃO',
  'SERVIDOR DE SECRETARIA (VARA 1º GRAU)',
  'SERVIDOR DOF',
  'SERVIDOR DTI/DSJ',
  'SERVIDOR EXPEDIÇÃO',
  'SERVIDOR GABINETE/SECRETARIA',
  'SERVIDOR OUTRAS BASES',
  'SERVIDOR UNIDADE JUDICIAL',
  'SERVIDOR UNIDADE JUDICIAL AVANÇADO',
  'SERVIDOR PRECATÓRIOS',
  'SISTEMA DE PROCURADORIA EXTERNO',
  'SISTEMA EPROC',
  'SUPERVISOR',
  'SUPERVISOR DE AUTOMATIZAÇÕES',
  'SUPERVISOR PRECATÓRIOS',
  'UNIDADE EXTERNA',
];

/** Payload de salvamento do editor — evita 7+ parâmetros posicionais */
export interface ScriptSavePayload {
  content: string;
  nome: string;
  autorId?: string | null;
  temporario?: boolean;
  n1?: boolean | null;
  validado_n1?: boolean;
  enviado_n1?: boolean;
  tipoRequisitante?: string | null;
  categoriaSlug?: string | null;
  subcategoriaSlug?: string | null;
  categoriaEquipeSlug?: string | null;
  subcategoriaGseSlug?: string | null;
  instancia?: ScriptInstancia | null;
  pergunta?: string;
  numeroChamado?: string;
}

interface ScriptEditorFullscreenProps {
  isOpen: boolean;
  script: ScriptItem | null;
  isNew?: boolean;
  editMode?: 'usuario_final' | 'atendente';
  referenceNumber?: number;
  usuariosExternos?: UserOption[];  // Recebe lista de usuários do pai (evita query redundante)
  versaoAtual?: number;
  ultimoAutorVersao?: string;
  dataUltimaVersao?: string;
  onSave: (payload: ScriptSavePayload) => Promise<void>;
  onSavePergunta?: (scriptId: string, pergunta: string, numeroChamado: string) => Promise<void>;
  onClose: () => void;
}

export const ScriptEditorFullscreen: React.FC<ScriptEditorFullscreenProps> = ({
  isOpen,
  script,
  isNew = false,
  editMode = 'usuario_final',
  referenceNumber,
  usuariosExternos,
  versaoAtual,
  ultimoAutorVersao,
  dataUltimaVersao,
  onSave,
  onSavePergunta,
  onClose,
}) => {
  const { temPermissao } = usePermissoes();
  // Migrado para o sistema de permiss\u00f5es:
  //   scripts.n1_controles      \u2192 quem pode marcar N1 (Qualidade 2.1 / admin)
  //   scripts.curadoria_acesso  \u2192 quem \u00e9 isento de obrigatoriedade N1 (curadoria 3.2 / admin)
  const isEquipe21OuAdmin = useMemo(
    () => temPermissao('scripts.n1_controles'),
    [temPermissao],
  );
  // Isento da obrigatoriedade de definir N1 ao editar scripts existentes:
  // qualquer usu\u00e1rio com permiss\u00f5es de N1 OU de Curadoria.
  const isentoN1 = useMemo(
    () => temPermissao('scripts.n1_controles') || temPermissao('scripts.curadoria_acesso'),
    [temPermissao],
  );
  // Estados do componente
  const [content, setContent] = useState('');
  const [nome, setNome] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPerguntaModal, setShowPerguntaModal] = useState(false);
  
  // Estados para edição de pergunta e número do chamado
  const [perguntaEdit, setPerguntaEdit] = useState('');
  const [numeroChamadoEdit, setNumeroChamadoEdit] = useState('');
  const [savingPergunta, setSavingPergunta] = useState(false);
  
  // Estados para campo de autor
  const [autorId, setAutorId] = useState<string | null>(null);
  const [autorNome, setAutorNome] = useState('');
  const [autorBusca, setAutorBusca] = useState('');
  const [showAutorSuggestions, setShowAutorSuggestions] = useState(false);
  const [usuarios, setUsuarios] = useState<UserOption[]>([]);
  const [isEditingAutor, setIsEditingAutor] = useState(false);
  
  // Estado para script temporário
  const [isTemporario, setIsTemporario] = useState(false);

  // Estado para N1 (obrigatório)
  const [n1Selecionado, setN1Selecionado] = useState<boolean | null>(null);

  // Estados para Validação e Envio N1 (equipe 2.1 only)
  const [validadoN1, setValidadoN1] = useState(false);
  const [enviadoN1, setEnviadoN1] = useState(false);
  
  // Estados para tipo de requisitante
  const [tipoRequisitante, setTipoRequisitante] = useState<string | null>(null);
  const [showTipoRequisitanteModal, setShowTipoRequisitanteModal] = useState(false);
  const [tipoRequisitanteBusca, setTipoRequisitanteBusca] = useState('');

  // Estado para instância do script (obrigatório)
  const [instancia, setInstancia] = useState<ScriptInstancia | null>(null);

  // Estados para categoria/subcategoria hierárquica v2 (Fase 5)
  const [categoriaEquipeSlug, setCategoriaEquipeSlug] = useState<string | null>(null);
  const [subcategoriaGseSlug, setSubcategoriaGseSlug] = useState<string | null>(null);
  
  // Rastreia o ID do script atual e o estado anterior de isOpen
  const lastLoadedScriptIdRef = useRef<string | undefined>(undefined);
  const prevIsOpenRef = useRef<boolean>(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Fix de cores escuras inline no preview (dark mode)
  useDarkModeColorFix(previewRef);

  // Usar lista de usuários recebida do pai (evita query redundante)
  // Fallback: se não receber, faz fetch individual
  useEffect(() => {
    if (usuariosExternos && usuariosExternos.length > 0) {
      setUsuarios(usuariosExternos);
      return;
    }

    const fetchUsuarios = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome')
        .not('nome', 'is', null)
        .neq('ativo', false)
        .order('nome');

      if (!error && data) {
        setUsuarios(data.filter(u => u.nome) as UserOption[]);
      }
    };

    if (isOpen) {
      fetchUsuarios();
    }
  }, [isOpen, usuariosExternos]);

  // Sincronizar estados quando o script mudar ou modal abrir
  useEffect(() => {
    // Sempre atualizar ref do estado anterior de isOpen, mesmo se script for null
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    
    // Se não há script, resetar o lastLoadedScriptIdRef para forçar reload na próxima abertura
    if (!script) {
      lastLoadedScriptIdRef.current = undefined;
      return;
    }

    const scriptChanged = script.id !== lastLoadedScriptIdRef.current;
    
    if (scriptChanged || justOpened) {
      // Carregar conteúdo correto baseado no modo de edição
      setContent(editMode === 'atendente' ? (script.conteudo_atendente || '') : (script.conteudo_bruto || ''));
      setNome(isNew ? '' : (script.nome || ''));
      setHasChanges(false);
      setIsPreview(false);
      setIsEditingName(isNew);
      lastLoadedScriptIdRef.current = script.id;
      
      // Carregar pergunta e número do chamado
      setPerguntaEdit(script.pergunta || '');
      setNumeroChamadoEdit(script.numero_chamado || '');
      
      // Carregar autor existente — independente por modo de edição
      const autorDoModo = editMode === 'atendente' ? script.criado_por_atendente : script.criado_por;
      if (autorDoModo) {
        setAutorId(autorDoModo);
        // Buscar nome do autor
        const autor = usuarios.find(u => u.id === autorDoModo);
        setAutorNome(autor?.nome || '');
        setAutorBusca(autor?.nome || '');
      } else {
        // Autor vazio quando o modo ainda não teve autor definido
        setAutorId(null);
        setAutorNome('');
        setAutorBusca('');
      }
      setIsEditingAutor(false);
      
      // Carregar flag temporário
      setIsTemporario(script.temporario || false);

      // Carregar N1
      setN1Selecionado(script?.n1 ?? null);

      // Carregar Validação e Envio N1
      setValidadoN1(script?.validado_n1 ?? false);
      setEnviadoN1(script?.enviado_n1 ?? false);
      
      // Carregar tipo de requisitante
      setTipoRequisitante(script.tipo_requisitante || null);
      setTipoRequisitanteBusca('');

      // Carregar instância ou inferir pela equipe quando ainda não persistida
      setInstancia(script.instancia || inferirInstanciaPorEquipe(script.equipe_id));

      // Carregar categoria/subcategoria hierárquica v2
      setCategoriaEquipeSlug(script.categoria_equipe_slug || null);
      setSubcategoriaGseSlug(script.subcategoria_gse_slug || null);
    }
  }, [script, isOpen, isNew, usuarios, editMode]);

  // Resolver nome do autor quando a lista de usuarios chega depois da inicialização
  // (corrige race condition: autorId setado mas usuarios ainda vazio no primeiro render)
  useEffect(() => {
    if (autorId && !autorNome && usuarios.length > 0) {
      const autor = usuarios.find(u => u.id === autorId);
      if (autor) {
        setAutorNome(autor.nome);
        setAutorBusca(autor.nome);
      }
    }
  }, [autorId, autorNome, usuarios]);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Ctrl+S para salvar
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }

      // ESC para fechar (com confirmação se houver mudanças)
      if (e.key === 'Escape' && !isEditingName) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, content, hasChanges, isEditingName]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  }, []);

  const handleNameChange = (newName: string) => {
    setNome(newName);
    setHasChanges(true);
  };

  // Sugestões de autores filtradas
  const sugestoesAutor = autorBusca.trim()
    ? usuarios.filter(u => u.nome.toLowerCase().includes(autorBusca.toLowerCase())).slice(0, 8)
    : [];

  // Selecionar autor da lista
  const handleSelectAutor = (user: UserOption) => {
    setAutorId(user.id);
    setAutorNome(user.nome);
    setAutorBusca(user.nome);
    setShowAutorSuggestions(false);
    setIsEditingAutor(false);
    setHasChanges(true);
  };

  // Limpar autor
  const handleClearAutor = () => {
    setAutorId(null);
    setAutorNome('');
    setAutorBusca('');
    setHasChanges(true);
  };

  // Salvar pergunta e número do chamado
  const handleSavePergunta = async () => {
    if (!script || savingPergunta) return;

    // Se é script novo (sem ID válido), salvar localmente — será enviado no onSave principal
    if (isNew || !script.id) {
      setShowPerguntaModal(false);
      setHasChanges(true);
      return;
    }

    if (!onSavePergunta) return;

    setSavingPergunta(true);
    try {
      await onSavePergunta(script.id, perguntaEdit, numeroChamadoEdit);
      setShowPerguntaModal(false);
    } catch (error) {
      console.error('Erro ao salvar pergunta:', error);
    } finally {
      setSavingPergunta(false);
    }
  };

  const handleSave = async () => {
    if (!script || saving) return;

    // Validar nome
    if (!nome.trim()) {
      alert('Por favor, insira um nome para o script.');
      setIsEditingName(true);
      return;
    }

    // Validar número do chamado obrigatório (apenas no modo usuario_final)
    if (editMode === 'usuario_final' && !numeroChamadoEdit.trim()) {
      toast.error('Preencha o número do chamado (ou "n/a" se não houver).');
      setShowPerguntaModal(true);
      return;
    }

    // Validar pergunta obrigatória (apenas no modo usuario_final)
    if (editMode === 'usuario_final' && !perguntaEdit.trim()) {
      toast.error('Preencha a pergunta-chave que este script responde.');
      setShowPerguntaModal(true);
      return;
    }

    // Validar autor obrigatório em ambos os modos
    if (!autorId) {
      toast.error('Por favor, selecione um autor para o script.');
      setIsEditingAutor(true);
      return;
    }

    // Validar tipo de requisitante obrigatório (apenas no modo usuário final)
    if (editMode === 'usuario_final' && !tipoRequisitante) {
      toast.error('Por favor, selecione o tipo do requisitante (perfil eProc).');
      setShowTipoRequisitanteModal(true);
      return;
    }

    // Validar instância obrigatória
    if (!instancia) {
      toast.error('Por favor, selecione a instância do script.');
      return;
    }

    // Validar N1 obrigatório apenas na criação ou para usuários não isentos
    // Isentos: admin, equipe 2.1 e curadoria 3.2 (atuam após a criação do script)
    if (n1Selecionado === null && (isNew || !isentoN1)) {
      toast.error('Por favor, selecione se o script é N1 (Sim ou Não).');
      return;
    }

    // Categoria/subcategoria são metadados opcionais: nunca devem bloquear o salvamento do script.

    setSaving(true);
    try {
      await onSave({
        content,
        nome,
        autorId,
        temporario: isTemporario,
        n1: n1Selecionado,
        validado_n1: validadoN1,
        enviado_n1: enviadoN1,
        tipoRequisitante: editMode === 'usuario_final' ? tipoRequisitante : undefined,
        categoriaSlug: undefined,
        subcategoriaSlug: undefined,
        categoriaEquipeSlug,
        subcategoriaGseSlug,
        instancia,
        pergunta: editMode === 'usuario_final' ? perguntaEdit.trim() : undefined,
        numeroChamado: editMode === 'usuario_final' ? numeroChamadoEdit.trim() : undefined,
      });
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirm = window.confirm('Existem alterações não salvas. Deseja realmente fechar?');
      if (!confirm) return;
    }
    onClose();
  };

  // Processar conteúdo para preview (destacar variáveis do script)
  const processPreviewContent = (html: string) => {
    // Destacar variáveis do tipo {[opção1][opção2]}
    let processed = html.replace(
      /\{(\[[^\]]+\])+\}/g,
      '<span style="background-color: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$&</span>'
    );

    // Destacar variáveis do tipo ()
    processed = processed.replace(
      /\(\)/g,
      '<span style="background-color: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; fontFamily: monospace;">()</span>'
    );

    return processed;
  };

  if (!isOpen || !script) return null;

  return (
    <>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black bg-opacity-50 flex items-center justify-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-900 w-full h-full flex flex-col"
        >
          {/* Header */}
          <div className={`px-6 py-3 bg-gradient-to-r ${editMode === 'atendente' ? 'from-orange-600 to-orange-700' : 'from-blue-600 to-blue-700'} text-white`}>
            {/* Linha 1: Fechar | Título + Nome | Ações */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                  title="Fechar (ESC)"
                >
                  <X size={24} />
                </button>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <h2 className="text-lg font-semibold flex-shrink-0">
                    {isNew ? 'Novo Script' : 'Editando Script'}
                    {editMode === 'atendente' && (
                      <span className="ml-2 text-sm bg-orange-800/50 px-2 py-0.5 rounded-full">Atendente</span>
                    )}
                  </h2>
                  {/* Número de referência do script */}
                  {!isNew && referenceNumber !== undefined && (
                    <span className="flex items-center gap-1 text-sm bg-gray-700 text-white px-2.5 py-1 rounded-full font-bold shadow-sm flex-shrink-0">
                      #{referenceNumber}
                    </span>
                  )}
                  {/* Badge de versão */}
                  {!isNew && versaoAtual !== undefined && versaoAtual >= 1 && (
                    <span className="text-xs bg-gray-700 text-white px-2 py-0.5 rounded-full flex-shrink-0">
                      Versão {versaoAtual}{ultimoAutorVersao ? ` · ${ultimoAutorVersao}` : ''}{dataUltimaVersao ? ` em ${dataUltimaVersao}` : ''}
                    </span>
                  )}
                  <span className="text-blue-200 flex-shrink-0">—</span>
                  {/* Nome editável */}
                  {isEditingName ? (
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onBlur={() => {
                        if (nome.trim()) {
                          setIsEditingName(false);
                        } else if (!isNew) {
                          setIsEditingName(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && nome.trim()) {
                          setIsEditingName(false);
                        }
                        if (e.key === 'Escape') {
                          setNome(script?.nome || '');
                          setIsEditingName(false);
                        }
                      }}
                      className="bg-white/20 text-white placeholder-blue-200 px-3 py-1 rounded-md text-sm border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 min-w-[250px] max-w-[500px] flex-1"
                      placeholder="Digite o título do Script"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className={`flex items-center gap-2 ${editMode === 'atendente' ? 'text-orange-100 hover:text-white' : 'text-blue-100 hover:text-white'} hover:bg-white/10 px-2 py-1 rounded transition-colors group truncate min-w-0`}
                      title="Clique para editar o nome"
                    >
                      <span className={`text-sm truncate ${!nome ? 'italic opacity-70' : ''}`}>
                        {nome || 'Digite o título do Script'}
                      </span>
                      <Pencil size={14} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Toggle Editar/Preview */}
                <div className="flex bg-white/20 rounded-lg p-1">
                  <button
                    onClick={() => setIsPreview(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      !isPreview ? `bg-white ${editMode === 'atendente' ? 'text-orange-600' : 'text-blue-600'}` : 'text-white hover:bg-white/10'
                    }`}
                  >
                    <Edit3 size={16} />
                    Editar
                  </button>
                  <button
                    onClick={() => setIsPreview(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      isPreview ? `bg-white ${editMode === 'atendente' ? 'text-orange-600' : 'text-blue-600'}` : 'text-white hover:bg-white/10'
                    }`}
                  >
                    <Eye size={16} />
                    Preview
                  </button>
                </div>

                {/* Indicador de mudanças */}
                {hasChanges && (
                  <span className="text-yellow-300 text-xs">
                    Não salvo
                  </span>
                )}

                {/* Botão Salvar */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    saving
                      ? 'bg-white/30 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  <Save size={16} />
                  {saving ? 'Salvando...' : (isNew ? 'Criar Script' : 'Salvar')}
                </button>
              </div>
            </div>

            {/* Linha 2: Metadados em linha - Pergunta | Autor | Tipo Requisitante | Temporário/Permanente */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Pergunta */}
              <button 
                onClick={() => setShowPerguntaModal(true)}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer group max-w-xs"
                title="Clique para editar pergunta e chamado"
              >
                <MessageCircleQuestion size={13} className="flex-shrink-0 text-blue-200" />
                {perguntaEdit ? (
                  <span className="truncate text-blue-100">{perguntaEdit}</span>
                ) : (
                  <span className="text-blue-300 italic">
                    Adicionar pergunta...
                  </span>
                )}
                <Pencil size={10} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>

              <span className="text-blue-400 text-xs">|</span>

              {/* Autor */}
              <div className="flex items-center gap-1.5">
                <User size={13} className="text-blue-200 flex-shrink-0" />
                {isEditingAutor ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={autorBusca}
                      onChange={(e) => {
                        setAutorBusca(e.target.value);
                        setShowAutorSuggestions(true);
                      }}
                      onFocus={() => setShowAutorSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowAutorSuggestions(false), 200)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setIsEditingAutor(false);
                          setAutorBusca(autorNome);
                        }
                      }}
                      placeholder="Buscar autor..."
                      className="bg-white/20 text-white placeholder-blue-200 px-2 py-1 rounded text-xs border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 w-44"
                      autoFocus
                    />
                    {showAutorSuggestions && sugestoesAutor.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                        {sugestoesAutor.map((user) => (
                          <button
                            key={user.id}
                            className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm text-gray-700 transition-colors"
                            onClick={() => handleSelectAutor(user)}
                          >
                            <span className="text-purple-600">👤</span> {user.nome}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingAutor(true)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      autorNome 
                        ? 'bg-purple-500/30 text-white hover:bg-purple-500/50' 
                        : 'bg-white/10 text-blue-200 hover:bg-white/20 hover:text-white'
                    }`}
                    title="Clique para definir/alterar o autor"
                  >
                    {autorNome || 'Não definido'}
                    <Pencil size={10} className="opacity-70" />
                  </button>
                )}
                {autorNome && !isEditingAutor && (
                  <button
                    onClick={handleClearAutor}
                    className="text-blue-300 hover:text-white text-xs p-0.5 hover:bg-white/10 rounded"
                    title="Remover autor"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Tipo do Requisitante (apenas no modo usuario_final) */}
              {editMode === 'usuario_final' && (
                <>
                  <span className="text-blue-400 text-xs">|</span>
                  <button
                    onClick={() => { setTipoRequisitanteBusca(''); setShowTipoRequisitanteModal(true); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      tipoRequisitante 
                        ? 'bg-emerald-500/30 text-white hover:bg-emerald-500/50' 
                        : 'bg-white/10 text-blue-200 hover:bg-white/20 hover:text-white'
                    }`}
                    title="Tipo do requisitante (perfil eProc)"
                  >
                    <Shield size={13} className="flex-shrink-0" />
                    {tipoRequisitante || 'Tipo Requisitante'}
                    <ChevronDown size={11} className="opacity-70" />
                  </button>
                </>
              )}

              <span className="text-blue-400 text-xs">|</span>

              {/* Instância */}
              <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                instancia
                  ? 'bg-indigo-500/30 text-white'
                  : 'bg-red-500/30 text-red-100 animate-pulse'
              }`}>
                <span className="font-medium">Instância</span>
                <select
                  value={instancia || ''}
                  onChange={(e) => {
                    setInstancia((e.target.value || null) as ScriptInstancia | null);
                    setHasChanges(true);
                  }}
                  className="select-options-light bg-white/95 text-gray-900 border border-white/40 rounded px-1.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/50"
                  title="Instância do script"
                >
                  <option value="">Selecionar</option>
                  {SCRIPT_INSTANCIA_OPTIONS.map((opcao) => (
                    <option key={opcao} value={opcao}>{opcao}</option>
                  ))}
                </select>
              </label>

              <span className="text-blue-400 text-xs">|</span>

              {/* Categoria/Subcategoria hierárquica v2 (Fase 5) */}
              <CategoriaEditavelScript
                scriptId={script?.id || ''}
                categoriaEquipeSlug={categoriaEquipeSlug}
                subcategoriaGseSlug={subcategoriaGseSlug}
                dominio={(script?.dominio as 'externo' | 'interno') || 'interno'}
                classificacaoOrigem={script?.classificacao_origem}
                classificacaoPendente={script?.classificacao_pendente}
                onCategoriaAtualizada={(dados) => {
                  setCategoriaEquipeSlug(dados.categoria_equipe_slug);
                  setSubcategoriaGseSlug(dados.subcategoria_gse_slug);
                  setHasChanges(true);
                }}
                compact={false}
              />

              <span className="text-blue-400 text-xs">|</span>

              {/* Seletor N1 (obrigatório) */}
              <div className="relative">
                <button
                  onClick={() => {
                    let newVal: boolean | null;
                    if (n1Selecionado === null) newVal = true;
                    else if (n1Selecionado === true) newVal = false;
                    else newVal = null;
                    setN1Selecionado(newVal);
                    // Cascade reset: limpar validação/envio quando N1 não é mais true
                    if (newVal !== true) {
                      setValidadoN1(false);
                      setEnviadoN1(false);
                    }
                    setHasChanges(true);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    n1Selecionado === true
                      ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                      : n1Selecionado === false
                        ? 'bg-gray-500 text-white hover:bg-gray-600'
                        : 'bg-red-500/30 text-red-200 hover:bg-red-500/50 animate-pulse'
                  }`}
                  title={
                    n1Selecionado === null
                      ? 'N1 não definido — clique para definir (obrigatório)'
                      : n1Selecionado
                        ? 'Script é N1 — clique para alterar'
                        : 'Script NÃO é N1 — clique para alterar'
                  }
                >
                  {n1Selecionado === null ? '⚠️' : n1Selecionado ? '✅' : '❌'}
                  N1: {n1Selecionado === null ? 'Selecionar' : n1Selecionado ? 'Sim' : 'Não'}
                </button>
              </div>

              {/* Seletor Validação e Envio N1 (equipe 2.1/admin, quando N1 === true) */}
              {isEquipe21OuAdmin && n1Selecionado === true && (
                <>
                  <span className="text-blue-400 text-xs">|</span>
                  <div className="flex items-center gap-1.5">
                    {/* Toggle Validado N1 */}
                    <button
                      onClick={() => { setValidadoN1(!validadoN1); setHasChanges(true); }}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        validadoN1
                          ? 'bg-teal-500 text-white hover:bg-teal-600'
                          : 'bg-white/10 text-blue-200 hover:bg-white/20'
                      }`}
                      title={validadoN1 ? 'Script validado para N1' : 'Marcar como validado para N1'}
                    >
                      {validadoN1 ? '✅' : '◯'} Validado N1
                    </button>

                    {/* Toggle Enviado N1 */}
                    <button
                      onClick={() => { setEnviadoN1(!enviadoN1); setHasChanges(true); }}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        enviadoN1
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'bg-white/10 text-blue-200 hover:bg-white/20'
                      }`}
                      title={enviadoN1 ? 'Script enviado para N1' : 'Marcar como enviado para N1'}
                    >
                      {enviadoN1 ? '📤' : '◯'} Enviado N1
                    </button>
                  </div>
                </>
              )}

              <span className="text-blue-400 text-xs">|</span>

              {/* Toggle Temporário/Permanente */}
              <button
                onClick={() => { setIsTemporario(!isTemporario); setHasChanges(true); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isTemporario 
                    ? 'bg-orange-500 text-white hover:bg-orange-600' 
                    : 'bg-white/10 text-blue-200 hover:bg-white/20 hover:text-white'
                }`}
                title="Scripts temporários são soluções de contorno que devem ser removidas no futuro"
              >
                <Clock size={13} />
                {isTemporario ? 'Temporário' : 'Permanente'}
              </button>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto">
            {isPreview ? (
              // Modo Preview
              <div className="h-full p-6 bg-gray-50 dark:bg-gray-800/50">
                <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-8">
                  <div className="mb-4 pb-4 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-500 dark:text-gray-300">Preview do Script</span>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{nome}</h3>
                  </div>
                  <div
                    ref={previewRef}
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: processPreviewContent(content) || '<p class="text-gray-600">Conteúdo vazio</p>'
                    }}
                  />
                  <div className="mt-6 pt-4 border-t dark:border-gray-700 text-sm text-gray-500 dark:text-gray-300">
                    <p>Legenda:</p>
                    <div className="flex gap-4 mt-2">
                      <span className="flex items-center gap-2">
                        <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                          {'{[opção]}'}
                        </span>
                        Dropdown de opções
                      </span>
                      <span className="flex items-center gap-2">
                        <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                          ()
                        </span>
                        Campo de texto
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Modo Edição
              <div className="p-4 flex flex-col" style={{ height: '100%' }}>
                <RichTextEditor
                  key={`${script.id || 'new'}-${editMode}`} // Força remontagem quando script OU modo muda
                  value={content || (editMode === 'atendente' ? (script.conteudo_atendente || '') : (script.conteudo_bruto || ''))} // Fallback mode-aware para primeiro render (useEffect roda após mount)
                  onChange={handleContentChange}
                  placeholder="Digite o conteúdo do script aqui..."
                  className="flex-1"
                  scriptId={script.id || 'new'}
                />
              </div>
            )}
          </div>

          {/* Footer com dicas */}
          <div className="px-6 py-3 bg-gray-100 dark:bg-gray-800 border-t dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 flex justify-between items-center">
            <div className="flex gap-4">
              <span><kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+S</kbd> Salvar</span>
              <span><kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">ESC</kbd> Fechar</span>
            </div>
            <div className="flex gap-4">
              <span>Use <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{'{[op1][op2]}'}</code> para criar dropdowns</span>
              <span>Use <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">()</code> para campos de texto</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Modal de Pergunta - Editável */}
      {showPerguntaModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-black bg-opacity-60 flex items-center justify-center p-4"
          onClick={() => setShowPerguntaModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowPerguntaModal(false);
              } else if (e.key === 'Enter' && e.ctrlKey) {
                handleSavePergunta();
              }
            }}
          >
            {/* Header do Modal */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <MessageCircleQuestion size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Pergunta e Chamado
                  </h3>
                  <p className="text-green-100 text-sm">{script.nome}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPerguntaModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Fechar (ESC)"
              >
                <X size={24} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Campo Número do Chamado */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Ticket size={16} className="text-green-600" />
                  Número do Chamado
                </label>
                {onSavePergunta ? (
                  <>
                    <input
                      type="text"
                      value={numeroChamadoEdit}
                      onChange={(e) => setNumeroChamadoEdit(e.target.value)}
                      placeholder="Ex: 123456 ou n/a"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      autoFocus
                    />
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-300">
                      Caso não possua número do chamado, preencha com <strong>n/a</strong>. Recomenda-se, sempre que possível, informar o número do chamado.
                    </p>
                    {numeroChamadoEdit && numeroChamadoEdit.toLowerCase() !== 'n/a' && (
                      <a
                        href={`https://suporte.tjsp.jus.br/saw/Request/${numeroChamadoEdit}/general`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        🔗 Abrir chamado no portal
                      </a>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    {script.numero_chamado ? (
                      <a
                        href={`https://suporte.tjsp.jus.br/saw/Request/${script.numero_chamado}/general`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        #{script.numero_chamado}
                      </a>
                    ) : (
                      <span className="text-gray-600 italic">Não informado</span>
                    )}
                  </div>
                )}
              </div>

              {/* Campo Pergunta */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <HelpCircle size={16} className="text-green-600" />
                  Pergunta
                </label>
                {onSavePergunta ? (
                  <>
                    <textarea
                      value={perguntaEdit}
                      onChange={(e) => setPerguntaEdit(e.target.value)}
                      placeholder="Formule uma pergunta cuja resposta corresponda ao conteúdo deste script."
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
                    />
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-300">
                      Não é necessário copiar a pergunta do chamado — ela pode ser confusa ou extensa demais. Escreva uma pergunta objetiva cuja resposta seja exatamente o procedimento descrito neste script.
                    </p>
                  </>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-gray-800 dark:text-gray-200 text-base leading-relaxed whitespace-pre-wrap">
                      {script.pergunta || <span className="text-gray-600 italic">Não informada</span>}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex items-center justify-between">
              {onSavePergunta ? (
                <>
                  <span className="text-xs text-gray-500 dark:text-gray-300">
                    Ctrl+Enter para salvar • ESC para fechar
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPerguntaModal(false)}
                      className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSavePergunta}
                      disabled={savingPergunta}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingPergunta ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Salvar
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full flex justify-end">
                  <button
                    onClick={() => setShowPerguntaModal(false)}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Modal de Tipo do Requisitante */}
      {showTipoRequisitanteModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-black bg-opacity-60 flex items-center justify-center p-4"
          onClick={() => setShowTipoRequisitanteModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowTipoRequisitanteModal(false);
            }}
          >
            {/* Header do Modal */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Tipo do Requisitante</h3>
                  <p className="text-emerald-100 text-sm">Perfil eProc</p>
                </div>
              </div>
              <button
                onClick={() => setShowTipoRequisitanteModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Fechar (ESC)"
              >
                <X size={24} />
              </button>
            </div>

            {/* Campo de busca / autocomplete */}
            <div className="px-6 pt-4 pb-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  value={tipoRequisitanteBusca}
                  onChange={(e) => setTipoRequisitanteBusca(e.target.value)}
                  placeholder="Buscar perfil eProc..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                  autoFocus
                />
              </div>
              {tipoRequisitante && (
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-300">Selecionado:</span>
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                    <Check size={12} />
                    {tipoRequisitante}
                  </span>
                  <button
                    onClick={() => { setTipoRequisitante(null); setHasChanges(true); }}
                    className="text-gray-600 hover:text-red-500 text-xs ml-1"
                    title="Remover seleção"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Lista de perfis */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <div className="space-y-0.5">
                {PERFIS_EPROC
                  .filter(p => !tipoRequisitanteBusca.trim() || p.toLowerCase().includes(tipoRequisitanteBusca.toLowerCase()))
                  .map((perfil) => (
                    <button
                      key={perfil}
                      onClick={() => {
                        setTipoRequisitante(perfil);
                        setHasChanges(true);
                        setShowTipoRequisitanteModal(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                        tipoRequisitante === perfil
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 font-medium'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span>{perfil}</span>
                      {tipoRequisitante === perfil && <Check size={16} className="text-emerald-600" />}
                    </button>
                  ))}
                {PERFIS_EPROC.filter(p => !tipoRequisitanteBusca.trim() || p.toLowerCase().includes(tipoRequisitanteBusca.toLowerCase())).length === 0 && (
                  <p className="text-gray-600 dark:text-gray-500 text-sm text-center py-4">Nenhum perfil encontrado</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowTipoRequisitanteModal(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Confirmar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Cores escuras inline no preview são tratadas via useDarkModeColorFix (JS) */}
    </>
  );
};

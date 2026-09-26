// src/hooks/useScriptsModal.ts — Hook com toda a lógica de estado do ScriptsModal
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { toast } from 'sonner';
import {
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ScriptItem, ScriptInstancia, inferirInstanciaPorEquipe, scriptPublicado } from '../types/Script';
import { useScriptFolders } from './useScriptFolders';
import { ScriptSavePayload } from '../components/ScriptEditorFullscreen';
import { exportarScriptComoHtml } from '../services/scriptExportService';
import { RevisaoCuradoriaData } from '../components/RevisarAlteracaoCuradoriaModal';
import { ContestacaoCuradoriaData } from '../components/AnalisarContestacaoModal';
import { solicitarExclusaoScript, reativarScript, aprovarNegarExclusao } from '../services/scriptExclusaoService';
import { arquivarNotificacaoExclusao } from '../services/notificacaoExclusaoService';
import { buscarPropostaAtiva, buscarPropostaPorId, criarVersaoCuradoria, revisarScriptInicial, criarNotificacao, aceitarContestacaoScript, marcarAcaoExecutada, buscarVersoesResumo, PropostaRevisao, ScriptNotificacao } from '../services/scriptVersioningService';
import { useEffectiveAuth } from './useEffectiveAuth';
import { usePermissoes } from '../contexts/PermissoesContext';
import { useAutoScriptClassification } from './useAutoScriptClassification';
import { buscarScriptsPorSimilaridade } from '../services/scriptSemanticSearchService';

export type FiltroCuradoria = 'todos' | 'nao-revisados' | 'revisados' | 'revisao-solicitada' | 'exclusao-solicitada';
export type ViewMode = 'lista' | 'cobertura';
export type { ScriptNotificacao, PropostaRevisao, RevisaoCuradoriaData, ContestacaoCuradoriaData, ScriptSavePayload };

// Permissões de Scripts são todas tratadas pelo sistema de permissões:
//   scripts.curadoria_acesso → controla showCuradoriaControls / canToggleCuradoria / canViewDesativados
//   scripts.n1_controles     → controla botões de envio/validação N1

export interface UseScriptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGerador: (script: { nome: string; conteudo_bruto: string; conteudo_atendente?: string | null }) => void;
  notificacaoPendente?: ScriptNotificacao | null;
  onNotificacaoProcessada?: () => void;
}

export function useScriptsModal({ isOpen, onClose: _onClose, onOpenGerador, notificacaoPendente, onNotificacaoProcessada }: UseScriptsModalProps) {
  const { user, equipeId } = useEffectiveAuth();
  const { temPermissao } = usePermissoes();
  
  // Classificação automática incremental via IA
  useAutoScriptClassification({ equipeId, enabled: isOpen });
  
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [busca, setBusca] = useState('');
  // Resultados da busca semantica (Map<scriptId, similarity>) — null enquanto inativa.
  const [semanticMatches, setSemanticMatches] = useState<Map<string, number> | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const [semanticSubmittedTerm, setSemanticSubmittedTerm] = useState('');
  const [semanticSubmitSeq, setSemanticSubmitSeq] = useState(0);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState('📁');
  const [showEditFolderModal, setShowEditFolderModal] = useState(false);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderIcon, setEditFolderIcon] = useState('📁');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [scriptToMove, setScriptToMove] = useState<string | null>(null);
  const [editingScript, setEditingScript] = useState<ScriptItem | null>(null);
  // Contador para forçar remontagem do editor quando script muda
  const [editorKey, setEditorKey] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_editingContent, setEditingContent] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{id: string, name: string, scriptCount: number} | null>(null);
  const [filtroCuradoria, setFiltroCuradoria] = useState<FiltroCuradoria>('todos');
  const [ordenacaoData, setOrdenacaoData] = useState<'mais-novo' | 'mais-antigo'>('mais-novo');

  // Filtros N1
  const [filtroN1, setFiltroN1] = useState<'todos' | 'n1' | 'nao-n1'>('todos');
  const [filtroValidacaoEnvio, setFiltroValidacaoEnvio] = useState<'todos' | 'validado-n1' | 'enviado-n1'>('todos');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const [showOrientacaoPosSalvarModal, setShowOrientacaoPosSalvarModal] = useState(false);
  const [orientacaoScriptNome, setOrientacaoScriptNome] = useState('');
  const [showConfirmPublicarModal, setShowConfirmPublicarModal] = useState(false);
  const [scriptForPublicar, setScriptForPublicar] = useState<ScriptItem | null>(null);
  const [publicarLoading, setPublicarLoading] = useState(false);

  // Estados para modais de confirmação de localização
  const [showConfirmScriptLocationModal, setShowConfirmScriptLocationModal] = useState(false);
  const [showConfirmFolderLocationModal, setShowConfirmFolderLocationModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Estados para modal de seleção de tipo de edição (atendente vs usuário final)
  const [showEditTypeModal, setShowEditTypeModal] = useState(false);
  const [pendingEditScript, setPendingEditScript] = useState<ScriptItem | null>(null);
  const [editMode, setEditMode] = useState<'usuario_final' | 'atendente'>('usuario_final');
  // Estado para criação de novo script com seleção de tipo (atendente/usuario_final)
  const [pendingNewScriptLocationId, setPendingNewScriptLocationId] = useState<string | null>(null);
  const [showNewScriptEditTypeModal, setShowNewScriptEditTypeModal] = useState(false);

  // Estados para fluxo de proposta de revisão (versionamento)
  const [modoPropostaAtivo, setModoPropostaAtivo] = useState(false);
  const [showPropostaMotivacaoModal, setShowPropostaMotivacaoModal] = useState(false);
  const [propostaConteudo, setPropostaConteudo] = useState('');
  const [propostaCampoAlvo, setPropostaCampoAlvo] = useState<'usuario_final' | 'atendente'>('usuario_final');
  const [propostaScriptId, setPropostaScriptId] = useState<string>('');
  const [propostaScriptNome, setPropostaScriptNome] = useState<string>('');
  const [propostaCuradorAnteriorId, setPropostaCuradorAnteriorId] = useState<string | null>(null);
  const [propostaPendenteInfo, setPropostaPendenteInfo] = useState<{ campo_alvo: 'usuario_final' | 'atendente'; id: string } | null>(null);

  // Estados para AnalisarPropostaModal (curadoria)
  const [showAnalisarPropostaModal, setShowAnalisarPropostaModal] = useState(false);
  const [propostaParaAnalisar, setPropostaParaAnalisar] = useState<PropostaRevisao | null>(null);
  const [scriptParaAnalisarProposta, setScriptParaAnalisarProposta] = useState<{ id: string; nome: string; conteudo_bruto?: string; conteudo_atendente?: string; curadoria_atuada: boolean; numero_chamado?: string } | null>(null);
  const [autorPropostaNome, setAutorPropostaNome] = useState('');

  // Estados para PropostaRejeitadaModal (reenvio)
  const [showPropostaRejeitadaModal, setShowPropostaRejeitadaModal] = useState(false);
  const [propostaRejeitada, setPropostaRejeitada] = useState<PropostaRevisao | null>(null);
  const [scriptNomeRejeitada, _setScriptNomeRejeitada] = useState('');
  const [propostaIdParaReenvio, setPropostaIdParaReenvio] = useState<string | null>(null);

  // Estados para HistoricoVersoesModal
  const [showHistoricoVersoesModal, setShowHistoricoVersoesModal] = useState(false);
  const [historicoScriptId, setHistoricoScriptId] = useState('');
  const [historicoScriptNome, setHistoricoScriptNome] = useState('');
  const [versoesMap, setVersoesMap] = useState<Record<string, { usuario_final: number; atendente: number }>>({});

  // Estados para ClassificarEdicaoCuradoriaModal
  const [showClassificarEdicaoModal, setShowClassificarEdicaoModal] = useState(false);
  const [classifConteudo, setClassifConteudo] = useState('');
  const [classifScriptId, setClassifScriptId] = useState('');
  const [classifCampoAlvo, setClassifCampoAlvo] = useState<'usuario_final' | 'atendente'>('usuario_final');
  const [classifScriptCriadoPor, setClassifScriptCriadoPor] = useState<string | null>(null);
  const [classifScriptNome, setClassifScriptNome] = useState('');
  const [classifContexto, setClassifContexto] = useState<'revisao_inicial' | 'edicao_posterior'>('revisao_inicial');
  // Captura categoria/subcategoria alteradas no editor para persistir junto da revisão da curadoria
  // (sem isso, mudanças de categoria + título + conteúdo na mesma sessão perdem a categoria)
  const [classifCategoriaEquipeSlug, setClassifCategoriaEquipeSlug] = useState<string | null | undefined>(undefined);
  const [classifSubcategoriaGseSlug, setClassifSubcategoriaGseSlug] = useState<string | null | undefined>(undefined);
  const [classifInstancia, setClassifInstancia] = useState<ScriptInstancia | null | undefined>(undefined);

  // Estados para RevisarAlteracaoCuradoriaModal (autor visualiza diff da revisão)
  const [showRevisarCuradoriaModal, setShowRevisarCuradoriaModal] = useState(false);
  const [revisarCuradoriaData, setRevisarCuradoriaData] = useState<RevisaoCuradoriaData | null>(null);

  // Estados para AnalisarContestacaoModal (curador visualiza contestação do autor)
  const [showAnalisarContestacaoModal, setShowAnalisarContestacaoModal] = useState(false);
  const [contestacaoData, setContestacaoData] = useState<ContestacaoCuradoriaData | null>(null);

  // ID da notificação que abriu o modal acionável (para marcar acao_executada após ação)
  const [notificacaoIdPendente, setNotificacaoIdPendente] = useState<string | null>(null);

  // Estados para modal de exclusão de script
  const [showDeleteScriptModal, setShowDeleteScriptModal] = useState(false);
  const [scriptToDelete, setScriptToDelete] = useState<ScriptItem | null>(null);
  const [showAprovarExclusaoModal, setShowAprovarExclusaoModal] = useState(false);
  const [scriptToAprovarExclusao, setScriptToAprovarExclusao] = useState<ScriptItem | null>(null);
  const [isProcessingAprovarExclusao, setIsProcessingAprovarExclusao] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados para busca por referência e autor
  const [buscaReferencia, setBuscaReferencia] = useState('');
  const [buscaAutor, setBuscaAutor] = useState('');
  const [showAutorSuggestions, setShowAutorSuggestions] = useState(false);
  const [autoresMap, setAutoresMap] = useState<Map<string, string>>(new Map()); // userId -> nome

  // Estado para filtro de equipe (independente, disponível para todos os usuários)
  const [filtroEquipeId, setFiltroEquipeId] = useState<string | null>(null);
  const [equipesDisponiveis, setEquipesDisponiveis] = useState<{id: string, nome: string}[]>([]);

  // Estado para filtro de tipo (temporário/permanente)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'temporario' | 'permanente'>('todos');

  // Estado para filtro de conteúdo atendente
  const [filtroAtendente, setFiltroAtendente] = useState<'todos' | 'com-atendente' | 'sem-atendente'>('todos');

  // Estado para filtro de tipo de requisitante
  const [filtroTipoRequisitante, setFiltroTipoRequisitante] = useState<string>('todos');

  // Estado para filtro de instância
  const [filtroInstancia, setFiltroInstancia] = useState<'todos' | ScriptInstancia>('todos');

  // Estado para painel de filtros colapsável
  const [showFiltrosPanel, setShowFiltrosPanel] = useState(false);

  // Estado para alternar entre lista de scripts e dashboard de cobertura
  const [viewMode, setViewMode] = useState<ViewMode>('lista');

  // Estados para filtro de domínio/categoria/subcategoria hierárquica (Fase 4 v2)
  const [filtroDominio, setFiltroDominio] = useState<string>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [filtroSubcategoria, setFiltroSubcategoria] = useState<string>('todos');
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState<{slug: string, nome: string, icone: string}[]>([]);
  const [subcategoriasDisponiveis, setSubcategoriasDisponiveis] = useState<{slug: string, nome: string}[]>([]);
  // Cache de rows do RPC obter_hierarquia_categorias (para extrair subcategorias sem chamada extra)
  const [hierarquiaRows, setHierarquiaRows] = useState<any[]>([]);

  // Hook para gerenciar pastas
  const { folders, folderHierarchy, loading: foldersLoading, createFolder, updateFolder, deleteFolder, getFolderScriptCount } = useScriptFolders();

  // Permissão para acessar controles de curadoria
  // Migrado para o sistema de permissões: scripts.curadoria_acesso
  const showCuradoriaControls = useMemo(
    () => temPermissao('scripts.curadoria_acesso'),
    [temPermissao],
  );

  // canToggleCuradoria = mesma lógica de showCuradoriaControls
  // Controla quem pode CLICAR no botão Revisado/Não Revisado
  const canToggleCuradoria = showCuradoriaControls;

  // Verificar se o usuário tem permissão para controles N1 (Qualidade)
  // Migrado para o sistema de permissões: scripts.n1_controles
  const isEquipe21OuAdmin = useMemo(
    () => temPermissao('scripts.n1_controles'),
    [temPermissao],
  );

  // Helper: marca acao_executada na notificação que abriu o modal (se existir)
  const finalizarNotificacaoPendente = async () => {
    if (notificacaoIdPendente) {
      try { await marcarAcaoExecutada(notificacaoIdPendente); } catch (e) { console.warn('Erro ao marcar acao_executada:', e); }
      setNotificacaoIdPendente(null);
    }
  };


  const fetchScripts = async () => {
    // Carrega todos os scripts de todas as equipes
    // NÃO filtra mais exclusao_pendente (scripts pendentes continuam visíveis)
    // Scripts deletados (desativados) são carregados para usuários com permissão
    // PERFORMANCE: Seleciona apenas colunas de listagem (sem conteudo_bruto/conteudo_atendente)
    const { data, error } = await supabase
      .from('scripts_customizados')
      .select(`
        id, nome, ordem, equipe_id, criado_em, pasta_id, numero_referencia,
        curadoria_atuada, pergunta, numero_chamado,
        email_enviado,
        criado_por, criado_por_atendente, equipe_autor_id, modificado_curadoria, data_curadoria, curadoria_por,
        deletado, deletado_em, deletado_por, desativado_em,
        exclusao_pendente, exclusao_solicitada_em, exclusao_solicitada_por, motivo_exclusao,
        temporario, tipo_requisitante, tem_conteudo_atendente, tem_conteudo_usuario_final,
        categoria_confianca, subcategoria_confianca,
        classificacao_origem, classificacao_em, classificacao_pendente, classificacao_por,
        categoria_equipe_slug, subcategoria_gse_slug, dominio, instancia,
        tem_proposta_pendente, n1, validado_n1, enviado_n1,
        scripts_categorias_adicionais(categoria_equipe_slug, subcategoria_gse_slug, confianca, origem)
      `)
      .order('ordem', { ascending: true })
      .order('criado_em', { ascending: true });
    
    if (error) {
      console.error('Erro ao carregar scripts:', error);
      toast.error('Erro ao carregar scripts', { id: 'scripts-fetch-error' });
      return;
    }
    // Mapear scripts_categorias_adicionais para categorias_adicionais
    const scriptsComCategorias = (data || []).map((s: any) => ({
      ...s,
      categorias_adicionais: s.scripts_categorias_adicionais || [],
      scripts_categorias_adicionais: undefined,
    }));
    setScripts(scriptsComCategorias);

    // Carregar max versões por script/campo via RPC agregada
    try {
      const scriptIds = (data || []).map((s: any) => s.id);
      const resumos = await buscarVersoesResumo(scriptIds);
      const map: Record<string, { usuario_final: number; atendente: number }> = {};
      resumos.forEach(r => {
        if (!map[r.script_id]) map[r.script_id] = { usuario_final: 0, atendente: 0 };
        map[r.script_id][r.campo_alvo as 'usuario_final' | 'atendente'] = r.max_versao;
      });
      setVersoesMap(map);
    } catch (e) {
      console.warn('Erro ao carregar versões (não crítico):', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchScripts();
      fetchAutoresMap();
      fetchEquipes();
      fetchCategorias(filtroDominio);
    } else {
      // Limpar dados grandes ao fechar modal (prevenir memory leak)
      setScripts([]);
      setAutoresMap(new Map());
      setCategoriasDisponiveis([]);
      setSubcategoriasDisponiveis([]);
      setHierarquiaRows([]);
      setEquipesDisponiveis([]);
      setVersoesMap({});
      setBusca('');
      setBuscaReferencia('');
      setBuscaAutor('');
      setEditingScript(null);
      setSelectedScriptId(null);
      setSelectedFolderId(null);
    }
  }, [isOpen]);

  // Recarregar categorias quando filtroDominio mudar (exceto na montagem inicial, coberta pelo useEffect de isOpen)
  const isFirstDominioRef = React.useRef(true);
  useEffect(() => {
    if (isFirstDominioRef.current) {
      isFirstDominioRef.current = false;
      return;
    }
    if (isOpen) {
      fetchCategorias(filtroDominio);
      setFiltroCategoria('todos');
      setFiltroSubcategoria('todos');
    }
  }, [filtroDominio]);

  // Soft refresh: atualizar scripts quando houver mudanças no banco em tempo real
  useEffect(() => {
    if (!isOpen) return;
    const channel = supabase
      .channel('scripts_realtime_refresh')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'scripts_customizados',
      }, () => {
        fetchScripts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isOpen]);

  // Processar notificação pendente (abrir modal correspondente)
  useEffect(() => {
    if (!notificacaoPendente || scripts.length === 0) return;
    const processarNotificacao = async () => {
      const scriptAlvo = scripts.find(s => s.id === notificacaoPendente.script_id);
      // Armazenar ID da notificação para marcar acao_executada quando o modal acionável concluir
      const tiposAcionaveis = ['proposta_recebida', 'proposta_rejeitada', 'proposta_reenviada', 'curadoria_inicial', 'contestacao_revisao_inicial'];
      if (tiposAcionaveis.includes(notificacaoPendente.tipo)) {
        setNotificacaoIdPendente(notificacaoPendente.id);
      }
      try {
        if (notificacaoPendente.tipo === 'proposta_recebida' && notificacaoPendente.proposta_id) {
          // Curador clicou → abrir AnalisarPropostaModal
          const proposta = await buscarPropostaPorId(notificacaoPendente.proposta_id);
          if (!proposta || proposta.status !== 'pendente') { setNotificacaoIdPendente(null); onNotificacaoProcessada?.(); return; }
          const { data: conteudos } = await supabase.from('scripts_customizados').select('conteudo_bruto, conteudo_atendente').eq('id', notificacaoPendente.script_id).single();
          setScriptParaAnalisarProposta({
            id: notificacaoPendente.script_id,
            nome: scriptAlvo?.nome || 'Script',
            conteudo_bruto: conteudos?.conteudo_bruto || '',
            conteudo_atendente: conteudos?.conteudo_atendente || undefined,
            curadoria_atuada: scriptAlvo?.curadoria_atuada ?? false,
            numero_chamado: scriptAlvo?.numero_chamado || undefined,
          });
          const nomeAutor = autoresMap.get(proposta.autor_id) || 'Usuário desconhecido';
          setAutorPropostaNome(nomeAutor);
          setPropostaParaAnalisar(proposta);
          setShowAnalisarPropostaModal(true);
        } else if (notificacaoPendente.tipo === 'proposta_aprovada') {
          // Autor clicou aprovação → abrir GeradorModal com o script
          if (scriptAlvo) {
            const { data: conteudos } = await supabase.from('scripts_customizados').select('conteudo_bruto, conteudo_atendente').eq('id', scriptAlvo.id).single();
            onOpenGerador({
              nome: scriptAlvo.nome,
              conteudo_bruto: conteudos?.conteudo_bruto || '',
              conteudo_atendente: conteudos?.conteudo_atendente || null,
            });
          }
        } else if (notificacaoPendente.tipo === 'proposta_rejeitada' && notificacaoPendente.proposta_id) {
          // Autor clicou rejeição → abrir PropostaRejeitadaModal
          const proposta = await buscarPropostaPorId(notificacaoPendente.proposta_id);
          if (!proposta) { setNotificacaoIdPendente(null); onNotificacaoProcessada?.(); return; }
          setPropostaRejeitada(proposta);
          _setScriptNomeRejeitada(scriptAlvo?.nome || 'Script');
          setShowPropostaRejeitadaModal(true);
        } else if (notificacaoPendente.tipo === 'curadoria_inicial') {
          if (notificacaoPendente.metadata) {
            // Revisão com alteração: abrir diff view
            const meta = notificacaoPendente.metadata as Record<string, string>;
            const curadorNome = autoresMap.get(meta.curador_id) || 'Curadoria';
            const campoAlvo = meta.campo_alvo || 'usuario_final';
            // Buscar conteúdo da versão mais recente (V2) para exibir diff
            const { data: versaoRecente } = await supabase
              .from('script_versoes')
              .select('conteudo, conteudo_anterior')
              .eq('script_id', notificacaoPendente.script_id)
              .eq('campo_alvo', campoAlvo)
              .order('numero_versao', { ascending: false })
              .limit(1)
              .single();
            setRevisarCuradoriaData({
              scriptId: notificacaoPendente.script_id,
              scriptNome: scriptAlvo?.nome || 'Script',
              conteudoOriginal: versaoRecente?.conteudo_anterior || '',
              conteudoModificado: versaoRecente?.conteudo || '',
              campoAlvo,
              tipoAlteracao: meta.tipo_motivacao || '',
              motivacao: meta.motivacao || '',
              curadorId: meta.curador_id || '',
              curadorNome,
            });
            setShowRevisarCuradoriaModal(true);
          } else {
            // Revisão sem alterações: abrir script no GeradorModal para visualização
            if (scriptAlvo) {
              const { data: conteudos } = await supabase.from('scripts_customizados').select('conteudo_bruto, conteudo_atendente').eq('id', scriptAlvo.id).single();
              onOpenGerador({
                nome: scriptAlvo.nome,
                conteudo_bruto: conteudos?.conteudo_bruto || '',
                conteudo_atendente: conteudos?.conteudo_atendente || null,
              });
            }
          }
        } else if (notificacaoPendente.tipo === 'contestacao_revisao_inicial' && notificacaoPendente.metadata) {
          // Curador clicou notificação de contestação → abrir AnalisarContestacaoModal
          const meta = notificacaoPendente.metadata as Record<string, string>;
          const campoAlvoContest = meta.campo_alvo || 'usuario_final';
          // Buscar conteúdo da versão mais recente para exibir diff
          const { data: versaoContest } = await supabase
            .from('script_versoes')
            .select('conteudo, conteudo_anterior')
            .eq('script_id', notificacaoPendente.script_id)
            .eq('campo_alvo', campoAlvoContest)
            .order('numero_versao', { ascending: false })
            .limit(1)
            .single();
          setContestacaoData({
            scriptId: notificacaoPendente.script_id,
            scriptNome: scriptAlvo?.nome || 'Script',
            conteudoOriginal: versaoContest?.conteudo_anterior || '',
            conteudoModificado: versaoContest?.conteudo || '',
            campoAlvo: campoAlvoContest,
            tipoAlteracao: meta.tipo_motivacao || '',
            motivacaoCuradoria: meta.motivacao_curadoria || meta.motivacao || '',
            razaoContestacao: meta.razao_contestacao || '',
          });
          setShowAnalisarContestacaoModal(true);
        } else if (notificacaoPendente.tipo === 'proposta_reenviada' && notificacaoPendente.proposta_id) {
          // Curador clicou notificação de proposta reenviada → abrir AnalisarPropostaModal
          const proposta = await buscarPropostaPorId(notificacaoPendente.proposta_id);
          if (!proposta || proposta.status !== 'pendente') { setNotificacaoIdPendente(null); onNotificacaoProcessada?.(); return; }
          const { data: conteudos } = await supabase.from('scripts_customizados').select('conteudo_bruto, conteudo_atendente').eq('id', notificacaoPendente.script_id).single();
          setScriptParaAnalisarProposta({
            id: notificacaoPendente.script_id,
            nome: scriptAlvo?.nome || 'Script',
            conteudo_bruto: conteudos?.conteudo_bruto || '',
            conteudo_atendente: conteudos?.conteudo_atendente || undefined,
            curadoria_atuada: scriptAlvo?.curadoria_atuada ?? false,
            numero_chamado: scriptAlvo?.numero_chamado || undefined,
          });
          const nomeAutor = autoresMap.get(proposta.autor_id) || 'Usuário desconhecido';
          setAutorPropostaNome(nomeAutor);
          setPropostaParaAnalisar(proposta);
          setShowAnalisarPropostaModal(true);
        }
      } catch (e) {
        console.warn('Erro ao processar notificação de script:', e);
      }
      onNotificacaoProcessada?.();
    };
    processarNotificacao();
  }, [notificacaoPendente, scripts]);

  // Buscar categorias hierárquicas por domínio + carregar hierarquia para subcategorias
  const fetchCategorias = async (dominio: string = 'todos') => {
    const equipeIds = dominio === 'externo'
      ? ['11111111-1111-1111-1111-111111111111']
      : dominio === 'interno'
        ? ['22222222-2222-2222-2222-222222222222', '90c2ed6a-bf56-4081-b4d6-63f37855ec12']
        : ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '90c2ed6a-bf56-4081-b4d6-63f37855ec12'];

    // Carregar categorias da tabela categorias_equipe (exposta via PostgREST)
    const { data, error } = await supabase
      .from('categorias_equipe')
      .select('slug, nome, icone')
      .in('equipe_id', equipeIds)
      .order('nome');

    if (!error && data) {
      const seen = new Set<string>();
      const dedup: {slug: string, nome: string, icone: string}[] = [];
      for (const row of data) {
        if (!seen.has(row.slug)) {
          seen.add(row.slug);
          dedup.push({ slug: row.slug, nome: row.nome, icone: row.icone || '🏷️' });
        }
      }
      setCategoriasDisponiveis(dedup.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    } else {
      setCategoriasDisponiveis([]);
    }

    // Carregar hierarquia completa para extrair subcategorias on-demand
    const allRows: any[] = [];
    for (const eqId of equipeIds) {
      const { data: hierData } = await supabase.rpc('obter_hierarquia_categorias', { p_equipe_id: eqId });
      if (hierData) allRows.push(...(hierData as any[]));
    }
    setHierarquiaRows(allRows);
  };

  // Carregar subcategorias da hierarquia quando filtroCategoria mudar
  useEffect(() => {
    if (filtroCategoria === 'todos' || filtroCategoria === 'sem_categoria') {
      setSubcategoriasDisponiveis([]);
      return;
    }
    // Extrair subcategorias da categoria selecionada a partir do cache da hierarquia
    const subs = new Map<string, {slug: string, nome: string}>();
    for (const row of hierarquiaRows) {
      if (row.categoria_equipe_slug === filtroCategoria && row.subcategoria_gse_slug) {
        if (!subs.has(row.subcategoria_gse_slug)) {
          subs.set(row.subcategoria_gse_slug, {
            slug: row.subcategoria_gse_slug,
            nome: row.subcategoria_gse_nome || row.subcategoria_gse_slug,
          });
        }
      }
    }
    setSubcategoriasDisponiveis(Array.from(subs.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
  }, [filtroCategoria, hierarquiaRows]);

  // Buscar equipes disponíveis
  const fetchEquipes = async () => {
    const { data, error } = await supabase
      .from('equipes')
      .select('id, nome')
      .order('nome');

    if (!error && data) {
      setEquipesDisponiveis(data);
    }
  };

  const fetchAutoresMap = async () => {
    const { data: autoresData, error: autoresError } = await supabase
      .from('users')
      .select('id, nome, email')
      .not('email', 'is', null);

    if (!autoresError && autoresData) {
      const map = new Map<string, string>();
      autoresData.forEach(u => {
        if (u.id && u.nome) {
          map.set(u.id, u.nome);
        }
      });
      setAutoresMap(map);
    }
  };

  const garantirVersoesV1Publicacao = async (
    script: ScriptItem,
    conteudo: string,
    conteudoAtendente: string | null
  ) => {
    try {
      if (conteudo) {
        const { error: errV1UF } = await supabase.rpc('criar_versao_v1_publicacao', {
          p_script_id: script.id,
          p_campo_alvo: 'usuario_final',
          p_conteudo: conteudo,
          p_autor_id: script.criado_por || user?.id,
        });
        if (errV1UF) console.warn('Erro ao criar V1 usuario_final:', errV1UF.message);
      }
      if (conteudoAtendente) {
        const { error: errV1AT } = await supabase.rpc('criar_versao_v1_publicacao', {
          p_script_id: script.id,
          p_campo_alvo: 'atendente',
          p_conteudo: conteudoAtendente,
          p_autor_id: script.criado_por_atendente || script.criado_por || user?.id,
        });
        if (errV1AT) console.warn('Erro ao criar V1 atendente:', errV1AT.message);
      }
    } catch (e) {
      console.warn('Erro ao criar V1 na publicação (não crítico):', e);
    }
  };

  const openPublicarModal = (script: ScriptItem) => {
    if (scriptPublicado(script)) {
      toast.info('Este script já está publicado.');
      return;
    }
    if (!script.numero_chamado || !script.pergunta) {
      toast.error('Preencha o número do chamado e a pergunta antes de publicar');
      return;
    }
    setScriptForPublicar(script);
    setShowConfirmPublicarModal(true);
  };

  const handleConfirmPublicar = async () => {
    if (!scriptForPublicar) return;

    setPublicarLoading(true);
    try {
      let conteudo = scriptForPublicar.conteudo_bruto;
      let conteudoAtendente = scriptForPublicar.conteudo_atendente ?? null;
      if (conteudo === undefined) {
        const dados = await fetchScriptConteudo(scriptForPublicar.id);
        conteudo = dados?.conteudo_bruto || '';
        conteudoAtendente = dados?.conteudo_atendente || null;
      }

      const { error: updateError } = await supabase
        .from('scripts_customizados')
        .update({ email_enviado: true })
        .eq('id', scriptForPublicar.id);

      if (updateError) {
        toast.error('Erro ao publicar script');
        return;
      }

      await garantirVersoesV1Publicacao(scriptForPublicar, conteudo || '', conteudoAtendente);

      const { error: notifError } = await supabase.rpc('notificar_curadoria_script_publicado', {
        p_script_id: scriptForPublicar.id,
      });
      if (notifError) {
        console.warn('Erro ao notificar curadoria (script já publicado):', notifError.message);
      }

      toast.success('Script publicado! A curadoria foi notificada.');
      setShowConfirmPublicarModal(false);
      setScriptForPublicar(null);
      fetchScripts();
    } catch (error) {
      console.error('Erro ao publicar script:', error);
      toast.error('Erro ao publicar script');
    } finally {
      setPublicarLoading(false);
    }
  };

  // Função helper para converter UTC para horário de Brasília (UTC-3)
  const converterParaBrasilia = (dataUtc: string): Date => {
    const data = new Date(dataUtc);
    // Subtrai 3 horas para converter de UTC para UTC-3 (Brasília)
    data.setHours(data.getHours() - 3);
    return data;
  };

  // Verificar se a pasta selecionada é uma pasta "Desativados" (pelo nome)
  const isPastaDesativadosSelected = React.useMemo(() => {
    if (!selectedFolderId) return false;
    const selectedFolder = folders.find(f => f.id === selectedFolderId);
    return selectedFolder?.nome === '🗑️ Desativados';
  }, [folders, selectedFolderId]);

  // Verificar se pode ver pasta Desativados (Coordenadoria 3.2 + admins)
  const canViewDesativados = showCuradoriaControls;

  // Mapa de referências fixas do banco (numero_referencia)
  const scriptsComReferencia = useMemo(() => {
    const map = new Map<string, number>();
    scripts.forEach(script => {
      if (script.numero_referencia) {
        map.set(script.id, script.numero_referencia);
      }
    });
    return map;
  }, [scripts]);

  // Converter autoresMap para formato UserOption[] para passar ao editor
  const usuariosParaEditor = useMemo(() => {
    return Array.from(autoresMap.entries()).map(([id, nome]) => ({ id, nome }));
  }, [autoresMap]);

  // Lista de autores únicos para sugestões (nome -> userId)
  const autoresUnicos = useMemo(() => {
    const autores = new Map<string, string>(); // nome -> userId
    scripts.forEach(script => {
      if (script.criado_por && autoresMap.has(script.criado_por)) {
        const nome = autoresMap.get(script.criado_por)!;
        autores.set(nome, script.criado_por);
      }
    });
    return Array.from(autores.entries()).map(([nome, userId]) => ({ nome, userId }));
  }, [scripts, autoresMap]);

  // Sugestões de autores filtradas pelo que o usuário digitou
  const sugestoesAutor = useMemo(() => {
    if (!buscaAutor.trim()) return [];
    const termo = buscaAutor.toLowerCase();
    return autoresUnicos
      .filter(a => a.nome.toLowerCase().includes(termo))
      .slice(0, 5); // Limitar a 5 sugestões
  }, [buscaAutor, autoresUnicos]);

  // Identificar todas as pastas Desativados e a principal (primeira encontrada)
  const desativadosFolderIds = React.useMemo(() => {
    const ids = folders.filter(f => f.nome === '🗑️ Desativados').map(f => f.id);
    return ids;
  }, [folders]);

  const mainDesativadosFolderId = desativadosFolderIds[0] || null;

  const executarBuscaSemantica = React.useCallback(() => {
    const termo = busca.trim().toLowerCase();
    if (termo.length < 3) {
      setSemanticSubmittedTerm('');
      setSemanticMatches(null);
      setSemanticLoading(false);
      setSemanticError(null);
      return;
    }
    setSemanticSubmittedTerm(termo);
    setSemanticSubmitSeq((s) => s + 1);
  }, [busca]);

  // Ao limpar a caixa de busca, reseta estado semantico.
  useEffect(() => {
    if (busca.trim() !== '') return;
    setSemanticSubmittedTerm('');
    setSemanticMatches(null);
    setSemanticLoading(false);
    setSemanticError(null);
  }, [busca]);

  // ===== Busca semantica (embedding) somente ao pressionar Enter =====
  // A digitacao atualiza apenas o termo local; a semantica e disparada
  // explicitamente por `executarBuscaSemantica`.
  useEffect(() => {
    const termo = semanticSubmittedTerm.trim();
    if (termo.length < 3) {
      setSemanticMatches(null);
      setSemanticLoading(false);
      setSemanticError(null);
      return;
    }

    const controller = new AbortController();
    setSemanticLoading(true);
    setSemanticError(null);

    (async () => {
      try {
        const matches = await buscarScriptsPorSimilaridade(termo, {
          limit: 100,
          minSimilarity: 0.18,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const map = new Map<string, number>();
        for (const m of matches) map.set(m.script_id, m.similarity);
        setSemanticMatches(map);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('[useScriptsModal] busca semantica falhou; mantendo filtro local:', err);
        setSemanticMatches(null);
        setSemanticError(err instanceof Error ? err.message : 'Falha na busca');
      } finally {
        if (!controller.signal.aborted) setSemanticLoading(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [semanticSubmittedTerm, semanticSubmitSeq]);

  // Filtrar scripts baseado na pasta selecionada e curadoria
  const filteredScripts = React.useMemo(() => {
    const termoBusca = busca.trim().toLowerCase();
    const semanticTermIsCurrent = termoBusca.length >= 3 && termoBusca === semanticSubmittedTerm;
    const usarSemantica = semanticTermIsCurrent && semanticMatches !== null;
    const scriptsFiltered = scripts.filter(script => {
      // Estrategia de busca por titulo:
      // - sem termo: passa todos
      // - termo curto (<3): substring no nome
      // - termo >= 3 com semanticMatches carregado: filtra por id presente no Map
      // - termo >= 3 sem matches ainda (loading/erro): mantem substring como fallback
      const matchesSearch =
        termoBusca === ''
          ? true
          : usarSemantica
            ? semanticMatches!.has(script.id)
            : script.nome.toLowerCase().includes(termoBusca);

      // Filtro por número de referência
      const refNumber = scriptsComReferencia.get(script.id);
      const matchesReferencia = buscaReferencia === '' || 
        (refNumber !== undefined && refNumber.toString() === buscaReferencia.trim());

      // Filtro por autor
      const autorNome = script.criado_por ? autoresMap.get(script.criado_por) : null;
      const matchesAutor = buscaAutor === '' || 
        (autorNome && autorNome.toLowerCase().includes(buscaAutor.toLowerCase()));

      // Filtro por tipo (temporário/permanente)
      const matchesTipo = 
        filtroTipo === 'todos' ||
        (filtroTipo === 'temporario' && script.temporario) ||
        (filtroTipo === 'permanente' && !script.temporario);

      // Filtro por conteúdo atendente
      const matchesAtendente =
        filtroAtendente === 'todos' ||
        (filtroAtendente === 'com-atendente' && script.tem_conteudo_atendente) ||
        (filtroAtendente === 'sem-atendente' && !script.tem_conteudo_atendente);

      // Filtro por tipo de requisitante
      const matchesTipoRequisitante =
        filtroTipoRequisitante === 'todos' ||
        script.tipo_requisitante === filtroTipoRequisitante;

      // Filtro N1
      const matchesN1 =
        filtroN1 === 'todos' ||
        (filtroN1 === 'n1' && script.n1 === true) ||
        (filtroN1 === 'nao-n1' && (script.n1 === false || script.n1 === null || script.n1 === undefined));

      // Filtro Validação e Envio (só ativo se filtroN1 === 'n1')
      const matchesValidacaoEnvio =
        filtroValidacaoEnvio === 'todos' ||
        (filtroValidacaoEnvio === 'validado-n1' && script.validado_n1 === true) ||
        (filtroValidacaoEnvio === 'enviado-n1' && script.enviado_n1 === true);

      // Filtro por domínio hierárquico (v2)
      const matchesDominio =
        filtroDominio === 'todos' || script.dominio === filtroDominio;

      // Filtro por instância
      const matchesInstancia =
        filtroInstancia === 'todos' || script.instancia === filtroInstancia;

      // Filtro por categoria hierárquica (v2 — usa categoria_equipe_slug, inclui categorias adicionais)
      const matchesCategoria =
        filtroCategoria === 'todos'
        || (filtroCategoria === 'sem_categoria' && !script.categoria_equipe_slug)
        || script.categoria_equipe_slug === filtroCategoria
        || (script.categorias_adicionais?.some(ca => ca.categoria_equipe_slug === filtroCategoria) ?? false);

      // Filtro por subcategoria hierárquica (v2 — usa subcategoria_gse_slug, inclui categorias adicionais)
      const slugsSubcatConhecidas = new Set(subcategoriasDisponiveis.map(s => s.slug));
      const matchesSubcategoria =
        filtroSubcategoria === 'todos'
        || (filtroSubcategoria === 'sem_subcategoria' && (
            !script.subcategoria_gse_slug
            || (filtroCategoria !== 'todos' && filtroCategoria !== 'sem_categoria' && !slugsSubcatConhecidas.has(script.subcategoria_gse_slug))
            || (filtroCategoria !== 'todos' && filtroCategoria !== 'sem_categoria' && script.categorias_adicionais?.some((ca: any) =>
                ca.categoria_equipe_slug === filtroCategoria && (!ca.subcategoria_gse_slug || !slugsSubcatConhecidas.has(ca.subcategoria_gse_slug))
              ) === true)
          ))
        || script.subcategoria_gse_slug === filtroSubcategoria
        || (script.categorias_adicionais?.some(ca =>
            ca.categoria_equipe_slug === filtroCategoria && ca.subcategoria_gse_slug === filtroSubcategoria
          ) ?? false);

      // Se o script está desativado, só mostrar na pasta Desativados E para usuários permitidos
      const isDesativado = script.deletado === true;

      // Usuários sem permissão: esconder scripts desativados SEMPRE
      if (isDesativado && !canViewDesativados) {
        return false;
      }

      // Scripts desativados só aparecem quando pasta Desativados está selecionada
      if (isDesativado && !isPastaDesativadosSelected && busca === '' && buscaReferencia === '' && buscaAutor === '' && filtroCuradoria === 'todos' && filtroAtendente === 'todos' && filtroCategoria === 'todos' && filtroDominio === 'todos' && filtroInstancia === 'todos' && filtroTipoRequisitante === 'todos') {
        return false;
      }

      // Na pasta Desativados, só mostrar scripts desativados
      if (isPastaDesativadosSelected && !isDesativado) {
        return false;
      }

      // Se filtro de domínio está ativo, buscar scripts de TODAS as pastas (cross-folder)
      if (filtroDominio !== 'todos') {
        const matchesEquipe = !filtroEquipeId || script.equipe_id === filtroEquipeId;
        return matchesSearch && matchesReferencia && matchesAutor && matchesDominio && matchesInstancia && matchesTipo && matchesAtendente && matchesTipoRequisitante && matchesEquipe && matchesCategoria && matchesSubcategoria && matchesN1 && matchesValidacaoEnvio && !isDesativado;
      }

      // Se filtro de instância está ativo, buscar scripts de TODAS as pastas (cross-folder)
      if (filtroInstancia !== 'todos') {
        const matchesEquipe = !filtroEquipeId || script.equipe_id === filtroEquipeId;
        return matchesSearch && matchesReferencia && matchesAutor && matchesDominio && matchesInstancia && matchesTipo && matchesAtendente && matchesTipoRequisitante && matchesEquipe && matchesCategoria && matchesSubcategoria && matchesN1 && matchesValidacaoEnvio && !isDesativado;
      }

      // Se filtro N1 está ativo, buscar scripts de TODAS as pastas (cross-folder)
      if (filtroN1 !== 'todos') {
        const matchesEquipe = !filtroEquipeId || script.equipe_id === filtroEquipeId;
        return matchesSearch && matchesReferencia && matchesAutor && matchesDominio && matchesInstancia && matchesTipo && matchesAtendente && matchesTipoRequisitante && matchesEquipe && matchesCategoria && matchesSubcategoria && matchesN1 && matchesValidacaoEnvio && !isDesativado;
      }

      // Se filtro de tipo requisitante está ativo, buscar scripts de TODAS as pastas (cross-folder)
      if (filtroTipoRequisitante !== 'todos') {
        const matchesEquipe = !filtroEquipeId || script.equipe_id === filtroEquipeId;
        return matchesSearch && matchesReferencia && matchesAutor && matchesDominio && matchesInstancia && matchesTipo && matchesAtendente && matchesTipoRequisitante && matchesEquipe && matchesCategoria && matchesSubcategoria && matchesN1 && matchesValidacaoEnvio && !isDesativado;
      }

      // Se filtro de categoria ou subcategoria está ativo, buscar scripts de TODAS as pastas (cross-folder)
      if (filtroCategoria !== 'todos' || filtroSubcategoria !== 'todos') {
        const matchesEquipe = !filtroEquipeId || script.equipe_id === filtroEquipeId;
        return matchesSearch && matchesReferencia && matchesAutor && matchesDominio && matchesInstancia && matchesTipo && matchesAtendente && matchesTipoRequisitante && matchesEquipe && matchesCategoria && matchesSubcategoria && matchesN1 && matchesValidacaoEnvio && !isDesativado;
      }

      // Se filtro de curadoria está ativo (Não Revisados ou Revisados), mostrar de TODAS as pastas
      if (filtroCuradoria !== 'todos') {
        const matchesEquipe = !filtroEquipeId || script.equipe_id === filtroEquipeId;
        const matchesCuradoria = filtroCuradoria === 'nao-revisados'
          ? !script.curadoria_atuada && script.tem_conteudo_usuario_final !== false
          : filtroCuradoria === 'revisao-solicitada'
            ? script.tem_proposta_pendente === true
            : filtroCuradoria === 'exclusao-solicitada'
              ? script.exclusao_pendente === true
              : script.curadoria_atuada === true;
        return matchesSearch && matchesReferencia && matchesAutor && matchesDominio && matchesInstancia && matchesTipo && matchesAtendente && matchesTipoRequisitante && matchesEquipe && matchesCuradoria && matchesCategoria && matchesSubcategoria && matchesN1 && matchesValidacaoEnvio && !isDesativado;
      }

      // Se há busca ativa (nome, referência ou autor), mostrar scripts de todas as pastas
      if (busca !== '' || buscaReferencia !== '' || buscaAutor !== '') {
        const matchesEquipe = !filtroEquipeId || script.equipe_id === filtroEquipeId;
        return matchesSearch && matchesReferencia && matchesAutor && matchesDominio && matchesInstancia && matchesTipo && matchesAtendente && matchesTipoRequisitante && matchesEquipe && matchesCategoria && matchesSubcategoria && matchesN1 && matchesValidacaoEnvio && (canViewDesativados || !isDesativado);
      }

      // Se filtro de equipe está ativo, mostrar scripts de TODAS as pastas (ignora pasta selecionada)
      if (filtroEquipeId) {
        const matchesEquipe = script.equipe_id === filtroEquipeId;
        return matchesSearch && matchesReferencia && matchesAutor && matchesDominio && matchesInstancia && matchesTipo && matchesAtendente && matchesTipoRequisitante && matchesEquipe && matchesCategoria && matchesSubcategoria && matchesN1 && matchesValidacaoEnvio && !isDesativado;
      }

      // Se filtro de atendente está ativo, mostrar scripts de TODAS as pastas
      if (filtroAtendente !== 'todos') {
        const matchesEquipe = !filtroEquipeId || script.equipe_id === filtroEquipeId;
        return matchesSearch && matchesReferencia && matchesAutor && matchesDominio && matchesInstancia && matchesTipo && matchesAtendente && matchesTipoRequisitante && matchesEquipe && matchesCategoria && matchesSubcategoria && matchesN1 && matchesValidacaoEnvio && !isDesativado;
      }

      // Se não há busca nem filtro de revisão nem filtro de equipe, aplicar filtro de pasta normalmente
      // Para pastas Desativados, considerar todas as pastas Desativados como uma só
      const matchesFolder = selectedFolderId === null
        ? !script.pasta_id
        : isPastaDesativadosSelected 
          ? desativadosFolderIds.includes(script.pasta_id || '')
          : script.pasta_id === selectedFolderId;

      const matchesEquipe = !filtroEquipeId || script.equipe_id === filtroEquipeId;
      return matchesFolder && matchesDominio && matchesInstancia && matchesTipo && matchesAtendente && matchesTipoRequisitante && matchesEquipe && matchesCategoria && matchesSubcategoria && matchesN1 && matchesValidacaoEnvio;
    });

    // Ordenar:
    // - Quando busca semantica esta' ativa, ordenar por similaridade (desc).
    // - Caso contrario, ordenar por data de criacao.
    if (semanticMatches && semanticTermIsCurrent) {
      return [...scriptsFiltered].sort((a, b) => {
        const sa = semanticMatches.get(a.id) ?? 0;
        const sb = semanticMatches.get(b.id) ?? 0;
        return sb - sa;
      });
    }

    return [...scriptsFiltered].sort((a, b) => {
      const dataA = converterParaBrasilia(a.criado_em).getTime();
      const dataB = converterParaBrasilia(b.criado_em).getTime();
      
      if (ordenacaoData === 'mais-antigo') {
        return dataA - dataB; // Mais antigo primeiro
      } else {
        return dataB - dataA; // Mais novo primeiro
      }
    });
  }, [scripts, busca, semanticMatches, semanticSubmittedTerm, buscaReferencia, buscaAutor, filtroCuradoria, filtroEquipeId, filtroTipo, filtroAtendente, filtroTipoRequisitante, filtroDominio, filtroInstancia, filtroCategoria, filtroSubcategoria, filtroN1, filtroValidacaoEnvio, selectedFolderId, ordenacaoData, isPastaDesativadosSelected, canViewDesativados, scriptsComReferencia, autoresMap, desativadosFolderIds]);

  // Contador de scripts baseado no filtro de curadoria ativo (com filtro de equipe)
  const countCuradoria = useMemo(() => {
    const filtered = filtroCuradoria === 'nao-revisados'
      ? scripts.filter(s => !s.curadoria_atuada && !s.deletado && s.tem_conteudo_usuario_final !== false)
      : filtroCuradoria === 'revisados'
        ? scripts.filter(s => s.curadoria_atuada === true && !s.deletado)
        : filtroCuradoria === 'revisao-solicitada'
          ? scripts.filter(s => s.tem_proposta_pendente === true && !s.deletado)
          : filtroCuradoria === 'exclusao-solicitada'
            ? scripts.filter(s => s.exclusao_pendente === true && !s.deletado)
            : [];
    if (filtroEquipeId) {
      return filtered.filter(s => s.equipe_id === filtroEquipeId).length;
    }
    return filtered.length;
  }, [scripts, filtroCuradoria, filtroEquipeId]);

  // Contador total (sem filtro de equipe) para badge
  const countCuradoriaTotal = useMemo(() => {
    if (filtroCuradoria === 'nao-revisados') {
      return scripts.filter(s => !s.curadoria_atuada && !s.deletado && s.tem_conteudo_usuario_final !== false).length;
    }
    if (filtroCuradoria === 'revisados') {
      return scripts.filter(s => s.curadoria_atuada === true && !s.deletado).length;
    }
    if (filtroCuradoria === 'revisao-solicitada') {
      return scripts.filter(s => s.tem_proposta_pendente === true && !s.deletado).length;
    }
    if (filtroCuradoria === 'exclusao-solicitada') {
      return scripts.filter(s => s.exclusao_pendente === true && !s.deletado).length;
    }
    return 0;
  }, [scripts, filtroCuradoria]);

  // Labels de contagem para as opções do select de curadoria (reagem ao filtro de equipe)
  const countNaoRevisadosLabel = useMemo(() => {
    const count = scripts.filter(s => !s.curadoria_atuada && !s.deletado && s.tem_conteudo_usuario_final !== false && (!filtroEquipeId || s.equipe_id === filtroEquipeId)).length;
    return count > 0 ? ` (${count})` : '';
  }, [scripts, filtroEquipeId]);

  const countRevisadosLabel = useMemo(() => {
    const count = scripts.filter(s => s.curadoria_atuada === true && !s.deletado && (!filtroEquipeId || s.equipe_id === filtroEquipeId)).length;
    return count > 0 ? ` (${count})` : '';
  }, [scripts, filtroEquipeId]);

  const countRevisaoSolicitadaLabel = useMemo(() => {
    const count = scripts.filter(s => s.tem_proposta_pendente === true && !s.deletado && (!filtroEquipeId || s.equipe_id === filtroEquipeId)).length;
    return count > 0 ? ` (${count})` : '';
  }, [scripts, filtroEquipeId]);

  const countExclusaoSolicitadaLabel = useMemo(() => {
    const count = scripts.filter(s => s.exclusao_pendente === true && !s.deletado && (!filtroEquipeId || s.equipe_id === filtroEquipeId)).length;
    return count > 0 ? ` (${count})` : '';
  }, [scripts, filtroEquipeId]);

  // Contador de scripts temporários
  const countTemporarios = useMemo(() => {
    return scripts.filter(s => s.temporario && !s.deletado).length;
  }, [scripts]);

  // Contador de scripts com conteúdo atendente
  const countComAtendente = useMemo(() => {
    return scripts.filter(s => s.tem_conteudo_atendente && !s.deletado).length;
  }, [scripts]);

  // Tipos Requisitante únicos presentes nos scripts (para o filtro)
  const tiposRequisitanteDisponiveis = useMemo(() => {
    const set = new Set<string>();
    scripts.forEach(s => {
      if (s.tipo_requisitante && !s.deletado) set.add(s.tipo_requisitante);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [scripts]);

  // Contagens de scripts por categoria hierárquica v2 (para exibir nos selects de filtro)
  const contagemPorCategoria = useMemo(() => {
    const map = new Map<string, number>();
    let semCategoria = 0;
    scripts.filter(s => !s.deletado && (!filtroEquipeId || s.equipe_id === filtroEquipeId) && (filtroDominio === 'todos' || s.dominio === filtroDominio) && (filtroInstancia === 'todos' || s.instancia === filtroInstancia)).forEach(s => {
      if (!s.categoria_equipe_slug) {
        semCategoria++;
      } else {
        map.set(s.categoria_equipe_slug, (map.get(s.categoria_equipe_slug) || 0) + 1);
      }
      // Contar categorias adicionais também
      s.categorias_adicionais?.forEach((ca: any) => {
        if (ca.categoria_equipe_slug && ca.categoria_equipe_slug !== s.categoria_equipe_slug) {
          map.set(ca.categoria_equipe_slug, (map.get(ca.categoria_equipe_slug) || 0) + 1);
        }
      });
    });
    map.set('sem_categoria', semCategoria);
    return map;
  }, [scripts, filtroEquipeId, filtroDominio, filtroInstancia]);

  // Contagens de scripts por subcategoria hierárquica v2 (para exibir nos selects de filtro)
  const contagemPorSubcategoria = useMemo(() => {
    const map = new Map<string, number>();
    let semSubcategoria = 0;
    const catAtiva = filtroCategoria;
    const slugsConhecidas = new Set(subcategoriasDisponiveis.map(s => s.slug));
    scripts.filter(s => !s.deletado && (!filtroEquipeId || s.equipe_id === filtroEquipeId) && (filtroDominio === 'todos' || s.dominio === filtroDominio) && (filtroInstancia === 'todos' || s.instancia === filtroInstancia)).forEach(s => {
      // Se categoria ativa, só contar scripts dessa categoria
      const pertenceCategoria = catAtiva === 'todos' || s.categoria_equipe_slug === catAtiva
        || (s.categorias_adicionais?.some((ca: any) => ca.categoria_equipe_slug === catAtiva) ?? false);
      if (!pertenceCategoria) return;
      if (!s.subcategoria_gse_slug) {
        semSubcategoria++;
      } else if (catAtiva !== 'todos' && catAtiva !== 'sem_categoria' && !slugsConhecidas.has(s.subcategoria_gse_slug)) {
        semSubcategoria++;
      } else {
        map.set(s.subcategoria_gse_slug, (map.get(s.subcategoria_gse_slug) || 0) + 1);
      }
      // Contar subcategorias adicionais da categoria ativa
      s.categorias_adicionais?.forEach((ca: any) => {
        if (ca.categoria_equipe_slug === catAtiva && ca.subcategoria_gse_slug && ca.subcategoria_gse_slug !== s.subcategoria_gse_slug) {
          if (!slugsConhecidas.has(ca.subcategoria_gse_slug)) {
            semSubcategoria++;
          } else {
            map.set(ca.subcategoria_gse_slug, (map.get(ca.subcategoria_gse_slug) || 0) + 1);
          }
        }
      });
    });
    map.set('sem_subcategoria', semSubcategoria);
    return map;
  }, [scripts, filtroEquipeId, filtroDominio, filtroInstancia, filtroCategoria, subcategoriasDisponiveis]);

  // Contar scripts sem pasta (excluindo desativados)
  const scriptsWithoutFolder = scripts.filter(s => !s.pasta_id && !s.deletado).length;

  // Mapa de contagem de scripts por pasta (consolidando pastas Desativados duplicadas)
  const scriptCountByFolder = React.useMemo(() => {
    const countMap = new Map<string, number>();
    scripts.forEach(script => {
      if (script.pasta_id) {
        // Se é uma pasta Desativados e não é a principal, contar na principal
        if (desativadosFolderIds.includes(script.pasta_id) && mainDesativadosFolderId) {
          countMap.set(mainDesativadosFolderId, (countMap.get(mainDesativadosFolderId) || 0) + 1);
        } else {
          countMap.set(script.pasta_id, (countMap.get(script.pasta_id) || 0) + 1);
        }
      }
    });
    return countMap;
  }, [scripts, desativadosFolderIds, mainDesativadosFolderId]);

  // Funções para criação de pasta
  const handleOpenCreateFolderModal = () => {
    setShowConfirmFolderLocationModal(true);
  };

  const handleConfirmFolderLocation = async (parentFolderId: string | null) => {
    setShowConfirmFolderLocationModal(false);
    
    // Atualizar a pasta selecionada se mudou
    if (parentFolderId !== selectedFolderId) {
      setSelectedFolderId(parentFolderId);
    }

    // Abrir modal de criação de pasta com a localização definida
    setShowCreateFolderModal(true);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    // A pasta será criada dentro da pasta selecionada (ou na raiz se null)
    const success = await createFolder(
      newFolderName.trim(), 
      '#3B82F6', 
      newFolderIcon,
      selectedFolderId // pasta_pai_id
    );
    
    if (success) {
      setNewFolderName('');
      setNewFolderIcon('📁');
      setShowCreateFolderModal(false);
    }
  };

  // Funções para edição de pasta
  const handleOpenEditFolder = (folder: any) => {
    setEditFolderId(folder.id);
    setEditFolderName(folder.nome);
    setEditFolderIcon(folder.icone || '📁');
    setShowEditFolderModal(true);
  };

  const handleEditFolder = async () => {
    if (!editFolderId || !editFolderName.trim()) return;
    
    await updateFolder(editFolderId, { nome: editFolderName.trim(), icone: editFolderIcon });
    setShowEditFolderModal(false);
    setEditFolderId(null);
    setEditFolderName('');
    setEditFolderIcon('📁');
  };

  // Função para confirmar exclusão de pasta
  const handleDeleteFolder = async (folder: any) => {
    const scriptCount = await getFolderScriptCount(folder.id);
    
    setFolderToDelete({
      id: folder.id,
      name: folder.nome,
      scriptCount
    });
    setShowDeleteFolderModal(true);
  };

  const confirmDeleteFolder = async (deleteContent: boolean) => {
    if (!folderToDelete) return;
    
    const success = await deleteFolder(folderToDelete.id, deleteContent);
    if (success) {
      setShowDeleteFolderModal(false);
      setFolderToDelete(null);
      // Atualizar scripts se necessário
      if (selectedFolderId === folderToDelete.id) {
        setSelectedFolderId(null);
      }
      fetchScripts();
    }
  };

  // Funções para edição inline de scripts
  const startEditScript = (script: ScriptItem) => {
    setEditingScriptId(script.id);
    setEditingTitle(script.nome);
  };

  const saveEditScript = async () => {
    if (!editingTitle.trim() || !editingScriptId) return;
    
    const { error } = await supabase
      .from('scripts_customizados')
      .update({ nome: editingTitle.trim() })
      .eq('id', editingScriptId);

    if (error) {
      toast.error('Erro ao salvar título');
    } else {
      toast.success('Título atualizado');
      setEditingScriptId(null);
      setEditingTitle('');
      fetchScripts();
    }
  };

  const cancelEditScript = () => {
    setEditingScriptId(null);
    setEditingTitle('');
  };

  // Funções para edição de conteúdo
  // PERFORMANCE: Busca conteudo_bruto sob demanda ao abrir o editor
  const openScriptEditor = async (script: ScriptItem, mode: 'usuario_final' | 'atendente' = 'usuario_final') => {
    setEditMode(mode);

    // Se já tem conteúdo carregado (ex: script recém-criado), usar direto
    if (script.conteudo_bruto !== undefined) {
      setEditingScript(script);
      setEditingContent(mode === 'atendente' ? (script.conteudo_atendente || '') : script.conteudo_bruto);
      setEditorKey(prev => prev + 1);
      return;
    }

    // Lazy load: buscar conteúdo completo do banco
    const { data, error } = await supabase
      .from('scripts_customizados')
      .select('conteudo_bruto, conteudo_atendente, criado_por_atendente')
      .eq('id', script.id)
      .single();

    if (error) {
      console.error('Erro ao carregar conteúdo do script:', error);
      toast.error('Erro ao carregar conteúdo do script');
      return;
    }

    const scriptComConteudo = { ...script, ...data };
    setEditingScript(scriptComConteudo);
    setEditingContent(mode === 'atendente' ? (data?.conteudo_atendente || '') : (data?.conteudo_bruto || ''));
    // Incrementa key para forçar remontagem completa do editor
    setEditorKey(prev => prev + 1);
  };

  // Helper: buscar conteúdos de um script sob demanda
  const fetchScriptConteudo = async (scriptId: string): Promise<{ conteudo_bruto: string; conteudo_atendente: string | null } | null> => {
    const { data, error } = await supabase
      .from('scripts_customizados')
      .select('conteudo_bruto, conteudo_atendente')
      .eq('id', scriptId)
      .single();

    if (error) {
      console.error('Erro ao carregar conteúdo do script:', error);
      return null;
    }
    return { conteudo_bruto: data?.conteudo_bruto || '', conteudo_atendente: data?.conteudo_atendente || null };
  };

  // Wrapper para abrir gerador com lazy load de conteúdo
  const handleOpenGerador = async (script: ScriptItem) => {
    if (script.conteudo_bruto !== undefined) {
      onOpenGerador({ nome: script.nome, conteudo_bruto: script.conteudo_bruto || '', conteudo_atendente: script.conteudo_atendente || null });
      return;
    }
    const conteudo = await fetchScriptConteudo(script.id);
    if (conteudo !== null) {
      onOpenGerador({ nome: script.nome, conteudo_bruto: conteudo.conteudo_bruto, conteudo_atendente: conteudo.conteudo_atendente });
    } else {
      toast.error('Erro ao carregar conteúdo para o gerador');
    }
  };

  const closeScriptEditor = () => {
    setEditingScript(null);
    setEditingContent('');
    setIsCreatingNew(false);
    setEditMode('usuario_final');
  };

  // Função para criar script diretamente no editor (abre modal de confirmação)
  const createScriptDirect = () => {
    setShowConfirmScriptLocationModal(true);
  };

  // Função chamada após confirmação do local do script
  const handleConfirmScriptLocation = (locationId: string | null) => {
    setShowConfirmScriptLocationModal(false);
    
    // Se o local for diferente, atualizar selectedFolderId
    if (locationId !== selectedFolderId) {
      setSelectedFolderId(locationId);
    }

    // Armazenar localização e abrir modal de seleção de tipo
    setPendingNewScriptLocationId(locationId);
    setShowNewScriptEditTypeModal(true);
  };

  // Função chamada após selecionar o tipo de edição para novo script
  const handleNewScriptEditTypeSelect = (tipo: 'usuario_final' | 'atendente') => {
    setShowNewScriptEditTypeModal(false);
    const locationId = pendingNewScriptLocationId;

    // Buscar equipe_id da pasta selecionada ou do localStorage
    let equipeId = localStorage.getItem("equipeId");
    
    if (locationId) {
      const pastaAtual = folders.find(f => f.id === locationId);
      if (pastaAtual && pastaAtual.equipe_id) {
        equipeId = pastaAtual.equipe_id;
      }
    }

    // Se não tiver equipeId, não permitir criar
    if (!equipeId) {
      toast.error('Erro: Equipe não identificada. Faça login novamente.');
      return;
    }

    const newScript: ScriptItem = {
      id: '', // ID vazio indica script novo
      nome: 'Novo Script',
      conteudo_bruto: '',
      equipe_id: equipeId,
      criado_em: new Date().toISOString(),
      pasta_id: locationId,
      curadoria_atuada: false,
      instancia: inferirInstanciaPorEquipe(equipeId),
    };
    setEditingScript(newScript);
    setEditingContent('');
    setIsCreatingNew(true);
    setEditMode(tipo);
    // Incrementa key para forçar remontagem completa do editor
    setEditorKey(prev => prev + 1);
    setPendingNewScriptLocationId(null);
  };

  // Função para salvar script (novo ou existente)
  const saveScript = async (payload: ScriptSavePayload) => {
    const { content, nome, autorId, temporario, n1, validado_n1, enviado_n1, tipoRequisitante, categoriaSlug: _categoriaSlug, subcategoriaSlug: _subcategoriaSlug, categoriaEquipeSlug, subcategoriaGseSlug, instancia, pergunta, numeroChamado } = payload;
    if (isCreatingNew) {
      // Buscar equipe_id da pasta selecionada ou do localStorage
      let equipeId = localStorage.getItem("equipeId");
      
      if (selectedFolderId) {
        const pastaAtual = folders.find(f => f.id === selectedFolderId);
        if (pastaAtual && pastaAtual.equipe_id) {
          equipeId = pastaAtual.equipe_id;
        }
      }

      // Se não tiver equipeId, não criar o script
      if (!equipeId) {
        toast.error('Erro: Equipe não identificada. Faça login novamente.');
        return;
      }

      // Criar novo script — salvar conteúdo no campo correto baseado no modo de edição
      const insertData: Record<string, unknown> = {
        nome: nome.trim() || 'Novo Script',
        ...(editMode === 'atendente'
          ? { conteudo_atendente: content, conteudo_bruto: '' }
          : { conteudo_bruto: content }),
        equipe_id: equipeId,
        pasta_id: selectedFolderId || null,
        curadoria_atuada: false,
        ...(editMode === 'atendente'
          ? { criado_por_atendente: autorId !== undefined ? autorId : user?.id }
          : { criado_por: autorId !== undefined ? autorId : user?.id }),
        equipe_autor_id: equipeId,
        temporario: temporario || false,
        tipo_requisitante: tipoRequisitante || null,
        instancia: instancia || inferirInstanciaPorEquipe(equipeId),
        n1: n1 ?? null,
        validado_n1: validado_n1 || false,
        enviado_n1: enviado_n1 || false,
        ...(validado_n1 ? { validado_n1_por: user?.id, validado_n1_em: new Date().toISOString() } : {}),
        ...(enviado_n1 ? { enviado_n1_por: user?.id, enviado_n1_em: new Date().toISOString() } : {}),
        pergunta: pergunta?.trim() || null,
        numero_chamado: numeroChamado?.trim() || null
      };

      // Incluir categoria hierárquica v2 se definida
      if (categoriaEquipeSlug !== undefined) {
        insertData.categoria_equipe_slug = categoriaEquipeSlug || null;
        insertData.subcategoria_gse_slug = subcategoriaGseSlug || null;
        if (categoriaEquipeSlug) {
          insertData.classificacao_origem = 'manual';
          insertData.classificacao_em = new Date().toISOString();
          insertData.classificacao_por = user?.id;
          insertData.classificacao_pendente = false;
        }
      }

      const { data: newScriptData, error } = await supabase
        .from('scripts_customizados')
        .insert(insertData)
        .select();

      if (error) {
        console.error('Erro ao criar script:', error);
        toast.error(`Erro ao criar script: ${error.message}`);
        return;
      }

      // Registrar V1 imediatamente na criação (histórico disponível desde o início)
      if (newScriptData?.[0]) {
        const ns = newScriptData[0];
        try {
          await supabase.rpc('criar_versao_v1_publicacao', {
            p_script_id: ns.id,
            p_campo_alvo: editMode === 'atendente' ? 'atendente' : 'usuario_final',
            p_conteudo: content,
            p_autor_id: (editMode === 'atendente' ? ns.criado_por_atendente : ns.criado_por) || user?.id
          });
        } catch (e) {
          console.warn('Erro ao criar V1 na criação (não crítico):', e);
        }
      }

      toast.success('Script criado com sucesso');

      setOrientacaoScriptNome(nome.trim() || 'Novo Script');
      setShowOrientacaoPosSalvarModal(true);

      setEditingScript(null);
      setEditingContent('');
      setIsCreatingNew(false);
      fetchScripts();
    } else {
      // Atualizar script existente
      if (!editingScript) return;

      // Detectar se apenas campos N1/Validação/Envio foram alterados (sem mudança no conteúdo ou nome)
      // Equipe 2.1 ou admin alterando apenas N1/Validado N1/Enviado N1 não dispara proposta nem curadoria
      const conteudoOriginalDoScript = editMode === 'atendente'
        ? (editingScript.conteudo_atendente || '')
        : (editingScript.conteudo_bruto || '');
      const nomeNovo = nome.trim() || editingScript.nome;
      const apenasAlteracaoN1 = content === conteudoOriginalDoScript && nomeNovo === editingScript.nome;

      // Interceptar: modo proposta ativo → capturar conteúdo e abrir modal de motivação
      // Exceção: alterações exclusivas de N1/Validado/Enviado (Equipe 2.1 ou admin) saltam o modo proposta
      if (modoPropostaAtivo && !apenasAlteracaoN1) {
        setPropostaConteudo(content);
        setPropostaCampoAlvo(editMode);
        setPropostaScriptId(editingScript.id);
        setPropostaScriptNome(editingScript.nome);
        setPropostaCuradorAnteriorId(editingScript.curadoria_atuada ? (editingScript.curadoria_por || null) : null);
        setEditingScript(null);
        setEditingContent('');
        setModoPropostaAtivo(false);
        setShowPropostaMotivacaoModal(true);
        return;
      }

      // Montar objeto de atualização
      const updateData: Record<string, unknown> = {
        nome: nome.trim() || editingScript.nome
      };

      // Salvar conteúdo no campo correto baseado no modo de edição
      if (editMode === 'atendente') {
        updateData.conteudo_atendente = content;
      } else {
        updateData.conteudo_bruto = content;
      }

      // Atualizar autor no campo correto baseado no modo de edição
      if (autorId !== undefined) {
        if (editMode === 'atendente') {
          updateData.criado_por_atendente = autorId;
        } else {
          updateData.criado_por = autorId;
        }
      }

      // Atualizar flag temporário
      if (temporario !== undefined) {
        updateData.temporario = temporario;
      }

      // Atualizar tipo de requisitante
      if (tipoRequisitante !== undefined) {
        updateData.tipo_requisitante = tipoRequisitante;
      }

      // Atualizar instância
      if (instancia !== undefined) {
        updateData.instancia = instancia || null;
      }

      // Atualizar N1
      if (n1 !== undefined) {
        updateData.n1 = n1;
        // Cascade reset: limpar validação/envio quando N1 é desativado
        if (n1 === false || n1 === null) {
          updateData.validado_n1 = false;
          updateData.validado_n1_por = null;
          updateData.validado_n1_em = null;
          updateData.enviado_n1 = false;
          updateData.enviado_n1_por = null;
          updateData.enviado_n1_em = null;
        }
      }

      // Atualizar Validação e Envio N1
      if (validado_n1 !== undefined) {
        updateData.validado_n1 = validado_n1;
        if (validado_n1) {
          updateData.validado_n1_por = user?.id;
          updateData.validado_n1_em = new Date().toISOString();
        } else {
          updateData.validado_n1_por = null;
          updateData.validado_n1_em = null;
        }
      }
      if (enviado_n1 !== undefined) {
        updateData.enviado_n1 = enviado_n1;
        if (enviado_n1) {
          updateData.enviado_n1_por = user?.id;
          updateData.enviado_n1_em = new Date().toISOString();
        } else {
          updateData.enviado_n1_por = null;
          updateData.enviado_n1_em = null;
        }
      }

      // Atualizar pergunta e número do chamado
      if (pergunta !== undefined) {
        updateData.pergunta = pergunta.trim() || null;
      }
      if (numeroChamado !== undefined) {
        updateData.numero_chamado = numeroChamado.trim() || null;
      }

      // Atualizar categoria hierárquica v2 (Fase 5)
      if (categoriaEquipeSlug !== undefined) {
        updateData.categoria_equipe_slug = categoriaEquipeSlug || null;
        updateData.subcategoria_gse_slug = subcategoriaGseSlug || null;
        if (categoriaEquipeSlug) {
          updateData.classificacao_origem = 'manual';
          updateData.classificacao_em = new Date().toISOString();
          updateData.classificacao_por = user?.id;
          updateData.classificacao_pendente = false;
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // Curadoria editando script já revisado: abrir modal de classificação
      // (antes era chamada direta com tipo hardcoded — agora curadoria classifica)
      // ═══════════════════════════════════════════════════════════════════
      if (showCuradoriaControls && editingScript.curadoria_atuada && !apenasAlteracaoN1) {
        setClassifConteudo(content);
        setClassifScriptId(editingScript.id);
        setClassifCampoAlvo(editMode);
        setClassifScriptCriadoPor(editingScript.criado_por || null);
        setClassifScriptNome(nomeNovo);
        setClassifContexto('edicao_posterior');
        // Capturar cat/subcat alteradas no editor para persistir junto com a revisão
        setClassifCategoriaEquipeSlug(categoriaEquipeSlug);
        setClassifSubcategoriaGseSlug(subcategoriaGseSlug);
        setClassifInstancia(instancia);
        setShowClassificarEdicaoModal(true);
        return;
      }

      // ═══════════════════════════════════════════════════════════════════
      // Curadoria editando script NÃO revisado (revisão inicial com edição):
      // Abrir modal de classificação ANTES de gravar no banco.
      // A RPC revisar_script_inicial precisa ler o conteúdo ORIGINAL
      // de scripts_customizados para criar V1 — se o frontend gravar
      // o conteúdo novo antes, V1 fica com conteúdo errado (Bug #12).
      // ═══════════════════════════════════════════════════════════════════
      if (showCuradoriaControls && !editingScript.curadoria_atuada && !apenasAlteracaoN1) {
        setClassifConteudo(content);
        setClassifScriptId(editingScript.id);
        setClassifCampoAlvo(editMode);
        setClassifScriptCriadoPor(editingScript.criado_por || null);
        setClassifScriptNome(nomeNovo);
        setClassifContexto('revisao_inicial');
        // Capturar cat/subcat alteradas no editor para persistir junto com a revisão
        setClassifCategoriaEquipeSlug(categoriaEquipeSlug);
        setClassifSubcategoriaGseSlug(subcategoriaGseSlug);
        setClassifInstancia(instancia);
        setShowClassificarEdicaoModal(true);
        return;
      }

      const { error } = await supabase
        .from('scripts_customizados')
        .update(updateData)
        .eq('id', editingScript.id);

      if (error) {
        console.error('Erro ao salvar script:', error);
        // Mensagens descritivas para erros de validação de categoria/subcategoria
        if (error.message?.includes('subcategoria_gse_slug não pode ser definido sem categoria_equipe_slug')) {
          toast.error('Por favor, selecione a Categoria correspondente à Subcategoria escolhida.');
        } else if (error.message?.toLowerCase().includes('subcategoria') && error.message?.toLowerCase().includes('inválida')) {
          toast.error('A Subcategoria selecionada não pertence à Categoria escolhida.');
        } else if (error.message?.toLowerCase().includes('categoria') && error.message?.toLowerCase().includes('inválida')) {
          toast.error('A Categoria selecionada é inválida para o domínio do script.');
        } else {
          toast.error('Erro ao salvar script');
        }
      } else {
        toast.success('Script salvo com sucesso');
        setEditingScript(null);
        setEditingContent('');
        fetchScripts();
        // Atualizar mapa de autores (nome/e-mail de login)
        fetchAutoresMap();
      }
    }
  };

  // Handler para confirmar classificação de edição na revisão inicial (ClassificarEdicaoCuradoriaModal)
  const handleClassificarEdicaoConfirm = async (tipo: 'correcao_grafia' | 'substantiva' | 'atualizacao_normativa' | 'outro', motivacao: string) => {
    try {
      if (classifContexto === 'revisao_inicial') {
        // Revisão inicial: mapear tipo para o que a RPC espera
        const tipoAlteracao: 'correcao_menor' | 'substantiva' = tipo === 'correcao_grafia' ? 'correcao_menor' : 'substantiva';
        await revisarScriptInicial(classifScriptId, classifCampoAlvo, classifConteudo, tipoAlteracao, motivacao);

        // Notificar autor original sobre a revisão inicial
        if (classifScriptCriadoPor && classifScriptCriadoPor !== user?.id) {
          try {
            const tipoMsg = tipo === 'correcao_grafia' ? 'com correção menor' : 'com alteração substantiva';
            await criarNotificacao(
              classifScriptCriadoPor,
              classifScriptId,
              'curadoria_inicial',
              `Seu script "${classifScriptNome}" foi revisado pela Curadoria (${tipoMsg}).`,
              undefined,
              {
                campo_alvo: classifCampoAlvo,
                tipo_motivacao: tipo,
                motivacao: motivacao,
                curador_id: user?.id || '',
              }
            );
          } catch (e) {
            console.warn('Erro ao criar notificação de revisão inicial (não crítico):', e);
          }
        }

        // Verificar se tem proposta pendente — notificar autor da proposta
        try {
          const propostaPendente = await buscarPropostaAtiva(classifScriptId);
          if (propostaPendente && propostaPendente.autor_id !== user?.id) {
            await criarNotificacao(
              propostaPendente.autor_id,
              classifScriptId,
              'script_revisado_com_proposta_pendente',
              `O script "${classifScriptNome}" foi revisado pela Curadoria. Sua proposta pendente pode ser afetada.`,
              propostaPendente.id
            );
          }
        } catch (e) {
          console.warn('Erro ao verificar proposta pendente (não crítico):', e);
        }

        const tipoLabel = tipo === 'correcao_grafia' ? 'correção menor' : 'alteração substantiva';
        toast.success(`Revisão inicial classificada como ${tipoLabel}`);
      } else {
        // Edição posterior: chamar criarVersaoCuradoria com tipo classificado
        await criarVersaoCuradoria(classifScriptId, classifCampoAlvo, classifConteudo, motivacao, tipo);

        // Notificar autor original
        if (classifScriptCriadoPor && classifScriptCriadoPor !== user?.id) {
          try {
            await criarNotificacao(
              classifScriptCriadoPor,
              classifScriptId,
              'nova_versao_curadoria',
              `A Curadoria criou uma nova versão do script "${classifScriptNome}".`,
              undefined,
              {
                campo_alvo: classifCampoAlvo,
                tipo_motivacao: tipo,
                motivacao: motivacao,
                curador_id: user?.id || '',
              }
            );
          } catch (e) {
            console.warn('Erro ao criar notificação de edição curadoria (não crítico):', e);
          }
        }

        toast.success('Edição da curadoria registrada com sucesso');
      }

      // Persistir nome do script + categoria/subcategoria (RPCs de classificação não atualizam esses campos)
      // Permite alterar título + categoria + subcategoria + conteúdo na mesma sessão da curadoria.
      const updateMeta: Record<string, unknown> = {};
      if (classifScriptNome && classifScriptNome.trim()) {
        updateMeta.nome = classifScriptNome.trim();
      }
      if (classifCategoriaEquipeSlug !== undefined) {
        updateMeta.categoria_equipe_slug = classifCategoriaEquipeSlug || null;
        updateMeta.subcategoria_gse_slug = classifSubcategoriaGseSlug || null;
        if (classifCategoriaEquipeSlug) {
          updateMeta.classificacao_origem = 'manual';
          updateMeta.classificacao_em = new Date().toISOString();
          updateMeta.classificacao_por = user?.id;
          updateMeta.classificacao_pendente = false;
        }
      }
      if (classifInstancia !== undefined) {
        updateMeta.instancia = classifInstancia || null;
      }
      if (Object.keys(updateMeta).length > 0) {
        const { error: metaError } = await supabase
          .from('scripts_customizados')
          .update(updateMeta)
          .eq('id', classifScriptId);
        if (metaError) {
          console.error('Erro ao atualizar metadados do script:', metaError);
          // Mensagem específica conforme o campo problemático
          if (metaError.message?.includes('subcategoria_gse_slug não pode ser definido sem categoria_equipe_slug')) {
            toast.error('Por favor, selecione a Categoria correspondente à Subcategoria escolhida.');
          } else if (metaError.message?.toLowerCase().includes('subcategoria') && metaError.message?.toLowerCase().includes('inválida')) {
            toast.error('A Subcategoria selecionada não pertence à Categoria escolhida.');
          } else if (metaError.message?.toLowerCase().includes('categoria') && metaError.message?.toLowerCase().includes('inválida')) {
            toast.error('A Categoria selecionada é inválida para o domínio do script.');
          } else {
            toast.error('Conteúdo salvo, mas erro ao atualizar título/categoria do script');
          }
        }
      }

      fetchScripts();
    } catch (e) {
      console.error('Erro ao classificar edição:', e);
      toast.error('Erro ao classificar edição');
    } finally {
      setShowClassificarEdicaoModal(false);
      setClassifConteudo('');
      setClassifScriptId('');
      setClassifScriptCriadoPor(null);
      setClassifScriptNome('');
      setClassifContexto('revisao_inicial');
      setClassifCategoriaEquipeSlug(undefined);
      setClassifSubcategoriaGseSlug(undefined);
      setClassifInstancia(undefined);
      // Fechar editor após fluxo completo (curadoria → classificação)
      setEditingScript(null);
      setEditingContent('');
    }
  };

  // Função para salvar pergunta e número do chamado
  const savePergunta = async (scriptId: string, pergunta: string, numeroChamado: string) => {
    const { error } = await supabase
      .from('scripts_customizados')
      .update({
        pergunta: pergunta.trim() || null,
        numero_chamado: numeroChamado.trim() || null,
      })
      .eq('id', scriptId);

    if (error) {
      toast.error('Erro ao salvar pergunta');
      throw error;
    }

    toast.success('Pergunta salva com sucesso');
    fetchScripts();
  };

  // Função para toggle de curadoria
  const toggleCuradoria = async (scriptId: string, currentValue: boolean) => {
    // Bloquear toggle se há proposta de revisão pendente
    const scriptAlvo = scripts.find(s => s.id === scriptId);
    if (scriptAlvo?.tem_proposta_pendente) {
      toast.info('Há uma proposta de revisão pendente para este script. Resolva-a antes de alterar o status de curadoria.');
      return;
    }
    // Se está desmarcando (já revisado -> não revisado), faz direto
    if (currentValue) {
      const { error } = await supabase
        .from('scripts_customizados')
        .update({ curadoria_atuada: false, curadoria_por: null, data_curadoria: null })
        .eq('id', scriptId);

      if (error) {
        toast.error('Erro ao atualizar status');
      } else {
        toast.success('Marcado como não revisado');
        fetchScripts();
      }
      return;
    }

    const script = scripts.find(s => s.id === scriptId);
    if (script) {
      await marcarCuradoriaRevisada(script);
    }
  };

  const marcarCuradoriaRevisada = async (script: ScriptItem) => {
    const { error } = await supabase
      .from('scripts_customizados')
      .update({ curadoria_atuada: true, curadoria_por: user?.id || null, data_curadoria: new Date().toISOString() })
      .eq('id', script.id);

    if (error) {
      toast.error('Erro ao atualizar status');
      return;
    }

    toast.success('Script marcado como revisado pela curadoria');
    try {
      await supabase.rpc('registrar_revisor_v1', { p_script_id: script.id });
    } catch (e) {
      console.warn('Erro ao registrar revisor em V1 (não crítico):', e);
    }
    if (script.criado_por && script.criado_por !== user?.id) {
      try {
        await criarNotificacao(
          script.criado_por,
          script.id,
          'curadoria_inicial',
          `Seu script "${script.nome}" foi revisado pela Curadoria.`
        );
      } catch (e) {
        console.warn('Erro ao criar notificação (não crítico):', e);
      }
    }
    fetchScripts();
  };

  // Handler: Curador aceita contestação → reverte conteúdo e reseta revisão
  const handleAceitarContestacao = async () => {
    if (!contestacaoData) return;
    try {
      // RPC reverte conteúdo para V1, deleta V2+ e reseta curadoria
      await aceitarContestacaoScript(
        contestacaoData.scriptId,
        contestacaoData.campoAlvo === 'atendente' ? 'atendente' : 'usuario_final'
      );

      // Notificar autor que contestação foi aceita (tipo proposta_aprovada abre GeradorModal ao clicar)
      const scriptAlvo = scripts.find(s => s.id === contestacaoData.scriptId);
      const autorId = scriptAlvo?.criado_por;
      if (autorId && autorId !== user?.id) {
        try {
          await criarNotificacao(
            autorId,
            contestacaoData.scriptId,
            'proposta_aprovada',
            `Sua contestação ao script "${contestacaoData.scriptNome}" foi aceita. O texto original foi restaurado.`
          );
        } catch (e) {
          console.warn('Erro ao notificar autor (não crítico):', e);
        }
      }

      toast.success('Contestação aceita. Conteúdo revertido ao original.');
      fetchScripts();
    } catch (e) {
      console.error('Erro ao aceitar contestação:', e);
      toast.error('Erro ao processar contestação');
    }
    await finalizarNotificacaoPendente();
    setShowAnalisarContestacaoModal(false);
    setContestacaoData(null);
  };

  // Handler: Curador quer editar novamente → reverte para V1, deleta V2+, abre editor
  const handleEditarNovamenteContestacao = async () => {
    if (!contestacaoData) return;
    try {
      const campoAlvo = contestacaoData.campoAlvo === 'atendente' ? 'atendente' : 'usuario_final';

      // Reverter conteúdo para V1, deletar V2+ e resetar curadoria (reutiliza RPC)
      await aceitarContestacaoScript(contestacaoData.scriptId, campoAlvo);

      // Recarregar scripts para pegar conteúdo V1 atualizado
      await fetchScripts();

      // Buscar script atualizado do banco (com conteúdo V1)
      const { data: scriptAtualizado } = await supabase
        .from('scripts_customizados')
        .select('*')
        .eq('id', contestacaoData.scriptId)
        .single();

      if (scriptAtualizado) {
        await finalizarNotificacaoPendente();
        setShowAnalisarContestacaoModal(false);
        setContestacaoData(null);
        const mode = campoAlvo as 'usuario_final' | 'atendente';
        await openScriptEditor(scriptAtualizado as ScriptItem, mode);
      }
    } catch (e) {
      console.error('Erro ao preparar edição:', e);
      toast.error('Erro ao abrir editor');
    }
  };

  // Função para mover script
  const handleMoveScript = (scriptId: string) => {
    setScriptToMove(scriptId);
    setShowMoveModal(true);
  };

  const moveScriptToFolder = async (folderId: string | null) => {
    if (!scriptToMove) return;
    
    // Determinar equipe_id baseado na pasta de destino
    let equipeId = 'GERAL'; // Padrão para raiz
    if (folderId) {
      const pastaDestino = folders.find(f => f.id === folderId);
      if (pastaDestino) {
        equipeId = pastaDestino.equipe_id;
      }
    }
    
    const { error } = await supabase
      .from('scripts_customizados')
      .update({ pasta_id: folderId, equipe_id: equipeId })
      .eq('id', scriptToMove);

    if (error) {
      toast.error('Erro ao mover script');
    } else {
      toast.success('Script movido com sucesso');
      setScriptToMove(null);
      setShowMoveModal(false);
      fetchScripts();
    }
  };

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: any) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Verificar se está sendo arrastado para uma pasta
    if (over.id.toString().startsWith('folder-') || over.id === 'root-folder') {
      const scriptId = active.id;
      const folderId = over.id === 'root-folder' ? null : over.id.toString().replace('folder-', '');
      
      // Determinar equipe_id baseado na pasta de destino
      let equipeId = 'GERAL'; // Padrão para raiz
      if (folderId) {
        const pastaDestino = folders.find(f => f.id === folderId);
        if (pastaDestino) {
          equipeId = pastaDestino.equipe_id;
        }
      }
      
      const { error } = await supabase
        .from('scripts_customizados')
        .update({ pasta_id: folderId, equipe_id: equipeId })
        .eq('id', scriptId);

      if (error) {
        toast.error('Erro ao mover script');
      } else {
        const scriptName = scripts.find(s => s.id === scriptId)?.nome || 'Script';
        const folderName = folderId 
          ? folders.find(f => f.id === folderId)?.nome || 'Pasta'
          : 'Scripts (sem pasta)';
        toast.success(`"${scriptName}" movido para "${folderName}"`);
        fetchScripts();
      }
      return;
    }

    // Reordenação dentro da mesma pasta (comportamento original)
    const oldIndex = filteredScripts.findIndex(s => s.id === active.id);
    const newIndex = filteredScripts.findIndex(s => s.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reordered = arrayMove(filteredScripts, oldIndex, newIndex);

    const updates = reordered.map((script, index) =>
      supabase.from('scripts_customizados').update({ ordem: index }).eq('id', script.id)
    );
    await Promise.all(updates);

    const scriptNome = scripts.find(s => s.id === active.id)?.nome || 'Script';
    toast.success(`"${scriptNome}" movido para a posição ${newIndex + 1}.`);
    fetchScripts();
  };

  const handleDelete = async (id: string) => {
    const script = scripts.find(s => s.id === id);
    if (!script) return;

    if (script.exclusao_pendente && !script.deletado) {
      if (canToggleCuradoria) {
        setScriptToAprovarExclusao(script);
        setShowAprovarExclusaoModal(true);
        return;
      }
      toast.info('Este script já possui uma solicitação de exclusão pendente.');
      return;
    }

    // Abrir modal de confirmação (tipo será determinado dentro do modal)
    setScriptToDelete(script);
    setShowDeleteScriptModal(true);
  };

  const handleAprovarExclusaoScript = async () => {
    if (!scriptToAprovarExclusao) return;

    setIsProcessingAprovarExclusao(true);
    try {
      const { sucesso, mensagem } = await aprovarNegarExclusao(scriptToAprovarExclusao.id, true);
      if (sucesso) {
        await arquivarNotificacaoExclusao(scriptToAprovarExclusao.id);
        toast.success(`Script "${scriptToAprovarExclusao.nome}" desativado com sucesso`);
        fetchScripts();
        setShowAprovarExclusaoModal(false);
        setScriptToAprovarExclusao(null);
      } else {
        toast.error(mensagem || 'Erro ao aprovar exclusão');
      }
    } catch (error) {
      console.error('Erro ao aprovar exclusão:', error);
      toast.error('Erro ao aprovar exclusão');
    } finally {
      setIsProcessingAprovarExclusao(false);
    }
  };

  const handleNegarExclusaoScript = async () => {
    if (!scriptToAprovarExclusao) return;

    setIsProcessingAprovarExclusao(true);
    try {
      const { sucesso, mensagem } = await aprovarNegarExclusao(
        scriptToAprovarExclusao.id,
        false,
        'Negado pela curadoria',
      );
      if (sucesso) {
        await arquivarNotificacaoExclusao(scriptToAprovarExclusao.id);
        toast.info('Solicitação de exclusão negada');
        fetchScripts();
        setShowAprovarExclusaoModal(false);
        setScriptToAprovarExclusao(null);
      } else {
        toast.error(mensagem || 'Erro ao negar exclusão');
      }
    } catch (error) {
      console.error('Erro ao negar exclusão:', error);
      toast.error('Erro ao negar exclusão');
    } finally {
      setIsProcessingAprovarExclusao(false);
    }
  };

  // Handler para confirmar exclusão (chamado pelo modal)
  const handleConfirmarExclusao = async (motivo?: string) => {
    if (!scriptToDelete) return;

    setIsDeleting(true);
    try {
      const resultado = await solicitarExclusaoScript(scriptToDelete.id, motivo);

      if (resultado.sucesso) {
        if (resultado.tipoExclusao === 'hard') {
          toast.success('Script excluído com sucesso!');
        } else {
          toast.info('Solicitação de exclusão enviada. Aguardando aprovação da curadoria.');
        }
        fetchScripts();
      } else {
        toast.error(resultado.mensagem || 'Erro ao processar exclusão');
      }
    } catch (error) {
      console.error('Erro ao excluir script:', error);
      toast.error('Erro ao processar exclusão');
    } finally {
      setIsDeleting(false);
      setShowDeleteScriptModal(false);
      setScriptToDelete(null);
    }
  };

  // Handler para reativar script desativado
  const handleReativar = async (scriptId: string) => {
    const script = scripts.find(s => s.id === scriptId);
    if (!script) return;

    try {
      const resultado = await reativarScript(scriptId);

      if (resultado.sucesso) {
        toast.success('Script reativado com sucesso!');
        fetchScripts();
        // Se estava na pasta Desativados, voltar para a raiz ou pasta restaurada
        if (resultado.pastaId) {
          setSelectedFolderId(resultado.pastaId);
        } else {
          setSelectedFolderId(null); // Voltar para raiz
        }
      } else {
        toast.error(resultado.mensagem || 'Erro ao reativar script');
      }
    } catch (error) {
      console.error('Erro ao reativar script:', error);
      toast.error('Erro ao reativar script');
    }
  };

  const handleExportarDocumento = async (script: ScriptItem) => {
    try {
      let conteudo = script.conteudo_bruto;
      if (!conteudo) {
        const { data } = await supabase
          .from('scripts_customizados')
          .select('conteudo_bruto')
          .eq('id', script.id)
          .single();
        conteudo = data?.conteudo_bruto || '';
      }

      await exportarScriptComoHtml({
        nome: script.nome,
        conteudo_bruto: conteudo ?? '',
        numero_referencia: script.numero_referencia,
        categoria_slug: script.categoria_equipe_slug,
        pergunta: script.pergunta,
        tipo_requisitante: script.tipo_requisitante,
      });

      toast.success('Documento exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar documento:', error);
      toast.error('Erro ao exportar documento.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const nome = file.name.replace(/\.txt$/, '');
      
      // Buscar equipe_id da pasta selecionada ou do localStorage
      let equipeId = localStorage.getItem("equipeId");
      
      if (selectedFolderId) {
        const pastaAtual = folders.find(f => f.id === selectedFolderId);
        if (pastaAtual && pastaAtual.equipe_id) {
          equipeId = pastaAtual.equipe_id;
        }
      }

      // Se não tiver equipeId, não criar o script
      if (!equipeId) {
        toast.error('Erro: Equipe não identificada. Faça login novamente.');
        setUploading(false);
        return;
      }

      const { error } = await supabase.from('scripts_customizados').insert({
        nome,
        conteudo_bruto: text,
        equipe_id: equipeId,
        pasta_id: selectedFolderId,
        instancia: inferirInstanciaPorEquipe(equipeId),
        criado_por: user?.id,
        equipe_autor_id: equipeId
      });

      if (error) {
        toast.error('Erro ao salvar script');
      } else {
        toast.success('Script criado com sucesso');
        fetchScripts();
      }
    } catch (err) {
      toast.error('Erro ao ler o arquivo');
    } finally {
      setUploading(false);
    }
  };

  return {
    // Auth
    user, equipeId,
    // Core state
    scripts, setScripts, uploading, filteredScripts,
    // Search & filter state
    busca, setBusca, executarBuscaSemantica, buscaReferencia, setBuscaReferencia,
    semanticLoading, semanticError,
    semanticActive: !!semanticMatches && busca.trim().toLowerCase() === semanticSubmittedTerm && busca.trim().length >= 3,
    semanticCount: (semanticMatches && busca.trim().toLowerCase() === semanticSubmittedTerm && busca.trim().length >= 3)
      ? semanticMatches.size
      : 0,
    buscaAutor, setBuscaAutor, showAutorSuggestions, setShowAutorSuggestions, sugestoesAutor,
    filtroEquipeId, setFiltroEquipeId, equipesDisponiveis,
    filtroTipo, setFiltroTipo, filtroAtendente, setFiltroAtendente,
    filtroTipoRequisitante, setFiltroTipoRequisitante, tiposRequisitanteDisponiveis,
    filtroInstancia, setFiltroInstancia,
    filtroCategoria, setFiltroCategoria, filtroSubcategoria, setFiltroSubcategoria,
    filtroDominio, setFiltroDominio,
    categoriasDisponiveis, subcategoriasDisponiveis, contagemPorCategoria, contagemPorSubcategoria,
    filtroN1, setFiltroN1, filtroValidacaoEnvio, setFiltroValidacaoEnvio,
    filtroCuradoria, setFiltroCuradoria, ordenacaoData, setOrdenacaoData,
    showFiltrosPanel, setShowFiltrosPanel, viewMode, setViewMode,
    // Counts
    countCuradoria, countCuradoriaTotal, countTemporarios, countComAtendente,
    countNaoRevisadosLabel, countRevisadosLabel, countRevisaoSolicitadaLabel, countExclusaoSolicitadaLabel,
    // Folder state
    folders, folderHierarchy, foldersLoading,
    selectedFolderId, setSelectedFolderId,
    scriptsWithoutFolder, scriptCountByFolder,
    showCreateFolderModal, setShowCreateFolderModal, newFolderName, setNewFolderName, newFolderIcon, setNewFolderIcon,
    showEditFolderModal, setShowEditFolderModal, editFolderId, editFolderName, setEditFolderName, editFolderIcon, setEditFolderIcon,
    showMoveModal, setShowMoveModal, showDeleteFolderModal, setShowDeleteFolderModal,
    folderToDelete, setFolderToDelete,
    // Script selection & editing
    selectedScriptId, setSelectedScriptId,
    editingScriptId, editingTitle, setEditingTitle,
    editingScript, setEditingScript, editorKey, setEditorKey, editMode, setEditMode, setEditingContent, isCreatingNew,
    // DnD
    sensors, activeId, handleDragStart, handleDragEnd,
    // Script handlers
    startEditScript, saveEditScript, cancelEditScript,
    openScriptEditor, closeScriptEditor, createScriptDirect,
    saveScript, savePergunta,
    handleOpenGerador, handleMoveScript, moveScriptToFolder,
    handleDelete, handleConfirmarExclusao, handleReativar,
    handleExportarDocumento, handleFileUpload,
    // Folder handlers
    handleOpenCreateFolderModal, handleConfirmFolderLocation, handleCreateFolder,
    handleOpenEditFolder, handleEditFolder, handleDeleteFolder, confirmDeleteFolder,
    // Publicação
    showOrientacaoPosSalvarModal, setShowOrientacaoPosSalvarModal, orientacaoScriptNome,
    showConfirmPublicarModal, setShowConfirmPublicarModal,
    scriptForPublicar, setScriptForPublicar, publicarLoading,
    openPublicarModal, handleConfirmPublicar,
    // Curadoria state & handlers
    showCuradoriaControls, canToggleCuradoria, isEquipe21OuAdmin,
    toggleCuradoria,
    showClassificarEdicaoModal, setShowClassificarEdicaoModal, handleClassificarEdicaoConfirm, classifContexto,
    // Proposal state
    showAnalisarPropostaModal, setShowAnalisarPropostaModal,
    propostaParaAnalisar, setPropostaParaAnalisar,
    scriptParaAnalisarProposta, setScriptParaAnalisarProposta,
    autorPropostaNome, setAutorPropostaNome,
    showPropostaRejeitadaModal, setShowPropostaRejeitadaModal,
    propostaRejeitada, setPropostaRejeitada, scriptNomeRejeitada,
    showPropostaMotivacaoModal, setShowPropostaMotivacaoModal,
    propostaScriptId, setPropostaScriptId, propostaScriptNome, setPropostaScriptNome,
    propostaCampoAlvo, setPropostaCampoAlvo, propostaConteudo, setPropostaConteudo,
    propostaIdParaReenvio, setPropostaIdParaReenvio, propostaCuradorAnteriorId, setPropostaCuradorAnteriorId,
    modoPropostaAtivo, setModoPropostaAtivo, propostaPendenteInfo, setPropostaPendenteInfo,
    // Revision state
    showRevisarCuradoriaModal, setShowRevisarCuradoriaModal, revisarCuradoriaData, setRevisarCuradoriaData,
    showAnalisarContestacaoModal, setShowAnalisarContestacaoModal, contestacaoData, setContestacaoData,
    handleAceitarContestacao, handleEditarNovamenteContestacao,
    // History & delete state
    showHistoricoVersoesModal, setShowHistoricoVersoesModal, historicoScriptId, setHistoricoScriptId, historicoScriptNome, setHistoricoScriptNome,
    showDeleteScriptModal, setShowDeleteScriptModal, scriptToDelete, setScriptToDelete, isDeleting,
    showAprovarExclusaoModal, setShowAprovarExclusaoModal,
    scriptToAprovarExclusao, setScriptToAprovarExclusao,
    isProcessingAprovarExclusao,
    handleAprovarExclusaoScript, handleNegarExclusaoScript,
    // Location modals
    showConfirmScriptLocationModal, setShowConfirmScriptLocationModal,
    showConfirmFolderLocationModal, setShowConfirmFolderLocationModal,
    handleConfirmScriptLocation,
    // Edit type
    showEditTypeModal, setShowEditTypeModal, pendingEditScript, setPendingEditScript,
    showNewScriptEditTypeModal, setShowNewScriptEditTypeModal, handleNewScriptEditTypeSelect,
    pendingNewScriptLocationId, finalizarNotificacaoPendente,
    // Help & UI
    showHelpModal, setShowHelpModal,
    // Misc computed
    canViewDesativados, isPastaDesativadosSelected,
    scriptsComReferencia, autoresMap, versoesMap, fetchScripts,
    usuariosParaEditor, desativadosFolderIds, mainDesativadosFolderId,
    // DnD
    converterParaBrasilia,
  };
}

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useEffectiveAuth } from './useEffectiveAuth';
import {
  isAdmin,
  listarSetores,
  criarSetor,
  editarSetor,
  deletarSetor,
  listarEquipes,
  criarEquipe,
  editarEquipe,
  deletarEquipe,
  listarUsuarios,
  criarUsuario,
  editarUsuario,
  deletarUsuario,
  resetarSenhaUsuario,
  toggleUsuarioAtivoComBan,
  listarGSEs,
  SetorWithCount,
  EquipeWithSetor,
  UserWithStatus,
  GSEWithEquipe,
  CreateUserData,
  UpdateUserData,
  UsuarioCriadoData,
} from '../services/adminService';

// =====================================================
// TIPOS
// =====================================================

export type TabType = 'setores' | 'equipes' | 'usuarios' | 'permissoes';

export interface UseBossOnlyModalParams {
  isOpen: boolean;
  onClose: () => void;
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export const useBossOnlyModal = ({ isOpen, onClose }: UseBossOnlyModalParams) => {
  const { userRole } = useEffectiveAuth();
  const isAdminUser = isAdmin(userRole);

  // Estados principais
  const [activeTab, setActiveTab] = useState<TabType>('setores');
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');

  // Dados
  const [setores, setSetores] = useState<SetorWithCount[]>([]);
  const [equipes, setEquipes] = useState<EquipeWithSetor[]>([]);
  const [usuarios, setUsuarios] = useState<UserWithStatus[]>([]);
  const [gses, setGSEs] = useState<GSEWithEquipe[]>([]);
  // Filtros
  const [filtroSetor, setFiltroSetor] = useState<string>('');
  const [filtroEquipe, setFiltroEquipe] = useState<string>('');
  const [filtroRole, setFiltroRole] = useState<string>('');
  const [filtroAtivo, setFiltroAtivo] = useState<string>('');

  // Modal de formulario
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formLoading, setFormLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Campos do formulario
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSenha, setFormSenha] = useState('');
  const [formRole, setFormRole] = useState<'user' | 'supervisor' | 'coordenador' | 'admin'>('user');
  const [formSetorId, setFormSetorId] = useState('');
  const [formEquipeId, setFormEquipeId] = useState('');
  const [formSupervisorEquipeIds, setFormSupervisorEquipeIds] = useState<string[]>([]);
  const [formGSE, setFormGSE] = useState('');
  /** Evita autofill do navegador (login) no formulário de novo usuário */
  const [blockUserFormAutofill, setBlockUserFormAutofill] = useState(true);

  // Modal de confirmacao de exclusao
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: string; nome: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Modal de reset de senha
  const [showResetSenhaModal, setShowResetSenhaModal] = useState(false);
  const [resetSenhaUserId, setResetSenhaUserId] = useState('');
  const [novaSenha, setNovaSenha] = useState('');

  const [showUsuarioCriadoModal, setShowUsuarioCriadoModal] = useState(false);
  const [usuarioCriado, setUsuarioCriado] = useState<UsuarioCriadoData | null>(null);

  // =====================================================
  // CARREGAMENTO DE DADOS
  // =====================================================

  const carregarSetores = useCallback(async () => {
    try {
      const data = await listarSetores();
      setSetores(data);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
      toast.error('Erro ao carregar setores');
    }
  }, []);

  const carregarEquipes = useCallback(async () => {
    try {
      const data = await listarEquipes(filtroSetor || undefined);
      setEquipes(data);
    } catch (error) {
      console.error('Erro ao carregar equipes:', error);
      toast.error('Erro ao carregar equipes');
    }
  }, [filtroSetor]);

  const carregarUsuarios = useCallback(async () => {
    try {
      const data = await listarUsuarios({
        setorId: filtroSetor || undefined,
        equipeId: filtroEquipe || undefined,
        role: filtroRole || undefined,
        ativo: filtroAtivo === '' ? undefined : filtroAtivo === 'true'
      });
      setUsuarios(data);
    } catch (error) {
      console.error('Erro ao carregar usuarios:', error);
      toast.error('Erro ao carregar usuarios');
    }
  }, [filtroSetor, filtroEquipe, filtroRole, filtroAtivo]);

  const carregarGSEs = useCallback(async () => {
    try {
      const data = await listarGSEs(filtroEquipe || undefined);
      setGSEs(data);
    } catch (error) {
      console.error('Erro ao carregar GSEs:', error);
      toast.error('Erro ao carregar GSEs');
    }
  }, [filtroEquipe]);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      // Sempre carregar setores para os selects
      await carregarSetores();

      switch (activeTab) {
        case 'setores':
          // ja carregou acima
          break;
        case 'equipes':
          await carregarEquipes();
          break;
        case 'usuarios':
          await carregarEquipes(); // para o filtro
          await carregarUsuarios();
          break;
        case 'permissoes':
          await carregarEquipes();
          await carregarUsuarios();
          break;
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, carregarSetores, carregarEquipes, carregarUsuarios, carregarGSEs]);

  useEffect(() => {
    if (isOpen) {
      carregarDados();
    } else {
      // Limpar dados grandes ao fechar modal (prevenir memory leak)
      setSetores([]);
      setEquipes([]);
      setUsuarios([]);
      setGSEs([]);
    }
  }, [isOpen, carregarDados]);

  // Recarregar quando filtros mudam
  useEffect(() => {
    if (isOpen && activeTab === 'equipes') {
      carregarEquipes();
    }
  }, [isOpen, activeTab, filtroSetor, carregarEquipes]);

  useEffect(() => {
    if (isOpen && activeTab === 'usuarios') {
      carregarUsuarios();
    }
  }, [isOpen, activeTab, filtroSetor, filtroEquipe, filtroRole, filtroAtivo, carregarUsuarios]);

  // =====================================================
  // HANDLERS DE FORMULARIO
  // =====================================================

  const limparFormulario = () => {
    setFormNome('');
    setFormEmail('');
    setFormSenha('');
    setFormRole('user');
    setFormSetorId('');
    setFormEquipeId('');
    setFormSupervisorEquipeIds([]);
    setFormGSE('');
    setEditingItem(null);
    setBlockUserFormAutofill(true);
  };

  const abrirFormularioCriacao = () => {
    setFormMode('create');
    limparFormulario();
    setBlockUserFormAutofill(true);
    setShowFormModal(true);
  };

  const abrirFormularioEdicao = (item: any) => {
    setFormMode('edit');
    setEditingItem(item);

    switch (activeTab) {
      case 'setores':
        setFormNome(item.nome);
        break;
      case 'equipes':
        setFormNome(item.nome);
        setFormSetorId(item.setor_id);
        break;
      case 'usuarios':
        setFormNome(item.nome || '');
        setFormEmail(item.email);
        setFormRole(item.role);
        setFormEquipeId(item.equipe_id || '');
        setFormSetorId(item.setor_id || '');
        setFormSupervisorEquipeIds(item.supervisor_equipe_ids || []);
        break;
    }

    setShowFormModal(true);
  };

  const handleFormSubmit = async () => {
    setFormLoading(true);
    try {
      let result;

      switch (activeTab) {
        case 'setores':
          if (formMode === 'create') {
            result = await criarSetor(formNome);
          } else {
            result = await editarSetor(editingItem.id, formNome);
          }
          break;

        case 'equipes':
          if (formMode === 'create') {
            result = await criarEquipe(formNome, formSetorId);
          } else {
            result = await editarEquipe(editingItem.id, formNome, formSetorId);
          }
          break;

        case 'usuarios':
          if (formMode === 'create') {
            const canManageSupervisorEquipes = formRole === 'admin' || formRole === 'supervisor';
            const dados: CreateUserData = {
              email: formEmail,
              senha: formSenha,
              nome: formNome,
              role: formRole,
              equipe_id: formEquipeId || null,
              setor_id: formSetorId || null,
              supervisor_equipe_ids: canManageSupervisorEquipes ? formSupervisorEquipeIds : []
            };
            result = await criarUsuario(dados);
            
            if (result?.success && result.senha) {
              const equipeSelecionada = equipes.find(e => e.id === formEquipeId);
              const setorSelecionado = setores.find(s => s.id === formSetorId);

              setUsuarioCriado({
                nome: formNome,
                email: formEmail,
                senha: result.senha,
                role: formRole,
                setor_nome: setorSelecionado?.nome,
                equipe_nome: equipeSelecionada?.nome,
              });
              setShowUsuarioCriadoModal(true);
              setShowFormModal(false);
              limparFormulario();
              carregarDados();
              return;
            }
          } else {
            const canManageSupervisorEquipes = formRole === 'admin' || formRole === 'supervisor';
            const dados: UpdateUserData = {
              nome: formNome,
              role: formRole,
              equipe_id: formEquipeId || null,
              setor_id: formSetorId || null,
              supervisor_equipe_ids: canManageSupervisorEquipes ? formSupervisorEquipeIds : []
            };
            result = await editarUsuario(editingItem.id, dados);
          }
          break;

      }

      if (result?.success) {
        toast.success(result.message || 'Operacao realizada com sucesso!');
        setShowFormModal(false);
        limparFormulario();
        carregarDados();
      } else {
        toast.error(result?.error || 'Erro ao realizar operacao');
      }
    } catch (error) {
      console.error('Erro no formulario:', error);
      toast.error('Erro ao processar formulario');
    } finally {
      setFormLoading(false);
    }
  };

  // =====================================================
  // HANDLERS DE EXCLUSAO
  // =====================================================

  const confirmarExclusao = (id: string, nome: string) => {
    setDeleteItem({ id, nome });
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;

    setDeleteLoading(true);
    try {
      let result;

      switch (activeTab) {
        case 'setores':
          result = await deletarSetor(deleteItem.id);
          break;
        case 'equipes':
          result = await deletarEquipe(deleteItem.id);
          break;
        case 'usuarios':
          result = await deletarUsuario(deleteItem.id);
          break;
      }

      if (result?.success) {
        toast.success(result.message || 'Excluido com sucesso!');
        setShowDeleteModal(false);
        setDeleteItem(null);
        carregarDados();
      } else {
        toast.error(result?.error || 'Erro ao excluir');
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir');
    } finally {
      setDeleteLoading(false);
    }
  };

  // =====================================================
  // HANDLERS DE USUARIO
  // =====================================================

  const handleResetSenha = async () => {
    if (!resetSenhaUserId || !novaSenha) return;

    setFormLoading(true);
    try {
      const result = await resetarSenhaUsuario(resetSenhaUserId, novaSenha);
      if (result?.success) {
        toast.success('Senha alterada com sucesso!');
        setShowResetSenhaModal(false);
        setResetSenhaUserId('');
        setNovaSenha('');
      } else {
        toast.error(result?.error || 'Erro ao resetar senha');
      }
    } catch (error) {
      console.error('Erro ao resetar senha:', error);
      toast.error('Erro ao resetar senha');
    } finally {
      setFormLoading(false);
    }
  };

  // =====================================================
  // FILTRO DE BUSCA
  // =====================================================

  const filtrarPorBusca = <T extends { nome?: string; email?: string; gse?: string }>(items: T[]): T[] => {
    if (!busca.trim()) return items;
    const termo = busca.toLowerCase();
    return items.filter(item =>
      item.nome?.toLowerCase().includes(termo) ||
      item.email?.toLowerCase().includes(termo) ||
      item.gse?.toLowerCase().includes(termo)
    );
  };

  const handleToggleAtivo = async (usuarioId: string, usuarioNome: string, ativo?: boolean) => {
    const acao = ativo !== false ? 'desativar' : 'reativar';
    const confirmado = window.confirm(`Tem certeza que deseja ${acao} o usuário ${usuarioNome}?`);
    if (!confirmado) return;

    try {
      const result = await toggleUsuarioAtivoComBan(usuarioId);
      if (result.success) {
        toast.success(`Usuário ${usuarioNome} ${ativo !== false ? 'desativado' : 'reativado'} com sucesso`);
        carregarDados();
      } else {
        toast.error(result.error || `Erro ao ${acao} usuário`);
      }
    } catch (error) {
      console.error(`Erro ao ${acao} usuário:`, error);
      toast.error(`Erro ao ${acao} usuário`);
    }
  };

  return {
    // Auth
    isAdminUser, onClose,
    // State
    activeTab, setActiveTab,
    loading, busca, setBusca,
    setores, equipes, usuarios, gses,
    // Filtros
    filtroSetor, setFiltroSetor,
    filtroEquipe, setFiltroEquipe,
    filtroRole, setFiltroRole,
    filtroAtivo, setFiltroAtivo,
    // Form
    showFormModal, setShowFormModal,
    formMode, formLoading, editingItem,
    formNome, setFormNome,
    formEmail, setFormEmail,
    formSenha, setFormSenha,
    formRole, setFormRole,
    formSetorId, setFormSetorId,
    formEquipeId, setFormEquipeId,
    formSupervisorEquipeIds, setFormSupervisorEquipeIds,
    formGSE, setFormGSE,
    blockUserFormAutofill, setBlockUserFormAutofill,
    // Delete
    showDeleteModal, setShowDeleteModal,
    deleteItem, setDeleteItem, deleteLoading,
    // Reset senha
    showResetSenhaModal, setShowResetSenhaModal,
    resetSenhaUserId, setResetSenhaUserId,
    novaSenha, setNovaSenha,
    showUsuarioCriadoModal, setShowUsuarioCriadoModal,
    usuarioCriado, setUsuarioCriado,
    // Handlers
    carregarDados,
    limparFormulario,
    abrirFormularioCriacao,
    abrirFormularioEdicao,
    handleFormSubmit,
    confirmarExclusao,
    handleDelete,
    handleResetSenha,
    handleToggleAtivo,
    filtrarPorBusca,
  };
};

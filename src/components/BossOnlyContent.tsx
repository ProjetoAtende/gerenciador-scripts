import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Users,
  UserCog,
  Plus,
  Pencil,
  Trash2,
  Key,
  Search,
  Loader2,
  AlertCircle,
  UserX,
  UserCheck,
  Shield
} from 'lucide-react';
import { UsuarioCriadoModal } from './UsuarioCriadoModal';
import { PermissoesTab } from './PermissoesTab';
import { FormModal, ConfirmDeleteModal } from './BossOnlyHelpers';

type TabType = 'setores' | 'equipes' | 'usuarios' | 'permissoes';

const BossOnlyContent: React.FC<{ [key: string]: any }> = (h) => {
  const {
    isAdminUser, onClose,
    activeTab, setActiveTab,
    loading, busca, setBusca,
    setores, equipes, usuarios,
    filtroSetor, setFiltroSetor,
    filtroEquipe, setFiltroEquipe,
    filtroRole, setFiltroRole,
    filtroAtivo, setFiltroAtivo,
    showFormModal, setShowFormModal,
    formMode, formLoading,
    formNome, setFormNome,
    formEmail, setFormEmail,
    formSenha, setFormSenha,
    formRole, setFormRole,
    formSetorId, setFormSetorId,
    formEquipeId, setFormEquipeId,
    formSupervisorEquipeIds, setFormSupervisorEquipeIds,
    blockUserFormAutofill, setBlockUserFormAutofill,
    showDeleteModal, setShowDeleteModal,
    deleteItem, setDeleteItem, deleteLoading,
    showResetSenhaModal, setShowResetSenhaModal,
    setResetSenhaUserId,
    novaSenha, setNovaSenha,
    showUsuarioCriadoModal, setShowUsuarioCriadoModal,
    usuarioCriado, setUsuarioCriado,
    abrirFormularioCriacao,
    abrirFormularioEdicao,
    handleFormSubmit,
    confirmarExclusao,
    handleDelete,
    handleResetSenha,
    handleToggleAtivo,
    filtrarPorBusca,
    limparFormulario,
  } = h;

  const toggleSupervisorEquipe = (equipeId: string) => {
    setFormSupervisorEquipeIds((atuais: string[]) =>
      atuais.includes(equipeId)
        ? atuais.filter((id) => id !== equipeId)
        : [...atuais, equipeId]
    );
  };

  // =====================================================
  // RENDER DAS ABAS
  // =====================================================

  const renderAbas = () => (
    <div className="flex flex-col gap-1 w-48 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
      {[
        { key: 'setores' as TabType, label: 'Setores', icon: Building2 },
        { key: 'equipes' as TabType, label: 'Equipes', icon: Users },
        { key: 'usuarios' as TabType, label: 'Usuarios', icon: UserCog },
        { key: 'permissoes' as TabType, label: 'Permissões', icon: Shield },
      ].map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => {
            setActiveTab(key);
            setBusca('');
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-left ${
            activeTab === key
              ? 'bg-amber-500 text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <Icon size={18} />
          <span className="font-medium text-sm">{label}</span>
          </button>
      ))}
    </div>
  );

  // =====================================================
  // RENDER DAS TABELAS
  // =====================================================

  const renderTabelaSetores = () => {
    const setoresFiltrados = filtrarPorBusca(setores);

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Nome</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Equipes</th>
              {isAdminUser && <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Acoes</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {setoresFiltrados.map((setor: any) => (
              <tr key={setor.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3 text-gray-800 dark:text-gray-100">{setor.nome}</td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{setor._count?.equipes || 0}</td>
                {isAdminUser && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => abrirFormularioEdicao(setor)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => confirmarExclusao(setor.id, setor.nome)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {setoresFiltrados.length === 0 && (
              <tr>
                <td colSpan={isAdminUser ? 3 : 2} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  Nenhum setor encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTabelaEquipes = () => {
    const equipesFiltradas = filtrarPorBusca(equipes);

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Nome</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Setor</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Usuarios</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">GSEs</th>
              {isAdminUser && <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Acoes</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {equipesFiltradas.map((equipe: any) => (
              <tr key={equipe.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3 text-gray-800 dark:text-gray-100">{equipe.nome}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{equipe.setor?.nome || '-'}</td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{equipe._count?.users || 0}</td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{equipe._count?.gses || 0}</td>
                {isAdminUser && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => abrirFormularioEdicao(equipe)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => confirmarExclusao(equipe.id, equipe.nome)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {equipesFiltradas.length === 0 && (
              <tr>
                <td colSpan={isAdminUser ? 5 : 4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  Nenhuma equipe encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTabelaUsuarios = () => {
    const usuariosFiltrados = filtrarPorBusca(usuarios);

    const roleLabels: Record<string, string> = {
      user: 'Usuario',
      supervisor: 'Supervisor',
      coordenador: 'Coordenador',
      admin: 'Admin'
    };

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Nome</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Email</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Papel</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Equipe</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Supervisorias</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Status</th>
              {isAdminUser && <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Acoes</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {usuariosFiltrados.map((usuario: any) => (
              <tr key={usuario.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1.5 ${usuario.ativo === false ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>
                    {usuario.ativo === false && <UserX size={14} className="text-gray-400 flex-shrink-0" />}
                    {usuario.nome || '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{usuario.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    usuario.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                    usuario.role === 'coordenador' ? 'bg-blue-100 text-blue-700' :
                    usuario.role === 'supervisor' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                  }`}>
                    {roleLabels[usuario.role] || usuario.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{usuario.equipe?.nome || '-'}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {usuario.supervisor_equipes?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {usuario.supervisor_equipes.map((equipe: any) => (
                        <span key={equipe.id} className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {equipe.nome}
                        </span>
                      ))}
                    </div>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  {usuario.ativo !== false ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Ativo</span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Inativo</span>
                  )}
                </td>
                {isAdminUser && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => abrirFormularioEdicao(usuario)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setResetSenhaUserId(usuario.id);
                          setShowResetSenhaModal(true);
                        }}
                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition"
                        title="Resetar Senha"
                      >
                        <Key size={16} />
                      </button>
                      {usuario.role !== 'admin' && (
                        usuario.ativo !== false ? (
                          <button
                            onClick={() => handleToggleAtivo(usuario.id, usuario.nome || usuario.email, usuario.ativo)}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded transition"
                            title="Desativar Usuário"
                          >
                            <UserX size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleAtivo(usuario.id, usuario.nome || usuario.email, usuario.ativo)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                            title="Reativar Usuário"
                          >
                            <UserCheck size={16} />
                          </button>
                        )
                      )}
                      <button
                        onClick={() => confirmarExclusao(usuario.id, usuario.email)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {usuariosFiltrados.length === 0 && (
              <tr>
                <td colSpan={isAdminUser ? 7 : 6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  Nenhum usuario encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // =====================================================
  // RENDER DOS FILTROS
  // =====================================================

  const renderFiltros = () => {
    switch (activeTab) {
      case 'equipes':
        return (
          <select
            value={filtroSetor}
            onChange={(e) => setFiltroSetor(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Todos os setores</option>
            {setores.map((s: any) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        );

      case 'usuarios':
        return (
          <div className="flex gap-2">
            <select
              value={filtroSetor}
              onChange={(e) => {
                setFiltroSetor(e.target.value);
                setFiltroEquipe('');
              }}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Todos os setores</option>
              {setores.map((s: any) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
            <select
              value={filtroEquipe}
              onChange={(e) => setFiltroEquipe(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Todas as equipes</option>
              {equipes
                .filter((e: any) => !filtroSetor || e.setor_id === filtroSetor)
                .map((e: any) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
            </select>
            <select
              value={filtroRole}
              onChange={(e) => setFiltroRole(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Todos os papeis</option>
              <option value="user">Usuario</option>
              <option value="supervisor">Supervisor</option>
              <option value="coordenador">Coordenador</option>
              <option value="admin">Admin</option>
            </select>
            <select
              value={filtroAtivo}
              onChange={(e) => setFiltroAtivo(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>
        );

      default:
        return null;
    }
  };

  // =====================================================
  // RENDER DO FORMULARIO
  // =====================================================

  const renderFormulario = () => {
    switch (activeTab) {
      case 'setores':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Setor</label>
            <input
              type="text"
              value={formNome}
              onChange={(e) => setFormNome(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Ex: Tecnologia da Informacao"
            />
          </div>
        );

      case 'equipes':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da Equipe</label>
              <input
                type="text"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Ex: Suporte N1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Setor</label>
              <select
                value={formSetorId}
                onChange={(e) => setFormSetorId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Selecione um setor</option>
                {setores.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>
          </>
        );

      case 'usuarios':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                type="email"
                name="bossonly-new-user-email"
                autoComplete="off"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                disabled={formMode === 'edit'}
                readOnly={formMode === 'create' && blockUserFormAutofill}
                onFocus={() => formMode === 'create' && setBlockUserFormAutofill(false)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                placeholder="usuario@email.com"
              />
            </div>
            {formMode === 'create' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha</label>
                <input
                  type="password"
                  name="bossonly-new-user-password"
                  autoComplete="new-password"
                  value={formSenha}
                  onChange={(e) => setFormSenha(e.target.value)}
                  readOnly={blockUserFormAutofill}
                  onFocus={() => setBlockUserFormAutofill(false)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Minimo 6 caracteres"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
              <input
                type="text"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Papel</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="user">Usuario</option>
                <option value="supervisor">Supervisor</option>
                <option value="coordenador">Coordenador</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Setor (opcional)</label>
              <select
                value={formSetorId}
                onChange={(e) => setFormSetorId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Nenhum</option>
                {setores.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Equipe (opcional)</label>
              <select
                value={formEquipeId}
                onChange={(e) => setFormEquipeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Nenhuma</option>
                {equipes
                  .filter((e: any) => !formSetorId || e.setor_id === formSetorId)
                  .map((e: any) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
              </select>
            </div>
            {(formRole === 'admin' || formRole === 'supervisor') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supervisor de equipes</label>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 p-2 space-y-1">
                  {equipes.map((equipe: any) => (
                    <label key={equipe.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formSupervisorEquipeIds.includes(equipe.id)}
                        onChange={() => toggleSupervisorEquipe(equipe.id)}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">{equipe.nome}</span>
                    </label>
                  ))}
                  {equipes.length === 0 && (
                    <p className="px-2 py-1.5 text-sm text-gray-400">Nenhuma equipe disponivel</p>
                  )}
                </div>
              </div>
            )}
          </>
        );

      default:
        return null;
    }
  };

  const getFormTitle = () => {
    const acao = formMode === 'create' ? 'Novo' : 'Editar';
    const entidade: Record<string, string> = {
      setores: 'Setor',
      equipes: 'Equipe',
      usuarios: 'Usuario',
    };
    return `${acao} ${entidade[activeTab] || ''}`.trim();
  };

  // =====================================================
  // RENDER PRINCIPAL
  // =====================================================

  return (
    <AnimatePresence>
      <motion.div
        key="boss-only-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/40"
      >
        <div className="bg-white dark:bg-gray-900 w-full h-full flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-amber-500 to-amber-600 border-b border-amber-600 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👔</span>
              <div>
                <h2 className="text-2xl font-bold text-white">Boss Only</h2>
                <p className="text-amber-100 text-sm">Gerenciamento Administrativo</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Fechar
            </button>
          </div>

          {/* Corpo */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar com abas */}
            <div className="p-4 border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              {renderAbas()}
            </div>

            {/* Conteudo principal */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Toolbar (oculta na aba de autorizações, que tem UI própria) */}
              {activeTab !== 'permissoes' && (
              <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Busca */}
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar..."
                      className="pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 w-64"
                    />
                  </div>

                  {/* Filtros */}
                  {renderFiltros()}
                </div>

                {/* Botao de criar (apenas Boss) */}
                {isAdminUser && (
                  <button
                    onClick={abrirFormularioCriacao}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                  >
                    <Plus size={18} />
                    Novo
                  </button>
                )}
              </div>
              )}

              {/* Tabela */}
              <div className="flex-1 overflow-auto p-4">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 size={32} className="animate-spin text-amber-500" />
                  </div>
                ) : (
                  <>
                    {activeTab === 'setores' && renderTabelaSetores()}
                    {activeTab === 'equipes' && renderTabelaEquipes()}
                    {activeTab === 'usuarios' && renderTabelaUsuarios()}
                    {activeTab === 'permissoes' && (
                      <PermissoesTab
                        isAdminUser={isAdminUser}
                        equipes={equipes}
                        usuarios={usuarios}
                        selectedObjectCode={null}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Aviso para nao-Boss */}
          {!isAdminUser && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border-t border-amber-200 dark:border-amber-800 px-4 py-3 flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertCircle size={18} />
              <span className="text-sm">Modo somente leitura. Apenas o administrador pode fazer alteracoes.</span>
            </div>
          )}
        </div>

        {/* Modal de formulario */}
        <AnimatePresence>
          {showFormModal && (
            <FormModal
              isOpen={showFormModal}
              onClose={() => {
                setShowFormModal(false);
                limparFormulario();
              }}
              title={getFormTitle()}
              onConfirm={handleFormSubmit}
              loading={formLoading}
            >
              {renderFormulario()}
            </FormModal>
          )}
        </AnimatePresence>

        {/* Modal de confirmacao de exclusao */}
        <AnimatePresence>
          {showDeleteModal && deleteItem && (
            <ConfirmDeleteModal
              isOpen={showDeleteModal}
              onClose={() => {
                setShowDeleteModal(false);
                setDeleteItem(null);
              }}
              onConfirm={handleDelete}
              loading={deleteLoading}
              itemName={deleteItem.nome}
            />
          )}
        </AnimatePresence>

        {/* Modal de reset de senha */}
        <AnimatePresence>
          {showResetSenhaModal && (
            <FormModal
              isOpen={showResetSenhaModal}
              onClose={() => {
                setShowResetSenhaModal(false);
                setResetSenhaUserId('');
                setNovaSenha('');
              }}
              title="Resetar Senha"
              onConfirm={handleResetSenha}
              loading={formLoading}
              confirmText="Alterar Senha"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nova Senha</label>
                <input
                  type="password"
                  name="bossonly-reset-password"
                  autoComplete="new-password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Minimo 6 caracteres"
                />
              </div>
            </FormModal>
          )}
        </AnimatePresence>

        {showUsuarioCriadoModal && usuarioCriado && (
          <UsuarioCriadoModal
            open={showUsuarioCriadoModal}
            onClose={() => {
              setShowUsuarioCriadoModal(false);
              setUsuarioCriado(null);
            }}
            usuario={usuarioCriado}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export { BossOnlyContent };

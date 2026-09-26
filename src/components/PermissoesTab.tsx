import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Shield, Users as UsersIcon, UserCog, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  listarObjetosPermissao,
  listarGrantsObjeto,
  setGrant,
  PermissaoObjeto,
  PermissaoGrant,
  PermissaoTargetType,
} from '../services/permissoesService';
import { EquipeWithSetor, UserWithStatus } from '../services/adminService';

interface PermissoesTabProps {
  isAdminUser: boolean;
  equipes: EquipeWithSetor[];
  usuarios: UserWithStatus[];
  selectedObjectCode?: string | null;
}

type SubTab = 'role' | 'equipe' | 'usuario';

const ROLES: { id: string; label: string }[] = [
  { id: 'user', label: 'Usuário' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'coordenador', label: 'Coordenador' },
  { id: 'admin', label: 'Admin (sempre liberado)' },
];

const CATEGORIA_LABEL: Record<string, string> = {
  home: 'Home',
  admin: 'Administração',
  scripts: 'Scripts',
  distribuidor: 'Distribuidor',
  radar: 'Radar de Tickets',
  tarefas: 'Tarefas',
  notificacoes: 'Notificações',
};

export const PermissoesTab: React.FC<PermissoesTabProps> = ({ isAdminUser, equipes, usuarios, selectedObjectCode }) => {
  const [loading, setLoading] = useState(true);
  const [objetos, setObjetos] = useState<PermissaoObjeto[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [grants, setGrants] = useState<PermissaoGrant[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('role');
  const [buscaObjeto, setBuscaObjeto] = useState('');
  const [buscaTarget, setBuscaTarget] = useState('');

  // Carregar catálogo
  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    listarObjetosPermissao()
      .then((lista) => {
        if (cancelado) return;
        setObjetos(lista);
        if (lista.length > 0 && !selecionado) {
          setSelecionado(lista[0].codigo);
        }
      })
      .catch((err) => {
        console.error('[PermissoesTab] erro listar objetos', err);
        toast.error('Erro ao carregar catálogo de autorizações');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => { cancelado = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carregar grants do objeto selecionado
  useEffect(() => {
    if (!selecionado) { setGrants([]); return; }
    let cancelado = false;
    setGrantsLoading(true);
    listarGrantsObjeto(selecionado)
      .then((lista) => { if (!cancelado) setGrants(lista); })
      .catch((err) => {
        console.error('[PermissoesTab] erro listar grants', err);
        toast.error('Erro ao carregar permissões do objeto');
      })
      .finally(() => { if (!cancelado) setGrantsLoading(false); });
    return () => { cancelado = true; };
  }, [selecionado]);

  useEffect(() => {
    if (!selectedObjectCode) return;
    if (!objetos.some((objeto) => objeto.codigo === selectedObjectCode)) return;
    setSelecionado(selectedObjectCode);
  }, [objetos, selectedObjectCode]);

  const objetosAgrupados = useMemo(() => {
    const filtro = buscaObjeto.trim().toLowerCase();
    const filtrado = filtro
      ? objetos.filter((o) =>
          o.codigo.toLowerCase().includes(filtro) ||
          o.nome.toLowerCase().includes(filtro) ||
          (o.descricao || '').toLowerCase().includes(filtro))
      : objetos;
    const map = new Map<string, PermissaoObjeto[]>();
    for (const o of filtrado) {
      const arr = map.get(o.categoria) || [];
      arr.push(o);
      map.set(o.categoria, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [objetos, buscaObjeto]);

  const objetoAtual = useMemo(
    () => objetos.find((o) => o.codigo === selecionado) || null,
    [objetos, selecionado],
  );

  const grantsSet = useMemo(() => {
    const s = new Set<string>();
    for (const g of grants) s.add(`${g.target_type}:${g.target_id}`);
    return s;
  }, [grants]);

  const recarregarObjetos = async () => {
    try {
      const lista = await listarObjetosPermissao();
      setObjetos(lista);
    } catch {
      // silencioso — total_grants apenas atualiza badge
    }
  };

  const handleToggle = async (
    targetType: PermissaoTargetType,
    targetId: string,
    targetNome: string,
    currentlyGranted: boolean,
  ) => {
    if (!selecionado) return;
    if (!isAdminUser) {
      toast.error('Apenas administradores podem alterar permissões');
      return;
    }
    const isAdminRoleSempreLiberado = targetType === 'role' && targetId === 'admin' && objetoAtual?.categoria !== 'notificacoes';
    if (isAdminRoleSempreLiberado) {
      toast.info('Admin sempre tem acesso a todos os objetos.');
      return;
    }

    const key = `${targetType}:${targetId}`;
    setSavingKey(key);
    try {
      await setGrant(selecionado, targetType, targetId, !currentlyGranted);
      // Atualização otimista
      if (currentlyGranted) {
        setGrants((prev) => prev.filter((g) => !(g.target_type === targetType && g.target_id === targetId)));
      } else {
        setGrants((prev) => [
          ...prev,
          {
            id: `tmp-${key}`,
            objeto_codigo: selecionado,
            target_type: targetType,
            target_id: targetId,
            target_nome: targetNome,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      toast.success(`${currentlyGranted ? 'Revogado' : 'Concedido'}: ${targetNome}`);
      recarregarObjetos();
    } catch (err: unknown) {
      console.error('[PermissoesTab] erro toggle', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar permissão');
    } finally {
      setSavingKey(null);
    }
  };

  // Lista de candidatos para a sub-aba ativa
  const candidatos = useMemo(() => {
    const filtro = buscaTarget.trim().toLowerCase();
    if (subTab === 'role') {
      return ROLES.map((r) => ({
        id: r.id,
        nome: r.id === 'admin' && objetoAtual?.categoria === 'notificacoes' ? 'Admin' : r.label,
        isAdminRole: r.id === 'admin',
      }));
    }
    if (subTab === 'equipe') {
      const lista = equipes
        .map((e) => ({ id: e.id, nome: e.nome, isAdminRole: false }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      return filtro ? lista.filter((x) => x.nome.toLowerCase().includes(filtro)) : lista;
    }
    // usuario
    const lista = usuarios
      .map((u) => ({ id: u.id, nome: `${u.nome} <${u.email}>`, isAdminRole: false }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return filtro ? lista.filter((x) => x.nome.toLowerCase().includes(filtro)) : lista;
  }, [subTab, equipes, usuarios, buscaTarget, objetoAtual?.categoria]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row lg:items-start gap-4 h-full">
      {/* Lista de objetos */}
      <div className="lg:w-96 lg:h-[calc(100vh-17rem)] shrink-0 flex flex-col border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
        <div className="p-3 border-b dark:border-gray-700">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={buscaObjeto}
              onChange={(e) => setBuscaObjeto(e.target.value)}
              placeholder="Buscar objeto..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {objetosAgrupados.map(([categoria, lista]) => (
            <div key={categoria}>
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40">
                {CATEGORIA_LABEL[categoria] || categoria}
              </div>
              {lista.map((o) => {
                const ativo = o.codigo === selecionado;
                return (
                  <button
                    key={o.codigo}
                    onClick={() => setSelecionado(o.codigo)}
                    className={`w-full text-left px-3 py-2 border-b dark:border-gray-700 transition ${
                      ativo
                        ? 'bg-amber-50 dark:bg-amber-900/30 border-l-4 border-l-amber-500'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{o.nome}</span>
                      {o.total_grants > 0 && (
                        <span className="text-xs bg-amber-500 text-white rounded-full px-2 py-0.5">
                          {o.total_grants}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{o.codigo}</div>
                  </button>
                );
              })}
            </div>
          ))}
          {objetosAgrupados.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-500">Nenhum objeto encontrado.</div>
          )}
        </div>
      </div>

      {/* Painel de grants */}
      <div className="flex-1 lg:sticky lg:top-4 lg:h-[calc(100vh-17rem)] self-start flex flex-col border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
        {!objetoAtual ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Selecione um objeto à esquerda
          </div>
        ) : (
          <>
            <div className="p-4 border-b dark:border-gray-700">
              <div className="flex items-start gap-3">
                <Shield size={22} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{objetoAtual.nome}</h3>
                  <code className="text-xs text-gray-500 dark:text-gray-400">{objetoAtual.codigo}</code>
                  {objetoAtual.descricao && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{objetoAtual.descricao}</p>
                  )}
                  {objetoAtual.origem && (
                    <p className="mt-1 text-xs text-gray-400 font-mono">origem: {objetoAtual.origem}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              {/* Sub-abas */}
              <div className="flex items-center gap-1 px-3 pt-3">
                {([
                  { k: 'role', label: 'Perfis', icon: Shield },
                  { k: 'equipe', label: 'Equipes', icon: Building2 },
                  { k: 'usuario', label: 'Usuários', icon: UserCog },
                ] as const).map(({ k, label, icon: Icon }) => (
                  <button
                    key={k}
                    onClick={() => { setSubTab(k); setBuscaTarget(''); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-sm font-medium transition ${
                      subTab === k
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Busca de alvo */}
              {subTab !== 'role' && (
                <div className="px-3 pt-3">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={buscaTarget}
                      onChange={(e) => setBuscaTarget(e.target.value)}
                      placeholder={`Buscar ${subTab === 'equipe' ? 'equipe' : 'usuário'}...`}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* Lista de toggles */}
              <div className="p-3">
              {grantsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 size={24} className="animate-spin text-amber-500" />
                </div>
              ) : (
                <ul className="divide-y dark:divide-gray-700">
                  {candidatos.map((c) => {
                    const targetType: PermissaoTargetType = subTab;
                    const key = `${targetType}:${c.id}`;
                    const adminSempreLiberado = c.isAdminRole && objetoAtual.categoria !== 'notificacoes';
                    const granted = adminSempreLiberado || grantsSet.has(key);
                    const saving = savingKey === key;
                    const disabled = !isAdminUser || saving || adminSempreLiberado;
                    return (
                      <li key={key} className="flex items-center justify-between py-2 px-2">
                        <div className="min-w-0 pr-3">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                            {c.nome}
                          </div>
                          {subTab === 'usuario' && (
                            <div className="text-xs text-gray-400 font-mono truncate">{c.id}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={granted}
                          disabled={disabled}
                          onClick={() => handleToggle(targetType, c.id, c.nome, granted)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                            granted ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                              granted ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                          {saving && (
                            <Loader2
                              size={12}
                              className="absolute -right-5 animate-spin text-amber-500"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                  {candidatos.length === 0 && (
                    <li className="py-6 text-center text-sm text-gray-500">
                      <UsersIcon size={20} className="inline mr-1 opacity-50" />
                      Nenhum item encontrado.
                    </li>
                  )}
                </ul>
              )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PermissoesTab;

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { usePermissoes } from '../contexts/PermissoesContext';
import { Settings, ArrowLeft } from 'lucide-react';
import FooterShadowFlow from '../components/FooterShadowFlow';
import { NotificationBadge } from '../components/NotificationBadge';
import { ScriptNotificacao } from '../services/scriptVersioningService';
import { VersionBadge } from '../components/VersionBadge';
import { useSettings } from '../contexts/SettingsContext';
import { listarEquipes, listarSetores, type EquipeWithSetor, type SetorWithCount } from '../services/adminService';
import { useSimulation } from '../contexts/SimulationContext';

const ScriptsModal = lazy(() => import('../components/ScriptsModal').then((m) => ({ default: m.ScriptsModal })));
const ScriptsEmNumerosModal = lazy(() =>
  import('../components/ScriptsEmNumerosModal').then((m) => ({ default: m.ScriptsEmNumerosModal })),
);
const BossOnlyModal = lazy(() => import('../components/BossOnlyModal'));
const OutrosServicosModal = lazy(() => import('../components/OutrosServicosModal').then((m) => ({ default: m.OutrosServicosModal })));
const LinksModal = lazy(() => import('../components/LinksModal').then((m) => ({ default: m.LinksModal })));
const GeradorModal = lazy(() => import('../components/GeradorModal').then((m) => ({ default: m.GeradorModal })));
const MelhorarTextoModal = lazy(() => import('../components/MelhorarTextoModal').then((m) => ({ default: m.MelhorarTextoModal })));
const ConfiguracoesModal = lazy(() => import('../components/ConfiguracoesModal').then((m) => ({ default: m.ConfiguracoesModal })));
const EscalaModal = lazy(() => import('../components/escala/EscalaModal').then((m) => ({ default: m.EscalaModal })));
const AtendeStackModal = lazy(() =>
  import('../components/atende-stack/AtendeStackModal').then((m) => ({ default: m.AtendeStackModal })),
);

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'tween' as const, duration: 0.15, ease: 'easeOut' as const },
  },
};

const HOME_MODALS = {
  scripts: false,
  scriptsEmNumeros: false,
  links: false,
  outrosServicos: false,
  escala: false,
  copilot: false,
  bossOnly: false,
  atendeStack: false,
} as const;

type HomeModalKey = keyof typeof HOME_MODALS;

type HomeCardConfig = {
  titulo: string;
  descricao: string;
  cor: string;
  modal: HomeModalKey;
  permissionCode?: string;
};

const HOME_CARD_CONFIGS: HomeCardConfig[] = [
  {
    titulo: 'Scripts',
    descricao: '🧩 Scripts prontos e customizados',
    cor: 'bg-orange-100 dark:bg-orange-900/30',
    modal: 'scripts',
    permissionCode: 'home.card.scripts',
  },
  {
    titulo: 'Escala',
    descricao: '🗓️ Calendário de escala, afastamentos e agenda institucional',
    cor: 'bg-gradient-to-br from-cyan-100 via-sky-100 to-blue-100 dark:from-cyan-900/30 dark:via-sky-900/30 dark:to-blue-900/30',
    modal: 'escala',
    permissionCode: 'home.card.escala',
  },
  {
    titulo: 'Pasquale',
    descricao: '✨ Melhorar textos com IA',
    cor: 'bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30',
    modal: 'copilot',
    permissionCode: 'home.card.pasquale',
  },
  {
    titulo: 'Links Úteis',
    descricao: '🔗 Endereços web da equipe',
    cor: 'bg-blue-100 dark:bg-blue-900/30',
    modal: 'links',
    permissionCode: 'home.card.links_uteis',
  },
  {
    titulo: 'Atende Stack',
    descricao: '🗨 Perguntas e respostas da operação',
    cor: 'bg-gradient-to-br from-indigo-100 via-violet-100 to-purple-100 dark:from-indigo-900/30 dark:via-violet-900/30 dark:to-purple-900/30',
    modal: 'atendeStack',
  },
  {
    titulo: 'Outros Serviços',
    descricao: '📋 Registro de serviços operacionais',
    cor: 'bg-gradient-to-br from-amber-100 via-orange-100 to-yellow-100 dark:from-amber-900/30 dark:via-orange-900/30 dark:to-yellow-900/30',
    modal: 'outrosServicos',
    permissionCode: 'home.card.outros_servicos',
  },
  {
    titulo: 'Scripts em Números',
    descricao: '📊 Estatísticas do sistema de scripts',
    cor: 'bg-gradient-to-br from-indigo-100 via-violet-100 to-purple-100 dark:from-indigo-900/30 dark:via-violet-900/30 dark:to-purple-900/30',
    modal: 'scriptsEmNumeros',
    permissionCode: 'scripts.em_numeros_modal',
  },
  {
    titulo: 'Boss Only',
    descricao: '👔 Setores, equipes, usuários e permissões',
    cor: 'bg-amber-100 dark:bg-amber-900/30',
    modal: 'bossOnly',
    permissionCode: 'admin.boss_only_modal',
  },
];

function emptyModals(): Record<HomeModalKey, boolean> {
  return { ...HOME_MODALS };
}

export default function Home() {
  const [modals, setModals] = useState(emptyModals);
  const { user, logout, isLoggingOut, setEquipeId, equipeId } = useAuth();
  const { temPermissao } = usePermissoes();
  const { openCardsInNewTab } = useSettings();
  const {
    canSimulate,
    isSimulating,
    simulation,
    effectiveEquipeId,
    effectiveRole,
    setSetorId: setSimulationSetorId,
    setEquipeId: setSimulationEquipeId,
    setRole: setSimulationRole,
    reset: resetSimulation,
  } = useSimulation();
  const location = useLocation();
  const navigate = useNavigate();
  const [setoresSimulacao, setSetoresSimulacao] = useState<SetorWithCount[]>([]);
  const [equipesSimulacao, setEquipesSimulacao] = useState<EquipeWithSetor[]>([]);
  const [loadingSimulacao, setLoadingSimulacao] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [openedViaQueryParam, setOpenedViaQueryParam] = useState(false);
  const stackPerguntaId = useMemo(() => new URLSearchParams(location.search).get('pergunta'), [location.search]);

  const [selectedScript, setSelectedScript] = useState<{
    nome: string;
    conteudo_bruto: string;
    conteudo_atendente?: string | null;
  } | null>(null);
  const [showGeradorModal, setShowGeradorModal] = useState(false);
  const [scriptNotificacaoPendente, setScriptNotificacaoPendente] = useState<ScriptNotificacao | null>(null);

  const handleOpenScriptNotificacao = useCallback((notificacao: ScriptNotificacao) => {
    setScriptNotificacaoPendente(notificacao);
    setModals((prev) => ({ ...prev, scripts: true }));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const modalParam = params.get('modal') as HomeModalKey | null;
    if (modalParam && modalParam in HOME_MODALS) {
      setModals((prev) => ({ ...prev, [modalParam]: true }));
      setOpenedViaQueryParam(true);
    }
  }, [location.search]);

  const handleVoltarAoDashboard = useCallback(() => {
    setOpenedViaQueryParam(false);
    setModals(emptyModals());
    navigate('/home', { replace: true });
  }, [navigate]);

  const toggleModal = useCallback((nome: HomeModalKey) => {
    setModals((prev) => ({ ...prev, [nome]: !prev[nome] }));
  }, []);

  const closeAtendeStack = useCallback(() => {
    setModals((prev) => ({ ...prev, atendeStack: false }));
    const params = new URLSearchParams(location.search);
    if (params.has('modal') || params.has('pergunta')) {
      navigate('/home', { replace: true });
    }
  }, [location.search, navigate]);

  const cards = useMemo(
    () => HOME_CARD_CONFIGS.filter((card) => !card.permissionCode || temPermissao(card.permissionCode)),
    [temPermissao],
  );

  useEffect(() => {
    if (!canSimulate) return;
    let cancelado = false;

    const carregarOpcoesSimulacao = async () => {
      setLoadingSimulacao(true);
      try {
        const [setores, equipes] = await Promise.all([listarSetores(), listarEquipes()]);
        if (cancelado) return;
        setSetoresSimulacao(setores);
        setEquipesSimulacao(equipes);
      } catch (error) {
        console.error('[Home] erro ao carregar opções de simulação', error);
      } finally {
        if (!cancelado) setLoadingSimulacao(false);
      }
    };

    void carregarOpcoesSimulacao();
    return () => {
      cancelado = true;
    };
  }, [canSimulate]);

  const equipesFiltradasSimulacao = useMemo(
    () =>
      simulation.setorId
        ? equipesSimulacao.filter((equipe) => equipe.setor_id === simulation.setorId)
        : equipesSimulacao,
    [equipesSimulacao, simulation.setorId],
  );

  const canOpenConfig = temPermissao('home.card.configuracoes');

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="w-full bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 p-4 flex justify-end items-center sticky top-0 z-50">
        <div className="w-full flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {canSimulate && (
              <>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Visualização
                </span>
                <select
                  value={simulation.setorId}
                  onChange={(e) => {
                    const nextSetorId = e.target.value;
                    setSimulationSetorId(nextSetorId);
                    if (simulation.equipeId) {
                      const equipeSelecionada = equipesSimulacao.find((equipe) => equipe.id === simulation.equipeId);
                      if (equipeSelecionada && nextSetorId && equipeSelecionada.setor_id !== nextSetorId) {
                        setSimulationEquipeId('');
                      }
                    }
                  }}
                  disabled={loadingSimulacao}
                  className="min-w-[160px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="">Todos os setores</option>
                  {setoresSimulacao.map((setor) => (
                    <option key={setor.id} value={setor.id}>
                      {setor.nome}
                    </option>
                  ))}
                </select>
                <select
                  value={simulation.equipeId}
                  onChange={(e) => setSimulationEquipeId(e.target.value)}
                  disabled={loadingSimulacao}
                  className="min-w-[180px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="">Equipe real ({equipeId || 'sem equipe'})</option>
                  {equipesFiltradasSimulacao.map((equipe) => (
                    <option key={equipe.id} value={equipe.id}>
                      {equipe.nome}
                    </option>
                  ))}
                </select>
                <select
                  value={simulation.role}
                  onChange={(e) => setSimulationRole(e.target.value as '' | 'user' | 'supervisor' | 'coordenador' | 'admin')}
                  className="min-w-[160px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="">Papel real (admin)</option>
                  <option value="user">Usuário</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="coordenador">Coordenador</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="button"
                  onClick={resetSimulation}
                  disabled={!isSimulating}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Resetar
                </button>
                {isSimulating && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    Simulando: {effectiveRole || 'admin'}{' '}
                    {effectiveEquipeId
                      ? `· ${equipesSimulacao.find((equipe) => equipe.id === effectiveEquipeId)?.nome || effectiveEquipeId}`
                      : ''}
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-4 justify-end">
            {user && <VersionBadge userId={user.id} />}
            {user && (
              <NotificationBadge
                onOpenScriptNotificacao={handleOpenScriptNotificacao}
                onOpenStackPergunta={(perguntaId) => {
                  setModals((prev) => ({ ...prev, atendeStack: true }));
                  setOpenedViaQueryParam(true);
                  navigate(`/home?modal=atendeStack&pergunta=${perguntaId}`, { replace: true });
                }}
              />
            )}
            {user?.email && (
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Bem-vindo, <strong>{user.email}</strong>
              </span>
            )}
            {canOpenConfig && (
              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Configurações"
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setEquipeId(null)}
              className="px-4 py-2 rounded shadow text-white bg-blue-700 hover:bg-blue-800 transition-colors"
            >
              🔄 Trocar Equipe
            </button>
            <button
              type="button"
              onClick={logout}
              disabled={isLoggingOut}
              className={`px-4 py-2 rounded shadow text-white transition-colors ${
                isLoggingOut ? 'bg-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-800'
              }`}
            >
              {isLoggingOut ? 'Saindo...' : '🚪 Sair'}
            </button>
          </div>
        </div>
      </header>

      {openedViaQueryParam && (
        <div className="w-full bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 px-4 py-2">
          <button
            type="button"
            onClick={handleVoltarAoDashboard}
            className="flex items-center gap-2 text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Dashboard
          </button>
        </div>
      )}

      <div className="flex-1 p-8 max-w-6xl mx-auto w-full">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {cards.map((card) => (
            <motion.button
              key={card.titulo}
              type="button"
              variants={cardVariants}
              whileHover={{ scale: 1.03 }}
              transition={{ type: 'tween', duration: 0.15 }}
              className={`cursor-pointer w-full text-left ${card.cor} rounded-xl shadow-md dark:shadow-gray-900/50 p-6 text-center transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900`}
              onClick={() => {
                if (openCardsInNewTab) {
                  const hash = window.location.hash.split('?')[0];
                  const baseUrl = window.location.href.split('#')[0];
                  window.open(`${baseUrl}${hash}?modal=${card.modal}`, '_blank');
                } else {
                  toggleModal(card.modal);
                }
              }}
            >
              <div className="text-4xl mb-2">{card.descricao.split(' ')[0]}</div>
              <h2 className="text-xl font-semibold dark:text-gray-100">{card.titulo}</h2>
              <p className="text-gray-600 dark:text-gray-300 mt-1">{card.descricao.split(' ').slice(1).join(' ')}</p>
            </motion.button>
          ))}
        </motion.div>
      </div>

      {modals.scripts && (
        <Suspense fallback={null}>
          <ScriptsModal
            isOpen
            onClose={() => toggleModal('scripts')}
            onOpenGerador={(script) => {
              setSelectedScript(script);
              setShowGeradorModal(true);
            }}
            notificacaoPendente={scriptNotificacaoPendente}
            onNotificacaoProcessada={() => setScriptNotificacaoPendente(null)}
          />
        </Suspense>
      )}

      {modals.scriptsEmNumeros && (
        <Suspense fallback={null}>
          <ScriptsEmNumerosModal isOpen onClose={() => toggleModal('scriptsEmNumeros')} />
        </Suspense>
      )}

      {modals.links && (
        <Suspense fallback={null}>
          <LinksModal isOpen onClose={() => toggleModal('links')} />
        </Suspense>
      )}

      {modals.outrosServicos && (
        <Suspense fallback={null}>
          <OutrosServicosModal isOpen onClose={() => toggleModal('outrosServicos')} />
        </Suspense>
      )}

      {modals.escala && (
        <Suspense fallback={null}>
          <EscalaModal isOpen onClose={() => toggleModal('escala')} />
        </Suspense>
      )}

      {modals.copilot && (
        <Suspense fallback={null}>
          <div className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-gray-900">
            <div className="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Pasquale</h2>
              <button
                type="button"
                onClick={() => toggleModal('copilot')}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600"
              >
                Fechar
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <MelhorarTextoModal isOpen showSaveButton={false} isFullscreen onClose={() => toggleModal('copilot')} />
            </div>
          </div>
        </Suspense>
      )}

      {modals.bossOnly && (
        <Suspense fallback={null}>
          <BossOnlyModal isOpen onClose={() => toggleModal('bossOnly')} />
        </Suspense>
      )}

      {modals.atendeStack && (
        <Suspense fallback={null}>
          <AtendeStackModal
            isOpen
            onClose={closeAtendeStack}
            initialPerguntaId={stackPerguntaId}
          />
        </Suspense>
      )}

      {selectedScript && showGeradorModal && (
        <Suspense fallback={null}>
          <GeradorModal isOpen onClose={() => setShowGeradorModal(false)} script={selectedScript} />
        </Suspense>
      )}

      {showConfigModal && (
        <Suspense fallback={null}>
          <ConfiguracoesModal isOpen onClose={() => setShowConfigModal(false)} />
        </Suspense>
      )}

      <FooterShadowFlow techStack={['React', 'TypeScript', 'Supabase', 'Tailwind CSS', 'Vite']} />
    </div>
  );
}

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
import { HomeInstitutionalHeader } from '../components/HomeInstitutionalHeader';
// Barra de visualização simulada preservada em ../components/HomeVisualizacaoSimulada.tsx (desativada).

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
const PrioridadesModal = lazy(() => import('../components/prioridades/PrioridadesModal'));

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
  prioridades: false,
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
    titulo: 'Prioridades e Urgências',
    descricao: '⚖️ Anotações de prioridade e urgência entre o TJSP Atende e as UPJs',
    cor: 'bg-gradient-to-br from-rose-100 via-red-100 to-orange-100 dark:from-rose-900/30 dark:via-red-900/30 dark:to-orange-900/30',
    modal: 'prioridades',
    permissionCode: 'home.card.prioridades_urgencias',
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
  const { user, logout, isLoggingOut, setEquipeId } = useAuth();
  const { temPermissao } = usePermissoes();
  const { openCardsInNewTab } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
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
    if (!modalParam || !(modalParam in HOME_MODALS)) return;

    // PU-14: a URL não pode abrir um módulo cujo card o usuário não tem
    // permissão de ver. O servidor já protege os dados, mas a tela não deve
    // abrir por parâmetro aquilo que o card esconde.
    const config = HOME_CARD_CONFIGS.find((card) => card.modal === modalParam);
    if (config?.permissionCode && !temPermissao(config.permissionCode)) {
      navigate('/home', { replace: true });
      return;
    }

    setModals((prev) => ({ ...prev, [modalParam]: true }));
    setOpenedViaQueryParam(true);
  }, [location.search, temPermissao, navigate]);

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

  const canOpenConfig = temPermissao('home.card.configuracoes');

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-stone-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/95 sm:p-4">
        <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <HomeInstitutionalHeader />
          <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
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

      {modals.prioridades && (
        <Suspense fallback={null}>
          <PrioridadesModal isOpen onClose={() => toggleModal('prioridades')} />
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

      <FooterShadowFlow />
    </div>
  );
}

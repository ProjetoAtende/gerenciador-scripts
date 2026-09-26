// src/components/ConfiguracoesModal.tsx
import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useEffectiveAuth } from '../hooks/useEffectiveAuth';
import { useSettings } from '../contexts/SettingsContext';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  fetchEquipesNotificacaoOptions,
  fetchNotificationPreferences,
  NOTIFICATION_PREFERENCE_DEFINITIONS,
  NotificationPreference,
  NotificationPreferenceMode,
  saveNotificationPreference,
} from '../services/notificacaoPreferenciasService';

interface ConfiguracoesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function createNotificationPreferenceState(): Record<string, NotificationPreference> {
  return NOTIFICATION_PREFERENCE_DEFINITIONS.reduce<Record<string, NotificationPreference>>((acc, definition) => {
    const pref = DEFAULT_NOTIFICATION_PREFERENCES[definition.codigo];
    acc[definition.codigo] = {
      ...pref,
      equipes_ids: [...pref.equipes_ids],
    };
    return acc;
  }, {});
}

export function ConfiguracoesModal({ isOpen, onClose }: ConfiguracoesModalProps) {
  const { equipeId } = useEffectiveAuth();
  const { darkMode, openCardsInNewTab, toggleDarkMode, toggleOpenCardsInNewTab } = useSettings();
  const [savingDark, setSavingDark] = useState(false);
  const [savingNewTab, setSavingNewTab] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [savingNotificationCode, setSavingNotificationCode] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, NotificationPreference>>(() => createNotificationPreferenceState());
  const [equipesDisponiveis, setEquipesDisponiveis] = useState<Array<{ id: string; nome: string }>>([]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelado = false;

    async function carregarPreferenciasNotificacao() {
      setLoadingNotifications(true);
      try {
        const [prefs, equipes] = await Promise.all([
          fetchNotificationPreferences(),
          fetchEquipesNotificacaoOptions(),
        ]);

        if (cancelado) return;

        setNotificationPrefs(prefs);
        setEquipesDisponiveis(equipes);
      } catch (error) {
        console.error('[ConfiguracoesModal] Erro ao carregar preferências de notificação:', error);
        if (!cancelado) {
          setNotificationPrefs(createNotificationPreferenceState());
          setEquipesDisponiveis([]);
        }
      } finally {
        if (!cancelado) setLoadingNotifications(false);
      }
    }

    carregarPreferenciasNotificacao();

    return () => {
      cancelado = true;
    };
  }, [isOpen]);

  const handleToggleDarkMode = async () => {
    setSavingDark(true);
    toggleDarkMode();
    // Simula feedback visual de "salvando"
    setTimeout(() => setSavingDark(false), 800);
  };

  const handleToggleNewTab = async () => {
    setSavingNewTab(true);
    toggleOpenCardsInNewTab();
    setTimeout(() => setSavingNewTab(false), 800);
  };

  const handleSaveNotificationPreference = async (codigo: string, nextPreference: NotificationPreference) => {
    const previous = notificationPrefs[codigo] || createNotificationPreferenceState()[codigo];

    setNotificationPrefs((prev) => ({
      ...prev,
      [codigo]: nextPreference,
    }));
    setSavingNotificationCode(codigo);

    try {
      const saved = await saveNotificationPreference(nextPreference);
      setNotificationPrefs((prev) => ({
        ...prev,
        [codigo]: saved,
      }));
    } catch (error) {
      console.error('[ConfiguracoesModal] Erro ao salvar preferência de notificação:', error);
      setNotificationPrefs((prev) => ({
        ...prev,
        [codigo]: previous,
      }));
      toast.error('Erro ao salvar preferência de notificação');
    } finally {
      setSavingNotificationCode(null);
    }
  };

  const handleChangeNotificationMode = async (codigo: string, modo: NotificationPreferenceMode) => {
    const current = notificationPrefs[codigo] || createNotificationPreferenceState()[codigo];
    const initialSelectedTeamIds = current.equipes_ids.length > 0
      ? current.equipes_ids
      : (equipeId ? [equipeId] : []);

    const nextPreference: NotificationPreference = {
      objeto_codigo: codigo,
      modo,
      equipes_ids: modo === 'selected' ? [...new Set(initialSelectedTeamIds)] : [],
    };

    await handleSaveNotificationPreference(codigo, nextPreference);
  };

  const handleToggleNotificationTeam = async (codigo: string, equipeSelecionadaId: string) => {
    const current = notificationPrefs[codigo] || createNotificationPreferenceState()[codigo];
    const currentTeams = current.equipes_ids;
    const nextTeams = currentTeams.includes(equipeSelecionadaId)
      ? currentTeams.filter((teamId) => teamId !== equipeSelecionadaId)
      : [...currentTeams, equipeSelecionadaId];

    const nextPreference: NotificationPreference = {
      objeto_codigo: codigo,
      modo: 'selected',
      equipes_ids: nextTeams,
    };

    await handleSaveNotificationPreference(codigo, nextPreference);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 z-10 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            ⚙️ Configurações
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Toggles */}
        <div className="space-y-5">
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <div className="flex-1 mr-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  Dark Mode
                </span>
                {savingDark && (
                  <span className="text-xs text-blue-500 dark:text-blue-400 animate-pulse">
                    salvando...
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Ativa o tema escuro nos componentes do sistema
              </p>
            </div>
            <button
              onClick={handleToggleDarkMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                darkMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              role="switch"
              aria-checked={darkMode}
              aria-label="Toggle Dark Mode"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Open Cards in New Tab Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <div className="flex-1 mr-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  Abrir cards em novas abas
                </span>
                {savingNewTab && (
                  <span className="text-xs text-blue-500 dark:text-blue-400 animate-pulse">
                    salvando...
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Cards do dashboard principal abrem em novas abas do navegador
              </p>
            </div>
            <button
              onClick={handleToggleNewTab}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                openCardsInNewTab ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              role="switch"
              aria-checked={openCardsInNewTab}
              aria-label="Toggle abrir cards em novas abas"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
                  openCardsInNewTab ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  Notificações por equipe
                </span>
                {(loadingNotifications || savingNotificationCode) && (
                  <span className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {loadingNotifications ? 'carregando...' : 'salvando...'}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Escolha se as notificações do sistema devem vir de todas as equipes elegíveis ou apenas das equipes que você marcar.
              </p>
            </div>

            {loadingNotifications ? (
              <div className="flex items-center justify-center py-6 text-sm text-gray-500 dark:text-gray-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando preferências de notificações...
              </div>
            ) : (
              <div className="space-y-4">
                {NOTIFICATION_PREFERENCE_DEFINITIONS.map((definition) => {
                  const pref = notificationPrefs[definition.codigo] || createNotificationPreferenceState()[definition.codigo];
                  const savingThis = savingNotificationCode === definition.codigo;

                  return (
                    <div
                      key={definition.codigo}
                      className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800/60 p-4 space-y-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                          {definition.nome}
                          {savingThis && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {definition.descricao}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name={`modo-${definition.codigo}`}
                            checked={pref.modo === 'all'}
                            disabled={savingThis}
                            onChange={() => handleChangeNotificationMode(definition.codigo, 'all')}
                            className="mt-1 h-4 w-4 text-blue-600"
                          />
                          <span>
                            <span className="font-medium">Todas as equipes elegíveis</span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                              Mantém o recebimento para qualquer equipe em que você tenha elegibilidade para este tipo de notificação.
                            </span>
                          </span>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name={`modo-${definition.codigo}`}
                            checked={pref.modo === 'selected'}
                            disabled={savingThis}
                            onChange={() => handleChangeNotificationMode(definition.codigo, 'selected')}
                            className="mt-1 h-4 w-4 text-blue-600"
                          />
                          <span>
                            <span className="font-medium">Apenas equipes selecionadas</span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                              Filtra novas notificações para as equipes marcadas abaixo. Se nada estiver marcado, você não recebe novas notificações deste tipo.
                            </span>
                          </span>
                        </label>
                      </div>

                      {pref.modo === 'selected' && (
                        <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/30 p-3">
                          {equipesDisponiveis.length === 0 ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Nenhuma equipe disponível para seleção.
                            </div>
                          ) : (
                            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                              {equipesDisponiveis.map((equipe) => (
                                <label
                                  key={equipe.id}
                                  className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={pref.equipes_ids.includes(equipe.id)}
                                    disabled={savingThis}
                                    onChange={() => handleToggleNotificationTeam(definition.codigo, equipe.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                  />
                                  <span>{equipe.nome}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-6 text-center">
          As configurações são salvas automaticamente no banco de dados.
        </p>
      </div>
    </div>
  );
}

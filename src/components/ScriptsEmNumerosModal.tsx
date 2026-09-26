import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  BarChart3,
  PenLine,
  Users,
  Shield,
  GitPullRequest,
  Building2,
  LayoutDashboard,
} from 'lucide-react';
import { useScriptStats, type SecaoStats } from '../hooks/useScriptStats';
import { StatsKPICards } from './stats/StatsKPICards';
import { StatsTopCriadoresChart } from './stats/StatsTopCriadoresChart';
import { StatsEquipesChart } from './stats/StatsEquipesChart';
import { StatsCriacaoChart } from './stats/StatsCriacaoChart';
import { StatsRevisaoChart } from './stats/StatsRevisaoChart';
import { StatsCriadoresView } from './stats/StatsCriadoresView';
import { StatsRevisoresView } from './stats/StatsRevisoresView';
import { StatsPropostasChart } from './stats/StatsPropostasChart';
import { StatsPanel } from './stats/scriptsEmNumerosLayout';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TABS: { key: SecaoStats; label: string; short: string; icon: React.ElementType }[] = [
  { key: 'visaoGeral', label: 'Visão geral', short: 'Geral', icon: LayoutDashboard },
  { key: 'criacao', label: 'Criação', short: 'Criação', icon: BarChart3 },
  { key: 'revisao', label: 'Revisão', short: 'Revisão', icon: PenLine },
  { key: 'criadores', label: 'Criadores', short: 'Autores', icon: Users },
  { key: 'revisores', label: 'Revisores', short: 'Curadores', icon: Shield },
  { key: 'propostas', label: 'Propostas', short: 'Propostas', icon: GitPullRequest },
  { key: 'equipes', label: 'Equipes', short: 'Equipes', icon: Building2 },
];

export const ScriptsEmNumerosModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const stats = useScriptStats(isOpen);
  const activeTab = TABS.find((t) => t.key === stats.secaoAtiva);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-scripts-numeros"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] bg-slate-950/50 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.995 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.995 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-100 dark:bg-slate-950"
          >
            {/* Top bar */}
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/95 sm:px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                    Scripts em Números
                  </h2>
                  <p className="hidden truncate text-xs text-slate-500 dark:text-slate-400 sm:block">
                    Painel compacto — métricas de criação, curadoria e propostas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              {/* Navigation */}
              <nav
                className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200/80 bg-white/70 px-2 py-2 dark:border-slate-800 dark:bg-slate-900/80 lg:w-[13.5rem] lg:flex-col lg:overflow-x-visible lg:border-b-0 lg:border-r lg:py-3"
                aria-label="Seções do painel"
              >
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = stats.secaoAtiva === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => stats.setSecaoAtiva(tab.key)}
                      className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all lg:w-full ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-90" />
                      <span className="whitespace-nowrap lg:whitespace-normal">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Viewport content — no page scroll */}
              <main className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={stats.secaoAtiva}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="h-full min-h-0"
                  >
                    {stats.secaoAtiva === 'visaoGeral' && (
                      <div className="flex h-full min-h-0 flex-col gap-2">
                        <StatsKPICards resumo={stats.resumo} loading={stats.loadingResumo} compact />
                        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-2">
                          <StatsPanel>
                            <StatsTopCriadoresChart
                              dados={stats.topCriadores}
                              loading={stats.loadingTopCriadores}
                            />
                          </StatsPanel>
                          <StatsPanel>
                            <StatsEquipesChart
                              dados={stats.equipesCriadoras}
                              loading={stats.loadingEquipes}
                              variant="overview"
                            />
                          </StatsPanel>
                        </div>
                      </div>
                    )}

                    {stats.secaoAtiva === 'criacao' && (
                      <StatsPanel>
                        <StatsCriacaoChart
                          dados={stats.dadosCriacao}
                          loading={stats.loadingCriacao}
                          periodo={stats.periodoCriacao}
                          setPeriodo={stats.setPeriodoCriacao}
                        />
                      </StatsPanel>
                    )}

                    {stats.secaoAtiva === 'revisao' && (
                      <StatsPanel>
                        <StatsRevisaoChart
                          dados={stats.dadosRevisao}
                          loading={stats.loadingRevisao}
                          periodo={stats.periodoRevisao}
                          setPeriodo={stats.setPeriodoRevisao}
                        />
                      </StatsPanel>
                    )}

                    {stats.secaoAtiva === 'criadores' && (
                      <StatsPanel className="min-h-0 flex-1">
                        <StatsCriadoresView
                          dados={stats.criadoresPorPeriodo}
                          loading={stats.loadingCriadores}
                          periodo={stats.periodoCriadores}
                          setPeriodo={stats.setPeriodoCriadores}
                        />
                      </StatsPanel>
                    )}

                    {stats.secaoAtiva === 'revisores' && (
                      <StatsPanel className="min-h-0 flex-1">
                        <StatsRevisoresView
                          dados={stats.topRevisores}
                          loading={stats.loadingRevisores}
                          periodo={stats.periodoRevisores}
                          setPeriodo={stats.setPeriodoRevisores}
                        />
                      </StatsPanel>
                    )}

                    {stats.secaoAtiva === 'propostas' && (
                      <StatsPanel>
                        <StatsPropostasChart
                          dados={stats.dadosPropostas}
                          loading={stats.loadingPropostas}
                          periodo={stats.periodoPropostas}
                          setPeriodo={stats.setPeriodoPropostas}
                        />
                      </StatsPanel>
                    )}

                    {stats.secaoAtiva === 'equipes' && (
                      <StatsPanel className="min-h-0 flex-1">
                        <StatsEquipesChart
                          dados={stats.equipesCriadoras}
                          loading={stats.loadingEquipes}
                          variant="detail"
                        />
                      </StatsPanel>
                    )}
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>

            {activeTab && (
              <footer className="hidden shrink-0 border-t border-slate-200/80 bg-white/80 px-4 py-1.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 sm:block">
                Seção ativa: <span className="font-medium text-slate-700 dark:text-slate-200">{activeTab.label}</span>
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

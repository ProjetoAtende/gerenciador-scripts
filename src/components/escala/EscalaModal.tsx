import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, HelpCircle, History, Loader2, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import BaseAnimatedModal from '../BaseAnimatedModal';
import { useEffectiveAuth } from '../../hooks/useEffectiveAuth';
import { escalaService } from '../../services/escalaService';
import type { EscalaAfastamento, EscalaAfastamentoTipo, EscalaAuditoriaItem, EscalaCalendario, EscalaDiaDetalhe, EscalaDiaResumo, EscalaEventoInstitucional, EscalaEventoInstitucionalTipo, EscalaMembro, EscalaMesResumo, EscalaRegistroTipo, EscalaRotinaSemanal, EscalaTurno } from '../../types/Escala';
import { EscalaHelperModal } from './EscalaHelperModal';

interface EscalaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EscalaTab = 'calendario' | 'rotinas' | 'afastamentos' | 'membros' | 'institucional';
type EscalaAfastamentosViewTab = 'cadastrar' | 'registros';
type EscalaAfastamentoPeriodoFiltro = '7' | '15' | '30' | 'all';
type EscalaAfastamentoStatusFiltro = 'ativos' | 'inativos';
type EscalaInstitucionalViewTab = 'cadastrar' | 'registros';
type EscalaInstitucionalPeriodoFiltro = '30' | '90' | '180' | 'all';

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
] as const;

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function pluralizeDias(total: number) {
  return `${total} ${total === 1 ? 'dia' : 'dias'}`;
}

function formatLongDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function dayBadgeClass(tipo: string) {
  if (tipo === 'extraordinario') return 'text-fuchsia-700 dark:text-fuchsia-300';
  if (tipo === 'ferias') return 'text-amber-700 dark:text-amber-300';
  if (tipo === 'licenca') return 'text-sky-700 dark:text-sky-300';
  if (tipo === 'folga') return 'text-emerald-700 dark:text-emerald-300';
  return 'text-cyan-700 dark:text-cyan-300';
}

function formatDisplayDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
}

function formatAfastamentoDuration(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const diff = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  return `${diff} dia${diff === 1 ? '' : 's'}`;
}

function getFirstName(fullName?: string | null, fallback = 'Você') {
  const normalized = fullName?.trim();
  if (!normalized) return fallback;
  return normalized.split(/\s+/)[0] ?? fallback;
}

function afastamentoLabel(tipo: EscalaAfastamentoTipo) {
  if (tipo === 'ferias') return 'Férias';
  if (tipo === 'licenca') return 'Licença';
  return 'Folga';
}

function eventoInstitucionalLabel(tipo: EscalaEventoInstitucionalTipo) {
  if (tipo === 'feriado') return 'Feriado';
  if (tipo === 'emenda') return 'Emenda';
  return 'Recesso';
}

function entidadeLabel(item: EscalaAuditoriaItem) {
  if (item.entidade === 'calendario') return 'Calendário';
  if (item.entidade === 'registro_dia') return 'Serviço do dia';
  if (item.entidade === 'rotina_semanal') return 'Rotina semanal';
  if (item.entidade === 'rotina_excecao') return 'Exceção de rotina';
  if (item.entidade === 'afastamento') return 'Afastamento';
  if (item.entidade === 'membro') return 'Membro';
  if (item.entidade === 'agenda_institucional') return 'Agenda institucional';
  return 'Escala';
}

function getWeekdayLabel(diaSemana: number) {
  return WEEKDAY_OPTIONS.find((item) => item.value === diaSemana)?.label ?? `Dia ${diaSemana}`;
}

function getEquipeDisplayName(equipeId?: string | null, equipeName?: string | null) {
  if (!equipeId) return 'Sem equipe';
  return equipeName?.trim() || `Equipe ${equipeId.slice(0, 8)}`;
}

function getCalendarioNome(equipeId: string, equipeName?: string | null) {
  return `Escala — ${getEquipeDisplayName(equipeId, equipeName)}`;
}

function getCalendarioDisplayTitle(calendario: EscalaCalendario | null, equipeId?: string | null, equipeName?: string | null) {
  if (!calendario || !equipeId) return 'Escala';
  return getCalendarioNome(equipeId, equipeName);
}

function buildCalendarGrid(monthDate: Date, dias: EscalaDiaResumo[]) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startWeekDay = firstDay.getDay();
  const normalizedOffset = (startWeekDay + 6) % 7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const map = new Map(dias.map((dia) => [dia.date, dia]));
  const cells: Array<{ date: string | null; resumo: EscalaDiaResumo | null }> = [];

  for (let i = 0; i < normalizedOffset; i += 1) {
    cells.push({ date: null, resumo: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day).toISOString().slice(0, 10);
    cells.push({ date, resumo: map.get(date) ?? null });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, resumo: null });
  }
  return cells;
}

function isWeekendDate(date: string) {
  const day = new Date(`${date}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

function getCalendarCellClass(date: string, hasInstitucional: boolean, isToday: boolean) {
  const weekend = isWeekendDate(date);

  if (isToday && hasInstitucional) {
    return 'border-indigo-400 bg-indigo-50/80 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-300 hover:border-indigo-500 dark:border-indigo-200/95 dark:bg-gray-900/70 dark:shadow-[0_0_0_1px_rgba(199,210,254,0.42),0_0_24px_rgba(99,102,241,0.28)] dark:ring-0 dark:hover:border-indigo-100';
  }

  if (isToday && weekend) {
    return 'border-violet-400 bg-violet-50/80 shadow-md shadow-violet-500/10 ring-1 ring-violet-300 hover:border-violet-500 dark:border-cyan-200/90 dark:bg-gray-900/70 dark:shadow-[0_0_0_1px_rgba(165,243,252,0.34),0_0_20px_rgba(34,211,238,0.2)] dark:ring-0 dark:hover:border-cyan-100';
  }

  if (isToday) {
    return 'border-cyan-400 bg-cyan-50/70 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-300 hover:border-cyan-500 dark:border-cyan-500/60 dark:bg-cyan-950/20 dark:ring-cyan-500/40';
  }

  if (hasInstitucional) {
    return 'border-indigo-300 bg-indigo-50/70 hover:border-indigo-400 hover:shadow-md dark:border-indigo-200/85 dark:bg-gray-900/70 dark:shadow-[0_0_0_1px_rgba(199,210,254,0.28),0_0_18px_rgba(99,102,241,0.18)] dark:hover:border-indigo-100';
  }

  if (weekend) {
    return 'border-violet-200 bg-violet-50/70 hover:border-violet-300 hover:shadow-md dark:border-cyan-200/70 dark:bg-gray-900/70 dark:shadow-[0_0_0_1px_rgba(165,243,252,0.22),0_0_14px_rgba(34,211,238,0.12)] dark:hover:border-cyan-100';
  }

  return 'border-gray-200 bg-white hover:border-cyan-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/70 dark:hover:border-cyan-500/30';
}

function EscalaHistoricoModal({
  isOpen,
  onClose,
  loading,
  items,
  equipeOptions,
  selectedEquipeId,
  selectedUserId,
  onEquipeChange,
  onUserChange,
  userOptions,
}: {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  items: EscalaAuditoriaItem[];
  equipeOptions: Array<[string, string]>;
  selectedEquipeId: string;
  selectedUserId: string;
  onEquipeChange: (value: string) => void;
  onUserChange: (value: string) => void;
  userOptions: EscalaMembro[];
}) {
  return (
    <BaseAnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      zIndex="z-[10005]"
      contentClassName="w-full max-w-3xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Histórico da Escala</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Últimas alterações registradas neste calendário.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Equipe</span>
            <select
              value={selectedEquipeId}
              onChange={(event) => onEquipeChange(event.target.value)}
              className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="all">Todas</option>
              {equipeOptions.map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Usuário</span>
            <select
              value={selectedUserId}
              onChange={(event) => onUserChange(event.target.value)}
              className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="all">Todos</option>
              {userOptions.map((membro) => (
                <option key={membro.user_id} value={membro.user_id}>
                  {membro.user?.nome ?? membro.user?.email ?? membro.user_id}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading && (
          <div className="flex items-center justify-center gap-3 py-16 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando histórico...
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Nenhuma alteração registrada ainda.
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">
                    {entidadeLabel(item)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(item.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {item.ator_user?.nome ?? 'Usuário'} 
                </p>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{item.resumo}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseAnimatedModal>
  );
}

function EscalaDayDetailModal({
  isOpen,
  onClose,
  detail,
  loading,
  membros,
  equipeOptions,
  onAddRegistro,
  onRemoveRegistro,
  onHandleRotinaOcorrencia,
  savingRegistro,
}: {
  isOpen: boolean;
  onClose: () => void;
  detail: EscalaDiaDetalhe | null;
  loading: boolean;
  membros: EscalaMembro[];
  equipeOptions: Array<[string, string]>;
  onAddRegistro: (userId: string, tipo: EscalaRegistroTipo) => Promise<void>;
  onRemoveRegistro: (userId: string, tipo: EscalaRegistroTipo) => Promise<void>;
  onHandleRotinaOcorrencia: (params: {
    userId: string;
    tipo: EscalaRegistroTipo;
    action: 'remove' | 'move';
    targetDate?: string;
  }) => Promise<void>;
  savingRegistro: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'visualizar' | 'editar'>('visualizar');
  const [selectedEquipeId, setSelectedEquipeId] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [routineActionKey, setRoutineActionKey] = useState<string | null>(null);
  const [routineMoveDate, setRoutineMoveDate] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('visualizar');
    setSelectedEquipeId('all');
    setSelectedUserId(membros[0]?.user_id ?? '');
    setRoutineActionKey(null);
    setRoutineMoveDate('');
  }, [isOpen, membros]);

  const weekend = detail ? isWeekendDate(detail.date) : false;
  const institutionalDay = (detail?.institucional.length ?? 0) > 0;
  const specialWorkday = weekend || institutionalDay;
  const sections = detail
    ? specialWorkday
      ? [
        { label: 'Extraordinário', items: detail.extraordinario, color: 'text-fuchsia-700 dark:text-fuchsia-300', tipo: 'extraordinario' as const },
      ]
      : [
        { label: 'Presencial', items: detail.presencial, color: 'text-cyan-700 dark:text-cyan-300', tipo: 'presencial' as const },
        { label: 'Férias', items: detail.ferias, color: 'text-amber-700 dark:text-amber-300' },
        { label: 'Licença', items: detail.licenca, color: 'text-sky-700 dark:text-sky-300' },
        { label: 'Folga', items: detail.folga, color: 'text-emerald-700 dark:text-emerald-300' },
      ]
    : [];
  const workSections = detail
    ? sections.filter(
      (section): section is { label: string; items: EscalaMembro[]; color: string; tipo: EscalaRegistroTipo } =>
        'tipo' in section,
    )
    : [];
  const visibleSections = sections.filter((section) => section.items.length > 0);
  const canRemoveItem = (item: EscalaMembro) => item.origemEscala !== 'rotina';
  const minMoveDate = detail?.date ?? '';
  const membrosFiltrados = selectedEquipeId === 'all'
    ? membros
    : membros.filter((membro) => membro.user?.equipe_id === selectedEquipeId);

  useEffect(() => {
    if (membrosFiltrados.some((membro) => membro.user_id === selectedUserId)) return;
    setSelectedUserId(membrosFiltrados[0]?.user_id ?? '');
  }, [membrosFiltrados, selectedUserId]);

  return (
    <BaseAnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      zIndex="z-[10010]"
      contentClassName="flex h-[88vh] w-[min(82vw,900px)] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Detalhe do Dia</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {detail ? formatLongDate(detail.date) : 'Carregando...'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {loading && (
          <div className="flex items-center justify-center gap-3 py-16 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando detalhe do dia...
          </div>
        )}
        {!loading && detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('visualizar')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === 'visualizar'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Visualizar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('editar')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === 'editar'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Editar
              </button>
            </div>

            {detail.institucional.length > 0 && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/20 dark:bg-indigo-950/20">
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Agenda institucional</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.institucional.map((evento) => (
                    <span
                      key={evento.id}
                      className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-gray-900/70 dark:text-indigo-200"
                    >
                      {evento.titulo}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'visualizar' && (
              <div className="space-y-4">
                {visibleSections.map((section) => (
                  <div key={section.label} className="flex w-full flex-col rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-semibold ${section.color}`}>{section.label}</p>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{section.items.length}</span>
                    </div>
                    <div className="mt-3 flex-1 space-y-2">
                      {section.items.map((item) => (
                        <div key={`${section.label}-${item.user_id}`} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.user?.nome ?? 'Usuário sem nome'}</p>
                            {item.origemEscala === 'rotina' && (
                              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200">
                                Rotina
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.turno.replace('-', ' às ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'editar' && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Adicionar pessoa ao serviço do dia</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {specialWorkday
                      ? 'Neste dia só é permitido lançar extraordinário.'
                      : 'Neste dia só é permitido lançar presencial.'}
                  </p>
                  <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(240px,1fr)_auto]">
                    <select
                      value={selectedEquipeId}
                      onChange={(event) => setSelectedEquipeId(event.target.value)}
                      className="rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    >
                      <option value="all">Todas as equipes</option>
                      {equipeOptions.map(([id, nome]) => (
                        <option key={id} value={id}>{nome}</option>
                      ))}
                    </select>
                    <select
                      value={selectedUserId}
                      onChange={(event) => setSelectedUserId(event.target.value)}
                      className="min-w-[220px] rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {membrosFiltrados.map((membro) => (
                        <option key={membro.user_id} value={membro.user_id}>
                          {membro.user?.nome ?? membro.user?.email ?? membro.user_id}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedUserId || savingRegistro}
                      onClick={() => void onAddRegistro(selectedUserId, specialWorkday ? 'extraordinario' : 'presencial')}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingRegistro ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Adicionar {specialWorkday ? 'extraordinário' : 'presencial'}
                    </button>
                  </div>
                </div>

                <div className={`grid gap-4 ${workSections.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                  {workSections.map((section) => (
                    <div key={section.label} className={`rounded-2xl border border-gray-200 p-4 dark:border-gray-700 ${workSections.length === 1 ? 'w-full' : ''}`}>
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-semibold ${section.color}`}>{section.label}</p>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{section.items.length}</span>
                      </div>
                      {section.items.length === 0 ? (
                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Nenhum registro.</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {section.items.map((item) => {
                            const actionKey = `${section.tipo}:${item.user_id}`;
                            const actionOpen = routineActionKey === actionKey;

                            return (
                            <div key={`${section.label}-edit-${item.user_id}`} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.user?.nome ?? 'Usuário sem nome'}</p>
                                    {item.origemEscala === 'rotina' && (
                                      <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200">
                                        Rotina
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.turno.replace('-', ' às ')}</p>
                                </div>
                                {canRemoveItem(item) ? (
                                  <button
                                    type="button"
                                    disabled={savingRegistro}
                                    onClick={() => void onRemoveRegistro(item.user_id, section.tipo)}
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/30 dark:text-red-300 dark:hover:bg-red-950/20"
                                    title={`Remover ${section.label.toLowerCase()}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={savingRegistro}
                                    onClick={() => {
                                      setRoutineActionKey((current) => (current === actionKey ? null : actionKey));
                                      setRoutineMoveDate('');
                                    }}
                                    className="shrink-0 rounded-full bg-gray-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-700 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                  >
                                    Ajustar este dia
                                  </button>
                                )}
                              </div>
                              {item.origemEscala === 'rotina' && actionOpen && (
                                <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-500/20 dark:bg-cyan-950/20">
                                  <p className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">Exceção da rotina</p>
                                  <p className="mt-1 text-xs leading-relaxed text-cyan-800/90 dark:text-cyan-100/80">
                                    Use esta ação para retirar {item.user?.nome ?? 'o usuário'} apenas deste dia. Se quiser, já aproveite para lançá-lo em outra data.
                                  </p>
                                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                    <div className="flex min-h-[134px] flex-col rounded-2xl border border-red-200/70 bg-white/70 p-3 dark:border-red-900/40 dark:bg-gray-900/50">
                                      <span className="mb-1.5 block text-xs font-medium text-red-700 dark:text-red-300">Excluir desta data</span>
                                      <button
                                        type="button"
                                        disabled={savingRegistro}
                                        onClick={() => void onHandleRotinaOcorrencia({
                                          userId: item.user_id,
                                          tipo: section.tipo,
                                          action: 'remove',
                                        }).then(() => {
                                          setRoutineActionKey(null);
                                          setRoutineMoveDate('');
                                        })}
                                        className="mx-auto my-auto inline-flex h-11 w-full max-w-[220px] items-center justify-center rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/30 dark:text-red-300 dark:hover:bg-red-950/20"
                                      >
                                        Excluir só deste dia
                                      </button>
                                    </div>
                                    <div className="rounded-2xl border border-cyan-200/70 bg-white/70 p-3 dark:border-cyan-800/60 dark:bg-gray-900/50">
                                      <label className="block">
                                        <span className="mb-1.5 block text-xs font-medium text-cyan-900 dark:text-cyan-100">Lançar em outra data</span>
                                        <input
                                          type="date"
                                          value={routineMoveDate}
                                          min={minMoveDate}
                                          onChange={(event) => setRoutineMoveDate(event.target.value)}
                                          className="w-full rounded-2xl border border-cyan-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-cyan-800 dark:bg-gray-900 dark:text-gray-100"
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        disabled={!routineMoveDate || savingRegistro}
                                        onClick={() => void onHandleRotinaOcorrencia({
                                          userId: item.user_id,
                                          tipo: section.tipo,
                                          action: 'move',
                                          targetDate: routineMoveDate,
                                        }).then(() => {
                                          setRoutineActionKey(null);
                                          setRoutineMoveDate('');
                                        })}
                                        className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Excluir e lançar na nova data
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )})}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </BaseAnimatedModal>
  );
}

export function EscalaModal({ isOpen, onClose }: EscalaModalProps) {
  const { user, equipeId } = useEffectiveAuth();
  const currentUserFirstName = useMemo(() => {
    const metadataName =
      (typeof user?.user_metadata?.nome === 'string' && user.user_metadata.nome) ||
      (typeof user?.user_metadata?.name === 'string' && user.user_metadata.name) ||
      (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
      null;

    return getFirstName(metadataName);
  }, [user]);
  const [helperOpen, setHelperOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tab, setTab] = useState<EscalaTab>('calendario');
  const [calendario, setCalendario] = useState<EscalaCalendario | null>(null);
  const [resumoMes, setResumoMes] = useState<EscalaMesResumo | null>(null);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [inactiveCalendarios, setInactiveCalendarios] = useState<EscalaCalendario[]>([]);
  const [inactiveCalendariosLoading, setInactiveCalendariosLoading] = useState(false);
  const [reactivatingCalendarioId, setReactivatingCalendarioId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dayDetail, setDayDetail] = useState<EscalaDiaDetalhe | null>(null);
  const [membros, setMembros] = useState<EscalaMembro[]>([]);
  const [rotinas, setRotinas] = useState<EscalaRotinaSemanal[]>([]);
  const [rotinasLoading, setRotinasLoading] = useState(false);
  const [afastamentos, setAfastamentos] = useState<EscalaAfastamento[]>([]);
  const [afastamentosLoading, setAfastamentosLoading] = useState(false);
  const [savingRotina, setSavingRotina] = useState(false);
  const [savingAfastamento, setSavingAfastamento] = useState(false);
  const [savingTurnoId, setSavingTurnoId] = useState<string | null>(null);
  const [savingRegistro, setSavingRegistro] = useState(false);
  const [auditItems, setAuditItems] = useState<EscalaAuditoriaItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [eventosInstitucionais, setEventosInstitucionais] = useState<EscalaEventoInstitucional[]>([]);
  const [eventosInstitucionaisLoading, setEventosInstitucionaisLoading] = useState(false);
  const [savingEventoInstitucional, setSavingEventoInstitucional] = useState(false);
  const [afastamentosViewTab, setAfastamentosViewTab] = useState<EscalaAfastamentosViewTab>('cadastrar');
  const [afastamentoEquipeFilter, setAfastamentoEquipeFilter] = useState('all');
  const [afastamentoUserFilter, setAfastamentoUserFilter] = useState('all');
  const [afastamentoTipoFilter, setAfastamentoTipoFilter] = useState<'all' | EscalaAfastamentoTipo>('all');
  const [afastamentoPeriodoFilter, setAfastamentoPeriodoFilter] = useState<EscalaAfastamentoPeriodoFiltro>('all');
  const [afastamentoStatusFilter, setAfastamentoStatusFilter] = useState<EscalaAfastamentoStatusFiltro>('ativos');
  const [institucionalViewTab, setInstitucionalViewTab] = useState<EscalaInstitucionalViewTab>('cadastrar');
  const [institucionalTipoFilter, setInstitucionalTipoFilter] = useState<'all' | EscalaEventoInstitucionalTipo>('all');
  const [institucionalPeriodoFilter, setInstitucionalPeriodoFilter] = useState<EscalaInstitucionalPeriodoFiltro>('all');
  const [membroEquipeFilter, setMembroEquipeFilter] = useState('all');
  const [membroUserFilter, setMembroUserFilter] = useState('all');
  const [historicoEquipeFilter, setHistoricoEquipeFilter] = useState('all');
  const [historicoUserFilter, setHistoricoUserFilter] = useState('all');
  const [equipeNames, setEquipeNames] = useState<Record<string, string>>({});
  const [formAfastamento, setFormAfastamento] = useState({
    userId: '',
    tipo: 'ferias' as EscalaAfastamentoTipo,
    dataInicio: '',
    dataFim: '',
    observacao: '',
  });
  const [formEventoInstitucional, setFormEventoInstitucional] = useState({
    tipo: 'feriado' as EscalaEventoInstitucionalTipo,
    titulo: '',
    descricao: '',
    dataInicio: '',
    dataFim: '',
  });
  const [editingEventoInstitucionalId, setEditingEventoInstitucionalId] = useState<string | null>(null);
  const [formRotina, setFormRotina] = useState({
    userId: '',
    diaSemana: 2,
    dataInicio: '',
    dataFim: '',
  });
  const [rotinaEquipeFilter, setRotinaEquipeFilter] = useState('all');
  const [rotinaUserSearch, setRotinaUserSearch] = useState('');

  const loadCalendario = useCallback(async () => {
    if (!equipeId || !user) return;
    setLoading(true);
    try {
      const found = await escalaService.getCalendarioByEquipe(equipeId);
      setCalendario(found);
      if (found) {
        const loadedMembers = await escalaService.getMembros(found.id);
        const loadedEquipeNames = await escalaService.getEquipeNamesByIds(
          loadedMembers.map((member) => member.user?.equipe_id ?? '').filter(Boolean),
        );
        const currentMember = loadedMembers.find((member) => member.user_id === user.id);
        const currentMemberFirstName = getFirstName(currentMember?.user?.nome, currentUserFirstName);
        const summary = await escalaService.getMonthSummary(found, user.id, monthDate, currentMemberFirstName);
        setResumoMes(summary);
        setMembros(loadedMembers);
        setEquipeNames(loadedEquipeNames);
        setInactiveCalendarios([]);
      } else {
        setResumoMes(null);
        setMembros([]);
        setEquipeNames({});
        setInactiveCalendariosLoading(true);
        try {
          const inactive = await escalaService.listInactiveCalendariosByEquipe(equipeId);
          setInactiveCalendarios(inactive);
        } finally {
          setInactiveCalendariosLoading(false);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar escala:', error);
      toast.error('Não foi possível carregar a Escala.');
    } finally {
      setLoading(false);
    }
  }, [currentUserFirstName, equipeId, monthDate, user]);

  const loadAfastamentos = useCallback(async () => {
    if (!calendario) return;
    setAfastamentosLoading(true);
    try {
      const data = await escalaService.listAfastamentos(calendario.id);
      setAfastamentos(data);
    } catch (error) {
      console.error('Erro ao carregar afastamentos:', error);
      toast.error('Não foi possível carregar os afastamentos.');
    } finally {
      setAfastamentosLoading(false);
    }
  }, [calendario]);

  const loadRotinas = useCallback(async () => {
    if (!calendario) return;
    setRotinasLoading(true);
    try {
      const data = await escalaService.listRotinasSemanais(calendario.id);
      setRotinas(data);
    } catch (error) {
      console.error('Erro ao carregar rotinas semanais:', error);
      toast.error('Não foi possível carregar as rotinas semanais.');
    } finally {
      setRotinasLoading(false);
    }
  }, [calendario]);

  const loadEventosInstitucionais = useCallback(async () => {
    setEventosInstitucionaisLoading(true);
    try {
      const data = await escalaService.listAgendaInstitucional();
      setEventosInstitucionais(data);
    } catch (error) {
      console.error('Erro ao carregar agenda institucional:', error);
      toast.error('Não foi possível carregar a agenda institucional.');
    } finally {
      setEventosInstitucionaisLoading(false);
    }
  }, []);

  const loadAuditoria = useCallback(async () => {
    if (!calendario) return;
    setAuditLoading(true);
    try {
      const data = await escalaService.listAuditoria(calendario.id);
      setAuditItems(data);
    } catch (error) {
      console.error('Erro ao carregar auditoria da escala:', error);
      toast.error('Não foi possível carregar o histórico da Escala.');
    } finally {
      setAuditLoading(false);
    }
  }, [calendario]);

  useEffect(() => {
    if (!isOpen) return;
    void loadCalendario();
  }, [isOpen, loadCalendario]);

  useEffect(() => {
    if (tab !== 'rotinas' || !calendario) return;
    void loadRotinas();
  }, [calendario, loadRotinas, tab]);

  useEffect(() => {
    if (tab !== 'afastamentos' || !calendario) return;
    void loadAfastamentos();
  }, [calendario, loadAfastamentos, tab]);

  useEffect(() => {
    if (tab !== 'institucional') return;
    void loadEventosInstitucionais();
  }, [loadEventosInstitucionais, tab]);

  useEffect(() => {
    if (!historyOpen || !calendario) return;
    void loadAuditoria();
  }, [calendario, historyOpen, loadAuditoria]);

  const handleCreateCalendar = useCallback(async () => {
    if (!equipeId || !user) return;
    setCreating(true);
    try {
      const created = await escalaService.createCalendario({
        nome: getCalendarioNome(equipeId, equipeNames[equipeId]),
        equipeId,
        userId: user.id,
      });
      setCalendario(created);
      toast.success('Calendário de escala criado com sucesso.');
      const loadedMembers = await escalaService.getMembros(created.id);
      const loadedEquipeNames = await escalaService.getEquipeNamesByIds(
        loadedMembers.map((member) => member.user?.equipe_id ?? '').filter(Boolean),
      );
      const summary = await escalaService.getMonthSummary(created, user.id, monthDate, currentUserFirstName);
      setResumoMes(summary);
      setMembros(loadedMembers);
      setEquipeNames(loadedEquipeNames);
      setInactiveCalendarios([]);
    } catch (error) {
      console.error('Erro ao criar calendário:', error);
      toast.error('Não foi possível criar o calendário da equipe.');
    } finally {
      setCreating(false);
    }
  }, [currentUserFirstName, equipeId, equipeNames, monthDate, user]);

  const handleDeactivateCalendar = useCallback(async () => {
    if (!calendario || !user) return;

    const confirmed = window.confirm(
      'Deseja desativar este calendário? Os registros próprios dele ficarão ocultos para a equipe, mas a Agenda Institucional continuará disponível.',
    );
    if (!confirmed) return;

    setDeactivating(true);
    try {
      await escalaService.deactivateCalendario(calendario.id, user.id);
      setCalendario(null);
      setResumoMes(null);
      setMembros([]);
      setRotinas([]);
      setAfastamentos([]);
      setAuditItems([]);
      setDayDetail(null);
      setDetailOpen(false);
      if (equipeId) {
        const inactive = await escalaService.listInactiveCalendariosByEquipe(equipeId);
        setInactiveCalendarios(inactive);
      }
      toast.success('Calendário desativado. Agora a equipe pode criar um novo calendário ativo.');
    } catch (error) {
      console.error('Erro ao desativar calendário:', error);
      toast.error('Não foi possível desativar o calendário.');
    } finally {
      setDeactivating(false);
    }
  }, [calendario, equipeId, user]);

  const handleReactivateCalendar = useCallback(async (calendarioId: string) => {
    if (!user || !equipeId) return;
    setReactivatingCalendarioId(calendarioId);
    try {
      await escalaService.reactivateCalendario(calendarioId, user.id);
      toast.success('Calendário reativado com sucesso.');
      await loadCalendario();
    } catch (error) {
      console.error('Erro ao reativar calendário:', error);
      toast.error('Não foi possível reativar o calendário.');
    } finally {
      setReactivatingCalendarioId(null);
    }
  }, [equipeId, loadCalendario, user]);

  const openDayDetail = useCallback(async (date: string) => {
    if (!calendario) return;
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await escalaService.getDayDetail(calendario.id, date);
      setDayDetail(detail);
    } catch (error) {
      console.error('Erro ao carregar detalhe do dia:', error);
      toast.error('Não foi possível abrir o detalhe deste dia.');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, [calendario]);

  const refreshDayDetail = useCallback(async (date: string) => {
    if (!calendario) return;
    const detail = await escalaService.getDayDetail(calendario.id, date);
    setDayDetail(detail);
  }, [calendario]);

  const resetAfastamentoForm = useCallback(() => {
    setFormAfastamento({
      userId: membros[0]?.user_id ?? '',
      tipo: 'ferias',
      dataInicio: '',
      dataFim: '',
      observacao: '',
    });
  }, [membros]);

  useEffect(() => {
    if (membros.length === 0) return;
    setFormAfastamento((current) => ({
      ...current,
      userId: current.userId || membros[0].user_id,
    }));
    setFormRotina((current) => ({
      ...current,
      userId: current.userId || membros[0].user_id,
    }));
  }, [membros]);

  const resetRotinaForm = useCallback(() => {
    setFormRotina({
      userId: membros[0]?.user_id ?? '',
      diaSemana: 2,
      dataInicio: '',
      dataFim: '',
    });
  }, [membros]);

  const handleSubmitAfastamento = useCallback(async () => {
    if (!calendario || !user) return;
    if (!formAfastamento.userId || !formAfastamento.dataInicio || !formAfastamento.dataFim) {
      toast.error('Selecione o usuário e preencha a data inicial e final.');
      return;
    }

    setSavingAfastamento(true);
    try {
      await escalaService.createAfastamento({
        calendarioId: calendario.id,
        userId: formAfastamento.userId,
        tipo: formAfastamento.tipo,
        dataInicio: formAfastamento.dataInicio,
        dataFim: formAfastamento.dataFim,
        observacao: formAfastamento.observacao || null,
        criadoPor: user.id,
      });
      toast.success('Afastamento registrado com sucesso.');
      resetAfastamentoForm();
      await Promise.all([loadAfastamentos(), loadCalendario()]);
    } catch (error) {
      console.error('Erro ao salvar afastamento:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar o afastamento.');
    } finally {
      setSavingAfastamento(false);
    }
  }, [calendario, formAfastamento, loadAfastamentos, loadCalendario, resetAfastamentoForm, user]);

  const handleSubmitRotina = useCallback(async () => {
    if (!calendario || !user) return;
    if (!formRotina.userId || !formRotina.dataInicio) {
      toast.error('Selecione o usuário e informe a data inicial da rotina.');
      return;
    }

    setSavingRotina(true);
    try {
      await escalaService.createRotinaSemanal({
        calendarioId: calendario.id,
        userId: formRotina.userId,
        tipo: 'presencial',
        diaSemana: formRotina.diaSemana,
        dataInicio: formRotina.dataInicio,
        dataFim: formRotina.dataFim || null,
        criadoPor: user.id,
      });
      toast.success('Rotina semanal registrada com sucesso.');
      resetRotinaForm();
      await Promise.all([loadRotinas(), loadCalendario()]);
      if (dayDetail) {
        await refreshDayDetail(dayDetail.date);
      }
    } catch (error) {
      console.error('Erro ao salvar rotina semanal:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a rotina semanal.');
    } finally {
      setSavingRotina(false);
    }
  }, [calendario, dayDetail, formRotina, loadCalendario, loadRotinas, refreshDayDetail, resetRotinaForm, user]);

  const handleDeleteRotina = useCallback(async (rotinaId: string) => {
    if (!user) return;
    try {
      await escalaService.deleteRotinaSemanal(rotinaId, user.id);
      toast.success('Rotina semanal removida com sucesso.');
      await Promise.all([loadRotinas(), loadCalendario()]);
      if (dayDetail) {
        await refreshDayDetail(dayDetail.date);
      }
    } catch (error) {
      console.error('Erro ao remover rotina semanal:', error);
      toast.error('Não foi possível remover a rotina semanal.');
    }
  }, [dayDetail, loadCalendario, loadRotinas, refreshDayDetail, user]);

  const handleDeleteAfastamento = useCallback(async (afastamentoId: string) => {
    if (!user) return;
    try {
      await escalaService.deleteAfastamento(afastamentoId, user.id);
      toast.success('Afastamento removido com sucesso.');
      await Promise.all([loadAfastamentos(), loadCalendario()]);
    } catch (error) {
      console.error('Erro ao remover afastamento:', error);
      toast.error('Não foi possível remover o afastamento.');
    }
  }, [loadAfastamentos, loadCalendario, user]);

  const handleTurnoChange = useCallback(async (membroId: string, turno: EscalaTurno) => {
    if (!user) return;
    setSavingTurnoId(membroId);
    try {
      const updated = await escalaService.updateTurnoMembro(membroId, turno, user.id);
      setMembros((current) => current.map((item) => (item.id === membroId ? updated : item)));
      setDayDetail((current) => {
        if (!current) return current;
        const updateSection = (items: EscalaMembro[]) => items.map((item) => (item.id === membroId ? updated : item));
        return {
          ...current,
          presencial: updateSection(current.presencial),
          extraordinario: updateSection(current.extraordinario),
          ferias: updateSection(current.ferias),
          licenca: updateSection(current.licenca),
          folga: updateSection(current.folga),
        };
      });
      toast.success('Turno atualizado com sucesso.');
    } catch (error) {
      console.error('Erro ao atualizar turno:', error);
      toast.error('Não foi possível atualizar o turno.');
    } finally {
      setSavingTurnoId(null);
    }
  }, [user]);

  const handleAddRegistroDia = useCallback(async (userId: string, tipo: EscalaRegistroTipo) => {
    if (!calendario || !user || !dayDetail) return;
    setSavingRegistro(true);
    try {
      await escalaService.createRegistroDia({
        calendarioId: calendario.id,
        userId,
        data: dayDetail.date,
        tipo,
        criadoPor: user.id,
      });
      toast.success('Registro do dia salvo com sucesso.');
      await Promise.all([refreshDayDetail(dayDetail.date), loadCalendario()]);
    } catch (error) {
      console.error('Erro ao salvar registro do dia:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o registro do dia.');
    } finally {
      setSavingRegistro(false);
    }
  }, [calendario, dayDetail, loadCalendario, refreshDayDetail, user]);

  const handleRemoveRegistroDia = useCallback(async (userId: string, tipo: EscalaRegistroTipo) => {
    if (!dayDetail || !user) return;
    const list = tipo === 'presencial' ? dayDetail.presencial : dayDetail.extraordinario;
    const target = list.find((item) => item.user_id === userId);
    if (!target) {
      toast.error('Registro não encontrado para remoção.');
      return;
    }

    setSavingRegistro(true);
    try {
      const registroId = await escalaService.findRegistroDiaId({
        calendarioId: calendario?.id ?? '',
        userId,
        data: dayDetail.date,
        tipo,
      });
      if (!registroId) throw new Error('Registro do dia não encontrado.');

      await escalaService.deleteRegistroDia(registroId, user.id);
      toast.success('Registro do dia removido com sucesso.');
      await Promise.all([refreshDayDetail(dayDetail.date), loadCalendario()]);
    } catch (error) {
      console.error('Erro ao remover registro do dia:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover o registro do dia.');
    } finally {
      setSavingRegistro(false);
    }
  }, [calendario?.id, dayDetail, loadCalendario, refreshDayDetail, user]);

  const handleRotinaOcorrencia = useCallback(async (params: {
    userId: string;
    tipo: EscalaRegistroTipo;
    action: 'remove' | 'move';
    targetDate?: string;
  }) => {
    if (!calendario || !dayDetail || !user) return;

    const { userId, tipo, action, targetDate } = params;
    if (action === 'move') {
      if (!targetDate) {
        toast.error('Informe a nova data para fazer a troca.');
        return;
      }
      if (targetDate === dayDetail.date) {
        toast.error('A nova data deve ser diferente do dia atual.');
        return;
      }
    }

    setSavingRegistro(true);
    try {
      if (action === 'remove') {
        await escalaService.createRotinaExcecao({
          calendarioId: calendario.id,
          userId,
          data: dayDetail.date,
          tipo,
          criadoPor: user.id,
        });
        toast.success('Pessoa retirada apenas deste dia. A rotina semanal foi preservada.');
      } else {
        await escalaService.moverOcorrenciaRotina({
          calendarioId: calendario.id,
          userId,
          dataOrigem: dayDetail.date,
          dataDestino: targetDate!,
          tipoOrigem: tipo,
          tipoDestino: isWeekendDate(targetDate!) ? 'extraordinario' : 'presencial',
          criadoPor: user.id,
        });
        toast.success('Pessoa removida deste dia e lançada na nova data com sucesso.');
      }

      await Promise.all([refreshDayDetail(dayDetail.date), loadCalendario(), loadAuditoria()]);
    } catch (error) {
      console.error('Erro ao ajustar ocorrência de rotina:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível ajustar a ocorrência da rotina.');
    } finally {
      setSavingRegistro(false);
    }
  }, [calendario, dayDetail, loadAuditoria, loadCalendario, refreshDayDetail, user]);

  const resetEventoInstitucionalForm = useCallback(() => {
    setEditingEventoInstitucionalId(null);
    setFormEventoInstitucional({
      tipo: 'feriado',
      titulo: '',
      descricao: '',
      dataInicio: '',
      dataFim: '',
    });
  }, []);

  const handleSubmitEventoInstitucional = useCallback(async () => {
    if (!user) return;
    if (!formEventoInstitucional.titulo || !formEventoInstitucional.dataInicio || !formEventoInstitucional.dataFim) {
      toast.error('Informe o título e as datas do evento institucional.');
      return;
    }

    setSavingEventoInstitucional(true);
    try {
      if (editingEventoInstitucionalId) {
        await escalaService.updateEventoInstitucional({
          eventoId: editingEventoInstitucionalId,
          tipo: formEventoInstitucional.tipo,
          titulo: formEventoInstitucional.titulo,
          descricao: formEventoInstitucional.descricao || null,
          dataInicio: formEventoInstitucional.dataInicio,
          dataFim: formEventoInstitucional.dataFim,
          atualizadoPor: user.id,
        });
        toast.success('Evento institucional atualizado com sucesso.');
      } else {
        await escalaService.createEventoInstitucional({
          tipo: formEventoInstitucional.tipo,
          titulo: formEventoInstitucional.titulo,
          descricao: formEventoInstitucional.descricao || null,
          dataInicio: formEventoInstitucional.dataInicio,
          dataFim: formEventoInstitucional.dataFim,
          criadoPor: user.id,
        });
        toast.success('Evento institucional registrado com sucesso.');
      }
      resetEventoInstitucionalForm();
      await Promise.all([loadEventosInstitucionais(), loadCalendario()]);
      if (dayDetail) {
        await refreshDayDetail(dayDetail.date);
      }
    } catch (error) {
      console.error('Erro ao salvar evento institucional:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o evento institucional.');
    } finally {
      setSavingEventoInstitucional(false);
    }
  }, [dayDetail, editingEventoInstitucionalId, formEventoInstitucional, loadCalendario, loadEventosInstitucionais, refreshDayDetail, resetEventoInstitucionalForm, user]);

  const handleEditEventoInstitucional = useCallback((evento: EscalaEventoInstitucional) => {
    setInstitucionalViewTab('cadastrar');
    setEditingEventoInstitucionalId(evento.id);
    setFormEventoInstitucional({
      tipo: evento.tipo,
      titulo: evento.titulo,
      descricao: evento.descricao ?? '',
      dataInicio: evento.data_inicio,
      dataFim: evento.data_fim,
    });
  }, []);

  const handleDeleteEventoInstitucional = useCallback(async (eventoId: string) => {
    if (!user) return;
    try {
      await escalaService.deleteEventoInstitucional(eventoId, user.id);
      toast.success('Evento institucional removido com sucesso.');
      await Promise.all([loadEventosInstitucionais(), loadCalendario()]);
      if (dayDetail) {
        await refreshDayDetail(dayDetail.date);
      }
    } catch (error) {
      console.error('Erro ao remover evento institucional:', error);
      toast.error('Não foi possível remover o evento institucional.');
    }
  }, [dayDetail, loadCalendario, loadEventosInstitucionais, refreshDayDetail, user]);

  const calendarGrid = useMemo(
    () => buildCalendarGrid(monthDate, resumoMes?.dias ?? []),
    [monthDate, resumoMes],
  );

  const headerLastChange = resumoMes?.ultimaAlteracao
    ? `${resumoMes.ultimaAlteracao.ator_user?.nome ?? 'Usuário'} · ${new Date(resumoMes.ultimaAlteracao.created_at).toLocaleString('pt-BR')}`
    : 'Sem alterações registradas ainda';

  const membroByUserId = useMemo(() => {
    return membros.reduce<Record<string, EscalaMembro>>((acc, membro) => {
      acc[membro.user_id] = membro;
      return acc;
    }, {});
  }, [membros]);

  const afastamentoFiltered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = today.toISOString().slice(0, 10);

    return afastamentos.filter((item) => {
      const member = membroByUserId[item.user_id];
      const equipeId = member?.user?.equipe_id ?? null;

      if (afastamentoEquipeFilter !== 'all' && equipeId !== afastamentoEquipeFilter) return false;
      if (afastamentoUserFilter !== 'all' && item.user_id !== afastamentoUserFilter) return false;
      if (afastamentoTipoFilter !== 'all' && item.tipo !== afastamentoTipoFilter) return false;
      if (afastamentoStatusFilter === 'ativos' && item.data_fim < todayDate) return false;
      if (afastamentoStatusFilter === 'inativos' && item.data_fim >= todayDate) return false;

      if (afastamentoPeriodoFilter !== 'all') {
        const limitDate = new Date(today);
        limitDate.setDate(limitDate.getDate() + Number(afastamentoPeriodoFilter));
        const itemStart = new Date(`${item.data_inicio}T00:00:00`);
        const itemEnd = new Date(`${item.data_fim}T00:00:00`);
        if (itemEnd < today || itemStart > limitDate) return false;
      }

      return true;
    });
  }, [afastamentoEquipeFilter, afastamentoPeriodoFilter, afastamentoStatusFilter, afastamentoTipoFilter, afastamentoUserFilter, afastamentos, membroByUserId]);

  const afastamentoSummary = useMemo(() => {
    return afastamentoFiltered.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.tipo] += 1;
        return acc;
      },
      { total: 0, ferias: 0, licenca: 0, folga: 0 },
    );
  }, [afastamentoFiltered]);

  const equipeOptions = useMemo(() => {
    return Object.entries(
      membros.reduce<Record<string, string>>((acc, membro) => {
        const equipeId = membro.user?.equipe_id;
        if (!equipeId) return acc;
        acc[equipeId] = getEquipeDisplayName(equipeId, equipeNames[equipeId]);
        return acc;
      }, {}),
    ).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [equipeNames, membros]);

  const filteredMembrosForAfastamentoUser = useMemo(() => {
    if (afastamentoEquipeFilter === 'all') return membros;
    return membros.filter((membro) => membro.user?.equipe_id === afastamentoEquipeFilter);
  }, [afastamentoEquipeFilter, membros]);

  const membrosFiltered = useMemo(() => {
    return membros.filter((membro) => {
      if (membroEquipeFilter !== 'all' && membro.user?.equipe_id !== membroEquipeFilter) return false;
      if (membroUserFilter !== 'all' && membro.user_id !== membroUserFilter) return false;
      return true;
    });
  }, [membroEquipeFilter, membroUserFilter, membros]);

  const filteredMembrosForMembroUser = useMemo(() => {
    if (membroEquipeFilter === 'all') return membros;
    return membros.filter((membro) => membro.user?.equipe_id === membroEquipeFilter);
  }, [membroEquipeFilter, membros]);

  const auditItemsFiltered = useMemo(() => {
    return auditItems.filter((item) => {
      const atorMembro = membros.find((membro) => membro.user_id === item.ator_user_id);
      const equipeId = atorMembro?.user?.equipe_id ?? null;
      if (historicoEquipeFilter !== 'all' && equipeId !== historicoEquipeFilter) return false;
      if (historicoUserFilter !== 'all' && item.ator_user_id !== historicoUserFilter) return false;
      return true;
    });
  }, [auditItems, historicoEquipeFilter, historicoUserFilter, membros]);

  const filteredMembrosForHistoricoUser = useMemo(() => {
    if (historicoEquipeFilter === 'all') return membros;
    return membros.filter((membro) => membro.user?.equipe_id === historicoEquipeFilter);
  }, [historicoEquipeFilter, membros]);

  useEffect(() => {
    if (afastamentoUserFilter !== 'all' && !filteredMembrosForAfastamentoUser.some((membro) => membro.user_id === afastamentoUserFilter)) {
      setAfastamentoUserFilter('all');
    }
  }, [afastamentoUserFilter, filteredMembrosForAfastamentoUser]);

  useEffect(() => {
    if (membroUserFilter !== 'all' && !filteredMembrosForMembroUser.some((membro) => membro.user_id === membroUserFilter)) {
      setMembroUserFilter('all');
    }
  }, [filteredMembrosForMembroUser, membroUserFilter]);

  useEffect(() => {
    if (historicoUserFilter !== 'all' && !filteredMembrosForHistoricoUser.some((membro) => membro.user_id === historicoUserFilter)) {
      setHistoricoUserFilter('all');
    }
  }, [filteredMembrosForHistoricoUser, historicoUserFilter]);

  const institucionalFiltered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return eventosInstitucionais.filter((item) => {
      if (institucionalTipoFilter !== 'all' && item.tipo !== institucionalTipoFilter) return false;

      if (institucionalPeriodoFilter !== 'all') {
        const limitDate = new Date(today);
        limitDate.setDate(limitDate.getDate() + Number(institucionalPeriodoFilter));
        const itemStart = new Date(`${item.data_inicio}T00:00:00`);
        const itemEnd = new Date(`${item.data_fim}T00:00:00`);
        if (itemEnd < today || itemStart > limitDate) return false;
      }

      return true;
    });
  }, [eventosInstitucionais, institucionalPeriodoFilter, institucionalTipoFilter]);

  const institucionalSummary = useMemo(() => {
    return institucionalFiltered.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.tipo] += 1;
        return acc;
      },
      { total: 0, feriado: 0, emenda: 0, recesso: 0 },
    );
  }, [institucionalFiltered]);

  const filteredMembrosForRotinaUser = useMemo(() => {
    if (rotinaEquipeFilter === 'all') return membros;
    return membros.filter((membro) => membro.user?.equipe_id === rotinaEquipeFilter);
  }, [membros, rotinaEquipeFilter]);

  const rotinaFiltered = useMemo(() => {
    const term = rotinaUserSearch.trim().toLocaleLowerCase('pt-BR');
    return rotinas.filter((rotina) => {
      if (rotinaEquipeFilter !== 'all' && rotina.user?.equipe_id !== rotinaEquipeFilter) return false;
      const nome = rotina.user?.nome?.toLocaleLowerCase('pt-BR') ?? '';
      const email = rotina.user?.email?.toLocaleLowerCase('pt-BR') ?? '';
      if (!term) return true;
      return nome.includes(term) || email.includes(term);
    });
  }, [rotinaEquipeFilter, rotinaUserSearch, rotinas]);

  const renderCalendarioTab = () => {
    if (loading) {
      return (
        <div className="flex min-h-[420px] items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando calendário...
        </div>
      );
    }

    if (!calendario || !resumoMes) {
      return (
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="grid w-full max-w-5xl gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <div className="rounded-3xl border border-dashed border-cyan-300 bg-cyan-50/70 p-8 text-center dark:border-cyan-500/20 dark:bg-cyan-950/10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-cyan-600 shadow-sm dark:bg-gray-900 dark:text-cyan-300">
                <CalendarDays className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Sua equipe ainda não possui uma escala ativa</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Qualquer usuário pode criar um novo calendário ativo para a equipe. Se preferir, você também pode reativar um calendário antigo logo ao lado.
              </p>
              <button
                type="button"
                onClick={() => void handleCreateCalendar()}
                disabled={creating}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Criar novo calendário
              </button>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/70">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reativar calendário antigo</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Escolha um calendário inativo para voltar a usá-lo. O nome abaixo é o nome técnico salvo no banco para facilitar a diferenciação.
              </p>

              <div className="mt-5 space-y-3">
                {inactiveCalendariosLoading ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando calendários inativos...
                  </div>
                ) : null}

                {!inactiveCalendariosLoading && inactiveCalendarios.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Nenhum calendário inativo encontrado para esta equipe.
                  </div>
                ) : null}

                {!inactiveCalendariosLoading && inactiveCalendarios.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-gray-900 dark:text-gray-100">{item.nome}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                          <span>Criado em {new Date(item.created_at).toLocaleString('pt-BR')}</span>
                          <span>
                            Desativado em {item.desativado_em ? new Date(item.desativado_em).toLocaleString('pt-BR') : 'não informado'}
                          </span>
                          <span>Última alteração em {new Date(item.updated_at).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleReactivateCalendar(item.id)}
                        disabled={reactivatingCalendarioId === item.id}
                        className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-500/30 dark:bg-cyan-950/20 dark:text-cyan-200 dark:hover:bg-cyan-950/30"
                      >
                        {reactivatingCalendarioId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reativar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    const todayDate = new Date().toISOString().slice(0, 10);

    return (
      <div className="space-y-5">
        {resumoMes.proximosAfastamentos.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Próximos afastamentos na janela de 7 dias</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {resumoMes.proximosAfastamentos.map((item) => (
                <span
                  key={item.id}
                  className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-gray-900/70 dark:text-amber-200"
                >
                  {(item.user?.nome?.trim() || item.user?.email?.trim() || 'Sem nome')} · {item.tipo === 'ferias' ? 'Férias' : item.tipo === 'licenca' ? 'Licença' : 'Folga'} em {new Date(`${item.data_inicio}T00:00:00`).toLocaleDateString('pt-BR')}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-7 gap-3">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((label) => (
            <div key={label} className="px-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
              {label}
            </div>
          ))}
          {calendarGrid.map((cell, index) => (
            <button
              type="button"
              key={cell.date ?? `empty-${index}`}
              disabled={!cell.date}
              onClick={() => cell.date && void openDayDetail(cell.date)}
              className={`min-h-[128px] rounded-2xl border p-3 text-left transition ${
                cell.date
                  ? getCalendarCellClass(
                    cell.date,
                    (cell.resumo?.institucional?.length ?? 0) > 0,
                    cell.date === todayDate,
                  )
                  : 'border-transparent bg-transparent'
              }`}
            >
              {cell.date && (
                <>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-semibold ${
                        (cell.resumo?.institucional?.length ?? 0) > 0
                          ? 'text-indigo-900 dark:text-indigo-100'
                          : isWeekendDate(cell.date)
                            ? 'text-violet-900 dark:text-violet-100'
                            : cell.date === todayDate
                              ? 'text-cyan-900 dark:text-cyan-100'
                              : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {Number(cell.date.slice(-2))}
                    </span>
                    {cell.date === todayDate && (
                      <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                        Hoje
                      </span>
                    )}
                    {cell.resumo?.institucional?.length ? (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                        TJSP
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200">
                      P {cell.resumo?.presencialCount ?? 0}
                    </span>
                    <span className="rounded-full bg-fuchsia-100 px-2 py-1 text-[11px] font-semibold text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200">
                      E {cell.resumo?.extraordinarioCount ?? 0}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                      A {cell.resumo?.afastamentosCount ?? 0}
                    </span>
                  </div>
                  <div className="mt-4 space-y-1">
                    {(cell.resumo?.currentUserLabels ?? []).map((label, labelIndex) => (
                      <p
                        key={`${cell.date}-${labelIndex}`}
                        className={`text-sm leading-tight ${label.destaque ? 'font-extrabold tracking-[0.01em]' : 'font-semibold'} ${dayBadgeClass(label.tipo)}`}
                      >
                        {label.texto}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderRotinasTab = () => {
    if (!calendario) {
      return (
        <div className="rounded-3xl border border-dashed border-gray-300 p-8 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
          Crie primeiro um calendário para começar a registrar rotinas semanais.
        </div>
      );
    }

    return (
      <div className="grid gap-5 xl:min-h-[calc(88vh-165px)] xl:grid-cols-[420px,minmax(0,1fr)] xl:items-start">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 xl:sticky xl:top-0 dark:border-gray-700 dark:bg-gray-900/70">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nova rotina semanal</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Use esta aba para repetir um presencial em todas as ocorrências de um mesmo dia da semana dentro de um período. A data inicial é obrigatória e a data final é opcional.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Usuário</span>
              <select
                value={formRotina.userId}
                onChange={(event) => setFormRotina((current) => ({ ...current, userId: event.target.value }))}
                className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                {membros.map((membro) => (
                  <option key={membro.user_id} value={membro.user_id}>
                    {membro.user?.nome ?? membro.user?.email ?? membro.user_id}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Dia da semana</span>
              <select
                value={formRotina.diaSemana}
                onChange={(event) => setFormRotina((current) => ({ ...current, diaSemana: Number(event.target.value) }))}
                className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                {WEEKDAY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Data inicial</span>
                <input
                  type="date"
                  value={formRotina.dataInicio}
                  onChange={(event) => setFormRotina((current) => ({ ...current, dataInicio: event.target.value }))}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Data final</span>
                <input
                  type="date"
                  value={formRotina.dataFim}
                  onChange={(event) => setFormRotina((current) => ({ ...current, dataFim: event.target.value }))}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-xs leading-relaxed text-cyan-900 dark:border-cyan-500/20 dark:bg-cyan-950/20 dark:text-cyan-100/90">
              A rotina semanal cria a base recorrente do presencial. A data inicial é obrigatória. Se a data final ficar em branco, a rotina continua valendo até ser removida. Ajustes pontuais continuam podendo ser feitos no detalhe de cada dia.
            </div>

            <button
              type="button"
              onClick={() => void handleSubmitRotina()}
              disabled={savingRotina || membros.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingRotina ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Registrar rotina
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/70 xl:flex xl:h-[calc(88vh-165px)] xl:flex-col">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Rotinas cadastradas</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Cada rotina vale para todas as semanas do período informado.
              </p>
            </div>
            {rotinasLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-500 dark:text-gray-400" />}
          </div>

          <div className="mt-5 space-y-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Equipe</span>
                <select
                  value={rotinaEquipeFilter}
                  onChange={(event) => setRotinaEquipeFilter(event.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="all">Todas as equipes</option>
                  {equipeOptions.map(([id, nome]) => (
                    <option key={id} value={id}>{nome}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Buscar usuário nas rotinas cadastradas</span>
                <input
                  type="text"
                  value={rotinaUserSearch}
                  onChange={(event) => setRotinaUserSearch(event.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  placeholder={filteredMembrosForRotinaUser.length > 0 ? 'Buscar por nome ou e-mail' : 'Nenhum membro na equipe selecionada'}
                />
              </label>
            </div>

            {!rotinasLoading && rotinas.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Nenhuma rotina semanal cadastrada até agora.
              </div>
            )}

            {!rotinasLoading && rotinas.length > 0 && rotinaFiltered.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Nenhuma rotina encontrada para a busca informada.
              </div>
            )}

            <div className="space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
              {rotinaFiltered.map((rotina) => (
                <div key={rotina.id} className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{rotina.user?.nome ?? 'Usuário sem nome'}</p>
                        <span className="rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200">
                          {getWeekdayLabel(rotina.dia_semana)}
                        </span>
                        <span className="rounded-full bg-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                          {getEquipeDisplayName(rotina.user?.equipe_id ?? '', equipeNames[rotina.user?.equipe_id ?? ''])}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {formatDisplayDate(rotina.data_inicio)} até {rotina.data_fim ? formatDisplayDate(rotina.data_fim) : 'sem data final'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteRotina(rotina.id)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-600 transition hover:bg-red-50 dark:border-red-900/30 dark:text-red-300 dark:hover:bg-red-950/20"
                      title="Remover rotina semanal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAfastamentosTab = () => {
    if (!calendario) {
      return (
        <div className="rounded-3xl border border-dashed border-gray-300 p-8 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
          Crie primeiro um calendário para começar a registrar afastamentos.
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'cadastrar', label: 'Cadastrar' },
            { id: 'registros', label: 'Registros' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAfastamentosViewTab(item.id as EscalaAfastamentosViewTab)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                afastamentosViewTab === item.id
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {afastamentosViewTab === 'cadastrar' && (
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/70">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Novo afastamento</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Registre férias, licença ou folga sempre com data inicial e final.
              </p>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Usuário</span>
                  <select
                    value={formAfastamento.userId}
                    onChange={(event) => setFormAfastamento((current) => ({ ...current, userId: event.target.value }))}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    {membros.map((membro) => (
                      <option key={membro.user_id} value={membro.user_id}>
                        {membro.user?.nome ?? membro.user?.email ?? membro.user_id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</span>
                  <select
                    value={formAfastamento.tipo}
                    onChange={(event) => setFormAfastamento((current) => ({ ...current, tipo: event.target.value as EscalaAfastamentoTipo }))}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="ferias">Férias</option>
                    <option value="licenca">Licença</option>
                    <option value="folga">Folga</option>
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Data inicial</span>
                    <input
                      type="date"
                      value={formAfastamento.dataInicio}
                      onChange={(event) => setFormAfastamento((current) => ({ ...current, dataInicio: event.target.value }))}
                      className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Data final</span>
                    <input
                      type="date"
                      value={formAfastamento.dataFim}
                      onChange={(event) => setFormAfastamento((current) => ({ ...current, dataFim: event.target.value }))}
                      className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Observação</span>
                  <textarea
                    value={formAfastamento.observacao}
                    onChange={(event) => setFormAfastamento((current) => ({ ...current, observacao: event.target.value }))}
                    rows={3}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    placeholder="Opcional"
                  />
                </label>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-100/90">
                  O sistema bloqueia conflito apenas com lançamentos manuais já registrados como presencial ou extraordinário. Rotinas semanais são automaticamente sobrepostas por afastamentos no período informado.
                </div>

                <button
                  type="button"
                  onClick={() => void handleSubmitAfastamento()}
                  disabled={savingAfastamento || membros.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAfastamento ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Registrar afastamento
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/70">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Resumo rápido</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Use a subaba de registros para pesquisar e gerenciar os afastamentos com filtros detalhados.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Total</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{afastamentos.length}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">Férias</p>
                  <p className="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-100">{afastamentos.filter((item) => item.tipo === 'ferias').length}</p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/20 dark:bg-sky-950/20">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-200">Licenças</p>
                  <p className="mt-2 text-2xl font-bold text-sky-900 dark:text-sky-100">{afastamentos.filter((item) => item.tipo === 'licenca').length}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/20">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">Folgas</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-100">{afastamentos.filter((item) => item.tipo === 'folga').length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {afastamentosViewTab === 'registros' && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Total</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{afastamentoSummary.total}</p>
              </div>
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">Férias</p>
                <p className="mt-2 text-3xl font-bold text-amber-900 dark:text-amber-100">{afastamentoSummary.ferias}</p>
              </div>
              <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/20 dark:bg-sky-950/20">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-200">Licenças</p>
                <p className="mt-2 text-3xl font-bold text-sky-900 dark:text-sky-100">{afastamentoSummary.licenca}</p>
              </div>
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/20">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">Folgas</p>
                <p className="mt-2 text-3xl font-bold text-emerald-900 dark:text-emerald-100">{afastamentoSummary.folga}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/70">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Registros de afastamento</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Filtre por equipe, usuário, tipo e períodos de 7, 15, 30 dias ou todo o histórico.
                  </p>
                </div>
                {afastamentosLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-500 dark:text-gray-400" />}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Equipe</span>
                  <select
                    value={afastamentoEquipeFilter}
                    onChange={(event) => setAfastamentoEquipeFilter(event.target.value)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="all">Todas</option>
                    {equipeOptions.map(([id, nome]) => (
                      <option key={id} value={id}>{nome}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Usuário</span>
                  <select
                    value={afastamentoUserFilter}
                    onChange={(event) => setAfastamentoUserFilter(event.target.value)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="all">Todos</option>
                    {filteredMembrosForAfastamentoUser.map((membro) => (
                      <option key={membro.user_id} value={membro.user_id}>
                        {membro.user?.nome ?? membro.user?.email ?? membro.user_id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</span>
                  <select
                    value={afastamentoTipoFilter}
                    onChange={(event) => setAfastamentoTipoFilter(event.target.value as 'all' | EscalaAfastamentoTipo)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="all">Todos</option>
                    <option value="ferias">Férias</option>
                    <option value="licenca">Licença</option>
                    <option value="folga">Folga</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Período</span>
                  <select
                    value={afastamentoPeriodoFilter}
                    onChange={(event) => setAfastamentoPeriodoFilter(event.target.value as EscalaAfastamentoPeriodoFiltro)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="7">Próximos 7 dias</option>
                    <option value="15">Próximos 15 dias</option>
                    <option value="30">Próximos 30 dias</option>
                    <option value="all">Todo período</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
                  <select
                    value={afastamentoStatusFilter}
                    onChange={(event) => setAfastamentoStatusFilter(event.target.value as EscalaAfastamentoStatusFiltro)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="ativos">Ativos</option>
                    <option value="inativos">Inativos</option>
                  </select>
                </label>
              </div>

              <div className="mt-5 space-y-3">
                {!afastamentosLoading && afastamentoFiltered.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Nenhum afastamento encontrado para os filtros selecionados.
                  </div>
                )}

                {afastamentoFiltered.map((item) => {
                  const member = membroByUserId[item.user_id];
                  const equipeId = member?.user?.equipe_id ?? null;
                  const equipeNome = getEquipeDisplayName(equipeId, equipeId ? equipeNames[equipeId] : null);

                  return (
                    <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.user?.nome ?? 'Usuário sem nome'}</p>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              item.tipo === 'ferias'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                                : item.tipo === 'licenca'
                                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                            }`}>
                              {afastamentoLabel(item.tipo)}
                            </span>
                            <span className="rounded-full bg-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                              {equipeNome}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                            <span>{formatDisplayDate(item.data_inicio)} até {formatDisplayDate(item.data_fim)}</span>
                            <span>{formatAfastamentoDuration(item.data_inicio, item.data_fim)}</span>
                          </div>
                          {item.observacao && (
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{item.observacao}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAfastamento(item.id)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-600 transition hover:bg-red-50 dark:border-red-900/30 dark:text-red-300 dark:hover:bg-red-950/20"
                          title="Remover afastamento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMembrosTab = () => {
    if (!calendario) {
      return (
        <div className="rounded-3xl border border-dashed border-gray-300 p-8 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
          Crie primeiro um calendário para começar a configurar membros e turnos.
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/70">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Membros do calendário</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Os usuários ativos das equipes vinculadas ao calendário aparecem aqui com seu turno padrão.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Equipe</span>
              <select
                value={membroEquipeFilter}
                onChange={(event) => setMembroEquipeFilter(event.target.value)}
                className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">Todas</option>
                {equipeOptions.map(([id, nome]) => (
                  <option key={id} value={id}>{nome}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Usuário</span>
              <select
                value={membroUserFilter}
                onChange={(event) => setMembroUserFilter(event.target.value)}
                className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">Todos</option>
                {filteredMembrosForMembroUser.map((membro) => (
                  <option key={membro.user_id} value={membro.user_id}>
                    {membro.user?.nome ?? membro.user?.email ?? membro.user_id}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-4">
          {membrosFiltered.length === 0 && (
            <div className="rounded-3xl border border-dashed border-gray-300 p-8 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Nenhum membro encontrado para os filtros selecionados.
            </div>
          )}

          {membrosFiltered.map((membro) => (
            <div
              key={membro.id}
              className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/70"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {membro.user?.nome ?? membro.user?.email ?? membro.user_id}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {membro.user?.email ?? 'Sem e-mail'} {membro.user?.equipe_id ? `· equipe ${getEquipeDisplayName(membro.user.equipe_id, equipeNames[membro.user.equipe_id])}` : ''}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={membro.turno}
                    onChange={(event) => void handleTurnoChange(membro.id, event.target.value as EscalaTurno)}
                    disabled={savingTurnoId === membro.id}
                    className="min-w-[180px] rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="09:00-17:00">09 às 17</option>
                    <option value="11:00-19:00">11 às 19</option>
                  </select>
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {savingTurnoId === membro.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Turno padrão
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderInstitucionalTab = () => {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'cadastrar', label: 'Cadastrar' },
            { id: 'registros', label: 'Registros' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setInstitucionalViewTab(item.id as EscalaInstitucionalViewTab)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                institucionalViewTab === item.id
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {institucionalViewTab === 'cadastrar' && (
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/70">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingEventoInstitucionalId ? 'Editar evento institucional' : 'Novo evento institucional'}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Esses eventos valem para todos os calendários da Escala.
              </p>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</span>
                  <select
                    value={formEventoInstitucional.tipo}
                    onChange={(event) => setFormEventoInstitucional((current) => ({ ...current, tipo: event.target.value as EscalaEventoInstitucionalTipo }))}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="feriado">Feriado</option>
                    <option value="emenda">Emenda</option>
                    <option value="recesso">Recesso</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Título</span>
                  <input
                    type="text"
                    value={formEventoInstitucional.titulo}
                    onChange={(event) => setFormEventoInstitucional((current) => ({ ...current, titulo: event.target.value }))}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    placeholder="Ex.: Recesso judiciário de fim de ano"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Data inicial</span>
                    <input
                      type="date"
                      value={formEventoInstitucional.dataInicio}
                      onChange={(event) => setFormEventoInstitucional((current) => ({ ...current, dataInicio: event.target.value }))}
                      className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Data final</span>
                    <input
                      type="date"
                      value={formEventoInstitucional.dataFim}
                      onChange={(event) => setFormEventoInstitucional((current) => ({ ...current, dataFim: event.target.value }))}
                      className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Descrição</span>
                  <textarea
                    value={formEventoInstitucional.descricao}
                    onChange={(event) => setFormEventoInstitucional((current) => ({ ...current, descricao: event.target.value }))}
                    rows={3}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    placeholder="Opcional"
                  />
                </label>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void handleSubmitEventoInstitucional()}
                    disabled={savingEventoInstitucional}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingEventoInstitucional ? <Loader2 className="h-4 w-4 animate-spin" /> : editingEventoInstitucionalId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingEventoInstitucionalId ? 'Salvar alterações' : 'Registrar evento institucional'}
                  </button>
                  {editingEventoInstitucionalId ? (
                    <button
                      type="button"
                      onClick={resetEventoInstitucionalForm}
                      disabled={savingEventoInstitucional}
                      className="inline-flex items-center justify-center rounded-2xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      Cancelar edição
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/70">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Resumo rápido</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Use a subaba de registros para pesquisar a agenda institucional com filtros e visão consolidada.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Total</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{eventosInstitucionais.length}</p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/20 dark:bg-indigo-950/20">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-200">Feriados</p>
                  <p className="mt-2 text-2xl font-bold text-indigo-900 dark:text-indigo-100">{eventosInstitucionais.filter((item) => item.tipo === 'feriado').length}</p>
                </div>
                <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-500/20 dark:bg-purple-950/20">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-purple-700 dark:text-purple-200">Emendas</p>
                  <p className="mt-2 text-2xl font-bold text-purple-900 dark:text-purple-100">{eventosInstitucionais.filter((item) => item.tipo === 'emenda').length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-500/20 dark:bg-slate-900/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">Recessos</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{eventosInstitucionais.filter((item) => item.tipo === 'recesso').length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {institucionalViewTab === 'registros' && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Total</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{institucionalSummary.total}</p>
              </div>
              <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/20 dark:bg-indigo-950/20">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-200">Feriados</p>
                <p className="mt-2 text-3xl font-bold text-indigo-900 dark:text-indigo-100">{institucionalSummary.feriado}</p>
              </div>
              <div className="rounded-3xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-500/20 dark:bg-purple-950/20">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-purple-700 dark:text-purple-200">Emendas</p>
                <p className="mt-2 text-3xl font-bold text-purple-900 dark:text-purple-100">{institucionalSummary.emenda}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-500/20 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">Recessos</p>
                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{institucionalSummary.recesso}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900/70">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Registros da agenda institucional</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Filtre por tipo e por períodos de 30, 90, 180 dias ou visualize todo o histórico.
                  </p>
                </div>
                {eventosInstitucionaisLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-500 dark:text-gray-400" />}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</span>
                  <select
                    value={institucionalTipoFilter}
                    onChange={(event) => setInstitucionalTipoFilter(event.target.value as 'all' | EscalaEventoInstitucionalTipo)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="all">Todos</option>
                    <option value="feriado">Feriado</option>
                    <option value="emenda">Emenda</option>
                    <option value="recesso">Recesso</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Período</span>
                  <select
                    value={institucionalPeriodoFilter}
                    onChange={(event) => setInstitucionalPeriodoFilter(event.target.value as EscalaInstitucionalPeriodoFiltro)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="30">Próximos 30 dias</option>
                    <option value="90">Próximos 90 dias</option>
                    <option value="180">Próximos 180 dias</option>
                    <option value="all">Todo período</option>
                  </select>
                </label>
              </div>

              <div className="mt-5 space-y-3">
                {!eventosInstitucionaisLoading && institucionalFiltered.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Nenhum evento institucional encontrado para os filtros selecionados.
                  </div>
                )}

                {institucionalFiltered.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.titulo}</p>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                            item.tipo === 'feriado'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200'
                              : item.tipo === 'emenda'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200'
                                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                          }`}>
                            {eventoInstitucionalLabel(item.tipo)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                          <span>{formatDisplayDate(item.data_inicio)} até {formatDisplayDate(item.data_fim)}</span>
                          <span>{formatAfastamentoDuration(item.data_inicio, item.data_fim)}</span>
                        </div>
                        {item.descricao && (
                          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{item.descricao}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditEventoInstitucional(item)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200 text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-950/20"
                          title="Editar evento institucional"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteEventoInstitucional(item.id)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-600 transition hover:bg-red-50 dark:border-red-900/30 dark:text-red-300 dark:hover:bg-red-950/20"
                          title="Remover evento institucional"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <BaseAnimatedModal
        isOpen={isOpen}
        onClose={onClose}
        zIndex="z-[9999]"
        contentClassName="relative flex h-[96vh] w-[96vw] max-w-[1400px] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-cyan-50 via-sky-50 to-blue-50 px-5 py-4 dark:border-gray-700 dark:from-cyan-950/20 dark:via-sky-950/20 dark:to-blue-950/20">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold text-gray-900 dark:text-gray-100">
                  {getCalendarioDisplayTitle(calendario, equipeId, equipeId ? equipeNames[equipeId] : undefined)}
                </h2>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                  Última alteração: {headerLastChange}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadCalendario()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 text-gray-600 transition hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              title="Atualizar"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <History className="h-4 w-4" />
              Histórico
            </button>
            <button
              type="button"
              onClick={() => setHelperOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
            >
              <HelpCircle className="h-4 w-4" />
              Ajuda
            </button>
            {calendario ? (
              <button
                type="button"
                onClick={() => void handleDeactivateCalendar()}
                disabled={deactivating}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200 dark:hover:bg-amber-950/30"
              >
                {deactivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Desativar
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 text-gray-600 transition hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="min-w-[220px] text-center text-lg font-semibold capitalize text-gray-900 dark:text-gray-100">
                {formatMonthTitle(monthDate)}
              </div>
              <button
                type="button"
                onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            {tab === 'calendario' && resumoMes ? (
              <div className="flex flex-wrap items-center gap-2 lg:flex-1 lg:justify-center">
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200">
                  Úteis: {pluralizeDias(resumoMes.totais.diasUteis)}
                </span>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-200">
                  Presencial: {pluralizeDias(resumoMes.totais.diasPresenciaisUsuario)}
                </span>
                {resumoMes.totais.diasExtraordinariosUsuario > 0 ? (
                  <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-800 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/30 dark:text-fuchsia-200">
                    Extraordinário: {pluralizeDias(resumoMes.totais.diasExtraordinariosUsuario)}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'calendario', label: 'Calendário' },
                { id: 'rotinas', label: 'Rotinas' },
                { id: 'afastamentos', label: 'Afastamentos' },
                { id: 'membros', label: 'Membros' },
                { id: 'institucional', label: 'Agenda Institucional' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id as EscalaTab)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    tab === item.id
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {tab === 'calendario' && renderCalendarioTab()}
          {tab === 'rotinas' && renderRotinasTab()}
          {tab === 'afastamentos' && renderAfastamentosTab()}
          {tab === 'membros' && renderMembrosTab()}
          {tab === 'institucional' && renderInstitucionalTab()}
        </div>
      </BaseAnimatedModal>

      <EscalaHelperModal isOpen={helperOpen} onClose={() => setHelperOpen(false)} />
      <EscalaHistoricoModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        loading={auditLoading}
        items={auditItemsFiltered}
        equipeOptions={equipeOptions}
        selectedEquipeId={historicoEquipeFilter}
        selectedUserId={historicoUserFilter}
        onEquipeChange={setHistoricoEquipeFilter}
        onUserChange={setHistoricoUserFilter}
        userOptions={filteredMembrosForHistoricoUser}
      />
      <EscalaDayDetailModal
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDayDetail(null);
        }}
        detail={dayDetail}
        loading={detailLoading}
        membros={membros}
        equipeOptions={equipeOptions}
        onAddRegistro={handleAddRegistroDia}
        onRemoveRegistro={handleRemoveRegistroDia}
        onHandleRotinaOcorrencia={handleRotinaOcorrencia}
        savingRegistro={savingRegistro}
      />
    </>
  );
}

export default EscalaModal;

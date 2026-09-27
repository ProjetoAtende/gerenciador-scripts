/**
 * Badge de notificações — Gerenciador Atende (scripts + exclusões pendentes).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Loader2, X, Trash2, ClipboardList, MessageSquare } from 'lucide-react';
import {
  stackListarNotificacoes,
  stackMarcarNotificacaoLida,
} from '../services/atendeStackService';
import type { StackNotificacao } from '../types/atendeStack';
import { useAuth } from '../contexts/AuthContext';
import { usePermissoes } from '../contexts/PermissoesContext';
import { useBrowserNotifications } from '../hooks/useBrowserNotifications';
import {
  listarNotificacoesExclusaoPendentes,
  type NotificacaoExclusaoScript,
  arquivarNotificacaoExclusao,
} from '../services/notificacaoExclusaoService';
import {
  buscarNotificacoesScript,
  marcarNotificacaoLida as marcarNotificacaoScriptLida,
  marcarAcaoExecutada as marcarAcaoExecutadaScript,
  type ScriptNotificacao,
} from '../services/scriptVersioningService';
import { supabase } from '../services/supabaseClient';

const TIPOS_INFORMATIVOS_SCRIPT: ScriptNotificacao['tipo'][] = [
  'proposta_aprovada',
  'nova_versao_curadoria',
  'script_revisado_com_proposta_pendente',
  'script_publicado',
];

export interface NotificationBadgeProps {
  onOpenScriptNotificacao?: (notificacao: ScriptNotificacao) => void;
  onOpenStackPergunta?: (perguntaId: string) => void;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  return `há ${diffDays}d`;
}

function scriptNotificacaoIcon(tipo: ScriptNotificacao['tipo']): string {
  switch (tipo) {
    case 'proposta_recebida':
      return '📋';
    case 'proposta_aprovada':
      return '✅';
    case 'proposta_rejeitada':
      return '❌';
    case 'nova_versao_curadoria':
      return '📝';
    case 'proposta_reenviada':
      return '🔄';
    case 'curadoria_inicial':
      return '🔍';
    case 'script_revisado_com_proposta_pendente':
      return '⚠️';
    case 'script_publicado':
      return '📢';
    default:
      return '📋';
  }
}

export const NotificationBadge = ({ onOpenScriptNotificacao, onOpenStackPergunta }: NotificationBadgeProps) => {
  const { user } = useAuth();
  const { temPermissao } = usePermissoes();
  const canAprovarExclusao = temPermissao('scripts.curadoria_acesso');

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [exclusoesPendentes, setExclusoesPendentes] = useState<NotificacaoExclusaoScript[]>([]);
  const [scriptNotificacoes, setScriptNotificacoes] = useState<ScriptNotificacao[]>([]);
  const [stackNotificacoes, setStackNotificacoes] = useState<StackNotificacao[]>([]);
  const stackFetchStartedAt = useRef(0);

  const carregarNotificacoesScripts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const notifs = await buscarNotificacoesScript(user.id);
      setScriptNotificacoes(notifs);
    } catch (e) {
      console.warn('Erro ao carregar notificações de scripts:', e);
    }
  }, [user?.id]);

  const carregarStackNotificacoes = useCallback(async () => {
    if (!user?.id) return;
    const now = Date.now();
    if (now - stackFetchStartedAt.current < 400) return;
    stackFetchStartedAt.current = now;
    try {
      const notifs = await stackListarNotificacoes(30);
      setStackNotificacoes(notifs);
    } catch (e) {
      console.warn('Erro ao carregar notificações do Stack:', e);
      setStackNotificacoes([]);
    }
  }, [user?.id]);

  const carregarExclusoesPendentes = useCallback(async () => {
    if (!user?.id || !canAprovarExclusao) {
      setExclusoesPendentes([]);
      return;
    }
    const { notificacoes } = await listarNotificacoesExclusaoPendentes(true);
    setExclusoesPendentes(notificacoes);
  }, [user?.id, canAprovarExclusao]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      carregarNotificacoesScripts(),
      carregarExclusoesPendentes(),
      carregarStackNotificacoes(),
    ]);
    setLoading(false);
  }, [carregarNotificacoesScripts, carregarExclusoesPendentes, carregarStackNotificacoes]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('script_notificacoes_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'script_notificacoes',
          filter: `destinatario_id=eq.${user.id}`,
        },
        () => carregarNotificacoesScripts(),
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, carregarNotificacoesScripts]);

  useEffect(() => {
    if (!canAprovarExclusao) return;
    const interval = setInterval(carregarExclusoesPendentes, 10000);
    return () => clearInterval(interval);
  }, [canAprovarExclusao, carregarExclusoesPendentes]);

  useEffect(() => {
    if (isOpen) refreshAll();
  }, [isOpen, refreshAll]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadScriptCount = scriptNotificacoes.filter((n) => !n.lida).length;
  const unreadStackCount = stackNotificacoes.filter((n) => !n.lida_em).length;
  const totalCount = exclusoesPendentes.length + unreadScriptCount + unreadStackCount;
  const hasNotifications = totalCount > 0;

  useBrowserNotifications({
    unreadCount: totalCount,
    enabled: true,
  });

  const handleArchiveExclusao = useCallback(async (e: React.MouseEvent, scriptId: string) => {
    e.stopPropagation();
    const { sucesso } = await arquivarNotificacaoExclusao(scriptId);
    if (sucesso) {
      setExclusoesPendentes((prev) => prev.filter((n) => n.scriptId !== scriptId));
    }
  }, []);

  const handleScriptNotificacaoClick = useCallback(
    async (notificacao: ScriptNotificacao) => {
      if (TIPOS_INFORMATIVOS_SCRIPT.includes(notificacao.tipo)) {
        await marcarAcaoExecutadaScript(notificacao.id);
        setScriptNotificacoes((prev) => prev.filter((n) => n.id !== notificacao.id));
      } else if (!notificacao.lida) {
        await marcarNotificacaoScriptLida(notificacao.id);
        setScriptNotificacoes((prev) =>
          prev.map((n) => (n.id === notificacao.id ? { ...n, lida: true } : n)),
        );
      }
      onOpenScriptNotificacao?.(notificacao);
      setIsOpen(false);
    },
    [onOpenScriptNotificacao],
  );

  const handleDismissScriptNotificacao = useCallback(async (e: React.MouseEvent, notificacaoId: string) => {
    e.stopPropagation();
    await marcarAcaoExecutadaScript(notificacaoId);
    setScriptNotificacoes((prev) => prev.filter((n) => n.id !== notificacaoId));
  }, []);

  const handleStackNotificacaoClick = useCallback(
    async (notificacao: StackNotificacao) => {
      if (!notificacao.lida_em) {
        await stackMarcarNotificacaoLida(notificacao.id);
        setStackNotificacoes((prev) =>
          prev.map((n) => (n.id === notificacao.id ? { ...n, lida_em: new Date().toISOString() } : n)),
        );
      }
      if (notificacao.pergunta_id) {
        onOpenStackPergunta?.(notificacao.pergunta_id);
      }
      setIsOpen(false);
    },
    [onOpenStackPergunta],
  );

  const empty =
    exclusoesPendentes.length === 0 && scriptNotificacoes.length === 0 && stackNotificacoes.length === 0;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative rounded-lg p-2 transition-colors ${
          hasNotifications
            ? 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        title="Notificações"
        aria-label="Notificações"
      >
        <Bell size={20} />
        {hasNotifications && (
          <span
            className={`absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              exclusoesPendentes.length > 0 ? 'bg-amber-500' : 'bg-red-500'
            }`}
          >
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:w-[420px]">
          <div className="flex items-center gap-2 border-b bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 dark:border-gray-600 dark:from-gray-700 dark:to-gray-700">
            <Bell size={18} className="text-gray-600 dark:text-gray-400" />
            <span className="font-semibold text-gray-800 dark:text-gray-200">Notificações</span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : empty ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <Bell size={32} className="mb-2 opacity-50" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <>
                {canAprovarExclusao && exclusoesPendentes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 dark:border-gray-700 dark:bg-amber-900/20">
                      <Trash2 size={14} className="text-amber-600" />
                      <span className="text-xs font-semibold text-amber-800 dark:text-amber-400">
                        Exclusões pendentes ({exclusoesPendentes.length})
                      </span>
                    </div>
                    {exclusoesPendentes.map((exclusao) => (
                      <div
                        key={exclusao.scriptId}
                        className="flex items-start gap-3 border-b border-gray-100 px-4 py-3 text-left dark:border-gray-700"
                      >
                        <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                            {exclusao.scriptNome}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            Solicitado por:{' '}
                            <span className="font-medium">{exclusao.solicitanteNome}</span>
                          </p>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{formatTimeAgo(exclusao.dataHora)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleArchiveExclusao(e, exclusao.scriptId)}
                          className="flex-shrink-0 rounded p-1 text-gray-300 transition-colors hover:bg-amber-50 hover:text-amber-500"
                          title="Arquivar"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="border-b bg-amber-50/50 px-4 py-2 text-center dark:bg-amber-900/10">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Em <span className="font-medium">Scripts → Revisão → Exclusão</span>, aprove ou negue
                      </p>
                    </div>
                  </div>
                )}

                {stackNotificacoes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 border-b bg-indigo-50 px-4 py-2 dark:border-gray-700 dark:bg-indigo-900/20">
                      <MessageSquare size={14} className="text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-400">
                        Atende Stack {unreadStackCount > 0 && `(${unreadStackCount} não lidas)`}
                      </span>
                    </div>
                    {stackNotificacoes.map((notificacao) => (
                      <div
                        key={notificacao.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => void handleStackNotificacaoClick(notificacao)}
                        onKeyDown={(e) => e.key === 'Enter' && void handleStackNotificacaoClick(notificacao)}
                        className={`flex cursor-pointer items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-indigo-50/50 dark:border-gray-700 dark:hover:bg-indigo-900/20 ${
                          notificacao.lida_em ? 'opacity-60' : ''
                        }`}
                      >
                        <div
                          className={`mt-2 h-2 w-2 flex-shrink-0 rounded-full ${
                            notificacao.lida_em ? 'bg-gray-300 dark:bg-gray-600' : 'bg-indigo-500'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-3 text-sm text-gray-800 dark:text-gray-200">{notificacao.mensagem}</p>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{formatTimeAgo(notificacao.updated_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {scriptNotificacoes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 border-b bg-purple-50 px-4 py-2 dark:border-gray-700 dark:bg-purple-900/20">
                      <ClipboardList size={14} className="text-purple-600" />
                      <span className="text-xs font-semibold text-purple-800 dark:text-purple-400">
                        Scripts {unreadScriptCount > 0 && `(${unreadScriptCount} não lidas)`}
                      </span>
                    </div>
                    {scriptNotificacoes.map((notificacao) => (
                      <div
                        key={notificacao.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleScriptNotificacaoClick(notificacao)}
                        onKeyDown={(e) => e.key === 'Enter' && handleScriptNotificacaoClick(notificacao)}
                        className={`flex cursor-pointer items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-purple-50/50 dark:border-gray-700 dark:hover:bg-purple-900/20 ${
                          notificacao.lida ? 'opacity-60' : ''
                        }`}
                      >
                        <div
                          className={`mt-2 h-2 w-2 flex-shrink-0 rounded-full ${
                            notificacao.lida ? 'bg-gray-300 dark:bg-gray-600' : 'bg-purple-500'
                          }`}
                        />
                        <div className="flex-shrink-0 text-lg">{scriptNotificacaoIcon(notificacao.tipo)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm text-gray-800 dark:text-gray-200">
                            {notificacao.mensagem}
                          </p>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{formatTimeAgo(notificacao.criado_em)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDismissScriptNotificacao(e, notificacao.id)}
                          className="flex-shrink-0 rounded p-1 text-gray-300 transition-colors hover:bg-purple-50 hover:text-purple-500 dark:hover:bg-purple-900/30"
                          title="Dispensar"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

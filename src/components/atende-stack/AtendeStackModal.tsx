import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Search,
  ThumbsUp,
  Star,
  Plus,
  Filter,
  MessageSquare,
  CheckCircle2,
  Pencil,
  Trash2,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { isHtmlEmpty } from '../../utils/htmlUtils';
import { useEffectiveAuth } from '../../hooks/useEffectiveAuth';
import { useAtendeStackFeed } from '../../hooks/useAtendeStackFeed';
import {
  isStackAutorStaff,
  type StackBuscaEscopo,
  type StackFiltros,
  type StackPerguntaDetalhe,
  type StackTag,
} from '../../types/atendeStack';
import {
  stackCriarPergunta,
  stackCriarResposta,
  stackDeletar,
  stackEditarPergunta,
  stackEditarResposta,
  stackFavoritar,
  stackFechar,
  stackMarcarAceita,
  stackObterPergunta,
  stackProcessarTagJob,
  stackRegenerarTags,
  stackReabrir,
  stackStaffDefinirTags,
  stackVotar,
} from '../../services/atendeStackService';
import { StackHtmlViewer } from './StackHtmlViewer';
import { StackCollapsibleHtmlViewer } from './StackCollapsibleHtmlViewer';
import { StackRichTextEditor } from './StackRichTextEditor';
import { StackFiltrosPanel } from './StackFiltrosPanel';
import { StackTagField } from './StackTagField'; // staff: fixar tags manualmente
import { StackFeedSkeleton, StackDetalheSkeleton } from './StackFeedSkeleton';
import { StackHighlightSnippet } from './StackHighlightSnippet';
import { StackHelpModal } from './StackHelpModal';
import { StackMinimalReplyEditor } from './StackMinimalReplyEditor';
import { StackFullEditorModal } from './StackFullEditorModal';
import { highlightSearchTermsHtml, stripHighlightMarkup } from '../../utils/stackSearchHighlight';
import {
  formatStackTimeAgo,
  stackPublicadoPorLine,
  stackStatusClass,
  stackStatusLabel,
} from './stackUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialPerguntaId?: string | null;
}

const iconActionClass =
  'min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2.5 rounded-lg border dark:border-slate-600';
const touchTargetClass = 'min-h-[44px] min-w-[44px] inline-flex items-center justify-center';
const touchControlClass = 'min-h-[44px] inline-flex items-center justify-center';

export function AtendeStackModal({ isOpen, onClose, initialPerguntaId }: Props) {
  const { equipeId, userRole, isSimulatingView, previewStackRole } = useEffectiveAuth();
  const isStaff = userRole !== 'user' && userRole !== null;

  const [filtros, setFiltros] = useState<StackFiltros>(() => ({
    minhas: { fiz: false, respondi: false, favoritas: false },
    status: 'todas',
    equipe: { ativo: false, modo: 'todas' },
    tag_ids: [],
  }));
  const [busca, setBusca] = useState('');
  const [escopo, setEscopo] = useState<StackBuscaEscopo>('ambos');

  const {
    feed,
    buscaItens,
    modoBusca,
    loadingList,
    loadingMore,
    hasMoreFeed,
    hasMoreBusca,
    listError,
    loadMore,
    refresh,
    retryList,
    clearBusca,
    setFeed,
  } = useAtendeStackFeed({ isOpen, filtros, equipeCtx: equipeId, busca, escopo });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<StackPerguntaDetalhe | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  const [mobilePane, setMobilePane] = useState<'lista' | 'detalhe'>('lista');
  const [showFiltrosSheet, setShowFiltrosSheet] = useState(false);

  const [composer, setComposer] = useState<
    | { tipo: 'none' }
    | { tipo: 'nova' }
    | { tipo: 'editPergunta'; id: string }
    | { tipo: 'editResposta'; id: string }
  >({ tipo: 'none' });
  const [tituloDraft, setTituloDraft] = useState('');
  const [corpoDraft, setCorpoDraft] = useState('');
  const [corpoDraftInicial, setCorpoDraftInicial] = useState('');
  const [respostaDraft, setRespostaDraft] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [staffTagsOpen, setStaffTagsOpen] = useState(false);
  const [staffTagsDraft, setStaffTagsDraft] = useState<StackTag[]>([]);
  const [staffTagsSalvando, setStaffTagsSalvando] = useState(false);

  const [reabrirOpen, setReabrirOpen] = useState(false);
  const [reabrirMotivo, setReabrirMotivo] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [fullEditorOpen, setFullEditorOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const respostasScrollRef = useRef<HTMLDivElement>(null);
  const respostasScrollBeforeFullEditor = useRef(0);
  const equipeFiltroDisabled = !equipeId;

  const detalheView = detalhe;

  const loadDetalhe = useCallback(async (id: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoadingDetalhe(true);
    try {
      const p = await stackObterPergunta(id, previewStackRole);
      setDetalhe(p);
      if (!p && !opts?.silent) toast.error('Pergunta não encontrada.');
      return p;
    } catch (e) {
      console.error(e);
      if (!opts?.silent) toast.error('Erro ao carregar pergunta.');
      return null;
    } finally {
      if (!opts?.silent) setLoadingDetalhe(false);
    }
  }, [previewStackRole]);

  const kickTagJob = useCallback((perguntaId: string) => {
    void stackProcessarTagJob(perguntaId)
      .then(() => loadDetalhe(perguntaId, { silent: true }))
      .then((p) => {
        if (p?.tags_status === 'ready' || p?.tags_status === 'failed') void refresh();
      })
      .catch((e) => console.warn('[Stack] tag job:', e));
  }, [loadDetalhe, refresh]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialPerguntaId) {
      setSelectedId(initialPerguntaId);
      setMobilePane('detalhe');
      void loadDetalhe(initialPerguntaId);
    }
  }, [isOpen, initialPerguntaId, loadDetalhe]);

  useEffect(() => {
    if (!isOpen || !selectedId) return;
    void loadDetalhe(selectedId);
  }, [previewStackRole]); // eslint-disable-line react-hooks/exhaustive-deps -- recarregar preview simulado

  useEffect(() => {
    if (!isOpen || !detalhe?.id || detalhe.tags_status !== 'pending') return;
    const t = window.setInterval(() => {
      void loadDetalhe(detalhe.id, { silent: true }).then((p) => {
        if (p?.tags_status === 'ready' || p?.tags_status === 'failed') void refresh();
      });
    }, 4000);
    return () => window.clearInterval(t);
  }, [isOpen, detalhe?.id, detalhe?.tags_status, loadDetalhe, refresh]);

  const selectPergunta = (id: string) => {
    if (id !== selectedId) {
      setRespostaDraft('');
      setFullEditorOpen(false);
    }
    setSelectedId(id);
    setComposer({ tipo: 'none' });
    setMobilePane('detalhe');
    void loadDetalhe(id);
  };

  const refreshAfterMutation = async (perguntaId: string) => {
    await loadDetalhe(perguntaId);
    await refresh();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === 'Escape') {
        if (fullEditorOpen) {
          setFullEditorOpen(false);
          return;
        }
        if (showHelp) {
          setShowHelp(false);
          return;
        }
        if (reabrirOpen) {
          setReabrirOpen(false);
          return;
        }
        if (showFiltrosSheet) {
          setShowFiltrosSheet(false);
          return;
        }
        if (typing) return;

        const draftPergunta =
          (composer.tipo === 'nova' || composer.tipo === 'editPergunta') &&
          (tituloDraft.trim().length > 0 || !isHtmlEmpty(corpoDraft));
        const draftResposta = composer.tipo === 'none' && !isHtmlEmpty(respostaDraft);
        const draftEditResposta = composer.tipo === 'editResposta' && !isHtmlEmpty(corpoDraft);

        if (composer.tipo !== 'none') {
          if (draftPergunta || draftEditResposta) {
            if (!window.confirm('Descartar o rascunho?')) return;
          }
          setComposer({ tipo: 'none' });
          setTituloDraft('');
          setCorpoDraft('');
          setCorpoDraftInicial('');
          return;
        }
        if (draftResposta) {
          if (!window.confirm('Descartar a resposta em elaboração?')) return;
          setRespostaDraft('');
          return;
        }
        onClose();
        return;
      }
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isOpen,
    onClose,
    reabrirOpen,
    showFiltrosSheet,
    showHelp,
    composer,
    tituloDraft,
    corpoDraft,
    respostaDraft,
    fullEditorOpen,
  ]);

  const patchFeedItem = useCallback(
    (perguntaId: string, patch: Partial<{ upvote_count: number; usuario_votou: boolean; favorito: boolean }>) => {
      setFeed((prev) => prev.map((item) => (item.id === perguntaId ? { ...item, ...patch } : item)));
    },
    [setFeed],
  );

  const handleVotarPergunta = async () => {
    if (!detalhe) return;
    const prev = { upvote_count: detalhe.upvote_count, usuario_votou: detalhe.usuario_votou };
    const nextVoted = !prev.usuario_votou;
    const optimistic = {
      upvote_count: Math.max(0, prev.upvote_count + (nextVoted ? 1 : -1)),
      usuario_votou: nextVoted,
    };
    setDetalhe({ ...detalhe, ...optimistic });
    patchFeedItem(detalhe.id, optimistic);
    try {
      const r = await stackVotar('pergunta', detalhe.id);
      setDetalhe((d) => (d ? { ...d, upvote_count: r.upvote_count, usuario_votou: r.usuario_votou } : d));
      patchFeedItem(detalhe.id, { upvote_count: r.upvote_count, usuario_votou: r.usuario_votou });
    } catch {
      setDetalhe((d) => (d ? { ...d, ...prev } : d));
      patchFeedItem(detalhe.id, prev);
      toast.error('Erro ao votar.');
    }
  };

  const handleFavorito = async () => {
    if (!detalhe) return;
    const prevFav = detalhe.favorito;
    setDetalhe({ ...detalhe, favorito: !prevFav });
    patchFeedItem(detalhe.id, { favorito: !prevFav });
    try {
      const fav = await stackFavoritar(detalhe.id);
      setDetalhe((d) => (d ? { ...d, favorito: fav } : d));
      patchFeedItem(detalhe.id, { favorito: fav });
    } catch {
      setDetalhe((d) => (d ? { ...d, favorito: prevFav } : d));
      patchFeedItem(detalhe.id, { favorito: prevFav });
      toast.error('Erro ao favoritar.');
    }
  };

  const startNova = () => {
    setComposer({ tipo: 'nova' });
    setTituloDraft('');
    setCorpoDraft('');
    setCorpoDraftInicial('');
    setMobilePane('detalhe');
    setSelectedId(null);
    setDetalhe(null);
  };

  const startEditPergunta = () => {
    if (!detalhe) return;
    setComposer({ tipo: 'editPergunta', id: detalhe.id });
    setTituloDraft(detalhe.titulo);
    setCorpoDraft(detalhe.corpo_html);
    setCorpoDraftInicial(detalhe.corpo_html);
  };

  const salvarPergunta = async () => {
    if (isHtmlEmpty(corpoDraft) || tituloDraft.trim().length < 3) {
      toast.error('Preencha título e corpo.');
      return;
    }
    setSalvando(true);
    try {
      if (composer.tipo === 'nova') {
        const id = await stackCriarPergunta({
          titulo: tituloDraft.trim(),
          corpoHtml: corpoDraft,
          autorEquipeId: equipeId,
        });
        toast.success('Pergunta publicada.');
        setComposer({ tipo: 'none' });
        selectPergunta(id);
        kickTagJob(id);
      } else if (composer.tipo === 'editPergunta') {
        const corpoMudou = corpoDraft !== corpoDraftInicial;
        await stackEditarPergunta({
          perguntaId: composer.id,
          titulo: tituloDraft.trim(),
          corpoHtml: corpoDraft,
        });
        toast.success('Pergunta atualizada.');
        setComposer({ tipo: 'none' });
        await refreshAfterMutation(composer.id);
        if (corpoMudou) kickTagJob(composer.id);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRegenerarTags = async () => {
    if (!detalhe?.id) return;
    try {
      await stackRegenerarTags(detalhe.id);
      toast.message('Regenerando tags…');
      setDetalhe({ ...detalhe, tags_status: 'pending' });
      kickTagJob(detalhe.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao regenerar tags.');
    }
  };

  const abrirStaffTags = () => {
    if (!detalhe) return;
    setStaffTagsDraft(detalhe.tags);
    setStaffTagsOpen(true);
  };

  const salvarStaffTags = async () => {
    if (!detalhe) return;
    setStaffTagsSalvando(true);
    try {
      const tagIds = staffTagsDraft.filter((t) => !t.id.startsWith('new:')).map((t) => t.id);
      const tagNovos = staffTagsDraft.filter((t) => t.id.startsWith('new:')).map((t) => t.rotulo);
      await stackStaffDefinirTags({ perguntaId: detalhe.id, tagIds, tagNovos });
      toast.success('Tags atualizadas.');
      setStaffTagsOpen(false);
      await refreshAfterMutation(detalhe.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar tags.');
    } finally {
      setStaffTagsSalvando(false);
    }
  };

  const publicarResposta = async () => {
    if (!detalhe || isHtmlEmpty(respostaDraft)) return;
    setSalvando(true);
    try {
      await stackCriarResposta({
        perguntaId: detalhe.id,
        corpoHtml: respostaDraft,
        autorEquipeId: equipeId,
      });
      setRespostaDraft('');
      setFullEditorOpen(false);
      toast.success('Resposta publicada.');
      await refreshAfterMutation(detalhe.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao responder.');
    } finally {
      setSalvando(false);
    }
  };

  const listaItems = modoBusca ? buscaItens : feed;
  const hasMore = modoBusca ? hasMoreBusca : hasMoreFeed;

  const filtrosAtivos =
    filtros.minhas.fiz ||
    filtros.minhas.respondi ||
    filtros.minhas.favoritas ||
    filtros.status !== 'todas' ||
    filtros.equipe.ativo ||
    filtros.tag_ids.length > 0;

  const emptyListMessage = listError
    ? listError
    : modoBusca
      ? `Nenhum resultado para «${busca.trim()}». Revise os termos ou limpe os filtros.`
      : filtrosAtivos
        ? 'Nenhuma pergunta para estes filtros.'
        : 'Nenhuma pergunta ainda.';

  const listPanel = (
    <div className="flex flex-col h-full min-h-0">
      {modoBusca && (
        <div className="shrink-0 px-3 py-2 border-b dark:border-slate-800 flex items-center justify-between gap-2 bg-indigo-50/50 dark:bg-indigo-950/20">
          <span className="text-xs text-indigo-800 dark:text-indigo-200 truncate">Busca: {busca.trim()}</span>
          <button
            type="button"
            className={`text-xs font-medium text-indigo-600 shrink-0 px-2 ${touchControlClass}`}
            onClick={() => {
              setBusca('');
              clearBusca();
            }}
          >
            Sair da busca
          </button>
        </div>
      )}
      {loadingList ? (
        <StackFeedSkeleton />
      ) : listaItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
          <MessageSquare className="w-10 h-10 mb-2 opacity-40" />
          <p>{emptyListMessage}</p>
          {listError ? (
            <button
              type="button"
              onClick={() => void retryList()}
              className="mt-3 text-indigo-600 text-sm font-medium"
            >
              Tentar novamente
            </button>
          ) : (
            !modoBusca && (
              <button type="button" onClick={startNova} className="mt-3 text-indigo-600 text-sm font-medium">
                Nova pergunta
              </button>
            )
          )}
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {modoBusca
            ? buscaItens.map((b) => (
                <li key={b.pergunta_id}>
                  <button
                    type="button"
                    onClick={() => selectPergunta(b.pergunta_id)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                      selectedId === b.pergunta_id ? 'border-l-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                    }`}
                  >
                    <StackHighlightSnippet
                      html={highlightSearchTermsHtml(b.titulo, busca.trim())}
                      className="font-medium text-sm line-clamp-2 dark:text-slate-100 mt-0"
                    />
                    <StackHighlightSnippet
                      html={highlightSearchTermsHtml(stripHighlightMarkup(b.snippet_html), busca.trim())}
                    />
                    <span className="text-xs uppercase text-slate-700 dark:text-slate-300">
                      {b.match_count > 1
                        ? `${b.match_count} trechos correspondem`
                        : b.match_tipo === 'resposta'
                          ? 'Resposta'
                          : 'Pergunta'}
                    </span>
                  </button>
                </li>
              ))
            : feed.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => selectPergunta(item.id)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                      selectedId === item.id ? 'border-l-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {item.favorito && <Star className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5 fill-amber-500" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm line-clamp-2 dark:text-slate-100">{item.titulo}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-600 dark:text-slate-400">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${stackStatusClass(item)}`}>
                            {stackStatusLabel(item)}
                          </span>
                          <span>👍 {item.upvote_count}</span>
                          <span>{item.resposta_count} resp.</span>
                          <span>{formatStackTimeAgo(item.ultima_atividade_em)}</span>
                        </div>
                        {(item.tags.length > 0 || item.tags_status === 'pending') && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.tags_status === 'pending' && item.tags.length === 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 animate-pulse">
                                Tags…
                              </span>
                            )}
                            {item.tags.slice(0, 2).map((t) => (
                              <span
                                key={t.id}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200"
                              >
                                {t.rotulo}
                              </span>
                            ))}
                            {item.tags.length > 2 && (
                              <span className="text-[10px] text-slate-600 dark:text-slate-400">+{item.tags.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
        </ul>
      )}
      {hasMore && listaItems.length > 0 && (
        <div className="shrink-0 p-2 border-t dark:border-slate-800">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => loadMore()}
            className="w-full py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {loadingMore ? 'Carregando…' : 'Carregar mais'}
          </button>
        </div>
      )}
    </div>
  );

  const composerPergunta = (composer.tipo === 'nova' || composer.tipo === 'editPergunta') && (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3 overflow-y-auto">
      <h2 className="text-lg font-semibold dark:text-slate-100">
        {composer.tipo === 'nova' ? 'Nova pergunta' : 'Editar pergunta'}
      </h2>
      <div>
        <label htmlFor="stack-titulo" className="text-sm font-medium dark:text-slate-200">
          Título <span className="text-red-600">*</span>
        </label>
        <input
          id="stack-titulo"
          value={tituloDraft}
          onChange={(e) => setTituloDraft(e.target.value)}
          placeholder="Título"
          maxLength={200}
          required
          aria-required="true"
          className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2.5 text-sm dark:bg-slate-800"
        />
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 text-right">{tituloDraft.length}/200</p>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        As tags são geradas automaticamente pela IA após publicar (2–3 temas). Se o corpo for editado, elas são recalculadas.
      </p>
      <div className="flex-1 min-h-[200px] border rounded-lg dark:border-slate-600 overflow-hidden">
        <StackRichTextEditor value={corpoDraft} onChange={setCorpoDraft} placeholder="Descreva sua dúvida…" />
      </div>
      <div className="flex gap-2 justify-end shrink-0">
        <button
          type="button"
          onClick={() => setComposer({ tipo: 'none' })}
          className={`px-4 py-2.5 text-sm rounded-lg border dark:border-slate-600 ${touchControlClass}`}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={salvando}
          onClick={() => void salvarPergunta()}
          className={`px-4 py-2.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 ${touchControlClass}`}
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );

  const detalhePanel = composer.tipo === 'nova' || composer.tipo === 'editPergunta' ? (
    composerPergunta
  ) : loadingDetalhe ? (
    <StackDetalheSkeleton />
  ) : !detalheView ? (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
      <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
      <p>Selecione uma pergunta ou crie uma nova.</p>
    </div>
  ) : (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-4 py-3 border-b dark:border-slate-700 flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold dark:text-slate-100">{detalheView.titulo}</h1>
          <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-600 dark:text-slate-400 items-center">
            <span
              className={`px-1.5 py-0.5 rounded font-semibold ${stackStatusClass({ status: detalheView.status, tem_solucao: !!detalheView.resposta_aceita_id })}`}
            >
              {stackStatusLabel({ status: detalheView.status, tem_solucao: !!detalheView.resposta_aceita_id })}
            </span>
            {detalheView.tags_status === 'pending' && (
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500 animate-pulse">
                Classificando tags…
              </span>
            )}
            {detalheView.tags.map((t) => (
              <span key={t.id} className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {t.rotulo}
              </span>
            ))}
            {detalheView.tags_status === 'failed' && detalheView.tags.length === 0 && (
              <span className="text-amber-700 dark:text-amber-400">Tags indisponíveis</span>
            )}
          </div>
          {detalheView.pode_gerenciar_tags && (
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => void handleRegenerarTags()}
              >
                Regenerar tags (IA)
              </button>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={abrirStaffTags}
              >
                Fixar tags manualmente
              </button>
            </div>
          )}
          {staffTagsOpen && detalheView.pode_gerenciar_tags && (
            <div className="mt-3 p-3 rounded-lg border dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/50 w-full">
              <StackTagField tags={staffTagsDraft} onChange={setStaffTagsDraft} placeholder="Tags staff…" />
              <div className="flex gap-2 mt-2 justify-end">
                <button type="button" className="text-xs px-3 py-1.5 rounded border dark:border-slate-600" onClick={() => setStaffTagsOpen(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={staffTagsSalvando}
                  className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-50"
                  onClick={() => void salvarStaffTags()}
                >
                  {staffTagsSalvando ? 'Salvando…' : 'Salvar tags'}
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5">
            {stackPublicadoPorLine(detalheView.autor, detalheView.created_at)}
            {isStaff && isStackAutorStaff(detalheView.autor) && (
              <span className="text-slate-500 dark:text-slate-500"> · {detalheView.autor.email}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void handleVotarPergunta()}
            className={`${iconActionClass} ${detalheView.usuario_votou ? 'bg-amber-50 border-amber-300 text-amber-800' : ''}`}
            aria-label="Joinha na pergunta"
            aria-pressed={detalheView.usuario_votou}
          >
            <ThumbsUp className="w-4 h-4" />
            <span className="text-xs ml-1">{detalheView.upvote_count}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleFavorito()}
            className={`${iconActionClass} ${detalheView.favorito ? 'text-amber-600 border-amber-300' : ''}`}
            aria-label={detalheView.favorito ? 'Remover dos favoritos' : 'Favoritar pergunta'}
            aria-pressed={detalheView.favorito}
          >
            <Star className={`w-4 h-4 ${detalheView.favorito ? 'fill-amber-500' : ''}`} />
          </button>
          {detalheView.pode_editar && (
            <button
              type="button"
              onClick={startEditPergunta}
              className={iconActionClass}
              aria-label="Editar pergunta"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {detalheView.pode_fechar && detalheView.status === 'aberta' && (
            <button
              type="button"
              className={`${touchControlClass} px-3 py-2.5 rounded-lg border dark:border-slate-600 text-xs`}
              title="Fechar pergunta"
              aria-label="Fechar pergunta"
              onClick={() =>
                void stackFechar(detalheView.id)
                  .then(() => refreshAfterMutation(detalheView.id))
                  .catch(() => toast.error('Erro ao fechar.'))
              }
            >
              Fechar
            </button>
          )}
          {detalheView.pode_deletar && (
            <button
              type="button"
              className={`${iconActionClass} border-red-200 text-red-700 dark:text-red-400`}
              aria-label="Excluir pergunta"
              onClick={() => {
                if (
                  !window.confirm(
                    'Excluir permanentemente esta pergunta e todas as respostas? Esta ação não pode ser desfeita.',
                  )
                ) {
                  return;
                }
                const typed = window.prompt('Digite EXCLUIR para confirmar a exclusão definitiva:');
                if (typed?.trim().toUpperCase() !== 'EXCLUIR') {
                  toast.message('Exclusão cancelada.');
                  return;
                }
                void stackDeletar(detalheView.id)
                  .then(() => {
                    toast.success('Pergunta removida.');
                    setDetalhe(null);
                    setSelectedId(null);
                    void refresh();
                  })
                  .catch(() => toast.error('Erro ao excluir.'));
              }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-2 space-y-3 border-b-2 border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/80">
        <section
          className="rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm px-4 py-3"
          aria-label="Enunciado da pergunta"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            Pergunta
          </p>
          <StackHtmlViewer html={detalheView.corpo_html} />
          {detalheView.editado && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Editado em {new Date(detalheView.editado.editado_em).toLocaleString('pt-BR')}
              {isStaff && detalheView.editado.por && isStackAutorStaff(detalheView.editado.por) && (
                <> por {detalheView.editado.por.nome}</>
              )}
            </p>
          )}
          {detalheView.reabertura && (
            <div className="border-l-4 border-amber-500 bg-amber-50/90 dark:bg-amber-950/30 rounded-r-lg p-3 mt-3">
              <p className="text-xs font-semibold uppercase text-amber-900 dark:text-amber-100">Reabertura pela equipe</p>
              <p className="text-sm mt-2 whitespace-pre-wrap dark:text-slate-200">{detalheView.reabertura.motivo}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{formatStackTimeAgo(detalheView.reabertura.created_at)}</p>
              {isStaff && detalheView.reabertura.staff && isStackAutorStaff(detalheView.reabertura.staff) && (
                <p className="text-xs text-slate-600 dark:text-slate-400">Por {detalheView.reabertura.staff.nome}</p>
              )}
            </div>
          )}
        </section>

        {detalheView.pode_responder && composer.tipo === 'none' && (
          <section
            className="rounded-xl border-2 border-indigo-400 dark:border-indigo-600 bg-indigo-50/90 dark:bg-indigo-950/35 shadow-md px-4 py-3"
            aria-label="Escrever resposta"
          >
            <label htmlFor="stack-resposta-curta" className="text-sm font-semibold text-indigo-950 dark:text-indigo-50">
              Sua resposta
            </label>
            <p className="text-xs text-indigo-800/90 dark:text-indigo-100/90 mt-0.5 mb-2">
              Respostas curtas aqui; formatação avançada no editor completo.
            </p>
            <StackMinimalReplyEditor
              id="stack-resposta-curta"
              valueHtml={respostaDraft}
              onChangeHtml={setRespostaDraft}
              placeholder="Resposta curta…"
            />
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                type="button"
                disabled={salvando || isHtmlEmpty(respostaDraft)}
                onClick={() => void publicarResposta()}
                className={`px-4 py-2.5 min-h-[44px] bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50 ${touchControlClass}`}
              >
                Publicar resposta
              </button>
              <button
                type="button"
                onClick={() => {
                  respostasScrollBeforeFullEditor.current = respostasScrollRef.current?.scrollTop ?? 0;
                  setFullEditorOpen(true);
                }}
                className={`px-4 py-2.5 min-h-[44px] text-sm rounded-lg border-2 border-indigo-500 text-indigo-900 dark:text-indigo-100 dark:border-indigo-400 bg-white/80 dark:bg-slate-900/80 ${touchControlClass}`}
              >
                Editor completo
              </button>
            </div>
          </section>
        )}
      </div>

      <div
        ref={respostasScrollRef}
        className="flex-1 overflow-y-auto min-h-0 px-4 py-3 bg-slate-100/70 dark:bg-slate-950/40"
      >
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">
          {detalheView.resposta_count} respostas publicadas
        </h3>
        <div className="space-y-3">
        {detalheView.respostas.map((r, idx, arr) => {
          const allowCollapse = arr.length > 1 && idx < arr.length - 1;
          return (
          <div
            key={r.id}
            className={`rounded-xl border p-3 bg-white dark:bg-slate-900 dark:border-slate-700 ${r.aceita ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-slate-200'}`}
          >
            {r.aceita && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Solução
              </span>
            )}
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
              {stackPublicadoPorLine(r.autor, r.created_at)}
              {isStaff && isStackAutorStaff(r.autor) && (
                <span className="text-slate-500 dark:text-slate-500"> · {r.autor.email}</span>
              )}
            </p>
            <StackCollapsibleHtmlViewer html={r.corpo_html} allowCollapse={allowCollapse} />
            {r.editado && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                Editado em {new Date(r.editado.editado_em).toLocaleString('pt-BR')}
                {isStaff && r.editado.por && isStackAutorStaff(r.editado.por) && <> por {r.editado.por.nome}</>}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                type="button"
                className={`min-h-[44px] inline-flex items-center gap-1 text-xs px-3 py-2 rounded-lg border ${r.usuario_votou ? 'bg-amber-50 border-amber-300' : 'dark:border-slate-600'}`}
                aria-label="Joinha na resposta"
                aria-pressed={r.usuario_votou}
                onClick={() => {
                  if (!detalhe) return;
                  const prev = { upvote_count: r.upvote_count, usuario_votou: r.usuario_votou };
                  const nextVoted = !prev.usuario_votou;
                  const optimistic = {
                    upvote_count: Math.max(0, prev.upvote_count + (nextVoted ? 1 : -1)),
                    usuario_votou: nextVoted,
                  };
                  const apply = (patch: typeof optimistic) =>
                    setDetalhe({
                      ...detalhe,
                      respostas: detalhe.respostas.map((x) => (x.id === r.id ? { ...x, ...patch } : x)),
                    });
                  apply(optimistic);
                  void stackVotar('resposta', r.id)
                    .then((v) => {
                      setDetalhe((d) =>
                        d
                          ? {
                              ...d,
                              respostas: d.respostas.map((x) =>
                                x.id === r.id ? { ...x, upvote_count: v.upvote_count, usuario_votou: v.usuario_votou } : x,
                              ),
                            }
                          : d,
                      );
                    })
                    .catch(() => {
                      apply(prev);
                      toast.error('Erro ao votar.');
                    });
                }}
              >
                <ThumbsUp className="w-3.5 h-3.5" /> {r.upvote_count}
              </button>
              {detalheView.pode_marcar_aceita && !r.aceita && (
                <button
                  type="button"
                  className="text-xs min-h-[44px] px-3 py-2 rounded-lg bg-emerald-700 text-white"
                  onClick={() => {
                    if (!detalhe) return;
                    if (
                      !window.confirm(
                        'Marcar esta resposta como solução? A pergunta será fechada automaticamente.',
                      )
                    ) {
                      return;
                    }
                    void stackMarcarAceita(detalhe.id, r.id)
                      .then(() => refreshAfterMutation(detalhe.id))
                      .catch(() => toast.error('Não foi possível marcar solução.'));
                  }}
                >
                  Marcar solução
                </button>
              )}
              {r.pode_editar && composer.tipo !== 'editResposta' && (
                <button
                  type="button"
                  className={`text-xs text-indigo-800 dark:text-indigo-300 font-medium px-2 ${touchControlClass}`}
                  aria-label="Editar resposta"
                  onClick={() => {
                    setComposer({ tipo: 'editResposta', id: r.id });
                    setCorpoDraft(r.corpo_html);
                  }}
                >
                  Editar
                </button>
              )}
            </div>
          </div>
          );
        })}

        {detalheView.respostas.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">Nenhuma resposta publicada ainda.</p>
        )}
        </div>

        {composer.tipo === 'editResposta' && (
          <div className="border rounded-lg p-3 dark:border-slate-600">
            <p className="text-sm font-medium mb-2">Editar resposta</p>
            <StackRichTextEditor value={corpoDraft} onChange={setCorpoDraft} />
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                className={`text-sm px-3 py-2.5 border rounded-lg ${touchControlClass}`}
                onClick={() => setComposer({ tipo: 'none' })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`text-sm px-3 py-2.5 bg-indigo-600 text-white rounded-lg ${touchControlClass}`}
                onClick={() =>
                  void stackEditarResposta(composer.id, corpoDraft)
                    .then(() => {
                      setComposer({ tipo: 'none' });
                      toast.success('Resposta atualizada.');
                      return refreshAfterMutation(detalheView.id);
                    })
                    .catch(() => toast.error('Erro ao editar.'))
                }
              >
                Salvar
              </button>
            </div>
          </div>
        )}
      </div>

      {detalheView.status === 'fechada' && (
        <div className="shrink-0 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-sm flex flex-wrap items-center gap-2 justify-between">
          <span>Pergunta encerrada.</span>
          <div className="flex gap-2">
            {detalheView.pode_reabrir && (
              <button
                type="button"
                className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2 rounded-lg bg-amber-700 text-white text-xs"
                onClick={() => setReabrirOpen(true)}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reabrir
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col bg-slate-50 dark:bg-slate-950"
      >
        <header className="shrink-0 h-14 px-4 flex items-center justify-between bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 text-white shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-lg">🗨</div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight">Atende Stack</h1>
              <p className="text-indigo-100 text-[11px] truncate">Perguntas e respostas da operação</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className={`${touchTargetClass} rounded-lg hover:bg-white/20`}
              aria-label="Ajuda"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${touchTargetClass} rounded-lg hover:bg-white/20`}
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="shrink-0 px-3 py-2 border-b dark:border-slate-800 flex flex-wrap gap-2 items-center bg-white dark:bg-slate-900">
          {!equipeId && (
            <p className="w-full text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 px-2 py-1.5 rounded-lg">
              Nenhuma equipe selecionada na Home — filtros por equipe ficam desativados.
            </p>
          )}
          {isSimulatingView && userRole === 'user' && (
            <p className="w-full text-xs text-indigo-800 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1.5 rounded-lg">
              Simulação: visualização de usuário operacional (ações de staff ocultas na interface).
            </p>
          )}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" aria-hidden />
            <input
              ref={searchInputRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar… (/ focar)"
              aria-label="Buscar no Atende Stack"
              className="w-full pl-9 pr-3 py-2 min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-700 text-sm dark:bg-slate-800"
            />
          </div>
          <div className="flex rounded-lg border dark:border-slate-700 overflow-hidden text-xs">
            {(['perguntas', 'respostas', 'ambos'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setEscopo(s)}
                className={`min-h-[44px] px-2.5 py-2 capitalize ${escopo === s ? 'bg-indigo-600 text-white' : 'dark:text-slate-300'}`}
                aria-pressed={escopo === s}
                aria-label={`Buscar em ${s}`}
              >
                {s === 'ambos' ? 'Ambos' : s === 'perguntas' ? 'Perguntas' : 'Respostas'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={startNova}
            className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nova
          </button>
          <button
            type="button"
            className={`md:hidden ${touchTargetClass} rounded-lg border dark:border-slate-700`}
            onClick={() => setShowFiltrosSheet(true)}
            aria-label="Filtros"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex">
          <aside className="hidden md:block w-56 shrink-0 border-r dark:border-slate-800 p-3 overflow-y-auto bg-white dark:bg-slate-900/50">
            <StackFiltrosPanel filtros={filtros} onChange={setFiltros} equipeFiltroDisabled={equipeFiltroDisabled} />
          </aside>

          <div
            className={`${mobilePane === 'detalhe' ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[min(38%,24rem)] shrink-0 border-r dark:border-slate-800 min-h-0 bg-white dark:bg-slate-900`}
          >
            <div className="md:hidden flex border-b dark:border-slate-800">
              <button type="button" className={`flex-1 py-2.5 text-sm font-medium text-indigo-600 border-b-2 border-indigo-600 ${touchControlClass}`}>
                Stack
              </button>
              <button
                type="button"
                disabled={!selectedId && composer.tipo === 'none'}
                onClick={() => setMobilePane('detalhe')}
                className={`flex-1 py-2.5 text-sm text-slate-500 disabled:opacity-40 ${touchControlClass}`}
              >
                Detalhe
              </button>
            </div>
            {listPanel}
          </div>

          <main
            className={`${mobilePane === 'lista' ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0 min-h-0 bg-slate-50 dark:bg-slate-950`}
          >
            <div className="md:hidden px-3 py-2 border-b dark:border-slate-800">
              <button
                type="button"
                className="text-sm min-h-[44px] py-2 text-indigo-700 dark:text-indigo-300"
                onClick={() => setMobilePane('lista')}
              >
                ← Voltar ao stack
              </button>
            </div>
            {detalhePanel}
          </main>
        </div>

        {showFiltrosSheet && (
          <div
            className="md:hidden fixed inset-0 z-[10000] bg-black/40 flex items-end"
            role="presentation"
            onClick={() => setShowFiltrosSheet(false)}
          >
            <div
              className="w-full max-h-[70vh] bg-white dark:bg-slate-900 rounded-t-2xl p-4 overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="stack-filtros-sheet-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 id="stack-filtros-sheet-title" className="font-semibold">
                  Filtros
                </h3>
                <button
                  type="button"
                  className={touchTargetClass}
                  aria-label="Fechar filtros"
                  onClick={() => setShowFiltrosSheet(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <StackFiltrosPanel filtros={filtros} onChange={setFiltros} equipeFiltroDisabled={equipeFiltroDisabled} />
            </div>
          </div>
        )}

        {mobilePane === 'lista' && (
          <button
            type="button"
            onClick={startNova}
            className="md:hidden fixed bottom-6 right-6 z-[10000] w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center hover:bg-indigo-700"
            aria-label="Nova pergunta"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}

        {showHelp && <StackHelpModal onClose={() => setShowHelp(false)} />}

        {fullEditorOpen && detalhe && detalheView && (
          <StackFullEditorModal
            detalhe={detalheView}
            isStaff={isStaff}
            valueHtml={respostaDraft}
            onChangeHtml={setRespostaDraft}
            salvando={salvando}
            onPublicar={() => void publicarResposta()}
            onClose={() => {
              setFullEditorOpen(false);
              requestAnimationFrame(() => {
                if (respostasScrollRef.current) {
                  respostasScrollRef.current.scrollTop = respostasScrollBeforeFullEditor.current;
                }
              });
            }}
            touchControlClass={touchControlClass}
          />
        )}

        {reabrirOpen && detalhe && (
          <div
            className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4"
            role="presentation"
            onClick={() => setReabrirOpen(false)}
          >
            <div
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl p-4 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="stack-reabrir-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="stack-reabrir-title" className="font-semibold text-lg mb-2">
                Reabrir pergunta
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                A resposta marcada como solução será desmarcada.
              </p>
              <label htmlFor="stack-reabrir-motivo" className="text-sm font-medium">
                Motivo <span className="text-red-600">*</span>
              </label>
              <textarea
                id="stack-reabrir-motivo"
                value={reabrirMotivo}
                onChange={(e) => setReabrirMotivo(e.target.value)}
                rows={4}
                required
                aria-required="true"
                aria-invalid={reabrirMotivo.trim().length > 0 && reabrirMotivo.trim().length < 3}
                className="mt-1 w-full rounded-lg border dark:border-slate-600 p-2 text-sm dark:bg-slate-800"
                placeholder="Motivo da reabertura (visível para todos, mín. 3 caracteres)"
              />
              {reabrirMotivo.trim().length > 0 && reabrirMotivo.trim().length < 3 && (
                <p className="text-xs text-red-600 mt-1">Informe pelo menos 3 caracteres.</p>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" className="px-4 py-2 text-sm rounded-lg border" onClick={() => setReabrirOpen(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={reabrirMotivo.trim().length < 3}
                  className="px-4 py-2 text-sm rounded-lg bg-amber-700 text-white disabled:opacity-50"
                  onClick={() =>
                    void stackReabrir(detalhe.id, reabrirMotivo.trim())
                      .then(() => {
                        setReabrirOpen(false);
                        setReabrirMotivo('');
                        toast.success('Pergunta reaberta.');
                        return refreshAfterMutation(detalhe.id);
                      })
                      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao reabrir.'))
                  }
                >
                  Reabrir
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default AtendeStackModal;

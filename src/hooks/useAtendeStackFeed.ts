import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { StackBuscaEscopo, StackBuscaItem, StackFeedItem, StackFiltros } from '../types/atendeStack';
import { stackBuscar, stackListarFeed } from '../services/atendeStackService';
import { STACK_PAGE_SIZE } from '../components/atende-stack/stackUtils';

interface Options {
  isOpen: boolean;
  filtros: StackFiltros;
  equipeCtx: string | null;
  busca: string;
  escopo: StackBuscaEscopo;
}

export function useAtendeStackFeed({ isOpen, filtros, equipeCtx, busca, escopo }: Options) {
  const [feed, setFeed] = useState<StackFeedItem[]>([]);
  const [buscaItens, setBuscaItens] = useState<StackBuscaItem[]>([]);
  const [modoBusca, setModoBusca] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreFeed, setHasMoreFeed] = useState(false);
  const [hasMoreBusca, setHasMoreBusca] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const requestId = useRef(0);
  const feedRef = useRef<StackFeedItem[]>([]);
  const buscaRef = useRef<StackBuscaItem[]>([]);
  feedRef.current = feed;
  buscaRef.current = buscaItens;

  const loadFeed = useCallback(
    async (append = false) => {
      const req = ++requestId.current;
      if (append) setLoadingMore(true);
      else {
        setLoadingList(true);
        setListError(null);
      }

      try {
        const current = feedRef.current;
        const cursor =
          append && current.length > 0
            ? { at: current[current.length - 1].ultima_atividade_em, id: current[current.length - 1].id }
            : null;

        const items = await stackListarFeed({
          filtros,
          equipeCtx,
          cursor,
          limit: STACK_PAGE_SIZE,
        });

        if (req !== requestId.current) return;

        setFeed((prev) => (append ? [...prev, ...items] : items));
        setHasMoreFeed(items.length >= STACK_PAGE_SIZE);
        setModoBusca(false);
      } catch (e) {
        console.error(e);
        if (!append) {
          setListError('Não foi possível carregar o feed.');
          setFeed([]);
          setHasMoreFeed(false);
          toast.error('Não foi possível carregar o feed.');
        }
      } finally {
        if (req === requestId.current) {
          setLoadingList(false);
          setLoadingMore(false);
        }
      }
    },
    [filtros, equipeCtx],
  );

  const runBusca = useCallback(
    async (append = false) => {
      const q = busca.trim();
      if (q.length < 2) {
        setModoBusca(false);
        setBuscaItens([]);
        await loadFeed(false);
        return;
      }

      const req = ++requestId.current;
      if (append) setLoadingMore(true);
      else {
        setLoadingList(true);
        setListError(null);
      }

      setModoBusca(true);
      try {
        const currentBusca = buscaRef.current;
        const cursor =
          append && currentBusca.length > 0
            ? {
                score: Number(Number(currentBusca[currentBusca.length - 1].score).toFixed(6)),
                perguntaId: currentBusca[currentBusca.length - 1].pergunta_id,
              }
            : null;
        const items = await stackBuscar({
          query: q,
          escopo,
          filtros,
          equipeCtx,
          limit: STACK_PAGE_SIZE,
          cursor,
        });

        if (req !== requestId.current) return;

        setBuscaItens((prev) => (append ? [...prev, ...items] : items));
        setHasMoreBusca(items.length >= STACK_PAGE_SIZE);
      } catch (e) {
        console.error(e);
        if (!append) {
          setListError('Erro na busca.');
          setBuscaItens([]);
          setHasMoreBusca(false);
          toast.error('Erro na busca.');
        }
      } finally {
        if (req === requestId.current) {
          setLoadingList(false);
          setLoadingMore(false);
        }
      }
    },
    [busca, escopo, filtros, equipeCtx, loadFeed],
  );

  const refresh = useCallback(async () => {
    if (modoBusca || busca.trim().length >= 2) {
      await runBusca(false);
    } else {
      await loadFeed(false);
    }
  }, [modoBusca, busca, runBusca, loadFeed]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      if (busca.trim().length >= 2) void runBusca(false);
      else void loadFeed(false);
    }, 300);
    return () => clearTimeout(t);
  }, [isOpen, busca, escopo, filtros, equipeCtx]); // eslint-disable-line react-hooks/exhaustive-deps -- debounced reload

  const loadMore = useCallback(() => {
    if (loadingMore || loadingList) return;
    if (modoBusca) void runBusca(true);
    else void loadFeed(true);
  }, [loadingMore, loadingList, modoBusca, runBusca, loadFeed]);

  const clearBusca = useCallback(() => {
    setModoBusca(false);
    setBuscaItens([]);
  }, []);

  const retryList = useCallback(async () => {
    setListError(null);
    if (modoBusca || busca.trim().length >= 2) await runBusca(false);
    else await loadFeed(false);
  }, [modoBusca, busca, runBusca, loadFeed]);

  return {
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
  };
}

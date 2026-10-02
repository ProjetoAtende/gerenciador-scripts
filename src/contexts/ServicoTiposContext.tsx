import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  SERVICOS_CONFIG,
  ServicoConfig,
  TipoServico,
  getTipoServicoParaTarefa,
  listarServicoTipos,
  servicoTipoRowToConfig,
  type ServicoTipoRow,
} from '../services/servicosService';
import { TIPO_TAREFA_LABELS, TipoTarefa, normalizarTipoTarefa } from '../types/Tarefa';

type ServicoTiposContextValue = {
  configs: ServicoConfig[];
  carregando: boolean;
  erro: string | null;
  fonte: 'banco' | 'padrao';
  refresh: () => Promise<void>;
  getConfig: (tipo: TipoServico) => ServicoConfig;
};

const ServicoTiposContext = createContext<ServicoTiposContextValue | null>(null);

function mergeConfigs(rows: ServicoTipoRow[]): ServicoConfig[] {
  const map = new Map<string, ServicoConfig>();
  for (const c of SERVICOS_CONFIG) {
    map.set(c.tipo, { ...c });
  }
  for (const row of rows) {
    if (!row.ativo) {
      map.delete(row.codigo);
      continue;
    }
    map.set(row.codigo, servicoTipoRowToConfig(row));
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

export function ServicoTiposProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<ServicoConfig[]>(SERVICOS_CONFIG);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fonte, setFonte] = useState<'banco' | 'padrao'>('padrao');

  const refresh = useCallback(async () => {
    if (!user) {
      setConfigs(SERVICOS_CONFIG);
      setFonte('padrao');
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const res = await listarServicoTipos(false);
      if (res.sucesso && res.tipos.length > 0) {
        setConfigs(mergeConfigs(res.tipos));
        setFonte('banco');
      } else if (res.sucesso) {
        setConfigs(SERVICOS_CONFIG);
        setFonte('padrao');
      } else {
        setConfigs(SERVICOS_CONFIG);
        setFonte('padrao');
        setErro(res.erro ?? 'Não foi possível carregar tipos de serviço.');
      }
    } catch {
      setConfigs(SERVICOS_CONFIG);
      setFonte('padrao');
      setErro('Não foi possível carregar tipos de serviço.');
    } finally {
      setCarregando(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getConfig = useCallback(
    (tipo: TipoServico): ServicoConfig => {
      const found = configs.find((c) => c.tipo === tipo);
      if (found) return found;
      const fallback = SERVICOS_CONFIG.find((c) => c.tipo === tipo);
      if (fallback) return fallback;
      return {
        tipo,
        label: tipo.replace(/_/g, ' '),
        unidade: 'unidades',
        icone: '📋',
        dica: '',
      };
    },
    [configs]
  );

  const value = useMemo(
    () => ({ configs, carregando, erro, fonte, refresh, getConfig }),
    [configs, carregando, erro, fonte, refresh, getConfig]
  );

  return <ServicoTiposContext.Provider value={value}>{children}</ServicoTiposContext.Provider>;
}

export function useServicoTipos(): ServicoTiposContextValue {
  const ctx = useContext(ServicoTiposContext);
  if (!ctx) {
    throw new Error('useServicoTipos deve ser usado dentro de ServicoTiposProvider');
  }
  return ctx;
}

export function resolveTipoTarefaLabel(
  tipo: TipoTarefa | null | undefined,
  getConfig: (t: TipoServico) => ServicoConfig
): string {
  if (!tipo) return '';
  const normalizado = normalizarTipoTarefa(tipo);
  const servicoSlug = getTipoServicoParaTarefa(normalizado);
  if (servicoSlug) {
    return getConfig(servicoSlug).label;
  }
  return TIPO_TAREFA_LABELS[tipo] ?? tipo;
}

/** Label de tarefa alinhada ao catálogo de serviços quando há equivalência por slug. */
export function useTipoTarefaLabel(tipo: TipoTarefa | null | undefined): string {
  const { getConfig } = useServicoTipos();
  return resolveTipoTarefaLabel(tipo, getConfig);
}

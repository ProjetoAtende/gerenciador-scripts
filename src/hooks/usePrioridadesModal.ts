/**
 * usePrioridadesModal.ts
 *
 * Estado do app "Prioridades e Urgências" dentro do modal fullscreen.
 *
 * Concentra: perfil do usuário, módulo ativo, item de navegação selecionado,
 * contadores do painel lateral e a anotação em foco. As telas são derivadas
 * desse estado (ver telas 7.2, 7.3 e 7.4 da especificação).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  contarPorStatus,
  listarUpjs,
  obterMeuPerfil,
} from '../services/prioridadesService';
import type {
  AnotacaoPrioridade,
  PerfilUsuarioPrioridades,
  PrioridadeModulo,
  PrioridadePerfil,
  Upj,
} from '../types/Prioridades';
import { gruposDoModulo } from '../types/Prioridades';

export type TelaPrioridades =
  | { tipo: 'inicial' }
  | { tipo: 'lista'; grupo: string }
  | { tipo: 'nova' }
  | { tipo: 'detalhe'; anotacaoId: number; modo: 'conferencia' | 'analise' | 'resposta' | 'consulta' }
  | { tipo: 'designacoes' }
  | { tipo: 'historico' };

export interface UsePrioridadesModal {
  carregando: boolean;
  perfil: PerfilUsuarioPrioridades | null;
  /** Perfil efetivo: base, ou o da designação em vigor de maior alcance. */
  perfilEfetivo: PrioridadePerfil | null;
  modulo: PrioridadeModulo;
  setModulo: (m: PrioridadeModulo) => void;
  upjs: Upj[];
  contadores: Record<string, number>;
  tela: TelaPrioridades;
  irPara: (tela: TelaPrioridades) => void;
  voltarInicial: () => void;
  atualizar: () => Promise<void>;
  /** Anotação destacada na tela inicial, quando aberta a partir de uma lista. */
  anotacaoAberta: AnotacaoPrioridade | null;
  setAnotacaoAberta: (a: AnotacaoPrioridade | null) => void;
}

export function usePrioridadesModal(isOpen: boolean): UsePrioridadesModal {
  const { user } = useAuth();

  const [carregando, setCarregando] = useState(true);
  const [perfil, setPerfil] = useState<PerfilUsuarioPrioridades | null>(null);
  const [perfilEfetivo, setPerfilEfetivo] = useState<PrioridadePerfil | null>(null);
  const [modulo, setModulo] = useState<PrioridadeModulo>('atendente');
  const [upjs, setUpjs] = useState<Upj[]>([]);
  const [contadores, setContadores] = useState<Record<string, number>>({});
  // PU-12: contagem própria das Urgentíssimas, que são um recorte por marcação
  // e não um status.
  const [totalUrgentissimos, setTotalUrgentissimos] = useState(0);
  const [tela, setTela] = useState<TelaPrioridades>({ tipo: 'inicial' });
  const [anotacaoAberta, setAnotacaoAberta] = useState<AnotacaoPrioridade | null>(null);

  const atualizar = useCallback(async () => {
    const { porStatus, urgentissimos } = await contarPorStatus();
    setContadores(porStatus);
    setTotalUrgentissimos(urgentissimos);
  }, []);

  useEffect(() => {
    if (!isOpen || !user) return;
    let cancelado = false;

    (async () => {
      setCarregando(true);
      try {
        const [resultadoPerfil, listaUpjs] = await Promise.all([
          obterMeuPerfil(),
          listarUpjs(),
        ]);
        if (cancelado) return;

        if (resultadoPerfil.perfil) {
          setPerfil(resultadoPerfil.perfil);
          setPerfilEfetivo(resultadoPerfil.perfilEfetivo);
          if (resultadoPerfil.modulo) setModulo(resultadoPerfil.modulo);
        } else {
          // Usuário ainda não cadastrado no app. Mantém o modal navegável com o
          // módulo Atendentes e uma faixa de aviso — evita beco sem saída.
          setPerfil(null);
          setPerfilEfetivo(null);
          setModulo('atendente');
        }
        setUpjs(listaUpjs);
        await atualizar();
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [isOpen, user, atualizar]);

  const grupos = useMemo(() => gruposDoModulo(modulo), [modulo]);

  // Contadores agregados por grupo do painel lateral (RF-GES-08 / RF-UPJ-02).
  const contadoresPorGrupo = useMemo(() => {
    const resultado: Record<string, number> = {};
    for (const grupo of grupos) {
      // "Urgentíssimas" usa a contagem por marcação, não a soma por status —
      // senão divergiria da lista exibida (PU-12).
      resultado[grupo.chave] = grupo.somenteUrgentissimos
        ? totalUrgentissimos
        : grupo.status.reduce((acc, status) => acc + (contadores[status] ?? 0), 0);
    }
    return resultado;
  }, [grupos, contadores, totalUrgentissimos]);

  const irPara = useCallback((nova: TelaPrioridades) => setTela(nova), []);
  const voltarInicial = useCallback(() => setTela({ tipo: 'inicial' }), []);

  const trocarModulo = useCallback((m: PrioridadeModulo) => {
    setModulo(m);
    setTela({ tipo: 'inicial' });
  }, []);

  return {
    carregando,
    perfil,
    perfilEfetivo,
    modulo,
    setModulo: trocarModulo,
    upjs,
    contadores: contadoresPorGrupo,
    tela,
    irPara,
    voltarInicial,
    atualizar,
    anotacaoAberta,
    setAnotacaoAberta,
  };
}

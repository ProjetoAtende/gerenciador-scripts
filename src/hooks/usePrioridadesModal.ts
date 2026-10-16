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
  listarLinhasPainel,
  listarUpjs,
  obterMeuPerfil,
} from '../services/prioridadesService';
import type { LinhaPainel } from '../services/prioridadesService';
import type {
  AnotacaoPrioridade,
  PerfilUsuarioPrioridades,
  PrioridadeModulo,
  PrioridadePerfil,
  Upj,
} from '../types/Prioridades';
import { contagemDaLista, type ChaveLista } from '../components/prioridades/prioridadesListas';

export type TelaPrioridades =
  | { tipo: 'inicial' }
  | { tipo: 'lista'; grupo: string }
  | { tipo: 'nova' }
  | { tipo: 'detalhe'; anotacaoId: number; modo: 'conferencia' | 'analise' | 'resposta' | 'correcao' | 'consulta' }
  | { tipo: 'designacoes' }
  | { tipo: 'configuracoes' }
  | { tipo: 'historico' }
  | { tipo: 'log-acessos' };

export interface UsePrioridadesModal {
  carregando: boolean;
  perfil: PerfilUsuarioPrioridades | null;
  /** Perfil efetivo: base, ou o da designação em vigor de maior alcance. */
  perfilEfetivo: PrioridadePerfil | null;
  modulo: PrioridadeModulo;
  setModulo: (m: PrioridadeModulo) => void;
  upjs: Upj[];
  contadores: Record<string, { total: number; reiteradas: number; urgentissimas: number }>;
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
  const [linhasPainel, setLinhasPainel] = useState<LinhaPainel[]>([]);
  const [tela, setTela] = useState<TelaPrioridades>({ tipo: 'inicial' });
  const [anotacaoAberta, setAnotacaoAberta] = useState<AnotacaoPrioridade | null>(null);

  const atualizar = useCallback(async () => {
    setLinhasPainel(await listarLinhasPainel());
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

  const contadoresPorGrupo = useMemo(() => {
    const ctx = {
      perfilEfetivo,
      usuarioId: user?.id ?? null,
      somenteVinculadas: perfil?.ver_somente_vinculadas ?? false,
    };
    const chaves: ChaveLista[] = [
      'ag-conferencia',
      'devolvidas',
      'aprovadas',
      'reprovadas',
      'urgentissimas',
      'reiteradas',
      'retornadas',
      'novas',
      'em-analise',
      'resolvidas',
      'rejeitadas',
    ];
    const resultado: Record<string, { total: number; reiteradas: number; urgentissimas: number }> = {};
    for (const chave of chaves) {
      resultado[chave] = contagemDaLista(linhasPainel, chave, ctx);
    }
    return resultado;
  }, [linhasPainel, perfilEfetivo, perfil?.ver_somente_vinculadas, user?.id]);

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

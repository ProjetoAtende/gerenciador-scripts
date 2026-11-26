/**
 * Estado da v2 de "Prioridades e Urgências".
 *
 * Mesma lógica de `hooks/usePrioridadesModal.ts` (v1), de propósito: a v2 troca
 * a apresentação, não as regras. Diferenças:
 *  - grava a tela aberta numa chave de sessão própria (ver prioridadesV2Sessao);
 *  - busca o nome do usuário para a saudação ("Olá, Mônica!") e o painel lateral.
 *
 * A v1 continua intacta e é o backup enquanto a v2 estiver em teste.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { listarLinhasPainel, listarUpjs, obterMeuPerfil } from '../../services/prioridadesService';
import type { LinhaPainel } from '../../services/prioridadesService';
import { supabase } from '../../services/supabaseClient';
import type { TelaPrioridades, UsePrioridadesModal } from '../../hooks/usePrioridadesModal';
import type { AnotacaoPrioridade, PerfilUsuarioPrioridades, PrioridadeModulo, PrioridadePerfil, Upj } from '../../types/Prioridades';
import { contagemDaLista, type ChaveLista } from '../prioridades/prioridadesListas';
import { lerPrioridadesV2Sessao, salvarPrioridadesV2Sessao } from './prioridadesV2Sessao';

export interface UsePrioridadesV2 extends UsePrioridadesModal {
  /** Nome completo do cadastro do Gerenciador (ou o e-mail, se não houver). */
  nomeCompleto: string;
  /** Primeiro nome, para a saudação. */
  primeiroNome: string;
}

const CHAVES_CONTADOR: ChaveLista[] = [
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

export function usePrioridadesV2(isOpen: boolean): UsePrioridadesV2 {
  const { user } = useAuth();

  const [carregando, setCarregando] = useState(true);
  const [perfil, setPerfil] = useState<PerfilUsuarioPrioridades | null>(null);
  const [perfilEfetivo, setPerfilEfetivo] = useState<PrioridadePerfil | null>(null);
  const [modulo, setModulo] = useState<PrioridadeModulo>('atendente');
  const [upjs, setUpjs] = useState<Upj[]>([]);
  const [linhasPainel, setLinhasPainel] = useState<LinhaPainel[]>([]);
  const [tela, setTela] = useState<TelaPrioridades>(() => lerPrioridadesV2Sessao()?.tela ?? { tipo: 'inicial' });
  const [anotacaoAberta, setAnotacaoAberta] = useState<AnotacaoPrioridade | null>(null);
  const [nomeCadastro, setNomeCadastro] = useState<string | null>(null);

  const atualizar = useCallback(async () => {
    setLinhasPainel(await listarLinhasPainel());
  }, []);

  // Depende do ID, não do objeto `user`: o Supabase entrega um objeto novo a cada vez
  // que a aba volta a ficar visível (troca de aba ou de programa). Depender do objeto
  // recarregava a tela inteira e apagava o que estava sendo preenchido na Nova Anotação.
  const usuarioId = user?.id ?? null;

  useEffect(() => {
    if (!isOpen || !usuarioId) return;
    let cancelado = false;

    (async () => {
      setCarregando(true);
      try {
        const [resultadoPerfil, listaUpjs, cadastro] = await Promise.all([
          obterMeuPerfil(),
          listarUpjs(),
          supabase.from('users').select('nome').eq('id', usuarioId).maybeSingle(),
        ]);
        if (cancelado) return;

        if (resultadoPerfil.perfil) {
          setPerfil(resultadoPerfil.perfil);
          setPerfilEfetivo(resultadoPerfil.perfilEfetivo);
          if (resultadoPerfil.modulo) setModulo(resultadoPerfil.modulo);
        } else {
          setPerfil(null);
          setPerfilEfetivo(null);
          setModulo('atendente');
        }
        setUpjs(listaUpjs);
        setNomeCadastro((cadastro.data as { nome?: string } | null)?.nome?.trim() || null);
        await atualizar();
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [isOpen, usuarioId, atualizar]);

  const contadores = useMemo(() => {
    const ctx = {
      perfilEfetivo,
      usuarioId: user?.id ?? null,
      somenteVinculadas: perfil?.ver_somente_vinculadas ?? false,
    };
    const resultado: Record<string, { total: number; reiteradas: number; urgentissimas: number }> = {};
    for (const chave of CHAVES_CONTADOR) resultado[chave] = contagemDaLista(linhasPainel, chave, ctx);
    return resultado;
  }, [linhasPainel, perfilEfetivo, perfil?.ver_somente_vinculadas, user?.id]);

  const irPara = useCallback(
    (nova: TelaPrioridades) => {
      setTela(nova);
      if (isOpen) salvarPrioridadesV2Sessao({ reabrir: true, tela: nova });
    },
    [isOpen]
  );

  useEffect(() => {
    if (!isOpen) return;
    salvarPrioridadesV2Sessao({ reabrir: true, tela });
  }, [isOpen, tela]);

  const voltarInicial = useCallback(() => setTela({ tipo: 'inicial' }), []);

  const trocarModulo = useCallback((m: PrioridadeModulo) => {
    setModulo(m);
    setTela({ tipo: 'inicial' });
  }, []);

  const metadados = user?.user_metadata as { nome?: string; name?: string } | undefined;
  const nomeCompleto =
    nomeCadastro || metadados?.nome?.trim() || metadados?.name?.trim() || user?.email?.split('@')[0] || 'Usuário';
  // "Mônica Atendente (teste)" → "Mônica"
  const primeiroNome = nomeCompleto.split(/\s+/)[0] ?? nomeCompleto;

  return {
    carregando,
    perfil,
    perfilEfetivo,
    modulo,
    setModulo: trocarModulo,
    upjs,
    contadores,
    tela,
    irPara,
    voltarInicial,
    atualizar,
    anotacaoAberta,
    setAnotacaoAberta,
    nomeCompleto,
    primeiroNome,
  };
}

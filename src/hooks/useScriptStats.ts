import { useState, useEffect, useCallback } from 'react';
import {
  fetchResumo,
  fetchTopCriadores,
  fetchCriacaoPorPeriodo,
  fetchRevisaoPorPeriodo,
  fetchCriadoresPorPeriodo,
  fetchTopRevisores,
  fetchPropostasPorPeriodo,
  fetchEquipesCriadoras,
  type ScriptsResumo,
  type TopCriador,
  type DadosPorPeriodo,
  type CriadorPorPeriodo,
  type TopRevisor,
  type PropostaPorPeriodo,
  type EquipeCriadora,
  type PeriodoFiltro,
} from '../services/scriptStatsService';

export type SecaoStats = 'visaoGeral' | 'criacao' | 'revisao' | 'criadores' | 'revisores' | 'propostas' | 'equipes';

interface ScriptStatsState {
  // Resumo (carregado sempre)
  resumo: ScriptsResumo | null;
  loadingResumo: boolean;

  // Dados por seção
  topCriadores: TopCriador[];
  loadingTopCriadores: boolean;

  dadosCriacao: DadosPorPeriodo[];
  loadingCriacao: boolean;
  periodoCriacao: PeriodoFiltro;
  setPeriodoCriacao: (p: PeriodoFiltro) => void;

  dadosRevisao: DadosPorPeriodo[];
  loadingRevisao: boolean;
  periodoRevisao: PeriodoFiltro;
  setPeriodoRevisao: (p: PeriodoFiltro) => void;

  criadoresPorPeriodo: CriadorPorPeriodo[];
  loadingCriadores: boolean;
  periodoCriadores: PeriodoFiltro;
  setPeriodoCriadores: (p: PeriodoFiltro) => void;

  topRevisores: TopRevisor[];
  loadingRevisores: boolean;
  periodoRevisores: PeriodoFiltro;
  setPeriodoRevisores: (p: PeriodoFiltro) => void;

  dadosPropostas: PropostaPorPeriodo[];
  loadingPropostas: boolean;
  periodoPropostas: PeriodoFiltro;
  setPeriodoPropostas: (p: PeriodoFiltro) => void;

  equipesCriadoras: EquipeCriadora[];
  loadingEquipes: boolean;

  // Navegação
  secaoAtiva: SecaoStats;
  setSecaoAtiva: (s: SecaoStats) => void;
}

export function useScriptStats(isOpen: boolean): ScriptStatsState {
  // Navegação
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoStats>('visaoGeral');

  // Resumo
  const [resumo, setResumo] = useState<ScriptsResumo | null>(null);
  const [loadingResumo, setLoadingResumo] = useState(false);

  // Top criadores
  const [topCriadores, setTopCriadores] = useState<TopCriador[]>([]);
  const [loadingTopCriadores, setLoadingTopCriadores] = useState(false);

  // Criação por período
  const [dadosCriacao, setDadosCriacao] = useState<DadosPorPeriodo[]>([]);
  const [loadingCriacao, setLoadingCriacao] = useState(false);
  const [periodoCriacao, setPeriodoCriacao] = useState<PeriodoFiltro>('30d');

  // Revisão por período
  const [dadosRevisao, setDadosRevisao] = useState<DadosPorPeriodo[]>([]);
  const [loadingRevisao, setLoadingRevisao] = useState(false);
  const [periodoRevisao, setPeriodoRevisao] = useState<PeriodoFiltro>('30d');

  // Criadores por período
  const [criadoresPorPeriodo, setCriadoresPorPeriodo] = useState<CriadorPorPeriodo[]>([]);
  const [loadingCriadores, setLoadingCriadores] = useState(false);
  const [periodoCriadores, setPeriodoCriadores] = useState<PeriodoFiltro>('30d');

  // Revisores
  const [topRevisores, setTopRevisores] = useState<TopRevisor[]>([]);
  const [loadingRevisores, setLoadingRevisores] = useState(false);
  const [periodoRevisores, setPeriodoRevisores] = useState<PeriodoFiltro>('30d');

  // Propostas
  const [dadosPropostas, setDadosPropostas] = useState<PropostaPorPeriodo[]>([]);
  const [loadingPropostas, setLoadingPropostas] = useState(false);
  const [periodoPropostas, setPeriodoPropostas] = useState<PeriodoFiltro>('30d');

  // Equipes
  const [equipesCriadoras, setEquipesCriadoras] = useState<EquipeCriadora[]>([]);
  const [loadingEquipes, setLoadingEquipes] = useState(false);

  // Carrega resumo + dados da visão geral ao abrir
  const loadResumo = useCallback(async () => {
    setLoadingResumo(true);
    try {
      const data = await fetchResumo();
      setResumo(data);
    } catch (err) {
      console.error('Erro ao carregar resumo de scripts:', err);
    } finally {
      setLoadingResumo(false);
    }
  }, []);

  const loadTopCriadores = useCallback(async () => {
    setLoadingTopCriadores(true);
    try {
      setTopCriadores(await fetchTopCriadores());
    } catch (err) {
      console.error('Erro ao carregar top criadores:', err);
    } finally {
      setLoadingTopCriadores(false);
    }
  }, []);

  const loadEquipes = useCallback(async () => {
    setLoadingEquipes(true);
    try {
      setEquipesCriadoras(await fetchEquipesCriadoras());
    } catch (err) {
      console.error('Erro ao carregar equipes criadoras:', err);
    } finally {
      setLoadingEquipes(false);
    }
  }, []);

  // Carrega ao abrir
  useEffect(() => {
    if (isOpen) {
      loadResumo();
      loadTopCriadores();
      loadEquipes();
    }
  }, [isOpen, loadResumo, loadTopCriadores, loadEquipes]);

  // Carrega dados de criação quando aba ou período muda
  useEffect(() => {
    if (!isOpen || secaoAtiva !== 'criacao') return;
    let cancelled = false;
    setLoadingCriacao(true);
    fetchCriacaoPorPeriodo(periodoCriacao)
      .then(d => { if (!cancelled) setDadosCriacao(d); })
      .catch(err => console.error('Erro criação por período:', err))
      .finally(() => { if (!cancelled) setLoadingCriacao(false); });
    return () => { cancelled = true; };
  }, [isOpen, secaoAtiva, periodoCriacao]);

  // Carrega dados de revisão
  useEffect(() => {
    if (!isOpen || secaoAtiva !== 'revisao') return;
    let cancelled = false;
    setLoadingRevisao(true);
    fetchRevisaoPorPeriodo(periodoRevisao)
      .then(d => { if (!cancelled) setDadosRevisao(d); })
      .catch(err => console.error('Erro revisão por período:', err))
      .finally(() => { if (!cancelled) setLoadingRevisao(false); });
    return () => { cancelled = true; };
  }, [isOpen, secaoAtiva, periodoRevisao]);

  // Carrega criadores por período
  useEffect(() => {
    if (!isOpen || secaoAtiva !== 'criadores') return;
    let cancelled = false;
    setLoadingCriadores(true);
    fetchCriadoresPorPeriodo(periodoCriadores)
      .then(d => { if (!cancelled) setCriadoresPorPeriodo(d); })
      .catch(err => console.error('Erro criadores por período:', err))
      .finally(() => { if (!cancelled) setLoadingCriadores(false); });
    return () => { cancelled = true; };
  }, [isOpen, secaoAtiva, periodoCriadores]);

  // Carrega revisores
  useEffect(() => {
    if (!isOpen || secaoAtiva !== 'revisores') return;
    let cancelled = false;
    setLoadingRevisores(true);
    fetchTopRevisores(periodoRevisores)
      .then(d => { if (!cancelled) setTopRevisores(d); })
      .catch(err => console.error('Erro top revisores:', err))
      .finally(() => { if (!cancelled) setLoadingRevisores(false); });
    return () => { cancelled = true; };
  }, [isOpen, secaoAtiva, periodoRevisores]);

  // Carrega propostas
  useEffect(() => {
    if (!isOpen || secaoAtiva !== 'propostas') return;
    let cancelled = false;
    setLoadingPropostas(true);
    fetchPropostasPorPeriodo(periodoPropostas)
      .then(d => { if (!cancelled) setDadosPropostas(d); })
      .catch(err => console.error('Erro propostas por período:', err))
      .finally(() => { if (!cancelled) setLoadingPropostas(false); });
    return () => { cancelled = true; };
  }, [isOpen, secaoAtiva, periodoPropostas]);

  return {
    resumo, loadingResumo,
    topCriadores, loadingTopCriadores,
    dadosCriacao, loadingCriacao, periodoCriacao, setPeriodoCriacao,
    dadosRevisao, loadingRevisao, periodoRevisao, setPeriodoRevisao,
    criadoresPorPeriodo, loadingCriadores, periodoCriadores, setPeriodoCriadores,
    topRevisores, loadingRevisores, periodoRevisores, setPeriodoRevisores,
    dadosPropostas, loadingPropostas, periodoPropostas, setPeriodoPropostas,
    equipesCriadoras, loadingEquipes,
    secaoAtiva, setSecaoAtiva,
  };
}

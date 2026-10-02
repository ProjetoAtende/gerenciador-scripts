/**
 * OutrosServicosModal.tsx
 *
 * Modal para registro e gestão de Outros Serviços realizados pelos membros da equipe.
 * Serviços cobertos: Email, Homologação, Ouvidoria, CPA, Chamado SMAX, Criação de Script,
 * Desenvolvimento e Execução, Agendamento de Visitas, Visitas Virtuais, Visitas Presenciais.
 *
 * Abas:
 *   - Novo Serviço    → formulário de registro
 *   - Meus Serviços   → listagem pessoal com edição/exclusão inline
 *   - Serviços da Equipe → listagem da equipe com filtro por membro
 */

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Pencil, Trash2, Check, ChevronDown, Loader2, RefreshCw, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useEffectiveAuth } from '../hooks/useEffectiveAuth';
import {
  TipoServico,
  FiltroPeriodo,
  Servico,
  ServicoConfig,
  criarServico,
  atualizarServico,
  excluirServico,
  listarServicosUsuarioFiltrado,
  listarServicosEquipeFiltrado,
  formatarQuantidade,
} from '../services/servicosService';
import { useServicoTipos } from '../contexts/ServicoTiposContext';
import { podeGerenciarTiposServico } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { RichTextEditor } from './RichTextEditor';

const ServicosEstatisticasTab = React.lazy(() => import('./ServicosEstatisticasTab'));
const ServicosGerenciamentoTab = React.lazy(() => import('./ServicosGerenciamentoTab'));

// ─────────────────────────────────────────────────────────────
// Tipos locais
// ─────────────────────────────────────────────────────────────

type Aba = 'novoServico' | 'meusServicos' | 'servicosEquipe' | 'estatisticas' | 'gerenciamento';

interface MembroEquipe {
  id: string;
  nome: string;
}

interface EstadoEdicao {
  id: string;
  tipo: TipoServico;
  quantidade: string;
  observacao: string;
  descricao: string;
  dataExecucao: string;  // datetime-local string
}

// ─────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────

interface OutrosServicosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Lista de sugestões clicáveis abaixo do campo de busca de tipos */
function ListaSugestoesTiposServico({
  itens,
  tipoSelecionado,
  onSelecionar,
  className = '',
  itemClassName = '',
}: {
  itens: ServicoConfig[];
  tipoSelecionado: TipoServico | null;
  onSelecionar: (tipo: TipoServico) => void;
  className?: string;
  itemClassName?: string;
}) {
  if (itens.length === 0) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400 px-1 py-3">
        Nenhum tipo encontrado. Tente outras palavras.
      </p>
    );
  }

  return (
    <ul className={`space-y-0.5 ${className}`} role="listbox" aria-label="Tipos de serviço sugeridos">
      {itens.map((c) => (
        <li key={c.tipo} role="option" aria-selected={tipoSelecionado === c.tipo}>
          <button
            type="button"
            onClick={() => onSelecionar(c.tipo)}
            className={`w-full flex items-start gap-2 px-2 py-2 rounded-lg text-xs text-left transition-all ${itemClassName} ${
              tipoSelecionado === c.tipo
                ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 font-semibold'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="text-sm w-5 text-center flex-shrink-0 leading-snug">{c.icone}</span>
            <span className="flex-1 min-w-0 leading-snug break-words">{c.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export const OutrosServicosModal: React.FC<OutrosServicosModalProps> = ({ isOpen, onClose }) => {
  const { user, equipeId, userRole } = useEffectiveAuth();
  const { configs: servicosConfigCatalogo, getConfig: getServicoConfigFromCatalogo } = useServicoTipos();

  // ── Navegação ──────────────────────────────────────────────
  const [abaAtiva, setAbaAtiva] = useState<Aba>('novoServico');

  // ── Formulário Novo Serviço ────────────────────────────────
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoServico | null>(null);
  const [buscaTipoSidebar, setBuscaTipoSidebar] = useState('');
  const [quantidadeStr, setQuantidadeStr] = useState('');
  const [observacao, setObservacao] = useState('');
  /** Conteúdo HTML rico da descrição */
  const [descricao, setDescricao] = useState('');
  /** Controla a abertura do modal de descrição (novo serviço) */
  const [modalDescricaoAberto, setModalDescricaoAberto] = useState(false);
  /** datetime-local string ("YYYY-MM-DDTHH:mm"). Vazio = agora ao salvar. */
  const [dataExecucaoStr, setDataExecucaoStr] = useState('');
  const [salvando, setSalvando] = useState(false);

  // ── Meus Serviços ──────────────────────────────────────────
  const [meusServicos, setMeusServicos] = useState<Servico[]>([]);
  const [totalMeus, setTotalMeus] = useState(0);
  const [carregandoMeus, setCarregandoMeus] = useState(false);
  const [edicao, setEdicao] = useState<EstadoEdicao | null>(null);
  const [salvanEdicao, setSalvanEdicao] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  /** Controle do modal de edição de descrição (modo edição do card) */
  const [edicaoDescricaoModalAberto, setEdicaoDescricaoModalAberto] = useState(false);
  /** Modal de visualização de descrição (conteúdo completo) */
  const [viewDescricaoModal, setViewDescricaoModal] = useState<{ titulo: string; html: string } | null>(null);
  // Filtros — Meus Serviços
  const [filtroPeriodoMeus, setFiltroPeriodoMeus] = useState<FiltroPeriodo>('24h');
  const [filtroTipoMeus, setFiltroTipoMeus] = useState<TipoServico | ''>('');

  // ── Serviços da Equipe ─────────────────────────────────────
  const [servicosEquipe, setServicosEquipe] = useState<Servico[]>([]);
  const [totalEquipe, setTotalEquipe] = useState(0);
  const [carregandoEquipe, setCarregandoEquipe] = useState(false);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [filtroMembro, setFiltroMembro] = useState('');
  // Filtros — Serviços da Equipe
  const [filtroPeriodoEquipe, setFiltroPeriodoEquipe] = useState<FiltroPeriodo>('24h');
  const [filtroTipoEquipe, setFiltroTipoEquipe] = useState<TipoServico | ''>('');

  // ── Paginação ──────────────────────────────────────────────
  const LIMITE = 30;
  const [offsetMeus, setOffsetMeus] = useState(0);
  const [offsetEquipe, setOffsetEquipe] = useState(0);

  // ── Scroll da área principal ───────────────────────────────
  const mainRef = useRef<HTMLElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const handleMainScroll = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    // Mostra o botão quando há conteúdo scrollável e o usuário já rolou ou pode rolar
    setShowScrollBtn(el.scrollHeight > el.clientHeight + 80);
  }, []);

  // Recalcular visibilidade dos botões quando a aba muda
  useEffect(() => {
    // Pequeno delay para o conteúdo renderizar
    const t = setTimeout(handleMainScroll, 150);
    return () => clearTimeout(t);
  }, [abaAtiva, meusServicos, servicosEquipe, handleMainScroll]);

  // ─────────────────────────────────────────────────────────
  // Config do tipo selecionado – reativa
  // ─────────────────────────────────────────────────────────
  const configAtual = tipoSelecionado ? getServicoConfigFromCatalogo(tipoSelecionado) : null;

  const tiposServicoOrdenados = useMemo(
    () => [...servicosConfigCatalogo].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    [servicosConfigCatalogo]
  );

  const buscaTipoNormalizada = buscaTipoSidebar.trim().toLowerCase();
  const buscaTipoVazia = buscaTipoNormalizada.length === 0;

  const tiposServicoSugeridos = useMemo(() => {
    if (!buscaTipoNormalizada) return tiposServicoOrdenados;
    const tokens = buscaTipoNormalizada.split(/\s+/).filter(Boolean);
    return tiposServicoOrdenados.filter((c) => {
      const haystack = `${c.label} ${c.tipo.replace(/_/g, ' ')}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [buscaTipoNormalizada, tiposServicoOrdenados]);

  const selecionarTipoServico = useCallback((tipo: TipoServico) => {
    setTipoSelecionado(tipo);
    setQuantidadeStr('');
    setBuscaTipoSidebar(getServicoConfigFromCatalogo(tipo).label);
  }, [getServicoConfigFromCatalogo]);

  const handleBuscaTipoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tiposServicoSugeridos.length > 0) {
      e.preventDefault();
      selecionarTipoServico(tiposServicoSugeridos[0].tipo);
    }
    if (e.key === 'Escape') {
      setBuscaTipoSidebar('');
    }
  };

  // ─────────────────────────────────────────────────────────
  // Loaders
  // ─────────────────────────────────────────────────────────
  const carregarMeusServicos = useCallback(
    async (
      offset = 0,
      opts?: { periodo?: FiltroPeriodo; tipo?: TipoServico | '' }
    ) => {
      if (!user) return;
      setCarregandoMeus(true);
      try {
        const res = await listarServicosUsuarioFiltrado(user.id, {
          periodo: opts?.periodo ?? filtroPeriodoMeus,
          tipo: opts?.tipo !== undefined ? opts.tipo : filtroTipoMeus,
          limite: LIMITE,
          offset,
        });
        if (res.sucesso) {
          setMeusServicos(res.servicos);
          setTotalMeus(res.total);
          setOffsetMeus(offset);
        } else {
          toast.error(res.erro ?? 'Erro ao carregar seus serviços.');
        }
      } finally {
        setCarregandoMeus(false);
      }
    },
    [user, filtroPeriodoMeus, filtroTipoMeus]
  );

  const carregarServicosEquipe = useCallback(
    async (
      offset = 0,
      opts?: { periodo?: FiltroPeriodo; tipo?: TipoServico | ''; membroId?: string }
    ) => {
      if (!equipeId) return;
      setCarregandoEquipe(true);
      try {
        const res = await listarServicosEquipeFiltrado(equipeId, {
          periodo: opts?.periodo ?? filtroPeriodoEquipe,
          tipo: opts?.tipo !== undefined ? opts.tipo : filtroTipoEquipe,
          membroId: opts?.membroId !== undefined ? opts.membroId : filtroMembro,
          limite: LIMITE,
          offset,
        });
        if (res.sucesso) {
          setServicosEquipe(res.servicos);
          setTotalEquipe(res.total);
          setOffsetEquipe(offset);
        } else {
          toast.error(res.erro ?? 'Erro ao carregar serviços da equipe.');
        }
      } finally {
        setCarregandoEquipe(false);
      }
    },
    [equipeId, filtroPeriodoEquipe, filtroTipoEquipe, filtroMembro]
  );

  const carregarMembros = useCallback(async () => {
    if (!equipeId) return;
    const { data } = await supabase
      .from('users')
      .select('id, nome')
      .eq('equipe_id', equipeId)
      .eq('ativo', true)
      .order('nome');
    if (data) {
      setMembros(data as MembroEquipe[]);
    }
  }, [equipeId]);

  // ─────────────────────────────────────────────────────────
  // Efeitos de carregamento por aba
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (abaAtiva === 'meusServicos') carregarMeusServicos(0);
    if (abaAtiva === 'servicosEquipe') {
      carregarServicosEquipe(0);
      carregarMembros();
    }
  }, [abaAtiva, isOpen, carregarMeusServicos, carregarServicosEquipe, carregarMembros]);

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setAbaAtiva('novoServico');
      setQuantidadeStr('');
      setObservacao('');
      setDescricao('');
      setModalDescricaoAberto(false);
      setDataExecucaoStr('');
      setTipoSelecionado(null);
      setBuscaTipoSidebar('');
      setEdicao(null);
      setFiltroMembro('');
      setFiltroPeriodoMeus('24h');
      setFiltroTipoMeus('');
      setFiltroPeriodoEquipe('24h');
      setFiltroTipoEquipe('');
      setMeusServicos([]);
      setServicosEquipe([]);
    }
  }, [isOpen]);

  // ─────────────────────────────────────────────────────────
  // Ações
  // ─────────────────────────────────────────────────────────
  const handleSalvarNovoServico = async () => {
    if (!tipoSelecionado) {
      toast.error('Selecione um tipo de serviço.');
      return;
    }
    const qtd = parseInt(quantidadeStr, 10);
    if (!quantidadeStr || isNaN(qtd) || qtd < 1) {
      toast.error('Informe uma quantidade válida (número inteiro ≥ 1).');
      return;
    }
    if (!user || !equipeId) {
      toast.error('Usuário ou equipe não identificados.');
      return;
    }
    setSalvando(true);
    try {
      const res = await criarServico(
        tipoSelecionado, qtd, user.id, equipeId,
        observacao || undefined,
        dataExecucaoStr ? new Date(dataExecucaoStr).toISOString() : undefined,
        descricao || undefined
      );
      if (res.sucesso) {
        toast.success('Serviço registrado com sucesso! 🎉');
        setQuantidadeStr('');
        setObservacao('');
        setDescricao('');
        setDataExecucaoStr('');
        // Se Meus Serviços já estiver carregado, recarregar
        if (meusServicos.length > 0) carregarMeusServicos(0);
      } else {
        toast.error(res.erro ?? 'Erro ao registrar serviço.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicao = (s: Servico) => {
    // Converter ISO para formato datetime-local ("YYYY-MM-DDTHH:mm")
    const toLocalDT = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setEdicao({
      id: s.id,
      tipo: s.tipo,
      quantidade: String(s.quantidade),
      observacao: s.observacao ?? '',
      descricao: s.descricao ?? '',
      dataExecucao: toLocalDT(s.data_execucao ?? s.criado_em),
    });
  };

  const cancelarEdicao = () => setEdicao(null);

  const handleSalvarEdicao = async () => {
    if (!edicao) return;
    const qtd = parseInt(edicao.quantidade, 10);
    if (isNaN(qtd) || qtd < 1) {
      toast.error('Quantidade inválida.');
      return;
    }
    setSalvanEdicao(true);
    try {
      const original = meusServicos.find((s) => s.id === edicao.id)
        ?? servicosEquipe.find((s) => s.id === edicao.id);
      const campos: Parameters<typeof atualizarServico>[1] = {};
      if (original?.tipo !== edicao.tipo) campos.tipo = edicao.tipo;
      if (original?.quantidade !== qtd) campos.quantidade = qtd;
      if ((original?.observacao ?? '') !== edicao.observacao) campos.observacao = edicao.observacao;
      if ((original?.descricao ?? '') !== edicao.descricao) campos.descricao = edicao.descricao;
      // Comparar data_execucao
      if (edicao.dataExecucao) {
        const novaISO = new Date(edicao.dataExecucao).toISOString();
        const originalISO = original?.data_execucao ?? original?.criado_em ?? '';
        if (novaISO !== originalISO) campos.dataExecucao = novaISO;
      }

      if (Object.keys(campos).length === 0) {
        toast.info('Nenhuma alteração detectada.');
        setEdicao(null);
        return;
      }

      const res = await atualizarServico(edicao.id, campos);
      if (res.sucesso) {
        toast.success('Serviço atualizado.');
        setEdicao(null);
        // Recarregar a aba ativa
        if (abaAtiva === 'meusServicos') carregarMeusServicos(offsetMeus);
        if (abaAtiva === 'servicosEquipe') carregarServicosEquipe(offsetEquipe);
      } else {
        toast.error(res.erro ?? 'Erro ao atualizar serviço.');
      }
    } finally {
      setSalvanEdicao(false);
    }
  };

  const handleExcluir = async (id: string) => {
    setExcluindoId(id);
    try {
      const res = await excluirServico(id);
      if (res.sucesso) {
        toast.success('Serviço excluído.');
        carregarMeusServicos(offsetMeus);
      } else {
        toast.error(res.erro ?? 'Erro ao excluir serviço.');
      }
    } finally {
      setExcluindoId(null);
    }
  };

  const isAdmin = userRole === 'admin';
  const podeGerenciarCatalogoServicos = podeGerenciarTiposServico(userRole);

  // ─────────────────────────────────────────────────────────
  // Helpers de UI
  // ─────────────────────────────────────────────────────────
  const formatarData = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const corPorTipo: Record<TipoServico, string> = {
    email: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    homologacao: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    reuniao_interna: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
    reuniao_externa: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    ouvidoria: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    cpa: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    chamado_smax: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    encerrar_ticket_gerenciador: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    criacao_script: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
    agendamento_visitas: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    visitas_virtuais: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
    visitas_presenciais: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    atendimento_teams: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
    atendimento_balcao: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    dev_aplicacao: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    resp_chamado_complexo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    analise_rejeites: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    analise_chamados_antigos: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    criacao_apresentacao: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    elaboracao_relatorio: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300',
    configuracao_sistema: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
    lotacao_usuarios: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300',
    cadastro_radar: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
    cadastro_melhoria: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    estudos_atualizacao: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    atendimento_chamados: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    monitoramento_qualidade: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    producao_documento: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    nape_ciclos_implantacao: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    nape_levantamento_gestores: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    nape_divulgacao_institucional: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    nape_reunioes_orientadoras: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    nape_pos_implantacao: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    atendimento_pr_chat_portal: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    respostas_padronizadas: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    nape_suporte_operacional: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    nape_monitoramento_utilizacao: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    nape_unidades_sem_uso: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    nape_baixa_adesao: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    monitoramento_erros_operacionais: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    acompanhamento_painel_watcher: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    revisao_scripts_atendimento: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    duvidas_recorrentes: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    oportunidades_automacao: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    melhorias_fluxos_operacionais: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    divergencias_entre_sistemas: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    contato_areas_tecnicas: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    padronizacao_orientacoes: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    validacao_procedimentos: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    diagnostico_otimizacao_python: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
    modelagem_regras_negocio: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  };

  if (!isOpen) return null;

  // ─────────────────────────────────────────────────────────
  // Sub-componente: Card de Serviço
  // ─────────────────────────────────────────────────────────
  const ServicoCard = ({
    servico,
    mostrarDono = false,
    podeEditar = false,
  }: {
    servico: Servico;
    mostrarDono?: boolean;
    podeEditar?: boolean;
  }) => {
    const config = getServicoConfigFromCatalogo(servico.tipo);
    const emEdicao = edicao?.id === servico.id;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
      >
        {emEdicao ? (
          /* ── Modo Edição ── */
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{config.icone}</span>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Editando serviço
              </span>
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Tipo
              </label>
              <div className="relative">
                <select
                  value={edicao.tipo}
                  onChange={(e) => {
                    const novoTipo = e.target.value as TipoServico;
                    setEdicao({ ...edicao, tipo: novoTipo });
                  }}
                  className="w-full appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 pr-8"
                >
                  {servicosConfigCatalogo.map((c) => (
                    <option key={c.tipo} value={c.tipo}>
                      {c.icone} {c.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
            </div>

            {/* Quantidade */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Quantidade ({getServicoConfigFromCatalogo(edicao.tipo).unidade})
              </label>
              <input
                type="number"
                min={1}
                value={edicao.quantidade}
                onChange={(e) => setEdicao({ ...edicao, quantidade: e.target.value })}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Observação */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Observação (opcional)
              </label>
              <textarea
                rows={2}
                value={edicao.observacao}
                onChange={(e) => setEdicao({ ...edicao, observacao: e.target.value })}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            {/* Descrição (editor rico) */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Descrição (opcional)
              </label>
              <button
                type="button"
                onClick={() => setEdicaoDescricaoModalAberto(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                📝 {edicao.descricao ? 'Editar Descrição' : 'Adicionar Descrição'}
              </button>
            </div>

            {/* Data de Execução */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Data de execução
              </label>
              <input
                type="datetime-local"
                value={edicao.dataExecucao}
                max={(() => {
                  const now = new Date();
                  const pad = (n: number) => String(n).padStart(2, '0');
                  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
                })()}
                onChange={(e) => setEdicao({ ...edicao, dataExecucao: e.target.value })}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={cancelarEdicao}
                disabled={salvanEdicao}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarEdicao}
                disabled={salvanEdicao}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors disabled:opacity-60"
              >
                {salvanEdicao ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Salvar
              </button>
            </div>
          </div>
        ) : (
          /* ── Modo Visualização ── */
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="text-2xl flex-shrink-0 mt-0.5">{config.icone}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${corPorTipo[servico.tipo]}`}>
                    {config.label}
                  </span>
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    {formatarQuantidade(servico.tipo, servico.quantidade, servicosConfigCatalogo)}
                  </span>
                </div>
                {mostrarDono && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    👤 {servico.usuario_nome}
                  </p>
                )}
                {servico.observacao && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic truncate">
                    {servico.observacao}
                  </p>
                )}
                {servico.descricao && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewDescricaoModal({
                        titulo: `${config.icone} ${config.label}`,
                        html: servico.descricao!,
                      });
                    }}
                    className="text-xs text-teal-600 dark:text-teal-400 mt-1 hover:underline"
                  >
                    📝 Ver descrição
                  </button>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  📅 {formatarData(servico.data_execucao ?? servico.criado_em)}
                </p>
              </div>
            </div>

            {podeEditar && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => iniciarEdicao(servico)}
                  disabled={!!excluindoId}
                  title="Editar"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors disabled:opacity-40"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleExcluir(servico.id)}
                  disabled={excluindoId === servico.id}
                  title="Excluir"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-60"
                >
                  {excluindoId === servico.id ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  // ─────────────────────────────────────────────────────────
  // Definição das abas
  // ─────────────────────────────────────────────────────────
  const abas: { id: Aba; label: string; labelCurto: string; icon: string }[] = [
    { id: 'novoServico',    label: 'Novo Serviço',      labelCurto: 'Novo',   icon: '➕' },
    { id: 'meusServicos',   label: 'Meus Serviços',     labelCurto: 'Meus',   icon: '👤' },
    { id: 'servicosEquipe', label: 'Serviços da Equipe', labelCurto: 'Equipe', icon: '👥' },
    { id: 'estatisticas',   label: 'Estatísticas',       labelCurto: 'Stats',  icon: '📊' },
    { id: 'gerenciamento', label: 'Gerenciamento de Serviços', labelCurto: 'Gestão', icon: '⚙️' },
  ];

  // ─────────────────────────────────────────────────────────
  // Render principal — fullscreen
  // ─────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-white dark:bg-gray-900 flex flex-col"
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 px-6 py-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shadow-inner">
              🔧
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">
                Outros Serviços
              </h1>
              <p className="text-teal-100 text-xs mt-0.5">
                Registre e acompanhe serviços extras da equipe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition-colors"
            title="Fechar"
          >
            <X size={22} />
          </button>
        </div>

        {/* ── Tabs mobile (sm-) ── */}
        <div className="flex-shrink-0 md:hidden border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
          <div className="flex">
            {abas.map((aba) => (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium border-b-2 transition-all ${
                  abaAtiva === aba.id
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-white dark:bg-gray-900'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span className="text-base">{aba.icon}</span>
                {aba.labelCurto}
              </button>
            ))}
          </div>
        </div>

        {/* ── Layout principal: sidebar + conteúdo ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Sidebar lateral (md+) ── */}
          <aside className="hidden md:flex flex-col w-80 flex-shrink-0 min-h-0 bg-gray-50 dark:bg-gray-800/50 border-r dark:border-gray-700 py-4 px-3 overflow-hidden">
            <div className="flex-shrink-0 space-y-1">
              {abas.map((aba) => (
                <button
                  key={aba.id}
                  onClick={() => setAbaAtiva(aba.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all ${
                    abaAtiva === aba.id
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:text-teal-600 dark:hover:text-teal-400'
                  }`}
                >
                  <span className="text-base w-5 text-center">{aba.icon}</span>
                  {aba.label}
                </button>
              ))}
            </div>

            {/* Navegador rápido de tipos (na aba Novo Serviço) */}
            {abaAtiva === 'novoServico' && (
              <div className="flex flex-col flex-1 min-h-0 mt-3 pt-3 border-t border-gray-200/80 dark:border-gray-700/80">
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">
                  Tipos disponíveis
                </p>
                <div className="flex-shrink-0 mb-2 px-1 relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
                  />
                  <input
                    type="search"
                    value={buscaTipoSidebar}
                    onChange={(e) => setBuscaTipoSidebar(e.target.value)}
                    onKeyDown={handleBuscaTipoKeyDown}
                    placeholder="Buscar tipo de serviço..."
                    aria-label="Buscar tipo de serviço"
                    aria-autocomplete="list"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                  />
                </div>
                <p className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500 px-1 mb-1.5">
                  {buscaTipoVazia
                    ? `${tiposServicoSugeridos.length} tipos — clique para selecionar ou use a busca para filtrar`
                    : `${tiposServicoSugeridos.length} de ${tiposServicoOrdenados.length} — clique para selecionar`}
                </p>
                <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                  <ListaSugestoesTiposServico
                    itens={tiposServicoSugeridos}
                    tipoSelecionado={tipoSelecionado}
                    onSelecionar={selecionarTipoServico}
                  />
                </div>
              </div>
            )}

            {/* Chips resumo dos tipos disponíveis */}
            {abaAtiva === 'meusServicos' && totalMeus > 0 && (
              <div className="mt-auto pt-4 px-1">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Resumo
                </p>
                <div className="space-y-1.5">
                  {servicosConfigCatalogo.map((c) => {
                    const count = meusServicos.filter((s) => s.tipo === c.tipo).length;
                    if (count === 0) return null;
                    return (
                      <div key={c.tipo} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">{c.icone} {c.label}</span>
                        <span className="font-bold text-teal-600 dark:text-teal-400">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>

          {/* ── Área de conteúdo ── */}
          <main
            ref={mainRef}
            onScroll={handleMainScroll}
            className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 relative scroll-smooth"
          >
            {/* Botão flutuante de scroll */}
            {showScrollBtn && (
              <div className="sticky top-0 left-0 w-full z-30 pointer-events-none">
                <div className="absolute right-4 top-4 flex flex-col gap-2 pointer-events-auto">
                  <button
                    onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="w-9 h-9 rounded-full bg-teal-600 text-white shadow-lg hover:bg-teal-700 transition-colors flex items-center justify-center opacity-80 hover:opacity-100"
                    title="Ir ao topo"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    onClick={() => mainRef.current?.scrollTo({ top: mainRef.current.scrollHeight, behavior: 'smooth' })}
                    className="w-9 h-9 rounded-full bg-teal-600 text-white shadow-lg hover:bg-teal-700 transition-colors flex items-center justify-center opacity-80 hover:opacity-100"
                    title="Ir ao final"
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ────── ABA: Novo Serviço ────── */}
            {abaAtiva === 'novoServico' && (
              <div className="p-6 md:p-8 flex flex-col items-center justify-center min-h-full">
                {!tipoSelecionado ? (
                  /* ── Estado vazio: nenhum tipo selecionado ── */
                  <div className="flex flex-col items-center text-center py-16 max-w-md mx-auto">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 flex items-center justify-center mb-5">
                      <span className="text-4xl">➕</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Registrar Serviço</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Na sidebar, a lista completa de tipos fica sempre visível; use a busca só para filtrar e clique em um item para selecionar.
                    </p>
                    {/* Grid compacto mobile only (md-) */}
                    <div className="md:hidden w-full space-y-3">
                      <div className="relative">
                        <Search
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                        <input
                          type="search"
                          value={buscaTipoSidebar}
                          onChange={(e) => setBuscaTipoSidebar(e.target.value)}
                          onKeyDown={handleBuscaTipoKeyDown}
                          placeholder="Buscar tipo de serviço…"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                        />
                      </div>
                      <div className="max-h-[50vh] overflow-y-auto text-left">
                        <ListaSugestoesTiposServico
                          itens={tiposServicoSugeridos}
                          tipoSelecionado={tipoSelecionado}
                          onSelecionar={selecionarTipoServico}
                          itemClassName="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-300 dark:hover:border-teal-700"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Formulário de preenchimento (grande e moderno) ── */
                  <motion.div
                    key={tipoSelecionado}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-2xl mx-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Cabeçalho do tipo */}
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 flex items-center justify-center shadow-sm">
                        <span className="text-3xl">{configAtual!.icone}</span>
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                          {configAtual!.label}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          💡 {configAtual!.dica}
                        </p>
                      </div>
                      <button
                        onClick={() => { setTipoSelecionado(null); setQuantidadeStr(''); }}
                        className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Limpar seleção"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Card do formulário */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                      <div className="p-8 space-y-6">
                        {/* Quantidade + Data lado a lado */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Quantidade */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Quantidade{' '}
                              <span className="text-gray-400 font-normal">
                                ({configAtual!.unidade === 'horas' ? 'horas inteiras' : 'unidades'})
                              </span>
                            </label>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              placeholder={configAtual!.unidade === 'horas' ? 'Ex: 2' : 'Ex: 5'}
                              value={quantidadeStr}
                              onChange={(e) => setQuantidadeStr(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !salvando) handleSalvarNovoServico();
                              }}
                              className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
                              autoFocus
                            />
                          </div>

                          {/* Data de Execução */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Data de execução{' '}
                              <span className="text-gray-400 font-normal">(padrão: agora)</span>
                            </label>
                            <input
                              type="datetime-local"
                              value={dataExecucaoStr}
                              max={(() => {
                                const now = new Date();
                                const pad = (n: number) => String(n).padStart(2, '0');
                                return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
                              })()}
                              onChange={(e) => setDataExecucaoStr(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
                            />
                          </div>
                        </div>

                        {/* Descrição (editor rico) */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Descrição{' '}
                            <span className="text-gray-400 font-normal">(opcional)</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setModalDescricaoAberto(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                          >
                            📝 {descricao ? 'Editar Descrição' : 'Adicionar Descrição'}
                          </button>
                          {descricao && (
                            <p className="text-xs text-teal-600 dark:text-teal-400 mt-1.5">
                              ✅ Descrição adicionada
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Botão de ação */}
                      <div className="px-8 pb-8">
                        <button
                          onClick={handleSalvarNovoServico}
                          disabled={salvando || !quantidadeStr}
                          className="w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {salvando ? (
                            <>
                              <Loader2 size={20} className="animate-spin" />
                              Registrando...
                            </>
                          ) : (
                            <>
                              <Plus size={20} />
                              Registrar {configAtual!.label}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* ────── ABA: Meus Serviços ────── */}
            {abaAtiva === 'meusServicos' && (
              <div className="p-6 md:p-8">
                {/* Header da aba */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                      👤 Meus Registros
                    </h2>
                    {!carregandoMeus && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {totalMeus} registro{totalMeus !== 1 ? 's' : ''} no período
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => carregarMeusServicos(0)}
                    disabled={carregandoMeus}
                    title="Atualizar lista"
                    className="p-2 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
                  >
                    <RefreshCw size={16} className={carregandoMeus ? 'animate-spin' : ''} />
                  </button>
                </div>

                {/* ── Filtros ── */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {/* Filtro de período */}
                  <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1">
                    {([ '24h', '48h', '72h', '7d', '30d', 'all'] as FiltroPeriodo[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setFiltroPeriodoMeus(p);
                          setOffsetMeus(0);
                          carregarMeusServicos(0, { periodo: p, tipo: filtroTipoMeus });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          filtroPeriodoMeus === p
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {p === 'all' ? 'Tudo' : p}
                      </button>
                    ))}
                  </div>
                  {/* Filtro de tipo */}
                  <div className="relative">
                    <select
                      value={filtroTipoMeus}
                      onChange={(e) => {
                        const v = e.target.value as TipoServico | '';
                        setFiltroTipoMeus(v);
                        setOffsetMeus(0);
                        carregarMeusServicos(0, { periodo: filtroPeriodoMeus, tipo: v });
                      }}
                      className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 pr-7"
                    >
                      <option value="">🔧 Todos os tipos</option>
                      {servicosConfigCatalogo.map((c) => (
                        <option key={c.tipo} value={c.tipo}>{c.icone} {c.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                </div>

                {carregandoMeus ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Loader2 size={32} className="animate-spin mb-3" />
                    <span className="text-sm">Carregando seus serviços...</span>
                  </div>
                ) : meusServicos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                    <span className="text-6xl block mb-4">🔧</span>
                    <p className="text-sm font-medium mb-1">
                      {filtroTipoMeus || filtroPeriodoMeus !== 'all'
                        ? 'Nenhum serviço encontrado para os filtros selecionados.'
                        : 'Nenhum serviço registrado ainda.'}
                    </p>
                    {!filtroTipoMeus && filtroPeriodoMeus === 'all' && (
                      <button
                        onClick={() => setAbaAtiva('novoServico')}
                        className="mt-2 text-teal-600 dark:text-teal-400 text-sm font-medium hover:underline"
                      >
                        Registrar meu primeiro serviço →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {meusServicos.map((s) => (
                      <ServicoCard
                        key={s.id}
                        servico={s}
                        podeEditar={true}
                      />
                    ))}
                  </div>
                )}

                {/* Paginação */}
                {totalMeus > LIMITE && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button
                      onClick={() => carregarMeusServicos(Math.max(0, offsetMeus - LIMITE))}
                      disabled={offsetMeus === 0 || carregandoMeus}
                      className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                    >
                      ← Anterior
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {offsetMeus + 1}–{Math.min(offsetMeus + LIMITE, totalMeus)} de {totalMeus}
                    </span>
                    <button
                      onClick={() => carregarMeusServicos(offsetMeus + LIMITE)}
                      disabled={offsetMeus + LIMITE >= totalMeus || carregandoMeus}
                      className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                    >
                      Próxima →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ────── ABA: Estatísticas ────── */}
            {abaAtiva === 'estatisticas' && (
              <Suspense fallback={
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Loader2 size={32} className="animate-spin mb-3" />
                  <span className="text-sm">Carregando estatísticas...</span>
                </div>
              }>
                <ServicosEstatisticasTab equipeIdInicial={equipeId ?? ''} />
              </Suspense>
            )}

            {abaAtiva === 'gerenciamento' && (
              <Suspense fallback={
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Loader2 size={32} className="animate-spin mb-3" />
                  <span className="text-sm">Carregando gerenciamento...</span>
                </div>
              }>
                <div className="p-6 md:p-8">
                  <ServicosGerenciamentoTab somenteLeitura={!podeGerenciarCatalogoServicos} />
                </div>
              </Suspense>
            )}

            {/* ────── ABA: Serviços da Equipe ────── */}
            {abaAtiva === 'servicosEquipe' && (
              <div className="p-6 md:p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                      👥 Serviços da Equipe
                    </h2>
                    {!carregandoEquipe && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {totalEquipe} registro{totalEquipe !== 1 ? 's' : ''}
                        {filtroMembro ? ` de ${membros.find((m) => m.id === filtroMembro)?.nome ?? ''}` : ' na equipe'}
                        {' '}no período
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => carregarServicosEquipe(0)}
                    disabled={carregandoEquipe}
                    title="Atualizar lista"
                    className="p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
                  >
                    <RefreshCw size={15} className={carregandoEquipe ? 'animate-spin' : ''} />
                  </button>
                </div>

                {/* ── Filtros ── */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {/* Filtro de período */}
                  <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1">
                    {(['24h', '48h', '72h', '7d', '30d', 'all'] as FiltroPeriodo[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setFiltroPeriodoEquipe(p);
                          setOffsetEquipe(0);
                          carregarServicosEquipe(0, { periodo: p, tipo: filtroTipoEquipe, membroId: filtroMembro });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          filtroPeriodoEquipe === p
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {p === 'all' ? 'Tudo' : p}
                      </button>
                    ))}
                  </div>
                  {/* Filtro de tipo */}
                  <div className="relative">
                    <select
                      value={filtroTipoEquipe}
                      onChange={(e) => {
                        const v = e.target.value as TipoServico | '';
                        setFiltroTipoEquipe(v);
                        setOffsetEquipe(0);
                        carregarServicosEquipe(0, { periodo: filtroPeriodoEquipe, tipo: v, membroId: filtroMembro });
                      }}
                      className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 pr-7"
                    >
                      <option value="">🔧 Todos os tipos</option>
                      {servicosConfigCatalogo.map((c) => (
                        <option key={c.tipo} value={c.tipo}>{c.icone} {c.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                  {/* Filtro de membro */}
                  <div className="relative">
                    <select
                      value={filtroMembro}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFiltroMembro(v);
                        setOffsetEquipe(0);
                        carregarServicosEquipe(0, { periodo: filtroPeriodoEquipe, tipo: filtroTipoEquipe, membroId: v });
                      }}
                      className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 pr-7 min-w-[150px]"
                    >
                      <option value="">👥 Todos os membros</option>
                      {membros.map((m) => (
                        <option key={m.id} value={m.id}>👤 {m.nome}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                </div>

                {carregandoEquipe ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Loader2 size={32} className="animate-spin mb-3" />
                    <span className="text-sm">Carregando serviços da equipe...</span>
                  </div>
                ) : servicosEquipe.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                    <span className="text-6xl block mb-4">👥</span>
                    <p className="text-sm font-medium">
                      {filtroMembro || filtroTipoEquipe || filtroPeriodoEquipe !== 'all'
                        ? 'Nenhum serviço encontrado para os filtros selecionados.'
                        : 'Nenhum serviço registrado pela equipe ainda.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {servicosEquipe.map((s) => (
                      <ServicoCard
                        key={s.id}
                        servico={s}
                        mostrarDono={!filtroMembro}
                        podeEditar={isAdmin || s.usuario_id === user?.id}
                      />
                    ))}
                  </div>
                )}

                {/* Paginação equipe */}
                {totalEquipe > LIMITE && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button
                      onClick={() => carregarServicosEquipe(Math.max(0, offsetEquipe - LIMITE))}
                      disabled={offsetEquipe === 0 || carregandoEquipe}
                      className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                    >
                      ← Anterior
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {offsetEquipe + 1}–{Math.min(offsetEquipe + LIMITE, totalEquipe)} de {totalEquipe}
                    </span>
                    <button
                      onClick={() => carregarServicosEquipe(offsetEquipe + LIMITE)}
                      disabled={offsetEquipe + LIMITE >= totalEquipe || carregandoEquipe}
                      className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                    >
                      Próxima →
                    </button>
                  </div>
                )}
              </div>
            )}

          </main>
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 border-t dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-2.5 text-center text-xs text-gray-400 dark:text-gray-500">
          💡 Serviços são registrados por membro e ficam visíveis para toda a equipe
        </div>
      </motion.div>

      {/* ── Modal: Salvar Descrição (novo serviço) ── */}
      <AnimatePresence>
        {modalDescricaoAberto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setModalDescricaoAberto(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/30 dark:to-cyan-900/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-100 dark:bg-teal-900/40 rounded-lg">
                    <span className="text-lg">📝</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Salvar Descrição</h2>
                    {configAtual && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{configAtual.icone} {configAtual.label}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setModalDescricaoAberto(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Editor */}
              <div className="flex-1 p-6 overflow-y-auto">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Cole ou digite a descrição. Você pode colar imagens diretamente da área de transferência.
                </p>
                <div className="min-h-[320px]">
                  <RichTextEditor
                    value={descricao}
                    onChange={setDescricao}
                    placeholder="Digite a descrição aqui..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                <button
                  onClick={() => setModalDescricaoAberto(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setModalDescricaoAberto(false)}
                  className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors font-medium"
                >
                  ✅ Confirmar Descrição
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal: Editar Descrição (modo edição do card) ── */}
      <AnimatePresence>
        {edicaoDescricaoModalAberto && edicao && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setEdicaoDescricaoModalAberto(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/30 dark:to-cyan-900/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-100 dark:bg-teal-900/40 rounded-lg">
                    <span className="text-lg">📝</span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Editar Descrição</h2>
                </div>
                <button
                  onClick={() => setEdicaoDescricaoModalAberto(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="min-h-[320px]">
                  <RichTextEditor
                    value={edicao.descricao}
                    onChange={(val) => setEdicao({ ...edicao, descricao: val })}
                    placeholder="Digite a descrição aqui..."
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                <button
                  onClick={() => setEdicaoDescricaoModalAberto(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setEdicaoDescricaoModalAberto(false)}
                  className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors font-medium"
                >
                  ✅ Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal: Visualizar Descrição (conteúdo completo) ── */}
      <AnimatePresence>
        {viewDescricaoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setViewDescricaoModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {viewDescricaoModal.titulo}
                </h2>
                <button
                  onClick={() => setViewDescricaoModal(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto">
                <div
                  className="prose dark:prose-invert max-w-none dark:[&_*]:!text-gray-200"
                  dangerouslySetInnerHTML={{ __html: viewDescricaoModal.html }}
                />
              </div>
              <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                <button
                  onClick={() => setViewDescricaoModal(null)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
};

export default OutrosServicosModal;

/**
 * servicosService.ts
 *
 * Service layer para o sistema de Outros Serviços.
 * Cobre: Email, Homologação, Ouvidoria, CPA, Chamado SMAX e Criação de Script.
 *
 * Todas as operações de escrita passam pelas RPCs do Supabase (SECURITY DEFINER).
 * Operações de leitura do próprio usuário usam o client com RLS.
 */

import { supabase } from './supabaseClient';
import type { TipoTarefa } from '../types/Tarefa';

// ──────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────

export type TipoServico =
  | 'email'
  | 'homologacao'
  | 'reuniao_interna'
  | 'reuniao_externa'
  | 'ouvidoria'
  | 'cpa'
  | 'chamado_smax'
  | 'encerrar_ticket_gerenciador'
  | 'criacao_script'
  | 'agendamento_visitas'
  | 'visitas_virtuais'
  | 'visitas_presenciais'
  | 'atendimento_teams'
  | 'atendimento_balcao'
  | 'dev_aplicacao'
  | 'resp_chamado_complexo'
  | 'analise_rejeites'
  | 'analise_chamados_antigos'
  | 'criacao_apresentacao'
  | 'elaboracao_relatorio'
  | 'configuracao_sistema'
  | 'lotacao_usuarios'
  | 'cadastro_radar'
  | 'cadastro_melhoria'
  | 'estudos_atualizacao'
  | 'atendimento_chamados'
  | 'monitoramento_qualidade'
  | 'producao_documento'
  | 'nape_ciclos_implantacao'
  | 'nape_levantamento_gestores'
  | 'nape_divulgacao_institucional'
  | 'nape_reunioes_orientadoras'
  | 'nape_pos_implantacao'
  | 'atendimento_pr_chat_portal'
  | 'respostas_padronizadas'
  | 'nape_suporte_operacional'
  | 'nape_monitoramento_utilizacao'
  | 'nape_unidades_sem_uso'
  | 'nape_baixa_adesao'
  | 'monitoramento_erros_operacionais'
  | 'acompanhamento_painel_watcher'
  | 'revisao_scripts_atendimento'
  | 'duvidas_recorrentes'
  | 'oportunidades_automacao'
  | 'melhorias_fluxos_operacionais'
  | 'divergencias_entre_sistemas'
  | 'contato_areas_tecnicas'
  | 'padronizacao_orientacoes'
  | 'validacao_procedimentos'
  | 'diagnostico_otimizacao_python'
  | 'modelagem_regras_negocio';

/** @deprecated Sub-tipos removidos. Usar tipos standalone: dev_aplicacao, resp_chamado_complexo, criacao_apresentacao */
export const DESENVOLVIMENTO_SUBTIPOS: { value: string; label: string }[] = [];

export type UnidadeMedida = 'unidades' | 'horas';

export type PeriodoEstatistica = '24h' | '48h' | '72h' | '7d' | '30d' | 'all';

/** Período de filtro nas abas Meus Serviços / Serviços da Equipe */
export type FiltroPeriodo = '24h' | '48h' | '72h' | '7d' | '30d' | 'all';

/** Converte FiltroPeriodo em data ISO (mínima) para filtro .gte('criado_em'). Retorna null para 'all'. */
export function filtroPeriodoParaData(periodo: FiltroPeriodo): string | null {
  if (periodo === 'all') return null;
  const now = new Date();
  const offsetHoras: Record<Exclude<FiltroPeriodo, 'all'>, number> = {
    '24h': 24,
    '48h': 48,
    '72h': 72,
    '7d': 24 * 7,
    '30d': 24 * 30,
  };
  now.setHours(now.getHours() - offsetHoras[periodo]);
  return now.toISOString();
}

export interface Servico {
  id: string;
  tipo: TipoServico;
  quantidade: number;
  usuario_id: string;
  usuario_nome: string;
  equipe_id: string;
  observacao: string | null;
  descricao: string | null;
  data_execucao: string;
  criado_em: string;
  atualizado_em: string;
}

export interface ServicoConfig {
  tipo: TipoServico;
  label: string;
  unidade: UnidadeMedida;
  icone: string;
  /** Dica exibida abaixo do input de quantidade */
  dica: string;
}

/** Dado de estatística retornado pela RPC obter_servicos_estatisticas */
export interface ServicoEstatisticaItem {
  usuario_nome: string;
  usuario_id: string;
  tipo: TipoServico;
  periodo: string;
  total_quantidade: number;
}

/** Dados consolidados por membro (todos os tipos somados) para o gráfico de evolução */
export interface ServicoMembroData {
  memberName: string;
  memberId: string;
  /** Série temporal: período → soma total de todas as quantidades */
  data: { period: string; value: number }[];
  totalValue: number;
}

/** Detalhe por tipo de serviço de um membro específico */
export interface ServicoDetalheMembroItem {
  tipo: TipoServico;
  label: string;
  unidade: UnidadeMedida;
  icone: string;
  totalQuantidade: number;
}

// ──────────────────────────────────────────────────────────────
// Configuração dos tipos de serviço
// ──────────────────────────────────────────────────────────────

export const SERVICOS_CONFIG: ServicoConfig[] = [
  {
    tipo: 'email',
    label: 'Criação e Resposta a E-mails',
    unidade: 'unidades',
    icone: '📧',
    dica: 'Informe o total de e-mails respondidos ou enviados.',
  },
  {
    tipo: 'homologacao',
    label: 'Homologação',
    unidade: 'horas',
    icone: '✅',
    dica: 'Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro (ex: 1h20min → 2).',
  },
  {
    tipo: 'reuniao_interna',
    label: 'Acompanhamento de Reunião Interna',
    unidade: 'horas',
    icone: '👥',
    dica: 'Horas dedicadas a reuniões internas. Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.',
  },
  {
    tipo: 'reuniao_externa',
    label: 'Acompanhamento de Reunião Externa',
    unidade: 'horas',
    icone: '🤝',
    dica: 'Horas dedicadas a reuniões externas. Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.',
  },
  {
    tipo: 'ouvidoria',
    label: 'Ouvidoria',
    unidade: 'horas',
    icone: '📢',
    dica: 'Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro (ex: 2h05min → 3).',
  },
  {
    tipo: 'cpa',
    label: 'CPA',
    unidade: 'horas',
    icone: '📋',
    dica: 'Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro (ex: 0h45min → 1).',
  },
  {
    tipo: 'chamado_smax',
    label: 'Chamado direto no SMAX',
    unidade: 'unidades',
    icone: '🎫',
    dica: 'Informe o total de chamados respondidos diretamente no SMAX.',
  },
  {
    tipo: 'encerrar_ticket_gerenciador',
    label: 'Encerrar ticket no Gerenciador',
    unidade: 'unidades',
    icone: '🗃️',
    dica: 'Informe o total de tickets encerrados no Gerenciador.',
  },
  {
    tipo: 'criacao_script',
    label: 'Criação de Script',
    unidade: 'unidades',
    icone: '🧩',
    dica: 'Informe o total de scripts criados ou finalizados.',
  },
  {
    tipo: 'atendimento_teams',
    label: 'Atendimento via Teams',
    unidade: 'unidades',
    icone: '💬',
    dica: 'Informe o total de atendimentos realizados via Teams.',
  },
  {
    tipo: 'atendimento_balcao',
    label: 'Atendimento via Balcão Virtual',
    unidade: 'unidades',
    icone: '🏪',
    dica: 'Informe o total de atendimentos realizados via Balcão Virtual.',
  },
  {
    tipo: 'dev_aplicacao',
    label: 'Desenvolvimento de Aplicação/Sistema',
    unidade: 'horas',
    icone: '🖥️',
    dica: 'Horas trabalhadas em desenvolvimento de aplicação. Se menos de 1 hora, registre 1.',
  },
  {
    tipo: 'resp_chamado_complexo',
    label: 'Resposta a Chamado Complexo',
    unidade: 'horas',
    icone: '🔧',
    dica: 'Horas trabalhadas em chamado complexo. Se menos de 1 hora, registre 1.',
  },
  {
    tipo: 'analise_rejeites',
    label: 'Resolução de rejeites',
    unidade: 'unidades',
    icone: '🧾',
    dica: 'Informe o total de rejeites resolvidos.',
  },
  {
    tipo: 'analise_chamados_antigos',
    label: 'Resolução de chamados antigos',
    unidade: 'unidades',
    icone: '🗂️',
    dica: 'Informe o total de chamados antigos resolvidos.',
  },
  {
    tipo: 'criacao_apresentacao',
    label: 'Produção de Apresentação (PPT)',
    unidade: 'horas',
    icone: '📊',
    dica: 'Horas trabalhadas na criação de apresentação. Se menos de 1 hora, registre 1.',
  },
  {
    tipo: 'elaboracao_relatorio',
    label: 'Produção de Relatório',
    unidade: 'horas',
    icone: '📄',
    dica: 'Horas dedicadas à elaboração de relatório. Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.',
  },
  {
    tipo: 'agendamento_visitas',
    label: 'Agendamento de Visitas',
    unidade: 'horas',
    icone: '📅',
    dica: 'Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.',
  },
  {
    tipo: 'visitas_virtuais',
    label: 'Visitas Virtuais',
    unidade: 'horas',
    icone: '🖥️',
    dica: 'Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.',
  },
  {
    tipo: 'visitas_presenciais',
    label: 'Visitas Presenciais',
    unidade: 'horas',
    icone: '🏢',
    dica: 'Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.',
  },
  {
    tipo: 'configuracao_sistema',
    label: 'Configuração do Sistema',
    unidade: 'unidades',
    icone: '⚙️',
    dica: 'Informe o total de configurações de sistema realizadas.',
  },
  {
    tipo: 'lotacao_usuarios',
    label: 'Lotação de Usuários',
    unidade: 'unidades',
    icone: '👥',
    dica: 'Informe o total de lotações de usuários realizadas.',
  },
  {
    tipo: 'cadastro_radar',
    label: 'Cadastro na Radar',
    unidade: 'unidades',
    icone: '📡',
    dica: 'Informe o total de cadastros realizados na Radar.',
  },
  {
    tipo: 'cadastro_melhoria',
    label: 'Cadastro de Melhoria',
    unidade: 'unidades',
    icone: '💡',
    dica: 'Informe o total de cadastros de melhoria realizados.',
  },
  {
    tipo: 'estudos_atualizacao',
    label: 'Estudos/Atualização',
    unidade: 'horas',
    icone: '📚',
    dica: 'Horas dedicadas a estudos ou atualização profissional. Se menos de 1 hora, registre 1. Arredonde sempre para o próximo número inteiro.',
  },
  {
    tipo: 'atendimento_chamados',
    label: 'Atendimento de chamados',
    unidade: 'unidades',
    icone: '📞',
    dica: 'Informe o total de chamados atendidos.',
  },
  {
    tipo: 'monitoramento_qualidade',
    label: 'Monitoramento e controle de qualidade',
    unidade: 'horas',
    icone: '🔍',
    dica: 'Horas dedicadas ao monitoramento e controle de qualidade. Se menos de 1 hora, registre 1.',
  },
  {
    tipo: 'producao_documento',
    label: 'Produção de documento',
    unidade: 'horas',
    icone: '📝',
    dica: 'Horas dedicadas à produção de documentos. Se menos de 1 hora, registre 1.',
  },
  {
    tipo: 'nape_ciclos_implantacao',
    label: 'Planejamento e execução dos ciclos de implantação do NAPE',
    unidade: 'horas',
    icone: '🔄',
    dica: 'Horas dedicadas ao planejamento e execução dos ciclos de implantação do NAPE. Se menos de 1 hora, registre 1.',
  },
  {
    tipo: 'nape_levantamento_gestores',
    label: 'Levantamento e validação de gestores e unidades participantes',
    unidade: 'unidades',
    icone: '✔️',
    dica: 'Informe a quantidade de gestores ou unidades levantados/validados.',
  },
  {
    tipo: 'nape_divulgacao_institucional',
    label: 'Divulgação institucional (banner, e-mails e convites)',
    unidade: 'unidades',
    icone: '📣',
    dica: 'Informe o total de ações de divulgação realizadas (banners, e-mails, convites).',
  },
  {
    tipo: 'nape_reunioes_orientadoras',
    label: 'Organização e apoio às reuniões orientadoras',
    unidade: 'horas',
    icone: '🗓️',
    dica: 'Horas dedicadas à organização e apoio às reuniões orientadoras. Se menos de 1 hora, registre 1.',
  },
  {
    tipo: 'nape_pos_implantacao',
    label: 'Acompanhamento pós-implantação das unidades',
    unidade: 'horas',
    icone: '🏥',
    dica: 'Horas dedicadas ao acompanhamento pós-implantação. Se menos de 1 hora, registre 1.',
  },
  {
    tipo: 'atendimento_pr_chat_portal',
    label: 'Atendimento de dúvidas pelo P&R, chat e portal de chamados',
    unidade: 'unidades',
    icone: '💭',
    dica: 'Informe o total de atendimentos de dúvidas via P&R, chat ou portal.',
  },
  {
    tipo: 'respostas_padronizadas',
    label: 'Elaboração e revisão de respostas padronizadas',
    unidade: 'unidades',
    icone: '📋',
    dica: 'Informe o total de respostas padronizadas elaboradas ou revisadas.',
  },
  {
    tipo: 'nape_suporte_operacional',
    label: 'Suporte operacional às unidades usuárias do NAPE',
    unidade: 'horas',
    icone: '🛟',
    dica: 'Horas de suporte operacional às unidades. Se menos de 1 hora, registre 1.',
  },
  {
    tipo: 'nape_monitoramento_utilizacao',
    label: 'Monitoramento diário da utilização do NAPE',
    unidade: 'unidades',
    icone: '📈',
    dica: 'Informe a quantidade de dias ou ciclos de monitoramento registrados.',
  },
  {
    tipo: 'nape_unidades_sem_uso',
    label: 'Identificação de unidades sem utilização do sistema',
    unidade: 'unidades',
    icone: '⚠️',
    dica: 'Informe o total de unidades identificadas sem utilização.',
  },
  {
    tipo: 'nape_baixa_adesao',
    label: 'Busca ativa de unidades com baixa adesão',
    unidade: 'unidades',
    icone: '🎯',
    dica: 'Informe o total de unidades contatadas ou mapeadas por baixa adesão.',
  },
  {
    tipo: 'monitoramento_erros_operacionais',
    label: 'Monitoramento de erros e inconsistências operacionais',
    unidade: 'unidades',
    icone: '🐛',
    dica: 'Informe o total de erros ou inconsistências monitorados/tratados.',
  },
  {
    tipo: 'acompanhamento_painel_watcher',
    label: 'Acompanhamento de informações do painel Watcher',
    unidade: 'horas',
    icone: '👁️',
    dica: 'Horas dedicadas ao acompanhamento do painel Watcher. Se menos de 1 hora, registre 1.',
  },
  {
    tipo: 'revisao_scripts_atendimento',
    label: 'Revisão e criação de scripts de atendimento',
    unidade: 'unidades',
    icone: '📜',
    dica: 'Informe o total de scripts de atendimento criados ou revisados.',
  },
  {
    tipo: 'duvidas_recorrentes',
    label: 'Levantamento e tratamento de dúvidas recorrentes',
    unidade: 'unidades',
    icone: '❓',
    dica: 'Informe o total de dúvidas recorrentes levantadas ou tratadas.',
  },
  {
    tipo: 'oportunidades_automacao',
    label: 'Identificação de oportunidades de automação',
    unidade: 'unidades',
    icone: '🤖',
    dica: 'Informe o total de oportunidades de automação identificadas.',
  },
  {
    tipo: 'melhorias_fluxos_operacionais',
    label: 'Proposição de melhorias nos fluxos operacionais',
    unidade: 'unidades',
    icone: '🔀',
    dica: 'Informe o total de melhorias propostas nos fluxos operacionais.',
  },
  {
    tipo: 'divergencias_entre_sistemas',
    label: 'Identificação e análise de divergências entre sistemas',
    unidade: 'unidades',
    icone: '⚖️',
    dica: 'Informe o total de divergências identificadas ou analisadas.',
  },
  {
    tipo: 'contato_areas_tecnicas',
    label: 'Contato com áreas técnicas para esclarecimentos',
    unidade: 'unidades',
    icone: '🔌',
    dica: 'Informe o total de contatos realizados com áreas técnicas.',
  },
  {
    tipo: 'padronizacao_orientacoes',
    label: 'Padronização de orientações fornecidas às unidades',
    unidade: 'unidades',
    icone: '📐',
    dica: 'Informe o total de orientações padronizadas ou revisadas.',
  },
  {
    tipo: 'validacao_procedimentos',
    label: 'Validação de procedimentos operacionais',
    unidade: 'horas',
    icone: '✅',
    dica: 'Horas dedicadas à validação de procedimentos operacionais. Se menos de 1 hora, registre 1.',
  },
  {
    tipo: 'diagnostico_otimizacao_python',
    label: 'Diagnóstico e Otimização de Código-Fonte Python',
    unidade: 'horas',
    icone: '🐍',
    dica: 'Horas dedicadas a diagnóstico e otimização de código Python. Se menos de 1 hora, registre 1.',
  },
  {
    tipo: 'modelagem_regras_negocio',
    label: 'Modelagem e Parametrização de Regras de Negócio',
    unidade: 'horas',
    icone: '🧠',
    dica: 'Horas dedicadas à modelagem e parametrização de regras de negócio. Se menos de 1 hora, registre 1.',
  },
];

export const TAREFA_SERVICO_EQUIVALENTE: Record<TipoTarefa, TipoServico> = {
  ouvidoria: 'ouvidoria',
  cpa: 'cpa',
  email: 'email',
  aplicacao: 'dev_aplicacao',
  chamado_complexo: 'resp_chamado_complexo',
  homologacao: 'homologacao',
  reuniao_interna: 'reuniao_interna',
  reuniao_externa: 'reuniao_externa',
  rejeites: 'analise_rejeites',
  chamados_antigos: 'analise_chamados_antigos',
  chamado_smax: 'chamado_smax',
  encerrar_ticket_gerenciador: 'encerrar_ticket_gerenciador',
  criacao_script: 'criacao_script',
  agendamento_visitas: 'agendamento_visitas',
  visitas_virtuais: 'visitas_virtuais',
  visitas_presenciais: 'visitas_presenciais',
  atendimento_teams: 'atendimento_teams',
  atendimento_balcao: 'atendimento_balcao',
  dev_aplicacao: 'dev_aplicacao',
  resp_chamado_complexo: 'resp_chamado_complexo',
  analise_rejeites: 'analise_rejeites',
  analise_chamados_antigos: 'analise_chamados_antigos',
  criacao_apresentacao: 'criacao_apresentacao',
  elaboracao_relatorio: 'elaboracao_relatorio',
  configuracao_sistema: 'configuracao_sistema',
  lotacao_usuarios: 'lotacao_usuarios',
  cadastro_radar: 'cadastro_radar',
  cadastro_melhoria: 'cadastro_melhoria',
  estudos_atualizacao: 'estudos_atualizacao',
  atendimento_chamados: 'atendimento_chamados',
  monitoramento_qualidade: 'monitoramento_qualidade',
  producao_documento: 'producao_documento',
  nape_ciclos_implantacao: 'nape_ciclos_implantacao',
  nape_levantamento_gestores: 'nape_levantamento_gestores',
  nape_divulgacao_institucional: 'nape_divulgacao_institucional',
  nape_reunioes_orientadoras: 'nape_reunioes_orientadoras',
  nape_pos_implantacao: 'nape_pos_implantacao',
  atendimento_pr_chat_portal: 'atendimento_pr_chat_portal',
  respostas_padronizadas: 'respostas_padronizadas',
  nape_suporte_operacional: 'nape_suporte_operacional',
  nape_monitoramento_utilizacao: 'nape_monitoramento_utilizacao',
  nape_unidades_sem_uso: 'nape_unidades_sem_uso',
  nape_baixa_adesao: 'nape_baixa_adesao',
  monitoramento_erros_operacionais: 'monitoramento_erros_operacionais',
  acompanhamento_painel_watcher: 'acompanhamento_painel_watcher',
  revisao_scripts_atendimento: 'revisao_scripts_atendimento',
  duvidas_recorrentes: 'duvidas_recorrentes',
  oportunidades_automacao: 'oportunidades_automacao',
  melhorias_fluxos_operacionais: 'melhorias_fluxos_operacionais',
  divergencias_entre_sistemas: 'divergencias_entre_sistemas',
  contato_areas_tecnicas: 'contato_areas_tecnicas',
  padronizacao_orientacoes: 'padronizacao_orientacoes',
  validacao_procedimentos: 'validacao_procedimentos',
  diagnostico_otimizacao_python: 'diagnostico_otimizacao_python',
  modelagem_regras_negocio: 'modelagem_regras_negocio',
};

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/** Retorna a configuração completa de um tipo de serviço. */
export function getServicoConfig(tipo: TipoServico): ServicoConfig {
  const config = SERVICOS_CONFIG.find((c) => c.tipo === tipo);
  if (!config) {
    throw new Error(`Tipo de serviço desconhecido: ${tipo}`);
  }
  return config;
}

/** Retorna o tipo de serviço equivalente a um tipo de tarefa. */
export function getTipoServicoParaTarefa(tipo: TipoTarefa | null | undefined): TipoServico | null {
  return tipo ? TAREFA_SERVICO_EQUIVALENTE[tipo] : null;
}

/** Retorna a unidade de medida de um tipo de serviço. */
export function getUnidadeLabel(tipo: TipoServico): UnidadeMedida {
  return getServicoConfig(tipo).unidade;
}

/** Retorna o label legível de um tipo de serviço. */
export function getServicoLabel(tipo: TipoServico): string {
  return getServicoConfig(tipo).label;
}

/** Retorna o ícone de um tipo de serviço. */
export function getServicoIcone(tipo: TipoServico): string {
  return getServicoConfig(tipo).icone;
}

/**
 * Formata quantidade + unidade para exibição.
 * Ex: "3 horas", "5 unidades"
 */
export function formatarQuantidade(tipo: TipoServico, quantidade: number): string {
  const unidade = getUnidadeLabel(tipo);
  if (unidade === 'horas') {
    return `${quantidade} ${quantidade === 1 ? 'hora' : 'horas'}`;
  }
  return `${quantidade} ${quantidade === 1 ? 'unidade' : 'unidades'}`;
}

// ──────────────────────────────────────────────────────────────
// CRUD via RPCs
// ──────────────────────────────────────────────────────────────

/**
 * Registra um novo serviço via RPC criar_servico.
 */
export async function criarServico(
  tipo: TipoServico,
  quantidade: number,
  usuarioId: string,
  equipeId: string,
  observacao?: string,
  dataExecucao?: string,
  descricao?: string
): Promise<{ sucesso: boolean; servico_id?: string; erro?: string }> {
  const { data, error } = await supabase.rpc('criar_servico', {
    p_tipo: tipo,
    p_quantidade: quantidade,
    p_usuario_id: usuarioId,
    p_equipe_id: equipeId,
    p_observacao: observacao ?? null,
    p_data_execucao: dataExecucao ?? null,
    p_descricao: descricao ?? null,
  });

  if (error) {
    console.error('[servicosService] criarServico error:', error);
    return { sucesso: false, erro: error.message };
  }

  return data as { sucesso: boolean; servico_id?: string; erro?: string };
}

/**
 * Atualiza tipo, quantidade e/ou observação de um serviço existente.
 * Passa apenas os campos que devem ser alterados.
 */
export async function atualizarServico(
  servicoId: string,
  campos: {
    tipo?: TipoServico;
    quantidade?: number;
    observacao?: string | null;
    dataExecucao?: string;
    descricao?: string | null;
  }
): Promise<{ sucesso: boolean; alteracoes?: Record<string, boolean>; erro?: string }> {
  const { data, error } = await supabase.rpc('atualizar_servico', {
    p_servico_id: servicoId,
    p_tipo: campos.tipo ?? null,
    p_quantidade: campos.quantidade ?? null,
    p_observacao: campos.observacao !== undefined ? campos.observacao : null,
    p_data_execucao: campos.dataExecucao ?? null,
    p_descricao: campos.descricao !== undefined ? campos.descricao : null,
  });

  if (error) {
    console.error('[servicosService] atualizarServico error:', error);
    return { sucesso: false, erro: error.message };
  }

  return data as { sucesso: boolean; alteracoes?: Record<string, boolean>; erro?: string };
}

/**
 * Exclui um serviço. Apenas o dono ou admin podem excluir.
 */
export async function excluirServico(
  servicoId: string
): Promise<{ sucesso: boolean; erro?: string }> {
  const { data, error } = await supabase.rpc('excluir_servico', {
    p_servico_id: servicoId,
  });

  if (error) {
    console.error('[servicosService] excluirServico error:', error);
    return { sucesso: false, erro: error.message };
  }

  return data as { sucesso: boolean; erro?: string };
}

// ──────────────────────────────────────────────────────────────
// Listagem
// ──────────────────────────────────────────────────────────────

/**
 * Lista os serviços de um usuário em ordem cronológica decrescente.
 */
export async function listarServicosUsuario(
  usuarioId: string,
  limite = 50,
  offset = 0
): Promise<{ sucesso: boolean; servicos: Servico[]; total: number; erro?: string }> {
  const { data, error } = await supabase.rpc('listar_servicos_usuario', {
    p_usuario_id: usuarioId,
    p_limite: limite,
    p_offset: offset,
  });

  if (error) {
    console.error('[servicosService] listarServicosUsuario error:', error);
    return { sucesso: false, servicos: [], total: 0, erro: error.message };
  }

  const resultado = data as { sucesso: boolean; servicos: Servico[]; total: number; erro?: string };
  return {
    sucesso: resultado.sucesso,
    servicos: resultado.servicos ?? [],
    total: resultado.total ?? 0,
    erro: resultado.erro,
  };
}

/**
 * Lista os serviços de toda a equipe em ordem cronológica decrescente.
 */
export async function listarServicosEquipe(
  equipeId: string,
  limite = 50,
  offset = 0
): Promise<{ sucesso: boolean; servicos: Servico[]; total: number; erro?: string }> {
  const { data, error } = await supabase.rpc('listar_servicos_equipe', {
    p_equipe_id: equipeId,
    p_limite: limite,
    p_offset: offset,
  });

  if (error) {
    console.error('[servicosService] listarServicosEquipe error:', error);
    return { sucesso: false, servicos: [], total: 0, erro: error.message };
  }

  const resultado = data as { sucesso: boolean; servicos: Servico[]; total: number; erro?: string };
  return {
    sucesso: resultado.sucesso,
    servicos: resultado.servicos ?? [],
    total: resultado.total ?? 0,
    erro: resultado.erro,
  };
}

// ──────────────────────────────────────────────────────────────
// Listagem filtrada (period + tipo + membro) — query direta com RLS
// ──────────────────────────────────────────────────────────────

/**
 * Lista os serviços de um usuário com filtros de período e tipo.
 * Usa query direta (com RLS) para suportar filtros server-side.
 */
export async function listarServicosUsuarioFiltrado(
  usuarioId: string,
  opts: {
    periodo?: FiltroPeriodo;
    tipo?: TipoServico | '';
    limite?: number;
    offset?: number;
  } = {}
): Promise<{ sucesso: boolean; servicos: Servico[]; total: number; erro?: string }> {
  const { periodo = '24h', tipo = '', limite = 30, offset = 0 } = opts;

  let query = supabase
    .from('servicos')
    .select('id, tipo, quantidade, usuario_id, usuario_nome, equipe_id, observacao, descricao, data_execucao, criado_em, atualizado_em', { count: 'exact' })
    .eq('usuario_id', usuarioId)
    .order('data_execucao', { ascending: false })
    .range(offset, offset + limite - 1);

  const dataMinima = filtroPeriodoParaData(periodo);
  if (dataMinima) query = query.gte('data_execucao', dataMinima);
  if (tipo) query = query.eq('tipo', tipo);

  const { data, count, error } = await query;

  if (error) {
    console.error('[servicosService] listarServicosUsuarioFiltrado error:', error);
    return { sucesso: false, servicos: [], total: 0, erro: error.message };
  }

  return { sucesso: true, servicos: (data ?? []) as Servico[], total: count ?? 0 };
}

/**
 * Lista os serviços da equipe com filtros de período, tipo e membro.
 * Usa query direta (com RLS) para suportar filtros server-side.
 */
export async function listarServicosEquipeFiltrado(
  equipeId: string,
  opts: {
    periodo?: FiltroPeriodo;
    tipo?: TipoServico | '';
    membroId?: string;
    limite?: number;
    offset?: number;
  } = {}
): Promise<{ sucesso: boolean; servicos: Servico[]; total: number; erro?: string }> {
  const { periodo = '24h', tipo = '', membroId = '', limite = 30, offset = 0 } = opts;

  let query = supabase
    .from('servicos')
    .select('id, tipo, quantidade, usuario_id, usuario_nome, equipe_id, observacao, descricao, data_execucao, criado_em, atualizado_em', { count: 'exact' })
    .eq('equipe_id', equipeId)
    .order('data_execucao', { ascending: false })
    .range(offset, offset + limite - 1);

  const dataMinima = filtroPeriodoParaData(periodo);
  if (dataMinima) query = query.gte('data_execucao', dataMinima);
  if (tipo) query = query.eq('tipo', tipo);
  if (membroId) query = query.eq('usuario_id', membroId);

  const { data, count, error } = await query;

  if (error) {
    console.error('[servicosService] listarServicosEquipeFiltrado error:', error);
    return { sucesso: false, servicos: [], total: 0, erro: error.message };
  }

  return { sucesso: true, servicos: (data ?? []) as Servico[], total: count ?? 0 };
}

// ──────────────────────────────────────────────────────────────
// Estatísticas
// ──────────────────────────────────────────────────────────────

/**
 * Retorna dados brutos agrupados por membro/tipo/período para o gráfico.
 */
export async function obterEstatisticasServicos(
  equipeId: string,
  periodo: PeriodoEstatistica = '30d'
): Promise<{ sucesso: boolean; dados: ServicoEstatisticaItem[]; periodo: string; erro?: string }> {
  const { data, error } = await supabase.rpc('obter_servicos_estatisticas', {
    p_equipe_id: equipeId,
    p_periodo: periodo,
  });

  if (error) {
    console.error('[servicosService] obterEstatisticasServicos error:', error);
    return { sucesso: false, dados: [], periodo, erro: error.message };
  }

  const resultado = data as {
    sucesso: boolean;
    dados: ServicoEstatisticaItem[];
    periodo: string;
    erro?: string;
  };

  return {
    sucesso: resultado.sucesso,
    dados: resultado.dados ?? [],
    periodo: resultado.periodo ?? periodo,
    erro: resultado.erro,
  };
}

/**
 * Converte os dados brutos em formato consolidado por membro
 * (somando todos os tipos) para uso no AllMembersComparisonChart.
 *
 * Cada membro terá uma única linha no gráfico, com o total de
 * todas as quantidades somadas por período.
 */
export function consolidarServicosPorMembro(
  dados: ServicoEstatisticaItem[]
): ServicoMembroData[] {
  // Agrupar por (usuario_nome + usuario_id) → mapa de períodos
  const membrosMap = new Map<
    string,
    { nome: string; id: string; periodos: Map<string, number> }
  >();

  for (const item of dados) {
    const key = item.usuario_id;
    if (!membrosMap.has(key)) {
      membrosMap.set(key, { nome: item.usuario_nome, id: item.usuario_id, periodos: new Map() });
    }
    const membro = membrosMap.get(key)!;
    const atual = membro.periodos.get(item.periodo) ?? 0;
    membro.periodos.set(item.periodo, atual + item.total_quantidade);
  }

  const resultado: ServicoMembroData[] = [];

  for (const [, membro] of membrosMap) {
    const serie = Array.from(membro.periodos.entries()).map(([period, value]) => ({
      period,
      value,
    }));

    const total = serie.reduce((acc, s) => acc + s.value, 0);

    resultado.push({
      memberName: membro.nome,
      memberId: membro.id,
      data: serie,
      totalValue: total,
    });
  }

  // Ordenar por total decrescente
  resultado.sort((a, b) => b.totalValue - a.totalValue);

  return resultado;
}

/**
 * Retorna o detalhe por tipo de serviço de um membro específico,
 * agregando todos os períodos.
 */
export function detalharServicosMembro(
  dados: ServicoEstatisticaItem[],
  usuarioId: string
): ServicoDetalheMembroItem[] {
  const membroDados = dados.filter((d) => d.usuario_id === usuarioId);
  const porTipo = new Map<TipoServico, number>();

  for (const item of membroDados) {
    const atual = porTipo.get(item.tipo) ?? 0;
    porTipo.set(item.tipo, atual + item.total_quantidade);
  }

  const resultado: ServicoDetalheMembroItem[] = [];

  for (const config of SERVICOS_CONFIG) {
    const total = porTipo.get(config.tipo) ?? 0;
    if (total > 0) {
      resultado.push({
        tipo: config.tipo,
        label: config.label,
        unidade: config.unidade,
        icone: config.icone,
        totalQuantidade: total,
      });
    }
  }

  // Ordenar por total decrescente
  resultado.sort((a, b) => b.totalQuantidade - a.totalQuantidade);

  return resultado;
}

// ──────────────────────────────────────────────────────────────
// Estatísticas Completas (nova RPC)
// ──────────────────────────────────────────────────────────────

export interface EstatisticasCompletasKpis {
  total_registros: number;
  total_horas: number;
  total_unidades: number;
  primeiro_registro: string | null;
  ultimo_registro: string | null;
  membros_distintos: number;
}

export interface EstatisticasCompletasTipo {
  tipo: TipoServico;
  total_qtd: number;
  total_regs: number;
}

export interface EstatisticasCompletasMembro {
  usuario_id: string;
  usuario_nome: string;
  total_qtd: number;
  total_regs: number;
  tipos_distintos: number;
}

export interface EstatisticasCompletasDiaSemana {
  dia_semana: number;
  dia_label: string;
  total_qtd: number;
  total_regs: number;
}

export interface EstatisticasCompletasFaixaHoraria {
  dia_semana: number;
  faixa: number;
  faixa_label: string;
  total_qtd: number;
}

export interface EstatisticasCompletasSerieItem {
  periodo: string;
  tipo: TipoServico;
  usuario_id: string;
  usuario_nome: string;
  total_quantidade: number;
}

export interface EstatisticasCompletasVolumeDiario {
  data: string;
  total_qtd: number;
  total_regs: number;
}

export interface EstatisticasCompletasResult {
  sucesso: boolean;
  periodo: string;
  kpis: EstatisticasCompletasKpis;
  por_tipo: EstatisticasCompletasTipo[];
  por_membro: EstatisticasCompletasMembro[];
  por_dia_semana: EstatisticasCompletasDiaSemana[];
  por_faixa_horaria: EstatisticasCompletasFaixaHoraria[];
  serie_temporal: EstatisticasCompletasSerieItem[];
  volume_diario: EstatisticasCompletasVolumeDiario[];
  erro?: string;
}

const EMPTY_KPIS: EstatisticasCompletasKpis = {
  total_registros: 0,
  total_horas: 0,
  total_unidades: 0,
  primeiro_registro: null,
  ultimo_registro: null,
  membros_distintos: 0,
};

/**
 * Retorna estatísticas completas de serviços numa única chamada.
 * Inclui KPIs, por tipo, por membro, dia da semana, faixa horária, série temporal e volume diário.
 */
export async function obterEstatisticasCompletas(
  equipeId: string,
  periodo: PeriodoEstatistica = '30d'
): Promise<EstatisticasCompletasResult> {
  const { data, error } = await supabase.rpc('obter_servicos_estatisticas_completas', {
    p_equipe_id: equipeId,
    p_periodo: periodo,
  });

  if (error) {
    console.error('[servicosService] obterEstatisticasCompletas error:', error);
    return {
      sucesso: false,
      periodo,
      kpis: EMPTY_KPIS,
      por_tipo: [],
      por_membro: [],
      por_dia_semana: [],
      por_faixa_horaria: [],
      serie_temporal: [],
      volume_diario: [],
      erro: error.message,
    };
  }

  const res = data as EstatisticasCompletasResult;
  return {
    sucesso: res.sucesso,
    periodo: res.periodo ?? periodo,
    kpis: res.kpis ?? EMPTY_KPIS,
    por_tipo: res.por_tipo ?? [],
    por_membro: res.por_membro ?? [],
    por_dia_semana: res.por_dia_semana ?? [],
    por_faixa_horaria: res.por_faixa_horaria ?? [],
    serie_temporal: res.serie_temporal ?? [],
    volume_diario: res.volume_diario ?? [],
    erro: res.erro,
  };
}

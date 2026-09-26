/**
 * Tipos para o Sistema de Acompanhamento de Tarefas
 * 
 * Define interfaces para:
 * - Tarefas e suas fases
 * - Threads de discussão
 * - Histórico de alterações
 * - Notificações
 */

// ============================================================================
// Estados e Tipos Base
// ============================================================================

/**
 * Estados possíveis de uma tarefa
 */
export type EstadoTarefa = 'em_andamento' | 'pausada' | 'concluida' | 'cancelada';

/**
 * Tipos de tarefa (classificação por área/natureza)
 */
export type TipoTarefa =
  | 'acompanhamento_painel_watcher'
  | 'reuniao_externa'
  | 'reuniao_interna'
  | 'nape_pos_implantacao'
  | 'agendamento_visitas'
  | 'aplicacao'
  | 'atendimento_chamados'
  | 'atendimento_pr_chat_portal'
  | 'atendimento_balcao'
  | 'atendimento_teams'
  | 'nape_baixa_adesao'
  | 'cadastro_melhoria'
  | 'cadastro_radar'
  | 'chamado_smax'
  | 'configuracao_sistema'
  | 'contato_areas_tecnicas'
  | 'cpa'
  | 'criacao_script'
  | 'email'
  | 'dev_aplicacao'
  | 'diagnostico_otimizacao_python'
  | 'nape_divulgacao_institucional'
  | 'respostas_padronizadas'
  | 'encerrar_ticket_gerenciador'
  | 'estudos_atualizacao'
  | 'homologacao'
  | 'oportunidades_automacao'
  | 'nape_unidades_sem_uso'
  | 'divergencias_entre_sistemas'
  | 'duvidas_recorrentes'
  | 'nape_levantamento_gestores'
  | 'lotacao_usuarios'
  | 'modelagem_regras_negocio'
  | 'monitoramento_erros_operacionais'
  | 'nape_monitoramento_utilizacao'
  | 'monitoramento_qualidade'
  | 'nape_reunioes_orientadoras'
  | 'ouvidoria'
  | 'padronizacao_orientacoes'
  | 'nape_ciclos_implantacao'
  | 'criacao_apresentacao'
  | 'producao_documento'
  | 'elaboracao_relatorio'
  | 'melhorias_fluxos_operacionais'
  | 'analise_chamados_antigos'
  | 'chamados_antigos'
  | 'analise_rejeites'
  | 'rejeites'
  | 'resp_chamado_complexo'
  | 'chamado_complexo'
  | 'revisao_scripts_atendimento'
  | 'nape_suporte_operacional'
  | 'validacao_procedimentos'
  | 'visitas_presenciais'
  | 'visitas_virtuais';

/**
 * Tipos de notificações do sistema de tarefas
 */
export type TipoNotificacaoTarefa = 
  | 'tarefa_criada'
  | 'tarefa_estado_alterado'
  | 'tarefa_responsavel_alterado'
  | 'tarefa_concluida'
  | 'fase_concluida'
  | 'thread_criada'
  | 'thread_resposta'
  | 'mencao'
  | 'documento_adicionado'
  | 'comentario_fase'
  | 'comentario_documento'
  | 'fase_usuario_vinculado'
  | 'prazo_se_esgotando';

// ============================================================================
// Tarefa Principal
// ============================================================================

/**
 * Tarefa do sistema de acompanhamento
 */
export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  dono_id: string;
  responsavel_tipo?: 'usuario' | 'equipe' | null;
  responsavel_usuario_id?: string | null;
  responsavel_equipe_id?: string | null;
  equipe_id: string | null;
  estado: EstadoTarefa;
  percentual_conclusao: number;
  resumo_conclusao: string | null;
  data_inicio: string | null;
  data_limite: string | null;
  posicao: number;
  tipo: TipoTarefa | null;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
}

/**
 * Tarefa com dados do dono e equipe (view expandida)
 */
export interface TarefaComDetalhes extends Tarefa {
  dono_nome: string;
  dono_email: string;
  responsavel_nome?: string | null;
  responsavel_email?: string | null;
  responsavel_chave_exibicao?: string | null;
  equipe_nome: string | null;
  total_fases: number;
  fases_concluidas: number;
  total_threads: number;
  participantes_discussao: number;
}

/**
 * Dados para criação de tarefa
 */
export interface CriarTarefaParams {
  titulo: string;
  descricao?: string;
  equipe_id?: string;
  tipo?: TipoTarefa;
  data_limite?: string;
  responsavel_tipo?: 'usuario' | 'equipe';
  responsavel_usuario_id?: string;
  responsavel_equipe_id?: string;
}

/**
 * Dados para atualização de tarefa
 */
export interface AtualizarTarefaParams {
  tarefa_id: string;
  titulo?: string;
  descricao?: string;
  tipo?: TipoTarefa | null;
  data_limite?: string | null;
  remover_prazo?: boolean;
}

/**
 * Dados para alteração de estado
 */
export interface AlterarEstadoParams {
  tarefa_id: string;
  novo_estado: EstadoTarefa;
  justificativa?: string;
  resumo?: string;
}

// ============================================================================
// Fases
// ============================================================================

/**
 * Fase de uma tarefa
 */
export interface TarefaFase {
  id: string;
  tarefa_id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  concluida: boolean;
  concluida_em: string | null;
  concluida_por: string | null;
  criado_em: string;
  usuario_vinculado_id: string | null;
  usuario_vinculado_nome?: string | null;
  usuario_vinculado_em: string | null;
}

/**
 * Dados para criar/editar fase
 */
export interface FaseParams {
  tarefa_id: string;
  titulo: string;
  descricao?: string;
}

export type TipoEventoHistorico =
  | 'criacao'
  | 'edicao_titulo'
  | 'edicao_descricao'
  | 'fase_criada'
  | 'fase_editada'
  | 'fase_removida'
  | 'fase_concluida'
  | 'fase_reaberta'
  | 'estado_em_andamento'
  | 'estado_pausada'
  | 'estado_concluida'
  | 'estado_cancelada'
  | 'estado_reativada'
  | 'mudanca_responsavel'
  | 'edicao_prazo';

// ============================================================================
// Histórico
// ============================================================================

/**
 * Registro de histórico de uma tarefa
 */
export interface TarefaHistorico {
  id: string;
  tarefa_id: string;
  usuario_id: string;
  tipo_evento: TipoEventoHistorico;
  dados: Record<string, any> | null;
  justificativa: string | null;
  resumo: string | null;
  criado_em: string;
}

/**
 * Histórico com dados do usuário
 */
export interface TarefaHistoricoComUsuario extends TarefaHistorico {
  usuario_nome: string;
  usuario_email: string;
}

// ============================================================================
// Threads de Discussão
// ============================================================================

/**
 * Thread (tópico) de discussão
 */
export interface TarefaThread {
  id: string;
  tarefa_id: string;
  autor_id: string;
  titulo: string;
  conteudo: string;
  total_respostas: number;
  criado_em: string;
  atualizado_em: string;
}

/**
 * Thread com dados do autor
 */
export interface TarefaThreadComAutor extends TarefaThread {
  autor_nome: string;
  autor_email: string;
}

/**
 * Resposta em uma thread
 */
export interface TarefaThreadResposta {
  id: string;
  thread_id: string;
  resposta_pai_id: string | null;
  autor_id: string;
  conteudo: string;
  nivel: number;
  criado_em: string;
  atualizado_em: string;
}

/**
 * Resposta com dados do autor e respostas aninhadas
 */
export interface TarefaThreadRespostaComAutor extends TarefaThreadResposta {
  autor_nome: string;
  autor_email: string;
  respostas?: TarefaThreadRespostaComAutor[];
}

/**
 * Dados para criar thread
 */
export interface CriarThreadParams {
  tarefa_id: string;
  titulo: string;
  conteudo: string;
  mencoes?: string[];
}

/**
 * Dados para criar resposta
 */
export interface CriarRespostaParams {
  thread_id: string;
  conteudo: string;
  resposta_pai_id?: string;
  mencoes?: string[];
}

// ============================================================================
// Notificações
// ============================================================================

/**
 * Notificação do sistema de tarefas
 */
export interface TarefaNotificacao {
  id: string;
  tarefa_id: string;
  thread_id: string | null;
  resposta_id: string | null;
  destinatario_id: string;
  remetente_id: string | null;
  tipo: TipoNotificacaoTarefa;
  dados: Record<string, any> | null;
  lida: boolean;
  lida_em: string | null;
  criado_em: string;
}

/**
 * Notificação com dados expandidos
 */
export interface TarefaNotificacaoComDetalhes extends TarefaNotificacao {
  remetente_nome: string | null;
  tarefa_titulo: string;
  thread_titulo?: string;
}

/**
 * Contagem de notificações
 * @deprecated Não está sendo utilizada. A RPC contar_notificacoes_tarefas retorna este formato,
 * mas o frontend usa query REST simples. Será removida na v2.0 se não houver uso.
 */
export interface TarefaNotificacaoCounts {
  total: number;
  por_tipo: Record<TipoNotificacaoTarefa, number>;
}

// ============================================================================
// Respostas de RPC
// ============================================================================

/**
 * Resposta genérica de RPC
 * @deprecated Não está sendo utilizada. Usar interfaces específicas como CriarTarefaResponse.
 * Será removida na v2.0 se não houver uso.
 */
export interface TarefaRPCResponse<T = any> {
  sucesso: boolean;
  erro?: string;
  mensagem?: string;
  data?: T;
}

/**
 * Resposta de criação de tarefa
 */
export interface CriarTarefaResponse {
  sucesso: boolean;
  tarefa_id?: string;
  erro?: string;
  mensagem?: string;
}

/**
 * Resposta de alteração de estado
 */
export interface AlterarEstadoResponse {
  sucesso: boolean;
  estado?: EstadoTarefa;
  erro?: string;
  mensagem?: string;
}

/**
 * Resposta de transferência
 */
export interface TransferirTarefaResponse {
  sucesso: boolean;
  novo_dono_id?: string;
  novo_dono_nome?: string;
  novo_responsavel_tipo?: 'usuario' | 'equipe';
  erro?: string;
  mensagem?: string;
}

export interface ResponsavelEquipeSimples {
  id: string;
  nome: string;
}

export interface ResponsavelUsuarioSimples {
  id: string;
  nome: string;
  email: string;
}

export interface ResponsavelTransferenciaUsuario {
  tipo: 'usuario';
  usuario_id: string;
}

export interface ResponsavelTransferenciaEquipe {
  tipo: 'equipe';
  equipe_id: string;
}

export type ResponsavelTransferenciaDestino =
  | ResponsavelTransferenciaUsuario
  | ResponsavelTransferenciaEquipe;

export function getResponsavelTipo(tarefa: Pick<TarefaComDetalhes, 'responsavel_tipo'>): 'usuario' | 'equipe' {
  return tarefa.responsavel_tipo === 'equipe' ? 'equipe' : 'usuario';
}

export function getResponsavelNome(
  tarefa: Pick<TarefaComDetalhes, 'responsavel_nome' | 'dono_nome'>
): string {
  return tarefa.responsavel_nome || tarefa.dono_nome || 'Desconhecido';
}

export function getResponsavelChaveExibicao(
  tarefa: Pick<TarefaComDetalhes, 'responsavel_chave_exibicao' | 'responsavel_tipo' | 'responsavel_usuario_id' | 'responsavel_equipe_id' | 'dono_id'>
): string {
  if (tarefa.responsavel_chave_exibicao) return tarefa.responsavel_chave_exibicao;
  if (tarefa.responsavel_tipo === 'equipe' && tarefa.responsavel_equipe_id) return `equipe:${tarefa.responsavel_equipe_id}`;
  if (tarefa.responsavel_usuario_id) return `usuario:${tarefa.responsavel_usuario_id}`;
  return `usuario:${tarefa.dono_id}`;
}

export function tarefaEhOperavelPorMembroEquipe(
  tarefa: Pick<TarefaComDetalhes, 'responsavel_tipo' | 'responsavel_equipe_id'>,
  equipeId?: string | null
): boolean {
  return tarefa.responsavel_tipo === 'equipe' && !!equipeId && tarefa.responsavel_equipe_id === equipeId;
}

// ============================================================================
// Filtros e Ordenação
// ============================================================================

/**
 * Filtros para listagem de tarefas
 */
export interface TarefasFiltros {
  estado?: EstadoTarefa | 'todos';
  dono_id?: string;
  equipe_id?: string;
  tipo?: TipoTarefa | 'todos';
}

/**
 * Opções de ordenação
 */
export type TarefasOrdenacao = 
  | 'percentual_conclusao'
  | 'atualizado_em'
  | 'titulo'
  | 'criado_em'
  | 'posicao';

/**
 * Direção da ordenação
 */
export type OrdenacaoDirecao = 'asc' | 'desc';

// ============================================================================
// Utilitários
// ============================================================================

/**
 * Mapa de labels para estados
 */
export const ESTADO_LABELS: Record<EstadoTarefa, string> = {
  em_andamento: 'Em Andamento',
  pausada: 'Pausada',
  concluida: 'Concluída',
  cancelada: 'Cancelada'
};

/**
 * Mapa de cores para estados
 */
export const ESTADO_CORES: Record<EstadoTarefa, string> = {
  em_andamento: 'bg-blue-100 text-blue-800',
  pausada: 'bg-yellow-100 text-yellow-800',
  concluida: 'bg-green-100 text-green-800',
  cancelada: 'bg-red-100 text-red-800'
};

/**
 * Mapa de labels para tipos de tarefa
 */
export const TIPO_TAREFA_LABELS: Record<TipoTarefa, string> = {
  acompanhamento_painel_watcher: 'Acompanhamento de informações do painel Watcher',
  reuniao_externa: 'Acompanhamento de Reunião Externa',
  reuniao_interna: 'Acompanhamento de Reunião Interna',
  nape_pos_implantacao: 'Acompanhamento pós-implantação das unidades',
  agendamento_visitas: 'Agendamento de Visitas',
  aplicacao: 'Aplicação',
  atendimento_chamados: 'Atendimento de chamados',
  atendimento_pr_chat_portal: 'Atendimento de dúvidas pelo P&R, chat e portal de chamados',
  atendimento_balcao: 'Atendimento via Balcão Virtual',
  atendimento_teams: 'Atendimento via Teams',
  nape_baixa_adesao: 'Busca ativa de unidades com baixa adesão',
  cadastro_melhoria: 'Cadastro de Melhoria',
  cadastro_radar: 'Cadastro na Radar',
  chamado_smax: 'Chamado direto no SMAX',
  configuracao_sistema: 'Configuração do Sistema',
  contato_areas_tecnicas: 'Contato com áreas técnicas para esclarecimentos',
  cpa: 'CPA',
  criacao_script: 'Criação de Script',
  email: 'Criação e Resposta a E-mails',
  dev_aplicacao: 'Desenvolvimento de Aplicação/Sistema',
  diagnostico_otimizacao_python: 'Diagnóstico e Otimização de Código-Fonte Python',
  nape_divulgacao_institucional: 'Divulgação institucional (banner, e-mails e convites)',
  respostas_padronizadas: 'Elaboração e revisão de respostas padronizadas',
  encerrar_ticket_gerenciador: 'Encerrar ticket no Gerenciador',
  estudos_atualizacao: 'Estudos/Atualização',
  homologacao: 'Homologação',
  oportunidades_automacao: 'Identificação de oportunidades de automação',
  nape_unidades_sem_uso: 'Identificação de unidades sem utilização do sistema',
  divergencias_entre_sistemas: 'Identificação e análise de divergências entre sistemas',
  duvidas_recorrentes: 'Levantamento e tratamento de dúvidas recorrentes',
  nape_levantamento_gestores: 'Levantamento e validação de gestores e unidades participantes',
  lotacao_usuarios: 'Lotação de Usuários',
  modelagem_regras_negocio: 'Modelagem e Parametrização de Regras de Negócio',
  monitoramento_erros_operacionais: 'Monitoramento de erros e inconsistências operacionais',
  nape_monitoramento_utilizacao: 'Monitoramento diário da utilização do NAPE',
  monitoramento_qualidade: 'Monitoramento e controle de qualidade',
  nape_reunioes_orientadoras: 'Organização e apoio às reuniões orientadoras',
  ouvidoria: 'Ouvidoria',
  padronizacao_orientacoes: 'Padronização de orientações fornecidas às unidades',
  nape_ciclos_implantacao: 'Planejamento e execução dos ciclos de implantação do NAPE',
  criacao_apresentacao: 'Produção de Apresentação (PPT)',
  producao_documento: 'Produção de documento',
  elaboracao_relatorio: 'Produção de Relatório',
  melhorias_fluxos_operacionais: 'Proposição de melhorias nos fluxos operacionais',
  analise_chamados_antigos: 'Resolução de chamados antigos',
  chamados_antigos: 'Resolução de chamados antigos',
  analise_rejeites: 'Resolução de rejeites',
  rejeites: 'Resolução de rejeites',
  resp_chamado_complexo: 'Resposta a Chamado Complexo',
  chamado_complexo: 'Resposta a Chamado Complexo',
  revisao_scripts_atendimento: 'Revisão e criação de scripts de atendimento',
  nape_suporte_operacional: 'Suporte operacional às unidades usuárias do NAPE',
  validacao_procedimentos: 'Validação de procedimentos operacionais',
  visitas_presenciais: 'Visitas Presenciais',
  visitas_virtuais: 'Visitas Virtuais',
};

export const TIPOS_TAREFA_LEGADOS_OCULTOS: TipoTarefa[] = [
  'chamado_complexo',
  'rejeites',
  'chamados_antigos',
];

const TIPOS_TAREFA_CANONICOS: Partial<Record<TipoTarefa, TipoTarefa>> = {
  chamado_complexo: 'resp_chamado_complexo',
  rejeites: 'analise_rejeites',
  chamados_antigos: 'analise_chamados_antigos',
};

export function normalizarTipoTarefa(tipo: TipoTarefa | null | undefined): TipoTarefa | null {
  if (!tipo) return null;
  return TIPOS_TAREFA_CANONICOS[tipo] ?? tipo;
}

export function obterTiposTarefaEquivalentes(tipo: TipoTarefa | null | undefined): TipoTarefa[] {
  const tipoNormalizado = normalizarTipoTarefa(tipo);
  if (!tipoNormalizado) return [];

  switch (tipoNormalizado) {
    case 'resp_chamado_complexo':
      return ['chamado_complexo', 'resp_chamado_complexo'];
    case 'analise_rejeites':
      return ['rejeites', 'analise_rejeites'];
    case 'analise_chamados_antigos':
      return ['chamados_antigos', 'analise_chamados_antigos'];
    default:
      return [tipoNormalizado];
  }
}

export const TIPOS_TAREFA_ATUAIS: TipoTarefa[] = [
  'ouvidoria',
  'cpa',
  'email',
  'aplicacao',
  'resp_chamado_complexo',
  'homologacao',
  'analise_rejeites',
  'analise_chamados_antigos'
];

export const TIPOS_TAREFA_OPCOES: TipoTarefa[] = (Object.keys(TIPO_TAREFA_LABELS) as TipoTarefa[])
  .filter((tipo) => !TIPOS_TAREFA_LEGADOS_OCULTOS.includes(tipo))
  .sort((a, b) => TIPO_TAREFA_LABELS[a].localeCompare(TIPO_TAREFA_LABELS[b], 'pt-BR'));

/**
 * Mapa de cores para tipos de tarefa
 */
export const TIPO_TAREFA_CORES: Record<TipoTarefa, string> = {
  acompanhamento_painel_watcher: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  reuniao_externa: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  reuniao_interna: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
  nape_pos_implantacao: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  agendamento_visitas: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  aplicacao: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  atendimento_chamados: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  atendimento_pr_chat_portal: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  atendimento_balcao: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300',
  atendimento_teams: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  nape_baixa_adesao: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  cadastro_melhoria: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  cadastro_radar: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  chamado_smax: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  configuracao_sistema: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  contato_areas_tecnicas: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  cpa: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  criacao_script: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  email: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  dev_aplicacao: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  diagnostico_otimizacao_python: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  nape_divulgacao_institucional: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  respostas_padronizadas: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  encerrar_ticket_gerenciador: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  estudos_atualizacao: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  homologacao: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  oportunidades_automacao: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  nape_unidades_sem_uso: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  divergencias_entre_sistemas: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  duvidas_recorrentes: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  nape_levantamento_gestores: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  lotacao_usuarios: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  modelagem_regras_negocio: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  monitoramento_erros_operacionais: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  nape_monitoramento_utilizacao: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  monitoramento_qualidade: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  nape_reunioes_orientadoras: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  ouvidoria: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  padronizacao_orientacoes: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  nape_ciclos_implantacao: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  criacao_apresentacao: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  producao_documento: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  elaboracao_relatorio: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200',
  melhorias_fluxos_operacionais: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  analise_chamados_antigos: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  chamados_antigos: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  analise_rejeites: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  rejeites: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  resp_chamado_complexo: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  chamado_complexo: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  revisao_scripts_atendimento: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  nape_suporte_operacional: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  validacao_procedimentos: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300',
  visitas_presenciais: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  visitas_virtuais: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

/**
 * Cor de fundo do card por tipo de tarefa
 */
export const TIPO_TAREFA_CARD_BG: Record<TipoTarefa, string> = {
  acompanhamento_painel_watcher: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  reuniao_externa: 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-l-emerald-500 dark:border-l-emerald-400',
  reuniao_interna: 'bg-slate-50 dark:bg-slate-900/20 border-l-4 border-l-slate-500 dark:border-l-slate-400',
  nape_pos_implantacao: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  agendamento_visitas: 'bg-teal-50 dark:bg-teal-900/20 border-l-4 border-l-teal-500 dark:border-l-teal-400',
  aplicacao: 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-l-purple-500 dark:border-l-purple-400',
  atendimento_chamados: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  atendimento_pr_chat_portal: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  atendimento_balcao: 'bg-lime-50 dark:bg-lime-900/20 border-l-4 border-l-lime-500 dark:border-l-lime-400',
  atendimento_teams: 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-500 dark:border-l-indigo-400',
  nape_baixa_adesao: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  cadastro_melhoria: 'bg-pink-50 dark:bg-pink-900/20 border-l-4 border-l-pink-500 dark:border-l-pink-400',
  cadastro_radar: 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-l-orange-500 dark:border-l-orange-400',
  chamado_smax: 'bg-sky-50 dark:bg-sky-900/20 border-l-4 border-l-sky-500 dark:border-l-sky-400',
  configuracao_sistema: 'bg-gray-50 dark:bg-gray-800 border-l-4 border-l-gray-500 dark:border-l-gray-400',
  contato_areas_tecnicas: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  cpa: 'bg-cyan-50 dark:bg-cyan-900/20 border-l-4 border-l-cyan-500 dark:border-l-cyan-400',
  criacao_script: 'bg-violet-50 dark:bg-violet-900/20 border-l-4 border-l-violet-500 dark:border-l-violet-400',
  email: 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500 dark:border-l-blue-400',
  dev_aplicacao: 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-l-purple-500 dark:border-l-purple-400',
  diagnostico_otimizacao_python: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  nape_divulgacao_institucional: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  respostas_padronizadas: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  encerrar_ticket_gerenciador: 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-500 dark:border-l-indigo-400',
  estudos_atualizacao: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  homologacao: 'bg-green-50 dark:bg-green-900/20 border-l-4 border-l-green-500 dark:border-l-green-400',
  oportunidades_automacao: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  nape_unidades_sem_uso: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  divergencias_entre_sistemas: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  duvidas_recorrentes: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  nape_levantamento_gestores: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  lotacao_usuarios: 'bg-cyan-50 dark:bg-cyan-900/20 border-l-4 border-l-cyan-500 dark:border-l-cyan-400',
  modelagem_regras_negocio: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  monitoramento_erros_operacionais: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  nape_monitoramento_utilizacao: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  monitoramento_qualidade: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  nape_reunioes_orientadoras: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  ouvidoria: 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-l-orange-500 dark:border-l-orange-400',
  padronizacao_orientacoes: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  nape_ciclos_implantacao: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  criacao_apresentacao: 'bg-fuchsia-50 dark:bg-fuchsia-900/20 border-l-4 border-l-fuchsia-500 dark:border-l-fuchsia-400',
  producao_documento: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  elaboracao_relatorio: 'bg-zinc-50 dark:bg-zinc-800/70 border-l-4 border-l-zinc-500 dark:border-l-zinc-400',
  melhorias_fluxos_operacionais: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  analise_chamados_antigos: 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-l-yellow-500 dark:border-l-yellow-400',
  chamados_antigos: 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-l-yellow-500 dark:border-l-yellow-400',
  analise_rejeites: 'bg-rose-50 dark:bg-rose-900/20 border-l-4 border-l-rose-500 dark:border-l-rose-400',
  rejeites: 'bg-rose-50 dark:bg-rose-900/20 border-l-4 border-l-rose-500 dark:border-l-rose-400',
  resp_chamado_complexo: 'bg-slate-50 dark:bg-slate-800/70 border-l-4 border-l-slate-500 dark:border-l-slate-400',
  chamado_complexo: 'bg-slate-50 dark:bg-slate-800/70 border-l-4 border-l-slate-500 dark:border-l-slate-400',
  revisao_scripts_atendimento: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  nape_suporte_operacional: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  validacao_procedimentos: 'bg-neutral-50 dark:bg-neutral-900/20 border-l-4 border-l-neutral-500 dark:border-l-neutral-400',
  visitas_presenciais: 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-l-emerald-500 dark:border-l-emerald-400',
  visitas_virtuais: 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500 dark:border-l-blue-400',
};

/**
 * Mapa de ícones para tipos de evento
 */
export const TIPO_EVENTO_LABELS: Record<TipoEventoHistorico, string> = {
  criacao: 'Tarefa criada',
  edicao_titulo: 'Título editado',
  edicao_descricao: 'Descrição editada',
  fase_criada: 'Fase adicionada',
  fase_editada: 'Fase editada',
  fase_removida: 'Fase removida',
  fase_concluida: 'Fase concluída',
  fase_reaberta: 'Fase reaberta',
  estado_em_andamento: 'Retomada',
  estado_pausada: 'Pausada',
  estado_concluida: 'Concluída',
  estado_cancelada: 'Cancelada',
  estado_reativada: 'Reativada',
  mudanca_responsavel: 'Responsável alterado',
  edicao_prazo: 'Prazo editado'
};

/**
 * Mapa de labels para tipos de notificação
 */
export const TIPO_NOTIFICACAO_LABELS: Record<TipoNotificacaoTarefa, string> = {
  tarefa_criada: 'Nova tarefa',
  tarefa_estado_alterado: 'Estado alterado',
  tarefa_responsavel_alterado: 'Você é o novo responsável',
  tarefa_concluida: 'Tarefa concluída',
  fase_concluida: 'Fase concluída',
  thread_criada: 'Novo tópico',
  thread_resposta: 'Nova resposta',
  mencao: 'Você foi mencionado',
  documento_adicionado: 'Novo documento adicionado',
  comentario_fase: 'Novo comentário na fase',
  comentario_documento: 'Novo comentário no documento',
  fase_usuario_vinculado: 'Você foi vinculado a uma fase',
  prazo_se_esgotando: 'Prazo se esgotando'
};

// ============================================================================
// Documentos
// ============================================================================

/**
 * Documento/link associado a uma tarefa
 */
export interface TarefaDocumento {
  id: string;
  tarefa_id?: string;
  titulo: string;
  url: string;
  criado_em: string;
  criado_por: string;
  criado_por_nome?: string;
}

/**
 * Dados para criar/editar documento
 */
export interface DocumentoParams {
  tarefa_id: string;
  titulo: string;
  url: string;
}

/**
 * Resposta de operação com documento
 */
export interface DocumentoResponse {
  sucesso: boolean;
  documento_id?: string;
  erro?: string;
}

// ============================================================================
// Comentários
// ============================================================================

/**
 * Comentário associado a uma fase ou documento
 */
export interface TarefaComentario {
  id: string;
  tarefa_id?: string;
  fase_id: string | null;
  documento_id: string | null;
  autor_id: string;
  autor_nome: string;
  conteudo: string;
  criado_em: string;
}

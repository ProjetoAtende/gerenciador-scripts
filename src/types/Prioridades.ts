/**
 * Tipos do app "Prioridades e Urgências" (TJSP Atende).
 *
 * Espelham a Especificação Técnica v1.0 (out/2026):
 *  - status: seção 5.2
 *  - perfis: seção 4
 *  - listas fechadas: RF-ATD-05 e RF-ATD-06
 *  - entidade Anotação: seção 8.1 + lacunas da 8.4
 */

/** Domínio de status conforme schema da proposta (seção 5.2). */
export type PrioridadeStatus =
  | 'gestor-conferencia'
  | 'gestor-aprovada'
  | 'gestor-devolvida'
  | 'gestor-rejeitada'
  | 'upj-pendente'
  | 'upj-reiterada'
  | 'upj-analisada'
  | 'upj-resolvida'
  | 'upj-devolvida'
  | 'upj-rejeitada';

/** Cinco tipos de usuário da proposta (slide 121). */
export type PrioridadePerfil =
  | 'atendente'
  | 'gestor'
  | 'conferente'
  | 'coordenador'
  | 'analista';

/** Módulos da solução (seção 3). */
export type PrioridadeModulo = 'atendente' | 'gestor' | 'upj';

export type PlataformaProcessual = 'eproc' | 'saj';
export type TipoSolicitante =
  | 'autor-exequente'
  | 'reu-executado'
  | 'perito-leiloeiro'
  | 'arrematante-alienante'
  | 'terceiro-interessado'
  | 'outros';

export type TipoPrioridade =
  | 'urgencia-determinada'
  | 'prazo-excedido'
  | 'fora-localizador'
  | 'erro-material'
  | 'medico-saude'
  | 'prioridade-doenca'
  | 'prioridade-pcd'
  | 'prioridade-idoso'
  | 'outros';

/**
 * Resultado da validação do processo na API do DJEN (Comunica PJe).
 *
 * ATENÇÃO — limitação estrutural registrada no parecer técnico: o DJEN é o
 * Diário de Justiça Eletrônico Nacional. Ele só conhece processos que tenham
 * comunicação publicada. Logo:
 *   - 'localizado'      → existe ao menos uma comunicação; dados confiáveis.
 *   - 'sem_comunicacao' → NÃO significa processo inexistente. A anotação segue,
 *                          mas sem UPJ autodetectada (exige escolha manual).
 *   - 'nao_consultado'  → a consulta não foi feita (offline, erro de rede).
 */
export type ValidacaoDjenStatus =
  | 'nao_consultado'
  | 'localizado'
  | 'sem_comunicacao'
  | 'erro';

/** Retorno normalizado de uma consulta ao DJEN. */
export interface DjenResultado {
  status: ValidacaoDjenStatus;
  processo: string;
  processoFormatado: string;
  vara: number | null;
  nomeOrgao: string | null;
  idOrgao: number | null;
  /**
   * Sempre `null`: o DJEN não informa em que sistema o processo tramita.
   * O campo passou a ser de preenchimento opcional pelo atendente na tela
   * "Nova Anotação". Mantido no tipo para deixar explícita a ausência.
   */
  plataforma: PlataformaProcessual | null;
  siglaTribunal: string | null;
  nomeClasse: string | null;
  totalComunicacoes: number;
  ultimaDisponibilizacao: string | null;
  /** Tipos de documento observados, do mais recente para o mais antigo. */
  tiposDocumento: string[];
  detalhe: string | null;
}

/** Registro retornado por prioridades_anteriores (RF-ATD-12). */
export interface AnotacaoAnterior {
  id: number;
  status: PrioridadeStatus;
  data_anotacao: string;
  descricao_prioridade: string;
  criador_nome: string;
  tipo_prioridade: string;
  upj_codigo: string | null;
}

export interface Upj {
  id: string;
  codigo: string;
  nome: string;
  foro: string | null;
  ativa: boolean;
}

/**
 * Designação em vigor (RF-GES-06 / RF-UPJ-05).
 *
 * `fim_em` nulo significa "Indeterminado" no wireframe. Uma designação em vigor
 * HABILITA o perfil correspondente além do perfil base — é assim que um
 * atendente designado Conferente passa a operar a fila de conferência.
 */
export interface DesignacaoAtiva {
  id: string;
  perfil: PrioridadePerfil;
  upj_id: string | null;
  inicio_em: string;
  fim_em: string | null;
}

export interface PerfilUsuarioPrioridades {
  usuario_id: string;
  perfil: PrioridadePerfil;
  upj_id: string | null;
  vinculacao_automatica: boolean;
  /** Preferência do Gestor nas listas Ag. Conferência e Retornadas. */
  ver_somente_vinculadas: boolean;
  designacoes_ativas: DesignacaoAtiva[];
}

/** Linha de resultado da busca de usuários para designação. */
export interface UsuarioElegivel {
  usuario_id: string;
  nome: string;
  email: string;
  perfil_atual: PrioridadePerfil | null;
  upj_atual: string | null;
  ja_designado: boolean;
}

/** Designação listada na tela Designações (inclui inativas/encerradas). */
export interface DesignacaoListada {
  id: string;
  usuario_id: string;
  designante_id: string | null;
  perfil: PrioridadePerfil;
  upj_id: string | null;
  inicio_em: string;
  fim_em: string | null;
  ativa: boolean;
  /** Preenchido em memória com o nome do designado. */
  usuario_nome: string | null;
  usuario_email: string | null;
}

/**
 * Perfil base do app, provido pelo admin (bootstrap).
 *
 * Diferente de designação: é permanente, define o módulo e não tem período.
 * Sem isso o sistema não fecha — a especificação diz que o Gestor designa
 * Conferentes, mas não diz como o primeiro Gestor passa a existir.
 */
export interface PerfilBase {
  usuario_id: string;
  perfil: PrioridadePerfil;
  upj_id: string | null;
  vinculacao_automatica: boolean;
  usuario_nome: string | null;
  usuario_email: string | null;
}

/** Perfis que o admin provisiona como perfil base. */
export const PERFIS_BASE: PrioridadePerfil[] = ['gestor', 'coordenador', 'atendente'];

export interface AnotacaoPrioridade {
  id: number;
  status: PrioridadeStatus;

  criador_id: string;
  criador_nome: string;
  criador_perfil: PrioridadePerfil;
  data_anotacao: string;

  processo: string;
  vara: number | null;
  upj_id: string | null;
  plataforma: PlataformaProcessual | null;
  validacao_djen_status: ValidacaoDjenStatus;
  validacao_djen_em: string | null;
  validacao_djen_detalhe: string | null;
  id_orgao_djen: number | null;
  nome_orgao_djen: string | null;

  tipo_solicitante: TipoSolicitante;
  descricao_solicitante: string | null;
  nome_solicitante: string | null;
  tipo_prioridade: TipoPrioridade;
  descricao_tipo_outros: string | null;
  evento_folha: string;
  descricao_prioridade: string;
  observacao_adicional_atende: string | null;

  data_remessa_gestor: string | null;
  conferente_vinculado_id: string | null;
  conferente_vinculado_nome: string | null;
  conferido_por_id: string | null;
  conferido_por_nome: string | null;
  justificativa_devolucao_gestor: string | null;
  justificativa_rejeicao_gestor: string | null;
  correcao_automatica: boolean;
  texto_correcao_automatica: string | null;
  observacao_adicional_gestor: string | null;
  /** Marcação manual do Gestor ou do Conferente. */
  urgentissimo: boolean;
  /** Marcação objetiva: 3 ou mais anotações do processo ainda em andamento. */
  urgentissimo_auto: boolean;
  /** Marca cumulativa: 2 ou mais anotações do processo ainda em andamento. */
  reiterada: boolean;

  data_remessa_upj: string | null;
  analista_vinculado_id: string | null;
  analista_vinculado_nome: string | null;
  analisado_por_id: string | null;
  analisado_por_nome: string | null;
  justificativa_devolucao_upj: string | null;
  justificativa_rejeicao_upj: string | null;
  observacao_adicional_upj: string | null;
  arquivamento_automatico: boolean;
  /** PD-07. Engatilhada quando a UPJ retorna a anotação. */
  rejeicao_automatica: boolean;

  devolvida_por: 'gestor' | 'upj' | null;
  data_devolucao: string | null;
  prazo_resposta_em: string | null;
  resposta_atendente: string | null;
  respondida_em: string | null;

  criado_em: string;
  atualizado_em: string;
}

export interface HistoricoAnotacao {
  id: number;
  anotacao_id: number;
  status_anterior: PrioridadeStatus | null;
  status_novo: PrioridadeStatus;
  evento: string;
  autor_id: string | null;
  autor_nome: string | null;
  autor_perfil: PrioridadePerfil | null;
  conteudo: string | null;
  criado_em: string;
}

/** Payload de criação da anotação (RF-ATD-11). */
export interface NovaAnotacaoPayload {
  processo: string;
  vara: number | null;
  upj_id: string | null;
  plataforma: PlataformaProcessual | null;
  validacao_djen_status: ValidacaoDjenStatus;
  validacao_djen_em: string | null;
  validacao_djen_detalhe: string | null;
  id_orgao_djen: number | null;
  nome_orgao_djen: string | null;
  tipo_solicitante: TipoSolicitante | '';
  descricao_solicitante: string;
  nome_solicitante: string;
  tipo_prioridade: TipoPrioridade | '';
  descricao_tipo_outros: string;
  evento_folha: string;
  descricao_prioridade: string;
  observacao_adicional_atende: string;
}

export interface RespostaRpc<T = unknown> {
  sucesso: boolean;
  erro?: string;
  campos_pendentes?: string[];
  status?: PrioridadeStatus;
  anotacao_id?: number;
  prazo_resposta_em?: string;
  data?: T;
}

// ──────────────────────────────────────────────────────────────
// Rótulos e agrupamentos de status
// ──────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<PrioridadeStatus, string> = {
  'gestor-conferencia': 'Ag. Conferência',
  'gestor-aprovada': 'Aprovada',
  'gestor-devolvida': 'Devolvida',
  'gestor-rejeitada': 'Reprovada',
  'upj-pendente': 'Nova',
  'upj-reiterada': 'Reiterada',
  'upj-analisada': 'Em Análise',
  'upj-resolvida': 'Resolvida',
  'upj-devolvida': 'Retornada',
  'upj-rejeitada': 'Rejeitada',
};

/**
 * Classes Tailwind por status. O documento pede realce de devoluções
 * (RF-ATD-13) e destaque de Urgentíssimo (RF-GES-04).
 */
export const STATUS_CLASSE: Record<PrioridadeStatus, string> = {
  'gestor-conferencia': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  'gestor-aprovada': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  'gestor-devolvida': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  'gestor-rejeitada': 'bg-stone-200 text-stone-700 dark:bg-stone-700/60 dark:text-stone-200',
  'upj-pendente': 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  'upj-reiterada': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  'upj-analisada': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
  'upj-resolvida': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  'upj-devolvida': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  'upj-rejeitada': 'bg-stone-200 text-stone-700 dark:bg-stone-700/60 dark:text-stone-200',
};

/** Devolução que volta ao Atendente. Retorno da UPJ fica com o Gestor. */
export const STATUS_DEVOLVIDA: PrioridadeStatus[] = ['gestor-devolvida'];

/** Status encerrados — não admitem mais transição operacional. */
export const STATUS_ENCERRADO: PrioridadeStatus[] = [
  'gestor-rejeitada',
  'upj-rejeitada',
  'upj-resolvida',
];

export const PERFIL_LABEL: Record<PrioridadePerfil, string> = {
  atendente: 'Atendente',
  gestor: 'Gestor',
  conferente: 'Conferente Designado',
  coordenador: 'Coordenador (UPJ)',
  analista: 'Analista Designado',
};

/** Módulo padrão de cada perfil (seção 4). */
export const MODULO_DO_PERFIL: Record<PrioridadePerfil, PrioridadeModulo> = {
  atendente: 'atendente',
  gestor: 'gestor',
  conferente: 'gestor',
  coordenador: 'upj',
  analista: 'upj',
};

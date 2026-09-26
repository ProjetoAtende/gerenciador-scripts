// src/types/Script.ts

// ===== Tipos de Categorização de Scripts (Fase 3) =====

/** Slugs das 12 categorias canônicas do sistema */
export type CategoriaSlug =
  | 'acesso'
  | 'cadastro'
  | 'processo'
  | 'custas'
  | 'documento'
  | 'protocolo'
  | 'intimacao'
  | 'pagamento'
  | 'integracao'
  | 'suporte'
  | 'expediente'
  | 'indefinido';

/** Informações visuais de uma categoria (nome, ícone, classes TailwindCSS) */
export interface CategoriaInfo {
  nome: string;
  icone: string;
  /** Prefixo de cor TailwindCSS (ex: 'purple', 'blue', 'amber') — para uso programático */
  cor: string;
  /** Classes CSS concretas para badge principal */
  badgeClasses: string;
  /** Classes CSS concretas para badge secundário (subcategoria / categoria adicional) */
  badgeSecClasses: string;
}

/** Mapa de categorias → informações visuais (reutilizado em Card, Filtros, Dashboard) */
export const CATEGORIAS_INFO: Record<CategoriaSlug, CategoriaInfo> = {
  acesso:      { nome: 'Acesso e Login',    icone: '🔐', cor: 'purple',  badgeClasses: 'bg-purple-100 text-purple-700 border-purple-200',   badgeSecClasses: 'bg-purple-50 text-purple-600 border-purple-100' },
  cadastro:    { nome: 'Cadastro',          icone: '📝', cor: 'blue',    badgeClasses: 'bg-blue-100 text-blue-700 border-blue-200',         badgeSecClasses: 'bg-blue-50 text-blue-600 border-blue-100' },
  processo:    { nome: 'Processos',         icone: '⚖️', cor: 'indigo',  badgeClasses: 'bg-indigo-100 text-indigo-700 border-indigo-200',   badgeSecClasses: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
  custas:      { nome: 'Custas e Taxas',    icone: '💰', cor: 'amber',   badgeClasses: 'bg-amber-100 text-amber-700 border-amber-200',     badgeSecClasses: 'bg-amber-50 text-amber-600 border-amber-100' },
  documento:   { nome: 'Documentos',        icone: '📄', cor: 'cyan',    badgeClasses: 'bg-cyan-100 text-cyan-700 border-cyan-200',         badgeSecClasses: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
  protocolo:   { nome: 'Protocolo',         icone: '📬', cor: 'teal',    badgeClasses: 'bg-teal-100 text-teal-700 border-teal-200',         badgeSecClasses: 'bg-teal-50 text-teal-600 border-teal-100' },
  intimacao:   { nome: 'Intimações',        icone: '📩', cor: 'rose',    badgeClasses: 'bg-rose-100 text-rose-700 border-rose-200',         badgeSecClasses: 'bg-rose-50 text-rose-600 border-rose-100' },
  pagamento:   { nome: 'Pagamentos',        icone: '💳', cor: 'emerald', badgeClasses: 'bg-emerald-100 text-emerald-700 border-emerald-200', badgeSecClasses: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  integracao:  { nome: 'Integrações',       icone: '🔗', cor: 'sky',     badgeClasses: 'bg-sky-100 text-sky-700 border-sky-200',             badgeSecClasses: 'bg-sky-50 text-sky-600 border-sky-100' },
  suporte:     { nome: 'Suporte Técnico',   icone: '🛠️', cor: 'orange',  badgeClasses: 'bg-orange-100 text-orange-700 border-orange-200',   badgeSecClasses: 'bg-orange-50 text-orange-600 border-orange-100' },
  expediente:  { nome: 'Expediente',        icone: '📑', cor: 'lime',    badgeClasses: 'bg-lime-100 text-lime-700 border-lime-200',         badgeSecClasses: 'bg-lime-50 text-lime-600 border-lime-100' },
  indefinido:  { nome: 'Não Classificado',  icone: '❓', cor: 'gray',    badgeClasses: 'bg-gray-100 text-gray-700 border-gray-200',         badgeSecClasses: 'bg-gray-50 text-gray-600 border-gray-100' },
};

/** Categoria adicional (secundária) de um script — tabela N:N */
export interface CategoriaAdicional {
  categoria_slug: CategoriaSlug;
  subcategoria_slug?: string | null;
  /** Slug hierárquico (v2) — categoria_equipe da classificação por domínio */
  categoria_equipe_slug?: string | null;
  /** Slug hierárquico (v2) — subcategoria_gse da classificação por domínio */
  subcategoria_gse_slug?: string | null;
  confianca?: number | null;
  origem?: 'ia' | 'ia_incremental' | 'manual';
}

// ===== Tipos de Pastas e Scripts =====

export interface ScriptFolder {
  id: string;
  nome: string;
  cor: string;
  icone: string;
  ordem?: number;
  equipe_id: string;
  criado_em: string;
  pasta_pai_id?: string | null;
}

// Pasta com suas subpastas organizadas hierarquicamente
export interface ScriptFolderWithChildren extends ScriptFolder {
  children: ScriptFolderWithChildren[];
}

export type ScriptInstancia = '1G' | '2G' | 'ColRec' | 'Externo (1G/2G)';

export const SCRIPT_INSTANCIA_OPTIONS: ScriptInstancia[] = [
  '1G',
  '2G',
  'ColRec',
  'Externo (1G/2G)',
];

export const SCRIPT_EQUIPE_IDS = {
  equipe221: '90c2ed6a-bf56-4081-b4d6-63f37855ec12',
  equipe222: '2299bffb-48ce-45eb-9e46-bcbc4d15c964',
  equipe231: '22222222-2222-2222-2222-222222222222',
  equipe232: '11111111-1111-1111-1111-111111111111',
} as const;

export function inferirInstanciaPorEquipe(equipeId?: string | null): ScriptInstancia | null {
  if (!equipeId) return null;
  if (equipeId === SCRIPT_EQUIPE_IDS.equipe221 || equipeId === SCRIPT_EQUIPE_IDS.equipe222) return '1G';
  if (equipeId === SCRIPT_EQUIPE_IDS.equipe231) return '2G';
  if (equipeId === SCRIPT_EQUIPE_IDS.equipe232) return 'Externo (1G/2G)';
  return null;
}

export interface ScriptItem {
  id: string;
  nome: string;
  conteudo_bruto?: string;               // Lazy loaded - não vem na listagem, carregado ao abrir editor
  ordem?: number;
  equipe_id: string;
  criado_em: string;
  pasta_id?: string | null;
  curadoria_atuada: boolean;
  pergunta?: string | null;
  numero_chamado?: string | null;
  email_enviado?: boolean;
  email_curadoria_enviado?: boolean;
  // Campos de autor e controle de modificações
  criado_por?: string | null;           // UUID do autor do script para o usuário final
  criado_por_atendente?: string | null; // UUID do autor do script para o atendente (independente de criado_por)
  equipe_autor_id?: string | null;      // UUID da equipe do autor
  conteudo_original?: string | null;    // Lazy loaded - conteúdo original antes da curadoria
  modificado_curadoria?: boolean;       // Se foi modificado pela curadoria
  data_curadoria?: string | null;       // Data da última curadoria
  curadoria_por?: string | null;        // UUID do usuário que realizou a curadoria
  // Campos de exclusão/desativação
  deletado?: boolean;                   // Se está desativado
  deletado_em?: string | null;          // Data de desativação
  deletado_por?: string | null;         // UUID de quem aprovou desativação
  desativado_em?: string | null;        // Data de desativação (alias)
  exclusao_pendente?: boolean;          // Se há solicitação de exclusão pendente
  exclusao_solicitada_em?: string | null; // Data da solicitação
  exclusao_solicitada_por?: string | null; // UUID de quem solicitou
  motivo_exclusao?: string | null;      // Motivo da solicitação de exclusão
  // Campos de scripts temporários (soluções de contorno para implantação e-Proc)
  temporario?: boolean;                  // Se é um script temporário
  // Perfil eProc do requisitante
  tipo_requisitante?: string | null;     // Perfil eProc (ex: MAGISTRADO, SERVIDOR UNIDADE JUDICIAL)
  // Conteúdo para o atendente (orientações internas de resolução)
  conteudo_atendente?: string | null;    // Lazy loaded - conteúdo HTML para o atendente
  tem_conteudo_atendente?: boolean;      // Vem na listagem (não é lazy loaded) - flag calculada por trigger
  tem_conteudo_usuario_final?: boolean;  // Vem na listagem - flag calculada por trigger (false quando conteudo_bruto é vazio)
  // Campos de categorização (Fase 1/3)
  categoria_slug?: CategoriaSlug | null;
  subcategoria_slug?: string | null;
  categoria_confianca?: number | null;
  subcategoria_confianca?: number | null;
  classificacao_origem?: 'ia' | 'ia_incremental' | 'manual' | null;
  classificacao_em?: string | null;
  classificacao_pendente?: boolean;
  classificacao_por?: string | null;
  categorias_adicionais?: CategoriaAdicional[];
  // Campos hierárquicos v2 (classificação por domínio)
  categoria_equipe_slug?: string | null;
  subcategoria_gse_slug?: string | null;
  dominio?: 'externo' | 'interno' | null;
  instancia?: ScriptInstancia | null;
  // Versionamento e propostas de revisão
  tem_proposta_pendente?: boolean;
  // Número de referência fixo (#N) — atribuído na criação, nunca muda
  numero_referencia?: number;
  // Campos N1 — atendimento de nível 1
  n1?: boolean | null;                   // null = não definido, true = N1, false = não N1
  validado_n1?: boolean;                  // Validado pela equipe 2.1 para uso em N1
  enviado_n1?: boolean;                   // Enviado para a equipe de atendimento N1
  validado_n1_por?: string | null;        // UUID de quem validou (lazy loaded)
  validado_n1_em?: string | null;         // Data/hora da validação (lazy loaded)
  enviado_n1_por?: string | null;         // UUID de quem enviou (lazy loaded)
  enviado_n1_em?: string | null;          // Data/hora do envio (lazy loaded)
}

export interface ScriptWithFolder extends ScriptItem {
  pasta?: ScriptFolder | null;
}
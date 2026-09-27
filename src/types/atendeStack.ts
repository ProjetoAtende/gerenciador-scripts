export type StackStatus = 'aberta' | 'fechada' | 'oculta';

export type StackEquipeModo = 'todas' | 'criadas' | 'com_resposta';

export type StackStatusFiltro = 'todas' | 'aberta' | 'fechada';

export type StackBuscaEscopo = 'perguntas' | 'respostas' | 'ambos';

export interface StackFiltros {
  minhas: {
    fiz: boolean;
    respondi: boolean;
    favoritas: boolean;
  };
  status: StackStatusFiltro;
  equipe: {
    ativo: boolean;
    modo: StackEquipeModo;
  };
  tag_ids: string[];
}

export const defaultStackFiltros = (): StackFiltros => ({
  minhas: { fiz: false, respondi: false, favoritas: false },
  status: 'todas',
  equipe: { ativo: false, modo: 'todas' },
  tag_ids: [],
});

export interface StackTag {
  id: string;
  slug: string;
  rotulo: string;
}

export interface StackAutorAnonimo {
  anonimo: true;
}

export interface StackAutorStaff {
  id: string;
  nome: string;
  email: string;
}

export type StackAutor = StackAutorAnonimo | StackAutorStaff;

export function isStackAutorStaff(a: StackAutor | null | undefined): a is StackAutorStaff {
  return !!a && 'id' in a;
}

export interface StackEditadoMeta {
  editado_em: string;
  por?: StackAutor | null;
}

export interface StackFeedItem {
  id: string;
  titulo: string;
  status: StackStatus;
  upvote_count: number;
  resposta_count: number;
  ultima_atividade_em: string;
  created_at: string;
  tem_solucao: boolean;
  favorito: boolean;
  usuario_votou: boolean;
  tags: StackTag[];
}

export interface StackResposta {
  id: string;
  corpo_html: string;
  upvote_count: number;
  created_at: string;
  aceita: boolean;
  autor: StackAutor | null;
  editado: StackEditadoMeta | null;
  usuario_votou: boolean;
  pode_editar: boolean;
}

export interface StackReabertura {
  id: string;
  motivo: string;
  created_at: string;
  staff: StackAutor | null;
}

export interface StackPerguntaDetalhe {
  id: string;
  titulo: string;
  corpo_html: string;
  status: StackStatus;
  upvote_count: number;
  resposta_count: number;
  ultima_atividade_em: string;
  created_at: string;
  resposta_aceita_id: string | null;
  autor: StackAutor | null;
  editado: StackEditadoMeta | null;
  tags: StackTag[];
  reabertura: StackReabertura | null;
  favorito: boolean;
  usuario_votou: boolean;
  pode_editar: boolean;
  pode_fechar: boolean;
  pode_reabrir: boolean;
  pode_responder: boolean;
  pode_marcar_aceita: boolean;
  pode_deletar: boolean;
  respostas: StackResposta[];
}

export interface StackBuscaItem {
  pergunta_id: string;
  resposta_id?: string | null;
  match_tipo: 'pergunta' | 'resposta';
  titulo: string;
  score: number;
  snippet_html: string;
  titulo_html?: string | null;
  /** Número de trechos (pergunta + respostas) que bateram na mesma pergunta */
  match_count: number;
}

export interface StackNotificacao {
  id: string;
  pergunta_id: string | null;
  tipo: string;
  contador: number;
  mensagem: string;
  lida_em: string | null;
  created_at: string;
  updated_at: string;
}

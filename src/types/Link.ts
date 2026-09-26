// src/types/Link.ts
export const LINK_TYPE_OPTIONS = ['Video', 'Documento', 'Website'] as const;

export type LinkType = typeof LINK_TYPE_OPTIONS[number];

export interface LinkFolder {
  id: string;
  nome: string;
  cor: string;
  icone: string;
  ordem?: number;
  equipe_id: string;
  criado_em: string;
}

export interface LinkItem {
  id: string;
  nome: string;
  url: string;
  criado_em: string;
  equipe_id: string;
  favicon_url?: string;
  site_title?: string;
  domain?: string;
  pasta_id?: string | null; // Nova coluna para sistema de pastas
  tipo?: LinkType | null;
}

export interface LinkWithFolder extends LinkItem {
  pasta?: LinkFolder | null;
}

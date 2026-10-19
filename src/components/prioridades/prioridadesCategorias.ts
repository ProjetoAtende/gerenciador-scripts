/** Categoria da anotação (direcionamento UPJ). */
export type CategoriaAnotacao =
  | 'mle'
  | 'sisbajud'
  | 'pesquisas'
  | 'cadastro'
  | 'expedicao'
  | 'movimentacao'
  | 'publicacao'
  | 'audiencias';

export interface CategoriaAnotacaoDef {
  codigo: CategoriaAnotacao;
  label: string;
  dica: string;
}

export const CATEGORIAS_ANOTACAO: CategoriaAnotacaoDef[] = [
  { codigo: 'mle', label: 'MLE', dica: 'Levantamentos e transferências de valores' },
  { codigo: 'sisbajud', label: 'Sisbajud', dica: 'Bloqueios e desbloqueios de valores' },
  {
    codigo: 'pesquisas',
    label: 'Pesquisas',
    dica: 'Infojud, Renajud, Serasajud, Petrus, Arisp/ONR etc.',
  },
  { codigo: 'cadastro', label: 'Cadastro', dica: 'Inclusão de partes, exclusão de advogados etc.' },
  { codigo: 'expedicao', label: 'Expedição', dica: 'Cartas, mandados, ofícios etc.' },
  { codigo: 'movimentacao', label: 'Movimentação', dica: 'Desarquivamento, redistribuição etc.' },
  { codigo: 'publicacao', label: 'Publicação', dica: 'Falhas, pendências etc.' },
  { codigo: 'audiencias', label: 'Audiências', dica: 'Links de sala virtual, cancelamentos etc.' },
];

export const CODIGOS_CATEGORIA: CategoriaAnotacao[] = CATEGORIAS_ANOTACAO.map((c) => c.codigo);

export function rotuloCategoria(codigo: CategoriaAnotacao | null | undefined): string {
  if (!codigo) return '—';
  return CATEGORIAS_ANOTACAO.find((c) => c.codigo === codigo)?.label ?? codigo;
}

export function categoriaValida(codigo: string): codigo is CategoriaAnotacao {
  return (CODIGOS_CATEGORIA as string[]).includes(codigo);
}

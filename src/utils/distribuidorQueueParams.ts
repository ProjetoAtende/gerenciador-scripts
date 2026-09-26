export interface QueueFetchParams {
  limit: number;
  offset: number;
  filtroCategoria?: string | null;
  filtroMantido?: string | null;
  filtroNumero?: string | null;
  filtroTempoHoras?: number | null;
  filtroTempoOperador?: 'maior' | 'menor';
  filtroSubcategoria?: string | null;
  filtroSos?: string | null;
  filtroGse?: string | null;
  filtroCategoriaEquipeId?: string | null;
  filtroSubcategoriaGseNome?: string | null;
  filtroSemCategoria?: boolean;
}

export const DISTRIBUIDOR_PAGE_SIZE = 50;

export interface DistribuidorServerFilterInput {
  filtroNumero: string;
  filtroMantido: string;
  filtroCategoria: string;
  filtroSubcategoria: string;
  filtroTempoHoras: string;
  filtroTempoOperador: 'maior' | 'menor';
  filtroTempoUnidade: 'horas' | 'dias';
  filtroSos: string;
  filtroGse: string;
  usaHierarquico: boolean;
}

export function buildDistribuidorServerQueueParams(
  input: DistribuidorServerFilterInput,
  limit: number,
  offset: number
): QueueFetchParams {
  let filtroTempoHoras: number | null = null;
  if (input.filtroTempoHoras !== '') {
    const valor = parseFloat(input.filtroTempoHoras);
    if (!Number.isNaN(valor)) {
      filtroTempoHoras =
        input.filtroTempoUnidade === 'dias' ? valor * 24 : valor;
    }
  }

  let filtroCategoria: string | null = null;
  let filtroCategoriaEquipeId: string | null = null;
  let filtroSubcategoriaGseNome: string | null = null;
  let filtroSemCategoria = false;

  if (input.filtroCategoria === 'sem_categoria') {
    filtroSemCategoria = true;
  } else if (input.usaHierarquico && input.filtroCategoria !== 'todos') {
    filtroCategoriaEquipeId = input.filtroCategoria;
  } else if (
    !input.usaHierarquico &&
    input.filtroCategoria !== 'todos'
  ) {
    filtroCategoria = input.filtroCategoria;
  }

  let filtroSubcategoria: string | null = null;
  if (!input.usaHierarquico && input.filtroSubcategoria !== 'todos') {
    filtroSubcategoria = input.filtroSubcategoria;
  } else if (input.usaHierarquico && input.filtroSubcategoria !== 'todos') {
    filtroSubcategoriaGseNome = input.filtroSubcategoria;
  }

  let filtroMantido: string | null = null;
  if (input.filtroMantido !== 'todos') {
    filtroMantido = input.filtroMantido;
  }

  let filtroSos: string | null = null;
  if (input.filtroSos !== 'todos') {
    filtroSos = input.filtroSos;
  }

  let filtroGse: string | null = null;
  if (input.filtroGse !== 'todos') {
    filtroGse = input.filtroGse;
  }

  return {
    limit,
    offset,
    filtroNumero: input.filtroNumero.trim() || null,
    filtroMantido,
    filtroCategoria,
    filtroSubcategoria,
    filtroTempoHoras,
    filtroTempoOperador: input.filtroTempoOperador,
    filtroSos,
    filtroGse,
    filtroCategoriaEquipeId,
    filtroSubcategoriaGseNome,
    filtroSemCategoria,
  };
}

export interface DistribuidorGlobalFilaFacet {
  id: string;
  numero: string;
  nome: string;
  count: number;
}

export interface DistribuidorFacetasFila {
  sem_categoria: number;
  categorias: Record<string, number>;
  subcategorias: Record<string, number>;
  gses: Record<string, number>;
  globais: DistribuidorGlobalFilaFacet[];
}

export function buildDistribuidorFacetParams(
  input: DistribuidorServerFilterInput,
  filtroCategoria: string,
  filtroSubcategoria: string
): {
  filtroCategoriaEquipeId: string | null;
  filtroCategoriaSlug: string | null;
  filtroSubcategoriaSlug: string | null;
  filtroSubcategoriaGseNome: string | null;
  filtroSemCategoria: boolean;
} {
  let filtroCategoriaEquipeId: string | null = null;
  let filtroCategoriaSlug: string | null = null;
  let filtroSubcategoriaSlug: string | null = null;
  let filtroSubcategoriaGseNome: string | null = null;
  let filtroSemCategoria = false;

  if (filtroCategoria === 'sem_categoria') {
    filtroSemCategoria = true;
  } else if (input.usaHierarquico && filtroCategoria !== 'todos') {
    filtroCategoriaEquipeId = filtroCategoria;
  } else if (!input.usaHierarquico && filtroCategoria !== 'todos') {
    filtroCategoriaSlug = filtroCategoria;
  }

  if (!input.usaHierarquico && filtroSubcategoria !== 'todos') {
    filtroSubcategoriaSlug = filtroSubcategoria;
  } else if (input.usaHierarquico && filtroSubcategoria !== 'todos') {
    filtroSubcategoriaGseNome = filtroSubcategoria;
  }

  return {
    filtroCategoriaEquipeId,
    filtroCategoriaSlug,
    filtroSubcategoriaSlug,
    filtroSubcategoriaGseNome,
    filtroSemCategoria,
  };
}

export function hasClientOnlyDistribuidorFilters(input: {
  filtroGlobal: string;
  filtroN3: string;
  filtrosAnalise: { gravidade: string; contexto: string; historico: string };
}): boolean {
  if (input.filtroGlobal !== 'todos') return true;
  if (input.filtroN3 !== 'todos') return true;
  if (input.filtrosAnalise.gravidade !== 'todos') return true;
  if (input.filtrosAnalise.contexto !== 'todos') return true;
  if (input.filtrosAnalise.historico !== 'todos') return true;
  return false;
}

export function isCategoriaFiltradaNoServidor(
  filtroCategoria: string,
  filtroSubcategoria: string
): boolean {
  return (
    filtroCategoria !== 'todos' ||
    filtroSubcategoria !== 'todos'
  );
}

/**
 * Hook para carregar informações visuais de categorias do banco,
 * mapeadas por slug para uso em badges do ScriptCard.
 * 
 * Carrega categorias de `categorias_equipe` por domínio,
 * retornando slug → { nome, icone, cor } com fallback genérico.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';

/** Informação visual de uma categoria carregada do banco */
export interface CategoriaInfoDB {
  slug: string;
  nome: string;
  icone: string;
  cor_hex: string;
}

/** Fallback para categorias desconhecidas */
const FALLBACK_INFO: CategoriaInfoDB = {
  slug: '',
  nome: 'Categoria',
  icone: '🏷️',
  cor_hex: '#9CA3AF', // gray-400
};

/** IDs das equipes por domínio */
const EQUIPE_IDS: Record<string, string[]> = {
  externo: ['11111111-1111-1111-1111-111111111111'],
  interno: ['22222222-2222-2222-2222-222222222222', '90c2ed6a-bf56-4081-b4d6-63f37855ec12'],
};

export const useCategoriaInfo = (dominio?: 'externo' | 'interno' | null) => {
  const [categorias, setCategorias] = useState<CategoriaInfoDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Selecionar equipes com base no domínio
      const equipeIds = dominio
        ? EQUIPE_IDS[dominio] || []
        : [...EQUIPE_IDS.externo, ...EQUIPE_IDS.interno];

      if (equipeIds.length === 0) {
        setCategorias([]);
        return;
      }

      const { data, error: dbError } = await supabase
        .from('categorias_equipe')
        .select('slug, nome, icone, cor_hex')
        .in('equipe_id', equipeIds)
        .order('nome');

      if (dbError) {
        console.error('[useCategoriaInfo] Erro:', dbError);
        setError(dbError.message);
        return;
      }

      // Deduplicar por slug (mesmo slug pode existir em múltiplas equipes)
      const seen = new Set<string>();
      const dedup: CategoriaInfoDB[] = [];
      for (const row of data || []) {
        if (!seen.has(row.slug)) {
          seen.add(row.slug);
          dedup.push(row);
        }
      }

      setCategorias(dedup);
    } catch (err) {
      console.error('[useCategoriaInfo] Exceção:', err);
      setError('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  }, [dominio]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Mapa slug → CategoriaInfoDB para lookup rápido */
  const mapaPorSlug = useMemo(() => {
    const m = new Map<string, CategoriaInfoDB>();
    for (const cat of categorias) {
      m.set(cat.slug, cat);
    }
    return m;
  }, [categorias]);

  /** Resolver info visual de um slug, com fallback genérico */
  const resolverSlug = useCallback((slug: string | null | undefined): CategoriaInfoDB | null => {
    if (!slug) return null;
    return mapaPorSlug.get(slug) || { ...FALLBACK_INFO, slug, nome: slug };
  }, [mapaPorSlug]);

  return {
    categorias,
    mapaPorSlug,
    resolverSlug,
    loading,
    error,
    recarregar: carregar,
  };
};

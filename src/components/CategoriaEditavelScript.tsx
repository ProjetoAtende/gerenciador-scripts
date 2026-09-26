// src/components/CategoriaEditavelScript.tsx
// Componente de edição inline de categoria/subcategoria para scripts (Fase 5 v2)
// Dois modos: compacto (ScriptCard) e expandido (ScriptEditorFullscreen)
// Usa sistema HIERÁRQUICO por domínio (externo/interno) — categorias do banco

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

/** IDs das equipes por domínio */
const EQUIPE_IDS: Record<string, string[]> = {
  externo: ['11111111-1111-1111-1111-111111111111'],
  interno: ['22222222-2222-2222-2222-222222222222', '90c2ed6a-bf56-4081-b4d6-63f37855ec12'],
};

interface CategoriaEditavelScriptProps {
  scriptId: string;
  categoriaEquipeSlug?: string | null;
  subcategoriaGseSlug?: string | null;
  dominio: 'externo' | 'interno';
  classificacaoOrigem?: 'ia' | 'ia_incremental' | 'manual' | null;
  classificacaoPendente?: boolean;
  onCategoriaAtualizada?: (dados: {
    categoria_equipe_slug: string | null;
    subcategoria_gse_slug: string | null;
    origem: 'manual';
  }) => void;
  compact?: boolean;
}

interface CategoriaOption {
  slug: string;
  nome: string;
  icone: string;
}

interface SubcategoriaOption {
  slug: string;
  nome: string;
}

export const CategoriaEditavelScript: React.FC<CategoriaEditavelScriptProps> = ({
  scriptId,
  categoriaEquipeSlug,
  subcategoriaGseSlug,
  dominio,
  classificacaoOrigem,
  classificacaoPendente,
  onCategoriaAtualizada,
  compact = true,
}) => {
  const { user } = useAuth();

  // Estado de edição (modo compacto)
  const [editing, setEditing] = useState(false);

  // Valores selecionados
  const [selectedCategoria, setSelectedCategoria] = useState<string>(categoriaEquipeSlug || '');
  const [selectedSubcategoria, setSelectedSubcategoria] = useState<string>(subcategoriaGseSlug || '');

  // Subcategorias carregadas dinamicamente
  const [subcategorias, setSubcategorias] = useState<SubcategoriaOption[]>([]);
  const [loadingSub, setLoadingSub] = useState(false);

  // Categorias disponíveis (carregadas por domínio)
  const [categorias, setCategorias] = useState<CategoriaOption[]>([]);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Ref para autoFocus no select
  const catSelectRef = useRef<HTMLSelectElement>(null);

  // Sync props → state quando props mudam
  useEffect(() => {
    setSelectedCategoria(categoriaEquipeSlug || '');
    setSelectedSubcategoria(subcategoriaGseSlug || '');
  }, [categoriaEquipeSlug, subcategoriaGseSlug]);

  // Carregar categorias do banco POR DOMÍNIO
  useEffect(() => {
    const fetchCategorias = async () => {
      const equipeIds = EQUIPE_IDS[dominio] || [];
      if (equipeIds.length === 0) {
        setCategorias([]);
        return;
      }

      const { data, error } = await supabase
        .from('categorias_equipe')
        .select('slug, nome, icone')
        .in('equipe_id', equipeIds)
        .eq('ativo', true)
        .order('nome');

      if (!error && data) {
        // Deduplicar por slug (union de equipes do domínio interno)
        const seen = new Set<string>();
        const dedup: CategoriaOption[] = [];
        for (const row of data) {
          if (!seen.has(row.slug)) {
            seen.add(row.slug);
            dedup.push({ slug: row.slug, nome: row.nome, icone: row.icone || '🏷️' });
          }
        }
        setCategorias(dedup.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      }
    };
    fetchCategorias();
  }, [dominio]);

  // Carregar subcategorias hierárquicas quando categoria muda
  const carregarSubcategorias = useCallback(async (catSlug: string) => {
    if (!catSlug) {
      setSubcategorias([]);
      return;
    }
    setLoadingSub(true);

    const equipeIds = EQUIPE_IDS[dominio] || [];

    // JOIN: subcategorias_gse → categorias_gse → categorias_equipe
    const { data, error } = await supabase
      .from('subcategorias_gse')
      .select(`
        slug, nome,
        categorias_gse!inner(
          categorias_equipe!inner(slug, equipe_id)
        )
      `)
      .eq('ativo', true)
      .eq('categorias_gse.categorias_equipe.slug', catSlug)
      .in('categorias_gse.categorias_equipe.equipe_id', equipeIds);

    if (!error && data) {
      // Deduplicar por slug
      const seen = new Set<string>();
      const dedup: SubcategoriaOption[] = [];
      for (const row of data) {
        if (!seen.has(row.slug)) {
          seen.add(row.slug);
          dedup.push({ slug: row.slug, nome: row.nome });
        }
      }
      setSubcategorias(dedup.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    } else {
      setSubcategorias([]);
    }
    setLoadingSub(false);
  }, [dominio]);

  // Carregar subcategorias ao mudar categoria
  useEffect(() => {
    if (selectedCategoria) {
      carregarSubcategorias(selectedCategoria);
    } else {
      setSubcategorias([]);
    }
  }, [selectedCategoria, carregarSubcategorias]);

  // Salvar no banco (modo compacto — auto-save)
  const salvarManual = async () => {
    if (saving) return;
    setSaving(true);

    const catSlug = selectedCategoria || null;
    const subSlug = selectedSubcategoria || null;

    try {
      const { error } = await supabase
        .from('scripts_customizados')
        .update({
          categoria_equipe_slug: catSlug,
          subcategoria_gse_slug: subSlug,
          dominio,
          classificacao_origem: 'manual',
          classificacao_em: new Date().toISOString(),
          classificacao_por: user?.id || null,
          classificacao_pendente: false,
        })
        .eq('id', scriptId);

      if (error) {
        toast.error('Erro ao salvar categoria');
        console.error('Erro ao salvar categoria:', error);
      } else {
        toast.success('Categoria atualizada');
        onCategoriaAtualizada?.({
          categoria_equipe_slug: catSlug,
          subcategoria_gse_slug: subSlug,
          origem: 'manual',
        });
        setEditing(false);
      }
    } catch (err) {
      toast.error('Erro ao salvar categoria');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Cancelar edição (modo compacto)
  const cancelar = () => {
    setSelectedCategoria(categoriaEquipeSlug || '');
    setSelectedSubcategoria(subcategoriaGseSlug || '');
    setEditing(false);
  };

  // Keyboard handler para select
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancelar();
    } else if (e.key === 'Enter') {
      salvarManual();
    }
  };

  // Quando categoria muda no select
  const handleCategoriaChange = (newSlug: string) => {
    setSelectedCategoria(newSlug);
    setSelectedSubcategoria(''); // Reset subcategoria
    if (!compact) {
      // Modo expandido: notificar pai
      onCategoriaAtualizada?.({
        categoria_equipe_slug: newSlug || null,
        subcategoria_gse_slug: null,
        origem: 'manual',
      });
    }
  };

  const handleSubcategoriaChange = (newSlug: string) => {
    setSelectedSubcategoria(newSlug);
    if (!compact) {
      // Modo expandido: notificar pai
      onCategoriaAtualizada?.({
        categoria_equipe_slug: selectedCategoria || null,
        subcategoria_gse_slug: newSlug || null,
        origem: 'manual',
      });
    }
  };

  // Obter info visual da categoria atual (do array carregado do banco)
  const categoriaInfo = categoriaEquipeSlug
    ? categorias.find(c => c.slug === categoriaEquipeSlug) || null
    : null;

  // Indicador de conteúdo alterado após classificação manual
  const mostrarAlertaPendente =
    classificacaoOrigem === 'manual' && classificacaoPendente === true;

  // ─── MODO COMPACTO ─────────────────────────────────────────────────────────

  if (compact) {
    // Estado de edição: selects inline
    if (editing) {
      return (
        <div className="inline-flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {/* Select de Categoria */}
          <select
            ref={catSelectRef}
            value={selectedCategoria}
            onChange={(e) => handleCategoriaChange(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="px-1.5 py-0.5 text-xs border border-purple-300 rounded-md bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 max-w-[130px] dark:bg-gray-700 dark:border-purple-600 dark:text-gray-200"
          >
            <option value="">Selecione uma Categoria</option>
            {categorias.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.icone} {cat.nome}
              </option>
            ))}
          </select>

          {/* Select de Subcategoria (se categoria selecionada) */}
          {selectedCategoria && (
            <select
              value={selectedSubcategoria}
              onChange={(e) => handleSubcategoriaChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loadingSub}
              className="px-1.5 py-0.5 text-xs border border-purple-200 rounded-md bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 max-w-[120px] disabled:opacity-50 dark:bg-gray-700 dark:border-purple-700 dark:text-gray-200"
            >
              <option value="">{loadingSub ? 'Carregando...' : 'Selecione uma Subcategoria'}</option>
              {subcategorias.map((sub) => (
                <option key={sub.slug} value={sub.slug}>
                  {sub.nome}
                </option>
              ))}
            </select>
          )}

          {/* Botões confirmar/cancelar */}
          <button
            onClick={salvarManual}
            disabled={saving}
            className="text-green-600 hover:text-green-800 p-0.5 rounded hover:bg-green-50 transition-colors disabled:opacity-50"
            title="Salvar (Enter)"
          >
            ✓
          </button>
          <button
            onClick={cancelar}
            className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-50 transition-colors"
            title="Cancelar (ESC)"
          >
            ✕
          </button>
        </div>
      );
    }

    // Estado padrão: badge clicável
    if (categoriaInfo) {
      return (
        <span className="inline-flex items-center group/cat">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
              setTimeout(() => catSelectRef.current?.focus(), 50);
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border max-w-[140px] cursor-pointer hover:opacity-80 transition-opacity bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700"
            title={`${categoriaInfo.nome}${subcategoriaGseSlug ? ` > ${subcategoriaGseSlug}` : ''} (${dominio}) — Clique para editar`}
          >
            <span className="flex-shrink-0">{categoriaInfo.icone}</span>
            <span className="truncate">{categoriaInfo.nome}</span>
            <span className="opacity-0 group-hover/cat:opacity-100 transition-opacity text-[10px]">✏️</span>
          </button>
          {mostrarAlertaPendente && (
            <span
              className="ml-0.5 text-amber-500 text-xs cursor-help"
              title="Conteúdo alterado desde a classificação manual. Verificar?"
            >
              ⚠️
            </span>
          )}
        </span>
      );
    }

    // Sem categoria: botão [+ Categorizar]
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
          setTimeout(() => catSelectRef.current?.focus(), 50);
        }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400 border border-dashed border-gray-300 hover:border-purple-300 hover:text-purple-500 hover:bg-purple-50 transition-colors cursor-pointer dark:bg-gray-700 dark:text-gray-500 dark:border-gray-600 dark:hover:bg-purple-900/30"
        title="Clique para categorizar este script"
      >
        + Categorizar
      </button>
    );
  }

  // ─── MODO EXPANDIDO ────────────────────────────────────────────────────────

  return (
    <div className="flex items-center gap-2">
      {/* Badge de Domínio */}
      <span
        className="text-xs cursor-help"
        title={`Domínio: ${dominio === 'externo' ? 'Externo (advogados/entes)' : 'Interno (servidores/magistrados)'}`}
      >
        {dominio === 'externo' ? '🌐' : '🏢'}
      </span>

      {/* Select de Categoria */}
      <div className="flex items-center gap-1.5">
        <select
          value={selectedCategoria}
          onChange={(e) => handleCategoriaChange(e.target.value)}
          className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
            selectedCategoria
              ? 'bg-purple-500/30 text-white'
              : 'bg-white/10 text-blue-200 hover:bg-white/20 hover:text-white'
          }`}
        >
          <option value="" className="text-gray-800 dark:text-gray-200">🏷️ Selecione uma Categoria</option>
          {categorias.map((cat) => (
            <option key={cat.slug} value={cat.slug} className="text-gray-800 dark:text-gray-200">
              {cat.icone} {cat.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Select de Subcategoria */}
      <select
        value={selectedSubcategoria}
        onChange={(e) => handleSubcategoriaChange(e.target.value)}
        disabled={!selectedCategoria || loadingSub}
        className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
          selectedSubcategoria
            ? 'bg-purple-500/30 text-white'
            : 'bg-white/10 text-blue-200 hover:bg-white/20 hover:text-white'
        } ${(!selectedCategoria || loadingSub) ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <option value="" className="text-gray-800 dark:text-gray-200">
          {loadingSub ? '⏳ Carregando...' : (selectedCategoria ? '📑 Selecione uma Subcategoria' : '📑 Selecione antes uma Categoria')}
        </option>
        {subcategorias.map((sub) => (
          <option key={sub.slug} value={sub.slug} className="text-gray-800 dark:text-gray-200">
            {sub.nome}
          </option>
        ))}
      </select>

      {/* Indicador de pendência */}
      {mostrarAlertaPendente && (
        <span
          className="text-amber-400 text-xs cursor-help"
          title="Conteúdo alterado desde a classificação manual. Verificar?"
        >
          ⚠️
        </span>
      )}
    </div>
  );
};

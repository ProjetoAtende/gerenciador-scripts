import { useEffect, useMemo, useState } from 'react';
import type { StackTag } from '../../types/atendeStack';
import { stackListarTagsNuvem, type StackTagNuvemItem } from '../../services/atendeStackService';

interface Props {
  selectedIds: string[];
  onChangeSelectedIds: (ids: string[]) => void;
}

function toStackTag(item: StackTagNuvemItem): StackTag {
  return { id: item.id, slug: item.slug, rotulo: item.rotulo };
}

export function StackTagChipFilter({ selectedIds, onChangeSelectedIds }: Props) {
  const [nuvem, setNuvem] = useState<StackTagNuvemItem[]>([]);
  const [busca, setBusca] = useState('');
  const [labels, setLabels] = useState<Map<string, StackTag>>(new Map());

  useEffect(() => {
    void stackListarTagsNuvem(200)
      .then((items) => {
        setNuvem(items);
        setLabels((prev) => {
          const next = new Map(prev);
          items.forEach((t) => next.set(t.id, toStackTag(t)));
          return next;
        });
      })
      .catch(() => setNuvem([]));
  }, []);

  useEffect(() => {
    setLabels((prev) => {
      const next = new Map(prev);
      selectedIds.forEach((id) => {
        if (!next.has(id)) {
          next.set(id, { id, slug: id, rotulo: id.slice(0, 8) });
        }
      });
      return next;
    });
  }, [selectedIds]);

  const selectedTags = useMemo(
    () => selectedIds.map((id) => labels.get(id)!),
    [selectedIds, labels],
  );

  const visibleNuvem = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return nuvem;
    return nuvem.filter(
      (t) => t.rotulo.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
    );
  }, [nuvem, busca]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChangeSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      onChangeSelectedIds([...selectedIds, id]);
    }
  };

  const remove = (id: string) => {
    onChangeSelectedIds(selectedIds.filter((x) => x !== id));
  };

  return (
    <div>
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedTags.map((t) => (
            <span
              key={t.id}
              className="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-200 px-2 py-0.5 rounded-full inline-flex items-center"
            >
              {t.rotulo}
              <button type="button" className="ml-1" onClick={() => remove(t.id)} aria-label={`Remover filtro ${t.rotulo}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative mb-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar tag na lista…"
          aria-label="Buscar tag na nuvem"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1.5 text-sm dark:bg-slate-800"
        />
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
        Clique para filtrar; vários chips = pergunta com <strong>todas</strong> as tags (E).
      </p>

      <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 p-1.5">
        <div className="flex flex-wrap gap-1">
          {visibleNuvem.length === 0 ? (
            <span className="text-xs text-slate-500 px-1 py-2">Nenhuma tag encontrada.</span>
          ) : (
            visibleNuvem.map((t) => {
              const on = selectedIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    on
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  title={`${t.rotulo} (${t.uso_count} uso${t.uso_count === 1 ? '' : 's'})`}
                >
                  {t.rotulo}
                  <span className={`text-[9px] ${on ? 'opacity-80' : 'opacity-60'}`}>{t.uso_count}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

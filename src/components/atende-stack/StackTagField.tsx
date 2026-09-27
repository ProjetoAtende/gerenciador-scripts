import { useEffect, useState } from 'react';
import type { StackTag } from '../../types/atendeStack';
import { stackListarTags } from '../../services/atendeStackService';

interface Props {
  tags: StackTag[];
  onChange: (tags: StackTag[]) => void;
  placeholder?: string;
}

export function StackTagField({ tags, onChange, placeholder = 'Adicionar tag…' }: Props) {
  const [draft, setDraft] = useState('');
  const [sugestoes, setSugestoes] = useState<StackTag[]>([]);

  useEffect(() => {
    if (!draft.trim()) {
      setSugestoes([]);
      return;
    }
    const t = setTimeout(() => {
      void stackListarTags(draft, 8).then(setSugestoes).catch(() => setSugestoes([]));
    }, 200);
    return () => clearTimeout(t);
  }, [draft]);

  const addTag = (raw: string, fromSuggestion?: StackTag) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (fromSuggestion) {
      if (!tags.some((t) => t.id === fromSuggestion.id)) {
        onChange([...tags, fromSuggestion]);
      }
    } else {
      const pseudo: StackTag = { id: `new:${trimmed}`, slug: trimmed, rotulo: trimmed };
      if (!tags.some((t) => t.rotulo.toLowerCase() === trimmed.toLowerCase())) {
        onChange([...tags, pseudo]);
      }
    }
    setDraft('');
    setSugestoes([]);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map((t) => (
          <span
            key={t.id}
            className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded-full inline-flex items-center"
          >
            {t.rotulo}
            <button
              type="button"
              className="ml-1 hover:text-red-600"
              aria-label={`Remover tag ${t.rotulo}`}
              onClick={() => onChange(tags.filter((x) => x.id !== t.id))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(draft);
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2.5 text-sm dark:bg-slate-800"
        />
        <button
          type="button"
          onClick={() => addTag(draft)}
          aria-label="Adicionar tag"
          className="min-h-[44px] min-w-[44px] px-3 py-2.5 text-sm bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 inline-flex items-center justify-center"
        >
          Add
        </button>
      </div>
      {sugestoes.length > 0 && (
        <ul className="mt-1 border rounded-lg dark:border-slate-600 overflow-hidden max-h-40 overflow-y-auto">
          {sugestoes.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => addTag(t.rotulo, t)}
              >
                {t.rotulo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { StackFiltros } from '../../types/atendeStack';
import { defaultStackFiltros } from '../../types/atendeStack';
import { StackTagChipFilter } from './StackTagChipFilter';

interface Props {
  filtros: StackFiltros;
  onChange: (filtros: StackFiltros) => void;
  equipeFiltroDisabled: boolean;
}

export function StackFiltrosPanel({ filtros, onChange, equipeFiltroDisabled }: Props) {
  const toggleMinhas = (key: 'fiz' | 'respondi' | 'favoritas') => {
    onChange({
      ...filtros,
      minhas: { ...filtros.minhas, [key]: !filtros.minhas[key] },
    });
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-2">Equipe</p>
        <label
          className="flex items-center gap-2 mb-2"
          title={equipeFiltroDisabled ? 'Selecione uma equipe na Home para usar este filtro' : undefined}
        >
          <input
            type="checkbox"
            checked={filtros.equipe.ativo}
            disabled={equipeFiltroDisabled}
            onChange={(e) =>
              onChange({
                ...filtros,
                equipe: { ...filtros.equipe, ativo: e.target.checked },
              })
            }
          />
          <span className={equipeFiltroDisabled ? 'text-slate-500 dark:text-slate-400' : ''}>Filtrar por equipe</span>
        </label>
        {equipeFiltroDisabled && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">Selecione uma equipe na Home para filtrar.</p>
        )}
        <select
          aria-label="Modo do filtro por equipe"
          disabled={!filtros.equipe.ativo || equipeFiltroDisabled}
          value={filtros.equipe.modo}
          onChange={(e) =>
            onChange({
              ...filtros,
              equipe: { ...filtros.equipe, modo: e.target.value as StackFiltros['equipe']['modo'] },
            })
          }
          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 disabled:opacity-50"
        >
          <option value="todas">Todas</option>
          <option value="criadas">Criadas pela equipe</option>
          <option value="com_resposta">Com resposta da equipe</option>
        </select>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-2">Minhas</p>
        <div className="flex flex-wrap gap-2">
          {(['fiz', 'respondi', 'favoritas'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => toggleMinhas(k)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filtros.minhas[k]
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
              }`}
            >
              {k === 'fiz' ? 'Fiz' : k === 'respondi' ? 'Respondi' : 'Favoritas'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-2">Status</p>
        <div className="flex flex-wrap gap-2">
          {(['todas', 'aberta', 'fechada'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ ...filtros, status: s })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                filtros.status === s
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-slate-200 dark:border-slate-600'
              }`}
            >
              {s === 'todas' ? 'Todas' : s === 'aberta' ? 'Abertas' : 'Fechadas'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-2">Tags</p>
        <StackTagChipFilter
          selectedIds={filtros.tag_ids}
          onChangeSelectedIds={(tag_ids) => onChange({ ...filtros, tag_ids })}
        />
      </div>

      <button
        type="button"
        onClick={() => onChange(defaultStackFiltros())}
        className="text-xs text-indigo-800 dark:text-indigo-300 hover:underline"
      >
        Limpar filtros
      </button>
    </div>
  );
}

import React from 'react';
import type { CategoriaAnotacao } from '../../types/Prioridades';
import { CATEGORIAS_ANOTACAO } from './prioridadesCategorias';

interface Props {
  value: CategoriaAnotacao | '';
  onChange: (valor: CategoriaAnotacao | '') => void;
}

/** Filtro de listas UPJ por categoria da anotação. */
export const FiltroCategoriaUpj: React.FC<Props> = ({ value, onChange }) => (
  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
    <span className="font-medium text-gray-600 dark:text-gray-300">Filtrar categoria:</span>
    <select
      value={value}
      onChange={(e) => onChange((e.target.value || '') as CategoriaAnotacao | '')}
      className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
    >
      <option value="">Todas</option>
      {CATEGORIAS_ANOTACAO.map((c) => (
        <option key={c.codigo} value={c.codigo}>
          {c.label}
        </option>
      ))}
    </select>
  </div>
);

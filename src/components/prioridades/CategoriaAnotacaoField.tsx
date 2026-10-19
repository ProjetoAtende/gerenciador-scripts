import React from 'react';
import {
  CATEGORIAS_ANOTACAO,
  type CategoriaAnotacao,
} from './prioridadesCategorias';

interface Props {
  value: CategoriaAnotacao | '';
  onChange: (valor: CategoriaAnotacao) => void;
  disabled?: boolean;
  idPrefix?: string;
}

/** Área "Categoria da Anotação" — 8 rádios em 2 linhas de 4. */
export const CategoriaAnotacaoField: React.FC<Props> = ({
  value,
  onChange,
  disabled = false,
  idPrefix = 'pu-cat',
}) => (
  <fieldset disabled={disabled} className="space-y-2">
    <legend className="text-sm font-medium text-gray-700 dark:text-gray-200">
      Categoria da Anotação <span className="text-red-600">*</span>
    </legend>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {CATEGORIAS_ANOTACAO.map((cat) => {
        const id = `${idPrefix}-${cat.codigo}`;
        return (
          <label
            key={cat.codigo}
            htmlFor={id}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-2 text-sm ${
              value === cat.codigo
                ? 'border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30'
                : 'border-gray-300 dark:border-gray-600'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              id={id}
              type="radio"
              name={`${idPrefix}-grupo`}
              value={cat.codigo}
              checked={value === cat.codigo}
              onChange={() => onChange(cat.codigo)}
              className="h-4 w-4 shrink-0"
            />
            <span className="font-medium text-gray-800 dark:text-gray-100">{cat.label}</span>
            <span
              className="ml-auto text-base leading-none"
              title={cat.dica}
              aria-label={cat.dica}
            >
              ℹ️
            </span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

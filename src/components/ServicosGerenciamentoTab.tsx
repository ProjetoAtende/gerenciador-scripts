/**
 * Aba admin: cadastro e edição do catálogo de tipos de serviço.
 */

import React, { useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Save, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  UnidadeMedida,
  criarServicoTipo,
  atualizarServicoTipo,
  listarServicoTipos,
  type ServicoTipoRow,
} from '../services/servicosService';
import { useServicoTipos } from '../contexts/ServicoTiposContext';
import { useEffectiveAuth } from '../hooks/useEffectiveAuth';
import { podeGerenciarTiposServico } from '../contexts/AuthContext';

const EMOJIS_SUGERIDOS = [
  '📧', '✅', '👥', '🤝', '📢', '📋', '🎫', '🗃️', '🧩', '💬', '🏪', '🖥️', '🔧', '🧾', '🗂️',
  '📊', '📄', '📅', '🏢', '⚙️', '📡', '💡', '📚', '📞', '🔍', '📝', '🔄', '✔️', '📣', '🗓️',
  '🏥', '💭', '🛟', '📈', '⚠️', '🎯', '🐛', '👁️', '📜', '❓', '🤖', '🔀', '⚖️', '🔌', '📐', '🐍', '🧠', '📋',
];

function slugify(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 80);
}

interface ServicosGerenciamentoTabProps {
  /** Quando true, exibe o catálogo sem ações de criar/editar (perfil `user`). */
  somenteLeitura?: boolean;
}

export default function ServicosGerenciamentoTab({ somenteLeitura = false }: ServicosGerenciamentoTabProps) {
  const { userRole } = useEffectiveAuth();
  const podeEditar = !somenteLeitura && podeGerenciarTiposServico(userRole);
  const { refresh, fonte } = useServicoTipos();
  const [itens, setItens] = useState<ServicoTipoRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [modo, setModo] = useState<'lista' | 'novo' | 'editar'>('lista');
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<ServicoTipoRow | null>(null);

  const [formCodigo, setFormCodigo] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formUnidade, setFormUnidade] = useState<UnidadeMedida>('unidades');
  const [formIcone, setFormIcone] = useState('📋');
  const [formDica, setFormDica] = useState('');
  const [formAtivo, setFormAtivo] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    try {
      const res = await listarServicoTipos(true);
      if (res.sucesso) {
        setItens(res.tipos.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')));
      } else {
        toast.error(res.erro ?? 'Erro ao carregar catálogo.');
      }
    } finally {
      setCarregando(false);
    }
  };

  React.useEffect(() => {
    void carregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.codigo.toLowerCase().includes(q)
    );
  }, [itens, busca]);

  const abrirNovo = () => {
    if (!podeEditar) return;
    setModo('novo');
    setEditando(null);
    setFormLabel('');
    setFormUnidade('unidades');
    setFormIcone('📋');
    setFormDica('');
    setFormAtivo(true);
  };

  const abrirEditar = (row: ServicoTipoRow) => {
    if (!podeEditar) return;
    setModo('editar');
    setEditando(row);
    setFormCodigo(row.codigo);
    setFormLabel(row.label);
    setFormUnidade(row.unidade);
    setFormIcone(row.icone);
    setFormDica(row.dica);
    setFormAtivo(row.ativo);
  };

  const cancelarForm = () => {
    setModo('lista');
    setEditando(null);
  };

  const salvarNovo = async () => {
    if (!podeEditar) {
      toast.error('Seu perfil não permite alterar o catálogo de serviços.');
      return;
    }
    const codigo = slugify(formLabel);
    if (!formLabel.trim()) {
      toast.error('Informe o nome do serviço.');
      return;
    }
    if (!codigo) {
      toast.error('Código inválido.');
      return;
    }
    setSalvando(true);
    try {
      const res = await criarServicoTipo({
        codigo,
        label: formLabel.trim(),
        unidade: formUnidade,
        icone: formIcone,
        dica: formDica,
      });
      if (res.sucesso) {
        toast.success('Serviço cadastrado no catálogo.');
        await carregar();
        await refresh();
        cancelarForm();
      } else {
        toast.error(res.erro ?? 'Erro ao cadastrar.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const salvarEdicao = async () => {
    if (!podeEditar) {
      toast.error('Seu perfil não permite alterar o catálogo de serviços.');
      return;
    }
    if (!editando) return;
    if (!formLabel.trim()) {
      toast.error('Informe o nome do serviço.');
      return;
    }
    setSalvando(true);
    try {
      const res = await atualizarServicoTipo(editando.codigo, {
        label: formLabel.trim(),
        unidade: formUnidade,
        icone: formIcone,
        dica: formDica,
        ativo: formAtivo,
      });
      if (res.sucesso) {
        toast.success('Serviço atualizado. Registros existentes passam a exibir o novo nome, unidade e ícone.');
        await carregar();
        await refresh();
        cancelarForm();
      } else {
        toast.error(res.erro ?? 'Erro ao salvar.');
      }
    } finally {
      setSalvando(false);
    }
  };

  React.useEffect(() => {
    if (!podeEditar && (modo === 'novo' || modo === 'editar')) {
      setModo('lista');
      setEditando(null);
    }
  }, [podeEditar, modo]);

  if ((modo === 'novo' || modo === 'editar') && podeEditar) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 p-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {modo === 'novo' ? 'Novo tipo de serviço' : 'Editar tipo de serviço'}
          </h2>
          <button type="button" onClick={cancelarForm} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} />
          </button>
        </div>

        {modo === 'editar' && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Código: <code className="text-teal-600 dark:text-teal-400">{formCodigo}</code> (não alterável)
          </p>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nome do serviço</label>
          <input
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          />
          {modo === 'novo' && formLabel.trim() && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Código gerado automaticamente:{' '}
              <code className="text-teal-600 dark:text-teal-400">{slugify(formLabel) || '—'}</code>
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Contagem em</label>
          <div className="flex gap-3">
            {(['unidades', 'horas'] as UnidadeMedida[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setFormUnidade(u)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  formUnidade === u
                    ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {u === 'horas' ? 'Horas' : 'Unidades'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ícone</label>
          <div className="flex gap-2 items-center mb-2">
            <span className="text-2xl w-10 text-center">{formIcone || '📋'}</span>
            <input
              value={formIcone}
              onChange={(e) => setFormIcone(e.target.value)}
              maxLength={8}
              className="flex-1 px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {EMOJIS_SUGERIDOS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setFormIcone(em)}
                className={`w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-lg ${
                  formIcone === em ? 'ring-2 ring-teal-500' : ''
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Dica (opcional)</label>
          <textarea
            value={formDica}
            onChange={(e) => setFormDica(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          />
        </div>

        {modo === 'editar' && (
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={formAtivo} onChange={(e) => setFormAtivo(e.target.checked)} />
            Tipo ativo (visível para novos registros)
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={cancelarForm} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={modo === 'novo' ? salvarNovo : salvarEdicao}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Gerenciamento de Serviços</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Alterações de nome, unidade e ícone refletem em todos os registros e, nas tarefas equivalentes, na aba Tarefas.
            {fonte === 'padrao' && (
              <span className="block text-amber-600 dark:text-amber-400 mt-1">
                Catálogo do banco indisponível — aplique a migration `20261002120000_servico_tipos_catalogo.sql`.
              </span>
            )}
          </p>
        </div>
        {podeEditar && (
          <button
            type="button"
            onClick={abrirNovo}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
          >
            <Plus size={16} />
            Novo serviço
          </button>
        )}
      </div>

      {!podeEditar && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Visualização do catálogo. Apenas supervisor, coordenador ou administrador podem cadastrar ou editar tipos de serviço.
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou código..."
          className="w-full pl-9 pr-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
        />
      </div>

      {carregando ? (
        <div className="flex justify-center py-16 text-gray-500">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700 border dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800/50">
          {filtrados.map((row) => (
            <li key={row.codigo} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
              <span className="text-xl w-8 text-center">{row.icone}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${row.ativo ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 line-through'}`}>
                  {row.label}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {row.codigo} · {row.unidade === 'horas' ? 'Horas' : 'Unidades'}
                  {row.eh_personalizado && ' · personalizado'}
                </p>
              </div>
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => abrirEditar(row)}
                  className="p-2 rounded-lg text-gray-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                  title="Editar"
                >
                  <Pencil size={16} />
                </button>
              )}
            </li>
          ))}
          {filtrados.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-gray-500">Nenhum tipo encontrado.</li>
          )}
        </ul>
      )}
    </div>
  );
}

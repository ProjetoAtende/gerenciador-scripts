import React, { useCallback, useEffect, useState } from 'react';
import type { CatalogoItem } from '../../services/prioridadesService';
import {
  definirVisaoFila,
  incluirDiaSemExpediente,
  listarDiasSemExpediente,
  listarRegrasEspeciais,
  listarTiposPrioridade,
  removerDiaSemExpediente,
  salvarRegraEspecial,
  type DiaSemExpediente,
  type RegraEspecial,
} from '../../services/prioridadesService';
import type { Upj } from '../../types/Prioridades';

interface Props {
  upjs: Upj[];
  somenteVinculadas: boolean;
  onVoltar: () => void;
  onAtualizar: () => Promise<void>;
}

/**
 * Configurações do Gestor: dias sem expediente, regras especiais por UPJ
 * e a visão da fila de conferência.
 */
export const ConfiguracoesTela: React.FC<Props> = ({ upjs, somenteVinculadas, onVoltar, onAtualizar }) => {
  const [dias, setDias] = useState<DiaSemExpediente[]>([]);
  const [regras, setRegras] = useState<RegraEspecial[]>([]);
  const [tipos, setTipos] = useState<CatalogoItem[]>([]);
  const [data, setData] = useState('');
  const [descricao, setDescricao] = useState('');
  const [upjId, setUpjId] = useState('');
  const [tipo, setTipo] = useState('');
  const [textoRegra, setTextoRegra] = useState('');
  const [filaRestrita, setFilaRestrita] = useState(somenteVinculadas);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [listaDias, listaRegras, listaTipos] = await Promise.all([
      listarDiasSemExpediente(),
      listarRegrasEspeciais(),
      listarTiposPrioridade(),
    ]);
    setDias(listaDias);
    setRegras(listaRegras);
    setTipos(listaTipos);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const regra = regras.find((r) => r.upj_id === upjId && r.tipo_prioridade === tipo);
    setTextoRegra(regra?.texto ?? '');
  }, [regras, upjId, tipo]);

  const incluirDia = async () => {
    setErro(null);
    const resposta = await incluirDiaSemExpediente(data, descricao);
    if (!resposta.sucesso) {
      setErro(resposta.erro ?? 'Não foi possível incluir o dia.');
      return;
    }
    setData('');
    setDescricao('');
    setAviso('Dia sem expediente incluído. Prazos já em curso não mudam.');
    await carregar();
  };

  const removerDia = async (dia: string) => {
    setErro(null);
    const resposta = await removerDiaSemExpediente(dia);
    if (!resposta.sucesso) {
      setErro(resposta.erro ?? 'Não foi possível remover o dia.');
      return;
    }
    await carregar();
  };

  const salvarRegra = async () => {
    setErro(null);
    const resposta = await salvarRegraEspecial(upjId, tipo, textoRegra);
    if (!resposta.sucesso) {
      setErro(resposta.erro ?? 'Não foi possível salvar a regra.');
      return;
    }
    setAviso(textoRegra.trim() ? 'Regra especial salva.' : 'Regra especial removida.');
    await carregar();
  };

  const salvarFila = async (valor: boolean) => {
    setFilaRestrita(valor);
    const resposta = await definirVisaoFila(valor);
    if (!resposta.sucesso) {
      setFilaRestrita(!valor);
      setErro(resposta.erro ?? 'Não foi possível salvar a preferência.');
      return;
    }
    await onAtualizar();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Configurações</h2>
        <button type="button" onClick={onVoltar} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          Voltar ao painel
        </button>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {erro}
        </p>
      )}
      {aviso && (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
          {aviso}
        </p>
      )}

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Fila de conferência</h3>
        <label className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-100">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={filaRestrita}
            onChange={(e) => void salvarFila(e.target.checked)}
          />
          <span>
            Nas listas Ag. Conferência e Retornadas, mostrar só as anotações vinculadas a mim.
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              Desmarcado, estas duas listas mostram também as anotações vinculadas aos Conferentes Designados.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Dias sem expediente</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          A contagem das 24 h pausa nestes dias e também aos sábados e domingos. Um prazo já mostrado ao Atendente
          não é recalculado.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (feriado, suspensão, recesso)"
            className="min-w-[16rem] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={() => void incluirDia()}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Incluir
          </button>
        </div>
        <ul className="divide-y divide-gray-200 text-sm dark:divide-gray-700">
          {dias.length === 0 && <li className="py-2 text-gray-500">Nenhum dia cadastrado.</li>}
          {dias.map((dia) => (
            <li key={dia.data} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-mono">{dia.data.split('-').reverse().join('/')}</span>
                <span className="ml-2 text-gray-700 dark:text-gray-200">{dia.descricao}</span>
              </span>
              <button type="button" onClick={() => void removerDia(dia.data)} className="text-xs text-red-700 hover:underline dark:text-red-300">
                Remover
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Regras especiais das UPJs</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Uma regra por tipo de prioridade e por UPJ. O Atendente vê o texto em um aviso ao escolher o tipo.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={upjId}
            onChange={(e) => setUpjId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">UPJ…</option>
            {upjs.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">Tipo de Prioridade/Urgência…</option>
            {tipos.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          rows={4}
          value={textoRegra}
          onChange={(e) => setTextoRegra(e.target.value)}
          placeholder="Texto do aviso. Deixe em branco e salve para remover a regra."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!upjId || !tipo}
            onClick={() => void salvarRegra()}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:bg-gray-400"
          >
            Salvar regra
          </button>
        </div>
      </section>
    </div>
  );
};

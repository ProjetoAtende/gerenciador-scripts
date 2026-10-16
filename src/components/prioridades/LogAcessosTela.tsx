import React, { useCallback, useEffect, useState } from 'react';
import { formatarProcessoCnj } from '../../services/prioridadesDjenService';
import { listarLogAcessosPrivilegiados, type LinhaLogAcesso } from '../../services/prioridadesService';
import { formatarDataHora } from './prioridadesUtils';

interface Props {
  onVoltar: () => void;
}

/**
 * Consulta ao log de leituras do administrador (PD-13).
 * Acesso: Gestor e Coordenador — conforme resposta da área (15/10/2026).
 */
export const LogAcessosTela: React.FC<Props> = ({ onVoltar }) => {
  const [linhas, setLinhas] = useState<LinhaLogAcesso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const resposta = await listarLogAcessosPrivilegiados();
    if (!resposta.sucesso) {
      setErro(resposta.erro ?? 'Não foi possível carregar o log.');
      setLinhas([]);
    } else {
      setLinhas(resposta.linhas);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Log de acessos privilegiados</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Registro de quando um administrador abre uma anotação de outro usuário. Retenção: 12 meses.
          </p>
        </div>
        <button type="button" onClick={onVoltar} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          Voltar
        </button>
      </div>

      {erro && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
          {erro}
        </div>
      )}

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-600">
          Nenhum registro encontrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Quando</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Administrador</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Anotação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-200">
                    {formatarDataHora(l.criado_em)}
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                    {l.usuario_nome ?? '—'}
                    {l.usuario_email ? (
                      <span className="block text-xs text-gray-500">{l.usuario_email}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-800 dark:text-gray-100">
                    #{l.anotacao_id} · {formatarProcessoCnj(l.processo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

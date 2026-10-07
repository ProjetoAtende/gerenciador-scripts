import React from 'react';
import type { PerfilUsuarioPrioridades, PrioridadeModulo, PrioridadePerfil } from '../../types/Prioridades';
import { PERFIL_LABEL, gruposDoModulo } from '../../types/Prioridades';
import type { TelaPrioridades } from '../../hooks/usePrioridadesModal';

interface PrioridadesSidebarProps {
  modulo: PrioridadeModulo;
  setModulo: (m: PrioridadeModulo) => void;
  perfil: PerfilUsuarioPrioridades | null;
  perfilEfetivo: PrioridadePerfil | null;
  nomeUsuario: string;
  contadores: Record<string, number>;
  tela: TelaPrioridades;
  irPara: (t: TelaPrioridades) => void;
  /** Seções fixas além dos grupos de status. */
  temDesignacoes: boolean;
  /** Papel admin global: única condição que libera alternar módulos (suporte). */
  ehAdmin: boolean;
}

/**
 * Painel lateral comum aos três módulos (seção 7.1).
 *
 * Itens variam por módulo (RF-GES-08 e RF-UPJ-02). O módulo UPJ tem uma seção
 * extra "Urgentíssimas", que na especificação é uma lista própria e não um
 * status — por isso ela é resolvida na tela, não aqui.
 */
export const PrioridadesSidebar: React.FC<PrioridadesSidebarProps> = ({
  modulo,
  setModulo,
  perfil,
  perfilEfetivo,
  nomeUsuario,
  contadores,
  tela,
  irPara,
  temDesignacoes,
  ehAdmin,
}) => {
  const grupos = gruposDoModulo(modulo);

  // RF-ATD-11: somente estes perfis registram anotações. Usa o perfil EFETIVO,
  // porque uma designação em vigor já habilita a operação.
  const podeRegistrar =
    perfilEfetivo === 'atendente' || perfilEfetivo === 'gestor' || perfilEfetivo === 'conferente';

  const modulosDisponiveis: Array<{ chave: PrioridadeModulo; label: string }> = [
    { chave: 'atendente', label: 'Atendentes' },
    { chave: 'gestor', label: 'Gestores' },
    { chave: 'upj', label: 'UPJs' },
  ];

  const itemAtivo = (chave: string) => tela.tipo === 'lista' && tela.grupo === chave;

  /**
   * O módulo é determinado pelo PERFIL do usuário, não por escolha livre.
   *
   * A especificação define cinco tipos de usuário distribuídos por três módulos
   * (seção 4), e `prioridades_usuarios_perfil.usuario_id` é UNIQUE — cada pessoa
   * tem exatamente um perfil no app.
   *
   * Exibir as três abas para todo mundo criava a ilusão de acesso e permitia
   * navegar em módulos de outra UPJ: as listas vinham vazias e as ações eram
   * recusadas pelo servidor, mas a interface sugeria o contrário. A alternância
   * fica restrita ao papel `admin` global, que a área definiu como leitura total
   * para suporte.
   */
  const podeAlternarModulo = ehAdmin;
  const moduloLabel = modulosDisponiveis.find((m) => m.chave === modulo)?.label ?? 'Atendentes';

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            🏛️
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-800 dark:text-gray-100">
              Prioridades e Urgências
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">TJSP Atende</p>
          </div>
        </div>
        <div className="mt-3 text-xs">
          <p className="truncate font-medium text-gray-700 dark:text-gray-200" title={nomeUsuario}>
            {nomeUsuario || 'Usuário'}
          </p>
          <p className="text-gray-500 dark:text-gray-400">
            {perfilEfetivo ? PERFIL_LABEL[perfilEfetivo] : 'Sem perfil no app'}
          </p>
          {/* Deixa explícito quando o acesso vem de designação, e não do perfil base. */}
          {perfil && perfilEfetivo && perfilEfetivo !== perfil.perfil && (
            <p className="mt-0.5 text-[11px] text-blue-600 dark:text-blue-300">
              por designação (base: {PERFIL_LABEL[perfil.perfil]})
            </p>
          )}
        </div>
      </div>

      {/*
        Alternância de módulo: visível apenas ao admin global (suporte), que
        precisa inspecionar os três módulos. Para os demais o módulo é derivado
        do perfil e exibido como rótulo, sem simular um acesso que não existe.
      */}
      <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        {podeAlternarModulo ? (
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
            {modulosDisponiveis.map((m) => (
              <button
                key={m.chave}
                type="button"
                onClick={() => setModulo(m.chave)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  modulo === m.chave
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-300'
                    : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Módulo {moduloLabel}
          </p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {modulo === 'atendente' ? 'Atendentes' : modulo === 'gestor' ? 'UPJs' : 'Minha UPJ'}
        </p>

        <ul className="space-y-0.5">
          {grupos.map((grupo) => {
            const total = contadores[grupo.chave] ?? 0;
            const ativo = itemAtivo(grupo.chave);
            const realce = grupo.chave === 'devolvidas' && total > 0;
            return (
              <li key={grupo.chave}>
                <button
                  type="button"
                  onClick={() => irPara({ tipo: 'lista', grupo: grupo.chave })}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                    ativo
                      ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                      : realce
                        ? 'font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="truncate">{grupo.label}</span>
                  {total > 0 && (
                    <span
                      className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                        realce
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-100'
                      }`}
                    >
                      {total}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
          <ul className="space-y-0.5">
            <li>
              <button
                type="button"
                onClick={() => irPara({ tipo: 'historico' })}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  tela.tipo === 'historico'
                    ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Histórico
              </button>
            </li>
            {temDesignacoes && (
              <li>
                <button
                  type="button"
                  onClick={() => irPara({ tipo: 'designacoes' })}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    tela.tipo === 'designacoes'
                      ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Designações
                </button>
              </li>
            )}
          </ul>
        </div>
      </nav>

      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        {/*
          Atalho de registro, disponível apenas aos perfis que podem registrar
          (RF-ATD-11: atendente, gestor e conferente). Coordenador e analista da
          UPJ não registram anotações, então não veem o botão.
        */}
        {podeRegistrar && (
          <button
            type="button"
            onClick={() => irPara({ tipo: 'nova' })}
            className={`w-full rounded-md px-3 py-2 text-sm font-medium text-white transition-colors ${
              tela.tipo === 'nova' ? 'bg-blue-900 hover:bg-blue-950' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            Nova Anotação
          </button>
        )}
      </div>
    </aside>
  );
};

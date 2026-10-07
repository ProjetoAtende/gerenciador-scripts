import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissoes } from '../../contexts/PermissoesContext';
import type { UsePrioridadesModal } from '../../hooks/usePrioridadesModal';
import { listarAnotacoes } from '../../services/prioridadesService';
import type { AnotacaoPrioridade } from '../../types/Prioridades';
import { gruposDoModulo } from '../../types/Prioridades';
import { AnotacaoCard } from './PrioridadesUi';
import { NovaAnotacaoForm } from './NovaAnotacaoForm';
import { ConferenciaAnotacao } from './ConferenciaAnotacao';
import { AnaliseAnotacao } from './AnaliseAnotacao';
import { RespostaDevolucao } from './RespostaDevolucao';
import { DesignacoesTela } from './DesignacoesTela';
import { HistoricoTela } from './HistoricoTela';

interface PrioridadesContentProps extends UsePrioridadesModal {
  /** Mantido para o cabeçalho de contexto; o nome já aparece no painel lateral. */
  nomeUsuario?: string;
}

/** Tela "Inicial" dos módulos Atendentes (7.2), Gestores (7.3) e UPJs (7.4). */
const TelaInicial: React.FC<{
  modulo: UsePrioridadesModal['modulo'];
  anotacoes: AnotacaoPrioridade[];
  onAbrir: (a: AnotacaoPrioridade) => void;
  onVerLista: (grupo: string) => void;
  onNova: () => void;
}> = ({ modulo, anotacoes, onAbrir, onVerLista, onNova }) => {
  const secoes = useMemo(() => {
    if (modulo === 'atendente') {
      return [{ grupo: 'devolvidas', titulo: 'Anotações Devolvidas' }];
    }
    if (modulo === 'gestor') {
      return [
        { grupo: 'ag-conferencia', titulo: 'Anotações Aguardando Conferência' },
        { grupo: 'reiteradas', titulo: 'Anotações Reiteradas' },
        { grupo: 'devolvidas', titulo: 'Devolvidas da UPJ' },
      ];
    }
    return [
      { grupo: 'urgentissimas', titulo: 'Anotações Urgentíssimas' },
      { grupo: 'reiteradas', titulo: 'Anotações Reiteradas' },
      { grupo: 'pendentes', titulo: 'Anotações Pendentes' },
    ];
  }, [modulo]);

  const porSecao = useMemo(() => {
    const resultado: Record<string, AnotacaoPrioridade[]> = {};
    for (const secao of secoes) {
      if (secao.grupo === 'urgentissimas') {
        resultado[secao.grupo] = anotacoes.filter((a) => a.urgentissimo && a.status === 'upj-pendente');
      } else {
        const grupo = gruposDoModulo(modulo).find((g) => g.chave === secao.grupo);
        resultado[secao.grupo] = grupo
          ? anotacoes.filter((a) => grupo.status.includes(a.status))
          : [];
      }
    }
    return resultado;
  }, [anotacoes, secoes, modulo]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {modulo === 'atendente' ? 'Painel do Atendente' : modulo === 'gestor' ? 'Painel do Gestor' : 'Painel da UPJ'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Registro guiado de anotações de prioridade e urgência, com rastreabilidade integral.
          </p>
        </div>
        {modulo === 'atendente' && (
          <button
            type="button"
            onClick={onNova}
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
          >
            + Nova Anotação
          </button>
        )}
      </div>

      {secoes.map((secao) => {
        const itens = porSecao[secao.grupo] ?? [];
        return (
          <section key={secao.grupo}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {secao.titulo} ({itens.length})
              </h3>
              {itens.length > 0 && (
                <button
                  type="button"
                  onClick={() => onVerLista(secao.grupo)}
                  className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
                >
                  Ver todas
                </button>
              )}
            </div>
            {itens.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                Nenhuma anotação nesta situação.
              </p>
            ) : (
              <div className="space-y-2">
                {itens.slice(0, 5).map((a) => (
                  <AnotacaoCard key={a.id} anotacao={a} onAbrir={onAbrir} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export const PrioridadesContent: React.FC<PrioridadesContentProps> = ({
  modulo,
  perfil,
  perfilEfetivo,
  upjs,
  tela,
  irPara,
  voltarInicial,
  atualizar,
}) => {
  const { user } = useAuth();
  const { isAdmin } = usePermissoes();
  const [anotacoes, setAnotacoes] = useState<AnotacaoPrioridade[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const nomeUpj = useCallback(
    (upjId: string | null): string | null => {
      if (!upjId) return null;
      const u = upjs.find((x) => x.id === upjId);
      return u ? `${u.codigo} — ${u.nome}` : null;
    },
    [upjs]
  );

  const carregar = useCallback(async () => {
    setCarregandoLista(true);
    try {
      const { anotacoes: lista } = await listarAnotacoes({ limite: 200 });
      setAnotacoes(lista);
    } finally {
      setCarregandoLista(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar, modulo, tela]);

  const abrirAnotacao = useCallback(
    (a: AnotacaoPrioridade) => {
      const modo =
        a.status === 'gestor-conferencia'
          ? 'conferencia'
          : a.status === 'upj-pendente'
            ? 'analise'
            : a.status === 'gestor-devolvida' || a.status === 'upj-devolvida'
              ? 'resposta'
              : 'consulta';
      irPara({ tipo: 'detalhe', anotacaoId: a.id, modo });
    },
    [irPara]
  );

  const aposAcao = useCallback(
    async (mensagem: string) => {
      setAviso(mensagem);
      await Promise.all([carregar(), atualizar()]);
      irPara({ tipo: 'inicial' });
    },
    [carregar, atualizar, irPara]
  );

  const itensDaLista = useMemo(() => {
    if (tela.tipo !== 'lista') return [];
    if (tela.grupo === 'urgentissimas') {
      return anotacoes.filter((a) => a.urgentissimo && a.status === 'upj-pendente');
    }
    const grupo = gruposDoModulo(modulo).find((g) => g.chave === tela.grupo);
    return grupo ? anotacoes.filter((a) => grupo.status.includes(a.status)) : [];
  }, [tela, anotacoes, modulo]);

  const anotacaoEmFoco = useMemo(
    () => (tela.tipo === 'detalhe' ? anotacoes.find((a) => a.id === tela.anotacaoId) ?? null : null),
    [tela, anotacoes]
  );

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      {/*
        Faixa de aviso quando o usuário ainda não tem perfil no app.
        O texto difere para o admin: ele NÃO fica apenas em visualização — é
        quem provisiona os perfis base, e sem isso ninguém sai do lugar. Dizer
        "modo de visualização" para o admin o levaria a concluir que a tela está
        bloqueada, quando é exatamente ali que ele destrava o sistema.
      */}
      {!perfil && (
        <div className="border-b border-amber-300 bg-amber-50 px-6 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          {isAdmin ? (
            <>
              Seu usuário não tem perfil no app, mas você é <strong>administrador</strong>. Use{' '}
              <strong>Designações → Perfil base</strong> para definir o primeiro Gestor e o primeiro Coordenador da
              UPJ; a partir daí eles designam os Conferentes e Analistas. O registro de anotações exige perfil
              próprio.
            </>
          ) : (
            <>
              Seu usuário ainda não possui perfil cadastrado em <strong>Prioridades e Urgências</strong>. O acesso
              está em modo de visualização — o registro de anotações será bloqueado pelo servidor até a designação.
            </>
          )}
        </div>
      )}

      {aviso && (
        <div className="flex items-start justify-between gap-3 border-b border-emerald-300 bg-emerald-50 px-6 py-2 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} className="font-bold">
            ×
          </button>
        </div>
      )}

      {carregandoLista && (
        <div className="border-b border-gray-200 bg-white px-6 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          Carregando anotações…
        </div>
      )}

      {tela.tipo === 'inicial' && (
        <TelaInicial
          modulo={modulo}
          anotacoes={anotacoes}
          onAbrir={abrirAnotacao}
          onVerLista={(grupo) => irPara({ tipo: 'lista', grupo })}
          onNova={() => irPara({ tipo: 'nova' })}
        />
      )}

      {tela.tipo === 'lista' && (
        <div className="space-y-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              {tela.grupo === 'urgentissimas'
                ? 'Urgentíssimas'
                : gruposDoModulo(modulo).find((g) => g.chave === tela.grupo)?.label ?? 'Lista'}
              <span className="ml-2 text-sm font-normal text-gray-500">({itensDaLista.length})</span>
            </h2>
            <button
              type="button"
              onClick={voltarInicial}
              className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Voltar ao painel
            </button>
          </div>

          {itensDaLista.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
              Nenhuma anotação nesta lista.
            </p>
          ) : (
            <div className="space-y-2">
              {itensDaLista.map((a) => (
                <AnotacaoCard key={a.id} anotacao={a} onAbrir={abrirAnotacao} upjNome={nomeUpj(a.upj_id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {tela.tipo === 'nova' && (
        <NovaAnotacaoForm
          perfil={perfil}
          onVoltar={voltarInicial}
          onCriada={(mensagem) => void aposAcao(mensagem)}
        />
      )}

      {tela.tipo === 'detalhe' && !anotacaoEmFoco && (
        <div className="p-6">
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
            Anotação não encontrada ou sem permissão de visualização.
          </p>
          <div className="mt-3 text-center">
            <button type="button" onClick={voltarInicial} className="text-sm text-blue-700 hover:underline dark:text-blue-300">
              Voltar ao painel
            </button>
          </div>
        </div>
      )}

      {tela.tipo === 'detalhe' && anotacaoEmFoco && tela.modo === 'conferencia' && (
        <ConferenciaAnotacao
          anotacao={anotacaoEmFoco}
          upjs={upjs}
          onConcluir={aposAcao}
          onVoltar={voltarInicial}
        />
      )}

      {tela.tipo === 'detalhe' && anotacaoEmFoco && tela.modo === 'analise' && (
        <AnaliseAnotacao anotacao={anotacaoEmFoco} onConcluir={aposAcao} onVoltar={voltarInicial} />
      )}

      {tela.tipo === 'detalhe' && anotacaoEmFoco && tela.modo === 'resposta' && (
        <RespostaDevolucao anotacao={anotacaoEmFoco} onConcluir={aposAcao} onVoltar={voltarInicial} />
      )}

      {tela.tipo === 'detalhe' && anotacaoEmFoco && tela.modo === 'consulta' && (
        <ConferenciaAnotacao
          anotacao={anotacaoEmFoco}
          upjs={upjs}
          somenteLeitura
          onConcluir={aposAcao}
          onVoltar={voltarInicial}
        />
      )}

      {tela.tipo === 'designacoes' && (
        <DesignacoesTela
          perfilEfetivo={perfilEfetivo}
          perfil={perfil}
          ehAdmin={isAdmin}
          upjs={upjs}
          onVoltar={voltarInicial}
          onAtualizar={atualizar}
        />
      )}

      {tela.tipo === 'historico' && (
        <HistoricoTela usuarioId={user?.id ?? null} anotacoes={anotacoes} onAbrir={abrirAnotacao} onVoltar={voltarInicial} />
      )}
    </main>
  );
};

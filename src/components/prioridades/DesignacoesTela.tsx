import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  alternarVinculacaoAutomatica,
  buscarUsuariosElegiveis,
  designarUsuario,
  encerrarDesignacao,
  listarAnotacoes,
  listarDesignacoes,
  listarPerfisBase,
  listarPerfisComVinculacao,
  removerPerfil,
} from '../../services/prioridadesService';
import type {
  DesignacaoListada,
  PerfilBase,
  PerfilUsuarioPrioridades,
  PrioridadePerfil,
  Upj,
  UsuarioElegivel,
} from '../../types/Prioridades';
import { PERFIL_LABEL } from '../../types/Prioridades';

interface Props {
  perfilEfetivo: PrioridadePerfil | null;
  perfil: PerfilUsuarioPrioridades | null;
  ehAdmin: boolean;
  upjs: Upj[];
  onVoltar: () => void;
  onAtualizar: () => Promise<void>;
}

function formatarData(iso: string | null): string {
  if (!iso) return 'Indeterminado';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Tela "Designações" (seções 7.3 e 7.4, slides 133 e 136).
 *
 * RF-GES-06 — Gestor designa Conferentes: busca de usuários vinculados ao TJSP
 * Atende, período (data ou "Indeterminado") e botão "Incluir Designação".
 * RF-UPJ-05 — Coordenador da UPJ designa Analistas: busca restrita à UPJ.
 * RF-GES-07 — controle "Habilitar/Desabilitar Vinculação Automática" por entrada.
 *
 * A designação cria/ajusta o perfil base do designado no servidor, para que ele
 * consiga efetivamente abrir o app e ver o módulo correspondente.
 */
export const DesignacoesTela: React.FC<Props> = ({
  perfilEfetivo,
  perfil,
  ehAdmin,
  upjs,
  onVoltar,
  onAtualizar,
}) => {
  const souCoordenador = perfilEfetivo === 'coordenador';
  const souGestor = perfilEfetivo === 'gestor' || perfilEfetivo === 'conferente' || ehAdmin;

  // Alçada: espelha a regra do servidor (RF-GES-06 / RF-UPJ-05).
  const podeDesignarConferente = souGestor;
  const podeDesignarAnalista = souCoordenador || ehAdmin;
  const podeDesignarAlgo = podeDesignarConferente || podeDesignarAnalista;

  /**
   * Perfil base é provisão do admin (bootstrap do sistema).
   *
   * A especificação define quem designa Conferentes e Analistas, mas não diz
   * como o primeiro Gestor ou Coordenador passa a existir. Como o admin é a
   * única figura fora do fluxo operacional, é ele que provisiona esses perfis —
   * e sem isso a tela fica inutilizável, porque ninguém tem perfil para designar.
   */
  const podeProverPerfilBase = ehAdmin;

  const perfisDesignaveis = useMemo<PrioridadePerfil[]>(() => {
    const lista: PrioridadePerfil[] = [];
    if (podeDesignarConferente) lista.push('conferente');
    if (podeDesignarAnalista) lista.push('analista');
    return lista;
  }, [podeDesignarConferente, podeDesignarAnalista]);

  /** Perfis que o admin provisiona: definem o módulo, sem período. */
  const perfisBaseProvisionaveis = useMemo<PrioridadePerfil[]>(
    () => (podeProverPerfilBase ? ['gestor', 'coordenador', 'atendente'] : []),
    [podeProverPerfilBase]
  );

  const [modoNovo, setModoNovo] = useState<'designacao' | 'perfil_base'>('designacao');

  const [designacoes, setDesignacoes] = useState<DesignacaoListada[]>([]);
  const [perfisBase, setPerfisBase] = useState<PerfilBase[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Contagem de anotações por designado, para dimensionar a carga do round-robin.
  const [cargaPorUsuario, setCargaPorUsuario] = useState<Record<string, number>>({});

  // Formulário de inclusão
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<UsuarioElegivel[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionado, setSelecionado] = useState<UsuarioElegivel | null>(null);
  const [perfilNovo, setPerfilNovo] = useState<PrioridadePerfil>('conferente');
  const [inicio, setInicio] = useState(hojeIso());
  const [indeterminado, setIndeterminado] = useState(true);
  const [fim, setFim] = useState('');
  const [upjNova, setUpjNova] = useState('');
  const [salvando, setSalvando] = useState(false);

  /**
   * Mantém `perfilNovo` dentro da lista válida do modo ativo.
   *
   * DEFEITO CORRIGIDO: este efeito checava `perfilDesignaveis` sempre, sem olhar
   * o modo. No modo "Perfil base", escolher **Gestor** caía fora daquela lista
   * (`['conferente','analista']`) e o estado era silenciosamente forçado de volta
   * para 'conferente'. O `<select>` continuava exibindo "Gestor" — o valor vinha
   * de outra fonte no render —, mas o envio mandava 'conferente'. Resultado: o
   * admin escolhia perfil base e a pessoa recebia uma designação de Conferente.
   *
   * Agora a validação usa a lista do modo em uso.
   */
  const perfisDoModoAtual = modoNovo === 'perfil_base' ? perfisBaseProvisionaveis : perfisDesignaveis;

  useEffect(() => {
    if (perfisDoModoAtual.length === 0) return;
    if (!perfisDoModoAtual.includes(perfilNovo)) {
      setPerfilNovo(perfisDoModoAtual[0]);
    }
  }, [perfisDoModoAtual, perfilNovo]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [resDesignacoes, resAnotacoes, resPerfis] = await Promise.all([
        listarDesignacoes(),
        listarAnotacoes({ limite: 300 }),
        listarPerfisBase(),
      ]);

      if (!resDesignacoes.sucesso) {
        setErro(resDesignacoes.erro ?? 'Não foi possível carregar as designações.');
        setDesignacoes([]);
        return;
      }
      setDesignacoes(resDesignacoes.designacoes);
      setPerfisBase(resPerfis.perfis);

      // Carga por designado: anotações que aguardam conferência ou análise.
      const contagem: Record<string, number> = {};
      for (const a of resAnotacoes.anotacoes) {
        const alvo = a.status === 'gestor-conferencia' ? a.conferente_vinculado_id : a.analista_vinculado_id;
        if (alvo) contagem[alvo] = (contagem[alvo] ?? 0) + 1;
      }
      setCargaPorUsuario(contagem);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Busca com atraso para não disparar a cada tecla. A provisão de perfil base
  // também precisa buscar usuários.
  useEffect(() => {
    if (!podeDesignarAlgo && !podeProverPerfilBase) return;
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await buscarUsuariosElegiveis(termo, souCoordenador && !ehAdmin ? perfil?.upj_id ?? null : null);
        setResultados(r.usuarios);
        if (!r.sucesso && r.erro) setErro(r.erro);
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [termo, podeDesignarAlgo, podeProverPerfilBase, souCoordenador, ehAdmin, perfil?.upj_id]);

  const incluir = async () => {
    if (!selecionado) {
      setErro('Selecione o usuário.');
      return;
    }

    const ehPerfilBase = modoNovo === 'perfil_base';

    // Perfil base não tem período: é permanente e define o módulo.
    if (!ehPerfilBase) {
      if (!indeterminado && !fim) {
        setErro('Informe a data final ou marque "Indeterminado".');
        return;
      }
      if (!indeterminado && fim < inicio) {
        setErro('A data final não pode ser anterior à inicial.');
        return;
      }
    }
    if (perfilNovo === 'analista' && !upjNova && !perfil?.upj_id) {
      setErro('Informe a UPJ do Analista.');
      return;
    }
    if (perfilNovo === 'coordenador' && !upjNova && !perfil?.upj_id) {
      setErro('Informe a UPJ do Coordenador.');
      return;
    }

    setErro(null);
    setSalvando(true);
    try {
      const r = await designarUsuario({
        usuarioId: selecionado.usuario_id,
        perfil: perfilNovo,
        inicio: ehPerfilBase ? null : inicio,
        fim: ehPerfilBase || indeterminado ? null : fim,
        upjId:
          perfilNovo === 'analista' || perfilNovo === 'coordenador'
            ? upjNova || perfil?.upj_id || null
            : null,
      });

      if (!r.sucesso) {
        setErro(r.erro ?? 'Não foi possível concluir a operação.');
        return;
      }

      setAviso(
        ehPerfilBase
          ? `${selecionado.nome} agora tem perfil de ${PERFIL_LABEL[perfilNovo]} no app.`
          : `${selecionado.nome} designado como ${PERFIL_LABEL[perfilNovo]}${
              indeterminado ? ' por período indeterminado' : ` até ${formatarData(fim)}`
            }.`
      );
      setSelecionado(null);
      setTermo('');
      setResultados([]);
      setIndeterminado(true);
      setFim('');
      await Promise.all([carregar(), onAtualizar()]);
    } finally {
      setSalvando(false);
    }
  };

  const removerPerfilBase = async (p: PerfilBase) => {
    setErro(null);
    const r = await removerPerfil(p.usuario_id);
    if (!r.sucesso) {
      setErro(r.erro ?? 'Não foi possível remover o perfil.');
      return;
    }
    setAviso(`Perfil de ${p.usuario_nome ?? 'usuário'} removido.`);
    await Promise.all([carregar(), onAtualizar()]);
  };

  const encerrar = async (d: DesignacaoListada) => {
    setErro(null);
    const r = await encerrarDesignacao(d.id);
    if (!r.sucesso) {
      setErro(r.erro ?? 'Não foi possível encerrar a designação.');
      return;
    }
    setAviso(`Designação de ${d.usuario_nome ?? 'usuário'} encerrada.`);
    await Promise.all([carregar(), onAtualizar()]);
  };

  const alternarVinculacao = async (d: DesignacaoListada, valor: boolean) => {
    setErro(null);
    // Atualização otimista: o checkbox responde na hora e o estado real é
    // reconfirmado pela recarga logo abaixo.
    setVinculacaoPorUsuario((prev) => ({ ...prev, [d.usuario_id]: valor }));

    const r = await alternarVinculacaoAutomatica(d.usuario_id, valor);
    if (!r.sucesso) {
      setErro(r.erro ?? 'Não foi possível alterar a vinculação automática.');
      setVinculacaoPorUsuario((prev) => ({ ...prev, [d.usuario_id]: !valor }));
      return;
    }
    await onAtualizar();
  };

  /**
   * Vinculação automática vive no perfil base, não na designação — por isso o
   * estado exibido vem de uma consulta aos perfis e é recarregado quando a lista
   * de designações muda.
   */
  const [vinculacaoPorUsuario, setVinculacaoPorUsuario] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void listarPerfisComVinculacao().then(setVinculacaoPorUsuario);
  }, [designacoes.length]);

  const nomeUpj = useCallback(
    (id: string | null) => {
      if (!id) return '—';
      const u = upjs.find((x) => x.id === id);
      return u ? `${u.codigo} — ${u.nome}` : '—';
    },
    [upjs]
  );

  const ativas = designacoes.filter((d) => d.ativa && (!d.fim_em || d.fim_em >= hojeIso()));
  const encerradas = designacoes.filter((d) => !ativas.includes(d));

  const conferentes = ativas.filter((d) => d.perfil === 'conferente');
  const analistas = ativas.filter((d) => d.perfil === 'analista');

  const tabela = (titulo: string, linhas: DesignacaoListada[], colunaUpj: boolean) => (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {titulo}
      </h3>
      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          Nenhum registro.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Nome</th>
                {colunaUpj && (
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">UPJ</th>
                )}
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Período</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Na fila</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                  Vinculação automática
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {linhas.map((d) => (
                <tr key={d.id}>
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-100">
                    {d.usuario_nome ?? d.usuario_id}
                    {d.usuario_email && (
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{d.usuario_email}</span>
                    )}
                  </td>
                  {colunaUpj && (
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{nomeUpj(d.upj_id)}</td>
                  )}
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                    {formatarData(d.inicio_em)} — {formatarData(d.fim_em)}
                    {!d.fim_em && (
                      <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                        Indeterminado
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                    {cargaPorUsuario[d.usuario_id] ?? 0}
                  </td>
                  <td className="px-3 py-2">
                    <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={vinculacaoPorUsuario[d.usuario_id] ?? true}
                        onChange={(e) => void alternarVinculacao(d, e.target.checked)}
                        className="h-4 w-4"
                      />
                      {vinculacaoPorUsuario[d.usuario_id] ?? true ? 'Habilitada' : 'Desabilitada'}
                    </label>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void encerrar(d)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      Encerrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Designações</h2>
        <button type="button" onClick={onVoltar} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          Voltar ao painel
        </button>
      </div>

      {erro && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {erro}
        </div>
      )}
      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} className="font-bold">
            ×
          </button>
        </div>
      )}

      {/* ── Inclusão ─────────────────────────────────────────── */}
      {podeDesignarAlgo || podeProverPerfilBase ? (
        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {modoNovo === 'perfil_base'
                ? 'Definir Perfil Base'
                : perfisDesignaveis.length > 1
                  ? 'Incluir Designação'
                  : `Designar Novo ${perfilNovo === 'analista' ? 'Analista' : 'Conferente'}`}
            </h3>

            {/*
              Duas operações distintas, expostas como tal: PERFIL BASE é
              permanente e define o módulo (provisão do admin); DESIGNAÇÃO tem
              período. Confundir as duas foi o que travou o fluxo — sem perfil
              base de Gestor, ninguém tem alçada para designar.
            */}
            {podeProverPerfilBase && podeDesignarAlgo && (
              <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                {(
                  [
                    ['designacao', 'Designação (com período)'],
                    ['perfil_base', 'Perfil base (permanente)'],
                  ] as Array<['designacao' | 'perfil_base', string]>
                ).map(([valor, label]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => {
                      setModoNovo(valor);
                      setSelecionado(null);
                      setTermo('');
                      setResultados([]);
                      setErro(null);
                    }}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      modoNovo === valor
                        ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-300'
                        : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {modoNovo === 'perfil_base' && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
              O perfil base é <strong>permanente</strong> e define qual módulo a pessoa vê. É por aqui que o
              primeiro <strong>Gestor</strong> e o primeiro <strong>Coordenador da UPJ</strong> passam a existir —
              sem eles ninguém tem alçada para designar Conferentes ou Analistas.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="des-busca" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Buscar usuário {souCoordenador && !ehAdmin && '(restrito à sua UPJ)'}
              </label>
              <input
                id="des-busca"
                type="text"
                value={termo}
                onChange={(e) => {
                  setTermo(e.target.value);
                  setSelecionado(null);
                }}
                placeholder="Nome ou e-mail"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              {buscando && <p className="mt-1 text-xs text-gray-500">Buscando…</p>}

              {/*
                A lista é limitada em altura com rolagem própria. Sem o
                `overflow-y-auto` combinado ao `max-h`, a lista era cortada pelo
                container e sobrepunha o campo seguinte.
              */}
              {resultados.length > 0 && !selecionado && (
                <ul
                  className="mt-2 max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800"
                  role="listbox"
                >
                  {resultados.map((u) => (
                    <li key={u.usuario_id}>
                      <button
                        type="button"
                        onClick={() => setSelecionado(u)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <span>
                          <span className="text-gray-800 dark:text-gray-100">{u.nome}</span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">{u.email}</span>
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {u.perfil_atual ? PERFIL_LABEL[u.perfil_atual] : 'sem perfil'}
                          {u.ja_designado && ' · já designado'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {selecionado && (
                <div className="mt-2 flex items-center justify-between rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm dark:border-blue-700 dark:bg-blue-900/20">
                  <span className="text-blue-900 dark:text-blue-100">
                    <strong>{selecionado.nome}</strong> · {selecionado.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelecionado(null)}
                    className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
                  >
                    trocar
                  </button>
                </div>
              )}
            </div>

            {perfisDoModoAtual.length > 1 && (
              <div>
                <label htmlFor="des-perfil" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Perfil
                </label>
                <select
                  id="des-perfil"
                  value={perfilNovo}
                  onChange={(e) => setPerfilNovo(e.target.value as PrioridadePerfil)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
                  {perfisDoModoAtual.map((p) => (
                    <option key={p} value={p}>
                      {PERFIL_LABEL[p]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(perfilNovo === 'analista' || perfilNovo === 'coordenador') && (
              <div>
                <label htmlFor="des-upj" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  UPJ do {perfilNovo === 'analista' ? 'Analista' : 'Coordenador'}{' '}
                  <span className="text-red-600">*</span>
                </label>
                <select
                  id="des-upj"
                  value={upjNova || perfil?.upj_id || ''}
                  onChange={(e) => setUpjNova(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="">Selecione…</option>
                  {upjs.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.codigo} — {u.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Período só existe para designação; perfil base é permanente. */}
            {modoNovo === 'designacao' && (
              <>
                <div>
                  <label htmlFor="des-inicio" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Início
                  </label>
                  <input
                    id="des-inicio"
                    type="date"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>

                <div>
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Término</span>
                  <label className="mt-1 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={indeterminado}
                      onChange={(e) => setIndeterminado(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Indeterminado
                  </label>
                  {!indeterminado && (
                    <input
                      type="date"
                      value={fim}
                      min={inicio}
                      onChange={(e) => setFim(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void incluir()}
              disabled={salvando || !selecionado}
              className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {salvando ? 'Salvando…' : modoNovo === 'perfil_base' ? 'Definir Perfil' : 'Incluir Designação'}
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {modoNovo === 'perfil_base'
              ? 'O perfil base é permanente e substitui o perfil anterior do usuário (exceto quando ele já é Gestor ou Coordenador, que são preservados). É ele que define qual módulo a pessoa vê ao abrir o app.'
              : 'Ao incluir, o sistema cria o perfil do usuário no app e registra a designação. Enquanto a designação estiver em vigor, o designado opera a fila correspondente ao seu perfil.'}
          </p>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
          Sua conta não tem alçada para incluir designações. O Gestor do TJSP Atende designa Conferentes; o
          Coordenador da UPJ designa Analistas.
        </p>
      )}

      {/* ── Listas ───────────────────────────────────────────── */}
      {carregando ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando designações…</p>
      ) : (
        <>
          {tabela(
            `Conferentes Designados (${conferentes.length})`,
            conferentes,
            false
          )}
          {tabela(`Analistas Designados (${analistas.length})`, analistas, true)}

          {encerradas.length > 0 && (
            <details className="rounded-lg border border-gray-200 dark:border-gray-700">
              <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                Designações encerradas ({encerradas.length})
              </summary>
              <div className="border-t border-gray-200 p-3 dark:border-gray-700">
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  {encerradas.map((d) => (
                    <li key={d.id}>
                      {d.usuario_nome ?? d.usuario_id} · {PERFIL_LABEL[d.perfil]} · {formatarData(d.inicio_em)} —{' '}
                      {formatarData(d.fim_em)}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Novas anotações são vinculadas de forma cíclica e equânime entre os designados habilitados
            (round-robin). O Gestor/Coordenador pode assumir uma anotação vinculada a um designado; o inverso não é
            permitido. "Na fila" mostra quantas anotações aguardam ação de cada designado.
          </p>

          {/*
            Perfis base: a camada que faz o sistema existir. Sem nenhum Gestor
            aqui, a fila de conferência não tem para quem distribuir e ninguém
            tem alçada para designar.
          */}
          {podeProverPerfilBase && (
            <section className="mt-2">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Perfis base no app ({perfisBase.length})
              </h3>
              {perfisBase.length === 0 ? (
                <p className="rounded-lg border border-dashed border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                  Nenhum perfil cadastrado. Enquanto não houver ao menos um <strong>Gestor</strong> e um{' '}
                  <strong>Coordenador da UPJ</strong>, a distribuição de anotações não tem para quem encaminhar.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Nome</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                          Perfil base
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">UPJ</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                      {perfisBase.map((p) => (
                        <tr key={p.usuario_id}>
                          <td className="px-3 py-2 text-gray-800 dark:text-gray-100">
                            {p.usuario_nome ?? p.usuario_id}
                            {p.usuario_email && (
                              <span className="block text-xs text-gray-500 dark:text-gray-400">
                                {p.usuario_email}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                            {PERFIL_LABEL[p.perfil]}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{nomeUpj(p.upj_id)}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void removerPerfilBase(p)}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-red-900/30"
                            >
                              Remover perfil
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                A remoção é recusada quando o usuário tem anotação em andamento vinculada — a integridade dos
                registros vem antes da conveniência administrativa.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
};

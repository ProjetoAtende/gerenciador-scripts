/**
 * Designações no visual da v2.
 *
 * Regras e chamadas da v1 (`prioridades/DesignacoesTela.tsx`), mais o item B da etapa 2:
 *  - Gestor designa Conferentes; Coordenador da UPJ designa Analistas (só da sua UPJ);
 *  - o admin provisiona o PERFIL BASE (permanente) de Gestor, Coordenador e Atendente;
 *  - vinculação automática (round-robin) por pessoa; categorias habilitadas por Analista.
 * Inclui a correção da v1 que mantém o perfil escolhido coerente com o modo
 * (designação × perfil base).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  alternarVinculacaoAutomatica,
  atualizarCategoriasHabilitadas,
  buscarUsuariosElegiveis,
  encerrarDesignacao,
  listarAnotacoes,
  listarCategoriasHabilitadas,
  listarDesignacoes,
  listarPerfisBase,
  listarPerfisComVinculacao,
  removerPerfil,
} from '../../services/prioridadesService';
import { designarUsuarioV2 } from '../../services/prioridadesV2Service';
import type { DesignacaoListada, PerfilBase, PerfilUsuarioPrioridades, PrioridadePerfil, Upj, UsuarioElegivel } from '../../types/Prioridades';
import { CATEGORIAS_ANOTACAO, CODIGOS_CATEGORIA } from '../prioridades/prioridadesCategorias';
import { Icone } from './Icone';
import { PERFIL_CURTO, faixaVaras, upjCurta } from './prioridadesV2Rotulos';

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

const Pessoa: React.FC<{ nome: string | null; email: string | null; id: string }> = ({ nome, email, id }) => (
  <>
    <strong>{nome ?? id}</strong>
    {email && <div className="pu2-ajuda">{email}</div>}
  </>
);

/** Interruptor "Habilitada / Desabilitada" (vinculação automática). */
const Interruptor: React.FC<{ ligado: boolean; onChange: (v: boolean) => void; rotulo: string }> = ({ ligado, onChange, rotulo }) => (
  <label className="pu2-interruptor" title={rotulo}>
    <input type="checkbox" checked={ligado} onChange={(e) => onChange(e.target.checked)} aria-label={rotulo} />
    <span className="trilho" aria-hidden />
    <span>{ligado ? 'Habilitada' : 'Desabilitada'}</span>
  </label>
);

export const DesignacoesV2: React.FC<Props> = ({ perfilEfetivo, perfil, ehAdmin, upjs, onVoltar, onAtualizar }) => {
  const souCoordenador = perfilEfetivo === 'coordenador';
  const coordenadorRestrito = souCoordenador && !ehAdmin;
  const souGestor = perfilEfetivo === 'gestor' || perfilEfetivo === 'conferente' || ehAdmin;

  const podeDesignarConferente = souGestor;
  const podeDesignarAnalista = souCoordenador || ehAdmin;
  const podeDesignarAlgo = podeDesignarConferente || podeDesignarAnalista;
  const podeProverPerfilBase = ehAdmin;
  // Etapa 2 (item B, confirmado pelo Celso): o Coordenador designa Analistas da própria UPJ.
  // A trava da UPJ está no servidor (prioridades_v2_designar), não só na tela.
  const podeIncluir = podeDesignarAlgo || podeProverPerfilBase;

  const perfisDesignaveis = useMemo<PrioridadePerfil[]>(() => {
    const lista: PrioridadePerfil[] = [];
    if (podeDesignarConferente) lista.push('conferente');
    if (podeDesignarAnalista) lista.push('analista');
    return lista;
  }, [podeDesignarConferente, podeDesignarAnalista]);

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
  const [cargaPorUsuario, setCargaPorUsuario] = useState<Record<string, number>>({});

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

  const [vinculacaoPorUsuario, setVinculacaoPorUsuario] = useState<Record<string, boolean>>({});
  const [categoriasPorUsuario, setCategoriasPorUsuario] = useState<Record<string, string[]>>({});

  // Mantém o perfil escolhido dentro da lista do MODO em uso (defeito corrigido na v1).
  const perfisDoModoAtual = modoNovo === 'perfil_base' ? perfisBaseProvisionaveis : perfisDesignaveis;
  useEffect(() => {
    if (perfisDoModoAtual.length === 0) return;
    if (!perfisDoModoAtual.includes(perfilNovo)) setPerfilNovo(perfisDoModoAtual[0]);
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

  useEffect(() => {
    void listarPerfisComVinculacao().then(setVinculacaoPorUsuario);
    void listarCategoriasHabilitadas().then((mapa) => {
      const normalizado: Record<string, string[]> = {};
      for (const [uid, cats] of Object.entries(mapa)) normalizado[uid] = cats.length > 0 ? cats : [...CODIGOS_CATEGORIA];
      setCategoriasPorUsuario(normalizado);
    });
  }, [designacoes.length]);

  // Busca com atraso, para não consultar a cada tecla.
  useEffect(() => {
    if (!podeDesignarAlgo && !podeProverPerfilBase) return;
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await buscarUsuariosElegiveis(termo, coordenadorRestrito ? perfil?.upj_id ?? null : null);
        setResultados(r.usuarios);
        if (!r.sucesso && r.erro) setErro(r.erro);
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [termo, podeDesignarAlgo, podeProverPerfilBase, coordenadorRestrito, perfil?.upj_id]);

  const limparFormulario = () => {
    setSelecionado(null);
    setTermo('');
    setResultados([]);
    setIndeterminado(true);
    setFim('');
  };

  const incluir = async () => {
    if (!selecionado) {
      setErro('Escolha a pessoa na lista.');
      return;
    }
    const ehPerfilBase = modoNovo === 'perfil_base';
    if (!ehPerfilBase) {
      if (!indeterminado && !fim) {
        setErro('Informe a data final ou marque "Sem data para terminar".');
        return;
      }
      if (!indeterminado && fim < inicio) {
        setErro('A data final não pode ser anterior à inicial.');
        return;
      }
    }
    if ((perfilNovo === 'analista' || perfilNovo === 'coordenador') && !upjNova && !perfil?.upj_id) {
      setErro(`Escolha a UPJ do ${perfilNovo === 'analista' ? 'Analista' : 'Coordenador'}.`);
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      const r = await designarUsuarioV2({
        usuarioId: selecionado.usuario_id,
        perfil: perfilNovo,
        inicio: ehPerfilBase ? null : inicio,
        fim: ehPerfilBase || indeterminado ? null : fim,
        upjId: perfilNovo === 'analista' || perfilNovo === 'coordenador' ? upjNova || perfil?.upj_id || null : null,
      });
      if (!r.sucesso) {
        setErro(r.erro ?? 'Não foi possível concluir a operação.');
        return;
      }
      setAviso(
        ehPerfilBase
          ? `${selecionado.nome} agora tem o perfil de ${PERFIL_CURTO[perfilNovo]} no app.`
          : `${selecionado.nome} designado(a) como ${PERFIL_CURTO[perfilNovo]}${indeterminado ? ', sem data para terminar' : ` até ${formatarData(fim)}`}.`
      );
      limparFormulario();
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

  const alternarVinculacao = async (usuarioId: string, valor: boolean) => {
    setErro(null);
    setVinculacaoPorUsuario((prev) => ({ ...prev, [usuarioId]: valor }));
    const r = await alternarVinculacaoAutomatica(usuarioId, valor);
    if (!r.sucesso) {
      setErro(r.erro ?? 'Não foi possível alterar a vinculação automática.');
      setVinculacaoPorUsuario((prev) => ({ ...prev, [usuarioId]: !valor }));
      return;
    }
    await onAtualizar();
  };

  const alternarCategoria = async (usuarioId: string, codigo: string, marcado: boolean) => {
    const atual = categoriasPorUsuario[usuarioId] ?? [...CODIGOS_CATEGORIA];
    const proximo = marcado ? [...new Set([...atual, codigo])] : atual.filter((c) => c !== codigo);
    setCategoriasPorUsuario((prev) => ({ ...prev, [usuarioId]: proximo }));
    const r = await atualizarCategoriasHabilitadas(usuarioId, proximo);
    if (!r.sucesso) {
      setErro(r.erro ?? 'Não foi possível salvar as categorias.');
      setCategoriasPorUsuario((prev) => ({ ...prev, [usuarioId]: atual }));
    }
  };

  const upjPorId = useMemo(() => new Map(upjs.map((u) => [u.id, u])), [upjs]);
  const nomeUpj = (id: string | null) => (id && upjPorId.get(id) ? upjCurta(upjPorId.get(id)) : '—');

  const ativas = designacoes.filter((d) => d.ativa && (!d.fim_em || d.fim_em >= hojeIso()));
  const encerradas = designacoes.filter((d) => !ativas.includes(d));
  const conferentes = ativas.filter((d) => d.perfil === 'conferente');
  const analistas = ativas.filter((d) => d.perfil === 'analista' && (!coordenadorRestrito || d.upj_id === perfil?.upj_id));
  const gestores = perfisBase.filter((p) => p.perfil === 'gestor');

  const tabelaDesignados = (titulo: string, icone: 'designacoes' | 'ag-conferencia', linhas: DesignacaoListada[], modo: 'conferente' | 'analista') => (
    <section className="pu2-secao">
      <h3 className="pu2-secao-rotulo pu2-com-icone-rotulo">
        <Icone nome={icone} tamanho={18} />
        {titulo} ({linhas.length})
      </h3>
      {linhas.length === 0 ? (
        <div className="pu2-vazio">Nenhuma pessoa designada.</div>
      ) : (
        <div className="pu2-tabela-moldura">
          <table className="pu2-tabela">
            <thead>
              <tr>
                <th>Nome</th>
                {modo === 'analista' && <th>UPJ</th>}
                <th>Período</th>
                <th title="Anotações que aguardam ação desta pessoa">Na fila</th>
                <th>{modo === 'conferente' ? 'Vinculação automática' : 'Categorias que atende'}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {linhas.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Pessoa nome={d.usuario_nome} email={d.usuario_email} id={d.usuario_id} />
                  </td>
                  {modo === 'analista' && <td>{nomeUpj(d.upj_id)}</td>}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatarData(d.inicio_em)} a {d.fim_em ? formatarData(d.fim_em) : <span className="pu2-pilula">Indeterminado</span>}
                  </td>
                  <td className="pu2-numero-centro">{cargaPorUsuario[d.usuario_id] ?? 0}</td>
                  <td>
                    {modo === 'conferente' ? (
                      <Interruptor
                        ligado={vinculacaoPorUsuario[d.usuario_id] ?? true}
                        onChange={(v) => void alternarVinculacao(d.usuario_id, v)}
                        rotulo={`Vinculação automática de ${d.usuario_nome ?? 'usuário'}`}
                      />
                    ) : (
                      <div className="pu2-categorias-mini">
                        {CATEGORIAS_ANOTACAO.map((cat) => {
                          const marcado = (categoriasPorUsuario[d.usuario_id] ?? CODIGOS_CATEGORIA).includes(cat.codigo);
                          return (
                            <label key={cat.codigo} title={cat.dica} className={marcado ? 'marcada' : ''}>
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={(e) => void alternarCategoria(d.usuario_id, cat.codigo, e.target.checked)}
                              />
                              {cat.label}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="pu2-botao pu2-botao-pequeno" onClick={() => void encerrar(d)}>
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

  const tituloFormulario =
    modoNovo === 'perfil_base'
      ? 'Definir perfil permanente'
      : perfisDesignaveis.length > 1
        ? 'Nova designação'
        : `Designar ${perfilNovo === 'analista' ? 'Analista' : 'Conferente'}`;

  return (
    <div>
      <div className="pu2-titulo-tela">
        <h2>
          <Icone nome="designacoes" tamanho="0.9em" />
          Designações
        </h2>
        <button type="button" className="pu2-botao pu2-botao-link" onClick={onVoltar}>
          <Icone nome="voltar" tamanho={14} />
          Voltar
        </button>
      </div>

      {erro && (
        <div className="pu2-caixa pu2-caixa-erro" role="alert">
          {erro}
        </div>
      )}
      {aviso && (
        <div className="pu2-caixa pu2-caixa-sucesso pu2-retorno" role="status">
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      )}

      {/* ── Inclusão ───────────────────────────────────────────── */}
      {podeIncluir ? (
        <section className="pu2-secao">
          <div className="pu2-secao-cabecalho">
            <h3 className="pu2-secao-rotulo">{tituloFormulario}</h3>
            {podeProverPerfilBase && podeDesignarAlgo && (
              <div className="pu2-alternador" role="tablist" aria-label="Tipo de inclusão">
                {(
                  [
                    ['designacao', 'Designação (com período)'],
                    ['perfil_base', 'Perfil permanente'],
                  ] as const
                ).map(([valor, rotulo]) => (
                  <button
                    key={valor}
                    type="button"
                    role="tab"
                    aria-selected={modoNovo === valor}
                    className={modoNovo === valor ? 'ativo' : ''}
                    onClick={() => {
                      setModoNovo(valor);
                      limparFormulario();
                      setErro(null);
                    }}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pu2-bloco pu2-bloco-esquerda">
            {modoNovo === 'perfil_base' && (
              <p className="pu2-ajuda" style={{ margin: 0 }}>
                O perfil permanente define o que a pessoa vê ao abrir o app. É por aqui que passam a existir o primeiro{' '}
                <strong>Gestor</strong> e o primeiro <strong>Coordenador da UPJ</strong>; sem eles, ninguém pode designar Conferentes ou
                Analistas.
              </p>
            )}

            <div className="pu2-campo" style={{ marginBottom: 0 }}>
              <label htmlFor="pu2-des-busca" className="pu2-rotulo">
                Pessoa {coordenadorRestrito && <span className="nota">(só da sua UPJ)</span>}
              </label>
              {selecionado ? (
                <div className="pu2-escolhido">
                  <span>
                    <strong>{selecionado.nome}</strong> · {selecionado.email}
                  </span>
                  <button type="button" className="pu2-botao pu2-botao-link" onClick={() => setSelecionado(null)}>
                    Trocar
                  </button>
                </div>
              ) : (
                <>
                  <input
                    id="pu2-des-busca"
                    className="pu2-entrada"
                    type="search"
                    value={termo}
                    onChange={(e) => setTermo(e.target.value)}
                    placeholder="Digite o nome ou o e-mail"
                    autoComplete="off"
                  />
                  {buscando && <p className="pu2-ajuda">Buscando…</p>}
                  {resultados.length > 0 && (
                    <ul className="pu2-resultados" role="listbox" aria-label="Pessoas encontradas">
                      {resultados.map((u) => (
                        <li key={u.usuario_id}>
                          <button type="button" role="option" aria-selected={false} onClick={() => setSelecionado(u)}>
                            <span>
                              <strong>{u.nome}</strong>
                              <span className="pu2-ajuda" style={{ display: 'block', margin: 0 }}>
                                {u.email}
                              </span>
                            </span>
                            <span className="pu2-ajuda" style={{ margin: 0 }}>
                              {u.perfil_atual ? PERFIL_CURTO[u.perfil_atual] : 'sem perfil'}
                              {u.ja_designado && ' · já designado(a)'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="pu2-linha-campos">
              {perfisDoModoAtual.length > 1 && (
                <div className="pu2-campo">
                  <label htmlFor="pu2-des-perfil" className="pu2-rotulo">
                    Perfil
                  </label>
                  <select
                    id="pu2-des-perfil"
                    className="pu2-selecao"
                    value={perfilNovo}
                    onChange={(e) => setPerfilNovo(e.target.value as PrioridadePerfil)}
                  >
                    {perfisDoModoAtual.map((p) => (
                      <option key={p} value={p}>
                        {PERFIL_CURTO[p]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(perfilNovo === 'analista' || perfilNovo === 'coordenador') && (
                <div className="pu2-campo">
                  <label htmlFor="pu2-des-upj" className="pu2-rotulo">
                    UPJ <span className="obrigatorio">*</span>
                  </label>
                  <select
                    id="pu2-des-upj"
                    className="pu2-selecao"
                    value={upjNova || perfil?.upj_id || ''}
                    onChange={(e) => setUpjNova(e.target.value)}
                    disabled={coordenadorRestrito}
                  >
                    <option value="">Selecione…</option>
                    {upjs.map((u) => (
                      <option key={u.id} value={u.id}>
                        {upjCurta(u)} {faixaVaras(u) ? `(${faixaVaras(u)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modoNovo === 'designacao' && (
                <>
                  <div className="pu2-campo">
                    <label htmlFor="pu2-des-inicio" className="pu2-rotulo">
                      Início
                    </label>
                    <input id="pu2-des-inicio" className="pu2-entrada" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                  </div>
                  <div className="pu2-campo">
                    <label htmlFor="pu2-des-fim" className="pu2-rotulo">
                      Término
                    </label>
                    {indeterminado ? (
                      <div className="pu2-entrada pu2-entrada-fixa">Sem data para terminar</div>
                    ) : (
                      <input id="pu2-des-fim" className="pu2-entrada" type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} />
                    )}
                    <label className="pu2-marcacao" style={{ marginBottom: 0 }}>
                      <input type="checkbox" checked={indeterminado} onChange={(e) => setIndeterminado(e.target.checked)} />
                      Sem data para terminar
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="pu2-acoes" style={{ marginTop: 0 }}>
              <span className="pu2-acoes-nota">
                {modoNovo === 'perfil_base'
                  ? 'Substitui o perfil anterior (Gestor e Coordenador são preservados).'
                  : 'A pessoa passa a atender a fila do seu perfil enquanto a designação valer.'}
              </span>
              <button type="button" className="pu2-botao pu2-botao-primario" onClick={() => void incluir()} disabled={salvando || !selecionado}>
                {salvando ? 'Salvando…' : modoNovo === 'perfil_base' ? 'Definir perfil' : 'Incluir designação'}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div className="pu2-vazio" style={{ marginBottom: 22 }}>
          Sua conta não pode incluir designações. O Gestor do TJSP Atende designa Conferentes; o Coordenador da UPJ designa Analistas.
        </div>
      )}

      {/* ── Listas ─────────────────────────────────────────────── */}
      {carregando ? (
        <p className="pu2-carregando">Carregando designações…</p>
      ) : (
        <>
          {!coordenadorRestrito && (perfilEfetivo === 'gestor' || ehAdmin) && (
            <>
              {gestores.length > 0 && (
                <section className="pu2-secao">
                  <h3 className="pu2-secao-rotulo pu2-com-icone-rotulo">
                    <Icone nome="designacoes" tamanho={18} />
                    Gestores ({gestores.length})
                  </h3>
                  <div className="pu2-tabela-moldura">
                    <table className="pu2-tabela">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Vinculação automática</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gestores.map((g) => (
                          <tr key={g.usuario_id}>
                            <td>
                              <Pessoa nome={g.usuario_nome} email={g.usuario_email} id={g.usuario_id} />
                            </td>
                            <td>
                              <Interruptor
                                ligado={vinculacaoPorUsuario[g.usuario_id] ?? g.vinculacao_automatica}
                                onChange={(v) => void alternarVinculacao(g.usuario_id, v)}
                                rotulo={`Vinculação automática de ${g.usuario_nome ?? 'usuário'}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {tabelaDesignados('Conferentes', 'ag-conferencia', conferentes, 'conferente')}
            </>
          )}

          {(podeDesignarAnalista || coordenadorRestrito) && tabelaDesignados('Analistas', 'designacoes', analistas, 'analista')}

          <p className="pu2-ajuda" style={{ margin: '-6px 0 22px' }}>
            As anotações novas são distribuídas em rodízio entre as pessoas com vinculação habilitada. "Na fila" mostra quantas aguardam
            ação de cada uma.
          </p>

          {!coordenadorRestrito && encerradas.length > 0 && (
            <details className="pu2-historico" style={{ marginBottom: 22 }}>
              <summary>
                <Icone nome="historico" tamanho={18} />
                Designações encerradas ({encerradas.length})
              </summary>
              <ul className="pu2-lista-simples" style={{ marginTop: 10 }}>
                {encerradas.map((d) => (
                  <li key={d.id}>
                    <span>
                      <strong>{d.usuario_nome ?? d.usuario_id}</strong> · {PERFIL_CURTO[d.perfil]}
                    </span>
                    <span className="pu2-ajuda" style={{ margin: 0 }}>
                      {formatarData(d.inicio_em)} a {formatarData(d.fim_em)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {!coordenadorRestrito && podeProverPerfilBase && (
            <section className="pu2-secao">
              <h3 className="pu2-secao-rotulo pu2-com-icone-rotulo">
                <Icone nome="configuracoes" tamanho={18} />
                Perfis permanentes no app ({perfisBase.length})
              </h3>
              {perfisBase.length === 0 ? (
                <div className="pu2-caixa pu2-caixa-aviso">
                  Nenhum perfil cadastrado. Sem ao menos um <strong>Gestor</strong> e um <strong>Coordenador da UPJ</strong>, as anotações não
                  têm para quem ser encaminhadas.
                </div>
              ) : (
                <div className="pu2-tabela-moldura">
                  <table className="pu2-tabela">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Perfil</th>
                        <th>UPJ</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {perfisBase.map((p) => (
                        <tr key={p.usuario_id}>
                          <td>
                            <Pessoa nome={p.usuario_nome} email={p.usuario_email} id={p.usuario_id} />
                          </td>
                          <td>{PERFIL_CURTO[p.perfil]}</td>
                          <td>{nomeUpj(p.upj_id)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button type="button" className="pu2-botao pu2-botao-pequeno" onClick={() => void removerPerfilBase(p)}>
                              Remover perfil
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="pu2-ajuda">Não é possível remover o perfil de quem tem anotação em andamento vinculada.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
};

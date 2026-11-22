/**
 * App "Prioridades e Urgências" — VERSÃO NOVA (v2), em teste.
 *
 * Convive com a v1 (`components/prioridades/`), que segue intacta como backup.
 * As duas usam o mesmo banco e as mesmas funções do servidor: a v2 muda a
 * apresentação. Telas ainda não redesenhadas são exibidas com o visual da v1
 * dentro desta moldura, para o app continuar completo durante os testes.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import './prioridadesV2.css';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissoes } from '../../contexts/PermissoesContext';
import {
  listarAnotacoes,
  listarTiposPrioridade,
  listarTiposSolicitante,
  marcarEmAnalise,
  registrarAcessoPrivilegiado,
} from '../../services/prioridadesService';
import type { AnotacaoPrioridade } from '../../types/Prioridades';
import { PrioridadesContent } from '../prioridades/PrioridadesContent';
import { anotacaoNaLista, type ChaveLista } from '../prioridades/prioridadesListas';
import { DetalheAnotacaoV2, type ModoDetalhe } from './DetalheAnotacaoV2';
import { Icone } from './Icone';
import type { NomeIcone } from './icones';
import { ListaAnotacoesV2 } from './ListaAnotacoesV2';
import { ehPerfilGestao, ehPerfilUpj } from './prioridadesV2Rotulos';
import { NovaAnotacaoV2 } from './NovaAnotacaoV2';
import { PainelLateralV2 } from './PainelLateralV2';
import { TelaInicialV2 } from './TelaInicialV2';
import { limparPrioridadesV2Sessao, recarregarPrioridadesV2 } from './prioridadesV2Sessao';
import { usePrioridadesV2 } from './usePrioridadesV2';
import fundo from './assets/fundo-painel.png';
import logo from './assets/logo-prioridades.png';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const LISTAS: Record<ChaveLista, { titulo: string; icone: NomeIcone }> = {
  'ag-conferencia': { titulo: 'Ag. Conferência', icone: 'ag-conferencia' },
  devolvidas: { titulo: 'Devolvidas', icone: 'devolvidas' },
  aprovadas: { titulo: 'Aprovadas', icone: 'aprovadas' },
  reprovadas: { titulo: 'Reprovadas', icone: 'reprovadas' },
  urgentissimas: { titulo: 'Urgentíssimas', icone: 'urgentissimas' },
  reiteradas: { titulo: 'Reiteradas', icone: 'reiteradas' },
  retornadas: { titulo: 'Retornadas', icone: 'retornadas' },
  novas: { titulo: 'Novas', icone: 'novas' },
  'em-analise': { titulo: 'Em Análise', icone: 'em-analise' },
  resolvidas: { titulo: 'Resolvidas', icone: 'resolvidas' },
  rejeitadas: { titulo: 'Rejeitadas', icone: 'rejeitadas' },
};

const PrioridadesV2Modal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { isAdmin } = usePermissoes();
  const { user } = useAuth();
  const estado = usePrioridadesV2(isOpen);
  const [recolhido, setRecolhido] = useState(false);
  const [retorno, setRetorno] = useState<string | null>(null);
  const [anotacoes, setAnotacoes] = useState<AnotacaoPrioridade[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [rotulos, setRotulos] = useState<{ tipos: Map<string, string>; solicitantes: Map<string, string> }>({
    tipos: new Map(),
    solicitantes: new Map(),
  });

  const { tela, irPara, atualizar, perfilEfetivo, perfil } = estado;

  const carregarAnotacoes = useCallback(async () => {
    setCarregandoLista(true);
    try {
      const { anotacoes: lista } = await listarAnotacoes({ limite: 200 });
      setAnotacoes(lista);
    } finally {
      setCarregandoLista(false);
    }
  }, []);

  // Catálogos (rótulos de tipo e de solicitante), uma vez por abertura.
  useEffect(() => {
    if (!isOpen) return;
    void Promise.all([listarTiposPrioridade(), listarTiposSolicitante()]).then(([tp, ts]) =>
      setRotulos({
        tipos: new Map(tp.map((t) => [t.codigo, t.label])),
        solicitantes: new Map(ts.map((t) => [t.codigo, t.label])),
      })
    );
  }, [isOpen]);

  // "Voltar" no detalhe leva à lista de onde a anotação foi aberta.
  const [ultimaLista, setUltimaLista] = useState<string | null>(null);
  useEffect(() => {
    if (tela.tipo === 'lista') setUltimaLista(tela.grupo);
    else if (tela.tipo !== 'detalhe') setUltimaLista(null);
  }, [tela]);

  // Recarrega as anotações ao entrar numa lista ou num detalhe (mesmo critério da v1).
  useEffect(() => {
    if (!isOpen) return;
    if (tela.tipo === 'lista' || tela.tipo === 'detalhe') void carregarAnotacoes();
  }, [isOpen, tela, carregarAnotacoes]);

  const rotuloTipo = useCallback((c: string) => rotulos.tipos.get(c) ?? c, [rotulos]);
  const rotuloSolicitante = useCallback((c: string) => rotulos.solicitantes.get(c) ?? c, [rotulos]);

  const contextoLista = useMemo(
    () => ({ perfilEfetivo, usuarioId: user?.id ?? null, somenteVinculadas: perfil?.ver_somente_vinculadas ?? false }),
    [perfilEfetivo, user?.id, perfil?.ver_somente_vinculadas]
  );

  /** Mesma regra da v1 para decidir o que a pessoa pode fazer com a anotação. */
  const abrirAnotacao = useCallback(
    (a: AnotacaoPrioridade) => {
      const podeAnalisar = ehPerfilUpj(perfilEfetivo);
      const podeConferir = ehPerfilGestao(perfilEfetivo);
      if (isAdmin && !podeAnalisar) void registrarAcessoPrivilegiado(a.id);
      if (podeAnalisar && a.status === 'upj-pendente') {
        void marcarEmAnalise(a.id).then(() => {
          void carregarAnotacoes();
          void atualizar();
        });
      }
      const modo: ModoDetalhe =
        a.status === 'gestor-conferencia' && podeConferir
          ? 'conferencia'
          : (a.status === 'upj-pendente' || a.status === 'upj-analisada') && podeAnalisar
            ? 'analise'
            : a.status === 'gestor-devolvida' && perfilEfetivo === 'atendente'
              ? 'resposta'
              : a.status === 'upj-devolvida' && podeConferir
                ? 'correcao'
                : 'consulta';
      irPara({ tipo: 'detalhe', anotacaoId: a.id, modo });
    },
    [perfilEfetivo, isAdmin, irPara, carregarAnotacoes, atualizar]
  );

  const aposAcao = useCallback(
    async (mensagem: string) => {
      setRetorno(mensagem);
      await Promise.all([carregarAnotacoes(), atualizar()]);
      irPara({ tipo: 'inicial' });
    },
    [carregarAnotacoes, atualizar, irPara]
  );

  useEffect(() => {
    if (!isOpen) return;
    const aoTeclar = (e: KeyboardEvent) => {
      // Esc fecha só quando nenhum diálogo próprio está aberto.
      if (e.key === 'Escape' && !document.querySelector('.pu2-dialogo-fundo')) onClose();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [isOpen, onClose]);

  // Mensagem de retorno some ao trocar de tela.
  useEffect(() => {
    if (estado.tela.tipo !== 'inicial') setRetorno(null);
  }, [estado.tela]);

  if (!isOpen) return null;

  const pe = estado.perfilEfetivo;
  const ehGestor = estado.perfil?.perfil === 'gestor' || pe === 'gestor';
  const podeCriar = pe === 'atendente' || pe === 'gestor' || pe === 'conferente';
  const temDesignacoes = isAdmin || pe === 'gestor' || pe === 'coordenador';
  const temConfiguracoes = estado.perfil?.perfil === 'gestor';

  const fechar = () => {
    limparPrioridadesV2Sessao();
    onClose();
  };

  const conteudo = (() => {
    if (estado.carregando) return <p className="pu2-carregando">Carregando…</p>;

    if (estado.tela.tipo === 'inicial') {
      return (
        <>
          {retorno && (
            <div className="pu2-caixa pu2-caixa-sucesso pu2-retorno" role="status">
              <span>
                <strong>Pronto!</strong> {retorno}
              </span>
              <button type="button" onClick={() => setRetorno(null)} aria-label="Fechar aviso">
                ×
              </button>
            </div>
          )}
          {!estado.perfil && (
            <div className="pu2-caixa pu2-caixa-aviso">
              {isAdmin
                ? 'Seu usuário não tem perfil neste app, mas você é administrador: use Designações para definir os perfis.'
                : 'Seu usuário ainda não tem perfil neste app. Peça ao Gestor do TJSP Atende para cadastrá-lo.'}
            </div>
          )}
          <TelaInicialV2
            primeiroNome={estado.primeiroNome}
            perfilEfetivo={pe}
            contadores={estado.contadores}
            podeCriar={podeCriar}
            irPara={estado.irPara}
          />
        </>
      );
    }

    if (estado.tela.tipo === 'nova') {
      return (
        <NovaAnotacaoV2
          perfil={estado.perfil}
          onVoltar={estado.voltarInicial}
          onCriada={(mensagem) => {
            setRetorno(mensagem);
            void estado.atualizar();
            estado.irPara({ tipo: 'inicial' });
          }}
        />
      );
    }

    if (estado.tela.tipo === 'lista' && estado.tela.grupo in LISTAS) {
      const chave = estado.tela.grupo as ChaveLista;
      return (
        <ListaAnotacoesV2
          key={chave}
          titulo={LISTAS[chave].titulo}
          icone={LISTAS[chave].icone}
          itens={anotacoes.filter((a) => anotacaoNaLista(a, chave, contextoLista))}
          upjs={estado.upjs}
          rotuloTipo={rotuloTipo}
          onAbrir={abrirAnotacao}
          carregando={carregandoLista}
        />
      );
    }

    if (estado.tela.tipo === 'detalhe') {
      const { anotacaoId, modo } = estado.tela;
      const emFoco = anotacoes.find((a) => a.id === anotacaoId);
      if (!emFoco) {
        return carregandoLista ? (
          <p className="pu2-carregando">Carregando anotação…</p>
        ) : (
          <div className="pu2-vazio">
            Anotação não encontrada ou sem permissão de visualização.{' '}
            <button type="button" className="pu2-botao pu2-botao-link" onClick={estado.voltarInicial}>
              Voltar ao início
            </button>
          </div>
        );
      }
      return (
        <DetalheAnotacaoV2
          key={`${emFoco.id}-${modo}`}
          anotacao={emFoco}
          modo={modo}
          upjs={estado.upjs}
          perfilEfetivo={pe}
          rotuloTipo={rotuloTipo}
          rotuloSolicitante={rotuloSolicitante}
          onConcluir={aposAcao}
          onVoltar={() => (ultimaLista ? irPara({ tipo: 'lista', grupo: ultimaLista }) : estado.voltarInicial())}
        />
      );
    }

    // Demais telas: visual da v1 por enquanto (serão redesenhadas nas próximas entregas).
    return (
      <>
        <p className="pu2-legado-aviso">Esta tela ainda está com o visual anterior. Ela será redesenhada nas próximas entregas.</p>
        <div className="pu2-legado">
          <PrioridadesContent {...estado} nomeUsuario={estado.nomeCompleto} />
        </div>
      </>
    );
  })();

  return (
    <div className="pu2 fixed inset-0 z-[9999] flex flex-col" role="dialog" aria-modal="true" aria-label="Prioridades e Urgências">
      <header className="pu2-topo">
        <div className="pu2-topo-titulo">
          <img src={logo} alt="" />
          <span>PRIORIDADES e URGÊNCIAS | TJSP Atende</span>
        </div>
        <div className="pu2-topo-acoes">
          <button
            type="button"
            className="pu2-topo-botao"
            onClick={() => recarregarPrioridadesV2(estado.tela)}
            title="Atualizar (como o F5, mantendo esta tela)"
          >
            <Icone nome="fechar" tamanho={16} />
            Atualizar
          </button>
          <button type="button" className="pu2-topo-botao" onClick={fechar} title="Fechar (Esc)">
            Fechar
          </button>
        </div>
      </header>

      <div className="pu2-corpo">
        <PainelLateralV2
          perfil={estado.perfil}
          perfilEfetivo={pe}
          nomeCompleto={estado.nomeCompleto}
          upjs={estado.upjs}
          contadores={estado.contadores}
          tela={estado.tela}
          irPara={estado.irPara}
          podeCriar={podeCriar}
          temDesignacoes={temDesignacoes}
          temConfiguracoes={temConfiguracoes}
          temLogAcessos={ehGestor}
          recolhido={recolhido}
          alternarRecolhido={() => setRecolhido((r) => !r)}
        />
        <main className="pu2-principal" style={{ backgroundImage: `url(${fundo})` }}>
          <div className="pu2-principal-conteudo">{conteudo}</div>
        </main>
      </div>
    </div>
  );
};

export default PrioridadesV2Modal;

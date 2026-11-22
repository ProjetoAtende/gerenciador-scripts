/**
 * App "Prioridades e Urgências" — VERSÃO NOVA (v2), em teste.
 *
 * Convive com a v1 (`components/prioridades/`), que segue intacta como backup.
 * As duas usam o mesmo banco e as mesmas funções do servidor: a v2 muda a
 * apresentação. Telas ainda não redesenhadas são exibidas com o visual da v1
 * dentro desta moldura, para o app continuar completo durante os testes.
 */
import React, { useEffect, useState } from 'react';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import './prioridadesV2.css';
import { usePermissoes } from '../../contexts/PermissoesContext';
import { PrioridadesContent } from '../prioridades/PrioridadesContent';
import { Icone } from './Icone';
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

const PrioridadesV2Modal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { isAdmin } = usePermissoes();
  const estado = usePrioridadesV2(isOpen);
  const [recolhido, setRecolhido] = useState(false);
  const [retorno, setRetorno] = useState<string | null>(null);

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

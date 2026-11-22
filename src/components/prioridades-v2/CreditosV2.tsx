/** Créditos do app — página do painel principal (Painel de Controle → Créditos). */
import React from 'react';
import { Icone } from './Icone';
import { CREDITOS_ICONES } from './icones';

const DESENVOLVIDO_POR = ['David de Souza Dichirico Pestilli'];

const CRIADO_POR = ['Celso Luis de Araújo Guimarães Filho', 'Gabriela Stephanie de Arruda Mira'];

/** Exibidos em ordem alfabética (a ordem abaixo não importa). */
const TESTADO_E_APRIMORADO_POR = [
  'Silvio José Machado Araújo',
  'Higor da Silva Fontes',
  'Laura Andrade Botelho de Matos',
  'José Carlos de Oliveira',
  'Silvia Regina Giansante',
  'Silvia Soares Hungria Prado Uelze',
  'Paula Cristina Ferraz Toledo Novato',
  'Allan José Silva Bertucci',
  'Monica Coimbra de Conti',
].sort((a, b) => a.localeCompare(b, 'pt-BR'));

const AGRADECIMENTO_ESPECIAL = ['Robson Alves Bezerra'];

const GrupoPessoas: React.FC<{ titulo: string; nomes: string[] }> = ({ titulo, nomes }) => (
  <div className="pu2-creditos-grupo">
    <div className="pu2-dado-rotulo">{titulo}</div>
    {nomes.map((n) => (
      <div key={n} className="pu2-dado-valor">
        {n}
      </div>
    ))}
  </div>
);

export const CreditosV2: React.FC<{ onVoltar: () => void }> = ({ onVoltar }) => (
  <div>
    <div className="pu2-titulo-tela">
      <h2>
        <Icone nome="creditos" tamanho="0.9em" />
        Créditos
      </h2>
      <button type="button" className="pu2-botao pu2-botao-link" onClick={onVoltar}>
        <Icone nome="voltar" tamanho={14} />
        Voltar
      </button>
    </div>

    <section className="pu2-secao">
      <h3 className="pu2-secao-rotulo">TJSP</h3>
      <div className="pu2-bloco">
        <GrupoPessoas titulo="Desenvolvido por" nomes={DESENVOLVIDO_POR} />
        <GrupoPessoas titulo="Criado por" nomes={CRIADO_POR} />
        <GrupoPessoas titulo="Testado e Aprimorado por" nomes={TESTADO_E_APRIMORADO_POR} />
        <GrupoPessoas titulo="Agradecimento Especial a" nomes={AGRADECIMENTO_ESPECIAL} />
      </div>
    </section>

    <section className="pu2-secao">
      <h3 className="pu2-secao-rotulo">Ícones e fonte</h3>
      <div className="pu2-bloco pu2-bloco-esquerda">
        <ul className="pu2-lista-simples pu2-creditos">
          {CREDITOS_ICONES.map((c) => (
            <li key={c.conjunto}>
              <strong>{c.conjunto}</strong>
              <span>{c.autorLicenca}</span>
            </li>
          ))}
          <li>
            <strong>Fonte Montserrat</strong>
            <span>Julieta Ulanovsky e colaboradores — SIL Open Font License</span>
          </li>
        </ul>
      </div>
    </section>
  </div>
);

import React from 'react';
import { ICONES, type NomeIcone } from './icones';

interface IconeProps {
  nome: NomeIcone;
  /** Tamanho em px (largura e altura). Padrão: 1em, acompanha o texto. */
  tamanho?: number | string;
  className?: string;
  /** Texto para leitores de tela. Sem ele, o ícone é decorativo. */
  rotulo?: string;
}

/** Ícone embutido (SVG inline, cor = `currentColor`). Nenhuma chamada externa. */
export const Icone: React.FC<IconeProps> = ({ nome, tamanho = '1em', className, rotulo }) => {
  const icone = ICONES[nome];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={icone.viewBox}
      width={tamanho}
      height={tamanho}
      className={className}
      fill="currentColor"
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: icone.body }}
    />
  );
};

/**
 * Logotipo da plataforma (Eproc / SAJ) em vetor, embutido no código.
 * Usa `currentColor`: assume a cor do texto em volta (vermelho no detalhe,
 * preto na Nova Anotação) e fica nítido em qualquer tamanho.
 */
import React from 'react';
import eproc from './assets/logo-eproc.svg?raw';
import saj from './assets/logo-saj.svg?raw';

export const LogoPlataforma: React.FC<{ plataforma: 'eproc' | 'saj'; className?: string }> = ({ plataforma, className }) => (
  <span
    className={`pu2-logo-svg ${className ?? ''}`}
    role="img"
    aria-label={plataforma === 'eproc' ? 'Eproc' : 'SAJ'}
    dangerouslySetInnerHTML={{ __html: plataforma === 'eproc' ? eproc : saj }}
  />
);

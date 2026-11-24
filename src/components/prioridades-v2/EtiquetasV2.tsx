import React from 'react';
import type { PrioridadeStatus } from '../../types/Prioridades';
import { STATUS_LABEL } from '../../types/Prioridades';
import { Icone } from './Icone';
import { classeEtiquetaStatus } from './prioridadesV2Rotulos';

export const EtiquetaStatus: React.FC<{ status: PrioridadeStatus }> = ({ status }) => (
  <span className={`pu2-etiqueta ${classeEtiquetaStatus(status)}`}>{STATUS_LABEL[status]}</span>
);

export const EtiquetaUrgentissima: React.FC = () => (
  <span className="pu2-etiqueta pu2-etiqueta-urgentissima" title="Marcada como de maior urgência">
    <Icone nome="urgentissimas" tamanho={15} />
    Urgentíssima
  </span>
);

export const EtiquetaReiterada: React.FC = () => (
  <span className="pu2-etiqueta pu2-etiqueta-reiterada" title="Há outra anotação em andamento para o mesmo processo">
    <Icone nome="reiteradas" tamanho={14} />
    Reiterada
  </span>
);

/** Log de acessos privilegiados (PD-13) no visual da v2. Mesma consulta da v1. */
import React, { useEffect, useState } from 'react';
import { formatarProcessoCnj } from '../../services/prioridadesDjenService';
import { listarLogAcessosPrivilegiados, type LinhaLogAcesso } from '../../services/prioridadesService';
import { formatarDataHora } from '../prioridades/prioridadesUtils';
import { Icone } from './Icone';

export const LogAcessosV2: React.FC<{ onVoltar: () => void }> = ({ onVoltar }) => {
  const [linhas, setLinhas] = useState<LinhaLogAcesso[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void listarLogAcessosPrivilegiados().then((r) => {
      if (!ativo) return;
      if (!r.sucesso) setErro(r.erro ?? 'Não foi possível carregar o log.');
      setLinhas(r.sucesso ? r.linhas : []);
    });
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <div>
      <div className="pu2-titulo-tela">
        <h2>
          <Icone nome="log-acessos" tamanho="0.9em" />
          Log de Acessos
        </h2>
        <button type="button" className="pu2-botao pu2-botao-link" onClick={onVoltar}>
          <Icone nome="voltar" tamanho={14} />
          Voltar
        </button>
      </div>
      <p className="pu2-subtitulo">
        Registra quando um administrador abre uma anotação de outra pessoa. Os registros são guardados por 12 meses.
      </p>

      {erro && (
        <div className="pu2-caixa pu2-caixa-erro" role="alert">
          {erro}
        </div>
      )}

      {linhas === null ? (
        <p className="pu2-carregando">Carregando…</p>
      ) : linhas.length === 0 ? (
        <div className="pu2-vazio">Nenhum acesso registrado.</div>
      ) : (
        <div className="pu2-tabela-moldura">
          <table className="pu2-tabela">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Administrador</th>
                <th>Anotação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatarDataHora(l.criado_em)}</td>
                  <td>
                    <strong>{l.usuario_nome ?? '—'}</strong>
                    {l.usuario_email && <div className="pu2-ajuda">{l.usuario_email}</div>}
                  </td>
                  <td>
                    n.º {l.anotacao_id} · <span className="vermelho">{formatarProcessoCnj(l.processo)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { buscarVersoes, ScriptVersao } from '../services/scriptVersioningService';
import { renderHtmlReadonly } from '../utils/renderHtmlReadonly';
import { supabase } from '../services/supabaseClient';
import { BaseAnimatedModal } from './BaseAnimatedModal';

interface HistoricoVersoesModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptId: string;
  scriptNome: string;
}

const TIPO_LABELS: Record<string, string> = {
  criacao: 'Criação do script',
  proposta_aprovada: 'Proposta aprovada',
  proposta_aprovada_editada: 'Proposta aprovada (editada pelo revisor)',
  correcao_grafia: 'Correção menor (curadoria)',
  substantiva: 'Alteração substantiva (curadoria)',
  atualizacao_normativa: 'Atualização normativa',
  outro: 'Outro',
};

export const HistoricoVersoesModal: React.FC<HistoricoVersoesModalProps> = ({
  isOpen,
  onClose,
  scriptId,
  scriptNome,
}) => {
  const [abaAtiva, setAbaAtiva] = useState<'usuario_final' | 'atendente'>('usuario_final');
  const [versoes, setVersoes] = useState<ScriptVersao[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedConteudo, setExpandedConteudo] = useState<string | null>(null);
  const [expandedAnterior, setExpandedAnterior] = useState<string | null>(null);
  const [expandedProposta, setExpandedProposta] = useState<string | null>(null);
  const [autoresMap, setAutoresMap] = useState<Record<string, string>>({});
  const [propostasCache, setPropostasCache] = useState<Record<string, string>>({});

  const carregarVersoes = useCallback(async () => {
    if (!scriptId) return;
    setLoading(true);
    try {
      const data = await buscarVersoes(scriptId, abaAtiva);
      setVersoes(data);

      // Buscar nomes dos autores
      const autorIds = [...new Set(data.flatMap(v => [v.autor_id, v.aprovado_por].filter(Boolean) as string[]))];
      if (autorIds.length > 0) {
        const { data: usuarios } = await supabase
          .from('users')
          .select('id, nome')
          .in('id', autorIds);
        if (usuarios) {
          const map: Record<string, string> = {};
          usuarios.forEach(p => { map[p.id] = p.nome; });
          setAutoresMap(prev => ({ ...prev, ...map }));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar versões:', err);
    } finally {
      setLoading(false);
    }
  }, [scriptId, abaAtiva]);

  useEffect(() => {
    if (isOpen) {
      carregarVersoes();
      setExpandedConteudo(null);
      setExpandedAnterior(null);
      setExpandedProposta(null);
    }
  }, [isOpen, carregarVersoes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Buscar proposta original para versões do tipo proposta_aprovada_editada
  const buscarPropostaOriginal = useCallback(async (versao: ScriptVersao) => {
    const cacheKey = `${versao.script_id}-${versao.campo_alvo}-${versao.numero_versao}`;
    if (propostasCache[cacheKey]) return;

    const { data } = await supabase
      .from('script_propostas_revisao')
      .select('conteudo_proposto')
      .eq('script_id', versao.script_id)
      .eq('campo_alvo', versao.campo_alvo)
      .eq('versao_gerada', versao.numero_versao)
      .maybeSingle();

    if (data?.conteudo_proposto) {
      setPropostasCache(prev => ({ ...prev, [cacheKey]: data.conteudo_proposto }));
    }
  }, [propostasCache]);

  const toggleProposta = useCallback(async (versao: ScriptVersao) => {
    if (expandedProposta === versao.id) {
      setExpandedProposta(null);
    } else {
      await buscarPropostaOriginal(versao);
      setExpandedProposta(versao.id);
    }
  }, [expandedProposta, buscarPropostaOriginal]);

  return (
    <BaseAnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden my-4"
      overlayClassName="items-start pt-8 overflow-y-auto"
      zIndex="z-50"
    >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Histórico de Versões — {scriptNome}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded-lg transition-colors"
              title="Fechar"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Abas */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {(['usuario_final', 'atendente'] as const).map(aba => (
              <button
                key={aba}
                onClick={() => setAbaAtiva(aba)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  abaAtiva === aba
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {aba === 'usuario_final' ? 'Usuário Final' : 'Atendente'}
              </button>
            ))}
          </div>

          {/* Lista de versões */}
          <div className="px-6 py-4 max-h-[65vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : versoes.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-gray-400 py-12">
                Nenhuma versão registrada para este campo.
              </p>
            ) : (
              <div className="space-y-3">
                {versoes.map((versao) => {
                  const isConteudoExpanded = expandedConteudo === versao.id;
                  const isAnteriorExpanded = expandedAnterior === versao.id;
                  const isPropostaExpanded = expandedProposta === versao.id;
                  const propostaCacheKey = `${versao.script_id}-${versao.campo_alvo}-${versao.numero_versao}`;
                  const propostaConteudo = propostasCache[propostaCacheKey];

                  const dataFormatada = new Date(versao.criado_em).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  });
                  const autorNome = autoresMap[versao.autor_id] || 'Desconhecido';
                  const aprovadoNome = versao.aprovado_por ? autoresMap[versao.aprovado_por] : null;
                  const tipoLabel = TIPO_LABELS[versao.tipo_motivacao] || versao.tipo_motivacao;

                  return (
                    <div key={versao.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {/* Header da versão */}
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded">
                              V{versao.numero_versao}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{dataFormatada}</span>
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded">
                            {tipoLabel}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          Autor: <span className="font-medium">{autorNome}</span>
                          {aprovadoNome && (
                            <span className="ml-2 text-green-600 dark:text-green-400">
                              · Revisado por: {aprovadoNome} (Curadoria)
                            </span>
                          )}
                        </div>
                        {versao.motivacao && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
                            "{versao.motivacao}"
                          </p>
                        )}
                      </div>

                      {/* Botão Ver conteúdo */}
                      <button
                        onClick={() => setExpandedConteudo(isConteudoExpanded ? null : versao.id)}
                        className="w-full px-4 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-1 border-t border-gray-200 dark:border-gray-700"
                      >
                        {isConteudoExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isConteudoExpanded ? 'Ocultar conteúdo' : 'Ver conteúdo'}
                      </button>
                      {isConteudoExpanded && (
                        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                          <div className="overflow-y-auto max-h-[40vh] prose prose-sm dark:prose-invert max-w-none leading-relaxed text-gray-700 dark:text-gray-300" style={{ lineHeight: '1.8' }}>
                            {versao.conteudo
                              ? renderHtmlReadonly(versao.conteudo)
                              : <em className="text-gray-400">Sem conteúdo</em>
                            }
                          </div>
                        </div>
                      )}

                      {/* Botão Ver conteúdo anterior (V2+ com conteudo_anterior) */}
                      {versao.conteudo_anterior && (
                        <>
                          <button
                            onClick={() => setExpandedAnterior(isAnteriorExpanded ? null : versao.id)}
                            className="w-full px-4 py-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center justify-center gap-1 border-t border-gray-200 dark:border-gray-700"
                          >
                            {isAnteriorExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isAnteriorExpanded ? 'Ocultar conteúdo anterior' : 'Ver conteúdo anterior'}
                          </button>
                          {isAnteriorExpanded && (
                            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-900/10">
                              <p className="text-xs text-amber-600 dark:text-amber-400 mb-2 font-medium">Conteúdo antes desta versão:</p>
                              <div className="overflow-y-auto max-h-[40vh] prose prose-sm dark:prose-invert max-w-none leading-relaxed text-gray-700 dark:text-gray-300" style={{ lineHeight: '1.8' }}>
                                {renderHtmlReadonly(versao.conteudo_anterior)}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Botão Ver proposta original (apenas para proposta_aprovada_editada) */}
                      {versao.tipo_motivacao === 'proposta_aprovada_editada' && (
                        <>
                          <button
                            onClick={() => toggleProposta(versao)}
                            className="w-full px-4 py-2 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center justify-center gap-1 border-t border-gray-200 dark:border-gray-700"
                          >
                            {isPropostaExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isPropostaExpanded ? 'Ocultar proposta original' : 'Ver proposta original'}
                          </button>
                          {isPropostaExpanded && (
                            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-purple-50/50 dark:bg-purple-900/10">
                              <p className="text-xs text-purple-600 dark:text-purple-400 mb-2 font-medium">Texto original da proposta (antes da edição do revisor):</p>
                              <div className="overflow-y-auto max-h-[40vh] prose prose-sm dark:prose-invert max-w-none leading-relaxed text-gray-700 dark:text-gray-300" style={{ lineHeight: '1.8' }}>
                                {propostaConteudo
                                  ? renderHtmlReadonly(propostaConteudo)
                                  : <em className="text-gray-400">Proposta não encontrada</em>
                                }
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
            >
              Fechar
            </button>
          </div>
    </BaseAnimatedModal>
  );
};

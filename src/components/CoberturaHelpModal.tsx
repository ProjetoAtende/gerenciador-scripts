/**
 * Modal de Ajuda — Aba Cobertura de Scripts
 * Explica todos os elementos da interface da aba Cobertura
 */

import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  BarChart3,
  Filter,
  ArrowUpDown,
  Layers,
  ChevronRight,
  RefreshCw,
  Target,
  Info,
  CheckCircle2,
  AlertTriangle,
  TicketCheck,
  FileText,
  Zap,
} from 'lucide-react';

interface CoberturaHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CoberturaHelpModal = ({ isOpen, onClose }: CoberturaHelpModalProps) => {
  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-blue-900/50 to-indigo-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-white">
                  Guia — Cobertura de Scripts
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Visão geral */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">O que é esta aba?</h3>
                </div>
                <div className="pl-7 space-y-2 text-gray-300 text-sm">
                  <p>
                    A aba <strong className="text-white">Cobertura</strong> mostra um panorama de 
                    quantos scripts existem para cada categoria e subcategoria de atendimento, 
                    comparado com a demanda real de tickets.
                  </p>
                  <p className="text-blue-400 italic">
                    💡 O objetivo é identificar <strong>gaps</strong>: categorias com muitos tickets 
                    mas poucos (ou nenhum) scripts de suporte, indicando onde novos scripts 
                    devem ser priorizados.
                  </p>
                </div>
              </section>

              {/* Cards de métricas */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-400" />
                  <h3 className="text-lg font-semibold text-white">Cards de Métricas</h3>
                </div>
                <div className="pl-7 space-y-3 text-gray-300 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Card 1 */}
                    <div className="bg-blue-950/40 border border-blue-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span className="font-medium text-blue-300">Scripts classificados</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Total de scripts únicos que possuem pelo menos uma categoria atribuída. 
                        Scripts com múltiplas categorias são contados apenas uma vez.
                      </p>
                    </div>

                    {/* Card 2 */}
                    <div className="bg-purple-950/40 border border-purple-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TicketCheck className="w-4 h-4 text-purple-400" />
                        <span className="font-medium text-purple-300">Tickets categorizados</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Soma total de tickets já analisados e classificados por categoria. 
                        Os dados vêm de um cache (Materialized View) que pode ser atualizado 
                        manualmente pelo botão 🔄.
                      </p>
                    </div>

                    {/* Card 3 */}
                    <div className="bg-green-950/40 border border-green-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Layers className="w-4 h-4 text-green-400" />
                        <span className="font-medium text-green-300">Cobertura subcats</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Percentual de subcategorias que possuem ao menos 1 script. 
                        O formato X/Y abaixo mostra quantas subcategorias estão cobertas 
                        do total existente.
                      </p>
                    </div>

                    {/* Card 4 */}
                    <div className="bg-orange-950/40 border border-orange-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                        <span className="font-medium text-orange-300">Cats sem scripts</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Número de categorias inteiras (nível pai) que não possuem nenhum script. 
                        São os maiores gaps de cobertura e merecem atenção prioritária.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Filtros e controles */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-semibold text-white">Filtros e Controles</h3>
                </div>
                <div className="pl-7 space-y-3 text-gray-300 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-lg shrink-0">🏢</span>
                      <div>
                        <span className="font-medium text-white">Filtro de equipe</span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Selecione <em>"Todas as equipes"</em> para ver o panorama global, 
                          ou escolha uma equipe específica para ver apenas os scripts e tickets 
                          atribuídos a ela. O dropdown mostra apenas equipes que possuem scripts.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <ArrowUpDown className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-white">Ordenação</span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          <strong className="text-gray-300">� Mais scripts</strong> — categorias com mais scripts aparecem primeiro (padrão).<br />
                          <strong className="text-gray-300">🎫 Mais tickets</strong> — categorias com maior volume de tickets no topo; útil para priorizar onde a demanda é maior.<br />
                          <strong className="text-gray-300">📊 Menor cobertura</strong> — categorias com menor % de subcategorias cobertas aparecem primeiro.<br />
                          <strong className="text-gray-300">⚠️ Mais gaps</strong> — categorias com mais subcategorias sem nenhum script no topo; 
                          foco nas lacunas absolutas.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-white">Expandir / Recolher</span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Abre ou fecha todas as categorias de uma vez, revelando as subcategorias. 
                          Você também pode clicar em cada categoria individualmente.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <RefreshCw className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-white">Botão 🔄 Atualizar</span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Atualiza o cache de contagem de tickets (Materialized View no banco) 
                          e recarrega todos os dados da tela. Use quando novos tickets tiverem 
                          sido categorizados e você quiser ver números atualizados.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Linhas de categoria */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-semibold text-white">Linhas de Categoria</h3>
                </div>
                <div className="pl-7 space-y-2 text-gray-300 text-sm">
                  <p>Cada linha representa uma categoria de atendimento e contém:</p>
                  <ul className="space-y-1.5 text-xs text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-gray-500 mt-0.5">▸</span>
                      <span><strong className="text-gray-300">Seta (▶)</strong> — clique para expandir/recolher as subcategorias</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-500 mt-0.5">▸</span>
                      <span><strong className="text-gray-300">Ícone + Nome</strong> — identificação visual da categoria</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-500 mt-0.5">▸</span>
                      <span><strong className="text-gray-300">📜 Scripts</strong> — pill azul com a quantidade de scripts atribuídos a esta categoria</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-500 mt-0.5">▸</span>
                      <span><strong className="text-gray-300">🎫 Tickets</strong> — pill roxa com a quantidade de tickets categorizados; ajuda a medir a demanda real. Fica cinza quando não há tickets.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-500 mt-0.5">▸</span>
                      <span><strong className="text-gray-300">Barra de progresso</strong> — pill cinza com barra visual e percentual de subcategorias cobertas (verde ≥80%, amarelo ≥40%, laranja &lt;40%)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-500 mt-0.5">▸</span>
                      <span><strong className="text-gray-300">Badge de status</strong> — OK, BAIXO ou VAZIO (baseado na quantidade de scripts)</span>
                    </li>
                  </ul>
                </div>
              </section>

              {/* Subcategorias */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-lg font-semibold text-white">Subcategorias</h3>
                </div>
                <div className="pl-7 space-y-2 text-gray-300 text-sm">
                  <p>
                    Ao expandir uma categoria, são listadas suas subcategorias com a mesma 
                    lógica de contagem de scripts e tickets. As subcategorias são ordenadas  
                    da que tem mais scripts para a que tem menos.
                  </p>
                  <p className="text-xs text-gray-400">
                    No rodapé de cada categoria expandida, há um resumo indicando quantas 
                    subcategorias possuem cobertura e quantas estão sem scripts.
                  </p>
                </div>
              </section>

              {/* Status badges */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-semibold text-white">Badges de Status</h3>
                </div>
                <div className="pl-7 space-y-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-900/50 text-green-400 border border-green-700/50">
                      OK
                    </span>
                    <span className="text-gray-400 text-xs">≥ 3 scripts — cobertura adequada</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-yellow-900/50 text-yellow-400 border border-yellow-700/50">
                      BAIXO
                    </span>
                    <span className="text-gray-400 text-xs">1-2 scripts — cobertura insuficiente, considere criar mais</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                      VAZIO
                    </span>
                    <span className="text-gray-400 text-xs">0 scripts — sem cobertura, criação urgente recomendada</span>
                  </div>
                </div>
              </section>

              {/* Dicas de uso */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-semibold text-white">Dicas de Uso</h3>
                </div>
                <div className="pl-7 space-y-2 text-gray-300 text-sm">
                  <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-3 space-y-2">
                    <p className="flex items-start gap-2">
                      <span className="shrink-0">🔍</span>
                      <span>
                        Use <strong className="text-amber-300">⚠️ Mais gaps</strong> ou <strong className="text-amber-300">📊 Menor cobertura</strong> para ver rapidamente 
                        onde estão os maiores buracos de cobertura.
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="shrink-0">🎫</span>
                      <span>
                        Use <strong className="text-amber-300">🎫 Mais tickets</strong> para priorizar categorias com 
                        maior demanda real. Compare com a quantidade de scripts para identificar 
                        onde a cobertura está desproporcional.
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="shrink-0">🏢</span>
                      <span>
                        Filtre por equipe para identificar gaps específicos. Cada equipe pode ter 
                        necessidades diferentes de scripts.
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="shrink-0">🔄</span>
                      <span>
                        Use o botão de atualização quando novos tickets forem categorizados pelo 
                        distribuidor. Os dados de ticket ficam em cache para performance.
                      </span>
                    </p>
                  </div>
                </div>
              </section>

            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-700 bg-gray-900/50 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              >
                Entendi
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default CoberturaHelpModal;

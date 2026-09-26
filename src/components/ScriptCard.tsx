// src/components/ScriptCard.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';

import { CheckCircle2, Circle, Clock, HelpCircle, Ticket, Send, Calendar, User, History } from 'lucide-react';
import { ScriptItem, ScriptFolder } from '../types/Script';
import { CategoriaEditavelScript } from './CategoriaEditavelScript';
import { useCategoriaInfo } from '../hooks/useCategoriaInfo';

// Função helper para converter UTC para horário de Brasília (UTC-3) e formatar
const formatarDataCriacao = (dataUtc: string): string => {
  if (!dataUtc) return '';
  const data = new Date(dataUtc);
  // Subtrai 3 horas para converter de UTC para UTC-3 (Brasília)
  data.setHours(data.getHours() - 3);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = String(data.getFullYear()).slice(-2);
  return `${dia}/${mes}/${ano}`;
};

// Função helper para construir o caminho hierárquico da pasta
const getFolderHierarchyPath = (folder: ScriptFolder | null | undefined, allFolders: ScriptFolder[]): string => {
  if (!folder) return 'Sem pasta';
  
  const path: string[] = [];
  let currentFolder: ScriptFolder | undefined = folder;
  
  // Construir caminho do fundo para cima (da pasta atual até a raiz)
  while (currentFolder) {
    path.unshift(currentFolder.nome);
    if (currentFolder.pasta_pai_id) {
      currentFolder = allFolders.find(f => f.id === currentFolder!.pasta_pai_id);
    } else {
      break;
    }
  }
  
  return path.join(' - ');
};

interface ScriptCardProps {
  script: ScriptItem;
  folder?: ScriptFolder | null;
  allFolders?: ScriptFolder[];
  isSelected?: boolean;
  isEditing?: boolean;
  editingTitle?: string;
  showCuradoriaControls?: boolean;
  canToggleCuradoria?: boolean;
  referenceNumber?: number;
  authorName?: string | null;
  curadorName?: string | null;
  onGenerate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canAprovarExclusaoPendente?: boolean;
  onMove: () => void;
  onPublicar: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onTitleChange: (value: string) => void;
  onSelect: () => void;
  onToggleCuradoria: () => void;
  onReativar?: () => void;
  onExportarDocumento?: () => void;
  onCategoriaAtualizada?: (dados: { categoria_equipe_slug: string | null; subcategoria_gse_slug: string | null; origem: 'manual' }) => void;
  versaoInfo?: { usuario_final: number; atendente: number } | null;
  onShowHistorico?: () => void;
}

export const ScriptCard: React.FC<ScriptCardProps> = React.memo(({
  script,
  folder,
  allFolders = [],
  isSelected = false,
  isEditing = false,
  editingTitle = '',
  canToggleCuradoria = false,
  referenceNumber,
  authorName,
  curadorName,
  onGenerate,
  onEdit,
  onDelete,
  canAprovarExclusaoPendente = false,
  onMove,
  onPublicar,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onTitleChange,
  onSelect,
  onToggleCuradoria,
  onReativar,
  onExportarDocumento,
  onCategoriaAtualizada,
  versaoInfo,
  onShowHistorico,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showAuthorTooltip, setShowAuthorTooltip] = useState(false);

  // Hook para resolver nomes de categorias hierárquicas v2
  const { resolverSlug } = useCategoriaInfo(script.dominio as 'externo' | 'interno' | null);

  // Determinar ícone baseado na pasta ou usar padrão
  const scriptIcon = folder?.icone || '📜';
  
  // Verificar se o script está desativado
  const isDesativado = script.deletado === true;
  const hasExclusaoPendente = script.exclusao_pendente === true && !isDesativado;

  // Verificar se tem badges para mostrar (categoria, domínio, temporário ou conteúdo atendente)
  const temBadges = !isDesativado && (
    script.categoria_equipe_slug ||
    script.dominio ||
    script.temporario ||
    hasExclusaoPendente ||
    script.tem_conteudo_atendente ||
    (script.categorias_adicionais && script.categorias_adicionais.length > 0)
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "tween", duration: 0.15 }}
      whileHover={{ scale: 1.02 }}
      className={`
        bg-white dark:bg-gray-800 rounded-xl shadow-md border-2 overflow-hidden group cursor-pointer relative min-h-56 flex flex-col
        ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
        transition-all duration-200
      `}
      onClick={onSelect}
    >
      {/* Header com ícone */}
      <div
        className={`px-4 py-3 border-b dark:border-gray-700 flex items-center gap-2 ${
          script.desativado_em || script.deletado 
            ? 'bg-red-50 dark:bg-red-900/30' 
            : script.temporario 
              ? 'bg-orange-100 dark:bg-orange-900/30' 
              : 'bg-gray-50 dark:bg-gray-700/50'
        }`}
        style={{ 
          backgroundColor: script.desativado_em || script.deletado 
            ? undefined 
            : script.temporario
              ? '#FFF7ED'
              : (folder?.cor ? `${folder.cor}15` : undefined) 
        }}
      >
        <span className="text-lg">{script.desativado_em || script.deletado ? '🗑️' : scriptIcon}</span>
        {script.desativado_em || script.deletado ? (
          <span className="text-sm text-red-600 truncate flex-1 font-medium">
            Desativado em {formatarDataCriacao(script.desativado_em || script.deletado_em || '')}
          </span>
        ) : (
          <span className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1" title={getFolderHierarchyPath(folder, allFolders)}>
            {getFolderHierarchyPath(folder, allFolders)}
          </span>
        )}
        {!script.desativado_em && !script.deletado && (
          <button
            onClick={(e) => { e.stopPropagation(); if (canToggleCuradoria && !script.tem_proposta_pendente) onToggleCuradoria(); }}
            className={`p-1 rounded transition-colors ${canToggleCuradoria && !script.tem_proposta_pendente ? 'hover:bg-white/50 cursor-pointer' : 'cursor-default opacity-80'}`}
            title={
              script.tem_proposta_pendente
                ? 'Proposta de revisão pendente — resolva a proposta antes de alterar o status'
                : script.curadoria_atuada
                  ? `Revisado${curadorName ? ` por ${curadorName}` : ''}${script.data_curadoria ? ` em ${formatarDataCriacao(script.data_curadoria)}` : ''}`
                  : canToggleCuradoria
                    ? 'Não revisado - Clique para marcar'
                    : 'Não revisado'
            }
          >
            {script.tem_proposta_pendente ? (
              <Clock className="w-5 h-5 text-yellow-500" />
            ) : script.curadoria_atuada ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <Circle className="w-5 h-5 text-gray-400" />
            )}
          </button>
        )}
        {/* Ícone de histórico de versões */}
        {!script.desativado_em && !script.deletado && versaoInfo && (versaoInfo.usuario_final >= 1 || versaoInfo.atendente >= 1) && (
          <button
            onClick={(e) => { e.stopPropagation(); onShowHistorico?.(); }}
            className="p-1 rounded transition-colors hover:bg-white/50 cursor-pointer relative"
            title={`Usuário final: v${versaoInfo.usuario_final || 0} · Atendente: v${versaoInfo.atendente || 0}`}
          >
            <History className="w-4 h-4 text-blue-500" />
            <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-blue-600 text-white rounded-full px-1 leading-tight">
              v{Math.max(versaoInfo.usuario_final || 0, versaoInfo.atendente || 0)}
            </span>
          </button>
        )}
      </div>

      {/* Linha de Badges — categoria, subcategoria, temporário, conteúdo atendente */}
      {temBadges && (
        <div className="px-3 py-1.5 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 flex flex-wrap items-center gap-1.5">
          {/* Badge de Categoria Editável (CategoriaEditavelScript — Fase 5 v2 hierárquico) */}
          <CategoriaEditavelScript
            scriptId={script.id}
            categoriaEquipeSlug={script.categoria_equipe_slug}
            subcategoriaGseSlug={script.subcategoria_gse_slug}
            dominio={(script.dominio as 'externo' | 'interno') || 'interno'}
            classificacaoOrigem={script.classificacao_origem}
            classificacaoPendente={script.classificacao_pendente}
            onCategoriaAtualizada={onCategoriaAtualizada}
            compact={true}
          />

          {/* Badge de Subcategoria v2 (somente leitura) */}
          {script.subcategoria_gse_slug && script.categoria_equipe_slug && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border opacity-80 max-w-[120px] bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800"
              title={`${resolverSlug(script.categoria_equipe_slug)?.nome || script.categoria_equipe_slug} > ${script.subcategoria_gse_slug}`}
            >
              <span className="truncate">{script.subcategoria_gse_slug}</span>
            </span>
          )}

          {/* Badge de Domínio (v2 hierárquico) */}
          {script.dominio && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                script.dominio === 'externo'
                  ? 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-700'
                  : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-700'
              }`}
              title={`Domínio: ${script.dominio === 'externo' ? 'Externo (usuário final)' : 'Interno (servidor)'}`}
            >
              {script.dominio === 'externo' ? '🌐' : '🏢'}
            </span>
          )}

          {/* Badges de Categorias Secundárias */}
          {/* Badges de Categorias Secundárias v2 */}
          {script.categorias_adicionais && script.categorias_adicionais.length > 0 && (
            <>
              {script.categorias_adicionais.slice(0, 2).map((ca, idx) => {
                const catInfo = resolverSlug(ca.categoria_equipe_slug);
                const displayName = catInfo?.nome || ca.categoria_equipe_slug;
                const displayIcon = catInfo?.icone || '🏷️';
                return (
                  <span
                    key={`cat-sec-${idx}`}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border opacity-60 bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800"
                    title={`Categoria secundária: ${displayName}${ca.subcategoria_gse_slug ? ` > ${ca.subcategoria_gse_slug}` : ''}`}
                  >
                    <span className="flex-shrink-0">{displayIcon}</span>
                  </span>
                );
              })}
              {script.categorias_adicionais.length > 2 && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600"
                  title={script.categorias_adicionais.slice(2).map(ca => {
                    const info = resolverSlug(ca.categoria_equipe_slug);
                    return (info?.nome || ca.categoria_equipe_slug) + (ca.subcategoria_gse_slug ? ` > ${ca.subcategoria_gse_slug}` : '');
                  }).join(', ')}
                >
                  +{script.categorias_adicionais.length - 2}
                </span>
              )}
            </>
          )}

          {/* Badge Temporário (movido do header) */}
          {script.temporario && !script.deletado && !script.desativado_em && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full font-medium">
              ⏳ Temporário
            </span>
          )}

          {hasExclusaoPendente && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs rounded-full font-medium border border-yellow-200 dark:border-yellow-800"
              title="Este script já possui solicitação de exclusão aguardando aprovação"
            >
              <Clock size={12} />
              Exclusão pendente
            </span>
          )}

          {/* Badge Conteúdo Atendente (movido do header) */}
          {script.tem_conteudo_atendente && !script.deletado && !script.desativado_em && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs rounded-full font-medium"
              title="Este script possui orientações para o atendente"
            >
              🛠️
            </span>
          )}
        </div>
      )}

      {/* Área central */}
      <div className="flex-1 p-4 flex flex-col justify-center items-center min-h-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-4xl text-gray-300">📝</span>
          {/* Número de Referência ao lado do ícone */}
          {referenceNumber !== undefined && (
            <span 
              className="bg-gray-700 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm"
              title={`Referência #${referenceNumber}`}
            >
              #{referenceNumber}
            </span>
          )}
        </div>
        
        {/* Título editável */}
        {isEditing ? (
          <div className="w-full space-y-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full px-2 py-1 border border-blue-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit();
                if (e.key === 'Escape') onCancelEdit();
              }}
            />
            <div className="flex gap-1 justify-center">
              <button
                onClick={onSaveEdit}
                className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
              >
                ✓
              </button>
              <button
                onClick={onCancelEdit}
                className="px-2 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <h3
            className="font-medium text-gray-800 dark:text-gray-200 text-center text-sm leading-tight px-2 line-clamp-3 max-h-16 overflow-hidden"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartEdit();
            }}
            title="Duplo clique para editar"
          >
            {script.nome}
          </h3>
        )}
      </div>

      {!script.email_enviado && (script.numero_chamado && script.pergunta) && (
        <div
          className="px-3 py-2 border-t dark:border-gray-700 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onPublicar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            <Send size={14} />
            Publicar script
          </button>
        </div>
      )}

      {script.email_enviado && (
        <div
          className="px-3 py-1.5 border-t bg-green-50 dark:bg-green-900/30 text-xs text-green-700 dark:text-green-400 flex items-center gap-1 dark:border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          <CheckCircle2 size={12} />
          <span>Publicado</span>
        </div>
      )}

      {/* Preview da Pergunta e Número do Chamado */}
      {(script.numero_chamado || script.pergunta) && (
        <div
          className="px-3 py-2 bg-green-50 dark:bg-green-900/30 border-t border-green-100 dark:border-gray-700 text-xs relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Número do Chamado - Clicável */}
          {script.numero_chamado && (
            <div className="flex items-center gap-1 mb-1">
              <Ticket size={12} className="text-green-600 flex-shrink-0" />
              <a
                href={`https://suporte.tjsp.jus.br/saw/Request/${script.numero_chamado}/general`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                #{script.numero_chamado}
              </a>
            </div>
          )}

          {/* Pergunta truncada com tooltip */}
          {script.pergunta && (
            <div
              className="relative"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <div className="flex items-start gap-1">
                <HelpCircle size={12} className="text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-400 line-clamp-2 cursor-help">
                  {script.pergunta}
                </span>
              </div>

              {/* Tooltip com pergunta completa */}
              {showTooltip && script.pergunta.length > 80 && (
                <div className="absolute z-50 bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl">
                  <div className="font-medium mb-1 text-green-400">Pergunta completa:</div>
                  <div className="whitespace-pre-wrap">{script.pergunta}</div>
                  <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions bar */}
      <div className={`px-3 py-2 border-t dark:border-gray-700 flex-shrink-0 ${isDesativado ? 'bg-green-50 dark:bg-green-900/30' : 'bg-gray-50 dark:bg-gray-700/50 opacity-0 group-hover:opacity-100'} transition-opacity`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {/* Botão Gerar - sempre visível */}
            <button
              onClick={(e) => { e.stopPropagation(); onGenerate(); }}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              title="Gerar script"
            >
              ▶️ Gerar
            </button>
            
            {/* Data de criação */}
            {script.criado_em && (
              <span 
                className="flex items-center gap-1 text-xs text-gray-400"
                title={`Criado em ${formatarDataCriacao(script.criado_em)}`}
              >
                <Calendar size={12} />
                {formatarDataCriacao(script.criado_em)}
              </span>
            )}

            {/* Ícone de Autor com Tooltip */}
            <div 
              className="relative"
              onMouseEnter={() => setShowAuthorTooltip(true)}
              onMouseLeave={() => setShowAuthorTooltip(false)}
            >
              <span 
                className={`flex items-center gap-1 text-xs cursor-help ${authorName ? 'text-purple-500' : 'text-gray-400'}`}
                title={authorName || 'Autor não cadastrado'}
              >
                <User size={12} />
              </span>
              
              {/* Tooltip com nome do autor */}
              {showAuthorTooltip && (
                <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <User size={10} />
                    <span className={authorName ? 'text-purple-300' : 'text-gray-400'}>
                      {authorName || 'Autor não cadastrado'}
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900" />
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onMove(); }}
              className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-xs transition-colors"
              title="Mover para pasta"
            >
              📁
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded text-xs transition-colors"
              title="Editar resposta"
            >
              ✏️
            </button>
            {onExportarDocumento && (
              <button
                onClick={(e) => { e.stopPropagation(); onExportarDocumento(); }}
                className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded text-xs transition-colors"
                title="Exportar script como documento HTML"
              >
                📄
              </button>
            )}
            {/* Botão Reativar ou Excluir dependendo do estado */}
            {isDesativado && onReativar ? (
              <button
                onClick={(e) => { e.stopPropagation(); onReativar(); }}
                className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-xs transition-colors"
                title="Reativar script - restaurar para pasta original"
              >
                ♻️
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasExclusaoPendente && !canAprovarExclusaoPendente) return;
                  onDelete();
                }}
                disabled={hasExclusaoPendente && !canAprovarExclusaoPendente}
                className={`p-1 rounded text-xs transition-colors ${
                  hasExclusaoPendente && !canAprovarExclusaoPendente
                    ? 'text-yellow-600 dark:text-yellow-400 cursor-not-allowed opacity-60'
                    : hasExclusaoPendente && canAprovarExclusaoPendente
                      ? 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 ring-1 ring-red-300'
                      : 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                }`}
                title={
                  hasExclusaoPendente && canAprovarExclusaoPendente
                    ? 'Aprovar ou negar exclusão'
                    : hasExclusaoPendente
                      ? 'Solicitação de exclusão já enviada'
                      : 'Excluir script'
                }
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      </div>

    </motion.div>
  );
});

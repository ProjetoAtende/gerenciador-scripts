// src/components/ChangelogModal.tsx

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Sparkles, 
  Wrench, 
  Bug, 
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Calendar,
  Tag
} from 'lucide-react';
import { Version, VersionFeature } from '../types/Version';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: Version[];
  currentVersion: string;
}

const featureTypeConfig: Record<VersionFeature['type'], { icon: typeof Sparkles; color: string; label: string }> = {
  feature: { icon: Sparkles, color: 'text-green-600 bg-green-100', label: 'Novo' },
  improvement: { icon: Wrench, color: 'text-blue-600 bg-blue-100', label: 'Melhoria' },
  fix: { icon: Bug, color: 'text-orange-600 bg-orange-100', label: 'Correção' },
  breaking: { icon: AlertTriangle, color: 'text-red-600 bg-red-100', label: 'Importante' }
};

export const ChangelogModal = ({
  isOpen,
  onClose,
  versions,
  currentVersion
}: ChangelogModalProps) => {
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    new Set(versions.filter(v => v.isCurrent).map(v => v.version))
  );

  const toggleVersion = (version: string) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(version)) {
        next.delete(version);
      } else {
        next.add(version);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Novidades do Sistema</h2>
                <p className="text-sm text-white/80">
                  Versão atual: <span className="font-semibold">{currentVersion}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {versions.map((version) => {
              const isExpanded = expandedVersions.has(version.version);
              const isCurrent = version.isCurrent;

              return (
                <div
                  key={version.version}
                  className={`border rounded-xl overflow-hidden transition-all ${
                    isCurrent 
                      ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/50' 
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                  }`}
                >
                  <button
                    onClick={() => toggleVersion(version.version)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      )}
                      
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-lg ${isCurrent ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-800 dark:text-gray-100'}`}>
                          v{version.version}
                        </span>
                        
                        {isCurrent && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-indigo-600 text-white rounded-full">
                            Atual
                          </span>
                        )}
                      </div>
                      
                      {version.title && (
                        <span className="text-gray-500 dark:text-gray-300 text-sm">— {version.title}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-300">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(version.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        {version.features.length} {version.features.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100 dark:border-gray-700">
                          {version.features.map((feature, fIndex) => {
                            const config = featureTypeConfig[feature.type];
                            const Icon = config.icon;
                            
                            return (
                              <div
                                key={fIndex}
                                className="flex items-start gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600 hover:border-gray-200 dark:hover:border-gray-500 transition-colors"
                              >
                                <div className={`p-1.5 rounded-md ${config.color}`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-gray-800 dark:text-gray-100">
                                      {feature.title}
                                    </span>
                                    {feature.area && (
                                      <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full">
                                        {feature.area}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {feature.description && (
                                    <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                                      {feature.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-300">
              Histórico consolidado de versões e novidades do sistema
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Helper para formatar data
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

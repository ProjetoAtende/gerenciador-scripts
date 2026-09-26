import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, HelpCircle } from "lucide-react";
import { useState } from "react";

interface PasqualeHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopyPrompt: (prompt: string) => void;
}

const EXEMPLO_PROMPTS = [
  {
    titulo: "Resumir Texto",
    prompt: "Faça um resumo conciso e objetivo do texto abaixo, mantendo apenas os pontos principais."
  },
  {
    titulo: "Tornar Mais Formal",
    prompt: "Reescreva o texto abaixo de forma mais formal e profissional, adequado para comunicação corporativa."
  },
  {
    titulo: "Tornar Mais Simples",
    prompt: "Simplifique o texto abaixo, usando linguagem mais acessível e fácil de entender, sem perder o significado."
  },
  {
    titulo: "Corrigir Gramática",
    prompt: "Corrija todos os erros de gramática, pontuação e ortografia no texto abaixo, mantendo o mesmo estilo."
  },
  {
    titulo: "Expandir Texto",
    prompt: "Expanda o texto abaixo adicionando mais detalhes e explicações, mantendo o tom profissional."
  },
  {
    titulo: "Criar Lista de Tópicos",
    prompt: "Transforme o texto abaixo em uma lista de tópicos clara e organizada, usando bullet points."
  },
  {
    titulo: "Traduzir para Inglês",
    prompt: "Traduza o texto abaixo para o inglês de forma profissional e precisa."
  },
  {
    titulo: "Resposta Amigável",
    prompt: "Reescreva o texto abaixo como uma resposta amigável e empática para um cliente, mantendo profissionalismo."
  },
  {
    titulo: "Email Executivo",
    prompt: "Transforme o texto abaixo em um email executivo conciso, direto e profissional."
  },
  {
    titulo: "Instruções Passo a Passo",
    prompt: "Organize o texto abaixo como um guia passo a passo numerado, claro e fácil de seguir."
  }
];

export const PasqualeHelpModal = ({ isOpen, onClose, onCopyPrompt }: PasqualeHelpModalProps) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyPrompt = (prompt: string, index: number) => {
    onCopyPrompt(prompt);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-800">
            <div className="flex items-center gap-3">
              <HelpCircle className="text-purple-600" size={24} />
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Como usar o Pasquale</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Explicação */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">📝 O que é o Pasquale?</h3>
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3 text-gray-700 dark:text-gray-300">
                <p>
                  O <strong>Pasquale</strong> é uma ferramenta de IA que ajuda você a melhorar, transformar e
                  otimizar textos de forma rápida e profissional.
                </p>
                <p>
                  <strong>Como funciona (Modo Padrão):</strong>
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li><strong>Prompt Customizado (opcional):</strong> Digite instruções específicas sobre o que você quer fazer com o texto</li>
                  <li><strong>Texto para Melhorar:</strong> Cole ou digite o texto que deseja processar</li>
                  <li><strong>Enviar para IA:</strong> Clique no botão e aguarde o processamento</li>
                  <li><strong>Resultado:</strong> Visualize o texto melhorado e copie quando estiver satisfeito</li>
                </ol>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded p-3 mt-4">
                  <p className="text-sm">
                    <strong>💡 Dica:</strong> Se você <strong>não</strong> preencher o Prompt Customizado, 
                    o sistema usará um prompt padrão para melhorar gramática, formatação e clareza do texto.
                  </p>
                </div>
              </div>
            </div>

            {/* Modo Ouvidoria */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">⚖️ Modo Ouvidoria</h3>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 space-y-3 text-gray-700 dark:text-gray-300">
                <p>
                  Aba dedicada à elaboração de respostas formais de Ouvidoria. O texto é reescrito
                  em <strong>linguagem formal, terceira pessoa</strong>, com parágrafos espaçados,
                  iniciando com <em>"Trata-se de…"</em> e encerrando com{" "}
                  <em>"É o que nos cumpre informar."</em>.
                </p>
                <p><strong>Campos:</strong></p>
                <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
                  <li>
                    <strong>Prompt Customizado (override — opcional):</strong> se preenchido,
                    <strong> substitui</strong> integralmente o prompt fixo do modo Ouvidoria.
                  </li>
                  <li>
                    <strong>Problema (opcional):</strong> síntese do problema apresentado, usada
                    como base do parágrafo de abertura. Se também houver "Trata-se de…" dentro da
                    Resolução, a IA funde as duas sem duplicar a abertura.
                  </li>
                  <li>
                    <strong>Resolução (obrigatória):</strong> texto principal a ser reescrito.
                  </li>
                </ul>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded p-3 mt-2">
                  <p className="text-sm">
                    <strong>🔒 Garantias:</strong> protocolos, números de processo, números de
                    chamado, datas, horários e nomes próprios são preservados literalmente. A
                    saída é em <strong>texto puro</strong> (sem markdown, listas ou emojis),
                    pronta para colagem em documentos formais.
                  </p>
                </div>
              </div>
            </div>

            {/* Exemplos de Prompts */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">✨ Exemplos de Prompts Customizados</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Clique em "Copiar" para usar qualquer um destes prompts como ponto de partida:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {EXEMPLO_PROMPTS.map((exemplo, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{exemplo.titulo}</h4>
                      <button
                        onClick={() => handleCopyPrompt(exemplo.prompt, index)}
                        className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                          copiedIndex === index
                            ? 'bg-green-100 text-green-700'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                        title="Copiar prompt"
                      >
                        {copiedIndex === index ? (
                          <>✓ Copiado</>
                        ) : (
                          <>
                            <Copy size={12} />
                            Copiar
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{exemplo.prompt}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
            >
              Entendi
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

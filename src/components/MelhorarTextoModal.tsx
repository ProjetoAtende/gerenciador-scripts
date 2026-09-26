import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Copy, Sparkles, Save, HelpCircle, Scale } from "lucide-react";
import { melhorarTextoComIA, melhorarTextoOuvidoria } from "../services/deepseekService";
import { ticketsService } from "../services/ticketsService";
import ReactMarkdown from "react-markdown";
import { PasqualeHelpModal } from "./PasqualeHelpModal";

type PasqualeAba = "padrao" | "ouvidoria";

interface MelhorarTextoModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId?: string; // ID do ticket atual para salvar a resposta
  showSaveButton?: boolean; // Controla se mostra o botão "Salvar Resposta"
  isFullscreen?: boolean; // Se true, renderiza sem o wrapper de fullscreen (para usar em container externo)
}

export const MelhorarTextoModal = ({ isOpen, onClose, ticketId, showSaveButton = true, isFullscreen = false }: MelhorarTextoModalProps) => {
  const [aba, setAba] = useState<PasqualeAba>("padrao");
  const [texto, setTexto] = useState("");
  const [problema, setProblema] = useState("");
  const [promptCustomizado, setPromptCustomizado] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [textoMelhorado, setTextoMelhorado] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Sincronizar edições manuais no textarea com o preview
  useEffect(() => {
    // Só sincroniza se já houver uma resposta da IA e o texto for diferente
    if (textoMelhorado !== null && texto !== textoMelhorado) {
      setTextoMelhorado(texto);
    }
  }, [texto, textoMelhorado]);

  const handleEnviarParaIA = async () => {
    if (!texto.trim()) {
      setErro(
        aba === "ouvidoria"
          ? "Por favor, preencha o campo 'Resolução' antes de enviar."
          : "Por favor, digite um texto antes de enviar."
      );
      return;
    }

    setLoading(true);
    setErro(null);

    const resultado =
      aba === "ouvidoria"
        ? await melhorarTextoOuvidoria({
            resolucao: texto,
            problema: problema.trim() || undefined,
            promptOverride: promptCustomizado.trim() || undefined,
          })
        : await melhorarTextoComIA(
            texto,
            promptCustomizado.trim() || undefined
          );

    setLoading(false);

    if (resultado.erro) {
      setErro(resultado.erro);
    } else {
      setTextoMelhorado(resultado.textoMelhorado);
      setTexto(resultado.textoMelhorado);
    }
  };

  const handleCopyPromptFromHelp = (prompt: string) => {
    setPromptCustomizado(prompt);
    setShowHelpModal(false);
  };

  const handleCopiarTexto = async () => {
    try {
      // Copiar o texto formatado do Preview (resposta da IA)
      if (!textoMelhorado) {
        setErro("Ainda não há resposta da IA para copiar. Clique em 'Enviar para IA' primeiro.");
        return;
      }

      // Pegar o conteúdo HTML do preview
      const previewElement = document.getElementById('preview-formatado');
      if (!previewElement) {
        setErro("Erro ao acessar o preview formatado");
        return;
      }

      // Copiar tanto texto simples quanto HTML formatado
      const htmlContent = previewElement.innerHTML;
      const textContent = previewElement.innerText;

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
          'text/plain': new Blob([textContent], { type: 'text/plain' })
        })
      ]);

      // Feedback visual temporário
      const button = document.getElementById('copiar-btn');
      if (button) {
        const originalText = button.innerText;
        button.innerText = 'Copiado!';
        setTimeout(() => {
          button.innerText = originalText;
        }, 2000);
      }
    } catch (err) {
      console.error('Erro ao copiar:', err);
      setErro("Erro ao copiar texto para a área de transferência");
    }
  };

  const handleSalvarResposta = async () => {
    try {
      if (!textoMelhorado) {
        setErro("Ainda não há resposta da IA para salvar. Clique em 'Enviar para IA' primeiro.");
        return;
      }

      if (!ticketId) {
        setErro("ID do ticket não encontrado. Não é possível salvar a resposta.");
        return;
      }

      setSalvando(true);
      setErro(null);

      // Pegar o conteúdo HTML do preview (mesmo que é copiado)
      const previewElement = document.getElementById('preview-formatado');
      if (!previewElement) {
        setErro("Erro ao acessar o preview formatado");
        setSalvando(false);
        return;
      }

      const htmlContent = previewElement.innerHTML;

      // Salvar no banco de dados
      await ticketsService.saveRespostaIA(ticketId, htmlContent);

      // Feedback visual temporário usando estado React
      setSalvoComSucesso(true);
      setTimeout(() => {
        setSalvoComSucesso(false);
      }, 2000);
    } catch (err) {
      console.error('Erro ao salvar resposta:', err);
      setErro("Erro ao salvar resposta no ticket");
    } finally {
      setSalvando(false);
    }
  };

  const handleClose = () => {
    setTexto("");
    setProblema("");
    setPromptCustomizado("");
    setTextoMelhorado(null);
    setErro(null);
    setLoading(false);
    setAba("padrao");
    onClose();
  };

  const handleTrocarAba = (nova: PasqualeAba) => {
    if (nova === aba) return;
    setAba(nova);
    // Limpa estado dependente da aba para evitar mistura entre fluxos
    setProblema("");
    setPromptCustomizado("");
    setTextoMelhorado(null);
    setErro(null);
  };

  if (!isOpen) return null;

  const isOuvidoria = aba === "ouvidoria";
  const labelTextoPrincipal = isOuvidoria ? "Resolução" : "Digite ou cole seu texto:";
  const placeholderTextoPrincipal = isOuvidoria
    ? "Cole aqui a resolução / texto principal da resposta da Ouvidoria...&#10;&#10;O sistema reescreverá em linguagem formal, em terceira pessoa, iniciando com 'Trata-se de…' e encerrando com 'É o que nos cumpre informar.'."
    : "Digite aqui o texto que deseja melhorar...&#10;&#10;Este campo aceita textos longos e expansivos.";
  const labelPromptCustomizado = isOuvidoria
    ? "Prompt Customizado (override — opcional)"
    : "Prompt Customizado (opcional)";
  const helperPromptCustomizado = isOuvidoria
    ? "💡 Se preenchido, SUBSTITUI o prompt fixo do modo Ouvidoria. Deixe vazio para usar o prompt padrão da Ouvidoria."
    : "💡 Se deixar vazio, será usado o prompt padrão para melhorar gramática e formatação";
  const placeholderPromptCustomizado = isOuvidoria
    ? "Deixe vazio para usar o prompt padrão da Ouvidoria, ou cole aqui um prompt para sobrescrevê-lo..."
    : "Ex: 'Resuma este texto em 3 parágrafos' ou deixe vazio para usar o prompt padrão...";

  const contentArea = (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {/* Tabs + Botão de Ajuda */}
        <div className="px-4 md:px-8 pt-4 md:pt-6 flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Modo do Pasquale"
            className="inline-flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <button
              role="tab"
              aria-selected={aba === "padrao"}
              onClick={() => handleTrocarAba("padrao")}
              disabled={loading || salvando}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                aba === "padrao"
                  ? "bg-white dark:bg-gray-900 text-purple-700 dark:text-purple-300 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <Sparkles size={16} />
              Modo Padrão
            </button>
            <button
              role="tab"
              aria-selected={aba === "ouvidoria"}
              onClick={() => handleTrocarAba("ouvidoria")}
              disabled={loading || salvando}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                aba === "ouvidoria"
                  ? "bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <Scale size={16} />
              Modo Ouvidoria
            </button>
          </div>
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-lg transition-colors font-medium text-sm"
            title="Como usar o Pasquale"
          >
            <HelpCircle size={18} />
            Como usar / Exemplos
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col p-4 md:p-8 pt-4 gap-4 md:gap-6 min-h-0">
          {isOuvidoria && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 text-sm text-indigo-900 dark:text-indigo-200">
              <strong>Modo Ouvidoria ativo.</strong> O texto será reescrito em linguagem formal,
              terceira pessoa, parágrafos espaçados, iniciando com{" "}
              <em>"Trata-se de…"</em> e encerrando com <em>"É o que nos cumpre informar."</em>.
              Preencha a <strong>Resolução</strong> (obrigatória) e, opcionalmente, o{" "}
              <strong>Problema</strong> (síntese para a abertura).
            </div>
          )}

          {/* Área de texto e preview lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 min-h-0">
          {/* Coluna Esquerda: Prompt Customizado + (Problema) + Editor de Texto */}
            <div className="flex flex-col gap-4 min-h-0">
            {/* Prompt Customizado */}
              <div className="flex flex-col">
              <label className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                <Sparkles size={18} className="text-purple-600" />
                {labelPromptCustomizado}
              </label>
              <textarea
                value={promptCustomizado}
                onChange={(e) => setPromptCustomizado(e.target.value)}
                placeholder={placeholderPromptCustomizado}
                className="w-full p-4 border-2 border-purple-200 dark:border-purple-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 resize-none text-sm leading-relaxed overflow-y-auto bg-purple-50 dark:bg-purple-900/20 dark:text-gray-200"
                disabled={loading}
                rows={3}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {helperPromptCustomizado}
              </p>
              </div>

            {/* Problema (apenas no modo Ouvidoria) */}
              {isOuvidoria && (
                <div className="flex flex-col">
                  <label className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                    <Scale size={18} className="text-indigo-600" />
                    Problema (opcional)
                  </label>
                  <textarea
                    value={problema}
                    onChange={(e) => setProblema(e.target.value)}
                    placeholder="Síntese do problema apresentado na manifestação. Ex.: 'dificuldades de acesso ao sistema eproc, apresentadas pelo perito judicial Sr. Fulano de Tal'."
                    className="w-full p-4 border-2 border-indigo-200 dark:border-indigo-700 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 resize-none text-sm leading-relaxed overflow-y-auto bg-indigo-50 dark:bg-indigo-900/20 dark:text-gray-200"
                    disabled={loading}
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 Se preenchido, será usado como base do parágrafo de abertura "Trata-se de…",
                    evitando duplicação caso a Resolução também já contenha essa abertura.
                  </p>
                </div>
              )}

            {/* Editor de Texto / Resolução */}
              <div className="flex-1 flex flex-col min-h-0">
                <label className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  {labelTextoPrincipal}
                </label>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={placeholderTextoPrincipal}
                  className="min-h-[300px] lg:min-h-[420px] w-full p-4 md:p-6 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 resize-none text-base leading-relaxed overflow-y-auto bg-white dark:bg-gray-800 dark:text-gray-200"
                  disabled={loading}
                />
              </div>
            </div>

          {/* Coluna Direita: Preview com Markdown */}
            {textoMelhorado && (
              <div className="flex flex-col min-h-0">
                <label className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <Sparkles size={20} className="text-purple-600" />
                  Preview (formatado):
                </label>
                <div
                  id="preview-formatado"
                  className="min-h-[300px] lg:min-h-[420px] w-full p-4 md:p-6 border-2 border-purple-300 dark:border-purple-700 rounded-lg bg-purple-50 dark:bg-purple-900/20 overflow-y-auto prose prose-sm md:prose-base max-w-none dark:prose-invert"
                >
                  <ReactMarkdown
                    components={{
                      h3: ({ node, ...props }) => (
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-6 mb-3" {...props} />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-6 mb-4" {...props} />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong className="font-bold text-gray-900 dark:text-gray-50" {...props} />
                      ),
                      em: ({ node, ...props }) => (
                        <em className="italic text-gray-800 dark:text-gray-200" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="mb-4 text-gray-700 dark:text-gray-200 leading-relaxed text-base" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc list-inside mb-4 space-y-2 text-gray-700 dark:text-gray-200" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="list-decimal list-inside mb-4 space-y-2 text-gray-700 dark:text-gray-200" {...props} />
                      ),
                    }}
                  >
                    {textoMelhorado}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Mensagem de erro */}
          {erro && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm md:text-base">
              {erro}
            </div>
          )}
        </div>
      </div>

      {/* Footer - Botões */}
      <div className="px-4 md:px-8 py-4 md:py-5 border-t bg-gray-50 dark:bg-gray-800 dark:border-gray-700 flex flex-wrap items-center justify-end gap-2 md:gap-4 shrink-0">
        <button
          onClick={handleClose}
          className="px-4 md:px-6 py-2 md:py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium text-sm md:text-base"
          disabled={loading || salvando}
        >
          Sair
        </button>
        {showSaveButton && (
          <button
            onClick={handleSalvarResposta}
            disabled={loading || salvando || !textoMelhorado || salvoComSucesso}
            className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
            title={textoMelhorado ? "Salvar resposta da IA no ticket" : "Aguardando resposta da IA"}
          >
            {salvoComSucesso ? (
              <>
                <Save size={16} className="md:w-[18px] md:h-[18px]" />
                Salvo!
              </>
            ) : salvando ? (
              <>
                <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save size={16} className="md:w-[18px] md:h-[18px]" />
                Salvar Resposta
              </>
            )}
          </button>
        )}
        <button
          id="copiar-btn"
          onClick={handleCopiarTexto}
          disabled={loading || salvando || !textoMelhorado}
          className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          title={textoMelhorado ? "Copiar texto melhorado pela IA" : "Aguardando resposta da IA"}
        >
          <Copy size={16} className="md:w-[18px] md:h-[18px]" />
          Copiar Resposta da IA
        </button>
        <button
          onClick={handleEnviarParaIA}
          disabled={loading || salvando || !texto.trim()}
          className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processando...
            </>
          ) : (
            <>
              <Send size={16} className="md:w-[18px] md:h-[18px]" />
              Enviar para IA
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Se for fullscreen, renderizar sem o wrapper de modal
  if (isFullscreen) {
    return (
      <>
        <div className="h-full flex flex-col">
          {contentArea}
        </div>
        {/* Modal de Ajuda */}
        <PasqualeHelpModal
          isOpen={showHelpModal}
          onClose={() => setShowHelpModal(false)}
          onCopyPrompt={handleCopyPromptFromHelp}
        />
      </>
    );
  }

  // Modo normal: renderizar com portal e wrapper de modal
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-[95vw] h-[95vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-800">
            <div className="flex items-center gap-3">
              <Sparkles className="text-purple-600" size={24} />
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Melhorar Resposta com IA</h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>

          {contentArea}
        </motion.div>
      </motion.div>
      {/* Modal de Ajuda */}
      <PasqualeHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        onCopyPrompt={handleCopyPromptFromHelp}
      />
    </AnimatePresence>,
    document.body
  );
};

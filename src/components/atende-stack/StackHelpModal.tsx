import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function StackHelpModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[10002] bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stack-help-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between border-b dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-900">
          <h2 id="stack-help-title" className="font-semibold text-lg dark:text-slate-100">
            Como usar o Atende Stack
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar ajuda">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300 space-y-4">
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Anonimato</h3>
            <p>
              Para usuários com perfil operacional, perguntas e respostas aparecem sem nome. Supervisores e acima veem autoria
              para moderação.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Solução e fechamento</h3>
            <p>
              O autor (ou a equipe) pode marcar uma resposta como solução. A pergunta é fechada automaticamente. A equipe pode
              reabrir informando um motivo visível a todos.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Tags</h3>
            <p>
              Use tags para agrupar temas. A primeira grafia de uma tag vira o padrão; variações como “Precatório” e “precatorios”
              unificam-se automaticamente.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Busca</h3>
            <p>
              Digite palavras-chave e escolha buscar em perguntas, respostas ou ambos. Os trechos encontrados são destacados. Filtros
              laterais também se aplicam à busca.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Atalhos</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <kbd className="px-1 rounded bg-slate-100 dark:bg-slate-800">Esc</kbd> — fechar diálogos, sair do rascunho ou fechar o Stack
              </li>
              <li>
                <kbd className="px-1 rounded bg-slate-100 dark:bg-slate-800">/</kbd> — focar a caixa de busca
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

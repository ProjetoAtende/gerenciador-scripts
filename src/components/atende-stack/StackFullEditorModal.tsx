import { useEffect } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { isStackAutorStaff, type StackPerguntaDetalhe } from '../../types/atendeStack';
import { isHtmlEmpty } from '../../utils/htmlUtils';
import { StackHtmlViewer } from './StackHtmlViewer';
import { StackCollapsibleHtmlViewer } from './StackCollapsibleHtmlViewer';
import { StackRichTextEditor } from './StackRichTextEditor';
import { formatStackTimeAgo, stackPublicadoPorLine } from './stackUtils';

interface Props {
  detalhe: StackPerguntaDetalhe;
  isStaff: boolean;
  valueHtml: string;
  onChangeHtml: (html: string) => void;
  salvando: boolean;
  onPublicar: () => void;
  onClose: () => void;
  touchControlClass: string;
}

export function StackFullEditorModal({
  detalhe,
  isStaff,
  valueHtml,
  onChangeHtml,
  salvando,
  onPublicar,
  onClose,
  touchControlClass,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10003] bg-black/55 flex items-center justify-center p-3 sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl h-[80vh] max-h-[80vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stack-full-editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
          <h2 id="stack-full-editor-title" className="font-semibold text-base dark:text-slate-100 truncate">
            Editor completo — {detalhe.titulo}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
            aria-label="Voltar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <section className="flex flex-col min-h-0 lg:w-[55%] border-b lg:border-b-0 lg:border-r dark:border-slate-700">
            <div className="shrink-0 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Sua resposta
            </div>
            <div className="flex-1 min-h-[200px] lg:min-h-0 px-3 pb-3 flex flex-col">
              <StackRichTextEditor
                value={valueHtml}
                onChange={onChangeHtml}
                placeholder="Escreva sua resposta…"
                className="flex-1 min-h-0 h-full"
                fillHeight
              />
            </div>
            <footer className="shrink-0 px-4 py-3 border-t dark:border-slate-700 flex flex-wrap gap-2 justify-end bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2.5 text-sm rounded-lg border dark:border-slate-600 ${touchControlClass}`}
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={salvando || isHtmlEmpty(valueHtml)}
                onClick={onPublicar}
                className={`px-4 py-2.5 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-50 ${touchControlClass}`}
              >
                {salvando ? 'Publicando…' : 'Publicar resposta'}
              </button>
            </footer>
          </section>

          <aside className="flex flex-col min-h-0 lg:w-[45%] bg-slate-100/80 dark:bg-slate-950/50">
            <div className="shrink-0 px-4 py-3 border-b dark:border-slate-700 bg-white dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">Pergunta</p>
              <h3 className="text-sm font-semibold dark:text-slate-100 line-clamp-2">{detalhe.titulo}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {stackPublicadoPorLine(detalhe.autor, detalhe.created_at)}
              </p>
              <div className="mt-2 max-h-32 overflow-y-auto text-sm">
                <StackHtmlViewer html={detalhe.corpo_html} />
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col px-4 py-2">
              <p className="shrink-0 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2">
                {detalhe.resposta_count} respostas
              </p>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                {detalhe.respostas.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma resposta ainda.</p>
                ) : (
                  detalhe.respostas.map((r, idx, arr) => {
                    const allowCollapse = arr.length > 1 && idx < arr.length - 1;
                    return (
                    <article
                      key={r.id}
                      className={`rounded-lg border p-2.5 text-sm bg-white dark:bg-slate-900 dark:border-slate-700 ${
                        r.aceita ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/25' : 'border-slate-200'
                      }`}
                    >
                      {r.aceita && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                          <CheckCircle2 className="w-3 h-3" /> Solução
                        </span>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                        {stackPublicadoPorLine(r.autor, r.created_at)}
                        {isStaff && isStackAutorStaff(r.autor) && (
                          <span className="text-slate-400"> · {r.autor.email}</span>
                        )}
                      </p>
                      <StackCollapsibleHtmlViewer html={r.corpo_html} allowCollapse={allowCollapse} />
                      <p className="text-[10px] text-slate-400 mt-1">{formatStackTimeAgo(r.created_at)}</p>
                    </article>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

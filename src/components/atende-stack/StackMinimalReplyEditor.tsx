import { useCallback, useEffect, useRef, useState } from 'react';
import { isHtmlEmpty } from '../../utils/htmlUtils';
import {
  isStackMinimalCompatibleHtml,
  plainTextToStackReplyHtml,
  stackReplyHtmlToPlainText,
} from '../../utils/stackReplyDraftUtils';

interface Props {
  valueHtml: string;
  onChangeHtml: (html: string) => void;
  placeholder?: string;
  id?: string;
}

const MIN_ROWS = 3;
const MAX_ROWS = 8;

export function StackMinimalReplyEditor({ valueHtml, onChangeHtml, placeholder, id }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastHtmlFromHere = useRef(valueHtml);
  const [plain, setPlain] = useState(() => stackReplyHtmlToPlainText(valueHtml));
  const richLocked = !isStackMinimalCompatibleHtml(valueHtml);

  useEffect(() => {
    if (richLocked) return;
    if (valueHtml === lastHtmlFromHere.current) return;
    lastHtmlFromHere.current = valueHtml;
    setPlain(stackReplyHtmlToPlainText(valueHtml));
  }, [valueHtml, richLocked]);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 22;
    const minH = lineHeight * MIN_ROWS + 16;
    const maxH = lineHeight * MAX_ROWS + 16;
    el.style.height = `${Math.min(maxH, Math.max(minH, el.scrollHeight))}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [plain, resize]);

  const handleChange = (nextPlain: string) => {
    setPlain(nextPlain);
    const html = plainTextToStackReplyHtml(nextPlain);
    lastHtmlFromHere.current = html;
    onChangeHtml(html);
  };

  if (richLocked && !isHtmlEmpty(valueHtml)) {
    return (
      <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 px-3 py-2.5 text-sm text-indigo-950 dark:text-indigo-100">
        <p className="font-medium">Formatação avançada no rascunho</p>
        <p className="text-xs mt-1 text-indigo-800/90 dark:text-indigo-200/90 line-clamp-3">
          {stackReplyHtmlToPlainText(valueHtml) || 'Conteúdo com mídia ou formatação.'}
        </p>
        <p className="text-xs mt-2 text-indigo-700 dark:text-indigo-300">Continue no Editor completo.</p>
      </div>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      id={id}
      value={plain}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder ?? 'Resposta curta…'}
      rows={MIN_ROWS}
      className="w-full resize-none rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
    />
  );
}

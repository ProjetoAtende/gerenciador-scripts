import { useEffect, useMemo, useRef, useState } from 'react';
import { useDarkModeColorFix } from '../../hooks/useDarkModeColorFix';
import { sanitizeStackHtml } from '../../utils/sanitizeStackHtml';

interface Props {
  html: string;
  className?: string;
  /**
   * Quando false, o texto fica sempre expandido (sem Ver mais/menos).
   * Use para a única resposta ou a última do thread.
   */
  allowCollapse?: boolean;
}

export function StackCollapsibleHtmlViewer({ html, className = '', allowCollapse = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [collapsible, setCollapsible] = useState(false);

  useDarkModeColorFix(ref);
  const safeHtml = useMemo(() => sanitizeStackHtml(html), [html]);

  useEffect(() => {
    setExpanded(false);
    setCollapsible(false);
  }, [html, allowCollapse]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !allowCollapse || expanded) return;

    const check = () => {
      setCollapsible(el.scrollHeight > el.clientHeight + 1);
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [safeHtml, expanded, allowCollapse]);

  const clamped = allowCollapse && !expanded;

  return (
    <div className={className}>
      <div
        ref={ref}
        className={`prose prose-sm dark:prose-invert max-w-none stack-html-viewer break-words ${
          clamped ? 'line-clamp-1' : ''
        }`}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
      {allowCollapse && collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline min-h-[44px] inline-flex items-center"
        >
          {expanded ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
    </div>
  );
}

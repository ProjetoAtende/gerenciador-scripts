import { useMemo, useRef } from 'react';
import { useDarkModeColorFix } from '../../hooks/useDarkModeColorFix';
import { sanitizeStackHtml } from '../../utils/sanitizeStackHtml';

interface Props {
  html: string;
  className?: string;
}

export function StackHtmlViewer({ html, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDarkModeColorFix(ref);
  const safeHtml = useMemo(() => sanitizeStackHtml(html), [html]);

  return (
    <div
      ref={ref}
      className={`prose prose-sm dark:prose-invert max-w-none stack-html-viewer ${className}`}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

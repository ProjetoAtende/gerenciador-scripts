import { sanitizeHighlightHtml } from '../../utils/sanitizeHighlightHtml';

interface Props {
  html: string;
  className?: string;
}

export function StackHighlightSnippet({ html, className = '' }: Props) {
  const safe = sanitizeHighlightHtml(html);
  if (!safe) return null;
  return (
    <p
      className={`text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 [&_mark]:bg-amber-200 dark:[&_mark]:bg-amber-500/50 [&_mark]:text-slate-900 dark:[&_mark]:text-slate-100 ${className}`}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

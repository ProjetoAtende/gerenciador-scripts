import DOMPurify from 'dompurify';

const HIGHLIGHT_ALLOWED_TAGS = ['mark', 'b', 'strong', 'em', 'i', 'br', 'span'];

/** Sanitiza snippets FTS (ts_headline) permitindo apenas highlight seguro. */
export function sanitizeHighlightHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: HIGHLIGHT_ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}

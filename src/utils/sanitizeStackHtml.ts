import DOMPurify from 'dompurify';

const STACK_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'code',
  'pre',
  'span',
  'div',
];

const STACK_ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height', 'style'];

const TEXT_ALIGN_STYLE = /^text-align\s*:\s*(left|right|center|justify)\s*;?\s*$/i;

let stackSanitizeHooks = false;

function ensureStackSanitizeHooks() {
  if (stackSanitizeHooks) return;
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName !== 'style') return;
    const val = (data.attrValue ?? '').trim();
    if (!TEXT_ALIGN_STYLE.test(val)) {
      data.keepAttr = false;
    }
  });
  stackSanitizeHooks = true;
}

/** Bloqueia javascript:, data:, vbscript: e URLs vazias no editor e na exibição. */
export function isAllowedLinkUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isAllowedImageSrc(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function hardenLinks(root: HTMLElement) {
  root.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') ?? '';
    if (!isAllowedLinkUrl(href)) {
      anchor.removeAttribute('href');
      return;
    }
    if (href.startsWith('http://') || href.startsWith('https://')) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

function hardenImages(root: HTMLElement) {
  root.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src') ?? '';
    if (!isAllowedImageSrc(src)) {
      img.remove();
    }
  });
}

/** Sanitiza HTML de perguntas/respostas do Atende Stack antes de renderizar. */
export function sanitizeStackHtml(html: string | null | undefined): string {
  if (!html) return '';
  ensureStackSanitizeHooks();
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: STACK_ALLOWED_TAGS,
    ALLOWED_ATTR: STACK_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
  const wrapper = document.createElement('div');
  wrapper.innerHTML = clean;
  hardenLinks(wrapper);
  hardenImages(wrapper);
  return wrapper.innerHTML;
}

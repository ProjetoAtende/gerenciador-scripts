import { isHtmlEmpty } from './htmlUtils';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Converte texto plano (resposta curta) em HTML simples para o backend. */
export function plainTextToStackReplyHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.trim()) return '';

  const lines = normalized.split('\n');
  return lines.map((line) => `<p>${line.trim() ? escapeHtml(line) : '<br>'}</p>`).join('');
}

/** Extrai texto multilinha de HTML simples para o editor mínimo. */
export function stackReplyHtmlToPlainText(html: string): string {
  if (isHtmlEmpty(html)) return '';

  const div = document.createElement('div');
  div.innerHTML = html.replace(/<br\s*\/?>/gi, '\n');

  const paragraphs = div.querySelectorAll('p');
  if (paragraphs.length > 0) {
    return Array.from(paragraphs)
      .map((p) => (p.textContent ?? '').replace(/\u00a0/g, ' '))
      .join('\n')
      .replace(/\n+$/, '');
  }

  return (div.textContent ?? '').replace(/\u00a0/g, ' ');
}

/** HTML que exige o editor completo (não editável de forma segura no campo mínimo). */
export function isStackMinimalCompatibleHtml(html: string): boolean {
  if (isHtmlEmpty(html)) return true;

  const div = document.createElement('div');
  div.innerHTML = html;

  if (
    div.querySelector(
      'img, video, audio, iframe, embed, object, table, ul, ol, h1, h2, h3, h4, a, b, strong, i, em, u, s, strike, font, [style]',
    )
  ) {
    return false;
  }

  const plain = stackReplyHtmlToPlainText(html);
  const roundTrip = plainTextToStackReplyHtml(plain);
  const norm = (s: string) => stackReplyHtmlToPlainText(s).trim();
  return norm(html) === norm(roundTrip);
}

import React from 'react';

/**
 * Regex para tokens interativos de scripts:
 * - {[opt1][opt2]} → dropdown (renderizado como badge estático)
 * - () → campo livre (renderizado como badge estático)
 */
const TOKEN_REGEX = /\{\[((?:[^\[\]]+)(?:\]\[.*?)*?)\]\}|\(\)/g;

/** Tags HTML void (sem children) */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Renderiza HTML de scripts como React nodes somente-leitura.
 * Baseado em renderHtmlWithChips() do GeradorModal, mas sem EditableChip.
 * Tokens {[opt1][opt2]} e () são renderizados como badges estáticos.
 */
export function renderHtmlReadonly(html: string): React.ReactNode[] {
  if (!html || typeof window === 'undefined') return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let tokenIndex = 0;
  let nodeKeyCounter = 0;

  const mapNode = (node: ChildNode): React.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      const parts: React.ReactNode[] = [];
      let lastIdx = 0;
      let match;
      let partKey = 0;

      TOKEN_REGEX.lastIndex = 0;
      while ((match = TOKEN_REGEX.exec(text))) {
        if (match.index > lastIdx) {
          parts.push(
            <React.Fragment key={`txt-${nodeKeyCounter}-${partKey++}`}>
              {text.slice(lastIdx, match.index)}
            </React.Fragment>
          );
        }

        const tokenText = match[0];
        const currentIdx = tokenIndex++;

        if (tokenText.startsWith('{[')) {
          // Dropdown: mostrar opções como badge
          const opcoes = match[1].split('][');
          parts.push(
            <span
              key={`token-${currentIdx}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300"
              title={`Opções: ${opcoes.join(', ')}`}
            >
              📝 {opcoes[0]}{opcoes.length > 1 ? ` (+${opcoes.length - 1})` : ''}
            </span>
          );
        } else {
          // Input livre: badge placeholder
          parts.push(
            <span
              key={`token-${currentIdx}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-300"
            >
              📝 Campo livre
            </span>
          );
        }

        lastIdx = TOKEN_REGEX.lastIndex;
      }

      if (lastIdx < text.length) {
        parts.push(
          <React.Fragment key={`txt-${nodeKeyCounter}-${partKey++}`}>
            {text.slice(lastIdx)}
          </React.Fragment>
        );
      }

      nodeKeyCounter++;
      return parts.length === 1 ? parts[0] : parts;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();
      const key = `el-${nodeKeyCounter++}`;

      // Bloquear scripts e estilos
      if (tag === 'script' || tag === 'style') return null;

      // Void elements
      if (VOID_ELEMENTS.has(tag)) {
        if (tag === 'br') return <br key={key} />;
        if (tag === 'hr') return <hr key={key} />;
        if (tag === 'img') {
          return (
            <img
              key={key}
              src={element.getAttribute('src') ?? ''}
              alt={element.getAttribute('alt') ?? ''}
              title={element.getAttribute('title') ?? undefined}
              style={{ maxWidth: '100%' }}
            />
          );
        }
        return React.createElement(tag, { key });
      }

      const children = Array.from(element.childNodes).map(mapNode);

      if (tag === 'a') {
        return (
          <a
            key={key}
            href={element.getAttribute('href') ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        );
      }

      return React.createElement(tag, { key }, children);
    }

    return null;
  };

  return Array.from(doc.body.childNodes).map(mapNode);
}

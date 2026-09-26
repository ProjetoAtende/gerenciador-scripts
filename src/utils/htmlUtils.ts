// htmlUtils.ts - Utilitários para manipulação de HTML
export const isHtmlEmpty = (html: string | undefined | null): boolean => {
  if (!html) return true;

  // Criar elemento temporário para parse do HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Extrair apenas o texto, removendo todas as tags HTML
  const textContent = tempDiv.textContent || tempDiv.innerText || '';

  // Verificar se o texto limpo está vazio ou contém apenas whitespace
  const hasRealText = textContent.trim().length > 0;

  // Verificar se há imagens ou outros elementos de mídia que não são texto
  const hasImages = tempDiv.querySelectorAll('img').length > 0;
  const hasVideo = tempDiv.querySelectorAll('video').length > 0;
  const hasAudio = tempDiv.querySelectorAll('audio').length > 0;
  const hasEmbeds = tempDiv.querySelectorAll('embed, iframe, object').length > 0;

  // Considerar não vazio se há texto real ou elementos de mídia
  return !(hasRealText || hasImages || hasVideo || hasAudio || hasEmbeds);
};

export const getTextFromHtml = (html: string | undefined | null): string => {
  if (!html) return '';

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return (tempDiv.textContent || tempDiv.innerText || '').replace(/\s+/g, ' ').trim();
};

export const truncateTextAtWord = (text: string, maxLength = 100): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  const safeText = lastSpaceIndex > Math.floor(maxLength * 0.6)
    ? truncated.slice(0, lastSpaceIndex)
    : truncated;

  return `${safeText.trimEnd()}...`;
};

export const getTextPreviewFromHtml = (html: string | undefined | null, maxLength = 100): string => {
  return truncateTextAtWord(getTextFromHtml(html), maxLength);
};

export const normalizeEmptyHtml = (html: string): string => {
  if (isHtmlEmpty(html)) {
    return '';
  }
  return html;
};

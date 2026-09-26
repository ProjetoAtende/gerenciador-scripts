// utils/mediaPlaceholders.ts - Utilitário para extrair e restaurar mídias do HTML
// Usado para enviar texto à IA sem imagens/vídeos (que consomem muitos tokens)

export interface MediaItem {
  id: string;
  type: 'img' | 'video' | 'iframe';
  fullTag: string;
  placeholder: string;
}

export interface MediaExtractionResult {
  cleanHtml: string;
  mediaItems: MediaItem[];
  originalHtml: string;
}

/**
 * Extrai todas as tags de mídia (img, video, iframe) do HTML,
 * substituindo-as por placeholders que a IA deve preservar.
 */
export function extractMediaFromHtml(html: string): MediaExtractionResult {
  const mediaItems: MediaItem[] = [];
  let cleanHtml = html;
  let mediaIndex = 0;

  // Regex para capturar tags de mídia completas
  // Captura: <img ... />, <img ...>, <video ...>...</video>, <iframe ...>...</iframe>
  
  // 1. Extrair tags <img> (self-closing ou não)
  const imgRegex = /<img\s[^>]*(?:\/>|>(?:<\/img>)?)/gi;
  cleanHtml = cleanHtml.replace(imgRegex, (match) => {
    const id = `MEDIA_${mediaIndex++}`;
    const placeholder = `<!--${id}-->`;
    mediaItems.push({
      id,
      type: 'img',
      fullTag: match,
      placeholder,
    });
    return placeholder;
  });

  // 2. Extrair tags <video> com conteúdo
  const videoRegex = /<video\s[^>]*>[\s\S]*?<\/video>/gi;
  cleanHtml = cleanHtml.replace(videoRegex, (match) => {
    const id = `MEDIA_${mediaIndex++}`;
    const placeholder = `<!--${id}-->`;
    mediaItems.push({
      id,
      type: 'video',
      fullTag: match,
      placeholder,
    });
    return placeholder;
  });

  // 3. Extrair tags <video> self-closing (sem conteúdo)
  const videoSelfClosingRegex = /<video\s[^>]*(?:\/>|>)(?![\s\S]*?<\/video>)/gi;
  cleanHtml = cleanHtml.replace(videoSelfClosingRegex, (match) => {
    // Verificar se não é parte de um video já extraído
    if (match.includes('</video>')) return match;
    const id = `MEDIA_${mediaIndex++}`;
    const placeholder = `<!--${id}-->`;
    mediaItems.push({
      id,
      type: 'video',
      fullTag: match,
      placeholder,
    });
    return placeholder;
  });

  // 4. Extrair tags <iframe>
  const iframeRegex = /<iframe\s[^>]*>[\s\S]*?<\/iframe>/gi;
  cleanHtml = cleanHtml.replace(iframeRegex, (match) => {
    const id = `MEDIA_${mediaIndex++}`;
    const placeholder = `<!--${id}-->`;
    mediaItems.push({
      id,
      type: 'iframe',
      fullTag: match,
      placeholder,
    });
    return placeholder;
  });

  return {
    cleanHtml,
    mediaItems,
    originalHtml: html,
  };
}

/**
 * Restaura as tags de mídia no HTML processado pela IA,
 * substituindo os placeholders pelas tags originais.
 */
export function restoreMediaInHtml(
  processedHtml: string, 
  mediaItems: MediaItem[]
): string {
  let restoredHtml = processedHtml;

  // Restaurar cada mídia pelo seu placeholder
  for (const media of mediaItems) {
    // O placeholder pode estar como comentário HTML ou como texto simples
    // dependendo de como a IA o processou
    
    // Tentar restaurar o placeholder exato (comentário HTML)
    if (restoredHtml.includes(media.placeholder)) {
      restoredHtml = restoredHtml.replace(media.placeholder, media.fullTag);
      continue;
    }

    // Tentar variações que a IA pode ter criado
    const variations = [
      `<!-- ${media.id} -->`,
      `<!--${media.id} -->`,
      `<!-- ${media.id}-->`,
      `[${media.id}]`,
      `{${media.id}}`,
      media.id,
    ];

    let restored = false;
    for (const variation of variations) {
      if (restoredHtml.includes(variation)) {
        restoredHtml = restoredHtml.replace(variation, media.fullTag);
        restored = true;
        break;
      }
    }

    // Se o placeholder não foi encontrado, adicionar a mídia ao final
    // para garantir que não seja perdida
    if (!restored) {
      console.warn(`Placeholder ${media.id} não encontrado no HTML processado. Mídia será adicionada ao final.`);
      restoredHtml += `\n${media.fullTag}`;
    }
  }

  return restoredHtml;
}

/**
 * Verifica se o HTML contém mídias que precisam ser extraídas
 */
export function htmlContainsMedia(html: string): boolean {
  const mediaRegex = /<(img|video|iframe)\s/i;
  return mediaRegex.test(html);
}

/**
 * Estima o número de tokens que as mídias consomem (aproximado)
 * Útil para decidir se vale a pena extrair as mídias
 */
export function estimateMediaTokens(html: string): number {
  // Base64 images são especialmente grandes
  const base64Matches = html.match(/data:image\/[^;]+;base64,[^"'\s>]+/g) || [];
  let totalChars = 0;
  
  for (const match of base64Matches) {
    totalChars += match.length;
  }

  // Aproximação: 1 token ≈ 4 caracteres para base64
  // Isso é uma estimativa conservadora
  return Math.ceil(totalChars / 4);
}

/**
 * Conta o número de mídias no HTML
 */
export function countMediaInHtml(html: string): { images: number; videos: number; iframes: number; total: number } {
  const images = (html.match(/<img\s/gi) || []).length;
  const videos = (html.match(/<video\s/gi) || []).length;
  const iframes = (html.match(/<iframe\s/gi) || []).length;
  
  return {
    images,
    videos,
    iframes,
    total: images + videos + iframes,
  };
}

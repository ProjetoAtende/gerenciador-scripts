// src/utils/metaExtractor.ts
export interface LinkMetadata {
  title: string;
  domain: string;
  favicon_url: string;
}

export const extractMetadata = async (url: string): Promise<LinkMetadata> => {
  try {
    // Normalizar URL
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const urlObj = new URL(normalizedUrl);
    const domain = urlObj.hostname.replace('www.', '');

    // Para favicon, usar um serviço público
    const favicon_url = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

    // Para título, extrair do domínio como fallback
    const title = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

    return {
      title,
      domain,
      favicon_url
    };
  } catch (error) {
    console.error('Erro ao extrair metadata:', error);
    return {
      title: 'Link',
      domain: 'unknown',
      favicon_url: 'https://www.google.com/s2/favicons?domain=example.com&sz=64'
    };
  }
};
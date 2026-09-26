/** URL pública da app (GitHub Pages). Deve coincidir com `base` em vite.config.ts e o nome do repositório. */
export const APP_GITHUB_PAGES_ORIGIN =
  (import.meta.env.VITE_APP_PUBLIC_ORIGIN as string | undefined)?.replace(/\/$/, '') ||
  'https://projetoatende.github.io/gerenciador-scripts';

export const APP_HOME_URL = `${APP_GITHUB_PAGES_ORIGIN}/#/home`;

/** Rótulo curto para rodapés de e-mail (sem protocolo). */
export const APP_PUBLIC_SITE_LABEL = APP_GITHUB_PAGES_ORIGIN.replace(/^https?:\/\//, '');

export function appHomeUrlWithQuery(params: Record<string, string>): string {
  const q = new URLSearchParams(params).toString();
  return q ? `${APP_HOME_URL}?${q}` : APP_HOME_URL;
}

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { arquivoUnicoDemo } from './vite-plugins/arquivoUnicoDemo';

/**
 * Build de DEMONSTRAÇÃO: o app inteiro num único arquivo .html, aberto com dois cliques
 * (sem servidor, sem instalar nada). Liga-se SOMENTE ao projeto Supabase de TESTES.
 *
 *   npm run build:demo   →   dist-demo/demonstracao-gerenciador.html
 *
 * Não altera o build de produção (vite.config.ts) nem o deploy.
 */
const REF_TESTES = 'utjkliwzwmifejqysmsy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (!env.VITE_SUPABASE_URL?.includes(REF_TESTES)) {
    throw new Error(
      `Build de demonstração recusado: VITE_SUPABASE_URL não aponta para o projeto de TESTES (${REF_TESTES}).`,
    );
  }

  return {
    base: './',
    publicDir: false, // as imagens usadas são embutidas pelo plugin
    plugins: [react(), arquivoUnicoDemo({ raiz: process.cwd(), nomeArquivo: 'demonstracao-gerenciador.html' })],
    build: {
      outDir: 'dist-demo',
      emptyOutDir: true,
      // Tudo (imagens, fontes) embutido como data URI.
      assetsInlineLimit: () => true,
      cssCodeSplit: false,
      modulePreload: false,
      chunkSizeWarningLimit: 100_000,
      rollupOptions: {
        output: { inlineDynamicImports: true },
      },
    },
  };
});

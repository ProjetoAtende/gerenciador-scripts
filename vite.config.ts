/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devUploadPlugin } from './vite-plugins/devUploadPlugin'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(() => ({
  // Para GitHub Pages em subdiretório, use o nome do repositório
  // Use CAPACITOR=true apenas para build Android
  base: '/gerenciador-scripts/',
  optimizeDeps: {
    // Evita cache inconsistente do prebundle em desenvolvimento no Windows.
    force: true,
  },
  plugins: [
    react(),
    devUploadPlugin(),
    // Desabilita visualizer no CI para evitar erro de path undefined no treemap
    !process.env.CI && visualizer({
      filename: 'reports/bundle-stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-framer': ['framer-motion'],
          'vendor-recharts': ['recharts'],
          'vendor-ui': ['@headlessui/react', 'lucide-react', 'sonner'],
          'vendor-pdf': ['pdfjs-dist'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    css: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/archive/**'],
  },
}))

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.jus.tjsp.atende.gerenciador',
  appName: 'Gerenciador Atende',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    backgroundColor: '#1f2937',
    webContentsDebuggingEnabled: true
  },
  server: {
    // Permitir HTTPS para Supabase
    androidScheme: 'https'
  }
};

export default config;

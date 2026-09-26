// ============================================================================
// VITE PLUGIN: Dev Upload
// ============================================================================
// Expõe POST /api/dev/upload apenas no servidor de desenvolvimento.
// Recebe o arquivo Excel como corpo binário (application/octet-stream),
// salva em temp, executa scripts/upload-oraculo.ts via Node child_process
// e faz stream do output de volta como SSE para o monitor no browser.
// ============================================================================

import type { Plugin } from 'vite';
import { spawn } from 'child_process';
import { writeFileSync, unlink } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

export function devUploadPlugin(): Plugin {
  return {
    name: 'dev-upload-plugin',
    apply: 'serve', // apenas no servidor de desenvolvimento

    configureServer(server) {
      server.middlewares.use(
        '/api/dev/upload',
        (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          // ---- Metadados da requisição ----
          const rawFilename = req.headers['x-filename'];
          const originalName = rawFilename
            ? decodeURIComponent(String(rawFilename))
            : 'upload.xlsx';

          // Nome seguro para o arquivo temporário (sem espaços, sem caracteres especiais)
          const safeFilename = originalName.replace(/[^\w.\-]/g, '_');
          const tempPath = join(tmpdir(), `oraculo-${Date.now()}-${safeFilename}`);

          const manterDados = req.headers['x-manter-dados'] === '1';
          const modoDiff = req.headers['x-modo-diff'] === '1';
          const planilhaAno = (req.headers['x-planilha-ano'] as string | undefined)?.trim();

          // ---- Coleta o body binário ----
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => chunks.push(chunk));

          req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            writeFileSync(tempPath, buffer);

            // ---- Configura resposta SSE ----
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('X-Accel-Buffering', 'no'); // evita buffering em proxies/nginx

            // Emite mensagem inicial com nome original
            sendSSE(res, 'stdout', `📂 Arquivo: ${originalName}\n`);

            // ---- Spawna o script ----
            // Usa o Node atual diretamente (sem npx, sem shell) para evitar
            // problemas de SIGTERM no Windows com shell:true + NODE_OPTIONS.
            // --import tsx carrega o transpilador TypeScript via ESM loader hook.
            // --max-old-space-size aumenta o heap para planilhas grandes (~64k linhas).
            const scriptArgs = [
              '--max-old-space-size=4096',
              '--import', 'tsx',
              join(process.cwd(), 'scripts', 'upload-oraculo.ts'),
              tempPath,
            ];
            if (modoDiff) {
              scriptArgs.push('--modo-diff');
              if (planilhaAno && ['2025', '2026', 'all'].includes(planilhaAno)) {
                scriptArgs.push('--planilha', planilhaAno);
              }
            } else if (manterDados) {
              scriptArgs.push('--manter-dados');
            }

            const child = spawn(process.execPath, scriptArgs, {
              cwd: process.cwd(),
              env: { ...process.env },
              shell: false,
            });

            child.stdout.on('data', (data: Buffer) =>
              sendSSE(res, 'stdout', data.toString()),
            );

            child.stderr.on('data', (data: Buffer) =>
              sendSSE(res, 'stderr', data.toString()),
            );

            let childDone = false;

            child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
              childDone = true;
              if (signal) {
                sendSSE(res, 'stderr', `\n💥 Processo encerrado por sinal: ${signal}\n`);
              }
              sendSSE(res, 'done', String(code ?? 1));
              try { res.end(); } catch { /* cliente desconectado */ }
              unlink(tempPath, () => {/* ignora erro de limpeza */});
            });

            // Se o cliente fechar a conexão SSE antes do script terminar
            // IMPORTANTE: usar res.on('close'), NÃO req.on('close').
            // req.on('close') dispara logo após req.on('end') (body recebido)
            // e mataria o processo imediatamente.
            res.on('close', () => {
              if (!childDone) {
                child.kill();
                unlink(tempPath, () => {});
              }
            });
          });

          req.on('error', () => {
            res.statusCode = 500;
            res.end('Internal Server Error');
          });
        },
      );
    },
  };
}

// ---- helper ----
function sendSSE(
  res: ServerResponse,
  type: 'stdout' | 'stderr' | 'done',
  text: string,
): void {
  try {
    res.write(`data: ${JSON.stringify({ type, text })}\n\n`);
  } catch {
    /* cliente desconectado */
  }
}

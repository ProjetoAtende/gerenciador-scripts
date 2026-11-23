import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import type { OutputAsset, OutputChunk } from 'rollup';

/**
 * Empacota o build num único arquivo .html, para a DEMONSTRAÇÃO aberta com dois cliques
 * (file://), sem servidor. Usado só por `vite.demo.config.ts`; o build de produção não muda.
 *
 * - Embute o JavaScript e o CSS dentro do HTML (o navegador não carrega scripts "module"
 *   de arquivos separados quando a página é aberta direto do disco).
 * - Troca as imagens de `public/` lidas por `${import.meta.env.BASE_URL}arquivo.png` por
 *   imagens embutidas (data URI), pois não haverá a pasta `public` ao lado do arquivo.
 * - Acrescenta a faixa "Demonstração" e muda o título da aba.
 */
export function arquivoUnicoDemo(opcoes: { raiz: string; nomeArquivo: string }): Plugin {
  const pastaPublica = path.join(opcoes.raiz, 'public');

  const dataUri = (arquivo: string) => {
    const caminho = path.join(pastaPublica, arquivo);
    const ext = path.extname(arquivo).slice(1).toLowerCase();
    const tipo = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${tipo};base64,${fs.readFileSync(caminho).toString('base64')}`;
  };

  return {
    name: 'arquivo-unico-demo',
    enforce: 'pre',
    transform(codigo, id) {
      if (!/\.(t|j)sx?$/.test(id) || id.includes('node_modules')) return null;
      const re = /`\$\{import\.meta\.env\.BASE_URL\}([\w.-]+\.(?:png|jpe?g|svg|webp|gif))`/g;
      if (!re.test(codigo)) return null;
      re.lastIndex = 0;
      return {
        code: codigo.replace(re, (_t, arquivo: string) => JSON.stringify(dataUri(arquivo))),
        map: null,
      };
    },
    transformIndexHtml(html) {
      return html
        .replace(/<link rel="icon"[^>]*>\s*/, '')
        .replace(/<title>[^<]*<\/title>/, '<title>Gerenciador Atende — DEMONSTRAÇÃO (dados fictícios)</title>')
        .replace(
          '</body>',
          `<div style="position:fixed;left:8px;bottom:8px;z-index:2147483647;pointer-events:none;` +
            `background:#A11116;color:#fff;font:600 11px/1.2 Inter,Arial,sans-serif;padding:4px 8px;` +
            `border-radius:4px;opacity:.85;letter-spacing:.02em">DEMONSTRAÇÃO · banco de testes · dados fictícios</div>\n</body>`,
        );
    },
    // 'post': o HTML só existe no pacote depois do plugin de HTML do Vite.
    generateBundle: {
      order: 'post',
      handler(_saida, pacote) {
      const html = Object.values(pacote).find(
        (f): f is OutputAsset => f.type === 'asset' && f.fileName.endsWith('.html'),
      );
      if (!html) throw new Error('arquivo-unico-demo: HTML não encontrado no build.');
      let texto = String(html.source);

      const chunks = Object.values(pacote).filter((f): f is OutputChunk => f.type === 'chunk');
      if (chunks.length !== 1) {
        throw new Error(
          `arquivo-unico-demo: esperava 1 arquivo JavaScript, veio ${chunks.length} ` +
            `(${chunks.map((c) => c.fileName).join(', ')}).`,
        );
      }
      const [js] = chunks;
      // "</script" dentro do código fecharia a tag antes da hora.
      const codigo = js.code.replace(/<\/(script)/gi, '<\\/$1');
      const reScript = new RegExp(`<script[^>]*src="[^"]*${escapar(js.fileName)}"[^>]*></script>`);
      if (!reScript.test(texto)) throw new Error('arquivo-unico-demo: tag do script não encontrada.');
      texto = texto.replace(reScript, () => `<script type="module">\n${codigo}\n</script>`);
      delete pacote[js.fileName];

      for (const css of Object.values(pacote)) {
        if (css.type !== 'asset' || !css.fileName.endsWith('.css')) continue;
        const reLink = new RegExp(`<link[^>]*href="[^"]*${escapar(css.fileName)}"[^>]*>`);
        texto = texto.replace(reLink, () => `<style>\n${String(css.source)}\n</style>`);
        delete pacote[css.fileName];
      }
      // Tira modulepreloads que tenham sobrado.
      texto = texto.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');

      const sobras = Object.keys(pacote).filter((n) => n !== html.fileName);
      if (sobras.length > 0) {
        this.warn(`arquivos que ficaram fora do HTML (não serão usados): ${sobras.join(', ')}`);
      }

      delete pacote[html.fileName];
      this.emitFile({ type: 'asset', fileName: opcoes.nomeArquivo, source: texto });
      },
    },
  };
}

function escapar(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

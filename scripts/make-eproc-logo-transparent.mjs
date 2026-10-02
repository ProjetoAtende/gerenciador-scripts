/**
 * Gera eproc-logo.png (fundo transparente) e eproc-logo-dark.png
 * (mesmos azuis do claro, texto "eproc" em branco, fundo transparente).
 *
 * Uso: npm install sharp --no-save && node scripts/make-eproc-logo-transparent.mjs
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const input = join(publicDir, 'eproc-logo.png');
const lightOut = join(publicDir, 'eproc-logo.png');
const darkOut = join(publicDir, 'eproc-logo-dark.png');
const WHITE_THRESHOLD = 248;

function stripWhiteBackground(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
      data[i + 3] = 0;
    }
  }
  return data;
}

function isEprocBlue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (max < 35 || chroma < 18) return false;
  return b >= max - 3 && b > r + 6 && g >= r - 10;
}

function shouldWhitenForDark(r, g, b, a) {
  if (a < 8) return false;
  if (isEprocBlue(r, g, b)) return false;
  const max = Math.max(r, g, b);
  return max <= 200;
}

function toDarkVariant(lightData) {
  const out = Buffer.from(lightData);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const a = out[i + 3];
    if (!shouldWhitenForDark(r, g, b, a)) continue;
    out[i] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
  }
  return out;
}

async function loadRaw(path) {
  return sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function saveRaw(data, info, path) {
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(path);
}

const { data, info } = await loadRaw(input);
const lightData = stripWhiteBackground(Buffer.from(data));
await saveRaw(lightData, info, lightOut);

const darkData = toDarkVariant(lightData);
await saveRaw(darkData, info, darkOut);

console.log(`OK: ${lightOut}`);
console.log(`OK: ${darkOut} (${info.width}x${info.height})`);

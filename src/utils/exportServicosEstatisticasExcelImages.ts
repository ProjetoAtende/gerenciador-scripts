/**
 * Exporta capturas (html2canvas) do conteúdo de cada sub-aba para abas do Excel.
 */

import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';

export interface ExportServicosEstatisticasMeta {
  equipeNome: string;
  periodoLabel: string;
}

export interface AbaCapturaExcel {
  sheetName: string;
  element: HTMLElement;
}

const MAX_IMAGE_WIDTH_PX = 920;

function safeFilePart(s: string): string {
  return s.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 40);
}

function downloadExcelBuffer(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Altura real do bloco (scrollHeight falha em painéis off-screen ou com flex). */
function medirAlturaCaptura(el: HTMLElement): number {
  const root = el.getBoundingClientRect();
  let bottom = root.bottom;
  el.querySelectorAll('*').forEach(node => {
    const h = node as HTMLElement;
    const r = h.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      bottom = Math.max(bottom, r.bottom);
    }
  });
  const fromChildren = Math.ceil(bottom - root.top);
  return Math.max(el.scrollHeight, el.offsetHeight, fromChildren) + 48;
}

function medirLarguraCaptura(el: HTMLElement): number {
  return Math.max(el.scrollWidth, el.offsetWidth, el.clientWidth, 1080);
}

async function capturarElemento(el: HTMLElement, darkMode: boolean): Promise<HTMLCanvasElement> {
  const bg = darkMode ? '#111827' : '#ffffff';

  const prev = {
    overflow: el.style.overflow,
    height: el.style.height,
    minHeight: el.style.minHeight,
  };
  el.style.overflow = 'visible';
  el.style.height = 'auto';
  el.style.minHeight = 'auto';

  try {
    const width = medirLarguraCaptura(el);
    const height = medirAlturaCaptura(el);

    return await html2canvas(el, {
      scale: Math.min(2, window.devicePixelRatio || 1.5),
      useCORS: true,
      logging: false,
      backgroundColor: bg,
      width,
      height,
      scrollX: 0,
      scrollY: 0,
      onclone: (_doc, clone) => {
        const root = clone as HTMLElement;
        root.style.overflow = 'visible';
        root.style.height = 'auto';
        root.style.minHeight = 'auto';
        root.querySelectorAll('*').forEach(node => {
          const h = node as HTMLElement;
          const style = h.style;
          if (style.overflow === 'hidden' || style.overflow === 'clip') {
            style.overflow = 'visible';
          }
          if (h.classList?.contains('truncate')) {
            h.classList.remove('truncate');
            style.overflow = 'visible';
            style.textOverflow = 'clip';
            style.whiteSpace = 'normal';
            style.wordBreak = 'break-word';
            style.lineHeight = '1.45';
            style.paddingBottom = '2px';
          }
        });
      },
    });
  } finally {
    el.style.overflow = prev.overflow;
    el.style.height = prev.height;
    el.style.minHeight = prev.minHeight;
  }
}

function sheetNameSafe(name: string): string {
  const trimmed = name.replace(/[\\/*?:[\]]/g, ' ').trim();
  return trimmed.slice(0, 31) || 'Aba';
}

/**
 * Aguarda layout + Recharts após montar painéis off-screen.
 */
export function aguardarRenderCaptura(ms = 900): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, ms);
      });
    });
  });
}

export async function exportServicosEstatisticasExcelImagens(
  abas: AbaCapturaExcel[],
  meta: ExportServicosEstatisticasMeta,
  darkMode: boolean,
): Promise<void> {
  if (abas.length === 0) {
    throw new Error('Nenhuma aba para capturar.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  for (const aba of abas) {
    const canvas = await capturarElemento(aba.element, darkMode);
    const base64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');

    const scale = MAX_IMAGE_WIDTH_PX / canvas.width;
    const displayWidth = MAX_IMAGE_WIDTH_PX;
    const displayHeight = Math.round(canvas.height * scale);

    const worksheet = workbook.addWorksheet(sheetNameSafe(aba.sheetName));
    worksheet.properties.defaultColWidth = 12;

    const imageId = workbook.addImage({
      base64,
      extension: 'png',
    });

    worksheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: displayWidth, height: displayHeight },
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `estatisticas_outros_servicos_${safeFilePart(meta.equipeNome)}_${safeFilePart(meta.periodoLabel)}_${stamp}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelBuffer(buffer as ArrayBuffer, filename);
}

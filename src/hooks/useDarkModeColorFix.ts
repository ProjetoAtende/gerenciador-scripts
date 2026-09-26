// src/hooks/useDarkModeColorFix.ts
//
// Utilitário + hooks para detectar cores inline escuras em conteúdo rich-text
// e convertê-las para cores claras quando o dark mode está ativo.
//
// Resolve o problema de textos ilegíveis que possuem cores inline arbitrárias
// (coladas de Word, Google Docs, emails, etc.) que seletores CSS estáticos como
// [style*="color: rgb(0,0,0)"] não conseguem capturar, pois existem centenas
// de variações de cores escuras no conteúdo real.
//
// Dois hooks exportados:
// - useDarkModeColorFix: para containers de VISUALIZAÇÃO (dangerouslySetInnerHTML)
// - useDarkModeColorFixEditable: para containers editáveis (contenteditable)
//   que precisam preservar as cores originais ao serializar innerHTML

import { useEffect, useRef, useCallback, RefObject } from 'react';
import { useSettings } from '../contexts/SettingsContext';

/** Limiar de luminosidade relativa (0-1). Cores abaixo disso são consideradas "escuras". */
const LUMINANCE_THRESHOLD = 0.4;

/** Cor clara padrão para substituir cores escuras no dark mode */
const LIGHT_REPLACEMENT = '#e5e7eb'; // gray-200 do Tailwind

/**
 * WeakMap que armazena a cor original de cada elemento modificado.
 * Usar WeakMap (ao invés de data-attributes) garante que o innerHTML
 * serializado NÃO contém artefatos do dark mode fix.
 */
const originalColors = new WeakMap<HTMLElement, string>();

// ---------------------------------------------------------------------------
// Funções utilitárias (exportadas para uso direto em componentes)
// ---------------------------------------------------------------------------

/**
 * Parseia uma string de cor CSS e retorna [r, g, b] ou null.
 * Suporta: rgb(), rgba(), #hex (3, 4, 6, 8 dígitos), e nomes básicos.
 */
export function parseColor(colorStr: string): [number, number, number] | null {
  const s = colorStr.trim().toLowerCase();

  // rgb(r, g, b) ou rgba(r, g, b, a)
  const rgbMatch = s.match(/^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
  }

  // #hex
  const hexMatch = s.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length >= 6) {
      return [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16),
      ];
    }
  }

  // Nomes de cores comuns em conteúdo colado
  const namedColors: Record<string, [number, number, number]> = {
    black: [0, 0, 0],
    darkgray: [169, 169, 169],
    darkgrey: [169, 169, 169],
    dimgray: [105, 105, 105],
    dimgrey: [105, 105, 105],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
    darkslategray: [47, 79, 79],
    darkslategrey: [47, 79, 79],
    slategray: [112, 128, 144],
    slategrey: [112, 128, 144],
  };
  if (namedColors[s]) return namedColors[s];

  return null;
}

/**
 * Calcula a luminosidade relativa de uma cor RGB (fórmula WCAG 2.0).
 * Retorna valor entre 0 (preto total) e 1 (branco total).
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Percorre todos os elementos dentro de `container` que possuem `color` inline
 * e, se a cor for escura (luminosidade < threshold), força cor clara.
 * Armazena originais no WeakMap global para restauração posterior.
 */
export function fixDarkColorsInContainer(container: HTMLElement) {
  // Elementos com style inline contendo "color"
  const elements = container.querySelectorAll<HTMLElement>('[style]');
  elements.forEach((el) => {
    const inlineColor = el.style.color;
    if (!inlineColor) return;
    // Não re-processar elemento já corrigido
    if (originalColors.has(el)) return;

    const rgb = parseColor(inlineColor);
    if (!rgb) return;

    const lum = relativeLuminance(...rgb);
    if (lum < LUMINANCE_THRESHOLD) {
      originalColors.set(el, inlineColor);
      el.style.setProperty('color', LIGHT_REPLACEMENT, 'important');
    }
  });

  // Elementos <font color="..."> (legado — Word, Outlook)
  const fontElements = container.querySelectorAll<HTMLFontElement>('font[color]');
  fontElements.forEach((el) => {
    if (originalColors.has(el)) return;
    const colorAttr = el.getAttribute('color');
    if (!colorAttr) return;

    const rgb = parseColor(colorAttr);
    if (!rgb) return;

    const lum = relativeLuminance(...rgb);
    if (lum < LUMINANCE_THRESHOLD) {
      originalColors.set(el, colorAttr);
      el.style.setProperty('color', LIGHT_REPLACEMENT, 'important');
    }
  });
}

/**
 * Restaura as cores originais que foram alteradas pelo fix de dark mode.
 * Usa o WeakMap global para recuperar os valores originais.
 */
export function restoreOriginalColors(container: HTMLElement) {
  // Restaurar elementos com style inline
  const elements = container.querySelectorAll<HTMLElement>('[style]');
  elements.forEach((el) => {
    const original = originalColors.get(el);
    if (original !== undefined) {
      el.style.color = original;
      originalColors.delete(el);
    }
  });

  // Restaurar elementos <font> legado
  const fontElements = container.querySelectorAll<HTMLFontElement>('font[color]');
  fontElements.forEach((el) => {
    const original = originalColors.get(el);
    if (original !== undefined) {
      el.style.removeProperty('color');
      originalColors.delete(el);
    }
  });
}

// ---------------------------------------------------------------------------
// Hook para containers NÃO-EDITÁVEIS (preview, modais, etc.)
// ---------------------------------------------------------------------------

/**
 * Hook que monitora um container ref e, quando dark mode está ativo,
 * converte automaticamente cores inline escuras para cores claras.
 * Usa MutationObserver para capturar conteúdo adicionado dinamicamente.
 *
 * Para containers de VISUALIZAÇÃO somente — não usar em contenteditable.
 */
export function useDarkModeColorFix(containerRef: RefObject<HTMLElement | null>) {
  const { darkMode } = useSettings();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!darkMode) {
      restoreOriginalColors(container);
      return;
    }

    // Aplicar fix inicial
    fixDarkColorsInContainer(container);

    // Observar mudanças no DOM (conteúdo dinâmico)
    const observer = new MutationObserver((mutations) => {
      let needsFix = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          needsFix = true;
          break;
        }
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          needsFix = true;
          break;
        }
      }
      if (needsFix) {
        fixDarkColorsInContainer(container);
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'color'],
    });

    return () => {
      observer.disconnect();
    };
  }, [darkMode, containerRef]);
}

// ---------------------------------------------------------------------------
// Hook para containers EDITÁVEIS (contenteditable)
// ---------------------------------------------------------------------------

/**
 * Hook para contenteditable que aplica fix de cores escuras visualmente,
 * mas fornece `getCleanHtml()` para obter o innerHTML SEM as modificações
 * de dark mode — garantindo que o conteúdo salvo no banco seja limpo.
 *
 * Fluxo:
 * 1. Aplica fix visual (cores escuras → claras)
 * 2. Antes de salvar: restaura originais → lê innerHTML → re-aplica fix
 * 3. Resultado: usuário vê cores claras, banco recebe cores originais
 */
export function useDarkModeColorFixEditable(
  containerRef: RefObject<HTMLElement | null>
) {
  const { darkMode } = useSettings();
  const observerRef = useRef<MutationObserver | null>(null);
  const pausedRef = useRef(false);

  // Aplica ou remove o fix quando darkMode muda ou conteúdo é carregado
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!darkMode) {
      restoreOriginalColors(container);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      return;
    }

    // Aplicar fix inicial
    fixDarkColorsInContainer(container);

    // Observar mudanças no DOM (paste, edição, etc.)
    const observer = new MutationObserver((mutations) => {
      if (pausedRef.current) return;
      let needsFix = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          needsFix = true;
          break;
        }
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'style' &&
          !originalColors.has(mutation.target as HTMLElement)
        ) {
          needsFix = true;
          break;
        }
      }
      if (needsFix) {
        fixDarkColorsInContainer(container);
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'color'],
    });
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [darkMode, containerRef]);

  /**
   * Lê o innerHTML do container com as cores originais restauradas.
   * Usado pelo handleInput do editor para garantir conteúdo limpo para salvar.
   */
  const getCleanHtml = useCallback((): string => {
    const container = containerRef.current;
    if (!container) return '';

    if (!darkMode) {
      return container.innerHTML;
    }

    // Pausar observer para evitar re-processamento durante restauração
    pausedRef.current = true;

    // Restaurar → ler → re-aplicar
    restoreOriginalColors(container);
    const cleanHtml = container.innerHTML;
    fixDarkColorsInContainer(container);

    pausedRef.current = false;

    return cleanHtml;
  }, [darkMode, containerRef]);

  /**
   * Força re-aplicação do fix (chamar após alterar innerHTML externamente,
   * ex: ao carregar um novo script no editor).
   */
  const reapplyFix = useCallback(() => {
    const container = containerRef.current;
    if (!container || !darkMode) return;
    fixDarkColorsInContainer(container);
  }, [darkMode, containerRef]);

  return { getCleanHtml, reapplyFix };
}

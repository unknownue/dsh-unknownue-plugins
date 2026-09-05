/**
 * Paperspace reader body font size (px), persisted like the theme.
 * Applies to `.paper-article` via the `--ps-article-font-size` CSS variable;
 * everything inside the article sizes in em so the whole body scales.
 */
export const DEFAULT_FONT_SIZE = 16;
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 26;
export const FONT_SIZE_STEP = 1;

const FONT_SIZE_STORAGE_KEY = 'dsh-unknownue-plugins/paperspace:fontSize';
let memoryFontSize: number | null = null;

export function readPaperspaceFontSize(): number {
  if (memoryFontSize) return memoryFontSize;
  try {
    const raw = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= MIN_FONT_SIZE && parsed <= MAX_FONT_SIZE) return parsed;
  } catch {
    /* storage unavailable — fall back to the default */
  }
  return DEFAULT_FONT_SIZE;
}

export function rememberPaperspaceFontSize(size: number): void {
  memoryFontSize = size;
  try {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(size));
  } catch {
    /* storage unavailable — module state still keeps the tab consistent */
  }
}

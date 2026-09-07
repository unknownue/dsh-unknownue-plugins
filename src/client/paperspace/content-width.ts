/**
 * Paperspace reader content max-width (percentage), persisted to localStorage.
 * Applies to `.paper-article` via the `--ps-article-max-width` CSS variable.
 */
export const DEFAULT_WIDTH_PCT = 100;
export const MIN_WIDTH_PCT = 40;
export const MAX_WIDTH_PCT = 100;
export const WIDTH_PCT_STEP = 1;

const STORAGE_KEY = 'dsh-unknownue-plugins/paperspace:contentWidthPct';
let memoryWidth: number | null = null;

export function readPaperspaceContentWidthPct(): number {
  if (memoryWidth !== null) return memoryWidth;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= MIN_WIDTH_PCT && parsed <= MAX_WIDTH_PCT) return parsed;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_WIDTH_PCT;
}

export function rememberPaperspaceContentWidthPct(pct: number): void {
  memoryWidth = pct;
  try {
    localStorage.setItem(STORAGE_KEY, String(pct));
  } catch {
    /* storage unavailable */
  }
}

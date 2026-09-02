/**
 * Paperspace's own light/dark preference, independent from DSH's theme.
 * `auto` follows DSH's theme (body[data-ds-dark-theme]); `light`/`dark` pin
 * the tab regardless. Persisted to localStorage; the module-level mirror
 * keeps it stable across the tab's unmount/remount cycles.
 */
export type PaperspaceTheme = 'auto' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'dsh-unknownue-plugins/paperspace:theme';
let memoryTheme: PaperspaceTheme | null = null;

export function readPaperspaceTheme(): PaperspaceTheme {
  if (memoryTheme) return memoryTheme;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw;
  } catch {
    /* storage unavailable — fall back to auto */
  }
  return 'auto';
}

export function rememberPaperspaceTheme(theme: PaperspaceTheme): void {
  memoryTheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — module state still keeps the tab consistent */
  }
}

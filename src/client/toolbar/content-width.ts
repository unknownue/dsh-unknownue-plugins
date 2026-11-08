/**
 * Content-width preference shared by the startup apply step and the UnPlugin
 * settings block.
 *
 * The value is browser-local: it lives in `localStorage` and is applied by
 * injecting one `<style data-width-override>` rule into the document head
 * (`*{--dsh-chat-content-width:<pct>% !important}`). Keeping the pure helpers
 * out of the React module lets the settings page render the same source of
 * truth without importing the sidebar control that used to own it.
 */

/** Browser-local storage key (kept stable so an existing profile keeps its value). */
export const WIDTH_STORAGE_KEY = "dsh-unknownue-plugins:contentWidthPct";
export const WIDTH_DEFAULT_PCT = 100;
export const WIDTH_MIN_PCT = 50;
export const WIDTH_MAX_PCT = 150;
export const WIDTH_STEP_PCT = 1;

/** Clamp any raw value (storage entry, slider string) into the supported range. */
export function clampWidth(value: unknown): number {
  const n = Math.round(Number(value));
  const finite = Number.isFinite(n) ? n : WIDTH_DEFAULT_PCT;
  return Math.min(WIDTH_MAX_PCT, Math.max(WIDTH_MIN_PCT, finite));
}

/** Read the persisted percentage, falling back to the 100 % default. */
export function readWidthPct(): number {
  try {
    const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
    return raw === null ? WIDTH_DEFAULT_PCT : clampWidth(raw);
  } catch {
    return WIDTH_DEFAULT_PCT;
  }
}

let widthStyleEl: HTMLStyleElement | null = null;

/** Apply one percentage to the document (idempotent; creates the tag once). */
export function applyWidth(pct: number): void {
  if (widthStyleEl === null) {
    widthStyleEl = document.createElement("style");
    widthStyleEl.setAttribute("data-plugin", "dsh-unknownue-plugins");
    widthStyleEl.setAttribute("data-width-override", "");
    document.head.appendChild(widthStyleEl);
  }
  widthStyleEl.textContent = `*{--dsh-chat-content-width:${pct}% !important}`;
}

/** Clamp, apply, and persist one percentage; returns the applied value. */
export function setWidthPct(pct: number): number {
  const clamped = clampWidth(pct);
  applyWidth(clamped);
  try {
    window.localStorage.setItem(WIDTH_STORAGE_KEY, String(clamped));
  } catch {
    // Storage may be unavailable (private mode); the session still applies.
  }
  return clamped;
}

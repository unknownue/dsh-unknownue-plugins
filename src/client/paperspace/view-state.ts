/**
 * Per-paper translation view state — the translation language and the
 * 原文/译文/双语 selection — restored when the reader remounts. DSH unmounts
 * inactive tabs, so the reader keeps this state at module level (survives
 * tab switches) and mirrors it in sessionStorage (survives page reloads,
 * like the paperspace route). Without it the scroll-position restore lands
 * on a different layout than the one the offset was recorded on.
 */
import type { Lang, ViewMode } from './types';

export interface TranslationViewState {
  lang: Lang;
  mode: ViewMode;
}

const STORAGE_KEY_PREFIX = 'dsh-unknownue-plugins/paperspace:view:';
const memoryView = new Map<string, TranslationViewState>();

const LANGS: readonly string[] = ['zh-CN', 'en-US', 'ja-JP'];
const MODES: readonly string[] = ['original', 'translated', 'bilingual'];

function isViewState(value: unknown): value is TranslationViewState {
  if (value === null || typeof value !== 'object') return false;
  const state = value as { lang?: unknown; mode?: unknown };
  return (
    typeof state.lang === 'string' &&
    LANGS.includes(state.lang) &&
    typeof state.mode === 'string' &&
    MODES.includes(state.mode)
  );
}

export function readTranslationViewState(arxivId: string): TranslationViewState {
  const cached = memoryView.get(arxivId);
  if (cached) return cached;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_PREFIX + arxivId);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isViewState(parsed)) return parsed;
    }
  } catch {
    /* storage unavailable — fall back to defaults */
  }
  return { lang: 'zh-CN', mode: 'original' };
}

export function rememberTranslationViewState(arxivId: string, view: TranslationViewState): void {
  memoryView.set(arxivId, view);
  try {
    sessionStorage.setItem(STORAGE_KEY_PREFIX + arxivId, JSON.stringify(view));
  } catch {
    /* storage unavailable — module state still keeps tab switches working */
  }
}

export function forgetTranslationViewState(arxivId: string): void {
  memoryView.delete(arxivId);
  try {
    sessionStorage.removeItem(STORAGE_KEY_PREFIX + arxivId);
  } catch {
    /* storage unavailable */
  }
}

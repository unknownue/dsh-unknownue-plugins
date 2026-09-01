/**
 * Shared DTOs / helpers, ported from vendor/paperspace packages/shared.
 */
export const ARXIV_ID_PATTERN = /^\d{4}\.\d{5}(v\d+)?$/;
export type PaperStatus = 'ingesting' | 'ready' | 'failed';
export type TranslationLanguage = 'zh-CN' | 'en-US' | 'ja-JP';
export type TranslationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Provider info exposed in API responses — the api key is always redacted. */
export interface TranslationProviderInfo { baseUrl: string; model: string; }
export interface TranslationJob { id: string; paperId: string; targetLang: TranslationLanguage; status: TranslationStatus; progress: number; total: number; attempts: number; startedAt: string | null; error: string | null; createdAt: string; updatedAt: string; provider: TranslationProviderInfo | null; }
export interface TranslationSnapshot { paperId: string; targetLang: TranslationLanguage; paragraphs: Array<string | null>; offsets: Array<{ start: number; end: number }>; glossary: Record<string, string>; status: TranslationStatus; model: string | null; updatedAt: string; }
export interface TranslationWithJob extends TranslationSnapshot { job: TranslationJob | null; }

export interface PaperSummary {
  id: string;
  arxivId: string;
  title: string;
  authors: string[];
  categories: string[];
  publishedAt?: string;
  abstract?: string;
  status: PaperStatus;
  errorMessage?: string;
}

export interface PaperDetail extends PaperSummary {
  abstract: string;
  markdown: string;
}

export function isArxivId(value: string): boolean {
  return ARXIV_ID_PATTERN.test(value);
}

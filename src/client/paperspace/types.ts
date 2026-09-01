/**
 * Paperspace client-side shared types (browser half).
 */
export type PaperStatus = 'ingesting' | 'ready' | 'failed';

export interface Paper {
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

export interface PaperDetail extends Paper {
  markdown: string;
}

export type Lang = 'zh-CN' | 'en-US' | 'ja-JP';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TranslationJob {
  id: string;
  paperId: string;
  targetLang: Lang;
  status: JobStatus;
  progress: number;
  total: number;
  attempts: number;
  startedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  provider: { baseUrl: string; model: string } | null;
}

export interface TranslationSnapshot {
  paperId: string;
  targetLang: Lang;
  paragraphs: Array<string | null>;
  offsets: Array<{ start: number; end: number }>;
  glossary: Record<string, string>;
  status: JobStatus;
  model: string | null;
  updatedAt: string;
}

export type ViewMode = 'original' | 'translated' | 'bilingual';

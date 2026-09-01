/**
 * Ported verbatim from vendor/paperspace packages/paper-domain/src/types.ts.
 */
export type PaperStatus = 'ingesting' | 'ready' | 'failed';

/** Row shape of `paper.papers` (camelCased via postgres.js transform). */
export interface PaperRow {
  id: string;
  arxivId: string;
  metadata: Record<string, unknown>;
  markdown: string | null;
  status: PaperStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Row shape of `paper.assets`. */
export interface AssetRow {
  id: string;
  paperId: string;
  originalUrl: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface PaperListResult {
  items: PaperRow[];
  total: number;
}

/** arXiv metadata extracted at ingest time, stored into `papers.metadata`. */
export interface PaperMetadata {
  title: string | null;
  authors: string[];
  abstract: string | null;
  categories: string[];
  published: string | null;
}

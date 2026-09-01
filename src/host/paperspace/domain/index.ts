/**
 * paperspace domain layer re-exports (bundle-local port of
 * vendor/paperspace packages/paper-domain/src/index.ts).
 */
export { createDb } from './db';
export type { Sql, TransactionSql, Queryable } from './db';
export { FileObjectStore } from '../filestore';
export { createPaperRepo } from './papers';
export type { PaperRepo, PaperListOptions } from './papers';
export { createAssetRepo } from './assets';
export type { AssetRepo, NewAsset } from './assets';
export { createTranslationRepo } from './translations';
export type { TranslationRepo, TranslationJobRow, TranslationSnapshotRow, TranslationJobStatus, TranslationProviderConfig } from './translations';
export { splitParagraphs, spliceParagraphs } from './paragraphs';
export type { ParagraphBlock } from './paragraphs';
export type { PaperRow, AssetRow, PaperListResult, PaperMetadata, PaperStatus } from './types';

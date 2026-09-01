/**
 * paperspace worker loops — port of vendor/paperspace apps/worker/src/index.ts
 * onto DSH cordis lifecycle. The ingest / translation / stuck-rescan loops run
 * as plain timers registered through `ctx.effect`; the effect disposer stops
 * them when the plugin row is unloaded (no separate worker process, no Docker).
 */
import { clearInterval, setInterval } from 'node:timers';
import type { PaperspaceRuntime } from '../db';
import { ensurePaperMarkdown } from '../dsh-integration';
import type { FileObjectStore } from '../filestore';
import type { PaperspaceConfig } from '../types';
import { createAssetRepo, createPaperRepo, createTranslationRepo } from '../domain/index';
import type { PaperRow } from '../domain/types';
import { fetchArxivHtml, fetchArxivMetadata } from './arxiv';
import { htmlToMarkdown } from './html2md';
import { rewriteImageUrls, storeImages } from './images';
import { failTranslationJob, runTranslationJob, TranslationFatalError, type TranslationContext } from './translate';

const CLAIM_GRACE_SECONDS = 3;
const HEARTBEAT_MS = 1000;

function envNumber(value: number, name: string): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '' || Number.isNaN(Number(raw))) return value;
  return Number(raw);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function startWorker(
  ctx: { effect(fn: () => unknown, label?: string): unknown },
  runtime: PaperspaceRuntime,
  store: FileObjectStore,
  config: PaperspaceConfig,
): void {
  const pollMs = envNumber(config.pollMs, 'WORKER_POLL_MS');
  const ingestTimeoutMs = envNumber(config.ingestTimeoutMs, 'INGEST_TIMEOUT_MS');
  const maxAssetBytes = envNumber(config.maxAssetBytes, 'MAX_ASSET_BYTES');
  const ingestConcurrency = envNumber(config.ingestConcurrency, 'INGEST_CONCURRENCY');
  const translateMaxAttempts = envNumber(config.translateMaxAttempts, 'TRANSLATE_MAX_ATTEMPTS');
  const translateStuckAfterMinutes = envNumber(config.translateStuckAfterMinutes, 'TRANSLATE_STUCK_AFTER_MINUTES');
  const translateTimeoutMs = envNumber(config.translateTimeoutMs, 'TRANSLATE_TIMEOUT_MS');
  const rescanIntervalMs = envNumber(config.rescanIntervalMs, 'RESCAN_INTERVAL_MS');

  ctx.effect(() => {
    // ── ingest (verbatim port; heartbeat + transaction per paper) ──────────
    async function ingest(paper: PaperRow): Promise<void> {
      const sql = await runtime.getSql();
      const papers = createPaperRepo(sql);
      const heartbeat = setInterval(() => {
        papers.heartbeat(paper.id).catch(() => {});
      }, HEARTBEAT_MS);
      try {
        const metadata = await fetchArxivMetadata(paper.arxivId, ingestTimeoutMs);
        const { html, baseUrl } = await fetchArxivHtml(paper.arxivId, ingestTimeoutMs);
        const markdown = htmlToMarkdown(html);
        const { assets } = await storeImages({
          arxivId: paper.arxivId,
          markdown,
          store,
          baseUrl,
          maxBytes: maxAssetBytes,
          timeoutMs: ingestTimeoutMs,
          concurrency: ingestConcurrency,
        });

        await sql.begin(async tx => {
          const assetRepo = createAssetRepo(tx);
          const inserted = await assetRepo.insertMany(paper.id, assets);
          const urlMap = new Map(
            inserted.map(asset => [asset.originalUrl, `/dsh-unknownue-plugins/paperspace/api/papers/${paper.arxivId}/assets/${asset.id}`]),
          );
          const rewritten = rewriteImageUrls(markdown, urlMap, baseUrl);
          await createPaperRepo(tx).finishReady(paper.id, metadata, rewritten);
        });

        // Materialize the paper into the shared DSH workspace so DSH's own
        // tools can read it and the 讨论 flow has a stable anchor.
        await ensurePaperMarkdown(sql, config.workspaceDir, paper.arxivId);

        console.log(`[paperspace] ingested ${paper.arxivId}: ${assets.length} assets, ${markdown.length} markdown chars`);
      } catch (error) {
        const message = messageOf(error);
        await papers.markFailed(paper.id, message);
        console.error(`[paperspace] ingest failed ${paper.arxivId}: ${message}`);
      } finally {
        clearInterval(heartbeat);
      }
    }

    async function tick(): Promise<void> {
      const sql = await runtime.getSql();
      const paper = await createPaperRepo(sql).claimNextIngesting(CLAIM_GRACE_SECONDS);
      if (!paper) return;
      await ingest(paper);
    }

    // ── translation (claim → run → fail/retry) ─────────────────────────────
    async function translateOne(): Promise<boolean> {
      const sql = await runtime.getSql();
      const translations = createTranslationRepo(sql);
      const papers = createPaperRepo(sql);
      const job = await translations.claimNextJob();
      if (!job) return false;
      // The provider is persisted with the job (same source as reader chat).
      // The env fallback only serves jobs created before the provider column
      // existed; the API rejects new jobs without a resolved provider.
      const provider = job.provider ?? (process.env.LLM_API_KEY ? { baseUrl: process.env.LLM_BASE_URL ?? 'https://api.deepseek.com', apiKey: process.env.LLM_API_KEY, model: process.env.LLM_MODEL ?? 'deepseek-chat' } : null);
      const translationContext: TranslationContext = {
        translations,
        provider: provider ?? { baseUrl: '', apiKey: null, model: '' },
        timeoutMs: translateTimeoutMs,
        maxAttempts: translateMaxAttempts,
      };
      const paper = await papers.findByRef(job.paperId);
      try {
        if (!provider) {
          throw new TranslationFatalError('translation job has no LLM provider configured; recreate the job from the reader');
        }
        if (!paper || paper.status !== 'ready' || !paper.markdown) {
          throw new TranslationFatalError(`paper is not ready for translation (status=${paper?.status ?? 'missing'})`);
        }
        await runTranslationJob(job, paper.markdown, translationContext);
        console.log(`[paperspace] translated ${paper.arxivId} → ${job.targetLang} (${job.total} paragraphs, model ${provider.model})`);
      } catch (error) {
        await failTranslationJob(job, error, translationContext);
      }
      return true;
    }

    /** Periodically re-queue running jobs whose lease expired. */
    async function rescanStuck(): Promise<void> {
      try {
        const sql = await runtime.getSql();
        const count = await createTranslationRepo(sql).rescanStuckJobs(translateStuckAfterMinutes);
        if (count > 0) console.warn(`[paperspace] requeued ${count} stuck translation job(s)`);
      } catch (error) {
        console.error('[paperspace] stuck-job rescan failed', messageOf(error));
      }
    }

    // ── loop scheduling (no-overlap flags keep paperspace's serial semantics) ──
    let ingesting = false;
    let translating = false;

    const ingestTimer = setInterval(() => {
      if (ingesting) return;
      ingesting = true;
      void tick()
        .catch(error => console.error('[paperspace] ingest tick failed', messageOf(error)))
        .finally(() => {
          ingesting = false;
        });
    }, pollMs);

    const translateTimer = setInterval(() => {
      if (translating) return;
      translating = true;
      void translateOne()
        .catch(error => console.error('[paperspace] translation tick failed', messageOf(error)))
        .finally(() => {
          translating = false;
        });
    }, pollMs);

    const rescanTimer = setInterval(() => void rescanStuck(), rescanIntervalMs);

    void store.ensureBucket().catch(error => console.error('[paperspace] object store init failed', messageOf(error)));
    console.log('[paperspace] worker started', {
      pollMs,
      assetsDir: config.assetsDir,
      ingestConcurrency,
      maxAssetBytes,
      translateMaxAttempts,
      translateStuckAfterMinutes,
      translateTimeoutMs,
    });

    return () => {
      clearInterval(ingestTimer);
      clearInterval(translateTimer);
      clearInterval(rescanTimer);
    };
  }, 'dsh-unknownue-plugins/paperspace: worker loops');
}

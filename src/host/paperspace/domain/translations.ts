/**
 * Ported verbatim from vendor/paperspace packages/paper-domain/src/translations.ts
 * (import specifiers adjusted to bundle-local resolution).
 */
import type { Queryable } from './db';

export type TranslationJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * LLM provider config persisted with a translation job so the worker can run
 * the whole job in the background with the model the user picked in the
 * reader. `apiKey` is stored plaintext but must never be returned by an API
 * response or written to logs.
 */
export interface TranslationProviderConfig {
  baseUrl: string;
  apiKey: string | null;
  model: string;
}

/** Row shape of `paper.paper_translations` (camelCased via postgres.js). */
export interface TranslationSnapshotRow {
  paperId: string;
  targetLang: string;
  paragraphs: Array<string | null>;
  offsets: Array<{ start: number; end: number }>;
  glossary: Record<string, string>;
  status: TranslationJobStatus;
  model: string | null;
  updatedAt: Date;
}

/** Row shape of `paper.translation_jobs`. */
export interface TranslationJobRow {
  id: string;
  paperId: string;
  targetLang: string;
  status: TranslationJobStatus;
  progress: number;
  total: number;
  attempts: number;
  availableAt: Date;
  startedAt: Date | null;
  error: string | null;
  glossary: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  provider: TranslationProviderConfig | null;
}

const ACTIVE = `status IN ('pending', 'running')`;

export interface TranslationRepo {
  /** The active (pending|running) job for a paper + language, if any. */
  findActiveJob(paperId: string, targetLang: string): Promise<TranslationJobRow | null>;
  /**
   * Create a translation job, or return the already-active one. Creating a
   * job discards any previous snapshot so a re-translation starts fresh.
   */
  createJob(paperId: string, targetLang: string, provider: TranslationProviderConfig | null): Promise<TranslationJobRow>;
  findLatestJob(paperId: string, targetLang: string): Promise<TranslationJobRow | null>;
  /** Atomically claim the next runnable job (FOR UPDATE SKIP LOCKED). */
  claimNextJob(): Promise<TranslationJobRow | null>;
  /** Initialize/reset the snapshot for a claimed job (keeps paragraphs so retries resume). */
  startSnapshot(jobId: string, paperId: string, targetLang: string, offsets: Array<{ start: number; end: number }>): Promise<void>;
  findSnapshot(paperId: string, targetLang: string): Promise<TranslationSnapshotRow | null>;
  deleteSnapshot(paperId: string, targetLang: string): Promise<void>;
  /**
   * Persist paragraphs/progress. Writes are guarded by the job still being
   * active, so a concurrent cancel (which deletes the snapshot) is never
   * resurrected by a late write.
   */
  updateSnapshot(params: {
    jobId: string;
    paperId: string;
    targetLang: string;
    paragraphs: Array<string | null>;
    offsets: Array<{ start: number; end: number }>;
    glossary: Record<string, string>;
    model: string;
  }): Promise<void>;
  updateProgress(jobId: string, progress: number, total: number): Promise<void>;
  setJobGlossary(jobId: string, glossary: Record<string, string>): Promise<void>;
  /** Current job status — workers poll it to observe cancellation. */
  jobStatus(jobId: string): Promise<TranslationJobStatus | null>;
  /** Job → completed; snapshot → completed. */
  finishJob(jobId: string, paperId: string, targetLang: string, model: string): Promise<void>;
  /** Retryable failure: job → pending with backoff; snapshot → failed (keeps paragraphs). */
  requeueJob(jobId: string, error: string, delaySeconds: number): Promise<void>;
  /** Terminal failure: job stays failed and is never retried; snapshot → failed. */
  failJobPermanently(jobId: string, error: string): Promise<void>;
  /** Cancel the active job and delete its snapshot. Returns whether a job was cancelled. */
  cancelActiveJob(paperId: string, targetLang: string): Promise<boolean>;
  /** Re-queue running jobs whose lease expired; returns how many were reset. */
  rescanStuckJobs(stuckAfterMinutes: number): Promise<number>;
}

export function createTranslationRepo(sql: Queryable): TranslationRepo {
  return {
    async findActiveJob(paperId, targetLang) {
      const rows = await sql<TranslationJobRow[]>`
        SELECT * FROM paper.translation_jobs
        WHERE paper_id = ${paperId} AND target_lang = ${targetLang} AND ${sql.unsafe(ACTIVE)}
        LIMIT 1`;
      return rows[0] ?? null;
    },

    async createJob(paperId, targetLang, provider) {
      const active = await sql<TranslationJobRow[]>`
        SELECT * FROM paper.translation_jobs
        WHERE paper_id = ${paperId} AND target_lang = ${targetLang} AND ${sql.unsafe(ACTIVE)}
        LIMIT 1`;
      if (active[0]) return active[0];
      const inserted = await sql<TranslationJobRow[]>`
        INSERT INTO paper.translation_jobs (paper_id, target_lang, provider)
        VALUES (${paperId}, ${targetLang}, ${provider as never}::jsonb)
        ON CONFLICT DO NOTHING
        RETURNING *`;
      if (inserted[0]) {
        await sql`DELETE FROM paper.paper_translations WHERE paper_id = ${paperId} AND target_lang = ${targetLang}`;
        return inserted[0];
      }
      // Lost a race: someone else created the active job; return it.
      const winner = await sql<TranslationJobRow[]>`
        SELECT * FROM paper.translation_jobs
        WHERE paper_id = ${paperId} AND target_lang = ${targetLang} AND ${sql.unsafe(ACTIVE)}
        LIMIT 1`;
      if (winner[0]) return winner[0];
      throw new Error('translation job create race left no active job');
    },

    async findLatestJob(paperId, targetLang) {
      const rows = await sql<TranslationJobRow[]>`
        SELECT * FROM paper.translation_jobs
        WHERE paper_id = ${paperId} AND target_lang = ${targetLang}
        ORDER BY created_at DESC, id DESC
        LIMIT 1`;
      return rows[0] ?? null;
    },

    async claimNextJob() {
      const rows = await sql<TranslationJobRow[]>`
        UPDATE paper.translation_jobs
        SET status = 'running', started_at = now(), attempts = attempts + 1,
            error = NULL, updated_at = now()
        WHERE id = (
          SELECT id FROM paper.translation_jobs
          WHERE status = 'pending' AND available_at <= now()
          ORDER BY available_at ASC, created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *`;
      return rows[0] ?? null;
    },

    async startSnapshot(jobId, paperId, targetLang, offsets) {
      await sql`
        INSERT INTO paper.paper_translations (paper_id, target_lang, paragraphs, offsets, glossary, status, model)
        VALUES (${paperId}, ${targetLang}, '[]'::jsonb, ${offsets as never}::jsonb, '{}'::jsonb, 'running', NULL)
        ON CONFLICT (paper_id, target_lang) DO UPDATE
        SET status = 'running', offsets = EXCLUDED.offsets, updated_at = now()
        WHERE EXISTS (SELECT 1 FROM paper.translation_jobs WHERE id = ${jobId} AND ${sql.unsafe(ACTIVE)})`;
    },

    async findSnapshot(paperId, targetLang) {
      const rows = await sql<TranslationSnapshotRow[]>`
        SELECT * FROM paper.paper_translations
        WHERE paper_id = ${paperId} AND target_lang = ${targetLang}
        LIMIT 1`;
      return rows[0] ?? null;
    },

    async deleteSnapshot(paperId, targetLang) {
      await sql`DELETE FROM paper.paper_translations WHERE paper_id = ${paperId} AND target_lang = ${targetLang}`;
    },

    async updateSnapshot({ jobId, paperId, targetLang, paragraphs, offsets, glossary, model }) {
      await sql`
        INSERT INTO paper.paper_translations (paper_id, target_lang, paragraphs, offsets, glossary, status, model)
        SELECT ${paperId}, ${targetLang}, ${paragraphs as never}::jsonb, ${offsets as never}::jsonb,
               ${glossary as never}::jsonb, 'running', ${model}
        WHERE EXISTS (SELECT 1 FROM paper.translation_jobs WHERE id = ${jobId} AND ${sql.unsafe(ACTIVE)})
        ON CONFLICT (paper_id, target_lang) DO UPDATE
        SET paragraphs = EXCLUDED.paragraphs, offsets = EXCLUDED.offsets,
            glossary = EXCLUDED.glossary, status = 'running', model = EXCLUDED.model,
            updated_at = now()
        WHERE EXISTS (SELECT 1 FROM paper.translation_jobs WHERE id = ${jobId} AND ${sql.unsafe(ACTIVE)})`;
    },

    async updateProgress(jobId, progress, total) {
      await sql`
        UPDATE paper.translation_jobs
        SET progress = ${progress}, total = ${total}, updated_at = now()
        WHERE id = ${jobId}`;
    },

    async setJobGlossary(jobId, glossary) {
      await sql`
        UPDATE paper.translation_jobs
        SET glossary = ${glossary as never}::jsonb, updated_at = now()
        WHERE id = ${jobId}`;
    },

    async jobStatus(jobId) {
      const rows = await sql<Array<{ status: TranslationJobStatus }>>`
        SELECT status FROM paper.translation_jobs WHERE id = ${jobId} LIMIT 1`;
      return rows[0]?.status ?? null;
    },

    async finishJob(jobId, paperId, targetLang, model) {
      // Single atomic statement: complete the job (guarded by it still being
      // active) and flip the matching snapshot via a data-modifying CTE.
      await sql`
        WITH done AS (
          UPDATE paper.translation_jobs
          SET status = 'completed', progress = total, error = NULL, updated_at = now()
          WHERE id = ${jobId} AND ${sql.unsafe(ACTIVE)}
          RETURNING paper_id, target_lang
        )
        UPDATE paper.paper_translations t
        SET status = 'completed', model = ${model}, updated_at = now()
        FROM done
        WHERE t.paper_id = done.paper_id AND t.target_lang = done.target_lang`;
    },

    async requeueJob(jobId, error, delaySeconds) {
      await sql`
        WITH requeued AS (
          UPDATE paper.translation_jobs
          SET status = 'pending', available_at = now() + make_interval(secs => ${delaySeconds}),
              started_at = NULL, error = ${truncateBytes(error, 2048)}, updated_at = now()
          WHERE id = ${jobId}
          RETURNING paper_id, target_lang
        )
        UPDATE paper.paper_translations t
        SET status = 'failed', updated_at = now()
        FROM requeued
        WHERE t.paper_id = requeued.paper_id AND t.target_lang = requeued.target_lang`;
    },

    async failJobPermanently(jobId, error) {
      await sql`
        WITH failed AS (
          UPDATE paper.translation_jobs
          SET status = 'failed', error = ${truncateBytes(error, 2048)}, updated_at = now()
          WHERE id = ${jobId}
          RETURNING paper_id, target_lang
        )
        UPDATE paper.paper_translations t
        SET status = 'failed', updated_at = now()
        FROM failed
        WHERE t.paper_id = failed.paper_id AND t.target_lang = failed.target_lang`;
    },

    async cancelActiveJob(paperId, targetLang) {
      const rows = await sql<Array<{ count: number }>>`
        WITH cancelled AS (
          UPDATE paper.translation_jobs
          SET status = 'cancelled', error = NULL, updated_at = now()
          WHERE paper_id = ${paperId} AND target_lang = ${targetLang} AND ${sql.unsafe(ACTIVE)}
          RETURNING paper_id, target_lang
        ), removed AS (
          DELETE FROM paper.paper_translations t
          USING cancelled
          WHERE t.paper_id = cancelled.paper_id AND t.target_lang = cancelled.target_lang
        )
        SELECT count(*)::int AS count FROM cancelled`;
      return (rows[0]?.count ?? 0) > 0;
    },

    async rescanStuckJobs(stuckAfterMinutes) {
      const rows = await sql<Array<{ id: string }>>`
        UPDATE paper.translation_jobs
        SET status = 'pending', started_at = NULL, available_at = now(), updated_at = now()
        WHERE status = 'running'
          AND started_at IS NOT NULL
          AND started_at < now() - make_interval(mins => ${stuckAfterMinutes})
        RETURNING id`;
      return rows.length;
    },
  };
}

function truncateBytes(value: string, maxBytes: number): string {
  let out = value;
  while (Buffer.byteLength(out, 'utf8') > maxBytes) out = out.slice(0, -1);
  return out;
}

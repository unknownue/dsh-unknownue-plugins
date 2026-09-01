/**
 * Ported verbatim from vendor/paperspace packages/paper-domain/src/papers.ts
 * (import specifiers adjusted to bundle-local resolution).
 */
import type { Queryable } from './db';
import type { PaperListResult, PaperMetadata, PaperRow } from './types';

export interface PaperListOptions {
  search?: string;
  category?: string;
  page: number;
  pageSize: number;
}

export interface PaperRepo {
  insert(arxivId: string): Promise<PaperRow>;
  findByRef(ref: string): Promise<PaperRow | null>;
  list(options: PaperListOptions): Promise<PaperListResult>;
  /** Atomically claim the next stale `ingesting` paper (FOR UPDATE SKIP LOCKED + lease). */
  claimNextIngesting(graceSeconds: number): Promise<PaperRow | null>;
  heartbeat(id: string): Promise<void>;
  finishReady(id: string, metadata: PaperMetadata, markdown: string): Promise<void>;
  markFailed(id: string, message: string): Promise<void>;
  /** Reset a failed paper back to `ingesting` so it can be retried. */
  requeue(id: string): Promise<void>;
  deleteById(id: string): Promise<void>;
}

export function createPaperRepo(sql: Queryable): PaperRepo {
  return {
    async insert(arxivId) {
      const rows = await sql<PaperRow[]>`
        INSERT INTO paper.papers (arxiv_id) VALUES (${arxivId})
        ON CONFLICT (arxiv_id) DO NOTHING
        RETURNING *`;
      if (rows[0]) return rows[0];
      const existing = await sql<PaperRow[]>`
        SELECT * FROM paper.papers WHERE arxiv_id = ${arxivId} LIMIT 1`;
      return existing[0];
    },

    async findByRef(ref) {
      const rows = await sql<PaperRow[]>`
        SELECT * FROM paper.papers
        WHERE id::text = ${ref} OR arxiv_id = ${ref}
        LIMIT 1`;
      return rows[0] ?? null;
    },

    async list({ search, category, page, pageSize }) {
      let where = sql`true`;
      if (search) {
        const pattern = `%${search}%`;
        where = sql`${where} AND (
          arxiv_id ILIKE ${pattern}
          OR metadata->>'title' ILIKE ${pattern}
          OR metadata->>'abstract' ILIKE ${pattern}
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(COALESCE(metadata->'authors', '[]'::jsonb)) AS author
            WHERE author ILIKE ${pattern}
          )
        )`;
      }
      if (category) {
        where = sql`${where} AND metadata->'categories' ? ${category}`;
      }
      const [{ count }] = await sql<[{ count: number }]>`
        SELECT count(*)::int AS count FROM paper.papers WHERE ${where}`;
      const items = await sql<PaperRow[]>`
        SELECT * FROM paper.papers
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
      return { items, total: count };
    },

    async claimNextIngesting(graceSeconds) {
      const rows = await sql<PaperRow[]>`
        UPDATE paper.papers SET updated_at = now()
        WHERE id = (
          SELECT id FROM paper.papers
          WHERE status = 'ingesting'
            AND updated_at < now() - make_interval(secs => ${graceSeconds})
          ORDER BY updated_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *`;
      return rows[0] ?? null;
    },

    async heartbeat(id) {
      await sql`UPDATE paper.papers SET updated_at = now() WHERE id = ${id}`;
    },

    async finishReady(id, metadata, markdown) {
      // postgres.js auto-serializes plain objects as JSON; the explicit
      // ::jsonb cast + `as never` satisfies its parameter typing.
      await sql`
        UPDATE paper.papers
        SET status = 'ready', metadata = ${metadata as never}::jsonb, markdown = ${markdown},
            error_message = NULL, updated_at = now()
        WHERE id = ${id}`;
    },

    async markFailed(id, message) {
      const truncated = truncateBytes(message, 2048);
      await sql`
        UPDATE paper.papers
        SET status = 'failed', error_message = ${truncated}, updated_at = now()
        WHERE id = ${id}`;
    },

    async requeue(id) {
      await sql`
        UPDATE paper.papers
        SET status = 'ingesting', error_message = NULL, updated_at = now()
        WHERE id = ${id}`;
    },

    async deleteById(id) {
      await sql`DELETE FROM paper.papers WHERE id = ${id}`;
    },
  };
}

function truncateBytes(value: string, maxBytes: number): string {
  let out = value;
  while (Buffer.byteLength(out, 'utf8') > maxBytes) out = out.slice(0, -1);
  return out;
}

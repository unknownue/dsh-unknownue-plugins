/**
 * DSH-session ↔ paper binding repo (paper.paper_sessions).
 *
 * DSH's SessionHeader has no free-form metadata, so the binding lives here:
 * one row per linked session. Multiple sessions may link to one paper.
 */
import type { Queryable } from './db';

export interface SessionLinkRow {
  sessionId: string;
  arxivId: string;
  createdAt: Date;
}

export interface SessionLinkRepo {
  link(sessionId: string, arxivId: string): Promise<void>;
  findBySession(sessionId: string): Promise<SessionLinkRow | null>;
  findByPaper(arxivId: string): Promise<SessionLinkRow[]>;
  unlink(sessionId: string): Promise<void>;
}

export function createSessionLinkRepo(sql: Queryable): SessionLinkRepo {
  return {
    async link(sessionId, arxivId) {
      await sql`
        INSERT INTO paper.paper_sessions (session_id, arxiv_id)
        VALUES (${sessionId}, ${arxivId})
        ON CONFLICT (session_id) DO UPDATE SET arxiv_id = EXCLUDED.arxiv_id`;
    },
    async findBySession(sessionId) {
      const rows = await sql<SessionLinkRow[]>`
        SELECT * FROM paper.paper_sessions WHERE session_id = ${sessionId} LIMIT 1`;
      return rows[0] ?? null;
    },
    async findByPaper(arxivId) {
      return sql<SessionLinkRow[]>`
        SELECT * FROM paper.paper_sessions WHERE arxiv_id = ${arxivId} ORDER BY created_at DESC`;
    },
    async unlink(sessionId) {
      await sql`DELETE FROM paper.paper_sessions WHERE session_id = ${sessionId}`;
    },
  };
}

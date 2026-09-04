/**
 * Task-board schema. Idempotent: the whole script runs on every boot
 * (CREATE TABLE IF NOT EXISTS / ON CONFLICT DO NOTHING), mirroring how
 * paperspace runs its migrations.
 *
 * Conventions (borrowed from the community @achasoft/dsh-tasks-manager board):
 * - `rank` is a fractional index, not a position — moving a card between two
 *   neighbours writes exactly one row and concurrent drags cannot scramble a
 *   column.
 * - `meta.revision` is a monotonically increasing integer the browser polls to
 *   decide whether to refetch the board (the board state deliberately lives
 *   OUTSIDE the DSH session log).
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'todo',
  priority     TEXT NOT NULL DEFAULT 'medium',
  due_at       TEXT,
  due_until    TEXT,
  rank         REAL NOT NULL DEFAULT 1024,
  archived     INTEGER NOT NULL DEFAULT 0,
  created_at   BIGINT NOT NULL,
  updated_at   BIGINT NOT NULL,
  completed_at BIGINT,
  todos        TEXT NOT NULL DEFAULT '[]'
);

-- Columns for databases booted before the features landed:
-- CREATE TABLE IF NOT EXISTS does not touch an existing table, so the
-- idempotent ALTERs cover every already-booted board.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS todos TEXT NOT NULL DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_until TEXT;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO meta (key, value) VALUES ('schema_version', '1') ON CONFLICT (key) DO NOTHING;
INSERT INTO meta (key, value) VALUES ('revision', '0') ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_tasks_status_rank ON tasks (status, rank) WHERE archived = 0;
`;

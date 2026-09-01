/**
 * Paperspace PostgreSQL schema, ported VERBATIM from vendor/paperspace:
 *   infra/postgres/001_paper_schema.sql
 *   infra/postgres/002_translation_provider.sql
 *
 * Runs against in-process PGlite (real PostgreSQL); `pgcrypto` is registered
 * on the PGlite instance in db.ts. Keep this file byte-for-byte in sync with
 * the source migrations when they change.
 */
export const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS paper;
CREATE TYPE paper.paper_status AS ENUM ('ingesting', 'ready', 'failed');
CREATE TYPE paper.job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE paper.message_role AS ENUM ('user', 'assistant', 'tool');
CREATE TABLE paper.papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), arxiv_id text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, markdown text, status paper.paper_status NOT NULL DEFAULT 'ingesting',
  error_message text CHECK (error_message IS NULL OR octet_length(error_message) <= 2048),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE paper.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), paper_id uuid NOT NULL REFERENCES paper.papers(id) ON DELETE CASCADE,
  original_url text NOT NULL, object_key text NOT NULL UNIQUE, content_type text NOT NULL, size_bytes bigint NOT NULL CHECK (size_bytes >= 0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE paper.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), paper_id uuid NOT NULL REFERENCES paper.papers(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation', title_is_manual boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE paper.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chat_id uuid NOT NULL REFERENCES paper.chats(id) ON DELETE CASCADE,
  role paper.message_role NOT NULL, content text NOT NULL DEFAULT '', thinking text, tool_calls jsonb, tool_result jsonb, usage jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE paper.paper_translations (
  paper_id uuid NOT NULL REFERENCES paper.papers(id) ON DELETE CASCADE, target_lang text NOT NULL CHECK (target_lang IN ('zh-CN', 'en-US', 'ja-JP')),
  paragraphs jsonb NOT NULL DEFAULT '[]'::jsonb, offsets jsonb NOT NULL DEFAULT '[]'::jsonb, glossary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status paper.job_status NOT NULL, model text, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (paper_id, target_lang)
);
CREATE TABLE paper.translation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), paper_id uuid NOT NULL REFERENCES paper.papers(id) ON DELETE CASCADE,
  target_lang text NOT NULL CHECK (target_lang IN ('zh-CN', 'en-US', 'ja-JP')), status paper.job_status NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0), total integer NOT NULL DEFAULT 0 CHECK (total >= 0), attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, error text, glossary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_translation_job ON paper.translation_jobs(paper_id, target_lang) WHERE status IN ('pending', 'running');
CREATE INDEX papers_search_idx ON paper.papers USING gin (metadata);
CREATE INDEX translation_jobs_claim_idx ON paper.translation_jobs(status, available_at);
ALTER TABLE paper.translation_jobs ADD COLUMN IF NOT EXISTS provider jsonb;
`;

/**
 * v2: DSH-session ↔ paper binding. Runs IDEMPOTENTLY on every boot (existing
 * databases never re-run the guarded schema above).
 */
export const SESSION_LINKS_SQL = `
CREATE TABLE IF NOT EXISTS paper.paper_sessions (
  session_id text PRIMARY KEY,
  arxiv_id text NOT NULL REFERENCES paper.papers(arxiv_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

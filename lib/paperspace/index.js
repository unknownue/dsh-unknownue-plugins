// src/host/paperspace/db.ts
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";

// src/host/paperspace/schema.ts
var SCHEMA_SQL = `
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
var SESSION_LINKS_SQL = `
CREATE TABLE IF NOT EXISTS paper.paper_sessions (
  session_id text PRIMARY KEY,
  arxiv_id text NOT NULL REFERENCES paper.papers(arxiv_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

// src/host/paperspace/db.ts
function createPaperspaceRuntime(config) {
  const pglite = new PGlite({
    dataDir: config.dataDir,
    initialMemory: config.initialMemoryBytes,
    extensions: { pgcrypto }
  });
  const server = new PGLiteSocketServer({ db: pglite, port: config.port, host: "127.0.0.1" });
  let port = config.port;
  let sql;
  let serverStarted = false;
  let disposed = false;
  const ready = (async () => {
    await pglite.waitReady;
    await server.start();
    serverStarted = true;
    const bound = server.port;
    if (typeof bound === "number") port = bound;
    const exists = await pglite.query(
      `SELECT to_regclass('paper.papers') AS name`
    );
    if (exists.rows[0]?.name === null) await pglite.exec(SCHEMA_SQL);
    await pglite.exec(SESSION_LINKS_SQL);
    sql = postgres({
      host: "127.0.0.1",
      port,
      user: "postgres",
      database: "postgres",
      max: 2,
      connect_timeout: 10,
      idle_timeout: 20,
      transform: postgres.camel
    });
  })();
  return {
    ready,
    get port() {
      return port;
    },
    async getSql() {
      await ready;
      return sql;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      void (async () => {
        try {
          if (serverStarted) await server.stop();
        } catch {
        }
        try {
          if (sql) await sql.end({ timeout: 5 });
        } catch {
        }
        try {
          await pglite.close();
        } catch {
        }
      })();
    }
  };
}

// src/host/paperspace/dsh-integration.ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/host/paperspace/domain/papers.ts
function createPaperRepo(sql) {
  return {
    async insert(arxivId) {
      const rows = await sql`
        INSERT INTO paper.papers (arxiv_id) VALUES (${arxivId})
        ON CONFLICT (arxiv_id) DO NOTHING
        RETURNING *`;
      if (rows[0]) return rows[0];
      const existing = await sql`
        SELECT * FROM paper.papers WHERE arxiv_id = ${arxivId} LIMIT 1`;
      return existing[0];
    },
    async findByRef(ref) {
      const rows = await sql`
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
      const [{ count }] = await sql`
        SELECT count(*)::int AS count FROM paper.papers WHERE ${where}`;
      const items = await sql`
        SELECT * FROM paper.papers
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
      return { items, total: count };
    },
    async claimNextIngesting(graceSeconds) {
      const rows = await sql`
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
      await sql`
        UPDATE paper.papers
        SET status = 'ready', metadata = ${metadata}::jsonb, markdown = ${markdown},
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
    }
  };
}
function truncateBytes(value, maxBytes) {
  let out = value;
  while (Buffer.byteLength(out, "utf8") > maxBytes) out = out.slice(0, -1);
  return out;
}

// src/host/paperspace/domain/session-links.ts
function createSessionLinkRepo(sql) {
  return {
    async link(sessionId, arxivId) {
      await sql`
        INSERT INTO paper.paper_sessions (session_id, arxiv_id)
        VALUES (${sessionId}, ${arxivId})
        ON CONFLICT (session_id) DO UPDATE SET arxiv_id = EXCLUDED.arxiv_id`;
    },
    async findBySession(sessionId) {
      const rows = await sql`
        SELECT * FROM paper.paper_sessions WHERE session_id = ${sessionId} LIMIT 1`;
      return rows[0] ?? null;
    },
    async findByPaper(arxivId) {
      return sql`
        SELECT * FROM paper.paper_sessions WHERE arxiv_id = ${arxivId} ORDER BY created_at DESC`;
    },
    async unlink(sessionId) {
      await sql`DELETE FROM paper.paper_sessions WHERE session_id = ${sessionId}`;
    }
  };
}

// src/host/paperspace/dsh-integration.ts
function papersSubdir(workspaceDir) {
  return join(workspaceDir, "papers");
}
async function ensurePapersDir(workspaceDir) {
  const dir = papersSubdir(workspaceDir);
  await mkdir(dir, { recursive: true });
  return dir;
}
async function ensurePaperMarkdown(sql, workspaceDir, arxivId) {
  const papers = createPaperRepo(sql);
  const row = await papers.findByRef(arxivId);
  if (!row || !row.markdown) throw new Error("paper content unavailable");
  const dir = await ensurePapersDir(workspaceDir);
  const file = join(dir, arxivId + ".md");
  await writeFile(file, row.markdown, "utf8");
  return file;
}
function callerSessionId(exec) {
  const agent = exec?.agent;
  return agent?.id ?? agent?.sessionId;
}
async function resolveCallerPaper(sql, exec) {
  const sessionId = callerSessionId(exec);
  if (!sessionId) return null;
  const link = await createSessionLinkRepo(sql).findBySession(sessionId);
  if (!link) return null;
  const paper = await createPaperRepo(sql).findByRef(link.arxivId);
  return paper?.markdown ?? null;
}
function paperTextForScope(scope, cache) {
  if (scope === null || typeof scope !== "object") return "";
  const agentId = scope.id;
  if (typeof agentId !== "string") return "";
  return cache.get(agentId) ?? "";
}
var SEARCH_MAX_RESULTS = 8;
var SEARCH_MAX_PASSAGE = 1200;
var SECTION_MAX_CHARS = 12e3;
function textBlock(value) {
  return [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }];
}
function registerPaperTools(tools, getSql) {
  if (!tools) return [];
  const registered = [];
  tools.register(
    defineTool({
      name: "search_paper",
      description: "Search passages in the CURRENT PAPER only (the paper linked to this session). Returns up to 8 scored passages; use it to ground answers in the paper. Not for other documents.",
      parameters: {
        query: { type: "string", required: true, description: "Search terms, lowercased for matching." }
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            passages: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  index: { type: "integer", description: "0-based paragraph index in the paper markdown." },
                  passage: { type: "string", description: "Matching paragraph, truncated." }
                }
              }
            },
            note: { type: "string", description: "Human-readable note when no paper is bound or nothing matches." }
          }
        },
        render: (_args, value) => textBlock(value)
      },
      async execute(args, exec) {
        const sql = await getSql();
        const markdown = await resolveCallerPaper(sql, exec);
        if (!markdown) return { passages: [], note: "This session is not linked to a paper. Link one through the picker above the composer or the \u8BBA\u6587 tab (\u4E0E AI \u8BA8\u8BBA)." };
        const query = String(args.query).toLowerCase();
        const terms = query.split(/\s+/).filter(Boolean);
        const paragraphs = markdown.split(/\n\s*\n/);
        const passages = paragraphs.map((text, index) => ({ text, index, score: terms.filter((term) => text.toLowerCase().includes(term)).length })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, SEARCH_MAX_RESULTS).map(({ text, index }) => ({ index, passage: text.slice(0, SEARCH_MAX_PASSAGE) }));
        return { passages, note: passages.length ? "" : "No passages matched." };
      }
    })
  );
  registered.push("search_paper");
  tools.register(
    defineTool({
      name: "read_section",
      description: "Read one heading section from the CURRENT PAPER only (the paper linked to this session). Returns the section text up to a character cap.",
      parameters: {
        heading: { type: "string", required: true, description: "Exact section heading text (without the # markers)." }
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            heading: { type: "string" },
            content: { type: "json", description: "Section markdown, or null when the heading was not found." },
            note: { type: "string", description: "Present only when the session is not linked to a paper." }
          }
        },
        render: (_args, value) => textBlock(value)
      },
      async execute(args, exec) {
        const sql = await getSql();
        const markdown = await resolveCallerPaper(sql, exec);
        if (!markdown) return { heading: String(args.heading), content: null, note: "This session is not linked to a paper. Link one through the picker above the composer or the \u8BBA\u6587 tab." };
        const wanted = String(args.heading).toLowerCase().trim();
        const lines = markdown.split("\n");
        const start = lines.findIndex((line) => /^#{1,6}\s+/.test(line) && line.replace(/^#{1,6}\s+/, "").trim().toLowerCase() === wanted);
        if (start < 0) return { heading: String(args.heading), content: null };
        const level = (lines[start].match(/^#+/) ?? [""])[0].length;
        const end = lines.findIndex((line, i) => i > start && new RegExp(`^#{1,${level}}\\s+`).test(line));
        return {
          heading: lines[start].replace(/^#+\s+/, ""),
          content: lines.slice(start, end < 0 ? void 0 : end).join("\n").slice(0, SECTION_MAX_CHARS)
        };
      }
    })
  );
  registered.push("read_section");
  return registered;
}

// src/host/paperspace/filestore.ts
import { createReadStream } from "node:fs";
import { mkdir as mkdir2, rm, stat, writeFile as writeFile2 } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
var FileObjectStore = class {
  constructor(root) {
    this.root = root;
  }
  ready = null;
  /** Idempotently create the root directory on first use. */
  ensureBucket() {
    this.ready ??= mkdir2(this.root, { recursive: true }).then(() => void 0);
    return this.ready;
  }
  /** Resolve an object key inside the root; keys are code-generated, this is belt-and-braces. */
  keyPath(key) {
    const path = resolve(this.root, key);
    const rel = relative(this.root, path);
    if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("invalid object key");
    return path;
  }
  async putObject(key, data, _contentType) {
    await this.ensureBucket();
    const path = this.keyPath(key);
    await mkdir2(dirname(path), { recursive: true });
    await writeFile2(path, data);
  }
  /** Rejects with ENOENT when the key is missing (same contract as MinIO). */
  async getObject(key) {
    await this.ensureBucket();
    const path = this.keyPath(key);
    await stat(path);
    return createReadStream(path);
  }
  async deleteObject(key) {
    await this.ensureBucket();
    await rm(this.keyPath(key), { force: true });
  }
  /** Best-effort batch delete; failures are logged and do not throw. */
  async deleteObjects(keys) {
    for (const key of keys) {
      try {
        await this.deleteObject(key);
      } catch (error) {
        console.warn(`[paperspace:object-store] deleteObject failed for ${key}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
};

// src/host/paperspace/routes.ts
import { createReadStream as createReadStream2, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname as dirname3, join as join3 } from "node:path";
import { z as z2 } from "zod";

// src/host/makefile.ts
var MAX_BODY_BYTES = 1 << 20;
var LOOPBACK_HOSTNAMES = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1"]);
function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
function hostNameOf(host) {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end >= 0 ? host.slice(1, end) : host;
  }
  return host.split(":")[0] ?? "";
}
function isLoopbackHost(host) {
  return host !== void 0 && LOOPBACK_HOSTNAMES.has(hostNameOf(host).toLowerCase());
}
function messageOf(value) {
  return value instanceof Error ? value.message : String(value);
}
function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("request body is too large");
    chunks.push(buffer);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("request body must be a JSON object");
  return parsed;
}

// src/host/paperspace/domain/db.ts
import postgres2 from "postgres";

// src/host/paperspace/domain/assets.ts
function createAssetRepo(sql) {
  return {
    async insertMany(paperId, assets) {
      if (assets.length === 0) return [];
      const values = assets.map(
        (asset) => [paperId, asset.originalUrl, asset.objectKey, asset.contentType, asset.sizeBytes]
      );
      const rows = await sql`
        INSERT INTO paper.assets (paper_id, original_url, object_key, content_type, size_bytes)
        VALUES ${sql(values)}
        ON CONFLICT (object_key) DO UPDATE
          SET size_bytes = EXCLUDED.size_bytes, content_type = EXCLUDED.content_type
        RETURNING id, original_url`;
      return rows;
    },
    async listByPaper(paperId) {
      return sql`
        SELECT * FROM paper.assets
        WHERE paper_id = ${paperId}
        ORDER BY created_at ASC, id ASC`;
    },
    async findByPaperAndId(paperId, assetId) {
      const rows = await sql`
        SELECT * FROM paper.assets
        WHERE paper_id = ${paperId} AND id = ${assetId}
        LIMIT 1`;
      return rows[0] ?? null;
    },
    async keysByPaper(paperId) {
      const rows = await sql`
        SELECT object_key FROM paper.assets WHERE paper_id = ${paperId}`;
      return rows.map((row) => row.objectKey);
    }
  };
}

// src/host/paperspace/domain/translations.ts
var ACTIVE = `status IN ('pending', 'running')`;
function createTranslationRepo(sql) {
  return {
    async findActiveJob(paperId, targetLang) {
      const rows = await sql`
        SELECT * FROM paper.translation_jobs
        WHERE paper_id = ${paperId} AND target_lang = ${targetLang} AND ${sql.unsafe(ACTIVE)}
        LIMIT 1`;
      return rows[0] ?? null;
    },
    async createJob(paperId, targetLang, provider) {
      const active = await sql`
        SELECT * FROM paper.translation_jobs
        WHERE paper_id = ${paperId} AND target_lang = ${targetLang} AND ${sql.unsafe(ACTIVE)}
        LIMIT 1`;
      if (active[0]) return active[0];
      const inserted = await sql`
        INSERT INTO paper.translation_jobs (paper_id, target_lang, provider)
        VALUES (${paperId}, ${targetLang}, ${provider}::jsonb)
        ON CONFLICT DO NOTHING
        RETURNING *`;
      if (inserted[0]) {
        await sql`DELETE FROM paper.paper_translations WHERE paper_id = ${paperId} AND target_lang = ${targetLang}`;
        return inserted[0];
      }
      const winner = await sql`
        SELECT * FROM paper.translation_jobs
        WHERE paper_id = ${paperId} AND target_lang = ${targetLang} AND ${sql.unsafe(ACTIVE)}
        LIMIT 1`;
      if (winner[0]) return winner[0];
      throw new Error("translation job create race left no active job");
    },
    async findLatestJob(paperId, targetLang) {
      const rows = await sql`
        SELECT * FROM paper.translation_jobs
        WHERE paper_id = ${paperId} AND target_lang = ${targetLang}
        ORDER BY created_at DESC, id DESC
        LIMIT 1`;
      return rows[0] ?? null;
    },
    async claimNextJob() {
      const rows = await sql`
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
        VALUES (${paperId}, ${targetLang}, '[]'::jsonb, ${offsets}::jsonb, '{}'::jsonb, 'running', NULL)
        ON CONFLICT (paper_id, target_lang) DO UPDATE
        SET status = 'running', offsets = EXCLUDED.offsets, updated_at = now()
        WHERE EXISTS (SELECT 1 FROM paper.translation_jobs WHERE id = ${jobId} AND ${sql.unsafe(ACTIVE)})`;
    },
    async findSnapshot(paperId, targetLang) {
      const rows = await sql`
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
        SELECT ${paperId}, ${targetLang}, ${paragraphs}::jsonb, ${offsets}::jsonb,
               ${glossary}::jsonb, 'running', ${model}
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
        SET glossary = ${glossary}::jsonb, updated_at = now()
        WHERE id = ${jobId}`;
    },
    async jobStatus(jobId) {
      const rows = await sql`
        SELECT status FROM paper.translation_jobs WHERE id = ${jobId} LIMIT 1`;
      return rows[0]?.status ?? null;
    },
    async finishJob(jobId, paperId, targetLang, model) {
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
              started_at = NULL, error = ${truncateBytes2(error, 2048)}, updated_at = now()
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
          SET status = 'failed', error = ${truncateBytes2(error, 2048)}, updated_at = now()
          WHERE id = ${jobId}
          RETURNING paper_id, target_lang
        )
        UPDATE paper.paper_translations t
        SET status = 'failed', updated_at = now()
        FROM failed
        WHERE t.paper_id = failed.paper_id AND t.target_lang = failed.target_lang`;
    },
    async cancelActiveJob(paperId, targetLang) {
      const rows = await sql`
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
      const rows = await sql`
        UPDATE paper.translation_jobs
        SET status = 'pending', started_at = NULL, available_at = now(), updated_at = now()
        WHERE status = 'running'
          AND started_at IS NOT NULL
          AND started_at < now() - make_interval(mins => ${stuckAfterMinutes})
        RETURNING id`;
      return rows.length;
    }
  };
}
function truncateBytes2(value, maxBytes) {
  let out = value;
  while (Buffer.byteLength(out, "utf8") > maxBytes) out = out.slice(0, -1);
  return out;
}

// src/host/paperspace/domain/paragraphs.ts
var REFERENCES_HEADING_RE = /^\s*(?:(?:references?|bibliography)\b|参考文献|文献)(?:[\s:：.、]|$)/i;
var IMAGE_ONLY_RE = /^!\[[^\]]*\]\([^)]*\)$/;
var HORIZONTAL_RULE_RE = /^(?:---+|\*\*\*+)\s*$/;
var HTML_TABLE_START_RE = /<table\b/i;
function splitParagraphs(markdown) {
  const blocks = groupBlocks(markdown);
  const paragraphs = [];
  let inReferences = false;
  let index = 0;
  for (const block of blocks) {
    const firstLine = block.text.split("\n", 1)[0].trim();
    if (firstLine.startsWith("```")) continue;
    const heading = block.text.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      if (heading[1].length <= 2) inReferences = REFERENCES_HEADING_RE.test(heading[2]);
      continue;
    }
    if (inReferences) continue;
    if (HORIZONTAL_RULE_RE.test(block.text)) continue;
    if (/^\$\$/.test(block.text)) continue;
    const trimmed = block.text.trim();
    if (!trimmed) continue;
    if (trimmed.split("\n").every((line) => IMAGE_ONLY_RE.test(line.trim()))) continue;
    if (trimmed.startsWith("<") && trimmed.endsWith(">")) continue;
    const tableAt = block.text.search(HTML_TABLE_START_RE);
    if (tableAt >= 0) {
      const caption = block.text.slice(0, tableAt).trim();
      if (!caption) continue;
      paragraphs.push({ index: index++, start: block.start, end: block.start + caption.length, text: caption });
      continue;
    }
    paragraphs.push({ index: index++, start: block.start, end: block.end, text: trimmed });
  }
  return paragraphs;
}
function groupBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split("\n");
  let lineStart = 0;
  let blockStart = -1;
  let blockEnd = -1;
  let blockLines = [];
  let inFence = false;
  const flush = () => {
    if (blockLines.length > 0) {
      blocks.push({ start: blockStart, end: blockEnd, text: blockLines.join("\n") });
      blockLines = [];
      blockStart = -1;
    }
  };
  for (let i = 0; i <= lines.length; i++) {
    const line = i < lines.length ? lines[i] : "";
    if (blockLines.length === 0 && line.trimStart().startsWith("```")) inFence = !inFence;
    const blank = line.trim() === "";
    if (!blank || inFence) {
      if (blockStart < 0) blockStart = lineStart;
      blockEnd = lineStart + line.length;
      blockLines.push(line);
      if (line.trimStart().startsWith("```") && blockLines.length > 1) inFence = !inFence;
    } else {
      flush();
    }
    lineStart += line.length + 1;
  }
  flush();
  return blocks;
}

// src/host/paperspace/settings.ts
import { readFileSync, existsSync } from "node:fs";
import { mkdir as mkdir3, writeFile as writeFile3 } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname as dirname2, isAbsolute as isAbsolute2, join as join2, resolve as resolve2 } from "node:path";
import { z } from "zod";
function paperspaceHome() {
  return process.env.DSH_HOME || join2(homedir(), ".dsh");
}
function paperspaceSettingsPath() {
  return join2(paperspaceHome(), "paperspace", "settings.json");
}
function normalizePath(value) {
  const expanded = value === "~" || value.startsWith("~/") ? join2(homedir(), value.slice(1)) : value;
  return isAbsolute2(expanded) ? resolve2(expanded) : resolve2(process.cwd(), expanded);
}
function builtinDefaults() {
  const root = join2(paperspaceHome(), "paperspace");
  return {
    dataDir: join2(root, "db"),
    assetsDir: join2(root, "assets"),
    workspaceDir: join2(root, "workspace"),
    port: 0,
    initialMemoryBytes: 512 * 1024 * 1024,
    pollMs: 5e3,
    ingestTimeoutMs: 3e4,
    maxAssetBytes: 10 * 1024 * 1024,
    ingestConcurrency: 2,
    translateMaxAttempts: 3,
    translateStuckAfterMinutes: 30,
    translateTimeoutMs: 12e4,
    rescanIntervalMs: 6e4
  };
}
function resolveConfig(row = {}, file = null) {
  const base = builtinDefaults();
  const norm = (value) => typeof value === "string" && value !== "" ? normalizePath(value) : void 0;
  const rowDataDir = norm(row.dataDir) ?? base.dataDir;
  const merged = {
    dataDir: rowDataDir,
    assetsDir: norm(row.assetsDir) ?? base.assetsDir,
    // Default the DSH workspace anchor next to the DATA directory, not the
    // builtin root, so relocated libraries keep their workspace beside them.
    workspaceDir: norm(row.workspaceDir) ?? join2(dirname2(rowDataDir), "workspace"),
    port: typeof row.port === "number" ? row.port : base.port,
    initialMemoryBytes: typeof row.initialMemoryBytes === "number" ? row.initialMemoryBytes : base.initialMemoryBytes,
    pollMs: typeof row.pollMs === "number" ? row.pollMs : base.pollMs,
    ingestTimeoutMs: typeof row.ingestTimeoutMs === "number" ? row.ingestTimeoutMs : base.ingestTimeoutMs,
    maxAssetBytes: typeof row.maxAssetBytes === "number" ? row.maxAssetBytes : base.maxAssetBytes,
    ingestConcurrency: typeof row.ingestConcurrency === "number" ? row.ingestConcurrency : base.ingestConcurrency,
    translateMaxAttempts: typeof row.translateMaxAttempts === "number" ? row.translateMaxAttempts : base.translateMaxAttempts,
    translateStuckAfterMinutes: typeof row.translateStuckAfterMinutes === "number" ? row.translateStuckAfterMinutes : base.translateStuckAfterMinutes,
    translateTimeoutMs: typeof row.translateTimeoutMs === "number" ? row.translateTimeoutMs : base.translateTimeoutMs,
    rescanIntervalMs: typeof row.rescanIntervalMs === "number" ? row.rescanIntervalMs : base.rescanIntervalMs
  };
  if (!file) return merged;
  const fileDataDir = file.dataDir ? normalizePath(file.dataDir) : merged.dataDir;
  return {
    dataDir: fileDataDir,
    assetsDir: file.assetsDir ? normalizePath(file.assetsDir) : merged.assetsDir,
    workspaceDir: file.workspaceDir ? normalizePath(file.workspaceDir) : join2(dirname2(fileDataDir), "workspace"),
    port: file.port,
    initialMemoryBytes: file.initialMemoryBytes,
    pollMs: file.pollMs,
    ingestTimeoutMs: file.ingestTimeoutMs,
    maxAssetBytes: file.maxAssetBytes,
    ingestConcurrency: file.ingestConcurrency,
    translateMaxAttempts: file.translateMaxAttempts,
    translateStuckAfterMinutes: file.translateStuckAfterMinutes,
    translateTimeoutMs: file.translateTimeoutMs,
    rescanIntervalMs: file.rescanIntervalMs
  };
}
var pathSchema = z.string().min(1).max(1024);
var settingsInputSchema = z.object({
  configured: z.boolean(),
  dataDir: pathSchema.optional(),
  assetsDir: pathSchema.optional(),
  workspaceDir: pathSchema.optional(),
  port: z.number().int().min(0).max(65535).optional(),
  initialMemoryBytes: z.number().int().min(64 * 1024 * 1024).max(8 * 1024 * 1024 * 1024).optional(),
  pollMs: z.number().int().min(500).max(36e5).optional(),
  ingestTimeoutMs: z.number().int().min(1e3).max(6e5).optional(),
  maxAssetBytes: z.number().int().min(1024).max(1024 * 1024 * 1024).optional(),
  ingestConcurrency: z.number().int().min(1).max(16).optional(),
  translateMaxAttempts: z.number().int().min(1).max(10).optional(),
  translateStuckAfterMinutes: z.number().int().min(1).max(1440).optional(),
  translateTimeoutMs: z.number().int().min(1e3).max(36e5).optional(),
  rescanIntervalMs: z.number().int().min(5e3).max(864e5).optional()
}).strict();
function applySettingsInput(input, current, row) {
  const base = current ?? { version: 1, configured: false, ...resolveConfig(row) };
  const dataDir = input.dataDir !== void 0 ? normalizePath(input.dataDir) : base.dataDir;
  return {
    version: 1,
    configured: input.configured,
    dataDir,
    assetsDir: input.assetsDir !== void 0 ? normalizePath(input.assetsDir) : base.assetsDir,
    workspaceDir: input.workspaceDir !== void 0 && input.workspaceDir !== "" ? normalizePath(input.workspaceDir) : base.workspaceDir !== "" ? base.workspaceDir : join2(dirname2(dataDir), "workspace"),
    port: input.port ?? base.port,
    initialMemoryBytes: input.initialMemoryBytes ?? base.initialMemoryBytes,
    pollMs: input.pollMs ?? base.pollMs,
    ingestTimeoutMs: input.ingestTimeoutMs ?? base.ingestTimeoutMs,
    maxAssetBytes: input.maxAssetBytes ?? base.maxAssetBytes,
    ingestConcurrency: input.ingestConcurrency ?? base.ingestConcurrency,
    translateMaxAttempts: input.translateMaxAttempts ?? base.translateMaxAttempts,
    translateStuckAfterMinutes: input.translateStuckAfterMinutes ?? base.translateStuckAfterMinutes,
    translateTimeoutMs: input.translateTimeoutMs ?? base.translateTimeoutMs,
    rescanIntervalMs: input.rescanIntervalMs ?? base.rescanIntervalMs
  };
}
var settingsFileSchema = settingsInputSchema.extend({
  version: z.number().int().min(0).max(10).optional()
});
function loadSettingsFile() {
  const path = paperspaceSettingsPath();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const input = settingsFileSchema.safeParse(parsed);
    if (!input.success) return null;
    return applySettingsInput({ ...input.data, configured: input.data.configured }, null, {});
  } catch {
    return null;
  }
}
async function saveSettingsFile(settings) {
  const path = paperspaceSettingsPath();
  await mkdir3(dirname2(path), { recursive: true });
  await writeFile3(path, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

// src/host/paperspace/shared.ts
var ARXIV_ID_PATTERN = /^\d{4}\.\d{5}(v\d+)?$/;
function isArxivId(value) {
  return ARXIV_ID_PATTERN.test(value);
}

// src/host/paperspace/routes.ts
var PAPERS_API = "/dsh-unknownue-plugins/paperspace/api";
var PAPERS_FONTS = "/dsh-unknownue-plugins/paperspace/static/fonts";
var FONT_TYPES = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf"
};
function katexFontsDir() {
  const require2 = createRequire(import.meta.url);
  let root;
  try {
    root = dirname3(require2.resolve("katex/package.json"));
  } catch {
    root = dirname3(dirname3(require2.resolve("katex")));
  }
  return join3(root, "dist", "fonts");
}
var refSchema = z2.object({ paperRef: z2.string().min(1).max(64) });
var assetParamsSchema = z2.object({ paperRef: z2.string().min(1).max(64), assetId: z2.string().uuid() });
var arxivSchema = z2.object({ arxiv_id: z2.string().refine(isArxivId, "Expected arXiv YYMM.NNNNN[vN]") }).strict();
var listQuerySchema = z2.object({
  page: z2.coerce.number().int().positive().default(1),
  page_size: z2.coerce.number().int().min(1).max(100).default(20),
  search: z2.string().max(200).optional(),
  category: z2.string().max(80).optional()
});
var modelConfiguration = z2.object({ base_url: z2.string().url().max(2048), api_key: z2.string().min(1).max(4096), model: z2.string().min(1).max(200) }).strict();
var translateLang = z2.enum(["zh-CN", "en-US", "ja-JP"]);
var translateInput = z2.object({ target_lang: translateLang, provider: modelConfiguration.optional() }).strict();
var translationQuery = z2.object({ lang: translateLang.default("zh-CN") });
function meta(paper) {
  return paper.metadata ?? {};
}
function toSummary(paper) {
  const m = meta(paper);
  return {
    id: paper.id,
    arxivId: paper.arxivId,
    title: m.title ?? paper.arxivId,
    authors: m.authors ?? [],
    categories: m.categories ?? [],
    publishedAt: m.published ?? void 0,
    abstract: m.abstract ?? void 0,
    status: paper.status,
    errorMessage: paper.errorMessage ?? void 0
  };
}
function toDetail(paper) {
  return { ...toSummary(paper), abstract: meta(paper).abstract ?? "", markdown: paper.markdown ?? "" };
}
function toAsset(row) {
  return {
    id: row.id,
    paperId: row.paperId,
    originalUrl: row.originalUrl,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString()
  };
}
function toJob(row) {
  return {
    id: row.id,
    paperId: row.paperId,
    targetLang: row.targetLang,
    status: row.status,
    progress: row.progress,
    total: row.total,
    attempts: row.attempts,
    startedAt: row.startedAt?.toISOString() ?? null,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    // Redacted: the persisted api key never leaves the API.
    provider: row.provider ? { baseUrl: row.provider.baseUrl, model: row.provider.model } : null
  };
}
function toSnapshot(row) {
  return {
    paperId: row.paperId,
    targetLang: row.targetLang,
    paragraphs: row.paragraphs,
    offsets: row.offsets,
    glossary: row.glossary,
    status: row.status,
    model: row.model,
    updatedAt: row.updatedAt.toISOString()
  };
}
function serverProvider() {
  if (!process.env.LLM_API_KEY) return null;
  return {
    base_url: process.env.LLM_BASE_URL ?? "https://api.deepseek.com",
    api_key: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL ?? "deepseek-chat"
  };
}
function registerRoutes(webServer, host) {
  const wrap = (handler) => async (req, res) => {
    if (!isLoopback(req.socket.remoteAddress) || !isLoopbackHost(req.headers.host)) {
      json(res, 403, { code: "FORBIDDEN", message: "loopback-only" });
      return;
    }
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        json(res, 400, { code: "VALIDATION_ERROR", message: error.issues.map((i) => i.message).join("; ") });
        return;
      }
      if (!res.headersSent) {
        json(res, 500, { code: "INTERNAL_ERROR", message: messageOf(error) });
      }
    }
  };
  webServer.register({
    kind: "exact",
    path: `${PAPERS_API}/health`,
    handler: wrap(async (_req, res) => {
      if (!host.state.configured) return json(res, 200, { status: "not-configured" });
      const { runtime } = await host.ensureStarted();
      const sql = await runtime.getSql();
      await sql`select 1`;
      json(res, 200, { status: "ok" });
    })
  });
  webServer.register({
    kind: "exact",
    path: `${PAPERS_API}/settings`,
    handler: wrap(async (req, res) => {
      if (req.method === "GET") {
        return json(res, 200, {
          configured: host.state.configured,
          restartRequired: host.state.restartRequired,
          settingsPath: host.state.settingsPath,
          defaults: host.row,
          settings: host.file()
        });
      }
      if (req.method === "POST") {
        const input = settingsInputSchema.parse(await readBody(req));
        const result = await host.save(input);
        if (!result.ok) return json(res, 400, { code: "SETTINGS_INVALID", message: result.error });
        return json(res, 200, result);
      }
      return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
    })
  });
  webServer.register({
    kind: "prefix",
    path: `${PAPERS_API}/sessions`,
    handler: wrap(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const rest = url.pathname.slice(`${PAPERS_API}/sessions`.length).replace(/^\//, "").split("/").filter(Boolean);
      if (!host.state.configured) {
        return json(res, 423, {
          code: "PAPERSPACE_NOT_CONFIGURED",
          message: "Paperspace is not configured yet. Open the \u8BBA\u6587 tab or DSH Settings \u2192 UnPlugin \u2192 Paperspace and set the storage location."
        });
      }
      const { runtime, config } = await host.ensureStarted();
      const sql = await runtime.getSql();
      if (rest.length === 1 && req.method === "GET") {
        const link = await createSessionLinkRepo(sql).findBySession(rest[0]);
        if (!link) return json(res, 404, { code: "SESSION_NOT_LINKED", message: "This session is not linked to a paper" });
        const paper = await createPaperRepo(sql).findByRef(link.arxivId);
        if (!paper) return json(res, 404, { code: "PAPER_NOT_FOUND", message: "Paper not found" });
        const meta2 = paper.metadata ?? {};
        return json(res, 200, { sessionId: rest[0], arxivId: link.arxivId, title: meta2.title ?? link.arxivId, status: paper.status });
      }
      if (rest.length === 0 && req.method === "POST") {
        const input = z2.object({ arxiv_id: z2.string().refine(isArxivId, "Expected arXiv YYMM.NNNNN[vN]") }).strict().parse(await readBody(req));
        const paper = await createPaperRepo(sql).findByRef(input.arxiv_id);
        if (!paper) return json(res, 404, { code: "PAPER_NOT_FOUND", message: "Paper not found" });
        if (paper.status !== "ready") return json(res, 409, { code: "PAPER_NOT_READY", message: "Paper is still ingesting or failed; wait for it to be ready" });
        const mdFile = await ensurePaperMarkdown(sql, config.workspaceDir, input.arxiv_id);
        return json(res, 200, { workspaceDir: config.workspaceDir, arxivId: input.arxiv_id, mdFile });
      }
      if (rest.length === 1 && rest[0] === "link" && req.method === "POST") {
        const input = z2.object({ session_id: z2.string().min(1).max(200), arxiv_id: z2.string().refine(isArxivId, "Expected arXiv YYMM.NNNNN[vN]") }).strict().parse(await readBody(req));
        const paper = await createPaperRepo(sql).findByRef(input.arxiv_id);
        if (!paper) return json(res, 404, { code: "PAPER_NOT_FOUND", message: "Paper not found" });
        await createSessionLinkRepo(sql).link(input.session_id, input.arxiv_id);
        const meta2 = paper.metadata ?? {};
        await host.renameSession?.(input.session_id, meta2.title ?? input.arxiv_id);
        await host.refreshPaperContexts?.();
        return json(res, 200, { ok: true, sessionId: input.session_id, arxivId: input.arxiv_id });
      }
      return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
    })
  });
  webServer.register({
    kind: "exact",
    path: `${PAPERS_API}/debug`,
    handler: wrap(async (req, res) => {
      if (req.method !== "GET") return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
      const debug = host.debug?.() ?? {};
      let links = [];
      try {
        const active = host.active();
        if (active) {
          const sql = await active.runtime.getSql();
          links = await sql`
            SELECT session_id, arxiv_id, created_at FROM paper.paper_sessions ORDER BY created_at DESC LIMIT 20`;
        }
      } catch {
      }
      return json(res, 200, { ...debug, links });
    })
  });
  webServer.register({
    kind: "prefix",
    path: PAPERS_FONTS,
    handler: (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const name2 = url.pathname.slice(PAPERS_FONTS.length).replace(/^\//, "");
      if (!/^[\w.-]+\.(woff2|woff|ttf|otf)$/i.test(name2)) return json(res, 404, { code: "NOT_FOUND", message: "not found" });
      let stats;
      let file;
      try {
        file = join3(katexFontsDir(), name2);
        stats = statSync(file);
      } catch {
        return json(res, 404, { code: "NOT_FOUND", message: "not found" });
      }
      const ext = name2.split(".").pop()?.toLowerCase() ?? "";
      res.writeHead(200, {
        "content-type": FONT_TYPES[ext] ?? "application/octet-stream",
        "content-length": String(stats.size),
        "cache-control": "public, max-age=31536000, immutable"
      });
      const stream = createReadStream2(file);
      stream.on("error", () => res.destroy());
      stream.pipe(res);
      return new Promise((resolve3) => {
        res.once("close", resolve3);
        res.once("error", resolve3);
      });
    }
  });
  webServer.register({
    kind: "prefix",
    path: `${PAPERS_API}/papers`,
    handler: wrap(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const rest = url.pathname.slice(`${PAPERS_API}/papers`.length).replace(/^\//, "").split("/").filter(Boolean);
      if (!host.state.configured) {
        return json(res, 423, {
          code: "PAPERSPACE_NOT_CONFIGURED",
          message: "Paperspace is not configured yet. Open the \u8BBA\u6587 tab or DSH Settings \u2192 UnPlugin \u2192 Paperspace and set the storage location."
        });
      }
      const { runtime, store } = await host.ensureStarted();
      const sql = await runtime.getSql();
      const papers = createPaperRepo(sql);
      if (rest.length === 0) {
        if (req.method === "POST") {
          const input = arxivSchema.parse(await readBody(req));
          const existing = await papers.findByRef(input.arxiv_id);
          if (existing) {
            if (existing.status === "failed") {
              await papers.requeue(existing.id);
              return json(res, 202, toSummary({ ...existing, status: "ingesting", errorMessage: null }));
            }
            return json(res, 200, toSummary(existing));
          }
          const row = await papers.insert(input.arxiv_id);
          return json(res, 202, toSummary(row));
        }
        if (req.method === "GET") {
          const query = listQuerySchema.parse(Object.fromEntries(url.searchParams));
          const { items, total } = await papers.list({ page: query.page, pageSize: query.page_size, search: query.search, category: query.category });
          return json(res, 200, { items: items.map(toSummary), page: query.page, page_size: query.page_size, total });
        }
        return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
      }
      const paperRef = refSchema.parse({ paperRef: rest[0] }).paperRef;
      const paper = await papers.findByRef(paperRef);
      const paper404 = () => json(res, 404, { code: "PAPER_NOT_FOUND", message: "Paper not found" });
      const action = rest.slice(1).join("/");
      if (rest.length === 1) {
        if (req.method === "GET") {
          if (!paper) return paper404();
          return json(res, 200, toDetail(paper));
        }
        if (req.method === "DELETE") {
          if (!paper) return paper404();
          const assets = createAssetRepo(sql);
          const keys = await assets.keysByPaper(paper.id);
          try {
            await store.deleteObjects(keys);
          } catch (error) {
            console.warn(`[paperspace] object cleanup failed for ${paper.arxivId}: ${messageOf(error)}`);
          }
          await papers.deleteById(paper.id);
          await host.refreshPaperContexts?.();
          return res.writeHead(204).end();
        }
        return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
      }
      if (action === "assets") {
        if (!paper) return paper404();
        const assets = createAssetRepo(sql);
        if (req.method !== "GET") return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
        const rows = await assets.listByPaper(paper.id);
        return json(res, 200, { items: rows.map(toAsset) });
      }
      if (action.startsWith("assets/") && rest.length === 3) {
        if (!paper) return paper404();
        if (req.method !== "GET") return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
        const { assetId } = assetParamsSchema.parse({ paperRef, assetId: rest[2] });
        const assets = createAssetRepo(sql);
        const asset = await assets.findByPaperAndId(paper.id, assetId);
        if (!asset) return json(res, 404, { code: "ASSET_NOT_FOUND", message: "Asset not found" });
        let stream;
        try {
          stream = await store.getObject(asset.objectKey);
        } catch {
          return json(res, 404, { code: "ASSET_NOT_FOUND", message: "Asset not found in storage" });
        }
        res.writeHead(200, {
          "content-type": asset.contentType,
          "content-length": String(asset.sizeBytes),
          "cache-control": "public, max-age=86400"
        });
        return new Promise((resolve3, reject) => {
          stream.on("error", reject);
          stream.pipe(res);
          res.on("close", resolve3);
        });
      }
      if (action === "translate-paper" && rest.length === 2) {
        if (req.method !== "POST") return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
        if (!paper) return paper404();
        if (paper.status !== "ready") return json(res, 409, { code: "PAPER_NOT_READY", message: "Translation requires a ready paper" });
        const { target_lang, provider } = translateInput.parse(await readBody(req));
        const resolved = provider ?? serverProvider();
        if (!resolved) return json(res, 400, { code: "MODEL_NOT_CONFIGURED", message: "Configure a model in the reader settings or set server-side LLM credentials." });
        const persisted = { baseUrl: resolved.base_url, apiKey: resolved.api_key, model: resolved.model };
        const translations = createTranslationRepo(sql);
        const job = await translations.createJob(paper.id, target_lang, persisted);
        return json(res, 202, { job: toJob(job) });
      }
      if (action === "translation" && rest.length === 2) {
        if (!paper) return paper404();
        const { lang } = translationQuery.parse(Object.fromEntries(url.searchParams));
        const translations = createTranslationRepo(sql);
        if (req.method === "GET") {
          const snapshot = await translations.findSnapshot(paper.id, lang);
          if (!snapshot) return json(res, 404, { code: "TRANSLATION_NOT_FOUND", message: "No translation for this language yet" });
          const job = await translations.findLatestJob(paper.id, lang);
          const body = { ...toSnapshot(snapshot), job: job ? toJob(job) : null };
          return json(res, 200, body);
        }
        if (req.method === "DELETE") {
          await translations.deleteSnapshot(paper.id, lang);
          return res.writeHead(204).end();
        }
        return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
      }
      if (action === "translation-job" && rest.length === 2) {
        if (!paper) return paper404();
        const { lang } = translationQuery.parse(Object.fromEntries(url.searchParams));
        const translations = createTranslationRepo(sql);
        if (req.method === "GET") {
          const job = await translations.findLatestJob(paper.id, lang);
          if (!job) return json(res, 404, { code: "TRANSLATION_JOB_NOT_FOUND", message: "No translation job for this language" });
          return json(res, 200, { job: toJob(job) });
        }
        if (req.method === "DELETE") {
          const cancelled = await translations.cancelActiveJob(paper.id, lang);
          if (!cancelled) return json(res, 404, { code: "TRANSLATION_JOB_NOT_ACTIVE", message: "No running translation job to cancel" });
          return res.writeHead(204).end();
        }
        return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
      }
      return json(res, 404, { code: "NOT_FOUND", message: "route not found" });
    })
  });
}

// src/host/paperspace/worker/loops.ts
import { clearInterval, setInterval } from "node:timers";

// src/host/paperspace/worker/arxiv.ts
import { XMLParser } from "fast-xml-parser";
var USER_AGENT = "paperspace-ingest/0.1 (academic paper reader)";
function fetchWithTimeout(url, timeoutMs, init = {}) {
  return fetch(url, {
    ...init,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": USER_AGENT, ...init.headers ?? {} }
  });
}
function normalize(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}
function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}
async function fetchArxivMetadata(arxivId, timeoutMs) {
  const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`;
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) throw new Error(`arXiv API returned HTTP ${response.status}`);
  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    parseTagValue: false
  });
  const doc = parser.parse(xml);
  const feed = doc?.feed;
  const entry = feed?.entry;
  if (!entry) throw new Error("arXiv API returned no entry for this id");
  const title = normalize(entry.title);
  const abstract = normalize(entry.summary);
  const authors = asArray(entry.author).map((author) => normalize(author?.name)).filter(Boolean);
  const categories = asArray(entry.category).map((category) => String(category?.["@_term"] ?? "")).filter(Boolean);
  const primary = entry["arxiv:primary_category"]?.["@_term"];
  if (typeof primary === "string" && primary && !categories.includes(primary)) {
    categories.unshift(primary);
  }
  const published = normalize(entry.published);
  return { title, authors, abstract, categories, published };
}
async function fetchArxivHtml(arxivId, timeoutMs) {
  const primary = `https://arxiv.org/html/${arxivId}`;
  const primaryResponse = await fetchWithTimeout(primary, timeoutMs, {
    headers: { accept: "text/html" }
  });
  if (primaryResponse.ok) {
    const html = await primaryResponse.text();
    if (html.includes("<body")) return { html, baseUrl: primaryResponse.url };
  }
  const fallback = `https://ar5iv.labs.arxiv.org/html/${arxivId}`;
  const fallbackResponse = await fetchWithTimeout(fallback, timeoutMs, {
    headers: { accept: "text/html" }
  });
  if (!fallbackResponse.ok) {
    throw new Error(`HTML fetch failed: arxiv.org/html ${primaryResponse.status}, ar5iv ${fallbackResponse.status}`);
  }
  return { html: await fallbackResponse.text(), baseUrl: fallbackResponse.url };
}

// src/host/paperspace/worker/html2md.ts
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
var MATH_PREFIX = "\uE000m";
var MATH_SUFFIX = "\uE001";
var PLACEHOLDER_RE = /\uE000m(\d+)\uE001/g;
function placeholder(id) {
  return MATH_PREFIX + id + MATH_SUFFIX;
}
function latexOf($math) {
  const $annotation = $math.find('annotation[encoding="application/x-tex"]').first();
  const source = $annotation.length > 0 ? $annotation.text() : $math.attr("alttext") ?? "";
  return source.replace(/^\\(?:displaystyle|textstyle)\s*/, "").replace(/\s+/g, " ").trim();
}
function htmlToMarkdown(html) {
  const $ = cheerio.load(html);
  const mathMarkdown = /* @__PURE__ */ new Map();
  let mathIndex = 0;
  $('table[class*="ltx_eqn"]').each((_index, table) => {
    const rows = [];
    $(table).find("tr").each((_rowIndex, tr) => {
      const parts = [];
      $(tr).find("math").each((_mathIndex, math) => {
        const tex = latexOf($(math));
        if (tex) parts.push(tex);
      });
      if (parts.length === 0) return;
      const $eqno = $(tr).find(".ltx_eqn_eqno").first();
      const tag = $eqno.length > 0 ? $eqno.text().replace(/[()\s]/g, "").trim() : "";
      rows.push({ latex: parts.join(" "), tag });
    });
    if (rows.length === 0) {
      $(table).remove();
      return;
    }
    const tags = [...new Set(rows.map((row) => row.tag).filter(Boolean))];
    let block;
    if (rows.length === 1) {
      const row = rows[0];
      block = "$$\n" + row.latex + (row.tag ? ` \\tag{${row.tag}}` : "") + "\n$$";
    } else if (tags.length <= 1) {
      const inner = rows.map((row) => row.latex).join(" \\\\\n");
      block = "$$\n\\begin{aligned}\n" + inner + "\n\\end{aligned}" + (tags[0] ? ` \\tag{${tags[0]}}` : "") + "\n$$";
    } else {
      block = rows.map((row) => "$$\n" + row.latex + (row.tag ? ` \\tag{${row.tag}}` : "") + "\n$$").join("\n\n");
    }
    const id = String(mathIndex++);
    mathMarkdown.set(id, block);
    $(table).replaceWith($("<div>").text(placeholder(id)));
  });
  $("math").each((_index, math) => {
    const $math = $(math);
    const tex = latexOf($math);
    if (!tex) {
      $math.remove();
      return;
    }
    const id = String(mathIndex++);
    if ($math.attr("display") === "block") {
      mathMarkdown.set(id, "$$\n" + tex + "\n$$");
      $math.replaceWith($("<div>").text(placeholder(id)));
    } else {
      mathMarkdown.set(id, "$" + tex + "$");
      $math.replaceWith($("<span>").text(placeholder(id)));
    }
  });
  $("script, style, noscript, nav, header, footer, aside, form, button, iframe, svg").remove();
  let root = $("main").first();
  if (root.length === 0) root = $("article").first();
  const content = root.length > 0 ? root.html() ?? html : html;
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    hr: "---"
  });
  service.use(gfm);
  service.remove(["script", "style", "noscript", "nav", "header", "footer", "aside", "form", "button", "iframe"]);
  return service.turndown(content).replace(PLACEHOLDER_RE, (_match, id) => {
    const text = mathMarkdown.get(id) ?? "";
    return text.startsWith("$$") ? "\n\n" + text + "\n\n" : text;
  }).replace(/\n{3,}/g, "\n\n").trim();
}

// src/host/paperspace/worker/images.ts
import { createHash } from "node:crypto";
var USER_AGENT2 = "paperspace-ingest/0.1 (academic paper reader)";
var MD_IMG_RE = /!\[[^\]]*\]\((?:<)?([^)>\s]+)(?:>)?\)/g;
var HTML_IMG_RE = /<img[^>]*\ssrc="([^"]+)"/gi;
function extractImageUrls(markdown) {
  const urls = [];
  const push = (url) => {
    if (url && !url.startsWith("data:") && !urls.includes(url)) urls.push(url);
  };
  for (const match of markdown.matchAll(MD_IMG_RE)) push(match[1]);
  for (const match of markdown.matchAll(HTML_IMG_RE)) push(match[1]);
  return urls;
}
var EXT_BY_CONTENT_TYPE = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/bmp": "bmp"
};
var KNOWN_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:[?#]|$)/i;
function guessContentType(url) {
  const match = url.match(KNOWN_EXT);
  const ext = match?.[1]?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "svg") return "image/svg+xml";
  if (ext) return `image/${ext}`;
  return "image/png";
}
function objectKey(arxivId, url, contentType) {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  const ext = EXT_BY_CONTENT_TYPE[mime] ?? "png";
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 16);
  return `papers/${arxivId}/${hash}.${ext}`;
}
async function storeImages(params) {
  const { arxivId, markdown, store, baseUrl, maxBytes, timeoutMs, concurrency } = params;
  const urls = extractImageUrls(markdown);
  const entries = await mapLimit(urls, concurrency, async (url) => {
    let absolute;
    try {
      absolute = new URL(url, baseUrl).href;
    } catch {
      return null;
    }
    try {
      const response = await fetch(absolute, {
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": USER_AGENT2 }
      });
      if (!response.ok) return null;
      const contentType = (response.headers.get("content-type") ?? guessContentType(absolute)).split(";")[0].trim();
      if (!contentType.startsWith("image/")) return null;
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length === 0 || data.length > maxBytes) return null;
      const key = objectKey(arxivId, absolute, contentType);
      await store.putObject(key, data, contentType);
      return { originalUrl: absolute, objectKey: key, contentType, sizeBytes: data.length };
    } catch {
      return null;
    }
  });
  return { assets: entries.filter((entry) => entry !== null) };
}
function rewriteImageUrls(markdown, urlMap, baseUrl) {
  const lookup = (url) => {
    const direct = urlMap.get(url);
    if (direct) return direct;
    try {
      return urlMap.get(new URL(url, baseUrl).href);
    } catch {
      return void 0;
    }
  };
  const rewritten = markdown.replace(MD_IMG_RE, (full, url) => {
    const target = lookup(url);
    return target ? full.replace(url, target) : full;
  }).replace(HTML_IMG_RE, (full, url) => {
    const target = lookup(url);
    return target ? full.replace(url, target) : full;
  });
  return rewritten;
}
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

// src/host/paperspace/runtime/sse.ts
async function* parseSse(input) {
  const chunks = isReadable(input) ? decode(input) : input;
  let buffer = "";
  let event;
  let data = [];
  for await (const chunk of chunks) {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) {
        if (data.length) yield { event, data: data.join("\n") };
        event = void 0;
        data = [];
        continue;
      }
      if (line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = (colon < 0 ? "" : line.slice(colon + 1)).replace(/^ /, "");
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
  }
  if (buffer) {
    const line = buffer;
    if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (data.length) yield { event, data: data.join("\n") };
}
function isReadable(value) {
  return typeof value === "object" && value !== null && "getReader" in value;
}
async function* decode(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) {
        const tail = decoder.decode();
        if (tail) yield tail;
        break;
      }
      yield decoder.decode(part.value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

// src/host/paperspace/runtime/provider.ts
var OpenAICompatibleProvider = class {
  constructor(options) {
    this.options = options;
  }
  async *stream(request) {
    const controller = new AbortController();
    const signal = mergeSignals(request.signal, controller.signal);
    let timer;
    if (this.options.timeoutMs) timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await (this.options.fetch ?? fetch)(this.options.baseUrl.replace(/\/$/, "") + "/chat/completions", { method: "POST", headers: { "content-type": "application/json", ...this.options.apiKey ? { authorization: "Bearer " + this.options.apiKey } : {} }, body: JSON.stringify({ model: this.options.model, messages: request.messages, tools: request.tools?.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } })), stream: true }), signal });
      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "");
        let message = detail.trim();
        try {
          const parsed = JSON.parse(message);
          message = parsed.error?.message ?? parsed.message ?? message;
        } catch {
        }
        throw new Error(`LLM request failed (${response.status})${message ? `: ${message}` : ""}`);
      }
      const calls = /* @__PURE__ */ new Map();
      for await (const item of parseSse(response.body)) {
        if (item.data === "[DONE]") continue;
        let json2;
        try {
          json2 = JSON.parse(item.data);
        } catch {
          continue;
        }
        const choice = json2.choices?.[0];
        const delta = choice?.delta;
        if (delta?.content) yield { text: delta.content };
        if (delta?.reasoning_content || delta?.thinking) yield { thinking: delta.reasoning_content ?? delta.thinking };
        for (const call of delta?.tool_calls ?? []) {
          const id = call.id ?? [...calls.keys()][call.index ?? 0] ?? crypto.randomUUID();
          const old = calls.get(id) ?? { name: "", args: "" };
          old.name += call.function?.name ?? "";
          old.args += call.function?.arguments ?? "";
          calls.set(id, old);
        }
        if (json2.usage) yield { usage: { tokens_in: json2.usage.prompt_tokens ?? 0, tokens_out: json2.usage.completion_tokens ?? 0 } };
      }
      for (const [id, call] of calls) yield { tool_call: { id, name: call.name, arguments: call.args } };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
};
function mergeSignals(a, b) {
  if (!a) return b;
  const c = new AbortController();
  const abort = () => c.abort();
  if (a.aborted || b?.aborted) c.abort();
  else {
    a.addEventListener("abort", abort, { once: true });
    b?.addEventListener("abort", abort, { once: true });
  }
  return c.signal;
}

// src/host/paperspace/worker/translate.ts
var GLOSSARY_MAX_CHARS = 4e4;
var GLOSSARY_MAX_TERMS = 60;
var LANG_NAMES = {
  "zh-CN": "Simplified Chinese",
  "en-US": "English",
  "ja-JP": "Japanese"
};
var TranslationFatalError = class extends Error {
};
async function runTranslationJob(job, markdown, ctx) {
  const provider = () => new OpenAICompatibleProvider({ baseUrl: ctx.provider.baseUrl, apiKey: ctx.provider.apiKey ?? void 0, model: ctx.provider.model, timeoutMs: ctx.timeoutMs });
  const blocks = splitParagraphs(markdown);
  if (blocks.length === 0) throw new TranslationFatalError("no translatable paragraphs found");
  const offsets = blocks.map((block) => ({ start: block.start, end: block.end }));
  await ctx.translations.startSnapshot(job.id, job.paperId, job.targetLang, offsets);
  await ctx.translations.updateProgress(job.id, 0, blocks.length);
  const snapshot = await ctx.translations.findSnapshot(job.paperId, job.targetLang);
  if (!snapshot) throw new Error("translation snapshot missing after start");
  let glossary = job.glossary ?? {};
  if (!glossary || Object.keys(glossary).length === 0) {
    glossary = await extractGlossary(markdown, job.targetLang, provider());
    await ctx.translations.setJobGlossary(job.id, glossary);
  }
  const paragraphs = [...snapshot.paragraphs ?? []];
  let next = paragraphs.findIndex((entry) => !entry);
  if (next < 0) next = paragraphs.length;
  if (next >= blocks.length) {
    await ctx.translations.finishJob(job.id, job.paperId, job.targetLang, ctx.provider.model);
    return;
  }
  for (let i = next; i < blocks.length; i++) {
    const status = await ctx.translations.jobStatus(job.id);
    if (status !== "running") return;
    const text = await translateParagraph(blocks[i].text, job.targetLang, glossary, provider());
    paragraphs[i] = text;
    await ctx.translations.updateSnapshot({
      jobId: job.id,
      paperId: job.paperId,
      targetLang: job.targetLang,
      paragraphs,
      offsets,
      glossary,
      model: ctx.provider.model
    });
    await ctx.translations.updateProgress(job.id, i + 1, blocks.length);
  }
  await ctx.translations.finishJob(job.id, job.paperId, job.targetLang, ctx.provider.model);
}
async function failTranslationJob(job, error, ctx) {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof TranslationFatalError || job.attempts >= ctx.maxAttempts) {
    await ctx.translations.failJobPermanently(job.id, message);
    console.error(`[paperspace] translation failed permanently (${job.paperId} \u2192 ${job.targetLang}, attempt ${job.attempts}): ${message}`);
    return;
  }
  const delaySeconds = Math.min(60 * 2 ** (job.attempts - 1), 900);
  await ctx.translations.requeueJob(job.id, message, delaySeconds);
  console.warn(`[paperspace] translation attempt ${job.attempts} failed, retrying in ${delaySeconds}s (${job.paperId} \u2192 ${job.targetLang}): ${message}`);
}
async function extractGlossary(markdown, targetLang, provider) {
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const system = [
    "You are a terminology extractor for academic-paper translation.",
    `You produce a JSON object mapping English technical terms to their preferred ${langName} translations, used as a consistency dictionary by a downstream paragraph-by-paragraph translator.`,
    "Include terms that: appear multiple times in the paper, or are central to the contribution (named methods, datasets, model classes, novel concepts).",
    "Rules:",
    "- Keep paper-specific named methods and model names in their original English form (translation may be empty string).",
    "- Prefer widely accepted translations in the field; short and precise.",
    '- Output ONLY a flat JSON object like {"term": "translation"}; no prose, no markdown fences.',
    `- At most ${GLOSSARY_MAX_TERMS} entries.`
  ].join("\n");
  const source = markdown.slice(0, GLOSSARY_MAX_CHARS);
  const response = await complete(provider, [
    { role: "system", content: system },
    { role: "user", content: `Paper:

${source}` }
  ]);
  return parseJsonObject(response) ?? {};
}
async function translateParagraph(text, targetLang, glossary, provider) {
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const system = [
    `You are a professional academic-paper translator. Translate the provided paragraph into ${langName}.`,
    "Rules:",
    "- Return ONLY the translation \u2014 no explanations, no quotes, no code fences.",
    "- Preserve markdown formatting exactly: keep $\u2026$ and $$\u2026$$ math unchanged, keep ![\u2026]() images and [\u2026]() links unchanged, keep **bold** / *italic* / `code` markers, keep list bullets and numbering, keep any HTML tags.",
    "- Translate prose faithfully and fluently; keep proper nouns, model names, method names, and dataset names in their original form.",
    "- Use the provided glossary when its terms appear; otherwise choose a natural, consistent translation.",
    "- Never translate code. Never invent content that is not in the source."
  ].join("\n");
  const terms = Object.entries(glossary).map(([term, translation]) => translation ? `${term} \u2192 ${translation}` : `${term} \u2192 (keep original)`).join("\n");
  const user = `Glossary:
${terms}

Paragraph:
${text}`;
  const response = await complete(provider, [
    { role: "system", content: system },
    { role: "user", content: user }
  ]);
  return stripWrapper(response);
}
async function complete(provider, messages) {
  let out = "";
  for await (const chunk of provider.stream({ messages })) {
    if (chunk.text) out += chunk.text;
  }
  return out.trim();
}
function parseJsonObject(raw) {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(start, i + 1));
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const record = {};
            for (const [key, value] of Object.entries(parsed)) {
              if (typeof value === "string") record[key] = value;
            }
            return record;
          }
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
function stripWrapper(text) {
  let out = text.trim();
  if (out.startsWith("```") && out.endsWith("```")) {
    out = out.replace(/^```[^\n]*\n/, "").replace(/```\s*$/, "").trim();
  }
  if (out.startsWith('"') && out.endsWith('"') && out.length >= 2 || out.startsWith("'") && out.endsWith("'") && out.length >= 2) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

// src/host/paperspace/worker/loops.ts
var CLAIM_GRACE_SECONDS = 3;
var HEARTBEAT_MS = 1e3;
function envNumber(value, name2) {
  const raw = process.env[name2];
  if (raw === void 0 || raw === "" || Number.isNaN(Number(raw))) return value;
  return Number(raw);
}
function messageOf2(error) {
  return error instanceof Error ? error.message : String(error);
}
function startWorker(ctx, runtime, store, config) {
  const pollMs = envNumber(config.pollMs, "WORKER_POLL_MS");
  const ingestTimeoutMs = envNumber(config.ingestTimeoutMs, "INGEST_TIMEOUT_MS");
  const maxAssetBytes = envNumber(config.maxAssetBytes, "MAX_ASSET_BYTES");
  const ingestConcurrency = envNumber(config.ingestConcurrency, "INGEST_CONCURRENCY");
  const translateMaxAttempts = envNumber(config.translateMaxAttempts, "TRANSLATE_MAX_ATTEMPTS");
  const translateStuckAfterMinutes = envNumber(config.translateStuckAfterMinutes, "TRANSLATE_STUCK_AFTER_MINUTES");
  const translateTimeoutMs = envNumber(config.translateTimeoutMs, "TRANSLATE_TIMEOUT_MS");
  const rescanIntervalMs = envNumber(config.rescanIntervalMs, "RESCAN_INTERVAL_MS");
  ctx.effect(() => {
    async function ingest(paper) {
      const sql = await runtime.getSql();
      const papers = createPaperRepo(sql);
      const heartbeat = setInterval(() => {
        papers.heartbeat(paper.id).catch(() => {
        });
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
          concurrency: ingestConcurrency
        });
        await sql.begin(async (tx) => {
          const assetRepo = createAssetRepo(tx);
          const inserted = await assetRepo.insertMany(paper.id, assets);
          const urlMap = new Map(
            inserted.map((asset) => [asset.originalUrl, `/dsh-unknownue-plugins/paperspace/api/papers/${paper.arxivId}/assets/${asset.id}`])
          );
          const rewritten = rewriteImageUrls(markdown, urlMap, baseUrl);
          await createPaperRepo(tx).finishReady(paper.id, metadata, rewritten);
        });
        await ensurePaperMarkdown(sql, config.workspaceDir, paper.arxivId);
        console.log(`[paperspace] ingested ${paper.arxivId}: ${assets.length} assets, ${markdown.length} markdown chars`);
      } catch (error) {
        const message = messageOf2(error);
        await papers.markFailed(paper.id, message);
        console.error(`[paperspace] ingest failed ${paper.arxivId}: ${message}`);
      } finally {
        clearInterval(heartbeat);
      }
    }
    async function tick() {
      const sql = await runtime.getSql();
      const paper = await createPaperRepo(sql).claimNextIngesting(CLAIM_GRACE_SECONDS);
      if (!paper) return;
      await ingest(paper);
    }
    async function translateOne() {
      const sql = await runtime.getSql();
      const translations = createTranslationRepo(sql);
      const papers = createPaperRepo(sql);
      const job = await translations.claimNextJob();
      if (!job) return false;
      const provider = job.provider ?? (process.env.LLM_API_KEY ? { baseUrl: process.env.LLM_BASE_URL ?? "https://api.deepseek.com", apiKey: process.env.LLM_API_KEY, model: process.env.LLM_MODEL ?? "deepseek-chat" } : null);
      const translationContext = {
        translations,
        provider: provider ?? { baseUrl: "", apiKey: null, model: "" },
        timeoutMs: translateTimeoutMs,
        maxAttempts: translateMaxAttempts
      };
      const paper = await papers.findByRef(job.paperId);
      try {
        if (!provider) {
          throw new TranslationFatalError("translation job has no LLM provider configured; recreate the job from the reader");
        }
        if (!paper || paper.status !== "ready" || !paper.markdown) {
          throw new TranslationFatalError(`paper is not ready for translation (status=${paper?.status ?? "missing"})`);
        }
        await runTranslationJob(job, paper.markdown, translationContext);
        console.log(`[paperspace] translated ${paper.arxivId} \u2192 ${job.targetLang} (${job.total} paragraphs, model ${provider.model})`);
      } catch (error) {
        await failTranslationJob(job, error, translationContext);
      }
      return true;
    }
    async function rescanStuck() {
      try {
        const sql = await runtime.getSql();
        const count = await createTranslationRepo(sql).rescanStuckJobs(translateStuckAfterMinutes);
        if (count > 0) console.warn(`[paperspace] requeued ${count} stuck translation job(s)`);
      } catch (error) {
        console.error("[paperspace] stuck-job rescan failed", messageOf2(error));
      }
    }
    let ingesting = false;
    let translating = false;
    const ingestTimer = setInterval(() => {
      if (ingesting) return;
      ingesting = true;
      void tick().catch((error) => console.error("[paperspace] ingest tick failed", messageOf2(error))).finally(() => {
        ingesting = false;
      });
    }, pollMs);
    const translateTimer = setInterval(() => {
      if (translating) return;
      translating = true;
      void translateOne().catch((error) => console.error("[paperspace] translation tick failed", messageOf2(error))).finally(() => {
        translating = false;
      });
    }, pollMs);
    const rescanTimer = setInterval(() => void rescanStuck(), rescanIntervalMs);
    void store.ensureBucket().catch((error) => console.error("[paperspace] object store init failed", messageOf2(error)));
    console.log("[paperspace] worker started", {
      pollMs,
      assetsDir: config.assetsDir,
      ingestConcurrency,
      maxAssetBytes,
      translateMaxAttempts,
      translateStuckAfterMinutes,
      translateTimeoutMs
    });
    return () => {
      clearInterval(ingestTimer);
      clearInterval(translateTimer);
      clearInterval(rescanTimer);
    };
  }, "dsh-unknownue-plugins/paperspace: worker loops");
}

// src/host/paperspace/index.ts
var name = "dsh-unknownue-plugins/paperspace";
var inject = ["webServer"];
function apply(ctx, config = {}) {
  const row = resolveConfig(config);
  let file = loadSettingsFile();
  let active = null;
  const state = {
    configured: file?.configured === true,
    restartRequired: false,
    settingsPath: paperspaceSettingsPath()
  };
  const service = (name2) => {
    try {
      const direct = typeof ctx.get === "function" ? ctx.get(name2, false) : void 0;
      if (direct !== void 0) return direct;
    } catch {
    }
    try {
      const root = ctx.root;
      if (root && typeof root.get === "function") return root.get(name2, false);
    } catch {
    }
    return void 0;
  };
  const paperContextCache = /* @__PURE__ */ new Map();
  const providerStats = { calls: 0, scopePresent: 0, agents: 0, matched: 0, lastSessionIds: [] };
  let contextProviderRegistered = false;
  let contextHitLogged = false;
  const ensureContextProvider = () => {
    if (contextProviderRegistered) return;
    const systemPrompt = service("systemPrompt");
    if (!systemPrompt || typeof systemPrompt.section !== "function") return;
    contextProviderRegistered = true;
    systemPrompt.section({
      name: "paperspace:current-paper",
      order: 120,
      text: (assembleContext) => {
        providerStats.calls++;
        const scope = assembleContext?.scope;
        if (scope !== void 0 && scope !== null) providerStats.scopePresent++;
        const agents = service("agents");
        const list = agents?.list() ?? [];
        providerStats.agents = list.length;
        providerStats.lastSessionIds = list.map((agent) => agent.id ?? "").slice(0, 12);
        const text = paperTextForScope(scope, paperContextCache);
        if (text) {
          providerStats.matched++;
          if (!contextHitLogged) {
            contextHitLogged = true;
            console.log("[paperspace] paper context injected for first assembly");
          }
        }
        return text;
      }
    });
    console.log("[paperspace] system-prompt paper section attached");
  };
  const refreshPaperContexts = async () => {
    try {
      if (!active) return;
      const sql = await active.runtime.getSql();
      const rows = await sql`
        SELECT s.session_id, p.arxiv_id, p.metadata
        FROM paper.paper_sessions s
        JOIN paper.papers p ON p.arxiv_id = s.arxiv_id`;
      paperContextCache.clear();
      for (const row2 of rows) {
        const meta2 = row2.metadata ?? {};
        const title = meta2.title ?? row2.arxivId;
        const categories = (meta2.categories ?? []).join(", ");
        paperContextCache.set(row2.sessionId, [
          `Current paper: \u201C${title}\u201D (arXiv:${row2.arxivId}${categories ? ", categories: " + categories : ""}).`,
          `Ground your answers in THIS paper: call search_paper for passages or read_section for a whole section, or read papers/${row2.arxivId}.md with file tools. If the user asks about a different paper, ask them to link it first.`
        ].join(" "));
      }
    } catch (error) {
      console.warn("[paperspace] paper context cache refresh failed:", error);
    }
  };
  ensureContextProvider();
  const dsh = {
    get tools() {
      return service("tools");
    }
  };
  let toolsRegistered = false;
  const ensureToolsRegistered = () => {
    if (toolsRegistered) return;
    ensureContextProvider();
    registerPaperTools(
      dsh.tools,
      () => host.ensureStarted().then((activeResult) => activeResult.runtime.getSql())
    );
    toolsRegistered = true;
  };
  const host = {
    state,
    row,
    dsh,
    file: () => file,
    active: () => active,
    refreshPaperContexts: () => refreshPaperContexts(),
    renameSession: async (sessionId, title) => {
      try {
        const store = service("sessions");
        const session = store?.get?.(sessionId);
        const titleService = service("sessionTitle");
        if (!session || typeof titleService?.rename !== "function") return;
        titleService.rename(session, title.slice(0, 120));
      } catch (error) {
        console.warn("[paperspace] session title rename failed:", error);
      }
    },
    debug: () => ({
      configured: state.configured,
      toolsRegistered,
      contextProviderRegistered,
      systemPromptFound: service("systemPrompt") !== void 0,
      agentsFound: service("agents") !== void 0,
      contextCacheKeys: Array.from(paperContextCache.keys()),
      providerStats: { ...providerStats }
    }),
    async ensureStarted() {
      if (!file?.configured) throw new Error("paperspace is not configured yet; save settings first");
      if (active) return active;
      const effective = resolveConfig(config, file);
      const runtime = createPaperspaceRuntime(effective);
      const store = new FileObjectStore(effective.assetsDir);
      active = { config: effective, runtime, store };
      await runtime.ready;
      startWorker(ctx, runtime, store, effective);
      ensureToolsRegistered();
      ensureContextProvider();
      await refreshPaperContexts();
      return active;
    },
    async save(input) {
      try {
        const next = applySettingsInput(input, file, config);
        await saveSettingsFile(next);
        file = next;
        state.configured = next.configured;
        state.restartRequired = false;
        if (!next.configured) {
          paperContextCache.clear();
          if (active) {
            active.runtime.dispose();
            active = null;
          }
          return { ok: true, configured: false, restartRequired: false };
        }
        if (!active) {
          await this.ensureStarted();
          return { ok: true, configured: true, restartRequired: false };
        }
        const effective = resolveConfig(config, next);
        const keys = Object.keys(effective);
        const changed = keys.some((key) => effective[key] !== active.config[key]);
        state.restartRequired = changed;
        return { ok: true, configured: true, restartRequired: changed };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  };
  ctx.effect(
    () => () => {
      active?.runtime.dispose();
      active = null;
      paperContextCache.clear();
    },
    "dsh-unknownue-plugins/paperspace: runtime dispose"
  );
  registerRoutes(ctx.webServer, host);
  ensureToolsRegistered();
  if (typeof ctx.provide === "function") {
    ctx.provide("paperspace", host);
  }
}
export {
  apply,
  inject,
  name,
  paperspaceSettingsPath,
  resolveConfig
};

// src/host/paperspace/paperspace.test.ts
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as join2 } from "node:path";
import { createServer } from "node:http";
import { EventEmitter } from "node:events";
import { apply } from "./index.js";

// src/host/paperspace/settings.ts
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { z } from "zod";
function paperspaceHome() {
  return process.env.DSH_HOME || join(homedir(), ".dsh");
}
function paperspaceSettingsPath() {
  return join(paperspaceHome(), "paperspace", "settings.json");
}
function normalizePath(value) {
  const expanded = value === "~" || value.startsWith("~/") ? join(homedir(), value.slice(1)) : value;
  return isAbsolute(expanded) ? resolve(expanded) : resolve(process.cwd(), expanded);
}
function builtinDefaults() {
  const root = join(paperspaceHome(), "paperspace");
  return {
    dataDir: join(root, "db"),
    assetsDir: join(root, "assets"),
    workspaceDir: join(root, "workspace"),
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
    workspaceDir: norm(row.workspaceDir) ?? join(dirname(rowDataDir), "workspace"),
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
    workspaceDir: file.workspaceDir ? normalizePath(file.workspaceDir) : join(dirname(fileDataDir), "workspace"),
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
    workspaceDir: input.workspaceDir !== void 0 && input.workspaceDir !== "" ? normalizePath(input.workspaceDir) : base.workspaceDir !== "" ? base.workspaceDir : join(dirname(dataDir), "workspace"),
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

// src/host/paperspace/dsh-integration.ts
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
async function paperContextTextForSession(getSql, sessionId) {
  const sql = await getSql();
  const rows = await sql`
    SELECT p.arxiv_id, p.metadata
    FROM paper.paper_sessions s
    JOIN paper.papers p ON p.arxiv_id = s.arxiv_id
    WHERE s.session_id = ${sessionId}
    LIMIT 1`;
  const row = rows[0];
  if (!row) return null;
  const meta = row.metadata ?? {};
  const title = meta.title ?? row.arxivId;
  const categories = (meta.categories ?? []).join(", ");
  return [
    `Current paper: \u201C${title}\u201D (arXiv:${row.arxivId}${categories ? ", categories: " + categories : ""}).`,
    `Ground your answers in THIS paper: call search_paper for passages or read_section for a whole section, or read papers/${row.arxivId}.md with file tools. If the user asks about a different paper, ask them to link it first.`
  ].join(" ");
}
function paperTextForScope(scope, cache) {
  if (scope === null || typeof scope !== "object") return "";
  const agentId = scope.id;
  if (typeof agentId !== "string") return "";
  return cache.get(agentId) ?? "";
}

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
function spliceParagraphs(markdown, offsets, paragraphs) {
  let out = "";
  let cursor = 0;
  for (let i = 0; i < offsets.length; i++) {
    const offset = offsets[i];
    const translation = paragraphs[i];
    if (!offset || typeof offset.start !== "number" || typeof offset.end !== "number") continue;
    if (offset.start < cursor || offset.end > markdown.length) continue;
    out += markdown.slice(cursor, offset.start);
    out += translation ? translation : markdown.slice(offset.start, offset.end);
    cursor = offset.end;
  }
  return out + markdown.slice(cursor);
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
        let json;
        try {
          json = JSON.parse(item.data);
        } catch {
          continue;
        }
        const choice = json.choices?.[0];
        const delta = choice?.delta;
        if (delta?.content) yield { text: delta.content };
        if (delta?.reasoning_content || delta?.thinking) yield { thinking: delta.reasoning_content ?? delta.thinking };
        for (const call2 of delta?.tool_calls ?? []) {
          const id = call2.id ?? [...calls.keys()][call2.index ?? 0] ?? crypto.randomUUID();
          const old = calls.get(id) ?? { name: "", args: "" };
          old.name += call2.function?.name ?? "";
          old.args += call2.function?.arguments ?? "";
          calls.set(id, old);
        }
        if (json.usage) yield { usage: { tokens_in: json.usage.prompt_tokens ?? 0, tokens_out: json.usage.completion_tokens ?? 0 } };
      }
      for (const [id, call2] of calls) yield { tool_call: { id, name: call2.name, arguments: call2.args } };
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

// src/host/paperspace/worker/images.ts
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

// src/host/paperspace/domain/db.ts
import postgres from "postgres";

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

// src/host/paperspace/paperspace.test.ts
var API = "/dsh-unknownue-plugins/paperspace/api";
var results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " \u2014 " + detail : ""}`);
}
var routes = /* @__PURE__ */ new Map();
var disposers = [];
var services = /* @__PURE__ */ new Map();
var registeredTools = [];
var fakeSessions = {
  seq: 0,
  create() {
    this.seq += 1;
    return { id: "sess-" + this.seq };
  },
  get(id) {
    return { id };
  }
};
var renamedTitles = /* @__PURE__ */ new Map();
var fakeSessionTitle = {
  rename(session, title) {
    renamedTitles.set(session.id, title);
    return { title };
  }
};
var fakeWorkspaceRegistry = {
  async resolveByPath() {
    return void 0;
  },
  async create(_path, title) {
    return { id: "ws-1", title: title ?? "" };
  }
};
var mockCtx = {
  effect(fn, _label) {
    const result = fn();
    if (typeof result === "function") disposers.push(result);
    return void 0;
  },
  provide(name, value) {
    services.set(name, value);
    return void 0;
  },
  get(name) {
    if (name === "sessions") return fakeSessions;
    if (name === "sessionTitle") return fakeSessionTitle;
    if (name === "workspaceRegistry") return fakeWorkspaceRegistry;
    if (name === "tools") return { register: (definition) => {
      registeredTools.push(definition);
      return () => void 0;
    } };
    return void 0;
  },
  webServer: {
    register(route) {
      routes.set(`${route.kind}:${route.path}`, route);
      return () => routes.delete(`${route.kind}:${route.path}`);
    }
  }
};
function mockReq(method, url, body) {
  const chunks = body === void 0 ? [] : [Buffer.from(JSON.stringify(body))];
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    method,
    url,
    headers: { host: "127.0.0.1:13080" },
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    }
  });
}
var MockRes = class extends EventEmitter {
  statusCode = 0;
  body = "";
  bodyBuffer = Buffer.alloc(0);
  headers = {};
  writeHead(status, headers) {
    this.statusCode = status;
    Object.assign(this.headers, headers ?? {});
    return this;
  }
  write(chunk) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    this.bodyBuffer = Buffer.concat([this.bodyBuffer, buffer]);
    return true;
  }
  end(chunk) {
    if (typeof chunk === "string") this.body = chunk;
    else if (Buffer.isBuffer(chunk)) this.bodyBuffer = Buffer.concat([this.bodyBuffer, chunk]);
    process.nextTick(() => this.emit("close"));
    return this;
  }
};
function matchRoute(url) {
  const pathname = new URL(url, "http://127.0.0.1").pathname;
  const exact = routes.get(`exact:${pathname}`);
  if (exact) return exact;
  let best;
  for (const [key, route] of routes) {
    if (!key.startsWith("prefix:")) continue;
    if (pathname === route.path || pathname.startsWith(route.path + "/")) {
      if (!best || route.path.length > best.path.length) best = route;
    }
  }
  return best;
}
async function call(method, url, body) {
  const route = matchRoute(url);
  assert.ok(route, `no route for ${url}`);
  const req = mockReq(method, url, body);
  const res = new MockRes();
  await route.handler(req, res);
  return res;
}
var sleep = (ms) => new Promise((resolve2) => setTimeout(resolve2, ms));
async function startMockLlm() {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => raw += chunk);
    req.on("end", () => {
      let body;
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        body = {};
      }
      requests.push({ body });
      const sse = (obj) => "data: " + JSON.stringify(obj) + "\n\n";
      const system = String(body.messages?.[0]?.content ?? "");
      const hasToolResult = (body.messages ?? []).some((m) => m.role === "tool");
      res.writeHead(200, { "content-type": "text/event-stream", connection: "keep-alive" });
      if (system.includes("terminology extractor")) {
        res.write(sse({ choices: [{ delta: { content: JSON.stringify({ transformer: "\u53D8\u6362\u5668" }) } }] }));
      } else if (system.includes("academic-paper translator")) {
        const user = String(body.messages?.at(-1)?.content ?? "");
        const para = user.split("Paragraph:\n").pop() ?? "";
        res.write(sse({ choices: [{ delta: { content: "[ZH] " + para } }] }));
      } else if (!hasToolResult) {
        res.write(sse({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "search_paper", arguments: JSON.stringify({ query: "hello" }) } }] } }] }));
      } else {
        res.write(sse({ choices: [{ delta: { content: "The paper says hello." } }] }));
        res.write(sse({ usage: { prompt_tokens: 10, completion_tokens: 5 } }));
      }
      res.write("data: [DONE]\n\n");
      res.end();
    });
  });
  await new Promise((resolve2) => server.listen(0, "127.0.0.1", resolve2));
  const port = server.address().port;
  return {
    url: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () => new Promise((resolve2) => server.close(() => resolve2()))
  };
}
async function main() {
  const root = mkdtempSync(join2(tmpdir(), "dsh-paperspace-test-"));
  const config = { dataDir: join2(root, "db"), assetsDir: join2(root, "assets"), workspaceDir: join2(root, "workspace"), port: 0, initialMemoryBytes: 512 * 1024 * 1024, pollMs: 6e4, ingestTimeoutMs: 3e4, maxAssetBytes: 10485760, ingestConcurrency: 2, translateMaxAttempts: 3, translateStuckAfterMinutes: 30, translateTimeoutMs: 12e4, rescanIntervalMs: 6e4 };
  const priorDshHome = process.env.DSH_HOME;
  process.env.DSH_HOME = root;
  try {
    apply(mockCtx, { dataDir: config.dataDir, assetsDir: config.assetsDir, port: 0, pollMs: config.pollMs, rescanIntervalMs: config.rescanIntervalMs });
    const host = services.get("paperspace");
    assert.ok(host, "apply() provides the paperspace host");
    assert.ok(routes.has(`exact:${API}/health`), "health route registered");
    assert.ok(routes.has(`exact:${API}/settings`), "settings route registered");
    assert.ok(routes.has(`prefix:${API}/papers`), "papers route registered");
    assert.equal(disposers.length, 1, "runtime dispose registered via ctx.effect (worker dormant until configured)");
    check("apply() wiring: routes + service + disposer", true);
    check("starts unconfigured", host.state.configured === false);
    const settingsBefore = await call("GET", `${API}/settings`);
    check("GET /settings \u2192 defaults, unconfigured", settingsBefore.statusCode === 200 && JSON.parse(settingsBefore.body).configured === false && typeof JSON.parse(settingsBefore.body).defaults.dataDir === "string");
    const gatedPapers = await call("GET", `${API}/papers`);
    check("business route gated \u2192 423", gatedPapers.statusCode === 423 && JSON.parse(gatedPapers.body).code === "PAPERSPACE_NOT_CONFIGURED");
    const gatedHealth = await call("GET", `${API}/health`);
    check("health reports not-configured", gatedHealth.statusCode === 200 && JSON.parse(gatedHealth.body).status === "not-configured");
    const invalidSettings = await call("POST", `${API}/settings`, { configured: true, dataDir: "" });
    check("invalid settings rejected \u2192 400", invalidSettings.statusCode === 400 && JSON.parse(invalidSettings.body).code === "VALIDATION_ERROR");
    const configuredRes = await call("POST", `${API}/settings`, { configured: true, dataDir: config.dataDir, assetsDir: config.assetsDir, port: 0, pollMs: config.pollMs, rescanIntervalMs: config.rescanIntervalMs });
    const configuredBody = JSON.parse(configuredRes.body);
    check("POST /settings configure \u2192 200", configuredRes.statusCode === 200 && configuredBody.ok === true && configuredBody.configured === true && configuredBody.restartRequired === false);
    check("host flips to configured", host.state.configured === true);
    const active0 = await host.ensureStarted();
    check("PGlite + pgwire socket boot", active0.runtime.port > 0, `port ${active0.runtime.port}`);
    const sql = await active0.runtime.getSql();
    const reg = await sql`SELECT to_regclass('paper.papers') AS name`;
    check("migrations ran (paper.papers exists)", reg[0].name === "paper.papers");
    const health = await call("GET", `${API}/health`);
    check("GET /health \u2192 200 ok", health.statusCode === 200 && JSON.parse(health.body).status === "ok");
    const created = await call("POST", `${API}/papers`, { arxiv_id: "1706.03762" });
    check("POST /papers \u2192 202", created.statusCode === 202, JSON.parse(created.body).arxivId);
    const duplicate = await call("POST", `${API}/papers`, { arxiv_id: "1706.03762" });
    check("POST /papers duplicate \u2192 200", duplicate.statusCode === 200);
    const invalid = await call("POST", `${API}/papers`, { arxiv_id: "not-an-arxiv-id" });
    check("POST /papers invalid id \u2192 400", invalid.statusCode === 400 && JSON.parse(invalid.body).code === "VALIDATION_ERROR");
    const listed = await call("GET", `${API}/papers?page=1&page_size=20`);
    check("GET /papers list", listed.statusCode === 200 && JSON.parse(listed.body).total === 1);
    const detail = await call("GET", `${API}/papers/1706.03762`);
    check("GET /papers/:ref detail", detail.statusCode === 200 && JSON.parse(detail.body).status === "ingesting");
    const missing = await call("GET", `${API}/papers/9999.99999`);
    check("GET /papers/:ref missing \u2192 404", missing.statusCode === 404 && JSON.parse(missing.body).code === "PAPER_NOT_FOUND");
    const papers = createPaperRepo(sql);
    const claimed = await papers.claimNextIngesting(0);
    assert.ok(claimed, "claimNextIngesting returned a paper");
    check("ingest claim FOR UPDATE SKIP LOCKED", claimed.arxivId === "1706.03762");
    const translations = createTranslationRepo(sql);
    const second = await papers.insert("large.test");
    const job = await translations.createJob(second.id, "zh-CN", null);
    const claimedJob = await translations.claimNextJob();
    check("translation job claim", claimedJob?.id === job.id && claimedJob?.status === "running");
    await translations.finishJob(job.id, second.id, "zh-CN", "test-model");
    check("translation job finish", await translations.jobStatus(job.id) === "completed");
    const cancelled = await translations.cancelActiveJob(second.id, "zh-CN");
    check("cancel on completed job is a no-op", cancelled === false);
    const assets = createAssetRepo(sql);
    const store = host.active().store;
    await store.ensureBucket();
    await store.putObject("papers/1706.03762/abc1.png", Buffer.from([1, 2, 3, 4]), "image/png");
    const md = { title: "Test Paper", authors: ["A"], categories: ["cs.CL"], abstract: "abstract", published: "2017-06-12" };
    await papers.finishReady(claimed.id, md, "# Intro\n\nParagraph one.\n\n## Methods\n\nParagraph two.");
    const inserted = await assets.insertMany(claimed.id, [
      { originalUrl: "https://x/f1.png", objectKey: "papers/1706.03762/abc1.png", contentType: "image/png", sizeBytes: 4 }
    ]);
    const assetList = await call("GET", `${API}/papers/1706.03762/assets`);
    check("GET assets list", assetList.statusCode === 200 && JSON.parse(assetList.body).items.length === 1);
    const assetBytes = await call("GET", `${API}/papers/1706.03762/assets/${inserted[0].id}`);
    check("GET asset stream (content-type + bytes)", assetBytes.statusCode === 200 && assetBytes.headers["content-type"] === "image/png" && assetBytes.bodyBuffer.equals(Buffer.from([1, 2, 3, 4])));
    const missingAsset = await call("GET", `${API}/papers/1706.03762/assets/${crypto.randomUUID()}`);
    check("GET missing asset \u2192 404", missingAsset.statusCode === 404 && JSON.parse(missingAsset.body).code === "ASSET_NOT_FOUND");
    const font = await call("GET", "/dsh-unknownue-plugins/paperspace/static/fonts/KaTeX_Main-Regular.woff2");
    check("KaTeX font served (woff2 + bytes)", font.statusCode === 200 && font.headers["content-type"] === "font/woff2" && font.bodyBuffer.length > 1e3);
    const badFont = await call("GET", "/dsh-unknownue-plugins/paperspace/static/fonts/secret.txt");
    check("font route rejects non-font names", badFont.statusCode === 404);
    const noProvider = await call("POST", `${API}/papers/1706.03762/translate-paper`, { target_lang: "zh-CN" });
    check("POST translate without provider \u2192 400", noProvider.statusCode === 400 && JSON.parse(noProvider.body).code === "MODEL_NOT_CONFIGURED");
    const started = await call("POST", `${API}/papers/1706.03762/translate-paper`, { target_lang: "zh-CN", provider: { base_url: "https://example.com/v1", api_key: "sk-test", model: "deepseek-chat" } });
    const startedBody = JSON.parse(started.body);
    check("POST translate-paper \u2192 202 with job", started.statusCode === 202 && typeof startedBody.job.id === "string");
    const activeAgain = await call("POST", `${API}/papers/1706.03762/translate-paper`, { target_lang: "zh-CN", provider: { base_url: "https://example.com/v1", api_key: "sk-test", model: "deepseek-chat" } });
    check("POST translate again returns active job", activeAgain.statusCode === 202 && JSON.parse(activeAgain.body).job.id === startedBody.job.id);
    const jobPoll = await call("GET", `${API}/papers/1706.03762/translation-job?lang=zh-CN`);
    check("GET translation-job", jobPoll.statusCode === 200 && JSON.parse(jobPoll.body).job.status === "pending");
    const noSnapshot = await call("GET", `${API}/papers/1706.03762/translation?lang=zh-CN`);
    check("GET translation without snapshot \u2192 404", noSnapshot.statusCode === 404 && JSON.parse(noSnapshot.body).code === "TRANSLATION_NOT_FOUND");
    const cancelJob = await call("DELETE", `${API}/papers/1706.03762/translation-job?lang=zh-CN`);
    check("DELETE translation-job \u2192 204", cancelJob.statusCode === 204);
    const cancelledPoll = await call("GET", `${API}/papers/1706.03762/translation-job?lang=zh-CN`);
    check("cancelled job visible", cancelledPoll.statusCode === 200 && JSON.parse(cancelledPoll.body).job.status === "cancelled");
    const cancelAgain = await call("DELETE", `${API}/papers/1706.03762/translation-job?lang=zh-CN`);
    check("DELETE again \u2192 404 not active", cancelAgain.statusCode === 404 && JSON.parse(cancelAgain.body).code === "TRANSLATION_JOB_NOT_ACTIVE");
    const toolNames = registeredTools.map((tool) => tool.name).sort();
    check("DSH tools registered (read_section + search_paper)", JSON.stringify(toolNames) === JSON.stringify(["read_section", "search_paper"]));
    const removed = await call("DELETE", `${API}/papers/1706.03762`);
    check("DELETE /papers \u2192 204", removed.statusCode === 204);
    const afterDelete = await call("GET", `${API}/papers/1706.03762`);
    check("paper gone after delete", afterDelete.statusCode === 404);
    await assert.rejects(() => store.getObject("papers/1706.03762/abc1.png"));
    check("object gone after delete", true);
    const searchTool = registeredTools.find((tool) => tool.name === "search_paper");
    const unbound = await searchTool.execute({ query: "hello" }, { agent: { sessionId: "no-such-session" } });
    check("search_paper unbound session \u2192 note", unbound.passages.length === 0 && Boolean(unbound.note));
    const paperX4 = await papers.insert("2101.00004");
    await papers.finishReady(paperX4.id, { title: "C", authors: [], categories: [], abstract: null, published: null }, "# Intro\n\nhello world\n\n## Methods\n\nmore text");
    const prepared = await call("POST", `${API}/sessions`, { arxiv_id: "2101.00004" });
    const preparedBody = JSON.parse(prepared.body);
    check("POST /sessions prepares workspace + md", prepared.statusCode === 200 && preparedBody.workspaceDir === config.workspaceDir && typeof preparedBody.mdFile === "string");
    const linked = await call("POST", `${API}/sessions/link`, { session_id: "sess-1", arxiv_id: "2101.00004" });
    check("POST /sessions/link records binding", linked.statusCode === 200 && JSON.parse(linked.body).sessionId === "sess-1");
    check("session auto-named after linked paper", renamedTitles.get("sess-1") === "C");
    const linksRepo = createSessionLinkRepo(sql);
    const linkRow = await linksRepo.findBySession("sess-1");
    check("session\u2192paper mapping persisted", linkRow?.arxivId === "2101.00004");
    const linkLookup = await call("GET", `${API}/sessions/sess-1`);
    check("GET /sessions/:id returns linked paper", linkLookup.statusCode === 200 && JSON.parse(linkLookup.body).arxivId === "2101.00004" && JSON.parse(linkLookup.body).status === "ready");
    const noLink = await call("GET", `${API}/sessions/no-such-session`);
    check("GET /sessions/:id unknown \u2192 404", noLink.statusCode === 404 && JSON.parse(noLink.body).code === "SESSION_NOT_LINKED");
    const { existsSync: existsSync2 } = await import("node:fs");
    check("paper.md materialized into workspace", existsSync2(join2(config.workspaceDir, "papers", "2101.00004.md")));
    const grounded = await searchTool.execute({ query: "hello" }, { agent: { sessionId: "sess-1" } });
    check("search_paper grounded in linked paper", grounded.passages.length === 1 && grounded.passages[0]?.passage.includes("hello world") === true);
    const groundedById = await searchTool.execute({ query: "hello" }, { agent: { id: "sess-1" } });
    check("search_paper grounded via agent.id (dsh-agent identity field)", groundedById.passages.length === 1 && groundedById.passages[0]?.passage.includes("hello world") === true);
    const sectionTool = registeredTools.find((tool) => tool.name === "read_section");
    const section = await sectionTool.execute({ heading: "Methods" }, { agent: { sessionId: "sess-1" } });
    check("read_section resolves section", section.heading === "Methods" && section.content?.includes("more text") === true);
    const contextText = await paperContextTextForSession(() => Promise.resolve(sql), "sess-1");
    check("paper context text for linked session", contextText !== null && contextText.includes("2101.00004") && contextText.includes("C") && contextText.includes("search_paper"));
    const noContext = await paperContextTextForSession(() => Promise.resolve(sql), "nobody");
    check("no context text for unlinked session", noContext === null);
    const scopeCache = /* @__PURE__ */ new Map([["sess-1", "PAPER"]]);
    check("paperTextForScope reads agent.id off the assembly scope", paperTextForScope({ id: "sess-1" }, scopeCache) === "PAPER");
    check("paperTextForScope empty for unknown scope", paperTextForScope({ id: "nobody" }, scopeCache) === "" && paperTextForScope(void 0, scopeCache) === "");
    await papers.insert("2101.00005");
    const notReadyLink = await call("POST", `${API}/sessions`, { arxiv_id: "2101.00005" });
    check("POST /sessions on non-ready paper \u2192 409", notReadyLink.statusCode === 409 && JSON.parse(notReadyLink.body).code === "PAPER_NOT_READY");
    const sseRoundtrip = [];
    const sseText = 'event: delta.text\ndata: {"type":"delta.text","text":"x"}\n\nevent: done\ndata: {"type":"done","status":"completed"}\n\n';
    async function* sseIter() {
      yield sseText;
    }
    for await (const frame of parseSse(sseIter())) {
      sseRoundtrip.push(JSON.parse(frame.data));
    }
    check("parseSse roundtrip", sseRoundtrip.length === 2 && sseRoundtrip[0].type === "delta.text");
    const markdown = "# Title\n\nHello world.\n\n## References\n\nskip me\n\n## Appendix\n\nlast words.";
    const blocks = splitParagraphs(markdown);
    const spliced = spliceParagraphs(markdown, blocks.map((b) => ({ start: b.start, end: b.end })), [blocks[0].text.toUpperCase(), null]);
    check("paragraph split skips references + splice roundtrip", blocks.length === 2 && spliced.includes("HELLO WORLD.") && spliced.includes("skip me"));
    const imgUrls = extractImageUrls('![a](https://x/a.png) and <img src="/rel/b.jpg"> and ![d](data:image/png;base64,xx)');
    check("extractImageUrls (skips data:)", imgUrls.length === 2);
    const rewritten = rewriteImageUrls("![a](rel/a.png)", /* @__PURE__ */ new Map([["https://x/base/rel/a.png", "/local/a.png"]]), "https://x/base/");
    check("rewriteImageUrls resolves relative", rewritten.includes("/local/a.png"));
    const glossary = parseJsonObject('Here it is:\n```json\n{"attention": "\u6CE8\u610F\u529B"}\n```');
    check("parseJsonObject strips fences", glossary?.attention === "\u6CE8\u610F\u529B");
    const mock = await startMockLlm();
    const provider = { baseUrl: mock.url, apiKey: "sk-test", model: "mock" };
    try {
      const paperX = await papers.insert("2101.00001");
      const mdX = "# Title\n\nFirst paragraph.\n\n## Methods\n\nSecond paragraph.";
      await papers.finishReady(paperX.id, { title: "X", authors: [], categories: [], abstract: null, published: null }, mdX);
      const jobX = await translations.createJob(paperX.id, "zh-CN", provider);
      const claimedX = await translations.claimNextJob();
      assert.ok(claimedX, "translation job claimed for e2e");
      await runTranslationJob(claimedX, mdX, { translations, provider, timeoutMs: 1e4, maxAttempts: 3 });
      const snapX = await translations.findSnapshot(paperX.id, "zh-CN");
      check(
        "translation e2e: snapshot completed with 2 paragraphs",
        snapX?.status === "completed" && snapX.paragraphs?.length === 2 && snapX.paragraphs[0]?.startsWith("[ZH]") === true && snapX.paragraphs[1]?.startsWith("[ZH]") === true
      );
      check("translation e2e: glossary extracted", snapX?.glossary.transformer === "\u53D8\u6362\u5668");
      check("translation e2e: job completed", await translations.jobStatus(jobX.id) === "completed");
      const paperY = await papers.insert("2101.00002");
      const mdY = "# T\n\nP1.\n\nP2.\n\nP3.";
      await papers.finishReady(paperY.id, { title: "Y", authors: [], categories: [], abstract: null, published: null }, mdY);
      const jobY = await translations.createJob(paperY.id, "en-US", provider);
      const claimedY = await translations.claimNextJob();
      assert.ok(claimedY, "resume job claimed");
      const blocksY = splitParagraphs(mdY);
      const offsetsY = blocksY.map((b) => ({ start: b.start, end: b.end }));
      await translations.startSnapshot(jobY.id, paperY.id, "en-US", offsetsY);
      await translations.updateSnapshot({ jobId: jobY.id, paperId: paperY.id, targetLang: "en-US", paragraphs: ["[EN] P1.", null, null], offsets: offsetsY, glossary: {}, model: "mock" });
      const beforeResume = mock.requests.length;
      await runTranslationJob(claimedY, mdY, { translations, provider, timeoutMs: 1e4, maxAttempts: 3 });
      const translatorCalls = mock.requests.slice(beforeResume).filter((r) => String(r.body.messages?.[0]?.content ?? "").includes("academic-paper translator"));
      const snapY = await translations.findSnapshot(paperY.id, "en-US");
      check("translation e2e: resume skips done paragraphs", translatorCalls.length === 2 && snapY?.status === "completed" && snapY.paragraphs[0] === "[EN] P1.");
      const deadProvider = { baseUrl: "http://127.0.0.1:1/v1", apiKey: "x", model: "mock" };
      const paperZ = await papers.insert("2101.00003");
      await papers.finishReady(paperZ.id, { title: "Z", authors: [], categories: [], abstract: null, published: null }, "# T\n\nP1.");
      const jobZ = await translations.createJob(paperZ.id, "zh-CN", deadProvider);
      await translations.claimNextJob();
      let zJob = await translations.findLatestJob(paperZ.id, "zh-CN");
      assert.ok(zJob, "job created");
      await failTranslationJob(zJob, new Error("connection refused"), { translations, provider: deadProvider, timeoutMs: 1e3, maxAttempts: 3 });
      zJob = await translations.findLatestJob(paperZ.id, "zh-CN");
      check("failed translation requeued with backoff", zJob?.status === "pending" && zJob.attempts === 1 && Boolean(zJob.error));
      await sql`UPDATE paper.translation_jobs SET available_at = now() WHERE id = ${jobZ.id}`;
      zJob = await translations.claimNextJob();
      await failTranslationJob(zJob, new Error("boom again"), { translations, provider: deadProvider, timeoutMs: 1e3, maxAttempts: 3 });
      await sql`UPDATE paper.translation_jobs SET available_at = now() WHERE id = ${jobZ.id}`;
      zJob = await translations.claimNextJob();
      await failTranslationJob(zJob, new Error("boom third"), { translations, provider: deadProvider, timeoutMs: 1e3, maxAttempts: 3 });
      zJob = await translations.findLatestJob(paperZ.id, "zh-CN");
      check("translation fails permanently after maxAttempts", zJob?.status === "failed" && zJob?.attempts === 3);
    } finally {
      await mock.close();
    }
    const movedRes = await call("POST", `${API}/settings`, { configured: true, dataDir: join2(root, "moved-db"), assetsDir: join2(root, "moved-assets") });
    const movedBody = JSON.parse(movedRes.body);
    check("changing dataDir while running \u2192 restartRequired", movedRes.statusCode === 200 && movedBody.restartRequired === true && host.state.restartRequired === true);
    const settingsAfterMove = await call("GET", `${API}/settings`);
    check("new path persisted to settings.json", JSON.parse(settingsAfterMove.body).settings.dataDir.endsWith("moved-db"));
    const stillServing = await call("GET", `${API}/health`);
    check("old runtime keeps serving until restart", stillServing.statusCode === 200 && JSON.parse(stillServing.body).status === "ok");
    const disabled = await call("POST", `${API}/settings`, { configured: false });
    check("disable \u2192 200 + host unconfigured", disabled.statusCode === 200 && JSON.parse(disabled.body).configured === false && host.state.configured === false);
    check("disable disposes runtime", host.active() === null);
    const gatedAgain = await call("GET", `${API}/papers`);
    check("business route gated again after disable", gatedAgain.statusCode === 423);
    const reenabled = await call("POST", `${API}/settings`, { configured: true, dataDir: config.dataDir, assetsDir: config.assetsDir, port: 0, pollMs: config.pollMs, rescanIntervalMs: config.rescanIntervalMs });
    check("re-enable \u2192 200", reenabled.statusCode === 200 && JSON.parse(reenabled.body).configured === true);
    const active2 = await host.ensureStarted();
    const sql2 = await active2.runtime.getSql();
    const count = await sql2`SELECT count(*)::int AS n FROM paper.papers`;
    check("re-enable persists data (6 papers)", count[0].n === 6);
    active2.runtime.dispose();
    for (const dispose of disposers) dispose();
    await sleep(500);
    await assert.rejects(() => sql2`SELECT 1`);
    check("dispose closes socket + client + loops", true);
    const reloaded = loadSettingsFile();
    check(
      "settings.json survives restart (version tolerated, paths intact)",
      reloaded?.configured === true && reloaded.dataDir === config.dataDir && reloaded.workspaceDir === config.workspaceDir
    );
  } finally {
    if (priorDshHome === void 0) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = priorDshHome;
    rmSync(root, { recursive: true, force: true });
  }
  console.log("\n== summary ==");
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((error) => {
  console.error("[paperspace.test] fatal:", error);
  process.exit(2);
});

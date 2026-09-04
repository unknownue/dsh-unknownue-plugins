// src/host/tasks/db.ts
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// src/host/tasks/schema.ts
var SCHEMA_SQL = `
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
  todos        TEXT NOT NULL DEFAULT '[]',
  tags         TEXT NOT NULL DEFAULT '[]'
);

-- Columns for databases booted before the features landed:
-- CREATE TABLE IF NOT EXISTS does not touch an existing table, so the
-- idempotent ALTERs cover every already-booted board.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS todos TEXT NOT NULL DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_until TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO meta (key, value) VALUES ('schema_version', '1') ON CONFLICT (key) DO NOTHING;
INSERT INTO meta (key, value) VALUES ('revision', '0') ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_tasks_status_rank ON tasks (status, rank) WHERE archived = 0;
`;

// src/host/tasks/db.ts
function createTasksRuntime(config) {
  if (config.dataDir !== "") {
    mkdirSync(config.dataDir, { recursive: true });
  }
  const options = {
    initialMemory: config.initialMemoryBytes
  };
  if (config.dataDir !== "") options.dataDir = config.dataDir;
  const pglite = new PGlite(options);
  let disposed = false;
  const ready = (async () => {
    await pglite.waitReady;
    await pglite.exec(SCHEMA_SQL);
  })();
  return {
    ready,
    async query(sql, params) {
      await ready;
      if (disposed) throw new Error("tasks runtime is disposed");
      const result = await pglite.query(sql, params);
      return { rows: result.rows };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      void pglite.close().catch(() => {
      });
    }
  };
}

// src/host/tasks/routes.ts
import { z } from "zod";

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

// src/host/tasks/store.ts
import { randomUUID } from "node:crypto";
var RANK_STEP = 1024;
var COLUMNS = "id, title, body, status, priority, due_at, due_until, rank, archived, created_at, updated_at, completed_at, todos, tags";
var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parseTodos(text) {
  if (typeof text !== "string" || text === "") return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (item === null || typeof item !== "object") return [];
      const record = item;
      if (typeof record.id !== "string" || !UUID_PATTERN.test(record.id)) return [];
      if (typeof record.content !== "string" || record.content === "") return [];
      if (typeof record.done !== "boolean") return [];
      return [{ id: record.id, content: record.content, done: record.done }];
    });
  } catch {
    return [];
  }
}
function normalizeTodos(items) {
  return items.map((item) => ({
    id: typeof item.id === "string" && UUID_PATTERN.test(item.id) ? item.id : randomUUID(),
    content: item.content.trim(),
    done: item.done
  }));
}
function parseTags(text) {
  if (typeof text !== "string" || text === "") return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === "string" && item !== "").slice(0, 20);
  } catch {
    return [];
  }
}
function normalizeTags(items) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const raw of items) {
    const tag = raw.trim();
    if (tag === "" || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 20) break;
  }
  return out;
}
function flattenDue(due) {
  if (due === null) return { due_at: null, due_until: null };
  return due.kind === "point" ? { due_at: due.at, due_until: null } : { due_at: due.start, due_until: due.end };
}
function dueOf(row) {
  if (typeof row.due_at !== "string" || row.due_at === "") return null;
  if (typeof row.due_until === "string" && row.due_until !== "") {
    return { kind: "range", start: row.due_at, end: row.due_until };
  }
  return { kind: "point", at: row.due_at };
}
function toCard(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    priority: row.priority,
    due: dueOf(row),
    rank: row.rank,
    archived: row.archived === 1,
    todos: parseTodos(row.todos),
    tags: parseTags(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  };
}
function taskError(code, message) {
  return Object.assign(new Error(message), { code });
}
async function bumpRevision(runtime) {
  await runtime.query(`UPDATE meta SET value = CAST(value AS BIGINT) + 1 WHERE key = 'revision'`);
}
async function readRevision(runtime) {
  const rows = await runtime.query(`SELECT value FROM meta WHERE key = 'revision'`);
  const value = rows.rows[0]?.value;
  return typeof value === "string" ? Number(value) || 0 : 0;
}
async function listBoard(runtime, includeArchived = false) {
  const rows = await runtime.query(
    `SELECT ${COLUMNS} FROM tasks WHERE archived = 0 OR $1 = 1 ORDER BY status, rank, created_at`,
    [includeArchived ? 1 : 0]
  );
  return rows.rows.map(toCard);
}
async function findRow(runtime, id) {
  const rows = await runtime.query(`SELECT ${COLUMNS} FROM tasks WHERE id = $1 LIMIT 1`, [id]);
  return rows.rows[0] ?? null;
}
async function findCard(runtime, id) {
  const row = await findRow(runtime, id);
  return row === null ? null : toCard(row);
}
async function columnMaxRank(runtime, status) {
  const rows = await runtime.query(
    `SELECT MAX(rank) AS max FROM tasks WHERE archived = 0 AND status = $1`,
    [status]
  );
  return rows.rows[0]?.max ?? 0;
}
async function createCard(runtime, input) {
  const now = Date.now();
  const status = input.status ?? "todo";
  const rank = await columnMaxRank(runtime, status) + RANK_STEP;
  const id = randomUUID();
  const completedAt = status === "done" ? now : null;
  const todos = input.todos !== void 0 ? JSON.stringify(normalizeTodos(input.todos)) : "[]";
  const tags = input.tags !== void 0 ? JSON.stringify(normalizeTags(input.tags)) : "[]";
  const due = flattenDue(input.due ?? null);
  await runtime.query(
    `INSERT INTO tasks (id, title, body, status, priority, due_at, due_until, rank, created_at, updated_at, completed_at, todos, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, $12)`,
    [id, input.title, input.body ?? "", status, input.priority ?? "medium", due.due_at, due.due_until, rank, now, completedAt, todos, tags]
  );
  await bumpRevision(runtime);
  const card = await findCard(runtime, id);
  if (card === null) throw taskError("TASK_NOT_FOUND", `task ${id} vanished after create`);
  return card;
}
async function updateCard(runtime, id, patch) {
  const current = await findRow(runtime, id);
  if (current === null) throw taskError("TASK_NOT_FOUND", `task ${id} not found`);
  const now = Date.now();
  let status = current.status;
  let rank = current.rank;
  let completedAt = current.completed_at;
  if (patch.status !== void 0 && patch.status !== current.status) {
    status = patch.status;
    rank = await columnMaxRank(runtime, status) + RANK_STEP;
    completedAt = status === "done" ? now : null;
  } else if (status === "done" && completedAt === null) {
    completedAt = now;
  }
  const todos = patch.todos !== void 0 ? JSON.stringify(normalizeTodos(patch.todos)) : null;
  const tags = patch.tags !== void 0 ? JSON.stringify(normalizeTags(patch.tags)) : null;
  const keepDue = patch.due === void 0;
  const due = flattenDue(patch.due ?? null);
  await runtime.query(
    `UPDATE tasks SET title = $2, body = $3, priority = $4, due_at = CASE WHEN $5 THEN due_at ELSE $6 END,
       due_until = CASE WHEN $7 THEN due_until ELSE $8 END, status = $9, rank = $10,
       completed_at = $11, updated_at = $12, todos = COALESCE($13, todos),
       tags = COALESCE($14, tags) WHERE id = $1`,
    [
      id,
      patch.title ?? current.title,
      patch.body ?? current.body,
      patch.priority ?? current.priority,
      keepDue,
      due.due_at,
      keepDue,
      due.due_until,
      status,
      rank,
      completedAt,
      now,
      todos,
      tags
    ]
  );
  await bumpRevision(runtime);
  const card = await findCard(runtime, id);
  if (card === null) throw taskError("TASK_NOT_FOUND", `task ${id} vanished after update`);
  return card;
}
async function moveCard(runtime, id, move) {
  const current = await findRow(runtime, id);
  if (current === null) throw taskError("TASK_NOT_FOUND", `task ${id} not found`);
  const column = await runtime.query(
    `SELECT ${COLUMNS} FROM tasks WHERE archived = 0 AND status = $1 AND id <> $2 ORDER BY rank, created_at`,
    [move.status, id]
  );
  const cards = column.rows;
  const appendRank = cards.length > 0 ? cards[cards.length - 1].rank + RANK_STEP : RANK_STEP;
  let rank;
  if (move.beforeId !== void 0 && move.beforeId !== null) {
    const index = cards.findIndex((card2) => card2.id === move.beforeId);
    if (index === -1) throw taskError("TARGET_NOT_IN_COLUMN", `card ${move.beforeId} is not in column ${move.status}`);
    const next = cards[index].rank;
    const prev = index > 0 ? cards[index - 1].rank : null;
    rank = prev === null ? next / 2 : next - prev <= 0 ? appendRank : next - (next - prev) / 2;
  } else if (move.afterId !== void 0 && move.afterId !== null) {
    const index = cards.findIndex((card2) => card2.id === move.afterId);
    if (index === -1) throw taskError("TARGET_NOT_IN_COLUMN", `card ${move.afterId} is not in column ${move.status}`);
    const prev = cards[index].rank;
    const next = index + 1 < cards.length ? cards[index + 1].rank : null;
    rank = next === null ? prev + RANK_STEP : next - prev <= 0 ? appendRank : prev + (next - prev) / 2;
  } else {
    rank = appendRank;
  }
  const completedAt = move.status === "done" ? Date.now() : null;
  await runtime.query(
    `UPDATE tasks SET status = $2, rank = $3, completed_at = $4, updated_at = $5 WHERE id = $1`,
    [id, move.status, rank, completedAt, Date.now()]
  );
  await bumpRevision(runtime);
  const card = await findCard(runtime, id);
  if (card === null) throw taskError("TASK_NOT_FOUND", `task ${id} vanished after move`);
  return card;
}
async function archiveCard(runtime, id) {
  const card = await findCard(runtime, id);
  if (card === null) throw taskError("TASK_NOT_FOUND", `task ${id} not found`);
  await runtime.query(`UPDATE tasks SET archived = 1, updated_at = $2 WHERE id = $1`, [id, Date.now()]);
  await bumpRevision(runtime);
  return { ...card, archived: true, updatedAt: Date.now() };
}
async function restoreCard(runtime, id) {
  const current = await findRow(runtime, id);
  if (current === null) throw taskError("TASK_NOT_FOUND", `task ${id} not found`);
  const status = current.status;
  const rank = await columnMaxRank(runtime, status) + RANK_STEP;
  await runtime.query(`UPDATE tasks SET archived = 0, rank = $2, updated_at = $3 WHERE id = $1`, [id, rank, Date.now()]);
  await bumpRevision(runtime);
  const card = await findCard(runtime, id);
  if (card === null) throw taskError("TASK_NOT_FOUND", `task ${id} vanished after restore`);
  return card;
}
async function deleteCard(runtime, id) {
  await runtime.query(`DELETE FROM tasks WHERE id = $1`, [id]);
  await bumpRevision(runtime);
}

// src/host/tasks/routes.ts
var TASKS_API = "/dsh-unknownue-plugins/tasks/api";
var statusSchema = z.enum(["todo", "in_progress", "blocked", "done"]);
var prioritySchema = z.enum(["low", "medium", "high"]);
var dueTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/, "due time must be YYYY-MM-DD or YYYY-MM-DDTHH:mm");
var dueSchema = z.union([
  z.object({ kind: z.literal("point"), at: dueTimeSchema }).strict(),
  z.object({ kind: z.literal("range"), start: dueTimeSchema, end: dueTimeSchema }).strict().refine((value) => value.start <= value.end, { message: "range start must not be after end" })
]).nullable();
var todoSchema = z.object({
  id: z.string().uuid().optional(),
  content: z.string().trim().min(1).max(200),
  done: z.boolean()
});
var todosSchema = z.array(todoSchema).max(50);
var tagsSchema = z.array(z.string().trim().min(1).max(32)).max(20);
var createSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().max(5e4).optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  due: dueSchema.optional(),
  todos: todosSchema.optional(),
  tags: tagsSchema.optional()
}).strict();
var updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body: z.string().max(5e4).optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  due: dueSchema.optional(),
  todos: todosSchema.optional(),
  tags: tagsSchema.optional()
}).strict();
var moveSchema = z.object({
  status: statusSchema,
  before_id: z.string().min(1).max(64).nullable().optional(),
  after_id: z.string().min(1).max(64).nullable().optional()
}).strict();
var settingsSchema = z.object({ data_dir: z.string().min(1).max(1024) }).strict();
var idSchema = z.string().min(1).max(64);
function statusOf(error) {
  const code = error.code;
  if (code === "TASK_NOT_FOUND") return 404;
  if (code === "TARGET_NOT_IN_COLUMN") return 400;
  return 500;
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
      if (error instanceof z.ZodError) {
        json(res, 400, { code: "VALIDATION_ERROR", message: error.issues.map((issue) => issue.message).join("; ") });
        return;
      }
      if (!res.headersSent) {
        json(res, statusOf(error), { code: error.code ?? "INTERNAL_ERROR", message: messageOf(error) });
      }
    }
  };
  webServer.register(
    {
      kind: "prefix",
      path: TASKS_API,
      handler: wrap(async (req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        const rest = url.pathname.slice(TASKS_API.length).replace(/^\//, "").split("/").filter(Boolean);
        const method = req.method ?? "GET";
        if (rest.length === 1 && (rest[0] === "board" || rest[0] === "revision")) {
          if (method !== "GET") return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
          const runtime = await host.ensureStarted();
          if (rest[0] === "revision") return json(res, 200, { revision: await readRevision(runtime) });
          const includeArchived = url.searchParams.get("archived") === "1";
          return json(res, 200, { revision: await readRevision(runtime), tasks: await listBoard(runtime, includeArchived) });
        }
        if (rest.length >= 1 && rest[0] === "cards") {
          if (rest.length === 1) {
            if (method !== "POST") return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
            const input = createSchema.parse(await readBody(req));
            const runtime2 = await host.ensureStarted();
            const card = await createCard(runtime2, {
              title: input.title,
              body: input.body,
              status: input.status,
              priority: input.priority,
              due: input.due,
              todos: input.todos,
              tags: input.tags
            });
            return json(res, 200, { card });
          }
          const id = idSchema.parse(rest[1]);
          const runtime = await host.ensureStarted();
          if (rest.length === 2) {
            if (method === "PATCH") {
              const input = updateSchema.parse(await readBody(req));
              const card = await updateCard(runtime, id, {
                title: input.title,
                body: input.body,
                status: input.status,
                priority: input.priority,
                due: input.due,
                todos: input.todos,
                tags: input.tags
              });
              return json(res, 200, { card });
            }
            if (method === "DELETE") {
              await deleteCard(runtime, id);
              return json(res, 200, { ok: true });
            }
            return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
          }
          if (rest.length === 3 && method === "POST") {
            if (rest[2] === "move") {
              const input = moveSchema.parse(await readBody(req));
              const card = await moveCard(runtime, id, {
                status: input.status,
                beforeId: input.before_id,
                afterId: input.after_id
              });
              return json(res, 200, { card });
            }
            if (rest[2] === "archive") return json(res, 200, { card: await archiveCard(runtime, id) });
            if (rest[2] === "restore") return json(res, 200, { card: await restoreCard(runtime, id) });
          }
          return json(res, 404, { code: "NOT_FOUND", message: "route not found" });
        }
        if (rest.length === 1 && rest[0] === "settings") {
          if (method === "GET") {
            const view = {
              restartRequired: host.state.restartRequired,
              settingsPath: host.state.settingsPath,
              defaults: host.row,
              settings: host.file()
            };
            return json(res, 200, view);
          }
          if (method === "POST") {
            const input = settingsSchema.parse(await readBody(req));
            const result = await host.save({ dataDir: input.data_dir });
            if (!result.ok) return json(res, 400, { code: "SETTINGS_INVALID", message: result.error ?? "settings save failed" });
            return json(res, 200, result);
          }
          return json(res, 405, { code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
        }
        return json(res, 404, { code: "NOT_FOUND", message: "route not found" });
      })
    },
    "dsh-unknownue-plugins/tasks: api"
  );
}

// src/host/tasks/settings.ts
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
function tasksHome() {
  return process.env.DSH_HOME || join(homedir(), ".dsh");
}
function tasksSettingsPath() {
  return join(tasksHome(), "tasks", "settings.json");
}
function normalizePath(value) {
  const expanded = value === "~" || value.startsWith("~/") ? join(homedir(), value.slice(1)) : value;
  return isAbsolute(expanded) ? resolve(expanded) : resolve(process.cwd(), expanded);
}
function builtinDefaults() {
  const root = join(tasksHome(), "tasks");
  return {
    dataDir: join(root, "db"),
    initialMemoryBytes: 128 * 1024 * 1024
  };
}
function resolveConfig(row = {}) {
  const base = builtinDefaults();
  return {
    dataDir: typeof row.dataDir === "string" && row.dataDir !== "" ? normalizePath(row.dataDir) : base.dataDir,
    initialMemoryBytes: typeof row.initialMemoryBytes === "number" ? row.initialMemoryBytes : base.initialMemoryBytes
  };
}
function loadSettingsFile() {
  try {
    const parsed = JSON.parse(readFileSync(tasksSettingsPath(), "utf8"));
    if (parsed === null || typeof parsed !== "object") return null;
    const record = parsed;
    if (typeof record.dataDir !== "string" || record.dataDir === "") return null;
    return { version: 1, dataDir: normalizePath(record.dataDir) };
  } catch {
    return null;
  }
}
async function saveSettingsFile(settings) {
  const path = tasksSettingsPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

// src/host/tasks/index.ts
var name = "dsh-unknownue-plugins/tasks";
var inject = ["webServer"];
function apply(ctx, config = {}) {
  const row = resolveConfig(config);
  let file = loadSettingsFile();
  const state = { restartRequired: false, settingsPath: tasksSettingsPath() };
  let runtimePromise = null;
  const ensureStarted = () => {
    if (runtimePromise === null) {
      const effective = {
        dataDir: file?.dataDir ?? row.dataDir,
        initialMemoryBytes: row.initialMemoryBytes
      };
      const runtime = createTasksRuntime(effective);
      runtimePromise = runtime.ready.then(
        () => runtime,
        (error) => {
          runtimePromise = null;
          throw error;
        }
      );
    }
    return runtimePromise;
  };
  const host = {
    ensureStarted,
    state,
    row,
    file: () => file,
    async save(input) {
      try {
        const dataDir = normalizePath(input.dataDir);
        const nextFile = { version: 1, dataDir };
        await saveSettingsFile(nextFile);
        const previous = file?.dataDir ?? row.dataDir;
        const changed = previous !== dataDir;
        file = nextFile;
        state.restartRequired = changed;
        return { ok: true, restartRequired: changed };
      } catch (error) {
        return { ok: false, restartRequired: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  };
  ctx.effect(
    () => () => {
      const pending = runtimePromise;
      runtimePromise = null;
      if (pending !== null) void pending.then((runtime) => runtime.dispose()).catch(() => void 0);
    },
    "dsh-unknownue-plugins/tasks: runtime dispose"
  );
  registerRoutes(ctx.webServer, host);
}
export {
  TASKS_API,
  apply,
  inject,
  name,
  resolveConfig,
  tasksSettingsPath
};

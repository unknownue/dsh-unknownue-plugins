// src/host/tasks/tasks.test.ts
import { existsSync, mkdtempSync, readFileSync as readFileSync2, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as join2 } from "node:path";
import { EventEmitter } from "node:events";
import { apply, TASKS_API } from "./index.js";

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
  rank         REAL NOT NULL DEFAULT 1024,
  archived     INTEGER NOT NULL DEFAULT 0,
  created_at   BIGINT NOT NULL,
  updated_at   BIGINT NOT NULL,
  completed_at BIGINT
);

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

// src/host/tasks/settings.ts
import { readFileSync } from "node:fs";
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

// src/host/tasks/tasks.test.ts
var results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " \u2014 " + detail : ""}`);
}
var tmpRoot = mkdtempSync(join2(tmpdir(), "dsh-tasks-test-"));
process.env.DSH_HOME = tmpRoot;
function makeCtx() {
  const routes = /* @__PURE__ */ new Map();
  const disposers = [];
  const ctx = {
    effect(fn, _label) {
      const result = fn();
      if (typeof result === "function") disposers.push(result);
      return void 0;
    },
    webServer: {
      register(route, _label) {
        routes.set(`${route.kind}:${route.path}`, route);
        return () => routes.delete(`${route.kind}:${route.path}`);
      }
    }
  };
  return { ctx, harness: { routes, disposers } };
}
function mockReq(method, url, body, remoteAddress = "127.0.0.1") {
  const chunks = body === void 0 ? [] : [Buffer.from(JSON.stringify(body))];
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    method,
    url,
    headers: { host: "127.0.0.1:13080" },
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    }
  });
}
var MockRes = class {
  statusCode = 200;
  bodyText = "";
  sent = false;
  writeHead(status, headers) {
    this.statusCode = status;
    void headers;
  }
  end(body) {
    this.bodyText = body ?? "";
    this.sent = true;
  }
  get headersSent() {
    return this.sent;
  }
};
async function call(route, method, path, body, remoteAddress) {
  const res = new MockRes();
  await route.handler(mockReq(method, path, body, remoteAddress), res);
  let parsed = {};
  try {
    parsed = JSON.parse(res.bodyText);
  } catch {
    parsed = { raw: res.bodyText };
  }
  return { status: res.statusCode, body: parsed };
}
var sleep = (ms) => new Promise((resolve2) => setTimeout(resolve2, ms));
async function main() {
  const first = makeCtx();
  apply(first.ctx, {});
  const api = first.harness.routes.get(`prefix:${TASKS_API}`);
  check("apply registers the prefix route", api !== void 0);
  if (api === void 0) throw new Error("missing route");
  check("apply registers one route only", first.harness.routes.size === 1);
  check("effect disposer captured", first.harness.disposers.length === 1);
  const empty = await call(api, "GET", `${TASKS_API}/board`);
  check("fresh board is empty with revision 0", empty.status === 200 && empty.body.revision === 0 && Array.isArray(empty.body.tasks) && empty.body.tasks.length === 0, JSON.stringify(empty.body));
  const a = await call(api, "POST", `${TASKS_API}/cards`, { title: "\u5199\u5468\u62A5" });
  const cardA = a.body.card;
  check("create with defaults", a.status === 200 && cardA.title === "\u5199\u5468\u62A5" && cardA.status === "todo" && cardA.priority === "medium" && cardA.rank === 1024 && cardA.dueAt === null && cardA.body === "" && cardA.completedAt === null, JSON.stringify(a.body));
  const b = await call(api, "POST", `${TASKS_API}/cards`, { title: "\u4FEE\u767B\u5F55 bug", status: "done", priority: "high", due_at: "2026-09-10", body: "\u590D\u73B0\u6B65\u9AA4\u89C1\u6587\u6863" });
  const cardB = b.body.card;
  check("create with all fields", b.status === 200 && cardB.status === "done" && cardB.priority === "high" && cardB.dueAt === "2026-09-10" && typeof cardB.completedAt === "number", JSON.stringify(b.body));
  const badTitle = await call(api, "POST", `${TASKS_API}/cards`, { title: "" });
  check("empty title \u2192 400 VALIDATION_ERROR", badTitle.status === 400 && badTitle.body.code === "VALIDATION_ERROR");
  const badStatus = await call(api, "POST", `${TASKS_API}/cards`, { title: "x", status: "bogus" });
  check("invalid status \u2192 400 VALIDATION_ERROR", badStatus.status === 400 && badStatus.body.code === "VALIDATION_ERROR");
  const afterCreate = await call(api, "GET", `${TASKS_API}/board`);
  const created = afterCreate.body.tasks;
  check("board lists 2 cards, revision 2", afterCreate.status === 200 && afterCreate.body.revision === 2 && created.length === 2, JSON.stringify({ revision: afterCreate.body.revision, count: created.length }));
  const updated = await call(api, "PATCH", `${TASKS_API}/cards/${cardA.id}`, { title: "\u5199\u5468\u62A5 v2", priority: "high" });
  const cardA2 = updated.body.card;
  check("patch updates fields", updated.status === 200 && cardA2.title === "\u5199\u5468\u62A5 v2" && cardA2.priority === "high" && cardA2.status === "todo" && cardA2.body === "", JSON.stringify(updated.body));
  const missing = await call(api, "PATCH", `${TASKS_API}/cards/does-not-exist`, { title: "x" });
  check("patch unknown card \u2192 404 TASK_NOT_FOUND", missing.status === 404 && missing.body.code === "TASK_NOT_FOUND");
  const moved = await call(api, "POST", `${TASKS_API}/cards/${cardA.id}/move`, { status: "in_progress" });
  const cardA3 = moved.body.card;
  check("move into empty column appends", moved.status === 200 && cardA3.status === "in_progress" && cardA3.rank === 1024 && cardA3.completedAt === null, JSON.stringify(moved.body));
  const done = await call(api, "POST", `${TASKS_API}/cards/${cardA.id}/move`, { status: "done" });
  const cardA4 = done.body.card;
  check("move to done stamps completedAt", done.status === 200 && cardA4.status === "done" && typeof cardA4.completedAt === "number", JSON.stringify(done.body));
  const c = await call(api, "POST", `${TASKS_API}/cards`, { title: "C" });
  const d = await call(api, "POST", `${TASKS_API}/cards`, { title: "D" });
  const cardC = c.body.card;
  const cardD = d.body.card;
  check("column ranks grow by 1024", cardC.rank === 1024 && cardD.rank === 2048, JSON.stringify({ c: cardC.rank, d: cardD.rank }));
  const beforeC = await call(api, "POST", `${TASKS_API}/cards/${cardA.id}/move`, { status: "todo", before_id: cardC.id });
  const cardA5 = beforeC.body.card;
  check("move before first card halves rank", beforeC.status === 200 && cardA5.status === "todo" && cardA5.rank > 0 && cardA5.rank < 1024, JSON.stringify(beforeC.body));
  const afterD = await call(api, "POST", `${TASKS_API}/cards/${cardA.id}/move`, { status: "todo", after_id: cardD.id });
  const cardA6 = afterD.body.card;
  check("move after last card appends", afterD.status === 200 && cardA6.rank > 2048, JSON.stringify(afterD.body));
  const between = await call(api, "POST", `${TASKS_API}/cards/${cardA.id}/move`, { status: "todo", after_id: cardC.id });
  const cardA7 = between.body.card;
  check("move between neighbours lands strictly between", between.status === 200 && cardA7.rank > 1024 && cardA7.rank < 2048, JSON.stringify(between.body));
  const wrongColumn = await call(api, "POST", `${TASKS_API}/cards/${cardA.id}/move`, { status: "done", before_id: cardC.id });
  check("target not in column \u2192 400", wrongColumn.status === 400 && wrongColumn.body.code === "TARGET_NOT_IN_COLUMN", JSON.stringify(wrongColumn.body));
  const archived = await call(api, "POST", `${TASKS_API}/cards/${cardC.id}/archive`);
  check("archive returns the card", archived.status === 200 && archived.body.card.id === cardC.id);
  const withoutC = await call(api, "GET", `${TASKS_API}/board`);
  const afterArchive = withoutC.body.tasks;
  check("archived card leaves the board", !afterArchive.some((t) => t.id === cardC.id), JSON.stringify(withoutC.body));
  const restored = await call(api, "POST", `${TASKS_API}/cards/${cardC.id}/restore`);
  const cardC2 = restored.body.card;
  check("restore re-appends the card", restored.status === 200 && cardC2.id === cardC.id && cardC2.rank > 2048, JSON.stringify(restored.body));
  const deleted = await call(api, "DELETE", `${TASKS_API}/cards/${cardD.id}`);
  check("delete succeeds", deleted.status === 200 && deleted.body.ok === true);
  const withoutD = await call(api, "GET", `${TASKS_API}/board`);
  const afterDelete = withoutD.body.tasks;
  check("deleted card is gone", !afterDelete.some((t) => t.id === cardD.id), JSON.stringify(withoutD.body));
  const revision = await call(api, "GET", `${TASKS_API}/revision`);
  const boardNow = await call(api, "GET", `${TASKS_API}/board`);
  check("revision endpoint matches board", revision.body.revision === boardNow.body.revision, JSON.stringify({ revision: revision.body.revision, board: boardNow.body.revision }));
  const remote = await call(api, "GET", `${TASKS_API}/board`, void 0, "8.8.8.8");
  check("non-loopback remote \u2192 403", remote.status === 403 && remote.body.code === "FORBIDDEN");
  const wrongMethod = await call(api, "GET", `${TASKS_API}/cards`);
  check("GET /cards \u2192 405", wrongMethod.status === 405 && wrongMethod.body.code === "METHOD_NOT_ALLOWED");
  const before = await call(api, "GET", `${TASKS_API}/board`);
  const persistedCard = await call(api, "POST", `${TASKS_API}/cards`, { title: "\u91CD\u542F\u540E\u8FD8\u5728" });
  const persistedId = persistedCard.body.card.id;
  check("card persisted before dispose", persistedCard.status === 200);
  for (const dispose of first.harness.disposers) dispose();
  await sleep(150);
  const second = makeCtx();
  apply(second.ctx, {});
  const api2 = second.harness.routes.get(`prefix:${TASKS_API}`);
  check("second apply registers its route", api2 !== void 0);
  if (api2 === void 0) throw new Error("missing second route");
  const reopened = await call(api2, "GET", `${TASKS_API}/board`);
  const reopenedTasks = reopened.body.tasks;
  check("data survives dispose + reopen", reopened.status === 200 && reopenedTasks.some((t) => t.id === persistedId), JSON.stringify({ count: reopenedTasks.length, revision: reopened.body.revision }));
  check("revision continues across reopen", reopened.body.revision === before.body.revision + 1, JSON.stringify({ before: before.body.revision, reopened: reopened.body.revision }));
  const settings = await call(api2, "GET", `${TASKS_API}/settings`);
  const settingsDefaults = settings.body.defaults;
  check("settings defaults derive from DSH_HOME", settings.status === 200 && settingsDefaults.dataDir === join2(tmpRoot, "tasks", "db") && settings.body.settings === null, JSON.stringify(settings.body));
  const customDir = join2(tmpRoot, "custom-db");
  const saveCustom = await call(api2, "POST", `${TASKS_API}/settings`, { data_dir: customDir });
  check("changing dataDir flags restartRequired", saveCustom.status === 200 && saveCustom.body.ok === true && saveCustom.body.restartRequired === true, JSON.stringify(saveCustom.body));
  check("settings.json persisted with normalized path", existsSync(tasksSettingsPath()) && loadSettingsFile()?.dataDir === customDir, loadSettingsFile()?.dataDir ?? "missing");
  const saveSame = await call(api2, "POST", `${TASKS_API}/settings`, { data_dir: customDir });
  check("same dataDir \u2192 restartRequired false", saveSame.status === 200 && saveSame.body.restartRequired === false, JSON.stringify(saveSame.body));
  const emptyDir = await call(api2, "POST", `${TASKS_API}/settings`, { data_dir: "" });
  check("empty dataDir \u2192 400 VALIDATION_ERROR", emptyDir.status === 400 && emptyDir.body.code === "VALIDATION_ERROR");
  const onDisk = JSON.parse(readFileSync2(tasksSettingsPath(), "utf8"));
  check("settings file shape { version: 1, dataDir }", onDisk.version === 1 && onDisk.dataDir === customDir);
  const memoryRuntime = createTasksRuntime({ dataDir: "", initialMemoryBytes: 128 * 1024 * 1024 });
  const rows = await memoryRuntime.query(`SELECT 1 AS one`);
  check("in-memory runtime boots and queries", rows.rows.length === 1 && rows.rows[0].one === 1);
  memoryRuntime.dispose();
  for (const dispose of second.harness.disposers) dispose();
  await sleep(150);
  rmSync(tmpRoot, { recursive: true, force: true });
  const failed = results.filter((result) => !result.ok).length;
  console.log(`
${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed === 0 ? 0 : 1;
}
void main().catch((error) => {
  console.error("tasks test crashed:", error);
  process.exitCode = 1;
});

/**
 * Task-board host-half integration test (no framework; run:
 * `node lib/tasks/tasks.test.js`).
 *
 * Boots the REAL PGlite runtime inside a mock cordis ctx, then exercises:
 *   - apply() wiring: prefix route registration + effect disposers
 *   - schema migration on first boot (persisted dataDir under a temp DSH_HOME)
 *   - REST: board/revision, create/update/move/archive/restore/delete,
 *     validation errors, 404s, 405s, loopback fence
 *   - subtask checklist: create/patch roundtrip, id minting, whole-list
 *     replacement, validation (blank/51 items/non-boolean/non-uuid)
 *   - fractional ranking (insert before/after neighbours)
 *   - settings: defaults, persistence, restartRequired flag, schema
 *   - dispose → data persists across a fresh runtime (reopen)
 *   - in-memory runtime (dataDir '') boots and queries
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { apply, TASKS_API } from './index.js';
import { createTasksRuntime } from './db';
import { loadSettingsFile, tasksSettingsPath } from './settings';
import type { TasksHostContext, WebRoute } from './types.js';

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const tmpRoot = mkdtempSync(join(tmpdir(), 'dsh-tasks-test-'));
process.env.DSH_HOME = tmpRoot;

// ── mock ctx / req / res ───────────────────────────────────────────────────

interface Harness {
  routes: Map<string, WebRoute>;
  disposers: Array<() => void>;
}

function makeCtx(): { ctx: TasksHostContext; harness: Harness } {
  const routes = new Map<string, WebRoute>();
  const disposers: Array<() => void> = [];
  const ctx: TasksHostContext = {
    effect(fn: () => unknown, _label?: string): unknown {
      const result = fn();
      if (typeof result === 'function') disposers.push(result as () => void);
      return undefined;
    },
    webServer: {
      register(route: WebRoute, _label?: string): unknown {
        routes.set(`${route.kind}:${route.path}`, route);
        return () => routes.delete(`${route.kind}:${route.path}`);
      },
    },
  };
  return { ctx, harness: { routes, disposers } };
}

function mockReq(method: string, url: string, body?: unknown, remoteAddress = '127.0.0.1'): IncomingMessage {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    method,
    url,
    headers: { host: '127.0.0.1:13080' },
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  }) as unknown as IncomingMessage;
}

class MockRes {
  statusCode = 200;
  bodyText = '';
  sent = false;
  writeHead(status: number, headers?: Record<string, string>) {
    this.statusCode = status;
    void headers;
  }
  end(body?: string) {
    this.bodyText = body ?? '';
    this.sent = true;
  }
  get headersSent() {
    return this.sent;
  }
}

async function call(
  route: WebRoute,
  method: string,
  path: string,
  body?: unknown,
  remoteAddress?: string,
): Promise<{ status: number; body: Record<string, any> }> {
  const res = new MockRes();
  await route.handler(mockReq(method, path, body, remoteAddress), res as unknown as ServerResponse);
  let parsed: Record<string, any> = {};
  try {
    parsed = JSON.parse(res.bodyText) as Record<string, any>;
  } catch {
    parsed = { raw: res.bodyText };
  }
  return { status: res.statusCode, body: parsed };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  // ── wiring ────────────────────────────────────────────────────────────────
  const first = makeCtx();
  apply(first.ctx, {});
  const api = first.harness.routes.get(`prefix:${TASKS_API}`);
  check('apply registers the prefix route', api !== undefined);
  if (api === undefined) throw new Error('missing route');
  check('apply registers one route only', first.harness.routes.size === 1);
  check('effect disposer captured', first.harness.disposers.length === 1);

  // ── fresh board ───────────────────────────────────────────────────────────
  const empty = await call(api, 'GET', `${TASKS_API}/board`);
  check('fresh board is empty with revision 0', empty.status === 200 && empty.body.revision === 0 && Array.isArray(empty.body.tasks) && (empty.body.tasks as unknown[]).length === 0, JSON.stringify(empty.body));

  // ── create ────────────────────────────────────────────────────────────────
  const a = await call(api, 'POST', `${TASKS_API}/cards`, { title: '写周报' });
  const cardA = a.body.card as Record<string, any>;
  check('create with defaults', a.status === 200 && cardA.title === '写周报' && cardA.status === 'todo' && cardA.priority === 'medium' && cardA.rank === 1024 && cardA.dueAt === null && cardA.body === '' && cardA.completedAt === null, JSON.stringify(a.body));

  const b = await call(api, 'POST', `${TASKS_API}/cards`, { title: '修登录 bug', status: 'done', priority: 'high', due_at: '2026-09-10', body: '复现步骤见文档' });
  const cardB = b.body.card as Record<string, any>;
  check('create with all fields', b.status === 200 && cardB.status === 'done' && cardB.priority === 'high' && cardB.dueAt === '2026-09-10' && typeof cardB.completedAt === 'number', JSON.stringify(b.body));

  const badTitle = await call(api, 'POST', `${TASKS_API}/cards`, { title: '' });
  check('empty title → 400 VALIDATION_ERROR', badTitle.status === 400 && badTitle.body.code === 'VALIDATION_ERROR');

  const badStatus = await call(api, 'POST', `${TASKS_API}/cards`, { title: 'x', status: 'bogus' });
  check('invalid status → 400 VALIDATION_ERROR', badStatus.status === 400 && badStatus.body.code === 'VALIDATION_ERROR');

  const afterCreate = await call(api, 'GET', `${TASKS_API}/board`);
  const created = afterCreate.body.tasks as Array<Record<string, unknown>>;
  check('board lists 2 cards, revision 2', afterCreate.status === 200 && afterCreate.body.revision === 2 && created.length === 2, JSON.stringify({ revision: afterCreate.body.revision, count: created.length }));

  // ── update ────────────────────────────────────────────────────────────────
  const updated = await call(api, 'PATCH', `${TASKS_API}/cards/${cardA.id}`, { title: '写周报 v2', priority: 'high' });
  const cardA2 = updated.body.card as Record<string, any>;
  check('patch updates fields', updated.status === 200 && cardA2.title === '写周报 v2' && cardA2.priority === 'high' && cardA2.status === 'todo' && cardA2.body === '', JSON.stringify(updated.body));

  const missing = await call(api, 'PATCH', `${TASKS_API}/cards/does-not-exist`, { title: 'x' });
  check('patch unknown card → 404 TASK_NOT_FOUND', missing.status === 404 && missing.body.code === 'TASK_NOT_FOUND');

  // ── subtask checklist ─────────────────────────────────────────────────────
  check('create without todos → empty list', Array.isArray(cardA.todos) && cardA.todos.length === 0, JSON.stringify(cardA.todos));

  const withTodos = await call(api, 'POST', `${TASKS_API}/cards`, {
    title: '带子任务',
    todos: [
      { content: '拆需求', done: false },
      { id: '00000000-0000-4000-8000-000000000001', content: '写代码', done: true },
    ],
  });
  const todoCard = withTodos.body.card as Record<string, any>;
  check(
    'create with todos roundtrips + mints ids',
    withTodos.status === 200 &&
      Array.isArray(todoCard.todos) &&
      todoCard.todos.length === 2 &&
      typeof todoCard.todos[0].id === 'string' &&
      todoCard.todos[0].content === '拆需求' &&
      todoCard.todos[0].done === false &&
      todoCard.todos[1].content === '写代码' &&
      todoCard.todos[1].done === true,
    JSON.stringify(todoCard.todos),
  );
  check('provided uuid id is kept', todoCard.todos[1].id === '00000000-0000-4000-8000-000000000001', todoCard.todos[1].id);

  const toggled = await call(api, 'PATCH', `${TASKS_API}/cards/${todoCard.id}`, {
    todos: [{ id: todoCard.todos[0].id, content: '拆需求', done: true }],
  });
  const toggledCard = toggled.body.card as Record<string, any>;
  check(
    'patch todos replaces the whole list',
    toggled.status === 200 && toggledCard.todos.length === 1 && toggledCard.todos[0].done === true,
    JSON.stringify(toggled.body),
  );

  const patchNoTodos = await call(api, 'PATCH', `${TASKS_API}/cards/${todoCard.id}`, { title: '改标题不动子任务' });
  const keepCard = patchNoTodos.body.card as Record<string, any>;
  check(
    'patch without todos keeps the list',
    keepCard.title === '改标题不动子任务' && keepCard.todos.length === 1 && keepCard.todos[0].done === true,
    JSON.stringify(patchNoTodos.body),
  );

  const cleared = await call(api, 'PATCH', `${TASKS_API}/cards/${todoCard.id}`, { todos: [] });
  check('patch todos: [] clears the list', (cleared.body.card as Record<string, any>).todos.length === 0);

  const blankContent = await call(api, 'PATCH', `${TASKS_API}/cards/${todoCard.id}`, { todos: [{ content: '   ', done: false }] });
  check('blank todo content → 400', blankContent.status === 400 && blankContent.body.code === 'VALIDATION_ERROR');

  const tooMany = await call(api, 'PATCH', `${TASKS_API}/cards/${todoCard.id}`, {
    todos: Array.from({ length: 51 }, (_, index) => ({ content: `t${index}`, done: false })),
  });
  check('51 todos → 400', tooMany.status === 400 && tooMany.body.code === 'VALIDATION_ERROR');

  const badDone = await call(api, 'PATCH', `${TASKS_API}/cards/${todoCard.id}`, { todos: [{ content: 'x', done: 'yes' }] });
  check('non-boolean done → 400', badDone.status === 400 && badDone.body.code === 'VALIDATION_ERROR');

  const badId = await call(api, 'PATCH', `${TASKS_API}/cards/${todoCard.id}`, { todos: [{ id: 'not-a-uuid', content: 'x', done: false }] });
  check('non-uuid id → 400', badId.status === 400 && badId.body.code === 'VALIDATION_ERROR');

  // ── move + fractional ranking ─────────────────────────────────────────────
  const moved = await call(api, 'POST', `${TASKS_API}/cards/${cardA.id}/move`, { status: 'in_progress' });
  const cardA3 = moved.body.card as Record<string, any>;
  check('move into empty column appends', moved.status === 200 && cardA3.status === 'in_progress' && cardA3.rank === 1024 && cardA3.completedAt === null, JSON.stringify(moved.body));

  const done = await call(api, 'POST', `${TASKS_API}/cards/${cardA.id}/move`, { status: 'done' });
  const cardA4 = done.body.card as Record<string, any>;
  check('move to done stamps completedAt', done.status === 200 && cardA4.status === 'done' && typeof cardA4.completedAt === 'number', JSON.stringify(done.body));

  const c = await call(api, 'POST', `${TASKS_API}/cards`, { title: 'C' });
  const d = await call(api, 'POST', `${TASKS_API}/cards`, { title: 'D' });
  const cardC = c.body.card as Record<string, any>;
  const cardD = d.body.card as Record<string, any>;
  check('column ranks grow by 1024', cardD.rank === cardC.rank + 1024, JSON.stringify({ c: cardC.rank, d: cardD.rank }));

  const beforeC = await call(api, 'POST', `${TASKS_API}/cards/${cardA.id}/move`, { status: 'todo', before_id: cardC.id });
  const cardA5 = beforeC.body.card as Record<string, any>;
  check('move before a card lands strictly before it', beforeC.status === 200 && cardA5.status === 'todo' && cardA5.rank < cardC.rank, JSON.stringify(beforeC.body));

  const afterD = await call(api, 'POST', `${TASKS_API}/cards/${cardA.id}/move`, { status: 'todo', after_id: cardD.id });
  const cardA6 = afterD.body.card as Record<string, any>;
  check('move after last card appends', afterD.status === 200 && cardA6.rank > cardD.rank, JSON.stringify(afterD.body));

  const between = await call(api, 'POST', `${TASKS_API}/cards/${cardA.id}/move`, { status: 'todo', after_id: cardC.id });
  const cardA7 = between.body.card as Record<string, any>;
  check('move between neighbours lands strictly between', between.status === 200 && cardA7.rank > cardC.rank && cardA7.rank < cardD.rank, JSON.stringify(between.body));

  const wrongColumn = await call(api, 'POST', `${TASKS_API}/cards/${cardA.id}/move`, { status: 'done', before_id: cardC.id });
  check('target not in column → 400', wrongColumn.status === 400 && wrongColumn.body.code === 'TARGET_NOT_IN_COLUMN', JSON.stringify(wrongColumn.body));

  // ── archive / restore / delete ────────────────────────────────────────────
  const archived = await call(api, 'POST', `${TASKS_API}/cards/${cardC.id}/archive`);
  check('archive returns the card', archived.status === 200 && (archived.body.card as Record<string, any>).id === cardC.id);
  const withoutC = await call(api, 'GET', `${TASKS_API}/board`);
  const afterArchive = withoutC.body.tasks as Array<Record<string, unknown>>;
  check('archived card leaves the board', !afterArchive.some(t => t.id === cardC.id), JSON.stringify(withoutC.body));

  const restored = await call(api, 'POST', `${TASKS_API}/cards/${cardC.id}/restore`);
  const cardC2 = restored.body.card as Record<string, any>;
  check('restore re-appends the card', restored.status === 200 && cardC2.id === cardC.id && cardC2.rank > cardD.rank, JSON.stringify(restored.body));

  const deleted = await call(api, 'DELETE', `${TASKS_API}/cards/${cardD.id}`);
  check('delete succeeds', deleted.status === 200 && deleted.body.ok === true);
  const withoutD = await call(api, 'GET', `${TASKS_API}/board`);
  const afterDelete = withoutD.body.tasks as Array<Record<string, unknown>>;
  check('deleted card is gone', !afterDelete.some(t => t.id === cardD.id), JSON.stringify(withoutD.body));

  // ── revision channel ──────────────────────────────────────────────────────
  const revision = await call(api, 'GET', `${TASKS_API}/revision`);
  const boardNow = await call(api, 'GET', `${TASKS_API}/board`);
  check('revision endpoint matches board', revision.body.revision === boardNow.body.revision, JSON.stringify({ revision: revision.body.revision, board: boardNow.body.revision }));

  // ── fence + method guard ──────────────────────────────────────────────────
  const remote = await call(api, 'GET', `${TASKS_API}/board`, undefined, '8.8.8.8');
  check('non-loopback remote → 403', remote.status === 403 && remote.body.code === 'FORBIDDEN');
  const wrongMethod = await call(api, 'GET', `${TASKS_API}/cards`);
  check('GET /cards → 405', wrongMethod.status === 405 && wrongMethod.body.code === 'METHOD_NOT_ALLOWED');

  // ── persistence across a fresh runtime (reopen) ───────────────────────────
  // Runs BEFORE the settings tests: once settings.json points dataDir at a
  // different directory, a fresh apply must boot there, so the reopen check
  // has to use the still-default directory.
  const before = await call(api, 'GET', `${TASKS_API}/board`);
  const persistedCard = await call(api, 'POST', `${TASKS_API}/cards`, {
    title: '重启后还在',
    todos: [{ content: '跨重启子任务', done: true }],
  });
  const persistedId = (persistedCard.body.card as Record<string, any>).id;
  check('card persisted before dispose', persistedCard.status === 200);

  for (const dispose of first.harness.disposers) dispose();
  await sleep(150); // let the async PGlite.close() settle before reopening

  const second = makeCtx();
  apply(second.ctx, {});
  const api2 = second.harness.routes.get(`prefix:${TASKS_API}`);
  check('second apply registers its route', api2 !== undefined);
  if (api2 === undefined) throw new Error('missing second route');
  const reopened = await call(api2, 'GET', `${TASKS_API}/board`);
  const reopenedTasks = reopened.body.tasks as Array<Record<string, unknown>>;
  check('data survives dispose + reopen', reopened.status === 200 && reopenedTasks.some(t => t.id === persistedId), JSON.stringify({ count: reopenedTasks.length, revision: reopened.body.revision }));
  const reopenedCard = reopenedTasks.find(t => t.id === persistedId) as Record<string, any> | undefined;
  check(
    'subtasks survive dispose + reopen',
    reopenedCard !== undefined && Array.isArray(reopenedCard.todos) && reopenedCard.todos.length === 1 && reopenedCard.todos[0].content === '跨重启子任务' && reopenedCard.todos[0].done === true,
    JSON.stringify(reopenedCard?.todos),
  );
  check('revision continues across reopen', reopened.body.revision === before.body.revision + 1, JSON.stringify({ before: before.body.revision, reopened: reopened.body.revision }));

  // ── settings (against the second host — settings routes need no runtime) ──
  const settings = await call(api2, 'GET', `${TASKS_API}/settings`);
  const settingsDefaults = settings.body.defaults as Record<string, any>;
  check('settings defaults derive from DSH_HOME', settings.status === 200 && settingsDefaults.dataDir === join(tmpRoot, 'tasks', 'db') && settings.body.settings === null, JSON.stringify(settings.body));

  const customDir = join(tmpRoot, 'custom-db');
  const saveCustom = await call(api2, 'POST', `${TASKS_API}/settings`, { data_dir: customDir });
  check('changing dataDir flags restartRequired', saveCustom.status === 200 && saveCustom.body.ok === true && saveCustom.body.restartRequired === true, JSON.stringify(saveCustom.body));
  check('settings.json persisted with normalized path', existsSync(tasksSettingsPath()) && loadSettingsFile()?.dataDir === customDir, loadSettingsFile()?.dataDir ?? 'missing');

  const saveSame = await call(api2, 'POST', `${TASKS_API}/settings`, { data_dir: customDir });
  check('same dataDir → restartRequired false', saveSame.status === 200 && saveSame.body.restartRequired === false, JSON.stringify(saveSame.body));

  const emptyDir = await call(api2, 'POST', `${TASKS_API}/settings`, { data_dir: '' });
  check('empty dataDir → 400 VALIDATION_ERROR', emptyDir.status === 400 && emptyDir.body.code === 'VALIDATION_ERROR');

  const onDisk = JSON.parse(readFileSync(tasksSettingsPath(), 'utf8')) as Record<string, any>;
  check('settings file shape { version: 1, dataDir }', onDisk.version === 1 && onDisk.dataDir === customDir);

  // ── in-memory runtime (tests-only dataDir) ────────────────────────────────
  // PGlite's WASM module declares 2048 memory pages minimum (= 128 MB), so
  // anything below 128 MB fails instantiation.
  const memoryRuntime = createTasksRuntime({ dataDir: '', initialMemoryBytes: 128 * 1024 * 1024 });
  const rows = await memoryRuntime.query<{ one: number }>(`SELECT 1 AS one`);
  check('in-memory runtime boots and queries', rows.rows.length === 1 && rows.rows[0].one === 1);
  memoryRuntime.dispose();

  // cleanup
  for (const dispose of second.harness.disposers) dispose();
  await sleep(150);
  rmSync(tmpRoot, { recursive: true, force: true });

  const failed = results.filter(result => !result.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed === 0 ? 0 : 1;
}

void main().catch(error => {
  console.error('tasks test crashed:', error);
  process.exitCode = 1;
});

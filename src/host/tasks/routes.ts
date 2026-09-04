/**
 * Task-board REST routes, mounted on the shared ctx.webServer under
 * `/dsh-unknownue-plugins/tasks/api`, loopback-fenced like every other route
 * in this bundle. Personal board — no agent surface, no session involvement:
 *
 *   GET    /board                  → { revision, tasks }
 *   GET    /revision               → { revision }            (light poll)
 *   POST   /cards                  → create card
 *   PATCH  /cards/:id              → update card fields
 *   POST   /cards/:id/move         → { status, before_id?, after_id? }
 *   POST   /cards/:id/archive      → archive
 *   POST   /cards/:id/restore      → restore
 *   DELETE /cards/:id              → permanent delete
 *   GET    /settings               → current settings view
 *   POST   /settings               → { data_dir } — persists; path change flags restartRequired
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { isLoopback, isLoopbackHost, json, messageOf, readBody } from '../makefile';
import type { TasksRuntime } from './db';
import {
  archiveCard,
  createCard,
  deleteCard,
  listBoard,
  moveCard,
  readRevision,
  restoreCard,
  updateCard,
} from './store';
import type {
  TaskPriority,
  TaskStatus,
  TasksConfig,
  TasksSettingsFile,
  TasksSettingsInput,
  TasksSettingsView,
  WebServer,
} from './types';

export const TASKS_API = '/dsh-unknownue-plugins/tasks/api';

const statusSchema = z.enum(['todo', 'in_progress', 'blocked', 'done']);
const prioritySchema = z.enum(['low', 'medium', 'high']);
/** Local wall time: all-day `YYYY-MM-DD` or minute-precise `YYYY-MM-DDTHH:mm`. */
const dueTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/, 'due time must be YYYY-MM-DD or YYYY-MM-DDTHH:mm');
const dueSchema = z
  .union([
    z.object({ kind: z.literal('point'), at: dueTimeSchema }).strict(),
    z
      .object({ kind: z.literal('range'), start: dueTimeSchema, end: dueTimeSchema })
      .strict()
      .refine(value => value.start <= value.end, { message: 'range start must not be after end' }),
  ])
  .nullable();
const todoSchema = z.object({
  id: z.string().uuid().optional(),
  content: z.string().trim().min(1).max(200),
  done: z.boolean(),
});
const todosSchema = z.array(todoSchema).max(50);

const createSchema = z
  .object({
    title: z.string().min(1).max(500),
    body: z.string().max(50000).optional(),
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
    due: dueSchema.optional(),
    todos: todosSchema.optional(),
  })
  .strict();

const updateSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    body: z.string().max(50000).optional(),
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
    due: dueSchema.optional(),
    todos: todosSchema.optional(),
  })
  .strict();

const moveSchema = z
  .object({
    status: statusSchema,
    before_id: z.string().min(1).max(64).nullable().optional(),
    after_id: z.string().min(1).max(64).nullable().optional(),
  })
  .strict();

const settingsSchema = z.object({ data_dir: z.string().min(1).max(1024) }).strict();

const idSchema = z.string().min(1).max(64);

/** The slice of the host plugin the routes need. */
export interface TasksHost {
  ensureStarted(): Promise<TasksRuntime>;
  state: { restartRequired: boolean; settingsPath: string };
  row: TasksConfig;
  file(): TasksSettingsFile | null;
  save(input: TasksSettingsInput): Promise<{ ok: boolean; restartRequired: boolean; error?: string }>;
}

interface ErrorLike {
  code?: unknown;
}

function statusOf(error: unknown): number {
  const code = (error as ErrorLike).code;
  if (code === 'TASK_NOT_FOUND') return 404;
  if (code === 'TARGET_NOT_IN_COLUMN') return 400;
  return 500;
}

export function registerRoutes(webServer: WebServer, host: TasksHost): void {
  const wrap =
    (handler: (req: IncomingMessage, res: ServerResponse) => unknown | Promise<unknown>) =>
    async (req: IncomingMessage, res: ServerResponse) => {
      if (!isLoopback(req.socket.remoteAddress) || !isLoopbackHost(req.headers.host)) {
        json(res, 403, { code: 'FORBIDDEN', message: 'loopback-only' });
        return;
      }
      try {
        await handler(req, res);
      } catch (error) {
        if (error instanceof z.ZodError) {
          json(res, 400, { code: 'VALIDATION_ERROR', message: error.issues.map(issue => issue.message).join('; ') });
          return;
        }
        if (!res.headersSent) {
          json(res, statusOf(error), { code: (error as ErrorLike).code ?? 'INTERNAL_ERROR', message: messageOf(error) });
        }
      }
    };

  webServer.register(
    {
      kind: 'prefix',
      path: TASKS_API,
      handler: wrap(async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        const rest = url.pathname.slice(TASKS_API.length).replace(/^\//, '').split('/').filter(Boolean);
        const method = req.method ?? 'GET';

        // ── /board, /revision ──────────────────────────────────────────────
        if (rest.length === 1 && (rest[0] === 'board' || rest[0] === 'revision')) {
          if (method !== 'GET') return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
          const runtime = await host.ensureStarted();
          if (rest[0] === 'revision') return json(res, 200, { revision: await readRevision(runtime) });
          const includeArchived = url.searchParams.get('archived') === '1';
          return json(res, 200, { revision: await readRevision(runtime), tasks: await listBoard(runtime, includeArchived) });
        }

        // ── /cards ────────────────────────────────────────────────────────
        if (rest.length >= 1 && rest[0] === 'cards') {
          if (rest.length === 1) {
            if (method !== 'POST') return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
            const input = createSchema.parse(await readBody(req));
            const runtime = await host.ensureStarted();
            const card = await createCard(runtime, {
              title: input.title,
              body: input.body,
              status: input.status as TaskStatus | undefined,
              priority: input.priority as TaskPriority | undefined,
              due: input.due,
              todos: input.todos,
            });
            return json(res, 200, { card });
          }

          const id = idSchema.parse(rest[1]);
          const runtime = await host.ensureStarted();

          if (rest.length === 2) {
            if (method === 'PATCH') {
              const input = updateSchema.parse(await readBody(req));
              const card = await updateCard(runtime, id, {
                title: input.title,
                body: input.body,
                status: input.status as TaskStatus | undefined,
                priority: input.priority as TaskPriority | undefined,
                due: input.due,
                todos: input.todos,
              });
              return json(res, 200, { card });
            }
            if (method === 'DELETE') {
              await deleteCard(runtime, id);
              return json(res, 200, { ok: true });
            }
            return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
          }

          if (rest.length === 3 && method === 'POST') {
            if (rest[2] === 'move') {
              const input = moveSchema.parse(await readBody(req));
              const card = await moveCard(runtime, id, {
                status: input.status as TaskStatus,
                beforeId: input.before_id,
                afterId: input.after_id,
              });
              return json(res, 200, { card });
            }
            if (rest[2] === 'archive') return json(res, 200, { card: await archiveCard(runtime, id) });
            if (rest[2] === 'restore') return json(res, 200, { card: await restoreCard(runtime, id) });
          }

          return json(res, 404, { code: 'NOT_FOUND', message: 'route not found' });
        }

        // ── /settings (available before first use — that is the point) ────
        if (rest.length === 1 && rest[0] === 'settings') {
          if (method === 'GET') {
            const view: TasksSettingsView = {
              restartRequired: host.state.restartRequired,
              settingsPath: host.state.settingsPath,
              defaults: host.row,
              settings: host.file(),
            };
            return json(res, 200, view);
          }
          if (method === 'POST') {
            const input = settingsSchema.parse(await readBody(req));
            const result = await host.save({ dataDir: input.data_dir });
            if (!result.ok) return json(res, 400, { code: 'SETTINGS_INVALID', message: result.error ?? 'settings save failed' });
            return json(res, 200, result);
          }
          return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
        }

        return json(res, 404, { code: 'NOT_FOUND', message: 'route not found' });
      }),
    },
    'dsh-unknownue-plugins/tasks: api',
  );
}

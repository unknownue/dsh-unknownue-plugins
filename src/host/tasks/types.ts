/**
 * Task-board host types — the feature's own contracts.
 *
 * The board is PERSONAL and user-maintained: there are no model-facing tools,
 * no session-log events, and no agent services. The only DSH seams consumed
 * are `ctx.webServer` (loopback REST routes) and `ctx.effect` (lifecycle),
 * exactly like the makefile/explorer features.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Kanban column key (also the task status stored in the database). */
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high';

export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];
export const TASK_PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high'];

/** One checkable subtask of a card (id minted host-side when absent). */
export interface TaskTodo {
  id: string;
  content: string;
  done: boolean;
}

/**
 * Optional due date: either a single deadline moment or a task time range.
 * Time strings are local wall time: `YYYY-MM-DD` (all-day) or
 * `YYYY-MM-DDTHH:mm`.
 */
export type TaskDue =
  | { kind: 'point'; at: string }
  | { kind: 'range'; start: string; end: string };

/** Public card DTO (camelCase; the wire API uses snake_case, paperspace-style). */
export interface TaskCard {
  id: string;
  title: string;
  body: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Optional due date (single moment or range); null when unset. */
  due: TaskDue | null;
  /** Fractional rank inside its status column (larger = further down). */
  rank: number;
  archived: boolean;
  /** Checkable subtask checklist; empty when the card has none. */
  todos: TaskTodo[];
  /** User-assigned tags (0..20, trimmed + deduped); colors derive from the name hash on the client. */
  tags: string[];
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

/** Effective runtime config: where the PGlite database lives + WASM heap. */
export interface TasksConfig {
  /** Absolute directory PGlite persists into ('' = in-memory, tests only). */
  dataDir: string;
  /** WASM initial heap size in bytes. */
  initialMemoryBytes: number;
}

/** Row config from cordis.patch.yml (all fields optional). */
export interface PartialTasksConfig {
  dataDir?: string;
  initialMemoryBytes?: number;
}

/** Persisted `<dsh home>/tasks/settings.json`. */
export interface TasksSettingsFile {
  version: 1;
  dataDir: string;
}

export interface TasksSettingsInput {
  dataDir: string;
}

// ── DSH seams (minimal honest contracts, same approach as src/host/types.ts) ─

export type WebRoute = {
  kind: 'exact' | 'prefix';
  path: string;
  handler: (req: IncomingMessage, res: ServerResponse) => unknown;
};

export interface WebServer {
  register(route: WebRoute, label?: string): unknown;
}

export interface TasksHostContext {
  effect(fn: () => unknown, label?: string): unknown;
  webServer: WebServer;
}

/** Settings view served to the browser settings page. */
export interface TasksSettingsView {
  restartRequired: boolean;
  settingsPath: string;
  defaults: TasksConfig;
  settings: TasksSettingsFile | null;
}

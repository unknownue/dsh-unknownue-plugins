/**
 * Task-board API base for the browser half (same origin as the DSH web app).
 * Wire payloads use snake_case (paperspace convention); DTOs are camelCase.
 */

export const TASKS_API = '/dsh-unknownue-plugins/tasks/api';

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];

/** One checkable subtask (id may be '' for not-yet-created draft items). */
export interface TaskTodo {
  id: string;
  content: string;
  done: boolean;
}

/** Subtask as sent on the wire: id omitted for new items (host mints it). */
export interface TaskTodoInput {
  id?: string;
  content: string;
  done: boolean;
}

/**
 * Optional due date: a single deadline moment or a task time range.
 * Local wall time: `YYYY-MM-DD` (all-day) or `YYYY-MM-DDTHH:mm`.
 */
export type TaskDue = { kind: 'point'; at: string } | { kind: 'range'; start: string; end: string };

export interface TaskCard {
  id: string;
  title: string;
  body: string;
  status: TaskStatus;
  priority: TaskPriority;
  due: TaskDue | null;
  rank: number;
  archived: boolean;
  todos: TaskTodo[];
  /** User-assigned tags; chip colors derive from the name hash client-side. */
  tags: string[];
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface Board {
  revision: number;
  tasks: TaskCard[];
}

export interface TasksSettingsFile {
  version: number;
  dataDir: string;
}

export interface TasksSettingsView {
  restartRequired: boolean;
  settingsPath: string;
  defaults: { dataDir: string; initialMemoryBytes: number };
  settings: TasksSettingsFile | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${TASKS_API}${path}`, {
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  const body = (await response.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!response.ok) {
    throw new Error(body?.message ?? `HTTP ${response.status}`);
  }
  return body as T;
}

export function fetchBoard(includeArchived = false): Promise<Board> {
  return request<Board>(`/board${includeArchived ? '?archived=1' : ''}`);
}

export function fetchRevision(): Promise<{ revision: number }> {
  return request<{ revision: number }>('/revision');
}

export function createCard(input: {
  title: string;
  body?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due?: TaskDue | null;
  todos?: TaskTodoInput[];
  tags?: string[];
}): Promise<{ card: TaskCard }> {
  return request<{ card: TaskCard }>('/cards', { method: 'POST', body: JSON.stringify(input) });
}

export function updateCard(
  id: string,
  patch: {
    title?: string;
    body?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    due?: TaskDue | null;
    todos?: TaskTodoInput[];
    tags?: string[];
  },
): Promise<{ card: TaskCard }> {
  return request<{ card: TaskCard }>(`/cards/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function moveCard(id: string, move: { status: TaskStatus; before_id?: string | null; after_id?: string | null }): Promise<{ card: TaskCard }> {
  return request<{ card: TaskCard }>(`/cards/${encodeURIComponent(id)}/move`, { method: 'POST', body: JSON.stringify(move) });
}

export function archiveCard(id: string): Promise<{ card: TaskCard }> {
  return request<{ card: TaskCard }>(`/cards/${encodeURIComponent(id)}/archive`, { method: 'POST' });
}

export function restoreCard(id: string): Promise<{ card: TaskCard }> {
  return request<{ card: TaskCard }>(`/cards/${encodeURIComponent(id)}/restore`, { method: 'POST' });
}

export function deleteCard(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/cards/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function fetchTasksSettings(): Promise<TasksSettingsView> {
  return request<TasksSettingsView>('/settings');
}

export function saveTasksSettings(input: { data_dir: string }): Promise<{ ok: boolean; restartRequired?: boolean }> {
  return request<{ ok: boolean; restartRequired?: boolean }>('/settings', { method: 'POST', body: JSON.stringify(input) });
}

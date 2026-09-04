/**
 * Task-board data layer over the TasksRuntime. Every mutation bumps
 * `meta.revision` so polling clients can refetch cheaply.
 *
 * Fractional ranking: cards inside one status column are ordered by `rank`.
 * Appending takes `max + 1024`; inserting before/after a neighbour takes the
 * midpoint, so a reorder writes exactly one row.
 */
import { randomUUID } from 'node:crypto';
import type { TasksRuntime } from './db';
import type { TaskCard, TaskDue, TaskPriority, TaskStatus, TaskTodo } from './types';

interface TaskRow {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  due_at: string | null;
  due_until: string | null;
  rank: number;
  archived: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  todos: string;
  tags: string;
}

const RANK_STEP = 1024;

const COLUMNS =
  'id, title, body, status, priority, due_at, due_until, rank, archived, created_at, updated_at, completed_at, todos, tags';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parse the stored todos JSON; the durable boundary never trusts the column. */
function parseTodos(text: string | null | undefined): TaskTodo[] {
  if (typeof text !== 'string' || text === '') return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      if (item === null || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      if (typeof record.id !== 'string' || !UUID_PATTERN.test(record.id)) return [];
      if (typeof record.content !== 'string' || record.content === '') return [];
      if (typeof record.done !== 'boolean') return [];
      return [{ id: record.id, content: record.content, done: record.done }];
    });
  } catch {
    return [];
  }
}

/** One subtask as accepted from the wire (id absent → host mints it). */
export interface TodoInput {
  id?: string;
  content: string;
  done: boolean;
}

/** Trim contents and mint ids for items that came without one. */
export function normalizeTodos(items: readonly TodoInput[]): TaskTodo[] {
  return items.map(item => ({
    id: typeof item.id === 'string' && UUID_PATTERN.test(item.id) ? item.id : randomUUID(),
    content: item.content.trim(),
    done: item.done,
  }));
}

/** Parse the stored tags JSON; the durable boundary never trusts the column. */
function parseTags(text: string | null | undefined): string[] {
  if (typeof text !== 'string' || text === '') return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item !== '').slice(0, 20);
  } catch {
    return [];
  }
}

/** Trim, drop empties, dedupe (exact match) and cap the tag list. */
export function normalizeTags(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const tag = raw.trim();
    if (tag === '' || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 20) break;
  }
  return out;
}

/** Flatten the wire due union onto the two columns (null → both null). */
function flattenDue(due: TaskDue | null): { due_at: string | null; due_until: string | null } {
  if (due === null) return { due_at: null, due_until: null };
  return due.kind === 'point'
    ? { due_at: due.at, due_until: null }
    : { due_at: due.start, due_until: due.end };
}

/** Rebuild the union from the columns; the durable boundary validates shape. */
function dueOf(row: TaskRow): TaskDue | null {
  if (typeof row.due_at !== 'string' || row.due_at === '') return null;
  if (typeof row.due_until === 'string' && row.due_until !== '') {
    return { kind: 'range', start: row.due_at, end: row.due_until };
  }
  return { kind: 'point', at: row.due_at };
}

function toCard(row: TaskRow): TaskCard {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    due: dueOf(row),
    rank: row.rank,
    archived: row.archived === 1,
    todos: parseTodos(row.todos),
    tags: parseTags(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function taskError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

async function bumpRevision(runtime: TasksRuntime): Promise<void> {
  await runtime.query(`UPDATE meta SET value = CAST(value AS BIGINT) + 1 WHERE key = 'revision'`);
}

export async function readRevision(runtime: TasksRuntime): Promise<number> {
  const rows = await runtime.query<{ value: string }>(`SELECT value FROM meta WHERE key = 'revision'`);
  const value = rows.rows[0]?.value;
  return typeof value === 'string' ? Number(value) || 0 : 0;
}

export async function listBoard(runtime: TasksRuntime, includeArchived = false): Promise<TaskCard[]> {
  const rows = await runtime.query<TaskRow>(
    `SELECT ${COLUMNS} FROM tasks WHERE archived = 0 OR $1 = 1 ORDER BY status, rank, created_at`,
    [includeArchived ? 1 : 0],
  );
  return rows.rows.map(toCard);
}

async function findRow(runtime: TasksRuntime, id: string): Promise<TaskRow | null> {
  const rows = await runtime.query<TaskRow>(`SELECT ${COLUMNS} FROM tasks WHERE id = $1 LIMIT 1`, [id]);
  return rows.rows[0] ?? null;
}

export async function findCard(runtime: TasksRuntime, id: string): Promise<TaskCard | null> {
  const row = await findRow(runtime, id);
  return row === null ? null : toCard(row);
}

async function columnMaxRank(runtime: TasksRuntime, status: TaskStatus): Promise<number> {
  const rows = await runtime.query<{ max: number | null }>(
    `SELECT MAX(rank) AS max FROM tasks WHERE archived = 0 AND status = $1`,
    [status],
  );
  return rows.rows[0]?.max ?? 0;
}

export interface CreateCardInput {
  title: string;
  body?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due?: TaskDue | null;
  todos?: TodoInput[];
  tags?: string[];
}

export async function createCard(runtime: TasksRuntime, input: CreateCardInput): Promise<TaskCard> {
  const now = Date.now();
  const status = input.status ?? 'todo';
  const rank = (await columnMaxRank(runtime, status)) + RANK_STEP;
  const id = randomUUID();
  const completedAt = status === 'done' ? now : null;
  const todos = input.todos !== undefined ? JSON.stringify(normalizeTodos(input.todos)) : '[]';
  const tags = input.tags !== undefined ? JSON.stringify(normalizeTags(input.tags)) : '[]';
  const due = flattenDue(input.due ?? null);
  await runtime.query(
    `INSERT INTO tasks (id, title, body, status, priority, due_at, due_until, rank, created_at, updated_at, completed_at, todos, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, $12)`,
    [id, input.title, input.body ?? '', status, input.priority ?? 'medium', due.due_at, due.due_until, rank, now, completedAt, todos, tags],
  );
  await bumpRevision(runtime);
  const card = await findCard(runtime, id);
  if (card === null) throw taskError('TASK_NOT_FOUND', `task ${id} vanished after create`);
  return card;
}

export interface UpdateCardPatch {
  title?: string;
  body?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  /** Absent → keep; null → clear; value → set (single moment or range). */
  due?: TaskDue | null;
  /** Whole-checklist replacement; absent → keep the current list. */
  todos?: TodoInput[];
  /** Whole-tag-list replacement; absent → keep the current list. */
  tags?: string[];
}

/** Field update; a status change appends the card to the new column. */
export async function updateCard(runtime: TasksRuntime, id: string, patch: UpdateCardPatch): Promise<TaskCard> {
  const current = await findRow(runtime, id);
  if (current === null) throw taskError('TASK_NOT_FOUND', `task ${id} not found`);
  const now = Date.now();

  let status = current.status as TaskStatus;
  let rank = current.rank;
  let completedAt = current.completed_at;
  if (patch.status !== undefined && patch.status !== current.status) {
    status = patch.status;
    rank = (await columnMaxRank(runtime, status)) + RANK_STEP;
    completedAt = status === 'done' ? now : null;
  } else if (status === 'done' && completedAt === null) {
    completedAt = now;
  }

  const todos = patch.todos !== undefined ? JSON.stringify(normalizeTodos(patch.todos)) : null;
  const tags = patch.tags !== undefined ? JSON.stringify(normalizeTags(patch.tags)) : null;
  // Due needs a flag pair (not COALESCE): switching range → point must be able
  // to write NULL into due_until, and clearing writes NULL into both.
  const keepDue = patch.due === undefined;
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
      tags,
    ],
  );
  await bumpRevision(runtime);
  const card = await findCard(runtime, id);
  if (card === null) throw taskError('TASK_NOT_FOUND', `task ${id} vanished after update`);
  return card;
}

export interface MoveCardInput {
  status: TaskStatus;
  /** Insert immediately before this card (same target column). */
  beforeId?: string | null;
  /** Insert immediately after this card (same target column). */
  afterId?: string | null;
}

/** Move a card into a column (append, or exactly before/after a neighbour). */
export async function moveCard(runtime: TasksRuntime, id: string, move: MoveCardInput): Promise<TaskCard> {
  const current = await findRow(runtime, id);
  if (current === null) throw taskError('TASK_NOT_FOUND', `task ${id} not found`);

  const column = await runtime.query<TaskRow>(
    `SELECT ${COLUMNS} FROM tasks WHERE archived = 0 AND status = $1 AND id <> $2 ORDER BY rank, created_at`,
    [move.status, id],
  );
  const cards = column.rows;

  const appendRank = cards.length > 0 ? cards[cards.length - 1].rank + RANK_STEP : RANK_STEP;
  let rank: number;
  if (move.beforeId !== undefined && move.beforeId !== null) {
    const index = cards.findIndex(card => card.id === move.beforeId);
    if (index === -1) throw taskError('TARGET_NOT_IN_COLUMN', `card ${move.beforeId} is not in column ${move.status}`);
    const next = cards[index].rank;
    const prev = index > 0 ? cards[index - 1].rank : null;
    // Degenerate neighbours (equal ranks) fall back to appending at the end.
    rank = prev === null ? next / 2 : next - prev <= 0 ? appendRank : next - (next - prev) / 2;
  } else if (move.afterId !== undefined && move.afterId !== null) {
    const index = cards.findIndex(card => card.id === move.afterId);
    if (index === -1) throw taskError('TARGET_NOT_IN_COLUMN', `card ${move.afterId} is not in column ${move.status}`);
    const prev = cards[index].rank;
    const next = index + 1 < cards.length ? cards[index + 1].rank : null;
    rank = next === null ? prev + RANK_STEP : next - prev <= 0 ? appendRank : prev + (next - prev) / 2;
  } else {
    rank = appendRank;
  }

  const completedAt = move.status === 'done' ? Date.now() : null;
  await runtime.query(
    `UPDATE tasks SET status = $2, rank = $3, completed_at = $4, updated_at = $5 WHERE id = $1`,
    [id, move.status, rank, completedAt, Date.now()],
  );
  await bumpRevision(runtime);
  const card = await findCard(runtime, id);
  if (card === null) throw taskError('TASK_NOT_FOUND', `task ${id} vanished after move`);
  return card;
}

export async function archiveCard(runtime: TasksRuntime, id: string): Promise<TaskCard> {
  const card = await findCard(runtime, id);
  if (card === null) throw taskError('TASK_NOT_FOUND', `task ${id} not found`);
  await runtime.query(`UPDATE tasks SET archived = 1, updated_at = $2 WHERE id = $1`, [id, Date.now()]);
  await bumpRevision(runtime);
  return { ...card, archived: true, updatedAt: Date.now() };
}

export async function restoreCard(runtime: TasksRuntime, id: string): Promise<TaskCard> {
  const current = await findRow(runtime, id);
  if (current === null) throw taskError('TASK_NOT_FOUND', `task ${id} not found`);
  const status = current.status as TaskStatus;
  const rank = (await columnMaxRank(runtime, status)) + RANK_STEP;
  await runtime.query(`UPDATE tasks SET archived = 0, rank = $2, updated_at = $3 WHERE id = $1`, [id, rank, Date.now()]);
  await bumpRevision(runtime);
  const card = await findCard(runtime, id);
  if (card === null) throw taskError('TASK_NOT_FOUND', `task ${id} vanished after restore`);
  return card;
}

export async function deleteCard(runtime: TasksRuntime, id: string): Promise<void> {
  await runtime.query(`DELETE FROM tasks WHERE id = $1`, [id]);
  await bumpRevision(runtime);
}

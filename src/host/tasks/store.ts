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
import type { TaskCard, TaskPriority, TaskStatus } from './types';

interface TaskRow {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  due_at: string | null;
  rank: number;
  archived: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

const RANK_STEP = 1024;

const COLUMNS = 'id, title, body, status, priority, due_at, rank, archived, created_at, updated_at, completed_at';

function toCard(row: TaskRow): TaskCard {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    dueAt: row.due_at,
    rank: row.rank,
    archived: row.archived === 1,
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
  dueAt?: string | null;
}

export async function createCard(runtime: TasksRuntime, input: CreateCardInput): Promise<TaskCard> {
  const now = Date.now();
  const status = input.status ?? 'todo';
  const rank = (await columnMaxRank(runtime, status)) + RANK_STEP;
  const id = randomUUID();
  const completedAt = status === 'done' ? now : null;
  await runtime.query(
    `INSERT INTO tasks (id, title, body, status, priority, due_at, rank, created_at, updated_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)`,
    [id, input.title, input.body ?? '', status, input.priority ?? 'medium', input.dueAt ?? null, rank, now, completedAt],
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
  dueAt?: string | null;
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

  await runtime.query(
    `UPDATE tasks SET title = $2, body = $3, priority = $4, due_at = $5, status = $6, rank = $7,
       completed_at = $8, updated_at = $9 WHERE id = $1`,
    [
      id,
      patch.title ?? current.title,
      patch.body ?? current.body,
      patch.priority ?? current.priority,
      patch.dueAt !== undefined ? patch.dueAt : current.due_at,
      status,
      rank,
      completedAt,
      now,
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

/**
 * Shared pure helpers for the task UI (board view, card editor, archive
 * drawer). No React, no side effects — display formatting and stable
 * tag-color derivation only.
 */
import type { TaskCard, TaskDue, TaskTodo } from './api';

/** Compact display label: `09-10 18:00` / `09-10 14:00 ~ 09-12`. */
export function formatDueLabel(due: TaskDue): string {
  if (due.kind === 'point') return due.at.replace('T', ' ');
  return `${due.start.replace('T', ' ')} ~ ${due.end.replace('T', ' ')}`;
}

export function formatUpdated(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function todoDoneCount(card: TaskCard): number {
  return card.todos.filter(item => item.done).length;
}

/** Unchecked subtasks first (stable within each group). */
export function sortTodosUncheckedFirst(items: readonly TaskTodo[]): TaskTodo[] {
  return [...items].sort((a, b) => Number(a.done) - Number(b.done));
}

/**
 * Fixed tag palette: white text stays readable on every entry in both light
 * and dark themes. The text hash picks an index, so one tag name always gets
 * the same color without any stored color data.
 */
export const TAG_PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#65a30d', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#ec4899', // pink
] as const;

/** Stable hash of the tag text (same value every render/session). */
export function tagHash(name: string): number {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) | 0;
  }
  return Math.abs(hash);
}

/** Tag chip inline style: text hash → fixed palette entry. */
export function tagStyle(name: string): { backgroundColor: string } {
  return { backgroundColor: TAG_PALETTE[tagHash(name) % TAG_PALETTE.length] };
}

/**
 * TasksView — the 任务 tab body: a kanban board (four status columns with
 * drag-and-drop between/within columns) and a dense list view over the same
 * cards, plus the card editor modal.
 *
 * Purely user-maintained: every write goes straight to the host routes, there
 * is no agent interaction. Freshness is revision polling (refetch only when
 * the host's `meta.revision` moved).
 */
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import React from 'react';
import {
  TASK_STATUSES,
  type TaskCard,
  type TaskPriority,
  type TaskStatus,
  type TaskTodo,
  archiveCard,
  createCard,
  deleteCard,
  fetchBoard,
  fetchRevision,
  moveCard,
  restoreCard,
  updateCard,
} from './api';

export type TasksLocale = (key: string) => string;

export interface TasksViewProps {
  t: TasksLocale;
}

const PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high'];
const POLL_MS = 5000;
/** Checklist items shown directly on a board card before folding into +n. */
const CARD_TODO_PREVIEW = 3;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(card: TaskCard): boolean {
  return card.dueAt !== null && card.status !== 'done' && card.dueAt < todayIso();
}

function formatUpdated(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function todoDoneCount(card: TaskCard): number {
  return card.todos.filter(item => item.done).length;
}

export default function TasksView({ t }: TasksViewProps) {
  const [board, setBoard] = useState<TaskCard[]>([]);
  const [revision, setRevision] = useState(-1);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'board' | 'list'>('board');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<TaskCard | 'new' | null>(null);
  const revisionRef = useRef(-1);

  const refresh = useCallback(async (includeArchived?: boolean) => {
    try {
      const next = await fetchBoard(includeArchived ?? false);
      revisionRef.current = next.revision;
      setBoard(next.tasks);
      setRevision(next.revision);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The board view never shows archived cards; the list view can opt in.
  useEffect(() => {
    if (mode === 'list' && showArchived) void refresh(true);
  }, [mode, showArchived, refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      void fetchRevision()
        .then(next => {
          if (next.revision !== revisionRef.current) void refresh(showArchived);
        })
        .catch(() => {
          // poll failures are silent; the next tick retries
        });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh, showArchived]);

  const move = useCallback(
    async (id: string, status: TaskStatus) => {
      try {
        await moveCard(id, { status });
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [refresh],
  );

  /** Toggle one subtask straight from the board card (whole-list replace). */
  const toggleTodo = useCallback(
    async (card: TaskCard, index: number) => {
      try {
        const todos = card.todos.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
        await updateCard(card.id, { todos });
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [refresh],
  );

  const archivedCount = board.filter(card => card.archived).length;
  const visible = mode === 'board' ? board.filter(card => !card.archived) : board;

  return (
    <div className="dsh-tasks">
      <header className="tk-head">
        <div className="tk-modes" role="tablist" aria-label={t('view.label')}>
          <button type="button" className={mode === 'board' ? 'tk-mode tk-mode-on' : 'tk-mode'} onClick={() => setMode('board')}>
            {t('mode.board')}
          </button>
          <button type="button" className={mode === 'list' ? 'tk-mode tk-mode-on' : 'tk-mode'} onClick={() => setMode('list')}>
            {t('mode.list')}
          </button>
        </div>
        {mode === 'list' && (
          <label className="tk-archived-toggle">
            <input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />
            {t('list.showArchived')}
            {archivedCount > 0 ? ` (${archivedCount})` : ''}
          </label>
        )}
        <div className="tk-actions">
          <button type="button" className="tk-btn" onClick={() => void refresh(showArchived)}>
            {t('board.refresh')}
          </button>
          <button type="button" className="tk-btn tk-btn-primary" onClick={() => setEditing('new')}>
            {t('board.new')}
          </button>
        </div>
      </header>

      {error !== '' && (
        <p className="tk-error" role="alert">
          {t('board.loadFailed')} {error}
        </p>
      )}

      {mode === 'board' ? (
        <div className="tk-board">
          {TASK_STATUSES.map(status => {
            const cards = visible.filter(card => card.status === status);
            return (
              <section
                className="tk-col"
                key={status}
                onDragOver={event => {
                  event.preventDefault();
                }}
                onDrop={event => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData('text/plain');
                  if (id !== '') void move(id, status);
                }}
              >
                <header className="tk-col-head">
                  <span>{t(`status.${status}`)}</span>
                  <span className="tk-count">{cards.length}</span>
                </header>
                <div className="tk-col-body">
                  {cards.map(card => (
                    <article
                      className="tk-card"
                      key={card.id}
                      draggable
                      onDragStart={event => {
                        event.dataTransfer.setData('text/plain', card.id);
                      }}
                      onClick={() => setEditing(card)}
                    >
                      <div className="tk-card-title">{card.title}</div>
                      {card.todos.length > 0 && (
                        <ul className="tk-card-todos">
                          {card.todos.slice(0, CARD_TODO_PREVIEW).map((item, index) => (
                            <li key={item.id} className={item.done ? 'tk-card-todo-row tk-todo-done' : 'tk-card-todo-row'}>
                              <label className="tk-todo-check" onClick={event => event.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={item.done}
                                  aria-label={t('todos.toggle')}
                                  onChange={() => void toggleTodo(card, index)}
                                />
                              </label>
                              <span className="tk-todo-content">{item.content}</span>
                            </li>
                          ))}
                          {card.todos.length > CARD_TODO_PREVIEW && (
                            <li className="tk-todo-more">+{card.todos.length - CARD_TODO_PREVIEW}</li>
                          )}
                        </ul>
                      )}
                      <div className="tk-card-meta">
                        <span className={`tk-prio tk-prio-${card.priority}`}>{t(`priority.${card.priority}`)}</span>
                        {card.dueAt !== null && <span className={isOverdue(card) ? 'tk-due tk-due-over' : 'tk-due'}>{card.dueAt}</span>}
                        {card.todos.length > 0 && (
                          <span className="tk-todo-count">
                            {todoDoneCount(card)}/{card.todos.length}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                  {cards.length === 0 && <p className="tk-col-empty">—</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="tk-list-wrap">
          <table className="tk-table">
            <thead>
              <tr>
                <th>{t('list.title')}</th>
                <th>{t('list.status')}</th>
                <th>{t('list.priority')}</th>
                <th>{t('list.due')}</th>
                <th>{t('list.updated')}</th>
                <th>{t('list.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(card => (
                <tr key={card.id} className={card.archived ? 'tk-row-archived' : undefined} onClick={() => setEditing(card)}>
                  <td className="tk-cell-title">
                    {card.title}
                    {card.todos.length > 0 && <span className="tk-todo-count">{todoDoneCount(card)}/{card.todos.length}</span>}
                  </td>
                  <td>{t(`status.${card.status}`)}</td>
                  <td>{t(`priority.${card.priority}`)}</td>
                  <td className={isOverdue(card) ? 'tk-due-over' : undefined}>{card.dueAt ?? '—'}</td>
                  <td className="tk-cell-muted">{formatUpdated(card.updatedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="tk-link-btn"
                      onClick={event => {
                        event.stopPropagation();
                        setEditing(card);
                      }}
                    >
                      {t('list.edit')}
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="tk-cell-muted">
                    {t('board.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="tk-foot">
        {t('board.revision')} #{revision >= 0 ? revision : '—'}
      </p>

      {editing !== null && (
        <CardEditor
          key={editing === 'new' ? 'new' : editing.id}
          card={editing}
          t={t}
          onClose={() => setEditing(null)}
          onSaved={async includeArchived => {
            setEditing(null);
            await refresh(includeArchived);
          }}
          onError={cause => setError(String(cause))}
        />
      )}
    </div>
  );
}

// ── card editor modal ───────────────────────────────────────────────────────

interface CardEditorProps {
  card: TaskCard | 'new';
  t: TasksLocale;
  onClose(): void;
  onSaved(includeArchived: boolean): Promise<void>;
  onError(message: string): void;
}

function CardEditor({ card, t, onClose, onSaved, onError }: CardEditorProps) {
  const existing = card === 'new' ? null : card;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? 'todo');
  const [priority, setPriority] = useState<TaskPriority>(existing?.priority ?? 'medium');
  const [due, setDue] = useState(existing?.dueAt ?? '');
  const [todos, setTodos] = useState<TaskTodo[]>(existing?.todos.map(item => ({ ...item })) ?? []);
  const [newTodo, setNewTodo] = useState('');
  const [busy, setBusy] = useState(false);

  function addTodo() {
    const content = newTodo.trim();
    if (content === '' || todos.length >= 50) return;
    setTodos([...todos, { id: '', content, done: false }]);
    setNewTodo('');
  }

  function toggleDraftTodo(index: number) {
    setTodos(todos.map((item, i) => (i === index ? { ...item, done: !item.done } : item)));
  }

  function removeDraftTodo(index: number) {
    setTodos(todos.filter((_, i) => i !== index));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (title.trim() === '') return;
    setBusy(true);
    try {
      // Draft items carry an empty id; the host mints ids for them.
      const payloadTodos = todos.map(({ id, content, done }) => (id === '' ? { content, done } : { id, content, done }));
      const payload = { title: title.trim(), body, status, priority, due_at: due === '' ? null : due, todos: payloadTodos };
      if (existing === null) await createCard(payload);
      else await updateCard(existing.id, payload);
      await onSaved(existing?.archived === true);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive() {
    if (existing === null) return;
    setBusy(true);
    try {
      if (existing.archived) await restoreCard(existing.id);
      else await archiveCard(existing.id);
      await onSaved(existing.archived);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (existing === null) return;
    if (!window.confirm(t('editor.deleteConfirm'))) return;
    setBusy(true);
    try {
      await deleteCard(existing.id);
      await onSaved(false);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tk-overlay" role="dialog" aria-modal="true" aria-label={t('editor.title')}>
      <div className="tk-mask" onClick={onClose} />
      <form className="tk-dialog" onSubmit={save}>
        <header className="tk-dialog-head">
          <h3 className="tk-dialog-title">{existing === null ? t('editor.newTitle') : t('editor.editTitle')}</h3>
          <button type="button" className="tk-close" onClick={onClose} aria-label={t('editor.cancel')}>
            ✕
          </button>
        </header>

        <label className="tk-field">
          <span>{t('editor.title')}</span>
          <input className="tk-input" value={title} maxLength={500} onChange={event => setTitle(event.target.value)} autoFocus />
        </label>

        <label className="tk-field">
          <span>{t('editor.body')}</span>
          <textarea className="tk-textarea" value={body} maxLength={50000} rows={6} onChange={event => setBody(event.target.value)} />
        </label>

        <div className="tk-field-row">
          <label className="tk-field">
            <span>{t('editor.status')}</span>
            <select className="tk-input" value={status} onChange={event => setStatus(event.target.value as TaskStatus)}>
              {TASK_STATUSES.map(value => (
                <option key={value} value={value}>
                  {t(`status.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="tk-field">
            <span>{t('editor.priority')}</span>
            <select className="tk-input" value={priority} onChange={event => setPriority(event.target.value as TaskPriority)}>
              {PRIORITIES.map(value => (
                <option key={value} value={value}>
                  {t(`priority.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="tk-field">
            <span>{t('editor.due')}</span>
            <input className="tk-input" type="date" value={due} onChange={event => setDue(event.target.value)} />
          </label>
        </div>

        <div className="tk-field">
          <span>
            {t('todos.title')}
            {todos.length > 0 && <span className="tk-todo-progress">{todos.filter(item => item.done).length}/{todos.length}</span>}
          </span>
          <ul className="tk-todos">
            {todos.map((item, index) => (
              <li key={item.id === '' ? `draft-${index}` : item.id} className={item.done ? 'tk-todo-row tk-todo-done' : 'tk-todo-row'}>
                <label className="tk-todo-check">
                  <input type="checkbox" checked={item.done} aria-label={t('todos.toggle')} onChange={() => toggleDraftTodo(index)} />
                </label>
                <span className="tk-todo-content">{item.content}</span>
                <button type="button" className="tk-todo-remove" aria-label={t('todos.remove')} onClick={() => removeDraftTodo(index)}>
                  ✕
                </button>
              </li>
            ))}
            {todos.length === 0 && <li className="tk-todo-empty">{t('todos.empty')}</li>}
          </ul>
          <div className="tk-todo-add">
            <input
              className="tk-input"
              value={newTodo}
              maxLength={200}
              placeholder={t('todos.addPlaceholder')}
              onChange={event => setNewTodo(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTodo();
                }
              }}
            />
            <button type="button" className="tk-btn" disabled={newTodo.trim() === '' || todos.length >= 50} onClick={addTodo}>
              {t('todos.add')}
            </button>
          </div>
        </div>

        <footer className="tk-dialog-foot">
          {existing !== null && (
            <div className="tk-foot-left">
              <button type="button" className="tk-btn" disabled={busy} onClick={() => void toggleArchive()}>
                {existing.archived ? t('editor.restore') : t('editor.archive')}
              </button>
              {existing.archived && (
                <button type="button" className="tk-btn tk-btn-danger" disabled={busy} onClick={() => void remove()}>
                  {t('editor.delete')}
                </button>
              )}
            </div>
          )}
          <div className="tk-foot-right">
            <button type="button" className="tk-btn" disabled={busy} onClick={onClose}>
              {t('editor.cancel')}
            </button>
            <button type="submit" className="tk-btn tk-btn-primary" disabled={busy || title.trim() === ''}>
              {busy ? '…' : t('editor.save')}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

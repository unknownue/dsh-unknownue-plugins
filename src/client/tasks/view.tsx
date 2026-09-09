/**
 * TasksView — the 任务 tab body: a kanban board (four status columns with
 * drag-and-drop between/within columns) and a dense list view over the same
 * cards, plus the card editor modal and the archive drawer (lightweight
 * searchable browser for archived cards, opened from the header).
 *
 * Purely user-maintained: every write goes straight to the host routes, there
 * is no agent interaction. Freshness is revision polling (refetch only when
 * the host's `meta.revision` moved). The board snapshot always includes
 * archived cards so the drawer can read them without an extra request; the
 * board/list views themselves render active cards only.
 */
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import React from 'react';
import {
  TASK_STATUSES,
  type TaskCard,
  type TaskDue,
  type TaskPriority,
  type TaskStatus,
  type TaskTodo,
  archiveCard,
  createCard,
  deleteCard,
  fetchBoard,
  fetchRevision,
  fetchTasksSettings,
  moveCard,
  restoreCard,
  updateCard,
} from './api';
import ArchiveDrawer from './archive';
import { formatDueLabel, formatUpdated, sortTodosUncheckedFirst, tagStyle, todoDoneCount } from './shared';

export type TasksLocale = (key: string) => string;

export interface TasksViewProps {
  t: TasksLocale;
}

const PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high'];
const POLL_MS = 5000;
/** Checklist items shown directly on a board card before folding into +n. */
const CARD_TODO_PREVIEW = 3;
/** Subtask count above which the editor list gets the fold/expand toggle. */
const TODO_FOLD_LIMIT = 8;

/**
 * Built-in quick-add subtask presets for the new-task editor (locale keys —
 * the translated text becomes the subtask content). Shown only when creating
 * a card; checked presets are appended as draft subtasks, unchecking removes
 * the matching row again.
 */
const PRESET_TODOS = [
  'todos.preset.requirements',
  'todos.preset.design',
  'todos.preset.implement',
  'todos.preset.selfcheck',
  'todos.preset.review',
  'todos.preset.docs',
] as const;

type DueMode = 'none' | 'point' | 'range';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Local wall-time "now" at minute precision, matching the due string format. */
function localNowMinute(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function dueModeOf(due: TaskDue | null): DueMode {
  if (due === null) return 'none';
  return due.kind;
}

/** Split `YYYY-MM-DD[THH:mm]` into its date and optional time parts. */
function splitDueTime(value: string): { date: string; time: string } {
  const separator = value.indexOf('T');
  return separator === -1 ? { date: value, time: '' } : { date: value.slice(0, separator), time: value.slice(separator + 1) };
}

function joinDueTime(date: string, time: string): string {
  return time === '' ? date : `${date}T${time}`;
}

/** The moment a card is late: the deadline itself, or the range end. */
function dueDeadline(due: TaskDue): string {
  return due.kind === 'point' ? due.at : due.end;
}

/** All-day dates go overdue after the day; timed values after the minute. */
function isOverdue(card: TaskCard): boolean {
  if (card.due === null || card.status === 'done') return false;
  const deadline = dueDeadline(card.due);
  return deadline.length === 10 ? deadline < todayIso() : deadline < localNowMinute();
}

/** True when the draft due has a cleared date or an inverted range. */
function dueInvalid(due: TaskDue | null): boolean {
  if (due === null) return false;
  if (due.kind === 'point') return splitDueTime(due.at).date === '';
  return splitDueTime(due.start).date === '' || splitDueTime(due.end).date === '' || due.start > due.end;
}

export default function TasksView({ t }: TasksViewProps) {
  const [board, setBoard] = useState<TaskCard[]>([]);
  const [revision, setRevision] = useState(-1);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'board' | 'list'>('board');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoringIds, setRestoringIds] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<TaskCard | 'new' | null>(null);
  const [archivingAll, setArchivingAll] = useState(false);
  /** User-configured quick-add presets; undefined → built-in localized ones. */
  const [presets, setPresets] = useState<string[] | undefined>(undefined);
  const revisionRef = useRef(-1);

  // Load the user's preset subtasks once; a failed fetch keeps the built-ins.
  useEffect(() => {
    let alive = true;
    void fetchTasksSettings()
      .then(view => {
        if (alive) setPresets(view.settings?.presetTodos);
      })
      .catch(() => {
        // host route unavailable → built-in presets remain
      });
    return () => {
      alive = false;
    };
  }, []);

  /** Open the new-task editor with the freshest preset list. */
  const openNewTask = useCallback(async () => {
    try {
      const view = await fetchTasksSettings();
      setPresets(view.settings?.presetTodos);
    } catch {
      // keep whatever presets we already have (or the built-ins)
    }
    setEditing('new');
  }, []);

  const refresh = useCallback(async (includeArchived = true) => {
    try {
      const next = await fetchBoard(includeArchived);
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

  // The board always fetches archived cards too: the archive drawer reads
  // them from the same snapshot, while both views render only active cards.
  useEffect(() => {
    const timer = setInterval(() => {
      void fetchRevision()
        .then(next => {
          if (next.revision !== revisionRef.current) void refresh(true);
        })
        .catch(() => {
          // poll failures are silent; the next tick retries
        });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

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
        const todos = sortTodosUncheckedFirst(card.todos).map((item, i) => (i === index ? { ...item, done: !item.done } : item));
        await updateCard(card.id, { todos: sortTodosUncheckedFirst(todos) });
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [refresh],
  );

  /** One-click archive of every card in the Done column (confirm-guarded). */
  const archiveAllDone = useCallback(
    async (cards: TaskCard[]) => {
      if (!window.confirm(t('board.archiveAllConfirm').replace('{n}', String(cards.length)))) return;
      setArchivingAll(true);
      try {
        await Promise.all(cards.map(card => archiveCard(card.id)));
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setArchivingAll(false);
      }
    },
    [refresh, t],
  );

  /** Unarchive a card from the drawer; the board snapshot refreshes after. */
  const restoreFromArchive = useCallback(
    async (id: string) => {
      setRestoringIds(prev => new Set(prev).add(id));
      try {
        await restoreCard(id);
        await refresh(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setRestoringIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [refresh],
  );

  const archivedCount = board.filter(card => card.archived).length;
  /** Active cards only — archived ones live in the archive drawer. */
  const visible = board.filter(card => !card.archived);
  /** Archived cards for the drawer, newest-updated first. */
  const archivedCards = board.filter(card => card.archived).sort((a, b) => b.updatedAt - a.updatedAt);
  /** Every tag already in use on the board, for the editor's quick-add row. */
  const knownTags = useMemo(() => [...new Set(board.flatMap(card => card.tags))].sort((a, b) => a.localeCompare(b)), [board]);

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
        <div className="tk-actions">
          <button type="button" className="tk-btn" onClick={() => setArchiveOpen(true)}>
            {t('archive.open')}
            {archivedCount > 0 && <span className="tk-count tk-archived-count">{archivedCount}</span>}
          </button>
          <button type="button" className="tk-btn" onClick={() => void refresh(true)}>
            {t('board.refresh')}
          </button>
          <button type="button" className="tk-btn tk-btn-primary" onClick={() => void openNewTask()}>
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
            // Newest-first within each column; the stored rank stays the
            // tie-break for equal timestamps (Array.sort is stable).
            const cards = visible
              .filter(card => card.status === status)
              .sort((a, b) => b.updatedAt - a.updatedAt);
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
                  <div className="tk-col-head-right">
                    {status === 'done' && cards.length > 0 && (
                      <button
                        type="button"
                        className="tk-col-archive"
                        disabled={archivingAll}
                        title={t('board.archiveAll')}
                        onClick={() => void archiveAllDone(cards)}
                      >
                        {archivingAll ? '…' : t('board.archiveAll')}
                      </button>
                    )}
                    <span className="tk-count">{cards.length}</span>
                  </div>
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
                      {card.tags.length > 0 && (
                        <div className="tk-card-tags">
                          {card.tags.map(tag => (
                            <span key={tag} className="tk-tag" style={tagStyle(tag)}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {card.todos.length > 0 && (
                        <ul className="tk-card-todos">
                          {sortTodosUncheckedFirst(card.todos).slice(0, CARD_TODO_PREVIEW).map((item, index) => (
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
                        {card.due !== null && (
                          <span className={isOverdue(card) ? 'tk-due tk-due-over' : 'tk-due'}>{formatDueLabel(card.due)}</span>
                        )}
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
                <th>{t('list.tags')}</th>
                <th>{t('list.updated')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(card => (
                <tr key={card.id} onClick={() => setEditing(card)}>
                  <td className="tk-cell-title">
                    {card.title}
                    {card.todos.length > 0 && <span className="tk-todo-count">{todoDoneCount(card)}/{card.todos.length}</span>}
                  </td>
                  <td>{t(`status.${card.status}`)}</td>
                  <td>{t(`priority.${card.priority}`)}</td>
                  <td className={isOverdue(card) ? 'tk-due-over' : undefined}>{card.due === null ? '—' : formatDueLabel(card.due)}</td>
                  <td>
                    <div className="tk-cell-tags">
                      {card.tags.map(tag => (
                        <span key={tag} className="tk-tag" style={tagStyle(tag)}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="tk-cell-muted">{formatUpdated(card.updatedAt)}</td>
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
          knownTags={knownTags}
          presets={presets}
          onClose={() => setEditing(null)}
          onSaved={async includeArchived => {
            setEditing(null);
            await refresh(includeArchived);
          }}
          onError={cause => setError(String(cause))}
        />
      )}

      {archiveOpen && (
        <ArchiveDrawer
          t={t}
          cards={archivedCards}
          restoring={restoringIds}
          onClose={() => setArchiveOpen(false)}
          onRestore={id => void restoreFromArchive(id)}
        />
      )}
    </div>
  );
}

// ── card editor modal ───────────────────────────────────────────────────────

interface CardEditorProps {
  card: TaskCard | 'new';
  t: TasksLocale;
  /** Tags already used across the board (quick-add suggestions). */
  knownTags: string[];
  /** User-configured quick-add presets; undefined → built-in localized ones. */
  presets?: string[];
  onClose(): void;
  onSaved(includeArchived: boolean): Promise<void>;
  onError(message: string): void;
}

function CardEditor({ card, t, knownTags, presets, onClose, onSaved, onError }: CardEditorProps) {
  const existing = card === 'new' ? null : card;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? 'todo');
  const [priority, setPriority] = useState<TaskPriority>(existing?.priority ?? 'medium');
  const [due, setDue] = useState<TaskDue | null>(existing?.due ?? null);
  const [todos, setTodos] = useState<TaskTodo[]>(existing?.todos.map(item => ({ ...item })) ?? []);
  const [newTodo, setNewTodo] = useState('');
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [newTag, setNewTag] = useState('');
  const [busy, setBusy] = useState(false);
  /** Row currently in inline-edit mode (stable key, not an array index). */
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [todosExpanded, setTodosExpanded] = useState(false);
  /** Set while Esc cancels so the ensuing blur does not commit. */
  const cancellingRef = useRef(false);

  function setDueMode(next: DueMode) {
    if (next === 'none') {
      setDue(null);
    } else if (next === 'point') {
      setDue(due === null ? { kind: 'point', at: todayIso() } : { kind: 'point', at: due.kind === 'range' ? due.start : due.at });
    } else {
      setDue(
        due !== null && due.kind === 'range'
          ? due
          : { kind: 'range', start: due !== null && due.kind === 'point' ? due.at : todayIso(), end: todayIso() },
      );
    }
  }

  function addTodo() {
    const content = newTodo.trim();
    if (content === '' || todos.length >= 50) return;
    setTodos([...todos, { id: '', content, done: false }]);
    setNewTodo('');
  }

  // Display order: unchecked first (handlers operate on the same view order).
  const sortedTodos = sortTodosUncheckedFirst(todos);
  /** Known tags not yet on this card, offered as quick-add chips. */
  const suggestedTags = knownTags.filter(tag => !tags.includes(tag));
  /** Effective quick-add presets: user-configured texts or built-in localized ones. */
  const presetItems = presets !== undefined ? presets.map(text => ({ key: text, label: text })) : PRESET_TODOS.map(key => ({ key, label: t(key) }));

  function toggleDraftTodo(index: number) {
    setTodos(sortTodosUncheckedFirst(sortedTodos.map((item, i) => (i === index ? { ...item, done: !item.done } : item))));
  }

  function editDraftTodo(index: number, content: string) {
    setTodos(sortTodosUncheckedFirst(sortedTodos.map((item, i) => (i === index ? { ...item, content } : item))));
  }

  /** Stable row identity (matches the `<li>` key): draft rows by slot, saved rows by id. */
  function keyOf(item: TaskTodo, index: number): string {
    return item.id === '' ? `draft-${index}` : item.id;
  }

  function startTodoEdit(key: string, content: string) {
    cancellingRef.current = false;
    setEditingKey(key);
    setEditDraft(content);
  }

  function commitTodoEdit() {
    if (editingKey === null) return;
    const index = sortedTodos.findIndex((item, i) => keyOf(item, i) === editingKey);
    if (index !== -1) {
      const content = editDraft.trim();
      if (content !== '') editDraftTodo(index, content);
    }
    setEditingKey(null);
    setEditDraft('');
  }

  function cancelTodoEdit() {
    cancellingRef.current = true;
    setEditingKey(null);
    setEditDraft('');
  }

  /** True when a row already carries the preset's text. */
  function isPresetAdded(label: string): boolean {
    return todos.some(item => item.content === label);
  }

  /** Check → append the preset as a draft subtask; uncheck → remove that row. */
  function togglePreset(label: string, checked: boolean) {
    const content = label;
    if (checked) {
      if (todos.length >= 50 || todos.some(item => item.content === content)) return;
      setTodos([...todos, { id: '', content, done: false }]);
      return;
    }
    const index = todos.findIndex(item => item.content === content);
    if (index === -1) return;
    // Exit edit mode when the row being removed is the one currently edited.
    if (editingKey !== null) {
      const editedIndex = sortedTodos.findIndex((item, i) => keyOf(item, i) === editingKey);
      if (editedIndex !== -1 && sortedTodos[editedIndex].content === content) {
        setEditingKey(null);
        setEditDraft('');
      }
    }
    setTodos(todos.filter((_, i) => i !== index));
  }

  function removeDraftTodo(index: number) {
    if (editingKey === keyOf(sortedTodos[index], index)) {
      setEditingKey(null);
      setEditDraft('');
    }
    setTodos(sortedTodos.filter((_, i) => i !== index));
  }

  function addTag() {
    const tag = newTag.trim();
    if (tag === '' || tags.includes(tag) || tags.length >= 20) return;
    setTags([...tags, tag]);
    setNewTag('');
  }

  function removeTag(index: number) {
    setTags(tags.filter((_, i) => i !== index));
  }

  function addExistingTag(tag: string) {
    if (tags.includes(tag) || tags.length >= 20) return;
    setTags([...tags, tag]);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (title.trim() === '' || dueInvalid(due)) return;
    setBusy(true);
    try {
      // Draft items carry an empty id; the host mints ids for them.
      const payloadTodos = todos.map(({ id, content, done }) => (id === '' ? { content, done } : { id, content, done }));
      const payload = { title: title.trim(), body, status, priority, due, todos: payloadTodos, tags };
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
            <select className="tk-input" value={dueModeOf(due)} onChange={event => setDueMode(event.target.value as DueMode)}>
              <option value="none">{t('due.none')}</option>
              <option value="point">{t('due.point')}</option>
              <option value="range">{t('due.range')}</option>
            </select>
          </label>
        </div>

        {due !== null && due.kind === 'point' && (
          <DueTimeRow
            label={t('due.at')}
            value={due.at}
            onChange={next => setDue({ kind: 'point', at: next })}
          />
        )}
        {due !== null && due.kind === 'range' && (
          <div className="tk-field-row">
            <DueTimeRow
              label={t('due.start')}
              value={due.start}
              onChange={next => setDue({ kind: 'range', start: next, end: due.end })}
            />
            <DueTimeRow
              label={t('due.end')}
              value={due.end}
              onChange={next => setDue({ kind: 'range', start: due.start, end: next })}
            />
          </div>
        )}
        {dueInvalid(due) && <p className="tk-error">{t('due.invalid')}</p>}

        <div className="tk-field">
          <span>{t('tags.title')}</span>
          {tags.length > 0 && (
            <ul className="tk-tag-list">
              {tags.map((tag, index) => (
                <li key={tag} className="tk-tag-item">
                  <span className="tk-tag" style={tagStyle(tag)}>
                    {tag}
                  </span>
                  <button type="button" className="tk-tag-remove" aria-label={t('tags.remove')} onClick={() => removeTag(index)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {suggestedTags.length > 0 && (
            <div className="tk-tag-suggest">
              <span className="tk-tag-suggest-label">{t('tags.suggestions')}</span>
              {suggestedTags.map(tag => (
                <button type="button" key={tag} className="tk-tag tk-tag-suggest-chip" style={tagStyle(tag)} onClick={() => addExistingTag(tag)}>
                  {tag}
                </button>
              ))}
            </div>
          )}
          <div className="tk-todo-add">
            <input
              className="tk-input"
              value={newTag}
              maxLength={32}
              placeholder={t('tags.addPlaceholder')}
              onChange={event => setNewTag(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTag();
                }
              }}
            />
            <button type="button" className="tk-btn" disabled={newTag.trim() === '' || tags.length >= 20} onClick={addTag}>
              {t('todos.add')}
            </button>
          </div>
        </div>

        <div className="tk-field">
          <span>
            {t('todos.title')}
            {todos.length > 0 && <span className="tk-todo-progress">{todos.filter(item => item.done).length}/{todos.length}</span>}
            {todos.length > TODO_FOLD_LIMIT && (
              <button type="button" className="tk-link-btn tk-todo-fold" onClick={() => setTodosExpanded(value => !value)}>
                {todosExpanded ? t('todos.collapse') : t('todos.expand')}
              </button>
            )}
          </span>
          <ul className={todosExpanded ? 'tk-todos tk-todos-expanded' : 'tk-todos'}>
            {sortedTodos.map((item, index) => {
              const key = keyOf(item, index);
              const isEditing = editingKey === key;
              return (
                <li key={key} className={item.done ? 'tk-todo-row tk-todo-done' : 'tk-todo-row'}>
                  <label className="tk-todo-check">
                    <input
                      type="checkbox"
                      checked={item.done}
                      disabled={isEditing}
                      aria-label={t('todos.toggle')}
                      onChange={() => toggleDraftTodo(index)}
                    />
                  </label>
                  {isEditing ? (
                    <>
                      <input
                        className="tk-input tk-todo-input"
                        value={editDraft}
                        maxLength={200}
                        aria-label={t('todos.edit')}
                        autoFocus
                        onChange={event => setEditDraft(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitTodoEdit();
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelTodoEdit();
                          }
                        }}
                        onBlur={() => {
                          if (!cancellingRef.current) commitTodoEdit();
                        }}
                      />
                      <button
                        type="button"
                        className="tk-todo-edit"
                        aria-label={t('editor.save')}
                        title={t('editor.save')}
                        onClick={commitTodoEdit}
                      >
                        ✓
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="tk-todo-content">{item.content}</span>
                      <button
                        type="button"
                        className="tk-todo-edit"
                        aria-label={t('todos.edit')}
                        title={t('todos.edit')}
                        onClick={() => startTodoEdit(key, item.content)}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M10.8 2.2 13.8 5.2 5.6 13.4a1.5 1.5 0 0 1-.6.4L2.6 14.5l.7-2.4a1.5 1.5 0 0 1 .4-.6L10.8 2.2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                          <path d="M9.6 3.4 12.6 6.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </>
                  )}
                  <button type="button" className="tk-todo-remove" aria-label={t('todos.remove')} onClick={() => removeDraftTodo(index)}>
                    ✕
                  </button>
                </li>
              );
            })}
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
          {existing === null && presetItems.length > 0 && (
            <div className="tk-field">
              <span>{t('todos.presets')}</span>
              <ul className="tk-todo-presets">
                {presetItems.map(item => (
                  <li key={item.key}>
                    <label className="tk-preset-row">
                      <input
                        type="checkbox"
                        checked={isPresetAdded(item.label)}
                        disabled={!isPresetAdded(item.label) && todos.length >= 50}
                        onChange={event => togglePreset(item.label, event.target.checked)}
                      />
                      <span className="tk-todo-content">{item.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
            <button type="submit" className="tk-btn tk-btn-primary" disabled={busy || title.trim() === '' || dueInvalid(due)}>
              {busy ? '…' : t('editor.save')}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

// ── due time row (date + optional time) ──────────────────────────────────────

interface DueTimeRowProps {
  label: string;
  value: string;
  onChange(next: string): void;
}

/** One boundary of a due date: a date input plus an OPTIONAL time input. */
function DueTimeRow({ label, value, onChange }: DueTimeRowProps) {
  const { date, time } = splitDueTime(value);
  return (
    <div className="tk-field">
      <span>{label}</span>
      <div className="tk-due-inputs">
        <input
          className="tk-input"
          type="date"
          value={date}
          aria-label={label}
          onChange={event => onChange(joinDueTime(event.target.value, time))}
        />
        <input className="tk-input" type="time" value={time} onChange={event => onChange(joinDueTime(date, event.target.value))} />
      </div>
    </div>
  );
}

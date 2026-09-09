/**
 * ArchiveDrawer — the lightweight archived-task browser, rendered inside the
 * tasks tab as a modal overlay. Deliberately simple (no editor, no kanban):
 * a search box, one row per archived card with an inline expandable detail,
 * and a per-row restore button.
 *
 * Presentational only: `cards` come from TasksView (which always fetches the
 * board with archived included), restore is delegated upward via `onRestore`.
 */
import React, { useMemo, useState } from 'react';
import type { TaskCard } from './api';
import type { TasksLocale } from './view';
import { formatDueLabel, formatUpdated, sortTodosUncheckedFirst, tagStyle } from './shared';

export interface ArchiveDrawerProps {
  /** Archived cards, newest-updated first. */
  cards: TaskCard[];
  t: TasksLocale;
  /** Ids whose restore request is in flight (row buttons disabled). */
  restoring: ReadonlySet<string>;
  onClose(): void;
  onRestore(id: string): void;
}

export default function ArchiveDrawer({ cards, t, restoring, onClose, onRestore }: ArchiveDrawerProps) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return cards;
    return cards.filter(card => card.title.toLowerCase().includes(q) || card.body.toLowerCase().includes(q));
  }, [cards, query]);

  const toggle = (id: string) => setExpanded(prev => (prev === id ? null : id));

  return (
    <div className="tk-overlay" role="dialog" aria-modal="true" aria-label={t('archive.title')}>
      <div className="tk-mask" onClick={onClose} />
      <div className="tk-archive-dialog">
        <header className="tk-dialog-head">
          <h3 className="tk-dialog-title">{t('archive.title')}</h3>
          <button type="button" className="tk-close" onClick={onClose} aria-label={t('editor.cancel')}>
            ✕
          </button>
        </header>

        <input
          className="tk-input tk-archive-search"
          value={query}
          maxLength={200}
          placeholder={t('archive.searchPlaceholder')}
          onChange={event => setQuery(event.target.value)}
          autoFocus
        />

        {cards.length === 0 ? (
          <p className="tk-archive-empty">{t('archive.empty')}</p>
        ) : (
          <ul className="tk-archive-list">
            {filtered.length === 0 && <li className="tk-archive-empty">{t('archive.noMatch')}</li>}
            {filtered.map(card => {
              const open = expanded === card.id;
              return (
                <li key={card.id} className="tk-archive-row">
                  <button
                    type="button"
                    className="tk-archive-row-main"
                    aria-expanded={open}
                    onClick={() => toggle(card.id)}
                  >
                    <span className="tk-archive-title">{card.title}</span>
                    <span className="tk-archive-meta">
                      {t(`status.${card.status}`)} · {formatUpdated(card.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="tk-btn"
                    disabled={restoring.has(card.id)}
                    onClick={() => onRestore(card.id)}
                  >
                    {restoring.has(card.id) ? '…' : t('editor.restore')}
                  </button>
                  {open && (
                    <div className="tk-archive-detail">
                      {card.body !== '' && <p className="tk-archive-body">{card.body}</p>}
                      {card.todos.length > 0 && (
                        <ul className="tk-card-todos">
                          {sortTodosUncheckedFirst(card.todos).map(item => (
                            <li key={item.id} className={item.done ? 'tk-card-todo-row tk-todo-done' : 'tk-card-todo-row'}>
                              <input type="checkbox" checked={item.done} readOnly disabled aria-label={t('todos.toggle')} />
                              <span className="tk-todo-content">{item.content}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {card.tags.length > 0 && (
                        <div className="tk-card-tags">
                          {card.tags.map(tag => (
                            <span key={tag} className="tk-tag" style={tagStyle(tag)}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="tk-archive-meta">
                        <span>{t(`priority.${card.priority}`)}</span>
                        {card.due !== null && <span> · {formatDueLabel(card.due)}</span>}
                        {card.completedAt !== null && (
                          <span>
                            {' '}
                            · {t('archive.completedAt')} {formatUpdated(card.completedAt)}
                          </span>
                        )}
                        <span>
                          {' '}
                          · {t('archive.createdAt')} {formatUpdated(card.createdAt)}
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

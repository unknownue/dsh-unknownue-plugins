/**
 * Papers library list — ported from vendor/paperspace papers-client.tsx.
 * Next.js routing replaced by an `onOpen(arxivId)` callback into the tab.
 */
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PAPERS_API } from './api';
import ThemeSwitch from './theme-switch';
import type { PaperspaceTheme } from './theme';
import type { Paper } from './types';

const ARXIV_ID_RE = /^\d{4}\.\d{5}(v\d+)?$/;
const DEFAULT_CATEGORIES = ['cs.AI', 'cs.CL', 'cs.CV', 'cs.LG', 'cs.RO', 'cs.DC', 'cs.LO'];

export default function PapersList({
  theme,
  onThemeChange,
  onOpen,
  onDiscuss,
}: {
  theme: PaperspaceTheme;
  onThemeChange: (next: PaperspaceTheme) => void;
  onOpen: (arxivId: string) => void;
  onDiscuss: (arxivId: string) => void;
}) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [open, setOpen] = useState(false);
  const [arxivId, setArxivId] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${PAPERS_API}/papers?page=1&page_size=100`, { cache: 'no-store' });
      if (!response.ok) throw new Error('API returned ' + response.status);
      const body = (await response.json()) as { items: Paper[] };
      setPapers(body.items);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load papers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll while any paper is still ingesting.
  useEffect(() => {
    if (!papers.some(paper => paper.status === 'ingesting')) return;
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [papers, refresh]);

  const categories = useMemo(() => {
    const seen = new Set(DEFAULT_CATEGORIES);
    for (const paper of papers) for (const tag of paper.categories) seen.add(tag);
    return ['All', ...seen];
  }, [papers]);

  const visible = useMemo(
    () =>
      papers.filter(
        paper =>
          (category === 'All' || paper.categories.includes(category)) &&
          (query.trim() === '' || JSON.stringify(paper).toLowerCase().includes(query.toLowerCase())),
      ),
    [papers, query, category],
  );

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!ARXIV_ID_RE.test(arxivId)) {
      setFormError('Enter an arXiv ID in YYMM.NNNNN format.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const response = await fetch(`${PAPERS_API}/papers`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ arxiv_id: arxivId }),
      });
      if (!response.ok) throw new Error('API returned ' + response.status);
      setOpen(false);
      setArxivId('');
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to queue paper');
    } finally {
      setSubmitting(false);
    }
  }

  async function retry(paper: Paper) {
    try {
      await fetch(`${PAPERS_API}/papers`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ arxiv_id: paper.arxivId }),
      });
      await refresh();
    } catch {
      /* refresh will surface the error state */
    }
  }

  async function remove(paper: Paper) {
    if (!confirm(`Delete ${paper.title} and its stored images?`)) return;
    try {
      await fetch(`${PAPERS_API}/papers/` + encodeURIComponent(paper.id), { method: 'DELETE' });
      await refresh();
    } catch {
      /* refresh will surface the error state */
    }
  }

  return (
    <main className="paper-workbench">
      <header className="workbench-header">
        <div>
          <h1>Paper workspace</h1>
          <p>Manage arXiv papers and use AI for close reading.</p>
        </div>
        <ThemeSwitch value={theme} onChange={onThemeChange} />
      </header>
      <div className="library-controls">
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title / arXiv ID / author…" aria-label="Search papers" />
        <button className="button primary" onClick={() => setOpen(true)}>
          + Add paper
        </button>
      </div>
      <div className="category-row">
        {categories.map(value => (
          <button className={'category ' + (value === category ? 'selected' : '')} onClick={() => setCategory(value)} key={value}>
            {value}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="ingesting">
          <span className="spinner" /> Loading papers…
        </p>
      ) : loadError ? (
        <section className="empty-state">
          <h2>Could not reach the API</h2>
          <p>{loadError}</p>
          <button className="button primary" onClick={() => void refresh()}>
            Retry
          </button>
        </section>
      ) : visible.length ? (
        <section className="paper-list">
          {visible.map(paper => (
            <article className="paper-item" key={paper.arxivId}>
              <div className="paper-item-body">
                {paper.status === 'ready' ? (
                  <button type="button" className="paper-item-title" onClick={() => onOpen(paper.arxivId)}>
                    {paper.title}
                  </button>
                ) : (
                  <span className="paper-item-title">{paper.title}</span>
                )}
                <div className="paper-item-meta">
                  <span>arXiv:{paper.arxivId}</span>
                  {paper.publishedAt && <span> · {paper.publishedAt.slice(0, 10)}</span>}
                  {paper.categories.length > 0 && <span> · {paper.categories.join(', ')}</span>}
                  {paper.status === 'ingesting' && (
                    <span className="ingesting">
                      {' '}
                      · <span className="spinner" /> 摄取中…
                    </span>
                  )}
                  {paper.status === 'failed' && (
                    <span className="failed"> · 摄取失败{paper.errorMessage ? `：${paper.errorMessage}` : ''}</span>
                  )}
                </div>
              </div>
              {(paper.status === 'ready' || paper.status === 'failed') && (
                <div className="paper-item-actions">
                  {paper.status === 'ready' && (
                    <>
                      <button type="button" className="text-button" onClick={() => onOpen(paper.arxivId)}>
                        阅读
                      </button>
                      <button type="button" className="text-button muted" onClick={() => onDiscuss(paper.arxivId)}>
                        与 AI 讨论
                      </button>
                    </>
                  )}
                  {paper.status === 'failed' && (
                    <>
                      <button type="button" className="text-button" onClick={() => void retry(paper)}>
                        重试
                      </button>
                      <button type="button" className="text-button muted" onClick={() => void remove(paper)}>
                        删除
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <h2>No papers found</h2>
          <p>Try another search or add an arXiv paper to start reading.</p>
        </section>
      )}
      <footer className="pagination">
        <span>
          {papers.length} paper{papers.length === 1 ? '' : 's'}
        </span>
      </footer>
      {open && (
        <div className="modal-backdrop" role="presentation">
          <form className="dialog" onSubmit={add}>
            <div className="dialog-header">
              <div>
                <h2>Add arXiv paper</h2>
                <p>Queue a paper for ingestion and local asset processing.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <label htmlFor="arxiv-id">arXiv ID</label>
            <input
              id="arxiv-id"
              autoFocus
              value={arxivId}
              onChange={event => setArxivId(event.target.value)}
              placeholder="2501.12948"
            />
            {formError && <p className="form-error">{formError}</p>}
            <div className="dialog-actions">
              <button type="button" className="button ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" disabled={submitting}>
                {submitting ? 'Queuing…' : 'Add paper'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

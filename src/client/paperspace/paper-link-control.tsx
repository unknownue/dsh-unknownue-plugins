/**
 * Paper-link control for the DSH composer dock: a chip styled exactly like
 * the hero mode-selector (agent-preset) button. Shown only on the welcome
 * screen (the same `composerPhase === 'blank' && openState === 'open'`
 * condition the mode selector uses). Clicking opens a small menu of ready
 * papers; picking one binds the CURRENT session and the chip then shows the
 * paper title (click again to rebind).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PAPERS_API, sessionsUrl } from './api';
import type { Paper } from './types';

interface LinkedInfo {
  arxivId: string;
  title: string;
}

interface SessionsFaceProps {
  sessionId?: string;
  /** InputZone owner share: point-in-time conversation snapshot. */
  session?: {
    composerPhase?: string;
    openState?: string;
  };
}

export function PaperLinkControl({ sessionId, session }: SessionsFaceProps) {
  const [linked, setLinked] = useState<LinkedInfo | null>(null);
  const [checked, setChecked] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);

  // Move the already-mounted chip DOM node onto the hero row (the flex row
  // holding the workspace chip and the mode selector). Plain DOM reparenting
  // — dynamic plugins cannot require `react-dom`, so no portal is available.
  // React keeps its fiber bound to the node, so state/events are unaffected.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const row = node.closest('[class*="composerStack"]')?.querySelector<HTMLElement>('[class*="heroWorkspaceRow"]');
    if (row && node.parentElement !== row) row.appendChild(node);
  }, [session?.composerPhase, session?.openState, checked, linked, menuOpen]);

  // Probe the current session's binding.
  useEffect(() => {
    let cancelled = false;
    setLinked(null);
    setChecked(false);
    if (!sessionId) {
      setChecked(true);
      return;
    }
    fetch(`${PAPERS_API}/sessions/${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
      .then(response => (response.ok ? (response.json() as Promise<LinkedInfo>) : null))
      .then(body => {
        if (cancelled) return;
        setLinked(body);
        setChecked(true);
      })
      .catch(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Load ready papers when the menu may be needed: unbound, or opened from
  // the confirmed chip (rebind).
  useEffect(() => {
    if (!checked) return;
    if (linked && !menuOpen) return;
    let cancelled = false;
    fetch(`${PAPERS_API}/papers?page=1&page_size=100`, { cache: 'no-store' })
      .then(response => (response.ok ? response.json() : null))
      .then(body => {
        if (cancelled || !body) return;
        setPapers((body.items ?? []).filter((paper: Paper) => paper.status === 'ready'));
      })
      .catch(() => {
        /* keep the menu usable next attempt */
      });
    return () => {
      cancelled = true;
    };
  }, [checked, linked, menuOpen]);

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (chipRef.current && !chipRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const pick = useCallback(
    async (arxivId: string) => {
      setMenuOpen(false);
      if (!sessionId || busy) return;
      setBusy(true);
      try {
        const response = await fetch(sessionsUrl() + '/link', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, arxiv_id: arxivId }),
        });
        if (response.ok) {
          const chosen = papers.find(paper => paper.arxivId === arxivId);
          console.log('[paperspace:link-control] linked', sessionId, '→', arxivId);
          setLinked({ arxivId, title: chosen?.title ?? arxivId });
        } else {
          console.warn('[paperspace:link-control] link failed', response.status, await response.json().catch(() => null));
        }
      } catch (error) {
        console.warn('[paperspace:link-control] link error', error);
      } finally {
        setBusy(false);
      }
    },
    [sessionId, busy, papers],
  );

  if (!sessionId || !checked) return null;
  // Hero gate — the same condition DSH's welcome screen uses for the mode
  // selector (`composerPhase === 'blank' && (openState === 'open' || summaryBlank)`).
  if (session && (session.composerPhase !== 'blank' || session.openState !== 'open')) return null;

  const chip = (
    <div className="paper-link-seat-wrap" ref={chipRef}>
      <button
        type="button"
        className="paper-link-seat"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={linked ? '当前会话关联的论文，点击可更换' : '将当前会话关联到一篇论文'}
        disabled={busy}
        onClick={() => setMenuOpen(open => !open)}
      >
        <span className="paper-link-seat-icon">📄</span>
        <span className="paper-link-seat-label">{linked ? linked.title : '关联论文'}</span>
        <svg className="paper-link-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3.5 5.5 7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {menuOpen && (
        <div className="paper-link-menu" role="menu">
          {papers.length === 0 ? (
            <div className="paper-link-menu-empty">没有可关联的论文</div>
          ) : (
            papers.map(paper => (
              <button
                key={paper.arxivId}
                type="button"
                role="menuitem"
                className="paper-link-item"
                onClick={() => void pick(paper.arxivId)}
              >
                <span className="paper-link-item-name">{paper.title}</span>
                <span className="paper-link-item-id">{paper.arxivId}</span>
                {linked?.arxivId === paper.arxivId ? <span className="paper-link-check">✓</span> : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );

  return <div ref={rootRef}>{chip}</div>;
}

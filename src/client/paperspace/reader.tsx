/**
 * Reader view — client-side port of vendor/paperspace
 * app/papers/[arxivId]/page.tsx (Next server fetch → in-tab fetch).
 * Chat moved into DSH's native conversation (「与 AI 讨论」button).
 */
import GithubSlugger from 'github-slugger';
import { useCallback, useEffect, useRef, useState } from 'react';
import { paperUrl } from './api';
import { ModelSelectionProvider } from './model-selection';
import ThemeSwitch from './theme-switch';
import type { PaperspaceTheme } from './theme';
import TranslationPanel, { type InitialTranslation } from './translation-panel';
import type { PaperDetail } from './types';

/**
 * Last scroll offset per paper. Tab switches unmount the reader (DSH renders
 * only the active conversation.view), so the offset is kept at module level
 * and restored when the same paper is reopened.
 */
const scrollOffsets = new Map<string, number>();

function buildToc(markdown: string) {
  const slugger = new GithubSlugger();
  const headings: Array<{ level: number; text: string; slug: string }> = [];
  for (const line of markdown.split('\n')) {
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) headings.push({ level: match[1].length, text: match[2], slug: slugger.slug(match[2]) });
  }
  return headings;
}

export default function Reader({
  arxivId,
  theme,
  onThemeChange,
  onBack,
  onOpenSettings,
  onDiscuss,
}: {
  arxivId: string;
  theme: PaperspaceTheme;
  onThemeChange: (next: PaperspaceTheme) => void;
  onBack: () => void;
  onOpenSettings: () => void;
  onDiscuss: () => void;
}) {
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [error, setError] = useState('');
  const [initialTranslation, setInitialTranslation] = useState<InitialTranslation>(null);
  const [initialMode] = useState<'original' | 'translated' | 'bilingual'>('original');
  const mainRef = useRef<HTMLElement | null>(null);

  // Restore the reader's scroll position. The element that actually scrolls
  // is NOT necessarily `.reader-main`: DSH's conversation layout puts the view
  // inside its own scrollport (`.scrollBody`, `overflow:hidden auto` with
  // `flex:1 0 auto` on the view area), so we track whichever scrollable
  // ancestor (or the reader-main itself) is doing the scrolling.
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const saved = scrollOffsets.get(arxivId);

    const scrollables = (): HTMLElement[] => {
      const list: HTMLElement[] = [];
      let node: HTMLElement | null = main;
      while (node) {
        const { overflowY } = getComputedStyle(node);
        if (overflowY === 'auto' || overflowY === 'scroll') list.push(node);
        node = node.parentElement;
      }
      const root = document.scrollingElement as HTMLElement | null;
      if (root && !list.includes(root)) list.push(root);
      return list;
    };

    // Programmatic scrollTop sets (ours or DSH's own reset) fire scroll
    // events asynchronously, so real user intent is detected from input
    // events instead — retries stop only when the user actually scrolls.
    let userIntent = false;
    const markUser = () => {
      userIntent = true;
    };
    const apply = () => {
      if (saved === undefined || saved <= 0 || userIntent) return;
      for (const el of scrollables()) el.scrollTop = saved;
    };

    const onScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      // Only the reader itself or an ancestor scrollport counts.
      if (target !== main && !target.contains(main)) return;
      if (target.scrollTop > 0) scrollOffsets.set(arxivId, target.scrollTop);
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('wheel', markUser, { passive: true });
    window.addEventListener('touchstart', markUser, { passive: true });
    window.addEventListener('keydown', markUser, true);

    // Apply immediately, again on the next frames (DSH may reset its
    // scrollport in a later effect when the view switches), and once more
    // after late layout settles — unless the user already started scrolling.
    apply();
    const rafA = requestAnimationFrame(apply);
    const rafB = requestAnimationFrame(apply);
    const retry = window.setTimeout(apply, 400);

    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('wheel', markUser);
      window.removeEventListener('touchstart', markUser);
      window.removeEventListener('keydown', markUser, true);
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
      window.clearTimeout(retry);
      for (const el of scrollables()) {
        if (el.scrollTop > 0) {
          scrollOffsets.set(arxivId, el.scrollTop);
          break;
        }
      }
    };
  }, [paper, arxivId]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(paperUrl(arxivId), { cache: 'no-store' });
      if (!response.ok) {
        setError('Paper not found (' + response.status + ')');
        return;
      }
      const body = (await response.json()) as PaperDetail;
      setPaper(body);
      setError('');
      if (body.status === 'ready') {
        try {
          const translationResponse = await fetch(`${paperUrl(arxivId)}/translation?lang=zh-CN`, { cache: 'no-store' });
          if (translationResponse.ok) setInitialTranslation((await translationResponse.json()) as NonNullable<InitialTranslation>);
        } catch {
          /* leave null */
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load paper');
    }
  }, [arxivId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!paper) {
    return (
      <main className="paper-workbench">
        <button type="button" className="button ghost" onClick={onBack}>
          ← Back to papers
        </button>
        {error ? <p className="failed">⚠ {error}</p> : <p className="ingesting">Loading paper…</p>}
      </main>
    );
  }

  const toc = buildToc(paper.markdown);

  return (
    <ModelSelectionProvider>
      <div className="reader-shell">
        <button className="toc-trigger" type="button" aria-label="Show contents">
          ☰
        </button>
        <aside className="reader-toc">
          <p>CONTENTS</p>
          {toc.length === 0 && <a>No headings</a>}
          {toc.map((item, index) => (
            <a key={index} className={'toc-level-' + item.level} href={'#' + item.slug}>
              {item.text}
            </a>
          ))}
        </aside>
        <main className="reader-main" ref={mainRef}>
          <header className="paper-header">
            <button type="button" className="back-link" onClick={onBack}>
              ← Back to papers
            </button>
            <h1>{paper.title}</h1>
            <p>{paper.authors.join(', ')}</p>
            <div className="paper-header-bottom">
              <div>
                <span className="tag">arXiv:{paper.arxivId}</span>
                {paper.categories.map(category => (
                  <span className="tag outline" key={category}>
                    {category}
                  </span>
                ))}
              </div>
              <div>
                <ThemeSwitch value={theme} onChange={onThemeChange} />
                {paper.status === 'ready' && (
                  <button className="button compact primary" onClick={onDiscuss}>
                    与 AI 讨论
                  </button>
                )}
                <button className="button compact ghost" onClick={onOpenSettings} title="模型设置">
                  ⚙ 模型
                </button>
                <a className="button compact ghost" href={'https://arxiv.org/abs/' + paper.arxivId} target="_blank" rel="noreferrer">
                  ↗ arXiv
                </a>
                <a className="button compact ghost" href={'https://arxiv.org/pdf/' + paper.arxivId} target="_blank" rel="noreferrer">
                  PDF
                </a>
              </div>
            </div>
            {paper.publishedAt && <p className="paper-published">Published: {paper.publishedAt}</p>}
          </header>
          {paper.status !== 'ready' ? (
            <div className="paper-status-note">
              {paper.status === 'ingesting' ? (
                <p className="ingesting">
                  <span className="spinner" /> Ingesting paper… Refresh to see progress.
                </p>
              ) : (
                <p className="failed">⚠ Ingestion failed: {paper.errorMessage ?? 'unknown error'}</p>
              )}
            </div>
          ) : (
            <TranslationPanel arxivId={arxivId} markdown={paper.markdown} initial={initialTranslation} initialMode={initialMode} />
          )}
        </main>
      </div>
    </ModelSelectionProvider>
  );
}

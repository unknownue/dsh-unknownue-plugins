/**
 * Reader view — client-side port of vendor/paperspace
 * app/papers/[arxivId]/page.tsx (Next server fetch → in-tab fetch).
 * Chat moved into DSH's native conversation (「与 AI 讨论」button).
 */
import GithubSlugger from 'github-slugger';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { paperUrl } from './api';
import { DEFAULT_FONT_SIZE, FONT_SIZE_STEP, MAX_FONT_SIZE, MIN_FONT_SIZE, readPaperspaceFontSize, rememberPaperspaceFontSize } from './font-size';
import { DEFAULT_WIDTH_PCT, MAX_WIDTH_PCT, MIN_WIDTH_PCT, WIDTH_PCT_STEP, readPaperspaceContentWidthPct, rememberPaperspaceContentWidthPct } from './content-width';
import ThemeSwitch from './theme-switch';
import type { PaperspaceTheme } from './theme';
import TranslationPanel, { type InitialTranslation } from './translation-panel';
import { forgetTranslationViewState, readTranslationViewState, rememberTranslationViewState } from './view-state';
import type { TranslationViewState } from './view-state';
import type { PaperDetail, ViewMode } from './types';
import { forgetSidebarPaper } from './sidebar-link';
import type { PaperspaceSurface } from './view';

/**
 * Last scroll offset per paper PER SURFACE. Tab switches unmount the reader
 * (DSH renders only the active conversation.view), so the offset is kept at
 * module level and restored when the same paper is reopened. The right Sidebar
 * reads the same paper in the same page but a different port, so the surface is
 * part of the key: each column keeps the place its reader left.
 */
const scrollOffsets = new Map<string, number>();
const scrollKey = (surface: PaperspaceSurface, arxivId: string) => surface + ':' + arxivId;

function buildToc(markdown: string) {
  const slugger = new GithubSlugger();
  const headings: Array<{ level: number; text: string; slug: string }> = [];
  for (const line of markdown.split('\n')) {
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) headings.push({ level: match[1].length, text: match[2], slug: slugger.slug(match[2]) });
  }
  return headings;
}

/** The element that actually scrolls is not necessarily `.reader-main` (DSH
 *  may scroll its own outer scrollport), so walk up and collect every
 *  scrollable ancestor, plus the document's scrolling element. */
function scrollContainers(main: HTMLElement | null): HTMLElement[] {
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
}

export default function Reader({
  arxivId,
  surface = 'view',
  theme,
  onThemeChange,
  onBack,
  onDiscuss,
  onOpenInSidebar,
}: {
  arxivId: string;
  /** Hosting surface: the 论文 tab, or the right Sidebar pane. */
  surface?: PaperspaceSurface;
  theme: PaperspaceTheme;
  onThemeChange: (next: PaperspaceTheme) => void;
  onBack: () => void;
  onDiscuss: () => void;
  /** Show this paper in DSH's right Sidebar; absent inside the Sidebar itself. */
  onOpenInSidebar?: () => void;
}) {
  const offsetKey = scrollKey(surface, arxivId);
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [error, setError] = useState('');
  const [initialTranslation, setInitialTranslation] = useState<InitialTranslation>(null);
  // The language + 原文/译文/双语 selection the user left this paper on, so
  // the restored scroll offset lands on the same layout it was recorded on.
  const [initialView] = useState<TranslationViewState>(() => readTranslationViewState(arxivId));
  const [removing, setRemoving] = useState(false);
  const [fontSize, setFontSize] = useState<number>(readPaperspaceFontSize);
  const [contentWidthPct, setContentWidthPct] = useState<number>(readPaperspaceContentWidthPct);
  const [tocOpen, setTocOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState('');
  const jumpEnterTimer = useRef<number | undefined>(undefined);
  const jumpLeaveTimer = useRef<number | undefined>(undefined);
  const mainRef = useRef<HTMLElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [jumpInset, setJumpInset] = useState(12);
  const [jumpBottom, setJumpBottom] = useState(24);
  const [showTopButton, setShowTopButton] = useState(false);

  // What the translation panel ACTUALLY renders (it falls back to the
  // original article until a completed snapshot exists for its language).
  const [article, setArticle] = useState<{ mode: ViewMode; completed: boolean; settled: boolean; busy: boolean }>({
    mode: 'original',
    completed: false,
    settled: false,
    busy: false,
  });
  const onArticleState = useCallback(
    (state: { mode: ViewMode; completed: boolean; settled: boolean; busy: boolean }) => {
      setArticle(state);
    },
    [],
  );
  const onViewChange = useCallback(
    (view: TranslationViewState) => {
      rememberTranslationViewState(arxivId, view);
    },
    [arxivId],
  );

  const toc = paper ? buildToc(paper.markdown) : [];

  // The section-jump control is position:fixed (floats above the article,
  // never scrolls with it), but its horizontal anchor must track the PAPER
  // TAB's right edge rather than the DSH page's: measure the reader shell's
  // bounds and offset the control by (viewportWidth - shellRight). The
  // bottom-right back-to-top button is anchored the same way vertically.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const shell = shellRef.current;
      if (!shell) return;
      const rect = shell.getBoundingClientRect();
      setJumpInset(Math.max(12, window.innerWidth - rect.right + 12));
      // Anchor the bottom-right button to the ACTUAL scrollport of the tab
      // (the scrollable that can really scroll), so it sits above DSH's
      // composer instead of the raw viewport bottom.
      const scroller =
        scrollContainers(mainRef.current).find(el => el.scrollHeight > el.clientHeight) ?? document.scrollingElement;
      const scrollerRect = (scroller as HTMLElement | null)?.getBoundingClientRect();
      const visibleBottom = Math.min(scrollerRect?.bottom ?? window.innerHeight, window.innerHeight);
      setJumpBottom(Math.max(24, window.innerHeight - visibleBottom + 24));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    const observer = new ResizeObserver(update);
    if (shellRef.current) observer.observe(shellRef.current);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', onScroll, true);
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [paper]);

  // Show the back-to-top button once the paper is scrolled a bit.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const scrollers = scrollContainers(mainRef.current);
      setShowTopButton(scrollers.some(el => el.scrollTop > 320));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [paper]);

  const scrollToTop = useCallback(() => {
    for (const el of scrollContainers(mainRef.current)) {
      try {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        el.scrollTop = 0;
      }
    }
  }, []);

  const changeFontSize = useCallback((delta: number) => {
    setFontSize(previous => {
      const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, previous + delta));
      rememberPaperspaceFontSize(next);
      return next;
    });
  }, []);

  const changeContentWidthPct = useCallback((delta: number) => {
    setContentWidthPct(previous => {
      const next = Math.min(MAX_WIDTH_PCT, Math.max(MIN_WIDTH_PCT, previous + delta));
      rememberPaperspaceContentWidthPct(next);
      return next;
    });
  }, []);

  // Hover on the top-right hotspot expands the section picker; leaving both
  // the hotspot and the panel collapses it again (short delays avoid flicker).
  const openJump = useCallback(() => {
    window.clearTimeout(jumpLeaveTimer.current);
    jumpEnterTimer.current = window.setTimeout(() => setTocOpen(true), 80);
  }, []);

  const closeJump = useCallback(() => {
    window.clearTimeout(jumpEnterTimer.current);
    jumpLeaveTimer.current = window.setTimeout(() => setTocOpen(false), 200);
  }, []);

  const jumpTo = useCallback((slug: string) => {
    setTocOpen(false);
    document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Close on Escape while the picker is open.
  useEffect(() => {
    if (!tocOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTocOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tocOpen]);

  // Track the section currently in view (headings above the top band).
  useEffect(() => {
    if (toc.length === 0) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      let active = '';
      for (const item of toc) {
        const el = document.getElementById(item.slug);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 140) active = item.slug;
        else break; // headings are in document order
      }
      setActiveSlug(active);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    compute();
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [toc]);

  async function removePaper() {
    if (!paper) return;
    if (!confirm(`删除《${paper.title}》及其本地图片与译文？删除后可在列表中重新添加该论文以重建数据。`)) return;
    setRemoving(true);
    try {
      const response = await fetch(paperUrl(arxivId), { method: 'DELETE' });
      if (!response.ok) {
        setError('删除失败 (HTTP ' + response.status + ')');
        return;
      }
      scrollOffsets.delete(offsetKey);
      forgetTranslationViewState(arxivId);
      // No later params-less open may resume into a paper that is gone.
      forgetSidebarPaper(arxivId);
      onBack();
    } catch (cause) {
      setError('删除失败：' + (cause instanceof Error ? cause.message : String(cause)));
    } finally {
      setRemoving(false);
    }
  }

  // ── Scroll tracking ────────────────────────────────────────────────────────
  // The element that actually scrolls is NOT necessarily `.reader-main`: DSH's
  // conversation layout puts the view inside its own scrollport (`.scrollBody`,
  // `overflow:hidden auto` with `flex:1 0 auto` on the view area), so we track
  // whichever scrollable ancestor (or the reader-main itself) is scrolling.
  //
  // Programmatic scrollTop sets (ours or DSH's own reset) fire scroll events
  // asynchronously, so real user intent is detected from input events instead.
  // The intent flag lives in a ref: it must survive the apply-effect's
  // re-runs below (e.g. when the translation content arrives late) so a user
  // who already started scrolling is never yanked back.
  const userIntentRef = useRef(false);
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const markUser = () => {
      userIntentRef.current = true;
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      // Only the reader itself or an ancestor scrollport counts.
      if (target !== main && !target.contains(main)) return;
      if (target.scrollTop > 0) scrollOffsets.set(offsetKey, target.scrollTop);
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('wheel', markUser, { passive: true });
    window.addEventListener('touchstart', markUser, { passive: true });
    window.addEventListener('keydown', markUser, true);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('wheel', markUser);
      window.removeEventListener('touchstart', markUser);
      window.removeEventListener('keydown', markUser, true);
      for (const el of scrollContainers(main)) {
        if (el.scrollTop > 0) {
          scrollOffsets.set(offsetKey, el.scrollTop);
          break;
        }
      }
    };
  }, [paper, offsetKey]);

  // ── Scroll restore ─────────────────────────────────────────────────────────
  // The saved offset only matches a specific layout: the one recorded when the
  // reader was last unmounted. The translation panel reports what it ACTUALLY
  // renders (original fallback until a completed snapshot exists), so the
  // apply is deferred until the restored view's layout is really on screen —
  // e.g. a restored 双语 waits for the completed snapshot before applying.
  const viewReady =
    initialView.mode === 'original'
      ? article.mode === 'original'
      : (article.mode === initialView.mode && article.completed) ||
        (article.mode === 'original' && article.settled && !article.busy);
  const restoreAppliedRef = useRef(false);
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const saved = scrollOffsets.get(offsetKey);
    // `applied` is local to this effect run: the immediate apply plus its
    // rAF/timeout retries may re-assert the position while the layout still
    // settles (KaTeX, images). `restoreAppliedRef` spans runs so a later
    // run (e.g. a mid-session mode toggle) never yanks the reader again.
    let applied = false;
    const apply = () => {
      if (userIntentRef.current) return;
      if (!viewReady) return;
      if (saved === undefined || saved <= 0) return;
      if (restoreAppliedRef.current && !applied) return;
      for (const el of scrollContainers(main)) el.scrollTop = saved;
      applied = true;
      restoreAppliedRef.current = true;
    };

    // Apply immediately, again on the next frames (DSH may reset its
    // scrollport in a later effect when the view switches), and once more
    // after late layout settles — unless the user already started scrolling.
    apply();
    const rafA = requestAnimationFrame(apply);
    const rafB = requestAnimationFrame(apply);
    const retry = window.setTimeout(apply, 400);

    return () => {
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
      window.clearTimeout(retry);
    };
  }, [paper, offsetKey, viewReady]);

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
          const translationResponse = await fetch(
            `${paperUrl(arxivId)}/translation?lang=${encodeURIComponent(initialView.lang)}`,
            { cache: 'no-store' },
          );
          if (translationResponse.ok) setInitialTranslation((await translationResponse.json()) as NonNullable<InitialTranslation>);
        } catch {
          /* leave null */
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load paper');
    }
  }, [arxivId, initialView.lang]);

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

  return (
    <div className="reader-shell" ref={shellRef} style={{ '--ps-article-font-size': fontSize + 'px', '--ps-article-max-width': contentWidthPct + '%' } as CSSProperties}>
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
          {/* Fixed (floating) above the article: never scrolls with the
              paper; its `right` offset tracks the tab's right edge so it
              stays inside the 论文 tab, not the DSH page corner. */}
          <div className="section-jump" style={{ right: jumpInset + 'px' }} onMouseEnter={openJump} onMouseLeave={closeJump}>
            <button
              type="button"
              className="section-jump-trigger"
              onClick={() => setTocOpen(open => !open)}
              aria-expanded={tocOpen}
              aria-haspopup="true"
              aria-label="章节跳转"
            >
              <span aria-hidden="true">☰</span> 章节 <span className="section-jump-caret" aria-hidden="true">▾</span>
            </button>
            {tocOpen && (
              <nav className="section-jump-panel" aria-label="章节列表">
                {toc.length === 0 ? (
                  <p className="section-jump-empty">暂无章节</p>
                ) : (
                  toc.map(item => (
                    <a
                      key={item.slug}
                      href={'#' + item.slug}
                      className={'jump-level-' + item.level + (item.slug === activeSlug ? ' active' : '')}
                      onClick={event => {
                        event.preventDefault();
                        jumpTo(item.slug);
                      }}
                    >
                      {item.text}
                    </a>
                  ))
                )}
              </nav>
            )}
          </div>
          {showTopButton && (
            <button
              type="button"
              className="back-to-top"
              style={{ right: jumpInset + 'px', bottom: jumpBottom + 'px' }}
              onClick={scrollToTop}
              aria-label="回到顶部"
              title="回到顶部"
            >
              ↑
            </button>
          )}
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
                <div className="font-size-control" role="group" aria-label="正文字体大小">
                  <button type="button" className="font-size-button" onClick={() => changeFontSize(-FONT_SIZE_STEP)} disabled={fontSize <= MIN_FONT_SIZE} aria-label="减小字号">
                    A−
                  </button>
                  <span
                    className="font-size-value"
                    title="正文字体大小（px），点击恢复默认"
                    onClick={() => changeFontSize(DEFAULT_FONT_SIZE - fontSize)}
                  >
                    {fontSize}
                  </span>
                  <button type="button" className="font-size-button" onClick={() => changeFontSize(FONT_SIZE_STEP)} disabled={fontSize >= MAX_FONT_SIZE} aria-label="增大字号">
                    A+
                  </button>
                </div>
                <div className="font-size-control" role="group" aria-label="正文宽度">
                  <button type="button" className="font-size-button" onClick={() => changeContentWidthPct(-WIDTH_PCT_STEP)} disabled={contentWidthPct <= MIN_WIDTH_PCT} aria-label="收窄">
                    ←
                  </button>
                  <span
                    className="font-size-value"
                    title="正文宽度（%），点击恢复100%"
                    onClick={() => changeContentWidthPct(DEFAULT_WIDTH_PCT - contentWidthPct)}
                  >
                    {contentWidthPct}%
                  </span>
                  <button type="button" className="font-size-button" onClick={() => changeContentWidthPct(WIDTH_PCT_STEP)} disabled={contentWidthPct >= MAX_WIDTH_PCT} aria-label="展宽">
                    →
                  </button>
                </div>
                <ThemeSwitch value={theme} onChange={onThemeChange} />
                {/* 与 AI 讨论 opens the PAPER's own session (create + open), which
                    would switch the Sidebar's session-bound surface out from
                    under this reader — so the action stays with the tab, where
                    the session switch is what the user asked for. */}
                {paper.status === 'ready' && surface === 'view' && (
                  <button className="button compact primary" onClick={onDiscuss}>
                    与 AI 讨论
                  </button>
                )}
                {paper.status === 'ready' && onOpenInSidebar && (
                  <button
                    className="button compact ghost"
                    onClick={onOpenInSidebar}
                    title="在右侧栏打开，与对话同屏阅读"
                  >
                    在侧栏打开
                  </button>
                )}
                <a className="button compact ghost" href={'https://arxiv.org/abs/' + paper.arxivId} target="_blank" rel="noreferrer">
                  ↗ arXiv
                </a>
                <a className="button compact ghost" href={'https://arxiv.org/pdf/' + paper.arxivId} target="_blank" rel="noreferrer">
                  PDF
                </a>
                <button type="button" className="button compact danger" onClick={() => void removePaper()} disabled={removing}>
                  {removing ? '删除中…' : '删除论文'}
                </button>
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
            <TranslationPanel
              arxivId={arxivId}
              markdown={paper.markdown}
              initial={initialTranslation}
              initialMode={initialView.mode}
              initialLang={initialView.lang}
              onViewChange={onViewChange}
              onArticleState={onArticleState}
            />
          )}
        </main>
      </div>
  );
}

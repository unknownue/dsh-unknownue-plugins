/**
 * Reader view — client-side port of vendor/paperspace
 * app/papers/[arxivId]/page.tsx (Next server fetch → in-tab fetch).
 * Chat moved into DSH's native conversation (「与 AI 讨论」button).
 */
import GithubSlugger from 'github-slugger';
import { useCallback, useEffect, useState } from 'react';
import { paperUrl } from './api';
import { ModelSelectionProvider } from './model-selection';
import TranslationPanel, { type InitialTranslation } from './translation-panel';
import type { PaperDetail } from './types';

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
  onBack,
  onOpenSettings,
  onDiscuss,
}: {
  arxivId: string;
  onBack: () => void;
  onOpenSettings: () => void;
  onDiscuss: () => void;
}) {
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [error, setError] = useState('');
  const [initialTranslation, setInitialTranslation] = useState<InitialTranslation>(null);
  const [initialMode] = useState<'original' | 'translated' | 'bilingual'>('original');

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
        <main className="reader-main">
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

/**
 * Translation panel — ported from vendor/paperspace translation-client.tsx.
 * Language picker, start/cancel/retry, progress polling, and
 * original / translated / bilingual rendering via pure string splicing.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Article, BilingualArticle } from './markdown';
import { paperUrl } from './api';
import type { TranslationViewState } from './view-state';
import type { Lang, TranslationJob, TranslationSnapshot, ViewMode } from './types';

export type InitialTranslation = (TranslationSnapshot & { job: TranslationJob | null }) | null;

const LANGS: Array<{ id: Lang; label: string; button: string }> = [
  { id: 'zh-CN', label: '中文', button: '翻译成中文' },
  { id: 'en-US', label: 'English', button: 'Translate to English' },
  { id: 'ja-JP', label: '日本語', button: '日本語に翻訳' },
];
const POLL_MS = 1500;

function spliceMarkdown(markdown: string, offsets: Array<{ start: number; end: number }>, paragraphs: Array<string | null>): string {
  let out = '';
  let cursor = 0;
  for (let i = 0; i < offsets.length; i++) {
    const offset = offsets[i];
    const translation = paragraphs[i];
    if (!offset || typeof offset.start !== 'number' || typeof offset.end !== 'number') continue;
    if (offset.start < cursor || offset.end > markdown.length) continue;
    out += markdown.slice(cursor, offset.start);
    out += translation ? translation : markdown.slice(offset.start, offset.end);
    cursor = offset.end;
  }
  return out + markdown.slice(cursor);
}

export default function TranslationPanel({
  arxivId,
  markdown,
  initial,
  initialMode = 'original',
  initialLang = 'zh-CN',
  onViewChange,
  onArticleState,
}: {
  arxivId: string;
  markdown: string;
  initial: InitialTranslation;
  initialMode?: ViewMode;
  initialLang?: Lang;
  /** Fired on user-initiated view changes (language or 原文/译文/双语 pick). */
  onViewChange?: (view: TranslationViewState) => void;
  /** Fired when the article actually rendered changes (mode or snapshot status). */
  onArticleState?: (state: { mode: ViewMode; completed: boolean; settled: boolean; busy: boolean }) => void;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [snapshot, setSnapshot] = useState<TranslationSnapshot | null>(initial);
  const [job, setJob] = useState<TranslationJob | null>(initial?.job ?? null);
  const [mode, setMode] = useState<ViewMode>(initialMode);
  const [busyAction, setBusyAction] = useState(false);
  const [actionError, setActionError] = useState('');
  // Set once the first translation lookup for the current language resolves —
  // either a snapshot (any status), a confirmed 404, or a network failure.
  // The reader uses it to tell "still looking up" from "no translation, the
  // fallback-original layout is final".
  const [lookupSettled, setLookupSettled] = useState(false);

  const jobStatus = job?.status;
  const snapshotStatus = snapshot?.status;
  const busy = jobStatus === 'pending' || jobStatus === 'running' || snapshotStatus === 'pending' || snapshotStatus === 'running';
  const failed = jobStatus === 'failed' || (!busy && snapshotStatus === 'failed');

  // The panel renders the article with the selected mode only while a
  // completed snapshot exists for the current language; otherwise it falls
  // back to the original markdown (e.g. restored bilingual with no
  // translation yet). Report the EFFECTIVE mode so the reader can delay its
  // scroll restore until the layout actually matches.
  const completed = snapshot?.status === 'completed';
  const effectiveMode: ViewMode = completed ? mode : 'original';
  useEffect(() => {
    onArticleState?.({ mode: effectiveMode, completed, settled: lookupSettled, busy });
  }, [effectiveMode, completed, lookupSettled, busy, onArticleState]);

  const changeLang = useCallback(
    (next: Lang) => {
      setLang(next);
      setMode('original');
      // The previous language's snapshot must not render under the new label.
      setSnapshot(null);
      setJob(null);
      setLookupSettled(false);
      onViewChange?.({ lang: next, mode: 'original' });
    },
    [onViewChange],
  );

  const changeMode = useCallback(
    (next: ViewMode) => {
      setMode(next);
      onViewChange?.({ lang, mode: next });
    },
    [lang, onViewChange],
  );

  const done = completed;
  const progressPercent = job && job.total > 0 ? Math.min(100, Math.round((job.progress / job.total) * 100)) : 0;

  const translatedMarkdown = useMemo(() => {
    if (!snapshot || snapshot.status !== 'completed') return null;
    return spliceMarkdown(markdown, snapshot.offsets, snapshot.paragraphs);
  }, [snapshot, markdown]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${paperUrl(arxivId)}/translation?lang=${encodeURIComponent(lang)}`, { cache: 'no-store' });
      if (response.ok) {
        const body = (await response.json()) as TranslationSnapshot & { job: TranslationJob | null };
        setSnapshot(body);
        setJob(body.job ?? null);
        setLookupSettled(true);
        return;
      }
      if (response.status === 404) {
        setSnapshot(null);
        const jobResponse = await fetch(`${paperUrl(arxivId)}/translation-job?lang=${encodeURIComponent(lang)}`, { cache: 'no-store' });
        if (jobResponse.ok) {
          const body = (await jobResponse.json()) as { job: TranslationJob };
          setJob(body.job ?? null);
        } else if (jobResponse.status === 404) {
          setJob(null);
        }
        setLookupSettled(true);
      }
    } catch {
      /* transient network error — keep last known state */
      setLookupSettled(true);
    }
  }, [arxivId, lang]);

  // Poll the snapshot while a job is active; refresh once on language change.
  useEffect(() => {
    void refresh();
    if (!busy) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh, busy]);

  async function startTranslation() {
    setBusyAction(true);
    setActionError('');
    try {
      const response = await fetch(`${paperUrl(arxivId)}/translate-paper`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target_lang: lang }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? body?.code ?? 'Failed to start translation');
      setJob(body.job ?? null);
      setSnapshot(null);
      changeMode('original');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to start translation');
    } finally {
      setBusyAction(false);
    }
  }

  async function cancelTranslation() {
    setActionError('');
    try {
      await fetch(`${paperUrl(arxivId)}/translation-job?lang=${encodeURIComponent(lang)}`, { method: 'DELETE' });
    } catch {
      /* refresh below reveals the authoritative state */
    }
    setJob(null);
    setSnapshot(null);
  }

  async function deleteTranslation() {
    setActionError('');
    try {
      await fetch(`${paperUrl(arxivId)}/translation?lang=${encodeURIComponent(lang)}`, { method: 'DELETE' });
    } catch {
      /* refresh below reveals the authoritative state */
    }
    setSnapshot(null);
    setJob(null);
    changeMode('original');
  }

  return (
    <>
      <div className="translation-bar">
        <select
          className="translation-lang"
          value={lang}
          onChange={event => changeLang(event.target.value as Lang)}
          aria-label="Translation language"
        >
          {LANGS.map(entry => (
            <option value={entry.id} key={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>

        <span className="translation-hint">模型在 DSH 设置 → UnPlugin → Paperspace 中指定</span>

        {done ? (
          <>
            <div className="translation-modes" role="group" aria-label="Translation view">
              {([['original', '原文'], ['translated', '译文'], ['bilingual', '双语']] as Array<[ViewMode, string]>).map(([value, label]) => (
                <button type="button" className={'translation-mode ' + (mode === value ? 'active' : '')} onClick={() => changeMode(value)} key={value}>
                  {label}
                </button>
              ))}
            </div>
            {(job?.provider?.model || snapshot?.model) && <span className="translation-model">模型：{job?.provider?.model ?? snapshot?.model}</span>}
            <button type="button" className="button compact ghost" onClick={() => void startTranslation()} disabled={busyAction}>
              重新翻译
            </button>
            <button type="button" className="button compact ghost" onClick={() => void deleteTranslation()} disabled={busyAction}>
              删除译文
            </button>
          </>
        ) : busy ? (
          <>
            <div className="translation-progress">
              <div className="translation-progress-track">
                <div className="translation-progress-fill" style={{ width: progressPercent + '%' }} />
              </div>
              <span>
                {jobStatus === 'pending' ? '排队中…' : `翻译中… ${job?.progress ?? 0}/${job?.total ?? 0}`}
                {job?.attempts && job.attempts > 1 ? ` (第 ${job.attempts} 次尝试)` : ''}
                {job?.provider?.model ? ` · ${job.provider.model}` : ''}
              </span>
            </div>
            <button type="button" className="button compact danger" onClick={() => void cancelTranslation()}>
              取消
            </button>
          </>
        ) : failed ? (
          <>
            <span className="translation-error">⚠ 翻译失败：{job?.error ?? '未知错误'}</span>
            <button type="button" className="button compact" onClick={() => void startTranslation()} disabled={busyAction}>
              重试
            </button>
          </>
        ) : (
          <button type="button" className="button compact" onClick={() => void startTranslation()} disabled={busyAction}>
            {LANGS.find(entry => entry.id === lang)?.button ?? '翻译'}
          </button>
        )}
        {actionError && <span className="translation-error">⚠ {actionError}</span>}
      </div>

      {mode === 'original' && <Article markdown={markdown} />}
      {mode === 'translated' && <Article markdown={translatedMarkdown ?? markdown} />}
      {mode === 'bilingual' &&
        (completed && snapshot ? (
          <BilingualArticle markdown={markdown} offsets={snapshot.offsets} paragraphs={snapshot.paragraphs} />
        ) : (
          <Article markdown={markdown} />
        ))}
    </>
  );
}

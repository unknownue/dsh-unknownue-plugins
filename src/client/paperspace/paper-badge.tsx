/**
 * Paper-linked-session badge for the DSH session header: shows which paper
 * the CURRENT session is grounded in (📄 title), with the arXiv ID as tooltip.
 * Data comes from the host link-lookup route; the current session id rides
 * `ctx.sessions.list` (ObservableSnapshot) via useSyncExternalStore.
 */
import { useSyncExternalStore, useEffect, useState } from 'react';
import { sessionLinkUrl } from './api';

interface SessionsListFace {
  getSnapshot(): { current?: string };
  subscribe(fn: () => void): () => void;
}

export interface PaperBadgeInfo {
  sessionId: string;
  arxivId: string;
  title: string;
  status: string;
}

export function PaperBadge({ sessions }: { sessions?: { list?: SessionsListFace } }) {
  const list = sessions?.list;
  const state = useSyncExternalStore(
    callback => (list ? list.subscribe(callback) : () => undefined),
    () => (list ? list.getSnapshot() : { current: undefined }),
  );
  const sessionId = state?.current;
  const [info, setInfo] = useState<PaperBadgeInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    if (!sessionId) return;
    fetch(sessionLinkUrl(sessionId), { cache: 'no-store' })
      .then(response => (response.ok ? (response.json() as Promise<PaperBadgeInfo>) : null))
      .then(body => {
        if (!cancelled && body && body.status === 'ready') setInfo(body);
      })
      .catch(() => {
        /* badge stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!info) return null;
  return (
    <span className="paper-session-badge" title={'arXiv:' + info.arxivId}>
      📄 {info.title}
    </span>
  );
}

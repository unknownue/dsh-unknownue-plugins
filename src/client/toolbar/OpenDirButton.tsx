/**
 * Open workspace directory button — opens the current session's cwd
 * in the OS file manager.
 */

import React, { useState } from "react";
import { call } from "../utils/rpc";
import { resolveCwd } from "../utils/sessions";

const OPEN_API = "/dsh-unknownue-plugins/open/api";

function FolderGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

interface OpenDirButtonProps {
  sessions: any;
  sessionId: string;
}

export function OpenDirButton(props: OpenDirButtonProps) {
  const { sessions, sessionId } = props;
  const cwd = resolveCwd(sessions, sessionId);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const onClick = async () => {
    if (busy) return;
    if (!cwd) {
      setFeedback({ kind: "error", text: "无法获取工作目录（cwd 为空）" });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = await call<{ opened?: string }>(OPEN_API, "openDir", { path: cwd });
      setFeedback({ kind: "ok", text: `已打开：${result?.opened ?? cwd}` });
    } catch (err: any) {
      setFeedback({ kind: "error", text: err.message || String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="dmk-action"
      title={feedback ? feedback.text : cwd ? `打开工作目录（${cwd}）` : "打开工作目录"}
      aria-label="打开工作目录"
      disabled={busy}
      onClick={onClick}
    >
      <FolderGlyph />
    </button>
  );
}

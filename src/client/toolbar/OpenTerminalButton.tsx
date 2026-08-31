/**
 * Open terminal button — opens a terminal at the current session's cwd.
 */

import React, { useState } from "react";
import { call } from "../utils/rpc";
import { resolveCwd } from "../utils/sessions";

const TERMINAL_API = "/dsh-unknownue-plugins/terminal/api";

function TerminalGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 9l3 3-3 3M12 15h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface OpenTerminalButtonProps {
  sessions: any;
  sessionId: string;
}

export function OpenTerminalButton(props: OpenTerminalButtonProps) {
  const { sessions, sessionId } = props;
  const cwd = resolveCwd(sessions, sessionId);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const onClick = async () => {
    if (busy) return;
    if (!cwd) {
      setFeedback("无法获取工作目录（cwd 为空）");
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = await call<{ opened?: string }>(TERMINAL_API, "openTerminal", { path: cwd });
      setFeedback(`已打开终端：${result?.opened ?? cwd}`);
    } catch (err: any) {
      setFeedback(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="dmk-action"
      title={feedback ?? (cwd ? `打开终端（${cwd}）` : "打开终端")}
      aria-label="打开终端"
      disabled={busy}
      onClick={onClick}
    >
      <TerminalGlyph />
    </button>
  );
}

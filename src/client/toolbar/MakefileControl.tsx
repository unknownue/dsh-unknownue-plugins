/**
 * Makefile target discovery panel — session-header button that lists
 * make targets (display-only) with default-target badge + copy-to-clipboard.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { call } from "../utils/rpc";
import { resolveCwd } from "../utils/sessions";

const MAKE_API = "/dsh-unknownue-plugins/makefile/api";

function Glyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 2h6v4h-6v-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

interface MakefileTarget {
  name: string;
  help: string;
  isDefault: boolean;
}

interface MakefileControlProps {
  sessions: any;
}

export function MakefileControl(props: MakefileControlProps) {
  const { sessions } = props;
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<MakefileTarget[]>([]);
  const [workdir, setWorkdir] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchTargets = useCallback(async (cwd: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await call<{ targets: MakefileTarget[]; cwd: string }>(MAKE_API, "list", { cwd });
      setTargets(data.targets);
      setWorkdir(data.cwd);
    } catch (err: any) {
      setError(err.message || "Failed to load Makefile");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    const sessionId = sessions?.current;
    const cwd = resolveCwd(sessions, sessionId);
    setOpen(true);
    void fetchTargets(cwd);
  }, [open, sessions, fetchTargets]);

  const handleRefresh = useCallback(() => {
    void fetchTargets(workdir);
  }, [fetchTargets, workdir]);

  const handleCopy = useCallback(async (target: string) => {
    const cmd = `make ${target}`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(target);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <>
      <button type="button" className="dmk-action" title="Makefile" aria-label="Makefile" onClick={handleClick}>
        <Glyph />
      </button>
      {open && (
        <div className="dmk-overlay" ref={panelRef}>
          <div className="dmk-mask" onClick={() => setOpen(false)} />
          <div className="dmk-card" role="dialog" aria-label="Makefile">
            <div className="dmk-head">
              <h3 className="dmk-title">Makefile</h3>
              <div className="dmk-toolbar">
                <input className="dmk-workdir" value={workdir} readOnly title="Working directory" />
                <button type="button" className="dmk-btn" onClick={handleRefresh} disabled={loading}>
                  刷新
                </button>
                <button type="button" className="dmk-close" onClick={() => setOpen(false)} aria-label="Close">
                  ✕
                </button>
              </div>
            </div>
            {error && <div className="dmk-meta" style={{ color: "#c2410c" }}>{error}</div>}
            {loading && <div className="dmk-meta">加载中…</div>}
            {!loading && !error && targets.length === 0 && <div className="dmk-meta">未发现构建目标</div>}
            {!loading && !error && targets.length > 0 && (
              <div className="dmk-list">
                {targets.map((t) => (
                  <div key={t.name} className="dmk-row">
                    <span className="dmk-target">{t.name}</span>
                    {t.isDefault && <span className="dmk-badge">默认</span>}
                    <span className="dmk-help">{t.help}</span>
                    <button
                      type="button"
                      className="dmk-copy"
                      onClick={() => void handleCopy(t.name)}
                    >
                      {copied === t.name ? "已复制 ✓" : "复制"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * FileEditorView — the main editor view with tabs, save/close,
 * markdown preview toggle, and Monaco editor pane.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "../utils/paths";
import { format } from "../i18n";
import { unwrap } from "../utils/rpc";
import {
  useTabs,
  useActivePath,
  closeTab,
  markSaved,
  updateActiveContent,
  focusTab,
  setEditorViewActive,
} from "../explorer/store";
import { useEditorTheme, themeChrome } from "./themeStore";
import { useMdMode, setMdMode } from "./mdModeStore";
import { isMarkdownPath } from "./markdown";
import { EditorPane } from "./EditorPane";
import { MarkdownPreview } from "./MarkdownPreview";
import { ThemeButton } from "./ThemeButton";
import type { FileManagerRemote } from "../explorer/remote";

function MdModeIcon({ mode }: { mode: "preview" | "source" }) {
  if (mode === "preview") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M1 3h14v10H1V3Z" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3 6h10M3 8.5h7M3 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 3L1 8l4 5M11 3l4 5-4 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface FileEditorViewProps {
  remote: FileManagerRemote;
  t: (key: string) => string;
}

export function FileEditorView({ remote, t }: FileEditorViewProps) {
  const tabs2 = useTabs();
  const activePath2 = useActivePath();
  const active = activePath2 === null ? undefined : tabs2.find((t2) => t2.path === activePath2);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const theme = useEditorTheme();
  const chrome = themeChrome(theme);
  const mdMode = useMdMode();

  useEffect(() => {
    setEditorViewActive(true);
    return () => setEditorViewActive(false);
  }, []);

  const saveActive = useCallback(async () => {
    if (active === undefined || !active.dirty) return;
    setBusy(true);
    try {
      await unwrap(await remote.writeText(active.path, active.content));
      markSaved(active.path);
      setNotice(format(t("editor.saved"), { name: active.path.split("/").pop() ?? "" }));
    } catch (error: any) {
      setNotice(format(t("editor.saveFailed"), { message: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(false);
    }
  }, [active, remote, t]);

  const saveRef = useRef(saveActive);
  saveRef.current = saveActive;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const themeVars: React.CSSProperties = {
    ["--dshf-bg" as any]: theme.background,
    ["--dshf-fg" as any]: theme.foreground,
    ["--dshf-chrome" as any]: chrome.chrome,
    ["--dshf-border" as any]: chrome.border,
    ["--dshf-muted" as any]: chrome.muted,
    ["--dshf-chip" as any]: chrome.chip,
    ["--dshf-dirty" as any]: chrome.dirty,
    ["--dshf-accent" as any]: "#094771",
    ["--dshf-font-size" as any]: `${theme.fontSize}px`,
  };

  if (active === undefined) {
    return (
      <div className="dshf-editor-view" style={themeVars}>
        <div className="dshf-editor-toolbar">
          <span className="dshf-title">{t("view.label")}</span>
          <span className="dshf-spacer" />
          <ThemeButton t={t} />
        </div>
        <div className="dshf-empty">{t("view.empty")}</div>
      </div>
    );
  }

  return (
    <div className="dshf-editor-view" style={themeVars}>
      <div className="dshf-editor-toolbar">
        <span className={cx("dshf-tabname", active.dirty && "dshf-dirty")} title={active.path}>
          {active.dirty ? "● " : ""}
          {active.path.split("/").pop()}
        </span>
        <span className="dshf-spacer" />
        <span className="dshf-editor-path" title={active.path}>
          {active.path}
        </span>
        {isMarkdownPath(active.path) && (
          <button
            type="button"
            className="dshf-btn dshf-md-toggle"
            title={mdMode === "preview" ? t("md.sourceTitle") : t("md.previewTitle")}
            onClick={() => setMdMode(mdMode === "preview" ? "source" : "preview")}
          >
            <MdModeIcon mode={mdMode} />
          </button>
        )}
        <ThemeButton t={t} />
        <button
          type="button"
          className="dshf-btn"
          title={t("editor.saveTitle")}
          disabled={!active.dirty || busy}
          onClick={() => void saveActive()}
        >
          {t("editor.save")}
        </button>
        <button
          type="button"
          className="dshf-btn"
          title={t("editor.closeFile")}
          onClick={() => {
            if (activePath2 !== null) closeTab(activePath2);
          }}
        >
          ✕
        </button>
      </div>
      <div className={cx("dshf-status", "dshf-status-top")}>
        {tabs2.length > 0 && (
          <span className="dshf-tabs-strip">
            {tabs2.map((tab) => (
              <span
                key={tab.path}
                className={cx("dshf-tab-chip", tab.path === activePath2 && "dshf-tab-chip-active")}
                title={tab.path}
              >
                <button type="button" className="dshf-tab-chip-name" onClick={() => focusTab(tab.path)}>
                  {tab.path.split("/").pop()}
                </button>
                <button
                  type="button"
                  className="dshf-tab-chip-close"
                  aria-label={format(t("editor.closeTab"), { name: tab.path.split("/").pop() ?? "" })}
                  title={t("editor.close")}
                  onClick={() => closeTab(tab.path)}
                >
                  ✕
                </button>
              </span>
            ))}
          </span>
        )}
        <span className="dshf-status-meta">
          <span className="dshf-status-busy">{busy ? "…" : ""}</span>
          <span className={cx("dshf-status-notice", notice === null && "dshf-hidden")}>{notice ?? ""}</span>
        </span>
      </div>
      {isMarkdownPath(active.path) && mdMode === "preview" ? (
        <MarkdownPreview content={active.content} path={active.path} remote={remote} />
      ) : (
        <EditorPane
          key={active.path}
          path={active.path}
          content={active.content}
          onChange={updateActiveContent}
          theme={theme}
          t={t}
        />
      )}
    </div>
  );
}

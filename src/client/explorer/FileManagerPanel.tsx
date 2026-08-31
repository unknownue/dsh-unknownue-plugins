/**
 * FileManagerPanel — the sidebar panel hosting the file tree with
 * toolbar (new file, new folder) and delete confirmation dialog.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../utils/paths";
import { format } from "../i18n";
import { unwrap } from "../utils/rpc";
import { clearClipboard } from "../utils/clipboard";
import {
  isTabOpen,
  focusTab,
  openTab,
  renameTab,
  removeTabs,
  resetAll,
  setWorkspaceRoot,
} from "./store";
import { FileTree, type FileTreeHandle } from "./FileTree";
import type { FileManagerRemote } from "./remote";

// ── icons ─────────────────────────────────────────────────────────────

function IconPlus(props: { size?: number }) {
  const size = props.size ?? 16;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ display: "block" }}>
      <path d="M8.64453 1.5V7.34961H14.5V8.65039H8.64453V14.5H7.34473V8.65039H1.5V7.34961H7.34473V1.5H8.64453Z" fill="currentColor" />
    </svg>
  );
}

function IconFolderAdd(props: { size?: number }) {
  const size = props.size ?? 16;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ display: "block" }}>
      <path transform="translate(9.52 2.52)" d="M3.55246 0L3.55246 2.44252L6 2.44252L6 3.55748L3.55246 3.55748L3.55246 6L2.43834 6L2.43834 3.55748L0 3.55748L0 2.44252L2.43834 2.44252L2.43834 0L3.55246 0Z" fill="currentColor" />
      <path transform="translate(0.3496 2.35)" d="M4.76367 0C5.36861 1.80598e-05 5.93113 0.310294 6.25488 0.821289L6.78027 1.64941C6.79685 1.67558 6.81791 1.69775 6.83887 1.71973C6.72186 2.15521 6.65702 2.61192 6.65137 3.08301C6.25601 2.96045 5.90909 2.70478 5.68164 2.3457L5.15723 1.5166C5.07183 1.38189 4.92318 1.3008 4.76367 1.30078L2.32422 1.30078C1.7589 1.30078 1.30078 1.7589 1.30078 2.32422L1.30078 10.1338C1.30078 10.6991 1.7589 11.1572 2.32422 11.1572L11.9766 11.1572C12.5419 11.1572 13 10.6991 13 8.58398C13.4545 8.5135 13.8903 8.38748 14.3008 8.21289L14.3008 10.1338C14.3008 11.4171 13.2598 12.458 11.9766 12.458L2.32422 12.458C1.04093 12.458 0 11.4171 0 10.1338L0 2.32422C0 1.04093 1.04093 0 2.32422 0L4.76367 0Z" fill="currentColor" />
    </svg>
  );
}

// ── DeleteConfirmDialog ───────────────────────────────────────────────

function DeleteConfirmDialog({
  path,
  t,
  onConfirm,
  onCancel,
}: {
  path: string;
  t: (key: string) => string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const name = path.split("/").pop() ?? path;
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div
      className="dshf-modal-overlay"
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div
        className="dshf-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={format(t("panel.deleteTitle"), { name })}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dshf-modal-title">{format(t("panel.deleteTitle"), { name })}</div>
        <div className="dshf-modal-body">{format(t("panel.deleteBody"), { name })}</div>
        <div className="dshf-modal-actions">
          <button type="button" className="dshf-btn" onClick={onCancel}>
            {t("panel.cancel")}
          </button>
          <button ref={confirmRef} type="button" className="dshf-btn dshf-btn-danger" onClick={onConfirm}>
            {t("panel.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FileManagerPanel ──────────────────────────────────────────────────

interface FileManagerPanelProps {
  remote: FileManagerRemote;
  t: (key: string) => string;
  useSessions?: (selector: (s: any) => any) => any;
  onFileOpened?: () => void;
}

export function FileManagerPanel({ remote, t, useSessions, onFileOpened }: FileManagerPanelProps) {
  const [root, setRoot] = useState<string | null>(null);
  const [rootError, setRootError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const treeRef = useRef<FileTreeHandle>(null);

  const sessionCwd = useSessions
    ? useSessions((s: any) => (s.current !== undefined ? s.byId[s.current]?.cwd : undefined))
    : undefined;
  const prevCwdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevCwdRef.current !== undefined && prevCwdRef.current !== sessionCwd) {
      resetAll();
      clearClipboard();
    }
    prevCwdRef.current = sessionCwd;
    let cancelled = false;
    (async () => {
      try {
        if (sessionCwd !== undefined) {
          try {
            await unwrap(await remote.setRoot(sessionCwd));
          } catch {
            // setRoot may fail if path doesn't exist yet
          }
        }
        const { path } = unwrap(remote.getRoot());
        if (!cancelled) {
          setRoot(path);
          setRootError(null);
          setWorkspaceRoot(path);
        }
      } catch (error: any) {
        if (!cancelled) setRootError(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [remote, sessionCwd]);

  const handleNotice = useCallback((message: string) => {
    setNotice(message);
  }, []);

  const openFile = useCallback(
    async (path: string) => {
      if (isTabOpen(path)) {
        focusTab(path);
        onFileOpened?.();
        return;
      }
      setBusy(true);
      try {
        const value = unwrap(await remote.readText(path));
        openTab({
          path,
          content: value.content,
          savedContent: value.content,
          mtimeMs: value.mtimeMs,
          dirty: false,
        });
        onFileOpened?.();
      } catch (error: any) {
        handleNotice(format(t("panel.openFailed"), { message: error instanceof Error ? error.message : String(error) }));
      } finally {
        setBusy(false);
      }
    },
    [remote, t, handleNotice, onFileOpened],
  );

  const handleCreate = useCallback((kind: "file" | "directory") => {
    treeRef.current?.beginCreate(kind);
  }, []);

  const handleRenamed = useCallback((from: string, to: string) => {
    renameTab(from, to);
  }, []);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const handleDelete = useCallback((path: string) => {
    setPendingDelete(path);
  }, []);

  const confirmDelete = useCallback(async () => {
    const path = pendingDelete;
    setPendingDelete(null);
    if (path === null) return;
    setBusy(true);
    try {
      await unwrap(await remote.delete(path));
      removeTabs([path]);
      treeRef.current?.refresh();
      handleNotice(t("panel.deleted"));
    } catch (error: any) {
      handleNotice(format(t("panel.deleteFailed"), { message: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(false);
    }
  }, [pendingDelete, remote, t, handleNotice]);

  const title = useMemo(() => {
    if (root === null) return "…";
    return root.split("/").filter(Boolean).pop() || "/";
  }, [root]);

  return (
    <div className="dshf-root">
      <div className="dshf-toolbar">
        <span className="dshf-title" title={root ?? ""}>
          {title}
        </span>
        <span className="dshf-spacer" />
        <button
          type="button"
          className="dshf-btn dshf-btn-icon"
          title={t("panel.newFile")}
          aria-label={t("panel.newFile")}
          onClick={() => handleCreate("file")}
        >
          <IconPlus />
        </button>
        <button
          type="button"
          className="dshf-btn dshf-btn-icon"
          title={t("panel.newDirectory")}
          aria-label={t("panel.newDirectory")}
          onClick={() => handleCreate("directory")}
        >
          <IconFolderAdd />
        </button>
      </div>
      {rootError !== null && <div className="dshf-error">{rootError}</div>}
      <div className="dshf-tree-pane">
        {root !== null && (
          <FileTree
            ref={treeRef}
            remote={remote}
            root={root}
            t={t}
            onOpenFile={(p) => void openFile(p)}
            onDelete={(p) => void handleDelete(p)}
            onRenamed={handleRenamed}
            onNotice={handleNotice}
          />
        )}
      </div>
      <div className="dshf-status">
        <span className="dshf-status-busy">{busy ? "…" : ""}</span>
        <span className={cx("dshf-status-notice", notice === null && "dshf-hidden")}>{notice ?? ""}</span>
        <span className="dshf-spacer" />
      </div>
      {pendingDelete !== null && (
        <DeleteConfirmDialog
          path={pendingDelete}
          t={t}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

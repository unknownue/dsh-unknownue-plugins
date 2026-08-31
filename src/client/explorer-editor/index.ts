/**
 * Explorer editor initialization -- sets up the file explorer editor
 * plugin with session restoration, remote mount, and slot registration.
 */

import React from "react";
import { NS, zh, en } from "../i18n";
import { unwrap } from "../utils/rpc";
import { buildExplorerRemote } from "../explorer/remote";
import { ExplorerViewWrapper } from "../explorer/ExplorerViewWrapper";
import { setFileEditorViewComponent } from "../explorer/ExplorerViewWrapper";
import { FileEditorView } from "../editor/FileEditorView";
import { installTabsSlotWatch } from "../editor/tabsSlotLive";
import {
  loadSnapshot,
  clearSnapshot,
  setWorkspaceRoot,
  filterByRoot,
  restoreTabs,
} from "../explorer/store";

// Inject FileEditorView into ExplorerViewWrapper to avoid circular deps
setFileEditorViewComponent(FileEditorView);

export async function restoreEditorSession(ctx: any): Promise<void> {
  try {
    const remote = ctx.get("remote.fileManager");
    if (remote === undefined) return;
    const { path: root } = unwrap<{ path: string }>(remote.getRoot());
    const snapshot = loadSnapshot();
    if (snapshot === null) return;
    if (snapshot.root !== root) {
      clearSnapshot();
      return;
    }
    setWorkspaceRoot(root);
    const kept = filterByRoot(snapshot.tabs, root);
    if (kept.length === 0) return;
    const restored: any[] = [];
    for (const tab of kept) {
      if (tab.content !== undefined) {
        restored.push({
          path: tab.path,
          content: tab.content,
          savedContent: tab.savedContent ?? tab.content,
          mtimeMs: tab.mtimeMs,
          dirty: tab.dirty,
          error: tab.error,
        });
      } else {
        try {
          const value = unwrap<{ path: string; content: string; mtimeMs: number | null }>(await remote.readText(tab.path));
          restored.push({
            path: value.path,
            content: value.content,
            savedContent: value.content,
            mtimeMs: value.mtimeMs,
            dirty: false,
            error: undefined,
          });
        } catch (error: any) {
          restored.push({
            path: tab.path,
            content: "",
            savedContent: "",
            mtimeMs: tab.mtimeMs,
            dirty: tab.dirty,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    if (restored.length > 0) {
      const active =
        snapshot.activePath !== null && restored.some((t: any) => t.path === snapshot.activePath)
          ? snapshot.activePath
          : restored[restored.length - 1]?.path ?? null;
      restoreTabs(restored, active);
      ctx.logger?.info?.("[dsh-explorer-editor] restored " + restored.length + " editor tab(s) from session");
    }
  } catch {
    // restoration failed silently
  }
}

export function applyExplorerEditor(ctx: any): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-explorer-editor: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.effect(() => installTabsSlotWatch(ctx), "dsh-explorer-editor: tabs slot watch");
  const mountRemote = ctx.effect(() => {
    ctx.provide("remote.fileManager", buildExplorerRemote());
    void restoreEditorSession(ctx);
  }, "dsh-explorer-editor: remote mount");
  ctx.slots.inject("conversation.view", () =>
    ctx.slots.register(
      {
        name: "conversation.view",
        id: "dsh-explorer-editor",
        order: 20,
        label: () => t("view.label"),
        locale: NS,
        registrant: "dsh-unknownue-plugins",
      },
      (props: any) => {
        const remote = ctx.get("remote.fileManager");
        if (remote === undefined) return null;
        return React.createElement(ExplorerViewWrapper, { remote, t, useSessions: props.useSessions });
      },
    ),
  );

  void mountRemote;
}

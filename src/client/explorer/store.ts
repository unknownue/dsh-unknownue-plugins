/**
 * Editor tabs store — manages open file tabs, active path, and persistence.
 * Uses the useSyncExternalStore pattern.
 */

import { useSyncExternalStore } from "react";
import { isInsideRoot } from "../utils/paths";

// ── types ─────────────────────────────────────────────────────────────

export interface EditorTab {
  path: string;
  content: string;
  savedContent: string;
  mtimeMs: number | null;
  dirty: boolean;
  error?: string;
}

export interface PersistedTab {
  path: string;
  mtimeMs: number | null;
  dirty: boolean;
  error?: string;
  content?: string;
  savedContent?: string;
}

export interface SessionSnapshot {
  root: string;
  activePath: string | null;
  tabs: PersistedTab[];
}

// ── persistence helpers ───────────────────────────────────────────────

const SNAPSHOT_KEY = "dsh-explorer-editor-session";
const MAX_PERSIST_CONTENT = 262144;

function shouldPersistContent(tab: EditorTab): boolean {
  return tab.content.length <= MAX_PERSIST_CONTENT;
}

export function filterByRoot(tabs: PersistedTab[], root: string): PersistedTab[] {
  return tabs.filter((t) => isInsideRoot(root, t.path));
}

function serialize(snapshot: SessionSnapshot): string {
  return JSON.stringify(snapshot);
}

function deserialize(raw: string): SessionSnapshot | null {
  try {
    const data = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;
    const obj = data as any;
    if (typeof obj.root !== "string" || !Array.isArray(obj.tabs)) return null;
    const tabs: PersistedTab[] = [];
    for (const entry of obj.tabs) {
      if (typeof entry !== "object" || entry === null) continue;
      const t = entry as any;
      if (typeof t.path !== "string") continue;
      tabs.push({
        path: t.path,
        mtimeMs: typeof t.mtimeMs === "number" ? t.mtimeMs : 0,
        dirty: t.dirty === true,
        error: typeof t.error === "string" ? t.error : undefined,
        content: typeof t.content === "string" ? t.content : undefined,
        savedContent: typeof t.savedContent === "string" ? t.savedContent : undefined,
      });
    }
    return {
      root: obj.root,
      activePath: typeof obj.activePath === "string" ? obj.activePath : null,
      tabs,
    };
  } catch {
    return null;
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSnapshot: SessionSnapshot | null = null;

function writeSnapshot(snapshot: SessionSnapshot): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SNAPSHOT_KEY, serialize(snapshot));
  } catch {
    try {
      const slim: SessionSnapshot = {
        root: snapshot.root,
        activePath: snapshot.activePath,
        tabs: snapshot.tabs.map((t) => ({
          path: t.path,
          mtimeMs: t.mtimeMs,
          dirty: t.dirty,
          error: t.error,
        })),
      };
      localStorage.setItem(SNAPSHOT_KEY, serialize(slim));
    } catch {
      // storage full — give up
    }
  }
}

export function saveSnapshot(snapshot: SessionSnapshot): void {
  pendingSnapshot = snapshot;
  if (persistTimer !== null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (pendingSnapshot !== null) {
      writeSnapshot(pendingSnapshot);
      pendingSnapshot = null;
    }
  }, 400);
}

export function loadSnapshot(): SessionSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw === null ? null : deserialize(raw);
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
    pendingSnapshot = null;
  }
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // storage unavailable
  }
}

// ── store state ───────────────────────────────────────────────────────

let tabs: EditorTab[] = [];
let activePath: string | null = null;
let currentRoot: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setWorkspaceRoot(root: string): void {
  currentRoot = root;
}

function persistNow(): void {
  if (currentRoot === null) return;
  saveSnapshot({
    root: currentRoot,
    activePath,
    tabs: tabs.map((t) => ({
      path: t.path,
      mtimeMs: t.mtimeMs,
      dirty: t.dirty,
      error: t.error,
      content: shouldPersistContent(t) ? t.content : undefined,
      savedContent: shouldPersistContent(t) ? t.savedContent : undefined,
    })),
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshotTabs(): EditorTab[] {
  return tabs;
}

function snapshotActive(): string | null {
  return activePath;
}

export function useTabs(): EditorTab[] {
  return useSyncExternalStore(subscribe, snapshotTabs);
}

export function useActivePath(): string | null {
  return useSyncExternalStore(subscribe, snapshotActive);
}

export function openTab(tab: EditorTab): void {
  const existing = tabs.find((t) => t.path === tab.path);
  if (existing) {
    activePath = tab.path;
  } else {
    tabs = [...tabs, tab];
    activePath = tab.path;
  }
  emit();
  persistNow();
}

export function focusTab(path: string): void {
  if (tabs.some((t) => t.path === path)) {
    activePath = path;
    emit();
    persistNow();
  }
}

export function isTabOpen(path: string): boolean {
  return tabs.some((t) => t.path === path);
}

export function updateActiveContent(content: string): void {
  if (activePath === null) return;
  tabs = tabs.map((t) =>
    t.path === activePath ? { ...t, content, dirty: content !== t.savedContent } : t,
  );
  emit();
  persistNow();
}

export function markSaved(path: string): void {
  tabs = tabs.map((t) =>
    t.path === path ? { ...t, savedContent: t.content, dirty: false } : t,
  );
  emit();
  persistNow();
}

export function closeTab(path: string): void {
  tabs = tabs.filter((t) => t.path !== path);
  if (activePath === path) {
    activePath = tabs.length > 0 ? tabs[tabs.length - 1].path : null;
  }
  emit();
  persistNow();
}

export function renameTab(from: string, to: string): void {
  tabs = tabs.map((t) => (t.path === from ? { ...t, path: to } : t));
  if (activePath === from) activePath = to;
  emit();
  persistNow();
}

export function removeTabs(paths: string[]): void {
  const gone = new Set(paths);
  tabs = tabs.filter((t) => !gone.has(t.path));
  if (activePath !== null && gone.has(activePath)) {
    activePath = tabs.length > 0 ? tabs[tabs.length - 1].path : null;
  }
  emit();
  persistNow();
}

export function resetAll(): void {
  tabs = [];
  activePath = null;
  emit();
  clearSnapshot();
}

export function restoreTabs(nextTabs: EditorTab[], active: string | null): void {
  tabs = nextTabs;
  activePath = active;
  emit();
}

// ── editor view active state ──────────────────────────────────────────

let editorViewActive = false;
const viewListeners = new Set<() => void>();

function emitView() {
  for (const listener of viewListeners) listener();
}

export function setEditorViewActive(active: boolean): void {
  if (editorViewActive === active) return;
  editorViewActive = active;
  emitView();
}

export function isEditorViewActive(): boolean {
  return editorViewActive;
}

export function subscribeEditorViewActive(listener: () => void): () => void {
  viewListeners.add(listener);
  return () => {
    viewListeners.delete(listener);
  };
}

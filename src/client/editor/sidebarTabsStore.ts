/**
 * Sidebar tabs store — tracks which sidebar tab is active (workspace or files).
 */

import { useSyncExternalStore } from "react";

export type SidebarTabId = "workspace" | "files";

const DEFAULT_SIDEBAR_TAB: SidebarTabId = "workspace";
let current: SidebarTabId = DEFAULT_SIDEBAR_TAB;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): SidebarTabId {
  return current;
}

export function useSidebarTab(): SidebarTabId {
  return useSyncExternalStore(subscribe, snapshot);
}

export function setSidebarTab(tab: SidebarTabId): void {
  if (current === tab) return;
  current = tab;
  emit();
}

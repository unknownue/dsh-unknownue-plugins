/**
 * Tabs slot live — tracks whether the DSH host provides its own tabs slot,
 * which would hide the file explorer's toggle button.
 */

import { useSyncExternalStore } from "react";

let liveCount = 0;
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

function snapshot(): number {
  return liveCount;
}

export function useTabsSlotLive(): boolean {
  return useSyncExternalStore(subscribe, snapshot) > 0;
}

export function installTabsSlotWatch(ctx: any): () => void {
  const sync = () => {
    const count = ctx.slots.entries("sidebar.workspaces.tabs").length;
    if (count !== liveCount) {
      liveCount = count;
      emit();
    }
  };
  const dispose = ctx.slots.subscribe("sidebar.workspaces.tabs", sync);
  sync();
  return dispose;
}

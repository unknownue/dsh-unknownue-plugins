/**
 * Clipboard store for cut/copy operations in the file tree.
 * Uses the useSyncExternalStore pattern.
 */

import { useSyncExternalStore } from "react";

export interface ClipboardEntry {
  kind: "cut" | "copy";
  path: string;
}

let pending: ClipboardEntry | null = null;
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

function snapshot(): ClipboardEntry | null {
  return pending;
}

export function useClipboard(): ClipboardEntry | null {
  return useSyncExternalStore(subscribe, snapshot);
}

export function setClipboard(value: ClipboardEntry): void {
  pending = value;
  emit();
}

export function clearClipboard(): void {
  if (pending !== null) {
    pending = null;
    emit();
  }
}

/**
 * Markdown mode store — tracks whether the editor shows source or preview.
 */

import { useSyncExternalStore } from "react";

export type MdMode = "preview" | "source";

const DEFAULT_MD_MODE: MdMode = "source";
const MD_MODE_STORAGE_KEY = "dsh-explorer-editor:md-mode:v2";
const VALID = new Set<string>(["preview", "source"]);

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

function loadMdMode(storage: Storage | undefined): MdMode {
  try {
    const raw = storage?.getItem(MD_MODE_STORAGE_KEY);
    return raw !== null && raw !== undefined && VALID.has(raw) ? (raw as MdMode) : DEFAULT_MD_MODE;
  } catch {
    return DEFAULT_MD_MODE;
  }
}

function persistMdMode(mode: MdMode, storage: Storage | undefined): void {
  try {
    storage?.setItem(MD_MODE_STORAGE_KEY, mode);
  } catch {
    // storage unavailable
  }
}

let current: MdMode = loadMdMode(safeStorage());
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

function snapshot(): MdMode {
  return current;
}

export function useMdMode(): MdMode {
  return useSyncExternalStore(subscribe, snapshot);
}

export function setMdMode(mode: MdMode): void {
  current = mode;
  const storage = safeStorage();
  if (storage !== undefined) persistMdMode(mode, storage);
  emit();
}

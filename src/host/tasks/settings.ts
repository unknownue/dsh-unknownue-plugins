/**
 * Task-board settings persistence.
 *
 * The database location is user-configurable: it lives in
 * `<dsh home>/tasks/settings.json` (same pattern as paperspace and
 * dsh-workspace-enhancement's machines.json). Resolution order:
 * settings.json (user) > cordis.patch.yml row > built-in defaults.
 *
 * Unlike paperspace there is NO `configured` gate — the board auto-boots with
 * defaults, because it needs no LLM credentials. Changing the database
 * location while running is saved but flagged `restartRequired` (PGlite booted
 * against the old directory; a restart picks up the new one).
 */
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { PartialTasksConfig, TasksConfig, TasksSettingsFile } from './types';

/** Harness home: `DSH_HOME` when set, else `~/.dsh` (paperspace pattern). */
export function tasksHome(): string {
  return process.env.DSH_HOME || join(homedir(), '.dsh');
}

export function tasksSettingsPath(): string {
  return join(tasksHome(), 'tasks', 'settings.json');
}

/** Expand `~` and resolve relative paths against the process cwd. */
export function normalizePath(value: string): string {
  const expanded = value === '~' || value.startsWith('~/') ? join(homedir(), value.slice(1)) : value;
  return isAbsolute(expanded) ? resolve(expanded) : resolve(process.cwd(), expanded);
}

/** Built-in defaults (also the settings form's initial values). */
export function builtinDefaults(): TasksConfig {
  const root = join(tasksHome(), 'tasks');
  return {
    dataDir: join(root, 'db'),
    initialMemoryBytes: 128 * 1024 * 1024,
  };
}

/** Preset list caps (a preset becomes a subtask, so 200 chars matches todos). */
export const PRESET_TODOS_MAX = 20;
export const PRESET_TODO_MAX_LEN = 200;

/**
 * Normalize a stored/wire preset list: strings only, trimmed, empties
 * dropped, deduped, capped. Non-arrays (incl. `null`) → `undefined` so a
 * missing field means "use the client's built-in presets".
 */
export function normalizePresetTodos(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const text = item.trim();
    if (text === '' || text.length > PRESET_TODO_MAX_LEN || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= PRESET_TODOS_MAX) break;
  }
  return out;
}

/** Row config layered over built-in defaults. */
export function resolveConfig(row: PartialTasksConfig = {}): TasksConfig {
  const base = builtinDefaults();
  return {
    dataDir: typeof row.dataDir === 'string' && row.dataDir !== '' ? normalizePath(row.dataDir) : base.dataDir,
    initialMemoryBytes: typeof row.initialMemoryBytes === 'number' ? row.initialMemoryBytes : base.initialMemoryBytes,
  };
}

/** Corrupt/missing file → null (fall back to defaults, never brick a restart). */
export function loadSettingsFile(): TasksSettingsFile | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(tasksSettingsPath(), 'utf8'));
    if (parsed === null || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.dataDir !== 'string' || record.dataDir === '') return null;
    const file: TasksSettingsFile = { version: 1, dataDir: normalizePath(record.dataDir) };
    const presetTodos = normalizePresetTodos(record.presetTodos);
    if (presetTodos !== undefined) file.presetTodos = presetTodos;
    return file;
  } catch {
    return null;
  }
}

export async function saveSettingsFile(settings: TasksSettingsFile): Promise<void> {
  const path = tasksSettingsPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

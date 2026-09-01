/**
 * Paperspace settings persistence + gating.
 *
 * User-configured options live in `<dsh home>/paperspace/settings.json`
 * (same pattern as dsh-workspace-enhancement's `remote-workspaces/machines.json`).
 * Resolution order: settings.json (user) > cordis.patch.yml row (seeded
 * defaults) > built-in defaults. Until the user saves `configured: true`,
 * every business route answers 423 PAPERSPACE_NOT_CONFIGURED and the worker
 * stays dormant — "must configure before use".
 */
import { readFileSync, existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import type { PaperspaceConfig, PartialPaperspaceConfig } from './types';

export interface PaperspaceSettingsFile extends PaperspaceConfig {
  version: 1;
  configured: boolean;
}

export interface PaperspaceSettingsInput {
  configured: boolean;
  dataDir?: string;
  assetsDir?: string;
  port?: number;
  initialMemoryBytes?: number;
  pollMs?: number;
  ingestTimeoutMs?: number;
  maxAssetBytes?: number;
  ingestConcurrency?: number;
  translateMaxAttempts?: number;
  translateStuckAfterMinutes?: number;
  translateTimeoutMs?: number;
  rescanIntervalMs?: number;
  workspaceDir?: string;
}

/** Harness home: `DSH_HOME` when set, else `~/.dsh` (dsh-workspace-enhancement pattern). */
export function paperspaceHome(): string {
  return process.env.DSH_HOME || join(homedir(), '.dsh');
}

export function paperspaceSettingsPath(): string {
  return join(paperspaceHome(), 'paperspace', 'settings.json');
}

/** Expand `~` and resolve relative paths against the process cwd. */
export function normalizePath(value: string): string {
  const expanded = value === '~' || value.startsWith('~/') ? join(homedir(), value.slice(1)) : value;
  return isAbsolute(expanded) ? resolve(expanded) : resolve(process.cwd(), expanded);
}

/** Built-in defaults (used as the settings form's initial values). */
export function builtinDefaults(): PaperspaceConfig {
  const root = join(paperspaceHome(), 'paperspace');
  return {
    dataDir: join(root, 'db'),
    assetsDir: join(root, 'assets'),
    workspaceDir: join(root, 'workspace'),
    port: 0,
    initialMemoryBytes: 512 * 1024 * 1024,
    pollMs: 5000,
    ingestTimeoutMs: 30000,
    maxAssetBytes: 10 * 1024 * 1024,
    ingestConcurrency: 2,
    translateMaxAttempts: 3,
    translateStuckAfterMinutes: 30,
    translateTimeoutMs: 120000,
    rescanIntervalMs: 60000,
  };
}

/** Merge layer by layer: builtin < row (patch) < settings.json. */
export function resolveConfig(
  row: PartialPaperspaceConfig = {},
  file: PaperspaceSettingsFile | null = null,
): PaperspaceConfig {
  const base = builtinDefaults();
  const norm = (value: string | undefined): string | undefined => (typeof value === 'string' && value !== '' ? normalizePath(value) : undefined);
  const rowDataDir = norm(row.dataDir) ?? base.dataDir;
  const merged: PaperspaceConfig = {
    dataDir: rowDataDir,
    assetsDir: norm(row.assetsDir) ?? base.assetsDir,
    // Default the DSH workspace anchor next to the DATA directory, not the
    // builtin root, so relocated libraries keep their workspace beside them.
    workspaceDir: norm(row.workspaceDir) ?? join(dirname(rowDataDir), 'workspace'),
    port: typeof row.port === 'number' ? row.port : base.port,
    initialMemoryBytes: typeof row.initialMemoryBytes === 'number' ? row.initialMemoryBytes : base.initialMemoryBytes,
    pollMs: typeof row.pollMs === 'number' ? row.pollMs : base.pollMs,
    ingestTimeoutMs: typeof row.ingestTimeoutMs === 'number' ? row.ingestTimeoutMs : base.ingestTimeoutMs,
    maxAssetBytes: typeof row.maxAssetBytes === 'number' ? row.maxAssetBytes : base.maxAssetBytes,
    ingestConcurrency: typeof row.ingestConcurrency === 'number' ? row.ingestConcurrency : base.ingestConcurrency,
    translateMaxAttempts: typeof row.translateMaxAttempts === 'number' ? row.translateMaxAttempts : base.translateMaxAttempts,
    translateStuckAfterMinutes: typeof row.translateStuckAfterMinutes === 'number' ? row.translateStuckAfterMinutes : base.translateStuckAfterMinutes,
    translateTimeoutMs: typeof row.translateTimeoutMs === 'number' ? row.translateTimeoutMs : base.translateTimeoutMs,
    rescanIntervalMs: typeof row.rescanIntervalMs === 'number' ? row.rescanIntervalMs : base.rescanIntervalMs,
  };
  if (!file) return merged;
  const fileDataDir = file.dataDir ? normalizePath(file.dataDir)! : merged.dataDir;
  return {
    dataDir: fileDataDir,
    assetsDir: file.assetsDir ? normalizePath(file.assetsDir)! : merged.assetsDir,
    workspaceDir: file.workspaceDir ? normalizePath(file.workspaceDir)! : join(dirname(fileDataDir), 'workspace'),
    port: file.port,
    initialMemoryBytes: file.initialMemoryBytes,
    pollMs: file.pollMs,
    ingestTimeoutMs: file.ingestTimeoutMs,
    maxAssetBytes: file.maxAssetBytes,
    ingestConcurrency: file.ingestConcurrency,
    translateMaxAttempts: file.translateMaxAttempts,
    translateStuckAfterMinutes: file.translateStuckAfterMinutes,
    translateTimeoutMs: file.translateTimeoutMs,
    rescanIntervalMs: file.rescanIntervalMs,
  };
}

const pathSchema = z.string().min(1).max(1024);
export const settingsInputSchema = z.object({
  configured: z.boolean(),
  dataDir: pathSchema.optional(),
  assetsDir: pathSchema.optional(),
  workspaceDir: pathSchema.optional(),
  port: z.number().int().min(0).max(65535).optional(),
  initialMemoryBytes: z.number().int().min(64 * 1024 * 1024).max(8 * 1024 * 1024 * 1024).optional(),
  pollMs: z.number().int().min(500).max(3600000).optional(),
  ingestTimeoutMs: z.number().int().min(1000).max(600000).optional(),
  maxAssetBytes: z.number().int().min(1024).max(1024 * 1024 * 1024).optional(),
  ingestConcurrency: z.number().int().min(1).max(16).optional(),
  translateMaxAttempts: z.number().int().min(1).max(10).optional(),
  translateStuckAfterMinutes: z.number().int().min(1).max(1440).optional(),
  translateTimeoutMs: z.number().int().min(1000).max(3600000).optional(),
  rescanIntervalMs: z.number().int().min(5000).max(86400000).optional(),
}).strict();

/** Validate + merge an input onto the current effective settings. */
export function applySettingsInput(
  input: PaperspaceSettingsInput,
  current: PaperspaceSettingsFile | null,
  row: PartialPaperspaceConfig,
): PaperspaceSettingsFile {
  const base = current ?? { version: 1 as const, configured: false, ...resolveConfig(row) };
  const dataDir = input.dataDir !== undefined ? normalizePath(input.dataDir) : base.dataDir;
  return {
    version: 1,
    configured: input.configured,
    dataDir,
    assetsDir: input.assetsDir !== undefined ? normalizePath(input.assetsDir) : base.assetsDir,
    workspaceDir:
      input.workspaceDir !== undefined && input.workspaceDir !== '' ? normalizePath(input.workspaceDir) : base.workspaceDir !== '' ? base.workspaceDir : join(dirname(dataDir), 'workspace'),
    port: input.port ?? base.port,
    initialMemoryBytes: input.initialMemoryBytes ?? base.initialMemoryBytes,
    pollMs: input.pollMs ?? base.pollMs,
    ingestTimeoutMs: input.ingestTimeoutMs ?? base.ingestTimeoutMs,
    maxAssetBytes: input.maxAssetBytes ?? base.maxAssetBytes,
    ingestConcurrency: input.ingestConcurrency ?? base.ingestConcurrency,
    translateMaxAttempts: input.translateMaxAttempts ?? base.translateMaxAttempts,
    translateStuckAfterMinutes: input.translateStuckAfterMinutes ?? base.translateStuckAfterMinutes,
    translateTimeoutMs: input.translateTimeoutMs ?? base.translateTimeoutMs,
    rescanIntervalMs: input.rescanIntervalMs ?? base.rescanIntervalMs,
  };
}

/**
 * On-disk file schema: same fields as the API input plus the persisted
 * `version`. NOT strict — future additive fields must not brick a restart
 * (the old `.strict()` parse rejected `version` and silently reset every
 * restart).
 */
const settingsFileSchema = settingsInputSchema.extend({
  version: z.number().int().min(0).max(10).optional(),
});

export function loadSettingsFile(): PaperspaceSettingsFile | null {
  const path = paperspaceSettingsPath();
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const input = settingsFileSchema.safeParse(parsed);
    if (!input.success) return null;
    return applySettingsInput({ ...input.data, configured: input.data.configured }, null, {});
  } catch {
    return null; // missing or corrupt → treat as unconfigured
  }
}

export async function saveSettingsFile(settings: PaperspaceSettingsFile): Promise<void> {
  const path = paperspaceSettingsPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

/** True when the key governs where data lives or how the DB boots. */
export function storageAffectingKeys(): Array<keyof PaperspaceConfig> {
  return ['dataDir', 'assetsDir', 'workspaceDir', 'port', 'initialMemoryBytes'];
}

/** The sync variants exist for tests that need existence checks without await. */
export function settingsFileExists(): boolean {
  return existsSync(paperspaceSettingsPath());
}

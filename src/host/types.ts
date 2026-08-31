/**
 * Host-half type contracts — the minimal, honest shapes of the seams the
 * bundle consumes. These deliberately model ONLY what this bundle calls:
 *
 * - `ctx.fs` / `ctx.subprocess` — the capability seams, either the dsh base
 *   providers or dsh-workspace-enhancement's mixed (local ←→ remote) ones.
 * - `ctx.webServer` — the shared HTTP server the host routes register on.
 * - `ctx.effect` — Cordis lifecycle registration.
 *
 * The real implementations come from packages this bundle does not declare as
 * devDependencies, so structural typing against these local faces keeps the
 * source honest without a hard @deepseek-ai/cordis dependency.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

// ── fs seam ────────────────────────────────────────────────────────────────

/** One resolved filesystem target (local realpath or `ssh://<id>/<path>`). */
export interface FsTarget {
  targetKey: string;
  displayPath: string;
}

export type FsEntryType = "file" | "directory";

export interface FsInfo {
  type: FsEntryType;
  size?: number;
  version?: unknown;
}

export interface FsDirEntry {
  name: string;
  type: FsEntryType;
  size?: number;
  target: FsTarget;
}

/** The fs seam surface this bundle's explorer calls. */
export interface FileSystemFace {
  resolve(path: string, opts?: { cwd?: string }): Promise<FsTarget>;
  stat(target: FsTarget): Promise<FsInfo | undefined>;
  listDir(target: FsTarget): Promise<FsDirEntry[]>;
  readText(target: FsTarget): Promise<string>;
  readBytes(target: FsTarget, signal: unknown, maxBytes: number): Promise<Uint8Array>;
  writeText(target: FsTarget, content: string): Promise<unknown>;
  processPath(target: FsTarget): string;
}

// ── subprocess seam ────────────────────────────────────────────────────────

export interface SubprocessOutcome {
  exitCode: number;
  signal: unknown;
}

/** The slice of the subprocess handle the structural operations consume. */
export interface SubprocessHandle {
  collected?: {
    stderr?: {
      readFrom(offset: number): { text: string };
    };
  };
  done: Promise<SubprocessOutcome>;
}

export interface SubprocessSpawnSpec {
  argv: string[];
  cwd?: string;
  stdio: unknown;
  graceMs?: number;
}

export interface SubprocessFace {
  spawn(spec: SubprocessSpawnSpec): SubprocessHandle;
}

// ── webServer / context ────────────────────────────────────────────────────

export type WebServerRoute = {
  kind: "exact" | "prefix";
  path: string;
  handler: (req: IncomingMessage, res: ServerResponse) => unknown;
};

export interface WebServer {
  register(route: WebServerRoute, label?: string): unknown;
}

/** The capability bag the explorer host half consumes (`ctx.get` only). */
export interface ServiceBag {
  get(name: string): unknown;
}

/** The full host-plugin context the bundle's `apply(ctx)` receives. */
export interface HostContext extends ServiceBag {
  effect(fn: () => unknown, label?: string): unknown;
  webServer: WebServer;
}

// ── bundle config ──────────────────────────────────────────────────────────

export interface ExplorerLimits {
  maxListEntries: number;
  maxReadBytes: number;
  maxRawBytes: number;
  structuralGraceMs: number;
  stderrTailBytes: number;
}

export interface BundleConfig {
  makefile?: string;
  explorer?: Partial<ExplorerLimits>;
}

/** One JSON-RPC call's parameter object (fields are validated per method). */
export interface ExplorerParams {
  cwd?: string;
  path?: string;
  name?: string;
  from?: string;
  to?: string;
  content?: string;
}

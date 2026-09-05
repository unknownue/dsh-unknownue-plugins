/**
 * Paperspace host-half type contracts.
 *
 * The paperspace feature is a subpath host row of this bundle
 * (`dsh-unknownue-plugins/paperspace`). It models ONLY the seams it consumes:
 *
 * - `ctx.webServer` — DSH's shared HTTP server (REST + SSE routes),
 * - `ctx.effect`   — Cordis lifecycle registration (disposal of DB/loops),
 * - `ctx.provide`  — optional service export for sibling plugins.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface PaperspaceConfig {
  /** PGlite data directory (empty string → ~/.dsh/paperspace/db). */
  dataDir: string;
  /** Local object-store root (empty string → ~/.dsh/paperspace/assets). */
  assetsDir: string;
  /** DSH workspace anchor + materialized papers (`<workspace>/papers/*.md`). */
  workspaceDir: string;
  /** pgwire listen port; 0 asks the OS for a free loopback port. */
  port: number;
  /** PGlite WASM initial memory in BYTES (see spike note: not MB/pages). */
  initialMemoryBytes: number;
  /** Worker poll interval in ms (ingest + translation loops). */
  pollMs: number;
  /** Per-request timeout for arXiv metadata/HTML fetches. */
  ingestTimeoutMs: number;
  /** Max bytes per downloaded paper image asset. */
  maxAssetBytes: number;
  /** Concurrent image downloads during ingest. */
  ingestConcurrency: number;
  /** Max translation attempts before a job fails permanently. */
  translateMaxAttempts: number;
  /** Running jobs older than this (minutes) are re-queued. */
  translateStuckAfterMinutes: number;
  /** Per-LLM-request timeout for translation calls. */
  translateTimeoutMs: number;
  /** Stuck-job rescan interval in ms. */
  rescanIntervalMs: number;
  /**
   * Translation model selection persisted in settings: a DSH provider route
   * + model id (models currently available in DSH). null = not configured.
   */
  translateModel: { provider: string; model: string } | null;
}

export type PartialPaperspaceConfig = Partial<PaperspaceConfig>;

export interface WebRoute {
  kind: 'exact' | 'prefix';
  path: string;
  handler: (req: IncomingMessage, res: ServerResponse) => unknown;
}

export interface WebServerFace {
  register(route: WebRoute): () => void;
}

/** The host-plugin context the paperspace `apply(ctx)` receives. */
export interface PaperspaceHostContext {
  effect(fn: () => unknown, label?: string): unknown;
  provide?(name: string, value: unknown): unknown;
  webServer: WebServerFace;
  /** Cordis service lookup (sessions / workspaceRegistry / tools are optional). */
  get?(name: string, optional?: boolean): unknown;
}

// ── gated host facade (implemented in index.ts) ────────────────────────────
// Type-only imports keep this module free of runtime cycles.
import type { PaperspaceRuntime } from './db';
import type { FileObjectStore } from './filestore';
import type { PaperspaceSettingsFile, PaperspaceSettingsInput } from './settings';
import type { DshServices } from './dsh-integration';

export interface PaperspaceState {
  /** True once the user persisted `configured: true` in settings. */
  configured: boolean;
  /** A saved change that only takes effect after `dsh web` restarts. */
  restartRequired: boolean;
  settingsPath: string;
}

export interface PaperspaceActive {
  config: PaperspaceConfig;
  runtime: PaperspaceRuntime;
  store: FileObjectStore;
}

export type PaperspaceSaveResult =
  | { ok: true; configured: boolean; restartRequired: boolean }
  | { ok: false; error: string };

/** Worker-loop liveness snapshot, surfaced through GET /health. */
export interface PaperspaceWorkerSnapshot {
  /** Last timestamp (ms) the translation loop ticked. */
  translateTickAt: number;
  /** Last timestamp (ms) a translation job was claimed. */
  lastClaimAt: number;
  /** Last error the translation loop hit (empty when none). */
  lastError: string;
}

export interface PaperspaceHost {
  state: PaperspaceState;
  /** Patch/builtin-merged defaults (settings form's initial values). */
  row: PaperspaceConfig;
  file(): PaperspaceSettingsFile | null;
  ensureStarted(): Promise<PaperspaceActive>;
  active(): PaperspaceActive | null;
  save(input: PaperspaceSettingsInput): Promise<PaperspaceSaveResult>;
  /** Worker-loop liveness for GET /health (null before the runtime boots). */
  workerSnapshot?(): PaperspaceWorkerSnapshot | null;
  /** Rebuild the sessionId→paper-context cache after a link changed. */
  refreshPaperContexts?(): Promise<void>;
  /** Name the session after its linked paper (explicit title via dsh-session-title). */
  renameSession?(sessionId: string, title: string): Promise<void>;
  /** Diagnostics for the paperspace integration (links + injection state). */
  debug?(): {
    configured: boolean;
    toolsRegistered: boolean;
    contextProviderRegistered: boolean;
    systemPromptFound: boolean;
    agentsFound: boolean;
    contextCacheKeys: string[];
    providerStats: {
      calls: number;
      scopePresent: number;
      agents: number;
      matched: number;
      lastSessionIds: string[];
    };
  };
  /** DSH services feature-detected from the host context (all optional). */
  dsh: DshServices;
}

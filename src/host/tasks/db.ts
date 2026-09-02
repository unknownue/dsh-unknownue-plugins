/**
 * Task-board storage runtime: an in-process PGlite (WASM PostgreSQL) instance
 * owned by the cordis lifecycle. Unlike paperspace, the board talks to PGlite
 * through its native `query` API directly — no pgwire socket, no postgres.js,
 * nothing else in the loop.
 *
 * `dataDir: ''` boots an in-memory database (integration tests only); a real
 * directory persists across restarts and is what the settings page configures.
 */
import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { SCHEMA_SQL } from './schema';
import type { TasksConfig } from './types';

export interface TasksRuntime {
  /** Resolves once PGlite is booted and the schema is migrated. */
  readonly ready: Promise<void>;
  /** Parameterized query ($1, $2, …); resolves after `ready`. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** Best-effort shutdown; idempotent. */
  dispose(): void;
}

export function createTasksRuntime(config: TasksConfig): TasksRuntime {
  if (config.dataDir !== '') {
    // PGlite requires the data directory to exist (it does not mkdir -p).
    mkdirSync(config.dataDir, { recursive: true });
  }
  const options: { dataDir?: string; initialMemory: number } = {
    initialMemory: config.initialMemoryBytes,
  };
  if (config.dataDir !== '') options.dataDir = config.dataDir;
  const pglite = new PGlite(options);

  let disposed = false;
  const ready = (async () => {
    await pglite.waitReady;
    await pglite.exec(SCHEMA_SQL);
  })();

  return {
    ready,
    async query<T>(sql: string, params?: unknown[]) {
      await ready;
      if (disposed) throw new Error('tasks runtime is disposed');
      const result = await pglite.query<T>(sql, params);
      return { rows: result.rows };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      void pglite.close().catch(() => {
        // best effort
      });
    },
  };
}

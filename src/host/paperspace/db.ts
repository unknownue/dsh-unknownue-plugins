/**
 * Paperspace storage runtime: in-process PostgreSQL (PGlite/WASM) exposed over
 * a loopback pgwire socket, plus a postgres.js client with the SAME config the
 * paperspace domain layer expects (camelCase transform).
 *
 * Migrations run once on first boot (to_regclass guard); the schema itself
 * stays verbatim in schema.ts.
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import { SCHEMA_SQL, SESSION_LINKS_SQL } from './schema';
import type { PaperspaceConfig } from './types';

export interface PaperspaceRuntime {
  /** Resolves once PGlite is booted, migrated, and the socket is listening. */
  readonly ready: Promise<void>;
  /** pgwire port actually bound (valid after `ready`). */
  readonly port: number;
  /** The postgres.js client (camel transform, max 2 connections). */
  getSql(): Promise<Sql>;
  /** Best-effort shutdown: socket server → client → PGlite. Idempotent. */
  dispose(): void;
}

export function createPaperspaceRuntime(config: PaperspaceConfig): PaperspaceRuntime {
  const pglite = new PGlite({
    dataDir: config.dataDir,
    initialMemory: config.initialMemoryBytes,
    extensions: { pgcrypto },
  });
  const server = new PGLiteSocketServer({ db: pglite, port: config.port, host: '127.0.0.1' });

  let port = config.port;
  let sql: Sql | undefined;
  let serverStarted = false;
  let disposed = false;

  const ready = (async () => {
    await pglite.waitReady;
    await server.start();
    serverStarted = true;
    const bound = (server as unknown as { port: number }).port;
    if (typeof bound === 'number') port = bound;
    // First-boot migration guard: only run when the schema is absent.
    const exists = await pglite.query<{ name: string | null }>(
      `SELECT to_regclass('paper.papers') AS name`,
    );
    if (exists.rows[0]?.name === null) await pglite.exec(SCHEMA_SQL);
    // v2 additions are idempotent and run on every boot.
    await pglite.exec(SESSION_LINKS_SQL);
    sql = postgres({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      database: 'postgres',
      max: 2,
      connect_timeout: 10,
      idle_timeout: 20,
      transform: postgres.camel,
    });
  })();

  return {
    ready,
    get port() {
      return port;
    },
    async getSql() {
      await ready;
      return sql!;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      void (async () => {
        try {
          if (serverStarted) await server.stop();
        } catch {
          // best effort
        }
        try {
          if (sql) await sql.end({ timeout: 5 });
        } catch {
          // best effort
        }
        try {
          await pglite.close();
        } catch {
          // best effort
        }
      })();
    },
  };
}

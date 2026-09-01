/**
 * Ported from vendor/paperspace packages/paper-domain/src/db.ts.
 * postgres.js client factory; `transform: postgres.camel` maps snake_case
 * columns to camelCase row keys. The paperspace runtime connects this client
 * to the in-process PGlite pgwire socket (see ../db.ts).
 */
import postgres from 'postgres';
import type { Sql, TransactionSql } from 'postgres';

export type { Sql, TransactionSql };

/** Anything that can execute queries — a pooled client or a transaction handle. */
export type Queryable = Sql | TransactionSql;

/**
 * Create a pooled PostgreSQL client bound to the `paper` schema.
 * `transform: postgres.camel` maps snake_case columns to camelCase row keys.
 */
export function createDb(databaseUrl: string): Sql {
  return postgres(databaseUrl, {
    max: 8,
    connect_timeout: 10,
    idle_timeout: 20,
    transform: postgres.camel,
  });
}

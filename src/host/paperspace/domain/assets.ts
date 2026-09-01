/**
 * Ported verbatim from vendor/paperspace packages/paper-domain/src/assets.ts
 * (import specifiers adjusted to bundle-local resolution).
 */
import type { Queryable } from './db';
import type { AssetRow } from './types';

export interface NewAsset {
  originalUrl: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
}

export interface AssetRepo {
  /**
   * Insert assets for a paper. Deterministic object keys make re-ingestion
   * safe: conflicts update the row and still return it.
   */
  insertMany(paperId: string, assets: NewAsset[]): Promise<Array<{ id: string; originalUrl: string }>>;
  listByPaper(paperId: string): Promise<AssetRow[]>;
  findByPaperAndId(paperId: string, assetId: string): Promise<AssetRow | null>;
  keysByPaper(paperId: string): Promise<string[]>;
}

export function createAssetRepo(sql: Queryable): AssetRepo {
  return {
    async insertMany(paperId, assets) {
      if (assets.length === 0) return [];
      const values = assets.map(asset =>
        [paperId, asset.originalUrl, asset.objectKey, asset.contentType, asset.sizeBytes] as (string | number)[],
      );
      const rows: Array<{ id: string; originalUrl: string }> = await sql`
        INSERT INTO paper.assets (paper_id, original_url, object_key, content_type, size_bytes)
        VALUES ${sql(values)}
        ON CONFLICT (object_key) DO UPDATE
          SET size_bytes = EXCLUDED.size_bytes, content_type = EXCLUDED.content_type
        RETURNING id, original_url`;
      return rows;
    },

    async listByPaper(paperId) {
      return sql<AssetRow[]>`
        SELECT * FROM paper.assets
        WHERE paper_id = ${paperId}
        ORDER BY created_at ASC, id ASC`;
    },

    async findByPaperAndId(paperId, assetId) {
      const rows = await sql<AssetRow[]>`
        SELECT * FROM paper.assets
        WHERE paper_id = ${paperId} AND id = ${assetId}
        LIMIT 1`;
      return rows[0] ?? null;
    },

    async keysByPaper(paperId) {
      const rows = await sql<Array<{ objectKey: string }>>`
        SELECT object_key FROM paper.assets WHERE paper_id = ${paperId}`;
      return rows.map(row => row.objectKey);
    },
  };
}

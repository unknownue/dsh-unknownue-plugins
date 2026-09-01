/**
 * Local filesystem object store — drop-in replacement for paperspace's MinIO
 * `ObjectStore` (same five-method surface, same `papers/{arxivId}/{sha1[:16]}.{ext}`
 * deterministic keys). Paper assets live under the configured `assetsDir`.
 */
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { Readable } from 'node:stream';

/** The object-store surface the paperspace domain/worker code consumes. */
export interface ObjectStoreFace {
  ensureBucket(): Promise<void>;
  putObject(key: string, data: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<Readable>;
  deleteObject(key: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
}

export class FileObjectStore implements ObjectStoreFace {
  private ready: Promise<void> | null = null;

  constructor(private readonly root: string) {}

  /** Idempotently create the root directory on first use. */
  ensureBucket(): Promise<void> {
    this.ready ??= mkdir(this.root, { recursive: true }).then(() => undefined);
    return this.ready;
  }

  /** Resolve an object key inside the root; keys are code-generated, this is belt-and-braces. */
  private keyPath(key: string): string {
    const path = resolve(this.root, key);
    const rel = relative(this.root, path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('invalid object key');
    return path;
  }

  async putObject(key: string, data: Buffer, _contentType: string): Promise<void> {
    await this.ensureBucket();
    const path = this.keyPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  /** Rejects with ENOENT when the key is missing (same contract as MinIO). */
  async getObject(key: string): Promise<Readable> {
    await this.ensureBucket();
    const path = this.keyPath(key);
    await stat(path);
    return createReadStream(path);
  }

  async deleteObject(key: string): Promise<void> {
    await this.ensureBucket();
    await rm(this.keyPath(key), { force: true });
  }

  /** Best-effort batch delete; failures are logged and do not throw. */
  async deleteObjects(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.deleteObject(key);
      } catch (error) {
        console.warn(`[paperspace:object-store] deleteObject failed for ${key}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
}

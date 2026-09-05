/**
 * Ported verbatim from vendor/paperspace apps/worker/src/images.ts
 * (import specifiers adjusted to bundle-local resolution).
 */
import { createHash } from 'node:crypto';
import type { NewAsset } from '../domain/assets';
import type { ObjectStoreFace } from '../filestore';

const USER_AGENT = 'paperspace-ingest/0.1 (academic paper reader)';

// ![alt](url) — url may be wrapped in angle brackets by some converters.
const MD_IMG_RE = /!\[[^\]]*\]\((?:<)?([^)>\s]+)(?:>)?\)/g;
const HTML_IMG_RE = /<img[^>]*\ssrc="([^"]+)"/gi;

/** Image URLs referenced by the markdown, as written (possibly relative). */
export function extractImageUrls(markdown: string): string[] {
  const urls: string[] = [];
  const push = (url: string) => {
    if (url && !url.startsWith('data:') && !urls.includes(url)) urls.push(url);
  };
  for (const match of markdown.matchAll(MD_IMG_RE)) push(match[1]);
  for (const match of markdown.matchAll(HTML_IMG_RE)) push(match[1]);
  return urls;
}

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
};

const KNOWN_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:[?#]|$)/i;

function guessContentType(url: string): string {
  const match = url.match(KNOWN_EXT);
  const ext = match?.[1]?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext) return `image/${ext}`;
  return 'image/png';
}

/** Deterministic object key: papers/{arxivId}/{sha1(url)[:16]}.{ext} */
function objectKey(arxivId: string, url: string, contentType: string): string {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  const ext = EXT_BY_CONTENT_TYPE[mime] ?? 'png';
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 16);
  return `papers/${arxivId}/${hash}.${ext}`;
}

export interface StoreImagesResult {
  /** Uploaded asset metadata ready for the database. */
  assets: NewAsset[];
}

/**
 * Download every image referenced by the markdown and upload it to the object
 * store. Downloads run with `concurrency` workers; per-image failures
 * (timeout, HTTP error, non-image, over size limit) are skipped, never fatal.
 */
export async function storeImages(params: {
  arxivId: string;
  markdown: string;
  store: ObjectStoreFace;
  baseUrl: string;
  maxBytes: number;
  timeoutMs: number;
  concurrency: number;
}): Promise<StoreImagesResult> {
  const { arxivId, markdown, store, baseUrl, maxBytes, timeoutMs, concurrency } = params;
  const urls = extractImageUrls(markdown);
  const entries = await mapLimit(urls, concurrency, async url => {
    let absolute: string;
    try {
      absolute = new URL(url, baseUrl).href;
    } catch {
      return null;
    }
    try {
      const response = await fetch(absolute, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': USER_AGENT },
      });
      if (!response.ok) return null;
      const contentType = (response.headers.get('content-type') ?? guessContentType(absolute)).split(';')[0].trim();
      if (!contentType.startsWith('image/')) return null;
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length === 0 || data.length > maxBytes) return null;
      const key = objectKey(arxivId, absolute, contentType);
      await store.putObject(key, data, contentType);
      return { originalUrl: absolute, objectKey: key, contentType, sizeBytes: data.length };
    } catch {
      return null;
    }
  });
  return { assets: entries.filter((entry): entry is NewAsset => entry !== null) };
}

/**
 * Rewrite image references in the markdown to app-local asset URLs.
 * `urlMap` maps absolute URLs to local URLs; relative references are resolved
 * against `baseUrl` before lookup. When an image was not stored (download
 * failure, non-image, over size limit), the reference is instead rewritten to
 * its ABSOLUTE source URL — otherwise a relative src would resolve against
 * the reader page URL and render as a broken "current page" link.
 */
export function rewriteImageUrls(markdown: string, urlMap: Map<string, string>, baseUrl: string): string {
  const targetOf = (url: string): string | undefined => {
    const direct = urlMap.get(url);
    if (direct) return direct;
    try {
      return urlMap.get(new URL(url, baseUrl).href);
    } catch {
      return undefined;
    }
  };
  const rewrite = (full: string, url: string): string => {
    const target = targetOf(url);
    if (target) return full.replace(url, target);
    try {
      const absolute = new URL(url, baseUrl).href;
      if (absolute !== url) return full.replace(url, absolute);
    } catch {
      /* leave the reference as-is */
    }
    return full;
  };
  return markdown
    .replace(MD_IMG_RE, (full, url: string) => rewrite(full, url))
    .replace(HTML_IMG_RE, (full, url: string) => rewrite(full, url));
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

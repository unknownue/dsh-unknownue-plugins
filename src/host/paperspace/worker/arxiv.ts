/**
 * Ported verbatim from vendor/paperspace apps/worker/src/arxiv.ts
 * (import specifiers adjusted to bundle-local resolution).
 */
import { XMLParser } from 'fast-xml-parser';
import type { PaperMetadata } from '../domain/types';

const USER_AGENT = 'paperspace-ingest/0.1 (academic paper reader)';

function fetchWithTimeout(url: string, timeoutMs: number, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': USER_AGENT, ...(init.headers ?? {}) },
  });
}

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Fetch title/authors/abstract/categories/published from the arXiv Atom API. */
export async function fetchArxivMetadata(arxivId: string, timeoutMs: number): Promise<PaperMetadata> {
  const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`;
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) throw new Error(`arXiv API returned HTTP ${response.status}`);
  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    parseTagValue: false,
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const feed = doc?.feed as Record<string, unknown> | undefined;
  const entry = feed?.entry as Record<string, unknown> | undefined;
  if (!entry) throw new Error('arXiv API returned no entry for this id');

  const title = normalize(entry.title);
  const abstract = normalize(entry.summary);
  const authors = asArray(entry.author as unknown)
    .map(author => normalize((author as Record<string, unknown>)?.name))
    .filter(Boolean);
  const categories = asArray(entry.category as unknown)
    .map(category => String((category as Record<string, unknown>)?.['@_term'] ?? ''))
    .filter(Boolean);
  const primary = (entry['arxiv:primary_category'] as Record<string, unknown> | undefined)?.['@_term'];
  if (typeof primary === 'string' && primary && !categories.includes(primary)) {
    categories.unshift(primary);
  }
  const published = normalize(entry.published);
  return { title, authors, abstract, categories, published };
}

export interface ArxivHtml {
  html: string;
  /** Base URL used to resolve relative image/asset URLs. */
  baseUrl: string;
}

/**
 * Fetch the paper HTML. Prefers arXiv's native HTML5 rendering and falls back
 * to ar5iv (LaTeX → HTML) which covers older papers.
 */
export async function fetchArxivHtml(arxivId: string, timeoutMs: number): Promise<ArxivHtml> {
  const primary = `https://arxiv.org/html/${arxivId}`;
  const primaryResponse = await fetchWithTimeout(primary, timeoutMs, {
    headers: { accept: 'text/html' },
  });
  if (primaryResponse.ok) {
    const html = await primaryResponse.text();
    if (html.includes('<body')) return { html, baseUrl: primaryResponse.url };
  }

  const fallback = `https://ar5iv.labs.arxiv.org/html/${arxivId}`;
  const fallbackResponse = await fetchWithTimeout(fallback, timeoutMs, {
    headers: { accept: 'text/html' },
  });
  if (!fallbackResponse.ok) {
    throw new Error(`HTML fetch failed: arxiv.org/html ${primaryResponse.status}, ar5iv ${fallbackResponse.status}`);
  }
  return { html: await fallbackResponse.text(), baseUrl: fallbackResponse.url };
}

/**
 * Shared proxy-aware fetch utilities for the paperspace worker.
 *
 * Node.js's native `fetch` (undici) does NOT respect HTTP_PROXY / HTTPS_PROXY
 * environment variables. This module reads the proxy URL from the paperspace
 * config (user-configurable in UnPlugin settings) and falls back to the
 * standard env vars, creating a ProxyAgent that is injected into every fetch.
 *
 * When no proxy is configured, fetch runs direct — matching the original
 * behaviour.
 */
import { ProxyAgent } from 'undici';

// undici's ProxyAgent types and the global fetch RequestInit types don't fully
// overlap (undici vs undici-types mismatch). We use `as any` at the boundary.
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Resolve the proxy URL: config wins, then env vars. */
export function resolveProxyUrl(configProxy?: string | null): string | null {
  if (configProxy && configProxy.trim()) return configProxy.trim();
  return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || null;
}

let cachedAgent: { key: string; agent: ProxyAgent } | null = null;

/** Return (and cache) a ProxyAgent for the given proxy URL, or null. */
export function getProxyAgent(proxyUrl: string | null): ProxyAgent | null {
  if (!proxyUrl) return null;
  if (cachedAgent && cachedAgent.key === proxyUrl) return cachedAgent.agent;
  const agent = new ProxyAgent(proxyUrl);
  cachedAgent = { key: proxyUrl, agent };
  return agent;
}

/** Dispose the cached agent (called on plugin unload). */
export function disposeProxyAgent(): void {
  cachedAgent?.agent.close().catch(() => {});
  cachedAgent = null;
}

/**
 * Proxy-aware fetch wrapper. Uses the paperspace config proxy first, then
 * falls back to HTTPS_PROXY / HTTP_PROXY environment variables.
 */
export function proxyFetch(
  url: string,
  init: RequestInit = {},
  proxyUrl?: string | null,
): ReturnType<typeof fetch> {
  const agent = getProxyAgent(resolveProxyUrl(proxyUrl));
  if (!agent) return fetch(url, init);
  return fetch(url, { ...init, dispatcher: agent } as any);
}

/**
 * Build a proxy-aware `fetch` function suitable for passing to
 * OpenAICompatibleProvider's `options.fetch`.
 */
export function createProxyFetchFn(proxyUrl?: string | null): typeof fetch {
  const agent = getProxyAgent(resolveProxyUrl(proxyUrl));
  if (!agent) return fetch;
  return ((url: string, init: RequestInit = {}) => {
    return fetch(url, { ...init, dispatcher: agent } as any);
  }) as typeof fetch;
}

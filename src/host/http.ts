/**
 * Shared HTTP helpers for the bundle's loopback JSON-RPC routes: the loopback
 * fence, bounded JSON-body reading, the reply envelope and the error-message
 * extractor.
 *
 * No Cordis plugin contract here: `lib/index.js` (the bundle's host row) plus
 * the feature modules `lib/explorer.js`, `lib/paperspace/routes.js` and
 * `lib/tasks/routes.js` import these functions directly.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

const MAX_BODY_BYTES = 1 << 20;

// ── loopback fence ─────────────────────────────────────────────────────────

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** Whether a socket's remote address is loopback (IPv4, IPv6 or v4-mapped). */
export function isLoopback(address: unknown): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

/** The hostname of a `Host` header value, port stripped (bracket-aware for IPv6). */
function hostNameOf(host: string): string {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end >= 0 ? host.slice(1, end) : host;
  }
  return host.split(":")[0] ?? "";
}

/** Whether a `Host` header names a loopback hostname. */
export function isLoopbackHost(host: string | undefined): boolean {
  return host !== undefined && LOOPBACK_HOSTNAMES.has(hostNameOf(host).toLowerCase());
}

// ── reply / body helpers ───────────────────────────────────────────────────

/** The message of a thrown value, for `{ ok: false, error }` replies. */
export function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

/** Write one JSON reply with the bundle's no-store/nosniff headers. */
export function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(body));
}

/** Read a POST body as a JSON object, rejecting anything over 1 MiB. */
export async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("request body is too large");
    chunks.push(buffer);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("request body must be a JSON object");
  return parsed as Record<string, unknown>;
}

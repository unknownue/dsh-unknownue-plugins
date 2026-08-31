/**
 * JSON-RPC helper for calling host loopback routes.
 */

export async function call<T = unknown>(
  api: string,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(api, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, params }),
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const data = await response.json();
  if (!data || data.ok !== true)
    throw new Error(data && data.error ? data.error : "request failed");
  return data.value as T;
}

/** Unwrap an explorer remote envelope result, throwing on error. */
export function unwrap<T>(result: { ok: boolean; value?: T; error?: { code?: string; message: string } }): T {
  if (result.ok) return result.value as T;
  const { code, message } = result.error ?? { code: undefined, message: "unknown error" };
  const err = new Error(`${message}${code ? ` (${code})` : ""}`);
  (err as any).code = code;
  throw err;
}

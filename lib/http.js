// src/host/http.ts
var MAX_BODY_BYTES = 1 << 20;
var LOOPBACK_HOSTNAMES = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1"]);
function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
function hostNameOf(host) {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end >= 0 ? host.slice(1, end) : host;
  }
  return host.split(":")[0] ?? "";
}
function isLoopbackHost(host) {
  return host !== void 0 && LOOPBACK_HOSTNAMES.has(hostNameOf(host).toLowerCase());
}
function messageOf(value) {
  return value instanceof Error ? value.message : String(value);
}
function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("request body is too large");
    chunks.push(buffer);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("request body must be a JSON object");
  return parsed;
}
export {
  isLoopback,
  isLoopbackHost,
  json,
  messageOf,
  readBody
};

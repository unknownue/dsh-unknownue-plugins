// src/host/makefile.ts
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
var MAX_BODY_BYTES = 1 << 20;
function isValidTarget(name) {
  if (name.includes("%") || name.startsWith(".")) return false;
  return /^[A-Za-z0-9_\-./$(){}]+$/.test(name);
}
function parseMakefile(content) {
  const targets = /* @__PURE__ */ new Map();
  let defaultTarget = null;
  let pendingHelp = null;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    const helpLine = /^##\s*(.*)$/.exec(trimmed);
    if (helpLine) {
      pendingHelp = helpLine[1].trim();
      continue;
    }
    if (trimmed === "") {
      pendingHelp = null;
      continue;
    }
    if (trimmed.startsWith("#")) continue;
    if (/^\s/.test(line)) continue;
    const phony = /^\.PHONY\s*:\s*(.*)$/.exec(trimmed);
    if (phony) {
      for (const target of phony[1].trim().split(/\s+/).filter(Boolean)) {
        if (!isValidTarget(target)) continue;
        if (!targets.has(target)) targets.set(target, null);
      }
      continue;
    }
    if (/^(?:export\s+)?[A-Za-z0-9_\-.]+\s*[:?+]?=/.test(trimmed)) continue;
    if (/^(?:include|sinclude|-include|ifeq|ifneq|ifdef|ifndef|else|endif|define|endef|override|unexport|vpath)\b/.test(trimmed)) continue;
    const match = /^([^#:=]+):(?!=)(?!\/)(.*)$/.exec(trimmed);
    if (!match) continue;
    const namesPart = match[1];
    const rest = match[2];
    const inlineHelp = /##\s*(.*)$/.exec(rest);
    const help = inlineHelp ? inlineHelp[1].trim() : null;
    const names = namesPart.trim().split(/\s+/).filter(Boolean);
    if (names.length === 0) continue;
    for (const target of names) {
      if (!isValidTarget(target)) continue;
      if (defaultTarget === null) defaultTarget = target;
      const existing = targets.get(target);
      if (existing === void 0) targets.set(target, help ?? pendingHelp);
      else if (existing === null && help !== null) targets.set(target, help);
    }
    pendingHelp = null;
  }
  return {
    targets: [...targets.entries()].map(([name, help]) => ({ name, help })).sort((a, b) => a.name.localeCompare(b.name)),
    defaultTarget
  };
}
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
async function listTargets({ workdir, makefile }) {
  const base = typeof workdir === "string" && workdir !== "" ? workdir : process.cwd();
  const makefilePath = isAbsolute(makefile) ? makefile : resolve(base, makefile);
  const content = await readFile(makefilePath, "utf8");
  const { targets, defaultTarget } = parseMakefile(content);
  return { makefile, path: makefilePath, targets, defaultTarget };
}
async function makefileDispatch(config, method, params) {
  switch (method) {
    case "listTargets":
      return listTargets({
        workdir: typeof params.workdir === "string" ? params.workdir : void 0,
        makefile: typeof params.makefile === "string" && params.makefile !== "" ? params.makefile : config.makefile
      });
    default:
      throw new Error(`unknown method "${method}"`);
  }
}
export {
  isLoopback,
  isLoopbackHost,
  json,
  makefileDispatch,
  messageOf,
  parseMakefile,
  readBody
};

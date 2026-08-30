/**
 * Feature #1 helper module — pure Makefile parsing + host route dispatch.
 * No Cordis plugin contract here: lib/index.js wires these functions into the
 * host plugin row (whose name is the package name, as the client module system
 * requires).
 *
 * Display-only: it lists targets (with `##` help and the default target). It
 * deliberately does NOT execute make.
 */
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

const MAX_BODY_BYTES = 1 << 20;

/** Whether a name looks like a real build target (no `%`, no dot targets, no stray chars like `\`). */
function isValidTarget(name) {
  if (name.includes("%") || name.startsWith(".")) return false;
  return /^[A-Za-z0-9_\-./$(){}]+$/.test(name);
}

/**
 * Parse a Makefile's explicit targets plus `##` help comments. Pure, read-once,
 * no polling. Returns targets sorted by name, plus the default target (the
 * first real target in file order).
 */
export function parseMakefile(content) {
  const targets = new Map();
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
    // Indented lines are recipes, not target definitions.
    if (/^\s/.test(line)) continue;

    // .PHONY: a b c — its names are real build targets.
    const phony = /^\.PHONY\s*:\s*(.*)$/.exec(trimmed);
    if (phony) {
      for (const target of phony[1].trim().split(/\s+/).filter(Boolean)) {
        if (!isValidTarget(target)) continue;
        if (!targets.has(target)) targets.set(target, null);
      }
      continue;
    }

    // Skip variable assignments and directives.
    if (/^(?:export\s+)?[A-Za-z0-9_\-.]+\s*[:?+]?=/.test(trimmed)) continue;
    if (/^(?:include|sinclude|-include|ifeq|ifneq|ifdef|ifndef|else|endif|define|endef|override|unexport|vpath)\b/.test(trimmed)) continue;

    // Generic target definition: `targets: [prereqs] [## help]`.
    // `(?!=)` skips `:=` assignments; `(?!\/)` skips URLs (`http://`, `file://`).
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
      if (existing === undefined) targets.set(target, help ?? pendingHelp);
      else if (existing === null && help !== null) targets.set(target, help);
    }
    pendingHelp = null;
  }
  return {
    targets: [...targets.entries()]
      .map(([name, help]) => ({ name, help }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    defaultTarget
  };
}

// ── HTTP helpers (loopback fence, bounded JSON body) ────────────────────────
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1"]);
export function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
function hostNameOf(host) {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end >= 0 ? host.slice(1, end) : host;
  }
  return host.split(":")[0] ?? "";
}
export function isLoopbackHost(host) {
  return host !== undefined && LOOPBACK_HOSTNAMES.has(hostNameOf(host).toLowerCase());
}
export function messageOf(value) {
  return value instanceof Error ? value.message : String(value);
}
export function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(body));
}
export async function readBody(req) {
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

// ── route dispatch ──────────────────────────────────────────────────────────
async function listTargets({ workdir, makefile }) {
  const base = typeof workdir === "string" && workdir !== "" ? workdir : process.cwd();
  const makefilePath = isAbsolute(makefile) ? makefile : resolve(base, makefile);
  const content = await readFile(makefilePath, "utf8");
  const { targets, defaultTarget } = parseMakefile(content);
  return { makefile, path: makefilePath, targets, defaultTarget };
}

/** Dispatch one JSON-RPC method. Display-only: `listTargets` only. */
export async function makefileDispatch(config, method, params) {
  switch (method) {
    case "listTargets":
      return listTargets({
        workdir: typeof params.workdir === "string" ? params.workdir : undefined,
        makefile: typeof params.makefile === "string" && params.makefile !== "" ? params.makefile : config.makefile
      });
    default:
      throw new Error(`unknown method "${method}"`);
  }
}

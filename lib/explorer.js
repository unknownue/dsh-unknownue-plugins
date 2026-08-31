/**
 * Feature #7 helper module — remote-aware file explorer (host half).
 *
 * All reads/writes go through the `ctx.fs` capability seam: with
 * dsh-workspace-enhancement mounted, the mixed provider routes every call by
 * its working directory, so a remote session's cwd (`ssh://<id>/<path>` or the
 * local `dsw-routes/<id>/…` placeholder) transparently serves the remote
 * machine over SFTP. The ONLY hard requirement is that the client passes the
 * session cwd verbatim as the `cwd` parameter — the mixed provider resolves
 * `path` against it (see dsh-workspace-enhancement's mixed.js).
 *
 * Structural operations (mkdir / touch / rename / delete) are deliberately
 * absent from the fs seam, so:
 *   - local world  → node:fs on the resolved absolute path;
 *   - remote world → ctx.subprocess spawn (routes to the server; argv items
 *     are shell-quoted by the remote runtime itself, process.js buildCommand).
 *
 * Permission gates from dsh-workspace-enhancement apply unchanged: a
 * `fs: 'r'` side workspace rejects writeText at the seam; `exec: 'off'`
 * rejects spawn. Errors are surfaced as-is to the UI.
 *
 * No Cordis plugin contract here: lib/index.js wires this dispatch into the
 * bundle's single host row (name == package name).
 */
import { watch } from "node:fs";
import { promises as nodeFs } from "node:fs";
import { extname, join } from "node:path";
import { join as posixJoin } from "node:path/posix";
import { messageOf } from "./makefile.js";
import { openDirectory } from "./platform.js";

/** Per-operation caps (config-overridable via the bundle row's `explorer` config). */
const DEFAULTS = {
  maxListEntries: 1000,
  maxReadBytes: 1 * 1024 * 1024,
  maxRawBytes: 8 * 1024 * 1024,
  structuralGraceMs: 8000,
  stderrTailBytes: 8192,
};

const MIME = {
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8",
  ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".json": "application/json", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".xml": "application/xml", ".yaml": "text/yaml", ".yml": "text/yaml",
  ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".bmp": "image/bmp", ".ico": "image/x-icon", ".avif": "image/avif",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".flac": "audio/flac", ".m4a": "audio/mp4",
};

/** The world a resolved target lives in: `remote` = ssh:// target keys. */
export function worldOf(target) {
  return String(target?.targetKey ?? "").startsWith("ssh://") ? "remote" : "local";
}

/** Resolve the two seams lazily; honest errors when they are not mounted. */
function servicesOf(ctx) {
  const fs = ctx.get("fs");
  if (fs === undefined) {
    throw new Error("explorer: fs service is not mounted (expected the dsh base fs provider or dsh-workspace-enhancement)");
  }
  return { fs, subprocess: ctx.get("subprocess") };
}

function limitsOf(config) {
  const cfg = config?.explorer ?? {};
  return {
    maxListEntries: Number(cfg.maxListEntries) > 0 ? Number(cfg.maxListEntries) : DEFAULTS.maxListEntries,
    maxReadBytes: Number(cfg.maxReadBytes) > 0 ? Number(cfg.maxReadBytes) : DEFAULTS.maxReadBytes,
    maxRawBytes: Number(cfg.maxRawBytes) > 0 ? Number(cfg.maxRawBytes) : DEFAULTS.maxRawBytes,
    structuralGraceMs: Number(cfg.structuralGraceMs) > 0 ? Number(cfg.structuralGraceMs) : DEFAULTS.structuralGraceMs,
    stderrTailBytes: Number(cfg.stderrTailBytes) > 0 ? Number(cfg.stderrTailBytes) : DEFAULTS.stderrTailBytes,
  };
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  if (value.includes("\0")) throw new Error(`${field} must not contain NUL`);
  return value;
}

function cwdOf(params) {
  return typeof params.cwd === "string" && params.cwd.trim() !== "" ? params.cwd : undefined;
}

/**
 * Parse a remote-world spelling into `{ id, path }`:
 *   - `ssh://<id>/<posix abs>`
 *   - the local `dsw-routes/<id>/<…>` placeholder tree (a remote session's
 *     header cwd lives here)
 *   - the legacy `dsh-ssh-routes/<id>/<…>` tree
 * Returns null for anything else (plain local paths, plain remote posix paths).
 *
 * The mixed provider routes on the cwd, then joins `path` onto the route base
 * with posix.resolve — so a remote-world spelling must NEVER reach
 * `fs.resolve` as the `path` argument: it would be treated as a relative path
 * and produce garbage (the "not a directory: <placeholder>" failure). This
 * helper lets us normalize the spelling to the plain remote posix path first.
 */
export function parseRemoteSpelling(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const route = /^ssh:\/\/([^/]+)(\/.*)$/.exec(value.trim());
  if (route) return { id: route[1], path: route[2] };
  const placeholder = /(?:^|[\\/])(?:dsw-routes|dsh-ssh-routes)[\\/]([^\\/]+)[\\/](.*)$/.exec(value);
  if (placeholder) return { id: placeholder[1], path: "/" + placeholder[2].replaceAll("\\", "/") };
  return null;
}

/** The registry id of a resolved remote target, or null. */
export function routeIdOf(target) {
  const m = /^ssh:\/\/([^/]+)\//.exec(String(target?.targetKey ?? ""));
  return m ? m[1] : null;
}

/**
 * Resolve a client-supplied path against the fs seam.
 * When the path itself carries a remote spelling (ssh:// route or a local
 * placeholder tree), it is normalized to the plain remote posix path and the
 * cwd is pinned onto the same machine's route (`ssh://<id>/`) whenever the
 * caller's cwd is local or names a different machine.
 */
async function resolveValue(fs, params, value) {
  const cwd = cwdOf(params);
  const remote = parseRemoteSpelling(value);
  if (remote !== null) {
    const cwdRoute = cwd !== undefined ? parseRemoteSpelling(cwd) : null;
    const pinned = cwdRoute === null || cwdRoute.id !== remote.id ? `ssh://${remote.id}/` : cwd;
    return fs.resolve(remote.path, { cwd: pinned });
  }
  return fs.resolve(value, cwd !== undefined ? { cwd } : undefined);
}

async function resolveTarget(fs, params) {
  return resolveValue(fs, params, requireString(params.path, "path"));
}

/**
 * The spawn cwd for a remote structural operation: the caller's cwd when it is
 * a remote spelling (placeholder / ssh://), otherwise the resolved target's
 * machine route — a local cwd must never reach the remote branch (it would
 * route the spawn into the LOCAL world instead of the server).
 */
function remoteSpawnCwd(params, target) {
  const given = cwdOf(params);
  if (given !== undefined && parseRemoteSpelling(given) !== null) return given;
  const id = routeIdOf(target);
  return id !== null ? `ssh://${id}/` : given;
}

/** Join a child name onto a parent path using the world's separator rules. */
function joinChild(world, parentPath, name) {
  const safe = String(name);
  if (safe === "" || safe.includes("/") || safe.includes("\\") || safe.includes("\0")) {
    throw new Error("name must be a plain single-path-segment string");
  }
  return world === "remote" ? posixJoin(parentPath, safe) : join(parentPath, safe);
}

// ── structural operations ───────────────────────────────────────────────────

/**
 * Run one structural command in the REMOTE world. argv items are shell-quoted
 * by the remote subprocess runtime; we never build a shell string ourselves.
 * Returns { exitCode, stderr } with a bounded stderr tail (seam contract:
 * `handle.collected.stderr.readFrom(0)`).
 */
async function runRemote(subprocess, cwd, argv, limits) {
  if (subprocess === undefined) {
    throw new Error("structural operations need the subprocess service (dsh-workspace-enhancement)");
  }
  const handle = subprocess.spawn({
    argv,
    cwd,
    stdio: { stdin: "ignore", stdout: { maxBytes: 65536 }, stderr: { maxBytes: limits.stderrTailBytes } },
    graceMs: limits.structuralGraceMs,
  });
  const outcome = await handle.done;
  let stderr = "";
  try {
    stderr = (handle.collected?.stderr?.readFrom(0)?.text ?? "").trim();
  } catch { /* collector unavailable — the exit code is still authoritative */ }
  return { exitCode: outcome.exitCode, stderr };
}

function assertRemoteSucceeded(result, operation) {
  if (result.exitCode === 0) return;
  const detail = result.stderr !== "" ? result.stderr.split("\n").slice(-4).join(" ") : `exit code ${result.exitCode}`;
  throw new Error(`${operation} failed on the remote host: ${detail}`);
}

async function makeEntry(ctx, config, params, kind) {
  const { fs } = servicesOf(ctx);
  const limits = limitsOf(config);
  const parent = await resolveTarget(fs, params);
  const parentInfo = await fs.stat(parent);
  if (parentInfo === undefined || parentInfo.type !== "directory") {
    throw new Error("parent path is not a directory");
  }
  const world = worldOf(parent);
  const name = requireString(params.name, "name");
  const full = joinChild(world, fs.processPath(parent), name);

  if (world === "local") {
    if (kind === "dir") await nodeFs.mkdir(full, { recursive: true });
    else {
      const handle = await nodeFs.open(full, "a");
      await handle.close();
    }
  } else {
    const { subprocess } = servicesOf(ctx);
    const cwd = remoteSpawnCwd(params, parent);
    const argv = kind === "dir" ? ["mkdir", "-p", "--", full] : ["touch", "--", full];
    const result = await runRemote(subprocess, cwd, argv, limits);
    assertRemoteSucceeded(result, kind === "dir" ? "mkdir" : "touch");
  }
  return { ok: true, world, path: full };
}

async function renameEntry(ctx, config, params) {
  const { fs } = servicesOf(ctx);
  const limits = limitsOf(config);
  // Source must exist: resolving it also fixes the world and the separator rules.
  const source = await resolveTarget(fs, params);
  const info = await fs.stat(source);
  if (info === undefined) throw new Error("source not found");
  const world = worldOf(source);
  const name = requireString(params.name, "name");
  const sourcePath = fs.processPath(source);
  const parentPath = world === "remote" ? posixJoin(sourcePath, "..") : join(sourcePath, "..");
  const dest = joinChild(world, parentPath, name);

  if (world === "local") {
    await nodeFs.rename(sourcePath, dest);
  } else {
    const { subprocess } = servicesOf(ctx);
    const cwd = remoteSpawnCwd(params, source);
    // `mv -T` is GNU-only; BSD/macOS reject the flag — retry without it.
    let result = await runRemote(subprocess, cwd, ["mv", "-T", "--", sourcePath, dest], limits);
    if (result.exitCode !== 0 && /invalid option|unknown option/i.test(result.stderr)) {
      result = await runRemote(subprocess, cwd, ["mv", "--", sourcePath, dest], limits);
    }
    assertRemoteSucceeded(result, "rename");
  }
  return { ok: true, world, path: dest };
}

async function deleteEntry(ctx, config, params) {
  const { fs } = servicesOf(ctx);
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === undefined) throw new Error("path not found");
  const world = worldOf(target);
  const path = fs.processPath(target);

  if (world === "local") {
    await nodeFs.rm(path, { recursive: true, force: true });
  } else {
    const { subprocess } = servicesOf(ctx);
    const result = await runRemote(subprocess, remoteSpawnCwd(params, target), ["rm", "-rf", "--", path], limits);
    assertRemoteSucceeded(result, "delete");
  }
  return { ok: true, world, path };
}

// ── method implementations ──────────────────────────────────────────────────

async function list(ctx, config, params) {
  const { fs } = servicesOf(ctx);
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === undefined || info.type !== "directory") {
    throw new Error(`not a directory: ${params.path}`);
  }
  const entries = await fs.listDir(target);
  const world = worldOf(target);
  const rows = entries.slice(0, limits.maxListEntries).map((e) => ({
    name: e.name,
    type: e.type,
    size: typeof e.size === "number" ? e.size : null,
    path: fs.processPath(e.target),
  }));
  return {
    world,
    path: fs.processPath(target),
    entries: rows,
    truncated: entries.length > limits.maxListEntries,
  };
}

async function read(ctx, config, params) {
  const { fs } = servicesOf(ctx);
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === undefined) throw new Error("not-found");
  if (info.type !== "file") throw new Error("not a file");
  const size = typeof info.size === "number" ? info.size : 0;
  if (size > limits.maxReadBytes) return { tooLarge: true, size, world: worldOf(target) };
  const content = await fs.readText(target);
  return { content, size, world: worldOf(target) };
}

async function write(ctx, _config, params) {
  const { fs } = servicesOf(ctx);
  const target = await resolveTarget(fs, params);
  if (typeof params.content !== "string") throw new Error("content must be a string");
  await fs.writeText(target, params.content);
  return { ok: true, world: worldOf(target), path: fs.processPath(target) };
}

async function raw(ctx, config, params) {
  const { fs } = servicesOf(ctx);
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === undefined) throw new Error("not-found");
  if (info.type !== "file") throw new Error("not a file");
  const size = typeof info.size === "number" ? info.size : 0;
  if (size > limits.maxRawBytes) throw new Error(`too-large: ${size} bytes exceeds the ${limits.maxRawBytes}-byte preview cap`);
  const bytes = await fs.readBytes(target, undefined, limits.maxRawBytes);
  const name = String(params.path ?? "").split(/[\\/]/).filter(Boolean).pop() || "file";
  const mime = MIME[extname(name).toLowerCase()] || "application/octet-stream";
  return { name, type: mime, size: bytes.length, base64: Buffer.from(bytes).toString("base64"), world: worldOf(target) };
}

/** Parent directory of a path, using the world's separator rules. */
export function parentPathOf(path, world) {
  const value = String(path);
  if (world === "remote") {
    const parts = value.split("/").filter(Boolean);
    parts.pop();
    return parts.length > 0 ? "/" + parts.join("/") : "/";
  }
  return /[\\/]/.test(value) ? value.replace(/[\\/][^\\/]*$/, "") : value;
}

/** Open the file's parent directory in the OS file manager (local world only). */
async function reveal(ctx, _config, params) {
  const { fs } = servicesOf(ctx);
  const target = await resolveTarget(fs, params);
  const world = worldOf(target);
  if (world !== "local") throw new Error("reveal: remote paths cannot be opened in the local file manager");
  const parent = parentPathOf(fs.processPath(target), "local");
  await openDirectory({ path: parent });
  return { ok: true, world, path: parent };
}

// ── live refresh (SSE watch channel, local-world roots only) ────────────────
// Ported from oneirictouch/dsh-explorer-editor's watcher (MIT): a recursive
// fs.watch on the pinned local root pushes debounced directory-change events
// to browser EventSource clients. Remote roots are NOT watchable from this
// host — the tree falls back to its manual refresh button.

const watchClients = new Set();
let watchRoot = null;
let watcher = null;
let watchTimer = null;
const changedDirs = new Set();

function broadcastWatch(msg) {
  const payload = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of watchClients) {
    try {
      res.write(payload);
    } catch {
      watchClients.delete(res);
    }
  }
}

function queueWatchChange(dir) {
  changedDirs.add(dir);
  if (watchTimer !== null) return;
  watchTimer = setTimeout(() => {
    watchTimer = null;
    const dirs = [...changedDirs];
    changedDirs.clear();
    if (dirs.length > 0) broadcastWatch({ dirs, rootChanged: false });
  }, 150);
}

function ensureWatchRoot(root) {
  if (watchRoot === root) return;
  if (watcher !== null) {
    try { watcher.close(); } catch { /* ignore */ }
    watcher = null;
  }
  watchRoot = root;
  try {
    watcher = watch(root, { recursive: true }, (_event, filename) => {
      const dir = filename == null ? root : parentPathOf(join(root, String(filename)), "local");
      queueWatchChange(dir);
    });
  } catch (error) {
    console.warn(`[dsh-unknownue-plugins] fs.watch unavailable for ${root}: ${messageOf(error)}`);
  }
}

function clearWatchRoot() {
  if (watcher !== null) {
    try { watcher.close(); } catch { /* ignore */ }
    watcher = null;
  }
  watchRoot = null;
  changedDirs.clear();
}

/** Register the SSE watch route (prefix) on the shared web server. */
export function registerExplorerWatch(webServer) {
  return webServer.register({
    kind: "prefix",
    path: "/dsh-unknownue-plugins/explorer/watch",
    handler: (req, res) => {
      if (req.method !== "GET") {
        res.writeHead(405, { allow: "GET" });
        res.end();
        return;
      }
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
        "x-accel-buffering": "no"
      });
      res.write("retry: 2000\n\n");
      watchClients.add(res);
      res.on("close", () => watchClients.delete(res));
    }
  });
}

/** Tear down the watch channel (plugin dispose). */
export function disposeExplorerWatch() {
  clearWatchRoot();
  if (watchTimer !== null) clearTimeout(watchTimer);
  for (const res of watchClients) {
    try { res.end(); } catch { /* ignore */ }
  }
  watchClients.clear();
}

// ── explorer-editor style full-path methods ─────────────────────────────────
// The tab UI (ported from dsh-explorer-editor) addresses files by full or
// root-relative paths; these methods resolve them through the same
// remote-aware seam as `list`/`read`/`write`.

async function statPath(ctx, _config, params) {
  const { fs } = servicesOf(ctx);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === undefined) throw new Error("not-found");
  return {
    path: fs.processPath(target),
    type: info.type,
    size: typeof info.size === "number" ? info.size : undefined,
    world: worldOf(target)
  };
}

async function resolvePath(ctx, _config, params) {
  const { fs } = servicesOf(ctx);
  const target = await resolveTarget(fs, params);
  return { path: fs.processPath(target), world: worldOf(target) };
}

/** Binary-safe inline read as a data URL (markdown image preview). */
async function readDataUrl(ctx, config, params) {
  const { fs } = servicesOf(ctx);
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === undefined) throw new Error("not-found");
  if (info.type !== "file") throw new Error("not a file");
  const size = typeof info.size === "number" ? info.size : 0;
  if (size > limits.maxRawBytes) throw new Error(`file too large to inline (${size} bytes)`);
  const bytes = await fs.readBytes(target, undefined, limits.maxRawBytes);
  const name = String(params.path ?? "").split(/[\\/]/).filter(Boolean).pop() || "file";
  const mime = MIME[extname(name).toLowerCase()] || "application/octet-stream";
  const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  return { path: fs.processPath(target), mime, dataUrl, world: worldOf(target) };
}

/** Create a file (fails when it already exists — editor semantic). */
async function createFile(ctx, config, params) {
  const { fs } = servicesOf(ctx);
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const world = worldOf(target);
  const full = fs.processPath(target);
  if (world === "local") {
    const handle = await nodeFs.open(full, "wx").catch((error) => {
      if (String(error.code) === "EEXIST") throw new Error(`already exists: ${full}`);
      throw error;
    });
    await handle.close();
  } else {
    const { subprocess } = servicesOf(ctx);
    const cwd = remoteSpawnCwd(params, target);
    const probe = await runRemote(subprocess, cwd, ["test", "-e", full], limits);
    if (probe.exitCode === 0) throw new Error(`already exists: ${full}`);
    const result = await runRemote(subprocess, cwd, ["touch", "--", full], limits);
    assertRemoteSucceeded(result, "createFile");
  }
  return { path: full, world };
}

/** Create a directory (recursive, idempotent — editor semantic). */
async function createDirectory(ctx, config, params) {
  const { fs } = servicesOf(ctx);
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const world = worldOf(target);
  const full = fs.processPath(target);
  if (world === "local") {
    await nodeFs.mkdir(full, { recursive: true });
  } else {
    const { subprocess } = servicesOf(ctx);
    const result = await runRemote(subprocess, remoteSpawnCwd(params, target), ["mkdir", "-p", "--", full], limits);
    assertRemoteSucceeded(result, "createDirectory");
  }
  return { path: full, world };
}

/** Resolve a destination target and verify it lives in the source's world. */
async function resolveDestination(fs, params, field, sourceWorld) {
  const target = await resolveValue(fs, params, requireString(params[field], field));
  if (worldOf(target) !== sourceWorld) throw new Error("cross-world operation is not supported");
  return target;
}

/** Rename / move (full-path semantics; cross-world rejected). */
async function renamePath(ctx, config, params) {
  const { fs } = servicesOf(ctx);
  const limits = limitsOf(config);
  const source = await resolveValue(fs, params, requireString(params.from, "from"));
  const info = await fs.stat(source);
  if (info === undefined) throw new Error("source not found");
  const world = worldOf(source);
  const destTarget = await resolveDestination(fs, params, "to", world);
  const from = fs.processPath(source);
  const to = fs.processPath(destTarget);

  if (world === "local") {
    await nodeFs.rename(from, to);
  } else {
    const { subprocess } = servicesOf(ctx);
    const cwd = remoteSpawnCwd(params, source);
    let result = await runRemote(subprocess, cwd, ["mv", "-T", "--", from, to], limits);
    if (result.exitCode !== 0 && /invalid option|unknown option/i.test(result.stderr)) {
      result = await runRemote(subprocess, cwd, ["mv", "--", from, to], limits);
    }
    assertRemoteSucceeded(result, "rename");
  }
  return { from, to, world };
}

/** Copy a file or directory (recursively); fails when the destination exists. */
async function copyPath(ctx, config, params) {
  const { fs } = servicesOf(ctx);
  const limits = limitsOf(config);
  const source = await resolveValue(fs, params, requireString(params.from, "from"));
  const info = await fs.stat(source);
  if (info === undefined) throw new Error("source not found");
  const world = worldOf(source);
  const destTarget = await resolveDestination(fs, params, "to", world);
  const from = fs.processPath(source);
  const to = fs.processPath(destTarget);

  if (world === "local") {
    const exists = await nodeFs.stat(to).then(() => true).catch(() => false);
    if (exists) throw new Error(`already exists: ${to}`);
    await nodeFs.cp(from, to, { recursive: true });
  } else {
    const { subprocess } = servicesOf(ctx);
    const cwd = remoteSpawnCwd(params, source);
    const probe = await runRemote(subprocess, cwd, ["test", "-e", to], limits);
    if (probe.exitCode === 0) throw new Error(`already exists: ${to}`);
    const result = await runRemote(subprocess, cwd, ["cp", "-r", "--", from, to], limits);
    assertRemoteSucceeded(result, "copy");
  }
  return { from, to, world };
}

/** Delete a file or EMPTY directory (the client walks children first). */
async function deletePath(ctx, config, params) {
  const { fs } = servicesOf(ctx);
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === undefined) throw new Error("not-found");
  const world = worldOf(target);
  const full = fs.processPath(target);

  if (world === "local") {
    const st = await nodeFs.lstat(full);
    if (st.isDirectory()) {
      const children = await nodeFs.readdir(full);
      if (children.length > 0) throw new Error(`directory not empty: ${full}`);
      await nodeFs.rmdir(full);
    } else {
      await nodeFs.unlink(full);
    }
  } else {
    const { subprocess } = servicesOf(ctx);
    const cwd = remoteSpawnCwd(params, target);
    const result = info.type === "directory"
      ? await runRemote(subprocess, cwd, ["rmdir", "--", full], limits)
      : await runRemote(subprocess, cwd, ["rm", "--", full], limits);
    assertRemoteSucceeded(result, "delete");
  }
  return { path: full, world };
}

/** Pin the watch root (the client calls this whenever the session cwd changes). */
async function setRoot(ctx, _config, params) {
  const { fs } = servicesOf(ctx);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === undefined || info.type !== "directory") {
    throw new Error(`not a directory: ${params.path}`);
  }
  const world = worldOf(target);
  const full = fs.processPath(target);
  if (world === "local") ensureWatchRoot(full);
  else clearWatchRoot();
  return { path: full, world };
}

// ── dispatch ────────────────────────────────────────────────────────────────

export async function explorerDispatch(ctx, config, method, params = {}) {
  try {
    switch (method) {
      case "list": return await list(ctx, config, params);
      case "read": return await read(ctx, config, params);
      case "write": return await write(ctx, config, params);
      case "mkdir": return await makeEntry(ctx, config, params, "dir");
      case "touch": return await makeEntry(ctx, config, params, "file");
      case "rename": return await renameEntry(ctx, config, params);
      case "delete": return await deleteEntry(ctx, config, params);
      case "raw": return await raw(ctx, config, params);
      case "reveal": return await reveal(ctx, config, params);
      case "readDataUrl": return await readDataUrl(ctx, config, params);
      case "createFile": return await createFile(ctx, config, params);
      case "createDirectory": return await createDirectory(ctx, config, params);
      case "renamePath": return await renamePath(ctx, config, params);
      case "copyPath": return await copyPath(ctx, config, params);
      case "deletePath": return await deletePath(ctx, config, params);
      case "statPath": return await statPath(ctx, config, params);
      case "resolvePath": return await resolvePath(ctx, config, params);
      case "setRoot": return await setRoot(ctx, config, params);
      default: throw new Error(`unknown method "${method}"`);
    }
  } catch (error) {
    throw new Error(messageOf(error));
  }
}

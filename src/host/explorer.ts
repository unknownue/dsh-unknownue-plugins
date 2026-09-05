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
import { watch, type FSWatcher } from "node:fs";
import { promises as nodeFs } from "node:fs";
import { extname, join } from "node:path";
import { join as posixJoin } from "node:path/posix";
import type { ServerResponse } from "node:http";
import { messageOf } from "./makefile.js";
import { openDirectory } from "./platform.js";
import type {
  BundleConfig,
  ExplorerLimits,
  ExplorerParams,
  FileSystemFace,
  FsTarget,
  ServiceBag,
  SubprocessFace,
  WebServer,
} from "./types.js";

export type ExecutionWorld = "local" | "remote";

/** Per-operation caps (config-overridable via the bundle row's `explorer` config). */
const DEFAULTS: ExplorerLimits = {
  maxListEntries: 1000,
  maxReadBytes: 1 * 1024 * 1024,
  maxRawBytes: 8 * 1024 * 1024,
  structuralGraceMs: 8000,
  stderrTailBytes: 8192,
};

const MIME: Record<string, string> = {
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
export function worldOf(target: FsTarget | undefined): ExecutionWorld {
  return String(target?.targetKey ?? "").startsWith("ssh://") ? "remote" : "local";
}

/**
 * Resolve the two seams lazily; honest errors when they are not mounted.
 *
 * The fs comes from the LIVE SESSION whose header cwd equals the request's
 * `cwd` when one exists: a session-scoped fs (e.g. a Docker world's
 * `ctx.fs`) serves the session's real paths, whereas the host fs only sees
 * the workspace anchor — an empty directory for container workspaces, which
 * is why the file tab showed nothing. Non-session (host-level) calls fall
 * back to the host fs.
 */
function servicesOf(ctx: ServiceBag, cwd: string | undefined): { fs: FileSystemFace; subprocess: SubprocessFace | undefined } {
  let fs = ctx.get("fs") as FileSystemFace | undefined;
  if (cwd !== undefined) {
    const agents = ctx.get("agents") as unknown as
      | { list(): ReadonlyArray<{ session?: { header?: { cwd?: string } }; ctx?: ServiceBag }> }
      | undefined;
    // Windows paths are case-insensitive and separator-tolerant; match the
    // live agent by its normalized header cwd so Docker workspaces (whose
    // session cwd is the host anchor) resolve their session-scoped fs.
    const normCwd = cwd.replace(/\\/g, "/").toLowerCase();
    const agent = agents?.list().find((a) => {
      const candidate = a.session?.header?.cwd;
      return typeof candidate === "string" && candidate.replace(/\\/g, "/").toLowerCase() === normCwd;
    });
    if (agent?.ctx !== undefined) {
      const scoped = agent.ctx.get("fs") as FileSystemFace | undefined;
      if (scoped !== undefined) fs = scoped;
    }
  }
  if (fs === undefined) {
    throw new Error("explorer: fs service is not mounted (expected the dsh base fs provider or dsh-workspace-enhancement)");
  }
  return { fs, subprocess: ctx.get("subprocess") as SubprocessFace | undefined };
}

function limitsOf(config: BundleConfig): ExplorerLimits {
  const cfg = config.explorer ?? {};
  return {
    maxListEntries: Number(cfg.maxListEntries) > 0 ? Number(cfg.maxListEntries) : DEFAULTS.maxListEntries,
    maxReadBytes: Number(cfg.maxReadBytes) > 0 ? Number(cfg.maxReadBytes) : DEFAULTS.maxReadBytes,
    maxRawBytes: Number(cfg.maxRawBytes) > 0 ? Number(cfg.maxRawBytes) : DEFAULTS.maxRawBytes,
    structuralGraceMs: Number(cfg.structuralGraceMs) > 0 ? Number(cfg.structuralGraceMs) : DEFAULTS.structuralGraceMs,
    stderrTailBytes: Number(cfg.stderrTailBytes) > 0 ? Number(cfg.stderrTailBytes) : DEFAULTS.stderrTailBytes,
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  if (value.includes("\0")) throw new Error(`${field} must not contain NUL`);
  return value;
}

function cwdOf(params: ExplorerParams): string | undefined {
  return typeof params.cwd === "string" && params.cwd.trim() !== "" ? params.cwd : undefined;
}

export interface RemoteSpelling {
  id: string;
  path: string;
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
export function parseRemoteSpelling(value: unknown): RemoteSpelling | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const route = /^ssh:\/\/([^/]+)(\/.*)$/.exec(value.trim());
  if (route) return { id: route[1], path: route[2] };
  const placeholder = /(?:^|[\\/])(?:dsw-routes|dsh-ssh-routes)[\\/]([^\\/]+)[\\/](.*)$/.exec(value);
  if (placeholder) return { id: placeholder[1], path: "/" + placeholder[2].replaceAll("\\", "/") };
  return null;
}

/** The registry id of a resolved remote target, or null. */
export function routeIdOf(target: FsTarget | undefined): string | null {
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
async function resolveValue(fs: FileSystemFace, params: ExplorerParams, value: string): Promise<FsTarget> {
  const cwd = cwdOf(params);
  const remote = parseRemoteSpelling(value);
  if (remote !== null) {
    const cwdRoute = cwd !== undefined ? parseRemoteSpelling(cwd) : null;
    const pinned = cwdRoute === null || cwdRoute.id !== remote.id ? `ssh://${remote.id}/` : cwd;
    return fs.resolve(remote.path, { cwd: pinned });
  }
  // A local absolute spelling (drive letter or UNC) must resolve in the LOCAL
  // world even when the caller's cwd names a remote route: the mixed provider
  // (dsh-workspace-enhancement) routes every path by its cwd's world, so a
  // stale remote cwd would silently send `E:\...` over SFTP and fail with
  // "not a directory" (the file tab's remote→local session-switch defect).
  if (cwd !== undefined && parseRemoteSpelling(cwd) !== null) {
    if (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\")) {
      return fs.resolve(value);
    }
  }
  return fs.resolve(value, cwd !== undefined ? { cwd } : undefined);
}

async function resolveTarget(fs: FileSystemFace, params: ExplorerParams): Promise<FsTarget> {
  return resolveValue(fs, params, requireString(params.path, "path"));
}

/**
 * The spawn cwd for a remote structural operation: the caller's cwd when it is
 * a remote spelling (placeholder / ssh://), otherwise the resolved target's
 * machine route — a local cwd must never reach the remote branch (it would
 * route the spawn into the LOCAL world instead of the server).
 */
function remoteSpawnCwd(params: ExplorerParams, target: FsTarget): string | undefined {
  const given = cwdOf(params);
  if (given !== undefined && parseRemoteSpelling(given) !== null) return given;
  const id = routeIdOf(target);
  return id !== null ? `ssh://${id}/` : given;
}

/** Join a child name onto a parent path using the world's separator rules. */
function joinChild(world: ExecutionWorld, parentPath: string, name: string): string {
  const safe = String(name);
  if (safe === "" || safe.includes("/") || safe.includes("\\") || safe.includes("\0")) {
    throw new Error("name must be a plain single-path-segment string");
  }
  return world === "remote" ? posixJoin(parentPath, safe) : join(parentPath, safe);
}

/**
 * The world-appropriate absolute path for node:fs / shell operations (NOT for
 * display). In the LOCAL world that is the underlying HOST target key: a
 * Docker-backed fs exposes bind-mount host paths there, and node:fs cannot
 * open container spellings (`C:\workspace\…`). In the REMOTE world it is the
 * plain remote posix path the shell runs against.
 */
function opPath(target: FsTarget, world: ExecutionWorld, fs: FileSystemFace): string {
  return world === "remote" ? fs.processPath(target) : String(target.targetKey);
}

// ── structural operations ───────────────────────────────────────────────────

interface RemoteResult {
  exitCode: number;
  stderr: string;
}

/**
 * Run one structural command in the REMOTE world. argv items are shell-quoted
 * by the remote subprocess runtime; we never build a shell string ourselves.
 * Returns { exitCode, stderr } with a bounded stderr tail (seam contract:
 * `handle.collected.stderr.readFrom(0)`).
 */
async function runRemote(subprocess: SubprocessFace | undefined, cwd: string | undefined, argv: string[], limits: ExplorerLimits): Promise<RemoteResult> {
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

function assertRemoteSucceeded(result: RemoteResult, operation: string): void {
  if (result.exitCode === 0) return;
  const detail = result.stderr !== "" ? result.stderr.split("\n").slice(-4).join(" ") : `exit code ${result.exitCode}`;
  throw new Error(`${operation} failed on the remote host: ${detail}`);
}

async function makeEntry(ctx: ServiceBag, config: BundleConfig, params: ExplorerParams, kind: "dir" | "file"): Promise<{ ok: true; world: ExecutionWorld; path: string }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const parent = await resolveTarget(fs, params);
  const parentInfo = await fs.stat(parent);
  if (parentInfo === undefined || parentInfo.type !== "directory") {
    throw new Error("parent path is not a directory");
  }
  const world = worldOf(parent);
  const name = requireString(params.name, "name");
  const display = joinChild(world, fs.processPath(parent), name);
  const full = joinChild(world, opPath(parent, world, fs), name);

  if (world === "local") {
    if (kind === "dir") await nodeFs.mkdir(full, { recursive: true });
    else {
      const handle = await nodeFs.open(full, "a");
      await handle.close();
    }
  } else {
    const { subprocess } = servicesOf(ctx, cwdOf(params));
    const cwd = remoteSpawnCwd(params, parent);
    const argv = kind === "dir" ? ["mkdir", "-p", "--", full] : ["touch", "--", full];
    const result = await runRemote(subprocess, cwd, argv, limits);
    assertRemoteSucceeded(result, kind === "dir" ? "mkdir" : "touch");
  }
  return { ok: true, world, path: display };
}

async function renameEntry(ctx: ServiceBag, config: BundleConfig, params: ExplorerParams): Promise<{ ok: true; world: ExecutionWorld; path: string }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  // Source must exist: resolving it also fixes the world and the separator rules.
  const source = await resolveTarget(fs, params);
  const info = await fs.stat(source);
  if (info === undefined) throw new Error("source not found");
  const world = worldOf(source);
  const name = requireString(params.name, "name");
  const sourcePath = opPath(source, world, fs);
  const parentPath = world === "remote" ? posixJoin(sourcePath, "..") : join(sourcePath, "..");
  const dest = joinChild(world, parentPath, name);

  if (world === "local") {
    await nodeFs.rename(sourcePath, dest);
  } else {
    const { subprocess } = servicesOf(ctx, cwdOf(params));
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

async function deleteEntry(ctx: ServiceBag, config: BundleConfig, params: ExplorerParams): Promise<{ ok: true; world: ExecutionWorld; path: string }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === undefined) throw new Error("path not found");
  const world = worldOf(target);
  const path = opPath(target, world, fs);

  if (world === "local") {
    await nodeFs.rm(path, { recursive: true, force: true });
  } else {
    const { subprocess } = servicesOf(ctx, cwdOf(params));
    const result = await runRemote(subprocess, remoteSpawnCwd(params, target), ["rm", "-rf", "--", path], limits);
    assertRemoteSucceeded(result, "delete");
  }
  return { ok: true, world, path };
}

// ── method implementations ──────────────────────────────────────────────────

interface ListResult {
  world: ExecutionWorld;
  path: string;
  entries: Array<{ name: string; type: string; size: number | null; path: string }>;
  truncated: boolean;
}

async function list(ctx: ServiceBag, config: BundleConfig, params: ExplorerParams): Promise<ListResult> {
  const { fs } = servicesOf(ctx, cwdOf(params));
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

async function read(ctx: ServiceBag, config: BundleConfig, params: ExplorerParams): Promise<{ content: string; size: number; world: ExecutionWorld } | { tooLarge: true; size: number; world: ExecutionWorld }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
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

async function write(ctx: ServiceBag, _config: BundleConfig, params: ExplorerParams): Promise<{ ok: true; world: ExecutionWorld; path: string }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const target = await resolveTarget(fs, params);
  if (typeof params.content !== "string") throw new Error("content must be a string");
  await fs.writeText(target, params.content);
  return { ok: true, world: worldOf(target), path: fs.processPath(target) };
}

async function raw(ctx: ServiceBag, config: BundleConfig, params: ExplorerParams): Promise<{ name: string; type: string; size: number; base64: string; world: ExecutionWorld }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
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
export function parentPathOf(path: unknown, world: ExecutionWorld): string {
  const value = String(path);
  if (world === "remote") {
    const parts = value.split("/").filter(Boolean);
    parts.pop();
    return parts.length > 0 ? "/" + parts.join("/") : "/";
  }
  return /[\\/]/.test(value) ? value.replace(/[\\/][^\\/]*$/, "") : value;
}

/** Open the file's parent directory in the OS file manager (local world only). */
async function reveal(ctx: ServiceBag, _config: BundleConfig, params: ExplorerParams): Promise<{ ok: true; world: ExecutionWorld; path: string }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const target = await resolveTarget(fs, params);
  const world = worldOf(target);
  if (world !== "local") throw new Error("reveal: remote paths cannot be opened in the local file manager");
  const parent = parentPathOf(opPath(target, "local", fs), "local");
  await openDirectory({ path: parent });
  return { ok: true, world, path: parent };
}

// ── live refresh (SSE watch channel, local-world roots only) ────────────────
// Ported from oneirictouch/dsh-explorer-editor's watcher (MIT): a recursive
// fs.watch on the pinned local root pushes debounced directory-change events
// to browser EventSource clients. Remote roots are NOT watchable from this
// host — the tree falls back to its manual refresh button.

const watchClients = new Set<ServerResponse>();
let watchRoot: string | null = null;
let watcher: FSWatcher | null = null;
let watchTimer: NodeJS.Timeout | null = null;
const changedDirs = new Set<string>();

function broadcastWatch(msg: { dirs: string[]; rootChanged: boolean }): void {
  const payload = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of watchClients) {
    try {
      res.write(payload);
    } catch {
      watchClients.delete(res);
    }
  }
}

function queueWatchChange(dir: string): void {
  changedDirs.add(dir);
  if (watchTimer !== null) return;
  watchTimer = setTimeout(() => {
    watchTimer = null;
    const dirs = [...changedDirs];
    changedDirs.clear();
    if (dirs.length > 0) broadcastWatch({ dirs, rootChanged: false });
  }, 150);
}

function ensureWatchRoot(root: string): void {
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

function clearWatchRoot(): void {
  if (watcher !== null) {
    try { watcher.close(); } catch { /* ignore */ }
    watcher = null;
  }
  watchRoot = null;
  changedDirs.clear();
}

/** Register the SSE watch route (prefix) on the shared web server. */
export function registerExplorerWatch(webServer: WebServer): unknown {
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
export function disposeExplorerWatch(): void {
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

async function statPath(ctx: ServiceBag, _config: BundleConfig, params: ExplorerParams) {
  const { fs } = servicesOf(ctx, cwdOf(params));
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

async function resolvePath(ctx: ServiceBag, _config: BundleConfig, params: ExplorerParams): Promise<{ path: string; world: ExecutionWorld }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const target = await resolveTarget(fs, params);
  return { path: fs.processPath(target), world: worldOf(target) };
}

/** Binary-safe inline read as a data URL (markdown image preview). */
async function readDataUrl(ctx: ServiceBag, config: BundleConfig, params: ExplorerParams): Promise<{ path: string; mime: string; dataUrl: string; world: ExecutionWorld }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
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
async function createFile(ctx: ServiceBag, config: BundleConfig, params: ExplorerParams): Promise<{ path: string; world: ExecutionWorld }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const world = worldOf(target);
  const full = fs.processPath(target);
  const op = opPath(target, world, fs);
  if (world === "local") {
    const handle = await nodeFs.open(op, "wx").catch((error: NodeJS.ErrnoException) => {
      if (String(error.code) === "EEXIST") throw new Error(`already exists: ${full}`);
      throw error;
    });
    await handle.close();
  } else {
    const { subprocess } = servicesOf(ctx, cwdOf(params));
    const cwd = remoteSpawnCwd(params, target);
    const probe = await runRemote(subprocess, cwd, ["test", "-e", op], limits);
    if (probe.exitCode === 0) throw new Error(`already exists: ${full}`);
    const result = await runRemote(subprocess, cwd, ["touch", "--", op], limits);
    assertRemoteSucceeded(result, "createFile");
  }
  return { path: full, world };
}

/** Create a directory (recursive, idempotent — editor semantic). */
async function createDirectory(ctx: ServiceBag, config: BundleConfig, params: ExplorerParams): Promise<{ path: string; world: ExecutionWorld }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const world = worldOf(target);
  const full = fs.processPath(target);
  const op = opPath(target, world, fs);
  if (world === "local") {
    await nodeFs.mkdir(op, { recursive: true });
  } else {
    const { subprocess } = servicesOf(ctx, cwdOf(params));
    const result = await runRemote(subprocess, remoteSpawnCwd(params, target), ["mkdir", "-p", "--", op], limits);
    assertRemoteSucceeded(result, "createDirectory");
  }
  return { path: full, world };
}

/** Resolve a destination target and verify it lives in the source's world. */
async function resolveDestination(fs: FileSystemFace, params: ExplorerParams, field: "from" | "to", sourceWorld: ExecutionWorld): Promise<FsTarget> {
  const target = await resolveValue(fs, params, requireString(params[field], field));
  if (worldOf(target) !== sourceWorld) throw new Error("cross-world operation is not supported");
  return target;
}

/** Rename / move (full-path semantics; cross-world rejected). */
async function renamePath(ctx: ServiceBag, config: BundleConfig, params: ExplorerParams): Promise<{ from: string; to: string; world: ExecutionWorld }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const source = await resolveValue(fs, params, requireString(params.from, "from"));
  const info = await fs.stat(source);
  if (info === undefined) throw new Error("source not found");
  const world = worldOf(source);
  const destTarget = await resolveDestination(fs, params, "to", world);
  const from = fs.processPath(source);
  const to = fs.processPath(destTarget);
  const fromOp = opPath(source, world, fs);
  const toOp = opPath(destTarget, world, fs);

  if (world === "local") {
    await nodeFs.rename(fromOp, toOp);
  } else {
    const { subprocess } = servicesOf(ctx, cwdOf(params));
    const cwd = remoteSpawnCwd(params, source);
    let result = await runRemote(subprocess, cwd, ["mv", "-T", "--", fromOp, toOp], limits);
    if (result.exitCode !== 0 && /invalid option|unknown option/i.test(result.stderr)) {
      result = await runRemote(subprocess, cwd, ["mv", "--", fromOp, toOp], limits);
    }
    assertRemoteSucceeded(result, "rename");
  }
  return { from, to, world };
}

/** Copy a file or directory (recursively); fails when the destination exists. */
async function copyPath(ctx: ServiceBag, config: BundleConfig, params: ExplorerParams): Promise<{ from: string; to: string; world: ExecutionWorld }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const source = await resolveValue(fs, params, requireString(params.from, "from"));
  const info = await fs.stat(source);
  if (info === undefined) throw new Error("source not found");
  const world = worldOf(source);
  const destTarget = await resolveDestination(fs, params, "to", world);
  const from = fs.processPath(source);
  const to = fs.processPath(destTarget);
  const fromOp = opPath(source, world, fs);
  const toOp = opPath(destTarget, world, fs);

  if (world === "local") {
    const exists = await nodeFs.stat(toOp).then(() => true).catch(() => false);
    if (exists) throw new Error(`already exists: ${to}`);
    await nodeFs.cp(fromOp, toOp, { recursive: true });
  } else {
    const { subprocess } = servicesOf(ctx, cwdOf(params));
    const cwd = remoteSpawnCwd(params, source);
    const probe = await runRemote(subprocess, cwd, ["test", "-e", toOp], limits);
    if (probe.exitCode === 0) throw new Error(`already exists: ${to}`);
    const result = await runRemote(subprocess, cwd, ["cp", "-r", "--", fromOp, toOp], limits);
    assertRemoteSucceeded(result, "copy");
  }
  return { from, to, world };
}

/** Delete a file or EMPTY directory (the client walks children first). */
async function deletePath(ctx: ServiceBag, config: BundleConfig, params: ExplorerParams): Promise<{ path: string; world: ExecutionWorld }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === undefined) throw new Error("not-found");
  const world = worldOf(target);
  const full = fs.processPath(target);
  const op = opPath(target, world, fs);

  if (world === "local") {
    const st = await nodeFs.lstat(op);
    if (st.isDirectory()) {
      const children = await nodeFs.readdir(op);
      if (children.length > 0) throw new Error(`directory not empty: ${full}`);
      await nodeFs.rmdir(op);
    } else {
      await nodeFs.unlink(op);
    }
  } else {
    const { subprocess } = servicesOf(ctx, cwdOf(params));
    const cwd = remoteSpawnCwd(params, target);
    const result = info.type === "directory"
      ? await runRemote(subprocess, cwd, ["rmdir", "--", op], limits)
      : await runRemote(subprocess, cwd, ["rm", "--", op], limits);
    assertRemoteSucceeded(result, "delete");
  }
  return { path: full, world };
}

/** Pin the watch root (the client calls this whenever the session cwd changes). */
async function setRoot(ctx: ServiceBag, _config: BundleConfig, params: ExplorerParams): Promise<{ path: string; world: ExecutionWorld }> {
  const { fs } = servicesOf(ctx, cwdOf(params));
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

export async function explorerDispatch(ctx: ServiceBag, config: BundleConfig, method: string, params: ExplorerParams = {}): Promise<unknown> {
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

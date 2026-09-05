// src/host/explorer.ts
import { watch } from "node:fs";
import { promises as nodeFs } from "node:fs";
import { extname, join } from "node:path";
import { join as posixJoin } from "node:path/posix";
import { messageOf } from "./makefile.js";
import { openDirectory } from "./platform.js";
var DEFAULTS = {
  maxListEntries: 1e3,
  maxReadBytes: 1 * 1024 * 1024,
  maxRawBytes: 8 * 1024 * 1024,
  structuralGraceMs: 8e3,
  stderrTailBytes: 8192
};
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4"
};
function worldOf(target) {
  return String(target?.targetKey ?? "").startsWith("ssh://") ? "remote" : "local";
}
function servicesOf(ctx, cwd) {
  let fs = ctx.get("fs");
  if (cwd !== void 0) {
    const agents = ctx.get("agents");
    const normCwd = cwd.replace(/\\/g, "/").toLowerCase();
    const agent = agents?.list().find((a) => {
      const candidate = a.session?.header?.cwd;
      return typeof candidate === "string" && candidate.replace(/\\/g, "/").toLowerCase() === normCwd;
    });
    if (agent?.ctx !== void 0) {
      const scoped = agent.ctx.get("fs");
      if (scoped !== void 0) fs = scoped;
    }
  }
  if (fs === void 0) {
    throw new Error("explorer: fs service is not mounted (expected the dsh base fs provider or dsh-workspace-enhancement)");
  }
  return { fs, subprocess: ctx.get("subprocess") };
}
function limitsOf(config) {
  const cfg = config.explorer ?? {};
  return {
    maxListEntries: Number(cfg.maxListEntries) > 0 ? Number(cfg.maxListEntries) : DEFAULTS.maxListEntries,
    maxReadBytes: Number(cfg.maxReadBytes) > 0 ? Number(cfg.maxReadBytes) : DEFAULTS.maxReadBytes,
    maxRawBytes: Number(cfg.maxRawBytes) > 0 ? Number(cfg.maxRawBytes) : DEFAULTS.maxRawBytes,
    structuralGraceMs: Number(cfg.structuralGraceMs) > 0 ? Number(cfg.structuralGraceMs) : DEFAULTS.structuralGraceMs,
    stderrTailBytes: Number(cfg.stderrTailBytes) > 0 ? Number(cfg.stderrTailBytes) : DEFAULTS.stderrTailBytes
  };
}
function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  if (value.includes("\0")) throw new Error(`${field} must not contain NUL`);
  return value;
}
function cwdOf(params) {
  return typeof params.cwd === "string" && params.cwd.trim() !== "" ? params.cwd : void 0;
}
function parseRemoteSpelling(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const route = /^ssh:\/\/([^/]+)(\/.*)$/.exec(value.trim());
  if (route) return { id: route[1], path: route[2] };
  const placeholder = /(?:^|[\\/])(?:dsw-routes|dsh-ssh-routes)[\\/]([^\\/]+)[\\/](.*)$/.exec(value);
  if (placeholder) return { id: placeholder[1], path: "/" + placeholder[2].replaceAll("\\", "/") };
  return null;
}
function routeIdOf(target) {
  const m = /^ssh:\/\/([^/]+)\//.exec(String(target?.targetKey ?? ""));
  return m ? m[1] : null;
}
async function resolveValue(fs, params, value) {
  const cwd = cwdOf(params);
  const remote = parseRemoteSpelling(value);
  if (remote !== null) {
    const cwdRoute = cwd !== void 0 ? parseRemoteSpelling(cwd) : null;
    const pinned = cwdRoute === null || cwdRoute.id !== remote.id ? `ssh://${remote.id}/` : cwd;
    return fs.resolve(remote.path, { cwd: pinned });
  }
  if (cwd !== void 0 && parseRemoteSpelling(cwd) !== null) {
    if (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\")) {
      return fs.resolve(value);
    }
  }
  return fs.resolve(value, cwd !== void 0 ? { cwd } : void 0);
}
async function resolveTarget(fs, params) {
  return resolveValue(fs, params, requireString(params.path, "path"));
}
function remoteSpawnCwd(params, target) {
  const given = cwdOf(params);
  if (given !== void 0 && parseRemoteSpelling(given) !== null) return given;
  const id = routeIdOf(target);
  return id !== null ? `ssh://${id}/` : given;
}
function joinChild(world, parentPath, name) {
  const safe = String(name);
  if (safe === "" || safe.includes("/") || safe.includes("\\") || safe.includes("\0")) {
    throw new Error("name must be a plain single-path-segment string");
  }
  return world === "remote" ? posixJoin(parentPath, safe) : join(parentPath, safe);
}
function opPath(target, world, fs) {
  return world === "remote" ? fs.processPath(target) : String(target.targetKey);
}
async function runRemote(subprocess, cwd, argv, limits) {
  if (subprocess === void 0) {
    throw new Error("structural operations need the subprocess service (dsh-workspace-enhancement)");
  }
  const handle = subprocess.spawn({
    argv,
    cwd,
    stdio: { stdin: "ignore", stdout: { maxBytes: 65536 }, stderr: { maxBytes: limits.stderrTailBytes } },
    graceMs: limits.structuralGraceMs
  });
  const outcome = await handle.done;
  let stderr = "";
  try {
    stderr = (handle.collected?.stderr?.readFrom(0)?.text ?? "").trim();
  } catch {
  }
  return { exitCode: outcome.exitCode, stderr };
}
function assertRemoteSucceeded(result, operation) {
  if (result.exitCode === 0) return;
  const detail = result.stderr !== "" ? result.stderr.split("\n").slice(-4).join(" ") : `exit code ${result.exitCode}`;
  throw new Error(`${operation} failed on the remote host: ${detail}`);
}
async function makeEntry(ctx, config, params, kind) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const parent = await resolveTarget(fs, params);
  const parentInfo = await fs.stat(parent);
  if (parentInfo === void 0 || parentInfo.type !== "directory") {
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
async function renameEntry(ctx, config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const source = await resolveTarget(fs, params);
  const info = await fs.stat(source);
  if (info === void 0) throw new Error("source not found");
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
    let result = await runRemote(subprocess, cwd, ["mv", "-T", "--", sourcePath, dest], limits);
    if (result.exitCode !== 0 && /invalid option|unknown option/i.test(result.stderr)) {
      result = await runRemote(subprocess, cwd, ["mv", "--", sourcePath, dest], limits);
    }
    assertRemoteSucceeded(result, "rename");
  }
  return { ok: true, world, path: dest };
}
async function deleteEntry(ctx, config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === void 0) throw new Error("path not found");
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
async function list(ctx, config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === void 0 || info.type !== "directory") {
    throw new Error(`not a directory: ${params.path}`);
  }
  const entries = await fs.listDir(target);
  const world = worldOf(target);
  const rows = entries.slice(0, limits.maxListEntries).map((e) => ({
    name: e.name,
    type: e.type,
    size: typeof e.size === "number" ? e.size : null,
    path: fs.processPath(e.target)
  }));
  return {
    world,
    path: fs.processPath(target),
    entries: rows,
    truncated: entries.length > limits.maxListEntries
  };
}
async function read(ctx, config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === void 0) throw new Error("not-found");
  if (info.type !== "file") throw new Error("not a file");
  const size = typeof info.size === "number" ? info.size : 0;
  if (size > limits.maxReadBytes) return { tooLarge: true, size, world: worldOf(target) };
  const content = await fs.readText(target);
  return { content, size, world: worldOf(target) };
}
async function write(ctx, _config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const target = await resolveTarget(fs, params);
  if (typeof params.content !== "string") throw new Error("content must be a string");
  await fs.writeText(target, params.content);
  return { ok: true, world: worldOf(target), path: fs.processPath(target) };
}
async function raw(ctx, config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === void 0) throw new Error("not-found");
  if (info.type !== "file") throw new Error("not a file");
  const size = typeof info.size === "number" ? info.size : 0;
  if (size > limits.maxRawBytes) throw new Error(`too-large: ${size} bytes exceeds the ${limits.maxRawBytes}-byte preview cap`);
  const bytes = await fs.readBytes(target, void 0, limits.maxRawBytes);
  const name = String(params.path ?? "").split(/[\\/]/).filter(Boolean).pop() || "file";
  const mime = MIME[extname(name).toLowerCase()] || "application/octet-stream";
  return { name, type: mime, size: bytes.length, base64: Buffer.from(bytes).toString("base64"), world: worldOf(target) };
}
function parentPathOf(path, world) {
  const value = String(path);
  if (world === "remote") {
    const parts = value.split("/").filter(Boolean);
    parts.pop();
    return parts.length > 0 ? "/" + parts.join("/") : "/";
  }
  return /[\\/]/.test(value) ? value.replace(/[\\/][^\\/]*$/, "") : value;
}
async function reveal(ctx, _config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const target = await resolveTarget(fs, params);
  const world = worldOf(target);
  if (world !== "local") throw new Error("reveal: remote paths cannot be opened in the local file manager");
  const parent = parentPathOf(opPath(target, "local", fs), "local");
  await openDirectory({ path: parent });
  return { ok: true, world, path: parent };
}
var watchClients = /* @__PURE__ */ new Set();
var watchRoot = null;
var watcher = null;
var watchTimer = null;
var changedDirs = /* @__PURE__ */ new Set();
function broadcastWatch(msg) {
  const payload = `data: ${JSON.stringify(msg)}

`;
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
    try {
      watcher.close();
    } catch {
    }
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
    try {
      watcher.close();
    } catch {
    }
    watcher = null;
  }
  watchRoot = null;
  changedDirs.clear();
}
function registerExplorerWatch(webServer) {
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
function disposeExplorerWatch() {
  clearWatchRoot();
  if (watchTimer !== null) clearTimeout(watchTimer);
  for (const res of watchClients) {
    try {
      res.end();
    } catch {
    }
  }
  watchClients.clear();
}
async function statPath(ctx, _config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === void 0) throw new Error("not-found");
  return {
    path: fs.processPath(target),
    type: info.type,
    size: typeof info.size === "number" ? info.size : void 0,
    world: worldOf(target)
  };
}
async function resolvePath(ctx, _config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const target = await resolveTarget(fs, params);
  return { path: fs.processPath(target), world: worldOf(target) };
}
async function readDataUrl(ctx, config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === void 0) throw new Error("not-found");
  if (info.type !== "file") throw new Error("not a file");
  const size = typeof info.size === "number" ? info.size : 0;
  if (size > limits.maxRawBytes) throw new Error(`file too large to inline (${size} bytes)`);
  const bytes = await fs.readBytes(target, void 0, limits.maxRawBytes);
  const name = String(params.path ?? "").split(/[\\/]/).filter(Boolean).pop() || "file";
  const mime = MIME[extname(name).toLowerCase()] || "application/octet-stream";
  const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  return { path: fs.processPath(target), mime, dataUrl, world: worldOf(target) };
}
async function createFile(ctx, config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const world = worldOf(target);
  const full = fs.processPath(target);
  const op = opPath(target, world, fs);
  if (world === "local") {
    const handle = await nodeFs.open(op, "wx").catch((error) => {
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
async function createDirectory(ctx, config, params) {
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
async function resolveDestination(fs, params, field, sourceWorld) {
  const target = await resolveValue(fs, params, requireString(params[field], field));
  if (worldOf(target) !== sourceWorld) throw new Error("cross-world operation is not supported");
  return target;
}
async function renamePath(ctx, config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const source = await resolveValue(fs, params, requireString(params.from, "from"));
  const info = await fs.stat(source);
  if (info === void 0) throw new Error("source not found");
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
async function copyPath(ctx, config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const source = await resolveValue(fs, params, requireString(params.from, "from"));
  const info = await fs.stat(source);
  if (info === void 0) throw new Error("source not found");
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
async function deletePath(ctx, config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const limits = limitsOf(config);
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === void 0) throw new Error("not-found");
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
    const result = info.type === "directory" ? await runRemote(subprocess, cwd, ["rmdir", "--", op], limits) : await runRemote(subprocess, cwd, ["rm", "--", op], limits);
    assertRemoteSucceeded(result, "delete");
  }
  return { path: full, world };
}
async function setRoot(ctx, _config, params) {
  const { fs } = servicesOf(ctx, cwdOf(params));
  const target = await resolveTarget(fs, params);
  const info = await fs.stat(target);
  if (info === void 0 || info.type !== "directory") {
    throw new Error(`not a directory: ${params.path}`);
  }
  const world = worldOf(target);
  const full = fs.processPath(target);
  if (world === "local") ensureWatchRoot(full);
  else clearWatchRoot();
  return { path: full, world };
}
async function explorerDispatch(ctx, config, method, params = {}) {
  try {
    switch (method) {
      case "list":
        return await list(ctx, config, params);
      case "read":
        return await read(ctx, config, params);
      case "write":
        return await write(ctx, config, params);
      case "mkdir":
        return await makeEntry(ctx, config, params, "dir");
      case "touch":
        return await makeEntry(ctx, config, params, "file");
      case "rename":
        return await renameEntry(ctx, config, params);
      case "delete":
        return await deleteEntry(ctx, config, params);
      case "raw":
        return await raw(ctx, config, params);
      case "reveal":
        return await reveal(ctx, config, params);
      case "readDataUrl":
        return await readDataUrl(ctx, config, params);
      case "createFile":
        return await createFile(ctx, config, params);
      case "createDirectory":
        return await createDirectory(ctx, config, params);
      case "renamePath":
        return await renamePath(ctx, config, params);
      case "copyPath":
        return await copyPath(ctx, config, params);
      case "deletePath":
        return await deletePath(ctx, config, params);
      case "statPath":
        return await statPath(ctx, config, params);
      case "resolvePath":
        return await resolvePath(ctx, config, params);
      case "setRoot":
        return await setRoot(ctx, config, params);
      default:
        throw new Error(`unknown method "${method}"`);
    }
  } catch (error) {
    throw new Error(messageOf(error));
  }
}
export {
  disposeExplorerWatch,
  explorerDispatch,
  parentPathOf,
  parseRemoteSpelling,
  registerExplorerWatch,
  routeIdOf,
  worldOf
};

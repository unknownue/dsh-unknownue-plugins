/**
 * dsh-unknownue-plugins — host half.
 *
 * The package itself is a personal DSH plugin bundle: one package, one host
 * plugin row (this module, name == package name), one browser half
 * (lib/client.js). Feature modules (lib/makefile.js, ...) contribute host
 * routes + execution logic; this file wires them in.
 *
 * Features:
 *   #1 Makefile target discovery (display-only, loopback JSON-RPC route).
 *   #2 Open the current session's working directory in the OS file manager.
 *   #3 Open a terminal window at the current session's working directory.
 *   #4 Remote control via SSH (command execution, file transfer, tunnel management).
 */
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { isLoopback, isLoopbackHost, json, makefileDispatch, messageOf, readBody } from "./makefile.js";
import { remoteDispatch } from "./remote.js";

const name = "dsh-unknownue-plugins";
const inject = ["webServer"];

const MAKE_ROUTE = "/dsh-unknownue-plugins/makefile/api";
const OPEN_ROUTE = "/dsh-unknownue-plugins/open/api";
const TERMINAL_ROUTE = "/dsh-unknownue-plugins/terminal/api";
const REMOTE_ROUTE = "/dsh-unknownue-plugins/remote/api";

/** Open a directory in the platform file manager (Explorer / Finder / xdg-open). */
async function openDirectory({ path }) {
  if (typeof path !== "string" || path.trim() === "") throw new Error("path must be a non-empty string");
  const info = await stat(path);
  if (!info.isDirectory()) throw new Error(`not a directory: ${path}`);

  if (process.platform === "win32") {
    // Reference: futongxu9-maker/dsh-path-reveal. Spawn explorer.exe directly
    // with its full path, NO `detached`/`windowsHide` (those flags break the
    // window). Exit code 1 is normal (Explorer reuses an existing window), so
    // success is signalled by the `spawn` event, not the exit code.
    const exe = `${process.env.SystemRoot ?? "C:\\Windows"}\\explorer.exe`;
    await new Promise((resolve, reject) => {
      const child = spawn(exe, [path], { stdio: "ignore" });
      child.once("error", reject);
      child.once("spawn", () => {
        child.unref();
        resolve();
      });
    });
    process.stderr.write(`[dsh-unknownue-plugins] opened directory via explorer: ${path}\n`);
    return { opened: path, command: exe };
  }

  const command = process.platform === "darwin" ? "open" : "xdg-open";
  await new Promise((resolve, reject) => {
    const child = spawn(command, [path], { stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
  process.stderr.write(`[dsh-unknownue-plugins] opened directory via ${command}: ${path}\n`);
  return { opened: path, command };
}

async function openDispatch(method, params) {
  if (method !== "openDir") throw new Error(`unknown method "${method}"`);
  return openDirectory({ path: params.path });
}

/** Open a terminal window whose working directory is `path`. */
async function openTerminal({ path }) {
  if (typeof path !== "string" || path.trim() === "") throw new Error("path must be a non-empty string");
  const info = await stat(path);
  if (!info.isDirectory()) throw new Error(`not a directory: ${path}`);

  if (process.platform === "win32") {
    // Open a new cmd window in the directory. `start "" cmd /k "cd /d <path>"`
    // (the /d flag switches drive); cmd.exe is always present.
    const cmd = `${process.env.SystemRoot ?? "C:\\Windows"}\\System32\\cmd.exe`;
    const command = `/c start "" cmd /k "cd /d ${path}"`;
    await new Promise((resolve, reject) => {
      const child = spawn(cmd, [command], { windowsVerbatimArguments: true, stdio: "ignore" });
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`cmd exited with code ${code}`));
      });
    });
    return { opened: path, command: "cmd.exe" };
  }

  if (process.platform === "darwin") {
    const escaped = path.replace(/"/g, '\\"');
    await new Promise((resolve, reject) => {
      const child = spawn("osascript", ["-e", `tell application "Terminal" to do script "cd ${escaped}"`], { stdio: "ignore" });
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`osascript exited with code ${code}`));
      });
    });
    return { opened: path, command: "Terminal" };
  }

  await new Promise((resolve, reject) => {
    const child = spawn("x-terminal-emulator", ["--working-directory", path], { stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
  return { opened: path, command: "x-terminal-emulator" };
}

async function terminalDispatch(method, params) {
  if (method !== "openTerminal") throw new Error(`unknown method "${method}"`);
  return openTerminal({ path: params.path });
}

function apply(ctx, config = {}) {
  const resolved = {
    makefile: config.makefile ?? "Makefile",
    remote: config.remote ?? {}
  };

  const registerRoute = (path, dispatcher) => {
    ctx.effect(() => ctx.webServer.register({
      kind: "exact",
      path,
      handler: async (req, res) => {
        if (!isLoopback(req.socket.remoteAddress) || !isLoopbackHost(req.headers.host)) {
          return json(res, 403, { ok: false, error: "loopback-only" });
        }
        if (req.method !== "POST") {
          return json(res, 405, { ok: false, error: "method not allowed" });
        }
        let body;
        try {
          body = await readBody(req);
        } catch (error) {
          return json(res, 400, { ok: false, error: messageOf(error) });
        }
        const method = typeof body.method === "string" ? body.method : "";
        const params = body.params === undefined ? {} : body.params;
        if (params === null || typeof params !== "object" || Array.isArray(params)) {
          return json(res, 400, { ok: false, error: "params must be an object" });
        }
        try {
          return json(res, 200, { ok: true, value: await dispatcher(method, params) });
        } catch (error) {
          return json(res, 200, { ok: false, error: messageOf(error) });
        }
      }
    }), `dsh-unknownue-plugins: route ${path}`);
  };

  registerRoute(MAKE_ROUTE, (method, params) => makefileDispatch(resolved, method, params));
  registerRoute(OPEN_ROUTE, openDispatch);
  registerRoute(TERMINAL_ROUTE, terminalDispatch);
  registerRoute(REMOTE_ROUTE, (method, params) => remoteDispatch(resolved, method, params));
}

export { apply, inject, name };

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
 *   #4 Remote-aware file explorer (ctx.fs / ctx.subprocess seams, local + remote).
 *
 * Remote workspaces are handled by dsh-workspace-enhancement (dependency).
 * Remote DSH access is handled by dsh-gateway (dependency).
 */
import { isLoopback, isLoopbackHost, json, makefileDispatch, messageOf, readBody } from "./makefile.js";
import { explorerDispatch, registerExplorerWatch, disposeExplorerWatch } from "./explorer.js";
import { openDirectory, openTerminal } from "./platform.js";
import type { BundleConfig, HostContext, ExplorerParams } from "./types.js";

const name = "dsh-unknownue-plugins";
const inject = ["webServer"];

const MAKE_ROUTE = "/dsh-unknownue-plugins/makefile/api";
const OPEN_ROUTE = "/dsh-unknownue-plugins/open/api";
const TERMINAL_ROUTE = "/dsh-unknownue-plugins/terminal/api";
const EXPLORER_ROUTE = "/dsh-unknownue-plugins/explorer/api";

async function openDispatch(method: string, params: Record<string, unknown>) {
  if (method !== "openDir") throw new Error(`unknown method "${method}"`);
  return openDirectory({ path: params.path as string });
}

async function terminalDispatch(method: string, params: Record<string, unknown>) {
  if (method !== "openTerminal") throw new Error(`unknown method "${method}"`);
  return openTerminal({ path: params.path as string });
}

function apply(ctx: HostContext, config: BundleConfig = {}): void {
  const resolved = {
    makefile: config.makefile ?? "Makefile",
    explorer: config.explorer ?? {}
  };

  const registerRoute = (path: string, dispatcher: (method: string, params: any) => Promise<unknown>) => {
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
  registerRoute(EXPLORER_ROUTE, (method, params) => explorerDispatch(ctx, resolved, method, params as ExplorerParams));

  ctx.effect(() => {
    const dispose = registerExplorerWatch(ctx.webServer);
    return () => {
      if (typeof dispose === "function") dispose();
      disposeExplorerWatch();
    };
  }, "dsh-unknownue-plugins: explorer watch channel");
}

export { apply, inject, name };

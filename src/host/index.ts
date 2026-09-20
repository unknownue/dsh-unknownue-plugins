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
 *   #2 Remote-aware file explorer (ctx.fs / ctx.subprocess seams, local + remote).
 *
 * Everything that hands the session workspace directory to an OS program is
 * deliberately NOT implemented here, because DSH ships it already:
 *   - open-in-app (`@deepseek-ai/dsh-host-open-in-app` +
 *     `@deepseek-ai/dsh-client-ui-open-in-app`, routes `/open-in-app/*`) puts a
 *     session-header button on the workspace directory with an application
 *     catalog (editors, Git GUIs, terminals, the file manager);
 *   - the terminal itself is a DSH surface too (`dsh-terminal` +
 *     `dsh-client-ui-sidebar-terminal`), so a native window is not this bundle's
 *     job either.
 *
 * Remote workspaces are handled by dsh-workspace-enhancement (dependency).
 * Remote DSH access is handled by dsh-gateway (dependency).
 */
import { isLoopback, isLoopbackHost, json, makefileDispatch, messageOf, readBody } from "./makefile.js";
import { explorerDispatch, registerExplorerWatch, disposeExplorerWatch } from "./explorer.js";
import type { BundleConfig, HostContext, ExplorerParams } from "./types.js";

const name = "dsh-unknownue-plugins";
const inject = ["webServer"];

const MAKE_ROUTE = "/dsh-unknownue-plugins/makefile/api";
const EXPLORER_ROUTE = "/dsh-unknownue-plugins/explorer/api";

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

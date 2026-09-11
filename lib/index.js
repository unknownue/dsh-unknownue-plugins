// src/host/index.ts
import { isLoopback, isLoopbackHost, json, makefileDispatch, messageOf, readBody } from "./makefile.js";
import { explorerDispatch, registerExplorerWatch, disposeExplorerWatch } from "./explorer.js";
import { openTerminal } from "./platform.js";
var name = "dsh-unknownue-plugins";
var inject = ["webServer"];
var MAKE_ROUTE = "/dsh-unknownue-plugins/makefile/api";
var TERMINAL_ROUTE = "/dsh-unknownue-plugins/terminal/api";
var EXPLORER_ROUTE = "/dsh-unknownue-plugins/explorer/api";
async function terminalDispatch(method, params) {
  if (method !== "openTerminal") throw new Error(`unknown method "${method}"`);
  return openTerminal({ path: params.path });
}
function apply(ctx, config = {}) {
  const resolved = {
    makefile: config.makefile ?? "Makefile",
    explorer: config.explorer ?? {}
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
        const params = body.params === void 0 ? {} : body.params;
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
  registerRoute(TERMINAL_ROUTE, terminalDispatch);
  registerRoute(EXPLORER_ROUTE, (method, params) => explorerDispatch(ctx, resolved, method, params));
  ctx.effect(() => {
    const dispose = registerExplorerWatch(ctx.webServer);
    return () => {
      if (typeof dispose === "function") dispose();
      disposeExplorerWatch();
    };
  }, "dsh-unknownue-plugins: explorer watch channel");
}
export {
  apply,
  inject,
  name
};

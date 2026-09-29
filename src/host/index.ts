/**
 * dsh-unknownue-plugins — host half of the bundle row.
 *
 * This row is **inert on the host side**: it registers no HTTP route. It used
 * to carry the remote-aware file explorer (`POST
 * /dsh-unknownue-plugins/explorer/api` plus the
 * `/dsh-unknownue-plugins/explorer/watch` SSE channel, `lib/explorer.js`); that
 * feature — host half and browser `Files` tab alike — was removed because DSH
 * ships its own file browsing surface.
 *
 * The row itself stays, because it is the bundle row (name == package name,
 * `dsh.bundle.patch` in package.json): the loader entry is what mounts this
 * package's client bundle (`lib/client.js` — the content-width control and the
 * browser halves of the sibling rows).
 *
 * The remaining host work lives in the sibling rows of this same package:
 *   - paperspace — `dsh-unknownue-plugins/paperspace` → lib/paperspace/index.js
 *   - tasks      — `dsh-unknownue-plugins/tasks`       → lib/tasks/index.js
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

const name = "dsh-unknownue-plugins";

/** Nothing to wire on the host side; kept so the bundle row keeps its client half. */
function apply(): void {}

export { apply, name };

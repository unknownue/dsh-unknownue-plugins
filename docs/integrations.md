# Integrations

This package is self-contained for its own features, but two capabilities it is
used with come from **companion plugins** that it is designed to sit next to.
Neither is a dependency of this npm package: they are installed and enabled as
their own bundle rows in a DSH profile.

## SSH remote workspaces — `dsh-workspace-enhancement`

Provides remote execution and remote files to DSH itself, so that tools written
against the standard seams keep working on a remote machine:

- **Remote providers** — transparent `ctx.subprocess` and `ctx.fs` implementations
  over one SSH chain (multi-hop / ProxyJump), so an SSH session runs bash, files,
  PTY and directory browsing with no code changes on the tools.
- **Multi-workspace sessions** — a main cwd plus side workspaces, each carrying
  its own permission marks (`fs: read-only | read-write` and `exec: on | off`),
  with the model told about them.
- **Machine registry and settings UI** — add / edit / test / delete machines,
  TOFU host keys, OS-keychain passwords; stored in
  `~/.dsh/remote-workspaces/machines.json`.
- **Cross-server execution** — `sw_exec(server, command)`, plus the model tools
  `sw_status`, `sw_connect`, `sw_pick_workspace`, `sw_exec`.

Install (upstream or the fork used in this workspace):

```sh
dsh plugin --profile web add dsh-workspace-enhancement
dsh plugin --profile web add github:unknownue/dsh-workspace-enhancement   # fork
```

How this bundle depends on it:

- The **file explorer** and **paperspace** route every filesystem and process
  operation through `ctx.fs` / `ctx.subprocess`, so they follow the mixed
  local/remote provider automatically. Paths are passed verbatim: a remote
  session's cwd arrives as `ssh://<id>/<path>` (or the `dsw-routes` placeholder
  tree) and is routed by that plugin.
- The per-workspace **permission gates apply unchanged**: `fs: read-only` makes
  the explorer reject writes, `exec: off` makes it reject structural operations
  (mkdir / rename / delete), which need a remote shell.
- The explorer's own test suite exercises exactly this contract (with fake
  seams) — see [File explorer](features/file-explorer.md#tests).
- Its Settings UI and prompt injection are independent of this bundle; this
  bundle only relies on its `settings.section` slot pattern being the same
  convention.

See the [project documentation](https://github.com/unknownue/dsh-workspace-enhancement#readme)
for the full reference (tools, permissions, host-key policy, troubleshooting).

## Remote DSH access — `dsh-gateway`

[`dsh-gateway`](https://github.com/thinkmoon/dsh-gateway) is a third-party DSH
plugin that puts an authenticated reverse proxy in front of the DSH web GUI, so
a phone or another machine can use this instance as if it were local:
password login with an HMAC-SHA256-signed session cookie (`Authorization:
Bearer <password>` for programmatic access), WebSocket upgrades gated by the
same session, and `Host` rewritten to `127.0.0.1:<dsh port>` with `Origin`
stripped so DSH's loopback fence treats remote requests as local ones. It starts
and stops with `dsh web`.

This package does **not** ship or mount it — install it separately:

```sh
dsh plugin --profile web add dsh-gateway
```

Its configuration lives in its own row in the profile's `cordis.patch.yml`
(`enabled`, `listenHost`, `port`, `password`, or `$DSH_GATEWAY_PASSWORD`, or the
auto-generated `~/.dsh-gateway/secret`). Because the proxied traffic reaches
DSH as a loopback request, the loopback fences used by this bundle's HTTP routes
are preserved rather than bypassed — a remote user gets the same surfaces as a
local one, including everything documented in
[HTTP API](reference/http-api.md).

> Binding a harness that can run arbitrary shell commands to a network interface
> is equivalent to exposing remote code execution: keep the gateway
> password-protected and prefer a private network or a TLS terminator in front
> of it.

## DSH seams this bundle relies on

Useful when verifying a DSH upgrade. Everything below is consumed through the
plugin context, so a missing service surfaces as an inert feature rather than a
crash.

| Seam | Used by | Purpose |
|---|---|---|
| `ctx.webServer.register` (exact-path routes) | host row, explorer, paperspace, tasks | every loopback HTTP route |
| `ctx.fs`, `ctx.subprocess` | explorer, paperspace | remote-aware file access and process execution |
| `ctx.effect` | all host modules | lifecycle / disposal of routes, workers, watchers |
| `ctx.slots` → `conversation.session.header.actions` | Makefile panel, open terminal, paper badge | session header buttons (opening the workspace in a file manager comes from DSH's own open-in-app plugin, not this bundle) |
| `ctx.slots` → `sidebar.footer.action` | content width control | sidebar footer button |
| `ctx.slots` → `conversation.view` | Files, Tasks, Papers tabs | conversation view tabs (orders 20 / 25 / 30) |
| `ctx.slots` → `conversation.input.dock` | paper-link picker | composer dock control (blank sessions only) |
| `ctx.slots` → `settings.section` | UnPlugin settings page | DSH Settings section hosting all feature options |
| `ctx.slots` → `sidebar.workspaces.tabs` | explorer editor | tracks whether DSH provides its own tabs slot |
| `ctx.inject(['slots', 'sidebarRightTabs'])`, `sidebar.right.pane.tab`, `sidebar.right.pane.tab.title`, `ctx.inject(['sidebarRight'])` | paperspace sidebar | right-Sidebar page tab (inert without the column) |
| `ctx.locale.register` / `bind` | all UI features | English + Chinese dictionaries |
| `ctx.sessions`, `ctx.workspaces` | toolbar actions, paperspace | session cwd resolution, native paper sessions |
| `dsh.client` manifest + `require.resolve(<name>/package.json)` | client module discovery | the bundle row `name` must stay the package name |

`scripts/verify-sidebar.mjs` is the cheapest check for the right-Sidebar rows
after a DSH upgrade — see [Development](development.md#verification-harness).

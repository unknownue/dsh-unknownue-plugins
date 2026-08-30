# dsh-unknownue-plugins

Personal DeepSeek Harness (DSH) plugin bundle for **unknownue** — one package that
aggregates my personal DSH plugins, so a single install mounts them all.

## Features

### 1. Makefile target discovery (display-only)

A session-header button opens a Makefile panel that, for the current session's
workspace directory:

- **刷新** — re-read the Makefile on demand (no polling / no watcher) and list
  its targets with `##` help comments and `.PHONY` entries, highlighting the
  default target.
- **复制** — copy the `make <target>` command for any target to the clipboard.

The browser half (`lib/client.js`) calls the host half's JSON-RPC route
(`POST /dsh-unknownue-plugins/makefile/api`) directly — there is no agent
interaction, no model-facing tools, and no target execution.

### 2. Content width control (merged from dsh-ui-width)

A sidebar-footer button opens a dialog with a 5%-step slider that adjusts the
chat/content column width (`--dsh-chat-content-width`), persisted in
`localStorage`. Pure client-side; no host involvement.

### 3. Open workspace directory

A button right of the Makefile button opens the current session's working
directory in the OS file manager (Explorer / Finder / xdg-open). It calls a
host loopback route (`POST /dsh-unknownue-plugins/open/api`) that validates the
path is an existing directory, then spawns the platform file manager.

### 4. Open terminal at workspace

A button opens a terminal window whose working directory is the current
session's workspace (Windows: `cmd`; macOS: Terminal.app; Linux:
`x-terminal-emulator`). It calls a host loopback route
(`POST /dsh-unknownue-plugins/terminal/api`).

### 5. SSH remote workspaces (via dsh-workspace-enhancement)

Manage local and remote (SSH) workspaces in one place. A session can hold
**multiple workspaces** (a main cwd plus side directories), each with its own
permissions.

- **Remote workspaces** — `ctx.subprocess` + `ctx.fs` transparent remote
  providers: one SSH chain (multi-hop) runs bash / files / PTY / directory
  browsing with no code changes on the tools
- **Multi-workspace sessions** — attach one or more side workspaces (local dirs
  or remote machine dirs) to a session, each with its own permission (`fs:
  read-only / read-write` + `exec: on / off`)
- **Machine settings** — add / edit / delete / test connections; TOFU host keys
  and OS-keychain passwords
- **Cross-server execution** — `sw_exec(server, command)` runs a command on a
  named server
- **Model tools** — `sw_status`, `sw_connect`, `sw_pick_workspace`, `sw_exec`

See [dsh-workspace-enhancement](https://github.com/DobyChao/dsh-workspace-enhancement)
for full documentation.

### 6. Remote DSH gateway (via dsh-gateway)

An authenticated reverse proxy that lets you access this DSH instance from
another machine (phone, laptop, another continent) — remote sessions behave
exactly like sitting at the machine itself.

- **Password-protected** — login page + HMAC-signed session cookie
- **WebSocket tunneling** — live UI works exactly as locally
- **Zero runtime deps** — plain Node core, nothing to audit

Access at `http://<your-ip>:8642` after setting a password. See
[Configuration](#configuration) below.

## Install

```sh
dsh plugin --profile web add github:unknownue/dsh-unknownue-plugins
```

Restart `dsh web`, refresh the page. The Makefile, open-workspace, and
open-terminal buttons appear in the session header; the width control appears
in the sidebar footer; the workspace enhancement adds remote workspace
capabilities to the native workspace picker.

> **First install with DSH's supply-chain pnpm**: native build scripts are
> blocked by default — allow them once per profile in `pnpm-workspace.yaml`
> (unstrict `allowBuilds`): `ssh2`, `cpu-features`, `koffi`, `node-pty`,
> `dsh-subprocess-local` — then run `dsh plugin --profile web install`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  dsh-unknownue-plugins (bundle)                             │
│                                                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ Makefile     │  │ Content Width    │  │ Open Dir/    │  │
│  │ Panel        │  │ Control          │  │ Terminal     │  │
│  └──────────────┘  └──────────────────┘  └──────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  dsh-workspace-enhancement (dependency)               │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ ctx.subprocess / ctx.fs (mixed provider)         │  │  │
│  │  │   local ←→ remote (SSH) transparent routing      │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ Machine Registry + Web UI                        │  │  │
│  │  │   add/edit/delete/test machines                  │  │  │
│  │  │   multi-workspace sessions                       │  │  │
│  │  │   cross-server execution                         │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  dsh-gateway (dependency)                             │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ Authenticated reverse proxy                      │  │  │
│  │  │   password auth + session cookie                 │  │  │
│  │  │   WebSocket tunneling                            │  │  │
│  │  │   Host/Origin rewriting                          │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

The bundle patch (`cordis.patch.yml`) seeds these defaults; override them in the
profile's `cordis.patch.yml`.

### Makefile

| key | default | meaning |
|-----|---------|---------|
| `makefile` | `Makefile` | Default Makefile name/path, resolved against the session's workdir. |

### SSH Remote Workspaces

Configuration is managed via the DSH UI (Settings → Remote Workspace). Machines
are stored in `~/.dsh/remote-workspaces/machines.json`. See
[dsh-workspace-enhancement](https://github.com/DobyChao/dsh-workspace-enhancement)
for full configuration reference.

### Gateway

The bundled [dsh-gateway](https://github.com/thinkmoon/dsh-gateway) provides
remote access to this DSH instance. Override in your profile's
`cordis.patch.yml` (row id `gateway`):

```yaml
- id: gateway
  name: 'dsh-gateway'
  config:
    enabled: true
    listenHost: '0.0.0.0'    # listen on all interfaces
    port: 8642                # gateway port
    password: 'your-password' # or set $DSH_GATEWAY_PASSWORD
```

Password resolution order: config `password` → `$DSH_GATEWAY_PASSWORD` →
`~/.dsh-gateway/secret` (auto-generated on first run).

## Adding a feature

1. Host logic: add `lib/<feature>.js` exporting pure helpers plus a
   `<feature>Dispatch` function (like `makefileDispatch`); register its HTTP
   route in `lib/index.js`.
2. Browser UI (optional): add the control to `lib/client.js` — the single
   client module whose `__ModuleLoader__` id equals the package name.
3. Keep `cordis.patch.yml`'s single row (`name: 'dsh-unknownue-plugins'`); the
   package's `dsh.client` manifest already serves `lib/client.js`.

> The client module system discovers the browser half through the package
> (`require.resolve(name + "/package.json")`), so the plugin row `name` must
> stay the package name — not a subpath.

The bundle is self-contained (no build step, no npm publishing); re-run
`dsh plugin --profile web install` and restart to pick up changes.

## License

MIT

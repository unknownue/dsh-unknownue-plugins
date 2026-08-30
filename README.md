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

### 5. Remote control via SSH

A session-header button opens a remote-control panel that connects to
configured machines through `~/.ssh/config` aliases:

- **Command execution** — run any shell command on a remote machine, view
  stdout/stderr inline.
- **File transfer** — upload files from your local machine or download from
  the remote via SCP.
- **Tunnel management** — monitor a reverse SSH tunnel (port status +
  systemd service), restart / stop / start from the UI.
- **Multi-host** — configure multiple remote machines, switch between them
  with a button bar; each host's reachability is checked live.

All hosts are referenced by their `~/.ssh/config` Host alias — no
credentials are stored in this plugin. See [Configuration](#configuration)
below for the `remote` config block.

## Install

```sh
dsh plugin --profile web add github:unknownue/dsh-unknownue-plugins
```

Restart `dsh web`, refresh the page. The Makefile, open-workspace,
open-terminal, and remote-control buttons appear in the session header;
the width control appears in the sidebar footer.

## Configuration

The bundle patch (`cordis.patch.yml`) seeds these defaults; override them in the
profile's `cordis.patch.yml` (row id `dsh-unknownue-plugins`):

### Makefile

| key | default | meaning |
|-----|---------|---------|
| `makefile` | `Makefile` | Default Makefile name/path, resolved against the session's workdir. |

### Remote control

```yaml
remote:
  hosts:
    - id: home
      sshHost: home            # ~/.ssh/config Host alias (required)
      label: "家里机器"         # UI display name
      description: "..."       # optional description
    - id: ecs
      sshHost: ecs
      label: "阿里云 ECS"
  tunnel:
    monitorHost: ecs           # host id to check tunnel port on
    tunnelPort: 2222           # port number
    serviceHost: home          # host id where systemd service runs
    serviceName: reverse-ssh-tunnel.service
```

| field | required | meaning |
|-------|----------|---------|
| `remote.hosts[].id` | yes | Unique identifier for the host |
| `remote.hosts[].sshHost` | yes | `~/.ssh/config` Host alias |
| `remote.hosts[].label` | no | Display name in the UI (defaults to `id`) |
| `remote.hosts[].description` | no | Description shown in the UI |
| `remote.tunnel.monitorHost` | no | Host id to check tunnel port on |
| `remote.tunnel.tunnelPort` | no | Tunnel port number (default 2222) |
| `remote.tunnel.serviceHost` | no | Host id where the systemd service runs |
| `remote.tunnel.serviceName` | no | Systemd unit name |

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

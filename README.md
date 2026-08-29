# dsh-unknownue-plugins

Personal DeepSeek Harness (DSH) plugin bundle for **unknownue** — one package that
aggregates my personal DSH plugins, so a single install mounts them all.

## Features

### 1. Makefile target discovery + execution (UI + execution, no agent)

A session-header button opens a Makefile panel that, for the current session's
workspace directory:

- **刷新** — re-read the Makefile on demand (no polling / no watcher) and list
  its targets with `##` help comments and `.PHONY` entries.
- **运行** — run one target through the platform shell and show stdout / stderr
  / exit code.

The browser half (`lib/client.js`) calls the host half's JSON-RPC route
(`POST /dsh-unknownue-plugins/makefile/api`) directly — there is no agent
interaction, and no model-facing tools are registered.

### 2. Content width control (merged from dsh-ui-width)

A sidebar-footer button opens a dialog with a 5%-step slider that adjusts the
chat/content column width (`--dsh-chat-content-width`), persisted in
`localStorage`. Pure client-side; no host involvement.

### 3. Open workspace directory

A button right of the Makefile button opens the current session's working
directory in the OS file manager (Explorer / Finder / xdg-open). It calls a
host loopback route (`POST /dsh-unknownue-plugins/open/api`) that validates the
path is an existing directory, then spawns the platform file manager detached.

## Install

```sh
dsh plugin --profile web add github:unknownue/dsh-unknownue-plugins
```

Restart `dsh web`, refresh the page. The Makefile button, the open-workspace
button, and the width control appear in the session header / sidebar footer.

## Configuration

The bundle patch (`cordis.patch.yml`) seeds these defaults; override them in the
profile's `cordis.patch.yml` (row id `dsh-unknownue-plugins/makefile`):

| key | default | meaning |
|-----|---------|---------|
| `makeBinary` | `make` | Command (or prefix) that runs make. Use `wsl make` for a Makefile inside WSL. |
| `makefile` | `Makefile` | Default Makefile name/path, resolved against the session's workdir. |

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

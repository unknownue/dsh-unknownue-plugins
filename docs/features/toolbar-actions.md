# Toolbar actions

One surface is left of the bundle's own UI actions: the **content width** control in the sidebar
footer, which is pure client-side and has no host half. Everything else that used to sit in a
session header was **removed on purpose**:

- **Open the workspace directory in the OS file manager** — DSH ships that control itself, as the
  open-in-app plugin (`@deepseek-ai/dsh-host-open-in-app` + `@deepseek-ai/dsh-client-ui-open-in-app`,
  routes `/open-in-app/apps`, `/open-in-app/icon`, `/open-in-app/open`), whose session-header
  **Open In…** button opens the workspace directory in a locally installed application with an app
  catalog and icons. Removed here: the header button, its route
  (`/dsh-unknownue-plugins/open/api`), the `openDirectory` host helper and the file explorer's
  `reveal` method that reached it.
- **Open terminal at workspace** — the header button that spawned a native terminal window
  (`/dsh-unknownue-plugins/terminal/api`, `openTerminal`; `cmd.exe` / `osascript` /
  `x-terminal-emulator`). DSH owns both halves: `dsh-terminal` + `dsh-client-ui-sidebar-terminal`
  provide the in-GUI terminal, and the open-in-app catalog launches the installed emulators.
  Removed: the button, the route and the whole `src/host/platform.ts` module.
- **Makefile panel (display-only)** — the header button that listed the session workspace's make
  targets with their `##` help and a default badge, behind
  `/dsh-unknownue-plugins/makefile/api` (`listTargets`, `parseMakefile`). It was a convenience
  panel rather than a DSH gap, and it never worked as shipped: the browser half posted method
  `list` with `{ cwd }` while the host dispatched `listTargets` and read `{ workdir }`, so every
  call came back `unknown method "list"`. Removed: the button, the panel component, the parser,
  the route and the row's `makefile` key. Read a Makefile through the explorer's file tree or the
  agent's tooling instead.

The bundle's host row (`src/host/index.ts`) therefore registers a single route, the file explorer's
`/dsh-unknownue-plugins/explorer/api`, plus the explorer's watch channel; the browser half
registers the width control and the three view tabs. Nothing in this bundle launches an OS program
on the workspace any more.

## Content width

- **Surface** — the sidebar footer action (`sidebar.footer.action` slot,
  id `dsh-unknownue-plugins/width`).
- **Behaviour** — a dialog with a slider (50 %–150 %, 5 % steps, default 100 %)
  and a `Reset 100%` button that rewrites the chat/content column width.
- **Mechanics** — the value is written to `localStorage` under
  `dsh-unknownue-plugins:contentWidthPct` and applied by injecting a single
  `<style data-width-override>` rule into the document head:
  `*{--dsh-chat-content-width:<pct>% !important}`. It is re-applied at plugin
  startup, so the width survives reloads; a storage failure (private mode) is
  ignored and the width still applies for the session.
- **No host involvement** — this is the feature formerly shipped as the separate
  `dsh-ui-width` plugin.

## Limitations

- The width control carries fixed English `title` / `aria-label` text and keeps its value in
  browser storage, so it is per browser profile and does not follow the UI language.
- The removed Makefile panel is documented here only as history: nothing in the bundle reads a
  Makefile or runs `make` any more.

## Related

- [HTTP API reference](../reference/http-api.md)
- [Configuration](../reference/configuration.md)
- [Integrations](../integrations.md)

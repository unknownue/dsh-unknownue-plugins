# Toolbar actions

Three surfaces belong to the bundle's own host row (`dsh-unknownue-plugins`): the
**Makefile** panel, the **content width** control, and **open terminal at
workspace**. Only the width control is pure client-side; the other two call a
loopback JSON-RPC route served by `src/host/index.ts`.

Opening the session workspace in the OS file manager used to live here as well
and was **removed**: DSH ships that control itself, as the open-in-app plugin
(`@deepseek-ai/dsh-host-open-in-app` + `@deepseek-ai/dsh-client-ui-open-in-app`,
routes `/open-in-app/apps`, `/open-in-app/icon`, `/open-in-app/open`), whose
session-header button opens the workspace directory in a locally installed
application with an app catalog and icons. This bundle does not duplicate it.

Both routes share one envelope (see [HTTP API](../reference/http-api.md)):
`POST` only, loopback-only, body `{ "method": string, "params": object }`,
response `{ "ok": true, "value": … }` or `{ "ok": false, "error": string }`
(dispatcher errors keep status `200`, so the panel shows the message text).

## Makefile panel (display-only)

- **Surface** — a header action button
  (`conversation.session.header.actions` slot, id
  `dsh-unknownue-plugins/makefile`).
- **Behaviour** — clicking the button opens a dialog that reads the Makefile for
  the current session work directory **once, on demand**: there is no polling,
  no file watcher, and the panel's refresh button re-reads it. Each row shows the
  target name, a *default* badge, the `##` help text, and a copy button that puts
  `make <target>` on the clipboard.
- **Parsing** — `parseMakefile()` is pure and read-once. It collects explicit
  targets plus `.PHONY` names, skips variable assignments, directives
  (`include`, `ifeq`, …), comments and indented recipe lines, rejects names
  containing `%` or starting with `.`, attaches `##` help from either a standalone
  `## comment` line directly above a target or a trailing `## help` on the
  target line, sorts targets by name, and reports the **first real target in file
  order** as the default target.
- **Configuration** — the `makefile` key on the bundle row (default `Makefile`),
  resolved against the session work directory; an absolute path is used as-is.
- **Route** — `POST /dsh-unknownue-plugins/makefile/api`, method `listTargets`,
  params `{ workdir?, makefile? }`, returning
  `{ makefile, path, targets: [{ name, help }], defaultTarget }`.
- **Never executes `make`** — discovery only.

> **Known issue (verified against HEAD, `src/client/toolbar/MakefileControl.tsx`
> vs `src/host/makefile.ts`)** — the panel calls method `list` with `{ cwd }`,
> while the host only accepts `listTargets` with `{ workdir }` and answers
> `{ targets, defaultTarget }` (the client expects `{ targets, cwd }` and a
> per-target `isDefault` flag). As shipped, the panel therefore reports
> `unknown method "list"`, and — even with the method fixed — would read the
> server process's working directory instead of the session's, and never show
> the default badge. Fix both sides together, then rebuild `lib/`.

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

## Open terminal at workspace

- **Surface** — a header action button (id `dsh-unknownue-plugins/terminal`).
- **Route** — `POST /dsh-unknownue-plugins/terminal/api`, method
  `openTerminal`, params `{ path }`; the path must be a non-empty string naming
  an existing **directory**.
- **Host behaviour** — Windows: `cmd.exe /c start "" cmd /k "cd /d <path>"`
  (the `/d` flag switches drives); macOS:
  `osascript -e 'tell application "Terminal" to do script "cd <path>"'`; Linux:
  `x-terminal-emulator --working-directory <path>`.

## Limitations

- Every action above runs on the **DSH host machine** and uses Node's local
  filesystem (`stat`/`readFile`), so they only work for sessions whose work
  directory exists locally. In a remote (SSH) session the session cwd is a
  remote path that these routes cannot read — use the remote workspace tooling
  instead (see [Integrations](../integrations.md)).
- The Makefile panel's status strings (refresh/copy/loading/labels) are
  hard-coded in the component instead of coming from the locale dictionaries, so
  that panel does not follow the UI language; the width control carries fixed
  English `title`/`aria-label` text, and the terminal button's tooltip is
  hard-coded in Chinese.

## Related

- [HTTP API reference](../reference/http-api.md)
- [Configuration](../reference/configuration.md)
- [Integrations](../integrations.md)

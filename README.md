# dsh-unknownue-plugins

Personal [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugin bundle
for **unknownue**: one npm package whose bundle patch mounts a set of personal
plugins in a single install — a content-width control, a personal task board,
and an in-process academic-paper reader.

Everything the browser half needs goes through loopback-fenced HTTP routes on
`ctx.webServer`; a feature whose DSH slot or service is missing stays inert
instead of failing.

## Features

| Feature | Where it appears | Docs |
| --- | --- | --- |
| **Content width** — 50–150 % slider in 1 % steps for the chat/content column, remembered per browser | sidebar footer button | [Toolbar actions](docs/features/toolbar-actions.md) |
| **Paperspace** — arXiv library, reader (math, TOC, figure lightbox) and AI translation, running inside the DSH process: embedded PGlite, local object store, no Docker and no separate worker | `Papers` conversation tab, right-Sidebar page tab, session header badge, composer paper picker, UnPlugin settings | [Paperspace](docs/features/paperspace.md) |
| **Tasks** — personal kanban + list board with tags, subtasks and optional due dates, maintained by hand (no agent surface) | `Tasks` conversation tab, UnPlugin settings | [Tasks](docs/features/tasks.md) |

Only paperspace exposes model-facing tools (`search_paper`, `read_section`).

### Rows and companion plugins

The bundle patch inserts three rows, all served by this one package:

| Row id | Plugin row | Documentation |
| --- | --- | --- |
| `dsh-unknownue-plugins` | the bundle row: the content-width control (its host half is inert) | this file |
| `paperspace` | `dsh-unknownue-plugins/paperspace` subpath | [Paperspace](docs/features/paperspace.md) |
| `tasks` | `dsh-unknownue-plugins/tasks` subpath | [Tasks](docs/features/tasks.md) |

Two further capabilities come from **separate** plugins that this bundle is
designed to sit next to (neither is a dependency of this package):

- **[dsh-workspace-enhancement](https://github.com/unknownue/dsh-workspace-enhancement)** —
  SSH remote workspaces (`ctx.fs` / `ctx.subprocess` providers, multi-workspace
  sessions with per-workspace permissions, machine registry, `sw_*` tools). The
  paperspace reader follows it automatically.
- **[dsh-gateway](https://github.com/thinkmoon/dsh-gateway)** — an authenticated
  reverse proxy for reaching this DSH instance from another machine.

See [Integrations](docs/integrations.md) for how they fit together.

## Install

```sh
dsh plugin --profile web add github:unknownue/dsh-unknownue-plugins
dsh plugin --profile web install
dsh web            # restart, then refresh the browser page
```

> **First install with DSH's supply-chain pnpm**: native build scripts are blocked
> by default — allow them once per profile by listing them under
> `onlyBuiltDependencies` in the profile's `pnpm-workspace.yaml` (pnpm 10's key;
> the DSH hint calls it `allowBuilds`): `ssh2`, `cpu-features`, `koffi`,
> `node-pty`, `dsh-subprocess-local` — then run
> `dsh plugin --profile web install`.

Requires Node.js >= 22.19 (`engines`); the package is ESM and its built `lib/`
artifacts are committed, so a git install needs no build step.

**After the first start** the task board and the toolbar buttons work
immediately. Paperspace is **gated**: until its storage locations
are saved (setup screen of the `Papers` tab, or DSH Settings → **UnPlugin**) it
shows a setup screen instead of serving.

## Configuration

Three layers, all documented in
[Configuration](docs/reference/configuration.md):

1. defaults seeded by this package's `cordis.patch.yml`;
2. overrides in your profile's `cordis.patch.yml`;
3. runtime settings written by the DSH Settings → **UnPlugin** page into
   `<dsh home>` (`paperspace/settings.json`, `tasks/settings.json`), plus
   browser-local UI preferences.

## Documentation

| Document | Covers |
| --- | --- |
| [Toolbar actions](docs/features/toolbar-actions.md) | the content-width control, and the header actions DSH owns instead |
| [Paperspace](docs/features/paperspace.md) | the `Papers` tab and sidebar pane, reader, translation, architecture, operations |
| [Tasks](docs/features/tasks.md) | the `Tasks` tab: board, list, archive, due dates, tags, subtasks, data layer |
| [Integrations](docs/integrations.md) | companion plugins, and the DSH seams each feature consumes |
| [Configuration](docs/reference/configuration.md) | every row key, settings file and browser preference |
| [HTTP API](docs/reference/http-api.md) | every loopback route this bundle registers |
| [Development](docs/development.md) | package layout, build, typecheck, tests, adding a feature |

## Repository layout

```
cordis.patch.yml   bundle patch: the three rows above
src/host/**        host halves (bundle row, paperspace, tasks)
src/client/**      browser halves (toolbar, paperspace, tasks)
lib/**             committed build output (esbuild) — never edit by hand
scripts/**         development-only harnesses (not published)
docs/**            the documentation linked above
```

```sh
npm install          # devDependencies only (esbuild, typescript, @types)
npm run typecheck    # tsc over src/client and src/host
npm run build        # esbuild → lib/client.js + lib/*.js
npm test             # build first: 98 paperspace + 77 tasks checks
npm run verify:sidebar   # build first: right-Sidebar wiring harness (no test framework)
```

## Known limitations

- The width control is browser-only: it rewrites a CSS variable in the page and remembers the
  value in `localStorage`, so it is per browser profile.
- Storage-path changes for paperspace and the task board are saved but take
  effect on the next `dsh web` restart.
- A gateway in front of DSH is equivalent to exposing remote code execution:
  keep it authenticated (see [Integrations](docs/integrations.md)).

## License

MIT. The remote-aware file explorer this bundle once shipped (the `Files` tab
and its `/dsh-unknownue-plugins/explorer/*` host routes, a port of
[oneirictouch/dsh-explorer-editor](https://github.com/oneirictouch/dsh-explorer-editor),
MIT) was removed because DSH ships its own file browsing surface; the third-party
code it carried is gone with it. Bundled dependency notices are listed in
`THIRD-PARTY-NOTICES.md`.

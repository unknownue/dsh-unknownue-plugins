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

### 7. File explorer tab (remote-aware; editor ported from dsh-explorer-editor)

A **"文件" tab** beside 对话 / 轨迹 hosts the whole file browser for the
current session's workspace. The VS Code-style UI is ported from
[dsh-explorer-editor](https://github.com/oneirictouch/dsh-explorer-editor)
(MIT) and re-wired onto this bundle's remote-aware host routes:

- **File tree** — left pane: lazy directory tree, dirs first, sizes, expand/collapse;
- **Resizable splitter** — drag the divider between the tree and the editor to
  adjust the tree width (the editor takes the remainder; persisted per browser);
- **Editor tabs** — open several files as tabs; Ctrl/Cmd+S saves (dirty marker);
- **Markdown preview** — rendered markdown with workspace images inlined via `readDataUrl`;
- **Context menu** — new file / new directory / rename / copy / delete
  (non-empty directories rejected; the tree walks children first);
- **Live refresh** — a host fs.watch → SSE channel refreshes changed
  directories automatically for LOCAL roots (remote roots use the refresh button);
- **Remote workspaces** — every operation routes through the `ctx.fs` /
  `ctx.subprocess` seams with the session cwd passed verbatim (`ssh://<id>/<path>`
  or the `dsw-routes` placeholder), so a remote session operates on the server
  over SFTP with structural ops on the remote shell. The side-workspace
  permission gates apply unchanged (`fs: r` rejects writes, `exec: off`
  rejects structural ops).

The browser half calls the host loopback routes
(`POST /dsh-unknownue-plugins/explorer/api`,
`GET /dsh-unknownue-plugins/explorer/watch`) directly — same fence as every
other route in this bundle.

> **Remote Windows hosts**: tree/read/write work (SFTP); mkdir/rename/delete
> need a POSIX shell and are reported as unsupported until a pwsh branch lands.

### 8. Paperspace: in-process paper reader (no Docker)

An academic-paper reader ported from a standalone paperspace monorepo, now
running INSIDE this DSH profile process:

- **Embedded PostgreSQL** — `@electric-sql/pglite` (WASM build of real
  PostgreSQL) with a loopback pgwire socket; the paperspace domain layer
  connects through `postgres` (postgres.js) unchanged, including
  `FOR UPDATE SKIP LOCKED` job claiming, JSONB search, and partial indexes.
- **Local object store** — paper assets live under `~/.dsh/paperspace/assets`
  with deterministic keys (`papers/{arxivId}/{sha1(url)[:16]}.{ext}`); the
  same five-method `ObjectStore` surface MinIO used, so no schema or API
  changes were needed.
- **DSH cordis lifecycle** — the PGlite runtime, socket server, and worker
  loops are all owned by the host plugin row (`ctx.effect` disposal); config
  comes from the row in `cordis.patch.yml`.
- **REST + SSE API** on `ctx.webServer` under
  `/dsh-unknownue-plugins/paperspace/api/`: paper create/list/detail/delete,
  asset metadata + streaming, translation job lifecycle, and grounded
  `chat/stream` SSE (agent chat with `search_paper` / `read_section` tools).
- **In-process worker** — ingest (arXiv metadata/HTML → markdown with math →
  images to the object store → single transaction) and translation
  (glossary → paragraph-by-paragraph snapshots → retry/backoff/stuck-rescan)
  run as `ctx.effect`-owned timer loops; no separate worker process. Verified
  against real arXiv (`1706.03762` ingested end-to-end in ~1s).

- **Reader UI tab** — a **论文** tab joins 对话 / 轨迹 / 文件 in the session
  body: paper library (search/categories/add/ingest polling/retry/delete),
  full reader (sticky TOC, markdown + math via remark/rehype/KaTeX, figure
  lightbox), and the translation panel (原文/译文/双语, progress polling,
  cancel/retry). Paperspace's stylesheet is scoped under `.dsh-paperspace`
  at build time; KaTeX fonts are served by the host route
  `/dsh-unknownue-plugins/paperspace/static/fonts`.
- **Native DSH conversations** — paperspace has NO chat UI of its own: the
  **与 AI 讨论** button (library cards + reader header) links a DSH session
  to the paper through the shared **Paperspace** workspace (one entry in the
  workspace list no matter how many papers), materializes the paper as
  `workspace/papers/<arxivId>.md`, and switches DSH to that session.
  `search_paper` / `read_section` are REAL DSH tools resolved per calling
  session (`exec.agent.sessionId → paper.paper_sessions → paper.papers`);
  DSH's own fs tools can read the materialized markdown. History, trajectory,
  model selection, permissions and multi-device access all come from DSH.

- **Gated first-run setup** — paperspace refuses to serve until configured:
  the **论文** tab shows a setup screen and the **DSH Settings → UnPlugin**
  section hosts the full options panel, where paperspace
  owns its own area (storage paths, memory, worker tunables).
  Saving `configured: true` persists to `<dsh home>/paperspace/settings.json`
  (same pattern as dsh-workspace-enhancement's `machines.json`) and boots the
  runtime; disabling stops it immediately. Storage-path changes are saved
  but flagged `restartRequired` — they take effect on the next `dsh web`
  restart.

Data lives wherever the user configured it (default `~/.dsh/paperspace/`) —
back up that directory to back up the whole library. Run
`node lib/paperspace/paperspace.test.js` for the integration suite
(65 checks: gating, settings persistence, real PGlite, routes, domain,
worker wiring, runtime tool loop, object store, fonts, persistence, plus
mock-LLM e2e for translation and the SSE chat tool loop). See
`THIRD-PARTY-NOTICES.md` for bundled dependency licenses.

### 9. Tasks: personal task board (kanban + list)

A **任务** tab (between 文件 and 论文) hosts a personal task board the user
maintains entirely by hand — there is **no agent surface** (no model-facing
tools, no session-log events, no dispatch). Four kanban columns (待办 /
进行中 / 阻塞 / 完成) with drag-and-drop between columns, a dense list view
(including archived cards), a card editor (title, Markdown body, status,
priority, optional due date, archive/restore/delete), and a one-click
**archive-all button on the Done column header** (confirm-guarded).

- **PGlite database** — the same in-process PostgreSQL used by paperspace,
  but driven through PGlite's native query API (no pgwire socket, no
  postgres.js). The database location is **user-configurable**: defaults to
  `<dsh home>/tasks/db`, overridable in `cordis.patch.yml` (row `tasks`,
  key `dataDir`) and in **DSH Settings → UnPlugin → 任务面板**, persisted to
  `<dsh home>/tasks/settings.json`. Changing the location while running is
  saved but flagged `restartRequired` — it takes effect on the next
  `dsh web` restart.
- **Auto-boot** — unlike paperspace there is no `configured` gate (no
  credentials are involved); the board is usable immediately.
- **Fractional ranking** — cards carry a `rank` (midpoint between neighbours);
  a drag/reorder writes exactly one row and concurrent edits cannot scramble
  a column.
- **Optional due date, two modes** — unset (无), a single deadline moment
  (单点: all-day `YYYY-MM-DD` or minute-precise `YYYY-MM-DDTHH:mm`), or a
  task time range (范围: start ~ end, each all-day or timed). Local wall
  time; overdue marks the deadline / range end. Stored as `due_at` +
  `due_until` columns (point = `due_at` only); databases from before the
  feature auto-migrate via `ALTER TABLE ... IF NOT EXISTS`, and legacy
  date-only values read as single-moment due dates.
- **Tags** — each card optionally carries up to 20 user-assigned tags
  (strings, trimmed + deduped). Board cards and the list view render them as
  colored chips whose color comes from a fixed palette picked by the tag
  text's hash (stable, no stored color data); the card editor adds/removes
  tags with a free-text input and offers **quick-add chips for tags already
  used on other cards**. PATCH `tags` is a whole-list replacement; omitting
  it keeps the current list.
- **Subtasks** — each card optionally carries up to 50 checkable subtasks
  (structured `{ id, content, done }`, ids minted host-side). The board card
  shows the checklist (first 3 items + `+n`, **unchecked items first**) with
  direct checkboxes and a `done/total` progress badge; the card editor edits
  the full list (toggle, remove, add, inline content editing, unchecked
  first). PATCH `todos` is a whole-list replacement; omitting it keeps
  the current list. Stored as a validated JSON column on `tasks`; databases
  from before the feature auto-migrate via `ALTER TABLE ... IF NOT EXISTS`.
- **Revision polling** — board state deliberately lives outside the DSH
  session log; the tab polls one integer (`meta.revision`, 5s) and refetches
  only when it moved, which also covers edits from another browser tab.
- **Loopback-fenced REST** on `ctx.webServer` under
  `/dsh-unknownue-plugins/tasks/api`: `GET /board` (+`?archived=1`),
  `GET /revision`, `POST /cards`, `PATCH /cards/:id`, `POST /cards/:id/move`
  (`before_id`/`after_id` for exact placement), `POST /cards/:id/archive`,
  `POST /cards/:id/restore`, `DELETE /cards/:id`, `GET|POST /settings`.

Run `node lib/tasks/tasks.test.js` for the integration suite (real PGlite
against a temp `DSH_HOME`: routes, validation, subtask checklist, ranking,
settings persistence, restartRequired flag, dispose → reopen persistence,
in-memory boot).

## Install

```sh
dsh plugin --profile web add github:unknownue/dsh-unknownue-plugins
```

Restart `dsh web`, refresh the page. The Makefile, open-workspace, and
open-terminal buttons appear in the session header; the width control appears
in the sidebar footer; the **文件** tab (file explorer) joins 对话 / 轨迹 in
the session body; the workspace enhancement adds remote workspace capabilities
to the native workspace picker; the **任务** tab (personal task board) sits
between 文件 and 论文 and is usable immediately.

> **First install with DSH's supply-chain pnpm**: native build scripts are
> blocked by default — allow them once per profile in `pnpm-workspace.yaml`
> (unstrict `allowBuilds`): `ssh2`, `cpu-features`, `koffi`, `node-pty`,
> `dsh-subprocess-local` — then run `dsh plugin --profile web install`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  dsh-unknownue-plugins (bundle)                             │
│                                                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Makefile     │  │ Content Width    │  │ Open Dir/    │  │ File         │  │
│  │ Panel        │  │ Control          │  │ Terminal     │  │ Explorer     │  │
│  └──────────────┘  └──────────────────┘  └──────────────┘  └──────┬───────┘  │
│                                                                    │          │
│  ┌─────────────────────────────────────────────────────────────────▼────────┐  │
│  │  ctx.fs / ctx.subprocess seams (mixed provider: local ←→ remote)         │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
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

### File explorer

| key | default | meaning |
|-----|---------|---------|
| `explorer.maxListEntries` | `1000` | Entries per directory level (excess reported as `truncated`). |
| `explorer.maxReadBytes` | `1048576` | Text preview cap; larger files offer download only. |
| `explorer.maxRawBytes` | `8388608` | Binary preview / download cap. |
| `explorer.structuralGraceMs` | `8000` | Remote structural command grace period. |
| `explorer.stderrTailBytes` | `8192` | Remote structural stderr tail kept for error messages. |

### Paperspace

User-facing configuration lives in the DSH Settings UI under the
**UnPlugin** section (paperspace area) and is
persisted to `<dsh home>/paperspace/settings.json`; the row config below only
seeds the settings form's initial values. `''` paths mean the default
(`~/.dsh/paperspace/…`); `DSH_HOME` relocates `<dsh home>`.

| key | default | meaning |
|-----|---------|---------|
| `dataDir` | `~/.dsh/paperspace/db` | PGlite data directory. |
| `assetsDir` | `~/.dsh/paperspace/assets` | Local object-store root. |
| `workspaceDir` | sibling of `dataDir` | Shared DSH workspace anchor; holds `papers/<arxivId>.md`. |
| `port` | `0` | pgwire listen port (0 → OS-assigned loopback port). |
| `initialMemoryBytes` | `536870912` | PGlite WASM initial memory in **bytes**. |
| `pollMs` | `5000` | Ingest/translation worker poll interval. |
| `ingestTimeoutMs` | `30000` | arXiv metadata/HTML fetch timeout. |
| `maxAssetBytes` | `10485760` | Max bytes per downloaded paper image. |
| `ingestConcurrency` | `2` | Concurrent image downloads. |
| `translateMaxAttempts` | `3` | Max translation attempts before permanent failure. |
| `translateStuckAfterMinutes` | `30` | Running jobs older than this are re-queued. |
| `translateTimeoutMs` | `120000` | Per-LLM-request timeout for translation. |
| `rescanIntervalMs` | `60000` | Stuck-job rescan interval. |

### Tasks

User-facing configuration lives in the DSH Settings UI under the
**UnPlugin** section's **任务面板** area and is persisted to
`<dsh home>/tasks/settings.json`; the
row config below only seeds the settings form's initial value. `''` paths mean
the default (`<dsh home>/tasks/…`); `DSH_HOME` relocates `<dsh home>`. The
board auto-boots with defaults (no `configured` gate); a `dataDir` change is
saved but flagged `restartRequired` and takes effect on the next `dsh web`
restart.

| key | default | meaning |
|-----|---------|---------|
| `dataDir` | `<dsh home>/tasks/db` | PGlite database directory (back this up to migrate the board). |
| `initialMemoryBytes` | `134217728` | PGlite WASM initial memory in bytes. |

LLM credentials (chat + translation server-side fallback) read from
`LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` env vars, exactly like paperspace.

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

1. Host logic: add `src/host/<feature>.ts` exporting pure helpers plus a
   `<feature>Dispatch` function (like `makefileDispatch`); register its HTTP
   route in `src/host/index.ts`. The build emits `lib/<feature>.js`.
2. Browser UI (optional): add your components under `src/client/` and wire
   them into `src/client/index.tsx`. Every `lib/*.js` is a BUILD ARTIFACT —
   do not edit those by hand.
3. Keep `cordis.patch.yml`'s single row (`name: 'dsh-unknownue-plugins'`); the
   package's `dsh.client` manifest already serves `lib/client.js`.

> The client module system discovers the browser half through the package
> (`require.resolve(name + "/package.json")`), so the plugin row `name` must
> stay the package name — not a subpath.

## Development

```sh
npm install          # devDependencies only: esbuild, typescript, @types/{node,react}
npm run typecheck    # tsc --noEmit over src/client AND src/host
npm run build        # esbuild: src/client → lib/client.js; src/host/* → lib/*.js
npm test             # node lib/explorer.test.js (built from src/host/explorer.test.ts)
```

- **Host half** — TypeScript under `src/host/`
  (`index.ts`, `makefile.ts`, `platform.ts`, `explorer.ts`,
  `explorer.test.ts`), built by esbuild into plain ESM `lib/*.js`. Node
  builtins and imports between feature modules are external, so the emitted
  module graph matches the original hand-written files (`index.js` imports
  `./makefile.js` / `./explorer.js` / `./platform.js` at runtime). The seam
  types (`ctx.fs` / `ctx.subprocess` / `ctx.webServer` / `ctx.effect`) are
  declared locally in `src/host/types.ts` — minimal honest contracts, no
  hard @deepseek-ai/cordis devDependency.
- **Browser half** — TypeScript under `src/client/`; bundled with esbuild
  into the single `lib/client.js` client module (React and
  `react/jsx-runtime` are externals — the DSH host module loader provides
  them). `.gitattributes` pins `src/client/*.css` to LF so the CSS text
  embedded in the bundle is byte-identical on every platform.
- Re-run `dsh plugin --profile web install` and restart to pick up changes.

## Tests

The explorer host half ships an ad-hoc mock-seam test suite (no test framework;
TypeScript source at `src/host/explorer.test.ts`, built to
`lib/explorer.test.js`):

```sh
npm test
```

It exercises the remote-aware routing (`ssh://` / `dsw-routes` normalization,
spawn cwd pinning) and the full-path structural operations against a fake
`ctx.fs` / `ctx.subprocess` pair for both the local and remote worlds.

The tasks host half ships its own integration suite (`src/host/tasks/tasks.test.ts`,
built to `lib/tasks/tasks.test.js`) that boots the real PGlite runtime against
a temp `DSH_HOME` and covers the routes, validation, fractional ranking,
settings persistence and the dispose → reopen persistence path.

## License

MIT

The file-explorer tab's client UI is ported from
[oneirictouch/dsh-explorer-editor](https://github.com/oneirictouch/dsh-explorer-editor)
(MIT), © its contributors, and re-wired onto this bundle's remote-aware host
routes; the host half and the HTTP adapter are original to this bundle.

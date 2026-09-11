# Paperspace

Paperspace is an academic-paper reader that runs **inside the DSH profile process**: no Docker, no
MinIO, no separate worker. Storage is an embedded PostgreSQL (`@electric-sql/pglite`, the WASM build
of real PostgreSQL) plus a local filesystem object store; the postgres.js domain layer keeps working
unchanged because PGlite is exposed over a loopback pgwire socket (`@electric-sql/pglite-socket`)
the `postgres` client connects to. Ingest and translation are plain timer loops owned by
`ctx.effect`, so unloading the row disposes the database, the socket and the loops. The UI appears
twice, as a **Papers** tab in the conversation view and as a right-Sidebar page tab, over one shared
component tree. Everything is gated behind a first-run configuration step (`<dsh
home>/paperspace/settings.json`, `configured: true`); until then business routes answer `423
PAPERSPACE_NOT_CONFIGURED` and the worker stays dormant. Host half: `src/host/paperspace/` (row
`dsh-unknownue-plugins/paperspace`, `inject: ['webServer']`, optional `ctx.provide('paperspace',
host)`); browser half: `src/client/paperspace/`.

## Where it lives in the UI

- **Papers tab** — registered into `conversation.view` by `applyPaperspaceTab`
  (`src/client/paperspace/index.tsx`) with slot id `dsh-unknownue-plugins/paperspace` and `order:
  30`; the label comes from the `en` dictionary as **Papers**. It sits **after the Files tab**
  (`src/client/explorer-editor/index.ts`, `order: 20`) and **after the Tasks tab**
  (`src/client/tasks/index.tsx`, `order: 25`).
- **Right-Sidebar page tab** — `applyPaperspaceSidebar` (`sidebar-tab.tsx`) registers a tab type
  with kind `paperspace` and id `dsh-unknownue-plugins/paperspace` (`priority: 'builtin'`; DSH
  records page tabs at `sidebar://<kind>`), the body into `sidebar.right.pane.tab` and the chip
  title into `sidebar.right.pane.tab.title`. Registration is wrapped in `ctx.inject(['slots',
  'sidebarRightTabs'])` and the controller behind the "open in sidebar" actions is bound separately
  through `ctx.inject(['sidebarRight'])`, so on a DSH build without the right Sidebar the whole
  surface stays inert. The guide entry lives on the tab type (`guide: [{ order: 20, title,
  description, icon }]`), which is how Papers appears next to Files in the Sidebar's add control.
- **Navigation contract** — the tab is a *page*: its route rides the tab's navigation `params`. `{
  arxivId }` renders that paper's reader; an **empty params object** (the reader's back link)
  renders the library; **no params at all** (guide entry box, strip add control, a layout restored
  by undo) resumes the paper the tab last showed, remembered in module state plus a `sessionStorage`
  mirror under `dsh-unknownue-plugins/paperspace:sidebar-paper` and falling back to the library only
  when nothing was ever open. Body navigation writes back through `tab.actions.openTab(kind, {
  params })`, so opening another paper re-points the one tab instead of stacking tabs; the chip
  title appends the arXiv id while a paper is shown.
- **Open in sidebar entries** — the library row action and the reader header action appear only when
  the controller exists **and** the hosting surface is `view`; the helper returns `false` and logs
  when the column throws (a global main panel owning the surface, for instance). Deleting a paper
  forgets the remembered sidebar paper, so a params-less open never resumes into a deleted paper.
- **Session-header badge** — `PaperBadge` is registered into `conversation.session.header.actions`
  (`order: 8`, id `dsh-unknownue-plugins/paperspace-badge`). It reads the current session id from
  `ctx.sessions.list` via `useSyncExternalStore`, probes `GET /sessions/:id`, and renders a paper
  glyph plus the title (arXiv id as tooltip) only while the linked paper is `ready`; otherwise it
  renders nothing.
- **Composer paper-link picker** — `PaperLinkControl` is registered into `conversation.input.dock`
  (`order: 5`, id `dsh-unknownue-plugins/paperspace-link`). Its gate is `session.blank === true &&
  session.openState === 'open'` (the condition DSH's own mode selector uses), so it appears on the
  hero/welcome composer only and **disappears as soon as the session has messages**; it renders
  nothing without a session id or before the binding probe resolves. It lists `ready` papers (`GET
  /papers?page=1&page_size=100`) and binds the current session with `POST /sessions/link`, after
  which the chip shows the paper title and clicking again rebinds. Because dynamic plugins cannot
  import `react-dom`, the chip node is reparented onto the hero row with plain DOM calls.
- **Settings** — `settings-page.tsx` fills the **UnPlugin** section (`settings.section`, `order:
  45`, label `UnPlugin`), which paperspace owns and the tasks feature appends to: enable toggle,
  storage paths, translation-model pickers, proxy, and an advanced block with the worker tunables.
  The page mounts *outside* the tab, so it wraps itself in `.dsh-paperspace` to pick up the scoped
  stylesheet.
- **Localization** — shell labels come from locale namespace `dsh-unknownue-plugins.paperspace`
  (`en`: `view.label` = "Papers", `settings.label` = "UnPlugin", `sidebar.title` = "Papers", plus
  the guide title and description). Many in-tab strings (library actions, status lines, theme
  switch, translation panel, setup screen) are **not** in the dictionary and are hard-coded in the
  bundle author's language, so those controls do not follow the DSH locale.

## Reader features

**Library (`papers-list.tsx`).** A search box filters client-side over the serialized paper objects;
category chips come from `All`, a fixed seed list (`cs.AI`, `cs.CL`, `cs.CV`, `cs.LG`, `cs.RO`,
`cs.DC`, `cs.LO`) and every category present in the loaded papers. The add-by-arXiv-id modal
validates `/^\d{4}\.\d{5}(v\d+)?$/` client-side as well as server-side. The list polls `GET
/papers?page=1&page_size=100` every 5000 ms while any row is `ingesting`; a `failed` row shows the
stored error with **retry** (re-posting the same id requeues the paper) and **delete**
(confirm-guarded, and it drops the sidebar memory).

**Reader (`reader.tsx`).** Per-paper `GET /papers/:ref`; header with a back link, title, authors,
tags and controls for body font size (12-26 px, step 1, default 16, click the value to reset),
content width (40-100 %, step 1, default 100 %, click to reset), a three-way theme switch, the
discuss-with-AI action (only for a `ready` paper and only on the tab surface), the open-in-sidebar
action, external arXiv abs/PDF links and delete. Contents navigation is two-fold: a fixed
hover-reveal TOC rail built from `h1`-`h4` with `github-slugger` anchors (hidden below the mobile
breakpoint and on the sidebar surface), and a floating section-jump picker anchored to the tab's
right edge. The active heading follows scroll position, Escape closes the picker, and a back-to-top
button appears once a scroll container passes 320 px.

**Rendering.** Markdown goes through `react-markdown` with `remark-gfm` and `remark-math`, then
rehype `raw`, the custom `rehype-math-in-raw-tables`, `katex` and `slug`. The custom plugin turns
`$...$` inside raw-HTML `<td>`/`<th>` cells into `math-inline` spans and strips macros KaTeX rejects
(`\definecolor`, `\color[...]{...}`, `\pagecolor`, `\begin{array}[]`). Every image renders through
`PaperImage`, which caps display height and opens a click-to-enlarge lightbox (Escape closes it,
body scroll is locked while open). Fenced code blocks survive ingestion as real fences, and ingested
block math carries the arXiv equation number as a `\tag{...}`.

**Translation panel (`translation-panel.tsx`).** A language select (`zh-CN`, `en-US`, `ja-JP`; the
start button is worded per target language, for example "Translate to English"), then one of four
states: start, running (progress bar with `progress/total`, attempt count and model), failed (error
text plus retry) and completed. Completed offers the **original / translated / bilingual** switch, a
re-translate action and a delete-translation action. The panel polls `GET
/papers/:ref/translation?lang=...` every 1500 ms while a job or snapshot is active, and cancel sends
`DELETE .../translation-job?lang=...`. It renders the original article until a snapshot with status
`completed` exists for the selected language, and reports that effective mode upward so the reader
can defer its scroll restore. Bilingual rendering splices translations into the source at the
persisted offsets (pure string splicing, no re-splitting in the browser), each translation below its
original behind a "Translation" label.

**Per-paper view state.** The reader keeps the scroll offset per `(surface, arxivId)` at module
level (it survives tab switches, because DSH unmounts inactive views); the translation language and
view mode per paper are mirrored in `sessionStorage` under
`dsh-unknownue-plugins/paperspace:view:<arxivId>`; theme, font size and content width live in
`localStorage`. The restore waits until the restored layout is on screen and is abandoned once real
user input (wheel, touch, key) is seen.

**Markdown and preview behaviour worth knowing.** Ingest converts arXiv HTML (or the ar5iv fallback)
to markdown with turndown plus GFM: MathML annotations become `$...$` and `$$...$$`, `ltx_listing`
figures become fenced code blocks, and `<object>` vector figures are re-emitted as images so they
survive. Downloaded image references are rewritten to
`/dsh-unknownue-plugins/paperspace/api/papers/<arxivId>/assets/<assetId>`; references that failed to
download are rewritten to their **absolute source URL**, so they do not resolve as broken relative
links.

## Architecture

### PGlite runtime and the loopback pgwire socket (`db.ts`)

- One `PGlite` instance per configured runtime: `{ dataDir, initialMemory: initialMemoryBytes,
  extensions: { pgcrypto } }`; `pgcrypto` is what the schema's `gen_random_uuid()` defaults need.
- A `PGLiteSocketServer` on `127.0.0.1` with `maxConnections: 5`: the socket package defaults to one
  connection and *rejects* further clients, while the postgres.js pool uses `max: 2` and `sql.begin`
  opens a dedicated connection, so the headroom is required. `port: 0` asks the OS for an ephemeral
  loopback port, and the bound port is read back from the server object and handed to the client.
- Migrations: the verbatim schema (`schema.ts`) runs only when `to_regclass('paper.papers')` is
  `NULL`; the v2 session-link table is created idempotently on every boot.
- The domain layer therefore still speaks **postgres.js** (`host`, `port`, `user: 'postgres'`,
  `database: 'postgres'`, `max: 2`, `connect_timeout: 10`, `idle_timeout: 20`, `transform:
  postgres.camel`), so `FOR UPDATE SKIP LOCKED` claiming, JSONB search and the partial unique index
  work exactly as ported. `dispose()` is idempotent and best-effort, in order: socket server, client
  (`sql.end({ timeout: 5 })`), `pglite.close()`.

### Local object store (`filestore.ts`)

- Five-method surface, the same one the MinIO client exposed: `ensureBucket`, `putObject`,
  `getObject`, `deleteObject`, `deleteObjects`.
- Deterministic keys `papers/{arxivId}/{sha1(url)[:16]}.{ext}`; the extension comes from the
  response content type (falling back to `png`) and only the URL is hashed, so one image always
  lands on one key.
- The root is the configured `assetsDir` (default `<dsh home>/paperspace/assets`); keys resolve
  inside the root and anything that escapes throws `invalid object key`. `getObject` rejects with
  `ENOENT` for a missing key (the MinIO contract); `deleteObjects` logs per-key failures and never
  throws.

### In-process workers (`worker/`)

There is **no separate worker process**. `startWorker` registers a single `ctx.effect` whose
disposer clears three timers: an ingest tick and a translation tick, both every `pollMs`, and a
stuck-job rescan every `rescanIntervalMs`. Each tick is guarded by a no-overlap flag, so one paper
is ingested and one job translated at a time.

- **Ingest.** Claim the next stale `ingesting` paper with `claimNextIngesting(3)` (lease-based, `FOR
  UPDATE SKIP LOCKED`, heartbeat `updated_at` every 1000 ms), then: arXiv Atom metadata
  (`export.arxiv.org/api/query`), arXiv HTML5 with an ar5iv fallback (the primary endpoint only gets
  `min(ingestTimeoutMs, 12000)` so a hang cannot eat the whole budget), HTML to markdown, image
  downloads into the object store with `ingestConcurrency` workers under `maxAssetBytes` and
  `ingestTimeoutMs`, and finally **one transaction** that inserts the asset rows, rewrites image
  URLs to local asset routes and marks the paper ready. The paper is then materialized into the
  shared workspace. Failure is retried up to **3 in-process attempts** (an `ingestAttempts` map, no
  schema change) by re-queueing; the third failure marks the paper `failed` with the message
  (truncated to 2048 bytes by the schema check).
- **Translation.** Claim one runnable job (`FOR UPDATE SKIP LOCKED`), resolve the provider persisted
  on the job row, split the markdown into translatable paragraphs (`domain/paragraphs.ts` skips
  headings, rules, fenced and indented code, listing artifacts, display math, image-only and
  raw-HTML blocks, the `<table>` part of mixed blocks, and everything under a
  References/Bibliography heading), extract a glossary once (at most 60 terms from at most 40000
  source characters), then translate paragraph by paragraph, persisting the snapshot and progress
  after each one so a retry resumes where it stopped. Math, inline code and HTML tags are swapped
  for placeholder markers before the model call and restored afterwards, so formulas survive
  byte-for-byte. Fatal errors (no provider, paper not ready, DSH `llm` service missing, empty
  paragraph list) fail permanently; other failures requeue with exponential backoff `min(60 *
  2^(attempts-1), 900)` seconds until `translateMaxAttempts` is reached. The rescan requeues
  `running` jobs whose lease is older than `translateStuckAfterMinutes`, and a watchdog releases the
  queue slot if a tick overruns `translateTimeoutMs + 60000` ms. `GET /health` reports the liveness
  snapshot (`translateTickAt`, `lastClaimAt`, `lastError`).

### Native DSH conversations (`dsh-integration.ts`)

Paperspace has no chat UI of its own. The discuss action runs the native DSH flow: `POST /sessions {
arxiv_id }` materializes `<workspaceDir>/papers/<arxivId>.md` and returns the workspace path, then
the client calls `workspaces.create({ path })`, waits for the workspace to appear in its list,
`sessions.create({ workspaceId })`, `sessions.open(sessionId)` and finally `POST /sessions/link`.
The link route records the binding, renames the session after the paper through the `sessionTitle`
service (120-character cap) and refreshes the paper-context cache. **One shared workspace** holds
the `papers/` subdirectory, so the workspace list gains one entry no matter how many papers are
read.

Tools are registered as real DSH tools through `defineTool` and the `tools` service (registration is
lazily retried, because the service may be assembled after this row). Both resolve the caller's
paper per session, in this chain:

```
exec.agent.id -> exec.agent.sessionId -> paper.paper_sessions.session_id
              -> paper.papers (by arxiv_id) -> paper markdown
```

- `search_paper` takes one `query` argument (max 500 chars), splits the markdown on blank lines,
  scores paragraphs by how many lowercased query terms they contain, and returns up to 8 passages of
  at most 1200 characters with 0-based paragraph indexes, or a note when the session is not linked
  or nothing matched.
- `read_section` takes one `heading` argument (max 200 chars), matches a heading line exactly
  (case-insensitive, ignoring the `#` markers) and returns that section up to 12000 characters, or
  `content: null` when the heading does not exist.

The current paper is also injected into the system prompt via `systemPrompt.section({ name:
'paperspace:current-paper', order: 120, text })`, whose text names the paper and points the model at
the two tools or `papers/<id>.md`. Prompt providers cannot await SQL, so the provider reads
`scope.id` against a sessionId-to-text cache the row refreshes whenever a link changes; `GET /debug`
reports the registration flags, cache keys and provider statistics.

### Style and theming

- `src/client/paperspace/styles.css` is scope-prefixed under `.dsh-paperspace` at build time by the
  esbuild CSS plugin, so generic class names (`paper-article`, `reader-toc`, `dialog`) cannot leak
  into DSH chrome. The root also carries `data-ps-surface="view" | "sidebar"` and `data-ps-theme`.
- An unscoped `THEME_CSS` block maps DSH design tokens (`--dsw-alias-*`) onto paperspace-local
  variables; the reading surface keeps its own "paper" palette, flipped for dark mode by
  `body[data-ds-dark-theme]` (auto) or a pinned `data-ps-theme`. Pinned modes also repaint the
  hosting view container and DSH's scrollport, restoring every inline style on unmount.
- KaTeX CSS is injected with its `url(fonts/...)` references rewritten to
  `/dsh-unknownue-plugins/paperspace/static/fonts/...`, and the host serves those files from the
  installed `katex` package with `cache-control: public, max-age=31536000, immutable`.
- The composer-hiding rule is guarded by the surface attribute:
  `[data-phase='active']:has(.dsh-paperspace [data-ps-surface='view']) [data-composer-seat]`.
  Without the guard, a paper shown in the right Sidebar next to the chat would hide the chat's own
  input box. The sidebar surface also drops the floating TOC and compacts its paddings.

## HTTP API

Routes are registered on the shared `ctx.webServer`. Base: `/dsh-unknownue-plugins/paperspace/api`;
paths below are relative to it, and `:ref` is the paper UUID **or** its arXiv id.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `{ status: 'not-configured' }`, or `{ status: 'ok', worker }` after a `select 1` roundtrip. |
| GET | `/models` | DSH's currently available model directory; available **before** configuration, because the settings picker needs it. |
| GET | `/settings` | `{ configured, restartRequired, settingsPath, defaults, settings }`; also available before configuration. |
| POST | `/settings` | Validate (strict zod) and persist settings; `{ ok, configured, restartRequired }`, or 400 `SETTINGS_INVALID`. |
| GET | `/debug` | Integration diagnostics: tool/context registration flags, cache keys, provider stats, last 20 session links. |
| GET | `/sessions/:sessionId` | The paper this DSH session links to (404 `SESSION_NOT_LINKED`). |
| POST | `/sessions` | `{ arxiv_id }` materializes `<workspaceDir>/papers/<id>.md`; returns `{ workspaceDir, arxivId, mdFile }` (409 `PAPER_NOT_READY`). |
| POST | `/sessions/link` | `{ session_id, arxiv_id }` records the binding, renames the session, refreshes the paper context. |
| POST | `/papers` | `{ arxiv_id }` gives 202 while ingesting, 200 when it already exists, and 202 again when a `failed` paper is requeued. |
| GET | `/papers` | List with `page`, `page_size` (max 100), `search`, `category`; returns `{ items, page, page_size, total }`. |
| GET | `/papers/:ref` | Paper detail including the full markdown (404 `PAPER_NOT_FOUND`). |
| DELETE | `/papers/:ref` | Drop object-store keys (best effort), cascade the rows, remove the workspace markdown, refresh the context cache, 204. |
| GET | `/papers/:ref/assets` | Asset metadata: `id`, `originalUrl`, `contentType`, `sizeBytes`, `createdAt`. |
| GET | `/papers/:ref/assets/:assetId` | Stream the object bytes with the stored content type and `cache-control: public, max-age=86400`. |
| POST | `/papers/:ref/translate-paper` | `{ target_lang }` gives 202 with the job (an already-active job is returned rather than duplicated); 400 `MODEL_NOT_CONFIGURED` or `MODEL_UNAVAILABLE`, 409 `PAPER_NOT_READY`. |
| GET | `/papers/:ref/translation?lang=` | The stored snapshot plus its latest job (404 `TRANSLATION_NOT_FOUND`). |
| DELETE | `/papers/:ref/translation?lang=` | Delete the snapshot (204). |
| GET | `/papers/:ref/translation-job?lang=` | The latest job for that language (404 `TRANSLATION_JOB_NOT_FOUND`). |
| DELETE | `/papers/:ref/translation-job?lang=` | Cancel the active job and drop its snapshot (204, or 404 `TRANSLATION_JOB_NOT_ACTIVE`). |
| GET | `/dsh-unknownue-plugins/paperspace/static/fonts/<name>` | KaTeX `woff2`/`woff`/`ttf`/`otf`, immutable cache; static assets only, so **not** loopback-fenced. |

- **Loopback fence.** Every API handler first requires a loopback socket address and a loopback
  `Host` header, otherwise `403 FORBIDDEN`; a `ZodError` becomes `400 VALIDATION_ERROR`, anything
  else `500 INTERNAL_ERROR`. Business routes (`/papers*`, `/sessions*`) answer `423
  PAPERSPACE_NOT_CONFIGURED` until the user saves `configured: true`, while `/health`, `/models`,
  `/settings`, `/debug` and the font route work either way.
- **No SSE endpoint exists.** `chat/stream` survives only as a comment in `routes.ts`; nothing registers
  it and no client calls it, so such a request falls through to `404
  NOT_FOUND`. The ported agent runtime (`runAgent`, `createPaperTools`, `encodeSse`/`parseSse`)
  lives in `runtime/` and is covered by tests, but its only production consumer is the translation
  worker, which uses `OpenAICompatibleProvider` for legacy-endpoint jobs. See
  `../reference/http-api.md` for the shared fence and error conventions.

## Configuration and storage

Resolution order: `settings.json` (user) > `cordis.patch.yml` row > built-in defaults (`settings.ts:
builtinDefaults`). Built-in default and shipped row differ for one key (`ingestTimeoutMs`), so both
are listed.

| Key | Built-in default | Shipped row | Meaning |
|---|---|---|---|
| `dataDir` | `<dsh home>/paperspace/db` | empty (default) | PGlite data directory. |
| `assetsDir` | `<dsh home>/paperspace/assets` | empty (default) | Local object-store root. |
| `workspaceDir` | sibling of the effective `dataDir` (`dirname(dataDir)/workspace`) | empty (default) | DSH workspace anchor; holds `papers/<arxivId>.md`. |
| `port` | `0` | `0` | pgwire listen port; `0` means an OS-assigned loopback port. |
| `initialMemoryBytes` | `536870912` (512 MiB) | `536870912` | PGlite WASM initial memory, in **bytes**. |
| `pollMs` | `5000` | `5000` | Ingest and translation tick interval. |
| `ingestTimeoutMs` | `60000` | `30000` | Per-request arXiv timeout. |
| `maxAssetBytes` | `10485760` (10 MiB) | `10485760` | Max bytes per downloaded image; larger ones are skipped. |
| `ingestConcurrency` | `2` | `2` | Concurrent image downloads per paper. |
| `translateMaxAttempts` | `3` | `3` | Attempts before a translation job fails permanently. |
| `translateStuckAfterMinutes` | `30` | `30` | `running` jobs older than this are requeued. |
| `translateTimeoutMs` | `120000` | `120000` | Per-LLM-request translation timeout, and the watchdog base. |
| `rescanIntervalMs` | `60000` | `60000` | Stuck-job rescan interval. |
| `translateModel` | `null` | not seeded | Translation model as a DSH provider route plus model id, picked from `GET /models`; required before any job can start. |
| `proxy` | `''` | not seeded | HTTP(S) proxy for arXiv, image downloads and LLM calls; empty means auto-detect from the environment. |

Paths accept `~` and resolve against the process cwd when relative, and inputs pass a strict zod
schema: paths 1-1024 chars; `port` 0-65535; `initialMemoryBytes` 64 MiB-8 GiB; `pollMs` 500-3600000;
`ingestTimeoutMs` 1000-600000; `maxAssetBytes` 1 KiB-1 GiB; `ingestConcurrency` 1-16;
`translateMaxAttempts` 1-10; `translateStuckAfterMinutes` 1-1440; `translateTimeoutMs` 1000-3600000;
`rescanIntervalMs` 5000-86400000.

**Persistence and the first-run gate.** `<dsh home>/paperspace/settings.json`, written
pretty-printed with `version: 1` and `configured`. A missing or unparsable file is treated as
unconfigured, which is what keeps every business route at 423. Saving `configured: false` disposes
the runtime immediately and leaves the data on disk; saving `configured: true` with no runtime up
boots it and reports `restartRequired: false`.

**`restartRequired` semantics.** When the runtime is already up, a save recomputes the merged
effective config and compares **every key** with the running config: any difference sets
`restartRequired: true`, because the runtime and the worker loops captured their settings at start.
The exported helper `storageAffectingKeys()` names `dataDir`, `assetsDir`, `workspaceDir`, `port`
and `initialMemoryBytes`, but the save path does not use it. The stored value takes effect on the
next `dsh web` restart; nothing is applied live except the file itself, which makes the translation
model the one setting that behaves immediately (it is read per request).

**What to back up.** `dataDir` (the PGlite directory: papers, asset metadata, translation snapshots
and jobs), `assetsDir` (downloaded figures and embedded images) and `settings.json` together
preserve a library. `workspaceDir` only holds regenerable `papers/<arxivId>.md` materializations.

**Credentials and environment.** DSH-route translation runs through DSH's own `llm` service, using
the provider and model stored in paperspace settings; **no API key is stored there**. Legacy job
rows carrying `{ baseUrl, apiKey, model }` are still honoured by the worker, and the API redacts the
key. A job row with no provider falls back to the environment: `LLM_API_KEY` (with `LLM_BASE_URL`,
default `https://api.deepseek.com`, and `LLM_MODEL`, default `deepseek-chat`); without `LLM_API_KEY`
the job fails permanently. `DSH_HOME` relocates `<dsh home>`, and each worker tunable also honours
an environment variable that wins over the stored value when it parses as a number:
`WORKER_POLL_MS`, `INGEST_TIMEOUT_MS`, `MAX_ASSET_BYTES`, `INGEST_CONCURRENCY`,
`TRANSLATE_MAX_ATTEMPTS`, `TRANSLATE_STUCK_AFTER_MINUTES`, `TRANSLATE_TIMEOUT_MS`,
`RESCAN_INTERVAL_MS`. Proxy detection falls back to `HTTPS_PROXY`, `https_proxy`, `HTTP_PROXY` and
`http_proxy`.

## Operations and edge cases

- **Stopping it.** Toggle it off in the settings page (or `POST /settings { configured: false }`):
  the runtime is disposed, `active` becomes null, the paper-context cache is cleared, business
  routes return 423 again, and data stays on disk. Unloading or disabling the plugin row runs the
  `ctx.effect` disposer (`dsh-unknownue-plugins/paperspace: runtime dispose`), which also clears the
  worker loops and closes the cached proxy agent; a `dsh web` restart does the same and re-reads the
  file.
- **Missing credentials.** Starting a translation with no persisted model is a 400
  (`MODEL_NOT_CONFIGURED`), and a stored provider missing from DSH's current directory is a 400
  (`MODEL_UNAVAILABLE`). A DSH-route job without an `llm` service, or a legacy job without a
  provider and without `LLM_API_KEY`, fails permanently on the first attempt.
- **Failure states in the UI.** A failed ingest is visible three times: the library row's failed
  status line with the stored error, the reader's ingestion-failed note, and a retry action that
  requeues the paper. A failed translation shows the job error with a retry action, and the panel
  falls back to the original article. `GET /health` exposes worker liveness and `GET /debug` the
  registration state, which are the first things to check when the tools or the paper badge do not
  appear.
- **Proxy support.** arXiv metadata and HTML, image downloads and legacy OpenAI-compatible
  translation calls all go through `proxyFetch`, which prefers the configured `proxy` and otherwise
  reads the environment. `proxy.ts` imports `undici`'s `ProxyAgent` at module load, but `undici` is
  **not** a declared dependency of this package (host npm packages stay external at build time), so
  proxy support depends on `undici` resolving from the installed tree.
- **Known limitations, all code-verified.** There is no chat/SSE endpoint, so DSH-native sessions
  are the only conversation surface and the ported agent runtime is reachable only from tests.
  `paper.chats` and `paper.chat_messages` exist in the schema but nothing in this bundle reads or
  writes them (no chat repo exists). Only post-2007 arXiv ids are accepted (`YYMM.NNNNN[vN]`);
  legacy ids such as `math.GT/0309136` fail validation in both the client form and the routes. The
  library always requests page 1 with `page_size=100` and filters in the browser, so the API's
  `search`, `category` and pagination parameters are unused by the UI. Concurrency is one paper at a
  time, because the ingest and translation ticks are serialized by no-overlap flags. In-process
  ingest attempt counters are lost on restart, and translation recovery after a crash relies solely
  on the stuck-job rescan. `settings.json` is parsed with a **strict** schema (zod `.extend()`
  preserves `.strict()`), so an unrecognized key makes the whole file fail validation and load as
  null: the feature then reports unconfigured and falls back to the row and built-in paths, despite
  the source comment claiming additive fields are tolerated. Translation targets are fixed to
  `zh-CN`, `en-US` and `ja-JP` by a database check constraint, and the job DTO never exposes the
  stored provider API key.

## Tests

The host half ships a framework-free integration suite that boots the real PGlite runtime (pgwire
socket, postgres.js, filesystem object store) inside a mock cordis context, with `DSH_HOME`
redirected to a temp directory and long poll intervals so the worker loops stay dormant:

```sh
npm run build                              # bundle src/ -> lib/ (esbuild)
node lib/paperspace/paperspace.test.js     # the paperspace suite alone
npm test                                   # explorer + paperspace + tasks suites
```

Source: `src/host/paperspace/paperspace.test.ts`, built to `lib/paperspace/paperspace.test.js`.
Every `check(...)` call is pushed into a `results` array and the run prints `passed/total`, exiting
1 on failure and 2 on a fatal error; the suite contains **98 checks**. Coverage: `apply()` wiring (routes, the provided `paperspace` service, exactly one
`ctx.effect` disposer before configuration); gating (unconfigured state, `GET /settings` defaults,
423 on business routes, `health` `not-configured`, 400 for an invalid settings payload); real PGlite
(port assignment, the `paper.papers` migration, ingest claiming through `FOR UPDATE SKIP LOCKED`,
the translation job lifecycle including cancel-is-a-no-op); REST (papers CRUD and validation,
duplicate insert, detail/list/404, asset metadata plus byte-exact streaming, missing-asset 404,
`/models` against a mock `llm` service, translation start without a configured model,
start/poll/cancel/re-cancel, and delete removing the paper, its objects and the workspace markdown);
sessions and tools (workspace preparation and `papers/*.md` materialization, `POST /sessions/link`
plus session renaming, session lookup, 409 for a non-ready paper, tool registration order, grounding
through both `exec.agent.sessionId` and `exec.agent.id`, and the system-prompt context helpers); the
KaTeX font route (a real `woff2` with the right content type, 404 for non-font names); pure helpers
(paragraph split/splice regressions for fences, blank-line and tilde fences, indented code, listings
and the references gate; image URL extraction and rewriting; glossary JSON parsing; `protectMath`
shielding plus exact restore); mock-LLM end-to-end (an OpenAI-compatible SSE server drives glossary
extraction and paragraph-by-paragraph translation, resume skipping done paragraphs, requeue with
backoff and permanent failure at `maxAttempts`; a fake DSH `llm` service drives DSH-route jobs,
including the no-service fatal path); the object store roundtrip; the `parseSse` roundtrip; dispose
so queries fail; and the settings-file restart regression.

## Related

- [Configuration reference](../reference/configuration.md) — bundle rows, `DSH_HOME`, settings
  files.
- [HTTP API reference](../reference/http-api.md) — shared route registration, loopback fence, SSE.
- [Development](../development.md) — building, type-checking and running the suites.
- [Integrations](../integrations.md) — how the bundle's rows cooperate inside one DSH profile.
- Source of truth for this page: `src/host/paperspace/` (`index.ts`, `routes.ts`, `settings.ts`,
  `schema.ts`, `db.ts`, `filestore.ts`, `dsh-integration.ts`, `proxy.ts`, `shared.ts`, `types.ts`,
  `domain/`, `runtime/`, `worker/`) and `src/client/paperspace/`.


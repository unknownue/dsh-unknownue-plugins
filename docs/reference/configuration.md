# Configuration

Everything this bundle can be told to do, and where each setting lives. Configuration stacks in three layers:

1. **Bundle patch** — `cordis.patch.yml` ships inside the package and inserts three host rows: `dsh-unknownue-plugins` (the client-side width control; its host half is inert), `paperspace`, and `tasks`. It applies wherever the bundle is installed (see [Integrations](../integrations.md)).
2. **Your patch layer** — a profile's `cordis.patch.yml`, and above it `<dsh home>/cordis.patch.yml`, patch those rows by `id`. See [Overriding in a profile](#overriding-in-a-profile).
3. **Runtime settings and browser preferences** — the paperspace and tasks Settings sections persist to `<dsh home>/<feature>/settings.json`, while pure-UI preferences live in the browser's `localStorage` / `sessionStorage`. See [Paperspace settings file](#paperspace-settings-file) and [Browser-local preferences](#browser-local-preferences).

`<dsh home>` is the `DSH_HOME` environment variable when set, otherwise `~/.dsh`. Both settings modules resolve it on every access (`process.env.DSH_HOME || join(homedir(), '.dsh')` in `src/host/paperspace/settings.ts` and `src/host/tasks/settings.ts`).

## Bundle row (`dsh-unknownue-plugins`)

**The row takes no configuration.** It carries the client-side content-width
control and mounts this package's client bundle; its host half registers nothing.
The `explorer:` block it used to seed (`maxListEntries`, `maxReadBytes`,
`maxRawBytes`, `structuralGraceMs`, `stderrTailBytes`) went away with the file
explorer, and a leftover `explorer:` block in a profile patch is simply ignored.

## Paperspace row and settings

The row only seeds the settings form's initial values. The effective config is built as **built-in defaults ← row (`cordis.patch.yml`) ← `<dsh home>/paperspace/settings.json`**. An empty string means "inherit": an empty `dataDir` / `assetsDir` / `workspaceDir` in the row falls through to the built-in default. Paths expand `~` and resolve relative values against the process cwd.

| key | default | meaning |
|-----|---------|---------|
| `dataDir` | `<dsh home>/paperspace/db` | PGlite data directory (row seed is `''`). |
| `assetsDir` | `<dsh home>/paperspace/assets` | Object-store root for downloaded paper figures. |
| `workspaceDir` | sibling of `dataDir` (`dirname(dataDir)/workspace`) | DSH workspace anchor that holds `papers/<arxivId>.md`. Without a row or file value the built-in default is `<dsh home>/paperspace/workspace`. |
| `port` | `0` | pgwire listen port; `0` lets the OS assign a loopback port. Accepted range 0–65535. |
| `initialMemoryBytes` | `536870912` (512 MiB) | PGlite WASM memory. Accepted range 64 MiB – 8 GiB. |
| `pollMs` | `5000` (ms) | Ingest / translation worker poll interval. Accepted range 500–3600000. |
| `ingestTimeoutMs` | `60000` built-in, `30000` as the bundle patch seeds it | arXiv metadata/HTML fetch timeout. Accepted range 1000–600000. The shipped `cordis.patch.yml` seeds 30000, which wins over the built-in default. |
| `maxAssetBytes` | `10485760` (10 MiB) | Per-image download cap. Accepted range 1024–1073741824. |
| `ingestConcurrency` | `2` | Parallel image downloads. Accepted range 1–16. |
| `translateMaxAttempts` | `3` | Attempts before a translation job is marked permanently failed. Accepted range 1–10. |
| `translateStuckAfterMinutes` | `30` | A running translation job older than this is re-queued. Accepted range 1–1440. |
| `translateTimeoutMs` | `120000` (ms) | Per-request LLM timeout for translation. Accepted range 1000–3600000. |
| `rescanIntervalMs` | `60000` (ms) | Interval of the stuck-job rescan. Accepted range 5000–86400000. |
| `translateModel` | `null` | `{ provider, model }` pair selected from DSH's live model directory (each id up to 200 chars). Translation cannot start while this is `null`. |
| `proxy` | `''` | Explicit HTTP proxy for arXiv, image, and LLM fetches (up to 2048 chars). Empty falls back to the environment — see [Environment variables](#environment-variables). |

The accepted ranges come from the strict zod schema on the settings route, so an out-of-range or unknown key is rejected with `400 VALIDATION_ERROR`. See [Paperspace](../features/paperspace.md) for the feature itself.

### Paperspace settings file

`<dsh home>/paperspace/settings.json` holds `version: 1`, `configured`, and every key in the table above (pretty-printed, trailing newline). It is read once when the plugin row applies, so hand edits take effect on the next `dsh web` restart.

The Settings section (DSH Settings, UnPlugin area) can change every key: storage paths, pgwire port and memory (shown in MiB and converted to bytes), the translation model picker (populated from `GET /paperspace/api/models`), the proxy, and the advanced worker tunables under a collapsible group.

### First-run gate

- With `configured: false` the runtime never starts: `ensureStarted()` answers `paperspace is not configured yet; save settings first`, and the business routes respond `423 PAPERSPACE_NOT_CONFIGURED`.
- `GET .../paperspace/api/settings`, `GET .../paperspace/api/models`, `GET .../paperspace/api/health`, and the static font route stay reachable so the form can be filled in and the model list read before enabling.
- Saving `configured: false` on a running instance disposes the runtime immediately (no restart needed) and leaves all data on disk.
- A missing or corrupt settings file is treated as unconfigured (a failed parse returns `null`), never as a startup error.

### `restartRequired`

Saving while the runtime is already up compares the whole effective config against the config the live runtime booted with; **any** changed key sets `restartRequired: true`, both in the save response and in `GET .../paperspace/api/settings`. PGlite and the worker loops captured their config at start, so the change lands on the next `dsh web` restart. A first save that boots the runtime reports `restartRequired: false`. The exported `storageAffectingKeys()` helper (`dataDir`, `assetsDir`, `workspaceDir`, `port`, `initialMemoryBytes`) documents which keys govern storage, but the running plugin does not consult it.

## Tasks row and settings

| key | default | meaning |
|-----|---------|---------|
| `dataDir` | `<dsh home>/tasks/db` | PGlite database directory (row seed is `''`). Back this directory up to move the board. |
| `initialMemoryBytes` | `134217728` (128 MiB) | PGlite WASM memory. Row-only: not editable in the Settings UI. |

### Task-board settings file

`<dsh home>/tasks/settings.json` holds `{ "version": 1, "dataDir": "<absolute path>", "presetTodos": [...] }`. The Settings section edits two things:

- `dataDir` — sent as `data_dir`; changing it while the runtime is up is persisted and flags `restartRequired` (PGlite booted against the old directory). Preset edits never flag it.
- Quick-add subtask presets — sent as `preset_todos`: at most 20 entries of at most 200 characters, trimmed and de-duplicated. Omitting the field keeps the stored list, `null` drops the field so the built-in presets return, and `[]` hides the quick-add panel.

**Auto-boot:** there is no `configured` gate (no credentials are involved). The runtime boots lazily on the first route hit, uses whatever `dataDir` resolves to at that moment, and a failed boot is retryable — the next request tries again. See [Tasks](../features/tasks.md).

## Environment variables

| variable | used by | meaning / effect |
|----------|---------|------------------|
| `DSH_HOME` | paperspace and tasks settings | `<dsh home>`, the root of `paperspace/settings.json` and `tasks/settings.json`. Unset → `~/.dsh`. |
| `LLM_API_KEY` | paperspace translation worker | Fallback credential. When a translation job carries no provider and this variable is set, the worker uses `{ baseUrl, apiKey, model }` built from the three variables below; unset means the env fallback does not exist. |
| `LLM_BASE_URL` | paperspace translation worker | Base URL of the env fallback provider. Unset → `https://api.deepseek.com`. |
| `LLM_MODEL` | paperspace translation worker | Model id of the env fallback provider. Unset → `deepseek-chat`. |
| `WORKER_POLL_MS`, `INGEST_TIMEOUT_MS`, `MAX_ASSET_BYTES`, `INGEST_CONCURRENCY`, `TRANSLATE_MAX_ATTEMPTS`, `TRANSLATE_STUCK_AFTER_MINUTES`, `TRANSLATE_TIMEOUT_MS`, `RESCAN_INTERVAL_MS` | paperspace worker loops | Per-tunable overrides (`envNumber` in `worker/loops.ts`): each wins over the stored/row value whenever it parses as a number, and is ignored otherwise. |
| `HTTPS_PROXY` / `https_proxy` | paperspace fetch layer | Proxy used when the `proxy` setting is empty, checked in this order. Node's built-in `fetch` ignores these variables on its own; the bundle injects an undici `ProxyAgent`. |
| `HTTP_PROXY` / `http_proxy` | paperspace fetch layer | Second fallback pair, checked after the HTTPS pair. |

The `proxy` setting always wins over the environment; resolution order is config → `HTTPS_PROXY` → `https_proxy` → `HTTP_PROXY` → `http_proxy`.

## Browser-local preferences

None of these reach the host: they are read and written by the browser half only.

| what | storage and key | scope | reset |
|------|-----------------|-------|-------|
| Chat/content column width | `localStorage` `dsh-unknownue-plugins:contentWidthPct` | Global per browser. Default 100 (%), range 50–150 in 1% steps, applied as the `--dsh-chat-content-width` CSS variable. | The dialog's "Reset 100%" button writes 100. |
| Paperspace light/dark preference | `localStorage` `dsh-unknownue-plugins/paperspace:theme` | Global per browser. `auto` (default, follows DSH) / `light` / `dark`. | Removing the key returns to `auto`. |
| Paperspace reader font size | `localStorage` `dsh-unknownue-plugins/paperspace:fontSize` | Global per browser. Pixels, default 16, range 12–26. | Out-of-range values are ignored and the default is used. |
| Paperspace reader content width | `localStorage` `dsh-unknownue-plugins/paperspace:contentWidthPct` | Global per browser. Percent, default 100, range 40–100. | Same fallback as above. |
| Paperspace tab route (library vs reader) | `sessionStorage` `dsh-unknownue-plugins/paperspace:route` | Per browser session. Survives a page reload, cleared when the session ends. | Clearing it reopens the library list. |
| Translation language and original/translated/bilingual mode | `sessionStorage` `dsh-unknownue-plugins/paperspace:view:<arxivId>` | Per paper, per browser session. Default `{ lang: 'zh-CN', mode: 'original' }`. | Clearing the entry returns the defaults for that paper. |
| Last paper shown in the right Sidebar's paperspace tab | `sessionStorage` `dsh-unknownue-plugins/paperspace:sidebar-paper` | Per browser session. | Clearing it makes a params-less open start from the library. |

One piece of UI state is deliberately **not** persisted: the reader's scroll offset (an in-memory map keyed by surface and arXiv id). The removed file explorer used to keep its own keys here (`dsh.explorer.treeWidth`, `dsh-explorer-editor-session`, `dsh-explorer-editor:editor-theme:v2`, `dsh-explorer-editor:md-mode:v2`, `dsh-explorer-editor:monaco-mirror`); they are inert leftovers and can be cleared.

## Overriding in a profile

Patch layers are applied in order — bundle patches, then the profile's `cordis.patch.yml`, then `<dsh home>/cordis.patch.yml`, then `--patch` overlays — and rows are keyed by `id`, so a later layer wins. A non-insert patch replaces the matched row's `config` object **as a whole** (the patch applies `target[key] = value`), so restate every key you want to keep. If you repeat `name`, it must match the row's current name or the patch is skipped with a warning. Use the non-insert form below: an `insert` list appends new rows rather than replacing them, so re-inserting one of these rows would mount the plugin twice.

```yaml
# <profile>/cordis.patch.yml (or <dsh home>/cordis.patch.yml, which outranks it)
- id: paperspace
  config:
    # `config` replaces the seeded object wholesale — restate what you keep.
    dataDir: ''
    assetsDir: ''
    workspaceDir: ''
    port: 0
    initialMemoryBytes: 536870912
    pollMs: 1000
    ingestTimeoutMs: 30000
    maxAssetBytes: 10485760
    ingestConcurrency: 2
    translateMaxAttempts: 3
    translateStuckAfterMinutes: 30
    translateTimeoutMs: 120000
    rescanIntervalMs: 60000

- id: tasks
  config:
    dataDir: ''
    initialMemoryBytes: 134217728
```

Omitting a key from such a patch is not the same as inheriting the bundle seed: it falls back to the **built-in** default. That difference is visible for `ingestTimeoutMs` (built-in 60000, bundle seed 30000). For paperspace, prefer leaving paths empty in the patch and setting the real locations once through the Settings UI, which writes `settings.json`.

**When a restart is required.** Rows are read when the plugin rows apply at boot, so any patch-file edit needs a `dsh web` restart. Browser preferences apply on the next page load. Paperspace settings saved through the UI either boot the runtime immediately (first save) or set `restartRequired`; disabling paperspace stops its runtime at once. See [Development](../development.md) for the build/install loop.

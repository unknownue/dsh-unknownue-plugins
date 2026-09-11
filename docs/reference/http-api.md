# HTTP API

Every route in this bundle is registered on DSH's shared web server through `ctx.webServer.register({ kind: 'exact' | 'prefix', path, handler })` and is fenced to loopback requests; the bundle's own browser half is the only intended client. Paths follow `/dsh-unknownue-plugins/<feature>/...`, and the bundle row also owns the toolbar/workspace routes.

The fence is the same check on every JSON route (the only exception is the paperspace static font route, which serves public assets and has no fence):

```ts
if (!isLoopback(req.socket.remoteAddress) || !isLoopbackHost(req.headers.host)) {
  return json(res, 403, { ok: false, error: "loopback-only" });
}
```

`isLoopback(address)` accepts `127.0.0.1`, `::1`, and `::ffff:127.0.0.1`; `isLoopbackHost(host)` strips the port (bracket-aware for IPv6) and lowercases the hostname, accepting `localhost`, `127.0.0.1`, `::1`, `::ffff:127.0.0.1`. Paperspace and tasks answer `403 { code: 'FORBIDDEN', message: 'loopback-only' }`; the bundle-row routes answer `403 { ok: false, error: 'loopback-only' }`.

Two payload conventions coexist:

- **Bundle-row routes** (`makefile`, `terminal`, `explorer`) are JSON-RPC: body `{ method, params }`, reply `{ ok: true, value }` or `{ ok: false, error }` — both with HTTP 200. Parse/shape problems are 400, a non-POST request is 405.
- **Paperspace and tasks** are REST: JSON bodies and `{ code, message }` errors.

## Toolbar and workspace actions

| method | path | purpose | request body | response |
|--------|------|---------|--------------|----------|
| POST | `/dsh-unknownue-plugins/makefile/api` | List Makefile targets with `##` help and the default target. Display-only: `make` is never executed. | `{ method: 'listTargets', params: { workdir?, makefile? } }` | `{ ok: true, value: { makefile, path, targets: [{ name, help }], defaultTarget } }` |
| POST | `/dsh-unknownue-plugins/terminal/api` | Open a terminal window at a directory (Windows `cmd`, macOS Terminal, Linux `x-terminal-emulator`). | `{ method: 'openTerminal', params: { path } }` | `{ ok: true, value: { opened, command } }` |

`workdir` defaults to `process.cwd()`; a relative `makefile` resolves against it and defaults to the row's `makefile` setting. The terminal route requires the path to exist and be a directory, otherwise `{ ok: false, error: ... }`.

Opening a directory in the OS file manager is **not** part of this bundle: the route (`/dsh-unknownue-plugins/open/api`) and its header button were removed in favour of DSH's own open-in-app plugin, which serves `/open-in-app/apps`, `/open-in-app/icon` and `/open-in-app/open`. See [Toolbar actions](../features/toolbar-actions.md).

Note a live caller/host mismatch: the shipped browser half posts `{ method: 'list', params: { cwd } }` for the Makefile route, while the host dispatches only `listTargets` and reads `workdir` — that call currently comes back as `{ ok: false, error: 'unknown method "list"' }`.

## File explorer

One POST endpoint carries a JSON-RPC dispatch; one GET endpoint streams watch events.

`POST /dsh-unknownue-plugins/explorer/api` — body `{ method, params }`. Every method takes `cwd` as the routing basis (the session cwd, passed verbatim), and the path fields below are resolved against it:

| method | params | result |
|--------|--------|--------|
| `list` | `cwd`, `path` | `{ world, path, entries: [{ name, type, size, path }], truncated }` (`size` may be `null`) |
| `read` | `cwd`, `path` | `{ content, size, world }`, or `{ tooLarge: true, size, world }` past `explorer.maxReadBytes` |
| `write` | `cwd`, `path`, `content` | `{ ok, world, path }` |
| `raw` | `cwd`, `path` | `{ name, type (MIME), size, base64, world }`; oversize files error with `too-large: …` |
| `readDataUrl` | `cwd`, `path` | `{ path, mime, dataUrl, world }` for inline markdown images |
| `statPath` | `cwd`, `path` | `{ path, type, size?, world }` |
| `resolvePath` | `cwd`, `path` | `{ path, world }` |
| `createFile` | `cwd`, `path` | `{ path, world }`; fails when the file already exists |
| `createDirectory` | `cwd`, `path` | `{ path, world }`; recursive and idempotent |
| `renamePath` | `cwd`, `from`, `to` | `{ from, to, world }`; cross-world moves are rejected |
| `copyPath` | `cwd`, `from`, `to` | `{ from, to, world }`; fails when the destination exists |
| `deletePath` | `cwd`, `path` | `{ path, world }`; a file or an empty directory only |
| `mkdir` | `cwd`, `path`, `name` | `{ ok, world, path }` (parent + name form) |
| `touch` | `cwd`, `path`, `name` | `{ ok, world, path }` |
| `rename` | `cwd`, `path`, `name` | `{ ok, world, path }` (renames in place) |
| `delete` | `cwd`, `path` | `{ ok, world, path }`; recursive |
| `reveal` | `cwd`, `path` | `{ ok, world, path }`; opens the parent directory, local world only |
| `setRoot` | `cwd`, `path` | `{ path, world }`; pins the watch root (remote worlds clear it) |

`world` is `"local"` or `"remote"` (decided by the resolved target key: `ssh://` means remote). `name` must be a single path segment — separators are rejected.

`GET /dsh-unknownue-plugins/explorer/watch` — server-sent events for the pinned local root; any other method answers `405` with an `allow: GET` header. The stream opens with `retry: 2000`, is registered as a prefix route, and sends `content-type: text/event-stream`, `cache-control: no-cache`, `connection: keep-alive`, and `x-accel-buffering: no`. Events are debounced by 150 ms into one frame per batch:

```text
data: {"dirs":["<changed directory>"],"rootChanged":false}
```

`dirs` lists the changed directories of the batch; `rootChanged` is currently always `false`. Watch is a recursive `fs.watch`, so remote roots get no events (the tree falls back to manual refresh) and an unavailable watch is logged rather than fatal. See [File explorer](../features/file-explorer.md).

## Paperspace

All of these live under `/dsh-unknownue-plugins/paperspace/`, with `api` routes fenced and `static` fonts public.

| method | path | purpose | notable params |
|--------|------|---------|----------------|
| GET | `/paperspace/api/health` | Liveness of the configured runtime (`select 1` + worker snapshot). | `{ status: 'ok', worker }`, or `{ status: 'not-configured' }` before the gate opens |
| GET | `/paperspace/api/models` | DSH model directory for the translation-model picker; available before configuration. | `{ available, groups: [{ id, name, models: [{ id, name }] }], reason? }` |
| GET | `/paperspace/api/settings` | Effective settings view. | `{ configured, restartRequired, settingsPath, defaults, settings }` |
| POST | `/paperspace/api/settings` | Validate and persist `settings.json`; boots or stops the runtime. | Strict body with `configured` plus any key from [Configuration](./configuration.md); `400 SETTINGS_INVALID` on a rejected save |
| GET | `/paperspace/api/sessions/:sessionId` | Which paper a DSH session is linked to. | `{ sessionId, arxivId, title, status }`; `404 SESSION_NOT_LINKED` / `PAPER_NOT_FOUND` |
| POST | `/paperspace/api/sessions` | Materialize a paper's markdown into the shared workspace so DSH can open a session on it. | `{ arxiv_id }` → `{ workspaceDir, arxivId, mdFile }`; `404 PAPER_NOT_FOUND`, `409 PAPER_NOT_READY` |
| POST | `/paperspace/api/sessions/link` | Record the session→paper binding and rename the session. | `{ session_id, arxiv_id }` → `{ ok, sessionId, arxivId }` |
| GET | `/paperspace/api/debug` | Diagnostics: integration flags plus the last 20 link rows. | `{ configured, toolsRegistered, contextProviderRegistered, …, links: [{ sessionId, arxivId, createdAt }] }` |
| GET | `/paperspace/static/fonts/<name>` | KaTeX font files for the reader, streamed from the installed package. | Filename must match `[\w.-]+\.(woff2\|woff\|ttf\|otf)`; `404` otherwise. No loopback fence, no method check; `public, max-age=31536000, immutable` |
| POST | `/paperspace/api/papers` | Create (or re-queue a failed) paper by arXiv id. | `{ arxiv_id }` → `202` with a summary (`200` when the paper already exists; a failed paper is re-queued) |
| GET | `/paperspace/api/papers` | Paginated library list. | `page` (default 1), `page_size` (1–100, default 20), `search` (≤200 chars), `category` (≤80) → `{ items, page, page_size, total }` |
| GET | `/paperspace/api/papers/:ref` | Paper detail including markdown and abstract. | `:ref` is the arXiv id, ≤64 chars; `404 PAPER_NOT_FOUND` |
| DELETE | `/paperspace/api/papers/:ref` | Delete a paper: cascade, object-store cleanup, workspace markdown removal. | `204` with an empty body (cleanup failures are logged, not fatal) |
| GET | `/paperspace/api/papers/:ref/assets` | Asset metadata for a paper. | `{ items: [{ id, paperId, originalUrl, contentType, sizeBytes, createdAt }] }` |
| GET | `/paperspace/api/papers/:ref/assets/:assetId` | Stream an asset's bytes from the object store. | `:assetId` must be a UUID; `content-type` from the asset, `content-length`, `cache-control: public, max-age=86400`; `404 ASSET_NOT_FOUND` |
| POST | `/paperspace/api/papers/:ref/translate-paper` | Enqueue a translation job. | `{ target_lang }` in `zh-CN` / `en-US` / `ja-JP` → `202 { job }`; `409 PAPER_NOT_READY`, `400 MODEL_NOT_CONFIGURED`, `400 MODEL_UNAVAILABLE` |
| GET | `/paperspace/api/papers/:ref/translation` | Latest translation snapshot plus its job. | `?lang=` (default `zh-CN`) → `{ paperId, targetLang, paragraphs, offsets, glossary, status, model, updatedAt, job }`; `404 TRANSLATION_NOT_FOUND` |
| DELETE | `/paperspace/api/papers/:ref/translation` | Drop the stored snapshot for a language. | `?lang=` → `204` |
| GET | `/paperspace/api/papers/:ref/translation-job` | Latest job for a language (progress, attempts, redacted provider). | `?lang=` → `{ job }`; `404 TRANSLATION_JOB_NOT_FOUND` |
| DELETE | `/paperspace/api/papers/:ref/translation-job` | Cancel the active job. | `?lang=` → `204`, or `404 TRANSLATION_JOB_NOT_ACTIVE` |

The API key persisted with a job never leaves the host: `provider` in job payloads is reduced to `{ provider, model }` or `{ baseUrl, model }`.

**Streaming.** This feature registers **no SSE endpoint**. There is no `chat/stream` route: `src/host/paperspace/runtime/` still carries the agent runtime and the SSE codec, but no route consumes them — grounded chat now runs through DSH sessions, with the `search_paper` / `read_section` tools and a system-prompt section instead, and the `paper.chats` / `paper.chat_messages` tables stay unused in the schema. Apart from the asset byte stream and the font files above, the bundle's only streaming route is the file-explorer watch channel. See [Paperspace](../features/paperspace.md).

## Tasks

Mounted as one prefix route under `/dsh-unknownue-plugins/tasks/api`:

| method | path | purpose | notable params |
|--------|------|---------|----------------|
| GET | `/tasks/api/board` | Whole board: revision plus cards. | `?archived=1` includes archived cards → `{ revision, tasks }` |
| GET | `/tasks/api/revision` | Light poll for the board revision. | `{ revision }` |
| POST | `/tasks/api/cards` | Create a card. | `{ title (≤500), body? (≤50000), status?, priority?, due?, todos? (≤50), tags? (≤20) }` → `{ card }` |
| PATCH | `/tasks/api/cards/:id` | Update card fields; omitted fields keep their value. | Same fields as create, all optional → `{ card }` |
| DELETE | `/tasks/api/cards/:id` | Permanent delete. | `{ ok: true }` |
| POST | `/tasks/api/cards/:id/move` | Move between columns, optionally anchored. | `{ status, before_id?, after_id? }` → `{ card }`; `400 TARGET_NOT_IN_COLUMN` |
| POST | `/tasks/api/cards/:id/archive` | Archive a card. | `{ card }` |
| POST | `/tasks/api/cards/:id/restore` | Restore an archived card. | `{ card }` |
| GET | `/tasks/api/settings` | Settings view. | `{ restartRequired, settingsPath, defaults, settings }` |
| POST | `/tasks/api/settings` | Persist the database directory and/or presets. | `{ data_dir (≤1024), preset_todos? (≤20 × ≤200 chars, nullable) }` → `{ ok, restartRequired }`; `400 SETTINGS_INVALID` on a rejected save |

`status` is `todo` / `in_progress` / `blocked` / `done`; `priority` is `low` / `medium` / `high`; `due` is `null`, `{ kind: 'point', at }`, or `{ kind: 'range', start, end }` with `at`/`start`/`end` as `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`. See [Tasks](../features/tasks.md).

## Conventions and limits

- **Body parsing.** All routes share one `readBody` helper: the body must be a JSON object (arrays, `null`, and scalars are rejected) and is capped at 1 MiB (`MAX_BODY_BYTES = 1 << 20`, failure message `request body is too large`). Bundle-row routes report a parse or size failure as 400; the paperspace and tasks wrappers only special-case zod failures, so a malformed body there surfaces as 500 `INTERNAL_ERROR`.
- **Status codes.** Bundle-row routes: 403 non-loopback, 405 non-POST, 400 unparseable body or non-object `params`, then 200 with `{ ok: false, error }` for anything the dispatcher throws (unknown method, missing file, permission rejection). Paperspace/tasks: 400 `VALIDATION_ERROR` for zod failures, 404 `NOT_FOUND`/`*_NOT_FOUND`, 405 `METHOD_NOT_ALLOWED`, 409 for state conflicts, 423 `PAPERSPACE_NOT_CONFIGURED`, 500 `INTERNAL_ERROR` — and nothing is written once headers are sent, so streaming handlers keep their own status.
- **Task error codes.** `TASK_NOT_FOUND` maps to 404 and `TARGET_NOT_IN_COLUMN` to 400; any other thrown code is surfaced with status 500.
- **Response headers.** The shared `json()` helper always sends `content-type: application/json; charset=utf-8`, `cache-control: no-store`, and `x-content-type-options: nosniff`.
- **Paths are passed verbatim.** The explorer treats `cwd` as the routing basis for every call and resolves `path` against it; the mixed `ctx.fs` provider picks the local or remote world from that cwd. Remote spellings are `ssh://<id>/<path>` and the local placeholder trees `dsw-routes/<id>/...` and the legacy `dsh-ssh-routes/<id>/...`, which are normalized to the plain remote posix path. Cross-world `renamePath` / `copyPath` is rejected with `cross-world operation is not supported`.
- **Seams.** The explorer needs `ctx.fs` (the host provider or dsh-workspace-enhancement's mixed provider; a session-scoped fs is preferred when a live agent's header cwd matches) and needs `ctx.subprocess` for structural operations in a remote world. A missing seam produces an honest error rather than a silent fallback.
- **Remote structural limits.** Spawned commands get `graceMs` = `explorer.structuralGraceMs` (default 8000 ms), stdout capped at 65536 bytes and stderr at `explorer.stderrTailBytes` (default 8192); argv items are shell-quoted by the remote runtime. `mv -T` is retried without the flag when the remote host rejects it as GNU-only.
- **Size caps.** `read` is capped by `explorer.maxReadBytes` and `raw` / `readDataUrl` by `explorer.maxRawBytes`; see [Configuration](./configuration.md) for the defaults.
- **No request timeouts of its own.** The bundle sets no handler deadline; only the subprocess grace period above bounds a request. Paperspace's `ingestTimeoutMs` / `translateTimeoutMs` belong to the background worker loops, not to HTTP calls.

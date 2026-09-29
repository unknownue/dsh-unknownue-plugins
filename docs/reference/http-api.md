# HTTP API

Every route in this bundle is registered on DSH's shared web server through `ctx.webServer.register({ kind: 'exact' | 'prefix', path, handler })` and is fenced to loopback requests; the bundle's own browser half is the only intended client. Paths follow `/dsh-unknownue-plugins/<feature>/...`, and only the **paperspace** and **tasks** rows register any: the bundle row itself (`dsh-unknownue-plugins`) registers nothing since the file explorer was removed.

The fence is the same check on every JSON route (the only exception is the paperspace static font route, which serves public assets and has no fence):

```ts
if (!isLoopback(req.socket.remoteAddress) || !isLoopbackHost(req.headers.host)) {
  return json(res, 403, { ok: false, error: "loopback-only" });
}
```

`isLoopback(address)` accepts `127.0.0.1`, `::1`, and `::ffff:127.0.0.1`; `isLoopbackHost(host)` strips the port (bracket-aware for IPv6) and lowercases the hostname, accepting `localhost`, `127.0.0.1`, `::1`, `::ffff:127.0.0.1`. Every fenced route answers `403 { code: 'FORBIDDEN', message: 'loopback-only' }`.

Every route is **REST**: JSON bodies, `{ code, message }` errors.

## Toolbar and workspace actions

The bundle row registers **no route at all**. Surfaces that used to live there were
removed, because DSH owns them:

- **Opening a directory** — `/dsh-unknownue-plugins/open/api` plus the host helper `platform.openDirectory`.
  DSH's open-in-app plugin (`@deepseek-ai/dsh-host-open-in-app` +
  `@deepseek-ai/dsh-client-ui-open-in-app`, routes `/open-in-app/apps`, `/open-in-app/icon`,
  `/open-in-app/open`) puts a session-header **Open In…** button on the session workspace directory
  whose catalog covers editors, Git GUIs, terminal emulators and the file manager.
- **Opening a terminal window** — `/dsh-unknownue-plugins/terminal/api` plus `platform.openTerminal`; the
  in-GUI terminal is DSH's `dsh-terminal` + `dsh-client-ui-sidebar-terminal`, and the open-in-app catalog
  lists the native emulators.
- **Listing Makefile targets** — `/dsh-unknownue-plugins/makefile/api` (`listTargets`, `parseMakefile`) and
  the panel behind it; the session header is left to DSH.
- **The file explorer** — `/dsh-unknownue-plugins/explorer/api` (JSON-RPC: `list`, `read`, `write`, the
  structural file operations) and the `/dsh-unknownue-plugins/explorer/watch` SSE channel, with the
  `Files` conversation tab and the whole editor UI in front of them. DSH ships its own file browsing
  surface, so the tab, the client modules and both routes are gone.

No code path in this bundle launches an OS program on the workspace any more, and the bundle row serves
nothing over HTTP. What remains of the row is the browser-only content-width control. See
[Toolbar actions](../features/toolbar-actions.md).

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

**Streaming.** This feature registers **no SSE endpoint**. There is no `chat/stream` route: `src/host/paperspace/runtime/` still carries the agent runtime and the SSE codec, but no route consumes them — grounded chat now runs through DSH sessions, with the `search_paper` / `read_section` tools and a system-prompt section instead, and the `paper.chats` / `paper.chat_messages` tables stay unused in the schema. Apart from the asset byte stream and the font files above, the bundle registers no streaming route at all — the file-explorer watch channel went away with the explorer. See [Paperspace](../features/paperspace.md).

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

- **Body parsing.** All routes share one `readBody` helper: the body must be a JSON object (arrays, `null`, and scalars are rejected) and is capped at 1 MiB (`MAX_BODY_BYTES = 1 << 20`, failure message `request body is too large`). The paperspace and tasks wrappers only special-case zod failures, so a malformed body surfaces as 500 `INTERNAL_ERROR`.
- **Status codes.** Paperspace/tasks: 403 non-loopback, 400 `VALIDATION_ERROR` for zod failures, 404 `NOT_FOUND`/`*_NOT_FOUND`, 405 `METHOD_NOT_ALLOWED`, 409 for state conflicts, 423 `PAPERSPACE_NOT_CONFIGURED`, 500 `INTERNAL_ERROR` — and nothing is written once headers are sent, so streaming handlers keep their own status.
- **Task error codes.** `TASK_NOT_FOUND` maps to 404 and `TARGET_NOT_IN_COLUMN` to 400; any other thrown code is surfaced with status 500.
- **Response headers.** The shared `json()` helper always sends `content-type: application/json; charset=utf-8`, `cache-control: no-store`, and `x-content-type-options: nosniff`.
- **No request timeouts of its own.** The bundle sets no handler deadline; paperspace's `ingestTimeoutMs` / `translateTimeoutMs` belong to the background worker loops, not to HTTP calls.

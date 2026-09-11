# Tasks

The tasks feature is a personal task board — a four-column kanban plus a dense list over the same cards — in a
"Tasks" tab of the conversation view. It is maintained entirely by hand: there is **no agent surface** (no
model-facing tools, no session-log events, no dispatch, no LLM credentials), and its only DSH seams are
`ctx.webServer` (loopback REST routes) and `ctx.effect` (lifecycle). Board state lives outside the DSH session
log in its own in-process PGlite (WASM PostgreSQL) database, so it survives any conversation; the tab polls a
single integer (`meta.revision`) every 5 seconds and refetches only when it moved, catching edits from other tabs.

## Where it lives in the UI

- `applyTasksTab` (`src/client/tasks/index.tsx`) registers the `conversation.view` slot with id
  `dsh-unknownue-plugins/tasks`, `order: 25` and the `en` label **Tasks** — i.e. **between Files and Papers**,
  since the file explorer (`src/client/explorer-editor/index.ts`) uses `order: 20` ("Files") and paperspace
  (`src/client/paperspace/index.tsx`) uses `order: 30` ("Papers").
- The header holds the **Board** / **List** mode switch (`role="tablist"`), an **Archived** button (count
  badge once archived cards exist), **Refresh** and **New task**; the footer shows `Revision #<n>`, and
  `.dsh-tasks` is a full-height flex column, so the board fills the view.
- Styles are injected as `style[data-plugin-css="dsh-tasks/styles.css"]` and `.../theme.css"`, every rule
  hand-scoped under `.dsh-tasks`. **Composer hiding**: while this tab owns the conversation view, DSH's chat
  input box is hidden via `[data-phase='active']:has(.dsh-tasks) [data-composer-seat]` and
  `[class*='scrollBody']:has(.dsh-tasks) [class*='composerSeat']` set to `display: none !important`.
- **Settings** live in the shared **UnPlugin** page (`settings.section` slot, `order: 45`, owned by paperspace): the task-board area is that page's final block.

## Board and list

- Columns come from the client status order in `src/client/tasks/api.ts`: `todo`, `in_progress`, `done`,
  `blocked` — **To-do**, **In progress**, **Done**, **Blocked**. (`src/host/tasks/types.ts` lists the same
  statuses in another order; only the client array drives the rendered columns and the editor's status
  dropdown.) Each header shows its label, its card count and — on **Done** only, while it has visible cards —
  the **Archive all** control; an empty column renders a dash.
- **Per-column order is newest-updated first** (`b.updatedAt - a.updatedAt`), a stable sort over the server's
  `status, rank, created_at` order, so rank then creation time break timestamp ties; the archived browser uses
  the same rule.
- **Drag and drop**: cards are `draggable` (the id travels in `text/plain`) and dropping on a column calls
  `POST /cards/:id/move` with `{ status }` only, which appends to that column (`max(rank) + 1024`) and stamps
  `updated_at`, so the card lands at the top. Exact placement (`before_id` / `after_id`) exists in the API
  and store but is never sent by the shipped UI, because column order is timestamp-driven rather than
  rank-driven.
- A card face shows the title, tag chips, the first 3 subtasks (unchecked first) plus a `+n` row with inline
  checkboxes, then a meta row with the priority badge, the due label (highlighted when overdue) and a
  `done/total` badge. The **list** view is a table of **Title**, **Status**, **Priority**, **Due**, **Tags**,
  **Updated**, where the title cell carries the `done/total` badge and an unset due date renders as an em
  dash; an empty board shows one "No tasks yet. Click "New task" to start." row.
- **Archived cards appear in neither view**: both render `board.filter(card => !card.archived)`. The snapshot
  is always fetched with `GET /board?archived=1`, so the archive drawer reads archived cards from the same
  payload without an extra request; the board, the list and the drawer are three views over one payload.
- The **card editor** modal opens on a card click (board card or list row) or from **New task**: Title
  (max 500), Description (Markdown) textarea (max 50000), Status, Priority (Low / Medium / High), Due date
  mode (None / Single / Range), the tag editor and the subtask editor. Save is disabled while the title is
  blank or the due draft is invalid.
- Existing cards offer **Archive** (or **Restore** when already archived); **Delete** is offered only for
  **archived** cards and is confirm-guarded ("Permanently delete this task? This cannot be undone.") and
  permanent, while new cards expose neither button. Archive is soft (`archived = 1` plus a new `updated_at`,
  status and rank untouched), and restore re-appends the card (`max(rank) + 1024`) in its own column.
- The **Archive all** control archives exactly the cards rendered in the Done column (the active,
  non-archived ones) after a confirm dialog naming the count, one request per card in parallel.

## Due dates

- Three modes in the editor: **None** (`due: null`), **Single** (`{ kind: 'point', at }`), **Range** (`{ kind: 'range', start, end }`).
- Values are **local wall time**, either all-day `YYYY-MM-DD` or minute-precise `YYYY-MM-DDTHH:mm`; the wire
  schema enforces exactly those shapes (`^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$`). The editor shows a `date`
  input plus an optional `time` input per boundary, so an empty time stays all-day.
- Switching mode maps the existing value: range to single keeps the range start, single to range uses the
  moment as start and today as end, and a first-time value defaults to today. A range must satisfy
  `start <= end` (host-side `refine`); the editor also blocks Save on a cleared date or an inverted range.
- **Overdue** is computed client-side for non-done cards only: the deadline is the point `at` or the range
  `end`; a 10-character (all-day) deadline goes overdue after that day, a timed deadline after that minute,
  and the label gets the `tk-due-over` class on the card and in the list's Due cell. Labels replace `T` with a
  space: `09-10 18:00`, or `09-10 14:00 ~ 09-12` for a range.
- **Storage**: `due_at` plus `due_until`; a point writes `due_at` only (NULLing `due_until`), a range writes
  both, and the union is rebuilt on read (set `due_at` + empty `due_until` means a point). Databases booted
  before ranges existed get the column from `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_until TEXT`, so
  their legacy date-only `due_at` values read back as single-moment due dates.

## Tags

- Model: a list of plain strings on the card, **at most 20**. Normalization trims, drops empties, dedupes by
  exact (case-sensitive) match and stops at 20; the wire schema allows 1-32 characters per tag and rejects
  blank, 33-character, 21-item and non-string payloads.
- **Colors come from a hash, never from storage**: `TAG_PALETTE` is a fixed 12-entry palette and
  `tagStyle(name)` picks `TAG_PALETTE[tagHash(name) % 12]`, where the hash accumulates `hash * 31 +
  codePoint` per character and is made positive. A tag therefore always gets the same color across renders,
  sessions and machines, and the white chip text stays readable in both light and dark themes.
- Chips render on board cards, in the list's Tags column, in the archive drawer detail and in the editor. The
  editor's tag field lists current tags with a remove button, offers a free-text input (max 32 characters,
  Enter or Add; duplicates and the 20-tag cap rejected), and shows an "Existing tags:" row of chips for tags
  used elsewhere on the board (archived cards included) that this card lacks — one click adds one.
- **Whole-list PATCH semantics**: sending `tags` replaces the entire list (after normalization, so `[]` clears
  it); omitting the field keeps the current list (the SQL uses `COALESCE($tags, tags)`), and creating a card
  without `tags` stores `[]`.

## Subtasks

- Model: `{ id, content, done }` checklist items, **at most 50** per card. Ids are UUIDs minted host-side —
  `normalizeTodos` keeps a supplied id only when it is a valid UUID and otherwise calls `randomUUID()` — and
  content is trimmed and constrained to 1-200 characters. The stored JSON column is re-validated on read:
  entries without a UUID, with empty content or with a non-boolean `done`, and corrupt JSON strings, all
  degrade to an empty list instead of throwing.
- **Board-card preview**: items are ordered **unchecked first** (stable within each group); only the first
  **3** are listed and the rest collapse into a `+n` row. The meta row carries a `done/total` badge, and the
  row checkboxes toggle straight from the board by sending a whole-list `PATCH` in the same unchecked-first
  order.
- **Card editor**: a `done/total` progress badge next to the heading; a fold toggle ("Expand all" /
  "Collapse") that appears once the list exceeds **8** items; rows in unchecked-first order with a checkbox,
  inline content editing (pencil button, then an input where Enter or the check commits, Escape cancels and
  blur commits), a remove button, and an add input (max 200 characters, Enter or Add, blocked at 50 items).
- **Preset quick-add list**, shown only while creating a card: one checkbox per preset; checking one appends
  it as a draft subtask (skipped when the card already carries that exact text or already has 50 items) and
  unchecking removes the matching row. Presets come from settings when configured, otherwise from six
  built-in localized labels: **Confirm requirements**, **Design the approach**, **Implementation**,
  **Self-test and verify**, **Code review**, **Update documentation**. An empty configured list hides the
  preset panel.
- **Whole-list PATCH semantics**: sending `todos` replaces the checklist (after trimming and id minting; `[]`
  clears it) and omitting it keeps the current list. Unsaved draft rows are sent without an `id` so the host
  mints one; saved rows resend their existing UUID.

## Data layer

- PGlite runs **in-process** and is driven through its **native `query` API** — no pgwire socket and no
  postgres.js in the loop (paperspace uses the same engine but also exposes a pgwire endpoint).
- `createTasksRuntime` (`src/host/tasks/db.ts`) creates the data directory if missing (PGlite does not
  `mkdir -p` itself), constructs `new PGlite({ dataDir, initialMemory })`, awaits `waitReady` and then runs
  the idempotent schema script on **every** boot.
- Default location `<dsh home>/tasks/db`, where `<dsh home>` is `$DSH_HOME` when set and `~/.dsh` otherwise;
  resolution order is settings.json, then the `cordis.patch.yml` row, then built-in defaults. `dataDir: ''`
  boots an in-memory database, which only the tests use.
- **Auto-boot, no `configured` gate** (unlike paperspace): no credentials are involved, so the runtime is
  created lazily on the first route hit, a failed boot is retryable, and `GET /settings` answers before any
  boot. `ctx.effect` owns disposal and closes PGlite with the plugin.
- Tables from `src/host/tasks/schema.ts`: `tasks` (`id` TEXT primary key, `title`, `body`, `status` default
  `todo`, `priority` default `medium`, `due_at`, `due_until`, `rank` REAL default 1024, `archived` INTEGER
  default 0, `created_at`, `updated_at`, `completed_at`, `todos` TEXT default `[]`, `tags` TEXT default
  `[]`) and `meta` (`key` / `value`, seeded with `schema_version` and `revision`), plus the partial index
  `idx_tasks_status_rank ON tasks (status, rank) WHERE archived = 0`.
- **Fractional ranking**: appending puts a card at `max(rank in its column) + 1024` (the first card becomes
  1024); moving before a neighbour takes the midpoint between that neighbour and its predecessor (halving
  the neighbour's rank when it is first); moving after a neighbour takes the midpoint with its successor, or
  `prev + 1024` at the tail; equal neighbours fall back to appending. A reorder therefore writes **exactly
  one row**, and concurrent edits cannot scramble the rest of the column — renumbering sequential positions
  would rewrite the whole column and reorder cards nobody touched.
- **Revision and validation**: every mutation runs
  `UPDATE meta SET value = CAST(value AS BIGINT) + 1 WHERE key = 'revision'`, the cheap change signal the
  tab polls, and the JSON-carrying columns (`todos`, `tags`) are validated twice — by zod on the wire and
  again on the durable boundary when rows are read back — so a hand-edited database cannot break the API.
- **Auto-migration** of older databases: the schema script runs its full `CREATE TABLE IF NOT EXISTS` /
  `INSERT ... ON CONFLICT DO NOTHING` text on every boot, and its `ALTER TABLE tasks ADD COLUMN IF NOT
  EXISTS` lines add `todos`, `due_until` and `tags` to a table created before those features landed.

## HTTP API

One `prefix` route on `ctx.webServer` under `/dsh-unknownue-plugins/tasks/api` (`TASKS_API`, exported by
both halves). Request bodies are snake_case JSON; responses wrap camelCase card DTOs.

| Method | Path | Purpose | Notable body / query params |
|--------|------|---------|-----------------------------|
| `GET` | `/board` | full snapshot `{ revision, tasks }` | `?archived=1` includes archived cards (the default excludes them); rows arrive ordered by `status, rank, created_at`. |
| `GET` | `/revision` | `{ revision }` | the light poll target (the tab polls it every 5 s). |
| `POST` | `/cards` | create a card, returns `{ card }` | `title` (required, 1-500), `body` (≤50000), `status`, `priority`, `due`, `todos`, `tags`; the schema is strict, so unknown keys are rejected. |
| `PATCH` | `/cards/:id` | update fields, returns `{ card }` | every create key, all optional; `due: null` clears and an omitted `due` keeps; `todos` / `tags` present replace the whole list; a `status` change appends to the new column and (un)stamps `completed_at`. |
| `POST` | `/cards/:id/move` | `{ card }` | `status` (required) plus optional `before_id` / `after_id` naming a card **in the target column**; without either the card is appended. |
| `POST` | `/cards/:id/archive` | soft archive, returns `{ card }` | keeps status and rank. |
| `POST` | `/cards/:id/restore` | unarchive and re-append, returns `{ card }` | re-appends inside the card's own column. |
| `DELETE` | `/cards/:id` | permanent delete, returns `{ ok: true }` | deleting an unknown id is not an error. |
| `GET` | `/settings` | `{ restartRequired, settingsPath, defaults, settings }` | `settings` is `null` until a settings file exists; answers without booting PGlite. |
| `POST` | `/settings` | persist, returns `{ ok, restartRequired }` | `data_dir` (required, 1-1024) and optional `preset_todos` (≤20 entries of ≤200 characters; `null` resets to the built-in presets). |

Error conventions from `src/host/tasks/routes.ts`:

- **Loopback fence** on every request: the socket remote address must be `127.0.0.1`, `::1` or
  `::ffff:127.0.0.1` **and** the `Host` header must resolve to a loopback hostname (`localhost`,
  `127.0.0.1`, `::1`, `::ffff:127.0.0.1` after the port is stripped); otherwise the reply is
  `403 { code: 'FORBIDDEN', message: 'loopback-only' }`.
- **Validation**: a zod failure becomes
  `400 { code: 'VALIDATION_ERROR', message: '<issues joined by "; ">' }`; `:id` must be 1-64 characters.
- **Store errors**: `TASK_NOT_FOUND` becomes 404, `TARGET_NOT_IN_COLUMN` becomes 400, anything else becomes
  500 carrying the error's own `code` or `INTERNAL_ERROR`; a wrong method on a known path gives
  `405 METHOD_NOT_ALLOWED`, any other subpath gives `404 NOT_FOUND`.

See the [HTTP API reference](../reference/http-api.md) for the shared route and fence conventions.

## Configuration

The `tasks` row in `cordis.patch.yml` (`- id: tasks`, `name: 'dsh-unknownue-plugins/tasks'`, seeded with
`dataDir: ''` and `initialMemoryBytes: 134217728`) seeds the configuration; `resolveConfig` layers that row
over the built-in defaults, and `settings.json` layers over the result.

| key | default | meaning |
|-----|---------|---------|
| `dataDir` | `<dsh home>/tasks/db` | PGlite data directory. An empty string in the row means "use the default"; a relative value resolves against the process cwd and `~` expands to the user home. |
| `initialMemoryBytes` | `134217728` (128 MiB) | PGlite WASM initial heap size in bytes. |

- **Settings file**: `<dsh home>/tasks/settings.json`, written as
  `{ "version": 1, "dataDir": "<absolute path>", "presetTodos": [...] }` with `presetTodos` optional. A
  missing or corrupt file resolves to `null` and falls back to defaults instead of blocking a restart.
  Preset entries are trimmed, deduped, capped at 20 entries and 200 characters each; omitting the field
  keeps the persisted list, and having no `presetTodos` field at all makes the client use its built-in
  labels.
- **Settings UI**: DSH Settings, then **UnPlugin**, then the task-board area (the final block of that page).
  It edits the database directory and the preset list, shows the settings file path, and offers a save plus a
  reset-to-built-in-presets action; an empty preset list hides the editor's quick-add panel.
- **`restartRequired`**: saving a `dataDir` that differs from the currently loaded value persists the file
  and returns `restartRequired: true` — PGlite stays bound to the old directory until `dsh web` is restarted.
  Because the comparison is against the loaded value, saving the same path a second time reports `false` even
  though the pending restart has not happened; preset changes never set the flag.

`DSH_HOME` relocates `<dsh home>` and therefore both the settings file and the default database directory;
see the [configuration reference](../reference/configuration.md) for how bundle rows and `DSH_HOME` interact.

## Tests

```sh
npm run build
npm test
node lib/tasks/tasks.test.js
```

`npm run build` compiles the host entries (including the test) into `lib/`; `npm test` chains the explorer,
paperspace and tasks suites; `node lib/tasks/tasks.test.js` runs this suite alone. There is no test
framework: `check()` records every assertion, the run prints `n/m checks passed` and exits non-zero on any
failure. The suite boots the **real PGlite runtime** in a mock cordis `ctx` under a temporary `DSH_HOME`
(`mkdtemp`) and covers:

- **Wiring, routes and validation**: one prefix route plus one `ctx.effect` disposer; a fresh board at
  revision 0; create with defaults (rank 1024, null `completedAt`) and with every field; `PATCH`; an unknown
  card 404; `/revision` matching `/board`; non-loopback 403; `GET /cards` 405; and the 400
  `VALIDATION_ERROR` matrix for title, status, subtasks, due dates and tags (blank, over-limit, wrong type).
- **Subtasks, due dates and tags**: roundtrips with id minting, whole-list replacement, `todos: []` and
  `tags: []` clearing, a patch without `tags` keeping the list, point to range switching, range to point
  clearing `due_until`, `due: null` clearing both columns, tag trim plus dedupe.
- **Ranking and lifecycle**: ranks grow by 1024, a move into an empty column appends (rank 1024), before /
  after / midpoint placement lands strictly on the right side, a target outside the column gives 400
  `TARGET_NOT_IN_COLUMN`; Done stamps `completedAt`, archive removes the card, restore re-appends it and
  delete removes it.
- **Persistence and settings**: after disposal a second plugin reads the same card, subtasks, due range and
  tags with the revision continuing, and an in-memory runtime (`dataDir: ''`) boots; settings defaults come
  from `DSH_HOME` with `settings: null`, a `dataDir` change flags `restartRequired` while the same path
  reports `false`, an empty `data_dir` gives 400, and preset saves are trimmed, deduped, returned by
  `GET /settings`, kept across a dataDir-only save, rejected at 21 entries, reset on `null`, and persisted.

## Related

- [Configuration reference](../reference/configuration.md) — bundle rows, `DSH_HOME`, settings files.
- [HTTP API reference](../reference/http-api.md) — shared route registration and the loopback fence.
- [Development](../development.md) — building, type-checking and running the plugin suites.
- Source of truth for this page: `src/host/tasks/` (`index.ts`, `routes.ts`, `store.ts`, `db.ts`,
  `schema.ts`, `settings.ts`, `types.ts`, `tasks.test.ts`) and `src/client/tasks/` (`index.tsx`,
  `view.tsx`, `archive.tsx`, `settings-page.tsx`, `api.ts`, `shared.ts`).

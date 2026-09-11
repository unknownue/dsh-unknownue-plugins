# File explorer

The file explorer is a **Files** tab in a session's conversation view: a lazy file tree for the
session workspace on the left and an editor pane on the right, wired to this bundle's host half through
loopback JSON-RPC routes. Both halves are remote-aware - with the companion `dsh-workspace-enhancement`
plugin mounted, every call is routed by the session cwd, so a remote session browses and edits the
remote machine (tree/read/write over SFTP, structural operations over the remote shell) with no mode
switch in the UI. The browser UI is ported from
[oneirictouch/dsh-explorer-editor](https://github.com/oneirictouch/dsh-explorer-editor) (MIT) and
re-wired onto this bundle's host routes (`src/client/explorer/`, `src/client/editor/`); the host half
(`src/host/explorer.ts`), the loopback adapter and the remote-routing logic are original to this bundle.

## Surfaces / UI

- **Files tab** - registered on the `conversation.view` slot (`id: dsh-explorer-editor`, `order: 20`,
  label from the `view.label` string, i.e. "Files"). It hosts the whole tree + editor split; the editor
  pane shows the "Select a file in the sidebar tree to edit it here" empty state until a file is open.
- **Lazy tree** - only the workspace root is listed on mount; a directory is listed the first time it
  is expanded (click, Enter/Space on the focused row, or ArrowRight; ArrowLeft collapses,
  ArrowUp/ArrowDown move the selection). Rows show a caret, a folder/file glyph and the name. There is
  **no client-side sorting** (rows render in the order the fs seam returned them) and **no size
  column** - entry `size` values are carried through the adapter but never rendered. Empty roots and
  listing errors render as inline hints ("Loading...", "Failed to load: ...", "(empty folder)").
- **Resizable splitter** - a 6 px pointer-captured divider between tree and editor; the tree width is
  clamped to 160 px minimum and (when the container width is known) container width minus 240 px, with
  a 1200 px fallback ceiling. The width is written to `localStorage` under `dsh.explorer.treeWidth` on
  pointer-up. The wrapper also forces `scrollbar-gutter: auto` on the conversation scroller while
  mounted and restores the previous value on unmount.
- **Editor tabs** - several files stay open as chips in a tab strip; the active chip is highlighted and
  a filled dot plus a colored name marks a dirty buffer. Ctrl/Cmd+S saves the active buffer (a global
  keydown handler) and Save is disabled unless the buffer is dirty; results appear in the status line.
  Tabs are restored on mount from `localStorage` (`dsh-explorer-editor-session`, written on a 400 ms
  debounce, buffer content persisted only up to 262144 characters); a snapshot with a different `root`
  is discarded, and switching the session cwd clears the tabs and the internal clipboard.
- **Markdown source/preview toggle** - shown only for `.md` / `.markdown`; the mode is persisted in
  `localStorage` (`dsh-explorer-editor:md-mode:v2`, default `source`). The preview renders with `marked`
  (GFM, line breaks; raw HTML blocks are escaped) and inlines relative images through the `readDataUrl`
  host action - `http(s)://` and `data:` sources are skipped, leading-slash sources are used as-is,
  everything else is resolved against the markdown file's directory; a failing image is left untouched.
- **Editor theme button/panel** - presets `light`, `dark`, `one-dark` and `github` (two preset button
  labels are hard-coded strings; `One Dark` and `GitHub` are Latin), or custom mode with a color picker
  plus hex field for background and foreground and a numeric font size (input range 8-32; hex values
  must match `#rrggbb`). Export downloads `dsh-editor-theme.json` (`type: "dsh-explorer-editor-theme"`,
  `version: 1`, plus a `colors` map with `editor.background` / `editor.foreground`); import accepts
  those fields or the `colors` map and reports invalid JSON, non-objects and missing colors in the
  dialog. The palette is persisted in `localStorage` (`dsh-explorer-editor:editor-theme:v2`), applied
  as CSS variables on the editor view (`--dshf-bg`, `--dshf-fg`, `--dshf-chrome`, `--dshf-border`,
  `--dshf-muted`, `--dshf-chip`, `--dshf-dirty`, `--dshf-font-size`; `--dshf-accent` is a fixed color)
  and as the Monaco theme `dsh-editor`.
- **Context menu** (right-click on a row, or on empty tree space which targets the root) - `Cut`,
  `Copy`, `Rename`, `Copy path`, `Copy relative path`, `Delete`, then for directories a separator and
  `Paste` (disabled while the internal clipboard is empty; labelled "Paste (move) <name>" or
  "Paste (copy) <name>"). Cut/Copy only fill an in-memory clipboard (no OS clipboard, no drag and
  drop). Paste copies (copy) or renames/moves (cut) into the clicked directory; pasting onto the source
  path itself is refused with "Already in the target location", an existing destination fails with the
  host's "already exists: <path>", and a successful paste clears the clipboard, selects the new node
  and reloads both the target and the source directory. Cut nodes render dimmed. `Copy path` /
  `Copy relative path` use the browser clipboard API and show a notice. Rename is inline (Enter
  submits, Escape/blur cancels, "/" is rejected). The tree toolbar adds `New file` and `New folder`
  buttons, which open an inline input in the relevant directory (the selected directory, or the
  selected file's parent); row hover adds pencil (rename) and trash (delete) mini-buttons.
- **Delete confirmation** - any delete opens an in-page modal ("Delete <name>?" / "Delete <name>? This
  cannot be undone.", Cancel / Delete). Confirming calls `deletePath`: files are removed, **directories
  must be empty** (the host answers `directory not empty: <path>`, or a failing `rmdir` remotely);
  nothing recurses and no children are walked. Tabs for the deleted path are closed and the tree root
  is re-listed.
- **Live refresh** - the host runs one recursive `fs.watch` on the pinned **local** workspace root and
  pushes debounced (150 ms) directory-change events to the browser over SSE; the tree reloads only the
  root and the directories it currently has expanded, and ignores events while an inline input or the
  context menu is open. Remote roots are not watched (the host clears the watcher); refresh then
  happens on window focus / tab visibility change, after a delete, and on mount. There is no dedicated
  refresh button in the UI.
- **Hidden chat composer** - while the Files tab owns the conversation view, the client entry injects
  two rules into a `<style data-dmk-styles>` tag that hide DSH's chat input
  (`[data-phase='active']:has(.dshfx-split) [data-composer-seat]` and the equivalent
  `[class*='scrollBody']:has(.dshfx-split) [class*='composerSeat']`, both `display: none !important`).
  The wrapper measures the conversation scroller and, when no composer overlay is present, sizes itself
  to viewport height minus the composer seat height; with an overlay it uses the full height and
  reserves bottom clearance.

## Host API

The browser half calls one exact route with a JSON-RPC style envelope, plus one SSE prefix route:

| Route | Method | Purpose |
|---|---|---|
| `/dsh-unknownue-plugins/explorer/api` | `POST` | `{ method, params }` -> `{ ok: true, value }` or `{ ok: false, error }` (errors still return HTTP 200) |
| `/dsh-unknownue-plugins/explorer/watch` | `GET` | `text/event-stream`; server pushes `data: {"dirs": [...], "rootChanged": false}` |

Both are registered in `src/host/index.ts`: the JSON-RPC route through the shared `registerRoute`
helper, the SSE route through `registerExplorerWatch`. Every request carries the session cwd **verbatim**
as `params.cwd` - either `ssh://<id>/<path>` or the local placeholder tree
(`.../dsw-routes/<id>/<path>`, legacy `dsh-ssh-routes/<id>/<path>`) - and the host resolves
`params.path` against it. Host resolution prefers the live session's own `ctx.fs` (matched by normalized
header cwd, so container workspaces resolve their session-scoped provider) and falls back to the host
`ctx.fs`; structural operations go through the separate `ctx.subprocess` seam.

Dispatch actions (`explorerDispatch` in `src/host/explorer.ts`):

| Action | Params | Behaviour |
|---|---|---|
| `list` | `cwd`, `path` | directory only; `{ world, path, entries: [{ name, type, size, path }], truncated }`, at most `maxListEntries` rows |
| `read` | `cwd`, `path` | file only; `{ content, size, world }`, or `{ tooLarge: true, size, world }` above `maxReadBytes` |
| `write` | `cwd`, `path`, `content` | `fs.writeText`; a read-only side workspace (`fs: r`) rejects it and the error is surfaced |
| `readDataUrl` | `cwd`, `path` | inline read as `data:<mime>;base64,...`; rejected above `maxRawBytes` |
| `raw` | `cwd`, `path` | `{ name, type, size, base64, world }` with MIME from the extension table; rejected above `maxRawBytes` |
| `statPath` | `cwd`, `path` | `{ path, type, size?, world }` |
| `resolvePath` | `cwd`, `path` | `{ path, world }` after remote-spelling normalization |
| `createFile` | `cwd`, `path` | fails when the path exists (local `open('wx')`; remote `test -e` probe, then `touch`) |
| `createDirectory` | `cwd`, `path` | recursive and idempotent (`mkdir -p`) |
| `renamePath` | `cwd`, `from`, `to` | rename/move; cross-world (local <-> remote) is rejected |
| `copyPath` | `cwd`, `from`, `to` | recursive copy; fails when the destination exists |
| `deletePath` | `cwd`, `path` | file delete, or **empty** directory delete (the editor-style action) |
| `mkdir` / `touch` | `cwd`, `path` (parent), `name` | one child under an existing directory parent |
| `rename` | `cwd`, `path`, `name` | same-directory rename of an existing source |
| `delete` | `cwd`, `path` | recursive delete (`rm -rf`) - not used by the shipped UI |
| `reveal` | `cwd`, `path` | opens the parent directory in the OS file manager; local world only |
| `setRoot` | `cwd`, `path` | directory only; pins the local watch root, clears it for remote roots |

The shipped UI calls `list`, `read`, `write`, `readDataUrl`, `createFile`, `createDirectory`,
`renamePath`, `copyPath`, `deletePath`, `statPath`, `resolvePath` and `setRoot`; `raw`, `mkdir`, `touch`,
`rename`, `delete` and `reveal` exist on the host but are not exposed by the ported client adapter
(`src/client/explorer/remote.ts`).

**Security fence.** The JSON-RPC route is loopback-only: a request whose socket address is not
`127.0.0.1` / `::1` / `::ffff:127.0.0.1`, or whose `Host` header is not a loopback host, gets
`403 { ok: false, error: "loopback-only" }`; non-POST gets 405, and a body that is not a JSON object or
exceeds 1 MiB (`MAX_BODY_BYTES`) gets 400. The SSE watch route is registered directly and performs no
loopback check - it only rejects non-GET with 405, then serves the event stream (`retry: 2000`). Remote
browsers are expected to reach the JSON-RPC route through a tunnel such as `dsh-gateway` rather than
directly.

**Remote-spelling normalization.** `parseRemoteSpelling` turns an `ssh://` URL or a placeholder path
into `{ id, path }`; `resolveValue` then calls `fs.resolve(<plain remote path>, { cwd: "ssh://<id>/" })`
when the cwd is local or names another machine - resolving the route spelling as a relative path is
what used to produce "not a directory: <placeholder>". The inverse guard also exists: a drive-letter or
UNC path is resolved with **no** cwd when the caller's cwd is remote, so a stale remote cwd can never
send `E:\...` over SFTP after a session switch.

## Remote workspaces

- **Routing** - every fs-backed action (`list`, `read`, `write`, `readDataUrl`, `raw`, `statPath`,
  `resolvePath`, `setRoot`, and the destination legs of `renamePath` / `copyPath`) works remotely: the
  mixed provider serves the machine over SFTP. `renamePath` / `copyPath` reject a source and destination
  in different worlds ("cross-world operation is not supported").
- **Structural operations** - `mkdir`, `touch`, `rename`, `delete`, `createFile`, `createDirectory`,
  `renamePath`, `copyPath` and `deletePath` need a shell on the remote machine, so they go through
  `ctx.subprocess.spawn` instead of the fs seam: `mkdir -p --`, `touch --`, `mv -T --` (retried as plain
  `mv --` when stderr looks like an unsupported flag, for BSD/macOS), `rm -rf --` for the recursive
  `delete`, `rm --` / `rmdir --` for `deletePath`, `cp -r --`, and `test -e` probes before create/copy.
  argv items are shell-quoted by the remote runtime - this bundle never builds a shell string.
- **Spawn cwd pinning** - the spawn cwd is the caller's cwd when it is a remote spelling, otherwise
  `ssh://<id>/` derived from the resolved target; a local cwd never reaches the remote branch (it would
  run the command in the local world).
- **Remote Windows hosts** - there is no PowerShell branch: the structural commands are POSIX utilities,
  so on a remote Windows machine tree, reads and writes still work over SFTP while mkdir/rename/delete/
  copy fail and surface the command error in the UI notice.
- **Permission gates** - the explorer does not pre-check permissions; the gates of
  `dsh-workspace-enhancement` apply at the seams and errors are shown as-is: `fs: 'r'` on a side
  workspace rejects `writeText` (writes fail), `exec: 'off'` rejects `spawn` (structural operations
  fail), and a missing subprocess service reports "structural operations need the subprocess service
  (dsh-workspace-enhancement)".
- **Timeouts and limits** - each remote structural command gets `graceMs: structuralGraceMs` (default
  8000 ms), stdout is capped at 65536 bytes and stderr at `stderrTailBytes`, and a non-zero exit is
  rethrown as `<operation> failed on the remote host: <last 4 stderr lines>` (or the exit code).

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `explorer.maxListEntries` | `1000` | Maximum entries returned per directory listing; the host also reports `truncated: true` when the real listing was longer. |
| `explorer.maxReadBytes` | `1048576` (1 MiB) | Text-open cap for `read`; larger files answer `tooLarge` and the editor shows "file too large to open in the editor (<size> bytes)". |
| `explorer.maxRawBytes` | `8388608` (8 MiB) | Binary/inline preview cap for `raw` and `readDataUrl`, and the `maxBytes` argument passed to the fs `readBytes` call. |
| `explorer.structuralGraceMs` | `8000` | Grace period, in milliseconds, for each remote structural command (`subprocess.spawn` `graceMs`). |
| `explorer.stderrTailBytes` | `8192` | Bytes of remote structural stderr retained for error messages; only the last four lines are shown. |

The same five values are seeded in this bundle's `cordis.patch.yml` under the `dsh-unknownue-plugins`
row's `explorer:` block, and a DSH profile's `cordis.patch.yml` can override them there. In code
(`limitsOf` in `src/host/explorer.ts`) any non-numeric or non-positive value falls back to the
`DEFAULTS` constants, so the two sources always agree.

## Limits and caveats

- **No truncation notice in the UI.** The host reports `truncated`, but the browser adapter maps only
  `entries`, so a directory with more than `maxListEntries` children silently shows the first batch.
- **No sorting and no sizes displayed**, even though the host returns `size` per entry; entry `mtimeMs`
  is hard-coded to `null` in the adapter (the host does not return mtimes), so restored tabs cannot
  detect out-of-band changes.
- **The read cap depends on the reported size.** `read` compares the `stat` size (an undefined size
  counts as 0) and then calls `readText` with no byte cap of its own.
- **Non-empty directories cannot be deleted**, locally or remotely; the client never recurses. Open
  tabs are closed with the deleted path only, so tabs inside a deleted directory would remain if a
  recursive delete were ever added.
- **Copy never overwrites**: an existing destination fails ("already exists: <path>"), and paste into
  the same directory is refused, so the tree cannot duplicate a file in place.
- **Live refresh is local-only and single-root.** `fs.watch(..., { recursive: true })` is unsupported on
  some platforms (a failure is logged and the channel stays silent), the watcher is module-global - the
  last `setRoot` wins, so two tabs on different local roots leave one without events - and `rootChanged`
  is never set to true by the host, so the client's full-reload branch is dead code.
- **Remote roots have no live refresh**: refresh happens on window focus / visibility change, after a
  delete, or on mount only.
- **Monaco requires CDN access.** Monaco 0.52.2 loads at runtime from `cdn.jsdelivr.net`, `unpkg.com`
  and `fastly.jsdelivr.net` (a `dsh-explorer-editor:monaco-mirror` `localStorage` key prepends a custom
  mirror); if all mirrors fail the editor pane renders nothing, while the markdown preview, tree and
  save paths are unaffected. Language highlighting comes from the file extension (~50 mapped).
- **Binary files are not editable**: `read` expects text (`readText`); binary inspection exists only
  through `raw` / `readDataUrl`, which the shipped UI uses just for markdown images.
- **Names must be single path segments.** Child names containing `/`, `\` or NUL are rejected by the
  host ("name must be a plain single-path-segment string"), and the tree rejects "/" client-side; the
  tree's temporary path inputs are joined with "/", so path handling assumes posix-style display paths.
- **Session-scoped fs lookup is cwd-exact.** A session is matched by its normalized header cwd; if no
  session matches the request cwd, the host fs is used, which may be the workspace anchor rather than
  the workspace itself.

## Tests

```sh
npm run build                  # esbuild: lib/client.js + the host ESM modules
npm test                       # explorer + paperspace + tasks host suites
node lib/explorer.test.js      # just this feature's suite
npm run typecheck              # tsc --noEmit for both tsconfigs
```

`lib/explorer.test.js` is built from `src/host/explorer.test.ts` by `npm run build`. It is a plain
script with no test framework: it prints `<n> passed, <n> failed` and exits non-zero if any check fails
(verified: 57 passed, 0 failed). It drives `explorerDispatch` against a mock context that fakes the
`ctx.fs` / `ctx.subprocess` seams for a local and a remote world (the mock fs keeps its own
directory/file tables, the mock subprocess records every argv), covering:

- `worldOf` and `parentPathOf` across Windows, posix and remote separators (including the root-file and
  no-separator cases - the Windows reveal regression), and `parseRemoteSpelling` for `ssh://`, the
  `dsw-routes` placeholder tree, the legacy `dsh-ssh-routes` tree and plain local spellings;
- the local world: `list` / `read` / `write`, the read-only (`fs: r`) write rejection, a missing-file
  `raw` rejection, an unknown method and a NUL-containing path;
- remote routing: cwd pinning for a placeholder or `ssh://` path with a local cwd, drive-letter and UNC
  paths resolving with the cwd stripped under a remote cwd, posix-absolute paths keeping the remote
  routing, and the spawn cwd pinned to `ssh://<id>/` for structural operations;
- the remote world: `list` / `read`, the exact argv of `mkdir -p --`, `touch --`, `mv -T --` and
  `rm -rf --`, `reveal` refusal, the missing-subprocess error, and the editor-style full-path methods
  (`createFile` probe + touch, `createDirectory`, `renamePath`, `copyPath` probe + `cp -r --`,
  `deletePath` as `rmdir --` / `rm --`, `statPath`, `readDataUrl`, `resolvePath`, `setRoot`).

## Related

- [Configuration reference](../reference/configuration.md)
- [HTTP API reference](../reference/http-api.md)
- [Development](../development.md)
- Upstream editor UI: [oneirictouch/dsh-explorer-editor](https://github.com/oneirictouch/dsh-explorer-editor)
  (MIT), credited in `THIRD-PARTY-NOTICES.md` and in the repository root `README.md`.

# Toolbar actions

The bundle now has **no toolbar surface of its own**: the only UI action it used to contribute —
the content-width control in the sidebar footer — moved into **DSH Settings → UnPlugin** (see
[Content width](#content-width)). The same **界面显示** block also hosts the
[hide New Session button](#hide-new-session-button) toggle. Everything else that used to sit in a
session header was **removed on purpose**:

- **Open the workspace directory in the OS file manager** — DSH ships that control itself, as the
  open-in-app plugin (`@deepseek-ai/dsh-host-open-in-app` + `@deepseek-ai/dsh-client-ui-open-in-app`,
  routes `/open-in-app/apps`, `/open-in-app/icon`, `/open-in-app/open`), whose session-header
  **Open In…** button opens the workspace directory in a locally installed application with an app
  catalog and icons. Removed here: the header button, its route
  (`/dsh-unknownue-plugins/open/api`) and the `openDirectory` host helper.
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
  the route and the row's `makefile` key. Read a Makefile through DSH's own file browsing surface or
  the agent's tooling instead.
- **The file explorer (`Files` tab)** — the `conversation.view` tab (order 20) with the tree + editor
  split, its `/dsh-unknownue-plugins/explorer/api` route and its `/dsh-unknownue-plugins/explorer/watch`
  SSE channel, plus the whole `src/client/explorer/**` + `src/client/editor/**` tree. DSH ships its own
  file browsing surface, so the tab, the client modules and both host routes are gone; see
  [HTTP API](../reference/http-api.md#toolbar-and-workspace-actions) for the full removed list.

The bundle's host row (`src/host/index.ts`) therefore registers **no route at all** — it exists as the
bundle row whose client bundle applies the stored width preference at startup and carries the two
remaining view tabs (`Tasks`, `Papers`). Nothing in this bundle launches an OS program on the
workspace any more.

## Content width

- **Surface** — the **界面显示** block of the UnPlugin settings page (`settings.section`, rendered by
  `src/client/toolbar/UiSettings.tsx` inside `paperspace/settings-page.tsx`). The former
  `sidebar.footer.action` button (`dsh-unknownue-plugins/width`) was removed with the move.
- **Behaviour** — a slider (50 %–150 %, 1 % steps, default 100 %) with a live percentage readout and
  a **恢复 100%** button; every change applies immediately and persists.
- **Mechanics** — the value is written to `localStorage` under
  `dsh-unknownue-plugins:contentWidthPct` and applied by injecting a single
  `<style data-width-override>` rule into the document head:
  `*{--dsh-chat-content-width:<pct>% !important}`. It is re-applied at plugin
  startup, so the width survives reloads; a storage failure (private mode) is
  ignored and the width still applies for the session.
- **Styling** — the outer card reuses the settings page's `bundle-section` classes; the slider row
  comes from the bundle's shared sheet (`ensureStyles()` in `src/client/index.tsx`, the
  `.dmw-width*` rules). That sheet carries `data-plugin`, so DSH's
  `removeOwnedStyles(<this bundle>)` deletes it on reload and `apply()` re-injects it; an untagged
  sheet would be left stale on 0.2.x. See
  [Injected stylesheet ownership](../development.md#injected-stylesheet-ownership-read-before-adding-css).
- **No host involvement** — this is the feature formerly shipped as the separate
  `dsh-ui-width` plugin; it stays browser-local.

## Hide New Session button

- **Surface** — the same **界面显示** block of the UnPlugin settings page, as a checkbox
  (**隐藏 New Session 按钮**).
- **Behaviour** — while checked, the sidebar's prominent New Session button is hidden, including
  the collapsed-sidebar / Windows titlebar variant. Unchecking restores it immediately; keyboard
  shortcuts and session creation itself are **not** touched (the option hides the button only).
- **Mechanics** — the preference is `localStorage` key
  `dsh-unknownue-plugins:hideNewSessionButton` (`"1"` = on) and is applied at plugin startup. While
  on, one `<style data-hide-new-session>` tag carries
  `button[class*="_newSession"], button[class*="newSession_"]{display:none !important}`. Off removes
  the tag entirely, so a default profile injects no extra sheet.
- **Selector rationale** — DSH renders the control as a CSS-module button
  (`SidebarRoot.module.css.newSession`, emitted as `wtg9ga_newSession` with the build's
  `[hash]_[local]` pattern in DSH 0.2.2). The attribute substring matches both module naming orders
  and only `button` elements, leaving the sidebar brand/logo button (which can also start a session
  on desktop) visible. If a DSH release renames the local class, the rule silently stops matching —
  see the limitation below.
- **No host involvement** — the button is client-rendered and has no slot to remove it, so hiding it
  is a browser-local style rule.

## Limitations

- Both preferences are browser-local and do not follow the UI language: they live in
  `localStorage`, so they are per browser profile.
- Loss of the shared sheet is not self-healing: the plugin is not reloaded when the
  sheet is deleted, so only a page refresh (or an HMR reload of this bundle)
  brings the slider styles back.
- **Hide New Session button is selector-based**: it depends on DSH's CSS-module local name
  (`_newSession`). A DSH release that renames that module class makes the rule a no-op (the option
  flips and persists, the button stays visible). Re-verify the selector against the shipped
  `dsh-client-ui-sidebar` client bundle after a DSH upgrade.
- The removed Makefile panel is documented here only as history: nothing in the bundle reads a
  Makefile or runs `make` any more.
- The removed file explorer is history too: with it went its browser-local preferences
  (`dsh.explorer.treeWidth`, `dsh-explorer-editor-session`,
  `dsh-explorer-editor:editor-theme:v2`, `dsh-explorer-editor:md-mode:v2`,
  `dsh-explorer-editor:monaco-mirror`). Those keys are inert leftovers in an existing
  browser profile and can be cleared.

## Related

- [HTTP API reference](../reference/http-api.md)
- [Configuration](../reference/configuration.md)
- [Integrations](../integrations.md)

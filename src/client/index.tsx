/**
 * dsh-unknownue-plugins client entry point.
 *
 * Owns the bundle-level shared stylesheet and the startup application of the
 * browser-local UI preferences (content width, hide New Session button);
 * registers the conversation view tabs the bundle still owns (paperspace,
 * tasks). The preference controls themselves live in the UnPlugin settings page
 * (`toolbar/UiSettings.tsx`, rendered by `paperspace/settings-page.tsx`).
 *
 * The **file explorer** (`Files` tab: tree, editor tabs, markdown preview,
 * file operations) was removed together with its host half
 * (`/dsh-unknownue-plugins/explorer/api` + the explorer watch channel): DSH
 * ships its own file browsing surface, so the bundle carries neither the tab
 * nor the route.
 *
 * Handing the session workspace directory to an OS program is left to DSH
 * itself: `@deepseek-ai/dsh-client-ui-open-in-app` covers the file manager and
 * the terminal emulators ("Open In…"), and `dsh-client-ui-sidebar-terminal`
 * covers an in-GUI terminal, so this bundle ships neither.
 */

import { readWidthPct, applyWidth } from "./toolbar/content-width";
import { readHideNewSessionButton, applyHideNewSessionButton } from "./toolbar/hide-new-session";
import { applyPaperspaceTab } from "./paperspace/index";
import { applyTasksTab } from "./tasks/index";
import { PLUGIN_ID } from "./plugin-id";

// ── idempotent stylesheet ─────────────────────────────────────────────

function ensureStyles(): void {
  if (typeof document === "undefined") return;
  const css = [
    // UI-preferences block, rendered by the UnPlugin settings page
    // (`toolbar/UiSettings.tsx`). The outer card uses the page's own
    // `bundle-section` classes; only the width control itself is styled here so
    // it does not depend on the paperspace subpath being the one that renders it.
    ".dmw-width{display:flex;flex-direction:column;gap:8px;}",
    ".dmw-width-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;}",
    ".dmw-width-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);}",
    ".dmw-width-value{font-variant-numeric:tabular-nums;font-size:12px;color:var(--dsw-alias-label-secondary);}",
    ".dmw-width-row{display:flex;align-items:center;gap:10px;}",
    ".dmw-width .dmw-width-slider{flex:1;min-width:0;padding:0;border:0;background:transparent;accent-color:var(--dsw-alias-state-business-primary);}",
    ".dmw-width-btn{flex:none;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:12px;}",
    ".dmw-width-btn:hover{background:var(--dsw-alias-interactive-bg-hover);}",
    ".dmw-width-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}",
  ].join("\n");
  // Refresh an existing tag in place
  const existing = document.querySelector("style[data-dsh-unknownue-styles]");
  const style = existing !== null ? existing : document.createElement("style");
  // Ownership marker: without it DSH's HMR bookkeeping adopts this sheet for
  // whichever plugin materializes next and deletes it when THAT plugin reloads
  // (see plugin-id.ts), which is what used to strip every .dmw-* rule off a
  // long-lived page.
  style.setAttribute("data-plugin", PLUGIN_ID);
  style.setAttribute("data-dsh-unknownue-styles", "");
  style.textContent = css;
  if (existing === null) document.head.appendChild(style);
}

// ── plugin contract ───────────────────────────────────────────────────

const inject = ["slots", "sessions", "workspaces", "locale"];

function apply(ctx: any): void {
  ensureStyles();
  // Browser-local UI preferences, re-applied on every activation so a reload
  // restores them even after DSH pruned this bundle's style tags.
  applyWidth(readWidthPct());
  applyHideNewSessionButton(readHideNewSessionButton());

  // Both controls live in DSH Settings → UnPlugin (`settings.section`, owned by
  // the paperspace subpath); the bundle row no longer registers a sidebar
  // footer action.

  applyPaperspaceTab(ctx);
  applyTasksTab(ctx);
}

export { apply, inject };

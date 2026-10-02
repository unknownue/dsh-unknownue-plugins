/**
 * dsh-unknownue-plugins client entry point.
 *
 * Registers the content-width control and the conversation view tabs this
 * bundle still owns (paperspace, tasks).
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

import React from "react";
import { WidthControl, readWidthPct, applyWidth, setWidthPct } from "./toolbar/WidthControl";
import { applyPaperspaceTab } from "./paperspace/index";
import { applyTasksTab } from "./tasks/index";
import { PLUGIN_ID } from "./plugin-id";

// ── idempotent stylesheet ─────────────────────────────────────────────

function ensureStyles(): void {
  if (typeof document === "undefined") return;
  const css = [
    ".dmw-action{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:50%;padding:0;background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);}",
    ".dmw-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);}",
    ".dmw-action svg{flex:none;}",
    ".dmw-overlay{position:fixed;inset:0;z-index:1100;display:flex;align-items:center;justify-content:center;padding:24px;}",
    // Same fix as the task editor mask (`tasks/styles.css`): DSH 0.2.x defines
    // --dsw-mask-blur as `none`, so this mask lost its frosted backdrop and kept
    // only the tint. Pinned to the value 0.1.x shipped for that token.
    ".dmw-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:blur(2px);}",
    ".dmw-card{position:relative;z-index:1;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;width:min(320px,100%);padding:16px 18px;border:1px solid var(--dsw-alias-border-inverted);border-radius:16px;background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-shadow-lv3);font-family:var(--dsw-font-family);}",
    ".dmw-title{display:flex;align-items:center;justify-content:space-between;margin:0;font-size:14px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary);}",
    ".dmw-close{border:0;background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:14px;line-height:1;padding:2px;}",
    ".dmw-value{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);text-align:center;}",
    ".dmw-slider{width:100%;accent-color:var(--dsw-alias-state-business-primary);}",
    ".dmw-reset{height:30px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:12px;}",
    ".dmw-reset:hover{background:var(--dsw-alias-interactive-bg-hover);}",
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
  applyWidth(readWidthPct());

  const widthInjected = () => ({ getPct: readWidthPct, setPct: setWidthPct });
  ctx.effect(
    () =>
      ctx.slots.inject("sidebar.footer.action", () =>
        ctx.slots.register(
          { name: "sidebar.footer.action", id: "dsh-unknownue-plugins/width", inject: widthInjected },
          WidthControl,
        ),
      ),
    "dsh-unknownue-plugins: content width control",
  );

  applyPaperspaceTab(ctx);
  applyTasksTab(ctx);
}

export { apply, inject };

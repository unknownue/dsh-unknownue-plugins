/**
 * dsh-unknownue-plugins client entry point.
 *
 * Registers the content-width control and the file explorer editor view.
 * Handing the session workspace directory to an OS program is left to DSH
 * itself: `@deepseek-ai/dsh-client-ui-open-in-app` covers the file manager and
 * the terminal emulators ("Open In…"), and `dsh-client-ui-sidebar-terminal`
 * covers an in-GUI terminal, so this bundle ships neither.
 */

import React from "react";
import { WidthControl, readWidthPct, applyWidth, setWidthPct } from "./toolbar/WidthControl";
import { applyExplorerEditor } from "./explorer-editor";
import { applyPaperspaceTab } from "./paperspace/index";
import { applyTasksTab } from "./tasks/index";

// Inject explorer editor CSS
import stylesCss from "./styles.css";

// ── idempotent stylesheet ─────────────────────────────────────────────

function ensureStyles(): void {
  if (typeof document === "undefined") return;
  const css = [
    ".dmw-action{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:50%;padding:0;background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);}",
    ".dmw-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);}",
    ".dmw-action svg{flex:none;}",
    ".dmw-overlay{position:fixed;inset:0;z-index:1100;display:flex;align-items:center;justify-content:center;padding:24px;}",
    ".dmw-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur);}",
    ".dmw-card{position:relative;z-index:1;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;width:min(320px,100%);padding:16px 18px;border:1px solid var(--dsw-alias-border-inverted);border-radius:16px;background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-shadow-lv3);font-family:var(--dsw-font-family);}",
    ".dmw-title{display:flex;align-items:center;justify-content:space-between;margin:0;font-size:14px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary);}",
    ".dmw-close{border:0;background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:14px;line-height:1;padding:2px;}",
    ".dmw-value{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);text-align:center;}",
    ".dmw-slider{width:100%;accent-color:var(--dsw-alias-state-business-primary);}",
    ".dmw-reset{height:30px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:12px;}",
    ".dmw-reset:hover{background:var(--dsw-alias-interactive-bg-hover);}",
    ".dshfx-split{display:flex;height:100%;min-height:0;overflow:hidden;position:relative;}",
    ".dshfx-tree-pane{flex:none;min-width:0;overflow:hidden;border-right:1px solid var(--dsw-alias-border-l2);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);}",
    ".dshfx-resizer{flex:none;width:6px;margin-left:-1px;cursor:col-resize;touch-action:none;position:relative;z-index:1;background:transparent;}",
    ".dshfx-resizer::after{content:\"\";position:absolute;top:0;bottom:0;left:2px;width:1px;background:var(--dsw-alias-border-l2);transition:background var(--ds-transition-duration-fast,120ms) ease;}",
    ".dshfx-resizer:hover::after,.dshfx-resizer[data-dragging]::after{background:var(--dsw-alias-state-business-primary);width:2px;left:2px;}",
    ".dshfx-editor-pane{flex:1;min-width:0;overflow:hidden;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);}",
    // The composer (input box) belongs to the chat view — hide it while the
    // 文件 tab owns the conversation view (same CSS approach paperspace uses;
    // the explorer wrapper already subtracts the composer seat height, so
    // with display:none it fills the whole viewport automatically).
    "[data-phase='active']:has(.dshfx-split) [data-composer-seat],",
    "[class*='scrollBody']:has(.dshfx-split) [class*='composerSeat']{display:none !important;}",
  ].join("\n");
  // Refresh an existing tag in place
  const existing = document.querySelector("style[data-dsh-unknownue-styles]");
  const style = existing !== null ? existing : document.createElement("style");
  style.setAttribute("data-dsh-unknownue-styles", "");
  style.textContent = css;
  if (existing === null) document.head.appendChild(style);

  // Inject explorer editor CSS
  const CSS_TAG = "dsh-explorer-editor/styles.css";
  if (document.querySelector(`style[data-plugin-css="${CSS_TAG}"]`) === null) {
    const tag = document.createElement("style");
    tag.dataset.plugin = "dsh-explorer-editor";
    tag.dataset.pluginCss = CSS_TAG;
    tag.textContent = stylesCss;
    document.head.appendChild(tag);
  }
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

  applyExplorerEditor(ctx);
  applyPaperspaceTab(ctx);
  applyTasksTab(ctx);
}

export { apply, inject };

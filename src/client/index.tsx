/**
 * dsh-unknownue-plugins client entry point.
 *
 * Registers all toolbar buttons (Makefile, Open Dir, Terminal, Width)
 * and the file explorer editor view.
 */

import React from "react";
import { MakefileControl } from "./toolbar/MakefileControl";
import { OpenDirButton } from "./toolbar/OpenDirButton";
import { OpenTerminalButton } from "./toolbar/OpenTerminalButton";
import { WidthControl, readWidthPct, applyWidth, setWidthPct } from "./toolbar/WidthControl";
import { applyExplorerEditor } from "./explorer-editor";

// Inject explorer editor CSS
import stylesCss from "./styles.css";

// ── idempotent stylesheet ─────────────────────────────────────────────

function ensureStyles(): void {
  if (typeof document === "undefined") return;
  const css = [
    ".dmk-action{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:50%;padding:0;background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);}",
    ".dmk-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}",
    ".dmk-action svg{flex:none;}",
    ".dmk-action:disabled{opacity:.45;cursor:default;}",
    ".dmk-overlay{position:fixed;inset:0;z-index:1100;display:flex;align-items:center;justify-content:center;padding:24px;}",
    ".dmk-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur);}",
    ".dmk-card{position:relative;z-index:1;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;width:min(560px,100%);max-height:80vh;padding:16px 18px;border:1px solid var(--dsw-alias-border-inverted);border-radius:16px;background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-shadow-lv3);font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary);}",
    ".dmk-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}",
    ".dmk-title{margin:0;font-size:14px;font-weight:600;line-height:20px;}",
    ".dmk-close{border:0;background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:14px;line-height:1;padding:2px;}",
    ".dmk-toolbar{display:flex;gap:8px;}",
    ".dmk-workdir{flex:1;min-width:0;height:30px;box-sizing:border-box;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;}",
    ".dmk-btn{flex:none;height:30px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:12px;}",
    ".dmk-btn:hover{background:var(--dsw-alias-interactive-bg-hover);}",
    ".dmk-btn:disabled{opacity:.45;cursor:default;}",
    ".dmk-list{display:flex;flex-direction:column;gap:6px;overflow:auto;min-height:0;}",
    ".dmk-row{display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-3);}",
    ".dmk-target{flex:none;font-family:ui-monospace,\"Cascadia Code\",\"Cascadia Mono\",Consolas,Menlo,monospace;font-size:12px;font-weight:600;line-height:20px;}",
    ".dmk-badge{flex:none;align-self:center;padding:0 6px;height:18px;line-height:18px;border-radius:9px;border:1px solid var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);font-size:10px;font-weight:600;}",
    ".dmk-help{flex:1;min-width:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:20px;white-space:normal;overflow-wrap:anywhere;}",
    ".dmk-copy{flex:none;height:24px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:11px;}",
    ".dmk-copy:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}",
    ".dmk-meta{color:var(--dsw-alias-label-secondary);font-size:12px;}",
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
  ].join("\n");
  // Refresh an existing tag in place
  const existing = document.querySelector("style[data-dmk-styles]");
  const style = existing !== null ? existing : document.createElement("style");
  style.setAttribute("data-dmk-styles", "");
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

const inject = ["slots", "sessions", "locale"];

function apply(ctx: any): void {
  ensureStyles();
  applyWidth(readWidthPct());

  const makefileInjected = () => ({ sessions: ctx.sessions });
  ctx.effect(
    () =>
      ctx.slots.inject("conversation.session.header.actions", () =>
        ctx.slots.register(
          { name: "conversation.session.header.actions", id: "dsh-unknownue-plugins/makefile", inject: makefileInjected },
          MakefileControl,
        ),
      ),
    "dsh-unknownue-plugins: makefile header action",
  );

  const openDirInjected = () => ({ sessions: ctx.sessions });
  ctx.effect(
    () =>
      ctx.slots.inject("conversation.session.header.actions", () =>
        ctx.slots.register(
          { name: "conversation.session.header.actions", id: "dsh-unknownue-plugins/open-dir", inject: openDirInjected },
          OpenDirButton,
        ),
      ),
    "dsh-unknownue-plugins: open workspace directory action",
  );

  const terminalInjected = () => ({ sessions: ctx.sessions });
  ctx.effect(
    () =>
      ctx.slots.inject("conversation.session.header.actions", () =>
        ctx.slots.register(
          { name: "conversation.session.header.actions", id: "dsh-unknownue-plugins/terminal", inject: terminalInjected },
          OpenTerminalButton,
        ),
      ),
    "dsh-unknownue-plugins: open terminal action",
  );

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
}

export { apply, inject };

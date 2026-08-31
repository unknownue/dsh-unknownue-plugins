window.__ModuleLoader__.load({
  id: "dsh-unknownue-plugins",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/toolbar/MakefileControl.tsx
var import_react = require("react");

// src/client/utils/rpc.ts
async function call(api, method, params) {
  const response = await fetch(api, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, params })
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const data = await response.json();
  if (!data || data.ok !== true)
    throw new Error(data && data.error ? data.error : "request failed");
  return data.value;
}
function unwrap(result) {
  if (result.ok) return result.value;
  const { code, message } = result.error ?? { code: void 0, message: "unknown error" };
  const err = new Error(`${message}${code ? ` (${code})` : ""}`);
  err.code = code;
  throw err;
}

// src/client/utils/sessions.ts
function resolveCwd(sessions, sessionId) {
  try {
    if (!sessions || !sessionId) return "";
    const binding = typeof sessions.binding === "function" ? sessions.binding(sessionId) : void 0;
    const headerCwd = binding && binding.session && binding.session.header ? binding.session.header.cwd : void 0;
    if (typeof headerCwd === "string" && headerCwd !== "") return headerCwd;
    const snapshot4 = sessions.list && typeof sessions.list.getSnapshot === "function" ? sessions.list.getSnapshot() : void 0;
    if (snapshot4 && snapshot4.byId) {
      const summary = snapshot4.byId[sessionId];
      if (summary && typeof summary.cwd === "string" && summary.cwd !== "")
        return summary.cwd;
    }
    return "";
  } catch {
    return "";
  }
}

// src/client/toolbar/MakefileControl.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var MAKE_API = "/dsh-unknownue-plugins/makefile/api";
function Glyph() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 2h6v4h-6v-4Z", stroke: "currentColor", strokeWidth: "1.8", strokeLinejoin: "round" }) });
}
function MakefileControl(props) {
  const { sessions } = props;
  const [open, setOpen] = (0, import_react.useState)(false);
  const [targets, setTargets] = (0, import_react.useState)([]);
  const [workdir, setWorkdir] = (0, import_react.useState)("");
  const [loading, setLoading] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const [copied, setCopied] = (0, import_react.useState)(null);
  const panelRef = (0, import_react.useRef)(null);
  const fetchTargets = (0, import_react.useCallback)(async (cwd) => {
    setLoading(true);
    setError(null);
    try {
      const data = await call(MAKE_API, "list", { cwd });
      setTargets(data.targets);
      setWorkdir(data.cwd);
    } catch (err) {
      setError(err.message || "Failed to load Makefile");
    } finally {
      setLoading(false);
    }
  }, []);
  const handleClick = (0, import_react.useCallback)(() => {
    if (open) {
      setOpen(false);
      return;
    }
    const sessionId = sessions?.current;
    const cwd = resolveCwd(sessions, sessionId);
    setOpen(true);
    void fetchTargets(cwd);
  }, [open, sessions, fetchTargets]);
  const handleRefresh = (0, import_react.useCallback)(() => {
    void fetchTargets(workdir);
  }, [fetchTargets, workdir]);
  const handleCopy = (0, import_react.useCallback)(async (target) => {
    const cmd = `make ${target}`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(target);
      setTimeout(() => setCopied(null), 1500);
    } catch {
    }
  }, []);
  (0, import_react.useEffect)(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dmk-action", title: "Makefile", "aria-label": "Makefile", onClick: handleClick, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Glyph, {}) }),
    open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmk-overlay", ref: panelRef, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dmk-mask", onClick: () => setOpen(false) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmk-card", role: "dialog", "aria-label": "Makefile", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmk-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "dmk-title", children: "Makefile" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmk-toolbar", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "dmk-workdir", value: workdir, readOnly: true, title: "Working directory" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dmk-btn", onClick: handleRefresh, disabled: loading, children: "\u5237\u65B0" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dmk-close", onClick: () => setOpen(false), "aria-label": "Close", children: "\u2715" })
          ] })
        ] }),
        error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dmk-meta", style: { color: "#c2410c" }, children: error }),
        loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dmk-meta", children: "\u52A0\u8F7D\u4E2D\u2026" }),
        !loading && !error && targets.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dmk-meta", children: "\u672A\u53D1\u73B0\u6784\u5EFA\u76EE\u6807" }),
        !loading && !error && targets.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dmk-list", children: targets.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dmk-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmk-target", children: t.name }),
          t.isDefault && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmk-badge", children: "\u9ED8\u8BA4" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dmk-help", children: t.help }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "dmk-copy",
              onClick: () => void handleCopy(t.name),
              children: copied === t.name ? "\u5DF2\u590D\u5236 \u2713" : "\u590D\u5236"
            }
          )
        ] }, t.name)) })
      ] })
    ] })
  ] });
}

// src/client/toolbar/OpenDirButton.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var OPEN_API = "/dsh-unknownue-plugins/open/api";
function FolderGlyph() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z", stroke: "currentColor", strokeWidth: "1.8", strokeLinejoin: "round" }) });
}
function OpenDirButton(props) {
  const { sessions, sessionId } = props;
  const cwd = resolveCwd(sessions, sessionId);
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [feedback, setFeedback] = (0, import_react2.useState)(null);
  const onClick = async () => {
    if (busy) return;
    if (!cwd) {
      setFeedback({ kind: "error", text: "\u65E0\u6CD5\u83B7\u53D6\u5DE5\u4F5C\u76EE\u5F55\uFF08cwd \u4E3A\u7A7A\uFF09" });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = await call(OPEN_API, "openDir", { path: cwd });
      setFeedback({ kind: "ok", text: `\u5DF2\u6253\u5F00\uFF1A${result?.opened ?? cwd}` });
    } catch (err) {
      setFeedback({ kind: "error", text: err.message || String(err) });
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "button",
    {
      type: "button",
      className: "dmk-action",
      title: feedback ? feedback.text : cwd ? `\u6253\u5F00\u5DE5\u4F5C\u76EE\u5F55\uFF08${cwd}\uFF09` : "\u6253\u5F00\u5DE5\u4F5C\u76EE\u5F55",
      "aria-label": "\u6253\u5F00\u5DE5\u4F5C\u76EE\u5F55",
      disabled: busy,
      onClick,
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FolderGlyph, {})
    }
  );
}

// src/client/toolbar/OpenTerminalButton.tsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var TERMINAL_API = "/dsh-unknownue-plugins/terminal/api";
function TerminalGlyph() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2", stroke: "currentColor", strokeWidth: "1.8" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M7 9l3 3-3 3M12 15h5", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" })
  ] });
}
function OpenTerminalButton(props) {
  const { sessions, sessionId } = props;
  const cwd = resolveCwd(sessions, sessionId);
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [feedback, setFeedback] = (0, import_react3.useState)(null);
  const onClick = async () => {
    if (busy) return;
    if (!cwd) {
      setFeedback("\u65E0\u6CD5\u83B7\u53D6\u5DE5\u4F5C\u76EE\u5F55\uFF08cwd \u4E3A\u7A7A\uFF09");
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = await call(TERMINAL_API, "openTerminal", { path: cwd });
      setFeedback(`\u5DF2\u6253\u5F00\u7EC8\u7AEF\uFF1A${result?.opened ?? cwd}`);
    } catch (err) {
      setFeedback(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "button",
    {
      type: "button",
      className: "dmk-action",
      title: feedback ?? (cwd ? `\u6253\u5F00\u7EC8\u7AEF\uFF08${cwd}\uFF09` : "\u6253\u5F00\u7EC8\u7AEF"),
      "aria-label": "\u6253\u5F00\u7EC8\u7AEF",
      disabled: busy,
      onClick,
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TerminalGlyph, {})
    }
  );
}

// src/client/toolbar/WidthControl.tsx
var import_react4 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var WIDTH_STORAGE_KEY = "dsh-unknownue-plugins:contentWidthPct";
var WIDTH_DEFAULT_PCT = 100;
var WIDTH_MIN_PCT = 50;
var WIDTH_MAX_PCT = 150;
var WIDTH_STEP_PCT = 5;
function clampWidth(value) {
  const n = Math.round(Number(value));
  const finite = Number.isFinite(n) ? n : WIDTH_DEFAULT_PCT;
  return Math.min(WIDTH_MAX_PCT, Math.max(WIDTH_MIN_PCT, finite));
}
function readWidthPct() {
  try {
    const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
    return raw === null ? WIDTH_DEFAULT_PCT : clampWidth(raw);
  } catch {
    return WIDTH_DEFAULT_PCT;
  }
}
var widthStyleEl = null;
function applyWidth(pct) {
  if (widthStyleEl === null) {
    widthStyleEl = document.createElement("style");
    widthStyleEl.setAttribute("data-plugin", "dsh-unknownue-plugins");
    widthStyleEl.setAttribute("data-width-override", "");
    document.head.appendChild(widthStyleEl);
  }
  widthStyleEl.textContent = `*{--dsh-chat-content-width:${pct}% !important}`;
}
function setWidthPct(pct) {
  const clamped = clampWidth(pct);
  applyWidth(clamped);
  try {
    window.localStorage.setItem(WIDTH_STORAGE_KEY, String(clamped));
  } catch {
  }
  return clamped;
}
function WidthGlyph() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M3 9V7h18v2M3 15v2h18v-2M3 12h18", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }) });
}
function WidthControl(props) {
  const { getPct, setPct: setPctInjected } = props;
  const [open, setOpen] = (0, import_react4.useState)(false);
  const [pct, setPctState] = (0, import_react4.useState)(() => getPct());
  if (!open) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        type: "button",
        className: "dmw-action",
        title: "Content width",
        "aria-label": "Content width",
        onClick: () => setOpen(true),
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(WidthGlyph, {})
      }
    );
  }
  const onClose = () => setOpen(false);
  const onInput = (event) => {
    const value = clampWidth(event.target.value);
    setPctState(value);
    setPctInjected(value);
  };
  const onReset = () => {
    setPctState(WIDTH_DEFAULT_PCT);
    setPctInjected(WIDTH_DEFAULT_PCT);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmw-overlay", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dmw-mask", onClick: onClose }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmw-card", role: "dialog", "aria-label": "Content width", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmw-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "Content width" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dmw-close", onClick: onClose, "aria-label": "Close", children: "\u2715" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dmw-value", children: [
        pct,
        "%"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "input",
        {
          type: "range",
          className: "dmw-slider",
          min: WIDTH_MIN_PCT,
          max: WIDTH_MAX_PCT,
          step: WIDTH_STEP_PCT,
          value: pct,
          onChange: onInput
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dmw-reset", onClick: onReset, children: "Reset 100%" })
    ] })
  ] });
}

// src/client/explorer-editor/index.ts
var import_react18 = __toESM(require("react"), 1);

// src/client/i18n.ts
var NS = "dshFile";
function format(template, params) {
  return template.replace(
    /\{(\w+)\}/g,
    (token, key) => Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : token
  );
}
var zh = {
  // footer toggle (legacy fallback)
  "toggle.label": "\u6587\u4EF6",
  "toggle.open": "\u6253\u5F00\u6587\u4EF6\u7BA1\u7406\u5668",
  "toggle.close": "\u5173\u95ED\u6587\u4EF6\u7BA1\u7406\u5668",
  // shared view / tab labels
  "view.label": "\u6587\u4EF6",
  "view.empty": "\u5728\u5DE6\u4FA7\u6587\u4EF6\u6811\u4E2D\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6\uFF0C\u5373\u53EF\u5728\u6B64\u7F16\u8F91",
  "workspace.tab": "\u5DE5\u4F5C\u533A",
  "tabs.aria": "\u5207\u6362\u4FA7\u8FB9\u680F\u89C6\u56FE",
  // sidebar panel toolbar
  "panel.newFile": "\u65B0\u5EFA\u6587\u4EF6",
  "panel.newDirectory": "\u65B0\u5EFA\u76EE\u5F55",
  "panel.openFailed": "\u6253\u5F00\u5931\u8D25: {message}",
  "panel.deleted": "\u5DF2\u5220\u9664",
  "panel.deleteFailed": "\u5220\u9664\u5931\u8D25: {message}",
  "panel.deleteTitle": "\u5220\u9664 {name}",
  "panel.deleteBody": "\u786E\u5B9A\u5220\u9664 {name} \u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002",
  "panel.cancel": "\u53D6\u6D88",
  "panel.delete": "\u5220\u9664",
  // tree context menu
  "menu.cut": "\u526A\u5207",
  "menu.copy": "\u590D\u5236",
  "menu.rename": "\u91CD\u547D\u540D",
  "menu.copyPath": "\u590D\u5236\u8DEF\u5F84",
  "menu.copyRelativePath": "\u590D\u5236\u76F8\u5BF9\u8DEF\u5F84",
  "menu.delete": "\u5220\u9664",
  "menu.paste": "\u7C98\u8D34",
  "menu.pasteMove": "\u7C98\u8D34\uFF08\u79FB\u52A8\uFF09{name}",
  "menu.pasteCopy": "\u7C98\u8D34\uFF08\u590D\u5236\uFF09{name}",
  "contextMenu.label": "\u6587\u4EF6\u64CD\u4F5C",
  // tree notices / validation
  "tree.clipboardUnavailable": "\u526A\u8D34\u677F\u4E0D\u53EF\u7528",
  "tree.copyFailed": "\u590D\u5236\u5931\u8D25: {message}",
  "tree.copiedPath": "\u5DF2\u590D\u5236\u8DEF\u5F84",
  "tree.copiedRelativePath": "\u5DF2\u590D\u5236\u76F8\u5BF9\u8DEF\u5F84",
  "tree.cut": "\u5DF2\u526A\u5207 {name}",
  "tree.copied": "\u5DF2\u590D\u5236 {name}",
  "tree.alreadyThere": "\u5DF2\u5728\u76EE\u6807\u4F4D\u7F6E",
  "tree.move": "\u79FB\u52A8",
  "tree.copyVerb": "\u590D\u5236",
  "tree.moved": "\u5DF2\u79FB\u52A8 {name}",
  "tree.copiedVerb": "\u5DF2\u590D\u5236 {name}",
  "tree.pasteFailed": "{verb}\u5931\u8D25: {message}",
  "tree.noSlash": "\u540D\u79F0\u4E0D\u80FD\u5305\u542B /",
  "tree.createFailed": "\u521B\u5EFA\u5931\u8D25: {message}",
  "tree.createdDirectory": "\u5DF2\u521B\u5EFA\u76EE\u5F55 {name}",
  "tree.createdFile": "\u5DF2\u521B\u5EFA\u6587\u4EF6 {name}",
  "tree.renameFailed": "\u91CD\u547D\u540D\u5931\u8D25: {message}",
  "tree.renamed": "\u5DF2\u91CD\u547D\u540D {name}",
  "tree.loadFailed": "\u52A0\u8F7D\u5931\u8D25: {message}",
  "tree.loading": "\u52A0\u8F7D\u4E2D\u2026",
  "tree.empty": "\uFF08\u7A7A\u76EE\u5F55\uFF09",
  "tree.renameTitle": "\u91CD\u547D\u540D",
  "tree.deleteTitle": "\u5220\u9664",
  "tree.filePlaceholder": "\u6587\u4EF6\u540D\u79F0",
  "tree.directoryPlaceholder": "\u76EE\u5F55\u540D\u79F0",
  // center-column editor
  "editor.save": "\u4FDD\u5B58",
  "editor.saveTitle": "\u4FDD\u5B58 (Ctrl+S)",
  "editor.closeFile": "\u5173\u95ED\u5F53\u524D\u6587\u4EF6",
  "editor.close": "\u5173\u95ED",
  "editor.closeTab": "\u5173\u95ED {name}",
  "editor.saved": "\u5DF2\u4FDD\u5B58 {name}",
  "editor.saveFailed": "\u4FDD\u5B58\u5931\u8D25: {message}",
  "editor.loading": "\u7F16\u8F91\u5668\u52A0\u8F7D\u4E2D\u2026",
  "md.previewTitle": "\u9884\u89C8\u6E32\u67D3\u6548\u679C",
  "md.sourceTitle": "\u7F16\u8F91\u6E90\u7801",
  // theme panel
  "theme.button": "\u4E3B\u9898",
  "theme.title": "\u7F16\u8F91\u5668\u4E3B\u9898\u8BBE\u7F6E",
  "theme.panelLabel": "\u7F16\u8F91\u5668\u4E3B\u9898",
  "theme.preset": "\u9884\u8BBE",
  "theme.custom": "\u81EA\u5B9A\u4E49",
  "theme.background": "\u80CC\u666F",
  "theme.foreground": "\u6587\u5B57",
  "theme.fontSize": "\u5B57\u53F7",
  "theme.export": "\u5BFC\u51FA\u4E3B\u9898",
  "theme.import": "\u5BFC\u5165\u4E3B\u9898",
  "theme.reset": "\u6062\u590D\u9ED8\u8BA4\u6D45\u8272\u4E3B\u9898",
  "theme.readFailed": "\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25",
  "theme.errorInvalidJson": "\u6587\u4EF6\u4E0D\u662F\u6709\u6548\u7684 JSON",
  "theme.errorNotObject": "JSON \u5185\u5BB9\u5FC5\u987B\u662F\u5BF9\u8C61",
  "theme.errorMissingBackground": "\u7F3A\u5C11\u6709\u6548\u7684\u80CC\u666F\u8272\uFF08\u9700\u8981 #rrggbb\uFF09",
  "theme.errorMissingForeground": "\u7F3A\u5C11\u6709\u6548\u7684\u6587\u5B57\u8272\uFF08\u9700\u8981 #rrggbb\uFF09"
};
var en = {
  "toggle.label": "Files",
  "toggle.open": "Open file manager",
  "toggle.close": "Close file manager",
  "view.label": "Files",
  "view.empty": "Select a file in the sidebar tree to edit it here",
  "workspace.tab": "Workspace",
  "tabs.aria": "Switch sidebar view",
  "panel.newFile": "New file",
  "panel.newDirectory": "New folder",
  "panel.openFailed": "Failed to open: {message}",
  "panel.deleted": "Deleted",
  "panel.deleteFailed": "Failed to delete: {message}",
  "panel.deleteTitle": "Delete {name}",
  "panel.deleteBody": "Delete {name}? This cannot be undone.",
  "panel.cancel": "Cancel",
  "panel.delete": "Delete",
  "menu.cut": "Cut",
  "menu.copy": "Copy",
  "menu.rename": "Rename",
  "menu.copyPath": "Copy path",
  "menu.copyRelativePath": "Copy relative path",
  "menu.delete": "Delete",
  "menu.paste": "Paste",
  "menu.pasteMove": "Paste (move) {name}",
  "menu.pasteCopy": "Paste (copy) {name}",
  "contextMenu.label": "File operations",
  "tree.clipboardUnavailable": "Clipboard unavailable",
  "tree.copyFailed": "Copy failed: {message}",
  "tree.copiedPath": "Copied path",
  "tree.copiedRelativePath": "Copied relative path",
  "tree.cut": "Cut {name}",
  "tree.copied": "Copied {name}",
  "tree.alreadyThere": "Already in the target location",
  "tree.move": "Move",
  "tree.copyVerb": "Copy",
  "tree.moved": "Moved {name}",
  "tree.copiedVerb": "Copied {name}",
  "tree.pasteFailed": "{verb} failed: {message}",
  "tree.noSlash": "Name cannot contain /",
  "tree.createFailed": "Create failed: {message}",
  "tree.createdDirectory": "Created folder {name}",
  "tree.createdFile": "Created file {name}",
  "tree.renameFailed": "Rename failed: {message}",
  "tree.renamed": "Renamed to {name}",
  "tree.loadFailed": "Failed to load: {message}",
  "tree.loading": "Loading\u2026",
  "tree.empty": "(empty folder)",
  "tree.renameTitle": "Rename",
  "tree.deleteTitle": "Delete",
  "tree.filePlaceholder": "File name",
  "tree.directoryPlaceholder": "Folder name",
  "editor.save": "Save",
  "editor.saveTitle": "Save (Ctrl+S)",
  "editor.closeFile": "Close current file",
  "editor.close": "Close",
  "editor.closeTab": "Close {name}",
  "editor.saved": "Saved {name}",
  "editor.saveFailed": "Save failed: {message}",
  "editor.loading": "Loading editor\u2026",
  "md.previewTitle": "Preview rendered output",
  "md.sourceTitle": "Edit source",
  "theme.button": "Theme",
  "theme.title": "Editor theme settings",
  "theme.panelLabel": "Editor theme",
  "theme.preset": "Preset",
  "theme.custom": "Custom",
  "theme.background": "Background",
  "theme.foreground": "Text",
  "theme.fontSize": "Font size",
  "theme.export": "Export theme",
  "theme.import": "Import theme",
  "theme.reset": "Reset to default light theme",
  "theme.readFailed": "Failed to read the file",
  "theme.errorInvalidJson": "File is not valid JSON",
  "theme.errorNotObject": "JSON content must be an object",
  "theme.errorMissingBackground": "Missing valid background color (#rrggbb required)",
  "theme.errorMissingForeground": "Missing valid foreground color (#rrggbb required)"
};

// src/client/explorer/remote.ts
var EXPLORER_API = "/dsh-unknownue-plugins/explorer/api";
function buildExplorerRemote() {
  let cwd = "";
  let resolvedRoot = "";
  const envelope = async (promise) => {
    try {
      return { ok: true, value: await promise };
    } catch (err) {
      return { ok: false, error: { code: "RPC_ERROR", message: err instanceof Error ? err.message : String(err) } };
    }
  };
  const entriesOf = (value) => value.entries.map((e) => ({
    name: e.name,
    type: e.type,
    size: e.size,
    mtimeMs: e.mtimeMs ?? null
  }));
  return {
    listDir: (path) => envelope(
      call(EXPLORER_API, "list", { cwd, path }).then((v) => ({
        path: v.path,
        entries: entriesOf(v)
      }))
    ),
    readText: (path) => envelope(
      call(EXPLORER_API, "read", { cwd, path }).then((v) => {
        if (v.tooLarge) throw new Error("file too large to open in the editor (" + v.size + " bytes)");
        return { path: v.path ?? path, content: v.content ?? "", mtimeMs: null, size: v.size };
      })
    ),
    readDataUrl: (path) => envelope(
      call(EXPLORER_API, "readDataUrl", { cwd, path }).then((v) => ({
        path: v.path,
        mime: v.mime,
        dataUrl: v.dataUrl
      }))
    ),
    writeText: (path, content) => envelope(
      call(EXPLORER_API, "write", { cwd, path, content }).then(() => ({
        path,
        operation: "update"
      }))
    ),
    createFile: (path) => envelope(
      call(EXPLORER_API, "createFile", { cwd, path }).then((v) => ({
        path: v.path,
        operation: "create"
      }))
    ),
    createDirectory: (path) => envelope(
      call(EXPLORER_API, "createDirectory", { cwd, path }).then((v) => ({
        path: v.path
      }))
    ),
    rename: (from, to) => envelope(
      call(EXPLORER_API, "renamePath", { cwd, from, to }).then((v) => ({
        from: v.from,
        to: v.to
      }))
    ),
    copy: (from, to) => envelope(
      call(EXPLORER_API, "copyPath", { cwd, from, to }).then((v) => ({
        from: v.from,
        to: v.to
      }))
    ),
    delete: (path) => envelope(
      call(EXPLORER_API, "deletePath", { cwd, path }).then(() => ({ path }))
    ),
    stat: (path) => envelope(
      call(EXPLORER_API, "statPath", { cwd, path }).then((v) => ({
        path: v.path,
        type: v.type,
        size: v.size,
        mtimeMs: null
      }))
    ),
    resolve: (path) => envelope(
      call(EXPLORER_API, "resolvePath", { cwd, path }).then((v) => ({
        path: v.path
      }))
    ),
    getRoot: () => ({
      ok: true,
      value: { path: resolvedRoot !== "" ? resolvedRoot : cwd }
    }),
    setRoot: (path) => envelope(
      call(EXPLORER_API, "setRoot", { cwd, path }).then((v) => {
        cwd = String(path);
        resolvedRoot = v.path;
        return { path: v.path };
      })
    )
  };
}

// src/client/explorer/ExplorerViewWrapper.tsx
var import_react10 = require("react");

// src/client/explorer/FileManagerPanel.tsx
var import_react9 = require("react");

// src/client/utils/paths.ts
function normalizePosix(path) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}
function isInsideRoot(root, path) {
  const r = normalizePosix(root);
  const p = normalizePosix(path);
  if (r === "") return true;
  return p === r || p.startsWith(`${r}/`);
}
function relativePath(root, full) {
  const r = normalizePosix(root);
  const f = normalizePosix(full);
  if (f === r) return "";
  if (!isInsideRoot(r, f)) return full;
  return f.slice(r === "" ? 0 : r.length + 1);
}
function baseName(path) {
  const p = normalizePosix(path);
  const i = p.lastIndexOf("/");
  return i < 0 ? p : p.slice(i + 1);
}
function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

// src/client/utils/clipboard.ts
var import_react5 = require("react");
var pending = null;
var listeners = /* @__PURE__ */ new Set();
function emit() {
  for (const listener of listeners) listener();
}
function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function snapshot() {
  return pending;
}
function useClipboard() {
  return (0, import_react5.useSyncExternalStore)(subscribe, snapshot);
}
function setClipboard(value) {
  pending = value;
  emit();
}
function clearClipboard() {
  if (pending !== null) {
    pending = null;
    emit();
  }
}

// src/client/explorer/store.ts
var import_react6 = require("react");
var SNAPSHOT_KEY = "dsh-explorer-editor-session";
var MAX_PERSIST_CONTENT = 262144;
function shouldPersistContent(tab) {
  return tab.content.length <= MAX_PERSIST_CONTENT;
}
function filterByRoot(tabs2, root) {
  return tabs2.filter((t) => isInsideRoot(root, t.path));
}
function serialize(snapshot4) {
  return JSON.stringify(snapshot4);
}
function deserialize(raw) {
  try {
    const data = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;
    const obj = data;
    if (typeof obj.root !== "string" || !Array.isArray(obj.tabs)) return null;
    const tabs2 = [];
    for (const entry of obj.tabs) {
      if (typeof entry !== "object" || entry === null) continue;
      const t = entry;
      if (typeof t.path !== "string") continue;
      tabs2.push({
        path: t.path,
        mtimeMs: typeof t.mtimeMs === "number" ? t.mtimeMs : 0,
        dirty: t.dirty === true,
        error: typeof t.error === "string" ? t.error : void 0,
        content: typeof t.content === "string" ? t.content : void 0,
        savedContent: typeof t.savedContent === "string" ? t.savedContent : void 0
      });
    }
    return {
      root: obj.root,
      activePath: typeof obj.activePath === "string" ? obj.activePath : null,
      tabs: tabs2
    };
  } catch {
    return null;
  }
}
var persistTimer = null;
var pendingSnapshot = null;
function writeSnapshot(snapshot4) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SNAPSHOT_KEY, serialize(snapshot4));
  } catch {
    try {
      const slim = {
        root: snapshot4.root,
        activePath: snapshot4.activePath,
        tabs: snapshot4.tabs.map((t) => ({
          path: t.path,
          mtimeMs: t.mtimeMs,
          dirty: t.dirty,
          error: t.error
        }))
      };
      localStorage.setItem(SNAPSHOT_KEY, serialize(slim));
    } catch {
    }
  }
}
function saveSnapshot(snapshot4) {
  pendingSnapshot = snapshot4;
  if (persistTimer !== null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (pendingSnapshot !== null) {
      writeSnapshot(pendingSnapshot);
      pendingSnapshot = null;
    }
  }, 400);
}
function loadSnapshot() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw === null ? null : deserialize(raw);
  } catch {
    return null;
  }
}
function clearSnapshot() {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
    pendingSnapshot = null;
  }
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
  }
}
var tabs = [];
var activePath = null;
var currentRoot = null;
var listeners2 = /* @__PURE__ */ new Set();
function emit2() {
  for (const listener of listeners2) listener();
}
function setWorkspaceRoot(root) {
  currentRoot = root;
}
function persistNow() {
  if (currentRoot === null) return;
  saveSnapshot({
    root: currentRoot,
    activePath,
    tabs: tabs.map((t) => ({
      path: t.path,
      mtimeMs: t.mtimeMs,
      dirty: t.dirty,
      error: t.error,
      content: shouldPersistContent(t) ? t.content : void 0,
      savedContent: shouldPersistContent(t) ? t.savedContent : void 0
    }))
  });
}
function subscribe2(listener) {
  listeners2.add(listener);
  return () => {
    listeners2.delete(listener);
  };
}
function snapshotTabs() {
  return tabs;
}
function snapshotActive() {
  return activePath;
}
function useTabs() {
  return (0, import_react6.useSyncExternalStore)(subscribe2, snapshotTabs);
}
function useActivePath() {
  return (0, import_react6.useSyncExternalStore)(subscribe2, snapshotActive);
}
function openTab(tab) {
  const existing = tabs.find((t) => t.path === tab.path);
  if (existing) {
    activePath = tab.path;
  } else {
    tabs = [...tabs, tab];
    activePath = tab.path;
  }
  emit2();
  persistNow();
}
function focusTab(path) {
  if (tabs.some((t) => t.path === path)) {
    activePath = path;
    emit2();
    persistNow();
  }
}
function isTabOpen(path) {
  return tabs.some((t) => t.path === path);
}
function updateActiveContent(content) {
  if (activePath === null) return;
  tabs = tabs.map(
    (t) => t.path === activePath ? { ...t, content, dirty: content !== t.savedContent } : t
  );
  emit2();
  persistNow();
}
function markSaved(path) {
  tabs = tabs.map(
    (t) => t.path === path ? { ...t, savedContent: t.content, dirty: false } : t
  );
  emit2();
  persistNow();
}
function closeTab(path) {
  tabs = tabs.filter((t) => t.path !== path);
  if (activePath === path) {
    activePath = tabs.length > 0 ? tabs[tabs.length - 1].path : null;
  }
  emit2();
  persistNow();
}
function renameTab(from, to) {
  tabs = tabs.map((t) => t.path === from ? { ...t, path: to } : t);
  if (activePath === from) activePath = to;
  emit2();
  persistNow();
}
function removeTabs(paths) {
  const gone = new Set(paths);
  tabs = tabs.filter((t) => !gone.has(t.path));
  if (activePath !== null && gone.has(activePath)) {
    activePath = tabs.length > 0 ? tabs[tabs.length - 1].path : null;
  }
  emit2();
  persistNow();
}
function resetAll() {
  tabs = [];
  activePath = null;
  emit2();
  clearSnapshot();
}
function restoreTabs(nextTabs, active) {
  tabs = nextTabs;
  activePath = active;
  emit2();
}
var editorViewActive = false;
var viewListeners = /* @__PURE__ */ new Set();
function emitView() {
  for (const listener of viewListeners) listener();
}
function setEditorViewActive(active) {
  if (editorViewActive === active) return;
  editorViewActive = active;
  emitView();
}

// src/client/explorer/FileTree.tsx
var import_react8 = require("react");

// src/client/explorer/TreeContextMenu.tsx
var import_react7 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
function TreeContextMenu({ x, y, items, t, onClose }) {
  const [position, setPosition] = (0, import_react7.useState)(null);
  const [active, setActive] = (0, import_react7.useState)(-1);
  const rootRef = (0, import_react7.useRef)(null);
  const visible = (0, import_react7.useMemo)(() => items.filter((item) => !item.separator), [items]);
  (0, import_react7.useEffect)(() => {
    const el = rootRef.current;
    if (el === null) return;
    const rect = el.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 4);
    const top = Math.min(y, window.innerHeight - rect.height - 4);
    setPosition({ left: Math.max(4, left), top: Math.max(4, top) });
  }, [x, y]);
  (0, import_react7.useEffect)(() => {
    const first = visible.findIndex((item) => !item.disabled);
    setActive(first);
  }, []);
  (0, import_react7.useEffect)(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        let idx = active;
        for (let step = 0; step < visible.length; step++) {
          idx = (idx + delta + visible.length) % visible.length;
          if (!visible[idx].disabled) break;
        }
        setActive(idx);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const item = visible[active];
        if (item !== void 0 && !item.disabled) {
          item.onSelect();
          onClose();
        }
      }
    };
    const onPointerDown = (e) => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target)) onClose();
    };
    const onContextMenuElsewhere = (e) => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target)) onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("contextmenu", onContextMenuElsewhere, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("contextmenu", onContextMenuElsewhere, true);
    };
  }, [visible, active, onClose]);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "div",
    {
      ref: rootRef,
      className: "dshf-context-menu",
      role: "menu",
      "aria-label": t("contextMenu.label"),
      style: position === null ? { visibility: "hidden", left: x, top: y } : { left: position.left, top: position.top },
      onContextMenu: (e) => e.preventDefault(),
      children: items.map((item) => {
        if (item.separator) {
          return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { role: "separator", className: "dshf-menu-sep" }, item.id);
        }
        const visibleIndex = visible.indexOf(item);
        return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "button",
          {
            type: "button",
            role: "menuitem",
            className: `dshf-menu-item${visibleIndex === active ? " dshf-menu-item-active" : ""}${item.disabled ? " dshf-menu-item-disabled" : ""}`,
            disabled: item.disabled,
            onMouseEnter: () => setActive(visibleIndex),
            onClick: () => {
              if (item.disabled) return;
              item.onSelect();
              onClose();
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dshf-menu-label", children: item.label }),
              item.shortcut !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dshf-menu-shortcut", children: item.shortcut })
            ]
          },
          item.id
        );
      })
    }
  );
}

// src/client/explorer/FileTree.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function DirChildren({
  node,
  depth,
  t,
  onRender
}) {
  if (node === void 0 || node.entries === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dshf-tree-hint", style: { paddingLeft: `${8 + depth * 14}px` }, children: node?.error ? format(t("tree.loadFailed"), { message: node.error }) : t("tree.loading") });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_jsx_runtime6.Fragment, { children: onRender(node.path, node.entries, depth) });
}
function InlineInput({
  depth,
  isDir,
  initial,
  t,
  onSubmit,
  onCancel
}) {
  const [value, setValue] = (0, import_react8.useState)(initial);
  const inputRef = (0, import_react8.useRef)(null);
  (0, import_react8.useEffect)(() => {
    const el = inputRef.current;
    if (el === null) return;
    el.focus();
    const dot = initial.lastIndexOf(".");
    if (initial !== "" && dot > 0) el.setSelectionRange(0, dot);
    else el.select();
  }, [initial]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dshf-node dshf-node-editing", style: { paddingLeft: `${8 + depth * 14}px` }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dshf-caret" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: cx("dshf-icon", isDir ? "dshf-icon-dir" : "dshf-icon-file"), children: isDir ? "\u{1F4C1}" : "\u{1F4C4}" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "input",
      {
        ref: inputRef,
        className: "dshf-inline-input",
        value,
        placeholder: initial === "" ? isDir ? t("tree.directoryPlaceholder") : t("tree.filePlaceholder") : void 0,
        onChange: (e) => setValue(e.target.value),
        onClick: (e) => e.stopPropagation(),
        onKeyDown: (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void onSubmit(value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        },
        onBlur: onCancel
      }
    )
  ] });
}
var FileTree = (0, import_react8.forwardRef)(function FileTree2({ remote, root, t, onOpenFile, onDelete, onRenamed, onNotice }, ref) {
  const [expanded, setExpanded] = (0, import_react8.useState)({ [root]: { path: root, entries: null } });
  const [selected, setSelected] = (0, import_react8.useState)(null);
  const [editing, setEditing] = (0, import_react8.useState)(null);
  const [rev, setRev] = (0, import_react8.useState)(0);
  const [menu, setMenu] = (0, import_react8.useState)(null);
  const clipboard = useClipboard();
  const dirPaths = (0, import_react8.useRef)(/* @__PURE__ */ new Set());
  const visibleNodes = (0, import_react8.useRef)([]);
  const nodeEls = (0, import_react8.useRef)(/* @__PURE__ */ new Map());
  const rootRef = (0, import_react8.useRef)(root);
  rootRef.current = root;
  const expandedRef = (0, import_react8.useRef)(expanded);
  expandedRef.current = expanded;
  const editingRef = (0, import_react8.useRef)(editing);
  editingRef.current = editing;
  const menuRef = (0, import_react8.useRef)(menu);
  menuRef.current = menu;
  const parentOf = (0, import_react8.useCallback)(
    (p) => {
      const i = p.lastIndexOf("/");
      if (i <= 0) return root;
      return p.slice(0, i) || root;
    },
    [root]
  );
  const loadDir = (0, import_react8.useCallback)(
    async (path) => {
      setExpanded((prev) => ({ ...prev, [path]: { ...prev[path] ?? { path }, entries: null, error: void 0 } }));
      try {
        const value = unwrap(await remote.listDir(path));
        setExpanded((prev) => ({ ...prev, [path]: { path, entries: value.entries } }));
      } catch (error) {
        setExpanded((prev) => ({
          ...prev,
          [path]: { path, entries: [], error: error instanceof Error ? error.message : String(error) }
        }));
      }
    },
    [remote]
  );
  (0, import_react8.useEffect)(() => {
    setEditing(null);
    setMenu(null);
    void loadDir(root);
  }, [root, rev, loadDir]);
  (0, import_react8.useEffect)(() => {
    const es = new EventSource("/dsh-unknownue-plugins/explorer/watch");
    es.onmessage = (event) => {
      if (editingRef.current !== null || menuRef.current !== null) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.rootChanged) {
          void loadDir(rootRef.current);
          for (const dir of Object.keys(expandedRef.current)) void loadDir(dir);
          return;
        }
        if (Array.isArray(msg.dirs)) {
          for (const dir of msg.dirs) {
            if (dir === rootRef.current || expandedRef.current[dir] !== void 0) void loadDir(dir);
          }
        }
      } catch {
      }
    };
    return () => es.close();
  }, [loadDir]);
  (0, import_react8.useEffect)(() => {
    const fullRefresh = () => {
      void loadDir(rootRef.current);
      for (const dir of Object.keys(expandedRef.current)) void loadDir(dir);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") fullRefresh();
    };
    window.addEventListener("focus", fullRefresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", fullRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadDir]);
  const closeMenu = (0, import_react8.useCallback)(() => setMenu(null), []);
  const copyToClipboard = (0, import_react8.useCallback)(
    async (text, okMessage) => {
      try {
        if (typeof navigator === "undefined" || !navigator.clipboard) throw new Error(t("tree.clipboardUnavailable"));
        await navigator.clipboard.writeText(text);
        onNotice(okMessage);
      } catch (error) {
        onNotice(format(t("tree.copyFailed"), { message: error instanceof Error ? error.message : String(error) }));
      }
    },
    [onNotice, t]
  );
  const pasteInto = (0, import_react8.useCallback)(
    async (targetDir, sourcePath) => {
      const kind = clipboard?.kind ?? "copy";
      const name = baseName(sourcePath);
      const dest = `${targetDir.replace(/\/$/, "")}/${name}`;
      const sourceParent = parentOf(sourcePath);
      const verb = kind === "cut" ? t("tree.move") : t("tree.copyVerb");
      if (dest === sourcePath) {
        onNotice(t("tree.alreadyThere"));
        return;
      }
      try {
        if (kind === "cut") {
          await unwrap(await remote.rename(sourcePath, dest));
          onRenamed(sourcePath, dest);
        } else {
          await unwrap(await remote.copy(sourcePath, dest));
        }
        await loadDir(targetDir);
        if (sourceParent !== targetDir) await loadDir(sourceParent);
        setSelected(dest);
        clearClipboard();
        onNotice(format(kind === "cut" ? t("tree.moved") : t("tree.copiedVerb"), { name }));
      } catch (error) {
        onNotice(format(t("tree.pasteFailed"), { verb, message: error instanceof Error ? error.message : String(error) }));
      }
    },
    [clipboard, remote, parentOf, loadDir, onRenamed, onNotice, t]
  );
  const menuItems = (0, import_react8.useMemo)(() => {
    if (menu === null) return [];
    const { path, isDir } = menu;
    const name = baseName(path);
    const items = [
      {
        id: "cut",
        label: t("menu.cut"),
        onSelect: () => {
          setClipboard({ kind: "cut", path });
          onNotice(format(t("tree.cut"), { name }));
        }
      },
      {
        id: "copy",
        label: t("menu.copy"),
        onSelect: () => {
          setClipboard({ kind: "copy", path });
          onNotice(format(t("tree.copied"), { name }));
        }
      },
      {
        id: "rename",
        label: t("menu.rename"),
        onSelect: () => {
          setSelected(path);
          setEditing({ mode: "rename", path });
        }
      },
      {
        id: "copy-path",
        label: t("menu.copyPath"),
        onSelect: () => void copyToClipboard(path, t("tree.copiedPath"))
      },
      {
        id: "copy-rel-path",
        label: t("menu.copyRelativePath"),
        onSelect: () => void copyToClipboard(relativePath(root, path), t("tree.copiedRelativePath"))
      },
      {
        id: "delete",
        label: t("menu.delete"),
        onSelect: () => onDelete(path)
      }
    ];
    if (isDir) {
      items.push({ id: "paste-sep", separator: true, label: "", onSelect: () => {
      } });
      items.push({
        id: "paste",
        label: clipboard === null ? t("menu.paste") : format(clipboard.kind === "cut" ? t("menu.pasteMove") : t("menu.pasteCopy"), {
          name: baseName(clipboard.path)
        }),
        disabled: clipboard === null,
        onSelect: () => {
          if (clipboard !== null) void pasteInto(path, clipboard.path);
        }
      });
    }
    return items;
  }, [menu, clipboard, root, t, onNotice, copyToClipboard, pasteInto, onDelete]);
  const cwdTarget = (0, import_react8.useCallback)(() => {
    if (selected === null) return root;
    if (dirPaths.current.has(selected)) return selected;
    return parentOf(selected);
  }, [selected, root, parentOf]);
  const beginCreate = (0, import_react8.useCallback)(
    (kind) => {
      const parent = cwdTarget();
      if (parent !== root && expanded[parent] === void 0) void loadDir(parent);
      setSelected(parent);
      setEditing({ mode: "create", parent, kind });
    },
    [cwdTarget, expanded, loadDir, root]
  );
  (0, import_react8.useImperativeHandle)(
    ref,
    () => ({
      refresh: () => setRev((v) => v + 1),
      beginCreate
    }),
    [beginCreate]
  );
  const cancelEdit = (0, import_react8.useCallback)(() => setEditing(null), []);
  const submitCreate = (0, import_react8.useCallback)(
    async (name) => {
      if (editing?.mode !== "create") return true;
      const trimmed = name.trim();
      if (trimmed === "") return true;
      if (trimmed.includes("/")) {
        onNotice(t("tree.noSlash"));
        return false;
      }
      const target = `${editing.parent.replace(/\/$/, "")}/${trimmed}`;
      try {
        if (editing.kind === "directory") await unwrap(await remote.createDirectory(target));
        else await unwrap(await remote.createFile(target));
      } catch (error) {
        onNotice(format(t("tree.createFailed"), { message: error instanceof Error ? error.message : String(error) }));
        return false;
      }
      await loadDir(editing.parent);
      setEditing(null);
      setSelected(target);
      onNotice(format(editing.kind === "directory" ? t("tree.createdDirectory") : t("tree.createdFile"), { name: trimmed }));
      if (editing.kind === "file") onOpenFile(target);
      return true;
    },
    [editing, remote, loadDir, onNotice, onOpenFile, t]
  );
  const submitRename = (0, import_react8.useCallback)(
    async (name) => {
      if (editing?.mode !== "rename") return true;
      const from = editing.path;
      const trimmed = name.trim();
      const oldName = from.split("/").pop() ?? "";
      if (trimmed === "" || trimmed === oldName) return true;
      if (trimmed.includes("/")) {
        onNotice(t("tree.noSlash"));
        return false;
      }
      const to = `${parentOf(from).replace(/\/$/, "")}/${trimmed}`;
      try {
        await unwrap(await remote.rename(from, to));
      } catch (error) {
        onNotice(format(t("tree.renameFailed"), { message: error instanceof Error ? error.message : String(error) }));
        return false;
      }
      await loadDir(parentOf(from));
      setEditing(null);
      setSelected(to);
      onRenamed(from, to);
      onNotice(format(t("tree.renamed"), { name: trimmed }));
      return true;
    },
    [editing, remote, loadDir, parentOf, onRenamed, onNotice, t]
  );
  const activate = (0, import_react8.useCallback)(
    (path, isDir) => {
      setSelected(path);
      if (isDir) {
        if (expanded[path] !== void 0) {
          setExpanded((prev) => {
            const next = { ...prev };
            delete next[path];
            return next;
          });
        } else {
          void loadDir(path);
        }
      } else {
        onOpenFile(path);
      }
    },
    [expanded, loadDir, onOpenFile]
  );
  const handleTreeKeyDown = (0, import_react8.useCallback)(
    (event) => {
      if (editing !== null || menu !== null) return;
      const nodes = visibleNodes.current;
      if (nodes.length === 0) return;
      const index = selected === null ? -1 : nodes.indexOf(selected);
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (index < nodes.length - 1) {
            const next = nodes[index + 1];
            setSelected(next);
            nodeEls.current.get(next)?.focus();
          }
          break;
        case "ArrowUp":
          event.preventDefault();
          if (index > 0) {
            const prev = nodes[index - 1];
            setSelected(prev);
            nodeEls.current.get(prev)?.focus();
          } else if (index === -1 && nodes.length > 0) {
            setSelected(nodes[0]);
            nodeEls.current.get(nodes[0])?.focus();
          }
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (selected !== null) activate(selected, dirPaths.current.has(selected));
          break;
        case "ArrowRight":
          event.preventDefault();
          if (selected !== null && dirPaths.current.has(selected) && expanded[selected] === void 0) void loadDir(selected);
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (selected !== null && dirPaths.current.has(selected) && expanded[selected] !== void 0) {
            setExpanded((prev) => {
              const next = { ...prev };
              delete next[selected];
              return next;
            });
          }
          break;
        default:
          break;
      }
    },
    [editing, menu, selected, expanded, activate, loadDir]
  );
  const renderLevel = (0, import_react8.useCallback)(
    (path, entries, depth) => {
      const draftHere = editing?.mode === "create" && editing.parent === path ? editing : null;
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
        draftHere !== null && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          InlineInput,
          {
            depth,
            isDir: draftHere.kind === "directory",
            initial: "",
            t,
            onSubmit: submitCreate,
            onCancel: cancelEdit
          }
        ),
        entries.map((entry) => {
          const full = `${path.replace(/\/$/, "")}/${entry.name}`;
          const isDir = entry.type === "directory";
          if (isDir) dirPaths.current.add(full);
          visibleNodes.current.push(full);
          const isOpen = expanded[full] !== void 0;
          const isRenaming = editing?.mode === "rename" && editing.path === full;
          return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
            isRenaming ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              InlineInput,
              {
                depth,
                isDir,
                initial: entry.name,
                t,
                onSubmit: submitRename,
                onCancel: cancelEdit
              }
            ) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
              "div",
              {
                role: "treeitem",
                "aria-selected": selected === full,
                "aria-expanded": isDir ? isOpen || false : void 0,
                tabIndex: selected === full ? 0 : -1,
                ref: (el) => {
                  if (el !== null) nodeEls.current.set(full, el);
                  else nodeEls.current.delete(full);
                },
                className: cx(
                  "dshf-node",
                  selected === full && "dshf-selected",
                  clipboard !== null && clipboard.kind === "cut" && clipboard.path === full && "dshf-cut"
                ),
                style: { paddingLeft: `${8 + depth * 14}px` },
                onClick: () => activate(full, isDir),
                onDoubleClick: () => {
                  if (!isDir && selected === full) onOpenFile(full);
                },
                onContextMenu: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelected(full);
                  setMenu({ x: e.clientX, y: e.clientY, path: full, isDir });
                },
                title: full,
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dshf-caret", children: isDir ? isOpen ? "\u25BE" : "\u25B8" : "" }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: cx("dshf-icon", isDir ? "dshf-icon-dir" : "dshf-icon-file"), children: isDir ? "\u{1F4C1}" : "\u{1F4C4}" }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dshf-name", children: entry.name }),
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dshf-node-actions", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      "button",
                      {
                        type: "button",
                        className: "dshf-mini",
                        title: t("tree.renameTitle"),
                        onClick: (e) => {
                          e.stopPropagation();
                          setSelected(full);
                          setEditing({ mode: "rename", path: full });
                        },
                        children: "\u270E"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      "button",
                      {
                        type: "button",
                        className: "dshf-mini",
                        title: t("tree.deleteTitle"),
                        onClick: (e) => {
                          e.stopPropagation();
                          onDelete(full);
                        },
                        children: "\u{1F5D1}"
                      }
                    )
                  ] })
                ]
              }
            ),
            isDir && isOpen && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(DirChildren, { node: expanded[full], depth: depth + 1, t, onRender: renderLevel })
          ] }, full);
        })
      ] });
    },
    [expanded, selected, editing, clipboard, loadDir, onOpenFile, onDelete, submitCreate, submitRename, cancelEdit, activate, t]
  );
  const node = expanded[root];
  visibleNodes.current = [];
  dirPaths.current.clear();
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "div",
    {
      className: "dshf-tree-scroll",
      role: "tree",
      tabIndex: 0,
      onKeyDown: handleTreeKeyDown,
      onContextMenu: (e) => {
        e.preventDefault();
        setSelected(root);
        setMenu({ x: e.clientX, y: e.clientY, path: root, isDir: true });
      },
      children: [
        node === void 0 ? null : node.entries === null ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dshf-tree-hint", children: node.error ? format(t("tree.loadFailed"), { message: node.error }) : t("tree.loading") }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dshf-tree-list", children: [
          node.entries.length === 0 && editing?.mode !== "create" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dshf-tree-hint", children: t("tree.empty") }),
          renderLevel(root, node.entries, 0)
        ] }),
        menu !== null && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TreeContextMenu, { x: menu.x, y: menu.y, items: menuItems, t, onClose: closeMenu })
      ]
    }
  );
});

// src/client/explorer/FileManagerPanel.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function IconPlus(props) {
  const size = props.size ?? 16;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: { display: "block" }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { d: "M8.64453 1.5V7.34961H14.5V8.65039H8.64453V14.5H7.34473V8.65039H1.5V7.34961H7.34473V1.5H8.64453Z", fill: "currentColor" }) });
}
function IconFolderAdd(props) {
  const size = props.size ?? 16;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: { display: "block" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { transform: "translate(9.52 2.52)", d: "M3.55246 0L3.55246 2.44252L6 2.44252L6 3.55748L3.55246 3.55748L3.55246 6L2.43834 6L2.43834 3.55748L0 3.55748L0 2.44252L2.43834 2.44252L2.43834 0L3.55246 0Z", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { transform: "translate(0.3496 2.35)", d: "M4.76367 0C5.36861 1.80598e-05 5.93113 0.310294 6.25488 0.821289L6.78027 1.64941C6.79685 1.67558 6.81791 1.69775 6.83887 1.71973C6.72186 2.15521 6.65702 2.61192 6.65137 3.08301C6.25601 2.96045 5.90909 2.70478 5.68164 2.3457L5.15723 1.5166C5.07183 1.38189 4.92318 1.3008 4.76367 1.30078L2.32422 1.30078C1.7589 1.30078 1.30078 1.7589 1.30078 2.32422L1.30078 10.1338C1.30078 10.6991 1.7589 11.1572 2.32422 11.1572L11.9766 11.1572C12.5419 11.1572 13 10.6991 13 8.58398C13.4545 8.5135 13.8903 8.38748 14.3008 8.21289L14.3008 10.1338C14.3008 11.4171 13.2598 12.458 11.9766 12.458L2.32422 12.458C1.04093 12.458 0 11.4171 0 10.1338L0 2.32422C0 1.04093 1.04093 0 2.32422 0L4.76367 0Z", fill: "currentColor" })
  ] });
}
function DeleteConfirmDialog({
  path,
  t,
  onConfirm,
  onCancel
}) {
  const name = path.split("/").pop() ?? path;
  const confirmRef = (0, import_react9.useRef)(null);
  (0, import_react9.useEffect)(() => {
    confirmRef.current?.focus();
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "div",
    {
      className: "dshf-modal-overlay",
      onClick: onCancel,
      onKeyDown: (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
        "div",
        {
          className: "dshf-modal",
          role: "alertdialog",
          "aria-modal": "true",
          "aria-label": format(t("panel.deleteTitle"), { name }),
          onClick: (e) => e.stopPropagation(),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dshf-modal-title", children: format(t("panel.deleteTitle"), { name }) }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dshf-modal-body", children: format(t("panel.deleteBody"), { name }) }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dshf-modal-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dshf-btn", onClick: onCancel, children: t("panel.cancel") }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { ref: confirmRef, type: "button", className: "dshf-btn dshf-btn-danger", onClick: onConfirm, children: t("panel.delete") })
            ] })
          ]
        }
      )
    }
  );
}
function FileManagerPanel({ remote, t, useSessions, onFileOpened }) {
  const [root, setRoot] = (0, import_react9.useState)(null);
  const [rootError, setRootError] = (0, import_react9.useState)(null);
  const [busy, setBusy] = (0, import_react9.useState)(false);
  const [notice, setNotice] = (0, import_react9.useState)(null);
  const treeRef = (0, import_react9.useRef)(null);
  const sessionCwd = useSessions ? useSessions((s) => s.current !== void 0 ? s.byId[s.current]?.cwd : void 0) : void 0;
  const prevCwdRef = (0, import_react9.useRef)(void 0);
  (0, import_react9.useEffect)(() => {
    if (prevCwdRef.current !== void 0 && prevCwdRef.current !== sessionCwd) {
      resetAll();
      clearClipboard();
    }
    prevCwdRef.current = sessionCwd;
    let cancelled = false;
    (async () => {
      try {
        if (sessionCwd !== void 0) {
          try {
            await unwrap(await remote.setRoot(sessionCwd));
          } catch {
          }
        }
        const { path } = unwrap(remote.getRoot());
        if (!cancelled) {
          setRoot(path);
          setRootError(null);
          setWorkspaceRoot(path);
        }
      } catch (error) {
        if (!cancelled) setRootError(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [remote, sessionCwd]);
  const handleNotice = (0, import_react9.useCallback)((message) => {
    setNotice(message);
  }, []);
  const openFile = (0, import_react9.useCallback)(
    async (path) => {
      if (isTabOpen(path)) {
        focusTab(path);
        onFileOpened?.();
        return;
      }
      setBusy(true);
      try {
        const value = unwrap(await remote.readText(path));
        openTab({
          path,
          content: value.content,
          savedContent: value.content,
          mtimeMs: value.mtimeMs,
          dirty: false
        });
        onFileOpened?.();
      } catch (error) {
        handleNotice(format(t("panel.openFailed"), { message: error instanceof Error ? error.message : String(error) }));
      } finally {
        setBusy(false);
      }
    },
    [remote, t, handleNotice, onFileOpened]
  );
  const handleCreate = (0, import_react9.useCallback)((kind) => {
    treeRef.current?.beginCreate(kind);
  }, []);
  const handleRenamed = (0, import_react9.useCallback)((from, to) => {
    renameTab(from, to);
  }, []);
  const [pendingDelete, setPendingDelete] = (0, import_react9.useState)(null);
  const handleDelete = (0, import_react9.useCallback)((path) => {
    setPendingDelete(path);
  }, []);
  const confirmDelete = (0, import_react9.useCallback)(async () => {
    const path = pendingDelete;
    setPendingDelete(null);
    if (path === null) return;
    setBusy(true);
    try {
      await unwrap(await remote.delete(path));
      removeTabs([path]);
      treeRef.current?.refresh();
      handleNotice(t("panel.deleted"));
    } catch (error) {
      handleNotice(format(t("panel.deleteFailed"), { message: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(false);
    }
  }, [pendingDelete, remote, t, handleNotice]);
  const title = (0, import_react9.useMemo)(() => {
    if (root === null) return "\u2026";
    return root.split("/").filter(Boolean).pop() || "/";
  }, [root]);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dshf-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dshf-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dshf-title", title: root ?? "", children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dshf-spacer" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "button",
        {
          type: "button",
          className: "dshf-btn dshf-btn-icon",
          title: t("panel.newFile"),
          "aria-label": t("panel.newFile"),
          onClick: () => handleCreate("file"),
          children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconPlus, {})
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "button",
        {
          type: "button",
          className: "dshf-btn dshf-btn-icon",
          title: t("panel.newDirectory"),
          "aria-label": t("panel.newDirectory"),
          onClick: () => handleCreate("directory"),
          children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconFolderAdd, {})
        }
      )
    ] }),
    rootError !== null && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dshf-error", children: rootError }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dshf-tree-pane", children: root !== null && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      FileTree,
      {
        ref: treeRef,
        remote,
        root,
        t,
        onOpenFile: (p) => void openFile(p),
        onDelete: (p) => void handleDelete(p),
        onRenamed: handleRenamed,
        onNotice: handleNotice
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dshf-status", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dshf-status-busy", children: busy ? "\u2026" : "" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: cx("dshf-status-notice", notice === null && "dshf-hidden"), children: notice ?? "" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dshf-spacer" })
    ] }),
    pendingDelete !== null && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      DeleteConfirmDialog,
      {
        path: pendingDelete,
        t,
        onConfirm: () => void confirmDelete(),
        onCancel: () => setPendingDelete(null)
      }
    )
  ] });
}

// src/client/explorer/ExplorerViewWrapper.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var TREE_WIDTH_KEY = "dsh.explorer.treeWidth";
var TREE_WIDTH_DEFAULT = 300;
var TREE_WIDTH_MIN = 160;
var TREE_CONTENT_MIN = 240;
function clampTreeWidth(value, containerWidth) {
  const n = Math.round(Number(value));
  const finite = Number.isFinite(n) ? n : TREE_WIDTH_DEFAULT;
  const upper = containerWidth !== void 0 && containerWidth > 0 ? Math.max(TREE_WIDTH_MIN, containerWidth - TREE_CONTENT_MIN) : 1200;
  return Math.min(upper, Math.max(TREE_WIDTH_MIN, finite));
}
function readTreeWidth() {
  try {
    return clampTreeWidth(localStorage.getItem(TREE_WIDTH_KEY) ?? TREE_WIDTH_DEFAULT);
  } catch {
    return TREE_WIDTH_DEFAULT;
  }
}
var FileEditorViewComponent = null;
function setFileEditorViewComponent(component) {
  FileEditorViewComponent = component;
}
function ExplorerViewWrapper(props) {
  const containerRef = (0, import_react10.useRef)(null);
  const dragRef = (0, import_react10.useRef)(null);
  const widthRef = (0, import_react10.useRef)(readTreeWidth());
  const [treeWidth, setTreeWidth] = (0, import_react10.useState)(widthRef.current);
  const [viewHeight, setViewHeight] = (0, import_react10.useState)(0);
  const [bottomClearance, setBottomClearance] = (0, import_react10.useState)(0);
  (0, import_react10.useEffect)(() => {
    const el = containerRef.current;
    if (!el) return;
    const scroller = el.closest("[data-conversation-scroll]");
    if (!scroller) return;
    const prevGutter = scroller.style.scrollbarGutter;
    scroller.style.scrollbarGutter = "auto";
    const sync = () => {
      const clientHeight = scroller.clientHeight;
      if (clientHeight <= 0) return;
      const composer = scroller.querySelector("[data-composer-seat]");
      const composerHeight = composer ? composer.offsetHeight : 0;
      const overlay = scroller.querySelector("[data-conversation-composer-overlay]") !== null;
      const available = overlay ? clientHeight : Math.max(160, clientHeight - composerHeight);
      setViewHeight(available);
      setBottomClearance(overlay ? composerHeight + 16 : 0);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(scroller);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
      scroller.style.scrollbarGutter = prevGutter;
    };
  }, []);
  const onResizeStart = (event) => {
    event.preventDefault();
    const rect = containerRef.current ? containerRef.current.getBoundingClientRect() : null;
    dragRef.current = {
      startX: event.clientX,
      startWidth: widthRef.current,
      containerWidth: rect ? rect.width : void 0
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.setAttribute("data-dragging", "true");
  };
  const onResizeMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = clampTreeWidth(drag.startWidth + (event.clientX - drag.startX), drag.containerWidth);
    widthRef.current = next;
    setTreeWidth(next);
  };
  const onResizeEnd = (event) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    event.currentTarget.removeAttribute("data-dragging");
    try {
      localStorage.setItem(TREE_WIDTH_KEY, String(widthRef.current));
    } catch {
    }
  };
  const EditorComponent = FileEditorViewComponent;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      className: "dshfx-split",
      ref: containerRef,
      style: {
        display: "flex",
        flexDirection: "row",
        height: viewHeight > 0 ? viewHeight + "px" : "100%",
        minHeight: 0,
        overflow: "hidden",
        position: "relative"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            className: "dshfx-tree-pane",
            style: {
              width: treeWidth + "px",
              flex: "0 0 auto",
              minWidth: 0,
              overflow: "hidden",
              borderRight: "1px solid var(--dsw-alias-border-l2)",
              boxSizing: "border-box",
              paddingBottom: bottomClearance
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              FileManagerPanel,
              {
                remote: props.remote,
                t: props.t,
                useSessions: props.useSessions,
                onFileOpened: () => {
                }
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            className: "dshfx-resizer",
            role: "separator",
            "aria-orientation": "vertical",
            "aria-label": "\u8C03\u6574\u6587\u4EF6\u6811\u5BBD\u5EA6",
            style: {
              flex: "0 0 auto",
              width: 6,
              cursor: "col-resize",
              touchAction: "none",
              position: "relative",
              zIndex: 1
            },
            onPointerDown: onResizeStart,
            onPointerMove: onResizeMove,
            onPointerUp: onResizeEnd,
            onPointerCancel: onResizeEnd
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "div",
          {
            className: "dshfx-editor-pane",
            style: {
              flex: "1 1 0%",
              minWidth: 0,
              overflow: "hidden",
              paddingBottom: bottomClearance
            },
            children: EditorComponent && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(EditorComponent, { remote: props.remote, t: props.t })
          }
        )
      ]
    }
  );
}

// src/client/editor/FileEditorView.tsx
var import_react16 = require("react");

// src/client/editor/themeStore.ts
var import_react11 = require("react");
var EDITOR_THEME_PRESETS = {
  light: { background: "#ffffff", foreground: "#1f2328", fontSize: 13 },
  dark: { background: "#1e1e1e", foreground: "#d4d4d4", fontSize: 13 },
  "one-dark": { background: "#282c34", foreground: "#abb2bf", fontSize: 13 },
  github: { background: "#ffffff", foreground: "#24292e", fontSize: 13 }
};
var EDITOR_THEME_PRESET_ORDER = ["light", "dark", "one-dark", "github"];
var EDITOR_THEME_PRESET_LABELS = {
  light: "\u6D45\u8272",
  dark: "\u6DF1\u8272",
  "one-dark": "One Dark",
  github: "GitHub"
};
var DEFAULT_EDITOR_THEME = { ...EDITOR_THEME_PRESETS.light };
function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return [0, 0, 0];
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
function rgbToHex(r, g, b) {
  const c = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mixColors(a, b, amount) {
  const [ar, ag, ab] = hexToRgb(a);
  const [br2, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br2 - ar) * amount, ag + (bg - ag) * amount, ab + (bb - ab) * amount);
}
function luminanceOf(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function isLightColor(hex) {
  return luminanceOf(hex) > 0.5;
}
function themeChrome(theme) {
  const light = isLightColor(theme.background);
  const chrome = mixColors(theme.background, light ? "#000000" : "#ffffff", light ? 0.06 : 0.08);
  const border = mixColors(theme.background, light ? "#000000" : "#ffffff", light ? 0.22 : 0.18);
  const muted = mixColors(theme.foreground, theme.background, 0.45);
  const chip = mixColors(theme.background, light ? "#000000" : "#ffffff", light ? 0.05 : 0.06);
  const dirty = light ? "#c2410c" : "#e2c08d";
  return { chrome, border, muted, chip, dirty };
}
var STORAGE_KEY = "dsh-explorer-editor:editor-theme:v2";
var HEX6 = /^#[0-9a-f]{6}$/i;
function load() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.background === "string" && HEX6.test(parsed.background) && typeof parsed?.foreground === "string" && HEX6.test(parsed.foreground)) {
          return {
            background: parsed.background.toLowerCase(),
            foreground: parsed.foreground.toLowerCase(),
            fontSize: typeof parsed.fontSize === "number" && parsed.fontSize > 0 ? parsed.fontSize : 13
          };
        }
      }
    }
  } catch {
  }
  return { ...DEFAULT_EDITOR_THEME };
}
var current = load();
var listeners3 = /* @__PURE__ */ new Set();
function emit3() {
  for (const listener of listeners3) listener();
}
function subscribe3(listener) {
  listeners3.add(listener);
  return () => {
    listeners3.delete(listener);
  };
}
function snapshot2() {
  return current;
}
function useEditorTheme() {
  return (0, import_react11.useSyncExternalStore)(subscribe3, snapshot2);
}
function setEditorTheme(partial) {
  current = { ...current, ...partial };
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
  }
  emit3();
}
function resetEditorTheme() {
  current = { ...DEFAULT_EDITOR_THEME };
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
  emit3();
}
function presetIdOf(theme) {
  for (const [id, preset] of Object.entries(EDITOR_THEME_PRESETS)) {
    if (preset.background === theme.background && preset.foreground === theme.foreground) return id;
  }
  return void 0;
}
function exportThemeText(theme, name) {
  return JSON.stringify(
    {
      name,
      type: "dsh-explorer-editor-theme",
      version: 1,
      background: theme.background,
      foreground: theme.foreground,
      fontSize: theme.fontSize,
      colors: {
        "editor.background": theme.background,
        "editor.foreground": theme.foreground
      }
    },
    null,
    2
  );
}
function themeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function parseImportedTheme(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw themeError("invalid-json", "File is not valid JSON");
  }
  if (typeof data !== "object" || data === null) throw themeError("not-object", "JSON content must be an object");
  const obj = data;
  let background = typeof obj.background === "string" ? obj.background : void 0;
  let foreground = typeof obj.foreground === "string" ? obj.foreground : void 0;
  if ((background === void 0 || foreground === void 0) && typeof obj.colors === "object" && obj.colors !== null) {
    const colors = obj.colors;
    if (background === void 0) background = typeof colors["editor.background"] === "string" ? colors["editor.background"] : void 0;
    if (foreground === void 0) foreground = typeof colors["editor.foreground"] === "string" ? colors["editor.foreground"] : void 0;
  }
  if (background === void 0 || !HEX6.test(background)) {
    throw themeError("missing-background", "Missing valid background color (#rrggbb required)");
  }
  if (foreground === void 0 || !HEX6.test(foreground)) {
    throw themeError("missing-foreground", "Missing valid foreground color (#rrggbb required)");
  }
  const fontSize = typeof obj.fontSize === "number" && obj.fontSize > 0 ? obj.fontSize : 13;
  const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : void 0;
  return { name, background: background.toLowerCase(), foreground: foreground.toLowerCase(), fontSize };
}
function themeErrorMessage(t, error) {
  switch (error.code) {
    case "invalid-json":
      return t("theme.errorInvalidJson");
    case "not-object":
      return t("theme.errorNotObject");
    case "missing-background":
      return t("theme.errorMissingBackground");
    case "missing-foreground":
      return t("theme.errorMissingForeground");
    default:
      return error.message;
  }
}

// src/client/editor/mdModeStore.ts
var import_react12 = require("react");
var DEFAULT_MD_MODE = "source";
var MD_MODE_STORAGE_KEY = "dsh-explorer-editor:md-mode:v2";
var VALID = /* @__PURE__ */ new Set(["preview", "source"]);
function safeStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : void 0;
  } catch {
    return void 0;
  }
}
function loadMdMode(storage) {
  try {
    const raw = storage?.getItem(MD_MODE_STORAGE_KEY);
    return raw !== null && raw !== void 0 && VALID.has(raw) ? raw : DEFAULT_MD_MODE;
  } catch {
    return DEFAULT_MD_MODE;
  }
}
function persistMdMode(mode, storage) {
  try {
    storage?.setItem(MD_MODE_STORAGE_KEY, mode);
  } catch {
  }
}
var current2 = loadMdMode(safeStorage());
var listeners4 = /* @__PURE__ */ new Set();
function emit4() {
  for (const listener of listeners4) listener();
}
function subscribe4(listener) {
  listeners4.add(listener);
  return () => {
    listeners4.delete(listener);
  };
}
function snapshot3() {
  return current2;
}
function useMdMode() {
  return (0, import_react12.useSyncExternalStore)(subscribe4, snapshot3);
}
function setMdMode(mode) {
  current2 = mode;
  const storage = safeStorage();
  if (storage !== void 0) persistMdMode(mode, storage);
  emit4();
}

// node_modules/marked/lib/marked.esm.js
function _getDefaults() {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null
  };
}
var _defaults = _getDefaults();
function changeDefaults(newDefaults) {
  _defaults = newDefaults;
}
var noopTest = { exec: () => null };
function edit(regex, opt = "") {
  let source = typeof regex === "string" ? regex : regex.source;
  const obj = {
    replace: (name, val) => {
      let valSource = typeof val === "string" ? val : val.source;
      valSource = valSource.replace(other.caret, "$1");
      source = source.replace(name, valSource);
      return obj;
    },
    getRegex: () => {
      return new RegExp(source, opt);
    }
  };
  return obj;
}
var other = {
  codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  listReplaceTabs: /^\t+/,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\] /,
  listReplaceTask: /^\[[ xX]\] +/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: (bull) => new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`),
  nextBulletRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),
  hrRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),
  fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
  headingBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
  htmlBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i")
};
var newline = /^(?:[ \t]*(?:\n|$))+/;
var blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var bullet = /(?:[*+-]|\d{1,9}[.)])/;
var lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var lheading = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var lheadingGfm = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var blockText = /^[^\n]+/;
var _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
var def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
var _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var html = edit(
  "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))",
  "i"
).replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
var blockNormal = {
  blockquote,
  code: blockCode,
  def,
  fences,
  heading,
  hr,
  html,
  lheading,
  list,
  newline,
  paragraph,
  table: noopTest,
  text: blockText
};
var gfmTable = edit(
  "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)"
).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockGfm = {
  ...blockNormal,
  lheading: lheadingGfm,
  table: gfmTable,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
};
var blockPedantic = {
  ...blockNormal,
  html: edit(
    `^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`
  ).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: noopTest,
  // fences not supported
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
};
var escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var br = /^( {2,}|\\)\n(?!\s*$)/;
var inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var _punctuation = /[\p{P}\p{S}]/u;
var _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
var punctuation = edit(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, _punctuationOrSpace).getRegex();
var _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
var _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;
var blockSkip = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
var emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
var emStrongLDelim = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuation).getRegex();
var emStrongLDelimGfm = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimAstCore = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var emStrongRDelimAst = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm).replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm).replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimUnd = edit(
  "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
  "gu"
).replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var anyPunctuation = edit(/\\(punct)/, "gu").replace(/punct/g, _punctuation).getRegex();
var autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
var tag = edit(
  "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>"
).replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
var link = edit(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
var nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
var reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
var inlineNormal = {
  _backpedal: noopTest,
  // only used for GFM url
  anyPunctuation,
  autolink,
  blockSkip,
  br,
  code: inlineCode,
  del: noopTest,
  emStrongLDelim,
  emStrongRDelimAst,
  emStrongRDelimUnd,
  escape,
  link,
  nolink,
  punctuation,
  reflink,
  reflinkSearch,
  tag,
  text: inlineText,
  url: noopTest
};
var inlinePedantic = {
  ...inlineNormal,
  link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
};
var inlineGfm = {
  ...inlineNormal,
  emStrongRDelimAst: emStrongRDelimAstGfm,
  emStrongLDelim: emStrongLDelimGfm,
  url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
  text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
};
var inlineBreaks = {
  ...inlineGfm,
  br: edit(br).replace("{2,}", "*").getRegex(),
  text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
};
var block = {
  normal: blockNormal,
  gfm: blockGfm,
  pedantic: blockPedantic
};
var inline = {
  normal: inlineNormal,
  gfm: inlineGfm,
  breaks: inlineBreaks,
  pedantic: inlinePedantic
};
var escapeReplacements = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
var getEscapeReplacement = (ch) => escapeReplacements[ch];
function escape2(html2, encode) {
  if (encode) {
    if (other.escapeTest.test(html2)) {
      return html2.replace(other.escapeReplace, getEscapeReplacement);
    }
  } else {
    if (other.escapeTestNoEncode.test(html2)) {
      return html2.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
    }
  }
  return html2;
}
function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(other.percentDecode, "%");
  } catch {
    return null;
  }
  return href;
}
function splitCells(tableRow, count) {
  const row = tableRow.replace(other.findPipe, (match, offset, str) => {
    let escaped = false;
    let curr = offset;
    while (--curr >= 0 && str[curr] === "\\") escaped = !escaped;
    if (escaped) {
      return "|";
    } else {
      return " |";
    }
  }), cells = row.split(other.splitPipe);
  let i = 0;
  if (!cells[0].trim()) {
    cells.shift();
  }
  if (cells.length > 0 && !cells.at(-1)?.trim()) {
    cells.pop();
  }
  if (count) {
    if (cells.length > count) {
      cells.splice(count);
    } else {
      while (cells.length < count) cells.push("");
    }
  }
  for (; i < cells.length; i++) {
    cells[i] = cells[i].trim().replace(other.slashPipe, "|");
  }
  return cells;
}
function rtrim(str, c, invert) {
  const l = str.length;
  if (l === 0) {
    return "";
  }
  let suffLen = 0;
  while (suffLen < l) {
    const currChar = str.charAt(l - suffLen - 1);
    if (currChar === c && !invert) {
      suffLen++;
    } else if (currChar !== c && invert) {
      suffLen++;
    } else {
      break;
    }
  }
  return str.slice(0, l - suffLen);
}
function findClosingBracket(str, b) {
  if (str.indexOf(b[1]) === -1) {
    return -1;
  }
  let level = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "\\") {
      i++;
    } else if (str[i] === b[0]) {
      level++;
    } else if (str[i] === b[1]) {
      level--;
      if (level < 0) {
        return i;
      }
    }
  }
  if (level > 0) {
    return -2;
  }
  return -1;
}
function outputLink(cap, link2, raw, lexer2, rules) {
  const href = link2.href;
  const title = link2.title || null;
  const text = cap[1].replace(rules.other.outputLinkReplace, "$1");
  lexer2.state.inLink = true;
  const token = {
    type: cap[0].charAt(0) === "!" ? "image" : "link",
    raw,
    href,
    title,
    text,
    tokens: lexer2.inlineTokens(text)
  };
  lexer2.state.inLink = false;
  return token;
}
function indentCodeCompensation(raw, text, rules) {
  const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);
  if (matchIndentToCode === null) {
    return text;
  }
  const indentToCode = matchIndentToCode[1];
  return text.split("\n").map((node) => {
    const matchIndentInNode = node.match(rules.other.beginningSpace);
    if (matchIndentInNode === null) {
      return node;
    }
    const [indentInNode] = matchIndentInNode;
    if (indentInNode.length >= indentToCode.length) {
      return node.slice(indentToCode.length);
    }
    return node;
  }).join("\n");
}
var _Tokenizer = class {
  options;
  rules;
  // set by the lexer
  lexer;
  // set by the lexer
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(src) {
    const cap = this.rules.block.newline.exec(src);
    if (cap && cap[0].length > 0) {
      return {
        type: "space",
        raw: cap[0]
      };
    }
  }
  code(src) {
    const cap = this.rules.block.code.exec(src);
    if (cap) {
      const text = cap[0].replace(this.rules.other.codeRemoveIndent, "");
      return {
        type: "code",
        raw: cap[0],
        codeBlockStyle: "indented",
        text: !this.options.pedantic ? rtrim(text, "\n") : text
      };
    }
  }
  fences(src) {
    const cap = this.rules.block.fences.exec(src);
    if (cap) {
      const raw = cap[0];
      const text = indentCodeCompensation(raw, cap[3] || "", this.rules);
      return {
        type: "code",
        raw,
        lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
        text
      };
    }
  }
  heading(src) {
    const cap = this.rules.block.heading.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (this.rules.other.endingHash.test(text)) {
        const trimmed = rtrim(text, "#");
        if (this.options.pedantic) {
          text = trimmed.trim();
        } else if (!trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
          text = trimmed.trim();
        }
      }
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[1].length,
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  hr(src) {
    const cap = this.rules.block.hr.exec(src);
    if (cap) {
      return {
        type: "hr",
        raw: rtrim(cap[0], "\n")
      };
    }
  }
  blockquote(src) {
    const cap = this.rules.block.blockquote.exec(src);
    if (cap) {
      let lines = rtrim(cap[0], "\n").split("\n");
      let raw = "";
      let text = "";
      const tokens = [];
      while (lines.length > 0) {
        let inBlockquote = false;
        const currentLines = [];
        let i;
        for (i = 0; i < lines.length; i++) {
          if (this.rules.other.blockquoteStart.test(lines[i])) {
            currentLines.push(lines[i]);
            inBlockquote = true;
          } else if (!inBlockquote) {
            currentLines.push(lines[i]);
          } else {
            break;
          }
        }
        lines = lines.slice(i);
        const currentRaw = currentLines.join("\n");
        const currentText = currentRaw.replace(this.rules.other.blockquoteSetextReplace, "\n    $1").replace(this.rules.other.blockquoteSetextReplace2, "");
        raw = raw ? `${raw}
${currentRaw}` : currentRaw;
        text = text ? `${text}
${currentText}` : currentText;
        const top = this.lexer.state.top;
        this.lexer.state.top = true;
        this.lexer.blockTokens(currentText, tokens, true);
        this.lexer.state.top = top;
        if (lines.length === 0) {
          break;
        }
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "code") {
          break;
        } else if (lastToken?.type === "blockquote") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.blockquote(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - oldToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.text.length) + newToken.text;
          break;
        } else if (lastToken?.type === "list") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.list(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.raw.length) + newToken.raw;
          lines = newText.substring(tokens.at(-1).raw.length).split("\n");
          continue;
        }
      }
      return {
        type: "blockquote",
        raw,
        tokens,
        text
      };
    }
  }
  list(src) {
    let cap = this.rules.block.list.exec(src);
    if (cap) {
      let bull = cap[1].trim();
      const isordered = bull.length > 1;
      const list2 = {
        type: "list",
        raw: "",
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : "",
        loose: false,
        items: []
      };
      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
      if (this.options.pedantic) {
        bull = isordered ? bull : "[*+-]";
      }
      const itemRegex = this.rules.other.listItemRegex(bull);
      let endsWithBlankLine = false;
      while (src) {
        let endEarly = false;
        let raw = "";
        let itemContents = "";
        if (!(cap = itemRegex.exec(src))) {
          break;
        }
        if (this.rules.block.hr.test(src)) {
          break;
        }
        raw = cap[0];
        src = src.substring(raw.length);
        let line = cap[2].split("\n", 1)[0].replace(this.rules.other.listReplaceTabs, (t) => " ".repeat(3 * t.length));
        let nextLine = src.split("\n", 1)[0];
        let blankLine = !line.trim();
        let indent = 0;
        if (this.options.pedantic) {
          indent = 2;
          itemContents = line.trimStart();
        } else if (blankLine) {
          indent = cap[1].length + 1;
        } else {
          indent = cap[2].search(this.rules.other.nonSpaceChar);
          indent = indent > 4 ? 1 : indent;
          itemContents = line.slice(indent);
          indent += cap[1].length;
        }
        if (blankLine && this.rules.other.blankLine.test(nextLine)) {
          raw += nextLine + "\n";
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }
        if (!endEarly) {
          const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
          const hrRegex = this.rules.other.hrRegex(indent);
          const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
          const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
          const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
          while (src) {
            const rawLine = src.split("\n", 1)[0];
            let nextLineWithoutTabs;
            nextLine = rawLine;
            if (this.options.pedantic) {
              nextLine = nextLine.replace(this.rules.other.listReplaceNesting, "  ");
              nextLineWithoutTabs = nextLine;
            } else {
              nextLineWithoutTabs = nextLine.replace(this.rules.other.tabCharGlobal, "    ");
            }
            if (fencesBeginRegex.test(nextLine)) {
              break;
            }
            if (headingBeginRegex.test(nextLine)) {
              break;
            }
            if (htmlBeginRegex.test(nextLine)) {
              break;
            }
            if (nextBulletRegex.test(nextLine)) {
              break;
            }
            if (hrRegex.test(nextLine)) {
              break;
            }
            if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
              itemContents += "\n" + nextLineWithoutTabs.slice(indent);
            } else {
              if (blankLine) {
                break;
              }
              if (line.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4) {
                break;
              }
              if (fencesBeginRegex.test(line)) {
                break;
              }
              if (headingBeginRegex.test(line)) {
                break;
              }
              if (hrRegex.test(line)) {
                break;
              }
              itemContents += "\n" + nextLine;
            }
            if (!blankLine && !nextLine.trim()) {
              blankLine = true;
            }
            raw += rawLine + "\n";
            src = src.substring(rawLine.length + 1);
            line = nextLineWithoutTabs.slice(indent);
          }
        }
        if (!list2.loose) {
          if (endsWithBlankLine) {
            list2.loose = true;
          } else if (this.rules.other.doubleBlankLine.test(raw)) {
            endsWithBlankLine = true;
          }
        }
        let istask = null;
        let ischecked;
        if (this.options.gfm) {
          istask = this.rules.other.listIsTask.exec(itemContents);
          if (istask) {
            ischecked = istask[0] !== "[ ] ";
            itemContents = itemContents.replace(this.rules.other.listReplaceTask, "");
          }
        }
        list2.items.push({
          type: "list_item",
          raw,
          task: !!istask,
          checked: ischecked,
          loose: false,
          text: itemContents,
          tokens: []
        });
        list2.raw += raw;
      }
      const lastItem = list2.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else {
        return;
      }
      list2.raw = list2.raw.trimEnd();
      for (let i = 0; i < list2.items.length; i++) {
        this.lexer.state.top = false;
        list2.items[i].tokens = this.lexer.blockTokens(list2.items[i].text, []);
        if (!list2.loose) {
          const spacers = list2.items[i].tokens.filter((t) => t.type === "space");
          const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t) => this.rules.other.anyLine.test(t.raw));
          list2.loose = hasMultipleLineBreaks;
        }
      }
      if (list2.loose) {
        for (let i = 0; i < list2.items.length; i++) {
          list2.items[i].loose = true;
        }
      }
      return list2;
    }
  }
  html(src) {
    const cap = this.rules.block.html.exec(src);
    if (cap) {
      const token = {
        type: "html",
        block: true,
        raw: cap[0],
        pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
        text: cap[0]
      };
      return token;
    }
  }
  def(src) {
    const cap = this.rules.block.def.exec(src);
    if (cap) {
      const tag2 = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " ");
      const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
      return {
        type: "def",
        tag: tag2,
        raw: cap[0],
        href,
        title
      };
    }
  }
  table(src) {
    const cap = this.rules.block.table.exec(src);
    if (!cap) {
      return;
    }
    if (!this.rules.other.tableDelimiter.test(cap[2])) {
      return;
    }
    const headers = splitCells(cap[1]);
    const aligns = cap[2].replace(this.rules.other.tableAlignChars, "").split("|");
    const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, "").split("\n") : [];
    const item = {
      type: "table",
      raw: cap[0],
      header: [],
      align: [],
      rows: []
    };
    if (headers.length !== aligns.length) {
      return;
    }
    for (const align of aligns) {
      if (this.rules.other.tableAlignRight.test(align)) {
        item.align.push("right");
      } else if (this.rules.other.tableAlignCenter.test(align)) {
        item.align.push("center");
      } else if (this.rules.other.tableAlignLeft.test(align)) {
        item.align.push("left");
      } else {
        item.align.push(null);
      }
    }
    for (let i = 0; i < headers.length; i++) {
      item.header.push({
        text: headers[i],
        tokens: this.lexer.inline(headers[i]),
        header: true,
        align: item.align[i]
      });
    }
    for (const row of rows) {
      item.rows.push(splitCells(row, item.header.length).map((cell, i) => {
        return {
          text: cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align: item.align[i]
        };
      }));
    }
    return item;
  }
  lheading(src) {
    const cap = this.rules.block.lheading.exec(src);
    if (cap) {
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[2].charAt(0) === "=" ? 1 : 2,
        text: cap[1],
        tokens: this.lexer.inline(cap[1])
      };
    }
  }
  paragraph(src) {
    const cap = this.rules.block.paragraph.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
      return {
        type: "paragraph",
        raw: cap[0],
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  text(src) {
    const cap = this.rules.block.text.exec(src);
    if (cap) {
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        tokens: this.lexer.inline(cap[0])
      };
    }
  }
  escape(src) {
    const cap = this.rules.inline.escape.exec(src);
    if (cap) {
      return {
        type: "escape",
        raw: cap[0],
        text: cap[1]
      };
    }
  }
  tag(src) {
    const cap = this.rules.inline.tag.exec(src);
    if (cap) {
      if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
        this.lexer.state.inLink = true;
      } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
        this.lexer.state.inLink = false;
      }
      if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = true;
      } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = false;
      }
      return {
        type: "html",
        raw: cap[0],
        inLink: this.lexer.state.inLink,
        inRawBlock: this.lexer.state.inRawBlock,
        block: false,
        text: cap[0]
      };
    }
  }
  link(src) {
    const cap = this.rules.inline.link.exec(src);
    if (cap) {
      const trimmedUrl = cap[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
        if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
          return;
        }
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return;
        }
      } else {
        const lastParenIndex = findClosingBracket(cap[2], "()");
        if (lastParenIndex === -2) {
          return;
        }
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf("!") === 0 ? 5 : 4;
          const linkLen = start + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = "";
        }
      }
      let href = cap[2];
      let title = "";
      if (this.options.pedantic) {
        const link2 = this.rules.other.pedanticHrefTitle.exec(href);
        if (link2) {
          href = link2[1];
          title = link2[3];
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : "";
      }
      href = href.trim();
      if (this.rules.other.startAngleBracket.test(href)) {
        if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
          href = href.slice(1);
        } else {
          href = href.slice(1, -1);
        }
      }
      return outputLink(cap, {
        href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
        title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
      }, cap[0], this.lexer, this.rules);
    }
  }
  reflink(src, links) {
    let cap;
    if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
      const linkString = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, " ");
      const link2 = links[linkString.toLowerCase()];
      if (!link2) {
        const text = cap[0].charAt(0);
        return {
          type: "text",
          raw: text,
          text
        };
      }
      return outputLink(cap, link2, cap[0], this.lexer, this.rules);
    }
  }
  emStrong(src, maskedSrc, prevChar = "") {
    let match = this.rules.inline.emStrongLDelim.exec(src);
    if (!match) return;
    if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
    const nextChar = match[1] || match[2] || "";
    if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      const lLength = [...match[0]].length - 1;
      let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
      const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      endReg.lastIndex = 0;
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      while ((match = endReg.exec(maskedSrc)) != null) {
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue;
        rLength = [...rDelim].length;
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6]) {
          if (lLength % 3 && !((lLength + rLength) % 3)) {
            midDelimTotal += rLength;
            continue;
          }
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue;
        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
        if (Math.min(lLength, rLength) % 2) {
          const text2 = raw.slice(1, -1);
          return {
            type: "em",
            raw,
            text: text2,
            tokens: this.lexer.inlineTokens(text2)
          };
        }
        const text = raw.slice(2, -2);
        return {
          type: "strong",
          raw,
          text,
          tokens: this.lexer.inlineTokens(text)
        };
      }
    }
  }
  codespan(src) {
    const cap = this.rules.inline.code.exec(src);
    if (cap) {
      let text = cap[2].replace(this.rules.other.newLineCharGlobal, " ");
      const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
      const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text = text.substring(1, text.length - 1);
      }
      return {
        type: "codespan",
        raw: cap[0],
        text
      };
    }
  }
  br(src) {
    const cap = this.rules.inline.br.exec(src);
    if (cap) {
      return {
        type: "br",
        raw: cap[0]
      };
    }
  }
  del(src) {
    const cap = this.rules.inline.del.exec(src);
    if (cap) {
      return {
        type: "del",
        raw: cap[0],
        text: cap[2],
        tokens: this.lexer.inlineTokens(cap[2])
      };
    }
  }
  autolink(src) {
    const cap = this.rules.inline.autolink.exec(src);
    if (cap) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[1];
        href = "mailto:" + text;
      } else {
        text = cap[1];
        href = text;
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  url(src) {
    let cap;
    if (cap = this.rules.inline.url.exec(src)) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[0];
        href = "mailto:" + text;
      } else {
        let prevCapZero;
        do {
          prevCapZero = cap[0];
          cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
        } while (prevCapZero !== cap[0]);
        text = cap[0];
        if (cap[1] === "www.") {
          href = "http://" + cap[0];
        } else {
          href = cap[0];
        }
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  inlineText(src) {
    const cap = this.rules.inline.text.exec(src);
    if (cap) {
      const escaped = this.lexer.state.inRawBlock;
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        escaped
      };
    }
  }
};
var _Lexer = class __Lexer {
  tokens;
  options;
  state;
  tokenizer;
  inlineQueue;
  constructor(options2) {
    this.tokens = [];
    this.tokens.links = /* @__PURE__ */ Object.create(null);
    this.options = options2 || _defaults;
    this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
    this.tokenizer = this.options.tokenizer;
    this.tokenizer.options = this.options;
    this.tokenizer.lexer = this;
    this.inlineQueue = [];
    this.state = {
      inLink: false,
      inRawBlock: false,
      top: true
    };
    const rules = {
      other,
      block: block.normal,
      inline: inline.normal
    };
    if (this.options.pedantic) {
      rules.block = block.pedantic;
      rules.inline = inline.pedantic;
    } else if (this.options.gfm) {
      rules.block = block.gfm;
      if (this.options.breaks) {
        rules.inline = inline.breaks;
      } else {
        rules.inline = inline.gfm;
      }
    }
    this.tokenizer.rules = rules;
  }
  /**
   * Expose Rules
   */
  static get rules() {
    return {
      block,
      inline
    };
  }
  /**
   * Static Lex Method
   */
  static lex(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.lex(src);
  }
  /**
   * Static Lex Inline Method
   */
  static lexInline(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.inlineTokens(src);
  }
  /**
   * Preprocessing
   */
  lex(src) {
    src = src.replace(other.carriageReturn, "\n");
    this.blockTokens(src, this.tokens);
    for (let i = 0; i < this.inlineQueue.length; i++) {
      const next = this.inlineQueue[i];
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }
  blockTokens(src, tokens = [], lastParagraphClipped = false) {
    if (this.options.pedantic) {
      src = src.replace(other.tabCharGlobal, "    ").replace(other.spaceLine, "");
    }
    while (src) {
      let token;
      if (this.options.extensions?.block?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.space(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.raw.length === 1 && lastToken !== void 0) {
          lastToken.raw += "\n";
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.code(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.fences(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.heading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.hr(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.blockquote(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.list(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.html(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.def(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.raw;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else if (!this.tokens.links[token.tag]) {
          this.tokens.links[token.tag] = {
            href: token.href,
            title: token.title
          };
        }
        continue;
      }
      if (token = this.tokenizer.table(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.lheading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startBlock) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startBlock.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
        const lastToken = tokens.at(-1);
        if (lastParagraphClipped && lastToken?.type === "paragraph") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        lastParagraphClipped = cutSrc.length !== src.length;
        src = src.substring(token.raw.length);
        continue;
      }
      if (token = this.tokenizer.text(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    this.state.top = true;
    return tokens;
  }
  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }
  /**
   * Lexing/Compiling
   */
  inlineTokens(src, tokens = []) {
    let maskedSrc = src;
    let match = null;
    if (this.tokens.links) {
      const links = Object.keys(this.tokens.links);
      if (links.length > 0) {
        while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
          if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
            maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
          }
        }
      }
    }
    while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    }
    while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    }
    let keepPrevChar = false;
    let prevChar = "";
    while (src) {
      if (!keepPrevChar) {
        prevChar = "";
      }
      keepPrevChar = false;
      let token;
      if (this.options.extensions?.inline?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.escape(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.tag(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.link(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.reflink(src, this.tokens.links)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.type === "text" && lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.codespan(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.br(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.del(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.autolink(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (!this.state.inLink && (token = this.tokenizer.url(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startInline) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startInline.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (token = this.tokenizer.inlineText(cutSrc)) {
        src = src.substring(token.raw.length);
        if (token.raw.slice(-1) !== "_") {
          prevChar = token.raw.slice(-1);
        }
        keepPrevChar = true;
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    return tokens;
  }
};
var _Renderer = class {
  options;
  parser;
  // set by the parser
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(token) {
    return "";
  }
  code({ text, lang, escaped }) {
    const langString = (lang || "").match(other.notSpaceStart)?.[0];
    const code = text.replace(other.endingNewline, "") + "\n";
    if (!langString) {
      return "<pre><code>" + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
    }
    return '<pre><code class="language-' + escape2(langString) + '">' + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
  }
  blockquote({ tokens }) {
    const body = this.parser.parse(tokens);
    return `<blockquote>
${body}</blockquote>
`;
  }
  html({ text }) {
    return text;
  }
  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
  }
  hr(token) {
    return "<hr>\n";
  }
  list(token) {
    const ordered = token.ordered;
    const start = token.start;
    let body = "";
    for (let j = 0; j < token.items.length; j++) {
      const item = token.items[j];
      body += this.listitem(item);
    }
    const type = ordered ? "ol" : "ul";
    const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : "";
    return "<" + type + startAttr + ">\n" + body + "</" + type + ">\n";
  }
  listitem(item) {
    let itemBody = "";
    if (item.task) {
      const checkbox = this.checkbox({ checked: !!item.checked });
      if (item.loose) {
        if (item.tokens[0]?.type === "paragraph") {
          item.tokens[0].text = checkbox + " " + item.tokens[0].text;
          if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
            item.tokens[0].tokens[0].text = checkbox + " " + escape2(item.tokens[0].tokens[0].text);
            item.tokens[0].tokens[0].escaped = true;
          }
        } else {
          item.tokens.unshift({
            type: "text",
            raw: checkbox + " ",
            text: checkbox + " ",
            escaped: true
          });
        }
      } else {
        itemBody += checkbox + " ";
      }
    }
    itemBody += this.parser.parse(item.tokens, !!item.loose);
    return `<li>${itemBody}</li>
`;
  }
  checkbox({ checked }) {
    return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
  }
  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>
`;
  }
  table(token) {
    let header = "";
    let cell = "";
    for (let j = 0; j < token.header.length; j++) {
      cell += this.tablecell(token.header[j]);
    }
    header += this.tablerow({ text: cell });
    let body = "";
    for (let j = 0; j < token.rows.length; j++) {
      const row = token.rows[j];
      cell = "";
      for (let k = 0; k < row.length; k++) {
        cell += this.tablecell(row[k]);
      }
      body += this.tablerow({ text: cell });
    }
    if (body) body = `<tbody>${body}</tbody>`;
    return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
  }
  tablerow({ text }) {
    return `<tr>
${text}</tr>
`;
  }
  tablecell(token) {
    const content = this.parser.parseInline(token.tokens);
    const type = token.header ? "th" : "td";
    const tag2 = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
    return tag2 + content + `</${type}>
`;
  }
  /**
   * span level renderer
   */
  strong({ tokens }) {
    return `<strong>${this.parser.parseInline(tokens)}</strong>`;
  }
  em({ tokens }) {
    return `<em>${this.parser.parseInline(tokens)}</em>`;
  }
  codespan({ text }) {
    return `<code>${escape2(text, true)}</code>`;
  }
  br(token) {
    return "<br>";
  }
  del({ tokens }) {
    return `<del>${this.parser.parseInline(tokens)}</del>`;
  }
  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return text;
    }
    href = cleanHref;
    let out = '<a href="' + href + '"';
    if (title) {
      out += ' title="' + escape2(title) + '"';
    }
    out += ">" + text + "</a>";
    return out;
  }
  image({ href, title, text, tokens }) {
    if (tokens) {
      text = this.parser.parseInline(tokens, this.parser.textRenderer);
    }
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return escape2(text);
    }
    href = cleanHref;
    let out = `<img src="${href}" alt="${text}"`;
    if (title) {
      out += ` title="${escape2(title)}"`;
    }
    out += ">";
    return out;
  }
  text(token) {
    return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : "escaped" in token && token.escaped ? token.text : escape2(token.text);
  }
};
var _TextRenderer = class {
  // no need for block level renderers
  strong({ text }) {
    return text;
  }
  em({ text }) {
    return text;
  }
  codespan({ text }) {
    return text;
  }
  del({ text }) {
    return text;
  }
  html({ text }) {
    return text;
  }
  text({ text }) {
    return text;
  }
  link({ text }) {
    return "" + text;
  }
  image({ text }) {
    return "" + text;
  }
  br() {
    return "";
  }
};
var _Parser = class __Parser {
  options;
  renderer;
  textRenderer;
  constructor(options2) {
    this.options = options2 || _defaults;
    this.options.renderer = this.options.renderer || new _Renderer();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
    this.renderer.parser = this;
    this.textRenderer = new _TextRenderer();
  }
  /**
   * Static Parse Method
   */
  static parse(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parse(tokens);
  }
  /**
   * Static Parse Inline Method
   */
  static parseInline(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parseInline(tokens);
  }
  /**
   * Parse Loop
   */
  parse(tokens, top = true) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const genericToken = anyToken;
        const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
        if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "space": {
          out += this.renderer.space(token);
          continue;
        }
        case "hr": {
          out += this.renderer.hr(token);
          continue;
        }
        case "heading": {
          out += this.renderer.heading(token);
          continue;
        }
        case "code": {
          out += this.renderer.code(token);
          continue;
        }
        case "table": {
          out += this.renderer.table(token);
          continue;
        }
        case "blockquote": {
          out += this.renderer.blockquote(token);
          continue;
        }
        case "list": {
          out += this.renderer.list(token);
          continue;
        }
        case "html": {
          out += this.renderer.html(token);
          continue;
        }
        case "paragraph": {
          out += this.renderer.paragraph(token);
          continue;
        }
        case "text": {
          let textToken = token;
          let body = this.renderer.text(textToken);
          while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
            textToken = tokens[++i];
            body += "\n" + this.renderer.text(textToken);
          }
          if (top) {
            out += this.renderer.paragraph({
              type: "paragraph",
              raw: body,
              text: body,
              tokens: [{ type: "text", raw: body, text: body, escaped: true }]
            });
          } else {
            out += body;
          }
          continue;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
  /**
   * Parse Inline Tokens
   */
  parseInline(tokens, renderer = this.renderer) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
        if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(anyToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "escape": {
          out += renderer.text(token);
          break;
        }
        case "html": {
          out += renderer.html(token);
          break;
        }
        case "link": {
          out += renderer.link(token);
          break;
        }
        case "image": {
          out += renderer.image(token);
          break;
        }
        case "strong": {
          out += renderer.strong(token);
          break;
        }
        case "em": {
          out += renderer.em(token);
          break;
        }
        case "codespan": {
          out += renderer.codespan(token);
          break;
        }
        case "br": {
          out += renderer.br(token);
          break;
        }
        case "del": {
          out += renderer.del(token);
          break;
        }
        case "text": {
          out += renderer.text(token);
          break;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
};
var _Hooks = class {
  options;
  block;
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  static passThroughHooks = /* @__PURE__ */ new Set([
    "preprocess",
    "postprocess",
    "processAllTokens"
  ]);
  /**
   * Process markdown before marked
   */
  preprocess(markdown) {
    return markdown;
  }
  /**
   * Process HTML after marked is finished
   */
  postprocess(html2) {
    return html2;
  }
  /**
   * Process all tokens before walk tokens
   */
  processAllTokens(tokens) {
    return tokens;
  }
  /**
   * Provide function to tokenize markdown
   */
  provideLexer() {
    return this.block ? _Lexer.lex : _Lexer.lexInline;
  }
  /**
   * Provide function to parse tokens
   */
  provideParser() {
    return this.block ? _Parser.parse : _Parser.parseInline;
  }
};
var Marked = class {
  defaults = _getDefaults();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = _Parser;
  Renderer = _Renderer;
  TextRenderer = _TextRenderer;
  Lexer = _Lexer;
  Tokenizer = _Tokenizer;
  Hooks = _Hooks;
  constructor(...args) {
    this.use(...args);
  }
  /**
   * Run callback for every token
   */
  walkTokens(tokens, callback) {
    let values = [];
    for (const token of tokens) {
      values = values.concat(callback.call(this, token));
      switch (token.type) {
        case "table": {
          const tableToken = token;
          for (const cell of tableToken.header) {
            values = values.concat(this.walkTokens(cell.tokens, callback));
          }
          for (const row of tableToken.rows) {
            for (const cell of row) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
          }
          break;
        }
        case "list": {
          const listToken = token;
          values = values.concat(this.walkTokens(listToken.items, callback));
          break;
        }
        default: {
          const genericToken = token;
          if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
            this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
              const tokens2 = genericToken[childTokens].flat(Infinity);
              values = values.concat(this.walkTokens(tokens2, callback));
            });
          } else if (genericToken.tokens) {
            values = values.concat(this.walkTokens(genericToken.tokens, callback));
          }
        }
      }
    }
    return values;
  }
  use(...args) {
    const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
    args.forEach((pack) => {
      const opts = { ...pack };
      opts.async = this.defaults.async || opts.async || false;
      if (pack.extensions) {
        pack.extensions.forEach((ext) => {
          if (!ext.name) {
            throw new Error("extension name required");
          }
          if ("renderer" in ext) {
            const prevRenderer = extensions.renderers[ext.name];
            if (prevRenderer) {
              extensions.renderers[ext.name] = function(...args2) {
                let ret = ext.renderer.apply(this, args2);
                if (ret === false) {
                  ret = prevRenderer.apply(this, args2);
                }
                return ret;
              };
            } else {
              extensions.renderers[ext.name] = ext.renderer;
            }
          }
          if ("tokenizer" in ext) {
            if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
              throw new Error("extension level must be 'block' or 'inline'");
            }
            const extLevel = extensions[ext.level];
            if (extLevel) {
              extLevel.unshift(ext.tokenizer);
            } else {
              extensions[ext.level] = [ext.tokenizer];
            }
            if (ext.start) {
              if (ext.level === "block") {
                if (extensions.startBlock) {
                  extensions.startBlock.push(ext.start);
                } else {
                  extensions.startBlock = [ext.start];
                }
              } else if (ext.level === "inline") {
                if (extensions.startInline) {
                  extensions.startInline.push(ext.start);
                } else {
                  extensions.startInline = [ext.start];
                }
              }
            }
          }
          if ("childTokens" in ext && ext.childTokens) {
            extensions.childTokens[ext.name] = ext.childTokens;
          }
        });
        opts.extensions = extensions;
      }
      if (pack.renderer) {
        const renderer = this.defaults.renderer || new _Renderer(this.defaults);
        for (const prop in pack.renderer) {
          if (!(prop in renderer)) {
            throw new Error(`renderer '${prop}' does not exist`);
          }
          if (["options", "parser"].includes(prop)) {
            continue;
          }
          const rendererProp = prop;
          const rendererFunc = pack.renderer[rendererProp];
          const prevRenderer = renderer[rendererProp];
          renderer[rendererProp] = (...args2) => {
            let ret = rendererFunc.apply(renderer, args2);
            if (ret === false) {
              ret = prevRenderer.apply(renderer, args2);
            }
            return ret || "";
          };
        }
        opts.renderer = renderer;
      }
      if (pack.tokenizer) {
        const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
        for (const prop in pack.tokenizer) {
          if (!(prop in tokenizer)) {
            throw new Error(`tokenizer '${prop}' does not exist`);
          }
          if (["options", "rules", "lexer"].includes(prop)) {
            continue;
          }
          const tokenizerProp = prop;
          const tokenizerFunc = pack.tokenizer[tokenizerProp];
          const prevTokenizer = tokenizer[tokenizerProp];
          tokenizer[tokenizerProp] = (...args2) => {
            let ret = tokenizerFunc.apply(tokenizer, args2);
            if (ret === false) {
              ret = prevTokenizer.apply(tokenizer, args2);
            }
            return ret;
          };
        }
        opts.tokenizer = tokenizer;
      }
      if (pack.hooks) {
        const hooks = this.defaults.hooks || new _Hooks();
        for (const prop in pack.hooks) {
          if (!(prop in hooks)) {
            throw new Error(`hook '${prop}' does not exist`);
          }
          if (["options", "block"].includes(prop)) {
            continue;
          }
          const hooksProp = prop;
          const hooksFunc = pack.hooks[hooksProp];
          const prevHook = hooks[hooksProp];
          if (_Hooks.passThroughHooks.has(prop)) {
            hooks[hooksProp] = (arg) => {
              if (this.defaults.async) {
                return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret2) => {
                  return prevHook.call(hooks, ret2);
                });
              }
              const ret = hooksFunc.call(hooks, arg);
              return prevHook.call(hooks, ret);
            };
          } else {
            hooks[hooksProp] = (...args2) => {
              let ret = hooksFunc.apply(hooks, args2);
              if (ret === false) {
                ret = prevHook.apply(hooks, args2);
              }
              return ret;
            };
          }
        }
        opts.hooks = hooks;
      }
      if (pack.walkTokens) {
        const walkTokens2 = this.defaults.walkTokens;
        const packWalktokens = pack.walkTokens;
        opts.walkTokens = function(token) {
          let values = [];
          values.push(packWalktokens.call(this, token));
          if (walkTokens2) {
            values = values.concat(walkTokens2.call(this, token));
          }
          return values;
        };
      }
      this.defaults = { ...this.defaults, ...opts };
    });
    return this;
  }
  setOptions(opt) {
    this.defaults = { ...this.defaults, ...opt };
    return this;
  }
  lexer(src, options2) {
    return _Lexer.lex(src, options2 ?? this.defaults);
  }
  parser(tokens, options2) {
    return _Parser.parse(tokens, options2 ?? this.defaults);
  }
  parseMarkdown(blockType) {
    const parse2 = (src, options2) => {
      const origOpt = { ...options2 };
      const opt = { ...this.defaults, ...origOpt };
      const throwError = this.onError(!!opt.silent, !!opt.async);
      if (this.defaults.async === true && origOpt.async === false) {
        return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      }
      if (typeof src === "undefined" || src === null) {
        return throwError(new Error("marked(): input parameter is undefined or null"));
      }
      if (typeof src !== "string") {
        return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
      }
      if (opt.hooks) {
        opt.hooks.options = opt;
        opt.hooks.block = blockType;
      }
      const lexer2 = opt.hooks ? opt.hooks.provideLexer() : blockType ? _Lexer.lex : _Lexer.lexInline;
      const parser2 = opt.hooks ? opt.hooks.provideParser() : blockType ? _Parser.parse : _Parser.parseInline;
      if (opt.async) {
        return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html2) => opt.hooks ? opt.hooks.postprocess(html2) : html2).catch(throwError);
      }
      try {
        if (opt.hooks) {
          src = opt.hooks.preprocess(src);
        }
        let tokens = lexer2(src, opt);
        if (opt.hooks) {
          tokens = opt.hooks.processAllTokens(tokens);
        }
        if (opt.walkTokens) {
          this.walkTokens(tokens, opt.walkTokens);
        }
        let html2 = parser2(tokens, opt);
        if (opt.hooks) {
          html2 = opt.hooks.postprocess(html2);
        }
        return html2;
      } catch (e) {
        return throwError(e);
      }
    };
    return parse2;
  }
  onError(silent, async) {
    return (e) => {
      e.message += "\nPlease report this to https://github.com/markedjs/marked.";
      if (silent) {
        const msg = "<p>An error occurred:</p><pre>" + escape2(e.message + "", true) + "</pre>";
        if (async) {
          return Promise.resolve(msg);
        }
        return msg;
      }
      if (async) {
        return Promise.reject(e);
      }
      throw e;
    };
  }
};
var markedInstance = new Marked();
function marked(src, opt) {
  return markedInstance.parse(src, opt);
}
marked.options = marked.setOptions = function(options2) {
  markedInstance.setOptions(options2);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.getDefaults = _getDefaults;
marked.defaults = _defaults;
marked.use = function(...args) {
  markedInstance.use(...args);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.walkTokens = function(tokens, callback) {
  return markedInstance.walkTokens(tokens, callback);
};
marked.parseInline = markedInstance.parseInline;
marked.Parser = _Parser;
marked.parser = _Parser.parse;
marked.Renderer = _Renderer;
marked.TextRenderer = _TextRenderer;
marked.Lexer = _Lexer;
marked.lexer = _Lexer.lex;
marked.Tokenizer = _Tokenizer;
marked.Hooks = _Hooks;
marked.parse = marked;
var options = marked.options;
var setOptions = marked.setOptions;
var use = marked.use;
var walkTokens = marked.walkTokens;
var parseInline = marked.parseInline;
var parser = _Parser.parse;
var lexer = _Lexer.lex;

// src/client/editor/markdown.ts
marked.use({
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    }
  }
});
function renderMarkdown(text) {
  try {
    const html2 = marked.parse(text, { gfm: true, breaks: true });
    return typeof html2 === "string" ? html2 : String(html2);
  } catch {
    return `<pre>${escapeHtml(text)}</pre>`;
  }
}
function isMarkdownPath(path) {
  const dot = path.lastIndexOf(".");
  if (dot <= 0) return false;
  const ext = path.slice(dot + 1).toLowerCase();
  return ext === "md" || ext === "markdown";
}
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// src/client/editor/EditorPane.tsx
var import_react13 = require("react");
var import_jsx_runtime9 = require("react/jsx-runtime");
function languageOf(path) {
  const dot = path.lastIndexOf(".");
  if (dot <= 0) return "plaintext";
  const ext = path.slice(dot + 1).toLowerCase();
  const map = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    jsx: "javascript",
    ts: "typescript",
    mts: "typescript",
    cts: "typescript",
    tsx: "typescript",
    json: "json",
    jsonc: "json",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
    markdown: "markdown",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    cxx: "cpp",
    cc: "cpp",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    yml: "yaml",
    yaml: "yaml",
    xml: "xml",
    svg: "xml",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    dockerfile: "dockerfile",
    toml: "toml",
    ini: "ini",
    lua: "lua",
    r: "r",
    dart: "dart",
    vue: "html",
    svelte: "html"
  };
  return map[ext] ?? "plaintext";
}
function EditorPane({ path, content, onChange, theme, t }) {
  const containerRef = (0, import_react13.useRef)(null);
  const editorRef = (0, import_react13.useRef)(null);
  const monacoRef = (0, import_react13.useRef)(null);
  const ignoreChange = (0, import_react13.useRef)(false);
  (0, import_react13.useEffect)(() => {
    const container = containerRef.current;
    if (!container) return;
    const monaco = window.monaco;
    if (!monaco) return;
    monacoRef.current = monaco;
    const model = monaco.editor.createModel(content, languageOf(path));
    const editor = monaco.editor.create(container, {
      model,
      theme: "vs",
      fontSize: theme.fontSize,
      fontFamily: 'ui-monospace, "Cascadia Code", "Cascadia Mono", Consolas, Menlo, monospace',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      automaticLayout: true,
      padding: { top: 8, bottom: 8 },
      lineNumbers: "on",
      glyphMargin: false,
      folding: true,
      lineDecorationsWidth: 8,
      renderLineHighlight: "line",
      scrollbar: {
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8
      }
    });
    editorRef.current = editor;
    const chrome = themeChrome(theme);
    monaco.editor.defineTheme("dsh-editor", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": theme.background,
        "editor.foreground": theme.foreground,
        "editor.lineHighlightBackground": chrome.chrome,
        "editorLineNumber.foreground": chrome.muted,
        "editorCursor.foreground": theme.foreground,
        "editor.selectionBackground": chrome.chip,
        "editor.inactiveSelectionBackground": chrome.chip
      }
    });
    monaco.editor.setTheme("dsh-editor");
    editor.onDidChangeModelContent(() => {
      if (ignoreChange.current) return;
      onChange(editor.getValue());
    });
    return () => {
      editor.dispose();
      model.dispose();
      editorRef.current = null;
    };
  }, [path]);
  (0, import_react13.useEffect)(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    const chrome = themeChrome(theme);
    monaco.editor.defineTheme("dsh-editor", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": theme.background,
        "editor.foreground": theme.foreground,
        "editor.lineHighlightBackground": chrome.chrome,
        "editorLineNumber.foreground": chrome.muted,
        "editorCursor.foreground": theme.foreground,
        "editor.selectionBackground": chrome.chip,
        "editor.inactiveSelectionBackground": chrome.chip
      }
    });
    monaco.editor.setTheme("dsh-editor");
    const editor = editorRef.current;
    if (editor) {
      editor.updateOptions({ fontSize: theme.fontSize });
    }
  }, [theme]);
  (0, import_react13.useEffect)(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const currentValue = editor.getValue();
    if (currentValue !== content) {
      ignoreChange.current = true;
      editor.setValue(content);
      ignoreChange.current = false;
    }
  }, [content]);
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    "div",
    {
      ref: containerRef,
      style: {
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden"
      }
    }
  );
}

// src/client/editor/MarkdownPreview.tsx
var import_react14 = require("react");
var import_jsx_runtime10 = require("react/jsx-runtime");
function MarkdownPreview({ content, path, remote }) {
  const [html2, setHtml] = (0, import_react14.useState)("");
  (0, import_react14.useEffect)(() => {
    let cancelled = false;
    async function processImages(rawHtml2) {
      const imgRegex = /<img[^>]+src=["']([^"'#][^"'#]*)["']/g;
      const dir = path.split("/").slice(0, -1).join("/");
      let result = rawHtml2;
      let match;
      while ((match = imgRegex.exec(rawHtml2)) !== null) {
        const src = match[1];
        if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) continue;
        try {
          const resolved = src.startsWith("/") ? src : `${dir}/${src}`;
          const dataResult = await remote.readDataUrl(resolved);
          if (cancelled) return rawHtml2;
          if (dataResult.ok && dataResult.value) {
            result = result.replace(match[0], match[0].replace(src, dataResult.value.dataUrl));
          }
        } catch {
        }
      }
      return result;
    }
    const rawHtml = renderMarkdown(content);
    void processImages(rawHtml).then((processed) => {
      if (!cancelled) setHtml(processed);
    });
    return () => {
      cancelled = true;
    };
  }, [content, path, remote]);
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
    "div",
    {
      className: "dshf-markdown-preview",
      style: {
        padding: "16px 24px",
        overflow: "auto",
        height: "100%",
        boxSizing: "border-box",
        fontFamily: 'ui-monospace, "Cascadia Code", "Cascadia Mono", Consolas, Menlo, monospace',
        fontSize: "13px",
        lineHeight: "1.6",
        color: "var(--dsw-alias-label-primary, #1f2328)"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("style", { children: `
        .dshf-markdown-preview h1, .dshf-markdown-preview h2, .dshf-markdown-preview h3,
        .dshf-markdown-preview h4, .dshf-markdown-preview h5, .dshf-markdown-preview h6 {
          margin-top: 1.2em;
          margin-bottom: 0.6em;
          font-weight: 600;
          line-height: 1.3;
        }
        .dshf-markdown-preview h1 { font-size: 1.5em; border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.08)); padding-bottom: 0.3em; }
        .dshf-markdown-preview h2 { font-size: 1.3em; border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.08)); padding-bottom: 0.3em; }
        .dshf-markdown-preview h3 { font-size: 1.1em; }
        .dshf-markdown-preview p { margin: 0.8em 0; }
        .dshf-markdown-preview code {
          background: var(--dsw-alias-bg-layer-3, rgba(0,0,0,0.04));
          padding: 0.15em 0.35em;
          border-radius: 4px;
          font-size: 0.9em;
        }
        .dshf-markdown-preview pre {
          background: var(--dsw-alias-bg-layer-3, rgba(0,0,0,0.04));
          padding: 12px 16px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 0.8em 0;
        }
        .dshf-markdown-preview pre code { background: none; padding: 0; }
        .dshf-markdown-preview blockquote {
          border-left: 3px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.15));
          margin: 0.8em 0;
          padding: 0.5em 0 0.5em 1em;
          color: var(--dsw-alias-label-secondary, #495057);
        }
        .dshf-markdown-preview table { border-collapse: collapse; margin: 0.8em 0; width: 100%; }
        .dshf-markdown-preview th, .dshf-markdown-preview td {
          border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.15));
          padding: 6px 10px;
          text-align: left;
        }
        .dshf-markdown-preview th { background: var(--dsw-alias-bg-layer-3, rgba(0,0,0,0.04)); font-weight: 600; }
        .dshf-markdown-preview img { max-width: 100%; height: auto; border-radius: 6px; }
        .dshf-markdown-preview a { color: var(--dsw-alias-state-business-primary, #0969da); text-decoration: none; }
        .dshf-markdown-preview a:hover { text-decoration: underline; }
        .dshf-markdown-preview ul, .dshf-markdown-preview ol { padding-left: 1.5em; margin: 0.5em 0; }
        .dshf-markdown-preview li { margin: 0.25em 0; }
        .dshf-markdown-preview hr { border: none; border-top: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.15)); margin: 1.5em 0; }
      ` }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { dangerouslySetInnerHTML: { __html: html2 } })
      ]
    }
  );
}

// src/client/editor/ThemeButton.tsx
var import_react15 = require("react");
var import_jsx_runtime11 = require("react/jsx-runtime");
function ThemeButton({ t }) {
  const [open, setOpen] = (0, import_react15.useState)(false);
  const theme = useEditorTheme();
  if (!open) {
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      "button",
      {
        type: "button",
        className: "dshf-btn",
        title: t("theme.title"),
        "aria-label": t("theme.button"),
        onClick: () => setOpen(true),
        children: t("theme.button")
      }
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(ThemeDialog, { theme, t, onClose: () => setOpen(false) });
}
function ThemeDialog({
  theme,
  t,
  onClose
}) {
  const preset = presetIdOf(theme);
  const [mode, setMode] = (0, import_react15.useState)(preset ? "preset" : "custom");
  const [bg, setBg] = (0, import_react15.useState)(theme.background);
  const [fg, setFg] = (0, import_react15.useState)(theme.foreground);
  const [fontSize, setFontSize] = (0, import_react15.useState)(theme.fontSize);
  const [error, setError] = (0, import_react15.useState)(null);
  const fileRef = (0, import_react15.useRef)(null);
  const applyPreset = (0, import_react15.useCallback)((id) => {
    const p = EDITOR_THEME_PRESETS[id];
    if (p) {
      setEditorTheme({ ...p });
      setBg(p.background);
      setFg(p.foreground);
      setFontSize(p.fontSize);
    }
  }, []);
  const applyCustom = (0, import_react15.useCallback)(() => {
    const hex6 = /^#[0-9a-f]{6}$/i;
    if (!hex6.test(bg)) {
      setError(t("theme.errorMissingBackground"));
      return;
    }
    if (!hex6.test(fg)) {
      setError(t("theme.errorMissingForeground"));
      return;
    }
    setError(null);
    setEditorTheme({ background: bg.toLowerCase(), foreground: fg.toLowerCase(), fontSize });
  }, [bg, fg, fontSize, t]);
  const handleExport = (0, import_react15.useCallback)(() => {
    const name = preset ? EDITOR_THEME_PRESET_LABELS[preset] : void 0;
    const text = exportThemeText(theme, name);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dsh-editor-theme.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [theme, preset]);
  const handleImport = (0, import_react15.useCallback)(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = parseImportedTheme(reader.result);
          setEditorTheme({
            background: parsed.background,
            foreground: parsed.foreground,
            fontSize: parsed.fontSize
          });
          setBg(parsed.background);
          setFg(parsed.foreground);
          setFontSize(parsed.fontSize);
          setError(null);
          setMode("custom");
        } catch (err) {
          setError(themeErrorMessage(t, err));
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [t]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dshf-theme-overlay", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dshf-theme-dialog", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dshf-theme-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dshf-theme-title", children: t("theme.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", className: "dshf-btn-icon", onClick: onClose, children: "\u2715" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dshf-theme-tabs", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "button",
        {
          type: "button",
          className: `dshf-tab ${mode === "preset" ? "dshf-tab-active" : ""}`,
          onClick: () => setMode("preset"),
          children: t("theme.preset")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "button",
        {
          type: "button",
          className: `dshf-tab ${mode === "custom" ? "dshf-tab-active" : ""}`,
          onClick: () => setMode("custom"),
          children: t("theme.custom")
        }
      )
    ] }),
    mode === "preset" ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dshf-theme-presets", children: EDITOR_THEME_PRESET_ORDER.map((id) => {
      const p = EDITOR_THEME_PRESETS[id];
      return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "button",
        {
          type: "button",
          className: `dshf-preset-btn ${preset === id ? "dshf-preset-active" : ""}`,
          onClick: () => applyPreset(id),
          style: {
            background: p.background,
            color: p.foreground,
            border: `2px solid ${preset === id ? "#0969da" : "var(--dsw-alias-border-l2, rgba(0,0,0,0.15))"}`
          },
          children: EDITOR_THEME_PRESET_LABELS[id]
        },
        id
      );
    }) }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dshf-theme-custom", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("label", { className: "dshf-theme-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: t("theme.background") }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("input", { type: "color", value: bg, onChange: (e) => setBg(e.target.value) }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("input", { type: "text", value: bg, onChange: (e) => setBg(e.target.value), className: "dshf-theme-input" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("label", { className: "dshf-theme-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: t("theme.foreground") }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("input", { type: "color", value: fg, onChange: (e) => setFg(e.target.value) }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("input", { type: "text", value: fg, onChange: (e) => setFg(e.target.value), className: "dshf-theme-input" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("label", { className: "dshf-theme-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: t("theme.fontSize") }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "input",
          {
            type: "number",
            value: fontSize,
            min: 8,
            max: 32,
            onChange: (e) => setFontSize(Number(e.target.value)),
            className: "dshf-theme-input"
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", className: "dshf-btn", onClick: applyCustom, children: t("theme.preset") })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dshf-theme-error", children: error }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dshf-theme-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", className: "dshf-btn", onClick: handleExport, children: t("theme.export") }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", className: "dshf-btn", onClick: () => fileRef.current?.click(), children: t("theme.import") }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("input", { ref: fileRef, type: "file", accept: ".json", style: { display: "none" }, onChange: handleImport }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { style: { flex: 1 } }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "button",
        {
          type: "button",
          className: "dshf-btn",
          onClick: () => {
            resetEditorTheme();
            const d = EDITOR_THEME_PRESETS.light;
            setBg(d.background);
            setFg(d.foreground);
            setFontSize(d.fontSize);
            setMode("preset");
          },
          children: t("theme.reset")
        }
      )
    ] })
  ] }) });
}

// src/client/editor/FileEditorView.tsx
var import_jsx_runtime12 = require("react/jsx-runtime");
function MdModeIcon({ mode }) {
  if (mode === "preview") {
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("path", { d: "M1 3h14v10H1V3Z", stroke: "currentColor", strokeWidth: "1.3" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("path", { d: "M3 6h10M3 8.5h7M3 11h4", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round" })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("path", { d: "M5 3L1 8l4 5M11 3l4 5-4 5", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" }) });
}
function FileEditorView({ remote, t }) {
  const tabs2 = useTabs();
  const activePath2 = useActivePath();
  const active = activePath2 === null ? void 0 : tabs2.find((t2) => t2.path === activePath2);
  const [busy, setBusy] = (0, import_react16.useState)(false);
  const [notice, setNotice] = (0, import_react16.useState)(null);
  const theme = useEditorTheme();
  const chrome = themeChrome(theme);
  const mdMode = useMdMode();
  (0, import_react16.useEffect)(() => {
    setEditorViewActive(true);
    return () => setEditorViewActive(false);
  }, []);
  const saveActive = (0, import_react16.useCallback)(async () => {
    if (active === void 0 || !active.dirty) return;
    setBusy(true);
    try {
      await unwrap(await remote.writeText(active.path, active.content));
      markSaved(active.path);
      setNotice(format(t("editor.saved"), { name: active.path.split("/").pop() ?? "" }));
    } catch (error) {
      setNotice(format(t("editor.saveFailed"), { message: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(false);
    }
  }, [active, remote, t]);
  const saveRef = (0, import_react16.useRef)(saveActive);
  saveRef.current = saveActive;
  (0, import_react16.useEffect)(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const themeVars = {
    ["--dshf-bg"]: theme.background,
    ["--dshf-fg"]: theme.foreground,
    ["--dshf-chrome"]: chrome.chrome,
    ["--dshf-border"]: chrome.border,
    ["--dshf-muted"]: chrome.muted,
    ["--dshf-chip"]: chrome.chip,
    ["--dshf-dirty"]: chrome.dirty,
    ["--dshf-accent"]: "#094771",
    ["--dshf-font-size"]: `${theme.fontSize}px`
  };
  if (active === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dshf-editor-view", style: themeVars, children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dshf-editor-toolbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dshf-title", children: t("view.label") }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dshf-spacer" }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ThemeButton, { t })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "dshf-empty", children: t("view.empty") })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dshf-editor-view", style: themeVars, children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "dshf-editor-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: cx("dshf-tabname", active.dirty && "dshf-dirty"), title: active.path, children: [
        active.dirty ? "\u25CF " : "",
        active.path.split("/").pop()
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dshf-spacer" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dshf-editor-path", title: active.path, children: active.path }),
      isMarkdownPath(active.path) && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
        "button",
        {
          type: "button",
          className: "dshf-btn dshf-md-toggle",
          title: mdMode === "preview" ? t("md.sourceTitle") : t("md.previewTitle"),
          onClick: () => setMdMode(mdMode === "preview" ? "source" : "preview"),
          children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(MdModeIcon, { mode: mdMode })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ThemeButton, { t }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
        "button",
        {
          type: "button",
          className: "dshf-btn",
          title: t("editor.saveTitle"),
          disabled: !active.dirty || busy,
          onClick: () => void saveActive(),
          children: t("editor.save")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
        "button",
        {
          type: "button",
          className: "dshf-btn",
          title: t("editor.closeFile"),
          onClick: () => {
            if (activePath2 !== null) closeTab(activePath2);
          },
          children: "\u2715"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: cx("dshf-status", "dshf-status-top"), children: [
      tabs2.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dshf-tabs-strip", children: tabs2.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
        "span",
        {
          className: cx("dshf-tab-chip", tab.path === activePath2 && "dshf-tab-chip-active"),
          title: tab.path,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { type: "button", className: "dshf-tab-chip-name", onClick: () => focusTab(tab.path), children: tab.path.split("/").pop() }),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
              "button",
              {
                type: "button",
                className: "dshf-tab-chip-close",
                "aria-label": format(t("editor.closeTab"), { name: tab.path.split("/").pop() ?? "" }),
                title: t("editor.close"),
                onClick: () => closeTab(tab.path),
                children: "\u2715"
              }
            )
          ]
        },
        tab.path
      )) }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "dshf-status-meta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "dshf-status-busy", children: busy ? "\u2026" : "" }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: cx("dshf-status-notice", notice === null && "dshf-hidden"), children: notice ?? "" })
      ] })
    ] }),
    isMarkdownPath(active.path) && mdMode === "preview" ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(MarkdownPreview, { content: active.content, path: active.path, remote }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
      EditorPane,
      {
        path: active.path,
        content: active.content,
        onChange: updateActiveContent,
        theme,
        t
      },
      active.path
    )
  ] });
}

// src/client/editor/tabsSlotLive.ts
var import_react17 = require("react");
var liveCount = 0;
var listeners5 = /* @__PURE__ */ new Set();
function emit5() {
  for (const listener of listeners5) listener();
}
function installTabsSlotWatch(ctx) {
  const sync = () => {
    const count = ctx.slots.entries("sidebar.workspaces.tabs").length;
    if (count !== liveCount) {
      liveCount = count;
      emit5();
    }
  };
  const dispose = ctx.slots.subscribe("sidebar.workspaces.tabs", sync);
  sync();
  return dispose;
}

// src/client/explorer-editor/index.ts
setFileEditorViewComponent(FileEditorView);
async function restoreEditorSession(ctx) {
  try {
    const remote = ctx.get("remote.fileManager");
    if (remote === void 0) return;
    const { path: root } = unwrap(remote.getRoot());
    const snapshot4 = loadSnapshot();
    if (snapshot4 === null) return;
    if (snapshot4.root !== root) {
      clearSnapshot();
      return;
    }
    setWorkspaceRoot(root);
    const kept = filterByRoot(snapshot4.tabs, root);
    if (kept.length === 0) return;
    const restored = [];
    for (const tab of kept) {
      if (tab.content !== void 0) {
        restored.push({
          path: tab.path,
          content: tab.content,
          savedContent: tab.savedContent ?? tab.content,
          mtimeMs: tab.mtimeMs,
          dirty: tab.dirty,
          error: tab.error
        });
      } else {
        try {
          const value = unwrap(await remote.readText(tab.path));
          restored.push({
            path: value.path,
            content: value.content,
            savedContent: value.content,
            mtimeMs: value.mtimeMs,
            dirty: false,
            error: void 0
          });
        } catch (error) {
          restored.push({
            path: tab.path,
            content: "",
            savedContent: "",
            mtimeMs: tab.mtimeMs,
            dirty: tab.dirty,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    if (restored.length > 0) {
      const active = snapshot4.activePath !== null && restored.some((t) => t.path === snapshot4.activePath) ? snapshot4.activePath : restored[restored.length - 1]?.path ?? null;
      restoreTabs(restored, active);
      ctx.logger?.info?.("[dsh-explorer-editor] restored " + restored.length + " editor tab(s) from session");
    }
  } catch {
  }
}
function applyExplorerEditor(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-explorer-editor: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.effect(() => installTabsSlotWatch(ctx), "dsh-explorer-editor: tabs slot watch");
  const mountRemote = ctx.effect(() => {
    ctx.provide("remote.fileManager", buildExplorerRemote());
    void restoreEditorSession(ctx);
  }, "dsh-explorer-editor: remote mount");
  ctx.slots.inject(
    "conversation.view",
    () => ctx.slots.register(
      {
        name: "conversation.view",
        id: "dsh-explorer-editor",
        order: 20,
        label: () => t("view.label"),
        locale: NS,
        registrant: "dsh-unknownue-plugins"
      },
      (props) => {
        const remote = ctx.get("remote.fileManager");
        if (remote === void 0) return null;
        return import_react18.default.createElement(ExplorerViewWrapper, { remote, t, useSessions: props.useSessions });
      }
    )
  );
  void mountRemote;
}

// src/client/styles.css
var styles_default = `/* dsh-explorer-editor plugin styles. Kept dependency-free: plain CSS with DSH design

 * tokens where available, sensible fallbacks elsewhere. */

/* \u2500\u2500 sidebar tree panel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.dshf-root {

  display: flex;

  flex-direction: column;

  height: 100%;

  min-height: 0;

  box-sizing: border-box;

  font-size: 13px;

  color: var(--dsw-alias-label-primary, #1f2328);

}

.dshf-toolbar {

  display: flex;

  align-items: center;

  gap: 6px;

  padding: 6px 8px;

  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));

  flex: none;

}

.dshf-title {

  font-weight: 600;

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;

  max-width: 120px;

}

.dshf-spacer {

  flex: 1;

}

.dshf-btn {

  background: transparent;

  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.15));

  border-radius: 6px;

  color: inherit;

  cursor: pointer;

  font-size: 12px;

  padding: 2px 6px;

  line-height: 1.5;

}

.dshf-btn:hover {

  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));

}

.dshf-btn:disabled {

  opacity: 0.5;

  cursor: default;

}

/* \u7EAF\u56FE\u6807\u6309\u94AE\uFF08\u5DE5\u5177\u6761\uFF09\uFF1ADSH \u98CE\u683C\u7684\u65E0\u8FB9\u6846 ghost \u56FE\u6807\u6309\u94AE */

.dshf-btn-icon {

  display: inline-flex;

  align-items: center;

  justify-content: center;

  border-color: transparent;

  padding: 4px;

  border-radius: 6px;

}

/* \u9875\u9762\u5185\u786E\u8BA4\u5F39\u5C42\uFF08\u66FF\u4EE3 window.confirm\uFF0C\u684C\u9762\u7AEF Electron \u4E0D\u652F\u6301\u539F\u751F\u5F39\u6846\uFF09 */

.dshf-modal-overlay {

  position: fixed;

  inset: 0;

  z-index: 1000;

  background: rgba(0, 0, 0, 0.35);

  display: flex;

  align-items: center;

  justify-content: center;

}

.dshf-modal {

  min-width: 260px;

  max-width: 360px;

  background: var(--dsw-alias-bg-overlay, #ffffff);

  color: var(--dsw-alias-label-primary, #1f2328);

  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.15));

  border-radius: 10px;

  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);

  padding: 14px 16px;

}

.dshf-modal-title {

  font-size: 14px;

  font-weight: 600;

  margin-bottom: 6px;

  overflow: hidden;

  text-overflow: ellipsis;

  white-space: nowrap;

}

.dshf-modal-body {

  font-size: 13px;

  color: var(--dsw-alias-label-secondary, #495057);

  margin-bottom: 14px;

  word-break: break-all;

}

.dshf-modal-actions {

  display: flex;

  justify-content: flex-end;

  gap: 8px;

}

/* \u6B21\u7EA7\u6309\u94AE\uFF08\u53D6\u6D88\uFF09\uFF1A\u7ED9\u53EF\u89C1\u8FB9\u6846\u4E0E\u6D45\u5E95\u8272\uFF0C\u786E\u4FDD\u4E0E\u4E3B\u6309\u94AE\uFF08\u5220\u9664\uFF09\u533A\u5206\u3001\u6DF1\u6D45\u4E3B\u9898\u4E0B\u90FD\u53EF\u89C1 */

.dshf-modal-actions .dshf-btn:not(.dshf-btn-danger) {

  background: var(--dsw-alias-bg-layer-2, #f0f1f3);

  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.3));

  color: var(--dsw-alias-label-primary, #1f2328);

  padding: 4px 14px;

}

.dshf-modal-actions .dshf-btn:not(.dshf-btn-danger):hover {

  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.08));

}

.dshf-modal-actions .dshf-btn-danger {

  padding: 4px 14px;

}

.dshf-btn-danger {

  background: var(--dsw-alias-danger-fg, #c92a2a);

  border-color: transparent;

  color: #ffffff;

}

.dshf-btn-danger:hover {

  background: var(--dsw-alias-danger-fg, #c92a2a);

  filter: brightness(1.1);

}

.dshf-error {

  padding: 8px 12px;

  color: var(--dsw-alias-danger-fg, #c92a2a);

  font-size: 12px;

}

.dshf-tree-pane {

  flex: 1;

  min-height: 0;

  display: flex;

  overflow: hidden;

}

.dshf-tree-scroll {

  overflow: auto;

  flex: 1;

  min-height: 0;

  padding: 4px 0;

}

.dshf-tree-list {

  min-width: max-content;

}

.dshf-tree-hint {

  padding: 4px 12px;

  color: var(--dsw-alias-label-tertiary, #868e96);

  font-size: 12px;

}

.dshf-node {

  display: flex;

  align-items: center;

  gap: 4px;

  padding: 2px 8px;

  cursor: pointer;

  white-space: nowrap;

  user-select: none;

  min-height: 22px;

}

.dshf-node:hover {

  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));

}

.dshf-selected {

  background: var(--dsw-alias-interactive-bg-selected, rgba(77, 171, 247, 0.15));

}

.dshf-caret {

  width: 12px;

  flex: none;

  font-size: 10px;

  color: var(--dsw-alias-label-tertiary, #868e96);

}

.dshf-icon {

  flex: none;

  font-size: 13px;

}

.dshf-name {

  overflow: hidden;

  text-overflow: ellipsis;

  min-width: 0;

}

/* VS Code \u5F0F\u5185\u8054\u8F93\u5165\u884C\uFF08\u65B0\u5EFA/\u91CD\u547D\u540D\uFF09\uFF1Aaccent \u8FB9\u6846\u7684\u8F93\u5165\u6846 */

.dshf-node-editing {

  cursor: default;

}

.dshf-inline-input {

  flex: 1;

  min-width: 0;

  font: inherit;

  font-size: 13px;

  line-height: 1.4;

  color: inherit;

  background: var(--dsw-alias-bg-primary, #ffffff);

  border: 1px solid var(--dsw-alias-accent-strong, #4dabf7);

  border-radius: 4px;

  padding: 1px 4px;

  outline: none;

}

.dshf-node-actions {

  display: none;

  margin-left: auto;

  gap: 2px;

  flex: none;

}

.dshf-node:hover .dshf-node-actions {

  display: inline-flex;

}

.dshf-mini {

  background: transparent;

  border: none;

  cursor: pointer;

  font-size: 11px;

  padding: 0 2px;

  opacity: 0.7;

}

.dshf-mini:hover {

  opacity: 1;

}

.dshf-status {

  display: flex;

  align-items: center;

  gap: 8px;

  padding: 4px 8px;

  border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));

  flex: none;

  font-size: 11px;

  color: var(--dsw-alias-label-tertiary, #868e96);

  min-height: 22px;

}

/* Status row placed at the TOP of the editor view (below the toolbar):

 * the open-file tab strip reads top-down, so the border flips sides. */

.dshf-status-top {

  border-top: none;

  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));

}

.dshf-status-busy {

  color: var(--dsw-alias-accent-strong, #4dabf7);

}

.dshf-status-notice {

  overflow: hidden;

  text-overflow: ellipsis;

  white-space: nowrap;

}

.dshf-hidden {

  display: none;

}

/* \u2500\u2500 center-column editor view (conversation.view) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/* Renders IN the conversation center column's view area (inside the session

 * scroll body), alongside chat / trajectory \u2014 never a popup. Fills the view

 * area the session body reserves for the active view.

 *

 * The whole view is ONE cohesive surface. Colors come from the editor theme

 * (themeStore) via CSS custom properties with LIGHT defaults (the default

 * theme is light), so the chrome always matches the Monaco background

 * instead of clashing with the page. */

.dshf-editor-view {

  display: flex;

  flex-direction: column;

  height: 100%;

  min-height: 0;

  box-sizing: border-box;

  position: relative;

  background: var(--dshf-bg, #ffffff);

  color: var(--dshf-fg, #1f2328);

  font-size: 13px;

}

.dshf-editor-view .dshf-editor-toolbar {

  display: flex;

  align-items: center;

  gap: 8px;

  padding: 6px 10px;

  background: var(--dshf-chrome, #f3f3f3);

  border-bottom: 1px solid var(--dshf-border, #e0e0e0);

  flex: none;

  font-size: 12px;

  color: var(--dshf-fg, #1f2328);

}

.dshf-editor-view .dshf-tabname {

  font-weight: 600;

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;

  color: var(--dshf-fg, #1f2328);

}

.dshf-editor-view .dshf-dirty {

  color: var(--dshf-dirty, #c2410c);

}

.dshf-editor-view .dshf-editor-path {

  min-width: 0;

  overflow: hidden;

  text-overflow: ellipsis;

  white-space: nowrap;

  color: var(--dshf-muted, #868e96);

  font-size: 11px;

}

.dshf-editor-view .dshf-status-top {

  background: var(--dshf-chrome, #f3f3f3);

  color: var(--dshf-muted, #868e96);

}

.dshf-editor-view .dshf-empty {

  color: var(--dshf-muted, #868e96);

}

.dshf-editor-view .dshf-monaco {

  flex: 1;

  min-height: 0;

}

.dshf-editor-view .dshf-textarea {

  flex: 1;

  min-height: 0;

  resize: none;

  border: none;

  outline: none;

  padding: 8px 12px;

  font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);

  font-size: var(--dshf-font-size, 13px);

  line-height: 1.5;

  background: var(--dshf-bg, #ffffff);

  color: var(--dshf-fg, #1f2328);

}

.dshf-editor-view .dshf-btn {

  color: var(--dshf-fg, #1f2328);

  border-color: var(--dshf-border, #d0d0d0);

}

.dshf-editor-view .dshf-btn:hover {

  background: var(--dshf-chip, #ececec);

}

.dshf-editor-view .dshf-tab-chip {

  background: var(--dshf-chip, #ececec);

  border-color: var(--dshf-border, #d0d0d0);

  color: var(--dshf-fg, #1f2328);

}

.dshf-editor-view .dshf-tab-chip:hover {

  background: var(--dshf-border, #c9c9c9);

}

.dshf-editor-view .dshf-tab-chip-active {

  background: var(--dshf-accent, #094771);

  border-color: var(--dshf-accent, #094771);

  color: #ffffff;

}

.dshf-editor-view .dshf-tab-chip-close:hover {

  background: var(--dshf-border, rgba(0, 0, 0, 0.1));

}

/* \u2500\u2500 Markdown preview (read-only rendered view) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.dshf-editor-view .dshf-md-preview {

  flex: 1;

  min-height: 0;

  overflow: auto;

  padding: 12px 20px 32px;

  font-size: var(--dshf-font-size, 13px);

  line-height: 1.6;

  color: var(--dshf-fg, #1f2328);

  background: var(--dshf-bg, #ffffff);

  box-sizing: border-box;

  word-wrap: break-word;

}

.dshf-editor-view .dshf-md-preview > :first-child {

  margin-top: 0;

}

.dshf-editor-view .dshf-md-preview h1,

.dshf-editor-view .dshf-md-preview h2,

.dshf-editor-view .dshf-md-preview h3,

.dshf-editor-view .dshf-md-preview h4 {

  margin: 1.2em 0 0.5em;

  line-height: 1.3;

  color: var(--dshf-fg, #1f2328);

}

.dshf-editor-view .dshf-md-preview h1 { font-size: 1.6em; border-bottom: 1px solid var(--dshf-border, #e0e0e0); padding-bottom: 0.3em; }

.dshf-editor-view .dshf-md-preview h2 { font-size: 1.35em; border-bottom: 1px solid var(--dshf-border, #e0e0e0); padding-bottom: 0.25em; }

.dshf-editor-view .dshf-md-preview h3 { font-size: 1.15em; }

.dshf-editor-view .dshf-md-preview h4 { font-size: 1em; }

.dshf-editor-view .dshf-md-preview p {

  margin: 0.6em 0;

}

.dshf-editor-view .dshf-md-preview ul,

.dshf-editor-view .dshf-md-preview ol {

  margin: 0.6em 0;

  padding-left: 1.6em;

}

.dshf-editor-view .dshf-md-preview li {

  margin: 0.2em 0;

}

.dshf-editor-view .dshf-md-preview blockquote {

  margin: 0.8em 0;

  padding: 0.1em 1em;

  border-left: 3px solid var(--dshf-border, #d0d0d0);

  color: var(--dshf-muted, #868e96);

  background: var(--dshf-chip, #f3f3f3);

  border-radius: 0 6px 6px 0;

}

.dshf-editor-view .dshf-md-preview code {

  font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);

  font-size: 0.92em;

  background: var(--dshf-chip, #ececec);

  border-radius: 4px;

  padding: 0.1em 0.35em;

}

.dshf-editor-view .dshf-md-preview pre {

  margin: 0.8em 0;

  padding: 10px 12px;

  background: var(--dshf-chip, #ececec);

  border: 1px solid var(--dshf-border, #d0d0d0);

  border-radius: 8px;

  overflow: auto;

}

.dshf-editor-view .dshf-md-preview pre code {

  background: transparent;

  padding: 0;

  font-size: 0.92em;

  line-height: 1.5;

}

.dshf-editor-view .dshf-md-preview a {

  color: var(--dshf-accent, #094771);

  text-decoration: none;

}

.dshf-editor-view .dshf-md-preview a:hover {

  text-decoration: underline;

}

.dshf-editor-view .dshf-md-preview img {

  max-width: 100%;

}

.dshf-editor-view .dshf-md-preview table {

  border-collapse: collapse;

  margin: 0.8em 0;

  display: block;

  overflow: auto;

  max-width: 100%;

}

.dshf-editor-view .dshf-md-preview th,

.dshf-editor-view .dshf-md-preview td {

  border: 1px solid var(--dshf-border, #d0d0d0);

  padding: 4px 10px;

}

.dshf-editor-view .dshf-md-preview th {

  background: var(--dshf-chip, #ececec);

  font-weight: 600;

}

.dshf-editor-view .dshf-md-preview hr {

  border: none;

  border-top: 1px solid var(--dshf-border, #d0d0d0);

  margin: 1em 0;

}

.dshf-editor-view .dshf-md-preview input[type='checkbox'] {

  margin-right: 0.4em;

}

/* Toggle button: keep it subtle like the theme button */

.dshf-editor-view .dshf-md-toggle {

  display: inline-flex;

  align-items: center;

  justify-content: center;

  padding: 2px 5px;

}

.dshf-editor-view .dshf-md-toggle svg {

  display: block;

}

/* \u2500\u2500 editor theme panel (VS Code style) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.dshf-theme-wrap {

  position: relative;

  display: inline-flex;

}

.dshf-theme-panel {

  position: absolute;

  top: calc(100% + 4px);

  right: 0;

  z-index: 40;

  width: 252px;

  display: flex;

  flex-direction: column;

  gap: 8px;

  box-sizing: border-box;

  padding: 10px;

  background: var(--dshf-chrome, #f3f3f3);

  border: 1px solid var(--dshf-border, #d0d0d0);

  border-radius: 8px;

  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);

  color: var(--dshf-fg, #1f2328);

  font-size: 12px;

}

.dshf-theme-row {

  display: flex;

  align-items: center;

  gap: 8px;

  min-width: 0;

}

.dshf-theme-label {

  flex: none;

  width: 44px;

  color: var(--dshf-muted, #868e96);

}

.dshf-theme-select {

  flex: 1;

  min-width: 0;

  background: var(--dshf-chip, #ececec);

  border: 1px solid var(--dshf-border, #d0d0d0);

  border-radius: 6px;

  color: var(--dshf-fg, #1f2328);

  font-size: 12px;

  padding: 2px 6px;

  cursor: pointer;

}

.dshf-theme-select:focus {

  outline: none;

  border-color: var(--dshf-accent, #094771);

}

.dshf-theme-row input[type='color'] {

  width: 34px;

  height: 22px;

  padding: 0;

  border: 1px solid var(--dshf-border, #d0d0d0);

  border-radius: 4px;

  background: var(--dshf-chip, #ececec);

  cursor: pointer;

}

.dshf-theme-hex {

  font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);

  font-size: 11px;

  color: var(--dshf-muted, #868e96);

  overflow: hidden;

  text-overflow: ellipsis;

}

.dshf-theme-error {

  color: var(--dshf-dirty, #c2410c);

  font-size: 11px;

  line-height: 1.4;

}

.dshf-hidden-input {

  display: none;

}

.dshf-theme-fontsize {

  width: 52px;

  background: var(--dshf-chip, #ececec);

  border: 1px solid var(--dshf-border, #d0d0d0);

  border-radius: 4px;

  color: var(--dshf-fg, #1f2328);

  font-size: 12px;

  padding: 1px 4px;

}

.dshf-theme-unit {

  color: var(--dshf-muted, #868e96);

  font-size: 11px;

}

.dshf-theme-actions {

  justify-content: flex-end;

  border-top: 1px solid var(--dshf-border, rgba(0, 0, 0, 0.1));

  padding-top: 8px;

}

.dshf-empty {

  display: flex;

  align-items: center;

  justify-content: center;

  flex: 1;

  color: var(--dsw-alias-label-tertiary, #868e96);

  font-size: 12px;

}

.dshf-tabs-strip {

  display: inline-flex;

  align-items: center;

  gap: 4px;

  overflow: hidden;

  max-width: 60%;

}

/* One open-file tab: a chip container holding the (clickable) name and a

 * per-file close "\u2715". Left-aligned in the status row. */

.dshf-tab-chip {

  display: inline-flex;

  align-items: center;

  gap: 2px;

  background: transparent;

  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));

  border-radius: 6px;

  color: var(--dsw-alias-label-secondary, #495057);

  font-size: 11px;

  padding: 1px 2px 1px 6px;

  white-space: nowrap;

  max-width: 160px;

}

.dshf-tab-chip:hover {

  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));

}

.dshf-tab-chip-active {

  background: var(--dsw-alias-interactive-bg-selected, rgba(77, 171, 247, 0.15));

  border-color: var(--dsw-alias-accent-strong, #4dabf7);

}

/* Filename part of a tab (click to focus). */

.dshf-tab-chip-name {

  background: transparent;

  border: none;

  padding: 0;

  margin: 0;

  font: inherit;

  color: inherit;

  cursor: pointer;

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;

  min-width: 0;

}

.dshf-tab-chip-name:hover {

  text-decoration: underline;

}

/* Per-file close button. */

.dshf-tab-chip-close {

  background: transparent;

  border: none;

  padding: 0 3px;

  margin: 0;

  font-size: 10px;

  line-height: 1;

  color: inherit;

  cursor: pointer;

  opacity: 0.55;

  border-radius: 4px;

  flex: none;

}

.dshf-tab-chip-close:hover {

  opacity: 1;

  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.08));

}

/* Busy / notice group pushed to the right end of the status row. */

.dshf-status-meta {

  display: inline-flex;

  align-items: center;

  gap: 8px;

  margin-left: auto;

  min-width: 0;

}

/* Sidebar footer toggle button */

.dshf-toggle {

  display: inline-flex;

  align-items: center;

  gap: 6px;

  background: transparent;

  border: 1px solid transparent;

  border-radius: 8px;

  color: var(--dsw-alias-label-secondary, #495057);

  cursor: pointer;

  padding: 6px 10px;

  flex: 1;

  min-width: 0;

}

.dshf-toggle:hover {

  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));

}

.dshf-toggle-label {

  font-size: 13px;

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;

}

/* \u2500\u2500 sidebar view-tab strip ([\u5DE5\u4F5C\u533A] [\u6587\u4EF6]) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

 * Rendered inside the workspace browser's section header row (replacing the

 * "\u5DE5\u4F5C\u533A" label) and at the top of the file-manager panel wrapper. margin-

 * right:auto keeps the strip at the row's left while the browser's search /

 * actions stay right-aligned; no flex-grow so it never stretches vertically

 * inside the panel wrapper's column layout. */

.dshf-tabs {

  display: flex;

  align-items: center;

  gap: 4px;

  min-width: 0;

  margin-right: auto;

}

.dshf-tab {

  display: inline-flex;

  align-items: center;

  justify-content: center;

  gap: 4px;

  height: 26px;

  padding: 0 8px;

  border: none;

  border-radius: 8px;

  background: transparent;

  color: var(--dsw-alias-label-secondary, #495057);

  cursor: pointer;

  font: inherit;

  font-size: 13px;

  flex: none;

}

.dshf-tab:hover {

  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));

}

.dshf-tab-active {

  color: var(--dsw-alias-label-primary, #1f2329);

  font-weight: 600;

}

.dshf-tab-label {

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;

}

/* Wrapper around the file-manager panel while the "\u6587\u4EF6" tab owns the cell:

 * hosts the tab strip on top and lets the panel fill the rest. The strip gets

 * the same 8px side inset as the panel toolbar below it. */

.dshf-panel-wrap {

  display: flex;

  flex-direction: column;

  flex: 1;

  min-height: 0;

  padding-top: 4px;

}

.dshf-panel-wrap .dshf-tabs {

  padding: 0 8px;

}

/* \u2500\u2500 context menu (right-click) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.dshf-context-menu {

  position: fixed;

  z-index: 2147483002;

  min-width: 180px;

  padding: 4px;

  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.35));

  border-radius: 8px;

  background: var(--dsw-alias-bg-layer-3, #ffffff);

  color: var(--dsw-alias-label-primary, inherit);

  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);

  font: 13px/1.5 system-ui, sans-serif;

  user-select: none;

}

.dshf-menu-item {

  display: flex;

  align-items: center;

  gap: 12px;

  width: 100%;

  padding: 5px 10px;

  border: none;

  border-radius: 6px;

  background: transparent;

  color: inherit;

  font: inherit;

  text-align: left;

  cursor: pointer;

}

.dshf-menu-item:hover,

.dshf-menu-item-active {

  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.08));

  outline: none;

}

.dshf-menu-item-disabled {

  opacity: 0.5;

  cursor: default;

}

.dshf-menu-item-disabled:hover {

  background: transparent;

}

.dshf-menu-label {

  flex: 1;

  min-width: 0;

  overflow: hidden;

  text-overflow: ellipsis;

  white-space: nowrap;

}

.dshf-menu-shortcut {

  color: var(--dsw-alias-label-tertiary, rgba(0, 0, 0, 0.45));

  font-size: 11px;

}

.dshf-menu-sep {

  height: 1px;

  margin: 4px 6px;

  background: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.25));

}

/* Cut-source row: dimmed with a dashed outline (VS Code style). */

.dshf-node.dshf-cut {

  opacity: 0.45;

  outline: 1px dashed var(--dsw-alias-label-dimmed, rgba(127, 127, 127, 0.6));

  outline-offset: -1px;

}

`;

// src/client/index.tsx
function ensureStyles() {
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
    '.dmk-target{flex:none;font-family:ui-monospace,"Cascadia Code","Cascadia Mono",Consolas,Menlo,monospace;font-size:12px;font-weight:600;line-height:20px;}',
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
    '.dshfx-resizer::after{content:"";position:absolute;top:0;bottom:0;left:2px;width:1px;background:var(--dsw-alias-border-l2);transition:background var(--ds-transition-duration-fast,120ms) ease;}',
    ".dshfx-resizer:hover::after,.dshfx-resizer[data-dragging]::after{background:var(--dsw-alias-state-business-primary);width:2px;left:2px;}",
    ".dshfx-editor-pane{flex:1;min-width:0;overflow:hidden;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);}"
  ].join("\n");
  const existing = document.querySelector("style[data-dmk-styles]");
  const style = existing !== null ? existing : document.createElement("style");
  style.setAttribute("data-dmk-styles", "");
  style.textContent = css;
  if (existing === null) document.head.appendChild(style);
  const CSS_TAG = "dsh-explorer-editor/styles.css";
  if (document.querySelector(`style[data-plugin-css="${CSS_TAG}"]`) === null) {
    const tag2 = document.createElement("style");
    tag2.dataset.plugin = "dsh-explorer-editor";
    tag2.dataset.pluginCss = CSS_TAG;
    tag2.textContent = styles_default;
    document.head.appendChild(tag2);
  }
}
var inject = ["slots", "sessions", "locale"];
function apply(ctx) {
  ensureStyles();
  applyWidth(readWidthPct());
  const makefileInjected = () => ({ sessions: ctx.sessions });
  ctx.effect(
    () => ctx.slots.inject(
      "conversation.session.header.actions",
      () => ctx.slots.register(
        { name: "conversation.session.header.actions", id: "dsh-unknownue-plugins/makefile", inject: makefileInjected },
        MakefileControl
      )
    ),
    "dsh-unknownue-plugins: makefile header action"
  );
  const openDirInjected = () => ({ sessions: ctx.sessions });
  ctx.effect(
    () => ctx.slots.inject(
      "conversation.session.header.actions",
      () => ctx.slots.register(
        { name: "conversation.session.header.actions", id: "dsh-unknownue-plugins/open-dir", inject: openDirInjected },
        OpenDirButton
      )
    ),
    "dsh-unknownue-plugins: open workspace directory action"
  );
  const terminalInjected = () => ({ sessions: ctx.sessions });
  ctx.effect(
    () => ctx.slots.inject(
      "conversation.session.header.actions",
      () => ctx.slots.register(
        { name: "conversation.session.header.actions", id: "dsh-unknownue-plugins/terminal", inject: terminalInjected },
        OpenTerminalButton
      )
    ),
    "dsh-unknownue-plugins: open terminal action"
  );
  const widthInjected = () => ({ getPct: readWidthPct, setPct: setWidthPct });
  ctx.effect(
    () => ctx.slots.inject(
      "sidebar.footer.action",
      () => ctx.slots.register(
        { name: "sidebar.footer.action", id: "dsh-unknownue-plugins/width", inject: widthInjected },
        WidthControl
      )
    ),
    "dsh-unknownue-plugins: content width control"
  );
  applyExplorerEditor(ctx);
}

    return module.exports;
  }
});


// Browser half of dsh-unknownue-plugins: the single client module for the whole
// personal bundle.
//   - Makefile panel (session-header button): lists make targets (display-only,
//     with default-target badge + copy-to-clipboard) via the host JSON-RPC route.
//   - Content-width control (sidebar footer button, merged from dsh-ui-width):
//     adjusts the chat/content column width by percentage, with persistence.
//   - Open-workspace button (session-header, next to Makefile).
//   - Open-terminal button (session-header): opens a terminal at the session cwd.
window.__ModuleLoader__.load({
  id: "dsh-unknownue-plugins",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");

    const MAKE_API = "/dsh-unknownue-plugins/makefile/api";
    const OPEN_API = "/dsh-unknownue-plugins/open/api";
    const TERMINAL_API = "/dsh-unknownue-plugins/terminal/api";

    // ── idempotent stylesheet ─────────────────────────────────────────────
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
        ".dshfx-editor-pane{flex:1;min-width:0;overflow:hidden;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);}"
      ].join("\n");
      // Refresh an existing tag in place (re-activation without a page reload
      // would otherwise keep serving a stale stylesheet).
      const existing = document.querySelector("style[data-dmk-styles]");
      const style = existing !== null ? existing : document.createElement("style");
      style.setAttribute("data-dmk-styles", "");
      style.textContent = css;
      if (existing === null) document.head.appendChild(style);
    }

    async function call(api, method, params) {
      const response = await fetch(api, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, params })
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : "request failed");
      return data.value;
    }

    function resolveCwd(sessions, sessionId) {
      try {
        if (!sessions || !sessionId) return "";
        const binding = typeof sessions.binding === "function" ? sessions.binding(sessionId) : undefined;
        const headerCwd = binding && binding.session && binding.session.header ? binding.session.header.cwd : undefined;
        if (typeof headerCwd === "string" && headerCwd !== "") return headerCwd;
        const snapshot = sessions.list && typeof sessions.list.getSnapshot === "function" ? sessions.list.getSnapshot() : undefined;
        if (snapshot && snapshot.byId) {
          const summary = snapshot.byId[sessionId];
          if (summary && typeof summary.cwd === "string" && summary.cwd !== "") return summary.cwd;
        }
        return "";
      } catch {
        return "";
      }
    }

    function Glyph() {
      return react.createElement(
        "svg",
        { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
        react.createElement("path", {
          d: "M3 21h18M5 21V8l7-4v17M12 21V10l7 4v7M8 6.5L12 4M12 13l7-4",
          stroke: "currentColor",
          strokeWidth: 1.8,
          strokeLinecap: "round",
          strokeLinejoin: "round"
        })
      );
    }

    function FolderGlyph() {
      return react.createElement(
        "svg",
        { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
        react.createElement("path", {
          d: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z",
          stroke: "currentColor",
          strokeWidth: 1.8,
          strokeLinejoin: "round"
        })
      );
    }

    function OpenDirButton(props) {
      const sessions = props.sessions;
      const sessionId = props.sessionId;
      const cwd = resolveCwd(sessions, sessionId);
      const [busy, setBusy] = react.useState(false);
      const [feedback, setFeedback] = react.useState(null);

      const onClick = async () => {
        if (busy) return;
        console.log("dsh-unknownue-plugins openDir:", { sessionId, cwd, sessionsType: typeof sessions });
        if (!cwd) {
          setFeedback({ kind: "error", text: "无法获取工作目录（cwd 为空）" });
          return;
        }
        setBusy(true);
        setFeedback(null);
        try {
          const result = await call(OPEN_API, "openDir", { path: cwd });
          setFeedback({ kind: "ok", text: `已打开：${result && result.opened ? result.opened : cwd}` });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setFeedback({ kind: "error", text: message });
          console.error("dsh-unknownue-plugins: openDir failed:", err);
        } finally {
          setBusy(false);
        }
      };

      return react.createElement(
        "button",
        {
          type: "button",
          className: "dmk-action",
          title: feedback ? feedback.text : cwd ? `打开工作目录（${cwd}）` : "打开工作目录",
          "aria-label": "打开工作目录",
          disabled: busy,
          onClick
        },
        react.createElement(FolderGlyph)
      );
    }

    function TerminalGlyph() {
      return react.createElement(
        "svg",
        { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
        react.createElement("rect", { x: 3, y: 4, width: 18, height: 16, rx: 2, stroke: "currentColor", strokeWidth: 1.8 }),
        react.createElement("path", { d: "M7 9l3 3-3 3M12 15h5", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" })
      );
    }

    function OpenTerminalButton(props) {
      const sessions = props.sessions;
      const sessionId = props.sessionId;
      const cwd = resolveCwd(sessions, sessionId);
      const [busy, setBusy] = react.useState(false);
      const [feedback, setFeedback] = react.useState(null);

      const onClick = async () => {
        if (busy) return;
        if (!cwd) {
          setFeedback({ text: "无法获取工作目录（cwd 为空）" });
          return;
        }
        setBusy(true);
        setFeedback(null);
        try {
          const result = await call(TERMINAL_API, "openTerminal", { path: cwd });
          setFeedback({ text: `已打开终端：${result && result.opened ? result.opened : cwd}` });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setFeedback({ text: message });
          console.error("dsh-unknownue-plugins: openTerminal failed:", err);
        } finally {
          setBusy(false);
        }
      };

      return react.createElement(
        "button",
        {
          type: "button",
          className: "dmk-action",
          title: feedback ? feedback.text : cwd ? `打开终端（${cwd}）` : "打开终端",
          "aria-label": "打开终端",
          disabled: busy,
          onClick
        },
        react.createElement(TerminalGlyph)
      );
    }

    function MakefileControl(props) {
      const sessions = props.sessions;
      const sessionId = props.sessionId;
      const [open, setOpen] = react.useState(false);
      const [workdir, setWorkdir] = react.useState("");
      const [status, setStatus] = react.useState({ kind: "idle" });
      const [targets, setTargets] = react.useState([]);
      const [defaultTarget, setDefaultTarget] = react.useState(null);
      const [copied, setCopied] = react.useState(null);

      const openPanel = () => {
        const cwd = resolveCwd(sessions, sessionId);
        setWorkdir(cwd);
        setStatus({ kind: "idle" });
        setTargets([]);
        setDefaultTarget(null);
        setCopied(null);
        setOpen(true);
        load(cwd);
      };

      const load = async (wd) => {
        setStatus({ kind: "loading" });
        try {
          const value = await call(MAKE_API, "listTargets", { workdir: wd || undefined });
          setTargets(value.targets || []);
          setDefaultTarget(value.defaultTarget || null);
          setStatus({ kind: "ready", path: value.path });
        } catch (error) {
          setTargets([]);
          setDefaultTarget(null);
          setStatus({ kind: "error", message: error instanceof Error ? error.message : String(error) });
        }
      };

      const onRefresh = () => load(workdir);

      const copyTarget = async (target) => {
        try {
          await navigator.clipboard.writeText(`make ${target}`);
          setCopied(target);
          setTimeout(() => setCopied((cur) => (cur === target ? null : cur)), 1500);
        } catch {
          // Clipboard may be unavailable (non-secure context); ignore.
        }
      };

      if (!open) {
        return react.createElement(
          "button",
          { type: "button", className: "dmk-action", title: "Makefile 目标", "aria-label": "Makefile 目标", onClick: openPanel },
          react.createElement(Glyph)
        );
      }

      const onClose = () => setOpen(false);
      const statusText = status.kind === "loading"
        ? "读取中…"
        : status.kind === "error"
          ? `错误：${status.message}`
          : status.kind === "ready"
            ? `${targets.length} 个目标 · ${status.path}${defaultTarget ? ` · 默认：${defaultTarget}` : ""}`
            : "";

      return react.createElement(
        "div",
        { className: "dmk-overlay" },
        react.createElement("div", { className: "dmk-mask", onClick: onClose }),
        react.createElement(
          "div",
          { className: "dmk-card", role: "dialog", "aria-label": "Makefile" },
          react.createElement(
            "div",
            { className: "dmk-head" },
            react.createElement("h3", { className: "dmk-title" }, "Makefile 目标"),
            react.createElement("button", { type: "button", className: "dmk-close", onClick: onClose, "aria-label": "Close" }, "\u2715")
          ),
          react.createElement(
            "div",
            { className: "dmk-toolbar" },
            react.createElement("input", {
              type: "text",
              className: "dmk-workdir",
              value: workdir,
              placeholder: "工作目录（如 C:\\project 或 /workspace）",
              onChange: (event) => setWorkdir(event.target.value)
            }),
            react.createElement("button", { type: "button", className: "dmk-btn", onClick: onRefresh, disabled: status.kind === "loading" }, "刷新")
          ),
          react.createElement("div", { className: "dmk-meta" }, statusText),
          react.createElement(
            "div",
            { className: "dmk-list" },
            targets.length === 0 && status.kind !== "loading"
              ? react.createElement("div", { className: "dmk-meta" }, "没有发现目标")
              : targets.map((target) => react.createElement(
                  "div",
                  { className: "dmk-row", key: target.name },
                  react.createElement("span", { className: "dmk-target" }, target.name),
                  defaultTarget === target.name
                    ? react.createElement("span", { className: "dmk-badge" }, "默认")
                    : null,
                  react.createElement("span", { className: "dmk-help" }, target.help || ""),
                  react.createElement(
                    "button",
                    { type: "button", className: "dmk-copy", title: "复制命令", onClick: () => copyTarget(target.name) },
                    copied === target.name ? "已复制" : "复制"
                  )
                ))
          )
        )
      );
    }

    // ── content width (merged from dsh-ui-width) ──────────────────────────
    const WIDTH_STORAGE_KEY = "dsh.uiWidth.pct";
    const WIDTH_DEFAULT_PCT = 100;
    const WIDTH_STEP_PCT = 5;
    const WIDTH_MIN_PCT = 50;
    const WIDTH_MAX_PCT = 100;

    function clampWidth(value) {
      const n = Math.round(Number(value) / WIDTH_STEP_PCT) * WIDTH_STEP_PCT;
      if (!Number.isFinite(n)) return WIDTH_DEFAULT_PCT;
      return Math.min(WIDTH_MAX_PCT, Math.max(WIDTH_MIN_PCT, n));
    }
    function readWidthPct() {
      try {
        const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
        return raw === null ? WIDTH_DEFAULT_PCT : clampWidth(raw);
      } catch {
        return WIDTH_DEFAULT_PCT;
      }
    }
    let widthStyleEl = null;
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
        // Storage may be unavailable (private mode); the session still applies.
      }
      return clamped;
    }

    function WidthGlyph() {
      return react.createElement(
        "svg",
        { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
        react.createElement("path", {
          d: "M3 9V7h18v2M3 15v2h18v-2M3 12h18",
          stroke: "currentColor",
          strokeWidth: 1.8,
          strokeLinecap: "round"
        })
      );
    }

    function WidthControl(props) {
      const getPct = props.getPct;
      const setPctInjected = props.setPct;
      const [open, setOpen] = react.useState(false);
      const [pct, setPctState] = react.useState(() => getPct());

      if (!open) {
        return react.createElement(
          "button",
          { type: "button", className: "dmw-action", title: "Content width", "aria-label": "Content width", onClick: () => setOpen(true) },
          react.createElement(WidthGlyph)
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

      return react.createElement(
        "div",
        { className: "dmw-overlay" },
        react.createElement("div", { className: "dmw-mask", onClick: onClose }),
        react.createElement(
          "div",
          { className: "dmw-card", role: "dialog", "aria-label": "Content width" },
          react.createElement(
            "div",
            { className: "dmw-title" },
            react.createElement("span", null, "Content width"),
            react.createElement("button", { type: "button", className: "dmw-close", onClick: onClose, "aria-label": "Close" }, "\u2715")
          ),
          react.createElement("div", { className: "dmw-value" }, pct + "%"),
          react.createElement("input", {
            type: "range",
            className: "dmw-slider",
            min: WIDTH_MIN_PCT,
            max: WIDTH_MAX_PCT,
            step: WIDTH_STEP_PCT,
            value: pct,
            onChange: onInput
          }),
          react.createElement("button", { type: "button", className: "dmw-reset", onClick: onReset }, "Reset 100%")
        )
      );
    }

    // ── file explorer tab (ported from oneirictouch/dsh-explorer-editor, MIT) ──
    const EXPLORER_API = "/dsh-unknownue-plugins/explorer/api";

    /**
     * HTTP adapter exposing the editor's `fileManager` remote surface over the
     * bundle's remote-aware explorer route. `setRoot` pins the session cwd
     * (local absolute path, ssh:// route, or dsw-routes placeholder); every
     * method then routes through the mixed fs/subprocess seams by that cwd.
     * Returns { ok, value } envelopes for the editor's unwrap().
     */
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
      const entriesOf = (value) => value.entries.map((e) => ({ name: e.name, type: e.type, size: e.size, mtimeMs: e.mtimeMs ?? null }));
      return {
        readDataUrl: (path) => envelope(call(EXPLORER_API, "readDataUrl", { cwd, path }).then((v) => ({ path: v.path, mime: v.mime, dataUrl: v.dataUrl }))),
        listDir: (path) => envelope(call(EXPLORER_API, "list", { cwd, path }).then((v) => ({ path: v.path, entries: entriesOf(v) }))),
        readText: (path) => envelope(call(EXPLORER_API, "read", { cwd, path }).then((v) => {
          if (v.tooLarge) throw new Error("file too large to open in the editor (" + v.size + " bytes)");
          return { path: v.path ?? path, content: v.content ?? "", mtimeMs: null, size: v.size };
        })),
        writeText: (path, content) => envelope(call(EXPLORER_API, "write", { cwd, path, content }).then(() => ({ path, operation: "update" }))),
        createFile: (path) => envelope(call(EXPLORER_API, "createFile", { cwd, path }).then((v) => ({ path: v.path, operation: "create" }))),
        createDirectory: (path) => envelope(call(EXPLORER_API, "createDirectory", { cwd, path }).then((v) => ({ path: v.path }))),
        rename: (from, to) => envelope(call(EXPLORER_API, "renamePath", { cwd, from, to }).then((v) => ({ from: v.from, to: v.to }))),
        copy: (from, to) => envelope(call(EXPLORER_API, "copyPath", { cwd, from, to }).then((v) => ({ from: v.from, to: v.to }))),
        delete: (path) => envelope(call(EXPLORER_API, "deletePath", { cwd, path }).then(() => ({ path }))),
        stat: (path) => envelope(call(EXPLORER_API, "statPath", { cwd, path }).then((v) => ({ path: v.path, type: v.type, size: v.size, mtimeMs: null }))),
        resolve: (path) => envelope(call(EXPLORER_API, "resolvePath", { cwd, path }).then((v) => ({ path: v.path }))),
        getRoot: () => ({ ok: true, value: { path: resolvedRoot !== "" ? resolvedRoot : cwd } }),
        setRoot: (path) => envelope(call(EXPLORER_API, "setRoot", { cwd, path }).then((v) => { cwd = String(path); resolvedRoot = v.path; return { path: v.path }; }))
      };
    }

    /**
     * The "文件" tab: the editor's file tree (FileManagerPanel) on the left,
     * the editor (FileEditorView: tabs + editor + markdown preview) on the
     * right, with a draggable splitter between them. The tree width is a
     * pixel budget shared with the editor pane (the pane takes the rest) and
     * is persisted in localStorage.
     */
    const TREE_WIDTH_KEY = "dsh.explorer.treeWidth";
    const TREE_WIDTH_DEFAULT = 300;
    const TREE_WIDTH_MIN = 160;
    const TREE_CONTENT_MIN = 240;

    function clampTreeWidth(value, containerWidth) {
      const n = Math.round(Number(value));
      const finite = Number.isFinite(n) ? n : TREE_WIDTH_DEFAULT;
      const upper = containerWidth !== undefined && containerWidth > 0
        ? Math.max(TREE_WIDTH_MIN, containerWidth - TREE_CONTENT_MIN)
        : 1200;
      return Math.min(upper, Math.max(TREE_WIDTH_MIN, finite));
    }

    function readTreeWidth() {
      try {
        return clampTreeWidth(localStorage.getItem(TREE_WIDTH_KEY) ?? TREE_WIDTH_DEFAULT);
      } catch {
        return TREE_WIDTH_DEFAULT;
      }
    }

    function ExplorerViewWrapper(props) {
      const containerRef = react.useRef(null);
      const dragRef = react.useRef(null);
      const widthRef = react.useRef(readTreeWidth());
      const [treeWidth, setTreeWidth] = react.useState(widthRef.current);
      // The conversation host scrolls its whole body (views grow with content,
      // a sticky composer overlays the bottom). Pin our view to the host's
      // measured viewport instead, so the panes keep independent scrollbars.
      const [viewHeight, setViewHeight] = react.useState(0);
      const [bottomClearance, setBottomClearance] = react.useState(0);

      react.useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const scroller = el.closest("[data-conversation-scroll]");
        if (!scroller) return;
        // The host reserves a scrollbar gutter (scrollbar-gutter:stable) even
        // when it never scrolls while our view is pinned. Reclaim that strip
        // for the duration of this view; restore on unmount so the chat and
        // trajectory tabs keep their shipped behavior.
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
          containerWidth: rect ? rect.width : undefined
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
        } catch { /* storage unavailable — the session width still applies */ }
      };

      return react.createElement(
        "div",
        {
          className: "dshfx-split",
          ref: containerRef,
          // Pinned to the host's measured viewport: the conversation body
          // scrolls as one by design, so we size ourselves to it and keep the
          // panes' own scrollbars independent. 100% is only the pre-measure
          // fallback for the first paint.
          style: { display: "flex", flexDirection: "row", height: viewHeight > 0 ? viewHeight + "px" : "100%", minHeight: 0, overflow: "hidden", position: "relative" }
        },
        react.createElement(
          "div",
          {
            className: "dshfx-tree-pane",
            // minWidth:0 defeats the flex item's content-based minimum (the
            // tree list is min-width:max-content); overflow is the internal
            // tree scroller's job, so the pane clips instead of scrolling.
            style: {
              width: treeWidth + "px",
              flex: "0 0 auto",
              minWidth: 0,
              overflow: "hidden",
              borderRight: "1px solid var(--dsw-alias-border-l2)",
              boxSizing: "border-box",
              paddingBottom: bottomClearance,
              "--dsh-scrollbar-thumb": "var(--dsw-alias-scrollbar-bg-l2)",
              "--dsh-scrollbar-thumb-hover": "var(--dsw-alias-scrollbar-hover-l2)"
            }
          },
          react.createElement(FileManagerPanel, { remote: props.remote, t: props.t, useSessions: props.useSessions, onFileOpened: () => {} })
        ),
        react.createElement("div", {
          className: "dshfx-resizer",
          role: "separator",
          "aria-orientation": "vertical",
          "aria-label": "调整文件树宽度",
          style: { flex: "0 0 auto", width: 6, cursor: "col-resize", touchAction: "none", position: "relative", zIndex: 1 },
          onPointerDown: onResizeStart,
          onPointerMove: onResizeMove,
          onPointerUp: onResizeEnd,
          onPointerCancel: onResizeEnd
        }),
        react.createElement(
          "div",
          {
            className: "dshfx-editor-pane",
            style: {
              flex: "1 1 0%",
              minWidth: 0,
              overflow: "hidden",
              paddingBottom: bottomClearance,
              // The shell's default thumb (scrollbar-bg-l1) is nearly
              // invisible on the editor theme's white background.
              "--dsh-scrollbar-thumb": "var(--dsw-alias-scrollbar-bg-l2)",
              "--dsh-scrollbar-thumb-hover": "var(--dsw-alias-scrollbar-hover-l2)"
            }
          },
          react.createElement(FileEditorView, { remote: props.remote, t: props.t })
        )
      );
    }

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/client/index.tsx


// src/client/remote.ts
var passthrough = { parse: (value) => value };
var jsonParam = (name) => ({
  name,
  wire: name,
  source: "json",
  codec: { mode: "strict", typeSymbol: "json", schema: passthrough }
});
var jsonResult = { mode: "strict", typeSymbol: "json", schema: passthrough };
var direct = (method, parameters) => ({
  id: `dsh-explorer-editor#fileManager/${method}`,
  service: "fileManager",
  namespace: "fileManager",
  method,
  invocation: { kind: "direct" },
  parameters: parameters.map(jsonParam),
  result: jsonResult
});
var TYPERT_REMOTE = {
  package: "dsh-explorer-editor",
  descriptors: [
    direct("listDir", ["path"]),
    direct("readText", ["path"]),
    direct("readDataUrl", ["path"]),
    direct("writeText", ["path", "content"]),
    direct("createFile", ["path"]),
    direct("createDirectory", ["path"]),
    direct("rename", ["from", "to"]),
    direct("copy", ["from", "to"]),
    direct("delete", ["path"]),
    direct("stat", ["path"]),
    direct("resolve", ["path"]),
    direct("getRoot", []),
    direct("setRoot", ["path"])
  ]
};
function unwrap(result) {
  if (result.ok) return result.value;
  const { code, message } = result.error;
  const err = new Error(`${message}${code ? ` (${code})` : ""}`);
  err.code = code;
  throw err;
}

// src/client/FileManagerPanel.tsx
var import_react5 = require("react");

// src/client/FileTree.tsx
var import_react3 = require("react");

// src/client/TreeContextMenu.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function TreeContextMenu({ x: x2, y: y2, items, t, onClose }) {
  const [position, setPosition] = (0, import_react.useState)(null);
  const [active, setActive] = (0, import_react.useState)(-1);
  const rootRef = (0, import_react.useRef)(null);
  const visible = (0, import_react.useMemo)(() => items.filter((item) => !item.separator), [items]);
  (0, import_react.useEffect)(() => {
    const el = rootRef.current;
    if (el === null) return;
    const rect = el.getBoundingClientRect();
    const left = Math.min(x2, window.innerWidth - rect.width - 4);
    const top = Math.min(y2, window.innerHeight - rect.height - 4);
    setPosition({ left: Math.max(4, left), top: Math.max(4, top) });
  }, [x2, y2]);
  (0, import_react.useEffect)(() => {
    const first = visible.findIndex((item) => !item.disabled);
    setActive(first);
  }, []);
  (0, import_react.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      ref: rootRef,
      className: "dshf-context-menu",
      role: "menu",
      "aria-label": t("contextMenu.label"),
      style: position === null ? { visibility: "hidden", left: x2, top: y2 } : { left: position.left, top: position.top },
      onContextMenu: (e) => e.preventDefault(),
      children: items.map((item, index) => {
        if (item.separator) {
          return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { role: "separator", className: "dshf-menu-sep" }, item.id);
        }
        const visibleIndex = visible.indexOf(item);
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
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
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dshf-menu-label", children: item.label }),
              item.shortcut !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dshf-menu-shortcut", children: item.shortcut })
            ]
          },
          item.id
        );
      })
    }
  );
}

// src/client/clipboard.ts
var import_react2 = require("react");
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
  return (0, import_react2.useSyncExternalStore)(subscribe, snapshot);
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

// src/client/paths.ts
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
  const f2 = normalizePosix(full);
  if (f2 === r) return "";
  if (!isInsideRoot(r, f2)) return full;
  return f2.slice(r === "" ? 0 : r.length + 1);
}
function baseName(path) {
  const p = normalizePosix(path);
  const i = p.lastIndexOf("/");
  return i < 0 ? p : p.slice(i + 1);
}

// src/client/cx.ts
function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

// src/client/i18n.ts
var NS = "dshFile";
function format(template, params) {
  return template.replace(/\{(\w+)\}/g, (token, key) => Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : token);
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

// src/client/FileTree.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var FileTree = (0, import_react3.forwardRef)(function FileTree2({ remote, root, t, onOpenFile, onDelete, onRenamed, onNotice }, ref) {
  const [expanded, setExpanded] = (0, import_react3.useState)({ [root]: { path: root, entries: null } });
  const [selected, setSelected] = (0, import_react3.useState)(null);
  const [editing, setEditing] = (0, import_react3.useState)(null);
  const [rev, setRev] = (0, import_react3.useState)(0);
  const [menu, setMenu] = (0, import_react3.useState)(null);
  const clipboard = useClipboard();
  const dirPaths = (0, import_react3.useRef)(/* @__PURE__ */ new Set());
  const visibleNodes = (0, import_react3.useRef)([]);
  const nodeEls = (0, import_react3.useRef)(/* @__PURE__ */ new Map());
  const rootRef = (0, import_react3.useRef)(root);
  rootRef.current = root;
  const expandedRef = (0, import_react3.useRef)(expanded);
  expandedRef.current = expanded;
  const editingRef = (0, import_react3.useRef)(editing);
  editingRef.current = editing;
  const menuRef = (0, import_react3.useRef)(menu);
  menuRef.current = menu;
  const parentOf = (0, import_react3.useCallback)(
    (p) => {
      const i = p.lastIndexOf("/");
      if (i <= 0) return root;
      return p.slice(0, i) || root;
    },
    [root]
  );
  const loadDir = (0, import_react3.useCallback)(
    async (path) => {
      setExpanded((prev) => ({ ...prev, [path]: { ...prev[path] ?? { path }, entries: null, error: void 0 } }));
      try {
        const value = unwrap(await remote.listDir(path));
        setExpanded((prev) => ({ ...prev, [path]: { path, entries: value.entries } }));
      } catch (error) {
        setExpanded((prev) => ({ ...prev, [path]: { path, entries: [], error: error instanceof Error ? error.message : String(error) } }));
      }
    },
    [remote]
  );
  (0, import_react3.useEffect)(() => {
    setEditing(null);
    setMenu(null);
    void loadDir(root);
  }, [root, rev, loadDir]);
  (0, import_react3.useEffect)(() => {
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
  (0, import_react3.useEffect)(() => {
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
  const closeMenu = (0, import_react3.useCallback)(() => setMenu(null), []);
  const copyToClipboard = (0, import_react3.useCallback)(async (text, okMessage) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) throw new Error(t("tree.clipboardUnavailable"));
      await navigator.clipboard.writeText(text);
      onNotice(okMessage);
    } catch (error) {
      onNotice(format(t("tree.copyFailed"), { message: error instanceof Error ? error.message : String(error) }));
    }
  }, [onNotice, t]);
  const pasteInto = (0, import_react3.useCallback)(
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
  const menuItems = (0, import_react3.useMemo)(() => {
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
        label: clipboard === null ? t("menu.paste") : format(clipboard.kind === "cut" ? t("menu.pasteMove") : t("menu.pasteCopy"), { name: baseName(clipboard.path) }),
        disabled: clipboard === null,
        onSelect: () => {
          if (clipboard !== null) void pasteInto(path, clipboard.path);
        }
      });
    }
    return items;
  }, [menu, clipboard, root, t, onNotice, copyToClipboard, pasteInto, onDelete]);
  const cwdTarget = (0, import_react3.useCallback)(() => {
    if (selected === null) return root;
    if (dirPaths.current.has(selected)) return selected;
    return parentOf(selected);
  }, [selected, root, parentOf]);
  const beginCreate = (0, import_react3.useCallback)(
    (kind) => {
      const parent = cwdTarget();
      if (parent !== root && expanded[parent] === void 0) void loadDir(parent);
      setSelected(parent);
      setEditing({ mode: "create", parent, kind });
    },
    [cwdTarget, expanded, loadDir, root]
  );
  (0, import_react3.useImperativeHandle)(ref, () => ({
    refresh: () => setRev((v2) => v2 + 1),
    beginCreate
  }), [beginCreate]);
  const cancelEdit = (0, import_react3.useCallback)(() => setEditing(null), []);
  const submitCreate = (0, import_react3.useCallback)(
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
  const submitRename = (0, import_react3.useCallback)(
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
  const activate = (0, import_react3.useCallback)((path, isDir) => {
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
  }, [expanded, loadDir, onOpenFile]);
  const handleTreeKeyDown = (0, import_react3.useCallback)((event) => {
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
  }, [editing, menu, selected, expanded, activate, loadDir]);
  const renderLevel = (0, import_react3.useCallback)(
    (path, entries, depth) => {
      const draftHere = editing?.mode === "create" && editing.parent === path ? editing : null;
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        draftHere !== null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
            isRenaming ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              InlineInput,
              {
                depth,
                isDir,
                initial: entry.name,
                t,
                onSubmit: submitRename,
                onCancel: cancelEdit
              }
            ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "div",
              {
                role: "treeitem",
                "aria-selected": selected === full,
                "aria-expanded": isDir ? isOpen ? true : false : void 0,
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
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dshf-caret", children: isDir ? isOpen ? "\u25BE" : "\u25B8" : "" }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: cx("dshf-icon", isDir ? "dshf-icon-dir" : "dshf-icon-file"), children: isDir ? "\u{1F4C1}" : "\u{1F4C4}" }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dshf-name", children: entry.name }),
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dshf-node-actions", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dshf-mini", title: t("tree.renameTitle"), onClick: (e) => {
                      e.stopPropagation();
                      setSelected(full);
                      setEditing({ mode: "rename", path: full });
                    }, children: "\u270E" }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dshf-mini", title: t("tree.deleteTitle"), onClick: (e) => {
                      e.stopPropagation();
                      onDelete(full);
                    }, children: "\u{1F5D1}" })
                  ] })
                ]
              }
            ),
            isDir && isOpen && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              DirChildren,
              {
                node: expanded[full],
                depth: depth + 1,
                t,
                onRender: renderLevel
              }
            )
          ] }, full);
        })
      ] });
    },
    [expanded, selected, editing, loadDir, onOpenFile, onDelete, submitCreate, submitRename, cancelEdit, activate, t]
  );
  const node = expanded[root];
  visibleNodes.current = [];
  dirPaths.current.clear();
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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
        node === void 0 ? null : node.entries === null ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshf-tree-hint", children: node.error ? format(t("tree.loadFailed"), { message: node.error }) : t("tree.loading") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshf-tree-list", children: [
          node.entries.length === 0 && editing?.mode !== "create" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshf-tree-hint", children: t("tree.empty") }),
          renderLevel(root, node.entries, 0)
        ] }),
        menu !== null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TreeContextMenu, { x: menu.x, y: menu.y, items: menuItems, t, onClose: closeMenu })
      ]
    }
  );
});
function DirChildren({ node, depth, t, onRender }) {
  if (node === void 0 || node.entries === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshf-tree-hint", style: { paddingLeft: `${8 + depth * 14}px` }, children: node?.error ? format(t("tree.loadFailed"), { message: node.error }) : t("tree.loading") });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: onRender(node.path, node.entries, depth) });
}
function InlineInput({ depth, isDir, initial, t, onSubmit, onCancel }) {
  const [value, setValue] = (0, import_react3.useState)(initial);
  const inputRef = (0, import_react3.useRef)(null);
  (0, import_react3.useEffect)(() => {
    const el = inputRef.current;
    if (el === null) return;
    el.focus();
    const dot = initial.lastIndexOf(".");
    if (initial !== "" && dot > 0) el.setSelectionRange(0, dot);
    else el.select();
  }, [initial]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshf-node dshf-node-editing", style: { paddingLeft: `${8 + depth * 14}px` }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dshf-caret" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: cx("dshf-icon", isDir ? "dshf-icon-dir" : "dshf-icon-file"), children: isDir ? "\u{1F4C1}" : "\u{1F4C4}" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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

// src/client/store.ts
var import_react4 = require("react");

// src/client/editorPersist.ts
var SNAPSHOT_KEY = "dsh-explorer-editor-session";
var MAX_PERSIST_CONTENT = 262144;
function shouldPersistContent(tab) {
  return tab.content.length <= MAX_PERSIST_CONTENT;
}
function filterByRoot(tabs2, root) {
  return tabs2.filter((t) => isInsideRoot(root, t.path));
}
function serialize(snapshot7) {
  return JSON.stringify(snapshot7);
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
var timer = null;
var pending2 = null;
function writeSnapshot(snapshot7) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SNAPSHOT_KEY, serialize(snapshot7));
  } catch {
    try {
      const slim = {
        root: snapshot7.root,
        activePath: snapshot7.activePath,
        tabs: snapshot7.tabs.map((t) => ({ path: t.path, mtimeMs: t.mtimeMs, dirty: t.dirty, error: t.error }))
      };
      localStorage.setItem(SNAPSHOT_KEY, serialize(slim));
    } catch {
    }
  }
}
function saveSnapshot(snapshot7) {
  pending2 = snapshot7;
  if (timer !== null) return;
  timer = setTimeout(() => {
    timer = null;
    if (pending2 !== null) {
      writeSnapshot(pending2);
      pending2 = null;
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
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
    pending2 = null;
  }
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
  }
}

// src/client/store.ts
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
function snapshot2() {
  return tabs;
}
function snapshotActive() {
  return activePath;
}
function useTabs() {
  return (0, import_react4.useSyncExternalStore)(subscribe2, snapshot2);
}
function useActivePath() {
  return (0, import_react4.useSyncExternalStore)(subscribe2, snapshotActive);
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
  tabs = tabs.map((t) => t.path === activePath ? { ...t, content, dirty: content !== t.savedContent } : t);
  emit2();
  persistNow();
}
function markSaved(path) {
  tabs = tabs.map((t) => t.path === path ? { ...t, savedContent: t.content, dirty: false } : t);
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
function isEditorViewActive() {
  return editorViewActive;
}
function subscribeEditorViewActive(listener) {
  viewListeners.add(listener);
  return () => {
    viewListeners.delete(listener);
  };
}

// src/client/FileManagerPanel.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function IconPlus(props) {
  const size = props.size ?? 16;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: { display: "block" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M8.64453 1.5V7.34961H14.5V8.65039H8.64453V14.5H7.34473V8.65039H1.5V7.34961H7.34473V1.5H8.64453Z", fill: "currentColor" }) });
}
function IconFolderAdd(props) {
  const size = props.size ?? 16;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: { display: "block" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { transform: "translate(9.52 2.52)", d: "M3.55246 0L3.55246 2.44252L6 2.44252L6 3.55748L3.55246 3.55748L3.55246 6L2.43834 6L2.43834 3.55748L0 3.55748L0 2.44252L2.43834 2.44252L2.43834 0L3.55246 0Z", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { transform: "translate(0.3496 2.35)", d: "M4.76367 0C5.36861 1.80598e-05 5.93113 0.310294 6.25488 0.821289L6.78027 1.64941C6.79685 1.67558 6.81791 1.69775 6.83887 1.71973C6.72186 2.15521 6.65702 2.61192 6.65137 3.08301C6.25601 2.96045 5.90909 2.70478 5.68164 2.3457L5.15723 1.5166C5.07183 1.38189 4.92318 1.3008 4.76367 1.30078L2.32422 1.30078C1.7589 1.30078 1.30078 1.7589 1.30078 2.32422L1.30078 10.1338C1.30078 10.6991 1.7589 11.1572 2.32422 11.1572L11.9766 11.1572C12.5419 11.1572 13 10.6991 13 8.58398C13.4545 8.5135 13.8903 8.38748 14.3008 8.21289L14.3008 10.1338C14.3008 11.4171 13.2598 12.458 11.9766 12.458L2.32422 12.458C1.04093 12.458 0 11.4171 0 10.1338L0 2.32422C0 1.04093 1.04093 0 2.32422 0L4.76367 0Z", fill: "currentColor" })
  ] });
}
function FileManagerPanel({ remote, t, useSessions, onFileOpened }) {
  const [root, setRoot] = (0, import_react5.useState)(null);
  const [rootError, setRootError] = (0, import_react5.useState)(null);
  const [busy, setBusy] = (0, import_react5.useState)(false);
  const [notice, setNotice] = (0, import_react5.useState)(null);
  const treeRef = (0, import_react5.useRef)(null);
  const sessionCwd = useSessions ? useSessions((s) => s.current !== void 0 ? s.byId[s.current]?.cwd : void 0) : void 0;
  const prevCwdRef = (0, import_react5.useRef)(void 0);
  (0, import_react5.useEffect)(() => {
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
        const { path } = unwrap(await remote.getRoot());
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
  const handleNotice = (0, import_react5.useCallback)((message) => {
    setNotice(message);
  }, []);
  const openFile = (0, import_react5.useCallback)(
    async (path) => {
      if (isTabOpen(path)) {
        focusTab(path);
        onFileOpened?.();
        return;
      }
      setBusy(true);
      try {
        const value = unwrap(await remote.readText(path));
        openTab({ path, content: value.content, savedContent: value.content, mtimeMs: value.mtimeMs, dirty: false });
        onFileOpened?.();
      } catch (error) {
        handleNotice(format(t("panel.openFailed"), { message: error instanceof Error ? error.message : String(error) }));
      } finally {
        setBusy(false);
      }
    },
    [remote, t, handleNotice, onFileOpened]
  );
  const handleCreate = (0, import_react5.useCallback)((kind) => {
    treeRef.current?.beginCreate(kind);
  }, []);
  const handleRenamed = (0, import_react5.useCallback)((from, to) => {
    renameTab(from, to);
  }, []);
  const [pendingDelete, setPendingDelete] = (0, import_react5.useState)(null);
  const handleDelete = (0, import_react5.useCallback)((path) => {
    setPendingDelete(path);
  }, []);
  const confirmDelete = (0, import_react5.useCallback)(
    async () => {
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
    },
    [pendingDelete, remote, t, handleNotice]
  );
  const title = (0, import_react5.useMemo)(() => {
    if (root === null) return "\u2026";
    return root.split("/").filter(Boolean).pop() || "/";
  }, [root]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dshf-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dshf-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dshf-title", title: root ?? "", children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dshf-spacer" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dshf-btn dshf-btn-icon", title: t("panel.newFile"), "aria-label": t("panel.newFile"), onClick: () => handleCreate("file"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconPlus, {}) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dshf-btn dshf-btn-icon", title: t("panel.newDirectory"), "aria-label": t("panel.newDirectory"), onClick: () => handleCreate("directory"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconFolderAdd, {}) })
    ] }),
    rootError !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dshf-error", children: rootError }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dshf-tree-pane", children: root !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dshf-status", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dshf-status-busy", children: busy ? "\u2026" : "" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: cx("dshf-status-notice", notice === null && "dshf-hidden"), children: notice ?? "" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dshf-spacer" })
    ] }),
    pendingDelete !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
function DeleteConfirmDialog({ path, t, onConfirm, onCancel }) {
  const name = path.split("/").pop() ?? path;
  const confirmRef = (0, import_react5.useRef)(null);
  (0, import_react5.useEffect)(() => {
    confirmRef.current?.focus();
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dshf-modal", role: "alertdialog", "aria-modal": "true", "aria-label": format(t("panel.deleteTitle"), { name }), onClick: (e) => e.stopPropagation(), children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dshf-modal-title", children: format(t("panel.deleteTitle"), { name }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dshf-modal-body", children: format(t("panel.deleteBody"), { name }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dshf-modal-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dshf-btn", onClick: onCancel, children: t("panel.cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { ref: confirmRef, type: "button", className: "dshf-btn dshf-btn-danger", onClick: onConfirm, children: t("panel.delete") })
        ] })
      ] })
    }
  );
}

// src/client/FileEditorView.tsx
var import_react8 = require("react");

// src/client/monaco.ts
var MONACO_VERSION = "0.52.2";
var MONACO_MIRRORS = [
  `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`,
  `https://unpkg.com/monaco-editor@${MONACO_VERSION}/min/vs`,
  `https://fastly.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`
];
var MONACO_MIRROR_OVERRIDE_KEY = "dsh-explorer-editor:monaco-mirror";
var loading = null;
var failed = false;
function mirrorBases() {
  let override = null;
  try {
    if (typeof localStorage !== "undefined") override = localStorage.getItem(MONACO_MIRROR_OVERRIDE_KEY);
  } catch {
  }
  if (override !== null && override.trim() !== "") return [override.trim(), ...MONACO_MIRRORS];
  return MONACO_MIRRORS;
}
function loadLoader(base) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = `${base}/loader.js`;
    el.async = true;
    el.addEventListener("load", () => resolve());
    el.addEventListener("error", () => reject(new Error(`failed to load monaco loader: ${base}`)));
    document.head.append(el);
  });
}
function ensureMonaco() {
  if (failed) return Promise.reject(new Error("monaco previously failed to load"));
  if (loading) return loading;
  loading = (async () => {
    for (const base of mirrorBases()) {
      try {
        await loadLoader(base);
      } catch {
        continue;
      }
      try {
        await new Promise((resolve, reject) => {
          window.require.config({ paths: { vs: base } });
          window.require(["vs/editor/editor.main"], () => resolve(), (err) => reject(err));
        });
        return window.monaco;
      } catch (error) {
        failed = true;
        loading = null;
        throw error instanceof Error ? error : new Error(String(error));
      }
    }
    failed = true;
    loading = null;
    throw new Error("failed to load monaco loader from any mirror");
  })();
  return loading;
}

// node_modules/marked/lib/marked.esm.js
function C() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var R = C();
function j(l3) {
  R = l3;
}
var z = { exec: () => null };
function A(l3) {
  let e = [];
  return (t) => {
    let n = Math.max(0, Math.min(3, t - 1)), s = e[n];
    return s || (s = l3(n), e[n] = s), s;
  };
}
function k(l3, e = "") {
  let t = typeof l3 == "string" ? l3 : l3.source, n = { replace: (s, r) => {
    let i = typeof r == "string" ? r : r.source;
    return i = i.replace(m.caret, "$1"), t = t.replace(s, i), n;
  }, getRegex: () => new RegExp(t, e) };
  return n;
}
var Te = ((l3 = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + l3);
  } catch {
    return false;
  }
})();
var m = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (l3) => new RegExp(`^( {0,3}${l3})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: A((l3) => new RegExp(`^ {0,${l3}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: A((l3) => new RegExp(`^ {0,${l3}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)), fencesBeginRegex: A((l3) => new RegExp(`^ {0,${l3}}(?:\`\`\`|~~~)`)), headingBeginRegex: A((l3) => new RegExp(`^ {0,${l3}}#`)), htmlBeginRegex: A((l3) => new RegExp(`^ {0,${l3}}<(?:[a-z].*>|!--)`, "i")), blockquoteBeginRegex: A((l3) => new RegExp(`^ {0,${l3}}>`)) };
var Oe = /^(?:[ \t]*(?:\n|$))+/;
var we = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var ye = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var q = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var Pe = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var U = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
var oe = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var ae = k(oe).replace(/bull/g, U).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var Se = k(oe).replace(/bull/g, U).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var K = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/;
var _e = /^[^\n]+/;
var W = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
var $e = k(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", W).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var Le = k(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, U).getRegex();
var Q = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var X = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var Me = k("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", X).replace("tag", Q).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var le = (l3) => k(K).replace("hr", q).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", l3).replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Q).getRegex();
var ze = le(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/);
var Ee = le(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/);
var Ce = k(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", Ee).getRegex();
var J = { blockquote: Ce, code: we, def: $e, fences: ye, heading: Pe, hr: q, html: Me, lheading: ae, list: Le, newline: Oe, paragraph: ze, table: z, text: _e };
var se = k("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", q).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Q).getRegex();
var Ae = { ...J, lheading: Se, table: se, paragraph: k(K).replace("hr", q).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", se).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Q).getRegex() };
var Ie = { ...J, html: k(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", X).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: z, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: k(K).replace("hr", q).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", ae).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() };
var Be = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var De = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var pe = /^( {2,}|\\)\n(?!\s*$)/;
var qe = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var _ = /[\p{P}\p{S}]/u;
var I = /[\s\p{P}\p{S}]/u;
var v = /[^\s\p{P}\p{S}]/u;
var ve = k(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, I).getRegex();
var He = /[\p{Pi}\p{Ps}"']/u;
var ue = /(?!~)[\p{P}\p{S}]/u;
var Ze = /(?!~)[\s\p{P}\p{S}]/u;
var Ge = /(?:[^\s\p{P}\p{S}]|~)/u;
var Qe = k(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", Te ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
var ce = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
var Ne = k(ce, "u").replace(/punct/g, _).getRegex();
var je = k(ce, "u").replace(/punct/g, ue).getRegex();
var Fe = /^(?:\*+(?:((?!\*)(?!openQuote)punct)|([^\s*]))?)|^_+(?:((?!_)(?!openQuote)punct)|([^\s_]))?/;
var Ue = k(Fe, "u").replace(/openQuote/g, He).replace(/punct/g, _).getRegex();
var he = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var Ke = k(he, "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, I).replace(/punct/g, _).getRegex();
var We = k(he, "gu").replace(/notPunctSpace/g, Ge).replace(/punctSpace/g, Ze).replace(/punct/g, ue).getRegex();
var Xe = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)[\\s](\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|(?:(?!\\*)punct|notPunctSpace)(\\*+)(?!\\*)(?=notPunctSpace)";
var Je = k(Xe, "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, I).replace(/punct/g, _).getRegex();
var Ve = k("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, I).replace(/punct/g, _).getRegex();
var Ye = "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)[\\s](_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)|(?:(?!_)punct|notPunctSpace)(_+)(?!_)(?=notPunctSpace)";
var et = k(Ye, "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, I).replace(/punct/g, _).getRegex();
var tt = k(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, _).getRegex();
var nt = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)";
var rt = k(nt, "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, I).replace(/punct/g, _).getRegex();
var st = k(/\\(punct)/, "gu").replace(/punct/g, _).getRegex();
var it = k(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var ot = k(X).replace("(?:-->|$)", "-->").getRegex();
var at = k("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", ot).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var G = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/;
var lt = k(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", G).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var de = k(/^!?\[(label)\]\[(ref)\]/).replace("label", G).replace("ref", W).getRegex();
var ke = k(/^!?\[(ref)\](?:\[\])?/).replace("ref", W).getRegex();
var pt = k("reflink|nolink(?!\\()", "g").replace("reflink", de).replace("nolink", ke).getRegex();
var ie = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
var V = { _backpedal: z, anyPunctuation: st, autolink: it, blockSkip: Qe, br: pe, code: De, del: z, delLDelim: z, delRDelim: z, emStrongLDelim: Ne, emStrongRDelimAst: Ke, emStrongRDelimUnd: Ve, escape: Be, link: lt, nolink: ke, punctuation: ve, reflink: de, reflinkSearch: pt, tag: at, text: qe, url: z };
var ut = { ...V, emStrongLDelim: Ue, emStrongRDelimAst: Je, emStrongRDelimUnd: et, link: k(/^!?\[(label)\]\((.*?)\)/).replace("label", G).getRegex(), reflink: k(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", G).getRegex() };
var F = { ...V, emStrongRDelimAst: We, emStrongLDelim: je, delLDelim: tt, delRDelim: rt, url: k(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", ie).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: k(/^(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", ie).getRegex() };
var ct = { ...F, br: k(pe).replace("{2,}", "*").getRegex(), text: k(F.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() };
var H = { normal: J, gfm: Ae, pedantic: Ie };
var B = { normal: V, gfm: F, breaks: ct, pedantic: ut };
var ht = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var ge = (l3) => ht[l3];
function O(l3, e) {
  if (e) {
    if (m.escapeTest.test(l3)) return l3.replace(m.escapeReplace, ge);
  } else if (m.escapeTestNoEncode.test(l3)) return l3.replace(m.escapeReplaceNoEncode, ge);
  return l3;
}
function Y(l3) {
  try {
    l3 = encodeURI(l3).replace(m.percentDecode, "%");
  } catch {
    return null;
  }
  return l3;
}
function ee(l3, e) {
  let t = l3.replace(m.findPipe, (r, i, o) => {
    let p = false, a = i;
    for (; --a >= 0 && o[a] === "\\"; ) p = !p;
    return p ? "|" : " |";
  }), n = t.split(m.splitPipe), s = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), e) if (n.length > e) n.splice(e);
  else for (; n.length < e; ) n.push("");
  for (; s < n.length; s++) n[s] = n[s].trim().replace(m.slashPipe, "|");
  return n;
}
function $(l3, e, t) {
  let n = l3.length;
  if (n === 0) return "";
  let s = 0;
  for (; s < n; ) {
    let r = l3.charAt(n - s - 1);
    if (r === e && !t) s++;
    else if (r !== e && t) s++;
    else break;
  }
  return l3.slice(0, n - s);
}
function te(l3) {
  let e = l3.split(`
`), t = e.length - 1;
  for (; t >= 0 && m.blankLine.test(e[t]); ) t--;
  return e.length - t <= 2 ? l3 : e.slice(0, t + 1).join(`
`);
}
function fe(l3, e) {
  if (l3.indexOf(e[1]) === -1) return -1;
  let t = 0;
  for (let n = 0; n < l3.length; n++) if (l3[n] === "\\") n++;
  else if (l3[n] === e[0]) t++;
  else if (l3[n] === e[1] && (t--, t < 0)) return n;
  return t > 0 ? -2 : -1;
}
function me(l3, e = 0) {
  let t = e, n = "";
  for (let s of l3) if (s === "	") {
    let r = 4 - t % 4;
    n += " ".repeat(r), t += r;
  } else n += s, t++;
  return n;
}
function xe(l3, e, t, n, s) {
  let r = e.href, i = e.title || null, o = l3[1].replace(s.other.outputLinkReplace, "$1");
  n.state.inLink = true;
  let p = { type: l3[0].charAt(0) === "!" ? "image" : "link", raw: t, href: r, title: i, text: o, tokens: n.inlineTokens(o) };
  return n.state.inLink = false, p;
}
function dt(l3, e, t) {
  let n = l3.match(t.other.indentCodeCompensation);
  if (n === null) return e;
  let s = n[1];
  return e.split(`
`).map((r) => {
    let i = r.match(t.other.beginningSpace);
    if (i === null) return r;
    let [o] = i;
    return o.length >= s.length ? r.slice(s.length) : r;
  }).join(`
`);
}
var y = class {
  constructor(e) {
    __publicField(this, "options");
    __publicField(this, "rules");
    __publicField(this, "lexer");
    this.options = e || R;
  }
  space(e) {
    let t = this.rules.block.newline.exec(e);
    if (t && t[0].length > 0) return { type: "space", raw: t[0] };
  }
  code(e) {
    let t = this.rules.block.code.exec(e);
    if (t) {
      let n = this.options.pedantic ? t[0] : te(t[0]), s = n.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: n, codeBlockStyle: "indented", text: s };
    }
  }
  fences(e) {
    let t = this.rules.block.fences.exec(e);
    if (t) {
      let n = t[0], s = dt(n, t[3] || "", this.rules);
      return { type: "code", raw: n, lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2], text: s };
    }
  }
  heading(e) {
    let t = this.rules.block.heading.exec(e);
    if (t) {
      let n = t[2].trim();
      if (this.rules.other.endingHash.test(n)) {
        let s = $(n, "#");
        (this.options.pedantic || !s || this.rules.other.endingSpaceChar.test(s)) && (n = s.trim());
      }
      return { type: "heading", raw: $(t[0], `
`), depth: t[1].length, text: n, tokens: this.lexer.inline(n) };
    }
  }
  hr(e) {
    let t = this.rules.block.hr.exec(e);
    if (t) return { type: "hr", raw: $(t[0], `
`) };
  }
  blockquote(e) {
    let t = this.rules.block.blockquote.exec(e);
    if (t) {
      let n = $(t[0], `
`).split(`
`), s = "", r = "", i = [];
      for (; n.length > 0; ) {
        let o = false, p = [], a;
        for (a = 0; a < n.length; a++) if (this.rules.other.blockquoteStart.test(n[a])) p.push(n[a]), o = true;
        else if (!o) p.push(n[a]);
        else break;
        n = n.slice(a);
        let u = p.join(`
`), c = u.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        s = s ? `${s}
${u}` : u, r = r ? `${r}
${c}` : c;
        let h = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(c, i, true), this.lexer.state.top = h, n.length === 0) break;
        let d = i.at(-1);
        if (d?.type === "code") break;
        if (d?.type === "blockquote") {
          let T = d, g = n.join(`
`), w = T.raw + `
` + g.replace(this.rules.other.blockquoteSetextReplace2, ""), M = this.blockquote(w);
          i[i.length - 1] = M, s = `${s}
${g}`, r = r.substring(0, r.length - T.text.length) + M.text;
          break;
        } else if (d?.type === "list") {
          let T = d, g = T.raw + `
` + n.join(`
`), w = this.list(g);
          i[i.length - 1] = w, s = s.substring(0, s.length - d.raw.length) + w.raw, r = r.substring(0, r.length - T.raw.length) + w.raw, n = g.substring(i.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: s, tokens: i, text: r };
    }
  }
  list(e) {
    let t = this.rules.block.list.exec(e);
    if (t) {
      let n = t[1].trim(), s = n.length > 1, r = { type: "list", raw: "", ordered: s, start: s ? +n.slice(0, -1) : "", loose: false, items: [] };
      n = s ? `\\d{1,9}\\${n.slice(-1)}` : `\\${n}`, this.options.pedantic && (n = s ? n : "[*+-]");
      let i = this.rules.other.listItemRegex(n), o = false;
      for (; e; ) {
        let a = false, u = "", c = "";
        if (!(t = i.exec(e)) || this.rules.block.hr.test(e)) break;
        u = t[0], e = e.substring(u.length);
        let h = me(t[2].split(`
`, 1)[0], t[1].length), d = e.split(`
`, 1)[0], T = !h.trim(), g = 0;
        if (this.options.pedantic ? (g = 2, c = h.trimStart()) : T ? g = t[1].length + 1 : (g = h.search(this.rules.other.nonSpaceChar), g = g > 4 ? 1 : g, c = h.slice(g), g += t[1].length), T && this.rules.other.blankLine.test(d) && (u += d + `
`, e = e.substring(d.length + 1), a = true), !a) {
          let w = this.rules.other.nextBulletRegex(g), M = this.rules.other.hrRegex(g), ne = this.rules.other.fencesBeginRegex(g), re = this.rules.other.headingBeginRegex(g), be = this.rules.other.htmlBeginRegex(g), Re = this.rules.other.blockquoteBeginRegex(g);
          for (; e; ) {
            let N = e.split(`
`, 1)[0], D;
            if (d = N, this.options.pedantic ? (d = d.replace(this.rules.other.listReplaceNesting, "  "), D = d) : D = d.replace(this.rules.other.tabCharGlobal, "    "), ne.test(d) || re.test(d) || be.test(d) || Re.test(d) || w.test(d) || M.test(d)) break;
            if (D.search(this.rules.other.nonSpaceChar) >= g || !d.trim()) c += `
` + D.slice(g);
            else {
              if (T || h.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || ne.test(h) || re.test(h) || M.test(h)) break;
              c += `
` + d;
            }
            T = !d.trim(), u += N + `
`, e = e.substring(N.length + 1), h = D.slice(g);
          }
        }
        r.loose || (o ? r.loose = true : this.rules.other.doubleBlankLine.test(u) && (o = true)), r.items.push({ type: "list_item", raw: u, task: !!this.options.gfm && this.rules.other.listIsTask.test(c), loose: false, text: c, tokens: [] }), r.raw += u;
      }
      let p = r.items.at(-1);
      if (p) p.raw = p.raw.trimEnd(), p.text = p.text.trimEnd();
      else return;
      r.raw = r.raw.trimEnd();
      for (let a of r.items) {
        this.lexer.state.top = false, a.tokens = this.lexer.blockTokens(a.text, []);
        let u = a.tokens[0];
        if (a.task && (u?.type === "text" || u?.type === "paragraph")) {
          a.text = a.text.replace(this.rules.other.listReplaceTask, ""), u.raw = u.raw.replace(this.rules.other.listReplaceTask, ""), u.text = u.text.replace(this.rules.other.listReplaceTask, "");
          for (let h = this.lexer.inlineQueue.length - 1; h >= 0; h--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[h].src)) {
            this.lexer.inlineQueue[h].src = this.lexer.inlineQueue[h].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let c = this.rules.other.listTaskCheckbox.exec(a.raw);
          if (c) {
            let h = { type: "checkbox", raw: c[0] + " ", checked: c[0] !== "[ ]" };
            a.checked = h.checked, r.loose ? a.tokens[0] && ["paragraph", "text"].includes(a.tokens[0].type) && "tokens" in a.tokens[0] && a.tokens[0].tokens ? (a.tokens[0].raw = h.raw + a.tokens[0].raw, a.tokens[0].text = h.raw + a.tokens[0].text, a.tokens[0].tokens.unshift(h)) : a.tokens.unshift({ type: "paragraph", raw: h.raw, text: h.raw, tokens: [h] }) : a.tokens.unshift(h);
          }
        } else a.task && (a.task = false);
        if (!r.loose) {
          let c = a.tokens.filter((d) => d.type === "space"), h = c.length > 0 && c.some((d) => this.rules.other.anyLine.test(d.raw));
          r.loose = h;
        }
      }
      if (r.loose) for (let a of r.items) {
        a.loose = true;
        for (let u of a.tokens) u.type === "text" && (u.type = "paragraph");
      }
      return r;
    }
  }
  html(e) {
    let t = this.rules.block.html.exec(e);
    if (t) {
      let n = te(t[0]);
      return { type: "html", block: true, raw: n, pre: t[1] === "pre" || t[1] === "script" || t[1] === "style", text: n };
    }
  }
  def(e) {
    let t = this.rules.block.def.exec(e);
    if (t) {
      let n = t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), s = t[2] ? t[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", r = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
      return { type: "def", tag: n, raw: $(t[0], `
`), href: s, title: r };
    }
  }
  table(e) {
    let t = this.rules.block.table.exec(e);
    if (!t || !this.rules.other.tableDelimiter.test(t[2])) return;
    let n = ee(t[1]), s = t[2].replace(this.rules.other.tableAlignChars, "").split("|"), r = t[3]?.trim() ? t[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], i = { type: "table", raw: $(t[0], `
`), header: [], align: [], rows: [] };
    if (n.length === s.length) {
      for (let o of s) this.rules.other.tableAlignRight.test(o) ? i.align.push("right") : this.rules.other.tableAlignCenter.test(o) ? i.align.push("center") : this.rules.other.tableAlignLeft.test(o) ? i.align.push("left") : i.align.push(null);
      for (let o = 0; o < n.length; o++) i.header.push({ text: n[o], tokens: this.lexer.inline(n[o]), header: true, align: i.align[o] });
      for (let o of r) i.rows.push(ee(o, i.header.length).map((p, a) => ({ text: p, tokens: this.lexer.inline(p), header: false, align: i.align[a] })));
      return i;
    }
  }
  lheading(e) {
    let t = this.rules.block.lheading.exec(e);
    if (t) {
      let n = t[1].trim();
      return { type: "heading", raw: $(t[0], `
`), depth: t[2].charAt(0) === "=" ? 1 : 2, text: n, tokens: this.lexer.inline(n) };
    }
  }
  paragraph(e) {
    let t = this.rules.block.paragraph.exec(e);
    if (t) {
      let n = t[1].charAt(t[1].length - 1) === `
` ? t[1].slice(0, -1) : t[1];
      return { type: "paragraph", raw: t[0], text: n, tokens: this.lexer.inline(n) };
    }
  }
  text(e) {
    let t = this.rules.block.text.exec(e);
    if (t) return { type: "text", raw: t[0], text: t[0], tokens: this.lexer.inline(t[0]) };
  }
  escape(e) {
    let t = this.rules.inline.escape.exec(e);
    if (t) return { type: "escape", raw: t[0], text: t[1] };
  }
  tag(e) {
    let t = this.rules.inline.tag.exec(e);
    if (t) return !this.lexer.state.inLink && this.rules.other.startATag.test(t[0]) ? this.lexer.state.inLink = true : this.lexer.state.inLink && this.rules.other.endATag.test(t[0]) && (this.lexer.state.inLink = false), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t[0]) ? this.lexer.state.inRawBlock = true : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t[0]) && (this.lexer.state.inRawBlock = false), { type: "html", raw: t[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: t[0] };
  }
  link(e) {
    let t = this.rules.inline.link.exec(e);
    if (t) {
      let n = t[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(n)) {
        if (!this.rules.other.endAngleBracket.test(n)) return;
        let i = $(n.slice(0, -1), "\\");
        if ((n.length - i.length) % 2 === 0) return;
      } else {
        let i = fe(t[2], "()");
        if (i === -2) return;
        if (i > -1) {
          let p = (t[0].indexOf("!") === 0 ? 5 : 4) + t[1].length + i;
          t[2] = t[2].substring(0, i), t[0] = t[0].substring(0, p).trim(), t[3] = "";
        }
      }
      let s = t[2], r = "";
      if (this.options.pedantic) {
        let i = this.rules.other.pedanticHrefTitle.exec(s);
        i && (s = i[1], r = i[3]);
      } else r = t[3] ? t[3].slice(1, -1) : "";
      return s = s.trim(), this.rules.other.startAngleBracket.test(s) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(n) ? s = s.slice(1) : s = s.slice(1, -1)), xe(t, { href: s && s.replace(this.rules.inline.anyPunctuation, "$1"), title: r && r.replace(this.rules.inline.anyPunctuation, "$1") }, t[0], this.lexer, this.rules);
    }
  }
  reflink(e, t) {
    let n;
    if ((n = this.rules.inline.reflink.exec(e)) || (n = this.rules.inline.nolink.exec(e))) {
      let s = (n[2] || n[1]).replace(this.rules.other.multipleSpaceGlobal, " "), r = t[s.toLowerCase()];
      if (!r) {
        let i = n[0].charAt(0);
        return { type: "text", raw: i, text: i };
      }
      return xe(n, r, n[0], this.lexer, this.rules);
    }
  }
  emStrong(e, t, n = "") {
    let s = this.rules.inline.emStrongLDelim.exec(e);
    if (!s || !s[1] && !s[2] && !s[3] && !s[4] || s[4] && n.match(this.rules.other.unicodeAlphaNumeric)) return;
    if (!(s[1] || s[3] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let i = [...s[0]].length - 1, o, p, a = i, u = 0, c = s[0][0], h = n === c, d = c === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (d.lastIndex = 0, t = t.slice(-1 * e.length + i); (s = d.exec(t)) !== null; ) {
        if (o = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !o) continue;
        if (p = [...o].length, s[3] || s[4]) {
          a += p;
          continue;
        } else if (s[5] || s[6]) {
          if (i % 3 && !((i + p) % 3)) {
            u += p;
            continue;
          }
          if (h) break;
        }
        if (a -= p, a > 0) continue;
        p = Math.min(p, p + a + u);
        let T = [...s[0]][0].length, g = e.slice(0, i + s.index + T + p);
        if (Math.min(i, p) % 2) {
          let M = g.slice(1, -1);
          return { type: "em", raw: g, text: M, tokens: this.lexer.inlineTokens(M) };
        }
        let w = g.slice(2, -2);
        return { type: "strong", raw: g, text: w, tokens: this.lexer.inlineTokens(w) };
      }
    }
  }
  codespan(e) {
    let t = this.rules.inline.code.exec(e);
    if (t) {
      let n = t[2].replace(this.rules.other.newLineCharGlobal, " "), s = this.rules.other.nonSpaceChar.test(n), r = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
      return s && r && (n = n.substring(1, n.length - 1)), { type: "codespan", raw: t[0], text: n };
    }
  }
  br(e) {
    let t = this.rules.inline.br.exec(e);
    if (t) return { type: "br", raw: t[0] };
  }
  del(e, t, n = "") {
    let s = this.rules.inline.delLDelim.exec(e);
    if (!s) return;
    if (!(s[1] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let i = [...s[0]].length - 1, o, p, a = i, u = this.rules.inline.delRDelim;
      for (u.lastIndex = 0, t = t.slice(-1 * e.length + i); (s = u.exec(t)) !== null; ) {
        if (o = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !o || (p = [...o].length, p !== i)) continue;
        if (s[3] || s[4]) {
          a += p;
          continue;
        }
        if (a -= p, a > 0) continue;
        p = Math.min(p, p + a);
        let c = [...s[0]][0].length, h = e.slice(0, i + s.index + c + p), d = h.slice(i, -i);
        return { type: "del", raw: h, text: d, tokens: this.lexer.inlineTokens(d) };
      }
    }
  }
  autolink(e) {
    let t = this.rules.inline.autolink.exec(e);
    if (t) {
      let n, s;
      return t[2] === "@" ? (n = t[1], s = "mailto:" + n) : (n = t[1], s = n), { type: "link", raw: t[0], text: n, href: s, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  url(e) {
    let t;
    if (t = this.rules.inline.url.exec(e)) {
      let n, s;
      if (t[2] === "@") n = t[0], s = "mailto:" + n;
      else {
        let r;
        do
          r = t[0], t[0] = this.rules.inline._backpedal.exec(t[0])?.[0] ?? "";
        while (r !== t[0]);
        n = t[0], t[1] === "www." ? s = "http://" + t[0] : s = t[0];
      }
      return { type: "link", raw: t[0], text: n, href: s, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  inlineText(e) {
    let t = this.rules.inline.text.exec(e);
    if (t) {
      let n = this.lexer.state.inRawBlock;
      return { type: "text", raw: t[0], text: t[0], escaped: n };
    }
  }
};
var x = class l {
  constructor(e) {
    __publicField(this, "tokens");
    __publicField(this, "options");
    __publicField(this, "state");
    __publicField(this, "inlineQueue");
    __publicField(this, "tokenizer");
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e || R, this.options.tokenizer = this.options.tokenizer || new y(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, top: true };
    let t = { other: m, block: H.normal, inline: B.normal };
    this.options.pedantic ? (t.block = H.pedantic, t.inline = B.pedantic) : this.options.gfm && (t.block = H.gfm, this.options.breaks ? t.inline = B.breaks : t.inline = B.gfm), this.tokenizer.rules = t;
  }
  static get rules() {
    return { block: H, inline: B };
  }
  static lex(e, t) {
    return new l(t).lex(e);
  }
  static lexInline(e, t) {
    return new l(t).inlineTokens(e);
  }
  lex(e) {
    e = e.replace(m.carriageReturn, `
`), this.blockTokens(e, this.tokens);
    for (let t = 0; t < this.inlineQueue.length; t++) {
      let n = this.inlineQueue[t];
      this.inlineTokens(n.src, n.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e, t = [], n = false) {
    this.tokenizer.lexer = this, this.options.pedantic && (e = e.replace(m.tabCharGlobal, "    ").replace(m.spaceLine, ""));
    let s = 1 / 0;
    for (; e; ) {
      if (e.length < s) s = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      let r;
      if (this.options.extensions?.block?.some((o) => (r = o.call({ lexer: this }, e, t)) ? (e = e.substring(r.raw.length), t.push(r), true) : false)) continue;
      if (r = this.tokenizer.space(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        r.raw.length === 1 && o !== void 0 ? o.raw += `
` : t.push(r);
        continue;
      }
      if (r = this.tokenizer.code(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.at(-1).src = o.text) : t.push(r);
        continue;
      }
      if (r = this.tokenizer.fences(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.heading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.hr(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.blockquote(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.list(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.html(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.def(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.raw, this.inlineQueue.at(-1).src = o.text) : this.tokens.links[r.tag] || (this.tokens.links[r.tag] = { href: r.href, title: r.title }, t.push(r));
        continue;
      }
      if (r = this.tokenizer.table(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.lheading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      let i = e;
      if (this.options.extensions?.startBlock) {
        let o = 1 / 0, p = e.slice(1), a;
        this.options.extensions.startBlock.forEach((u) => {
          a = u.call({ lexer: this }, p), typeof a == "number" && a >= 0 && (o = Math.min(o, a));
        }), o < 1 / 0 && o >= 0 && (i = e.substring(0, o + 1));
      }
      if (this.state.top && (r = this.tokenizer.paragraph(i))) {
        let o = t.at(-1);
        n && o?.type === "paragraph" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : t.push(r), n = i.length !== e.length, e = e.substring(r.raw.length);
        continue;
      }
      if (r = this.tokenizer.text(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : t.push(r);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return this.state.top = true, t;
  }
  inline(e, t = []) {
    return this.inlineQueue.push({ src: e, tokens: t }), t;
  }
  inlineTokens(e, t = []) {
    this.tokenizer.lexer = this;
    let n = e;
    if (this.tokens.links) {
      let o = Object.keys(this.tokens.links);
      o.length > 0 && (n = n.replace(this.tokenizer.rules.inline.reflinkSearch, (p) => o.includes(p.slice(p.lastIndexOf("[") + 1, -1)) ? "[" + "a".repeat(p.length - 2) + "]" : p));
    }
    n = n.replace(this.tokenizer.rules.inline.anyPunctuation, "++"), n = n.replace(this.tokenizer.rules.inline.blockSkip, (o, p, a) => {
      let u = a ? a.length : 0;
      return o.slice(0, u) + "[" + "a".repeat(o.length - u - 2) + "]";
    }), n = this.options.hooks?.emStrongMask?.call({ lexer: this }, n) ?? n;
    let s = false, r = "", i = 1 / 0;
    for (; e; ) {
      if (e.length < i) i = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      s || (r = ""), s = false;
      let o;
      if (this.options.extensions?.inline?.some((a) => (o = a.call({ lexer: this }, e, t)) ? (e = e.substring(o.raw.length), t.push(o), true) : false)) continue;
      if (o = this.tokenizer.escape(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.tag(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.link(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.reflink(e, this.tokens.links)) {
        e = e.substring(o.raw.length);
        let a = t.at(-1);
        o.type === "text" && a?.type === "text" ? (a.raw += o.raw, a.text += o.text) : t.push(o);
        continue;
      }
      if (o = this.tokenizer.emStrong(e, n, r)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.codespan(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.br(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.del(e, n, r)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.autolink(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (!this.state.inLink && (o = this.tokenizer.url(e))) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      let p = e;
      if (this.options.extensions?.startInline) {
        let a = 1 / 0, u = e.slice(1), c;
        this.options.extensions.startInline.forEach((h) => {
          c = h.call({ lexer: this }, u), typeof c == "number" && c >= 0 && (a = Math.min(a, c));
        }), a < 1 / 0 && a >= 0 && (p = e.substring(0, a + 1));
      }
      if (o = this.tokenizer.inlineText(p)) {
        e = e.substring(o.raw.length), o.raw.slice(-1) !== "_" && (r = o.raw.slice(-1)), s = true;
        let a = t.at(-1);
        a?.type === "text" ? (a.raw += o.raw, a.text += o.text) : t.push(o);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return t;
  }
  infiniteLoopError(e) {
    let t = "Infinite loop on byte: " + e;
    if (this.options.silent) console.error(t);
    else throw new Error(t);
  }
};
var P = class {
  constructor(e) {
    __publicField(this, "options");
    __publicField(this, "parser");
    this.options = e || R;
  }
  space(e) {
    return "";
  }
  code({ text: e, lang: t, escaped: n }) {
    let s = (t || "").match(m.notSpaceStart)?.[0], r = e.replace(m.endingNewline, "") + `
`;
    return s ? '<pre><code class="language-' + O(s) + '">' + (n ? r : O(r, true)) + `</code></pre>
` : "<pre><code>" + (n ? r : O(r, true)) + `</code></pre>
`;
  }
  blockquote({ tokens: e }) {
    return `<blockquote>
${this.parser.parse(e)}</blockquote>
`;
  }
  html({ text: e }) {
    return e;
  }
  def(e) {
    return "";
  }
  heading({ tokens: e, depth: t }) {
    return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`;
  }
  hr(e) {
    return `<hr>
`;
  }
  list(e) {
    let t = e.ordered, n = e.start, s = "";
    for (let o = 0; o < e.items.length; o++) {
      let p = e.items[o];
      s += this.listitem(p);
    }
    let r = t ? "ol" : "ul", i = t && n !== 1 ? ' start="' + n + '"' : "";
    return "<" + r + i + `>
` + s + "</" + r + `>
`;
  }
  listitem(e) {
    return `<li>${this.parser.parse(e.tokens)}</li>
`;
  }
  checkbox({ checked: e }) {
    return "<input " + (e ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: e }) {
    return `<p>${this.parser.parseInline(e)}</p>
`;
  }
  table(e) {
    let t = "", n = "";
    for (let r = 0; r < e.header.length; r++) n += this.tablecell(e.header[r]);
    t += this.tablerow({ text: n });
    let s = "";
    for (let r = 0; r < e.rows.length; r++) {
      let i = e.rows[r];
      n = "";
      for (let o = 0; o < i.length; o++) n += this.tablecell(i[o]);
      s += this.tablerow({ text: n });
    }
    return s && (s = `<tbody>${s}</tbody>`), `<table>
<thead>
` + t + `</thead>
` + s + `</table>
`;
  }
  tablerow({ text: e }) {
    return `<tr>
${e}</tr>
`;
  }
  tablecell(e) {
    let t = this.parser.parseInline(e.tokens), n = e.header ? "th" : "td";
    return (e.align ? `<${n} align="${e.align}">` : `<${n}>`) + t + `</${n}>
`;
  }
  strong({ tokens: e }) {
    return `<strong>${this.parser.parseInline(e)}</strong>`;
  }
  em({ tokens: e }) {
    return `<em>${this.parser.parseInline(e)}</em>`;
  }
  codespan({ text: e }) {
    return `<code>${O(e, true)}</code>`;
  }
  br(e) {
    return "<br>";
  }
  del({ tokens: e }) {
    return `<del>${this.parser.parseInline(e)}</del>`;
  }
  link({ href: e, title: t, tokens: n }) {
    let s = this.parser.parseInline(n), r = Y(e);
    if (r === null) return s;
    e = r;
    let i = '<a href="' + e + '"';
    return t && (i += ' title="' + O(t) + '"'), i += ">" + s + "</a>", i;
  }
  image({ href: e, title: t, text: n, tokens: s }) {
    s && (n = this.parser.parseInline(s, this.parser.textRenderer));
    let r = Y(e);
    if (r === null) return O(n);
    e = r;
    let i = `<img src="${e}" alt="${O(n)}"`;
    return t && (i += ` title="${O(t)}"`), i += ">", i;
  }
  text(e) {
    return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : "escaped" in e && e.escaped ? e.text : O(e.text);
  }
};
var L = class {
  strong({ text: e }) {
    return e;
  }
  em({ text: e }) {
    return e;
  }
  codespan({ text: e }) {
    return e;
  }
  del({ text: e }) {
    return e;
  }
  html({ text: e }) {
    return e;
  }
  text({ text: e }) {
    return e;
  }
  link({ text: e }) {
    return "" + e;
  }
  image({ text: e }) {
    return "" + e;
  }
  br() {
    return "";
  }
  checkbox({ raw: e }) {
    return e;
  }
};
var b = class l2 {
  constructor(e) {
    __publicField(this, "options");
    __publicField(this, "renderer");
    __publicField(this, "textRenderer");
    this.options = e || R, this.options.renderer = this.options.renderer || new P(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new L();
  }
  static parse(e, t) {
    return new l2(t).parse(e);
  }
  static parseInline(e, t) {
    return new l2(t).parseInline(e);
  }
  parse(e) {
    this.renderer.parser = this;
    let t = "";
    for (let n = 0; n < e.length; n++) {
      let s = e[n];
      if (this.options.extensions?.renderers?.[s.type]) {
        let i = s, o = this.options.extensions.renderers[i.type].call({ parser: this }, i);
        if (o !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "checkbox", "html", "def", "paragraph", "text"].includes(i.type)) {
          t += o || "";
          continue;
        }
      }
      let r = s;
      switch (r.type) {
        case "space": {
          t += this.renderer.space(r);
          break;
        }
        case "hr": {
          t += this.renderer.hr(r);
          break;
        }
        case "heading": {
          t += this.renderer.heading(r);
          break;
        }
        case "code": {
          t += this.renderer.code(r);
          break;
        }
        case "table": {
          t += this.renderer.table(r);
          break;
        }
        case "blockquote": {
          t += this.renderer.blockquote(r);
          break;
        }
        case "list": {
          t += this.renderer.list(r);
          break;
        }
        case "checkbox": {
          t += this.renderer.checkbox(r);
          break;
        }
        case "html": {
          t += this.renderer.html(r);
          break;
        }
        case "def": {
          t += this.renderer.def(r);
          break;
        }
        case "paragraph": {
          t += this.renderer.paragraph(r);
          break;
        }
        case "text": {
          t += this.renderer.text(r);
          break;
        }
        default: {
          let i = 'Token with "' + r.type + '" type was not found.';
          if (this.options.silent) return console.error(i), "";
          throw new Error(i);
        }
      }
    }
    return t;
  }
  parseInline(e, t = this.renderer) {
    this.renderer.parser = this;
    let n = "";
    for (let s = 0; s < e.length; s++) {
      let r = e[s];
      if (this.options.extensions?.renderers?.[r.type]) {
        let o = this.options.extensions.renderers[r.type].call({ parser: this }, r);
        if (o !== false || !["escape", "html", "link", "image", "checkbox", "strong", "em", "codespan", "br", "del", "text"].includes(r.type)) {
          n += o || "";
          continue;
        }
      }
      let i = r;
      switch (i.type) {
        case "escape": {
          n += t.text(i);
          break;
        }
        case "html": {
          n += t.html(i);
          break;
        }
        case "link": {
          n += t.link(i);
          break;
        }
        case "image": {
          n += t.image(i);
          break;
        }
        case "checkbox": {
          n += t.checkbox(i);
          break;
        }
        case "strong": {
          n += t.strong(i);
          break;
        }
        case "em": {
          n += t.em(i);
          break;
        }
        case "codespan": {
          n += t.codespan(i);
          break;
        }
        case "br": {
          n += t.br(i);
          break;
        }
        case "del": {
          n += t.del(i);
          break;
        }
        case "text": {
          n += t.text(i);
          break;
        }
        default: {
          let o = 'Token with "' + i.type + '" type was not found.';
          if (this.options.silent) return console.error(o), "";
          throw new Error(o);
        }
      }
    }
    return n;
  }
};
var _a;
var S = (_a = class {
  constructor(e) {
    __publicField(this, "options");
    __publicField(this, "block");
    this.options = e || R;
  }
  preprocess(e) {
    return e;
  }
  postprocess(e) {
    return e;
  }
  processAllTokens(e) {
    return e;
  }
  emStrongMask(e) {
    return e;
  }
  provideLexer(e = this.block) {
    return e ? x.lex : x.lexInline;
  }
  provideParser(e = this.block) {
    return e ? b.parse : b.parseInline;
  }
}, __publicField(_a, "passThroughHooks", /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"])), __publicField(_a, "passThroughHooksRespectAsync", /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"])), _a);
var Z = class {
  constructor(...e) {
    __publicField(this, "defaults", C());
    __publicField(this, "options", this.setOptions);
    __publicField(this, "parse", this.parseMarkdown(true));
    __publicField(this, "parseInline", this.parseMarkdown(false));
    __publicField(this, "Parser", b);
    __publicField(this, "Renderer", P);
    __publicField(this, "TextRenderer", L);
    __publicField(this, "Lexer", x);
    __publicField(this, "Tokenizer", y);
    __publicField(this, "Hooks", S);
    this.use(...e);
  }
  walkTokens(e, t) {
    let n = [];
    for (let s of e) switch (n = n.concat(t.call(this, s)), s.type) {
      case "table": {
        let r = s;
        for (let i of r.header) n = n.concat(this.walkTokens(i.tokens, t));
        for (let i of r.rows) for (let o of i) n = n.concat(this.walkTokens(o.tokens, t));
        break;
      }
      case "list": {
        let r = s;
        n = n.concat(this.walkTokens(r.items, t));
        break;
      }
      default: {
        let r = s;
        this.defaults.extensions?.childTokens?.[r.type] ? this.defaults.extensions.childTokens[r.type].forEach((i) => {
          let o = r[i].flat(1 / 0);
          n = n.concat(this.walkTokens(o, t));
        }) : r.tokens && (n = n.concat(this.walkTokens(r.tokens, t)));
      }
    }
    return n;
  }
  use(...e) {
    let t = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e.forEach((n) => {
      let s = { ...n };
      if (s.async = this.defaults.async || s.async || false, n.extensions && (n.extensions.forEach((r) => {
        if (!r.name) throw new Error("extension name required");
        if ("renderer" in r) {
          let i = t.renderers[r.name];
          i ? t.renderers[r.name] = function(...o) {
            let p = r.renderer.apply(this, o);
            return p === false && (p = i.apply(this, o)), p;
          } : t.renderers[r.name] = r.renderer;
        }
        if ("tokenizer" in r) {
          if (!r.level || r.level !== "block" && r.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let i = t[r.level];
          i ? i.unshift(r.tokenizer) : t[r.level] = [r.tokenizer], r.start && (r.level === "block" ? t.startBlock ? t.startBlock.push(r.start) : t.startBlock = [r.start] : r.level === "inline" && (t.startInline ? t.startInline.push(r.start) : t.startInline = [r.start]));
        }
        "childTokens" in r && r.childTokens && (t.childTokens[r.name] = r.childTokens);
      }), s.extensions = t), n.renderer) {
        let r = this.defaults.renderer || new P(this.defaults);
        for (let i in n.renderer) {
          if (!(i in r)) throw new Error(`renderer '${i}' does not exist`);
          if (["options", "parser"].includes(i)) continue;
          let o = i, p = n.renderer[o], a = r[o];
          r[o] = (...u) => {
            let c = p.apply(r, u);
            return c === false && (c = a.apply(r, u)), c || "";
          };
        }
        s.renderer = r;
      }
      if (n.tokenizer) {
        let r = this.defaults.tokenizer || new y(this.defaults);
        for (let i in n.tokenizer) {
          if (!(i in r)) throw new Error(`tokenizer '${i}' does not exist`);
          if (["options", "rules", "lexer"].includes(i)) continue;
          let o = i, p = n.tokenizer[o], a = r[o];
          r[o] = (...u) => {
            let c = p.apply(r, u);
            return c === false && (c = a.apply(r, u)), c;
          };
        }
        s.tokenizer = r;
      }
      if (n.hooks) {
        let r = this.defaults.hooks || new S();
        for (let i in n.hooks) {
          if (!(i in r)) throw new Error(`hook '${i}' does not exist`);
          if (["options", "block"].includes(i)) continue;
          let o = i, p = n.hooks[o], a = r[o];
          S.passThroughHooks.has(i) ? r[o] = (u) => {
            if (this.defaults.async && S.passThroughHooksRespectAsync.has(i)) return (async () => {
              let h = await p.call(r, u);
              return a.call(r, h);
            })();
            let c = p.call(r, u);
            return a.call(r, c);
          } : r[o] = (...u) => {
            if (this.defaults.async) return (async () => {
              let h = await p.apply(r, u);
              return h === false && (h = await a.apply(r, u)), h;
            })();
            let c = p.apply(r, u);
            return c === false && (c = a.apply(r, u)), c;
          };
        }
        s.hooks = r;
      }
      if (n.walkTokens) {
        let r = this.defaults.walkTokens, i = n.walkTokens;
        s.walkTokens = function(o) {
          let p = [];
          return p.push(i.call(this, o)), r && (p = p.concat(r.call(this, o))), p;
        };
      }
      this.defaults = { ...this.defaults, ...s };
    }), this;
  }
  setOptions(e) {
    return this.defaults = { ...this.defaults, ...e }, this;
  }
  lexer(e, t) {
    return x.lex(e, t ?? this.defaults);
  }
  parser(e, t) {
    return b.parse(e, t ?? this.defaults);
  }
  parseMarkdown(e) {
    return (n, s) => {
      let r = { ...s }, i = { ...this.defaults, ...r }, o = this.onError(!!i.silent, !!i.async);
      if (this.defaults.async === true && r.async === false) return o(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof n > "u" || n === null) return o(new Error("marked(): input parameter is undefined or null"));
      if (typeof n != "string") return o(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n) + ", string expected"));
      if (i.hooks && (i.hooks.options = i, i.hooks.block = e), i.async) return (async () => {
        let p = i.hooks ? await i.hooks.preprocess(n) : n, u = await (i.hooks ? await i.hooks.provideLexer(e) : e ? x.lex : x.lexInline)(p, i), c = i.hooks ? await i.hooks.processAllTokens(u) : u;
        i.walkTokens && await Promise.all(this.walkTokens(c, i.walkTokens));
        let d = await (i.hooks ? await i.hooks.provideParser(e) : e ? b.parse : b.parseInline)(c, i);
        return i.hooks ? await i.hooks.postprocess(d) : d;
      })().catch(o);
      try {
        i.hooks && (n = i.hooks.preprocess(n));
        let a = (i.hooks ? i.hooks.provideLexer(e) : e ? x.lex : x.lexInline)(n, i);
        i.hooks && (a = i.hooks.processAllTokens(a)), i.walkTokens && this.walkTokens(a, i.walkTokens);
        let c = (i.hooks ? i.hooks.provideParser(e) : e ? b.parse : b.parseInline)(a, i);
        return i.hooks && (c = i.hooks.postprocess(c)), c;
      } catch (p) {
        return o(p);
      }
    };
  }
  onError(e, t) {
    return (n) => {
      if (n.message += `
Please report this to https://github.com/markedjs/marked.`, e) {
        let s = "<p>An error occurred:</p><pre>" + O(n.message + "", true) + "</pre>";
        return t ? Promise.resolve(s) : s;
      }
      if (t) return Promise.reject(n);
      throw n;
    };
  }
};
var E = new Z();
function f(l3, e) {
  return E.parse(l3, e);
}
f.options = f.setOptions = function(l3) {
  return E.setOptions(l3), f.defaults = E.defaults, j(f.defaults), f;
};
f.getDefaults = C;
f.defaults = R;
function kt(...l3) {
  return E.use(...l3), f.defaults = E.defaults, j(f.defaults), f;
}
f.use = kt;
f.walkTokens = function(l3, e) {
  return E.walkTokens(l3, e);
};
f.parseInline = E.parseInline;
f.Parser = b;
f.parser = b.parse;
f.Renderer = P;
f.TextRenderer = L;
f.Lexer = x;
f.lexer = x.lex;
f.Tokenizer = y;
f.Hooks = S;
f.parse = f;
var nn = f.options;
var rn = f.setOptions;
var sn = f.walkTokens;
var on = f.parseInline;
var ln = b.parse;
var pn = x.lex;

// src/client/markdown.ts
f.use({
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    }
  }
});
function renderMarkdown(text) {
  try {
    const html = f.parse(text, { gfm: true, breaks: true });
    return typeof html === "string" ? html : String(html);
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

// src/client/mdModeStore.ts
var import_react6 = require("react");
var DEFAULT_MD_MODE = "source";
var MD_MODE_STORAGE_KEY = "dsh-explorer-editor:md-mode:v2";
var VALID = /* @__PURE__ */ new Set(["preview", "source"]);
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
var current = loadMdMode(safeStorage());
var listeners3 = /* @__PURE__ */ new Set();
function emit3() {
  for (const listener of listeners3) listener();
}
function safeStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : void 0;
  } catch {
    return void 0;
  }
}
function subscribe3(listener) {
  listeners3.add(listener);
  return () => {
    listeners3.delete(listener);
  };
}
function snapshot3() {
  return current;
}
function useMdMode() {
  return (0, import_react6.useSyncExternalStore)(subscribe3, snapshot3);
}
function setMdMode(mode) {
  current = mode;
  const storage = safeStorage();
  if (storage !== void 0) persistMdMode(mode, storage);
  emit3();
}

// src/client/themeStore.ts
var import_react7 = require("react");
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
function rgbToHex(r, g, b2) {
  const c = (x2) => Math.max(0, Math.min(255, Math.round(x2))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b2)}`;
}
function mixColors(a, b2, amount) {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b2);
  return rgbToHex(ar + (br - ar) * amount, ag + (bg - ag) * amount, ab + (bb - ab) * amount);
}
function luminanceOf(hex) {
  const [r, g, b2] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b2) / 255;
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
var current2 = load();
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
function snapshot4() {
  return current2;
}
function useEditorTheme() {
  return (0, import_react7.useSyncExternalStore)(subscribe4, snapshot4);
}
function setEditorTheme(partial) {
  current2 = { ...current2, ...partial };
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(current2));
  } catch {
  }
  emit4();
}
function resetEditorTheme() {
  current2 = { ...DEFAULT_EDITOR_THEME };
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
  emit4();
}
function presetIdOf(theme) {
  for (const [id, preset] of Object.entries(EDITOR_THEME_PRESETS)) {
    if (preset.background === theme.background && preset.foreground === theme.foreground) return id;
  }
  return void 0;
}
function exportThemeText(theme, name) {
  return JSON.stringify({
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
  }, null, 2);
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
function themeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// src/client/FileEditorView.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function FileEditorView({ remote, t }) {
  const tabs2 = useTabs();
  const activePath2 = useActivePath();
  const active = activePath2 === null ? void 0 : tabs2.find((t2) => t2.path === activePath2);
  const [busy, setBusy] = (0, import_react8.useState)(false);
  const [notice, setNotice] = (0, import_react8.useState)(null);
  const theme = useEditorTheme();
  const chrome = themeChrome(theme);
  const mdMode = useMdMode();
  (0, import_react8.useEffect)(() => {
    setEditorViewActive(true);
    return () => setEditorViewActive(false);
  }, []);
  const saveActive = (0, import_react8.useCallback)(async () => {
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
  const saveRef = (0, import_react8.useRef)(saveActive);
  saveRef.current = saveActive;
  (0, import_react8.useEffect)(() => {
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
    "--dshf-bg": theme.background,
    "--dshf-fg": theme.foreground,
    "--dshf-chrome": chrome.chrome,
    "--dshf-border": chrome.border,
    "--dshf-muted": chrome.muted,
    "--dshf-chip": chrome.chip,
    "--dshf-dirty": chrome.dirty,
    "--dshf-accent": "#094771",
    "--dshf-font-size": `${theme.fontSize}px`
  };
  if (active === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dshf-editor-view", style: themeVars, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dshf-editor-toolbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dshf-title", children: t("view.label") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dshf-spacer" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ThemeButton, { t })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dshf-empty", children: t("view.empty") })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dshf-editor-view", style: themeVars, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dshf-editor-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: cx("dshf-tabname", active.dirty && "dshf-dirty"), title: active.path, children: [
        active.dirty ? "\u25CF " : "",
        active.path.split("/").pop()
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dshf-spacer" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dshf-editor-path", title: active.path, children: active.path }),
      isMarkdownPath(active.path) && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          type: "button",
          className: "dshf-btn dshf-md-toggle",
          title: mdMode === "preview" ? t("md.sourceTitle") : t("md.previewTitle"),
          onClick: () => setMdMode(mdMode === "preview" ? "source" : "preview"),
          children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(MdModeIcon, { mode: mdMode })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ThemeButton, { t }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: cx("dshf-status", "dshf-status-top"), children: [
      tabs2.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dshf-tabs-strip", children: tabs2.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "span",
        {
          className: cx("dshf-tab-chip", tab.path === activePath2 && "dshf-tab-chip-active"),
          title: tab.path,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                type: "button",
                className: "dshf-tab-chip-name",
                onClick: () => focusTab(tab.path),
                children: tab.path.split("/").pop()
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dshf-status-meta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dshf-status-busy", children: busy ? "\u2026" : "" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: cx("dshf-status-notice", notice === null && "dshf-hidden"), children: notice ?? "" })
      ] })
    ] }),
    isMarkdownPath(active.path) && mdMode === "preview" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(MarkdownPreview, { content: active.content, path: active.path, remote }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
function themeErrorMessage(t, error) {
  const code = error?.code;
  switch (code) {
    case "invalid-json":
      return t("theme.errorInvalidJson");
    case "not-object":
      return t("theme.errorNotObject");
    case "missing-background":
      return t("theme.errorMissingBackground");
    case "missing-foreground":
      return t("theme.errorMissingForeground");
    default:
      return error instanceof Error ? error.message : String(error);
  }
}
function ThemeButton({ t }) {
  const [open, setOpen] = (0, import_react8.useState)(false);
  const [importError, setImportError] = (0, import_react8.useState)(null);
  const fileRef = (0, import_react8.useRef)(null);
  const theme = useEditorTheme();
  const presetId = presetIdOf(theme);
  const handleExport = () => {
    const name = presetId !== void 0 ? `dsh-explorer-editor \xB7 ${EDITOR_THEME_PRESET_LABELS[presetId] ?? presetId}` : `dsh-explorer-editor \xB7 ${t("theme.custom")}`;
    const text = exportThemeText(theme, name);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dsh-explorer-editor-theme-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseImportedTheme(String(reader.result ?? ""));
        setEditorTheme({ background: imported.background, foreground: imported.foreground, fontSize: imported.fontSize });
        setImportError(null);
      } catch (error) {
        setImportError(themeErrorMessage(t, error));
      }
    };
    reader.onerror = () => setImportError(t("theme.readFailed"));
    reader.readAsText(file);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dshf-theme-wrap", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        type: "button",
        className: "dshf-btn",
        title: t("theme.title"),
        onClick: () => setOpen((v2) => !v2),
        children: t("theme.button")
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dshf-theme-panel", role: "dialog", "aria-label": t("theme.panelLabel"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: "dshf-theme-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dshf-theme-label", children: t("theme.preset") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "select",
          {
            className: "dshf-theme-select",
            value: presetId ?? "custom",
            onChange: (e) => {
              const preset = EDITOR_THEME_PRESETS[e.target.value];
              if (preset) setEditorTheme(preset);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: "custom", disabled: true, children: t("theme.custom") }),
              EDITOR_THEME_PRESET_ORDER.map((id) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: id, children: EDITOR_THEME_PRESET_LABELS[id] ?? id }, id))
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: "dshf-theme-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dshf-theme-label", children: t("theme.background") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            type: "color",
            value: theme.background,
            onChange: (e) => setEditorTheme({ background: e.target.value })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { className: "dshf-theme-hex", children: theme.background })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: "dshf-theme-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dshf-theme-label", children: t("theme.foreground") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            type: "color",
            value: theme.foreground,
            onChange: (e) => setEditorTheme({ foreground: e.target.value })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { className: "dshf-theme-hex", children: theme.foreground })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: "dshf-theme-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dshf-theme-label", children: t("theme.fontSize") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            type: "number",
            className: "dshf-theme-fontsize",
            min: 10,
            max: 28,
            value: theme.fontSize,
            onChange: (e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) setEditorTheme({ fontSize: n });
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dshf-theme-unit", children: "px" })
      ] }),
      importError !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dshf-theme-error", children: importError }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dshf-theme-row dshf-theme-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dshf-btn", title: t("theme.export"), onClick: handleExport, children: t("theme.export") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dshf-btn", title: t("theme.import"), onClick: () => fileRef.current?.click(), children: t("theme.import") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            ref: fileRef,
            type: "file",
            accept: ".json,application/json",
            className: "dshf-hidden-input",
            onChange: handleImportFile
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dshf-btn", title: t("theme.reset"), onClick: () => resetEditorTheme(), children: t("theme.reset") })
      ] })
    ] })
  ] });
}
function EditorPane({ path, content, onChange, theme, t }) {
  const [mode, setMode] = (0, import_react8.useState)("loading");
  const [monacoLib, setMonacoLib] = (0, import_react8.useState)(null);
  const hostRef = (0, import_react8.useRef)(null);
  const editorRef = (0, import_react8.useRef)(null);
  const onChangeRef = (0, import_react8.useRef)(onChange);
  onChangeRef.current = onChange;
  const initialRef = (0, import_react8.useRef)(content);
  initialRef.current = content;
  (0, import_react8.useEffect)(() => {
    let disposed = false;
    setMode("loading");
    ensureMonaco().then((monaco) => {
      if (disposed) return;
      setMonacoLib(monaco);
      setMode("monaco");
    }).catch(() => {
      if (!disposed) setMode("textarea");
    });
    return () => {
      disposed = true;
      setMonacoLib(null);
    };
  }, [path]);
  (0, import_react8.useEffect)(() => {
    if (mode !== "monaco" || monacoLib === null || hostRef.current === null) return;
    const initial = initialRef.current;
    const monacoAny = monacoLib;
    const editor = monacoAny.editor.create(hostRef.current, {
      value: initial,
      language: languageOf(path),
      automaticLayout: true,
      fontSize: theme.fontSize,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      tabSize: 2
    });
    editor.onDidChangeModelContent(() => onChangeRef.current(editor.getValue()));
    editorRef.current = editor;
    return () => {
      editor.dispose();
      editorRef.current = null;
    };
  }, [mode, monacoLib, path]);
  (0, import_react8.useEffect)(() => {
    if (mode !== "monaco" || monacoLib === null) return;
    const monacoAny = monacoLib;
    try {
      const light = isLightColor(theme.background);
      monacoAny.editor.defineTheme("dshf-editor", {
        base: light ? "vs" : "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": theme.background,
          "editor.foreground": theme.foreground,
          "editorLineNumber.foreground": mixColors(theme.foreground, theme.background, 0.45),
          "editorLineNumber.activeForeground": theme.foreground,
          "editorCursor.foreground": theme.foreground,
          "editor.selectionBackground": light ? "#add6ff" : "#264f78",
          "editor.inactiveSelectionBackground": light ? "#e5ebf1" : "#3a3d41",
          "editor.lineHighlightBackground": light ? "#e3edf7" : "#282a2d",
          "editorWidget.background": mixColors(theme.background, light ? "#000000" : "#ffffff", 0.08),
          "editorWidget.border": mixColors(theme.background, light ? "#000000" : "#ffffff", 0.2),
          "scrollbarSlider.background": mixColors(theme.foreground, theme.background, 0.2),
          "scrollbarSlider.hoverBackground": mixColors(theme.foreground, theme.background, 0.3)
        }
      });
      monacoAny.editor.setTheme("dshf-editor");
    } catch {
    }
    editorRef.current?.updateOptions?.({ fontSize: theme.fontSize });
  }, [mode, monacoLib, theme.background, theme.foreground, theme.fontSize]);
  if (mode === "loading") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dshf-empty", children: t("editor.loading") });
  }
  if (mode === "monaco") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { ref: hostRef, className: "dshf-monaco" });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "textarea",
    {
      className: "dshf-textarea",
      value: content,
      onChange: (e) => onChange(e.target.value),
      spellCheck: false
    }
  );
}
function MarkdownPreview({ content, path, remote }) {
  const html = (0, import_react8.useMemo)(() => renderMarkdown(content), [content]);
  const rootRef = (0, import_react8.useRef)(null);
  const remoteRef = (0, import_react8.useRef)(remote);
  remoteRef.current = remote;
  (0, import_react8.useEffect)(() => {
    const root = rootRef.current;
    if (root === null) return;
    const dir = path.slice(0, path.lastIndexOf("/") + 1);
    const imgs = root.querySelectorAll("img[src]");
    let cancelled = false;
    for (const img of imgs) {
      const src = img.getAttribute("src") ?? "";
      if (/^(?:https?:|data:|blob:)/i.test(src)) continue;
      if (src.startsWith("#")) continue;
      const target = src.startsWith("/") ? src.slice(1) : `${dir}${src}`;
      void remoteRef.current.readDataUrl(target).then((result) => unwrap(result)).then(({ dataUrl }) => {
        if (cancelled) return;
        img.setAttribute("src", dataUrl);
      }).catch(() => {
      });
    }
    return () => {
      cancelled = true;
    };
  }, [html, path]);
  const onPreviewClick = (0, import_react8.useCallback)((e) => {
    const anchor = e.target.closest("a");
    if (anchor === null) return;
    const href = anchor.getAttribute("href") ?? "";
    e.preventDefault();
    if (/^https?:\/\//i.test(href)) {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "div",
    {
      ref: rootRef,
      className: "dshf-md-preview",
      onClick: onPreviewClick,
      dangerouslySetInnerHTML: { __html: html }
    }
  );
}
function MdModeIcon({ mode }) {
  if (mode === "preview") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M4 2h8v1H4zM2 4h12v1H2zM4 6h8v1H4zM2 8h12v1H2zM4 10h4v1H4z", fill: "currentColor" }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M11.3 1.3l3.4 3.4-7.9 7.9L3 13l.4-3.8 7.9-7.9z", fill: "currentColor" }) });
}
function languageOf(path) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
    case "mts":
    case "cts":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "less":
      return "less";
    case "py":
      return "python";
    case "rb":
      return "ruby";
    case "go":
      return "go";
    case "rs":
      return "rust";
    case "java":
      return "java";
    case "c":
    case "h":
      return "c";
    case "cpp":
    case "cc":
    case "hpp":
      return "cpp";
    case "cs":
      return "csharp";
    case "sh":
    case "bash":
      return "shell";
    case "yml":
    case "yaml":
      return "yaml";
    case "xml":
    case "svg":
      return "xml";
    case "sql":
      return "sql";
    case "php":
      return "php";
    case "vue":
      return "html";
    case "svelte":
      return "html";
    default:
      return "plaintext";
  }
}

// src/client/sidebarTabsStore.ts
var import_react9 = require("react");
var DEFAULT_SIDEBAR_TAB = "workspace";
var current3 = DEFAULT_SIDEBAR_TAB;
var listeners5 = /* @__PURE__ */ new Set();
function emit5() {
  for (const listener of listeners5) listener();
}
function subscribe5(listener) {
  listeners5.add(listener);
  return () => {
    listeners5.delete(listener);
  };
}
function snapshot5() {
  return current3;
}
function useSidebarTab() {
  return (0, import_react9.useSyncExternalStore)(subscribe5, snapshot5);
}
function setSidebarTab(tab) {
  if (current3 === tab) return;
  current3 = tab;
  emit5();
}

// src/client/SidebarTabs.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function SidebarTabs({ wide, expandSidebar, onSelectFile, onSelectWorkspace, t }) {
  const tab = useSidebarTab();
  const workspaceLabel = t("workspace.tab");
  const fileLabel = t("view.label");
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dshf-tabs", role: "group", "aria-label": t("tabs.aria"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "button",
      {
        type: "button",
        className: cx("dshf-tab", tab === "workspace" && "dshf-tab-active"),
        "aria-pressed": tab === "workspace",
        title: wide ? void 0 : workspaceLabel,
        onClick: onSelectWorkspace,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FolderCloseIcon, { size: wide ? 14 : 16 }),
          wide ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dshf-tab-label", children: workspaceLabel }) : null
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "button",
      {
        type: "button",
        className: cx("dshf-tab", tab === "files" && "dshf-tab-active"),
        "aria-pressed": tab === "files",
        title: wide ? void 0 : fileLabel,
        onClick: () => {
          onSelectFile();
          if (!wide) expandSidebar?.();
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FolderOpenIcon, { size: wide ? 14 : 16 }),
          wide ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dshf-tab-label", children: fileLabel }) : null
        ]
      }
    )
  ] });
}
function FolderOpenIcon(props) {
  const size = props.size ?? 16;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: { display: "block" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "path",
    {
      d: "M5.19629 1.57104C5.81144 1.5711 6.38623 1.8786 6.72754 2.39038L7.19922 3.09839C7.28454 3.22635 7.42824 3.30344 7.58203 3.30347H12.1699C13.5039 3.30348 14.5859 4.38548 14.5859 5.71948V6.62671C15.2694 7.02689 15.6605 7.85012 15.4385 8.68726L14.3848 12.658C14.1037 13.7164 13.1449 14.4527 12.0498 14.4529H2.91699C1.51651 14.4529 0.451662 13.2814 0.501954 11.9519V3.98706C0.501954 2.65305 1.58396 1.57104 2.91797 1.57104H5.19629ZM3.7793 7.75562C3.30994 7.75562 2.89883 8.07153 2.77832 8.52515L1.91602 11.7722C1.74167 12.4291 2.23734 13.073 2.91699 13.073H12.0498C12.5191 13.0728 12.9304 12.757 13.0508 12.3035L14.1045 8.33374C14.1819 8.04202 13.9619 7.756 13.6602 7.75562H3.7793ZM2.91797 2.9519C2.34625 2.9519 1.88281 3.41534 1.88281 3.98706V7.2937C2.33068 6.7269 3.02249 6.37476 3.7793 6.37476H13.2051V5.71948C13.2051 5.14777 12.7416 4.68434 12.1699 4.68433H7.58203C6.96675 4.6843 6.39209 4.37595 6.05078 3.86401L5.5791 3.15601C5.49379 3.02821 5.34995 2.95196 5.19629 2.9519H2.91797Z",
      fill: "currentColor"
    }
  ) });
}
function FolderCloseIcon(props) {
  const size = props.size ?? 16;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: { display: "block" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    "path",
    {
      transform: "translate(1.5 2.429)",
      d: "M5.05582 0.518756L4.50669 0.86654L5.05582 0.518756ZM13 9.4837L13.65 9.4837L13.65 3.53962L13 3.53962L12.35 3.53962L12.35 9.4837L13 9.4837ZM11.3264 1.86603L11.3264 1.21603L6.52313 1.21603L6.52313 1.86603L6.52313 2.51603L11.3264 2.51603L11.3264 1.86603ZM5.58054 1.34727L6.12968 0.999489L5.60495 0.170972L5.05582 0.518756L4.50669 0.86654L5.03141 1.69506L5.58054 1.34727ZM4.11323 1.23058e-13L4.11323 -0.65L1.67359 -0.65L1.67359 5.00699e-14L1.67359 0.65L4.11323 0.65L4.11323 1.23058e-13ZM0 1.67359L-0.65 1.67359L-0.65 9.4837L0 9.4837L0.65 9.4837L0.65 1.67359L0 1.67359ZM11.3264 11.1573L11.3264 10.5073L1.67359 10.5073L1.67359 11.1573L1.67359 11.8073L11.3264 11.8073L11.3264 11.1573ZM0 9.4837L-0.65 9.4837C-0.65 10.767 0.390308 11.8073 1.67359 11.8073L1.67359 11.1573L1.67359 10.5073C1.10828 10.5073 0.65 10.049 0.65 9.4837L0 9.4837ZM1.67359 5.00699e-14L1.67359 -0.65C0.390307 -0.65 -0.65 0.390309 -0.65 1.67359L0 1.67359L0.65 1.67359C0.65 1.10828 1.10828 0.65 1.67359 0.65L1.67359 5.00699e-14ZM5.05582 0.518756L5.60495 0.170972C5.28121 -0.340193 4.71829 -0.65 4.11323 -0.65L4.11323 1.23058e-13L4.11323 0.65C4.27282 0.65 4.4213 0.731715 4.50669 0.86654L5.05582 0.518756ZM6.52313 1.86603L6.52313 1.21603C6.36354 1.21603 6.21507 1.13431 6.12968 0.999489L5.58054 1.34727L5.03141 1.69506C5.35515 2.20622 5.91808 2.51603 6.52313 2.51603L6.52313 1.86603ZM13 3.53962L13.65 3.53962C13.65 2.25634 12.6097 1.21603 11.3264 1.21603L11.3264 1.86603L11.3264 2.51603C11.8917 2.51603 12.35 2.97431 12.35 3.53962L13 3.53962ZM13 9.4837L12.35 9.4837C12.35 10.049 11.8917 10.5073 11.3264 10.5073L11.3264 11.1573L11.3264 11.8073C12.6097 11.8073 13.65 10.767 13.65 9.4837L13 9.4837Z",
      fill: "currentColor"
    }
  ) });
}

// src/client/tabsSlotLive.ts
var import_react10 = require("react");
var liveCount = 0;
var listeners6 = /* @__PURE__ */ new Set();
function emit6() {
  for (const listener of listeners6) listener();
}
function subscribe6(listener) {
  listeners6.add(listener);
  return () => {
    listeners6.delete(listener);
  };
}
function snapshot6() {
  return liveCount;
}
function useTabsSlotLive() {
  return (0, import_react10.useSyncExternalStore)(subscribe6, snapshot6) > 0;
}
function installTabsSlotWatch(ctx) {
  const sync = () => {
    const count = ctx.slots.entries("sidebar.workspaces.tabs").length;
    if (count !== liveCount) {
      liveCount = count;
      emit6();
    }
  };
  const dispose = ctx.slots.subscribe("sidebar.workspaces.tabs", sync);
  sync();
  return dispose;
}

// src/client/styles.css
var styles_default = `/* dsh-explorer-editor plugin styles. Kept dependency-free: plain CSS with DSH design\r
 * tokens where available, sensible fallbacks elsewhere. */\r
\r
/* \u2500\u2500 sidebar tree panel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\r
\r
.dshf-root {\r
  display: flex;\r
  flex-direction: column;\r
  height: 100%;\r
  min-height: 0;\r
  box-sizing: border-box;\r
  font-size: 13px;\r
  color: var(--dsw-alias-label-primary, #1f2328);\r
}\r
\r
.dshf-toolbar {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  padding: 6px 8px;\r
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));\r
  flex: none;\r
}\r
\r
.dshf-title {\r
  font-weight: 600;\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  max-width: 120px;\r
}\r
\r
.dshf-spacer {\r
  flex: 1;\r
}\r
\r
.dshf-btn {\r
  background: transparent;\r
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.15));\r
  border-radius: 6px;\r
  color: inherit;\r
  cursor: pointer;\r
  font-size: 12px;\r
  padding: 2px 6px;\r
  line-height: 1.5;\r
}\r
.dshf-btn:hover {\r
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));\r
}\r
.dshf-btn:disabled {\r
  opacity: 0.5;\r
  cursor: default;\r
}\r
\r
/* \u7EAF\u56FE\u6807\u6309\u94AE\uFF08\u5DE5\u5177\u6761\uFF09\uFF1ADSH \u98CE\u683C\u7684\u65E0\u8FB9\u6846 ghost \u56FE\u6807\u6309\u94AE */\r
.dshf-btn-icon {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  border-color: transparent;\r
  padding: 4px;\r
  border-radius: 6px;\r
}\r
\r
/* \u9875\u9762\u5185\u786E\u8BA4\u5F39\u5C42\uFF08\u66FF\u4EE3 window.confirm\uFF0C\u684C\u9762\u7AEF Electron \u4E0D\u652F\u6301\u539F\u751F\u5F39\u6846\uFF09 */\r
.dshf-modal-overlay {\r
  position: fixed;\r
  inset: 0;\r
  z-index: 1000;\r
  background: rgba(0, 0, 0, 0.35);\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
}\r
.dshf-modal {\r
  min-width: 260px;\r
  max-width: 360px;\r
  background: var(--dsw-alias-bg-overlay, #ffffff);\r
  color: var(--dsw-alias-label-primary, #1f2328);\r
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.15));\r
  border-radius: 10px;\r
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);\r
  padding: 14px 16px;\r
}\r
.dshf-modal-title {\r
  font-size: 14px;\r
  font-weight: 600;\r
  margin-bottom: 6px;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
.dshf-modal-body {\r
  font-size: 13px;\r
  color: var(--dsw-alias-label-secondary, #495057);\r
  margin-bottom: 14px;\r
  word-break: break-all;\r
}\r
.dshf-modal-actions {\r
  display: flex;\r
  justify-content: flex-end;\r
  gap: 8px;\r
}\r
/* \u6B21\u7EA7\u6309\u94AE\uFF08\u53D6\u6D88\uFF09\uFF1A\u7ED9\u53EF\u89C1\u8FB9\u6846\u4E0E\u6D45\u5E95\u8272\uFF0C\u786E\u4FDD\u4E0E\u4E3B\u6309\u94AE\uFF08\u5220\u9664\uFF09\u533A\u5206\u3001\u6DF1\u6D45\u4E3B\u9898\u4E0B\u90FD\u53EF\u89C1 */\r
.dshf-modal-actions .dshf-btn:not(.dshf-btn-danger) {\r
  background: var(--dsw-alias-bg-layer-2, #f0f1f3);\r
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.3));\r
  color: var(--dsw-alias-label-primary, #1f2328);\r
  padding: 4px 14px;\r
}\r
.dshf-modal-actions .dshf-btn:not(.dshf-btn-danger):hover {\r
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.08));\r
}\r
.dshf-modal-actions .dshf-btn-danger {\r
  padding: 4px 14px;\r
}\r
.dshf-btn-danger {\r
  background: var(--dsw-alias-danger-fg, #c92a2a);\r
  border-color: transparent;\r
  color: #ffffff;\r
}\r
.dshf-btn-danger:hover {\r
  background: var(--dsw-alias-danger-fg, #c92a2a);\r
  filter: brightness(1.1);\r
}\r
\r
.dshf-error {\r
  padding: 8px 12px;\r
  color: var(--dsw-alias-danger-fg, #c92a2a);\r
  font-size: 12px;\r
}\r
\r
.dshf-tree-pane {\r
  flex: 1;\r
  min-height: 0;\r
  display: flex;\r
  overflow: hidden;\r
}\r
\r
.dshf-tree-scroll {\r
  overflow: auto;\r
  flex: 1;\r
  min-height: 0;\r
  padding: 4px 0;\r
}\r
\r
.dshf-tree-list {\r
  min-width: max-content;\r
}\r
\r
.dshf-tree-hint {\r
  padding: 4px 12px;\r
  color: var(--dsw-alias-label-tertiary, #868e96);\r
  font-size: 12px;\r
}\r
\r
.dshf-node {\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
  padding: 2px 8px;\r
  cursor: pointer;\r
  white-space: nowrap;\r
  user-select: none;\r
  min-height: 22px;\r
}\r
.dshf-node:hover {\r
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));\r
}\r
.dshf-selected {\r
  background: var(--dsw-alias-interactive-bg-selected, rgba(77, 171, 247, 0.15));\r
}\r
\r
.dshf-caret {\r
  width: 12px;\r
  flex: none;\r
  font-size: 10px;\r
  color: var(--dsw-alias-label-tertiary, #868e96);\r
}\r
\r
.dshf-icon {\r
  flex: none;\r
  font-size: 13px;\r
}\r
\r
.dshf-name {\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  min-width: 0;\r
}\r
\r
/* VS Code \u5F0F\u5185\u8054\u8F93\u5165\u884C\uFF08\u65B0\u5EFA/\u91CD\u547D\u540D\uFF09\uFF1Aaccent \u8FB9\u6846\u7684\u8F93\u5165\u6846 */\r
.dshf-node-editing {\r
  cursor: default;\r
}\r
.dshf-inline-input {\r
  flex: 1;\r
  min-width: 0;\r
  font: inherit;\r
  font-size: 13px;\r
  line-height: 1.4;\r
  color: inherit;\r
  background: var(--dsw-alias-bg-primary, #ffffff);\r
  border: 1px solid var(--dsw-alias-accent-strong, #4dabf7);\r
  border-radius: 4px;\r
  padding: 1px 4px;\r
  outline: none;\r
}\r
\r
.dshf-node-actions {\r
  display: none;\r
  margin-left: auto;\r
  gap: 2px;\r
  flex: none;\r
}\r
.dshf-node:hover .dshf-node-actions {\r
  display: inline-flex;\r
}\r
\r
.dshf-mini {\r
  background: transparent;\r
  border: none;\r
  cursor: pointer;\r
  font-size: 11px;\r
  padding: 0 2px;\r
  opacity: 0.7;\r
}\r
.dshf-mini:hover {\r
  opacity: 1;\r
}\r
\r
.dshf-status {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  padding: 4px 8px;\r
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));\r
  flex: none;\r
  font-size: 11px;\r
  color: var(--dsw-alias-label-tertiary, #868e96);\r
  min-height: 22px;\r
}\r
\r
/* Status row placed at the TOP of the editor view (below the toolbar):\r
 * the open-file tab strip reads top-down, so the border flips sides. */\r
.dshf-status-top {\r
  border-top: none;\r
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));\r
}\r
\r
.dshf-status-busy {\r
  color: var(--dsw-alias-accent-strong, #4dabf7);\r
}\r
\r
.dshf-status-notice {\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
\r
.dshf-hidden {\r
  display: none;\r
}\r
\r
/* \u2500\u2500 center-column editor view (conversation.view) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\r
\r
/* Renders IN the conversation center column's view area (inside the session\r
 * scroll body), alongside chat / trajectory \u2014 never a popup. Fills the view\r
 * area the session body reserves for the active view.\r
 *\r
 * The whole view is ONE cohesive surface. Colors come from the editor theme\r
 * (themeStore) via CSS custom properties with LIGHT defaults (the default\r
 * theme is light), so the chrome always matches the Monaco background\r
 * instead of clashing with the page. */\r
.dshf-editor-view {\r
  display: flex;\r
  flex-direction: column;\r
  height: 100%;\r
  min-height: 0;\r
  box-sizing: border-box;\r
  position: relative;\r
  background: var(--dshf-bg, #ffffff);\r
  color: var(--dshf-fg, #1f2328);\r
  font-size: 13px;\r
}\r
\r
.dshf-editor-view .dshf-editor-toolbar {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  padding: 6px 10px;\r
  background: var(--dshf-chrome, #f3f3f3);\r
  border-bottom: 1px solid var(--dshf-border, #e0e0e0);\r
  flex: none;\r
  font-size: 12px;\r
  color: var(--dshf-fg, #1f2328);\r
}\r
\r
.dshf-editor-view .dshf-tabname {\r
  font-weight: 600;\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  color: var(--dshf-fg, #1f2328);\r
}\r
.dshf-editor-view .dshf-dirty {\r
  color: var(--dshf-dirty, #c2410c);\r
}\r
\r
.dshf-editor-view .dshf-editor-path {\r
  min-width: 0;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
  color: var(--dshf-muted, #868e96);\r
  font-size: 11px;\r
}\r
\r
.dshf-editor-view .dshf-status-top {\r
  background: var(--dshf-chrome, #f3f3f3);\r
  color: var(--dshf-muted, #868e96);\r
}\r
\r
.dshf-editor-view .dshf-empty {\r
  color: var(--dshf-muted, #868e96);\r
}\r
\r
.dshf-editor-view .dshf-monaco {\r
  flex: 1;\r
  min-height: 0;\r
}\r
\r
.dshf-editor-view .dshf-textarea {\r
  flex: 1;\r
  min-height: 0;\r
  resize: none;\r
  border: none;\r
  outline: none;\r
  padding: 8px 12px;\r
  font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);\r
  font-size: var(--dshf-font-size, 13px);\r
  line-height: 1.5;\r
  background: var(--dshf-bg, #ffffff);\r
  color: var(--dshf-fg, #1f2328);\r
}\r
\r
.dshf-editor-view .dshf-btn {\r
  color: var(--dshf-fg, #1f2328);\r
  border-color: var(--dshf-border, #d0d0d0);\r
}\r
.dshf-editor-view .dshf-btn:hover {\r
  background: var(--dshf-chip, #ececec);\r
}\r
\r
.dshf-editor-view .dshf-tab-chip {\r
  background: var(--dshf-chip, #ececec);\r
  border-color: var(--dshf-border, #d0d0d0);\r
  color: var(--dshf-fg, #1f2328);\r
}\r
.dshf-editor-view .dshf-tab-chip:hover {\r
  background: var(--dshf-border, #c9c9c9);\r
}\r
.dshf-editor-view .dshf-tab-chip-active {\r
  background: var(--dshf-accent, #094771);\r
  border-color: var(--dshf-accent, #094771);\r
  color: #ffffff;\r
}\r
.dshf-editor-view .dshf-tab-chip-close:hover {\r
  background: var(--dshf-border, rgba(0, 0, 0, 0.1));\r
}\r
\r
/* \u2500\u2500 Markdown preview (read-only rendered view) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\r
\r
.dshf-editor-view .dshf-md-preview {\r
  flex: 1;\r
  min-height: 0;\r
  overflow: auto;\r
  padding: 12px 20px 32px;\r
  font-size: var(--dshf-font-size, 13px);\r
  line-height: 1.6;\r
  color: var(--dshf-fg, #1f2328);\r
  background: var(--dshf-bg, #ffffff);\r
  box-sizing: border-box;\r
  word-wrap: break-word;\r
}\r
\r
.dshf-editor-view .dshf-md-preview > :first-child {\r
  margin-top: 0;\r
}\r
\r
.dshf-editor-view .dshf-md-preview h1,\r
.dshf-editor-view .dshf-md-preview h2,\r
.dshf-editor-view .dshf-md-preview h3,\r
.dshf-editor-view .dshf-md-preview h4 {\r
  margin: 1.2em 0 0.5em;\r
  line-height: 1.3;\r
  color: var(--dshf-fg, #1f2328);\r
}\r
.dshf-editor-view .dshf-md-preview h1 { font-size: 1.6em; border-bottom: 1px solid var(--dshf-border, #e0e0e0); padding-bottom: 0.3em; }\r
.dshf-editor-view .dshf-md-preview h2 { font-size: 1.35em; border-bottom: 1px solid var(--dshf-border, #e0e0e0); padding-bottom: 0.25em; }\r
.dshf-editor-view .dshf-md-preview h3 { font-size: 1.15em; }\r
.dshf-editor-view .dshf-md-preview h4 { font-size: 1em; }\r
\r
.dshf-editor-view .dshf-md-preview p {\r
  margin: 0.6em 0;\r
}\r
\r
.dshf-editor-view .dshf-md-preview ul,\r
.dshf-editor-view .dshf-md-preview ol {\r
  margin: 0.6em 0;\r
  padding-left: 1.6em;\r
}\r
\r
.dshf-editor-view .dshf-md-preview li {\r
  margin: 0.2em 0;\r
}\r
\r
.dshf-editor-view .dshf-md-preview blockquote {\r
  margin: 0.8em 0;\r
  padding: 0.1em 1em;\r
  border-left: 3px solid var(--dshf-border, #d0d0d0);\r
  color: var(--dshf-muted, #868e96);\r
  background: var(--dshf-chip, #f3f3f3);\r
  border-radius: 0 6px 6px 0;\r
}\r
\r
.dshf-editor-view .dshf-md-preview code {\r
  font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);\r
  font-size: 0.92em;\r
  background: var(--dshf-chip, #ececec);\r
  border-radius: 4px;\r
  padding: 0.1em 0.35em;\r
}\r
\r
.dshf-editor-view .dshf-md-preview pre {\r
  margin: 0.8em 0;\r
  padding: 10px 12px;\r
  background: var(--dshf-chip, #ececec);\r
  border: 1px solid var(--dshf-border, #d0d0d0);\r
  border-radius: 8px;\r
  overflow: auto;\r
}\r
.dshf-editor-view .dshf-md-preview pre code {\r
  background: transparent;\r
  padding: 0;\r
  font-size: 0.92em;\r
  line-height: 1.5;\r
}\r
\r
.dshf-editor-view .dshf-md-preview a {\r
  color: var(--dshf-accent, #094771);\r
  text-decoration: none;\r
}\r
.dshf-editor-view .dshf-md-preview a:hover {\r
  text-decoration: underline;\r
}\r
\r
.dshf-editor-view .dshf-md-preview img {\r
  max-width: 100%;\r
}\r
\r
.dshf-editor-view .dshf-md-preview table {\r
  border-collapse: collapse;\r
  margin: 0.8em 0;\r
  display: block;\r
  overflow: auto;\r
  max-width: 100%;\r
}\r
.dshf-editor-view .dshf-md-preview th,\r
.dshf-editor-view .dshf-md-preview td {\r
  border: 1px solid var(--dshf-border, #d0d0d0);\r
  padding: 4px 10px;\r
}\r
.dshf-editor-view .dshf-md-preview th {\r
  background: var(--dshf-chip, #ececec);\r
  font-weight: 600;\r
}\r
\r
.dshf-editor-view .dshf-md-preview hr {\r
  border: none;\r
  border-top: 1px solid var(--dshf-border, #d0d0d0);\r
  margin: 1em 0;\r
}\r
\r
.dshf-editor-view .dshf-md-preview input[type='checkbox'] {\r
  margin-right: 0.4em;\r
}\r
\r
/* Toggle button: keep it subtle like the theme button */\r
.dshf-editor-view .dshf-md-toggle {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  padding: 2px 5px;\r
}\r
.dshf-editor-view .dshf-md-toggle svg {\r
  display: block;\r
}\r
\r
/* \u2500\u2500 editor theme panel (VS Code style) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\r
\r
.dshf-theme-wrap {\r
  position: relative;\r
  display: inline-flex;\r
}\r
\r
.dshf-theme-panel {\r
  position: absolute;\r
  top: calc(100% + 4px);\r
  right: 0;\r
  z-index: 40;\r
  width: 252px;\r
  display: flex;\r
  flex-direction: column;\r
  gap: 8px;\r
  box-sizing: border-box;\r
  padding: 10px;\r
  background: var(--dshf-chrome, #f3f3f3);\r
  border: 1px solid var(--dshf-border, #d0d0d0);\r
  border-radius: 8px;\r
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);\r
  color: var(--dshf-fg, #1f2328);\r
  font-size: 12px;\r
}\r
\r
.dshf-theme-row {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  min-width: 0;\r
}\r
\r
.dshf-theme-label {\r
  flex: none;\r
  width: 44px;\r
  color: var(--dshf-muted, #868e96);\r
}\r
\r
.dshf-theme-select {\r
  flex: 1;\r
  min-width: 0;\r
  background: var(--dshf-chip, #ececec);\r
  border: 1px solid var(--dshf-border, #d0d0d0);\r
  border-radius: 6px;\r
  color: var(--dshf-fg, #1f2328);\r
  font-size: 12px;\r
  padding: 2px 6px;\r
  cursor: pointer;\r
}\r
.dshf-theme-select:focus {\r
  outline: none;\r
  border-color: var(--dshf-accent, #094771);\r
}\r
\r
.dshf-theme-row input[type='color'] {\r
  width: 34px;\r
  height: 22px;\r
  padding: 0;\r
  border: 1px solid var(--dshf-border, #d0d0d0);\r
  border-radius: 4px;\r
  background: var(--dshf-chip, #ececec);\r
  cursor: pointer;\r
}\r
\r
.dshf-theme-hex {\r
  font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);\r
  font-size: 11px;\r
  color: var(--dshf-muted, #868e96);\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
\r
.dshf-theme-error {\r
  color: var(--dshf-dirty, #c2410c);\r
  font-size: 11px;\r
  line-height: 1.4;\r
}\r
\r
.dshf-hidden-input {\r
  display: none;\r
}\r
\r
.dshf-theme-fontsize {\r
  width: 52px;\r
  background: var(--dshf-chip, #ececec);\r
  border: 1px solid var(--dshf-border, #d0d0d0);\r
  border-radius: 4px;\r
  color: var(--dshf-fg, #1f2328);\r
  font-size: 12px;\r
  padding: 1px 4px;\r
}\r
\r
.dshf-theme-unit {\r
  color: var(--dshf-muted, #868e96);\r
  font-size: 11px;\r
}\r
\r
.dshf-theme-actions {\r
  justify-content: flex-end;\r
  border-top: 1px solid var(--dshf-border, rgba(0, 0, 0, 0.1));\r
  padding-top: 8px;\r
}\r
\r
.dshf-empty {\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  flex: 1;\r
  color: var(--dsw-alias-label-tertiary, #868e96);\r
  font-size: 12px;\r
}\r
\r
.dshf-tabs-strip {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 4px;\r
  overflow: hidden;\r
  max-width: 60%;\r
}\r
\r
/* One open-file tab: a chip container holding the (clickable) name and a\r
 * per-file close "\u2715". Left-aligned in the status row. */\r
.dshf-tab-chip {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 2px;\r
  background: transparent;\r
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));\r
  border-radius: 6px;\r
  color: var(--dsw-alias-label-secondary, #495057);\r
  font-size: 11px;\r
  padding: 1px 2px 1px 6px;\r
  white-space: nowrap;\r
  max-width: 160px;\r
}\r
.dshf-tab-chip:hover {\r
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));\r
}\r
.dshf-tab-chip-active {\r
  background: var(--dsw-alias-interactive-bg-selected, rgba(77, 171, 247, 0.15));\r
  border-color: var(--dsw-alias-accent-strong, #4dabf7);\r
}\r
\r
/* Filename part of a tab (click to focus). */\r
.dshf-tab-chip-name {\r
  background: transparent;\r
  border: none;\r
  padding: 0;\r
  margin: 0;\r
  font: inherit;\r
  color: inherit;\r
  cursor: pointer;\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  min-width: 0;\r
}\r
.dshf-tab-chip-name:hover {\r
  text-decoration: underline;\r
}\r
\r
/* Per-file close button. */\r
.dshf-tab-chip-close {\r
  background: transparent;\r
  border: none;\r
  padding: 0 3px;\r
  margin: 0;\r
  font-size: 10px;\r
  line-height: 1;\r
  color: inherit;\r
  cursor: pointer;\r
  opacity: 0.55;\r
  border-radius: 4px;\r
  flex: none;\r
}\r
.dshf-tab-chip-close:hover {\r
  opacity: 1;\r
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.08));\r
}\r
\r
/* Busy / notice group pushed to the right end of the status row. */\r
.dshf-status-meta {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 8px;\r
  margin-left: auto;\r
  min-width: 0;\r
}\r
\r
/* Sidebar footer toggle button */\r
.dshf-toggle {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 6px;\r
  background: transparent;\r
  border: 1px solid transparent;\r
  border-radius: 8px;\r
  color: var(--dsw-alias-label-secondary, #495057);\r
  cursor: pointer;\r
  padding: 6px 10px;\r
  flex: 1;\r
  min-width: 0;\r
}\r
.dshf-toggle:hover {\r
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));\r
}\r
\r
.dshf-toggle-label {\r
  font-size: 13px;\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
\r
/* \u2500\u2500 sidebar view-tab strip ([\u5DE5\u4F5C\u533A] [\u6587\u4EF6]) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r
 * Rendered inside the workspace browser's section header row (replacing the\r
 * "\u5DE5\u4F5C\u533A" label) and at the top of the file-manager panel wrapper. margin-\r
 * right:auto keeps the strip at the row's left while the browser's search /\r
 * actions stay right-aligned; no flex-grow so it never stretches vertically\r
 * inside the panel wrapper's column layout. */\r
.dshf-tabs {\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
  min-width: 0;\r
  margin-right: auto;\r
}\r
.dshf-tab {\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;\r
  gap: 4px;\r
  height: 26px;\r
  padding: 0 8px;\r
  border: none;\r
  border-radius: 8px;\r
  background: transparent;\r
  color: var(--dsw-alias-label-secondary, #495057);\r
  cursor: pointer;\r
  font: inherit;\r
  font-size: 13px;\r
  flex: none;\r
}\r
.dshf-tab:hover {\r
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));\r
}\r
.dshf-tab-active {\r
  color: var(--dsw-alias-label-primary, #1f2329);\r
  font-weight: 600;\r
}\r
.dshf-tab-label {\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
/* Wrapper around the file-manager panel while the "\u6587\u4EF6" tab owns the cell:\r
 * hosts the tab strip on top and lets the panel fill the rest. The strip gets\r
 * the same 8px side inset as the panel toolbar below it. */\r
.dshf-panel-wrap {\r
  display: flex;\r
  flex-direction: column;\r
  flex: 1;\r
  min-height: 0;\r
  padding-top: 4px;\r
}\r
.dshf-panel-wrap .dshf-tabs {\r
  padding: 0 8px;\r
}\r
\r
/* \u2500\u2500 context menu (right-click) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\r
.dshf-context-menu {\r
  position: fixed;\r
  z-index: 2147483002;\r
  min-width: 180px;\r
  padding: 4px;\r
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.35));\r
  border-radius: 8px;\r
  background: var(--dsw-alias-bg-layer-3, #ffffff);\r
  color: var(--dsw-alias-label-primary, inherit);\r
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);\r
  font: 13px/1.5 system-ui, sans-serif;\r
  user-select: none;\r
}\r
.dshf-menu-item {\r
  display: flex;\r
  align-items: center;\r
  gap: 12px;\r
  width: 100%;\r
  padding: 5px 10px;\r
  border: none;\r
  border-radius: 6px;\r
  background: transparent;\r
  color: inherit;\r
  font: inherit;\r
  text-align: left;\r
  cursor: pointer;\r
}\r
.dshf-menu-item:hover,\r
.dshf-menu-item-active {\r
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.08));\r
  outline: none;\r
}\r
.dshf-menu-item-disabled {\r
  opacity: 0.5;\r
  cursor: default;\r
}\r
.dshf-menu-item-disabled:hover {\r
  background: transparent;\r
}\r
.dshf-menu-label {\r
  flex: 1;\r
  min-width: 0;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
}\r
.dshf-menu-shortcut {\r
  color: var(--dsw-alias-label-tertiary, rgba(0, 0, 0, 0.45));\r
  font-size: 11px;\r
}\r
.dshf-menu-sep {\r
  height: 1px;\r
  margin: 4px 6px;\r
  background: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.25));\r
}\r
/* Cut-source row: dimmed with a dashed outline (VS Code style). */\r
.dshf-node.dshf-cut {\r
  opacity: 0.45;\r
  outline: 1px dashed var(--dsw-alias-label-dimmed, rgba(127, 127, 127, 0.6));\r
  outline-offset: -1px;\r
}\r
`;

// src/client/index.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var CSS_TAG = "dsh-explorer-editor/styles.css";
if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css="${CSS_TAG}"]`) === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-explorer-editor";
  tag.dataset.pluginCss = CSS_TAG;
  tag.textContent = styles_default;
  document.head.appendChild(tag);
}
var explorerEditorInject = ["slots", "locale"];
async function restoreEditorSession(ctx) {
  try {
    const remote = ctx.get("remote.fileManager");
    if (remote === void 0) return;
    const { path: root } = unwrap(await remote.getRoot());
    const snapshot7 = loadSnapshot();
    if (snapshot7 === null) return;
    if (snapshot7.root !== root) {
      clearSnapshot();
      return;
    }
    setWorkspaceRoot(root);
    const kept = filterByRoot(snapshot7.tabs, root);
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
      const active = snapshot7.activePath !== null && restored.some((t) => t.path === snapshot7.activePath) ? snapshot7.activePath : restored[restored.length - 1]?.path ?? null;
      restoreTabs(restored, active);
      ctx.logger?.info?.(`[dsh-explorer-editor] restored ${restored.length} editor tab(s) from session`);
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
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: "dsh-explorer-editor",
    order: 20,
    label: () => t("view.label"),
    locale: NS,
    registrant: "dsh-unknownue-plugins"
  }, (props) => {
    const remote = ctx.get("remote.fileManager");
    if (remote === void 0) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ExplorerViewWrapper, { remote, t, useSessions: props.useSessions });
  }));

  const activateEditorView = () => {
    const label = t("view.label");
    for (const tab of Array.from(document.querySelectorAll('[role="tab"]'))) {
      if (tab.closest(".dshf-tabs") !== null) continue;
      if (tab.textContent?.trim() === label) {
        tab.click();
        return;
      }
    }
  };
  void mountRemote;
}
function FileToggleButton(props) {
  const { wide, t, onToggle, isOpen } = props;
  const tabsLive = useTabsSlotLive();
  if (tabsLive) return null;
  const label = t("toggle.label");
  const title = isOpen() ? t("toggle.close") : t("toggle.open");
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "button",
    {
      type: "button",
      className: "dshf-toggle",
      title,
      "aria-label": label,
      onClick: onToggle,
      style: isOpen() ? { fontWeight: 700 } : void 0,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(FolderOpenIcon, { size: wide ? 14 : 16 }),
        wide ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dshf-toggle-label", children: label }) : null
      ]
    }
  );
}

    // ── plugin contract ───────────────────────────────────────────────────
    const inject = ["slots", "sessions", "locale"];

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

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});



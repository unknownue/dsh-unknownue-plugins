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
      if (document.querySelector("style[data-dmk-styles]") !== null) return;
      const style = document.createElement("style");
      style.setAttribute("data-dmk-styles", "");
      style.textContent = [
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
        ".dmw-reset:hover{background:var(--dsw-alias-interactive-bg-hover);}"
      ].join("\n");
      document.head.appendChild(style);
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

    // ── plugin contract ───────────────────────────────────────────────────
    const inject = ["slots", "sessions"];

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
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});

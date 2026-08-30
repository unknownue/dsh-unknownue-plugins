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
        ".dmw-reset:hover{background:var(--dsw-alias-interactive-bg-hover);}",
        ".dmr-card{position:relative;z-index:1;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;width:min(640px,100%);max-height:85vh;padding:16px 18px;border:1px solid var(--dsw-alias-border-inverted);border-radius:16px;background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-shadow-lv3);font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary);overflow-y:auto;}",
        ".dmr-hosts{display:flex;gap:6px;flex-wrap:wrap;}",
        ".dmr-host-btn{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px;}",
        ".dmr-host-btn:hover{background:var(--dsw-alias-interactive-bg-hover);}",
        ".dmr-host-active{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary);}",
        ".dmr-dot{flex:none;width:7px;height:7px;border-radius:50%;}",
        ".dmr-section{display:flex;flex-direction:column;gap:6px;}",
        ".dmr-section-title{font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:0.5px;}",
        ".dmr-cmd-row{display:flex;gap:6px;}",
        ".dmr-output{max-height:200px;overflow:auto;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);font-family:ui-monospace,Consolas,Menlo,monospace;font-size:12px;line-height:18px;white-space:pre-wrap;word-break:break-all;}",
        ".dmr-output-cmd{color:var(--dsw-alias-state-business-primary);font-weight:600;}",
        ".dmr-output-out{color:var(--dsw-alias-label-primary);}",
        ".dmr-output-err{color:var(--dsw-alias-state-error);}",
        ".dmr-output-meta{color:var(--dsw-alias-label-secondary);font-style:italic;}",
        ".dmr-transfer-row{display:flex;gap:6px;align-items:center;}",
        ".dmr-file-input{font-size:12px;color:var(--dsw-alias-label-secondary);}",
        ".dmr-tunnel{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}",
        ".dmr-tunnel-actions{display:flex;gap:4px;margin-left:auto;}",
        ".dmr-btn{height:26px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:11px;}",
        ".dmr-btn:hover{background:var(--dsw-alias-interactive-bg-hover);}",
        ".dmr-btn:disabled{opacity:.45;cursor:default;}",
        ".dmr-meta{font-size:12px;color:var(--dsw-alias-label-secondary);}",
        ".dmr-error{color:var(--dsw-alias-state-error);}",
        ".dmr-host-add{border-style:dashed;opacity:.7;}",
        ".dmr-host-add:hover{opacity:1;}",
        ".dmr-host-info{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);}",
        ".dmr-host-detail{font-family:ui-monospace,Consolas,Menlo,monospace;font-size:11px;}",
        ".dmr-host-actions{display:flex;gap:4px;margin-left:auto;}",
        ".dmr-btn-sm{height:22px;padding:0 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:10px;display:inline-flex;align-items:center;gap:2px;}",
        ".dmr-btn-sm:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}",
        ".dmr-btn-danger{color:var(--dsw-alias-state-error);}",
        ".dmr-btn-danger:hover{background:var(--dsw-alias-state-error);color:#fff;}",
        ".dmr-btn-primary{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);}",
        ".dmr-btn-primary:hover{background:var(--dsw-alias-state-business-primary);color:#fff;}",
        ".dmr-btn-ghost{border-color:transparent;color:var(--dsw-alias-label-secondary);font-size:11px;}",
        ".dmr-btn-ghost:hover{background:var(--dsw-alias-interactive-bg-hover);}",
        ".dmr-key-empty{border-style:dashed;}",
        ".dmr-empty{text-align:center;padding:24px 0;color:var(--dsw-alias-label-secondary);font-size:13px;}",
        ".dmr-form{display:flex;flex-direction:column;gap:8px;}",
        ".dmr-form-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);margin-bottom:4px;}",
        ".dmr-label{font-size:11px;font-weight:500;color:var(--dsw-alias-label-secondary);margin-top:4px;}",
        ".dmr-checkbox-label{display:flex;align-items:center;gap:6px;cursor:pointer;}",
        ".dmr-form-sub{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);}",
        ".dmr-form-actions{display:flex;gap:6px;justify-content:flex-end;margin-top:8px;}",
        ".dmr-test-result{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;font-size:12px;background:var(--dsw-alias-bg-layer-3);}",
        ".dmr-key-section{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);}",
        ".dmr-key-actions{display:flex;gap:6px;}",
        ".dmr-pubkey-box{margin-top:4px;}",
        ".dmr-pubkey-label{font-size:10px;color:var(--dsw-alias-label-secondary);margin-bottom:4px;}",
        ".dmr-pubkey{padding:6px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-3);font-family:ui-monospace,Consolas,Menlo,monospace;font-size:10px;line-height:16px;word-break:break-all;white-space:pre-wrap;max-height:60px;overflow:auto;user-select:all;}",
        ".dmr-push-section{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);}"
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

    // ── remote control ───────────────────────────────────────────────────────
    const REMOTE_API = "/dsh-unknownue-plugins/remote/api";

    function RemoteGlyph() {
      return react.createElement(
        "svg",
        { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
        react.createElement("path", {
          d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3",
          stroke: "currentColor",
          strokeWidth: 1.8,
          strokeLinecap: "round",
          strokeLinejoin: "round"
        })
      );
    }

    function PlusGlyph() {
      return react.createElement(
        "svg",
        { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
        react.createElement("path", { d: "M12 5v14M5 12h14", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round" })
      );
    }

    function TrashGlyph() {
      return react.createElement(
        "svg",
        { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
        react.createElement("path", { d: "M3 6h18M8 6V4h8v2M10 11v6M14 11v6M5 6l1 14h12l1-14", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" })
      );
    }

    // ── Add/Edit Host Form ─────────────────────────────────────────────────
    function HostForm(props) {
      const { initial, onSave, onCancel } = props;
      const [form, setForm] = react.useState(initial || {
        id: "", label: "", description: "", hostName: "", port: 22, user: "", keyPath: "",
        tunnelEnabled: false, tunnelPort: 2222, tunnelServiceName: "reverse-ssh-tunnel.service"
      });
      const [testing, setTesting] = react.useState(false);
      const [testResult, setTestResult] = react.useState(null);
      const [saving, setSaving] = react.useState(false);
      const [keyInfo, setKeyInfo] = react.useState(null);
      const [keyBusy, setKeyBusy] = react.useState(false);
      const [keyMsg, setKeyMsg] = react.useState(null);
      const [pushBusy, setPushBusy] = react.useState(false);
      const [pushMsg, setPushMsg] = react.useState(null);
      const [keyChecked, setKeyChecked] = react.useState(false);

      const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

      // Check for existing key on mount
      react.useEffect(() => {
        const checkKey = async () => {
          try {
            const result = await call(REMOTE_API, "ssh.generateKey", { keyPath: form.keyPath || null });
            if (result.existed && result.publicKey) {
              setKeyInfo(result);
              if (!form.keyPath && result.keyPath) {
                setForm(prev => ({ ...prev, keyPath: result.keyPath.replace(/^\/Users\/[^\/]+/, "~") }));
              }
            }
          } catch {}
          setKeyChecked(true);
        };
        checkKey();
      }, []);

      // Generate SSH key
      const onGenerateKey = async () => {
        setKeyBusy(true);
        setKeyMsg(null);
        try {
          const result = await call(REMOTE_API, "ssh.generateKey", { keyPath: form.keyPath || null });
          setKeyInfo(result);
          setKeyMsg({ ok: true, text: result.message + (result.existed ? "" : " ✅") });
          if (!form.keyPath && result.keyPath) {
            setForm(prev => ({ ...prev, keyPath: result.keyPath.replace(/^\/Users\/[^\/]+/, "~") }));
          }
        } catch (err) {
          setKeyMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
        } finally {
          setKeyBusy(false);
        }
      };

      // Copy public key to clipboard
      const onCopyPublicKey = async () => {
        const pubKey = keyInfo?.publicKey;
        if (!pubKey) return;
        try {
          await navigator.clipboard.writeText(pubKey);
          setKeyMsg({ ok: true, text: "公钥已复制到剪贴板 ✅" });
        } catch {
          setKeyMsg({ ok: false, text: "复制失败，请手动复制下方公钥" });
        }
      };

      // Push key to remote host
      const onPushKey = async () => {
        if (!form.hostName || !form.user) {
          setPushMsg({ ok: false, text: "请先填写主机地址和用户名" });
          return;
        }
        setPushBusy(true);
        setPushMsg(null);
        try {
          const result = await call(REMOTE_API, "ssh.pushKey", {
            hostId: form.id || "temp",
            hostName: form.hostName,
            port: Number(form.port) || 22,
            user: form.user,
            keyPath: form.keyPath || null
          });
          setPushMsg({ ok: true, text: result.message });
        } catch (err) {
          setPushMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
        } finally {
          setPushBusy(false);
        }
      };

      const onTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
          const result = await call(REMOTE_API, "hosts.test", {
            hostName: form.hostName,
            port: Number(form.port) || 22,
            user: form.user,
            keyPath: form.keyPath || null
          });
          setTestResult(result);
        } catch (err) {
          setTestResult({ reachable: false, error: err instanceof Error ? err.message : String(err) });
        } finally {
          setTesting(false);
        }
      };

      const onSaveClick = async () => {
        if (!form.id.trim() || !form.hostName.trim() || !form.user.trim()) return;
        setSaving(true);
        try {
          const payload = {
            id: form.id.trim(),
            label: form.label.trim() || form.id.trim(),
            description: form.description.trim(),
            hostName: form.hostName.trim(),
            port: Number(form.port) || 22,
            user: form.user.trim(),
            keyPath: form.keyPath.trim() || null,
            tunnel: form.tunnelEnabled ? {
              enabled: true,
              port: Number(form.tunnelPort) || 2222,
              serviceName: form.tunnelServiceName.trim() || "reverse-ssh-tunnel.service"
            } : null
          };
          await onSave(payload);
        } finally {
          setSaving(false);
        }
      };

      const hasKey = keyInfo && keyInfo.publicKey;

      return react.createElement(
        "div",
        { className: "dmr-form" },
        react.createElement("div", { className: "dmr-form-title" }, initial ? "编辑主机" : "添加主机"),
        // Basic fields
        react.createElement("label", { className: "dmr-label" }, "主机 ID *"),
        react.createElement("input", { className: "dmk-workdir", value: form.id, onChange: set("id"), placeholder: "如 home、ecs（唯一标识）", disabled: !!initial }),
        react.createElement("label", { className: "dmr-label" }, "显示名称"),
        react.createElement("input", { className: "dmk-workdir", value: form.label, onChange: set("label"), placeholder: "如 家里机器" }),
        react.createElement("label", { className: "dmr-label" }, "描述"),
        react.createElement("input", { className: "dmk-workdir", value: form.description, onChange: set("description"), placeholder: "如 Ubuntu 26.04 server" }),
        react.createElement("label", { className: "dmr-label" }, "主机地址 *"),
        react.createElement("input", { className: "dmk-workdir", value: form.hostName, onChange: set("hostName"), placeholder: "IP 或域名" }),
        react.createElement("label", { className: "dmr-label" }, "SSH 端口"),
        react.createElement("input", { className: "dmk-workdir", type: "number", value: form.port, onChange: set("port"), placeholder: "22" }),
        react.createElement("label", { className: "dmr-label" }, "用户名 *"),
        react.createElement("input", { className: "dmk-workdir", value: form.user, onChange: set("user"), placeholder: "如 root、ubuntu" }),
        // SSH Key section — conditional rendering
        react.createElement("label", { className: "dmr-label" }, "SSH 密钥"),
        !keyChecked ? react.createElement("div", { className: "dmr-meta" }, "检查密钥中...") : (
          hasKey ? react.createElement(
            // Key exists: show public key + copy button
            "div",
            { className: "dmr-key-section" },
            react.createElement("input", { className: "dmk-workdir", value: form.keyPath, onChange: set("keyPath"), placeholder: "密钥路径" }),
            react.createElement(
              "div",
              { className: "dmr-key-actions" },
              react.createElement("button", { type: "button", className: "dmr-btn", onClick: onCopyPublicKey }, "复制公钥"),
              react.createElement("button", { type: "button", className: "dmr-btn dmr-btn-ghost", onClick: onGenerateKey, disabled: keyBusy }, "重新生成")
            ),
            keyMsg ? react.createElement("div", { className: "dmr-meta" + (keyMsg.ok ? "" : " dmr-error") }, keyMsg.text) : null,
            react.createElement(
              "div",
              { className: "dmr-pubkey-box" },
              react.createElement("div", { className: "dmr-pubkey-label" }, "公钥（添加到远程主机的 ~/.ssh/authorized_keys）："),
              react.createElement("div", { className: "dmr-pubkey" }, keyInfo.publicKey)
            )
          ) : react.createElement(
            // No key: show generate button prominently
            "div",
            { className: "dmr-key-section dmr-key-empty" },
            react.createElement("div", { className: "dmr-meta" }, "尚未生成 SSH 密钥"),
            react.createElement("input", { className: "dmk-workdir", value: form.keyPath, onChange: set("keyPath"), placeholder: "密钥保存路径（留空使用默认 ~/.ssh/id_ed25519）" }),
            react.createElement("button", { type: "button", className: "dmr-btn dmr-btn-primary", disabled: keyBusy, onClick: onGenerateKey }, keyBusy ? "生成中..." : "生成密钥"),
            keyMsg ? react.createElement("div", { className: "dmr-meta" + (keyMsg.ok ? "" : " dmr-error") }, keyMsg.text) : null
          )
        ),
        // Push key to remote
        react.createElement(
          "div",
          { className: "dmr-push-section" },
          react.createElement("div", { className: "dmr-label" }, "推送公钥到远程主机"),
          react.createElement("div", { className: "dmr-meta" }, "需要远程主机已配置密码认证或已有其他密钥"),
          react.createElement("button", { type: "button", className: "dmr-btn", disabled: pushBusy || !form.hostName || !form.user, onClick: onPushKey }, pushBusy ? "推送中..." : "推送公钥"),
          pushMsg ? react.createElement("div", { className: "dmr-meta" + (pushMsg.ok ? "" : " dmr-error") }, pushMsg.text) : null
        ),
        // Tunnel section
        react.createElement(
          "label",
          { className: "dmr-label dmr-checkbox-label" },
          react.createElement("input", { type: "checkbox", checked: form.tunnelEnabled, onChange: set("tunnelEnabled") }),
          "启用反向隧道"
        ),
        form.tunnelEnabled ? react.createElement(
          "div",
          { className: "dmr-form-sub" },
          react.createElement("label", { className: "dmr-label" }, "隧道端口"),
          react.createElement("input", { className: "dmk-workdir", type: "number", value: form.tunnelPort, onChange: set("tunnelPort"), placeholder: "2222" }),
          react.createElement("label", { className: "dmr-label" }, "systemd 服务名"),
          react.createElement("input", { className: "dmk-workdir", value: form.tunnelServiceName, onChange: set("tunnelServiceName"), placeholder: "reverse-ssh-tunnel.service" })
        ) : null,
        // Test result
        testResult ? react.createElement(
          "div",
          { className: "dmr-test-result" },
          react.createElement("span", {
            className: "dmr-dot",
            style: { background: testResult.reachable ? "var(--dsw-alias-state-success)" : "var(--dsw-alias-state-error)" }
          }),
          testResult.reachable
            ? `连接成功 (${testResult.latency}ms)`
            : `连接失败: ${testResult.error}`
        ) : null,
        // Actions
        react.createElement(
          "div",
          { className: "dmr-form-actions" },
          react.createElement("button", { type: "button", className: "dmr-btn", onClick: onCancel }, "取消"),
          react.createElement("button", { type: "button", className: "dmr-btn", disabled: testing || !form.hostName || !form.user, onClick: onTest }, testing ? "测试中..." : "测试连接"),
          react.createElement("button", { type: "button", className: "dmr-btn dmr-btn-primary", disabled: saving || !form.id || !form.hostName || !form.user, onClick: onSaveClick }, saving ? "保存中..." : "保存")
        )
      );
    }

    // ── Main Remote Control Component ──────────────────────────────────────
    function RemoteControl(props) {
      const [open, setOpen] = react.useState(false);
      const [hosts, setHosts] = react.useState([]);
      const [selectedHost, setSelectedHost] = react.useState(null);
      const [hostStatus, setHostStatus] = react.useState({});
      const [view, setView] = react.useState("main"); // "main" | "add" | "edit"
      const [editingHost, setEditingHost] = react.useState(null);
      const [command, setCommand] = react.useState("");
      const [execOutput, setExecOutput] = react.useState([]);
      const [execBusy, setExecBusy] = react.useState(false);
      const [uploadPath, setUploadPath] = react.useState("");
      const [downloadPath, setDownloadPath] = react.useState("");
      const [localFile, setLocalFile] = react.useState(null);
      const [transferBusy, setTransferBusy] = react.useState(false);
      const [transferMsg, setTransferMsg] = react.useState(null);
      const [tunnelBusy, setTunnelBusy] = react.useState(false);

      const loadHosts = async () => {
        try {
          const list = await call(REMOTE_API, "hosts.list", {});
          setHosts(list);
          if (list.length > 0 && !selectedHost) setSelectedHost(list[0].id);
          if (selectedHost && !list.some(h => h.id === selectedHost)) {
            setSelectedHost(list.length > 0 ? list[0].id : null);
          }
        } catch (err) {
          console.error("dsh-unknownue-plugins: hosts.list failed:", err);
        }
      };

      const loadStatus = async () => {
        try {
          const value = await call(REMOTE_API, "status", {});
          setHostStatus(value.hosts || {});
        } catch {}
      };

      const openPanel = () => {
        setOpen(true);
        setView("main");
        loadHosts();
        loadStatus();
      };

      const onAddHost = () => { setView("add"); setEditingHost(null); };
      const onEditHost = (host) => {
        setView("edit");
        setEditingHost({
          ...host,
          keyPath: host.keyPath || "",
          tunnelEnabled: host.hasTunnel || false,
          tunnelPort: host.tunnelPort || 2222,
          tunnelServiceName: host.tunnelServiceName || "reverse-ssh-tunnel.service"
        });
      };

      const onSaveHost = async (payload) => {
        try {
          if (view === "add") {
            await call(REMOTE_API, "hosts.add", payload);
          } else {
            await call(REMOTE_API, "hosts.update", payload);
          }
          setView("main");
          setEditingHost(null);
          await loadHosts();
          await loadStatus();
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err));
        }
      };

      const onRemoveHost = async (id) => {
        if (!confirm(`确定删除主机 "${id}"？`)) return;
        try {
          await call(REMOTE_API, "hosts.remove", { id });
          await loadHosts();
          await loadStatus();
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err));
        }
      };

      // Execute command
      const onExec = async () => {
        if (!selectedHost || !command.trim() || execBusy) return;
        setExecBusy(true);
        const cmd = command.trim();
        setExecOutput(prev => [...prev, { type: "cmd", text: `$ ${cmd}` }]);
        try {
          const result = await call(REMOTE_API, "exec", { hostId: selectedHost, command: cmd });
          if (result.stdout) setExecOutput(prev => [...prev, { type: "out", text: result.stdout }]);
          if (result.stderr) setExecOutput(prev => [...prev, { type: "err", text: result.stderr }]);
          if (result.exitCode !== 0) setExecOutput(prev => [...prev, { type: "meta", text: `[exit code: ${result.exitCode}]` }]);
        } catch (err) {
          setExecOutput(prev => [...prev, { type: "err", text: err instanceof Error ? err.message : String(err) }]);
        } finally {
          setExecBusy(false);
          setCommand("");
        }
      };

      // Upload file
      const onUpload = async () => {
        if (!selectedHost || !localFile || !uploadPath.trim() || transferBusy) return;
        setTransferBusy(true);
        setTransferMsg(null);
        try {
          const result = await call(REMOTE_API, "upload", { hostId: selectedHost, localPath: localFile, remotePath: uploadPath.trim() });
          setTransferMsg({ ok: true, text: `已上传: ${result.to} (${result.size} bytes)` });
        } catch (err) {
          setTransferMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
        } finally {
          setTransferBusy(false);
        }
      };

      // Download file
      const onDownload = async () => {
        if (!selectedHost || !downloadPath.trim() || transferBusy) return;
        setTransferBusy(true);
        setTransferMsg(null);
        try {
          const result = await call(REMOTE_API, "download", { hostId: selectedHost, remotePath: downloadPath.trim(), localPath: "/tmp" });
          setTransferMsg({ ok: true, text: `已下载: ${result.downloaded} (${result.size} bytes)` });
        } catch (err) {
          setTransferMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
        } finally {
          setTransferBusy(false);
        }
      };

      // Tunnel actions
      const onTunnelAction = async (action) => {
        if (!selectedHost) return;
        setTunnelBusy(true);
        try {
          await call(REMOTE_API, `tunnel.${action}`, { hostId: selectedHost });
          await loadStatus();
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err));
        } finally {
          setTunnelBusy(false);
        }
      };

      if (!open) {
        return react.createElement(
          "button",
          { type: "button", className: "dmk-action", title: "远程控制", "aria-label": "远程控制", onClick: openPanel },
          react.createElement(RemoteGlyph)
        );
      }

      const onClose = () => { setOpen(false); setView("main"); };
      const currentHost = hosts.find(h => h.id === selectedHost);
      const currentStatus = hostStatus[selectedHost];

      // ── Add/Edit view ──
      if (view === "add" || view === "edit") {
        return react.createElement(
          "div",
          { className: "dmk-overlay" },
          react.createElement("div", { className: "dmk-mask", onClick: onClose }),
          react.createElement(
            "div",
            { className: "dmr-card", role: "dialog", "aria-label": view === "add" ? "添加主机" : "编辑主机" },
            react.createElement(HostForm, {
              initial: view === "edit" ? editingHost : null,
              onSave: onSaveHost,
              onCancel: () => { setView("main"); setEditingHost(null); }
            })
          )
        );
      }

      // ── Main view ──
      // Host selector bar
      const hostSelector = react.createElement(
        "div",
        { className: "dmr-hosts" },
        hosts.map(h => {
          const st = hostStatus[h.id];
          const reachable = st ? st.reachable : false;
          return react.createElement(
            "button",
            {
              key: h.id,
              type: "button",
              className: "dmr-host-btn" + (h.id === selectedHost ? " dmr-host-active" : ""),
              onClick: () => { setSelectedHost(h.id); setExecOutput([]); }
            },
            react.createElement("span", {
              className: "dmr-dot",
              style: { background: reachable ? "var(--dsw-alias-state-success)" : "var(--dsw-alias-state-error)" }
            }),
            h.label
          );
        }),
        react.createElement(
          "button",
          { type: "button", className: "dmr-host-btn dmr-host-add", title: "添加主机", onClick: onAddHost },
          react.createElement(PlusGlyph)
        )
      );

      // Host info bar
      const hostInfo = currentHost ? react.createElement(
        "div",
        { className: "dmr-host-info" },
        react.createElement("span", { className: "dmr-host-detail" },
          `${currentHost.user}@${currentHost.hostName}:${currentHost.port}`
        ),
        currentHost.description ? react.createElement("span", { className: "dmr-meta" }, ` · ${currentHost.description}`) : null,
        react.createElement("div", { className: "dmr-host-actions" },
          react.createElement("button", { type: "button", className: "dmr-btn-sm", title: "编辑", onClick: () => onEditHost(currentHost) }, "编辑"),
          react.createElement("button", { type: "button", className: "dmr-btn-sm dmr-btn-danger", title: "删除", onClick: () => onRemoveHost(currentHost.id) },
            react.createElement(TrashGlyph)
          )
        )
      ) : null;

      // Tunnel section
      const tunnelInfo = currentStatus && currentStatus.tunnel ? currentStatus.tunnel : null;
      const tunnelSection = currentHost && currentHost.hasTunnel ? react.createElement(
        "div",
        { className: "dmr-section" },
        react.createElement("div", { className: "dmr-section-title" }, "隧道状态"),
        react.createElement(
          "div",
          { className: "dmr-tunnel" },
          react.createElement("span", {
            className: "dmr-dot",
            style: { background: tunnelInfo && tunnelInfo.portListening ? "var(--dsw-alias-state-success)" : "var(--dsw-alias-state-error)" }
          }),
          react.createElement("span", null,
            tunnelInfo ? (tunnelInfo.portListening ? `端口 ${tunnelInfo.port} 监听中` : `端口 ${tunnelInfo.port} 未监听`) : "检查中..."
          ),
          tunnelInfo && tunnelInfo.service ? react.createElement("span", { className: "dmr-meta" },
            ` · ${tunnelInfo.service.status}${tunnelInfo.service.uptime ? " · " + tunnelInfo.service.uptime : ""}`
          ) : null,
          react.createElement("div", { className: "dmr-tunnel-actions" },
            react.createElement("button", { type: "button", className: "dmr-btn", disabled: tunnelBusy, onClick: () => onTunnelAction("restart") }, "重启"),
            react.createElement("button", { type: "button", className: "dmr-btn", disabled: tunnelBusy, onClick: () => onTunnelAction("stop") }, "停止"),
            react.createElement("button", { type: "button", className: "dmr-btn", disabled: tunnelBusy, onClick: () => onTunnelAction("start") }, "启动")
          )
        )
      ) : null;

      const noHostsMsg = hosts.length === 0
        ? react.createElement("div", { className: "dmr-empty" }, "还没有配置远程主机，点击上方 + 添加")
        : null;

      return react.createElement(
        "div",
        { className: "dmk-overlay" },
        react.createElement("div", { className: "dmk-mask", onClick: onClose }),
        react.createElement(
          "div",
          { className: "dmr-card", role: "dialog", "aria-label": "远程控制" },
          // Header
          react.createElement(
            "div",
            { className: "dmk-head" },
            react.createElement("h3", { className: "dmk-title" }, "远程控制"),
            react.createElement("button", { type: "button", className: "dmk-close", onClick: onClose, "aria-label": "Close" }, "\u2715")
          ),
          // Host selector
          hostSelector,
          // Host info
          hostInfo,
          // No hosts message
          noHostsMsg,
          // Command execution
          currentHost && currentStatus && currentStatus.reachable ? react.createElement(
            "div",
            { className: "dmr-section" },
            react.createElement("div", { className: "dmr-section-title" }, "命令执行"),
            react.createElement(
              "div",
              { className: "dmr-cmd-row" },
              react.createElement("input", {
                type: "text",
                className: "dmk-workdir",
                value: command,
                placeholder: "输入命令...",
                disabled: execBusy,
                onChange: (e) => setCommand(e.target.value),
                onKeyDown: (e) => { if (e.key === "Enter") onExec(); }
              }),
              react.createElement("button", { type: "button", className: "dmk-btn", disabled: execBusy || !command.trim(), onClick: onExec },
                execBusy ? "执行中..." : "执行"
              )
            ),
            execOutput.length > 0 ? react.createElement(
              "div",
              { className: "dmr-output" },
              execOutput.map((line, i) => react.createElement("div", { key: i, className: "dmr-output-" + line.type }, line.text))
            ) : null
          ) : null,
          // File transfer
          currentHost && currentStatus && currentStatus.reachable ? react.createElement(
            "div",
            { className: "dmr-section" },
            react.createElement("div", { className: "dmr-section-title" }, "文件传输"),
            react.createElement(
              "div",
              { className: "dmr-transfer-row" },
              react.createElement("input", { type: "file", className: "dmr-file-input", onChange: (e) => setLocalFile(e.target.files?.[0]?.path || e.target.value) }),
              react.createElement("input", { type: "text", className: "dmk-workdir", value: uploadPath, placeholder: "远程路径", onChange: (e) => setUploadPath(e.target.value) }),
              react.createElement("button", { type: "button", className: "dmk-btn", disabled: transferBusy || !localFile || !uploadPath.trim(), onClick: onUpload }, "上传")
            ),
            react.createElement(
              "div",
              { className: "dmr-transfer-row" },
              react.createElement("input", { type: "text", className: "dmk-workdir", value: downloadPath, placeholder: "远程文件路径", onChange: (e) => setDownloadPath(e.target.value) }),
              react.createElement("button", { type: "button", className: "dmk-btn", disabled: transferBusy || !downloadPath.trim(), onClick: onDownload }, "下载")
            ),
            transferMsg ? react.createElement("div", { className: "dmr-meta" + (transferMsg.ok ? "" : " dmr-error") }, transferMsg.text) : null
          ) : null,
          // Tunnel status
          tunnelSection
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

      const remoteInjected = () => ({ sessions: ctx.sessions });
      ctx.effect(
        () => ctx.slots.inject(
          "conversation.session.header.actions",
          () => ctx.slots.register(
            { name: "conversation.session.header.actions", id: "dsh-unknownue-plugins/remote", inject: remoteInjected },
            RemoteControl
          )
        ),
        "dsh-unknownue-plugins: remote control action"
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

/**
 * Paperspace root: setup screen (first-run, mandatory configuration) →
 * library list ⇄ paper reader.
 *
 * TWO SURFACES render this one view:
 *   - `view` — the 论文 tab in the conversation body, which owns its route
 *     (module state + a sessionStorage mirror, see below);
 *   - `sidebar` — DSH's right Sidebar pane, which is CONTROLLED: the tab's
 *     navigation params are the route and `navigate` writes them back, so the
 *     list ⇄ reader trip never touches this module's tab-level memory.
 */
import { FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import PapersList from './papers-list';
import Reader from './reader';
import { sessionsUrl } from './api';
import { fetchSettings, saveSettings, type SettingsView } from './settings-page';
import { readPaperspaceTheme, rememberPaperspaceTheme, type PaperspaceTheme } from './theme';
import { openPaperInSidebar, useSidebarRightAvailable } from './sidebar-link';

/** Which surface hosts the view: the 论文 tab, or the right Sidebar pane. */
export type PaperspaceSurface = 'view' | 'sidebar';

/** What the view shows: the library, or one paper's reader. */
export type PaperspaceRoute = { kind: 'list' } | { kind: 'reader'; arxivId: string };

/**
 * Tab switching unmounts the 论文 tab (DSH renders only the active
 * conversation.view), so the TAB's route lives OUTSIDE the component: module
 * state survives tab switches, and a sessionStorage mirror survives page
 * reloads. The Sidebar surface has no such problem — its route is the tab's
 * navigation record — and therefore never reads or writes this memory.
 */
const ROUTE_STORAGE_KEY = 'dsh-unknownue-plugins/paperspace:route';
let memoryRoute: PaperspaceRoute | null = null;

function isRoute(value: unknown): value is PaperspaceRoute {
  if (value === null || typeof value !== 'object') return false;
  const route = value as { kind?: unknown; arxivId?: unknown };
  return route.kind === 'list' || (route.kind === 'reader' && typeof route.arxivId === 'string');
}

function readInitialRoute(): PaperspaceRoute {
  if (memoryRoute) return memoryRoute;
  try {
    const raw = sessionStorage.getItem(ROUTE_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isRoute(parsed)) return parsed;
    }
  } catch {
    /* storage unavailable — fall back to the list */
  }
  return { kind: 'list' };
}

function rememberRoute(route: PaperspaceRoute): void {
  memoryRoute = route;
  try {
    sessionStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(route));
  } catch {
    /* storage unavailable — module state still keeps the tab switch working */
  }
}

function SetupScreen({ defaults, onConfigured }: { defaults: SettingsView['defaults']; onConfigured: () => void }) {
  const [dataDir, setDataDir] = useState(defaults.dataDir);
  const [assetsDir, setAssetsDir] = useState(defaults.assetsDir);
  const [workspaceDir, setWorkspaceDir] = useState(defaults.workspaceDir);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function enable(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await saveSettings({
      configured: true,
      dataDir: dataDir.trim(),
      assetsDir: assetsDir.trim(),
      workspaceDir: workspaceDir.trim(),
      port: defaults.port,
      initialMemoryBytes: defaults.initialMemoryBytes,
      pollMs: defaults.pollMs,
      ingestTimeoutMs: defaults.ingestTimeoutMs,
      maxAssetBytes: defaults.maxAssetBytes,
      ingestConcurrency: defaults.ingestConcurrency,
      translateMaxAttempts: defaults.translateMaxAttempts,
      translateStuckAfterMinutes: defaults.translateStuckAfterMinutes,
      translateTimeoutMs: defaults.translateTimeoutMs,
      rescanIntervalMs: defaults.rescanIntervalMs,
      translateModel: defaults.translateModel,
      proxy: defaults.proxy ?? '',
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? '保存失败');
      return;
    }
    onConfigured();
  }

  return (
    <main className="paper-workbench">
      <header className="workbench-header">
        <div>
          <h1>论文阅读（Paperspace）</h1>
          <p>首次使用需要选择论文库的存储位置。数据库（内嵌 PostgreSQL）和论文图片将保存在你的磁盘上。</p>
        </div>
      </header>
      <form className="paper-card" onSubmit={enable}>
        <label className="paper-field">
          <span>数据库目录（dataDir）</span>
          <input value={dataDir} onChange={event => setDataDir(event.target.value)} placeholder="~/.dsh/paperspace/db" />
        </label>
        <label className="paper-field">
          <span>资产目录（assetsDir）</span>
          <input value={assetsDir} onChange={event => setAssetsDir(event.target.value)} placeholder="~/.dsh/paperspace/assets" />
        </label>
        <label className="paper-field">
          <span>DSH 工作区（workspaceDir，存放 papers/*.md 供 DSH 工具读取）</span>
          <input value={workspaceDir} onChange={event => setWorkspaceDir(event.target.value)} placeholder="~/.dsh/paperspace/workspace" />
        </label>
        {error && <p className="form-error">⚠ {error}</p>}
        <div className="dialog-actions">
          <span className="paper-id">更多选项（内存、后台任务参数）在 DSH 设置 → UnPlugin → Paperspace 中调整。</span>
          <button className="button primary" disabled={busy || !dataDir.trim() || !assetsDir.trim()}>
            {busy ? '启动中…' : '保存并启用'}
          </button>
        </div>
      </form>
    </main>
  );
}

export interface PaperspaceSessionsFace {
  open(id: string): void;
  create?(opts: { workspaceId: string }): Promise<string>;
  list?: {
    getSnapshot(): { current?: string; byId?: Record<string, unknown> };
  };
}

export interface PaperspaceWorkspacesFace {
  /** Returns the wire WorkspaceView (`workspaceId`, `path`, …). */
  create(input: { path: string }): Promise<{ workspaceId: string; path: string }>;
  list?: {
    getSnapshot(): { items?: Array<{ workspaceId: string }> };
  };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** DSH paints its conversation region with `--dsw-alias-bg-base`; these are
 *  the light/dark page values used when the tab's theme is pinned. */
const PAGE_DARK = '#151517';
const PAGE_LIGHT = '#ffffff';

function composerSeatGradient(page: string): string {
  return `linear-gradient(180deg, transparent 0px, ${page} 36px)`;
}

export interface PaperspaceViewProps {
  sessions?: PaperspaceSessionsFace;
  workspaces?: PaperspaceWorkspacesFace;
  /** Hosting surface; defaults to the 论文 tab. */
  surface?: PaperspaceSurface;
  /** Controlled route; the Sidebar tab passes the one its navigation params name. */
  route?: PaperspaceRoute;
  /** Controlled navigation; the Sidebar tab writes params back through it. */
  navigate?: (next: PaperspaceRoute) => void;
}

export default function PaperspaceView({
  sessions,
  workspaces,
  surface = 'view',
  route: controlledRoute,
  navigate: controlledNavigate,
}: PaperspaceViewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [localRoute, setLocalRoute] = useState<PaperspaceRoute>(readInitialRoute);
  const route = controlledRoute ?? localRoute;
  const navigate = useCallback(
    (next: PaperspaceRoute) => {
      if (controlledNavigate !== undefined) {
        controlledNavigate(next);
        return;
      }
      rememberRoute(next);
      setLocalRoute(next);
    },
    [controlledNavigate],
  );
  // 在侧栏打开 belongs to the TAB (the Sidebar is where it opens); it is also
  // absent — and so keeps the button off screen — on a DSH without the column.
  const sidebarRight = useSidebarRightAvailable();
  const openInSidebar = surface === 'view' && sidebarRight ? openPaperInSidebar : undefined;
  // Paperspace-local theme, independent from DSH's light/dark setting.
  const [psTheme, setPsTheme] = useState<PaperspaceTheme>(readPaperspaceTheme);
  const changeTheme = useCallback((next: PaperspaceTheme) => {
    rememberPaperspaceTheme(next);
    setPsTheme(next);
  }, []);
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [settingsFailed, setSettingsFailed] = useState(false);

  // When the tab's theme is pinned (light/dark), paint DSH's view container
  // and scrollport behind the tab so the page background no longer reuses
  // DSH's theme. In auto mode DSH's own background stays untouched. Every
  // inline style is restored when the tab unmounts or the mode changes.
  //
  // The Sidebar surface never paints anything: its ancestors are DSH's own
  // panel chrome, which the reading surface must not repaint (the pane keeps
  // its own background, and the view paints its paper surface itself).
  useLayoutEffect(() => {
    if (psTheme === 'auto' || surface === 'sidebar') return;
    const root = rootRef.current;
    if (!root) return;
    const page = psTheme === 'dark' ? PAGE_DARK : PAGE_LIGHT;
    const gradient = composerSeatGradient(page);
    const restores: Array<() => void> = [];
    const paint = (el: HTMLElement | null) => {
      if (!el) return;
      const previous = el.style.backgroundColor;
      el.style.backgroundColor = page;
      restores.push(() => {
        el.style.backgroundColor = previous;
      });
    };
    // The view area container directly hosting the tab…
    paint(root.parentElement);
    // …and DSH's scrollport (the ancestor that actually scrolls the view),
    // plus its sticky composer gradient, both of which reuse DSH tokens.
    let node: HTMLElement | null = root.parentElement;
    while (node) {
      const { overflowY } = getComputedStyle(node);
      if (overflowY === 'auto' || overflowY === 'scroll') {
        paint(node);
        const seat = node.querySelector<HTMLElement>('[class*="composerSeat"]');
        if (seat) {
          const previous = seat.style.background;
          seat.style.background = gradient;
          restores.push(() => {
            seat.style.background = previous;
          });
        }
        break;
      }
      node = node.parentElement;
    }
    return () => restores.forEach(restore => restore());
  }, [psTheme]);

  const reload = useCallback(async () => {
    const next = await fetchSettings();
    if (next === null) {
      setSettingsFailed(true);
      return;
    }
    setSettingsFailed(false);
    setSettings(next);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Native DSH flow: sessions.create({ workspaceId }) → sessions.open()
  const discuss = useCallback(
    async (arxivId: string) => {
      const step = (message: string) => console.log('[paperspace:discuss]', message);
      const die = (message: string) => {
        console.warn('[paperspace:discuss] FAILED:', message);
        window.alert(message + '（详细步骤见浏览器控制台 [paperspace:discuss]）');
      };
      try {
        step('prepare: ' + arxivId);
        const response = await fetch(sessionsUrl(), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ arxiv_id: arxivId }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) return die('无法准备论文会话：' + ((body?.message ?? body?.code) || 'HTTP ' + response.status));
        if (!workspaces) return die('DSH 工作区服务不可用');
        if (!sessions?.create) return die('DSH 会话创建服务不可用');

        const workspace = await workspaces.create({ path: String(body.workspaceDir) });
        const workspaceId = workspace.workspaceId;
        step('workspaceId=' + workspaceId);

        // Wait for workspace to appear in the client list.
        for (let attempt = 0; attempt < 40; attempt++) {
          const items = workspaces.list?.getSnapshot()?.items ?? [];
          if (items.some(item => item.workspaceId === workspaceId)) break;
          await sleep(250);
        }

        // Create a session in this workspace, then open it.
        const sessionId = await sessions.create({ workspaceId });
        step('sessionId=' + sessionId);
        sessions.open(sessionId);
        step('open() done');

        // Link the paper to the session.
        const linkResponse = await fetch(sessionsUrl() + '/link', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, arxiv_id: arxivId }),
        });
        if (!linkResponse.ok) {
          const linkBody = (await linkResponse.json().catch(() => null)) as { message?: string } | null;
          return die('会话已打开，但论文绑定失败：' + (linkBody?.message ?? ''));
        }
        step('linked ' + sessionId + ' → ' + arxivId);
      } catch (error) {
        die('无法创建论文会话：' + (error instanceof Error ? error.message : String(error)));
      }
    },
    [sessions, workspaces],
  );

  return (
    <div className="dsh-paperspace" ref={rootRef} data-ps-theme={psTheme === 'auto' ? undefined : psTheme}>
      {/* The surface wrapper carries the hosting surface as an attribute: every
          stylesheet rule is scoped under `.dsh-paperspace` at build time, so the
          root itself can never be matched by a descendant selector — and the
          attribute is also what keeps the tab's composer-hiding rule from firing
          when paperspace is only the Sidebar's pane. */}
      <div className="dsh-ps-surface" data-ps-surface={surface}>
        {settings === null ? (
          <main className="paper-workbench">
            {settingsFailed ? (
              <section className="empty-state">
                <h2>Could not reach the paperspace host</h2>
                <p>The plugin's host half is not running. Check the bundle install and restart dsh web.</p>
                <button className="button primary" onClick={() => void reload()}>
                  Retry
                </button>
              </section>
            ) : (
              <p className="ingesting">
                <span className="spinner" /> Loading paperspace…
              </p>
            )}
          </main>
        ) : !settings.configured ? (
          <SetupScreen defaults={settings.defaults} onConfigured={() => void reload()} />
        ) : (
          <>
            {route.kind === 'list' && (
              <PapersList
                surface={surface}
                theme={psTheme}
                onThemeChange={changeTheme}
                onOpen={arxivId => navigate({ kind: 'reader', arxivId })}
                onDiscuss={arxivId => void discuss(arxivId)}
                onOpenInSidebar={openInSidebar}
              />
            )}
            {route.kind === 'reader' && (
              <Reader
                key={route.arxivId}
                arxivId={route.arxivId}
                surface={surface}
                theme={psTheme}
                onThemeChange={changeTheme}
                onBack={() => navigate({ kind: 'list' })}
                onDiscuss={() => void discuss(route.arxivId)}
                onOpenInSidebar={openInSidebar === undefined ? undefined : () => openInSidebar(route.arxivId)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

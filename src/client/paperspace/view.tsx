/**
 * Paperspace tab root: setup screen (first-run, mandatory configuration) →
 * library list ⇄ paper reader, plus the shared model settings modal.
 */
import { FormEvent, useCallback, useEffect, useState } from 'react';
import PapersList from './papers-list';
import Reader from './reader';
import ModelSettingsModal from './model-settings-modal';
import { sessionsUrl } from './api';
import { fetchSettings, saveSettings, type SettingsView } from './settings-page';

type Route = { kind: 'list' } | { kind: 'reader'; arxivId: string };

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
  list?: {
    getSnapshot(): { current?: string; byId?: Record<string, unknown> };
  };
}

export interface PaperspaceWorkspacesFace {
  /** Returns the wire WorkspaceView (`workspaceId`, `path`, …). */
  create(input: { path: string }): Promise<{ workspaceId: string; path: string }>;
  /** Connect the workspace's blank session (returns an id already in the list). */
  connectWorkspace?(workspaceId: string): Promise<string>;
  /** DSH's own "New Session flow": connect + OPEN the resulting session. */
  startSession(workspaceId?: string): void;
  list?: {
    getSnapshot(): { items?: Array<{ workspaceId: string }> };
  };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function PaperspaceView({ sessions, workspaces }: { sessions?: PaperspaceSessionsFace; workspaces?: PaperspaceWorkspacesFace }) {
  const [route, setRoute] = useState<Route>({ kind: 'list' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [settingsFailed, setSettingsFailed] = useState(false);

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

  // Native DSH flow, with step-by-step diagnostics (`[paperspace:discuss]` in
  // the browser console) and a dual open path:
  //   A) connectWorkspace → sessions.open
  //   B) fallback startSession (DSH's own open flow)
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
        const workspace = await workspaces.create({ path: String(body.workspaceDir) });
        const workspaceId = workspace.workspaceId;
        step('workspaceId=' + workspaceId);
        // connectWorkspace requires the workspace in the client list snapshot.
        let inList = false;
        for (let attempt = 0; attempt < 40; attempt++) {
          const items = workspaces.list?.getSnapshot()?.items ?? [];
          if (items.some(item => item.workspaceId === workspaceId)) {
            inList = true;
            break;
          }
          await sleep(250);
        }
        step('workspace in client list: ' + inList);
        const previousCurrent = sessions?.list?.getSnapshot()?.current;
        step('previousCurrent=' + String(previousCurrent));

        // Path A: typed connectWorkspace + manual open.
        let sessionId: string | undefined;
        let opened = false;
        if (typeof workspaces.connectWorkspace === 'function') {
          try {
            sessionId = await workspaces.connectWorkspace(workspaceId);
            step('connectWorkspace → ' + sessionId);
            try {
              sessions?.open?.(sessionId);
              opened = true;
              step('open() accepted ' + sessionId);
            } catch (openError) {
              step('open() threw: ' + String(openError));
            }
          } catch (connectError) {
            step('connectWorkspace threw: ' + String(connectError));
          }
        }

        // Path B: native startSession (connect + open through DSH's own flow).
        if (!opened) {
          step('fallback: startSession');
          workspaces.startSession(workspaceId);
        }

        // Resolve the CURRENT session (changed selection or the connected id).
        let currentId: string | undefined;
        for (let attempt = 0; attempt < 60; attempt++) {
          const current = sessions?.list?.getSnapshot()?.current;
          if (current && (current === sessionId || current !== previousCurrent)) {
            currentId = current;
            break;
          }
          await sleep(250);
        }
        step('current=' + String(currentId) + ' session=' + String(sessionId));
        const target = currentId ?? sessionId;
        if (!target) return die('未能打开论文会话——请在 Paperspace 分组中手动点击该会话后再提问。');

        const linkResponse = await fetch(sessionsUrl() + '/link', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ session_id: target, arxiv_id: arxivId }),
        });
        if (!linkResponse.ok) {
          const linkBody = (await linkResponse.json().catch(() => null)) as { message?: string } | null;
          return die('会话已打开，但论文绑定失败：' + (linkBody?.message ?? ''));
        }
        step('linked ' + target + ' → ' + arxivId);
      } catch (error) {
        die('无法创建论文会话：' + (error instanceof Error ? error.message : String(error)));
      }
    },
    [sessions, workspaces],
  );

  return (
    <div className="dsh-paperspace">
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
          {route.kind === 'list' && <PapersList onOpen={arxivId => setRoute({ kind: 'reader', arxivId })} onDiscuss={arxivId => void discuss(arxivId)} />}
          {route.kind === 'reader' && (
            <Reader
              arxivId={route.arxivId}
              onBack={() => setRoute({ kind: 'list' })}
              onOpenSettings={() => setSettingsOpen(true)}
              onDiscuss={() => void discuss(route.arxivId)}
            />
          )}
          {settingsOpen && <ModelSettingsModal onClose={() => setSettingsOpen(false)} />}
        </>
      )}
    </div>
  );
}

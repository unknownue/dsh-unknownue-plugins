/**
 * UnPlugin settings page — registered into DSH's Settings UI via the
 * `settings.section` slot (same mechanism as dsh-workspace-enhancement).
 * The page groups every bundle feature; Paperspace owns one section.
 *
 * Storage options persist to `<dsh home>/paperspace/settings.json` through
 * the host's loopback settings route. Enabling starts the runtime; changes
 * while running are saved but flagged `restartRequired`.
 *
 * NOTE: the root wraps everything in `.dsh-paperspace` — the bundle's
 * stylesheet is scope-prefixed at build time, and the settings page is
 * mounted OUTSIDE the tab's own wrapper.
 */
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { settingsUrl } from './api';

export interface PaperspaceSettingsFile {
  version: number;
  configured: boolean;
  dataDir: string;
  assetsDir: string;
  workspaceDir: string;
  port: number;
  initialMemoryBytes: number;
  pollMs: number;
  ingestTimeoutMs: number;
  maxAssetBytes: number;
  ingestConcurrency: number;
  translateMaxAttempts: number;
  translateStuckAfterMinutes: number;
  translateTimeoutMs: number;
  rescanIntervalMs: number;
}

export interface SettingsView {
  configured: boolean;
  restartRequired: boolean;
  settingsPath: string;
  defaults: PaperspaceSettingsFile;
  settings: PaperspaceSettingsFile | null;
}

export async function fetchSettings(): Promise<SettingsView | null> {
  try {
    const response = await fetch(settingsUrl(), { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as SettingsView;
  } catch {
    return null;
  }
}

export interface SettingsInput {
  configured: boolean;
  dataDir: string;
  assetsDir: string;
  workspaceDir: string;
  port: number;
  initialMemoryBytes: number;
  pollMs: number;
  ingestTimeoutMs: number;
  maxAssetBytes: number;
  ingestConcurrency: number;
  translateMaxAttempts: number;
  translateStuckAfterMinutes: number;
  translateTimeoutMs: number;
  rescanIntervalMs: number;
}

export async function saveSettings(input: SettingsInput): Promise<{ ok: boolean; error?: string; restartRequired?: boolean }> {
  try {
    const response = await fetch(settingsUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, error: body?.message ?? body?.code ?? 'Save failed' };
    return { ok: true, restartRequired: Boolean(body?.restartRequired) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Save failed' };
  }
}

const MB = 1024 * 1024;

type FieldProps<K extends keyof SettingsInput> = {
  label: string;
  keyName: K;
  form: SettingsInput;
  onChange: (key: K, value: SettingsInput[K]) => void;
  type?: 'text' | 'number';
  step?: number;
  display?: (value: SettingsInput[K]) => number | string;
  parse?: (raw: string, fallback: SettingsInput[K]) => SettingsInput[K];
  placeholder?: string;
};

function Field<K extends keyof SettingsInput>({ label, keyName, form, onChange, type = 'text', display, parse, placeholder }: FieldProps<K>) {
  const value = form[keyName];
  const shown = display ? display(value) : (value as number | string);
  return (
    <label className="ps-row">
      <span>{label}</span>
      <input
        type={type}
        value={shown}
        placeholder={placeholder}
        onChange={event => {
          if (type === 'number') {
            const parsed = Number(event.target.value);
            if (!Number.isFinite(parsed)) return;
            onChange(keyName, (parse ? parse(event.target.value, value as never) : parsed) as SettingsInput[K]);
          } else {
            onChange(keyName, event.target.value as SettingsInput[K]);
          }
        }}
      />
    </label>
  );
}

export default function UnknownueSettingsPage() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [form, setForm] = useState<SettingsInput | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const next = await fetchSettings();
    if (!next) {
      setErr('无法访问 paperspace 主机路由（插件 host 未运行？）。');
      return;
    }
    setView(next);
    const base = next.settings ?? next.defaults;
    setForm({
      configured: next.settings?.configured ?? next.configured,
      dataDir: base.dataDir,
      assetsDir: base.assetsDir,
      workspaceDir: base.workspaceDir,
      port: base.port,
      initialMemoryBytes: base.initialMemoryBytes,
      pollMs: base.pollMs,
      ingestTimeoutMs: base.ingestTimeoutMs,
      maxAssetBytes: base.maxAssetBytes,
      ingestConcurrency: base.ingestConcurrency,
      translateMaxAttempts: base.translateMaxAttempts,
      translateStuckAfterMinutes: base.translateStuckAfterMinutes,
      translateTimeoutMs: base.translateTimeoutMs,
      rescanIntervalMs: base.rescanIntervalMs,
    });
    setErr('');
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!view || !form) {
    return (
      <div className="dsh-paperspace">
        <div className="unplugin-settings">
          <p className="settings-empty">{err || '正在读取 Paperspace 设置…'}</p>
        </div>
      </div>
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    const result = await saveSettings(form!);
    setBusy(false);
    if (!result.ok) {
      setErr(result.error ?? '保存失败');
      return;
    }
    setMsg(result.restartRequired ? '已保存。存储路径等改动将在重启 dsh web 后生效。' : '已保存。');
    await reload();
  }

  const set = <K extends keyof SettingsInput>(key: K, value: SettingsInput[K]) => setForm(prev => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="dsh-paperspace">
      <form className="unplugin-settings" onSubmit={save}>
        <header className="unplugin-head">
          <h1>UnPlugin</h1>
          <p>本插件合集的统一设置页；每个功能各占一块区域。Paperspace 需要完成配置并启用后才能使用。</p>
        </header>

        {msg && (
          <p className="settings-notice" role="status">
            {msg}
          </p>
        )}
        {err && <p className="form-error">⚠ {err}</p>}

        <section className="bundle-section">
          <div className="bundle-section-head">
            <h2>Paperspace（论文阅读）</h2>
            <p>论文库存储位置与后台参数。启用后才会在「论文」tab 中开放使用。</p>
          </div>

          <label className="ps-toggle">
            <input type="checkbox" checked={form.configured} onChange={event => set('configured', event.target.checked)} />
            <strong>启用 Paperspace</strong>
            <small>关闭后论文 tab 与 API 立即停止服务，数据保留在磁盘上。</small>
          </label>

          <div className="bundle-section-sub">
            <h3>存储位置</h3>
            <p className="settings-empty">数据库（内嵌 PostgreSQL）与论文图片分开存放；改路径后需重启 dsh web 生效。</p>
            <Field label="数据库目录 dataDir" keyName="dataDir" form={form} onChange={set} placeholder="~/.dsh/paperspace/db" />
            <Field label="资产目录 assetsDir" keyName="assetsDir" form={form} onChange={set} placeholder="~/.dsh/paperspace/assets" />
            <Field label="DSH 工作区 workspaceDir" keyName="workspaceDir" form={form} onChange={set} placeholder="~/.dsh/paperspace/workspace" />
            <Field label="pgwire 端口（0 = 自动）" keyName="port" form={form} onChange={set} type="number" />
            <Field
              label="内存上限（MB）"
              keyName="initialMemoryBytes"
              form={form}
              onChange={set}
              type="number"
              display={value => Math.round((value as number) / MB)}
              parse={(raw, fallback) => Number(raw) * MB || (fallback as number)}
            />
            <p className="settings-empty">
              配置文件：<code>{view.settingsPath}</code>（备份整个数据目录即可迁移书库）
            </p>
          </div>

          <details className="ps-advanced">
            <summary>高级：后台任务参数</summary>
            <Field label="轮询间隔 pollMs（ms）" keyName="pollMs" form={form} onChange={set} type="number" />
            <Field label="摄取超时 ingestTimeoutMs（ms）" keyName="ingestTimeoutMs" form={form} onChange={set} type="number" />
            <Field label="单图上限 maxAssetBytes（字节）" keyName="maxAssetBytes" form={form} onChange={set} type="number" />
            <Field label="图片下载并发 ingestConcurrency" keyName="ingestConcurrency" form={form} onChange={set} type="number" />
            <Field label="翻译最大尝试 translateMaxAttempts" keyName="translateMaxAttempts" form={form} onChange={set} type="number" />
            <Field label="僵死任务阈值 translateStuckAfterMinutes（分钟）" keyName="translateStuckAfterMinutes" form={form} onChange={set} type="number" />
            <Field label="翻译请求超时 translateTimeoutMs（ms）" keyName="translateTimeoutMs" form={form} onChange={set} type="number" />
            <Field label="僵死重扫间隔 rescanIntervalMs（ms）" keyName="rescanIntervalMs" form={form} onChange={set} type="number" />
          </details>

          <div className="ps-actions">
            <button className="button primary" disabled={busy}>
              {busy ? '保存中…' : '保存'}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}

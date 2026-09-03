/**
 * Task-board settings section, rendered INSIDE the UnPlugin settings page
 * (paperspace owns that page; every bundle feature keeps one area there).
 * Uses the paperspace page's own classes (bundle-section / ps-row / button)
 * so styling stays uniform, and hardcoded Chinese copy like that page.
 *
 * The only user-tunable is the PGlite database directory; changing it while
 * the runtime is up is persisted but flagged restartRequired (PGlite booted
 * against the old directory).
 */
import { useCallback, useEffect, useState } from 'react';
import React from 'react';
import { fetchTasksSettings, saveTasksSettings, type TasksSettingsView } from './api';

export default function TasksSettingsSection() {
  const [view, setView] = useState<TasksSettingsView | null>(null);
  const [dataDir, setDataDir] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const next = await fetchTasksSettings();
      setView(next);
      setDataDir((next.settings ?? next.defaults).dataDir);
      setErr('');
    } catch {
      setErr('无法访问任务面板 host 路由（插件 host 未运行？）。');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const result = await saveTasksSettings({ data_dir: dataDir });
      setMsg(result.restartRequired ? '已保存。数据库位置改动将在重启 dsh web 后生效。' : '已保存。');
      await reload();
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bundle-section">
      <div className="bundle-section-head">
        <h2>任务面板</h2>
        <p>个人任务看板（任务 tab）的数据库存储位置；修改后需重启 dsh web 生效。</p>
      </div>

      {msg !== '' && (
        <p className="settings-notice" role="status">
          {msg}
        </p>
      )}
      {err !== '' && <p className="form-error">⚠ {err}</p>}

      <label className="ps-row">
        <span>数据库目录 dataDir</span>
        <input value={dataDir} onChange={event => setDataDir(event.target.value)} placeholder="~/.dsh/tasks/db" />
      </label>

      {view !== null && (
        <p className="settings-empty">
          配置文件：<code>{view.settingsPath}</code>（备份整个数据目录即可迁移任务板）
        </p>
      )}

      <div className="ps-actions">
        <button type="button" className="button primary" disabled={busy || dataDir.trim() === ''} onClick={() => void save()}>
          {busy ? '保存中…' : '保存'}
        </button>
      </div>
    </section>
  );
}

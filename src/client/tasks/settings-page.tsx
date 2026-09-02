/**
 * Task-board settings section (registered as its own `settings.section` entry,
 * labelled 任务面板 — independent of the paperspace-owned UnPlugin page).
 *
 * The only user-tunable is the PGlite database directory; changing it while
 * the runtime is up is persisted but flagged restartRequired (PGlite booted
 * against the old directory).
 */
import { FormEvent, useCallback, useEffect, useState } from 'react';
import React from 'react';
import { fetchTasksSettings, saveTasksSettings, type TasksSettingsView } from './api';
import type { TasksLocale } from './view';

export default function TasksSettings({ t }: { t: TasksLocale }) {
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
      setErr(t('settings.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const result = await saveTasksSettings({ data_dir: dataDir });
      setMsg(result.restartRequired ? t('settings.restartRequired') : t('settings.saved'));
      await reload();
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : t('settings.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dsh-tasks">
      <form className="tk-settings" onSubmit={save}>
        <header className="tk-settings-head">
          <h2>{t('settings.title')}</h2>
          <p>{t('settings.hint')}</p>
        </header>

        {msg !== '' && (
          <p className="tk-notice" role="status">
            {msg}
          </p>
        )}
        {err !== '' && <p className="tk-error">⚠ {err}</p>}

        <label className="tk-field">
          <span>{t('settings.dataDir')}</span>
          <input className="tk-input" value={dataDir} onChange={event => setDataDir(event.target.value)} placeholder="~/.dsh/tasks/db" />
        </label>

        {view !== null && (
          <p className="tk-settings-meta">
            {t('settings.settingsPath')} <code>{view.settingsPath}</code>
          </p>
        )}

        <div className="tk-dialog-foot">
          <div className="tk-foot-right">
            <button type="submit" className="tk-btn tk-btn-primary" disabled={busy || dataDir.trim() === ''}>
              {busy ? '…' : t('settings.save')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

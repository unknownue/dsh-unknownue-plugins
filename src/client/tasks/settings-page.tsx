/**
 * Task-board settings section, rendered INSIDE the UnPlugin settings page
 * (paperspace owns that page; every bundle feature keeps one area there).
 * Uses the paperspace page's own classes (bundle-section / ps-row / button)
 * so styling stays uniform, and hardcoded Chinese copy like that page.
 *
 * Tunables:
 *   - the PGlite database directory (changing it while the runtime is up is
 *     persisted but flagged restartRequired — PGlite booted against the old
 *     directory);
 *   - the quick-add subtask presets shown in the new-task editor. They live
 *     in the same settings.json; `preset_todos: null` resets them to the
 *     client's built-in localized presets. An empty list hides the panel.
 */
import { useCallback, useEffect, useState } from 'react';
import React from 'react';
import { fetchTasksSettings, saveTasksSettings, type TasksSettingsView } from './api';

/** Built-in zh labels — mirrors the `todos.preset.*` dictionary entries. */
const DEFAULT_PRESETS = ['需求确认', '方案设计', '编码实现', '自测验证', '代码评审', '更新文档'];
const PRESETS_MAX = 20;

/** Trim + drop empties + dedupe + cap (mirrors the host-side normalization). */
function normalizePresets(rows: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rows) {
    const text = raw.trim();
    if (text === '' || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= PRESETS_MAX) break;
  }
  return out;
}

export default function TasksSettingsSection() {
  const [view, setView] = useState<TasksSettingsView | null>(null);
  const [dataDir, setDataDir] = useState('');
  const [presets, setPresets] = useState<string[]>(DEFAULT_PRESETS);
  const [newPreset, setNewPreset] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const next = await fetchTasksSettings();
      setView(next);
      setDataDir((next.settings ?? next.defaults).dataDir);
      setPresets(next.settings?.presetTodos ?? [...DEFAULT_PRESETS]);
      setErr('');
    } catch {
      setErr('无法访问任务面板 host 路由（插件 host 未运行？）。');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Persist dataDir + presets (`null` resets presets to built-in defaults). */
  async function persist(presetTodos: string[] | null) {
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const result = await saveTasksSettings({ data_dir: dataDir, preset_todos: presetTodos });
      setMsg(result.restartRequired ? '已保存。数据库位置改动将在重启 dsh web 后生效。' : '已保存。');
      await reload();
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  function addPreset() {
    const text = newPreset.trim();
    if (text === '' || presets.includes(text) || presets.length >= PRESETS_MAX) return;
    setPresets([...presets, text]);
    setNewPreset('');
  }

  function updatePreset(index: number, value: string) {
    setPresets(presets.map((item, i) => (i === index ? value : item)));
  }

  function removePreset(index: number) {
    setPresets(presets.filter((_, i) => i !== index));
  }

  return (
    <section className="bundle-section">
      <div className="bundle-section-head">
        <h2>任务面板</h2>
        <p>任务看板的数据库存储位置（改动后需重启 dsh web 生效），以及新建任务时快捷添加的预定义子任务。</p>
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

      <div className="ps-row">
        <span>预定义子任务</span>
        <div className="preset-editor">
          {presets.map((text, index) => (
            <div key={index} className="preset-editor-row">
              <input value={text} maxLength={200} onChange={event => updatePreset(index, event.target.value)} />
              <button type="button" className="button compact" title="移除" onClick={() => removePreset(index)}>
                ✕
              </button>
            </div>
          ))}
          <div className="preset-editor-row">
            <input
              value={newPreset}
              maxLength={200}
              placeholder="新增预设，回车或点「添加」"
              onChange={event => setNewPreset(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addPreset();
                }
              }}
            />
            <button
              type="button"
              className="button compact"
              disabled={newPreset.trim() === '' || presets.length >= PRESETS_MAX}
              onClick={addPreset}
            >
              添加
            </button>
          </div>
          {presets.length === 0 && <p className="settings-empty">空列表 = 新建任务时不显示快捷添加面板。</p>}
        </div>
      </div>

      {view !== null && (
        <p className="settings-empty">
          配置文件：<code>{view.settingsPath}</code>（备份整个数据目录即可迁移任务板）
        </p>
      )}

      <div className="ps-actions">
        <button type="button" className="button" disabled={busy} onClick={() => void persist(null)}>
          恢复默认预设
        </button>
        <button type="button" className="button primary" disabled={busy || dataDir.trim() === ''} onClick={() => void persist(normalizePresets(presets))}>
          {busy ? '保存中…' : '保存'}
        </button>
      </div>
    </section>
  );
}

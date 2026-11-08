/**
 * "界面显示" block for the UnPlugin settings page: the bundle-level UI
 * preferences that do not belong to one feature tab.
 *
 * - Content width: the slider that used to live in a sidebar-footer dialog.
 * - Hide New Session button: hides DSH's sidebar/titlebar New Session button
 *   for a quieter sidebar (see `hide-new-session.ts` for the selector rationale).
 *
 * The outer card reuses the page's own `bundle-section` classes
 * (`paperspace/styles.css`); the width control keeps its `.dmw-width*` rules on
 * the bundle's shared sheet (`index.tsx#ensureStyles`) so it does not depend on
 * the paperspace subpath for styling.
 */

import React from "react";
import {
  WIDTH_DEFAULT_PCT,
  WIDTH_MAX_PCT,
  WIDTH_MIN_PCT,
  WIDTH_STEP_PCT,
  readWidthPct,
  setWidthPct,
} from "./content-width";
import { readHideNewSessionButton, setHideNewSessionButton } from "./hide-new-session";

export function InterfaceSettings() {
  const [pct, setPct] = React.useState(() => readWidthPct());
  const [hideNewSession, setHideNewSession] = React.useState(() => readHideNewSessionButton());

  const commitWidth = (value: number) => {
    setPct(setWidthPct(value));
  };
  const commitHideNewSession = (hide: boolean) => {
    setHideNewSession(setHideNewSessionButton(hide));
  };

  return (
    <section className="bundle-section">
      <div className="bundle-section-head">
        <h2>界面显示</h2>
        <p>本插件合集对 DSH 界面的调整，立即生效；设置按浏览器保存，刷新后仍保留。</p>
      </div>

      <div className="dmw-width">
        <div className="dmw-width-head">
          <label className="dmw-width-title" htmlFor="dmw-content-width">
            内容宽度
          </label>
          <span className="dmw-width-value">{pct}%</span>
        </div>
        <div className="dmw-width-row">
          <input
            id="dmw-content-width"
            className="dmw-width-slider"
            type="range"
            min={WIDTH_MIN_PCT}
            max={WIDTH_MAX_PCT}
            step={WIDTH_STEP_PCT}
            value={pct}
            aria-label="内容宽度"
            onChange={event => commitWidth(Number(event.target.value))}
          />
          <button type="button" className="dmw-width-btn" onClick={() => commitWidth(WIDTH_DEFAULT_PCT)}>
            恢复 100%
          </button>
        </div>
        <p className="dmw-width-hint">
          聊天 / 内容列的宽度，可调范围 {WIDTH_MIN_PCT}%–{WIDTH_MAX_PCT}%（{WIDTH_STEP_PCT}% 步进），默认 {WIDTH_DEFAULT_PCT}%。
        </p>
      </div>

      <label className="ps-toggle">
        <input
          type="checkbox"
          checked={hideNewSession}
          onChange={event => commitHideNewSession(event.target.checked)}
        />
        <strong>隐藏 New Session 按钮</strong>
        <small>
          隐藏侧栏（含收起后的标题栏）上的「New session」按钮。仅隐藏这个按钮，快捷键与新建会话本身不受影响。
        </small>
      </label>
    </section>
  );
}

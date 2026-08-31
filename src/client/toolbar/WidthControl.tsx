/**
 * Content width control — sidebar footer button with a slider dialog
 * that adjusts the chat/content column width by percentage.
 */

import React, { useState } from "react";

const WIDTH_STORAGE_KEY = "dsh-unknownue-plugins:contentWidthPct";
const WIDTH_DEFAULT_PCT = 100;
const WIDTH_MIN_PCT = 50;
const WIDTH_MAX_PCT = 150;
const WIDTH_STEP_PCT = 5;

function clampWidth(value: unknown): number {
  const n = Math.round(Number(value));
  const finite = Number.isFinite(n) ? n : WIDTH_DEFAULT_PCT;
  return Math.min(WIDTH_MAX_PCT, Math.max(WIDTH_MIN_PCT, finite));
}

export function readWidthPct(): number {
  try {
    const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
    return raw === null ? WIDTH_DEFAULT_PCT : clampWidth(raw);
  } catch {
    return WIDTH_DEFAULT_PCT;
  }
}

let widthStyleEl: HTMLStyleElement | null = null;

export function applyWidth(pct: number): void {
  if (widthStyleEl === null) {
    widthStyleEl = document.createElement("style");
    widthStyleEl.setAttribute("data-plugin", "dsh-unknownue-plugins");
    widthStyleEl.setAttribute("data-width-override", "");
    document.head.appendChild(widthStyleEl);
  }
  widthStyleEl.textContent = `*{--dsh-chat-content-width:${pct}% !important}`;
}

export function setWidthPct(pct: number): number {
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
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 9V7h18v2M3 15v2h18v-2M3 12h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface WidthControlProps {
  getPct: () => number;
  setPct: (pct: number) => number;
}

export function WidthControl(props: WidthControlProps) {
  const { getPct, setPct: setPctInjected } = props;
  const [open, setOpen] = useState(false);
  const [pct, setPctState] = useState(() => getPct());

  if (!open) {
    return (
      <button
        type="button"
        className="dmw-action"
        title="Content width"
        aria-label="Content width"
        onClick={() => setOpen(true)}
      >
        <WidthGlyph />
      </button>
    );
  }

  const onClose = () => setOpen(false);
  const onInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = clampWidth(event.target.value);
    setPctState(value);
    setPctInjected(value);
  };
  const onReset = () => {
    setPctState(WIDTH_DEFAULT_PCT);
    setPctInjected(WIDTH_DEFAULT_PCT);
  };

  return (
    <div className="dmw-overlay">
      <div className="dmw-mask" onClick={onClose} />
      <div className="dmw-card" role="dialog" aria-label="Content width">
        <div className="dmw-title">
          <span>Content width</span>
          <button type="button" className="dmw-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="dmw-value">{pct}%</div>
        <input
          type="range"
          className="dmw-slider"
          min={WIDTH_MIN_PCT}
          max={WIDTH_MAX_PCT}
          step={WIDTH_STEP_PCT}
          value={pct}
          onChange={onInput}
        />
        <button type="button" className="dmw-reset" onClick={onReset}>
          Reset 100%
        </button>
      </div>
    </div>
  );
}

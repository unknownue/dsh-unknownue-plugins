/**
 * ThemeButton — editor theme settings dialog with presets,
 * custom colors, font size, and import/export.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  useEditorTheme,
  setEditorTheme,
  resetEditorTheme,
  presetIdOf,
  exportThemeText,
  parseImportedTheme,
  themeErrorMessage,
  EDITOR_THEME_PRESETS,
  EDITOR_THEME_PRESET_ORDER,
  EDITOR_THEME_PRESET_LABELS,
  type EditorTheme,
} from "./themeStore";

interface ThemeButtonProps {
  t: (key: string) => string;
}

export function ThemeButton({ t }: ThemeButtonProps) {
  const [open, setOpen] = useState(false);
  const theme = useEditorTheme();

  if (!open) {
    return (
      <button
        type="button"
        className="dshf-btn"
        title={t("theme.title")}
        aria-label={t("theme.button")}
        onClick={() => setOpen(true)}
      >
        {t("theme.button")}
      </button>
    );
  }

  return <ThemeDialog theme={theme} t={t} onClose={() => setOpen(false)} />;
}

function ThemeDialog({
  theme,
  t,
  onClose,
}: {
  theme: EditorTheme;
  t: (key: string) => string;
  onClose: () => void;
}) {
  const preset = presetIdOf(theme);
  const [mode, setMode] = useState<"preset" | "custom">(preset ? "preset" : "custom");
  const [bg, setBg] = useState(theme.background);
  const [fg, setFg] = useState(theme.foreground);
  const [fontSize, setFontSize] = useState(theme.fontSize);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyPreset = useCallback((id: string) => {
    const p = EDITOR_THEME_PRESETS[id];
    if (p) {
      setEditorTheme({ ...p });
      setBg(p.background);
      setFg(p.foreground);
      setFontSize(p.fontSize);
    }
  }, []);

  const applyCustom = useCallback(() => {
    const hex6 = /^#[0-9a-f]{6}$/i;
    if (!hex6.test(bg)) {
      setError(t("theme.errorMissingBackground"));
      return;
    }
    if (!hex6.test(fg)) {
      setError(t("theme.errorMissingForeground"));
      return;
    }
    setError(null);
    setEditorTheme({ background: bg.toLowerCase(), foreground: fg.toLowerCase(), fontSize });
  }, [bg, fg, fontSize, t]);

  const handleExport = useCallback(() => {
    const name = preset ? EDITOR_THEME_PRESET_LABELS[preset] : undefined;
    const text = exportThemeText(theme, name);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dsh-editor-theme.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [theme, preset]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = parseImportedTheme(reader.result as string);
          setEditorTheme({
            background: parsed.background,
            foreground: parsed.foreground,
            fontSize: parsed.fontSize,
          });
          setBg(parsed.background);
          setFg(parsed.foreground);
          setFontSize(parsed.fontSize);
          setError(null);
          setMode("custom");
        } catch (err: any) {
          setError(themeErrorMessage(t, err));
        }
      };
      reader.readAsText(file);
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [t],
  );

  return (
    <div className="dshf-theme-overlay" onClick={onClose}>
      <div className="dshf-theme-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dshf-theme-header">
          <span className="dshf-theme-title">{t("theme.title")}</span>
          <button type="button" className="dshf-btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="dshf-theme-tabs">
          <button
            type="button"
            className={`dshf-tab ${mode === "preset" ? "dshf-tab-active" : ""}`}
            onClick={() => setMode("preset")}
          >
            {t("theme.preset")}
          </button>
          <button
            type="button"
            className={`dshf-tab ${mode === "custom" ? "dshf-tab-active" : ""}`}
            onClick={() => setMode("custom")}
          >
            {t("theme.custom")}
          </button>
        </div>

        {mode === "preset" ? (
          <div className="dshf-theme-presets">
            {EDITOR_THEME_PRESET_ORDER.map((id) => {
              const p = EDITOR_THEME_PRESETS[id];
              return (
                <button
                  key={id}
                  type="button"
                  className={`dshf-preset-btn ${preset === id ? "dshf-preset-active" : ""}`}
                  onClick={() => applyPreset(id)}
                  style={{
                    background: p.background,
                    color: p.foreground,
                    border: `2px solid ${preset === id ? "#0969da" : "var(--dsw-alias-border-l2, rgba(0,0,0,0.15))"}`,
                  }}
                >
                  {EDITOR_THEME_PRESET_LABELS[id]}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="dshf-theme-custom">
            <label className="dshf-theme-field">
              <span>{t("theme.background")}</span>
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
              <input type="text" value={bg} onChange={(e) => setBg(e.target.value)} className="dshf-theme-input" />
            </label>
            <label className="dshf-theme-field">
              <span>{t("theme.foreground")}</span>
              <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} />
              <input type="text" value={fg} onChange={(e) => setFg(e.target.value)} className="dshf-theme-input" />
            </label>
            <label className="dshf-theme-field">
              <span>{t("theme.fontSize")}</span>
              <input
                type="number"
                value={fontSize}
                min={8}
                max={32}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="dshf-theme-input"
              />
            </label>
            <button type="button" className="dshf-btn" onClick={applyCustom}>
              {t("theme.preset")}
            </button>
          </div>
        )}

        {error && <div className="dshf-theme-error">{error}</div>}

        <div className="dshf-theme-actions">
          <button type="button" className="dshf-btn" onClick={handleExport}>
            {t("theme.export")}
          </button>
          <button type="button" className="dshf-btn" onClick={() => fileRef.current?.click()}>
            {t("theme.import")}
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="dshf-btn"
            onClick={() => {
              resetEditorTheme();
              const d = EDITOR_THEME_PRESETS.light;
              setBg(d.background);
              setFg(d.foreground);
              setFontSize(d.fontSize);
              setMode("preset");
            }}
          >
            {t("theme.reset")}
          </button>
        </div>
      </div>
    </div>
  );
}

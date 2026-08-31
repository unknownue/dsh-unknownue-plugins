/**
 * Editor theme store — manages the editor's color theme with presets,
 * custom colors, and import/export support.
 */

import { useSyncExternalStore } from "react";

export interface EditorTheme {
  background: string;
  foreground: string;
  fontSize: number;
}

export interface ThemeChrome {
  chrome: string;
  border: string;
  muted: string;
  chip: string;
  dirty: string;
}

export const EDITOR_THEME_PRESETS: Record<string, EditorTheme> = {
  light: { background: "#ffffff", foreground: "#1f2328", fontSize: 13 },
  dark: { background: "#1e1e1e", foreground: "#d4d4d4", fontSize: 13 },
  "one-dark": { background: "#282c34", foreground: "#abb2bf", fontSize: 13 },
  github: { background: "#ffffff", foreground: "#24292e", fontSize: 13 },
};

export const EDITOR_THEME_PRESET_ORDER = ["light", "dark", "one-dark", "github"];

export const EDITOR_THEME_PRESET_LABELS: Record<string, string> = {
  light: "浅色",
  dark: "深色",
  "one-dark": "One Dark",
  github: "GitHub",
};

const DEFAULT_EDITOR_THEME: EditorTheme = { ...EDITOR_THEME_PRESETS.light };

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mixColors(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * amount, ag + (bg - ag) * amount, ab + (bb - ab) * amount);
}

export function luminanceOf(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function isLightColor(hex: string): boolean {
  return luminanceOf(hex) > 0.5;
}

export function themeChrome(theme: EditorTheme): ThemeChrome {
  const light = isLightColor(theme.background);
  const chrome = mixColors(theme.background, light ? "#000000" : "#ffffff", light ? 0.06 : 0.08);
  const border = mixColors(theme.background, light ? "#000000" : "#ffffff", light ? 0.22 : 0.18);
  const muted = mixColors(theme.foreground, theme.background, 0.45);
  const chip = mixColors(theme.background, light ? "#000000" : "#ffffff", light ? 0.05 : 0.06);
  const dirty = light ? "#c2410c" : "#e2c08d";
  return { chrome, border, muted, chip, dirty };
}

const STORAGE_KEY = "dsh-explorer-editor:editor-theme:v2";
const HEX6 = /^#[0-9a-f]{6}$/i;

function load(): EditorTheme {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          typeof parsed?.background === "string" &&
          HEX6.test(parsed.background) &&
          typeof parsed?.foreground === "string" &&
          HEX6.test(parsed.foreground)
        ) {
          return {
            background: parsed.background.toLowerCase(),
            foreground: parsed.foreground.toLowerCase(),
            fontSize: typeof parsed.fontSize === "number" && parsed.fontSize > 0 ? parsed.fontSize : 13,
          };
        }
      }
    }
  } catch {
    // storage unavailable
  }
  return { ...DEFAULT_EDITOR_THEME };
}

let current: EditorTheme = load();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): EditorTheme {
  return current;
}

export function useEditorTheme(): EditorTheme {
  return useSyncExternalStore(subscribe, snapshot);
}

export function setEditorTheme(partial: Partial<EditorTheme>): void {
  current = { ...current, ...partial };
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // storage unavailable
  }
  emit();
}

export function resetEditorTheme(): void {
  current = { ...DEFAULT_EDITOR_THEME };
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable
  }
  emit();
}

export function presetIdOf(theme: EditorTheme): string | undefined {
  for (const [id, preset] of Object.entries(EDITOR_THEME_PRESETS)) {
    if (preset.background === theme.background && preset.foreground === theme.foreground) return id;
  }
  return undefined;
}

export function exportThemeText(theme: EditorTheme, name?: string): string {
  return JSON.stringify(
    {
      name,
      type: "dsh-explorer-editor-theme",
      version: 1,
      background: theme.background,
      foreground: theme.foreground,
      fontSize: theme.fontSize,
      colors: {
        "editor.background": theme.background,
        "editor.foreground": theme.foreground,
      },
    },
    null,
    2,
  );
}

interface ThemeError extends Error {
  code: string;
}

function themeError(code: string, message: string): ThemeError {
  const error = new Error(message) as ThemeError;
  error.code = code;
  return error;
}

export function parseImportedTheme(text: string): { name?: string } & EditorTheme {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw themeError("invalid-json", "File is not valid JSON");
  }
  if (typeof data !== "object" || data === null) throw themeError("not-object", "JSON content must be an object");
  const obj = data as any;
  let background = typeof obj.background === "string" ? obj.background : undefined;
  let foreground = typeof obj.foreground === "string" ? obj.foreground : undefined;
  if ((background === undefined || foreground === undefined) && typeof obj.colors === "object" && obj.colors !== null) {
    const colors = obj.colors;
    if (background === undefined) background = typeof colors["editor.background"] === "string" ? colors["editor.background"] : undefined;
    if (foreground === undefined) foreground = typeof colors["editor.foreground"] === "string" ? colors["editor.foreground"] : undefined;
  }
  if (background === undefined || !HEX6.test(background)) {
    throw themeError("missing-background", "Missing valid background color (#rrggbb required)");
  }
  if (foreground === undefined || !HEX6.test(foreground)) {
    throw themeError("missing-foreground", "Missing valid foreground color (#rrggbb required)");
  }
  const fontSize = typeof obj.fontSize === "number" && obj.fontSize > 0 ? obj.fontSize : 13;
  const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : undefined;
  return { name, background: background.toLowerCase(), foreground: foreground.toLowerCase(), fontSize };
}

export function themeErrorMessage(t: (key: string, params?: Record<string, unknown>) => string, error: ThemeError): string {
  switch (error.code) {
    case "invalid-json":
      return t("theme.errorInvalidJson");
    case "not-object":
      return t("theme.errorNotObject");
    case "missing-background":
      return t("theme.errorMissingBackground");
    case "missing-foreground":
      return t("theme.errorMissingForeground");
    default:
      return error.message;
  }
}

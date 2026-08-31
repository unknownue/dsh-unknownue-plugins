/**
 * EditorPane — Monaco editor wrapper with theme integration.
 */

import React, { useEffect, useRef } from "react";
import type { EditorTheme, ThemeChrome } from "./themeStore";
import { themeChrome } from "./themeStore";

interface EditorPaneProps {
  path: string;
  content: string;
  onChange: (value: string) => void;
  theme: EditorTheme;
  t: (key: string) => string;
}

function languageOf(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot <= 0) return "plaintext";
  const ext = path.slice(dot + 1).toLowerCase();
  const map: Record<string, string> = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    jsx: "javascript",
    ts: "typescript",
    mts: "typescript",
    cts: "typescript",
    tsx: "typescript",
    json: "json",
    jsonc: "json",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
    markdown: "markdown",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    cxx: "cpp",
    cc: "cpp",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    yml: "yaml",
    yaml: "yaml",
    xml: "xml",
    svg: "xml",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    dockerfile: "dockerfile",
    toml: "toml",
    ini: "ini",
    lua: "lua",
    r: "r",
    dart: "dart",
    vue: "html",
    svelte: "html",
  };
  return map[ext] ?? "plaintext";
}

export function EditorPane({ path, content, onChange, theme, t }: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const ignoreChange = useRef(false);

  // Create editor
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const monaco = (window as any).monaco;
    if (!monaco) return;
    monacoRef.current = monaco;

    const model = monaco.editor.createModel(content, languageOf(path));
    const editor = monaco.editor.create(container, {
      model,
      theme: "vs",
      fontSize: theme.fontSize,
      fontFamily: 'ui-monospace, "Cascadia Code", "Cascadia Mono", Consolas, Menlo, monospace',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      automaticLayout: true,
      padding: { top: 8, bottom: 8 },
      lineNumbers: "on",
      glyphMargin: false,
      folding: true,
      lineDecorationsWidth: 8,
      renderLineHighlight: "line",
      scrollbar: {
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
      },
    });
    editorRef.current = editor;

    // Apply theme colors
    const chrome = themeChrome(theme);
    monaco.editor.defineTheme("dsh-editor", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": theme.background,
        "editor.foreground": theme.foreground,
        "editor.lineHighlightBackground": chrome.chrome,
        "editorLineNumber.foreground": chrome.muted,
        "editorCursor.foreground": theme.foreground,
        "editor.selectionBackground": chrome.chip,
        "editor.inactiveSelectionBackground": chrome.chip,
      },
    });
    monaco.editor.setTheme("dsh-editor");

    editor.onDidChangeModelContent(() => {
      if (ignoreChange.current) return;
      onChange(editor.getValue());
    });

    return () => {
      editor.dispose();
      model.dispose();
      editorRef.current = null;
    };
  }, [path]); // Recreate when path changes

  // Update theme
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    const chrome = themeChrome(theme);
    monaco.editor.defineTheme("dsh-editor", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": theme.background,
        "editor.foreground": theme.foreground,
        "editor.lineHighlightBackground": chrome.chrome,
        "editorLineNumber.foreground": chrome.muted,
        "editorCursor.foreground": theme.foreground,
        "editor.selectionBackground": chrome.chip,
        "editor.inactiveSelectionBackground": chrome.chip,
      },
    });
    monaco.editor.setTheme("dsh-editor");
    const editor = editorRef.current;
    if (editor) {
      editor.updateOptions({ fontSize: theme.fontSize });
    }
  }, [theme]);

  // Update content when it changes externally
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const currentValue = editor.getValue();
    if (currentValue !== content) {
      ignoreChange.current = true;
      editor.setValue(content);
      ignoreChange.current = false;
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    />
  );
}

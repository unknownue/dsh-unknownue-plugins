/**
 * Markdown rendering utilities using marked.
 */

import { marked } from "marked";

// Configure marked to sanitize HTML output
marked.use({
  renderer: {
    html({ text }: { text: string }) {
      return escapeHtml(text);
    },
  },
});

export function renderMarkdown(text: string): string {
  try {
    const html = marked.parse(text, { gfm: true, breaks: true });
    return typeof html === "string" ? html : String(html);
  } catch {
    return `<pre>${escapeHtml(text)}</pre>`;
  }
}

export function isMarkdownPath(path: string): boolean {
  const dot = path.lastIndexOf(".");
  if (dot <= 0) return false;
  const ext = path.slice(dot + 1).toLowerCase();
  return ext === "md" || ext === "markdown";
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

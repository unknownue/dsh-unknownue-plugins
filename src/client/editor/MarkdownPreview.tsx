/**
 * MarkdownPreview — renders markdown content with workspace images
 * inlined via readDataUrl.
 */

import React, { useEffect, useState } from "react";
import { renderMarkdown } from "./markdown";
import type { FileManagerRemote } from "../explorer/remote";

interface MarkdownPreviewProps {
  content: string;
  path: string;
  remote: FileManagerRemote;
}

export function MarkdownPreview({ content, path, remote }: MarkdownPreviewProps) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function processImages(rawHtml: string): Promise<string> {
      // Find relative image references: ![alt](./path) or ![alt](path)
      const imgRegex = /<img[^>]+src=["']([^"'#][^"'#]*)["']/g;
      const dir = path.split("/").slice(0, -1).join("/");
      let result = rawHtml;
      let match: RegExpExecArray | null;

      while ((match = imgRegex.exec(rawHtml)) !== null) {
        const src = match[1];
        if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) continue;

        try {
          const resolved = src.startsWith("/") ? src : `${dir}/${src}`;
          const dataResult = await remote.readDataUrl(resolved);
          if (cancelled) return rawHtml;
          if (dataResult.ok && dataResult.value) {
            result = result.replace(match[0], match[0].replace(src, dataResult.value.dataUrl));
          }
        } catch {
          // Image not found — leave as-is
        }
      }
      return result;
    }

    const rawHtml = renderMarkdown(content);
    void processImages(rawHtml).then((processed) => {
      if (!cancelled) setHtml(processed);
    });

    return () => {
      cancelled = true;
    };
  }, [content, path, remote]);

  return (
    <div
      className="dshf-markdown-preview"
      style={{
        padding: "16px 24px",
        overflow: "auto",
        height: "100%",
        boxSizing: "border-box",
        fontFamily: 'ui-monospace, "Cascadia Code", "Cascadia Mono", Consolas, Menlo, monospace',
        fontSize: "13px",
        lineHeight: "1.6",
        color: "var(--dsw-alias-label-primary, #1f2328)",
      }}
    >
      <style>{`
        .dshf-markdown-preview h1, .dshf-markdown-preview h2, .dshf-markdown-preview h3,
        .dshf-markdown-preview h4, .dshf-markdown-preview h5, .dshf-markdown-preview h6 {
          margin-top: 1.2em;
          margin-bottom: 0.6em;
          font-weight: 600;
          line-height: 1.3;
        }
        .dshf-markdown-preview h1 { font-size: 1.5em; border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.08)); padding-bottom: 0.3em; }
        .dshf-markdown-preview h2 { font-size: 1.3em; border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.08)); padding-bottom: 0.3em; }
        .dshf-markdown-preview h3 { font-size: 1.1em; }
        .dshf-markdown-preview p { margin: 0.8em 0; }
        .dshf-markdown-preview code {
          background: var(--dsw-alias-bg-layer-3, rgba(0,0,0,0.04));
          padding: 0.15em 0.35em;
          border-radius: 4px;
          font-size: 0.9em;
        }
        .dshf-markdown-preview pre {
          background: var(--dsw-alias-bg-layer-3, rgba(0,0,0,0.04));
          padding: 12px 16px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 0.8em 0;
        }
        .dshf-markdown-preview pre code { background: none; padding: 0; }
        .dshf-markdown-preview blockquote {
          border-left: 3px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.15));
          margin: 0.8em 0;
          padding: 0.5em 0 0.5em 1em;
          color: var(--dsw-alias-label-secondary, #495057);
        }
        .dshf-markdown-preview table { border-collapse: collapse; margin: 0.8em 0; width: 100%; }
        .dshf-markdown-preview th, .dshf-markdown-preview td {
          border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.15));
          padding: 6px 10px;
          text-align: left;
        }
        .dshf-markdown-preview th { background: var(--dsw-alias-bg-layer-3, rgba(0,0,0,0.04)); font-weight: 600; }
        .dshf-markdown-preview img { max-width: 100%; height: auto; border-radius: 6px; }
        .dshf-markdown-preview a { color: var(--dsw-alias-state-business-primary, #0969da); text-decoration: none; }
        .dshf-markdown-preview a:hover { text-decoration: underline; }
        .dshf-markdown-preview ul, .dshf-markdown-preview ol { padding-left: 1.5em; margin: 0.5em 0; }
        .dshf-markdown-preview li { margin: 0.25em 0; }
        .dshf-markdown-preview hr { border: none; border-top: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.15)); margin: 1.5em 0; }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

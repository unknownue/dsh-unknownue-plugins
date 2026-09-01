/**
 * Markdown rendering pipeline (ported from paperspace's translation-client):
 * react-markdown + gfm + math + katex + the raw-table math plugin.
 */
import { memo, useMemo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeKatex from 'rehype-katex';
import rehypeMathInRawTables from './rehype-math-in-raw-tables';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import PaperImage from './paper-image';

const MarkdownBody = memo(function MarkdownBody({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeMathInRawTables, rehypeKatex, rehypeSlug]}
      components={{ img: PaperImage }}
    >
      {markdown}
    </ReactMarkdown>
  );
});

export function Article({ markdown }: { markdown: string }) {
  return (
    <article className="paper-article">
      <MarkdownBody markdown={markdown} />
    </article>
  );
}

/**
 * Bilingual view: the paper is split along the translation offsets, and each
 * translated paragraph is rendered directly below its original.
 */
export function BilingualArticle({
  markdown,
  offsets,
  paragraphs,
}: {
  markdown: string;
  offsets: Array<{ start: number; end: number }>;
  paragraphs: Array<string | null>;
}) {
  const segments = useMemo<ReactNode[]>(() => {
    const nodes: ReactNode[] = [];
    let cursor = 0;
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      const translation = paragraphs[i];
      if (!offset || typeof offset.start !== 'number' || typeof offset.end !== 'number') continue;
      if (offset.start < cursor || offset.end > markdown.length) continue;
      const gap = markdown.slice(cursor, offset.start);
      if (gap.trim()) nodes.push(<MarkdownBody key={'gap-' + i} markdown={gap} />);
      const original = markdown.slice(offset.start, offset.end);
      nodes.push(<MarkdownBody key={'orig-' + i} markdown={original} />);
      if (translation) {
        nodes.push(
          <aside className="bilingual-translation-block" key={'trans-' + i}>
            <span className="bilingual-translation-label">Translation</span>
            <MarkdownBody markdown={translation} />
          </aside>,
        );
      }
      cursor = offset.end;
    }
    const tail = markdown.slice(cursor);
    if (tail.trim()) nodes.push(<MarkdownBody key="tail" markdown={tail} />);
    return nodes;
  }, [markdown, offsets, paragraphs]);

  return <article className="paper-article">{segments}</article>;
}

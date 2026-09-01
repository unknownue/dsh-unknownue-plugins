/**
 * Ported verbatim from vendor/paperspace packages/paper-domain/src/paragraphs.ts.
 */
/**
 * Markdown paragraph splitting for the translation pipeline.
 *
 * The worker and the persisted snapshots must agree on which slices of the
 * paper markdown are translatable. `splitParagraphs` returns, for every
 * translatable paragraph in document order:
 *
 * - `index` — 0-based translating index (aligned with the snapshot's
 *   `paragraphs` and `offsets` arrays),
 * - `start` / `end` — character offsets of the translatable text inside the
 *   source markdown,
 * - `text` — the markdown snippet handed to the LLM.
 *
 * The offsets let any consumer rebuild a translated document by pure string
 * splicing (`spliceParagraphs`) without re-running the splitter, which keeps
 * the browser bundle free of this module.
 *
 * Skipped (never translated):
 * - headings (`# …`), horizontal rules, fenced code blocks,
 * - display-math blocks (`$$…$$`),
 * - paragraphs whose only content is an image,
 * - raw HTML blocks, and the `<table>…</table>` portion of mixed blocks
 *   (only the leading caption text is translated),
 * - everything inside a References / Bibliography / 参考文献 H1/H2 section
 *   (the gate resets at the next H1/H2, so trailing Appendix sections are
 *   still translated; H3 inherits the enclosing H1/H2 gate).
 */

export interface ParagraphBlock {
  index: number;
  start: number;
  end: number;
  text: string;
}

// Note: `\b` is ASCII-only in JS regexes, so the CJK variants need their own
// alternative instead of a trailing word boundary.
const REFERENCES_HEADING_RE = /^\s*(?:(?:references?|bibliography)\b|参考文献|文献)(?:[\s:：.、]|$)/i;
const IMAGE_ONLY_RE = /^!\[[^\]]*\]\([^)]*\)$/;
const HORIZONTAL_RULE_RE = /^(?:---+|\*\*\*+)\s*$/;
const HTML_TABLE_START_RE = /<table\b/i;

export function splitParagraphs(markdown: string): ParagraphBlock[] {
  const blocks = groupBlocks(markdown);
  const paragraphs: ParagraphBlock[] = [];
  let inReferences = false;
  let index = 0;

  for (const block of blocks) {
    const firstLine = block.text.split('\n', 1)[0].trim();

    // Fenced code blocks arrive as one grouped block (groupBlocks never
    // splits inside a fence); skip them wholesale.
    if (firstLine.startsWith('```')) continue;

    // H1/H2 headings toggle the references gate; H3+ inherit it.
    const heading = block.text.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      if (heading[1].length <= 2) inReferences = REFERENCES_HEADING_RE.test(heading[2]);
      continue;
    }

    if (inReferences) continue;
    if (HORIZONTAL_RULE_RE.test(block.text)) continue;
    if (/^\$\$/.test(block.text)) continue;

    const trimmed = block.text.trim();
    if (!trimmed) continue;

    // Image-only paragraphs carry no prose.
    if (trimmed.split('\n').every(line => IMAGE_ONLY_RE.test(line.trim()))) continue;

    // Raw HTML blocks (figure shells etc.) are not prose.
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) continue;

    // Mixed block: translate only the caption before an inline <table>.
    const tableAt = block.text.search(HTML_TABLE_START_RE);
    if (tableAt >= 0) {
      const caption = block.text.slice(0, tableAt).trim();
      if (!caption) continue;
      paragraphs.push({ index: index++, start: block.start, end: block.start + caption.length, text: caption });
      continue;
    }

    paragraphs.push({ index: index++, start: block.start, end: block.end, text: trimmed });
  }
  return paragraphs;
}

/**
 * Rebuild a markdown document by replacing the slices described by `offsets`
 * with the matching `paragraphs` entries. Offsets without a translation (or
 * `null` entries) keep the original text.
 */
export function spliceParagraphs(
  markdown: string,
  offsets: Array<{ start: number; end: number }>,
  paragraphs: Array<string | null>,
): string {
  let out = '';
  let cursor = 0;
  for (let i = 0; i < offsets.length; i++) {
    const offset = offsets[i];
    const translation = paragraphs[i];
    if (!offset || typeof offset.start !== 'number' || typeof offset.end !== 'number') continue;
    if (offset.start < cursor || offset.end > markdown.length) continue;
    out += markdown.slice(cursor, offset.start);
    out += translation ? translation : markdown.slice(offset.start, offset.end);
    cursor = offset.end;
  }
  return out + markdown.slice(cursor);
}

interface RawBlock {
  start: number;
  end: number;
  text: string;
}

/**
 * Group consecutive non-blank lines into blocks, tracking character offsets.
 * Blank lines inside fenced code blocks do not split the block.
 */
function groupBlocks(markdown: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  const lines = markdown.split('\n');
  let lineStart = 0;
  let blockStart = -1;
  let blockEnd = -1;
  let blockLines: string[] = [];
  let inFence = false;

  const flush = () => {
    if (blockLines.length > 0) {
      blocks.push({ start: blockStart, end: blockEnd, text: blockLines.join('\n') });
      blockLines = [];
      blockStart = -1;
    }
  };

  for (let i = 0; i <= lines.length; i++) {
    const line = i < lines.length ? lines[i] : '';
    if (blockLines.length === 0 && line.trimStart().startsWith('```')) inFence = !inFence;
    const blank = line.trim() === '';
    if (!blank || inFence) {
      if (blockStart < 0) blockStart = lineStart;
      blockEnd = lineStart + line.length;
      blockLines.push(line);
      if (line.trimStart().startsWith('```') && blockLines.length > 1) inFence = !inFence;
    } else {
      flush();
    }
    lineStart += line.length + 1;
  }
  flush();
  return blocks;
}

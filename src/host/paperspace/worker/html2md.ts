/**
 * Ported verbatim from vendor/paperspace apps/worker/src/html2md.ts.
 */
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

/**
 * Convert arXiv HTML to structured markdown.
 *
 * - Math: arXiv/ar5iv render every formula as a MathML `<math>` element whose
 *   `<annotation encoding="application/x-tex">` carries the original LaTeX.
 *   That LaTeX is extracted and re-emitted as markdown math (`$…$` inline,
 *   `$$\n…\n$$` display) so formulas survive ingestion. Display equations come
 *   wrapped in `<table class="ltx_equation ltx_eqn_table">` shells, which are
 *   replaced wholesale (equation numbers become `\tag{…}`).
 * - Turndown converts the rest (`<img>` to `![alt](src)`, headings/lists/code,
 *   tables/strikethrough via the GFM plugin).
 *
 * Math is swapped out for private-use placeholders before turndown runs so the
 * LaTeX is never escaped or mangled by the markdown converter; the placeholders
 * are replaced afterwards.
 */

const MATH_PREFIX = '\uE000m';
const MATH_SUFFIX = '\uE001';
const PLACEHOLDER_RE = /\uE000m(\d+)\uE001/g;

function placeholder(id: string): string {
  return MATH_PREFIX + id + MATH_SUFFIX;
}

/** Extract the LaTeX source for one `<math>` element (annotation, then alttext). */
function latexOf($math: cheerio.Cheerio<any>): string {
  const $annotation = $math.find('annotation[encoding="application/x-tex"]').first();
  const source = $annotation.length > 0 ? $annotation.text() : ($math.attr('alttext') ?? '');
  return source
    .replace(/^\\(?:displaystyle|textstyle)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function htmlToMarkdown(html: string): string {
  const $ = cheerio.load(html);

  // --- Extract math before turndown sees the document ---
  const mathMarkdown = new Map<string, string>();
  let mathIndex = 0;

  // Display equations: arXiv renders them as
  // <table class="ltx_equation ltx_eqn_table"><tr><td class="ltx_eqn_cell">
  //   <math display="block">…</math></td>
  //   <td class="ltx_eqn_cell ltx_eqn_eqno">(1)</td></tr></table>
  // Replace each shell with a standalone $$…$$ block; the equation number
  // becomes a KaTeX \tag. Multi-row tables are either one aligned display
  // (single or no tag) or a sequence of separately numbered equations.
  $('table[class*="ltx_eqn"]').each((_index, table) => {
    const rows: Array<{ latex: string; tag: string }> = [];
    $(table).find('tr').each((_rowIndex, tr) => {
      const parts: string[] = [];
      $(tr).find('math').each((_mathIndex, math) => {
        const tex = latexOf($(math));
        if (tex) parts.push(tex);
      });
      if (parts.length === 0) return;
      const $eqno = $(tr).find('.ltx_eqn_eqno').first();
      const tag = $eqno.length > 0 ? $eqno.text().replace(/[()\s]/g, '').trim() : '';
      rows.push({ latex: parts.join(' '), tag });
    });

    if (rows.length === 0) {
      $(table).remove();
      return;
    }

    const tags = [...new Set(rows.map(row => row.tag).filter(Boolean))];
    let block: string;
    if (rows.length === 1) {
      const row = rows[0];
      block = '$$\n' + row.latex + (row.tag ? ` \\tag{${row.tag}}` : '') + '\n$$';
    } else if (tags.length <= 1) {
      const inner = rows.map(row => row.latex).join(' \\\\\n');
      block =
        '$$\n\\begin{aligned}\n' +
        inner +
        '\n\\end{aligned}' +
        (tags[0] ? ` \\tag{${tags[0]}}` : '') +
        '\n$$';
    } else {
      block = rows
        .map(row => '$$\n' + row.latex + (row.tag ? ` \\tag{${row.tag}}` : '') + '\n$$')
        .join('\n\n');
    }

    const id = String(mathIndex++);
    mathMarkdown.set(id, block);
    $(table).replaceWith($('<div>').text(placeholder(id)));
  });

  // Remaining math: inline (`$…$`) and any block math outside an equation table.
  $('math').each((_index, math) => {
    const $math = $(math);
    const tex = latexOf($math);
    if (!tex) {
      $math.remove();
      return;
    }
    const id = String(mathIndex++);
    if ($math.attr('display') === 'block') {
      mathMarkdown.set(id, '$$\n' + tex + '\n$$');
      $math.replaceWith($('<div>').text(placeholder(id)));
    } else {
      mathMarkdown.set(id, '$' + tex + '$');
      $math.replaceWith($('<span>').text(placeholder(id)));
    }
  });

  // --- Drop site chrome ---
  $('script, style, noscript, nav, header, footer, aside, form, button, iframe, svg').remove();

  // Scope the conversion to the main/article element.
  let root = $('main').first();
  if (root.length === 0) root = $('article').first();
  const content = root.length > 0 ? root.html() ?? html : html;

  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    hr: '---',
  });
  service.use(gfm);
  service.remove(['script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'form', 'button', 'iframe']);

  return service
    .turndown(content)
    .replace(PLACEHOLDER_RE, (_match, id: string) => {
      const text = mathMarkdown.get(id) ?? '';
      return text.startsWith('$$') ? '\n\n' + text + '\n\n' : text;
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

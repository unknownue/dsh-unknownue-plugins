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
 * - Listings: algorithm pseudocode comes as `ltx_listing` figures whose
 *   `ltx_listing_data` carries the exact source in a base64 download link;
 *   each figure is converted to a fenced code block (caption kept as text) so
 *   code is never split into translatable paragraphs.
 * - Vector figures (`<object type="image/svg+xml" data="…">`, which turndown
 *   would drop) are re-emitted as `<img>` so they survive as markdown images.
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

const LISTING_PREFIX = '\uE000l';
const LISTING_RE = /\uE000l(\d+)\uE001/g;

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

  // --- Convert algorithm/listings into fenced code blocks ------------------
  // arXiv renders lstlisting environments as `<figure class="ltx_float …">`
  // with a `<figcaption>` and a `<div class="ltx_listing">` whose
  // `.ltx_listing_data` carries a `data:text/plain;base64,…` download link
  // with the EXACT source. Decode it into a ```fence so code is structurally
  // code in the markdown (skipped by the translator, rendered as a code
  // block). Without this, every code line became a separate paragraph that
  // the translation pipeline would translate.
  const listingMarkdown = new Map<string, string>();
  let listingIndex = 0;
  const listingPlaceholder = (id: string): string => LISTING_PREFIX + id + '\uE001';

  const buildListingMarkdown = (captionLines: string[], $listing: cheerio.Cheerio<any>): string => {
    let code = '';
    const $link = $listing.find('.ltx_listing_data a[href^="data:text/plain;base64,"]').first();
    if ($link.length > 0) {
      const comma = ($link.attr('href') ?? '').indexOf(',');
      if (comma >= 0) {
        try {
          code = Buffer.from(($link.attr('href') ?? '').slice(comma + 1), 'base64').toString('utf8');
        } catch {
          code = '';
        }
      }
    }
    // Fallback for listings without the base64 link (e.g. ar5iv variants):
    // join the per-line divs, preserving blank lines.
    if (!code) {
      code = $listing
        .find('.ltx_listingline')
        .map((_j, el) => $(el).text())
        .get()
        .join('\n');
    }
    const cls = $listing.attr('class') ?? '';
    const lang = /ltx_lst_language_Python/i.test(cls) ? 'python' : '';
    const lines = [...captionLines.filter(Boolean)];
    lines.push('', '```' + lang, code.replace(/\s+$/, ''), '```');
    return lines.join('\n');
  };

  // Algorithm figures: caption + one or more listings.
  $('figure.ltx_float').each((_index, fig) => {
    const $fig = $(fig);
    const $listings = $fig.find('.ltx_listing');
    if ($listings.length === 0) return;
    const $caption = $fig.find('figcaption').first();
    $caption.find('br').replaceWith('\n');
    const captionLines = $caption
      .text()
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const md = $listings
      .map((_j, el) => buildListingMarkdown(captionLines, $(el)))
      .get()
      .join('\n\n');
    const id = String(listingIndex++);
    listingMarkdown.set(id, md);
    $fig.replaceWith($('<div>').text(listingPlaceholder(id)));
  });

  // Standalone listings (no float figure wrapper).
  $('.ltx_listing').each((_index, el) => {
    const md = buildListingMarkdown([], $(el));
    const id = String(listingIndex++);
    listingMarkdown.set(id, md);
    $(el).replaceWith($('<div>').text(listingPlaceholder(id)));
  });

  // Vector figures arrive as `<object type="image/svg+xml" data="…">`.
  // Turndown drops `<object>` (unknown element, no children), which silently
  // removed most figures from ingested papers. Re-emit them as `<img>` so
  // turndown produces a markdown image and the worker downloads/stores them.
  $('object[data]').each((_index, el) => {
    const $obj = $(el);
    const src = ($obj.attr('data') ?? '').trim();
    if (!src) return;
    $obj.replaceWith($('<img>').attr({ src, alt: 'Refer to caption' }));
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

  const restoreMath = (text: string): string =>
    text.replace(PLACEHOLDER_RE, (_match, id: string) => {
      const math = mathMarkdown.get(id) ?? '';
      return math.startsWith('$$') ? '\n\n' + math + '\n\n' : math;
    });

  return service
    .turndown(content)
    .replace(PLACEHOLDER_RE, (_match, id: string) => {
      const text = mathMarkdown.get(id) ?? '';
      return text.startsWith('$$') ? '\n\n' + text + '\n\n' : text;
    })
    .replace(LISTING_RE, (_match, id: string) => '\n\n' + restoreMath(listingMarkdown.get(id) ?? '') + '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

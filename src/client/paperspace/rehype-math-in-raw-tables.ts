/**
 * Ported verbatim from vendor/paperspace apps/web/lib/rehype-math-in-raw-tables.ts.
 *
 * Rehype plugin: convert `$...$` text inside table cells (from raw HTML
 * blocks) into `<span class="math-inline">` elements so that
 * `rehype-katex` can render them.
 *
 * @import {Element, Root, Text} from 'hast'
 */
import type { Plugin } from 'unified';
import type { Element, Root, Text } from 'hast';
import { visit } from 'unist-util-visit';

/** Matches `$expr$` where expr doesn't contain `$`. */
const MATH_RE = /\$([^$]+?)\$/g;

/**
 * KaTeX cannot parse `\color[rgb]{r,g,b}` (only `\color{name|#hex}`),
 * `\definecolor`, or `\pagecolor`. Strip them so surrounding math renders.
 * Mirrors the backend `_strip_unsupported_math_macros`.
 */
const UNSUPPORTED_MACRO_RE =
  /\\definecolor(?:\[[^\]]*\])?\{[^}]*\}\{[^}]*\}\{[^}]*\}|\\color\[[^\]]*\]\{[^}]*\}|\\pagecolor(?:\[[^\]]*\])?\{[^}]*\}/g;

function cleanLatex(expr: string): string {
  // Strip KaTeX-unsupported color macros.
  expr = expr.replace(UNSUPPORTED_MACRO_RE, '');
  // `\begin{array}[]{l}` → `\begin{array}{l}`: empty bracket column-spacing
  // arg is valid LaTeX but KaTeX rejects it.
  expr = expr.replace(/\\begin\{array\}\[\]/g, '\\begin{array}');
  return expr;
}

/** Return true if the element is already a remark-math node. */
function isMathElement(node: Element): boolean {
  const cls = node.properties?.className;
  if (!Array.isArray(cls)) return false;
  return cls.includes('math-inline') || cls.includes('math-display');
}

/**
 * Split a text node's value on `$...$` boundaries. Returns new child nodes
 * (plain text + math-inline spans), or the original node unchanged if no
 * math was found.
 */
function splitMathText(textNode: Text): (Text | Element)[] {
  const text = textNode.value;
  if (!text.includes('$')) return [textNode];

  const result: (Text | Element)[] = [];
  let lastIndex = 0;
  let matched = false;
  MATH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MATH_RE.exec(text)) !== null) {
    matched = true;
    if (m.index > lastIndex) {
      result.push({ type: 'text', value: text.slice(lastIndex, m.index) });
    }
    result.push({
      type: 'element',
      tagName: 'span',
      properties: { className: ['math-inline'] },
      children: [{ type: 'text', value: cleanLatex(m[1]) }],
    });
    lastIndex = m.index + m[0].length;
  }
  if (!matched) return [textNode];
  if (lastIndex < text.length) {
    result.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return result;
}

/**
 * Recursively process children of an element, replacing `$...$` text nodes
 * with math-inline spans. Skips subtrees that are already math elements.
 */
function processChildren(element: Element): boolean {
  let changed = false;
  const newChildren: Element['children'] = [];

  for (const child of element.children) {
    if (child.type === 'text') {
      const parts = splitMathText(child);
      newChildren.push(...parts);
      if (parts.length !== 1 || parts[0] !== child) changed = true;
    } else if (child.type === 'element') {
      if (isMathElement(child)) {
        newChildren.push(child);
      } else {
        if (processChildren(child)) changed = true;
        newChildren.push(child);
      }
    } else {
      newChildren.push(child);
    }
  }

  if (changed) element.children = newChildren;
  return changed;
}

const rehypeMathInRawTables: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'td' && node.tagName !== 'th') return;
      processChildren(node);
    });
  };
};

export default rehypeMathInRawTables;

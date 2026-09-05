import { readFileSync } from 'node:fs';
import { splitParagraphs } from './src/host/paperspace/domain/paragraphs.ts';
import { htmlToMarkdown } from './src/host/paperspace/worker/html2md.ts';

// ── 1. Legacy markdown: code lines must not be translatable ──
const md = readFileSync('F:/Data/dsh-unknownue-plugins/paperspace/workspace/papers/2605.10938.md', 'utf8');
const blocks = splitParagraphs(md);
console.log('total translatable blocks:', blocks.length);
const codeLike = blocks.filter(b => /\\[=_\*\+<>\[\]|]/.test(b.text));
const linkLike = blocks.filter(b => b.text.includes('data:text/plain;base64'));
console.log('escaped code lines leaked into translation:', codeLike.length);
console.log('base64 link blocks leaked:', linkLike.length);
console.log('captions still translated:');
for (const b of blocks.filter(x => /^Algorithm \d/.test(x.text))) console.log('  -', b.text.slice(0, 80));
console.log('first 5 blocks:', blocks.slice(0, 5).map(b => b.text.slice(0, 60)));

// ── 2. Fresh ingestion: listings must become fenced code blocks ──
const html = readFileSync('F:/Data/dsh-unknownue-plugins/paperspace/2605.10938.html', 'utf8');
const fresh = htmlToMarkdown(html);
const fences = (fresh.match(/```/g) ?? []).length;
console.log('\nfresh markdown length:', fresh.length, '| fence markers:', fences);
console.log('base64 links remaining:', (fresh.match(/data:text\/plain;base64/g) ?? []).length);
console.log('escaped equals remaining (listing leakage):', (fresh.match(/\\=/g) ?? []).length);
const first = fresh.indexOf('```');
console.log('first fence context:\n' + fresh.slice(Math.max(0, first - 200), first + 500));

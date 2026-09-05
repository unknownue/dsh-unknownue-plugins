import { readFileSync, writeFileSync } from 'node:fs';
import { htmlToMarkdown } from './src/host/paperspace/worker/html2md.ts';

const html = readFileSync('F:/Data/dsh-unknownue-plugins/paperspace/2605.10938.html', 'utf8');
const fresh = htmlToMarkdown(html);
writeFileSync('F:/Data/dsh-unknownue-plugins/paperspace/2605.10938.fresh.md', fresh);
const checks = [
  ['<object', (fresh.match(/<object/g) ?? []).length],
  ['<img', (fresh.match(/<img/g) ?? []).length],
  ['!\\[', (fresh.match(/!\[/g) ?? []).length],
  ['svg', (fresh.match(/svg/g) ?? []).length],
  ['data:image', (fresh.match(/data:image/g) ?? []).length],
  ['⬇', (fresh.match(/⬇/g) ?? []).length],
  ['md image', (fresh.match(/!\[[^\]]*\]\([^)]*\)/g) ?? []).length],
];
for (const [k, v] of checks) console.log(k + ': ' + v);
const i = fresh.indexOf('Figure 1');
console.log('\n--- around Figure 1 ---\n' + fresh.slice(i - 60, i + 400));
const j = fresh.indexOf('Figure 2');
console.log('\n--- around Figure 2 ---\n' + fresh.slice(j - 60, j + 300));

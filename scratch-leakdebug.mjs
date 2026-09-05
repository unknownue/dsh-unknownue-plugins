import { readFileSync } from 'node:fs';
import { splitParagraphs } from './src/host/paperspace/domain/paragraphs.ts';

const md = readFileSync('F:/Data/dsh-unknownue-plugins/paperspace/workspace/papers/2605.10938.md', 'utf8');
const blocks = splitParagraphs(md);
const leaked = blocks.filter(b => /\\[=_\*\+<>\[\]|]/.test(b.text));
console.log('leaked count:', leaked.length);
for (const b of leaked.slice(0, 20)) {
  const pos = md.indexOf(b.text);
  console.log(pos + ': ' + JSON.stringify(b.text.slice(0, 100)));
}
// Context: lines of md around the first leaked block
const first = leaked[0];
if (first) {
  const pos = md.indexOf(first.text);
  const before = md.slice(0, pos).split('\n').slice(-8).join('\n');
  console.log('\n--- context before first leak ---\n' + before);
}

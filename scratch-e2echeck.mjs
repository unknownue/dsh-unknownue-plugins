import { readFileSync } from 'node:fs';
import { splitParagraphs } from './src/host/paperspace/domain/paragraphs.ts';
import { htmlToMarkdown } from './src/host/paperspace/worker/html2md.ts';

// Fresh pipeline for 2605.10938
const html = readFileSync('F:/Data/dsh-unknownue-plugins/paperspace/2605.10938.html', 'utf8');
const fresh = htmlToMarkdown(html);
const freshBlocks = splitParagraphs(fresh);
const codeTokens = ['encode(s)', 'sample_t()', 'randn_like', 'unembed(h)', 'argmax(', 'token_logits', 'mse_loss', 'self_cond_mask'];
const freshLeaks = freshBlocks.filter(b => codeTokens.some(t => b.text.includes(t)));
console.log('2605.10938 fresh: blocks=' + freshBlocks.length + ' code leaks=' + freshLeaks.length + ' fences=' + ((fresh.match(/```/g) ?? []).length / 2));
console.log('  has ELF title:', fresh.includes('# ELF: Embedded Language Flows'));
console.log('  has references:', fresh.includes('## References') || fresh.includes('References'));

// Legacy pipeline for the same paper (safety net)
const legacy = readFileSync('F:/Data/dsh-unknownue-plugins/paperspace/workspace/papers/2605.10938.md', 'utf8');
const legacyBlocks = splitParagraphs(legacy);
const legacyLeaks = legacyBlocks.filter(b => codeTokens.some(t => b.text.includes(t)));
console.log('2605.10938 legacy: blocks=' + legacyBlocks.length + ' code leaks=' + legacyLeaks.length);

// Second paper unaffected
const other = readFileSync('F:/Data/dsh-unknownue-plugins/paperspace/workspace/papers/1706.03762.md', 'utf8');
const otherBlocks = splitParagraphs(other);
console.log('1706.03762: blocks=' + otherBlocks.length + ' sample=' + JSON.stringify(otherBlocks.slice(0, 2).map(b => b.text.slice(0, 50))));

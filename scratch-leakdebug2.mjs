import { readFileSync } from 'node:fs';
import { splitParagraphs } from './src/host/paperspace/domain/paragraphs.ts';

const md = readFileSync('F:/Data/dsh-unknownue-plugins/paperspace/workspace/papers/2605.10938.md', 'utf8');
const blocks = splitParagraphs(md);
const codeTokens = ['encode(s)', 'sample_t()', 'randn_like', 'unembed(h)', 'argmax(', 'token_logits', 'mse_loss', 'ce_loss', 'stopgrad(', 'zeros_like', 'uniform(0, 1)', 'concat([z', 'self_cond_mask', 'sample_sc_cfg_scale'];
const leaks = blocks.filter(b => codeTokens.some(t => b.text.includes(t)));
console.log('code-token leaks:', leaks.length);
for (const b of leaks.slice(0, 15)) console.log('  ' + JSON.stringify(b.text.slice(0, 90)));
console.log('total blocks:', blocks.length);
// ensure captions and surrounding prose still there
console.log('has caption:', blocks.some(b => /^Algorithm 1/.test(b.text)));
console.log('has prose after listing:', blocks.some(b => b.text.includes('The core concepts of ELF are summarized')));

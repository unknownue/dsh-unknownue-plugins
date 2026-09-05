import { readFileSync } from 'node:fs';
import { htmlToMarkdown } from './src/host/paperspace/worker/html2md.ts';
import { extractImageUrls } from './src/host/paperspace/worker/images.ts';

const html = readFileSync('F:/Data/dsh-unknownue-plugins/paperspace/2605.10938.html', 'utf8');
const fresh = htmlToMarkdown(html);
const imgs = fresh.match(/!\[[^\]]*\]\([^)]*\)/g) ?? [];
console.log('markdown images:', imgs.length);
const svg = imgs.filter(u => u.includes('.svg'));
const png = imgs.filter(u => u.includes('.png'));
console.log('svg:', svg.length, 'png:', png.length);
console.log('remaining <object>:', (fresh.match(/<object/g) ?? []).length);
const urls = extractImageUrls(fresh);
console.log('extractable urls:', urls.length);
for (const u of urls.slice(0, 18)) console.log('  ' + u);

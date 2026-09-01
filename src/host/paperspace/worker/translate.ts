/**
 * Ported verbatim from vendor/paperspace apps/worker/src/translate.ts
 * (import specifiers adjusted to bundle-local resolution).
 */
import {
  splitParagraphs,
  type TranslationJobRow,
  type TranslationProviderConfig,
  type TranslationRepo,
} from '../domain/index';
import { OpenAICompatibleProvider } from '../runtime';

/**
 * Full-paper translation pipeline (worker side).
 *
 * One job = one (paper, target_lang). The worker claims a job, splits the
 * paper markdown into translatable paragraphs (offsets persisted so any
 * client can splice translations back into the source), extracts a
 * terminology glossary once, then translates paragraph by paragraph —
 * persisting the snapshot and the job progress after every paragraph so a
 * retry (or the UI) always sees consistent partial state.
 */

const GLOSSARY_MAX_CHARS = 40000;
const GLOSSARY_MAX_TERMS = 60;

export const LANG_NAMES: Record<string, string> = {
  'zh-CN': 'Simplified Chinese',
  'en-US': 'English',
  'ja-JP': 'Japanese',
};

/** Failure that must not be retried (missing input, bad configuration). */
export class TranslationFatalError extends Error {}

export interface TranslationContext {
  translations: TranslationRepo;
  /** LLM provider persisted with the job (same source as reader chat). */
  provider: TranslationProviderConfig;
  timeoutMs: number;
  maxAttempts: number;
}

export async function runTranslationJob(job: TranslationJobRow, markdown: string, ctx: TranslationContext): Promise<void> {
  const provider = () => new OpenAICompatibleProvider({ baseUrl: ctx.provider.baseUrl, apiKey: ctx.provider.apiKey ?? undefined, model: ctx.provider.model, timeoutMs: ctx.timeoutMs });

  const blocks = splitParagraphs(markdown);
  if (blocks.length === 0) throw new TranslationFatalError('no translatable paragraphs found');

  const offsets = blocks.map(block => ({ start: block.start, end: block.end }));
  await ctx.translations.startSnapshot(job.id, job.paperId, job.targetLang, offsets);
  await ctx.translations.updateProgress(job.id, 0, blocks.length);

  const snapshot = await ctx.translations.findSnapshot(job.paperId, job.targetLang);
  if (!snapshot) throw new Error('translation snapshot missing after start');

  let glossary = job.glossary ?? {};
  if (!glossary || Object.keys(glossary).length === 0) {
    glossary = await extractGlossary(markdown, job.targetLang, provider());
    await ctx.translations.setJobGlossary(job.id, glossary);
  }

  const paragraphs: Array<string | null> = [...(snapshot.paragraphs ?? [])];
  let next = paragraphs.findIndex(entry => !entry);
  if (next < 0) next = paragraphs.length; // resume after whatever was persisted
  if (next >= blocks.length) {
    // Every paragraph is already persisted — resume finished the job.
    await ctx.translations.finishJob(job.id, job.paperId, job.targetLang, ctx.provider.model);
    return;
  }

  for (let i = next; i < blocks.length; i++) {
    const status = await ctx.translations.jobStatus(job.id);
    if (status !== 'running') return; // cancelled — stop quietly, snapshot already removed

    const text = await translateParagraph(blocks[i].text, job.targetLang, glossary, provider());
    paragraphs[i] = text;
    await ctx.translations.updateSnapshot({
      jobId: job.id,
      paperId: job.paperId,
      targetLang: job.targetLang,
      paragraphs,
      offsets,
      glossary,
      model: ctx.provider.model,
    });
    await ctx.translations.updateProgress(job.id, i + 1, blocks.length);
  }

  await ctx.translations.finishJob(job.id, job.paperId, job.targetLang, ctx.provider.model);
}

/** Handle a failed job run: terminal failure or requeue with exponential backoff. */
export async function failTranslationJob(job: TranslationJobRow, error: unknown, ctx: TranslationContext): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof TranslationFatalError || job.attempts >= ctx.maxAttempts) {
    await ctx.translations.failJobPermanently(job.id, message);
    console.error(`[paperspace] translation failed permanently (${job.paperId} → ${job.targetLang}, attempt ${job.attempts}): ${message}`);
    return;
  }
  const delaySeconds = Math.min(60 * 2 ** (job.attempts - 1), 900);
  await ctx.translations.requeueJob(job.id, message, delaySeconds);
  console.warn(`[paperspace] translation attempt ${job.attempts} failed, retrying in ${delaySeconds}s (${job.paperId} → ${job.targetLang}): ${message}`);
}

async function extractGlossary(markdown: string, targetLang: string, provider: OpenAICompatibleProvider): Promise<Record<string, string>> {
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const system = [
    'You are a terminology extractor for academic-paper translation.',
    `You produce a JSON object mapping English technical terms to their preferred ${langName} translations, used as a consistency dictionary by a downstream paragraph-by-paragraph translator.`,
    'Include terms that: appear multiple times in the paper, or are central to the contribution (named methods, datasets, model classes, novel concepts).',
    'Rules:',
    '- Keep paper-specific named methods and model names in their original English form (translation may be empty string).',
    '- Prefer widely accepted translations in the field; short and precise.',
    '- Output ONLY a flat JSON object like {"term": "translation"}; no prose, no markdown fences.',
    `- At most ${GLOSSARY_MAX_TERMS} entries.`,
  ].join('\n');
  const source = markdown.slice(0, GLOSSARY_MAX_CHARS);
  const response = await complete(provider, [
    { role: 'system', content: system },
    { role: 'user', content: `Paper:\n\n${source}` },
  ]);
  return parseJsonObject(response) ?? {};
}

async function translateParagraph(text: string, targetLang: string, glossary: Record<string, string>, provider: OpenAICompatibleProvider): Promise<string> {
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const system = [
    `You are a professional academic-paper translator. Translate the provided paragraph into ${langName}.`,
    'Rules:',
    '- Return ONLY the translation — no explanations, no quotes, no code fences.',
    '- Preserve markdown formatting exactly: keep $…$ and $$…$$ math unchanged, keep ![…]() images and […]() links unchanged, keep **bold** / *italic* / `code` markers, keep list bullets and numbering, keep any HTML tags.',
    '- Translate prose faithfully and fluently; keep proper nouns, model names, method names, and dataset names in their original form.',
    '- Use the provided glossary when its terms appear; otherwise choose a natural, consistent translation.',
    '- Never translate code. Never invent content that is not in the source.',
  ].join('\n');
  const terms = Object.entries(glossary)
    .map(([term, translation]) => (translation ? `${term} → ${translation}` : `${term} → (keep original)`))
    .join('\n');
  const user = `Glossary:\n${terms}\n\nParagraph:\n${text}`;
  const response = await complete(provider, [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);
  return stripWrapper(response);
}

/** One non-tool LLM completion; returns the concatenated text. */
async function complete(provider: OpenAICompatibleProvider, messages: Array<{ role: 'system' | 'user'; content: string }>): Promise<string> {
  let out = '';
  for await (const chunk of provider.stream({ messages })) {
    if (chunk.text) out += chunk.text;
  }
  return out.trim();
}

/** Parse a flat JSON object out of a possibly-fenced LLM reply. */
export function parseJsonObject(raw: string): Record<string, string> | null {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) {
        try {
          const parsed: unknown = JSON.parse(text.slice(start, i + 1));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const record: Record<string, string> = {};
            for (const [key, value] of Object.entries(parsed)) {
              if (typeof value === 'string') record[key] = value;
            }
            return record;
          }
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Strip matching quotes / fence markers a model may wrap around its answer. */
function stripWrapper(text: string): string {
  let out = text.trim();
  if (out.startsWith('```') && out.endsWith('```')) {
    out = out.replace(/^```[^\n]*\n/, '').replace(/```\s*$/, '').trim();
  }
  if (
    (out.startsWith('"') && out.endsWith('"') && out.length >= 2) ||
    (out.startsWith("'") && out.endsWith("'") && out.length >= 2)
  ) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

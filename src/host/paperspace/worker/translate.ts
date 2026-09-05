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

/** Structural face of DSH's `llm` service (feature-detected, all optional). */
export interface DshLlmFace {
  listProviders?: () => Array<{ id: string; name: string }>;
  /** Note: the real llm service resolves models ASYNCHRONOUSLY. */
  listModels?: (provider?: string) => Promise<Array<{ provider: string; id: string; name: string; description?: string }>> | Array<{ provider: string; id: string; name: string; description?: string }>;
  stream?: (options: {
    provider: string;
    model: string;
    reasoningEffort?: string;
    messages: Array<{ role: string; content: Array<{ type: 'text'; text: string }> }>;
    signal: AbortSignal;
  }) => AsyncIterable<{
    type: string;
    text?: string;
    reason?: { kind: string; failure?: { message?: string } };
  }>;
}

/** The DSH model directory the settings page lists (currently available models). */
export interface DshModelDirectory {
  available: boolean;
  groups: Array<{ id: string; name: string; models: Array<{ id: string; name: string }> }>;
  /** Why nothing is available, for the settings-page hint. */
  reason?: 'no-llm-service' | 'empty-directory';
}

/** Defensively map the llm service's directory into the settings-page shape. */
export async function listDshModelDirectory(llm: unknown): Promise<DshModelDirectory> {
  const face = llm as DshLlmFace | undefined;
  if (!face || typeof face.listProviders !== 'function') return { available: false, groups: [], reason: 'no-llm-service' };
  const groups: DshModelDirectory['groups'] = [];
  try {
    for (const provider of face.listProviders()) {
      if (!provider || typeof provider.id !== 'string') continue;
      const models: Array<{ id: string; name: string }> = [];
      if (typeof face.listModels === 'function') {
        for (const model of (await face.listModels(provider.id)) ?? []) {
          if (!model || typeof model.id !== 'string') continue;
          models.push({ id: model.id, name: typeof model.name === 'string' && model.name ? model.name : model.id });
        }
      }
      if (models.length > 0) groups.push({ id: provider.id, name: provider.name ?? provider.id, models });
    }
  } catch {
    return { available: false, groups: [], reason: 'empty-directory' };
  }
  return groups.length > 0 ? { available: true, groups } : { available: false, groups: [], reason: 'empty-directory' };
}

/** Minimal provider contract `complete()` consumes. */
export interface StreamProvider {
  stream(input: { messages: Array<{ role: 'system' | 'user'; content: string }> }): AsyncIterable<{ text?: string }>;
}

/**
 * Provider backed by DSH's `llm` service: translation runs on the exact
 * provider route + model the user picked in paperspace settings (which lists
 * DSH's currently-available models). Reasoning deltas are ignored; the
 * terminal finish reason must be `stop` or the call raises.
 */
class DshLlmProvider implements StreamProvider {
  constructor(
    private readonly face: DshLlmFace,
    private readonly provider: string,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async *stream(input: { messages: Array<{ role: 'system' | 'user'; content: string }> }): AsyncIterable<{ text?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let finish: { kind: string; failure?: { message?: string } } | null = null;
    try {
      // Method invocation on the service keeps its `this` binding — the real
      // LlmRuntime.stream delegates through instance state.
      for await (const chunk of this.face.stream!({
        provider: this.provider,
        model: this.model,
        messages: input.messages.map(message =>
          message.role === 'system'
            ? { role: 'system' as const, content: [{ type: 'text' as const, text: message.content }], source: { kind: 'plugin' as const, plugin: 'dsh-unknownue-plugins' } }
            : { role: 'user' as const, content: [{ type: 'text' as const, text: message.content }], source: { kind: 'user' as const } },
        ),
        signal: controller.signal,
      })) {
        if (chunk.type === 'text-delta' && chunk.text) yield { text: chunk.text };
        if (chunk.type === 'finish' && chunk.reason) finish = chunk.reason;
      }
    } finally {
      clearTimeout(timer);
    }
    if (!finish) {
      if (controller.signal.aborted) throw new Error('The operation was aborted due to timeout');
      throw new Error('translation stream ended without a finish chunk');
    }
    if (finish.kind !== 'stop') {
      throw new Error(finish.failure?.message ?? `model call finished with ${finish.kind}`);
    }
  }
}

export interface TranslationContext {
  translations: TranslationRepo;
  /** LLM provider persisted with the job (settings-specified DSH route, or legacy endpoint). */
  provider: TranslationProviderConfig;
  /** DSH `llm` service, feature-detected; required for DSH-route jobs. */
  llm?: DshLlmFace | null;
  timeoutMs: number;
  maxAttempts: number;
}

/** Build the streaming provider the job's persisted config calls for. */
function buildProvider(ctx: TranslationContext): StreamProvider {
  if ('provider' in ctx.provider) {
    const face = ctx.llm;
    if (!face || typeof face.stream !== 'function') {
      throw new TranslationFatalError('DSH llm service unavailable — this translation job needs the DSH model route');
    }
    return new DshLlmProvider(face, ctx.provider.provider, ctx.provider.model, ctx.timeoutMs);
  }
  return new OpenAICompatibleProvider({ baseUrl: ctx.provider.baseUrl, apiKey: ctx.provider.apiKey ?? undefined, model: ctx.provider.model, timeoutMs: ctx.timeoutMs });
}

export async function runTranslationJob(job: TranslationJobRow, markdown: string, ctx: TranslationContext): Promise<void> {
  const provider = () => buildProvider(ctx);

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

async function extractGlossary(markdown: string, targetLang: string, provider: StreamProvider): Promise<Record<string, string>> {
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

// Placeholder markers used to shield math from the LLM. Chosen to be tokens a
// model will reliably copy verbatim rather than spell out or "fix": a short
// uppercase word would risk being translated, whereas a bracketed punctuation
// run has no natural-language reading. `N` is a decimal id.
const PROTECT_MARKER = '⟨⌁';
const BLOCK_MARKER = '⟨⌂';

// Anything a model might be tempted to translate or reformat, replaced with a
// placeholders before the LLM call so the source survives byte-for-byte:
//   - inline math  $…$   and display math  $$…$$  (the bug this guards against)
//   - inline code  `…`
//   - HTML tags    <…>
// Math can contain escaped `\$` and doubled `$$`; inline `$…$` is matched
// with a non-greedy body (no newline), display `$$…$$` separately so `$$`
// runs don't swallow everything to end-of-text.
const INLINE_MATH_RE = /(?<!\\)\$(?!\$)([^$\n]+?)(?<!\\)\$(?!\$)/g;
const DISPLAY_MATH_RE = /\$\$([\s\S]+?)\$\$/g;
const INLINE_CODE_RE = /`[^`\n]+`/g;
const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/g;

interface SpanProtection {
  /** The text with every protected span swapped out for a placeholder. */
  protected: string;
  /** Replaces placeholders in a model reply with the original spans. */
  restore: (translated: string) => string;
}

/**
 * Shield math (and other verbatim-sensitive spans) with placeholders so a
 * translation model cannot alter the formulas. Only the prose around them is
 * translated; `restore` splices the originals back in.
 */
export function protectMath(text: string): SpanProtection {
  const replacers: Array<{ match: RegExp; marker: string }> = [
    { match: DISPLAY_MATH_RE, marker: BLOCK_MARKER },
    { match: INLINE_MATH_RE, marker: PROTECT_MARKER },
    { match: INLINE_CODE_RE, marker: PROTECT_MARKER },
    { match: HTML_TAG_RE, marker: PROTECT_MARKER },
  ];

  const spans: string[] = [];
  let inProgress = text;
  for (const { match, marker } of replacers) {
    inProgress = inProgress.replace(match, (span: string) => {
      const id = spans.length;
      spans.push(span);
      return `${marker}${id}${marker}`;
    });
  }

  const RESTORE_RE = /⟨⌁(\d+)⟨⌁|⟨⌂(\d+)⟨⌂/g;
  return {
    protected: inProgress,
    restore(translated: string): string {
      return translated.replace(RESTORE_RE, (_whole, inline?: string, block?: string) => {
        const index = Number(inline ?? block);
        return spans[index] ?? '';
      });
    },
  };
}

async function translateParagraph(text: string, targetLang: string, glossary: Record<string, string>, provider: StreamProvider): Promise<string> {
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const system = [
    `You are a professional academic-paper translator. Translate the provided paragraph into ${langName}.`,
    'Rules:',
    '- Return ONLY the translation — no explanations, no quotes, no code fences.',
    `- Markdown is protected: math is replaced by placeholders of the form ${PROTECT_MARKER}N${PROTECT_MARKER} and ${BLOCK_MARKER}N${BLOCK_MARKER}. Copy every placeholder into your output EXACTLY as-is, in the same order, never translate, alter, or drop them.`,
    '- Preserve all remaining markdown formatting exactly: keep ![…]() images and […]() links unchanged, keep **bold** / *italic* / `code` markers, keep list bullets and numbering, keep any HTML tags.',
    '- Translate prose faithfully and fluently; keep proper nouns, model names, method names, and dataset names in their original form.',
    '- Use the provided glossary when its terms appear; otherwise choose a natural, consistent translation.',
    '- Never translate code. Never invent content that is not in the source.',
  ].join('\n');
  const terms = Object.entries(glossary)
    .map(([term, translation]) => (translation ? `${term} → ${translation}` : `${term} → (keep original)`))
    .join('\n');
  const { protected: protectedText, restore } = protectMath(text);
  const user = `Glossary:\n${terms}\n\nParagraph:\n${protectedText}`;
  const response = await complete(provider, [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);
  return restore(stripWrapper(response));
}

/** One non-tool LLM completion; returns the concatenated text. */
async function complete(provider: StreamProvider, messages: Array<{ role: 'system' | 'user'; content: string }>): Promise<string> {
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

/**
 * DSH-native conversation integration:
 *
 * - materializes each paper as `<workspace>/papers/<arxivId>.md` so DSH's own
 *   filesystem tools can read it;
 * - registers `search_paper` / `read_section` as REAL DSH tools — they resolve
 *   the caller's paper via `exec.agent.sessionId` → paper.paper_sessions →
 *   paper.papers, so a tool call in any session is grounded in that session's
 *   linked paper;
 * - links a DSH session to a paper through the single shared "Paperspace"
 *   workspace (one workspace entry no matter how many papers).
 *
 * Services are feature-detected from the host context so the row still loads
 * in compositions without sessions/workspace/tools (routes then answer 501).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { Sql } from 'postgres';
import { createPaperRepo } from './domain/papers';
import { createSessionLinkRepo } from './domain/session-links';

// ── paper markdown materialization ─────────────────────────────────────────

export function papersSubdir(workspaceDir: string): string {
  return join(workspaceDir, 'papers');
}

export async function ensurePapersDir(workspaceDir: string): Promise<string> {
  const dir = papersSubdir(workspaceDir);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Write (or refresh) the paper's markdown snapshot into the shared workspace. */
export async function ensurePaperMarkdown(sql: Sql, workspaceDir: string, arxivId: string): Promise<string> {
  const papers = createPaperRepo(sql);
  const row = await papers.findByRef(arxivId);
  if (!row || !row.markdown) throw new Error('paper content unavailable');
  const dir = await ensurePapersDir(workspaceDir);
  const file = join(dir, arxivId + '.md');
  await writeFile(file, row.markdown, 'utf8');
  return file;
}

// ── DSH tool registration ──────────────────────────────────────────────────

export interface ToolRegistryFace {
  register(definition: unknown): () => void;
}

/** DSH services paperspace consumes (all optional; feature-detected). */
export interface DshServices {
  tools?: ToolRegistryFace;
}

interface CallerAgent {
  id?: string;
  sessionId?: string;
}

/** The caller's session identity (dsh-agent's Agent carries it on `id`). */
function callerSessionId(exec: { agent?: CallerAgent }): string | undefined {
  const agent = exec?.agent;
  return agent?.id ?? agent?.sessionId;
}

/** Resolve the markdown of the paper linked to the calling session, or null. */
export async function resolveCallerPaper(sql: Sql, exec: { agent?: CallerAgent }): Promise<string | null> {
  const sessionId = callerSessionId(exec);
  if (!sessionId) return null;
  const link = await createSessionLinkRepo(sql).findBySession(sessionId);
  if (!link) return null;
  const paper = await createPaperRepo(sql).findByRef(link.arxivId);
  return paper?.markdown ?? null;
}

// ── model-facing paper context (system-prompt assembly) ────────────────────

export interface DshAgentsFace {
  list(): Array<{ id?: string; ctx?: unknown }>;
}

/** Build the model-facing context sentence for a session's linked paper. */
export async function paperContextTextForSession(getSql: () => Promise<Sql>, sessionId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<Array<{ arxivId: string; metadata: unknown }>>`
    SELECT p.arxiv_id, p.metadata
    FROM paper.paper_sessions s
    JOIN paper.papers p ON p.arxiv_id = s.arxiv_id
    WHERE s.session_id = ${sessionId}
    LIMIT 1`;
  const row = rows[0];
  if (!row) return null;
  const meta = (row.metadata ?? {}) as { title?: string; categories?: string[] };
  const title = meta.title ?? row.arxivId;
  const categories = (meta.categories ?? []).join(', ');
  return [
    `Current paper: “${title}” (arXiv:${row.arxivId}${categories ? ', categories: ' + categories : ''}).`,
    `Ground your answers in THIS paper: call search_paper for passages or read_section for a whole section, or read papers/${row.arxivId}.md with file tools. If the user asks about a different paper, ask them to link it first.`,
  ].join(' ');
}

/**
 * Resolve the cached paper-context text for a system-prompt assembly.
 * dsh-agent's `assembleContextFor` passes `scope: agent` — the assembling
 * AGENT OBJECT ITSELF — so we read `scope.id` (the shared agent/session
 * identity) straight off the scope and hit the sessionId→text cache.
 * Synchronous — prompt providers cannot await SQL, so the paperspace row
 * keeps the cache warm on every link change.
 */
export function paperTextForScope(scope: unknown, cache: ReadonlyMap<string, string>): string {
  if (scope === null || typeof scope !== 'object') return '';
  const agentId = (scope as { id?: unknown }).id;
  if (typeof agentId !== 'string') return '';
  return cache.get(agentId) ?? '';
}

const SEARCH_MAX_QUERY = 500;
const SEARCH_MAX_RESULTS = 8;
const SEARCH_MAX_PASSAGE = 1200;
const SECTION_MAX_HEADING = 200;
const SECTION_MAX_CHARS = 12000;

function textBlock(value: unknown): Array<{ type: 'text'; text: string }> {
  return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }];
}

export function registerPaperTools(tools: ToolRegistryFace | undefined, getSql: () => Promise<Sql>): string[] {
  if (!tools) return [];
  const registered: string[] = [];

  tools.register(
    defineTool({
      name: 'search_paper',
      description:
        'Search passages in the CURRENT PAPER only (the paper linked to this session). Returns up to 8 scored passages; use it to ground answers in the paper. Not for other documents.',
      parameters: {
        query: { type: 'string', required: true, description: 'Search terms, lowercased for matching.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            passages: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  index: { type: 'integer', description: '0-based paragraph index in the paper markdown.' },
                  passage: { type: 'string', description: 'Matching paragraph, truncated.' },
                },
              },
            },
            note: { type: 'string', description: 'Human-readable note when no paper is bound or nothing matches.' },
          },
        },
        render: (_args, value) => textBlock(value),
      },
      async execute(args, exec: ToolRunContext) {
        const sql = await getSql();
        const markdown = await resolveCallerPaper(sql, exec as unknown as { agent?: CallerAgent });
        if (!markdown) return { passages: [], note: 'This session is not linked to a paper. Link one through the picker above the composer or the 论文 tab (与 AI 讨论).' };
        const query = String((args as { query: string }).query).toLowerCase();
        const terms = query.split(/\s+/).filter(Boolean);
        const paragraphs = markdown.split(/\n\s*\n/);
        const passages = paragraphs
          .map((text, index) => ({ text, index, score: terms.filter(term => text.toLowerCase().includes(term)).length }))
          .filter(entry => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, SEARCH_MAX_RESULTS)
          .map(({ text, index }) => ({ index, passage: text.slice(0, SEARCH_MAX_PASSAGE) }));
        return { passages, note: passages.length ? '' : 'No passages matched.' };
      },
    }),
  );
  registered.push('search_paper');

  tools.register(
    defineTool({
      name: 'read_section',
      description: 'Read one heading section from the CURRENT PAPER only (the paper linked to this session). Returns the section text up to a character cap.',
      parameters: {
        heading: { type: 'string', required: true, description: 'Exact section heading text (without the # markers).' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            heading: { type: 'string' },
            content: { type: 'json', description: 'Section markdown, or null when the heading was not found.' },
            note: { type: 'string', description: 'Present only when the session is not linked to a paper.' },
          },
        },
        render: (_args, value) => textBlock(value),
      },
      async execute(args, exec: ToolRunContext) {
        const sql = await getSql();
        const markdown = await resolveCallerPaper(sql, exec as unknown as { agent?: CallerAgent });
        if (!markdown) return { heading: String((args as { heading: string }).heading), content: null, note: 'This session is not linked to a paper. Link one through the picker above the composer or the 论文 tab.' };
        const wanted = String((args as { heading: string }).heading).toLowerCase().trim();
        const lines = markdown.split('\n');
        const start = lines.findIndex(line => /^#{1,6}\s+/.test(line) && line.replace(/^#{1,6}\s+/, '').trim().toLowerCase() === wanted);
        if (start < 0) return { heading: String((args as { heading: string }).heading), content: null };
        const level = (lines[start].match(/^#+/) ?? [''])[0].length;
        const end = lines.findIndex((line, i) => i > start && new RegExp(`^#{1,${level}}\\s+`).test(line));
        return {
          heading: lines[start].replace(/^#+\s+/, ''),
          content: lines.slice(start, end < 0 ? undefined : end).join('\n').slice(0, SECTION_MAX_CHARS),
        };
      },
    }),
  );
  registered.push('read_section');

  return registered;
}

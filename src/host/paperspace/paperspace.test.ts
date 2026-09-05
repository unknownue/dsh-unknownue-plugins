/**
 * paperspace host-half integration test (no framework; run: node lib/paperspace/paperspace.test.js).
 *
 * Boots the REAL paperspace runtime (PGlite + pgwire socket + postgres.js +
 * local object store) inside a mock cordis ctx, then exercises:
 *
 *   - apply() wiring: route registration, service provide, effect disposers
 *   - schema migrations (verbatim paperspace SQL) on first boot
 *   - REST: health, papers CRUD + validation, asset list/stream, translation
 *     job lifecycle endpoints, SSE chat guards
 *   - domain: FOR UPDATE SKIP LOCKED ingest claim, translation job lifecycle
 *   - worker: startWorker registers loop disposers (no hang on dispose)
 *   - runtime: runAgent tool loop with a fake provider; parseSse roundtrip
 *   - pure helpers: paragraph split/splice, image URL extraction/rewrite
 *   - object store: put/get/delete roundtrip
 *   - dispose → queries fail; data persists across a fresh runtime (reopen)
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';
import { apply } from './index.js';
import { loadSettingsFile } from './settings';
import { paperContextTextForSession, paperTextForScope } from './dsh-integration';
import type { PaperspaceHost } from './types';
import { createPaperRepo } from './domain/papers';
import { createAssetRepo } from './domain/assets';
import { createTranslationRepo } from './domain/translations';
import { createSessionLinkRepo } from './domain/session-links';
import { splitParagraphs, spliceParagraphs } from './domain/paragraphs';
import { parseSse } from './runtime/index';
import { extractImageUrls, rewriteImageUrls } from './worker/images';
import { htmlToMarkdown } from './worker/html2md';
import { failTranslationJob, parseJsonObject, protectMath, runTranslationJob, TranslationFatalError } from './worker/translate';
import type { PaperspaceHostContext, WebRoute } from './types';

const API = '/dsh-unknownue-plugins/paperspace/api';

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// ── mock ctx / req / res ───────────────────────────────────────────────────

const routes = new Map<string, WebRoute>();
const disposers: Array<() => void> = [];
const services = new Map<string, unknown>();
const registeredTools: Array<{ name: string; execute: (args: unknown, exec: unknown) => Promise<unknown> }> = [];
const fakeSessions = {
  seq: 0,
  create() {
    this.seq += 1;
    return { id: 'sess-' + this.seq };
  },
  get(id: string) {
    return { id };
  },
};
const renamedTitles = new Map<string, string>();
const fakeSessionTitle = {
  rename(session: { id: string }, title: string) {
    renamedTitles.set(session.id, title);
    return { title };
  },
};
const fakeWorkspaceRegistry = {
  async resolveByPath() {
    return undefined;
  },
  async create(_path: string, title?: string) {
    return { id: 'ws-1', title: title ?? '' };
  },
};

/** Structural stand-in for DSH's `llm` service (directory + stream). */
const fakeLlm = {
  listProviders: () => [{ id: 'mock', name: 'Mock Provider' }],
  listModels: async (provider?: string) => (provider === 'mock' ? [{ provider: 'mock', id: 'mock-1', name: 'Mock One' }] : []),
  async *stream(options: { messages: Array<{ role: string; content: Array<{ type: 'text'; text: string }> }>; signal: AbortSignal }) {
    const system = String(options.messages[0]?.content?.[0]?.text ?? '');
    const user = String(options.messages.at(-1)?.content?.[0]?.text ?? '');
    if (system.includes('terminology extractor')) {
      yield { type: 'text-delta', index: 0, text: '{"transformer":"变换器"}' };
    } else if (system.includes('academic-paper translator')) {
      yield { type: 'reasoning-delta', index: 0, text: 'thinking…' };
      yield { type: 'text-delta', index: 0, text: '[DSH] ' + (user.split('Paragraph:\n').pop() ?? '') };
    }
    yield { type: 'finish', reason: { kind: 'stop' } };
  },
};

const mockCtx: PaperspaceHostContext = {
  effect(fn: () => unknown, _label?: string): unknown {
    const result = fn();
    if (typeof result === 'function') disposers.push(result as () => void);
    return undefined;
  },
  provide(name: string, value: unknown): unknown {
    services.set(name, value);
    return undefined;
  },
  get(name: string): unknown {
    if (name === 'sessions') return fakeSessions;
    if (name === 'sessionTitle') return fakeSessionTitle;
    if (name === 'workspaceRegistry') return fakeWorkspaceRegistry;
    if (name === 'llm') return fakeLlm;
    if (name === 'tools') return { register: (definition: { name: string; execute: (args: unknown, exec: unknown) => Promise<unknown> }) => { registeredTools.push(definition); return () => undefined; } };
    return undefined;
  },
  webServer: {
    register(route: WebRoute) {
      routes.set(`${route.kind}:${route.path}`, route);
      return () => routes.delete(`${route.kind}:${route.path}`);
    },
  },
};

function mockReq(method: string, url: string, body?: unknown): IncomingMessage {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    method,
    url,
    headers: { host: '127.0.0.1:13080' },
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  }) as unknown as IncomingMessage;
}

class MockRes extends EventEmitter {
  statusCode = 0;
  body = '';
  bodyBuffer = Buffer.alloc(0);
  headers: Record<string, string> = {};
  writeHead(status: number, headers?: Record<string, string>) {
    this.statusCode = status;
    Object.assign(this.headers, headers ?? {});
    return this;
  }
  write(chunk: unknown) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    this.bodyBuffer = Buffer.concat([this.bodyBuffer, buffer]);
    return true;
  }
  end(chunk?: unknown) {
    if (typeof chunk === 'string') this.body = chunk;
    else if (Buffer.isBuffer(chunk)) this.bodyBuffer = Buffer.concat([this.bodyBuffer, chunk]);
    process.nextTick(() => this.emit('close'));
    return this;
  }
}

function matchRoute(url: string): WebRoute | undefined {
  const pathname = new URL(url, 'http://127.0.0.1').pathname;
  const exact = routes.get(`exact:${pathname}`);
  if (exact) return exact;
  let best: WebRoute | undefined;
  for (const [key, route] of routes) {
    if (!key.startsWith('prefix:')) continue;
    if (pathname === route.path || pathname.startsWith(route.path + '/')) {
      if (!best || route.path.length > best.path.length) best = route;
    }
  }
  return best;
}

async function call(method: string, url: string, body?: unknown): Promise<MockRes> {
  const route = matchRoute(url);
  assert.ok(route, `no route for ${url}`);
  const req = mockReq(method, url, body);
  const res = new MockRes();
  await route.handler(req, res as unknown as ServerResponse);
  return res;
}

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── mock OpenAI-compatible SSE server ───────────────────────────────────────

async function startMockLlm(): Promise<{ url: string; requests: Array<{ body: any }>; close(): Promise<void> }> {
  const requests: Array<{ body: any }> = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      let body: any;
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        body = {};
      }
      requests.push({ body });
      const sse = (obj: unknown) => 'data: ' + JSON.stringify(obj) + '\n\n';
      const system = String(body.messages?.[0]?.content ?? '');
      const hasToolResult = (body.messages ?? []).some((m: any) => m.role === 'tool');
      res.writeHead(200, { 'content-type': 'text/event-stream', connection: 'keep-alive' });
      if (system.includes('terminology extractor')) {
        res.write(sse({ choices: [{ delta: { content: JSON.stringify({ transformer: '变换器' }) } }] }));
      } else if (system.includes('academic-paper translator')) {
        const user = String(body.messages?.at(-1)?.content ?? '');
        const para = user.split('Paragraph:\n').pop() ?? '';
        res.write(sse({ choices: [{ delta: { content: '[ZH] ' + para } }] }));
      } else if (!hasToolResult) {
        res.write(sse({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'search_paper', arguments: JSON.stringify({ query: 'hello' }) } }] } }] }));
      } else {
        res.write(sse({ choices: [{ delta: { content: 'The paper says hello.' } }] }));
        res.write(sse({ usage: { prompt_tokens: 10, completion_tokens: 5 } }));
      }
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

// ── test ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'dsh-paperspace-test-'));
  // Large poll intervals keep the in-process worker loops dormant during the test.
  const config = { dataDir: join(root, 'db'), assetsDir: join(root, 'assets'), workspaceDir: join(root, 'workspace'), port: 0, initialMemoryBytes: 512 * 1024 * 1024, pollMs: 60000, ingestTimeoutMs: 30000, maxAssetBytes: 10485760, ingestConcurrency: 2, translateMaxAttempts: 3, translateStuckAfterMinutes: 30, translateTimeoutMs: 120000, rescanIntervalMs: 60000 };
  // Isolate settings.json from the real user home.
  const priorDshHome = process.env.DSH_HOME;
  process.env.DSH_HOME = root;

  try {
    apply(mockCtx, { dataDir: config.dataDir, assetsDir: config.assetsDir, port: 0, pollMs: config.pollMs, rescanIntervalMs: config.rescanIntervalMs });

    const host = services.get('paperspace') as PaperspaceHost;
    assert.ok(host, 'apply() provides the paperspace host');
    assert.ok(routes.has(`exact:${API}/health`), 'health route registered');
    assert.ok(routes.has(`exact:${API}/settings`), 'settings route registered');
    assert.ok(routes.has(`prefix:${API}/papers`), 'papers route registered');
    assert.equal(disposers.length, 1, 'runtime dispose registered via ctx.effect (worker dormant until configured)');
    check('apply() wiring: routes + service + disposer', true);

    // ── gate: nothing works until configured ────────────────────────────────
    check('starts unconfigured', host.state.configured === false);
    const settingsBefore = await call('GET', `${API}/settings`);
    check('GET /settings → defaults, unconfigured', settingsBefore.statusCode === 200 && JSON.parse(settingsBefore.body).configured === false && typeof JSON.parse(settingsBefore.body).defaults.dataDir === 'string');
    const gatedPapers = await call('GET', `${API}/papers`);
    check('business route gated → 423', gatedPapers.statusCode === 423 && JSON.parse(gatedPapers.body).code === 'PAPERSPACE_NOT_CONFIGURED');
    const gatedHealth = await call('GET', `${API}/health`);
    check('health reports not-configured', gatedHealth.statusCode === 200 && JSON.parse(gatedHealth.body).status === 'not-configured');
    const invalidSettings = await call('POST', `${API}/settings`, { configured: true, dataDir: '' });
    check('invalid settings rejected → 400', invalidSettings.statusCode === 400 && JSON.parse(invalidSettings.body).code === 'VALIDATION_ERROR');

    // ── configure → runtime starts ───────────────────────────────────────────
    const configuredRes = await call('POST', `${API}/settings`, { configured: true, dataDir: config.dataDir, assetsDir: config.assetsDir, port: 0, pollMs: config.pollMs, rescanIntervalMs: config.rescanIntervalMs });
    const configuredBody = JSON.parse(configuredRes.body);
    check('POST /settings configure → 200', configuredRes.statusCode === 200 && configuredBody.ok === true && configuredBody.configured === true && configuredBody.restartRequired === false);
    check('host flips to configured', host.state.configured === true);

    const active0 = await host.ensureStarted();
    check('PGlite + pgwire socket boot', active0.runtime.port > 0, `port ${active0.runtime.port}`);

    const sql = await active0.runtime.getSql();

    const reg = await sql<Array<{ name: string | null }>>`SELECT to_regclass('paper.papers') AS name`;
    check('migrations ran (paper.papers exists)', reg[0].name === 'paper.papers');

    // ── health / papers CRUD ────────────────────────────────────────────────
    const health = await call('GET', `${API}/health`);
    check('GET /health → 200 ok', health.statusCode === 200 && JSON.parse(health.body).status === 'ok');

    const created = await call('POST', `${API}/papers`, { arxiv_id: '1706.03762' });
    check('POST /papers → 202', created.statusCode === 202, JSON.parse(created.body).arxivId);

    const duplicate = await call('POST', `${API}/papers`, { arxiv_id: '1706.03762' });
    check('POST /papers duplicate → 200', duplicate.statusCode === 200);

    const invalid = await call('POST', `${API}/papers`, { arxiv_id: 'not-an-arxiv-id' });
    check('POST /papers invalid id → 400', invalid.statusCode === 400 && JSON.parse(invalid.body).code === 'VALIDATION_ERROR');

    const listed = await call('GET', `${API}/papers?page=1&page_size=20`);
    check('GET /papers list', listed.statusCode === 200 && JSON.parse(listed.body).total === 1);

    const detail = await call('GET', `${API}/papers/1706.03762`);
    check('GET /papers/:ref detail', detail.statusCode === 200 && JSON.parse(detail.body).status === 'ingesting');

    const missing = await call('GET', `${API}/papers/9999.99999`);
    check('GET /papers/:ref missing → 404', missing.statusCode === 404 && JSON.parse(missing.body).code === 'PAPER_NOT_FOUND');

    // ── domain claims ───────────────────────────────────────────────────────
    const papers = createPaperRepo(sql);
    const claimed = await papers.claimNextIngesting(0);
    assert.ok(claimed, 'claimNextIngesting returned a paper');
    check('ingest claim FOR UPDATE SKIP LOCKED', claimed.arxivId === '1706.03762');

    // ── translation lifecycle via repos ─────────────────────────────────────
    const translations = createTranslationRepo(sql);
    const second = await papers.insert('large.test');
    const job = await translations.createJob(second.id, 'zh-CN', null);
    const claimedJob = await translations.claimNextJob();
    check('translation job claim', claimedJob?.id === job.id && claimedJob?.status === 'running');
    await translations.finishJob(job.id, second.id, 'zh-CN', 'test-model');
    check('translation job finish', (await translations.jobStatus(job.id)) === 'completed');
    const cancelled = await translations.cancelActiveJob(second.id, 'zh-CN');
    check('cancel on completed job is a no-op', cancelled === false);

    // ── asset REST + object store ───────────────────────────────────────────
    const assets = createAssetRepo(sql);
    const store = host.active()!.store;
    await store.ensureBucket();
    await store.putObject('papers/1706.03762/abc1.png', Buffer.from([1, 2, 3, 4]), 'image/png');
    const md = { title: 'Test Paper', authors: ['A'], categories: ['cs.CL'], abstract: 'abstract', published: '2017-06-12' };
    await papers.finishReady(claimed.id, md, '# Intro\n\nParagraph one.\n\n## Methods\n\nParagraph two.');
    const inserted = await assets.insertMany(claimed.id, [
      { originalUrl: 'https://x/f1.png', objectKey: 'papers/1706.03762/abc1.png', contentType: 'image/png', sizeBytes: 4 },
    ]);

    const assetList = await call('GET', `${API}/papers/1706.03762/assets`);
    check('GET assets list', assetList.statusCode === 200 && JSON.parse(assetList.body).items.length === 1);

    const assetBytes = await call('GET', `${API}/papers/1706.03762/assets/${inserted[0].id}`);
    check('GET asset stream (content-type + bytes)', assetBytes.statusCode === 200 && assetBytes.headers['content-type'] === 'image/png' && assetBytes.bodyBuffer.equals(Buffer.from([1, 2, 3, 4])));

    const missingAsset = await call('GET', `${API}/papers/1706.03762/assets/${crypto.randomUUID()}`);
    check('GET missing asset → 404', missingAsset.statusCode === 404 && JSON.parse(missingAsset.body).code === 'ASSET_NOT_FOUND');

    // ── KaTeX font static route ─────────────────────────────────────────────
    const font = await call('GET', '/dsh-unknownue-plugins/paperspace/static/fonts/KaTeX_Main-Regular.woff2');
    check('KaTeX font served (woff2 + bytes)', font.statusCode === 200 && font.headers['content-type'] === 'font/woff2' && font.bodyBuffer.length > 1000);
    const badFont = await call('GET', '/dsh-unknownue-plugins/paperspace/static/fonts/secret.txt');
    check('font route rejects non-font names', badFont.statusCode === 404);

    // ── translation REST flow ───────────────────────────────────────────────
    const modelDirectory = await call('GET', `${API}/models`);
    const modelDirectoryBody = JSON.parse(modelDirectory.body);
    check('GET /models → DSH directory (mock llm)', modelDirectory.statusCode === 200 && modelDirectoryBody.available === true && modelDirectoryBody.groups[0]?.id === 'mock' && modelDirectoryBody.groups[0]?.models[0]?.id === 'mock-1');

    const noProvider = await call('POST', `${API}/papers/1706.03762/translate-paper`, { target_lang: 'zh-CN' });
    check('POST translate without settings model → 400', noProvider.statusCode === 400 && JSON.parse(noProvider.body).code === 'MODEL_NOT_CONFIGURED');

    const savedModel = await call('POST', `${API}/settings`, { configured: true, translateModel: { provider: 'mock', model: 'mock-1' } });
    check('POST /settings with translateModel → 200', savedModel.statusCode === 200 && JSON.parse(savedModel.body).ok === true);

    const started = await call('POST', `${API}/papers/1706.03762/translate-paper`, { target_lang: 'zh-CN' });
    const startedBody = JSON.parse(started.body);
    check(
      'POST translate-paper → 202 with settings-selected provider',
      started.statusCode === 202 && startedBody.job.provider?.provider === 'mock' && startedBody.job.provider?.model === 'mock-1',
    );

    const activeAgain = await call('POST', `${API}/papers/1706.03762/translate-paper`, { target_lang: 'zh-CN' });
    check('POST translate again returns active job', activeAgain.statusCode === 202 && JSON.parse(activeAgain.body).job.id === startedBody.job.id);

    const unavailable = await call('POST', `${API}/settings`, { configured: true, translateModel: { provider: 'missing', model: 'mock-1' } });
    const unavailableTranslate = await call('POST', `${API}/papers/1706.03762/translate-paper`, { target_lang: 'zh-CN' });
    check(
      'POST translate with unavailable provider → 400 MODEL_UNAVAILABLE',
      unavailable.statusCode === 200 && unavailableTranslate.statusCode === 400 && JSON.parse(unavailableTranslate.body).code === 'MODEL_UNAVAILABLE',
    );
    await call('POST', `${API}/settings`, { configured: true, translateModel: { provider: 'mock', model: 'mock-1' } });

    const jobPoll = await call('GET', `${API}/papers/1706.03762/translation-job?lang=zh-CN`);
    check('GET translation-job', jobPoll.statusCode === 200 && JSON.parse(jobPoll.body).job.status === 'pending');

    const noSnapshot = await call('GET', `${API}/papers/1706.03762/translation?lang=zh-CN`);
    check('GET translation without snapshot → 404', noSnapshot.statusCode === 404 && JSON.parse(noSnapshot.body).code === 'TRANSLATION_NOT_FOUND');

    const cancelJob = await call('DELETE', `${API}/papers/1706.03762/translation-job?lang=zh-CN`);
    check('DELETE translation-job → 204', cancelJob.statusCode === 204);

    const cancelledPoll = await call('GET', `${API}/papers/1706.03762/translation-job?lang=zh-CN`);
    check('cancelled job visible', cancelledPoll.statusCode === 200 && JSON.parse(cancelledPoll.body).job.status === 'cancelled');

    const cancelAgain = await call('DELETE', `${API}/papers/1706.03762/translation-job?lang=zh-CN`);
    check('DELETE again → 404 not active', cancelAgain.statusCode === 404 && JSON.parse(cancelAgain.body).code === 'TRANSLATION_JOB_NOT_ACTIVE');

    // ── DSH integration: tools registered at apply ──────────────────────────
    const toolNames = registeredTools.map(tool => tool.name).sort();
    check('DSH tools registered (read_section + search_paper)', JSON.stringify(toolNames) === JSON.stringify(['read_section', 'search_paper']));

    // ── DELETE /papers/:ref ─────────────────────────────────────────────────
    // Materialize a stale workspace md first so the cleanup path is exercised.
    mkdirSync(join(config.workspaceDir, 'papers'), { recursive: true });
    const staleMdFile = join(config.workspaceDir, 'papers', '1706.03762.md');
    writeFileSync(staleMdFile, '# stale\n', 'utf8');
    const removed = await call('DELETE', `${API}/papers/1706.03762`);
    check('DELETE /papers → 204', removed.statusCode === 204);
    const afterDelete = await call('GET', `${API}/papers/1706.03762`);
    check('paper gone after delete', afterDelete.statusCode === 404);
    await assert.rejects(() => store.getObject('papers/1706.03762/abc1.png'));
    check('object gone after delete', true);
    check('workspace paper md removed on delete', !existsSync(staleMdFile));

    // ── DSH tools: bound to the calling session ─────────────────────────────
    // Unbound session → note.
    const searchTool = registeredTools.find(tool => tool.name === 'search_paper')!;
    const unbound = (await searchTool.execute({ query: 'hello' }, { agent: { sessionId: 'no-such-session' } })) as { passages: unknown[]; note: string };
    check('search_paper unbound session → note', unbound.passages.length === 0 && Boolean(unbound.note));
    // Native flow: prepare → (client registers workspace + connects session) → link.
    const paperX4 = await papers.insert('2101.00004');
    await papers.finishReady(paperX4.id, { title: 'C', authors: [], categories: [], abstract: null, published: null }, '# Intro\n\nhello world\n\n## Methods\n\nmore text');
    const prepared = await call('POST', `${API}/sessions`, { arxiv_id: '2101.00004' });
    const preparedBody = JSON.parse(prepared.body);
    check('POST /sessions prepares workspace + md', prepared.statusCode === 200 && preparedBody.workspaceDir === config.workspaceDir && typeof preparedBody.mdFile === 'string');
    const linked = await call('POST', `${API}/sessions/link`, { session_id: 'sess-1', arxiv_id: '2101.00004' });
    check('POST /sessions/link records binding', linked.statusCode === 200 && JSON.parse(linked.body).sessionId === 'sess-1');
    check('session auto-named after linked paper', renamedTitles.get('sess-1') === 'C');
    const linksRepo = createSessionLinkRepo(sql);
    const linkRow = await linksRepo.findBySession('sess-1');
    check('session→paper mapping persisted', linkRow?.arxivId === '2101.00004');
    const linkLookup = await call('GET', `${API}/sessions/sess-1`);
    check('GET /sessions/:id returns linked paper', linkLookup.statusCode === 200 && JSON.parse(linkLookup.body).arxivId === '2101.00004' && JSON.parse(linkLookup.body).status === 'ready');
    const noLink = await call('GET', `${API}/sessions/no-such-session`);
    check('GET /sessions/:id unknown → 404', noLink.statusCode === 404 && JSON.parse(noLink.body).code === 'SESSION_NOT_LINKED');
    check('paper.md materialized into workspace', existsSync(join(config.workspaceDir, 'papers', '2101.00004.md')));
    const grounded = (await searchTool.execute({ query: 'hello' }, { agent: { sessionId: 'sess-1' } })) as { passages: Array<{ passage: string }>; note: string };
    check('search_paper grounded in linked paper', grounded.passages.length === 1 && grounded.passages[0]?.passage.includes('hello world') === true);
    const groundedById = (await searchTool.execute({ query: 'hello' }, { agent: { id: 'sess-1' } })) as { passages: Array<{ passage: string }>; note: string };
    check('search_paper grounded via agent.id (dsh-agent identity field)', groundedById.passages.length === 1 && groundedById.passages[0]?.passage.includes('hello world') === true);
    const sectionTool = registeredTools.find(tool => tool.name === 'read_section')!;
    const section = (await sectionTool.execute({ heading: 'Methods' }, { agent: { sessionId: 'sess-1' } })) as { heading: string; content: string | null };
    check('read_section resolves section', section.heading === 'Methods' && section.content?.includes('more text') === true);
    // Model-facing paper context for the system-prompt assembly.
    const contextText = await paperContextTextForSession(() => Promise.resolve(sql), 'sess-1');
    check('paper context text for linked session', contextText !== null && contextText.includes('2101.00004') && contextText.includes('C') && contextText.includes('search_paper'));
    const noContext = await paperContextTextForSession(() => Promise.resolve(sql), 'nobody');
    check('no context text for unlinked session', noContext === null);
    const scopeCache = new Map<string, string>([['sess-1', 'PAPER']]);
    check('paperTextForScope reads agent.id off the assembly scope', paperTextForScope({ id: 'sess-1' }, scopeCache) === 'PAPER');
    check('paperTextForScope empty for unknown scope', paperTextForScope({ id: 'nobody' }, scopeCache) === '' && paperTextForScope(undefined, scopeCache) === '');
    await papers.insert('2101.00005');
    const notReadyLink = await call('POST', `${API}/sessions`, { arxiv_id: '2101.00005' });
    check('POST /sessions on non-ready paper → 409', notReadyLink.statusCode === 409 && JSON.parse(notReadyLink.body).code === 'PAPER_NOT_READY');

    const sseRoundtrip = [];
    const sseText = 'event: delta.text\ndata: {"type":"delta.text","text":"x"}\n\nevent: done\ndata: {"type":"done","status":"completed"}\n\n';
    async function* sseIter(): AsyncGenerator<string> {
      yield sseText;
    }
    for await (const frame of parseSse(sseIter())) {
      sseRoundtrip.push(JSON.parse(frame.data));
    }
    check('parseSse roundtrip', sseRoundtrip.length === 2 && sseRoundtrip[0].type === 'delta.text');

    // ── pure helpers ────────────────────────────────────────────────────────
    const markdown = '# Title\n\nHello world.\n\n## References\n\nskip me\n\n## Appendix\n\nlast words.';
    const blocks = splitParagraphs(markdown);
    const spliced = spliceParagraphs(markdown, blocks.map(b => ({ start: b.start, end: b.end })), [blocks[0].text.toUpperCase(), null]);
    check('paragraph split skips references + splice roundtrip', blocks.length === 2 && spliced.includes('HELLO WORLD.') && spliced.includes('skip me'));

    // ── code blocks must never be translated ─────────────────────────────────
    const mergedCodeMd = 'Para before code, no blank line:\n```python\nx = 1\nprint(x)\n```\nPara after code, no blank line.';
    const mergedCodeBlocks = splitParagraphs(mergedCodeMd);
    check(
      'fenced code split from adjacent prose (no blank lines)',
      mergedCodeBlocks.length === 2 &&
        mergedCodeBlocks[0].text === 'Para before code, no blank line:' &&
        mergedCodeBlocks[1].text === 'Para after code, no blank line.',
    );
    const mergedCodeSpliced = spliceParagraphs(mergedCodeMd, mergedCodeBlocks.map(b => ({ start: b.start, end: b.end })), ['[ZH] before', '[ZH] after']);
    check(
      'splice keeps merged fenced code verbatim',
      mergedCodeSpliced === '[ZH] before\n```python\nx = 1\nprint(x)\n```\n[ZH] after',
    );

    const blankFenceMd = 'Before.\n\n```\ncode\n```\n\nAfter.';
    const blankFenceBlocks = splitParagraphs(blankFenceMd);
    check('blank-line fenced code still skipped', blankFenceBlocks.length === 2 && blankFenceBlocks[0].text === 'Before.' && blankFenceBlocks[1].text === 'After.');

    const blankInsideMd = 'Code with blank line inside:\n```\nline1\n\nline2\n```\nAfter.';
    const blankInsideBlocks = splitParagraphs(blankInsideMd);
    check('fence with blank line inside stays one block', blankInsideBlocks.length === 2 && blankInsideBlocks[0].text === 'Code with blank line inside:' && blankInsideBlocks[1].text === 'After.');

    const tildeMd = 'Before.\n~~~\ncode\n~~~\nAfter.';
    const tildeBlocks = splitParagraphs(tildeMd);
    check('tilde fence skipped', tildeBlocks.length === 2 && tildeBlocks[0].text === 'Before.' && tildeBlocks[1].text === 'After.');

    const indentedMd = 'Text.\n\n    x = 1\n    print(x)\n\nMore text.';
    const indentedBlocks = splitParagraphs(indentedMd);
    check('indented code block skipped', indentedBlocks.length === 2 && indentedBlocks[0].text === 'Text.' && indentedBlocks[1].text === 'More text.');

    const nestedListMd = '    - sub item\n    - sub item 2';
    const nestedListBlocks = splitParagraphs(nestedListMd);
    check('indented list continuation still translatable', nestedListBlocks.length === 1 && nestedListBlocks[0].text.includes('- sub item'));

    // ── legacy arXiv listing artifacts must never be translated ─────────────
    const legacyListingMd =
      'Algorithm 1 ELF: training.\n\n' +
      '[⬇](data:text/plain;base64,xyz)\n\n' +
      'x \\= encode(s)\n\n' +
      '# comment line\n\n' +
      'Algorithm 2 ELF: inference.\n\n' +
      '[⬇](data:text/plain;base64,abc)\n\n' +
      'y \\= corrupt(x)\n\n' +
      'The core concepts of ELF are summarized in a long prose paragraph that definitely exceeds two hundred and fifty characters so the listing region ends here and the prose gets translated normally, continuing on for a while longer still, with additional sentences appended to guarantee the length check passes reliably for this regression test case.';
    const legacyListingBlocks = splitParagraphs(legacyListingMd);
    check(
      'legacy listing code lines skipped (captions + prose kept)',
      legacyListingBlocks.length === 3 &&
        legacyListingBlocks[0].text.includes('Algorithm 1') &&
        legacyListingBlocks[1].text.includes('Algorithm 2') &&
        legacyListingBlocks[2].text.includes('The core concepts'),
    );

    // ── ingestion: arXiv listings become fenced code blocks ─────────────────
    const listingHtml =
      '<main><section>' +
      '<figure class="ltx_figure"><div class="ltx_flex_figure"><div class="ltx_flex_cell">' +
      '<figure id="alg1" class="ltx_float ltx_figure_panel ltx_float_algorithm">' +
      '<figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_float">Algorithm 1</span> Train.<br class="ltx_break"><span>Note line.</span></figcaption>' +
      '<div class="ltx_listing ltx_lst_language_PythonFuncColor ltx_lstlisting">' +
      '<div class="ltx_listing_data"><a href="data:text/plain;base64,IyBjb21tZW50CnggPSAxCnlbaV0gPSAy" download="">⬇</a></div>' +
      '<div class="ltx_listingline"># comment</div>' +
      '<div class="ltx_listingline">x = 1</div>' +
      '</div></figure></div></div></figure>' +
      '<p>After paragraph.</p>' +
      '</section></main>';
    const listingMd = htmlToMarkdown(listingHtml);
    check(
      'html2md converts listings to fenced code (base64 decoded)',
      listingMd.includes('Algorithm 1 Train.') &&
        listingMd.includes('Note line.') &&
        listingMd.includes('```python\n# comment\nx = 1\ny[i] = 2\n```') &&
        !listingMd.includes('data:text/plain;base64') &&
        listingMd.includes('After paragraph.'),
    );
    const listingBlocks = splitParagraphs(listingMd);
    check('fenced listing is skipped by the splitter', listingBlocks.length === 2 && listingBlocks.every(b => !b.text.includes('# comment')));

    // ── ingestion: vector figures (<object data>) must survive ──────────────
    const objectHtml =
      '<main><figure class="ltx_figure">' +
      '<figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_figure">Figure X</span>: A plot.</figcaption>' +
      '<div class="ltx_block ltx_figure_panel"><object type="image/svg+xml" data="2605.10938v2/system_teaser.svg" width="229" height="87"></object></div>' +
      '</figure></main>';
    const objectMd = htmlToMarkdown(objectHtml);
    check(
      'html2md converts <object data> vector figures to markdown images',
      objectMd.includes('![Refer to caption](2605.10938v2/system_teaser.svg)') && objectMd.includes('Figure X: A plot.'),
    );

    const imgUrls = extractImageUrls('![a](https://x/a.png) and <img src="/rel/b.jpg"> and ![d](data:image/png;base64,xx)');
    check('extractImageUrls (skips data:)', imgUrls.length === 2);
    const rewritten = rewriteImageUrls('![a](rel/a.png)', new Map([['https://x/base/rel/a.png', '/local/a.png']]), 'https://x/base/');
    check('rewriteImageUrls resolves relative', rewritten.includes('/local/a.png'));
    const rewrittenFallback = rewriteImageUrls('![a](rel/a.png) ![b](miss/x.png) ![d](data:image/png;base64,xx)', new Map([['https://x/base/rel/a.png', '/local/a.png']]), 'https://x/base/');
    check(
      'rewriteImageUrls: unstored relative → absolute, data: untouched',
      rewrittenFallback.includes('/local/a.png') &&
        rewrittenFallback.includes('https://x/base/miss/x.png') &&
        rewrittenFallback.includes('data:image/png;base64,xx'),
    );

    const glossary = parseJsonObject('Here it is:\n```json\n{"attention": "注意力"}\n```');
    check('parseJsonObject strips fences', glossary?.attention === '注意力');

    // ── math protection: formulas must survive translation byte-for-byte ─────
    const mathMd = 'The loss is $L = \\sum_{i} (y_i - \\hat{y}_i)^2$ and the bound is $$\\|x\\|_2 \\le C$$ for <b>any</b> `input` here.';
    const protectedSpan = protectMath(mathMd);
    check('protectMath removes raw math from the protected text', !protectedSpan.protected.includes('\\sum') && !protectedSpan.protected.includes('$$') && !protectedSpan.protected.includes('<b>'));
    const restored = protectedSpan.restore(protectedSpan.protected);
    check('protectMath restore roundtrips exactly', restored === mathMd);
    // A "model" that translates prose but copies placeholders verbatim keeps formulas intact.
    const modelReply = protectedSpan.protected.replace('The loss is', '损失为').replace('and the bound is', '且上界为');
    const outAfterTranslate = protectedSpan.restore(modelReply);
    check('math survives a prose translation', outAfterTranslate.includes('$L = \\sum_{i} (y_i - \\hat{y}_i)^2$') && outAfterTranslate.includes('$$\\|x\\|_2 \\le C$$') && outAfterTranslate.includes('<b>any</b>') && outAfterTranslate.includes('`input`') && outAfterTranslate.startsWith('损失为'));
    // No math → protect is a no-op and restore is the identity.
    const noMath = protectMath('Just plain prose.');
    check('protectMath is identity when no spans', noMath.protected === 'Just plain prose.' && noMath.restore('Just plain prose.') === 'Just plain prose.');

    // ── e2e against a mock OpenAI-compatible server ─────────────────────────
    const mock = await startMockLlm();
    const provider = { baseUrl: mock.url, apiKey: 'sk-test', model: 'mock' };
    try {
      // Translation: full run (glossary + two paragraphs).
      const paperX = await papers.insert('2101.00001');
      const mdX = '# Title\n\nFirst paragraph.\n\n## Methods\n\nSecond paragraph.';
      await papers.finishReady(paperX.id, { title: 'X', authors: [], categories: [], abstract: null, published: null }, mdX);
      const jobX = await translations.createJob(paperX.id, 'zh-CN', provider);
      const claimedX = await translations.claimNextJob();
      assert.ok(claimedX, 'translation job claimed for e2e');
      await runTranslationJob(claimedX, mdX, { translations, provider, timeoutMs: 10000, maxAttempts: 3 });
      const snapX = await translations.findSnapshot(paperX.id, 'zh-CN');
      check(
        'translation e2e: snapshot completed with 2 paragraphs',
        snapX?.status === 'completed' &&
          snapX.paragraphs?.length === 2 &&
          snapX.paragraphs[0]?.startsWith('[ZH]') === true &&
          snapX.paragraphs[1]?.startsWith('[ZH]') === true,
      );
      check('translation e2e: glossary extracted', snapX?.glossary.transformer === '变换器');
      check('translation e2e: job completed', (await translations.jobStatus(jobX.id)) === 'completed');

      // Translation: resume only translates missing paragraphs.
      const paperY = await papers.insert('2101.00002');
      const mdY = '# T\n\nP1.\n\nP2.\n\nP3.';
      await papers.finishReady(paperY.id, { title: 'Y', authors: [], categories: [], abstract: null, published: null }, mdY);
      const jobY = await translations.createJob(paperY.id, 'en-US', provider);
      const claimedY = await translations.claimNextJob();
      assert.ok(claimedY, 'resume job claimed');
      const blocksY = splitParagraphs(mdY);
      const offsetsY = blocksY.map(b => ({ start: b.start, end: b.end }));
      await translations.startSnapshot(jobY.id, paperY.id, 'en-US', offsetsY);
      await translations.updateSnapshot({ jobId: jobY.id, paperId: paperY.id, targetLang: 'en-US', paragraphs: ['[EN] P1.', null, null], offsets: offsetsY, glossary: {}, model: 'mock' });
      const beforeResume = mock.requests.length;
      await runTranslationJob(claimedY, mdY, { translations, provider, timeoutMs: 10000, maxAttempts: 3 });
      const translatorCalls = mock.requests.slice(beforeResume).filter(r => String(r.body.messages?.[0]?.content ?? '').includes('academic-paper translator'));
      const snapY = await translations.findSnapshot(paperY.id, 'en-US');
      check('translation e2e: resume skips done paragraphs', translatorCalls.length === 2 && snapY?.status === 'completed' && snapY.paragraphs[0] === '[EN] P1.');

      // Translation: retryable failure → requeue with backoff; 3rd failure permanent.
      const deadProvider = { baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'x', model: 'mock' };
      const paperZ = await papers.insert('2101.00003');
      await papers.finishReady(paperZ.id, { title: 'Z', authors: [], categories: [], abstract: null, published: null }, '# T\n\nP1.');
      const jobZ = await translations.createJob(paperZ.id, 'zh-CN', deadProvider);
      await translations.claimNextJob();
      let zJob = await translations.findLatestJob(paperZ.id, 'zh-CN');
      assert.ok(zJob, 'job created');
      await failTranslationJob(zJob, new Error('connection refused'), { translations, provider: deadProvider, timeoutMs: 1000, maxAttempts: 3 });
      zJob = await translations.findLatestJob(paperZ.id, 'zh-CN');
      check('failed translation requeued with backoff', zJob?.status === 'pending' && zJob.attempts === 1 && Boolean(zJob.error));
      await sql`UPDATE paper.translation_jobs SET available_at = now() WHERE id = ${jobZ.id}`;
      zJob = (await translations.claimNextJob())!;
      await failTranslationJob(zJob, new Error('boom again'), { translations, provider: deadProvider, timeoutMs: 1000, maxAttempts: 3 });
      await sql`UPDATE paper.translation_jobs SET available_at = now() WHERE id = ${jobZ.id}`;
      zJob = (await translations.claimNextJob())!;
      await failTranslationJob(zJob, new Error('boom third'), { translations, provider: deadProvider, timeoutMs: 1000, maxAttempts: 3 });
      zJob = await translations.findLatestJob(paperZ.id, 'zh-CN');
      check('translation fails permanently after maxAttempts', zJob?.status === 'failed' && zJob?.attempts === 3);
    } finally {
      await mock.close();
    }

    // ── DSH-route translation (settings-driven model executed via ctx.llm) ──
    const dshProvider = { provider: 'mock', model: 'mock-1' };
    const paperD = await papers.insert('2101.00006');
    const mdD = '# T\n\nDSH paragraph one.\n\n## M\n\nDSH paragraph two.';
    await papers.finishReady(paperD.id, { title: 'D', authors: [], categories: [], abstract: null, published: null }, mdD);
    const jobD = await translations.createJob(paperD.id, 'zh-CN', dshProvider);
    const claimedD = await translations.claimNextJob();
    assert.ok(claimedD, 'DSH-route translation job claimed');
    await runTranslationJob(claimedD, mdD, { translations, provider: dshProvider, llm: fakeLlm, timeoutMs: 10000, maxAttempts: 3 });
    const snapD = await translations.findSnapshot(paperD.id, 'zh-CN');
    check(
      'DSH-route translation e2e (llm stream, reasoning deltas ignored)',
      snapD?.status === 'completed' &&
        snapD.paragraphs?.[0] === '[DSH] DSH paragraph one.' &&
        snapD.paragraphs?.[1] === '[DSH] DSH paragraph two.' &&
        snapD.glossary.transformer === '变换器',
    );

    const paperE = await papers.insert('2101.00007');
    await papers.finishReady(paperE.id, { title: 'E', authors: [], categories: [], abstract: null, published: null }, '# T\n\nP1.');
    const jobE = await translations.createJob(paperE.id, 'zh-CN', dshProvider);
    const claimedE = await translations.claimNextJob();
    assert.ok(claimedE, 'DSH-route job claimed (no llm case)');
    let fatal: unknown = null;
    try {
      await runTranslationJob(claimedE, '# T\n\nP1.', { translations, provider: dshProvider, llm: null, timeoutMs: 1000, maxAttempts: 3 });
    } catch (error) {
      fatal = error;
    }
    check('DSH-route job without llm service → fatal error', fatal instanceof TranslationFatalError);
    if (fatal) await failTranslationJob(claimedE, fatal, { translations, provider: dshProvider, llm: null, timeoutMs: 1000, maxAttempts: 3 });
    check('DSH-route fatal stays failed (no retry)', (await translations.findLatestJob(paperE.id, 'zh-CN'))?.status === 'failed');

    // ── settings: path change requires restart; disable gates again ─────────
    const movedRes = await call('POST', `${API}/settings`, { configured: true, dataDir: join(root, 'moved-db'), assetsDir: join(root, 'moved-assets') });
    const movedBody = JSON.parse(movedRes.body);
    check('changing dataDir while running → restartRequired', movedRes.statusCode === 200 && movedBody.restartRequired === true && host.state.restartRequired === true);
    const settingsAfterMove = await call('GET', `${API}/settings`);
    check('new path persisted to settings.json', JSON.parse(settingsAfterMove.body).settings.dataDir.endsWith('moved-db'));
    const stillServing = await call('GET', `${API}/health`);
    check('old runtime keeps serving until restart', stillServing.statusCode === 200 && JSON.parse(stillServing.body).status === 'ok');

    const disabled = await call('POST', `${API}/settings`, { configured: false });
    check('disable → 200 + host unconfigured', disabled.statusCode === 200 && JSON.parse(disabled.body).configured === false && host.state.configured === false);
    check('disable disposes runtime', host.active() === null);
    const gatedAgain = await call('GET', `${API}/papers`);
    check('business route gated again after disable', gatedAgain.statusCode === 423);

    // ── re-enable: fresh runtime on the same dataDir = persistence proof ────
    const reenabled = await call('POST', `${API}/settings`, { configured: true, dataDir: config.dataDir, assetsDir: config.assetsDir, port: 0, pollMs: config.pollMs, rescanIntervalMs: config.rescanIntervalMs });
    check('re-enable → 200', reenabled.statusCode === 200 && JSON.parse(reenabled.body).configured === true);
    const active2 = await host.ensureStarted();
    const sql2 = await active2.runtime.getSql();
    const count = await sql2<Array<{ n: number }>>`SELECT count(*)::int AS n FROM paper.papers`;
    check('re-enable persists data (8 papers)', count[0].n === 8);

    // ── dispose ──────────────────────────────────────────────────────────────
    active2.runtime.dispose();
    for (const dispose of disposers) dispose();
    await sleep(500);
    await assert.rejects(() => sql2`SELECT 1`);
    check('dispose closes socket + client + loops', true);

    // ── restart-persistence regression: the file OUR save wrote must load back
    // ── (a strict schema used to reject the persisted `version` key → every
    // ── dsh restart silently reset to defaults).
    const reloaded = loadSettingsFile();
    check(
      'settings.json survives restart (version tolerated, paths intact)',
      reloaded?.configured === true && reloaded.dataDir === config.dataDir && reloaded.workspaceDir === config.workspaceDir,
    );
  } finally {
    if (priorDshHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = priorDshHome;
    rmSync(root, { recursive: true, force: true });
  }

  console.log('\n== summary ==');
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('[paperspace.test] fatal:', error);
  process.exit(2);
});

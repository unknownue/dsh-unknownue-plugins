/**
 * Paperspace REST routes — a node:http port of vendor/paperspace
 * apps/api/src/server.ts (same zod schemas, status codes, error payloads).
 *
 * Mounts under /dsh-unknownue-plugins/paperspace/api, loopback-fenced like
 * every other route in this bundle:
 *
 *   GET  /health
 *   POST /papers                     { arxiv_id }
 *   GET  /papers?page&page_size&search&category
 *   GET  /papers/:ref                → PaperDetail
 *   DELETE /papers/:ref              → cascade + object-store cleanup
 *   GET  /papers/:ref/assets         → asset metadata
 *   GET  /papers/:ref/assets/:assetId → stream bytes from the object store
 *   POST /papers/:ref/translate-paper { target_lang } (model = settings translateModel)
 *   GET  /papers/:ref/translation?lang=
 *   GET  /papers/:ref/translation-job?lang=
 *   DELETE /papers/:ref/translation?lang=
 *   DELETE /papers/:ref/translation-job?lang=
 *   POST /sessions { arxiv_id }       → link a DSH session to the paper
 *                                      (conversation itself lives in DSH)
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { isLoopback, isLoopbackHost, json, messageOf, readBody } from '../makefile';
import { ensurePaperMarkdown, removePaperMarkdown } from './dsh-integration';
import { createAssetRepo, createPaperRepo, createTranslationRepo } from './domain/index';
import { createSessionLinkRepo } from './domain/session-links';
import type { PaperRow, AssetRow } from './domain/types';
import type { TranslationJobRow, TranslationSnapshotRow, TranslationProviderConfig } from './domain/translations';
import { settingsInputSchema } from './settings';
import { listDshModelDirectory } from './worker/translate';
import {
  isArxivId,
  type PaperDetail,
  type PaperSummary,
  type TranslationJob,
  type TranslationLanguage,
  type TranslationWithJob,
} from './shared';
import type { PaperspaceHost, WebServerFace } from './types';

export const PAPERS_API = '/dsh-unknownue-plugins/paperspace/api';
export const PAPERS_FONTS = '/dsh-unknownue-plugins/paperspace/static/fonts';

const FONT_TYPES: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

/** Lazily resolve the KaTeX fonts directory (npm package, external at build). */
function katexFontsDir(): string {
  const require = createRequire(import.meta.url);
  let root: string;
  try {
    root = dirname(require.resolve('katex/package.json'));
  } catch {
    // `exports` may block package.json; katex's main is dist/katex.js.
    root = dirname(dirname(require.resolve('katex')));
  }
  return join(root, 'dist', 'fonts');
}

// ── zod schemas (copied from paperspace server.ts) ─────────────────────────

const refSchema = z.object({ paperRef: z.string().min(1).max(64) });
const assetParamsSchema = z.object({ paperRef: z.string().min(1).max(64), assetId: z.string().uuid() });
const arxivSchema = z.object({ arxiv_id: z.string().refine(isArxivId, 'Expected arXiv YYMM.NNNNN[vN]') }).strict();
const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  category: z.string().max(80).optional(),
});
const translateLang = z.enum(['zh-CN', 'en-US', 'ja-JP']);
const translateInput = z.object({ target_lang: translateLang }).strict();
const translationQuery = z.object({ lang: translateLang.default('zh-CN') });

// ── DTO converters (copied from paperspace server.ts) ──────────────────────

function meta(paper: PaperRow) {
  return (paper.metadata ?? {}) as { title?: string; authors?: string[]; abstract?: string; categories?: string[]; published?: string };
}

function toSummary(paper: PaperRow): PaperSummary {
  const m = meta(paper);
  return {
    id: paper.id,
    arxivId: paper.arxivId,
    title: m.title ?? paper.arxivId,
    authors: m.authors ?? [],
    categories: m.categories ?? [],
    publishedAt: m.published ?? undefined,
    abstract: m.abstract ?? undefined,
    status: paper.status,
    errorMessage: paper.errorMessage ?? undefined,
  };
}

function toDetail(paper: PaperRow): PaperDetail {
  return { ...toSummary(paper), abstract: meta(paper).abstract ?? '', markdown: paper.markdown ?? '' };
}

function toAsset(row: AssetRow) {
  return {
    id: row.id,
    paperId: row.paperId,
    originalUrl: row.originalUrl,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  };
}

function toJob(row: TranslationJobRow): TranslationJob {
  return {
    id: row.id,
    paperId: row.paperId,
    targetLang: row.targetLang as TranslationLanguage,
    status: row.status,
    progress: row.progress,
    total: row.total,
    attempts: row.attempts,
    startedAt: row.startedAt?.toISOString() ?? null,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    // Redacted: the persisted api key never leaves the API.
    provider: row.provider
      ? 'provider' in row.provider
        ? { provider: row.provider.provider, model: row.provider.model }
        : { baseUrl: row.provider.baseUrl, model: row.provider.model }
      : null,
  };
}

function toSnapshot(row: TranslationSnapshotRow): Omit<TranslationWithJob, 'job'> {
  return {
    paperId: row.paperId,
    targetLang: row.targetLang as TranslationLanguage,
    paragraphs: row.paragraphs,
    offsets: row.offsets,
    glossary: row.glossary,
    status: row.status,
    model: row.model,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── route registration ─────────────────────────────────────────────────────

export function registerRoutes(webServer: WebServerFace, host: PaperspaceHost, getLlm?: () => unknown): void {
  const wrap =
    (handler: (req: IncomingMessage, res: ServerResponse) => unknown | Promise<unknown>) =>
    async (req: IncomingMessage, res: ServerResponse) => {
      if (!isLoopback(req.socket.remoteAddress) || !isLoopbackHost(req.headers.host)) {
        json(res, 403, { code: 'FORBIDDEN', message: 'loopback-only' });
        return;
      }
      try {
        await handler(req, res);
      } catch (error) {
        if (error instanceof z.ZodError) {
          json(res, 400, { code: 'VALIDATION_ERROR', message: error.issues.map(i => i.message).join('; ') });
          return;
        }
        if (!res.headersSent) {
          json(res, 500, { code: 'INTERNAL_ERROR', message: messageOf(error) });
        }
      }
    };

  webServer.register({
    kind: 'exact',
    path: `${PAPERS_API}/health`,
    handler: wrap(async (_req, res) => {
      if (!host.state.configured) return json(res, 200, { status: 'not-configured' });
      const { runtime } = await host.ensureStarted();
      const sql = await runtime.getSql();
      await sql`select 1`;
      json(res, 200, { status: 'ok', worker: host.workerSnapshot?.() ?? null });
    }),
  });

  // DSH model directory: what the settings page offers for the translation
  // model. Available BEFORE configuration (the picker needs it to configure).
  webServer.register({
    kind: 'exact',
    path: `${PAPERS_API}/models`,
    handler: wrap(async (_req, res) => {
      json(res, 200, await listDshModelDirectory(getLlm?.()));
    }),
  });

  // Settings endpoints are available BEFORE configuration (that is the point).
  webServer.register({
    kind: 'exact',
    path: `${PAPERS_API}/settings`,
    handler: wrap(async (req, res) => {
      if (req.method === 'GET') {
        return json(res, 200, {
          configured: host.state.configured,
          restartRequired: host.state.restartRequired,
          settingsPath: host.state.settingsPath,
          defaults: host.row,
          settings: host.file(),
        });
      }
      if (req.method === 'POST') {
        const input = settingsInputSchema.parse(await readBody(req));
        const result = await host.save(input);
        if (!result.ok) return json(res, 400, { code: 'SETTINGS_INVALID', message: result.error });
        return json(res, 200, result);
      }
      return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
    }),
  });

  // Link a DSH session to a paper: conversation itself lives in DSH, this
  // endpoint only materializes the paper and records the binding.
  webServer.register({
    kind: 'prefix',
    path: `${PAPERS_API}/sessions`,
    handler: wrap(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const rest = url.pathname.slice(`${PAPERS_API}/sessions`.length).replace(/^\//, '').split('/').filter(Boolean);
      if (!host.state.configured) {
        return json(res, 423, {
          code: 'PAPERSPACE_NOT_CONFIGURED',
          message: 'Paperspace is not configured yet. Open the 论文 tab or DSH Settings → UnPlugin → Paperspace and set the storage location.',
        });
      }
      const { runtime, config } = await host.ensureStarted();
      const sql = await runtime.getSql();

      // GET /sessions/:sessionId → which paper (if any) this session links to.
      if (rest.length === 1 && req.method === 'GET') {
        const link = await createSessionLinkRepo(sql).findBySession(rest[0]);
        if (!link) return json(res, 404, { code: 'SESSION_NOT_LINKED', message: 'This session is not linked to a paper' });
        const paper = await createPaperRepo(sql).findByRef(link.arxivId);
        if (!paper) return json(res, 404, { code: 'PAPER_NOT_FOUND', message: 'Paper not found' });
        const meta = (paper.metadata ?? {}) as { title?: string };
        return json(res, 200, { sessionId: rest[0], arxivId: link.arxivId, title: meta.title ?? link.arxivId, status: paper.status });
      }

      // POST /sessions { arxiv_id } → materialize the paper into the shared
      // workspace; the client then registers the workspace and creates the
      // session through DSH's own services (ctx.workspaces).
      if (rest.length === 0 && req.method === 'POST') {
        const input = z.object({ arxiv_id: z.string().refine(isArxivId, 'Expected arXiv YYMM.NNNNN[vN]') }).strict().parse(await readBody(req));
        const paper = await createPaperRepo(sql).findByRef(input.arxiv_id);
        if (!paper) return json(res, 404, { code: 'PAPER_NOT_FOUND', message: 'Paper not found' });
        if (paper.status !== 'ready') return json(res, 409, { code: 'PAPER_NOT_READY', message: 'Paper is still ingesting or failed; wait for it to be ready' });
        const mdFile = await ensurePaperMarkdown(sql, config.workspaceDir, input.arxiv_id);
        return json(res, 200, { workspaceDir: config.workspaceDir, arxivId: input.arxiv_id, mdFile });
      }

      // POST /sessions/link { session_id, arxiv_id } → record the binding
      // (called after DSH created the session through its own flow).
      if (rest.length === 1 && rest[0] === 'link' && req.method === 'POST') {
        const input = z
          .object({ session_id: z.string().min(1).max(200), arxiv_id: z.string().refine(isArxivId, 'Expected arXiv YYMM.NNNNN[vN]') })
          .strict()
          .parse(await readBody(req));
        const paper = await createPaperRepo(sql).findByRef(input.arxiv_id);
        if (!paper) return json(res, 404, { code: 'PAPER_NOT_FOUND', message: 'Paper not found' });
        await createSessionLinkRepo(sql).link(input.session_id, input.arxiv_id);
        const meta = (paper.metadata ?? {}) as { title?: string };
        await host.renameSession?.(input.session_id, meta.title ?? input.arxiv_id);
        await host.refreshPaperContexts?.();
        return json(res, 200, { ok: true, sessionId: input.session_id, arxivId: input.arxiv_id });
      }

      return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
    }),
  });

  // Diagnostics: paperspace integration state (link rows + injection flags).
  webServer.register({
    kind: 'exact',
    path: `${PAPERS_API}/debug`,
    handler: wrap(async (req, res) => {
      if (req.method !== 'GET') return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
      const debug = host.debug?.() ?? {};
      let links: Array<{ sessionId: string; arxivId: string; createdAt: string }> = [];
      try {
        const active = host.active();
        if (active) {
          const sql = await active.runtime.getSql();
          links = await sql<Array<{ sessionId: string; arxivId: string; createdAt: string }>>`
            SELECT session_id, arxiv_id, created_at FROM paper.paper_sessions ORDER BY created_at DESC LIMIT 20`;
        }
      } catch {
        /* leave links empty */
      }
      return json(res, 200, { ...debug, links });
    }),
  });

  // KaTeX font assets for the browser half (static, no secrets → no fence).
  webServer.register({
    kind: 'prefix',
    path: PAPERS_FONTS,
    handler: (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const name = url.pathname.slice(PAPERS_FONTS.length).replace(/^\//, '');
      if (!/^[\w.-]+\.(woff2|woff|ttf|otf)$/i.test(name)) return json(res, 404, { code: 'NOT_FOUND', message: 'not found' });
      let stats;
      let file;
      try {
        file = join(katexFontsDir(), name);
        stats = statSync(file);
      } catch {
        return json(res, 404, { code: 'NOT_FOUND', message: 'not found' });
      }
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      res.writeHead(200, {
        'content-type': FONT_TYPES[ext] ?? 'application/octet-stream',
        'content-length': String(stats.size),
        'cache-control': 'public, max-age=31536000, immutable',
      });
      const stream = createReadStream(file);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
      return new Promise<void>(resolve => {
        res.once('close', resolve);
        res.once('error', resolve);
      });
    },
  });

  webServer.register({
    kind: 'prefix',
    path: `${PAPERS_API}/papers`,
    handler: wrap(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const rest = url.pathname.slice(`${PAPERS_API}/papers`.length).replace(/^\//, '').split('/').filter(Boolean);
      if (!host.state.configured) {
        return json(res, 423, {
          code: 'PAPERSPACE_NOT_CONFIGURED',
          message: 'Paperspace is not configured yet. Open the 论文 tab or DSH Settings → UnPlugin → Paperspace and set the storage location.',
        });
      }
      const { runtime, store, config } = await host.ensureStarted();
      const sql = await runtime.getSql();
      const papers = createPaperRepo(sql);

      // ── collection ─────────────────────────────────────────────────────────
      if (rest.length === 0) {
        if (req.method === 'POST') {
          const input = arxivSchema.parse(await readBody(req));
          const existing = await papers.findByRef(input.arxiv_id);
          if (existing) {
            if (existing.status === 'failed') {
              await papers.requeue(existing.id);
              return json(res, 202, toSummary({ ...existing, status: 'ingesting' as const, errorMessage: null }));
            }
            return json(res, 200, toSummary(existing));
          }
          const row = await papers.insert(input.arxiv_id);
          return json(res, 202, toSummary(row));
        }
        if (req.method === 'GET') {
          const query = listQuerySchema.parse(Object.fromEntries(url.searchParams));
          const { items, total } = await papers.list({ page: query.page, pageSize: query.page_size, search: query.search, category: query.category });
          return json(res, 200, { items: items.map(toSummary), page: query.page, page_size: query.page_size, total });
        }
        return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
      }

      const paperRef = refSchema.parse({ paperRef: rest[0] }).paperRef;
      const paper = await papers.findByRef(paperRef);
      const paper404 = () => json(res, 404, { code: 'PAPER_NOT_FOUND', message: 'Paper not found' });
      // Multi-segment actions (`chat/stream`) arrive as several path segments.
      const action = rest.slice(1).join('/');

      // ── /papers/:ref ───────────────────────────────────────────────────────
      if (rest.length === 1) {
        if (req.method === 'GET') {
          if (!paper) return paper404();
          return json(res, 200, toDetail(paper));
        }
        if (req.method === 'DELETE') {
          if (!paper) return paper404();
          const assets = createAssetRepo(sql);
          const keys = await assets.keysByPaper(paper.id);
          try {
            await store.deleteObjects(keys);
          } catch (error) {
            console.warn(`[paperspace] object cleanup failed for ${paper.arxivId}: ${messageOf(error)}`);
          }
          await papers.deleteById(paper.id);
          try {
            await removePaperMarkdown(config.workspaceDir, paper.arxivId);
          } catch (error) {
            console.warn(`[paperspace] workspace md cleanup failed for ${paper.arxivId}: ${messageOf(error)}`);
          }
          await host.refreshPaperContexts?.();
          return res.writeHead(204).end();
        }
        return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
      }

      // ── /papers/:ref/assets[...] ───────────────────────────────────────────
      if (action === 'assets') {
        if (!paper) return paper404();
        const assets = createAssetRepo(sql);
        if (req.method !== 'GET') return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
        const rows = await assets.listByPaper(paper.id);
        return json(res, 200, { items: rows.map(toAsset) });
      }
      if (action.startsWith('assets/') && rest.length === 3) {
        if (!paper) return paper404();
        if (req.method !== 'GET') return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
        const { assetId } = assetParamsSchema.parse({ paperRef, assetId: rest[2] });
        const assets = createAssetRepo(sql);
        const asset = await assets.findByPaperAndId(paper.id, assetId);
        if (!asset) return json(res, 404, { code: 'ASSET_NOT_FOUND', message: 'Asset not found' });
        let stream;
        try {
          stream = await store.getObject(asset.objectKey);
        } catch {
          return json(res, 404, { code: 'ASSET_NOT_FOUND', message: 'Asset not found in storage' });
        }
        res.writeHead(200, {
          'content-type': asset.contentType,
          'content-length': String(asset.sizeBytes),
          'cache-control': 'public, max-age=86400',
        });
        return new Promise<void>((resolve, reject) => {
          stream.on('error', reject);
          stream.pipe(res);
          res.on('close', resolve);
        });
      }

      // ── /papers/:ref/translate-paper ───────────────────────────────────────
      if (action === 'translate-paper' && rest.length === 2) {
        if (req.method !== 'POST') return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
        if (!paper) return paper404();
        if (paper.status !== 'ready') return json(res, 409, { code: 'PAPER_NOT_READY', message: 'Translation requires a ready paper' });
        const { target_lang } = translateInput.parse(await readBody(req));
        // The model comes from the settings-persisted selection (a DSH route
        // + model id chosen from the currently-available directory).
        const selection = host.file()?.translateModel ?? null;
        if (!selection) {
          return json(res, 400, {
            code: 'MODEL_NOT_CONFIGURED',
            message: '尚未指定翻译模型：请在 DSH 设置 → UnPlugin → Paperspace 中选择翻译模型后重试。',
          });
        }
        const directory = await listDshModelDirectory(getLlm?.());
        if (directory.available && !directory.groups.some(group => group.id === selection.provider)) {
          return json(res, 400, {
            code: 'MODEL_UNAVAILABLE',
            message: `翻译模型提供商 ${selection.provider} 当前不可用，请在 DSH 设置中重新选择。`,
          });
        }
        const persisted: TranslationProviderConfig = { provider: selection.provider, model: selection.model };
        const translations = createTranslationRepo(sql);
        const job = await translations.createJob(paper.id, target_lang, persisted);
        return json(res, 202, { job: toJob(job) });
      }

      // ── /papers/:ref/translation ───────────────────────────────────────────
      if (action === 'translation' && rest.length === 2) {
        if (!paper) return paper404();
        const { lang } = translationQuery.parse(Object.fromEntries(url.searchParams));
        const translations = createTranslationRepo(sql);
        if (req.method === 'GET') {
          const snapshot = await translations.findSnapshot(paper.id, lang);
          if (!snapshot) return json(res, 404, { code: 'TRANSLATION_NOT_FOUND', message: 'No translation for this language yet' });
          const job = await translations.findLatestJob(paper.id, lang);
          const body: TranslationWithJob = { ...toSnapshot(snapshot), job: job ? toJob(job) : null };
          return json(res, 200, body);
        }
        if (req.method === 'DELETE') {
          await translations.deleteSnapshot(paper.id, lang);
          return res.writeHead(204).end();
        }
        return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
      }

      // ── /papers/:ref/translation-job ───────────────────────────────────────
      if (action === 'translation-job' && rest.length === 2) {
        if (!paper) return paper404();
        const { lang } = translationQuery.parse(Object.fromEntries(url.searchParams));
        const translations = createTranslationRepo(sql);
        if (req.method === 'GET') {
          const job = await translations.findLatestJob(paper.id, lang);
          if (!job) return json(res, 404, { code: 'TRANSLATION_JOB_NOT_FOUND', message: 'No translation job for this language' });
          return json(res, 200, { job: toJob(job) });
        }
        if (req.method === 'DELETE') {
          const cancelled = await translations.cancelActiveJob(paper.id, lang);
          if (!cancelled) return json(res, 404, { code: 'TRANSLATION_JOB_NOT_ACTIVE', message: 'No running translation job to cancel' });
          return res.writeHead(204).end();
        }
        return json(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'method not allowed' });
      }

      return json(res, 404, { code: 'NOT_FOUND', message: 'route not found' });
    }),
  });
}

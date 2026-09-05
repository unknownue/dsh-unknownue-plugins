/**
 * dsh-unknownue-plugins/paperspace — host plugin (subpath row).
 *
 * In-process academic paper reader ported from vendor/paperspace:
 * PGlite (WASM PostgreSQL) + local filesystem object store, NO Docker,
 * NO MinIO. All storage handles and worker loops live inside DSH's cordis
 * lifecycle (ctx.effect disposal); routes mount on the shared ctx.webServer.
 *
 * Gating: the user must configure storage in the DSH Settings page (or the
 * tab's setup screen) before use. Until `configured: true` is persisted to
 * `<dsh home>/paperspace/settings.json`, business routes answer 423
 * PAPERSPACE_NOT_CONFIGURED and the worker stays dormant.
 */
import { createPaperspaceRuntime } from './db';
import {
  paperTextForScope,
  registerPaperTools,
  type DshAgentsFace,
  type DshServices,
  type ToolRegistryFace,
} from './dsh-integration';
import { FileObjectStore } from './filestore';
import { registerRoutes } from './routes';
import {
  applySettingsInput,
  loadSettingsFile,
  paperspaceSettingsPath,
  resolveConfig,
  saveSettingsFile,
} from './settings';
import { startWorker, type WorkerLiveness } from './worker/loops';
import type {
  PaperspaceActive,
  PaperspaceConfig,
  PaperspaceHost,
  PaperspaceHostContext,
  PaperspaceState,
  PartialPaperspaceConfig,
} from './types';

const name = 'dsh-unknownue-plugins/paperspace';
const inject = ['webServer'];

export { resolveConfig, paperspaceSettingsPath } from './settings';
export type { PaperspaceActive, PaperspaceHost, PaperspaceState } from './types';

export function apply(ctx: PaperspaceHostContext, config: PartialPaperspaceConfig = {}): void {
  const row = resolveConfig(config);
  let file = loadSettingsFile();
  let active: PaperspaceActive | null = null;
  let worker: WorkerLiveness | null = null;

  const state: PaperspaceState = {
    configured: file?.configured === true,
    restartRequired: false,
    settingsPath: paperspaceSettingsPath(),
  };

  // Feature-detect DSH services LAZILY: they may be assembled after this row
  // (dsh-workspace-enhancement's proven pattern is call-time `ctx.get(name, false)`),
  // so capture-at-apply time is wrong. The getters resolve on every access.
  const service = (name: string): unknown => {
    try {
      const direct = typeof ctx.get === 'function' ? ctx.get(name, false) : undefined;
      if (direct !== undefined) return direct;
    } catch {
      /* fall through to root lookup */
    }
    try {
      const root = (ctx as unknown as { root?: { get?(n: string, o?: boolean): unknown } }).root;
      if (root && typeof root.get === 'function') return root.get(name, false);
    } catch {
      /* leave undefined */
    }
    return undefined;
  };
  // Model-facing paper context via the OFFICIAL registry API. A SECTION
  // (dsh-tool-cordis's own pattern) is rendered into the system prompt itself
  // — more robust than a dynamic context, which can be dropped when runtime
  // context snapshots are disabled. The provider resolves synchronously
  // against a sessionId→paper-text cache (SQL is async, providers are not).
  const paperContextCache = new Map<string, string>();
  const providerStats = { calls: 0, scopePresent: 0, agents: 0, matched: 0, lastSessionIds: [] as string[] };
  let contextProviderRegistered = false;
  let contextHitLogged = false;
  const ensureContextProvider = (): void => {
    if (contextProviderRegistered) return;
    const systemPrompt = service('systemPrompt') as {
      section?: (spec: { name: string; order: number; text: string | ((assemble: { scope?: unknown }) => string) }) => unknown;
    } | undefined;
    if (!systemPrompt || typeof systemPrompt.section !== 'function') return;
    contextProviderRegistered = true;
    systemPrompt.section({
      name: 'paperspace:current-paper',
      order: 120,
      text: (assembleContext) => {
        providerStats.calls++;
        const scope = assembleContext?.scope;
        if (scope !== undefined && scope !== null) providerStats.scopePresent++;
        const agents = service('agents') as DshAgentsFace | undefined;
        const list = agents?.list() ?? [];
        providerStats.agents = list.length;
        providerStats.lastSessionIds = list.map(agent => agent.id ?? '').slice(0, 12);
        const text = paperTextForScope(scope, paperContextCache);
        if (text) {
          providerStats.matched++;
          if (!contextHitLogged) {
            contextHitLogged = true;
            console.log('[paperspace] paper context injected for first assembly');
          }
        }
        return text;
      },
    });
    console.log('[paperspace] system-prompt paper section attached');
  };

  const refreshPaperContexts = async (): Promise<void> => {
    try {
      if (!active) return;
      const sql = await active.runtime.getSql();
      const rows = await sql<Array<{ sessionId: string; arxivId: string; metadata: unknown }>>`
        SELECT s.session_id, p.arxiv_id, p.metadata
        FROM paper.paper_sessions s
        JOIN paper.papers p ON p.arxiv_id = s.arxiv_id`;
      paperContextCache.clear();
      for (const row of rows) {
        const meta = (row.metadata ?? {}) as { title?: string; categories?: string[] };
        const title = meta.title ?? row.arxivId;
        const categories = (meta.categories ?? []).join(', ');
        paperContextCache.set(row.sessionId, [
          `Current paper: “${title}” (arXiv:${row.arxivId}${categories ? ', categories: ' + categories : ''}).`,
          `Ground your answers in THIS paper: call search_paper for passages or read_section for a whole section, or read papers/${row.arxivId}.md with file tools. If the user asks about a different paper, ask them to link it first.`,
        ].join(' '));
      }
    } catch (error) {
      console.warn('[paperspace] paper context cache refresh failed:', error);
    }
  };
  ensureContextProvider();

  const dsh: DshServices = {
    get tools() {
      return service('tools') as ToolRegistryFace | undefined;
    },
  };

  // Tool registration is idempotent and retried until the DSH tools service
  // shows up (apply-time may be too early depending on row order).
  let toolsRegistered = false;
  const ensureToolsRegistered = (): void => {
    if (toolsRegistered) return;
    ensureContextProvider();
    registerPaperTools(
      dsh.tools,
      () => host.ensureStarted().then(activeResult => activeResult.runtime.getSql()),
    );
    toolsRegistered = true;
  };

  const host: PaperspaceHost = {
    state,
    row,
    dsh,
    file: () => file,
    active: () => active,
    refreshPaperContexts: () => refreshPaperContexts(),
    renameSession: async (sessionId, title) => {
      try {
        const store = service('sessions') as { get?: (id: string) => unknown } | undefined;
        const session = store?.get?.(sessionId);
        const titleService = service('sessionTitle') as { rename?: (session: unknown, raw: string) => unknown } | undefined;
        if (!session || typeof titleService?.rename !== 'function') return;
        titleService.rename(session, title.slice(0, 120));
      } catch (error) {
        console.warn('[paperspace] session title rename failed:', error);
      }
    },
    debug: () => ({
      configured: state.configured,
      toolsRegistered,
      contextProviderRegistered,
      systemPromptFound: service('systemPrompt') !== undefined,
      agentsFound: service('agents') !== undefined,
      contextCacheKeys: Array.from(paperContextCache.keys()),
      providerStats: { ...providerStats },
    }),
    workerSnapshot: () => worker?.snapshot() ?? null,
    async ensureStarted() {
      if (!file?.configured) throw new Error('paperspace is not configured yet; save settings first');
      if (active) return active;
      const effective = resolveConfig(config, file);
      const runtime = createPaperspaceRuntime(effective);
      const store = new FileObjectStore(effective.assetsDir);
      active = { config: effective, runtime, store };
      await runtime.ready; // migrations + pgwire socket bound
      worker = startWorker(ctx, runtime, store, effective, () => service('llm'));
      ensureToolsRegistered();
      ensureContextProvider();
      await refreshPaperContexts();
      return active;
    },
    async save(input) {
      try {
        const next = applySettingsInput(input, file, config);
        await saveSettingsFile(next);
        file = next;
        state.configured = next.configured;
        state.restartRequired = false;
        if (!next.configured) {
          paperContextCache.clear();
          if (active) {
            active.runtime.dispose();
            active = null;
          }
          return { ok: true, configured: false, restartRequired: false };
        }
        if (!active) {
          await this.ensureStarted();
          return { ok: true, configured: true, restartRequired: false };
        }
        // Runtime already up: any effective change needs a restart (worker
        // loops and PGlite boot captured their config at start).
        const effective = resolveConfig(config, next);
        const keys = Object.keys(effective) as Array<keyof PaperspaceConfig>;
        const changed = keys.some(key => effective[key] !== active!.config[key]);
        state.restartRequired = changed;
        return { ok: true, configured: true, restartRequired: changed };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };

  ctx.effect(
    () => () => {
      active?.runtime.dispose();
      active = null;
      paperContextCache.clear();
    },
    'dsh-unknownue-plugins/paperspace: runtime dispose',
  );

  registerRoutes(ctx.webServer, host, () => service('llm'));

  // Real DSH tools: grounded in whichever session called them (exec.agent →
  // paper_sessions → paper). Registered lazily (retried on runtime start when
  // the tools service was not assembled yet at apply time).
  ensureToolsRegistered();

  if (typeof ctx.provide === 'function') {
    ctx.provide('paperspace', host);
  }
}

export { inject, name };

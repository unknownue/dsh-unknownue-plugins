/**
 * dsh-unknownue-plugins/tasks — host plugin (subpath row).
 *
 * Personal, user-maintained task board on an in-process PGlite database.
 * No agent surface: no model-facing tools, no session-log events, no dispatch.
 * The database location is configurable (cordis.patch.yml seed → settings.json
 * → defaults) and the PGlite instance is owned by the cordis lifecycle.
 *
 * The runtime boots lazily on the first route hit; changing the database
 * location while running is persisted but flagged `restartRequired`.
 */
import { createTasksRuntime, type TasksRuntime } from './db';
import { registerRoutes, type TasksHost } from './routes';
import { loadSettingsFile, normalizePath, resolveConfig, saveSettingsFile, tasksSettingsPath } from './settings';
import type { PartialTasksConfig, TasksConfig, TasksHostContext, TasksSettingsFile, TasksSettingsInput } from './types';

const name = 'dsh-unknownue-plugins/tasks';
const inject = ['webServer'];

export { TASKS_API } from './routes';
export { resolveConfig, tasksSettingsPath } from './settings';

export function apply(ctx: TasksHostContext, config: PartialTasksConfig = {}): void {
  const row = resolveConfig(config);
  let file = loadSettingsFile();
  const state = { restartRequired: false, settingsPath: tasksSettingsPath() };

  let runtimePromise: Promise<TasksRuntime> | null = null;
  const ensureStarted = (): Promise<TasksRuntime> => {
    if (runtimePromise === null) {
      const effective: TasksConfig = {
        dataDir: file?.dataDir ?? row.dataDir,
        initialMemoryBytes: row.initialMemoryBytes,
      };
      const runtime = createTasksRuntime(effective);
      runtimePromise = runtime.ready.then(
        () => runtime,
        error => {
          runtimePromise = null; // failed boot is retryable
          throw error;
        },
      );
    }
    return runtimePromise;
  };

  const host: TasksHost = {
    ensureStarted,
    state,
    row,
    file: () => file,
    async save(input: TasksSettingsInput) {
      try {
        const dataDir = normalizePath(input.dataDir);
        const nextFile: TasksSettingsFile = { version: 1, dataDir };
        await saveSettingsFile(nextFile);
        const previous = file?.dataDir ?? row.dataDir;
        const changed = previous !== dataDir;
        file = nextFile;
        state.restartRequired = changed;
        return { ok: true, restartRequired: changed };
      } catch (error) {
        return { ok: false, restartRequired: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };

  ctx.effect(
    () => () => {
      const pending = runtimePromise;
      runtimePromise = null;
      if (pending !== null) void pending.then(runtime => runtime.dispose()).catch(() => undefined);
    },
    'dsh-unknownue-plugins/tasks: runtime dispose',
  );

  registerRoutes(ctx.webServer, host);
}

export { inject, name };

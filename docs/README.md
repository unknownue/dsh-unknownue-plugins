# Documentation

The [README](../README.md) is the entry point and stays deliberately short; the
details live here.

## Map

| Document | Answers |
| --- | --- |
| [features/toolbar-actions.md](features/toolbar-actions.md) | Makefile panel, content width, open terminal |
| [features/file-explorer.md](features/file-explorer.md) | the `Files` tab: tree, editor, markdown preview, file operations, remote workspaces, limits |
| [features/paperspace.md](features/paperspace.md) | the `Papers` tab and right-Sidebar pane: library, reader, translation, architecture, operations |
| [features/tasks.md](features/tasks.md) | the `Tasks` tab: board, list, archived browser, due dates, tags, subtasks, data layer |
| [integrations.md](integrations.md) | companion plugins (SSH remote workspaces, remote access) and the DSH seams each feature consumes |
| [reference/configuration.md](reference/configuration.md) | every row key, settings file, environment variable and browser preference |
| [reference/http-api.md](reference/http-api.md) | every loopback HTTP route this bundle registers |
| [development.md](development.md) | package layout, build pipeline, typecheck, tests, adding a feature, packaging |

## Quick paths

- **Installing or upgrading** — [README](../README.md#install) and
  [development.md](development.md#install-and-upgrade-workflow).
- **First run of paperspace** — [features/paperspace.md](features/paperspace.md#configuration-and-storage).
- **Something stopped working after a DSH upgrade** — check the seams table in
  [integrations.md](integrations.md#dsh-seams-this-bundle-relies-on), then run the
  harness described in [development.md](development.md#verification-harness).
- **Adding a feature** — [development.md](development.md#adding-a-feature).

## Conventions used here

- **The code is the source of truth.** Every route path, config key, default
  value and limit in these pages was read from `src/` at the time of writing; when
  code and prose disagree, the code wins.
- **UI surfaces are named by their English labels** (`Files`, `Tasks`, `Papers`,
  `UnPlugin`). The UI ships English and Chinese dictionaries from
  `src/client/i18n.ts`, `src/client/paperspace/index.tsx` and
  `src/client/tasks/index.tsx`; the English labels are used throughout these
  pages so that names stay unambiguous.
- **Commands run from the repository root** unless stated otherwise.
- **`lib/` is build output.** Rebuilt artifacts are committed; read the `src/`
  file named in each section instead of a `lib/` bundle.

# Third-party notices

`dsh-unknownue-plugins` is MIT-licensed. Two features bundle or port
third-party code whose licenses require attribution: the paperspace reader
(embedded paper reader, third-party npm packages) and the file explorer (a
ported UI). Sources are resolved from npm at install time; this file lists the
notable ones.

| Package | Version (range) | License | Notes |
|---|---|---|---|
| `@electric-sql/pglite` | ^0.5.8 | Apache-2.0 | PostgreSQL compiled to WebAssembly; retains PostgreSQL's PostgreSQL License lineage. |
| `@electric-sql/pglite-socket` | ^0.2.11 | Apache-2.0 | pgwire TCP server for PGlite. |
| `postgres` (postgres.js) | ^3.4.9 | Unlicense | PostgreSQL wire-protocol client. |
| `katex` | ^0.16.47 | MIT | Math rendering; fonts served by the host route. |
| `react-markdown` / `remark-*` / `rehype-*` | v10 / v4 / v6-7 | MIT | Markdown → math pipeline. |
| `zod` | ^3.25 | MIT | API validation schemas. |
| `cheerio`, `turndown`, `turndown-plugin-gfm`, `fast-xml-parser` | see package.json | MIT | arXiv HTML ingestion. |
| `github-slugger` | ^2.0 | ISC | TOC heading slugs. |
| `marked` | ^15.0 | MIT | Existing explorer markdown preview. |

The upstream paperspace sources ported into this bundle were original work of
the paperspace project; the reader UI's paperspace stylesheet and React
components are ported with structural changes only (routing/fetch/scope).

## File explorer (ported UI)

| Source | License | Notes |
|---|---|---|
| [oneirictouch/dsh-explorer-editor](https://github.com/oneirictouch/dsh-explorer-editor) | MIT | The VS Code-style explorer/editor UI under `src/client/explorer/` and `src/client/editor/` (file tree, editor tabs, markdown preview, theme panel) is ported from this project, with routing/fetch rewired onto this bundle's loopback host routes. The host half (`src/host/explorer.ts`), the HTTP adapter and the remote-workspace routing are original to this bundle. Monaco is loaded at runtime from a public CDN (see `src/client/editor/monaco.ts`), not vendored. |

Full license texts ship inside each installed package's `LICENSE` file.

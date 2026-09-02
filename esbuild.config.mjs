import { build } from "esbuild";

// Build one face (or both) of the bundle:
//   node esbuild.config.mjs            → client + host
//   node esbuild.config.mjs client     → client only
//   node esbuild.config.mjs host       → host only

const target = process.argv[2] ?? "all";
const want = (face) => target === "all" || target === face;

// ── browser half ────────────────────────────────────────────────────────────
// DSH client modules use window.__ModuleLoader__.load({ id, factory }).
// The factory receives `require` and must return `module.exports`.
// React is provided by the host module loader, NOT bundled.

if (want("client")) {
  const preamble = `window.__ModuleLoader__.load({
  id: "dsh-unknownue-plugins",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
`;

  const epilogue = `
    return module.exports;
  }
});
`;

  /**
   * Scope a flat CSS file under one container class so paperspace's generic
   * selectors (.button, .dialog, …) never collide with DSH's global styles.
   * Whitespace and comments are preserved verbatim; @keyframes passes
   * through untouched; @media blocks are recursed.
   */
  function scopeCss(css, scope) {
    let out = '';
    let i = 0;
    const n = css.length;
    // Skip whitespace/comments, copying them to the output as-is.
    const skipTrivia = from => {
      let k = from;
      while (k < n) {
        if (css[k] === '/' && css[k + 1] === '*') {
          const endComment = css.indexOf('*/', k + 2);
          out += css.slice(k, endComment < 0 ? n : endComment + 2);
          k = endComment < 0 ? n : endComment + 2;
          continue;
        }
        if (/\s/.test(css[k])) {
          out += css[k];
          k++;
          continue;
        }
        break;
      }
      return k;
    };
    while (i < n) {
      i = skipTrivia(i);
      if (i >= n) break;
      if (css[i] === '@') {
        const open = css.indexOf('{', i);
        if (open < 0) {
          out += css.slice(i);
          break;
        }
        let depth = 0;
        let j = open;
        for (; j < n; j++) {
          if (css[j] === '{') depth++;
          else if (css[j] === '}') {
            depth--;
            if (depth === 0) break;
          }
        }
        const end = j + 1;
        const head = css.slice(i, open).trim();
        if (head.startsWith('@media')) {
          out += head + ' {' + scopeCss(css.slice(open + 1, end - 1), scope) + '}';
        } else {
          out += css.slice(i, end); // @keyframes and friends verbatim
        }
        i = end;
        continue;
      }
      const open = css.indexOf('{', i);
      if (open < 0) {
        out += css.slice(i);
        break;
      }
      const sel = css.slice(i, open).trim();
      let depth = 0;
      let j = open;
      for (; j < n; j++) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      const end = j + 1;
      const body = css.slice(open + 1, end - 1);
      const scoped = sel
        .split(',')
        .map(part => `${scope} ${part.trim()}`)
        .join(',\n');
      out += scoped + ' {' + body + '}';
      i = end;
    }
    return out;
  }

  // CSS-as-text plugin: paperspace styles are scoped under `.dsh-paperspace`;
  // KaTeX CSS has its font URLs rewritten to the host's static fonts route.
  const cssTextPlugin = {
    name: 'dsh-unknownue-plugins-css-text',
    setup(build) {
      build.onLoad({ filter: /paperspace[\\/]styles\.css$/, namespace: 'file' }, async args => {
        const { readFile } = await import('node:fs/promises');
        const css = await readFile(args.path, 'utf8');
        return { contents: 'export default ' + JSON.stringify(scopeCss(css, '.dsh-paperspace')) + ';', loader: 'js' };
      });
      build.onLoad({ filter: /katex\.min\.css$/, namespace: 'file' }, async args => {
        const { readFile } = await import('node:fs/promises');
        const css = (await readFile(args.path, 'utf8')).replace(/url\(fonts\//g, 'url(/dsh-unknownue-plugins/paperspace/static/fonts/');
        return { contents: 'export default ' + JSON.stringify(css) + ';', loader: 'js' };
      });
    },
  };

  await build({
    entryPoints: ["src/client/index.tsx"],
    bundle: true,
    format: "cjs",
    outfile: "lib/client.js",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "react",
    plugins: [cssTextPlugin],
    loader: {
      ".css": "text",
    },
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    banner: {
      js: preamble,
    },
    footer: {
      js: epilogue,
    },
    // React is provided by the DSH host module loader
    external: ["react", "react/jsx-runtime"],
    minify: false,
    sourcemap: false,
  });

  console.log("✓ Built lib/client.js from TypeScript sources");
}

// ── host half ───────────────────────────────────────────────────────────────
// One ESM entry per feature module, emitted to lib/ alongside the client
// bundle. Imports between entry points stay external (index.js imports
// makefile.js / explorer.js / platform.js exactly as the hand-written files
// did), so the runtime module graph is unchanged.

if (want("host")) {
  await build({
    entryPoints: [
      "src/host/index.ts",
      "src/host/makefile.ts",
      "src/host/platform.ts",
      "src/host/explorer.ts",
      "src/host/explorer.test.ts",
      "src/host/paperspace/index.ts",
      "src/host/paperspace/paperspace.test.ts",
      "src/host/tasks/index.ts",
      "src/host/tasks/tasks.test.ts",
    ],
    outdir: "lib",
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    // npm packages stay external so their own runtime asset resolution
    // (PGlite WASM/data files, postgres.js) keeps working at runtime.
    packages: "external",
    // Keep imports between feature modules as-is (index.js imports
    // ./makefile.js / ./explorer.js / ./platform.js at runtime, exactly like
    // the hand-written files did), instead of inlining everything into the
    // entry that happens to import it.
    external: ["./*.js"],
    minify: false,
    sourcemap: false,
  });

  console.log("✓ Built host modules (index, makefile, platform, explorer, explorer.test, paperspace, paperspace.test, tasks, tasks.test)");
}

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

  await build({
    entryPoints: ["src/client/index.tsx"],
    bundle: true,
    format: "cjs",
    outfile: "lib/client.js",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "react",
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
    ],
    outdir: "lib",
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    // Keep imports between feature modules as-is (index.js imports
    // ./makefile.js / ./explorer.js / ./platform.js at runtime, exactly like
    // the hand-written files did), instead of inlining everything into the
    // entry that happens to import it.
    external: ["./*.js"],
    minify: false,
    sourcemap: false,
  });

  console.log("✓ Built host modules (lib/index.js, makefile.js, platform.js, explorer.js, explorer.test.js)");
}

import { build } from "esbuild";

// DSH client modules use window.__ModuleLoader__.load({ id, factory }).
// The factory receives `require` and must return `module.exports`.
// React is provided by the host module loader, NOT bundled.

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

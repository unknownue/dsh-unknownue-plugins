/**
 * Headless smoke test for the paperspace right-Sidebar wiring (a script-style
 * harness: no test framework, run it by hand from the repository root).
 *
 *   npm run build && node scripts/verify-sidebar.mjs
 *
 * The working directory must be the repository root — the harness resolves the
 * built bundle and the package manifest relative to `process.cwd()`.
 *
 * React is not a dependency of this package — the DSH host provides it at
 * runtime — so the harness borrows react/react-dom/server from an installed
 * profile (DSH_PROFILE overrides the default `~/.dsh/profiles/web/package.json`).
 *
 * It does three things no `tsc` pass can:
 *   1. materializes the BUILT client bundle exactly as DSH's module table does
 *      (`window.__ModuleLoader__.load({ id, factory })` + `factory(require)`)
 *      and runs the plugin's own `apply(ctx)` against a recording stub context,
 *      asserting the tab type, the guide entry, both keyed seats, the optional
 *      service waits, and the controller binding;
 *   2. renders the built registration's BODY component (react-dom/server) and
 *      intercepts the props it hands the view: navigation params → route in,
 *      navigate → tab params out, plus the hosting-surface attribute;
 *   3. bundles `src/client/paperspace/sidebar-link.ts` on the fly and drives the
 *      controller facade (behind the 在侧栏打开 buttons) in all three states:
 *      no controller, accepting controller, throwing controller.
 *
 * Re-run it after a DSH upgrade: it is the cheapest way to learn that the right
 * Sidebar's service names, slot keys, or tab-type contract moved.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const PLUGIN = process.cwd();
const PROFILE = process.env.DSH_PROFILE ?? join(homedir(), '.dsh', 'profiles', 'web', 'package.json');
const profileRequire = createRequire(PROFILE);
const React = profileRequire('react');
const jsxRuntime = profileRequire('react/jsx-runtime');
const { renderToStaticMarkup } = profileRequire('react-dom/server');
const pluginRequire = createRequire(`file:///${process.cwd().replace(/\\/g, '/')}/package.json`);
const esbuild = pluginRequire('esbuild');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === '' ? '' : '  — ' + detail}`);
  if (!ok) failures += 1;
};

// ── 1. materialize the built bundle and run apply(ctx) ──────────────────────

// The bundle carries browser-only code at module scope (markdown's named
// character references touch `document.createElement`), so the harness needs a
// minimal DOM facade. Its own code guards such access with `typeof document`,
// so no DOM behaviour is relied on here beyond "an element exists".
const fakeElement = () => ({
  style: {},
  dataset: {},
  classList: { add: () => {}, remove: () => {}, contains: () => false },
  setAttribute: () => {},
  appendChild: () => {},
  removeChild: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  innerHTML: '',
  textContent: '',
});
globalThis.document = {
  createElement: fakeElement,
  querySelector: () => null,
  querySelectorAll: () => [],
  head: fakeElement(),
  body: fakeElement(),
};
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
/** A real (Map-backed) session storage: the resume memory mirrors itself into one. */
const storage = new Map();
globalThis.sessionStorage = {
  getItem: key => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
const LAST_PAPER_KEY = 'dsh-unknownue-plugins/paperspace:sidebar-paper';
globalThis.DOMParser = class {
  parseFromString() {
    return fakeElement();
  }
};
globalThis.XMLSerializer = class {
  serializeToString() {
    return '';
  }
};
globalThis.Node = class {};
globalThis.Element = class {};
globalThis.HTMLElement = class {};
globalThis.getComputedStyle = () => ({ overflowY: 'visible', backgroundColor: '', background: '' });
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0) && 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};

let registration;
globalThis.window = {
  __ModuleLoader__: {
    load: value => {
      registration = value;
    },
  },
};
const bundle = readFileSync(join(PLUGIN, 'lib/client.js'), 'utf8');
// eslint-disable-next-line no-new-func
new Function('window', bundle)(globalThis.window);
check('bundle registers itself with the module loader', registration !== undefined);
check('module id', registration?.id === 'dsh-unknownue-plugins');

const created = [];
const reactShim = new Proxy(React, {
  get: (target, property) => {
    if (property === 'createElement') {
      return (...args) => {
        created.push(args);
        return React.createElement(...args);
      };
    }
    return target[property];
  },
});

/**
 * Materialize the built bundle and run its apply(ctx) against a recording stub
 * context. One materialization is one page load: the tab-type registry, the
 * controller binding, and the resume memory are module state, so the cases that
 * need a clean slate call this again instead of sharing mutations.
 * @returns the recording context plus the materialized module.
 */
const materialize = () => {
  const recorded = { types: [], registrations: [], injectDeps: [], effects: [], openTabs: [] };
  const slots = {
    inject: (name, factory) => {
      const dispose = factory();
      return typeof dispose === 'function' ? dispose : () => {};
    },
    register: (options, component) => {
      recorded.registrations.push({ options, component });
      return () => {};
    },
    entries: () => [],
    subscribe: () => () => {},
  };
  const services = {
    slots,
    locale: { register: () => () => {}, bind: () => key => key },
    sessions: { open: () => {}, create: async () => 's1', list: { getSnapshot: () => ({}), subscribe: () => () => {} } },
    workspaces: { create: async () => ({ workspaceId: 'w1', path: '/tmp' }), list: { getSnapshot: () => ({ items: [] }) } },
    sidebarRightTabs: {
      register: definition => {
        recorded.types.push(definition);
        return () => {};
      },
    },
    sidebarRight: {
      openTab: (kind, options) => {
        recorded.openTabs.push({ kind, options });
      },
    },
  };
  const ctx = {
    ...services,
    effect: (callback, label) => {
      const dispose = callback();
      recorded.effects.push(label);
      return typeof dispose === 'function' ? dispose : () => {};
    },
    provide: () => () => {},
    get: name => services[name],
    inject: (deps, callback) => {
      recorded.injectDeps.push(deps.join(','));
      const scope = { ...ctx };
      for (const dep of deps) scope[dep] = services[dep];
      callback(scope);
      return { dispose: () => {} };
    },
  };
  const module = registration.factory(spec => {
    if (spec === 'react') return reactShim;
    if (spec === 'react/jsx-runtime') return jsxRuntime;
    throw new Error('unexpected require: ' + spec);
  });
  module.apply(ctx);
  return { ...recorded, module };
};

const plugin = materialize();
check('client half exports apply + inject', typeof plugin.module.apply === 'function' && Array.isArray(plugin.module.inject));

const type = plugin.types[0];
check('registers exactly one tab type', plugin.types.length === 1);
check('tab kind', type?.kind === 'paperspace', type?.kind);
check('tab id', type?.id === 'dsh-unknownue-plugins/paperspace', type?.id);
check('builtin band (a page type, no resource address)', type?.priority === 'builtin' && type?.patterns === undefined);
check('chip title reads the namespace', type?.title('sidebar://paperspace') === 'sidebar.title', type?.title('sidebar://paperspace'));
const entry = type?.guide?.[0];
check('guide entry after 文件 (order 20)', entry?.order === 20, String(entry?.order));
check('guide entry copy + glyph', entry?.title() === 'sidebar.guide.title' && entry?.description() === 'sidebar.guide.description' && typeof entry?.icon === 'function');

const body = plugin.registrations.find(r => r.options.name === 'sidebar.right.pane.tab');
const title = plugin.registrations.find(r => r.options.name === 'sidebar.right.pane.tab.title');
check('body seat registered under the type id', body?.options.key === type.id, String(body?.options.key));
check('title seat registered under the type id', title?.options.key === type.id, String(title?.options.key));
check('body is a component', typeof body?.component === 'function');
check(
  'optional services are waited for, not required',
  plugin.injectDeps.includes('slots,sidebarRightTabs') && plugin.injectDeps.includes('sidebarRight'),
  plugin.injectDeps.join(' | '),
);
check(
  'controller binding has a disposer effect',
  plugin.effects.includes('dsh-paperspace: sidebar controller binding'),
);
check(
  'the body records the paper it shows (the resume memory)',
  plugin.module !== undefined && readFileSync(join(PLUGIN, 'lib/client.js'), 'utf8').includes('rememberSidebarPaper('),
);

// ── 2. the body's route contract (the tab's navigation IS the route) ────────

// The body hands PaperspaceView its route and its navigate callback, and those
// two props ARE the contract DSH's tab navigation is wired through. Intercepting
// React.createElement reads them off the real built component (SSR alone cannot:
// the view paints its loading state until the settings fetch resolves, and
// effects do not run outside the browser).

const renderBody = (recorded, params) => {
  const bodySeat = recorded.registrations.find(r => r.options.name === 'sidebar.right.pane.tab');
  const tab = {
    id: 'tab-1',
    kind: 'paperspace',
    contentId: 'sidebar://paperspace',
    navigation: { address: 'sidebar://paperspace', params, revision: 1 },
    actions: { openTab: (kind, options) => recorded.openTabs.push({ kind, options }) },
  };
  created.length = 0;
  const html = renderToStaticMarkup(
    React.createElement(bodySeat.component, { useTabInfo: () => ({ tab }), sessionId: 'session-1' }),
  );
  const viewProps = created.find(
    args => args[1] !== null && typeof args[1] === 'object' && 'surface' in args[1] && 'route' in args[1],
  )?.[1];
  // The chip title resolves the same route, so it is read the same way.
  const titleSeat = recorded.registrations.find(r => r.options.name === 'sidebar.right.pane.tab.title');
  const chip = renderToStaticMarkup(
    React.createElement(titleSeat.component, { useTabInfo: () => ({ tab }), sessionId: 'session-1' }),
  );
  return { html, viewProps, chip };
};

// A paper was open in the Sidebar before, and the guide page is the opening now
// (the entry box re-records the tab with NO params). It must come back to that
// paper, not to the library, and the memory has to survive the tab being
// closed — which is why it is mirrored into sessionStorage.
storage.set('dsh-unknownue-plugins/paperspace:sidebar-paper', '1706.03762');
const resumed = materialize();
const resumedBody = renderBody(resumed, undefined);
check(
  'params-less open (the guide pick) resumes the paper that was open',
  resumedBody.viewProps?.route?.kind === 'reader' && resumedBody.viewProps?.route?.arxivId === '1706.03762',
  JSON.stringify(resumedBody.viewProps?.route),
);
check('the resumed view drives the sidebar surface', resumedBody.viewProps?.surface === 'sidebar');
check('the resumed view is NOT the tab surface', !resumedBody.html.includes('data-ps-surface="view"'));
check('the chip names the resumed paper', resumedBody.chip.includes('1706.03762'), resumedBody.chip);

// An EXPLICIT empty params object — the reader's back link — still means the
// library, memory or not.
const back = renderBody(resumed, {});
check('the back link still means the library', JSON.stringify(back.viewProps?.route) === '{"kind":"list"}', JSON.stringify(back.viewProps?.route));

// A named paper always wins over the memory.
const named = renderBody(resumed, { arxivId: '2501.12948' });
check(
  'a paper named in the params wins over the memory',
  named.viewProps?.route?.arxivId === '2501.12948',
  JSON.stringify(named.viewProps?.route),
);

// Nothing was ever open (fresh page load, empty storage) → the library.
storage.clear();
const empty = materialize();
const first = renderBody(empty, undefined);
check('nothing remembered → the library', JSON.stringify(first.viewProps?.route) === '{"kind":"list"}', JSON.stringify(first.viewProps?.route));
check('the library surface renders', first.html.includes('dsh-paperspace') && first.html.includes('data-ps-surface="sidebar"'));

// …and the write direction: the view's navigation becomes the tab's params.
empty.openTabs.length = 0;
first.viewProps.navigate({ kind: 'reader', arxivId: '2501.12948' });
check(
  'navigating to a paper writes it into the tab params',
  empty.openTabs.length === 1 && empty.openTabs[0].kind === 'paperspace' && empty.openTabs[0].options?.params?.arxivId === '2501.12948',
  JSON.stringify(empty.openTabs),
);
resumed.openTabs.length = 0;
named.viewProps.navigate({ kind: 'list' });
check(
  'going back clears the params (the library route)',
  resumed.openTabs.length === 1 && JSON.stringify(resumed.openTabs[0].options?.params) === '{}',
  JSON.stringify(resumed.openTabs),
);

// ── 3. the controller facade + the resume memory, as source modules ─────────

const dir = mkdtempSync(join(tmpdir(), 'ps-sidebar-'));
const entryPath = join(dir, 'entry.ts');
const outPath = join(dir, 'out.mjs');
writeFileSync(
  entryPath,
  [
    `import {
  openPaperInSidebar,
  setSidebarRight,
  rememberSidebarPaper,
  readSidebarPaper,
  forgetSidebarPaper,
  PAPERS_SIDEBAR_KIND,
  PAPERS_SIDEBAR_ID,
} from ${JSON.stringify(join(PLUGIN, 'src/client/paperspace/sidebar-link.ts').replace(/\\/g, '/'))};`,
    'const out = [];',
    'out.push([PAPERS_SIDEBAR_KIND, PAPERS_SIDEBAR_ID]);',
    // the 在侧栏打开 facade: unbound → bound → throwing → unbound again
    'out.push([openPaperInSidebar("1706.03762"), "unbound"]);',
    'const calls = [];',
    'setSidebarRight({ openTab: (kind, options) => calls.push([kind, options]) });',
    'out.push([openPaperInSidebar("1706.03762"), "bound"]);',
    'out.push(calls);',
    'setSidebarRight({ openTab: () => { throw new Error("no mounted seat"); } });',
    'out.push([openPaperInSidebar("1706.03762"), "thrower"]);',
    'setSidebarRight(undefined);',
    'out.push([openPaperInSidebar("1706.03762"), "unbound-again"]);',
    // the resume memory: pristine → remembered (module + mirror) → forgotten
    'out.push([readSidebarPaper(), "pristine"]);',
    'rememberSidebarPaper("2501.12948");',
    'out.push([readSidebarPaper(), localStorage.getItem("dsh-unknownue-plugins/paperspace:sidebar-paper")]);',
    'rememberSidebarPaper("1706.03762");',
    'forgetSidebarPaper("2501.12948");',
    'out.push([readSidebarPaper(), "forget-other"]);',
    'forgetSidebarPaper("1706.03762");',
    'out.push([readSidebarPaper(), localStorage.getItem("dsh-unknownue-plugins/paperspace:sidebar-paper")]);',
    'console.log(JSON.stringify(out));',
  ].join('\n'),
);
await esbuild.build({
  entryPoints: [entryPath],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: outPath,
  alias: { react: PROFILE.replace(/package\.json$/, 'node_modules/react') },
  external: [],
});
const { execFileSync } = await import('node:child_process');
// The memory mirrors itself into sessionStorage; the bundled source runs in a
// child process, so give it one that records what the module writes.
const runner = [
  "import { pathToFileURL } from 'node:url';",
  'const memory = new Map();',
  'globalThis.sessionStorage = {',
  '  getItem: key => (memory.has(key) ? memory.get(key) : null),',
  '  setItem: (key, value) => memory.set(key, String(value)),',
  '  removeItem: key => memory.delete(key),',
  '};',
  'globalThis.localStorage = globalThis.sessionStorage;',
  `await import(pathToFileURL(${JSON.stringify(outPath)}).href);`,
].join('\n');
const runnerPath = join(dir, 'runner.mjs');
writeFileSync(runnerPath, runner);
const result = JSON.parse(execFileSync(process.execPath, [runnerPath], { encoding: 'utf8' }).trim());
const [kind, id] = result[0];
check('facade shares the kind + id with the registration', kind === 'paperspace' && id === 'dsh-unknownue-plugins/paperspace', `${kind} / ${id}`);
check('no controller → the call is refused, not thrown', result[1][0] === false);
check('bound controller → navigation accepted', result[2][0] === true);
check(
  'the paper rides in navigation params',
  result[3][0]?.[0] === 'paperspace' && result[3][0]?.[1]?.params?.arxivId === '1706.03762',
  JSON.stringify(result[3]),
);
check('no mounted seat → refused, with a warning instead of a crash', result[4][0] === false);
check('unbind clears the facade', result[5][0] === false);
check('nothing remembered → null', result[6][0] === null, JSON.stringify(result[6]));
check('the memory survives a reload through its sessionStorage mirror', result[7][0] === '2501.12948' && result[7][1] === '2501.12948', JSON.stringify(result[7]));
check('forgetting another paper is a no-op', result[8][0] === '1706.03762', JSON.stringify(result[8]));
check('forgetting the remembered paper clears module state AND the mirror', result[9][0] === null && result[9][1] === null, JSON.stringify(result[9]));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

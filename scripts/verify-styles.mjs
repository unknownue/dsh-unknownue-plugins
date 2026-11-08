/**
 * Headless regression harness for injected-stylesheet ownership (script-style
 * harness: no test framework, run it by hand from the repository root).
 *
 *   npm run build:client && node scripts/verify-styles.mjs
 *
 * The working directory must be the repository root — the harness resolves the
 * built bundle and the package manifest relative to `process.cwd()`.
 *
 * What it guards
 * --------------
 * DSH's client module system maintains HMR bookkeeping over `<style>` tags by
 * attribute, not by closure (see `@deepseek-ai/dsh-client-modules`, browser
 * half):
 *
 *   claimStyles(id, before)  untagged tags a factory injects DURING its own
 *                            materialization  → stamp data-plugin=<that id>
 *   removeOwnedStyles(id)    style[data-plugin=<id>] → remove
 *
 * The rule moved between DSH lines: 0.1.x adopted every untagged tag present when
 * the next plugin materialized; 0.2.x narrowed `claimStyles` to the pre/post
 * delta, so a PRE-EXISTING untagged sheet is left alone (and never cleaned up).
 * Either way an untagged sheet is not a stable choice: on 0.1.x it was adopted and
 * deleted with that plugin, on 0.2.x it survives reloads and a re-applied bundle
 * duplicates it. Tagging every sheet keeps `removeOwnedStyles(id)` pairing
 * correct, so a reloaded bundle refreshes its tags in place.
 *
 * The visible symptom when the shared sheet is lost is an unstyled
 * content-width slider row (`.dmw-width*` rules gone).
 *
 * The harness does what a `tsc` pass cannot:
 *   1. materializes the BUILT client bundle exactly as DSH's module table does
 *      (`window.__ModuleLoader__.load({ id, factory })` + `factory(require)`),
 *      runs the plugin's own `apply(ctx)` against a recording stub context, and
 *      inventories every `<style>` it injected;
 *   2. drives the REAL `dsh-client-modules` browser half over a two-entry boot
 *      graph and shows the shipped ownership sequence: a pre-existing untagged
 *      sheet is not adopted, a factory-injected one is claimed and removed with
 *      its plugin, and the plugin's own tags survive that reload;
 *   3. re-runs `apply` to prove a second activation does not duplicate sheets.
 *
 * Re-run it after a DSH upgrade: the adoption rule lives in the module system,
 * not in this repository.
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PLUGIN = process.cwd();
const PLUGIN_ID = 'dsh-unknownue-plugins';
const PROFILE = process.env.DSH_PROFILE ?? join(homedir(), '.dsh', 'profiles', 'web', 'package.json');
const profileRequire = createRequire(PROFILE);
const pluginRequire = createRequire(`file:///${PLUGIN.replace(/\\/g, '/')}/package.json`);

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === '' ? '' : '  — ' + detail}`);
  if (!ok) failures += 1;
};
const kebab = value => String(value).replace(/[A-Z]/g, m => '-' + m.toLowerCase());

// ── a small DOM that actually behaves like one ──────────────────────────────
//
// The module system selects style tags by attribute, and the plugin creates,
// tags and re-finds its own tags, so the facade has to be a working document
// rather than the no-op `querySelector: () => null` the sidebar harness needs.

const styles = []; // document order, the way querySelectorAll walks it

const attributeMatches = (element, body) => {
  const eq = body.indexOf('=');
  if (eq < 0) return element.getAttribute(body) !== null;
  const name = body.slice(0, eq);
  let value = body.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return element.getAttribute(name) === value;
};

/** Supports the only selector shapes DSH's bookkeeping and this plugin use. */
const matches = (element, selector) => {
  if (!selector.startsWith('style')) throw new Error(`fake DOM: unsupported selector ${selector}`);
  if (element.tagName !== 'style') return false;
  let rest = selector.slice('style'.length);
  while (rest.length > 0) {
    if (rest.startsWith(':not([data-plugin])')) {
      if (element.getAttribute('data-plugin') !== null) return false;
      rest = rest.slice(':not([data-plugin])'.length);
      continue;
    }
    const bracket = /^\[([^\]\[]+)\]/.exec(rest);
    if (bracket === null) throw new Error(`fake DOM: unsupported selector ${selector}`);
    if (!attributeMatches(element, bracket[1])) return false;
    rest = rest.slice(bracket[0].length);
  }
  return true;
};

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.attributes = new Map();
    this.textContent = '';
    this.children = [];
    this.style = {};
    this.classList = { add: () => {}, remove: () => {}, contains: () => false };
    this.dataset = new Proxy({}, {
      get: (_, key) => this.getAttribute(`data-${kebab(key)}`),
      set: (_, key, value) => {
        this.setAttribute(`data-${kebab(key)}`, value);
        return true;
      },
    });
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  remove() {
    const at = styles.indexOf(this);
    if (at >= 0) styles.splice(at, 1);
    this.removed = true;
  }

  appendChild(child) {
    this.children.push(child);
    if (this.tagName === 'head') styles.push(child);
    return child;
  }

  append(child) {
    return this.appendChild(child);
  }
}

const fakeElement = tagName => new FakeElement(tagName);

globalThis.document = {
  createElement: fakeElement,
  querySelector: selector => styles.find(element => matches(element, selector)) ?? null,
  querySelectorAll: selector => styles.filter(element => matches(element, selector)),
  head: new FakeElement('head'),
  body: new FakeElement('body'),
};
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const storage = new Map();
globalThis.sessionStorage = {
  getItem: key => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
globalThis.DOMParser = class { parseFromString() { return fakeElement('div'); } };
globalThis.XMLSerializer = class { serializeToString() { return ''; } };
globalThis.Node = class {};
globalThis.Element = class {};
globalThis.HTMLElement = class {};
globalThis.getComputedStyle = () => ({ overflowY: 'visible', backgroundColor: '', background: '' });
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0) && 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.ResizeObserver = class { observe() {} disconnect() {} };

// One loader facade serves every bundle the harness evaluates; DSH's own client
// half registers through it too.
const registrations = new Map();
globalThis.window = {
  __ModuleLoader__: {
    load: value => {
      registrations.set(value.id, value);
    },
  },
};

const loadBundle = (path) => {
  const before = registrations.size;
  // eslint-disable-next-line no-new-func
  new Function('window', readFileSync(path, 'utf8'))(globalThis.window);
  const added = [...registrations.keys()].slice(before);
  if (added.length !== 1) throw new Error(`fake loader: ${path} registered ${added.length} modules`);
  return registrations.get(added[0]);
};

// ── 1. materialize the built plugin bundle and inventory its stylesheets ────

const pluginRegistration = loadBundle(join(PLUGIN, 'lib', 'client.js'));
check('bundle registers itself with the module loader', pluginRegistration !== undefined);
check('module id', pluginRegistration.id === PLUGIN_ID, pluginRegistration?.id);

const React = profileRequire('react');
const jsxRuntime = profileRequire('react/jsx-runtime');

const makeContext = () => {
  const recorded = { effects: [], registrations: [], injectDeps: [] };
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
    sidebarRightTabs: { register: () => () => {} },
    sidebarRight: { openTab: () => {} },
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
  return { ctx, recorded };
};

const materialize = () => {
  const { ctx, recorded } = makeContext();
  const module = pluginRegistration.factory(spec => {
    if (spec === 'react') return React;
    if (spec === 'react/jsx-runtime') return jsxRuntime;
    throw new Error('unexpected require: ' + spec);
  });
  module.apply(ctx);
  return { module, recorded };
};

styles.length = 0;
const built = materialize();
const injected = [...styles];
const pluginTagOf = element => element.getAttribute('data-plugin');
const tagged = element => pluginTagOf(element) === PLUGIN_ID;

const labelOf = element =>
  element.getAttribute('data-plugin-css') ?? (element.getAttribute('data-dsh-unknownue-styles') !== null ? 'dsh-unknownue-plugins/styles.css' : '(anonymous)');
check('apply injected stylesheets', injected.length > 0, `${injected.length} tag(s): ${injected.map(labelOf).join(', ')}`);
check(
  'every injected stylesheet carries data-plugin',
  injected.every(tagged),
  injected.map(element => pluginTagOf(element) ?? '(untagged)').join(', '),
);
const mainSheet = injected.find(element => element.getAttribute('data-dsh-unknownue-styles') !== null);
check('the shared sheet exists', mainSheet !== undefined);
check(
  'the shared sheet still carries the width-block rules it must protect',
  mainSheet?.textContent.includes('.dmw-width{display:flex'),
);
const widthOverride = injected.find(element => element.hasAttribute('data-width-override'));
check('the width override tag is owned too', widthOverride !== undefined && tagged(widthOverride));

// A code reload of THIS plugin: DSH removes the tags it owns, re-executes the
// bundle (fresh module state) and applies again. The sheets must come back, with
// the same content, still owned — one copy each, no pile-up.
const removeOwned = () => {
  for (const element of [...styles]) if (tagged(element)) element.remove();
};

// A second activation of the SAME instance must refresh, not duplicate.
const beforeReApply = [...styles];
built.module.apply(makeContext().ctx);
const addedByReApply = styles.filter(element => !beforeReApply.includes(element));
check(
  're-applying the same instance refreshes in place',
  addedByReApply.length === 0,
  `${beforeReApply.length} → ${styles.length}${addedByReApply.length === 0 ? '' : ' (new: ' + addedByReApply.map(labelOf).join(', ') + ')'}`,
);

removeOwned();
materialize();
const afterReload = [...styles];
check(
  'a plugin reload re-injects exactly the same set of sheets',
  afterReload.length === injected.length,
  `${injected.length} → ${afterReload.length}`,
);
check(
  'the re-injected sheets are owned again',
  afterReload.every(tagged),
  afterReload.map(element => pluginTagOf(element) ?? '(untagged)').join(', '),
);
check(
  'the reloaded bundle keeps the width-block rules',
  afterReload.some(element => element.textContent.includes('.dmw-width{display:flex')),
);

// The live tags after the reload — what the module-system section below checks
// for survival while an unrelated plugin is reloaded.
const liveMainSheet = afterReload.find(element => element.getAttribute('data-dsh-unknownue-styles') !== null);
const liveWidthOverride = afterReload.find(element => element.hasAttribute('data-width-override'));

// ── 2. drive DSH's REAL module system over an adopt-then-reload sequence ────

/**
 * Resolve the browser half of DSH's client module system from the installed
 * profile: the HMR adoption rule lives there, not in this repository, so the
 * harness has to run the shipped file rather than a copy of the rule.
 * @returns the resolved path, or undefined when this profile/bundle does not ship it.
 */
const resolveDshClientModules = () => {
  const candidates = ['@deepseek-ai/dsh-client-modules/client', '@deepseek-ai/dsh-client-modules/lib/client.js'];
  for (const specifier of candidates) {
    try {
      return profileRequire.resolve(specifier);
    } catch {}
  }
  const profileDir = PROFILE.replace(/[\\/]package\.json$/, '');
  const onDisk = [
    join(profileDir, 'node_modules', '@deepseek-ai', 'dsh-client-modules', 'lib', 'client.js'),
    join(profileDir, '..', 'node_modules', '@deepseek-ai', 'dsh-client-modules', 'lib', 'client.js'),
  ];
  for (const path of onDisk) if (existsSync(path)) return path;
  try {
    const dshPackageJson = profileRequire.resolve('@deepseek-ai/dsh/package.json');
    const install = join(dshPackageJson, '..', 'node_modules', '@deepseek-ai', 'dsh-client-modules', 'lib', 'client.js');
    if (existsSync(install)) return install;
  } catch {}
  return undefined;
};

const dshClientModules = resolveDshClientModules();
if (dshClientModules === undefined) {
  console.log('SKIP  DSH client module system not resolvable from the profile — the adoption rule was not exercised');
} else {
  const dshRegistration = loadBundle(dshClientModules);
  const dsh = dshRegistration.factory(spec => {
    throw new Error('dsh-client-modules requires nothing at factory time: ' + spec);
  });
  check('the DSH browser half materializes', typeof dsh.createClientModuleSystem === 'function');

  const THIS_PLUGIN = PLUGIN_ID;
  const THIEF = 'dsh-skin-endfield';
  const boot = {
    rev: 'rev-1',
    entries: [
      { id: THIS_PLUGIN, url: `/bundles/${THIS_PLUGIN}/client.js?rev=rev-1`, rev: 'rev-1' },
      { id: THIEF, url: `/bundles/${THIEF}/client.js?rev=rev-1`, rev: 'rev-1' },
    ],
    batches: [
      {
        phase: 'application',
        url: '/bundles/application.js?rev=rev-1',
        rev: 'rev-1',
        entries: [THIS_PLUGIN, THIEF],
      },
    ],
  };
  const target = { mode: 'queue', pendingQueue: [] };
  const system = dsh.createClientModuleSystem(target, { id: 'dsh-client-modules', exports: {} }, {
    boot,
    staticModules: {},
    // Script arrival is irrelevant here: each row's factory is registered by hand.
    loadBundle: async () => {},
  });
  system.register({ id: THIS_PLUGIN, factory: () => ({}) });
  // DSH 0.2.x claims only the untagged tags a factory injects DURING its own
  // materialization (the pre-existing snapshot is deliberately left alone), so
  // model both shapes: the thief injects one sheet in its factory, and an
  // unrelated untagged sheet is already present before materialization.
  let thiefSheet;
  system.register({
    id: THIEF,
    factory: () => {
      thiefSheet = fakeElement('style');
      thiefSheet.textContent = '/* thief */';
      document.head.appendChild(thiefSheet);
      return {};
    },
  });

  const foreign = fakeElement('style');
  foreign.textContent = '.dmw-width{display:flex;flex-direction:column}';
  document.head.appendChild(foreign);
  const pluginOwnedBefore = [...styles].filter(tagged).length;

  system.materialize(THIEF);
  check(
    'a pre-existing untagged stylesheet is NOT adopted (0.2.x narrowed claimStyles)',
    foreign.getAttribute('data-plugin') === null,
    `data-plugin=${foreign.getAttribute('data-plugin') ?? '(untagged)'}`,
  );
  check(
    'a stylesheet injected BY the materializing factory IS claimed',
    thiefSheet?.getAttribute('data-plugin') === THIEF,
    `data-plugin=${thiefSheet?.getAttribute('data-plugin') ?? '(untagged)'}`,
  );
  check(
    "the plugin's own tagged sheets are NOT adopted",
    [...styles].filter(element => tagged(element) && element !== thiefSheet).length === pluginOwnedBefore
      && pluginOwnedBefore > 0,
    `${pluginOwnedBefore} tag(s) still owned by ${PLUGIN_ID}`,
  );

  await system.entries.reload(THIEF, 'rev-2').catch(() => {
    // This harness has no Cordis Loader, so the reconciliation queued behind the
    // reload rejects. The style removal runs BEFORE it, which is the whole point.
  });
  check('…and the claimed sheet is deleted when that plugin reloads', thiefSheet?.removed === true && !styles.includes(thiefSheet));
  check(
    'a pre-existing untagged sheet is untouched by another plugin reload',
    foreign.removed !== true && styles.includes(foreign),
  );
  check(
    "the plugin's own sheets survive another plugin's reload",
    styles.includes(liveMainSheet) && liveMainSheet.textContent.includes('.dmw-width{display:flex'),
  );
  check('the width override survives too', liveWidthOverride.removed !== true && styles.includes(liveWidthOverride));
}

// ── 4. browser-local preference rules: hide the New Session button ─────────
//
// The preference reads `window.localStorage` at apply time, so a stubbed storage
// drives the same code path a browser takes: the rule tag exists only while the
// option is on, carries `data-plugin`, and targets the CSS-module button class.

const originalBrowserStorage = globalThis.window.localStorage;
const hideTagIn = () => styles.find(element => element.hasAttribute('data-hide-new-session'));
try {
  styles.length = 0;
  globalThis.window.localStorage = {
    getItem: key => (key === 'dsh-unknownue-plugins:hideNewSessionButton' ? '1' : null),
    setItem: () => {},
    removeItem: () => {},
  };
  materialize();
  const hideTag = hideTagIn();
  check(
    'hide-New-Session: the rule tag exists while the preference is on',
    hideTag !== undefined,
  );
  check(
    'hide-New-Session: the tag is owned by this bundle',
    hideTag !== undefined && tagged(hideTag),
  );
  check(
    'hide-New-Session: the rule targets the module-styled button only',
    hideTag?.textContent.includes('button[class*="_newSession"]')
      && !hideTag.textContent.includes('_brand'),
    hideTag?.textContent,
  );

  styles.length = 0;
  globalThis.window.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  materialize();
  check('hide-New-Session: no rule tag ships by default', hideTagIn() === undefined);
} finally {
  globalThis.window.localStorage = originalBrowserStorage;
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

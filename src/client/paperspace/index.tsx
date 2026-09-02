/**
 * Paperspace client half: registers the 论文 tab in conversation.view and
 * injects the scoped paperspace stylesheet + KaTeX CSS/fonts (fonts are
 * served by the host route /dsh-unknownue-plugins/paperspace/static/fonts).
 */
import React from 'react';
import PaperspaceView from './view';
import UnknownueSettingsPage from './settings-page';
import { PaperBadge } from './paper-badge';
import { PaperLinkControl } from './paper-link-control';
import stylesCss from './styles.css';
import katexCss from 'katex/dist/katex.min.css';

const NS = 'dsh-unknownue-plugins.paperspace';

/**
 * Unscoped theme layer: the scoped stylesheet can't define variables on the
 * `.dsh-paperspace` ROOT element itself (the build prefixes every selector),
 * so this raw rule maps paperspace-local tokens onto DSH's design tokens —
 * the settings page and all chrome follow DSH's light/dark theme, while the
 * reading surface keeps its fixed "paper" palette below.
 */
const THEME_CSS = `
.dsh-paperspace {
  color-scheme: light dark;
  font-family: var(--dsw-font-family, inherit);
  color: var(--ps-text, #18181b);
  /* "paper" reading-surface palette (light paper by default) */
  --paper: #ffffff;
  --surface: #fafafa;
  --ink: #18181b;
  --ink-2: #71717a;
  --ink-3: #52525b;
  --paper-line: #e4e4e7;
  --paper-code-bg: #f4f4f5;
  --paper-pre-bg: #27272a;
  --paper-pre-fg: #fafafa;
  --paper-link: #2563eb;
  --paper-note-fg: #b45309;
  --paper-img-bg: transparent;
  /* theme-aware chrome tokens (follow DSH's design tokens in auto mode) */
  --ps-text: var(--dsw-alias-label-primary, #0f1115);
  --ps-text-2: var(--dsw-alias-label-secondary, #61666b);
  --ps-text-3: var(--dsw-alias-label-tertiary, #81858c);
  --ps-bg: var(--dsw-alias-bg-overlay, #e9ecf2);
  --ps-bg-2: var(--dsw-alias-bg-layer-2, #ffffff);
  --ps-bg-3: var(--dsw-alias-bg-layer-3, #ffffff);
  --ps-line: var(--dsw-alias-border-l2, #0000001a);
  --ps-line-soft: color-mix(in srgb, var(--ps-line, #0000001a) 55%, transparent);
  --ps-line-strong: var(--dsw-alias-border-inverted, #0000001a);
  --ps-brand: var(--dsw-alias-state-business-primary, #4176e6);
  --ps-danger: var(--dsw-alias-state-error-primary, #ec1313);
  --ps-hover: var(--dsw-alias-interactive-bg-hover, #2631480f);
  --ps-selected: rgba(77, 171, 247, 0.15);
}

/* Auto mode under DSH's dark theme: flip the paper palette onto a dark
   reading surface (chrome tokens above already follow the alias vars).
   The :not() guard lets a pinned light mode override DSH's dark. */
body[data-ds-dark-theme] .dsh-paperspace:not([data-ps-theme='light']),
.dsh-paperspace[data-ps-theme='dark'] {
  --paper: #1a1a1d;
  --surface: #232327;
  --ink: #e7e7ec;
  --ink-2: #a6a6b2;
  --ink-3: #8b8b98;
  --paper-line: #313138;
  --paper-code-bg: #2b2b31;
  --paper-pre-bg: #131316;
  --paper-pre-fg: #d6d6dc;
  --paper-link: #8fb3ff;
  --paper-note-fg: #dca15f;
  /* figures are authored for white paper — keep a white mat in dark mode */
  --paper-img-bg: #ffffff;
}

/* Forced dark: chrome + paper both pinned dark, independent of DSH. Values
   mirror DSH's own dark alias palette. */
.dsh-paperspace[data-ps-theme='dark'] {
  color-scheme: dark;
  --ps-text: #f9fafb;
  --ps-text-2: #cfd3d6;
  --ps-text-3: #adb2b8;
  --ps-bg: #43454a;
  --ps-bg-2: #2c2c2e;
  --ps-bg-3: #353638;
  --ps-line: #ffffff1f;
  --ps-line-strong: #ffffff0f;
  --ps-brand: #679efe;
  --ps-danger: #f25a5a;
  --ps-hover: #ffffff14;
  --ps-selected: #ffffff24;
}

/* Forced light: chrome pinned light even when DSH itself is dark. Values
   mirror DSH's own light alias palette. */
.dsh-paperspace[data-ps-theme='light'] {
  color-scheme: light;
  --ps-text: #0f1115;
  --ps-text-2: #61666b;
  --ps-text-3: #81858c;
  --ps-bg: #e9ecf2;
  --ps-bg-2: #ffffff;
  --ps-bg-3: #ffffff;
  --ps-line: #0000001a;
  --ps-line-strong: #0000001a;
  --ps-brand: #4176e6;
  --ps-danger: #ec1313;
  --ps-hover: #2631480f;
  --ps-selected: rgba(77, 171, 247, 0.15);
}

/* The composer (input box) belongs to the chat view — hide it while the
   paperspace tab owns the conversation view. DSH renders the composer for
   the active view regardless of which tab it is, so the seat is hidden via
   CSS when the paperspace root is present in the active conversation. */
[data-phase='active']:has(.dsh-paperspace) [data-composer-seat],
[class*='scrollBody']:has(.dsh-paperspace) [class*='composerSeat'] {
  display: none !important;
}
`;

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  const inject = (tagId: string, css: string) => {
    const existing = document.querySelector(`style[data-plugin-css="${tagId}"]`);
    const tag = existing !== null ? existing : document.createElement('style');
    tag.setAttribute('data-plugin-css', tagId);
    tag.textContent = css;
    if (existing === null) document.head.appendChild(tag);
  };
  inject('dsh-paperspace/theme.css', THEME_CSS);
  inject('dsh-paperspace/styles.css', stylesCss);
  inject('dsh-paperspace/katex.css', katexCss);
}

export function applyPaperspaceTab(ctx: any): void {
  ensureStyles();
  // Flat dictionary keys — the proven dsh-workspace-enhancement pattern
  // (`register('dsw', { zh, en })` with `'settings.label'`-style keys).
  ctx.effect(
    () =>
      ctx.locale.register(NS, {
        zh: { 'view.label': '论文', 'settings.label': 'UnPlugin' },
        en: { 'view.label': 'Papers', 'settings.label': 'UnPlugin' },
      }),
    'dsh-paperspace: dictionaries',
  );
  const t = ctx.locale.bind(NS);
  // The tab needs DSH's sessions service (open) and workspaces service
  // (create/connectWorkspace) for the native paper-session flow.
  const tabInjected = () => ({ sessions: ctx.sessions, workspaces: ctx.workspaces });
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: 'dsh-unknownue-plugins/paperspace',
        order: 30,
        label: () => t('view.label'),
        locale: NS,
        inject: tabInjected,
        registrant: 'dsh-unknownue-plugins',
      },
      (props: { sessions?: { open(id: string): void }; workspaces?: unknown }) =>
        React.createElement(PaperspaceView, { sessions: props?.sessions, workspaces: props?.workspaces as never }),
    ),
  );
  // Linked-paper badge in the DSH session header (display-only UI hint:
  // which paper grounds the current session).
  ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register(
      {
        name: 'conversation.session.header.actions',
        id: 'dsh-unknownue-plugins/paperspace-badge',
        order: 8,
        inject: tabInjected,
        registrant: 'dsh-unknownue-plugins',
      },
      (props: { sessions?: { list?: unknown } }) => React.createElement(PaperBadge, { sessions: props?.sessions as never }),
    ),
  );
  // Paper-link picker in the composer dock: hero (blank session) only —
  // the InputZone owner share (`session.nodes`) hides it once messages exist.
  ctx.slots.inject('conversation.input.dock', () =>
    ctx.slots.register(
      {
        name: 'conversation.input.dock',
        id: 'dsh-unknownue-plugins/paperspace-link',
        order: 5,
        registrant: 'dsh-unknownue-plugins',
      },
      (props: { sessionId?: string; session?: unknown }) =>
        React.createElement(PaperLinkControl, { sessionId: props?.sessionId, session: props?.session as never }),
    ),
  );
  // Settings page entry (same `settings.section` slot dsh-workspace-enhancement
  // uses); the page groups every bundle feature, paperspace owns one area.
  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      {
        name: 'settings.section',
        id: 'dsh-unknownue-plugins/settings',
        order: 45,
        label: () => 'UnPlugin',
        locale: NS,
        registrant: 'dsh-unknownue-plugins',
      },
      () => React.createElement(UnknownueSettingsPage),
    ),
  );
}

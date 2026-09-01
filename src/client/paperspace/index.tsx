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
  /* fixed "paper" palette (reading surface stays light) */
  --paper: #ffffff;
  --surface: #fafafa;
  --ink: #18181b;
  /* theme-aware tokens */
  --ps-text: var(--dsw-alias-label-primary, #18181b);
  --ps-text-2: var(--dsw-alias-label-secondary, #71717a);
  --ps-text-3: var(--dsw-alias-label-tertiary, #a1a1aa);
  --ps-bg: var(--dsw-alias-bg-overlay, #ffffff);
  --ps-bg-2: var(--dsw-alias-bg-layer-2, #fafafa);
  --ps-bg-3: var(--dsw-alias-bg-layer-3, #f4f4f5);
  --ps-line: var(--dsw-alias-border-l2, #e4e4e7);
  --ps-line-soft: color-mix(in srgb, var(--ps-line, #e4e4e7) 55%, transparent);
  --ps-line-strong: var(--dsw-alias-border-inverted, #d4d4d8);
  --ps-brand: var(--dsw-alias-state-business-primary, #18181b);
  --ps-danger: var(--dsw-alias-danger-fg, #b42318);
  --ps-hover: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
  --ps-selected: var(--dsw-alias-interactive-bg-selected, rgba(77, 171, 247, 0.15));
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

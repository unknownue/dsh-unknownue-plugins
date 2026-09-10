/**
 * Paperspace as a right-Sidebar tab type.
 *
 * The type is a PAGE (it claims no resource address): DSH records it at
 * `sidebar://paperspace`, and the route inside the tab — library list or one
 * paper's reader — rides the tab's navigation `params`. That makes navigation
 * the only state: the 论文 tab's 在侧栏打开 button calls
 * `sidebarRight.openTab('paperspace', { params: { arxivId } })`, the body reads
 * the params it is handed, and a re-open of the same page reveals the one tab
 * and bumps the navigation revision instead of stacking duplicates.
 *
 * Everything reaches DSH through `ctx` (services and slots); no DSH client
 * package is imported, so the bundle stays one self-contained client module.
 * `ctx.inject` gates the whole registration on the right Sidebar's services,
 * which keeps this file inert — and the rest of the bundle unaffected — on a
 * DSH build without the column.
 */
import React, { useCallback, useEffect } from 'react';
import {
  PAPERS_SIDEBAR_ID,
  PAPERS_SIDEBAR_KIND,
  readSidebarPaper,
  rememberSidebarPaper,
  setSidebarRight,
} from './sidebar-link';
import PaperspaceView, { type PaperspaceRoute } from './view';

const NS = 'dsh-unknownue-plugins.paperspace';

/** The navigation parameters a paperspace tab carries. */
interface PapersParams {
  /** The paper whose reader the tab should show; absent shows the library. */
  readonly arxivId?: string;
}
type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * The page's glyph: a sheet with a folded corner and text lines, drawn in
 * `currentColor` so the guide page themes it. Local (not an import) for the
 * same reason as every other icon in this bundle.
 */
function PapersGlyph(props: { size?: number; className?: string }) {
  const size = props.size ?? 16;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={props.className}
      style={{ display: 'block' }}
    >
      <path
        d="M3.35 1.6h5.83l3.47 3.36v9.44H3.35V1.6Z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <path d="M9.05 1.75v3.35h3.4" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
      <path
        d="M5.3 8.1h5.4M5.3 10.15h5.4M5.3 12.2h3.4"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The tab type's registry definition, with its entry box on the guide page —
 * the page the Sidebar's "+" control opens, where 论文 joins 文件 as a choice.
 * @param t - namespace-bound translate, read fresh on every label call.
 * @returns the definition to register.
 */
function papersDefinition(t: Translate) {
  return {
    id: PAPERS_SIDEBAR_ID,
    kind: PAPERS_SIDEBAR_KIND,
    priority: 'builtin',
    title: () => t('sidebar.title'),
    guide: [
      {
        order: 20,
        title: () => t('sidebar.guide.title'),
        description: () => t('sidebar.guide.description'),
        icon: PapersGlyph,
      },
    ],
  };
}

/**
 * The route one navigation of this tab names.
 *
 * Three cases, and the difference between the last two is the whole point:
 *   - a paper in the params (`openTab` from 在侧栏打开) → that paper's reader;
 *   - an EMPTY params object — the reader's back link, the one thing that means
 *     the library — → the library;
 *   - no params at all — the guide page's entry box, the strip's add control, a
 *     layout restored by undo — → the paper this tab last showed, so picking
 *     论文 from the guide comes back to the reading position instead of
 *     dropping into the library. Falling back on the library only when nothing
 *     was ever open.
 * @param params - the tab's current navigation parameters, verbatim.
 * @returns the route to render.
 */
function routeOf(params: PapersParams | undefined): PaperspaceRoute {
  const arxivId = params?.arxivId;
  if (typeof arxivId === 'string' && arxivId !== '') return { kind: 'reader', arxivId };
  if (params !== undefined) return { kind: 'list' };
  const remembered = readSidebarPaper();
  return remembered !== null ? { kind: 'reader', arxivId: remembered } : { kind: 'list' };
}

/**
 * One paperspace page's body: the paper view, driven by this tab's navigation.
 *
 * `useTabInfo` is the seat's own reader — it subscribes to the tab record and
 * its navigation — so a `openTab(..., { params })` aimed at this tab re-renders
 * the body with the new route. Navigation goes back through the tab's OWN
 * actions, which act on the session the tab is in rather than on whichever
 * surface happens to be mounted.
 */
function PaperspaceSidebarBody(props: any) {
  const { tab } = props.useTabInfo();
  const route = routeOf(tab?.navigation?.params as PapersParams | undefined);
  // Whatever this tab ends up showing is what a later params-less open resumes.
  const shownPaper = route.kind === 'reader' ? route.arxivId : '';
  useEffect(() => {
    if (shownPaper !== '') rememberSidebarPaper(shownPaper);
  }, [shownPaper]);
  const navigate = useCallback(
    (next: PaperspaceRoute) => {
      try {
        tab.actions.openTab(PAPERS_SIDEBAR_KIND, {
          params: next.kind === 'reader' ? { arxivId: next.arxivId } : {},
        });
      } catch (cause) {
        console.warn('[paperspace] 侧栏内导航失败：', cause);
      }
    },
    [tab],
  );
  return React.createElement(PaperspaceView, { surface: 'sidebar', route, navigate });
}

/**
 * The tab's chip title: the page label plus the arXiv ID the tab shows — the
 * same route resolution the body uses, so a resumed paper names itself on the
 * chip instead of leaving the label bare.
 * @param t - namespace-bound translate.
 * @returns the title component.
 */
function makeSidebarTitle(t: Translate) {
  return function PaperspaceSidebarTitle(props: any) {
    const { tab } = props.useTabInfo();
    const route = routeOf(tab?.navigation?.params as PapersParams | undefined);
    const label = t('sidebar.title');
    const text = route.kind === 'reader' ? `${label} · ${route.arxivId}` : label;
    return React.createElement('span', { className: 'dsh-ps-sidebar-title' }, text);
  };
}

/**
 * Register the paperspace tab type, its body, and its chip title with the
 * right Sidebar, and keep the controller binding the 论文 tab's buttons use.
 *
 * The registration waits for the Sidebar's own services (`ctx.inject`), so this
 * is a no-op on a build without the column and never a boot-order race.
 * @param ctx - the client root context (slots, locale, and the Sidebar services).
 */
export function applyPaperspaceSidebar(ctx: any): void {
  const t: Translate = ctx.locale.bind(NS);
  ctx.inject(['slots', 'sidebarRightTabs'], (scope: any) => {
    scope.effect(
      () => scope.sidebarRightTabs.register(papersDefinition(t)),
      'dsh-paperspace: sidebar tab type',
    );
    scope.effect(
      () =>
        scope.slots.inject('sidebar.right.pane.tab', () =>
          scope.slots.register(
            { name: 'sidebar.right.pane.tab', key: PAPERS_SIDEBAR_ID, registrant: 'dsh-unknownue-plugins' },
            PaperspaceSidebarBody,
          ),
        ),
      'dsh-paperspace: sidebar tab body',
    );
    scope.effect(
      () =>
        scope.slots.inject('sidebar.right.pane.tab.title', () =>
          scope.slots.register(
            { name: 'sidebar.right.pane.tab.title', key: PAPERS_SIDEBAR_ID, registrant: 'dsh-unknownue-plugins' },
            makeSidebarTitle(t),
          ),
        ),
      'dsh-paperspace: sidebar tab title',
    );
  });
  ctx.inject(['sidebarRight'], (scope: any) => {
    scope.effect(
      () => {
        setSidebarRight(scope.sidebarRight);
        return () => setSidebarRight(undefined);
      },
      'dsh-paperspace: sidebar controller binding',
    );
  });
}

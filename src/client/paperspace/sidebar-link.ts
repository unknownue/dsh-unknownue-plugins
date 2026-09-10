/**
 * The bridge between the 论文 tab (main view) and DSH's right Sidebar.
 *
 * The tab type's identity, the controller binding, and the remembered paper all
 * live here, in a module both sides import: `sidebar-tab.tsx` registers the type
 * under this identity and renders the paper view into it; the tab view and its
 * list/reader children ask this module whether the column is available, route a
 * paper into it, and keep the remembered paper current. Keeping these shared
 * facts out of either side avoids a cycle between the registration and the view
 * it renders.
 *
 * The controller arrives asynchronously — the right Sidebar is another plugin's
 * client half — so availability is a subscribable store rather than a snapshot
 * taken at import time: the 在侧栏打开 button appears when (and only when) the
 * column actually exists, which also keeps older DSH builds working.
 */
import { useSyncExternalStore } from 'react';

/** The tab kind paperspace owns (DSH records page tabs at `sidebar://<kind>`). */
export const PAPERS_SIDEBAR_KIND = 'paperspace';
/** This implementation's identity in the tab system: the key its body and title register under. */
export const PAPERS_SIDEBAR_ID = 'dsh-unknownue-plugins/paperspace';

/** The slice of `ctx.sidebarRight` this bundle calls (typed locally: no DSH import). */
export interface SidebarRightFace {
  /**
   * Reveal the named page type, expanding the column in the same step.
   * @param kind - the page type's kind.
   * @param options - that kind's navigation parameters.
   */
  openTab(kind: string, options?: { params?: Record<string, unknown> }): void;
}

let controller: SidebarRightFace | undefined;
const listeners = new Set<() => void>();

/**
 * Bind the live controller, or clear it when the plugin unloads.
 * @param next - the controller, or undefined to unbind.
 */
export function setSidebarRight(next: SidebarRightFace | undefined): void {
  if (controller === next) return;
  controller = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether DSH's right Sidebar is mounted in this client. */
export function useSidebarRightAvailable(): boolean {
  const read = () => controller !== undefined;
  // The third argument is the server snapshot: this client half only ever runs
  // in the browser, but keeping this store renderable outside the DOM is what
  // lets the registration be smoke-tested with react-dom/server.
  return useSyncExternalStore(subscribe, read, read);
}

/**
 * Show one paper in the right Sidebar's paperspace tab.
 *
 * A session whose column has no mounted surface (a global main panel is open)
 * makes the controller throw rather than write into a surface nobody draws, so
 * the call is fenced here; the caller keeps its own affordance either way.
 * @param arxivId - the paper the tab should open its reader on.
 * @returns whether the column accepted the navigation.
 */
export function openPaperInSidebar(arxivId: string): boolean {
  if (controller === undefined) return false;
  try {
    controller.openTab(PAPERS_SIDEBAR_KIND, { params: { arxivId } });
    return true;
  } catch (cause) {
    console.warn('[paperspace] 右侧栏当前不可用，无法打开论文：', cause);
    return false;
  }
}

/**
 * The paper the Sidebar's papers tab last showed.
 *
 * A params-less open states no route of its own — the guide page's entry box
 * (`openTab(kind)`), a layout restored by undo, the strip's add control — and
 * the tab may have been closed since (picking an entry REPLACES the tab it came
 * from), so its navigation record is gone with it. The memory is what makes
 * "open 论文" mean "back to my paper" instead of "start from the library".
 *
 * Module state carries it across tab switches; a sessionStorage mirror carries
 * it across page reloads, exactly like the tab's own route memory.
 */
const LAST_PAPER_KEY = 'dsh-unknownue-plugins/paperspace:sidebar-paper';
let memoryPaper: string | null | undefined;

/** Remember the paper the Sidebar's papers tab is showing. */
export function rememberSidebarPaper(arxivId: string): void {
  if (memoryPaper === arxivId) return;
  memoryPaper = arxivId;
  try {
    sessionStorage.setItem(LAST_PAPER_KEY, arxivId);
  } catch {
    /* storage unavailable — module state still keeps the tab switch working */
  }
}

/** The remembered paper, or null when the Sidebar never showed one. */
export function readSidebarPaper(): string | null {
  if (memoryPaper !== undefined) return memoryPaper;
  try {
    const raw = sessionStorage.getItem(LAST_PAPER_KEY);
    memoryPaper = raw !== null && raw !== '' ? raw : null;
  } catch {
    memoryPaper = null;
  }
  return memoryPaper;
}

/**
 * Drop the memory of one paper — for a paper that no longer exists, which no
 * later open should try to resume into.
 * @param arxivId - the paper that went away.
 */
export function forgetSidebarPaper(arxivId: string): void {
  if (readSidebarPaper() !== arxivId) return;
  memoryPaper = null;
  try {
    sessionStorage.removeItem(LAST_PAPER_KEY);
  } catch {
    /* storage unavailable */
  }
}

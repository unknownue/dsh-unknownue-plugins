/**
 * "Hide the New Session button" preference.
 *
 * DSH's sidebar renders the New Session control as a CSS-module-styled button
 * (`className = SidebarRoot.module.css.newSession`, emitted with the build's
 * `[hash]_[local]` pattern — `wtg9ga_newSession` in DSH 0.2.2). There is no slot
 * to remove it, so the bundle hides it with one injected rule while the setting
 * is on. The selector deliberately matches both hash-first and hash-last module
 * conventions and only `button` elements, so the sidebar brand/logo button (which
 * can also start a session on desktop) stays visible.
 *
 * The rule is browser-local: the preference lives in `localStorage`, and the
 * style tag is created only while the setting is on, so a default browser ships
 * no extra sheet. Keyboard shortcuts and session creation itself are untouched —
 * this hides the button, nothing else.
 */

/** Stable browser-local key (survives reloads; per browser profile). */
export const HIDE_NEW_SESSION_STORAGE_KEY = "dsh-unknownue-plugins:hideNewSessionButton";

/** Attribute that identifies the bundle's own rule element. */
export const HIDE_NEW_SESSION_ATTRIBUTE = "data-hide-new-session";

/** Both CSS-module naming conventions DSH builds have used. */
const HIDE_NEW_SESSION_SELECTOR = 'button[class*="_newSession"], button[class*="newSession_"]';

let hideStyleEl: HTMLStyleElement | null = null;

/** Find an existing rule tag (fresh module state after an HMR reload). */
function findHideStyle(): HTMLStyleElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLStyleElement>(`style[${HIDE_NEW_SESSION_ATTRIBUTE}]`);
}

/** Read the persisted toggle (default off; storage failures read as off). */
export function readHideNewSessionButton(): boolean {
  try {
    return window.localStorage.getItem(HIDE_NEW_SESSION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Apply the current preference: one rule while hidden, no tag while shown. */
export function applyHideNewSessionButton(hide: boolean): void {
  if (typeof document === "undefined") return;
  if (!hide) {
    // Remove any tag a previous activation left behind (module state resets on
    // reload, the DOM does not), so turning the option off really restores the
    // button.
    for (const element of document.querySelectorAll(`style[${HIDE_NEW_SESSION_ATTRIBUTE}]`)) element.remove();
    hideStyleEl = null;
    return;
  }
  if (hideStyleEl === null || !hideStyleEl.isConnected) hideStyleEl = findHideStyle();
  if (hideStyleEl === null) {
    hideStyleEl = document.createElement("style");
    hideStyleEl.setAttribute("data-plugin", "dsh-unknownue-plugins");
    hideStyleEl.setAttribute(HIDE_NEW_SESSION_ATTRIBUTE, "");
    document.head.appendChild(hideStyleEl);
  }
  hideStyleEl.textContent = `${HIDE_NEW_SESSION_SELECTOR}{display:none !important;}`;
}

/** Persist and apply one toggle value; returns the applied value. */
export function setHideNewSessionButton(hide: boolean): boolean {
  applyHideNewSessionButton(hide);
  try {
    window.localStorage.setItem(HIDE_NEW_SESSION_STORAGE_KEY, hide ? "1" : "0");
  } catch {
    // Storage may be unavailable (private mode); the session still applies.
  }
  return hide;
}

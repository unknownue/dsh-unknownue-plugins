/**
 * The client module id of this bundle — the value DSH's module loader registers
 * (`window.__ModuleLoader__.load({ id })` in the build preamble) and, more
 * importantly, the value every stylesheet this bundle injects must declare as
 * its owner.
 *
 * DSH's client module system keeps HMR bookkeeping over `<style>` tags by
 * attribute rather than by closure:
 *
 *   claimStyles(id)       `style:not([data-plugin])` → stamp `data-plugin=<id>`
 *                         on every untagged tag for the plugin whose bundle
 *                         materializes next;
 *   removeOwnedStyles(id) `style[data-plugin=<id>]`   → remove.
 *
 * An untagged sheet is therefore NOT unowned: whichever plugin materializes
 * next adopts it, and the sheet is deleted the moment THAT plugin is
 * code-reloaded, pruned from the graph, or has its graph revision changed. The
 * injector itself never reloads, so nothing re-injects the CSS and the surface
 * stays unstyled for the rest of the page's life (refresh hides it again until
 * the next reload of whoever adopted the tag).
 *
 * Hence one owner id for the whole bundle, on every injected tag — the sheet's
 * own identity attributes (`data-dsh-unknownue-styles`, `data-width-override`,
 * `data-plugin-css`) stay as they are; only `data-plugin` is the ownership
 * contract. See `scripts/verify-styles.mjs`, which drives the real module
 * system to prove the adopt-then-delete sequence.
 */
export const PLUGIN_ID = "dsh-unknownue-plugins";

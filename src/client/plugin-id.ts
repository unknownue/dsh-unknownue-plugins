/**
 * The client module id of this bundle — the value DSH's module loader registers
 * (`window.__ModuleLoader__.load({ id })` in the build preamble) and, more
 * importantly, the value every stylesheet this bundle injects must declare as
 * its owner.
 *
 * DSH's client module system keeps HMR bookkeeping over `<style>` tags by
 * attribute rather than by closure:
 *
 *   claimStyles(id, before)  untagged tags a factory injects DURING its own
 *                            materialization → stamp `data-plugin=<id>`; tags
 *                            already present are deliberately left alone (0.1.x
 *                            adopted those too, 0.2.x narrowed the rule);
 *   removeOwnedStyles(id)    `style[data-plugin=<id>]` → remove.
 *
 * Either line makes `data-plugin` the right contract: on 0.1.x an untagged sheet
 * was adopted and deleted with whichever plugin materialized next; on 0.2.x it is
 * never removed, so a re-applied bundle would append a stale duplicate. A sheet
 * tagged with this bundle's id is removed by the bundle's own reload and
 * re-injected by its `apply()`, so the surface comes back styled instead of
 * silently losing its rules.
 *
 * Hence one owner id for the whole bundle, on every injected tag — the sheet's
 * own identity attributes (`data-dsh-unknownue-styles`, `data-width-override`,
 * `data-plugin-css`) stay as they are; only `data-plugin` is the ownership
 * contract. See `scripts/verify-styles.mjs`, which drives the real module
 * system to prove the current sequence (a pre-existing untagged tag untouched,
 * a factory-injected tag claimed and removed, this bundle's tags surviving).
 */
export const PLUGIN_ID = "dsh-unknownue-plugins";

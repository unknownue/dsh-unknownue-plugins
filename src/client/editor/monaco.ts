/**
 * Monaco editor CDN loader — loads Monaco from multiple CDN mirrors
 * with fallback support.
 */

const MONACO_VERSION = "0.52.2";
const MONACO_MIRRORS = [
  `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`,
  `https://unpkg.com/monaco-editor@${MONACO_VERSION}/min/vs`,
  `https://fastly.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`,
];
const MONACO_MIRROR_OVERRIDE_KEY = "dsh-explorer-editor:monaco-mirror";

let loading: Promise<typeof window.monaco> | null = null;
let failed = false;

function mirrorBases(): string[] {
  let override: string | null = null;
  try {
    if (typeof localStorage !== "undefined") override = localStorage.getItem(MONACO_MIRROR_OVERRIDE_KEY);
  } catch {
    // storage unavailable
  }
  if (override !== null && override.trim() !== "") return [override.trim(), ...MONACO_MIRRORS];
  return MONACO_MIRRORS;
}

function loadLoader(base: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = `${base}/loader.js`;
    el.async = true;
    el.addEventListener("load", () => resolve());
    el.addEventListener("error", () => reject(new Error(`failed to load monaco loader: ${base}`)));
    document.head.append(el);
  });
}

export function ensureMonaco(): Promise<typeof window.monaco> {
  if (failed) return Promise.reject(new Error("monaco previously failed to load"));
  if (loading) return loading;
  loading = (async () => {
    for (const base of mirrorBases()) {
      try {
        await loadLoader(base);
      } catch {
        continue;
      }
      try {
        await new Promise<void>((resolve, reject) => {
          (window as any).require.config({ paths: { vs: base } });
          (window as any).require(["vs/editor/editor.main"], () => resolve(), (err: any) => reject(err));
        });
        return (window as any).monaco;
      } catch (error) {
        failed = true;
        loading = null;
        throw error instanceof Error ? error : new Error(String(error));
      }
    }
    failed = true;
    loading = null;
    throw new Error("failed to load monaco loader from any mirror");
  })();
  return loading;
}

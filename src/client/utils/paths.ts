/**
 * Posix-path utilities for the file tree.
 */

export function normalizePosix(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function isInsideRoot(root: string, path: string): boolean {
  const r = normalizePosix(root);
  const p = normalizePosix(path);
  if (r === "") return true;
  return p === r || p.startsWith(`${r}/`);
}

export function relativePath(root: string, full: string): string {
  const r = normalizePosix(root);
  const f = normalizePosix(full);
  if (f === r) return "";
  if (!isInsideRoot(r, f)) return full;
  return f.slice(r === "" ? 0 : r.length + 1);
}

export function baseName(path: string): string {
  const p = normalizePosix(path);
  const i = p.lastIndexOf("/");
  return i < 0 ? p : p.slice(i + 1);
}

export function parentOf(path: string, root: string): string {
  const i = path.lastIndexOf("/");
  if (i <= 0) return root;
  return path.slice(0, i) || root;
}

/** Join class names, filtering out falsy values. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

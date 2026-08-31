/**
 * Explorer remote — builds the file manager remote interface that
 * communicates with the host via JSON-RPC loopback routes.
 */

import { call, unwrap } from "../utils/rpc";

const EXPLORER_API = "/dsh-unknownue-plugins/explorer/api";

export interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  mtimeMs: number | null;
}

export interface DirListing {
  path: string;
  entries: FileEntry[];
}

export interface ReadResult {
  path: string;
  content: string;
  mtimeMs: number | null;
  size: number;
}

export interface DataUrlResult {
  path: string;
  mime: string;
  dataUrl: string;
}

export interface StatResult {
  path: string;
  type: string;
  size: number;
  mtimeMs: number | null;
}

export interface WriteResult {
  path: string;
  operation: string;
}

export interface RenameResult {
  from: string;
  to: string;
}

export interface ResolveResult {
  path: string;
}

export interface RootResult {
  path: string;
}

export interface FileManagerRemote {
  listDir(path: string): Promise<{ ok: boolean; value?: DirListing; error?: any }>;
  readText(path: string): Promise<{ ok: boolean; value?: ReadResult; error?: any }>;
  readDataUrl(path: string): Promise<{ ok: boolean; value?: DataUrlResult; error?: any }>;
  writeText(path: string, content: string): Promise<{ ok: boolean; value?: WriteResult; error?: any }>;
  createFile(path: string): Promise<{ ok: boolean; value?: { path: string; operation: string }; error?: any }>;
  createDirectory(path: string): Promise<{ ok: boolean; value?: { path: string }; error?: any }>;
  rename(from: string, to: string): Promise<{ ok: boolean; value?: RenameResult; error?: any }>;
  copy(from: string, to: string): Promise<{ ok: boolean; value?: RenameResult; error?: any }>;
  delete(path: string): Promise<{ ok: boolean; value?: { path: string }; error?: any }>;
  stat(path: string): Promise<{ ok: boolean; value?: StatResult; error?: any }>;
  resolve(path: string): Promise<{ ok: boolean; value?: ResolveResult; error?: any }>;
  getRoot(): { ok: boolean; value?: RootResult; error?: any };
  setRoot(path: string): Promise<{ ok: boolean; value?: RootResult; error?: any }>;
}

export function buildExplorerRemote(): FileManagerRemote {
  let cwd = "";
  let resolvedRoot = "";

  const envelope = async <T>(promise: Promise<T>): Promise<{ ok: boolean; value?: T; error?: any }> => {
    try {
      return { ok: true, value: await promise };
    } catch (err: any) {
      return { ok: false, error: { code: "RPC_ERROR", message: err instanceof Error ? err.message : String(err) } };
    }
  };

  const entriesOf = (value: any): FileEntry[] =>
    value.entries.map((e: any) => ({
      name: e.name,
      type: e.type,
      size: e.size,
      mtimeMs: e.mtimeMs ?? null,
    }));

  return {
    listDir: (path) =>
      envelope(
        call<any>(EXPLORER_API, "list", { cwd, path }).then((v) => ({
          path: v.path,
          entries: entriesOf(v),
        })),
      ),
    readText: (path) =>
      envelope(
        call<any>(EXPLORER_API, "read", { cwd, path }).then((v) => {
          if (v.tooLarge) throw new Error("file too large to open in the editor (" + v.size + " bytes)");
          return { path: v.path ?? path, content: v.content ?? "", mtimeMs: null, size: v.size };
        }),
      ),
    readDataUrl: (path) =>
      envelope(
        call<any>(EXPLORER_API, "readDataUrl", { cwd, path }).then((v) => ({
          path: v.path,
          mime: v.mime,
          dataUrl: v.dataUrl,
        })),
      ),
    writeText: (path, content) =>
      envelope(
        call<any>(EXPLORER_API, "write", { cwd, path, content }).then(() => ({
          path,
          operation: "update",
        })),
      ),
    createFile: (path) =>
      envelope(
        call<any>(EXPLORER_API, "createFile", { cwd, path }).then((v) => ({
          path: v.path,
          operation: "create",
        })),
      ),
    createDirectory: (path) =>
      envelope(
        call<any>(EXPLORER_API, "createDirectory", { cwd, path }).then((v) => ({
          path: v.path,
        })),
      ),
    rename: (from, to) =>
      envelope(
        call<any>(EXPLORER_API, "renamePath", { cwd, from, to }).then((v) => ({
          from: v.from,
          to: v.to,
        })),
      ),
    copy: (from, to) =>
      envelope(
        call<any>(EXPLORER_API, "copyPath", { cwd, from, to }).then((v) => ({
          from: v.from,
          to: v.to,
        })),
      ),
    delete: (path) =>
      envelope(
        call<any>(EXPLORER_API, "deletePath", { cwd, path }).then(() => ({ path })),
      ),
    stat: (path) =>
      envelope(
        call<any>(EXPLORER_API, "statPath", { cwd, path }).then((v) => ({
          path: v.path,
          type: v.type,
          size: v.size,
          mtimeMs: null,
        })),
      ),
    resolve: (path) =>
      envelope(
        call<any>(EXPLORER_API, "resolvePath", { cwd, path }).then((v) => ({
          path: v.path,
        })),
      ),
    getRoot: () => ({
      ok: true,
      value: { path: resolvedRoot !== "" ? resolvedRoot : cwd },
    }),
    setRoot: (path) =>
      envelope(
        call<any>(EXPLORER_API, "setRoot", { cwd, path }).then((v) => {
          cwd = String(path);
          resolvedRoot = v.path;
          return { path: v.path };
        }),
      ),
  };
}

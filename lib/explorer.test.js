/**
 * Ad-hoc host-half harness: exercises explorerDispatch against a mock ctx that
 * emulates the mixed fs/subprocess seams for a LOCAL and a REMOTE world.
 * Run: node lib/explorer.test.js
 */
import { explorerDispatch, worldOf, parentPathOf, parseRemoteSpelling } from "./explorer.js";
import { join } from "node:path";

// ── mock world ───────────────────────────────────────────────────────────────
const dirs = {
  "local:/proj": new Set(["readme.md", "src"]),
  "local:/proj/src": new Set(["a.txt", "img.png"]),
  "remote:/home/u": new Set(["notes.md", "work"]),
  "remote:/home/u/work": new Set(["b.txt"]),
};
const files = {
  "local:/proj/readme.md": "# hello",
  "local:/proj/src/a.txt": "alpha",
  "remote:/home/u/notes.md": "# remote notes",
  "remote:/home/u/work/b.txt": "beta",
};

const keyOf = (world, path) => `${world}:${path}`;

function makeFs(world, resolveLog) {
  const mk = (path, display) => ({ targetKey: `${world === "remote" ? "ssh://c1" : ""}${path}`, displayPath: display ?? path });
  return {
    async resolve(path, opts) {
      if (resolveLog) resolveLog.push({ path, cwd: opts?.cwd });
      return mk(path);
    },
    async stat(target) {
      const key = keyOf(world, String(target.targetKey).replace(/^ssh:\/\/c1/, ""));
      if (dirs[key]) return { version: "v1", type: "directory" };
      if (files[key] !== undefined) return { version: "v1", type: "file", size: files[key].length };
      return undefined;
    },
    async listDir(target) {
      const key = keyOf(world, String(target.targetKey).replace(/^ssh:\/\/c1/, ""));
      const set = dirs[key];
      if (!set) throw new Error("not a directory");
      return [...set].sort().map((name) => {
        const child = target.targetKey + "/" + name;
        return { name, type: dirs[keyOf(world, child.replace(/^ssh:\/\/c1/, ""))] ? "directory" : "file", target: mk(child), size: 3 };
      });
    },
    async readText(target) {
      const key = keyOf(world, String(target.targetKey).replace(/^ssh:\/\/c1/, ""));
      if (files[key] === undefined) throw new Error("not a file");
      return files[key];
    },
    async readBytes(target, signal, maxBytes) {
      const text = await this.readText(target);
      return Buffer.from(text, "utf8");
    },
    async writeText(target, content) {
      const key = keyOf(world, String(target.targetKey).replace(/^ssh:\/\/c1/, ""));
      if (content.includes("readonly")) throw new Error(`cannot write: the side workspace is read-only (fs: r)`);
      files[key] = content;
      return { operation: "update", version: "v2" };
    },
    processPath(target) {
      return String(target.targetKey).replace(/^ssh:\/\/c1/, "");
    },
  };
}

function makeSubprocess(remoteLog) {
  return {
    spawn(spec) {
      remoteLog.push({ argv: spec.argv, cwd: spec.cwd });
      // `test -e` probes report "not exists" so create/copy flows proceed.
      const exitCode = spec.argv[0] === "test" ? 1 : 0;
      return {
        collected: { stderr: { readFrom: () => ({ text: "" }) } },
        done: Promise.resolve({ exitCode, signal: null }),
      };
    },
  };
}

function makeCtx({ world, resolveLog }) {
  const remoteLog = [];
  return {
    remoteLog,
    resolveLog,
    ctx: {
      get(name) {
        if (name === "fs") return makeFs(world, resolveLog);
        if (name === "subprocess") return makeSubprocess(remoteLog);
        return undefined;
      },
    },
  };
}

// ── assertions ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL ${label}\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
  }
}
async function rejects(label, promise, pattern) {
  try {
    await promise;
    failed += 1;
    console.error(`FAIL ${label}: expected rejection`);
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (pattern.test(msg)) passed += 1;
    else {
      failed += 1;
      console.error(`FAIL ${label}: error "${msg}" does not match ${pattern}`);
    }
  }
}

// worldOf
check("worldOf ssh://", worldOf({ targetKey: "ssh://c1/a" }), "remote");
check("worldOf local", worldOf({ targetKey: "C:/a" }), "local");

// parentPathOf — both separator families (the Windows reveal bug regression)
check("parentPathOf windows", parentPathOf("C:\\Users\\u\\Temp\\x\\f.txt", "local"), "C:\\Users\\u\\Temp\\x");
check("parentPathOf posix", parentPathOf("/home/u/work/b.txt", "local"), "/home/u/work");
check("parentPathOf remote", parentPathOf("/home/u/work/b.txt", "remote"), "/home/u/work");
check("parentPathOf root file", parentPathOf("/f.txt", "remote"), "/");
check("parentPathOf no separator", parentPathOf("plain", "local"), "plain");

// parseRemoteSpelling — the remote-spelling normalizer
check("spelling ssh://", parseRemoteSpelling("ssh://c3/home/u/w"), { id: "c3", path: "/home/u/w" });
check("spelling dsw-routes", parseRemoteSpelling("C:\\Users\\x\\.dsh\\dsw-routes\\c3\\home\\u\\w"), { id: "c3", path: "/home/u/w" });
check("spelling legacy tree", parseRemoteSpelling("/root/.dsh/dsh-ssh-routes/c9/a/b"), { id: "c9", path: "/a/b" });
check("spelling plain posix", parseRemoteSpelling("/home/u/w"), null);
check("spelling plain windows", parseRemoteSpelling("E:\\Workspace\\x"), null);
check("spelling empty", parseRemoteSpelling(""), null);

// LOCAL world
{
  const { ctx } = makeCtx({ world: "local" });
  const list = await explorerDispatch(ctx, {}, "list", { cwd: "/proj", path: "/proj" });
  check("local list world", list.world, "local");
  check("local list entries", list.entries.map((e) => e.name), ["readme.md", "src"]);
  const read = await explorerDispatch(ctx, {}, "read", { cwd: "/proj", path: "/proj/readme.md" });
  check("local read", read.content, "# hello");
  const write = await explorerDispatch(ctx, {}, "write", { cwd: "/proj", path: "/proj/new.md", content: "new" });
  check("local write ok", write.ok, true);
  check("local write stored", files["local:/proj/new.md"], "new");
  await rejects("local write readonly gate", explorerDispatch(ctx, {}, "write", { cwd: "/proj", path: "/proj/x", content: "readonly" }), /read-only/);
  await rejects("local raw binary guard", explorerDispatch(ctx, {}, "raw", { cwd: "/proj", path: "/proj/nope" }), /not-found/);
  await rejects("unknown method", explorerDispatch(ctx, {}, "bogus", {}), /unknown method/);
  await rejects("NUL path", explorerDispatch(ctx, {}, "list", { cwd: "/proj", path: "a\0b" }), /NUL/);
}

// REMOTE world
{
  const { ctx, remoteLog } = makeCtx({ world: "remote" });
  const list = await explorerDispatch(ctx, {}, "list", { cwd: "dsw-routes/c1/home/u", path: "/home/u" });
  check("remote list world", list.world, "remote");
  check("remote list entries", list.entries.map((e) => e.name), ["notes.md", "work"]);
  const read = await explorerDispatch(ctx, {}, "read", { cwd: "ssh://c1/home/u", path: "/home/u/notes.md" });
  check("remote read", read.content, "# remote notes");

  const mk = await explorerDispatch(ctx, {}, "mkdir", { cwd: "ssh://c1/home/u", path: "/home/u", name: "newdir" });
  check("remote mkdir world", mk.world, "remote");
  check("remote mkdir argv", remoteLog[0].argv, ["mkdir", "-p", "--", "/home/u/newdir"]);

  const touch = await explorerDispatch(ctx, {}, "touch", { cwd: "ssh://c1/home/u", path: "/home/u", name: "f.txt" });
  check("remote touch argv", remoteLog[1].argv, ["touch", "--", "/home/u/f.txt"]);

  await explorerDispatch(ctx, {}, "rename", { cwd: "ssh://c1/home/u", path: "/home/u/notes.md", name: "n2.md" });
  check("remote rename argv", remoteLog[2].argv, ["mv", "-T", "--", "/home/u/notes.md", "/home/u/n2.md"]);

  await explorerDispatch(ctx, {}, "delete", { cwd: "ssh://c1/home/u", path: "/home/u/work" });
  check("remote delete argv", remoteLog[3].argv, ["rm", "-rf", "--", "/home/u/work"]);

  await rejects("remote reveal refused", explorerDispatch(ctx, {}, "reveal", { cwd: "ssh://c1/home/u", path: "/home/u/notes.md" }), /remote/);
  await rejects("remote structural no subprocess", (async () => {
    const bare = { get: (n) => (n === "fs" ? makeFs("remote") : undefined) };
    await explorerDispatch(bare, {}, "mkdir", { cwd: "ssh://c1/home/u", path: "/home/u", name: "x" });
  })(), /subprocess/);
}

// REMOTE-world spelling normalization (the "not a directory: <placeholder>" fix)
{
  const resolveLog = [];
  const { ctx } = makeCtx({ world: "remote", resolveLog });

  // 1. placeholder as BOTH cwd and path (the real remote-session root call)
  const ph = "C:\\Users\\u\\.dsh\\dsw-routes\\c1\\home\\u";
  const list = await explorerDispatch(ctx, {}, "list", { cwd: ph, path: ph });
  check("placeholder list world", list.world, "remote");
  check("placeholder path normalized", resolveLog.at(-1).path, "/home/u");
  check("placeholder cwd kept", resolveLog.at(-1).cwd, ph);

  // 2. ssh:// path with a LOCAL cwd → cwd pinned onto the machine route
  const list2 = await explorerDispatch(ctx, {}, "list", { cwd: "E:\\local", path: "ssh://c1/home/u" });
  check("ssh:// path normalized", resolveLog.at(-1).path, "/home/u");
  check("ssh:// cwd pinned", resolveLog.at(-1).cwd, "ssh://c1/");
}

// REMOTE structural spawn cwd: a LOCAL cwd must never reach the remote spawn
{
  const { ctx, remoteLog } = makeCtx({ world: "remote" });
  await explorerDispatch(ctx, {}, "mkdir", { cwd: "E:\\local", path: "ssh://c1/home/u", name: "made" });
  check("remote mkdir world pinned", remoteLog[0].cwd, "ssh://c1/");
  check("remote mkdir argv absolute", remoteLog[0].argv, ["mkdir", "-p", "--", "/home/u/made"]);
}

// REMOTE explorer-editor style full-path methods
{
  const { ctx, remoteLog } = makeCtx({ world: "remote" });
  const cwd = "ssh://c1/home/u";

  await explorerDispatch(ctx, {}, "createFile", { cwd, path: "/home/u/newfile.txt" });
  check("createFile probe", remoteLog[0].argv, ["test", "-e", "/home/u/newfile.txt"]);
  check("createFile touch", remoteLog[1].argv, ["touch", "--", "/home/u/newfile.txt"]);

  await explorerDispatch(ctx, {}, "createDirectory", { cwd, path: "/home/u/somedir/nested" });
  check("createDirectory argv", remoteLog[2].argv, ["mkdir", "-p", "--", "/home/u/somedir/nested"]);

  await explorerDispatch(ctx, {}, "renamePath", { cwd, from: "/home/u/notes.md", to: "/home/u/n2.md" });
  check("renamePath argv", remoteLog[3].argv, ["mv", "-T", "--", "/home/u/notes.md", "/home/u/n2.md"]);

  await explorerDispatch(ctx, {}, "copyPath", { cwd, from: "/home/u/notes.md", to: "/home/u/n3.md" });
  check("copyPath probe", remoteLog[4].argv, ["test", "-e", "/home/u/n3.md"]);
  check("copyPath cp", remoteLog[5].argv, ["cp", "-r", "--", "/home/u/notes.md", "/home/u/n3.md"]);

  await explorerDispatch(ctx, {}, "deletePath", { cwd, path: "/home/u/work" });
  check("deletePath rmdir", remoteLog[6].argv, ["rmdir", "--", "/home/u/work"]);
  await explorerDispatch(ctx, {}, "deletePath", { cwd, path: "/home/u/notes.md" });
  check("deletePath rm", remoteLog[7].argv, ["rm", "--", "/home/u/notes.md"]);

  const st = await explorerDispatch(ctx, {}, "statPath", { cwd, path: "/home/u/notes.md" });
  check("statPath", { path: st.path, type: st.type, world: st.world }, { path: "/home/u/notes.md", type: "file", world: "remote" });

  const du = await explorerDispatch(ctx, {}, "readDataUrl", { cwd, path: "/home/u/notes.md" });
  check("readDataUrl prefix", du.dataUrl.startsWith("data:text/plain;"), true);
  check("readDataUrl world", du.world, "remote");

  const rp = await explorerDispatch(ctx, {}, "resolvePath", { cwd, path: "/home/u/notes.md" });
  check("resolvePath", rp, { path: "/home/u/notes.md", world: "remote" });

  const sr = await explorerDispatch(ctx, {}, "setRoot", { cwd, path: "/home/u" });
  check("setRoot remote", sr, { path: "/home/u", world: "remote" });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

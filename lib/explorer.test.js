// src/host/explorer.test.ts
import { explorerDispatch, worldOf, parentPathOf, parseRemoteSpelling } from "./explorer.js";
function call(ctx, method, params) {
  return explorerDispatch(ctx, {}, method, params);
}
var dirs = {
  "local:/proj": /* @__PURE__ */ new Set(["readme.md", "src"]),
  "local:/proj/src": /* @__PURE__ */ new Set(["a.txt", "img.png"]),
  "remote:/home/u": /* @__PURE__ */ new Set(["notes.md", "work"]),
  "remote:/home/u/work": /* @__PURE__ */ new Set(["b.txt"])
};
var files = {
  "local:/proj/readme.md": "# hello",
  "local:/proj/src/a.txt": "alpha",
  "remote:/home/u/notes.md": "# remote notes",
  "remote:/home/u/work/b.txt": "beta"
};
var keyOf = (world, path) => `${world}:${path}`;
function makeFs(world, resolveLog) {
  const mk = (path, display) => ({
    targetKey: `${world === "remote" ? "ssh://c1" : ""}${path}`,
    displayPath: display ?? path
  });
  const readTextOf = async (target) => {
    const key = keyOf(world, String(target.targetKey).replace(/^ssh:\/\/c1/, ""));
    if (files[key] === void 0) throw new Error("not a file");
    return files[key];
  };
  return {
    async resolve(path, opts) {
      if (resolveLog) resolveLog.push({ path, cwd: opts?.cwd });
      return mk(path);
    },
    async stat(target) {
      const key = keyOf(world, String(target.targetKey).replace(/^ssh:\/\/c1/, ""));
      if (dirs[key]) return { version: "v1", type: "directory" };
      if (files[key] !== void 0) return { version: "v1", type: "file", size: files[key].length };
      return void 0;
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
    readText: readTextOf,
    async readBytes(target, _signal, _maxBytes) {
      const text = await readTextOf(target);
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
    }
  };
}
function makeSubprocess(remoteLog) {
  return {
    spawn(spec) {
      remoteLog.push({ argv: spec.argv, cwd: spec.cwd });
      const exitCode = spec.argv[0] === "test" ? 1 : 0;
      return {
        collected: { stderr: { readFrom: () => ({ text: "" }) } },
        done: Promise.resolve({ exitCode, signal: null })
      };
    }
  };
}
function makeCtx({ world, resolveLog }) {
  const remoteLog = [];
  return {
    remoteLog,
    ctx: {
      get(name) {
        if (name === "fs") return makeFs(world, resolveLog);
        if (name === "subprocess") return makeSubprocess(remoteLog);
        return void 0;
      }
    }
  };
}
var passed = 0;
var failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL ${label}
  actual:   ${JSON.stringify(actual)}
  expected: ${JSON.stringify(expected)}`);
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
check("worldOf ssh://", worldOf({ targetKey: "ssh://c1/a", displayPath: "/a" }), "remote");
check("worldOf local", worldOf({ targetKey: "C:/a", displayPath: "C:/a" }), "local");
check("parentPathOf windows", parentPathOf("C:\\Users\\u\\Temp\\x\\f.txt", "local"), "C:\\Users\\u\\Temp\\x");
check("parentPathOf posix", parentPathOf("/home/u/work/b.txt", "local"), "/home/u/work");
check("parentPathOf remote", parentPathOf("/home/u/work/b.txt", "remote"), "/home/u/work");
check("parentPathOf root file", parentPathOf("/f.txt", "remote"), "/");
check("parentPathOf no separator", parentPathOf("plain", "local"), "plain");
check("spelling ssh://", parseRemoteSpelling("ssh://c3/home/u/w"), { id: "c3", path: "/home/u/w" });
check("spelling dsw-routes", parseRemoteSpelling("C:\\Users\\x\\.dsh\\dsw-routes\\c3\\home\\u\\w"), { id: "c3", path: "/home/u/w" });
check("spelling legacy tree", parseRemoteSpelling("/root/.dsh/dsh-ssh-routes/c9/a/b"), { id: "c9", path: "/a/b" });
check("spelling plain posix", parseRemoteSpelling("/home/u/w"), null);
check("spelling plain windows", parseRemoteSpelling("E:\\Workspace\\x"), null);
check("spelling empty", parseRemoteSpelling(""), null);
{
  const { ctx } = makeCtx({ world: "local" });
  const list = await call(ctx, "list", { cwd: "/proj", path: "/proj" });
  check("local list world", list.world, "local");
  check("local list entries", list.entries.map((e) => e.name), ["readme.md", "src"]);
  const read = await call(ctx, "read", { cwd: "/proj", path: "/proj/readme.md" });
  check("local read", read.content, "# hello");
  const write = await call(ctx, "write", { cwd: "/proj", path: "/proj/new.md", content: "new" });
  check("local write ok", write.ok, true);
  check("local write stored", files["local:/proj/new.md"], "new");
  await rejects("local write readonly gate", call(ctx, "write", { cwd: "/proj", path: "/proj/x", content: "readonly" }), /read-only/);
  await rejects("local raw binary guard", call(ctx, "raw", { cwd: "/proj", path: "/proj/nope" }), /not-found/);
  await rejects("unknown method", call(ctx, "bogus", {}), /unknown method/);
  await rejects("NUL path", call(ctx, "list", { cwd: "/proj", path: "a\0b" }), /NUL/);
}
{
  const { ctx, remoteLog } = makeCtx({ world: "remote" });
  const list = await call(ctx, "list", { cwd: "dsw-routes/c1/home/u", path: "/home/u" });
  check("remote list world", list.world, "remote");
  check("remote list entries", list.entries.map((e) => e.name), ["notes.md", "work"]);
  const read = await call(ctx, "read", { cwd: "ssh://c1/home/u", path: "/home/u/notes.md" });
  check("remote read", read.content, "# remote notes");
  const mk = await call(ctx, "mkdir", { cwd: "ssh://c1/home/u", path: "/home/u", name: "newdir" });
  check("remote mkdir world", mk.world, "remote");
  check("remote mkdir argv", remoteLog[0].argv, ["mkdir", "-p", "--", "/home/u/newdir"]);
  const touch = await call(ctx, "touch", { cwd: "ssh://c1/home/u", path: "/home/u", name: "f.txt" });
  check("remote touch argv", remoteLog[1].argv, ["touch", "--", "/home/u/f.txt"]);
  await call(ctx, "rename", { cwd: "ssh://c1/home/u", path: "/home/u/notes.md", name: "n2.md" });
  check("remote rename argv", remoteLog[2].argv, ["mv", "-T", "--", "/home/u/notes.md", "/home/u/n2.md"]);
  await call(ctx, "delete", { cwd: "ssh://c1/home/u", path: "/home/u/work" });
  check("remote delete argv", remoteLog[3].argv, ["rm", "-rf", "--", "/home/u/work"]);
  await rejects("remote reveal refused", call(ctx, "reveal", { cwd: "ssh://c1/home/u", path: "/home/u/notes.md" }), /remote/);
  await rejects("remote structural no subprocess", (async () => {
    const bare = { get: (n) => n === "fs" ? makeFs("remote") : void 0 };
    await call(bare, "mkdir", { cwd: "ssh://c1/home/u", path: "/home/u", name: "x" });
  })(), /subprocess/);
}
{
  const resolveLog = [];
  const { ctx } = makeCtx({ world: "remote", resolveLog });
  const ph = "C:\\Users\\u\\.dsh\\dsw-routes\\c1\\home\\u";
  const list = await call(ctx, "list", { cwd: ph, path: ph });
  check("placeholder list world", list.world, "remote");
  check("placeholder path normalized", resolveLog.at(-1).path, "/home/u");
  check("placeholder cwd kept", resolveLog.at(-1).cwd, ph);
  const list2 = await call(ctx, "list", { cwd: "E:\\local", path: "ssh://c1/home/u" });
  check("ssh:// path normalized", resolveLog.at(-1).path, "/home/u");
  check("ssh:// cwd pinned", resolveLog.at(-1).cwd, "ssh://c1/");
}
{
  const resolveLog = [];
  const { ctx } = makeCtx({ world: "local", resolveLog });
  const ph = "C:\\Users\\u\\.dsh\\dsw-routes\\c1\\home\\u";
  await call(ctx, "resolvePath", { cwd: ph, path: "E:\\Workspace" });
  check("drive path cwd stripped", resolveLog.at(-1).cwd, void 0);
  check("drive path kept", resolveLog.at(-1).path, "E:\\Workspace");
  await call(ctx, "resolvePath", { cwd: ph, path: "\\\\server\\share\\dir" });
  check("UNC path cwd stripped", resolveLog.at(-1).cwd, void 0);
  check("UNC path kept", resolveLog.at(-1).path, "\\\\server\\share\\dir");
  await call(ctx, "resolvePath", { cwd: ph, path: "/home/u/notes.md" });
  check("remote posix cwd kept", resolveLog.at(-1).cwd, ph);
}
{
  const { ctx, remoteLog } = makeCtx({ world: "remote" });
  await call(ctx, "mkdir", { cwd: "E:\\local", path: "ssh://c1/home/u", name: "made" });
  check("remote mkdir world pinned", remoteLog[0].cwd, "ssh://c1/");
  check("remote mkdir argv absolute", remoteLog[0].argv, ["mkdir", "-p", "--", "/home/u/made"]);
}
{
  const { ctx, remoteLog } = makeCtx({ world: "remote" });
  const cwd = "ssh://c1/home/u";
  await call(ctx, "createFile", { cwd, path: "/home/u/newfile.txt" });
  check("createFile probe", remoteLog[0].argv, ["test", "-e", "/home/u/newfile.txt"]);
  check("createFile touch", remoteLog[1].argv, ["touch", "--", "/home/u/newfile.txt"]);
  await call(ctx, "createDirectory", { cwd, path: "/home/u/somedir/nested" });
  check("createDirectory argv", remoteLog[2].argv, ["mkdir", "-p", "--", "/home/u/somedir/nested"]);
  await call(ctx, "renamePath", { cwd, from: "/home/u/notes.md", to: "/home/u/n2.md" });
  check("renamePath argv", remoteLog[3].argv, ["mv", "-T", "--", "/home/u/notes.md", "/home/u/n2.md"]);
  await call(ctx, "copyPath", { cwd, from: "/home/u/notes.md", to: "/home/u/n3.md" });
  check("copyPath probe", remoteLog[4].argv, ["test", "-e", "/home/u/n3.md"]);
  check("copyPath cp", remoteLog[5].argv, ["cp", "-r", "--", "/home/u/notes.md", "/home/u/n3.md"]);
  await call(ctx, "deletePath", { cwd, path: "/home/u/work" });
  check("deletePath rmdir", remoteLog[6].argv, ["rmdir", "--", "/home/u/work"]);
  await call(ctx, "deletePath", { cwd, path: "/home/u/notes.md" });
  check("deletePath rm", remoteLog[7].argv, ["rm", "--", "/home/u/notes.md"]);
  const st = await call(ctx, "statPath", { cwd, path: "/home/u/notes.md" });
  check("statPath", { path: st.path, type: st.type, world: st.world }, { path: "/home/u/notes.md", type: "file", world: "remote" });
  const du = await call(ctx, "readDataUrl", { cwd, path: "/home/u/notes.md" });
  check("readDataUrl prefix", du.dataUrl.startsWith("data:text/plain;"), true);
  check("readDataUrl world", du.world, "remote");
  const rp = await call(ctx, "resolvePath", { cwd, path: "/home/u/notes.md" });
  check("resolvePath", rp, { path: "/home/u/notes.md", world: "remote" });
  const sr = await call(ctx, "setRoot", { cwd, path: "/home/u" });
  check("setRoot remote", sr, { path: "/home/u", world: "remote" });
}
console.log(`
${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

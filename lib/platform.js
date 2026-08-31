/**
 * Platform helpers — open a directory / terminal in the host OS.
 * Shared by the host half (lib/index.js) and feature modules (lib/explorer.js)
 * without creating an import cycle.
 */
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";

/** Open a directory in the platform file manager (Explorer / Finder / xdg-open). */
export async function openDirectory({ path }) {
  if (typeof path !== "string" || path.trim() === "") throw new Error("path must be a non-empty string");
  const info = await stat(path);
  if (!info.isDirectory()) throw new Error(`not a directory: ${path}`);

  if (process.platform === "win32") {
    // Reference: futongxu9-maker/dsh-path-reveal. Spawn explorer.exe directly
    // with its full path, NO `detached`/`windowsHide` (those flags break the
    // window). Exit code 1 is normal (Explorer reuses an existing window), so
    // success is signalled by the `spawn` event, not the exit code.
    const exe = `${process.env.SystemRoot ?? "C:\\Windows"}\\explorer.exe`;
    await new Promise((resolve, reject) => {
      const child = spawn(exe, [path], { stdio: "ignore" });
      child.once("error", reject);
      child.once("spawn", () => {
        child.unref();
        resolve();
      });
    });
    process.stderr.write(`[dsh-unknownue-plugins] opened directory via explorer: ${path}\n`);
    return { opened: path, command: exe };
  }

  const command = process.platform === "darwin" ? "open" : "xdg-open";
  await new Promise((resolve, reject) => {
    const child = spawn(command, [path], { stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
  process.stderr.write(`[dsh-unknownue-plugins] opened directory via ${command}: ${path}\n`);
  return { opened: path, command };
}

/** Open a terminal window whose working directory is `path`. */
export async function openTerminal({ path }) {
  if (typeof path !== "string" || path.trim() === "") throw new Error("path must be a non-empty string");
  const info = await stat(path);
  if (!info.isDirectory()) throw new Error(`not a directory: ${path}`);

  if (process.platform === "win32") {
    // Open a new cmd window in the directory. `start "" cmd /k "cd /d <path>"`
    // (the /d flag switches drive); cmd.exe is always present.
    const cmd = `${process.env.SystemRoot ?? "C:\\Windows"}\\System32\\cmd.exe`;
    const command = `/c start "" cmd /k "cd /d ${path}"`;
    await new Promise((resolve, reject) => {
      const child = spawn(cmd, [command], { windowsVerbatimArguments: true, stdio: "ignore" });
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`cmd exited with code ${code}`));
      });
    });
    return { opened: path, command: "cmd.exe" };
  }

  if (process.platform === "darwin") {
    const escaped = path.replace(/"/g, '\\"');
    await new Promise((resolve, reject) => {
      const child = spawn("osascript", ["-e", `tell application "Terminal" to do script "cd ${escaped}"`], { stdio: "ignore" });
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`osascript exited with code ${code}`));
      });
    });
    return { opened: path, command: "Terminal" };
  }

  await new Promise((resolve, reject) => {
    const child = spawn("x-terminal-emulator", ["--working-directory", path], { stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
  return { opened: path, command: "x-terminal-emulator" };
}

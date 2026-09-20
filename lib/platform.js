// src/host/platform.ts
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
function requirePath(path) {
  if (typeof path !== "string" || path.trim() === "") throw new Error("path must be a non-empty string");
  return path;
}
async function openTerminal({ path }) {
  const checked = requirePath(path);
  const info = await stat(checked);
  if (!info.isDirectory()) throw new Error(`not a directory: ${checked}`);
  if (process.platform === "win32") {
    const cmd = `${process.env.SystemRoot ?? "C:\\Windows"}\\System32\\cmd.exe`;
    const command = `/c start "" cmd /k "cd /d ${checked}"`;
    await new Promise((resolve, reject) => {
      const child = spawn(cmd, [command], { windowsVerbatimArguments: true, stdio: "ignore" });
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`cmd exited with code ${code}`));
      });
    });
    return { opened: checked, command: "cmd.exe" };
  }
  if (process.platform === "darwin") {
    const escaped = checked.replace(/"/g, '\\"');
    await new Promise((resolve, reject) => {
      const child = spawn("osascript", ["-e", `tell application "Terminal" to do script "cd ${escaped}"`], { stdio: "ignore" });
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`osascript exited with code ${code}`));
      });
    });
    return { opened: checked, command: "Terminal" };
  }
  await new Promise((resolve, reject) => {
    const child = spawn("x-terminal-emulator", ["--working-directory", checked], { stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
  return { opened: checked, command: "x-terminal-emulator" };
}
export {
  openTerminal
};

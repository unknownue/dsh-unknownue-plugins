/**
 * Platform helpers — open a terminal window in the host OS.
 *
 * Opening a directory in the OS file manager is deliberately NOT implemented
 * here: DSH ships that itself (the open-in-app plugin,
 * `@deepseek-ai/dsh-host-open-in-app` + `@deepseek-ai/dsh-client-ui-open-in-app`,
 * whose session-header button launches the session's workspace directory in a
 * locally installed application), so this bundle carries no directory-opening
 * code at all.
 */
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";

function requirePath(path: unknown): string {
  if (typeof path !== "string" || path.trim() === "") throw new Error("path must be a non-empty string");
  return path;
}

/** Open a terminal window whose working directory is `path`. */
export async function openTerminal({ path }: { path: string }): Promise<{ opened: string; command: string }> {
  const checked = requirePath(path);
  const info = await stat(checked);
  if (!info.isDirectory()) throw new Error(`not a directory: ${checked}`);

  if (process.platform === "win32") {
    // Open a new cmd window in the directory. `start "" cmd /k "cd /d <path>"`
    // (the /d flag switches drive); cmd.exe is always present.
    const cmd = `${process.env.SystemRoot ?? "C:\\Windows"}\\System32\\cmd.exe`;
    const command = `/c start "" cmd /k "cd /d ${checked}"`;
    await new Promise<void>((resolve, reject) => {
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
    await new Promise<void>((resolve, reject) => {
      const child = spawn("osascript", ["-e", `tell application "Terminal" to do script "cd ${escaped}"`], { stdio: "ignore" });
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`osascript exited with code ${code}`));
      });
    });
    return { opened: checked, command: "Terminal" };
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn("x-terminal-emulator", ["--working-directory", checked], { stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
  return { opened: checked, command: "x-terminal-emulator" };
}

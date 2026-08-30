/**
 * Feature #4 — Remote control via SSH.
 *
 * Executes commands, transfers files, and manages reverse SSH tunnels on
 * configured remote machines. All host references resolve through the user's
 * ~/.ssh/config aliases — no credentials are stored in this plugin.
 *
 * Configuration (cordis.patch.yml):
 *   remote:
 *     hosts:
 *       - id: home
 *         sshHost: home        # ~/.ssh/config Host alias
 *         label: "家里机器"
 *         description: "Ubuntu server"
 *     tunnel:
 *       monitorHost: ecs       # which host to check tunnel port on
 *       tunnelPort: 2222
 *       serviceHost: home      # which host runs the systemd service
 *       serviceName: reverse-ssh-tunnel.service
 */
import { exec } from "node:child_process";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Run a shell command and return { stdout, stderr, exitCode }. */
function run(command, { timeout = 30_000, maxBuffer = 10 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const child = exec(command, { timeout, maxBuffer, encoding: "utf8" }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        exitCode: error ? (error.code ?? 1) : 0
      });
    });
    child.on("error", reject);
  });
}

/** Find a host config entry by id. */
function findHost(config, hostId) {
  const hosts = config.remote?.hosts;
  if (!Array.isArray(hosts) || hosts.length === 0) {
    throw new Error("no remote hosts configured");
  }
  const host = hosts.find(h => h.id === hostId);
  if (!host) {
    const available = hosts.map(h => h.id).join(", ");
    throw new Error(`unknown host "${hostId}"; available: ${available}`);
  }
  if (typeof host.sshHost !== "string" || host.sshHost.trim() === "") {
    throw new Error(`host "${hostId}" has no sshHost configured`);
  }
  return host;
}

/** Get the tunnel config, or throw if not configured. */
function requireTunnel(config) {
  const tunnel = config.remote?.tunnel;
  if (!tunnel || typeof tunnel !== "object") {
    throw new Error("tunnel not configured (remote.tunnel is missing)");
  }
  return tunnel;
}

/** Quote a string for safe shell embedding. */
function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

// ── remote command execution ─────────────────────────────────────────────────

async function execCommand(config, { hostId, command, timeout }) {
  const host = findHost(config, hostId);
  if (typeof command !== "string" || command.trim() === "") {
    throw new Error("command must be a non-empty string");
  }
  const t = typeof timeout === "number" && timeout > 0 ? timeout * 1000 : 30_000;
  const sshCmd = `ssh -o BatchMode=yes -o ConnectTimeout=5 ${shellQuote(host.sshHost)} ${shellQuote(command)}`;
  process.stderr.write(`[dsh-unknownue-plugins] remote exec on ${hostId}: ${command}\n`);
  return run(sshCmd, { timeout: t });
}

// ── file transfer ────────────────────────────────────────────────────────────

async function uploadFile(config, { hostId, localPath, remotePath }) {
  const host = findHost(config, hostId);
  if (typeof localPath !== "string" || localPath.trim() === "") throw new Error("localPath must be a non-empty string");
  if (typeof remotePath !== "string" || remotePath.trim() === "") throw new Error("remotePath must be a non-empty string");

  const absLocal = resolve(localPath);
  const info = await stat(absLocal).catch(() => null);
  if (!info) throw new Error(`local file not found: ${absLocal}`);

  const scpCmd = `scp -o BatchMode=yes -o ConnectTimeout=5 ${shellQuote(absLocal)} ${shellQuote(host.sshHost + ":" + remotePath)}`;
  process.stderr.write(`[dsh-unknownue-plugins] upload ${absLocal} → ${hostId}:${remotePath}\n`);
  const result = await run(scpCmd, { timeout: 120_000 });
  if (result.exitCode !== 0) throw new Error(`scp failed: ${result.stderr || result.stdout}`);
  return { uploaded: absLocal, to: `${host.sshHost}:${remotePath}`, size: info.size };
}

async function downloadFile(config, { hostId, remotePath, localPath }) {
  const host = findHost(config, hostId);
  if (typeof remotePath !== "string" || remotePath.trim() === "") throw new Error("remotePath must be a non-empty string");
  if (typeof localPath !== "string" || localPath.trim() === "") throw new Error("localPath must be a non-empty string");

  const absLocal = resolve(localPath);
  const scpCmd = `scp -o BatchMode=yes -o ConnectTimeout=5 ${shellQuote(host.sshHost + ":" + remotePath)} ${shellQuote(absLocal)}`;
  process.stderr.write(`[dsh-unknownue-plugins] download ${hostId}:${remotePath} → ${absLocal}\n`);
  const result = await run(scpCmd, { timeout: 120_000 });
  if (result.exitCode !== 0) throw new Error(`scp failed: ${result.stderr || result.stdout}`);

  const info = await stat(absLocal).catch(() => null);
  return { downloaded: absLocal, from: `${host.sshHost}:${remotePath}`, size: info?.size ?? null };
}

// ── status check ─────────────────────────────────────────────────────────────

async function pingHost(sshHost) {
  const result = await run(`ssh -o BatchMode=yes -o ConnectTimeout=5 ${shellQuote(sshHost)} "echo ok"`, { timeout: 10_000 });
  return {
    reachable: result.exitCode === 0 && result.stdout.trim() === "ok",
    error: result.exitCode !== 0 ? (result.stderr || "exit code " + result.exitCode) : null
  };
}

async function checkTunnelStatus(config) {
  const tunnel = requireTunnel(config);
  const monitorHost = findHost(config, tunnel.monitorHost);
  const port = tunnel.tunnelPort ?? 2222;

  // Check if tunnel port is listening on the monitor host
  const portCheck = await run(
    `ssh -o BatchMode=yes -o ConnectTimeout=5 ${shellQuote(monitorHost.sshHost)} "ss -tlnp | grep :${port}"`,
    { timeout: 10_000 }
  );
  const portListening = portCheck.exitCode === 0 && portCheck.stdout.includes(`:${port}`);

  // Check systemd service status on the service host
  let serviceInfo = null;
  if (tunnel.serviceHost && tunnel.serviceName) {
    const serviceHost = findHost(config, tunnel.serviceHost);
    const svcResult = await run(
      `ssh -o BatchMode=yes -o ConnectTimeout=5 ${shellQuote(serviceHost.sshHost)} "systemctl --user status ${shellQuote(tunnel.serviceName)} 2>&1"`,
      { timeout: 10_000 }
    );
    const stdout = svcResult.stdout;
    const activeMatch = /Active:\s*(\S+)/.exec(stdout);
    const uptimeMatch = /Active:\s*\S+\s+\(([^)]+)\)\s+since\s+(.+?);/.exec(stdout);
    serviceInfo = {
      active: activeMatch ? activeMatch[1] === "active" : false,
      status: activeMatch ? activeMatch[1] : "unknown",
      uptime: uptimeMatch ? uptimeMatch[2].trim() : null,
      raw: stdout
    };
  }

  return {
    portListening,
    port,
    monitorHost: tunnel.monitorHost,
    service: serviceInfo
  };
}

async function checkAllStatus(config) {
  const hosts = config.remote?.hosts;
  if (!Array.isArray(hosts)) return { hosts: {}, tunnel: null };

  // Ping all hosts in parallel
  const hostResults = {};
  await Promise.all(hosts.map(async (host) => {
    hostResults[host.id] = {
      ...host,
      ...(await pingHost(host.sshHost))
    };
  }));

  // Check tunnel if configured
  let tunnel = null;
  if (config.remote?.tunnel) {
    try {
      tunnel = await checkTunnelStatus(config);
    } catch (error) {
      tunnel = { error: error instanceof Error ? error.message : String(error) };
    }
  }

  return { hosts: hostResults, tunnel };
}

// ── tunnel management ────────────────────────────────────────────────────────

async function tunnelAction(config, action) {
  const tunnel = requireTunnel(config);
  const serviceHost = findHost(config, tunnel.serviceHost);
  const serviceName = tunnel.serviceName ?? "reverse-ssh-tunnel.service";

  const validActions = ["start", "stop", "restart"];
  if (!validActions.includes(action)) {
    throw new Error(`invalid tunnel action "${action}"; use: ${validActions.join(", ")}`);
  }

  const cmd = `systemctl --user ${action} ${shellQuote(serviceName)}`;
  const sshCmd = `ssh -o BatchMode=yes -o ConnectTimeout=5 ${shellQuote(serviceHost.sshHost)} ${shellQuote(cmd)}`;
  process.stderr.write(`[dsh-unknownue-plugins] tunnel ${action} on ${serviceHost.sshHost}\n`);
  const result = await run(sshCmd, { timeout: 15_000 });

  // Restarting the tunnel service may drop the SSH connection (exit code != 0).
  // That is expected — the service restart still succeeds. Only throw if the
  // action is "stop" (where the connection should survive) and it fails.
  if (result.exitCode !== 0 && action !== "restart") {
    // For start/stop, a non-zero exit is a real error
    if (action === "stop" || (action === "start" && !result.stderr.includes("closed by remote host"))) {
      throw new Error(`tunnel ${action} failed: ${result.stderr || result.stdout}`);
    }
  }

  // Wait for the service to settle, then return new status
  await new Promise(r => setTimeout(r, 2000));
  try {
    const status = await checkTunnelStatus(config);
    return { action, ...status };
  } catch {
    // If status check fails (e.g. tunnel still restarting), return minimal info
    return { action, portListening: action === "stop" ? false : true, port: tunnel.tunnelPort ?? 2222, service: null };
  }
}

// ── route dispatch ───────────────────────────────────────────────────────────

export async function remoteDispatch(config, method, params) {
  switch (method) {
    case "exec":
      return execCommand(config, params);
    case "upload":
      return uploadFile(config, params);
    case "download":
      return downloadFile(config, params);
    case "status":
      return checkAllStatus(config);
    case "tunnel.start":
      return tunnelAction(config, "start");
    case "tunnel.stop":
      return tunnelAction(config, "stop");
    case "tunnel.restart":
      return tunnelAction(config, "restart");
    default:
      throw new Error(`unknown method "${method}"`);
  }
}

/**
 * Feature #4 — Remote control via SSH.
 *
 * Executes commands, transfers files, and manages reverse SSH tunnels on
 * configured remote machines. Host configuration is stored independently in
 * ~/.dsh/remote-hosts.json — no dependency on ~/.ssh/config.
 *
 * Host config format (managed via UI):
 *   {
 *     "hosts": [
 *       {
 *         "id": "home",
 *         "label": "家里机器",
 *         "description": "Ubuntu server",
 *         "hostName": "1.2.3.4",
 *         "port": 22,
 *         "user": "unknownue",
 *         "keyPath": "~/.ssh/id_rsa",
 *         "tunnel": {
 *           "enabled": true,
 *           "port": 2222,
 *           "serviceName": "reverse-ssh-tunnel.service"
 *         }
 *       }
 *     ]
 *   }
 */
import { exec } from "node:child_process";
import { readFile, writeFile, mkdir, stat, access } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { homedir } from "node:os";

// ── constants ────────────────────────────────────────────────────────────────

const CONFIG_PATH = resolve(homedir(), ".dsh", "remote-hosts.json");

// ── helpers ──────────────────────────────────────────────────────────────────

/** Run a shell command and return { stdout, stderr, exitCode }. */
function run(command, { timeout = 30_000, maxBuffer = 10 * 1024 * 1024 } = {}) {
  return new Promise((res) => {
    const child = exec(command, { timeout, maxBuffer, encoding: "utf8" }, (error, stdout, stderr) => {
      res({
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        exitCode: error ? (error.code ?? 1) : 0
      });
    });
    child.on("error", (err) => {
      res({ stdout: "", stderr: err.message, exitCode: 1 });
    });
  });
}

/** Quote a string for safe shell embedding. */
function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

/** Expand ~ to home directory. */
function expandHome(p) {
  if (typeof p !== "string") return p;
  if (p.startsWith("~/") || p === "~") return resolve(homedir(), p.slice(2));
  return p;
}

// ── host config persistence ──────────────────────────────────────────────────

async function readHostsConfig() {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.hosts)) return parsed;
  } catch {}
  return { hosts: [] };
}

async function writeHostsConfig(data) {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function findHostById(hosts, id) {
  const host = hosts.find(h => h.id === id);
  if (!host) {
    const available = hosts.map(h => h.id).join(", ") || "(none)";
    throw new Error(`host "${id}" not found; available: ${available}`);
  }
  return host;
}

// ── SSH command construction ─────────────────────────────────────────────────

/** Build SSH options for a host. */
function sshOpts(host) {
  const parts = [
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=5",
    "-o", "StrictHostKeyChecking=accept-new"
  ];
  if (host.keyPath) parts.push("-i", expandHome(host.keyPath));
  if (host.port && host.port !== 22) parts.push("-p", String(host.port));
  return parts;
}

/** Build full SSH command string for executing a remote command. */
function sshExecCmd(host, command) {
  const opts = sshOpts(host);
  const target = `${host.user}@${host.hostName}`;
  return `ssh ${opts.map(shellQuote).join(" ")} ${shellQuote(target)} ${shellQuote(command)}`;
}

/** Build full SCP command string. */
function scpCmd(host, src, dest) {
  const opts = sshOpts(host);
  // SCP uses -P for port (not -p like ssh)
  const scpOpts = opts.filter((_, i) => !(i > 0 && opts[i - 1] === "-p"));
  if (host.port && host.port !== 22) {
    scpOpts.push("-P", String(host.port));
  }
  return `scp ${scpOpts.map(shellQuote).join(" ")} ${shellQuote(src)} ${shellQuote(dest)}`;
}

/** Build SCP target string: user@host:path */
function scpTarget(host, remotePath) {
  return `${host.user}@${host.hostName}:${remotePath}`;
}

// ── host management (CRUD) ───────────────────────────────────────────────────

async function listHosts() {
  const config = await readHostsConfig();
  return config.hosts.map(({ id, label, description, hostName, port, user, tunnel }) => ({
    id, label, description, hostName, port: port ?? 22, user,
    hasTunnel: !!(tunnel && tunnel.enabled)
  }));
}

async function addHost(params) {
  const { id, label, description, hostName, port, user, keyPath, tunnel } = params;
  if (!id || !hostName || !user) throw new Error("id, hostName, and user are required");

  const config = await readHostsConfig();
  if (config.hosts.some(h => h.id === id)) throw new Error(`host "${id}" already exists`);

  const host = {
    id: String(id).trim(),
    label: label || id,
    description: description || "",
    hostName: String(hostName).trim(),
    port: typeof port === "number" ? port : 22,
    user: String(user).trim(),
    keyPath: keyPath || null,
    tunnel: tunnel || null
  };
  config.hosts.push(host);
  await writeHostsConfig(config);
  process.stderr.write(`[dsh-unknownue-plugins] added host: ${id}\n`);
  return { added: host.id };
}

async function updateHost(params) {
  const { id, ...fields } = params;
  if (!id) throw new Error("id is required");

  const config = await readHostsConfig();
  const idx = config.hosts.findIndex(h => h.id === id);
  if (idx < 0) throw new Error(`host "${id}" not found`);

  // Merge fields
  const existing = config.hosts[idx];
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) existing[key] = value;
  }
  config.hosts[idx] = existing;
  await writeHostsConfig(config);
  process.stderr.write(`[dsh-unknownue-plugins] updated host: ${id}\n`);
  return { updated: id };
}

async function removeHost(params) {
  const { id } = params;
  if (!id) throw new Error("id is required");

  const config = await readHostsConfig();
  const idx = config.hosts.findIndex(h => h.id === id);
  if (idx < 0) throw new Error(`host "${id}" not found`);

  config.hosts.splice(idx, 1);
  await writeHostsConfig(config);
  process.stderr.write(`[dsh-unknownue-plugins] removed host: ${id}\n`);
  return { removed: id };
}

// ── connection test ──────────────────────────────────────────────────────────

async function testHost(params) {
  const { id, hostName, port, user, keyPath } = params;

  // If id is provided, look up from config; otherwise use inline params
  let host;
  if (id) {
    const config = await readHostsConfig();
    host = findHostById(config.hosts, id);
  } else {
    if (!hostName || !user) throw new Error("hostName and user are required (or provide id)");
    host = { hostName, port: port ?? 22, user, keyPath: keyPath || null };
  }

  const start = Date.now();
  const result = await run(sshExecCmd(host, "echo ok"), { timeout: 10_000 });
  const latency = Date.now() - start;

  const reachable = result.exitCode === 0 && result.stdout.trim() === "ok";
  return {
    reachable,
    latency,
    error: reachable ? null : (result.stderr || "exit code " + result.exitCode)
  };
}

// ── remote command execution ─────────────────────────────────────────────────

async function execCommand(params) {
  const { hostId, command, timeout } = params;
  if (!hostId) throw new Error("hostId is required");
  if (typeof command !== "string" || command.trim() === "") throw new Error("command must be a non-empty string");

  const config = await readHostsConfig();
  const host = findHostById(config.hosts, hostId);
  const t = typeof timeout === "number" && timeout > 0 ? timeout * 1000 : 30_000;

  process.stderr.write(`[dsh-unknownue-plugins] exec on ${hostId}: ${command}\n`);
  return run(sshExecCmd(host, command), { timeout: t });
}

// ── file transfer ────────────────────────────────────────────────────────────

async function uploadFile(params) {
  const { hostId, localPath, remotePath } = params;
  if (!hostId) throw new Error("hostId is required");
  if (!localPath) throw new Error("localPath is required");
  if (!remotePath) throw new Error("remotePath is required");

  const config = await readHostsConfig();
  const host = findHostById(config.hosts, hostId);

  const absLocal = resolve(localPath);
  const info = await stat(absLocal).catch(() => null);
  if (!info) throw new Error(`local file not found: ${absLocal}`);

  const cmd = scpCmd(host, absLocal, scpTarget(host, remotePath));
  process.stderr.write(`[dsh-unknownue-plugins] upload ${absLocal} → ${hostId}:${remotePath}\n`);
  const result = await run(cmd, { timeout: 120_000 });
  if (result.exitCode !== 0) throw new Error(`scp failed: ${result.stderr || result.stdout}`);
  return { uploaded: absLocal, to: `${host.hostName}:${remotePath}`, size: info.size };
}

async function downloadFile(params) {
  const { hostId, remotePath, localPath } = params;
  if (!hostId) throw new Error("hostId is required");
  if (!remotePath) throw new Error("remotePath is required");
  if (!localPath) throw new Error("localPath is required");

  const config = await readHostsConfig();
  const host = findHostById(config.hosts, hostId);

  const absLocal = resolve(localPath);
  const cmd = scpCmd(host, scpTarget(host, remotePath), absLocal);
  process.stderr.write(`[dsh-unknownue-plugins] download ${hostId}:${remotePath} → ${absLocal}\n`);
  const result = await run(cmd, { timeout: 120_000 });
  if (result.exitCode !== 0) throw new Error(`scp failed: ${result.stderr || result.stdout}`);

  const info = await stat(absLocal).catch(() => null);
  return { downloaded: absLocal, from: `${host.hostName}:${remotePath}`, size: info?.size ?? null };
}

// ── status check ─────────────────────────────────────────────────────────────

async function pingHost(host) {
  const result = await run(sshExecCmd(host, "echo ok"), { timeout: 10_000 });
  return {
    reachable: result.exitCode === 0 && result.stdout.trim() === "ok",
    error: result.exitCode !== 0 ? (result.stderr || "exit code " + result.exitCode) : null
  };
}

async function checkTunnelForHost(host) {
  if (!host.tunnel || !host.tunnel.enabled) return null;
  const port = host.tunnel.port ?? 2222;

  // Check if tunnel port is listening on this host
  const portCheck = await run(sshExecCmd(host, `ss -tlnp | grep :${port}`), { timeout: 10_000 });
  const portListening = portCheck.exitCode === 0 && portCheck.stdout.includes(`:${port}`);

  // Check systemd service status
  let serviceInfo = null;
  if (host.tunnel.serviceName) {
    const svcResult = await run(
      sshExecCmd(host, `systemctl --user status ${shellQuote(host.tunnel.serviceName)} 2>&1`),
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

  return { portListening, port, service: serviceInfo };
}

async function checkAllStatus() {
  const config = await readHostsConfig();
  if (config.hosts.length === 0) return { hosts: {}, tunnel: null };

  const hostResults = {};
  await Promise.all(config.hosts.map(async (host) => {
    const ping = await pingHost(host);
    const tunnel = await checkTunnelForHost(host).catch(() => null);
    hostResults[host.id] = {
      id: host.id,
      label: host.label,
      description: host.description,
      hostName: host.hostName,
      ...ping,
      tunnel
    };
  }));

  return { hosts: hostResults };
}

// ── tunnel management ────────────────────────────────────────────────────────

async function tunnelAction(params, action) {
  const { hostId } = params;
  if (!hostId) throw new Error("hostId is required");

  const config = await readHostsConfig();
  const host = findHostById(config.hosts, hostId);

  if (!host.tunnel || !host.tunnel.enabled) {
    throw new Error(`host "${hostId}" has no tunnel configured`);
  }

  const serviceName = host.tunnel.serviceName ?? "reverse-ssh-tunnel.service";
  const validActions = ["start", "stop", "restart"];
  if (!validActions.includes(action)) {
    throw new Error(`invalid tunnel action "${action}"; use: ${validActions.join(", ")}`);
  }

  const cmd = `systemctl --user ${action} ${shellQuote(serviceName)}`;
  process.stderr.write(`[dsh-unknownue-plugins] tunnel ${action} on ${hostId}\n`);
  const result = await run(sshExecCmd(host, cmd), { timeout: 15_000 });

  // Restarting the tunnel service may drop the SSH connection — that's expected
  if (result.exitCode !== 0 && action !== "restart") {
    if (action === "stop" || (action === "start" && !result.stderr.includes("closed by remote host"))) {
      throw new Error(`tunnel ${action} failed: ${result.stderr || result.stdout}`);
    }
  }

  // Wait for the service to settle, then return new status
  await new Promise(r => setTimeout(r, 2000));
  try {
    const tunnel = await checkTunnelForHost(host);
    return { action, hostId, ...tunnel };
  } catch {
    return { action, hostId, portListening: action === "stop" ? false : true, port: host.tunnel.port ?? 2222, service: null };
  }
}

// ── SSH key management ───────────────────────────────────────────────────────

const DEFAULT_KEY_PATH = resolve(homedir(), ".ssh", "id_ed25519");

/** Check if an SSH private key exists. */
async function sshKeyExists(keyPath) {
  try {
    await access(keyPath);
    return true;
  } catch {
    return false;
  }
}

/** Generate an SSH ed25519 key pair. */
async function sshGenerateKey(params) {
  const keyPath = params?.keyPath ? expandHome(params.keyPath) : DEFAULT_KEY_PATH;
  const comment = params?.comment || `${homedir().split("/").pop()}@dsh-remote`;

  // Check if key already exists
  if (await sshKeyExists(keyPath)) {
    // Read existing public key
    const pubPath = keyPath + ".pub";
    const pubContent = await readFile(pubPath, "utf8").catch(() => null);
    return {
      existed: true,
      keyPath,
      publicKey: pubContent ? pubContent.trim() : null,
      message: "密钥已存在"
    };
  }

  // Ensure ~/.ssh directory exists
  await mkdir(dirname(keyPath), { recursive: true, mode: 0o700 });

  // Generate key
  const cmd = `ssh-keygen -t ed25519 -N "" -f ${shellQuote(keyPath)} -C ${shellQuote(comment)}`;
  const result = await run(cmd, { timeout: 10_000 });
  if (result.exitCode !== 0) {
    throw new Error(`ssh-keygen failed: ${result.stderr || result.stdout}`);
  }

  // Read the generated public key
  const pubPath = keyPath + ".pub";
  const pubContent = await readFile(pubPath, "utf8");

  process.stderr.write(`[dsh-unknownue-plugins] generated SSH key: ${keyPath}\n`);
  return {
    existed: false,
    keyPath,
    publicKey: pubContent.trim(),
    message: "密钥生成成功"
  };
}

/** Get the public key content. */
async function sshGetPublicKey(params) {
  const keyPath = params?.keyPath ? expandHome(params.keyPath) : DEFAULT_KEY_PATH;
  const pubPath = keyPath + ".pub";

  const content = await readFile(pubPath, "utf8").catch(() => null);
  if (!content) throw new Error(`公钥文件不存在: ${pubPath}`);

  return {
    keyPath,
    publicKey: content.trim()
  };
}

/** Push public key to a remote host's authorized_keys. */
async function sshPushKey(params) {
  const { hostId, hostName, port, user, keyPath: paramKeyPath, password } = params;

  // Get host config - either from saved config or inline params
  let host;
  if (hostId) {
    try {
      const config = await readHostsConfig();
      host = findHostById(config.hosts, hostId);
    } catch {
      // Host not saved yet, use inline params
      if (!hostName || !user) throw new Error("hostName and user are required");
      host = { hostName, port: port ?? 22, user, keyPath: paramKeyPath || null };
    }
  } else {
    if (!hostName || !user) throw new Error("hostName and user are required (or provide hostId)");
    host = { hostName, port: port ?? 22, user, keyPath: paramKeyPath || null };
  }

  // Get local public key
  const localKeyPath = host.keyPath ? expandHome(host.keyPath) : DEFAULT_KEY_PATH;
  const pubPath = localKeyPath + ".pub";
  const pubContent = await readFile(pubPath, "utf8").catch(() => null);
  if (!pubContent) throw new Error(`本地公钥不存在: ${pubPath}，请先生成密钥`);

  const pubKey = pubContent.trim();

  // Build command to add key to remote authorized_keys
  const escapedKey = pubKey.replace(/'/g, "'\\''");
  const remoteCmd = `mkdir -p ~/.ssh && echo '${escapedKey}' >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys && echo ok`;

  // If password is provided, use sshpass for password auth
  let sshCmd;
  if (password) {
    const target = `${host.user}@${host.hostName}`;
    const portFlag = host.port && host.port !== 22 ? `-p ${host.port}` : "";
    sshCmd = `sshpass -p ${shellQuote(password)} ssh -o StrictHostKeyChecking=accept-new ${portFlag} ${shellQuote(target)} ${shellQuote(remoteCmd)}`;
  } else {
    sshCmd = sshExecCmd(host, remoteCmd);
  }

  process.stderr.write(`[dsh-unknownue-plugins] pushing SSH key to ${host.hostName}\n`);
  const result = await run(sshCmd, { timeout: 15_000 });

  if (result.exitCode !== 0) {
    const stderr = result.stderr;
    if (stderr.includes("Permission denied") || stderr.includes("password")) {
      throw new Error("认证失败：需要密码或密钥。请确保远程主机已配置密钥认证，或提供密码。");
    }
    throw new Error(`推送公钥失败: ${stderr || result.stdout}`);
  }

  return {
    pushed: true,
    hostName: host.hostName,
    message: "公钥已添加到远程主机的 authorized_keys"
  };
}

// ── route dispatch ───────────────────────────────────────────────────────────

export async function remoteDispatch(_config, method, params) {
  switch (method) {
    // Host management
    case "hosts.list":
      return listHosts();
    case "hosts.add":
      return addHost(params);
    case "hosts.update":
      return updateHost(params);
    case "hosts.remove":
      return removeHost(params);
    case "hosts.test":
      return testHost(params);
    // SSH key management
    case "ssh.generateKey":
      return sshGenerateKey(params);
    case "ssh.getPublicKey":
      return sshGetPublicKey(params);
    case "ssh.pushKey":
      return sshPushKey(params);
    // Remote operations
    case "exec":
      return execCommand(params);
    case "upload":
      return uploadFile(params);
    case "download":
      return downloadFile(params);
    case "status":
      return checkAllStatus();
    // Tunnel management
    case "tunnel.restart":
      return tunnelAction(params, "restart");
    case "tunnel.stop":
      return tunnelAction(params, "stop");
    case "tunnel.start":
      return tunnelAction(params, "start");
    default:
      throw new Error(`unknown method "${method}"`);
  }
}

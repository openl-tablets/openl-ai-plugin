import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const CONFIG_VERSION = 1;
const CONFIG_FILE = "codex.json";
const MAX_SETTINGS_BYTES = 1024 * 1024;
const PROBE_TIMEOUT_MS = 10_000;

export function assertSupportedNode(version = process.versions.node) {
  const major = Number.parseInt(String(version).split(".", 1)[0], 10);
  if (!Number.isInteger(major) || major < 24) {
    throw new Error(`Node.js 24 or later is required (found ${version || "unknown"}).`);
  }
}

export function resolveConfigDir({
  env = process.env,
  home = homedir(),
  platform = process.platform,
} = {}) {
  if (env.OPENL_AI_CONFIG_DIR) {
    return resolve(env.OPENL_AI_CONFIG_DIR);
  }
  if (platform === "win32" && env.APPDATA) {
    return join(env.APPDATA, "openl-ai");
  }
  if (env.XDG_CONFIG_HOME) {
    return join(env.XDG_CONFIG_HOME, "openl-ai");
  }
  return join(home, ".config", "openl-ai");
}

export function resolveConfigPath(options = {}) {
  return join(resolveConfigDir(options), CONFIG_FILE);
}

export function isInsecureOptIn(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

export function normalizeBaseUrl(rawValue, { allowInsecure = false } = {}) {
  const value = String(rawValue ?? "").trim();
  if (!value) {
    throw new Error("OpenL Studio address is required.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("OpenL Studio address must be an absolute http:// or https:// URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("OpenL Studio address must use https:// (or http:// for loopback development only).");
  }
  if (url.username || url.password) {
    throw new Error("OpenL Studio address must not contain a username or password.");
  }
  if (url.search || url.hash) {
    throw new Error("OpenL Studio address must not contain a query string or fragment.");
  }

  // HTTP is always fine for loopback. For any other host it is refused by
  // default so credentials never travel unencrypted; a deployment on a trusted
  // internal network can opt in explicitly (--allow-insecure /
  // OPENL_AI_ALLOW_INSECURE=1), which is persisted in the config so the launcher
  // honors it too.
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (
    url.protocol === "http:" &&
    !loopbackHosts.has(url.hostname.toLowerCase()) &&
    !allowInsecure
  ) {
    throw new Error(
      "Use HTTPS when connecting to a non-local OpenL Studio so credentials stay encrypted. " +
        "For a trusted internal HTTP deployment, opt in with --allow-insecure (or OPENL_AI_ALLOW_INSECURE=1).",
    );
  }

  const path = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host}${path}`;
}

async function readLimitedBody(response, maxBytes) {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("OpenL Studio settings response is unexpectedly large.");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function probeStudio(
  baseUrl,
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = PROBE_TIMEOUT_MS,
    maxBytes = MAX_SETTINGS_BYTES,
    allowInsecure = false,
  } = {},
) {
  if (typeof fetchImpl !== "function") {
    throw new Error("This Node.js runtime does not provide fetch(). Node.js 24 or later is required.");
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, { allowInsecure });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  let body;
  try {
    response = await fetchImpl(`${normalizedBaseUrl}/rest/settings`, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    body = await readLimitedBody(response, maxBytes);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`OpenL Studio did not respond within ${Math.ceil(timeoutMs / 1000)} seconds.`);
    }
    throw new Error(`Cannot reach OpenL Studio: ${error?.message ?? String(error)}`);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status !== 200) {
    throw new Error(`OpenL Studio settings probe returned HTTP ${response.status}.`);
  }

  let settings;
  try {
    settings = JSON.parse(body);
  } catch {
    throw new Error("OpenL Studio settings probe did not return valid JSON.");
  }
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("OpenL Studio settings response has an unexpected shape.");
  }
  if (
    !settings.supportedFeatures ||
    typeof settings.supportedFeatures !== "object" ||
    Array.isArray(settings.supportedFeatures)
  ) {
    throw new Error("OpenL Studio settings response does not contain supportedFeatures.");
  }

  const multiUser = settings.userMode != null;
  const personalAccessToken = settings.supportedFeatures.personalAccessToken === true;
  return {
    baseUrl: normalizedBaseUrl,
    multiUser,
    personalAccessToken,
  };
}

function validateConfig(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Codex configuration must contain a JSON object.");
  }
  if (payload.version !== CONFIG_VERSION) {
    throw new Error(`Unsupported Codex configuration version: ${payload.version ?? "missing"}.`);
  }

  const allowInsecure = payload.allowInsecure === true;
  const baseUrl = normalizeBaseUrl(payload.baseUrl, { allowInsecure });
  const token = typeof payload.personalAccessToken === "string"
    ? payload.personalAccessToken.trim()
    : "";
  return {
    version: CONFIG_VERSION,
    baseUrl,
    ...(allowInsecure ? { allowInsecure: true } : {}),
    ...(token ? { personalAccessToken: token } : {}),
  };
}

async function inspectPrivateFile(path, platform) {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new Error(`Refusing to read ${path}: configuration must be a regular file, not a symlink.`);
  }
  if (platform !== "win32" && (info.mode & 0o077) !== 0) {
    throw new Error(`Refusing to read ${path}: permissions must be 0600.`);
  }
  return info;
}

async function preparePrivateDirectory(directory, platform) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error(`Refusing to use ${directory}: configuration directory must not be a symlink.`);
  }
  if (platform !== "win32") {
    await chmod(directory, 0o700);
  }
}

async function inspectExistingDestination(configPath, platform) {
  try {
    await inspectPrivateFile(configPath, platform);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function readCodexConfig({
  configPath = resolveConfigPath(),
  platform = process.platform,
} = {}) {
  try {
    await inspectPrivateFile(configPath, platform);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("Codex is not configured for OpenL Studio. Run the bundled configure-codex.mjs script first.");
    }
    throw error;
  }

  let raw;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Codex is not configured for OpenL Studio. Run the bundled configure-codex.mjs script first.`);
    }
    throw error;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`Codex configuration is not valid JSON: ${configPath}`);
  }
  return validateConfig(payload);
}

export async function writeCodexConfig(
  payload,
  { configPath = resolveConfigPath(), platform = process.platform } = {},
) {
  const config = validateConfig(payload);
  const directory = dirname(configPath);
  await preparePrivateDirectory(directory, platform);
  const destinationExists = await inspectExistingDestination(configPath, platform);

  const temporaryPath = `${configPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    if (platform !== "win32") {
      await chmod(temporaryPath, 0o600);
    }
    try {
      await rename(temporaryPath, configPath);
    } catch (error) {
      if (
        platform !== "win32" ||
        !destinationExists ||
        !["EEXIST", "EPERM"].includes(error?.code)
      ) {
        throw error;
      }
      const backupPath = `${configPath}.${process.pid}.${randomUUID()}.bak`;
      await rename(configPath, backupPath);
      try {
        await rename(temporaryPath, configPath);
      } catch (replacementError) {
        await rename(backupPath, configPath);
        throw replacementError;
      }
      await rm(backupPath, { force: true });
    }
  } finally {
    await rm(temporaryPath, { force: true });
  }
  return { config, configPath };
}

export async function clearCodexConfig({ configPath = resolveConfigPath() } = {}) {
  await rm(configPath, { force: true });
  return configPath;
}

export function safeConfigStatus(config) {
  return {
    configured: true,
    baseUrl: config.baseUrl,
    authentication: config.personalAccessToken ? "personal-access-token" : "anonymous",
    ...(config.allowInsecure ? { insecure: true } : {}),
  };
}

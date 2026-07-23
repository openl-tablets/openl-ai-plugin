import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, lstat, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertSupportedNode,
  classifyStudioTransport,
  clearCodexConfig,
  isInsecureOptIn,
  normalizeBaseUrl,
  probeStudio,
  readCodexConfig,
  safeConfigStatus,
  writeCodexConfig,
} from "../scripts/codex-config.mjs";

test("requires Node.js 24 or later", () => {
  assert.doesNotThrow(() => assertSupportedNode("24.0.0"));
  assert.throws(() => assertSupportedNode("23.11.0"), /Node\.js 24 or later/);
  assert.throws(() => assertSupportedNode("unknown"), /Node\.js 24 or later/);
});

test("normalizes safe Studio URLs", () => {
  assert.equal(normalizeBaseUrl(" https://studio.example.com/openl/ "), "https://studio.example.com/openl");
  assert.equal(normalizeBaseUrl("http://localhost:8080/"), "http://localhost:8080");
  assert.equal(normalizeBaseUrl("http://127.0.0.1:8080/openl"), "http://127.0.0.1:8080/openl");
});

test("rejects unsafe Studio URLs", () => {
  for (const value of [
    "http://studio.example.com",
    "ftp://studio.example.com",
    "https://user:pass@studio.example.com",
    "https://studio.example.com?tenant=a",
    "https://studio.example.com/#fragment",
    "not-a-url",
  ]) {
    assert.throws(() => normalizeBaseUrl(value));
  }
});

test("non-loopback http needs the explicit insecure opt-in", () => {
  // Default: refused.
  assert.throws(() => normalizeBaseUrl("http://studio.internal:8080"), /Use HTTPS/);
  // Opt-in: accepted, other validations still apply.
  assert.equal(
    normalizeBaseUrl("http://studio.internal:8080/openl/", { allowInsecure: true }),
    "http://studio.internal:8080/openl",
  );
  assert.throws(
    () => normalizeBaseUrl("https://user:pass@studio.internal", { allowInsecure: true }),
    /username or password/,
  );
  // https is unaffected by the flag.
  assert.equal(
    normalizeBaseUrl("https://studio.example.com", { allowInsecure: true }),
    "https://studio.example.com",
  );
});

test("loopback HTTP supports local token-based Studio without an opt-in", () => {
  for (const value of [
    "http://localhost:8080",
    "http://localhost.:8080",
    "http://127.0.0.1:8080/openl",
    "http://127.0.0.2:8080/openl",
    "http://[::1]:8080",
    "http://[::ffff:127.0.0.1]:8080",
  ]) {
    assert.deepEqual(classifyStudioTransport(value), {
      isHttps: false,
      isHttp: true,
      isLoopback: true,
      allowed: true,
      requiresOptIn: false,
    });
  }

  assert.deepEqual(classifyStudioTransport("http://studio.internal:8080"), {
    isHttps: false,
    isHttp: true,
    isLoopback: false,
    allowed: false,
    requiresOptIn: true,
  });
  assert.equal(
    classifyStudioTransport("http://studio.internal:8080", { allowInsecure: true }).allowed,
    true,
  );
});

test("isInsecureOptIn reads only explicit truthy values", () => {
  for (const value of ["1", "true", "TRUE", "yes", "on"]) {
    assert.equal(isInsecureOptIn(value), true);
  }
  for (const value of ["", "0", "false", "no", undefined, null, "off"]) {
    assert.equal(isInsecureOptIn(value), false);
  }
});

test("insecure config round-trips and the launcher can read it", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "openl-ai-insecure-test-"));
  const configPath = join(root, "codex.json");
  t.after(async () => clearCodexConfig({ configPath }));

  await writeCodexConfig({
    version: 1,
    baseUrl: "http://studio.internal:8080",
    allowInsecure: true,
    personalAccessToken: "test-token-never-log",
  }, { configPath });

  // readCodexConfig (used by the launcher at startup) must not throw on the
  // persisted http URL because the flag is stored alongside it.
  const config = await readCodexConfig({ configPath });
  assert.equal(config.baseUrl, "http://studio.internal:8080");
  assert.equal(config.allowInsecure, true);
  assert.equal(safeConfigStatus(config).insecure, true);
});

test("loopback HTTP PAT config works without storing an opt-in", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "openl-ai-loopback-test-"));
  const configPath = join(root, "codex.json");
  t.after(async () => clearCodexConfig({ configPath }));
  const { config } = await writeCodexConfig({
    version: 1,
    baseUrl: "http://localhost:8080",
    personalAccessToken: "local-test-token",
  }, { configPath });
  assert.equal(config.allowInsecure, undefined);
  assert.equal((await readCodexConfig({ configPath })).personalAccessToken, "local-test-token");
  assert.deepEqual(safeConfigStatus(config), {
    configured: true,
    baseUrl: "http://localhost:8080",
    authentication: "personal-access-token",
    insecure: true,
  });
});

test("status distinguishes missing config from invalid config and reports HTTP", async () => {
  const root = await mkdtemp(join(tmpdir(), "openl-ai-status-test-"));
  const command = join(process.cwd(), "scripts/configure-codex.mjs");
  const run = (...args) => spawnSync(process.execPath, [command, ...args], {
    encoding: "utf8",
    env: { ...process.env, OPENL_AI_CONFIG_DIR: root },
  });

  const missing = run("--status", "--json");
  assert.equal(missing.status, 0, missing.stderr);
  assert.equal(JSON.parse(missing.stdout).configured, false);

  await writeCodexConfig({
    version: 1,
    baseUrl: "http://localhost:8080",
  }, { configPath: join(root, "codex.json") });
  const httpStatus = run("--status");
  assert.equal(httpStatus.status, 0, httpStatus.stderr);
  assert.match(httpStatus.stdout, /Transport: HTTP \(unencrypted\)/);

  await writeFile(join(root, "codex.json"), "not json\n", { mode: 0o600 });
  const invalid = run("--status", "--json");
  assert.notEqual(invalid.status, 0);
  assert.doesNotMatch(invalid.stdout, /"configured":false/);
  assert.match(invalid.stderr, /not valid JSON/);
});

test("probe accepts absent or null userMode as single-user", async () => {
  for (const settings of [
    { supportedFeatures: { personalAccessToken: false } },
    { userMode: null, supportedFeatures: { personalAccessToken: true } },
  ]) {
    const result = await probeStudio("https://studio.example.com", {
      fetchImpl: async () => new Response(JSON.stringify(settings), { status: 200 }),
    });
    assert.equal(result.multiUser, false);
  }
});

test("probe detects a PAT-capable multi-user Studio", async () => {
  const result = await probeStudio("https://studio.example.com/", {
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://studio.example.com/rest/settings");
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.Accept, "application/json");
      assert.equal(options.headers.Authorization, undefined);
      return new Response(JSON.stringify({
        userMode: "multi",
        supportedFeatures: { personalAccessToken: true },
      }), { status: 200 });
    },
  });
  assert.deepEqual(result, {
    baseUrl: "https://studio.example.com",
    multiUser: true,
    personalAccessToken: true,
  });
});

test("probe rejects status, malformed shape, and oversized bodies", async () => {
  await assert.rejects(
    probeStudio("https://studio.example.com", {
      fetchImpl: async () => new Response("missing", { status: 404 }),
    }),
    /HTTP 404/,
  );
  await assert.rejects(
    probeStudio("https://studio.example.com", {
      fetchImpl: async () => new Response("{}", { status: 200 }),
    }),
    /supportedFeatures/,
  );
  await assert.rejects(
    probeStudio("https://studio.example.com", {
      fetchImpl: async () => new Response("x".repeat(32), { status: 200 }),
      maxBytes: 16,
    }),
    /unexpectedly large/,
  );
});

test("writes, reads, reports, and clears owner-only configuration", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "openl-ai-config-test-"));
  t.after(async () => clearCodexConfig({ configPath: join(root, "codex.json") }));
  const configPath = join(root, "private", "codex.json");
  const personalAccessToken = "test-token-never-log";

  await writeCodexConfig({
    version: 1,
    baseUrl: "https://studio.example.com/",
    personalAccessToken,
  }, { configPath });

  const directoryInfo = await lstat(join(root, "private"));
  const fileInfo = await lstat(configPath);
  if (process.platform !== "win32") {
    assert.equal(directoryInfo.mode & 0o777, 0o700);
    assert.equal(fileInfo.mode & 0o777, 0o600);
  }
  const config = await readCodexConfig({ configPath });
  assert.equal(config.personalAccessToken, personalAccessToken);
  assert.deepEqual(safeConfigStatus(config), {
    configured: true,
    baseUrl: "https://studio.example.com",
    authentication: "personal-access-token",
  });
  assert.doesNotMatch(JSON.stringify(safeConfigStatus(config)), /test-token-never-log/);

  await clearCodexConfig({ configPath });
  await assert.rejects(readFile(configPath, "utf8"), { code: "ENOENT" });
});

test("refuses permissive files and symlinked config paths", { skip: process.platform === "win32" }, async () => {
  const root = await mkdtemp(join(tmpdir(), "openl-ai-symlink-test-"));
  const target = join(root, "target.json");
  const configPath = join(root, "codex.json");
  await writeFile(target, '{"version":1,"baseUrl":"https://studio.example.com"}\n', { mode: 0o644 });
  await symlink(target, configPath);
  await assert.rejects(readCodexConfig({ configPath }), /regular file, not a symlink/);
  await assert.rejects(
    writeCodexConfig({ version: 1, baseUrl: "https://studio.example.com" }, { configPath }),
    /regular file, not a symlink/,
  );

  const unsafePath = join(root, "unsafe.json");
  await writeFile(unsafePath, '{"version":1,"baseUrl":"https://studio.example.com"}\n', { mode: 0o600 });
  await chmod(unsafePath, 0o644);
  await assert.rejects(readCodexConfig({ configPath: unsafePath }), /permissions must be 0600/);
});

test("refuses a symlinked configuration directory", { skip: process.platform === "win32" }, async () => {
  const root = await mkdtemp(join(tmpdir(), "openl-ai-dir-test-"));
  const target = join(root, "target");
  const linked = join(root, "linked");
  await mkdir(target);
  await symlink(target, linked);
  await assert.rejects(
    writeCodexConfig(
      { version: 1, baseUrl: "https://studio.example.com" },
      { configPath: join(linked, "codex.json") },
    ),
    /must not be a symlink/,
  );
});

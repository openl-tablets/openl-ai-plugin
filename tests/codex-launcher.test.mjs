import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeCodexConfig } from "../scripts/codex-config.mjs";
import { buildMcpEnvironment } from "../scripts/start-openl-mcp-codex.mjs";
import { buildNpxInvocation, terminateProcessTree } from "../scripts/start-openl-mcp.mjs";
import { builtInMcpRoutes, startFakeStudio, versionRoutes } from "./helpers/fake-studio.mjs";
import { installFakeNpx, startNode, waitFor } from "./helpers/processes.mjs";

test("launcher environment replaces inherited OpenL credentials", () => {
  const env = buildMcpEnvironment(
    { baseUrl: "https://studio.example.com", personalAccessToken: "configured-token" },
    "/tmp/isolated",
    {
      OPENL_BASE_URL: "https://wrong.example.com",
      OPENL_PERSONAL_ACCESS_TOKEN: "inherited-token",
      OPENL_CONFIG_DIR: "/tmp/stale",
      No_Update_Notifier: "0",
    },
  );
  assert.equal(env.OPENL_BASE_URL, "https://studio.example.com");
  assert.equal(env.OPENL_PERSONAL_ACCESS_TOKEN, "configured-token");
  assert.equal(env.OPENL_CONFIG_DIR, "/tmp/isolated");
  assert.equal(env.NO_UPDATE_NOTIFIER, "1");
  assert.equal(env.No_Update_Notifier, undefined);

  const anonymous = buildMcpEnvironment(
    { baseUrl: "http://localhost:8080" },
    "/tmp/fresh",
    {
      Openl_Base_Url: "https://wrong.example.com",
      Openl_Personal_Access_Token: "inherited-token",
      Openl_Config_Dir: "/tmp/stale",
    },
  );
  assert.equal(anonymous.OPENL_PERSONAL_ACCESS_TOKEN, undefined);
  assert.equal(anonymous.Openl_Personal_Access_Token, undefined);
  assert.equal(anonymous.Openl_Base_Url, undefined);
  assert.equal(anonymous.Openl_Config_Dir, undefined);
});

test("launcher uses fixed, pinned npx invocations", () => {
  assert.deepEqual(buildNpxInvocation({ platform: "linux", env: {} }), {
    command: "npx",
    args: ["-y", "-p", "openl-mcp@1.2.0", "openl-mcp"],
  });
  assert.deepEqual(buildNpxInvocation({ platform: "win32", env: { ComSpec: "C:\\Windows\\cmd.exe" } }), {
    command: "C:\\Windows\\cmd.exe",
    args: ["/d", "/s", "/c", "npx.cmd -y -p openl-mcp@1.2.0 openl-mcp"],
  });
});

test("launcher terminates the whole POSIX process group", async () => {
  const kills = [];
  let directKills = 0;
  await terminateProcessTree(
    { pid: 1234, kill: () => { directKills += 1; } },
    {
      platform: "linux",
      signal: "SIGINT",
      killImpl: (pid, signal) => kills.push([pid, signal]),
    },
  );
  assert.deepEqual(kills, [[-1234, "SIGINT"]]);
  assert.equal(directKills, 0);
});

test("launcher preserves both POSIX termination failures", async () => {
  const groupError = new Error("group kill failed");
  const directError = new Error("direct kill failed");
  await assert.rejects(
    terminateProcessTree(
      {
        pid: 1234,
        kill: () => {
          throw directError;
        },
      },
      {
        platform: "linux",
        killImpl: () => {
          throw groupError;
        },
      },
    ),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [groupError, directError]);
      return true;
    },
  );
});

test("launcher uses taskkill for the whole Windows process tree", async () => {
  const invocations = [];
  let directKills = 0;
  const spawnImpl = (command, args, options) => {
    invocations.push({ command, args, options });
    const killer = new EventEmitter();
    queueMicrotask(() => killer.emit("exit", 0));
    return killer;
  };

  await terminateProcessTree(
    { pid: 4321, kill: () => { directKills += 1; } },
    {
      platform: "win32",
      signal: "SIGBREAK",
      env: { systemroot: "C:\\Windows" },
      spawnImpl,
    },
  );

  assert.equal(directKills, 0);
  assert.deepEqual(invocations, [{
    command: "C:\\Windows\\System32\\taskkill.exe",
    args: ["/PID", "4321", "/T", "/F"],
    options: {
      stdio: "ignore",
      windowsHide: true,
      shell: false,
    },
  }]);
});

test("launcher reports taskkill failure after attempting a direct fallback", async () => {
  const killer = new EventEmitter();
  let directSignal;
  const result = terminateProcessTree(
    { pid: 4321, kill: (signal) => { directSignal = signal; } },
    {
      platform: "win32",
      signal: "SIGTERM",
      env: {},
      spawnImpl: () => {
        queueMicrotask(() => killer.emit("exit", 1));
        return killer;
      },
    },
  );
  await assert.rejects(result, /taskkill\.exe exited with code 1/);
  assert.equal(directSignal, "SIGTERM");
});

test("launcher runs through a symlink", { skip: process.platform === "win32" }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "openl-ai-launcher-symlink-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const command = join(root, "start-openl-mcp-codex.mjs");
  await symlink(join(process.cwd(), "scripts/start-openl-mcp-codex.mjs"), command);

  const result = spawnSync(process.execPath, [command], {
    encoding: "utf8",
    env: { ...process.env, OPENL_AI_CONFIG_DIR: root },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /OpenL Plugin MCP startup failed:/);
});

test("launcher keeps secrets out of output and uses a fresh cache", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "openl-ai-launcher-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const configDirectory = join(root, "config");
  const capturePath = join(root, "capture.json");
  const npxEnvironment = await installFakeNpx(root, capturePath);
  const configuredToken = "configured-secret-for-test";

  // A Studio 6.4 has no MCP server of its own, so the launcher runs the pinned openl-mcp.
  const studio = await startFakeStudio(versionRoutes("6.4.0"));
  t.after(() => studio.close());
  await writeCodexConfig({
    version: 1,
    baseUrl: studio.baseUrl,
    personalAccessToken: configuredToken,
  }, { configPath: join(configDirectory, "codex.json") });

  const run = startNode(join(process.cwd(), "scripts/start-openl-mcp-codex.mjs"), {
    ...process.env,
    ...npxEnvironment,
    OPENL_AI_CONFIG_DIR: configDirectory,
    OPENL_BASE_URL: "https://wrong.example.com",
    OPENL_PERSONAL_ACCESS_TOKEN: "inherited-secret-for-test",
    OPENL_CONFIG_DIR: join(root, "stale-cache"),
  });
  run.child.stdin.end();
  const exit = await run.exited;
  assert.equal(exit.code, 0, run.stderr);
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, /configured-secret|inherited-secret/);

  const capture = JSON.parse(await readFile(capturePath, "utf8"));
  assert.deepEqual(capture.argv, ["-y", "-p", "openl-mcp@1.2.0", "openl-mcp"]);
  assert.equal(capture.baseUrl, studio.baseUrl);
  assert.equal(capture.token, configuredToken);
  assert.notEqual(capture.configDir, join(root, "stale-cache"));
  await assert.rejects(access(capture.configDir), { code: "ENOENT" });
});

test("launcher connects Codex to the MCP server built into Studio 7.0", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "openl-ai-launcher-built-in-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const configDirectory = join(root, "config");
  const studio = await startFakeStudio(builtInMcpRoutes());
  t.after(() => studio.close());
  await writeCodexConfig({
    version: 1,
    baseUrl: studio.baseUrl,
    personalAccessToken: "configured-secret-for-test",
  }, { configPath: join(configDirectory, "codex.json") });

  const run = startNode(join(process.cwd(), "scripts/start-openl-mcp-codex.mjs"), {
    ...process.env,
    OPENL_AI_CONFIG_DIR: configDirectory,
    OPENL_PERSONAL_ACCESS_TOKEN: "inherited-secret-for-test",
  });
  run.child.stdin.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "codex", version: "1" } },
  })}\n`);
  await waitFor(() => run.stdout.includes("\n"));
  run.child.stdin.end();
  const exit = await run.exited;

  assert.equal(exit.code, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout.trim()).result.serverInfo.name, "studio-mcp");
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, /configured-secret|inherited-secret/);
  const [initialize] = studio.requests.filter((request) => request.method === "POST" && request.url === "/mcp");
  assert.equal(initialize.headers.authorization, "Token configured-secret-for-test");
});

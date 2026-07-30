import assert from "node:assert/strict";
import { access, chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import { writeCodexConfig } from "../scripts/codex-config.mjs";
import {
  buildMcpEnvironment,
  buildNpxInvocation,
  terminateProcessTree,
} from "../scripts/start-openl-mcp-codex.mjs";

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
    args: ["-y", "-p", "openl-mcp@1.1.0", "openl-mcp"],
  });
  assert.deepEqual(buildNpxInvocation({ platform: "win32", env: { ComSpec: "C:\\Windows\\cmd.exe" } }), {
    command: "C:\\Windows\\cmd.exe",
    args: ["/d", "/s", "/c", "npx.cmd -y -p openl-mcp@1.1.0 openl-mcp"],
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

test("launcher keeps secrets out of output and uses a fresh cache", async () => {
  const root = await mkdtemp(join(tmpdir(), "openl-ai-launcher-test-"));
  const configDirectory = join(root, "config");
  const capturePath = join(root, "capture.json");
  const fakeNpx = join(root, process.platform === "win32" ? "npx.cmd" : "npx");
  const fakeNpxHelper = join(root, "fake-npx.mjs");
  const configuredToken = "configured-secret-for-test";
  await writeCodexConfig({
    version: 1,
    baseUrl: "https://studio.example.com",
    personalAccessToken: configuredToken,
  }, { configPath: join(configDirectory, "codex.json") });
  await writeFile(fakeNpxHelper, `
import { writeFileSync } from "node:fs";
writeFileSync(process.env.OPENL_TEST_CAPTURE, JSON.stringify({
  argv: process.argv.slice(2),
  baseUrl: process.env.OPENL_BASE_URL,
  token: process.env.OPENL_PERSONAL_ACCESS_TOKEN,
  configDir: process.env.OPENL_CONFIG_DIR
}));
`);
  if (process.platform === "win32") {
    await writeFile(
      fakeNpx,
      '@echo off\r\n"%OPENL_TEST_NODE%" "%OPENL_TEST_HELPER%" %*\r\n',
    );
  } else {
    await writeFile(
      fakeNpx,
      '#!/bin/sh\nexec "$OPENL_TEST_NODE" "$OPENL_TEST_HELPER" "$@"\n',
      { mode: 0o700 },
    );
    await chmod(fakeNpx, 0o700);
  }

  const result = spawnSync(process.execPath, [join(process.cwd(), "scripts/start-openl-mcp-codex.mjs")], {
    encoding: "utf8",
    env: {
      ...process.env,
      OPENL_AI_CONFIG_DIR: configDirectory,
      OPENL_BASE_URL: "https://wrong.example.com",
      OPENL_PERSONAL_ACCESS_TOKEN: "inherited-secret-for-test",
      OPENL_CONFIG_DIR: join(root, "stale-cache"),
      OPENL_TEST_CAPTURE: capturePath,
      OPENL_TEST_HELPER: fakeNpxHelper,
      OPENL_TEST_NODE: process.execPath,
      PATH: `${root}${delimiter}${process.env.PATH}`,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /configured-secret|inherited-secret/);

  const capture = JSON.parse(await readFile(capturePath, "utf8"));
  assert.deepEqual(capture.argv, ["-y", "-p", "openl-mcp@1.1.0", "openl-mcp"]);
  assert.equal(capture.baseUrl, "https://studio.example.com");
  assert.equal(capture.token, configuredToken);
  assert.notEqual(capture.configDir, join(root, "stale-cache"));
  await assert.rejects(access(capture.configDir), { code: "ENOENT" });
});

import assert from "node:assert/strict";
import { access, chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import { writeCodexConfig } from "../scripts/codex-config.mjs";
import {
  buildMcpEnvironment,
  buildNpxInvocation,
} from "../scripts/start-openl-mcp-codex.mjs";

test("launcher environment replaces inherited OpenL credentials", () => {
  const env = buildMcpEnvironment(
    { baseUrl: "https://studio.example.com", personalAccessToken: "configured-token" },
    "/tmp/isolated",
    {
      OPENL_BASE_URL: "https://wrong.example.com",
      OPENL_PERSONAL_ACCESS_TOKEN: "inherited-token",
      OPENL_CONFIG_DIR: "/tmp/stale",
    },
  );
  assert.equal(env.OPENL_BASE_URL, "https://studio.example.com");
  assert.equal(env.OPENL_PERSONAL_ACCESS_TOKEN, "configured-token");
  assert.equal(env.OPENL_CONFIG_DIR, "/tmp/isolated");

  const anonymous = buildMcpEnvironment(
    { baseUrl: "http://localhost:8080" },
    "/tmp/fresh",
    { OPENL_PERSONAL_ACCESS_TOKEN: "inherited-token" },
  );
  assert.equal(anonymous.OPENL_PERSONAL_ACCESS_TOKEN, undefined);
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

test("launcher keeps secrets out of output and uses a fresh cache", { skip: process.platform === "win32" }, async () => {
  const root = await mkdtemp(join(tmpdir(), "openl-ai-launcher-test-"));
  const configDirectory = join(root, "config");
  const capturePath = join(root, "capture.json");
  const fakeNpx = join(root, "npx");
  const configuredToken = "configured-secret-for-test";
  await writeCodexConfig({
    version: 1,
    baseUrl: "https://studio.example.com",
    personalAccessToken: configuredToken,
  }, { configPath: join(configDirectory, "codex.json") });
  await writeFile(fakeNpx, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.OPENL_TEST_CAPTURE, JSON.stringify({
  argv: process.argv.slice(2),
  baseUrl: process.env.OPENL_BASE_URL,
  token: process.env.OPENL_PERSONAL_ACCESS_TOKEN,
  configDir: process.env.OPENL_CONFIG_DIR
}));
`, { mode: 0o700 });
  await chmod(fakeNpx, 0o700);

  const result = spawnSync(process.execPath, [join(process.cwd(), "scripts/start-openl-mcp-codex.mjs")], {
    encoding: "utf8",
    env: {
      ...process.env,
      OPENL_AI_CONFIG_DIR: configDirectory,
      OPENL_BASE_URL: "https://wrong.example.com",
      OPENL_PERSONAL_ACCESS_TOKEN: "inherited-secret-for-test",
      OPENL_CONFIG_DIR: join(root, "stale-cache"),
      OPENL_TEST_CAPTURE: capturePath,
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

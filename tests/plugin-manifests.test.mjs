import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("Claude and Codex manifests stay version-aligned", async () => {
  const claude = await readJson(".claude-plugin/plugin.json");
  const codex = await readJson(".codex-plugin/plugin.json");
  const packageJson = await readJson("package.json");
  assert.equal(codex.version, claude.version);
  assert.equal(packageJson.version, claude.version);
});

test("Codex uses only its native launcher and never Claude placeholders", async () => {
  const codexText = await readFile(".codex-plugin/plugin.json", "utf8");
  const codex = JSON.parse(codexText);
  assert.deepEqual(Object.keys(codex.mcpServers), ["openl-ai"]);
  assert.deepEqual(codex.mcpServers["openl-ai"], {
    type: "stdio",
    command: "node",
    args: ["./scripts/start-openl-mcp-codex.mjs"],
    cwd: ".",
    startup_timeout_sec: 120,
    tool_timeout_sec: 300,
    required: false,
    default_tools_approval_mode: "writes",
  });
  assert.doesNotMatch(codexText, /\$\{user_config\./);
});

test("Claude keeps its existing MCP contract and pin", async () => {
  const claudeMcpText = await readFile(".mcp.json", "utf8");
  const claudeMcp = JSON.parse(claudeMcpText);
  assert.deepEqual(Object.keys(claudeMcp), ["tools"]);
  assert.match(claudeMcpText, /\$\{user_config\.studio_base_url\}/);
  assert.ok(claudeMcp.tools.args.includes("openl-mcp@1.1.0"));

  const launcherText = await readFile("scripts/start-openl-mcp-codex.mjs", "utf8");
  assert.match(launcherText, /OPENL_MCP_VERSION = "1\.1\.0"/);
});

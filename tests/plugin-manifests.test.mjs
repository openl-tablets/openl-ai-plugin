import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("Claude, Codex and Cursor manifests stay version-aligned", async () => {
  const claude = await readJson(".claude-plugin/plugin.json");
  const codex = await readJson(".codex-plugin/plugin.json");
  const cursor = await readJson(".cursor-plugin/plugin.json");
  const marketplace = await readJson(".claude-plugin/marketplace.json");
  const packageJson = await readJson("package.json");
  assert.equal(codex.version, claude.version);
  assert.equal(cursor.version, claude.version);
  assert.equal(packageJson.version, claude.version);
  assert.equal(cursor.name, claude.name);
  assert.deepEqual(marketplace.renames, { "openl-ai": "openl" });
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].name, claude.name);
  const changelog = await readFile("CHANGELOG.md", "utf8");
  const currentRelease = changelog.match(/^## \[([^\]]+)\] - (Unreleased|\d{4}-\d{2}-\d{2})$/m);
  assert.ok(currentRelease, "CHANGELOG.md must start with a versioned release heading");
  assert.equal(currentRelease[1], claude.version);
});

// Cursor reads whichever marketplace manifest it finds first
// (.cursor-plugin/marketplace.json before .claude-plugin/marketplace.json), so the two
// must describe the same single plugin at the same source. A drift here would offer
// Cursor users a different plugin than Claude Code users install from the same commit.
test("the Cursor and Claude marketplace manifests describe the same plugin", async () => {
  const claudeMarketplace = await readJson(".claude-plugin/marketplace.json");
  const cursorMarketplace = await readJson(".cursor-plugin/marketplace.json");
  assert.equal(cursorMarketplace.name, claudeMarketplace.name);
  assert.deepEqual(cursorMarketplace.owner, claudeMarketplace.owner);
  assert.equal(cursorMarketplace.plugins.length, 1);
  assert.equal(cursorMarketplace.plugins[0].name, claudeMarketplace.plugins[0].name);
  assert.equal(cursorMarketplace.plugins[0].source, claudeMarketplace.plugins[0].source);
  // `renames` is a Claude Code marketplace feature; Cursor has no equivalent, so the
  // Cursor manifest must not pretend to carry one.
  assert.equal(cursorMarketplace.renames, undefined);
});

test("Codex uses only its native launcher and never Claude placeholders", async () => {
  const codexText = await readFile(".codex-plugin/plugin.json", "utf8");
  const codex = JSON.parse(codexText);
  assert.equal(codex.mcpServers, "./.mcp.codex.json");
  const codexMcpPath = resolve(codex.mcpServers);
  await assert.doesNotReject(access(codexMcpPath));

  const codexMcpText = await readFile(codexMcpPath, "utf8");
  const codexMcp = JSON.parse(codexMcpText);
  assert.deepEqual(Object.keys(codexMcp), ["openl-ai"]);
  assert.deepEqual(codexMcp["openl-ai"], {
    command: "node",
    args: ["./scripts/start-openl-mcp-codex.mjs"],
    cwd: ".",
    startup_timeout_sec: 120,
    tool_timeout_sec: 300,
    required: false,
    default_tools_approval_mode: "writes",
  });
  assert.doesNotMatch(`${codexText}\n${codexMcpText}`, /\$\{user_config\./);
});

test("Claude keeps its existing MCP contract and pin", async () => {
  const claudeMcpText = await readFile(".mcp.json", "utf8");
  const claudeMcp = JSON.parse(claudeMcpText);
  assert.deepEqual(Object.keys(claudeMcp), ["tools"]);
  assert.match(claudeMcpText, /\$\{user_config\.studio_base_url\}/);
  assert.ok(claudeMcp.tools.args.includes("openl-mcp@1.2.0"));
});

// Cursor discovers `.mcp.json` before `mcp.json` and would otherwise reuse Claude
// Code's descriptor, whose `${user_config.*}` placeholders Cursor does not substitute —
// the server then starts with a literal placeholder as its base URL and exits. The
// manifest's `mcpServers` field overrides that discovery, so it must keep pointing at
// the Cursor-specific descriptor, under the same server key Claude Code uses.
test("Cursor overrides MCP discovery with its own descriptor and variables", async () => {
  const cursorText = await readFile(".cursor-plugin/plugin.json", "utf8");
  const cursor = JSON.parse(cursorText);
  assert.equal(cursor.mcpServers, "./.mcp.cursor.json");
  const cursorMcpPath = resolve(cursor.mcpServers);
  await assert.doesNotReject(access(cursorMcpPath));

  const cursorMcpText = await readFile(cursorMcpPath, "utf8");
  const cursorMcp = JSON.parse(cursorMcpText);
  assert.deepEqual(Object.keys(cursorMcp), ["mcpServers"]);
  assert.deepEqual(Object.keys(cursorMcp.mcpServers), ["tools"]);
  assert.doesNotMatch(`${cursorText}\n${cursorMcpText}`, /\$\{user_config\./);

  // Every ${VAR} placeholder in the descriptor must be declared in the manifest schema:
  // Cursor leaves an undeclared, unconfigured placeholder in place verbatim, and Cursor's
  // own submission checklist requires the declaration.
  const declared = Object.keys(cursor.variables.properties);
  assert.deepEqual([...declared].sort(), ["OPENL_STUDIO_TOKEN", "OPENL_STUDIO_URL"]);
  assert.deepEqual(cursor.variables.required, ["OPENL_STUDIO_URL"]);
  const placeholders = [...cursorMcpText.matchAll(/\$\{([^:}]+)(?::-([^}]*))?\}/gu)];
  assert.equal(placeholders.length, 2);
  for (const [, name] of placeholders) {
    assert.ok(declared.includes(name), `${name} is used but not declared under variables`);
  }

  // The token is optional (single-user Studio has no sign-in). An unconfigured variable
  // without a default survives substitution as the literal `${OPENL_STUDIO_TOKEN}`,
  // which Studio would reject with 401; the `:-` default makes it an empty string
  // instead, which openl-mcp >= 1.1.0 treats as "no token".
  const { env } = cursorMcp.mcpServers.tools;
  assert.equal(env.OPENL_BASE_URL, "${OPENL_STUDIO_URL}");
  assert.equal(env.OPENL_PERSONAL_ACCESS_TOKEN, "${OPENL_STUDIO_TOKEN:-}");
});

// The server version is pinned twice — .mcp.json (Claude Code) and
// OPENL_MCP_VERSION in the Codex launcher — with no shared source of truth.
// This guard fails the build if the two ever drift, so a release bump that
// touches only one place cannot silently ship Codex users a stale server.
test("Claude, Codex and Cursor pin the same openl-mcp version", async () => {
  const claudeMcp = await readJson(".mcp.json");
  const pinnedArg = claudeMcp.tools.args.find((arg) => arg.startsWith("openl-mcp@"));
  assert.ok(pinnedArg, ".mcp.json must pin an exact openl-mcp@<version>");
  const claudePin = pinnedArg.slice("openl-mcp@".length);

  const launcherText = await readFile("scripts/start-openl-mcp-codex.mjs", "utf8");
  const launcherMatch = launcherText.match(/OPENL_MCP_VERSION = "([^"]+)"/);
  assert.ok(launcherMatch, "the Codex launcher must define OPENL_MCP_VERSION");
  const codexPin = launcherMatch[1];

  assert.equal(
    codexPin,
    claudePin,
    `openl-mcp pin drift: .mcp.json pins ${claudePin} but ` +
      `scripts/start-openl-mcp-codex.mjs pins ${codexPin}. Bump both together (see docs/release.md).`,
  );

  const cursorMcp = await readJson(".mcp.cursor.json");
  const cursorPinnedArg = cursorMcp.mcpServers.tools.args.find((arg) => arg.startsWith("openl-mcp@"));
  assert.ok(cursorPinnedArg, ".mcp.cursor.json must pin an exact openl-mcp@<version>");
  const cursorPin = cursorPinnedArg.slice("openl-mcp@".length);

  assert.equal(
    cursorPin,
    claudePin,
    `openl-mcp pin drift: .mcp.json pins ${claudePin} but ` +
      `.mcp.cursor.json pins ${cursorPin}. Bump all three together (see docs/release.md).`,
  );
});

async function skillDirectories() {
  const entries = await readdir("skills", { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

// All three packages take the whole skills/ directory — Claude Code and Cursor by
// auto-discovery, Codex through its manifest — and Claude Code derives the invocation
// name (/openl:<dir>) from the directory while the frontmatter carries its own name.
// This validates packaging, not runtime discovery in any client.
test("every skill is packaged for every client", async () => {
  const claude = await readJson(".claude-plugin/plugin.json");
  assert.equal(claude.skills, undefined, "Claude Code auto-discovers skills/; keep the field unset");
  const cursor = await readJson(".cursor-plugin/plugin.json");
  assert.equal(cursor.skills, undefined, "Cursor auto-discovers skills/; setting the field replaces discovery");
  const codex = await readJson(".codex-plugin/plugin.json");
  assert.equal(codex.skills, "./skills/");

  const skills = await skillDirectories();
  assert.deepEqual(
    [...skills].sort(),
    ["branching", "connect", "testing", "trace-investigation", "versioning"],
  );
  for (const skill of skills) {
    // Normalize line endings: a Windows checkout delivers CRLF, which the
    // line-anchored frontmatter patterns below would otherwise miss.
    const markdown = (await readFile(join("skills", skill, "SKILL.md"), "utf8")).replaceAll("\r\n", "\n");
    const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---\n/u);
    assert.ok(frontmatter, `skills/${skill}/SKILL.md must open with YAML frontmatter`);
    const name = frontmatter[1].match(/^name:\s*(\S+)\s*$/mu);
    assert.ok(name, `skills/${skill}/SKILL.md must declare a name`);
    assert.equal(name[1], skill, `skills/${skill}/SKILL.md name must match its directory`);
    assert.match(
      frontmatter[1],
      /^description:[^\S\r\n]*\S.*$/mu,
      `skills/${skill}/SKILL.md must declare a non-empty description`,
    );
  }
});

test("local Markdown links resolve", async () => {
  const markdownFiles = [
    "README.md",
    "CHANGELOG.md",
    ...(await readdir("docs")).filter((name) => name.endsWith(".md")).map((name) => join("docs", name)),
    ...(await skillDirectories()).map((skill) => join("skills", skill, "SKILL.md")),
  ];
  for (const file of markdownFiles) {
    const markdown = await readFile(file, "utf8");
    for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)) {
      const target = match[1].split("#", 1)[0];
      if (!target || /^(?:https?:|mailto:)/u.test(target)) {
        continue;
      }
      const resolved = resolve(dirname(file), decodeURIComponent(target));
      await assert.doesNotReject(access(resolved), `${file} links to missing ${target}`);
    }
  }
});

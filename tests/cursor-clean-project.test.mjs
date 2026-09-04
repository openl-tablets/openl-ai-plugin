import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonIfPresent(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function asWrappedMcpConfig(document) {
  if (document.mcpServers) {
    return document;
  }

  // Cursor accepts Claude Code's bare-root descriptor as a discovery fallback.
  return {
    mcpServers: Object.fromEntries(
      Object.entries(document).filter(
        ([, value]) => value && typeof value === "object" && ("command" in value || "url" in value),
      ),
    ),
  };
}

function expandCursorVariables(value, { configuredVariables, environment, pluginRoot }) {
  if (typeof value === "string") {
    return value.replace(/\$\{([^:}]+)(?::-([^}]*))?\}/gu, (placeholder, name, fallback) => {
      if (name === "CURSOR_PLUGIN_ROOT" || name === "CLAUDE_PLUGIN_ROOT") {
        return pluginRoot;
      }
      if (environment[name] !== undefined) {
        return String(environment[name]);
      }
      if (configuredVariables[name] !== undefined && configuredVariables[name] !== null) {
        return String(configuredVariables[name]);
      }
      return fallback === undefined ? placeholder : fallback;
    });
  }
  if (Array.isArray(value)) {
    return value.map((entry) =>
      expandCursorVariables(entry, { configuredVariables, environment, pluginRoot }),
    );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        expandCursorVariables(entry, { configuredVariables, environment, pluginRoot }),
      ]),
    );
  }
  return value;
}

// This is a small regression model of the Cursor 3.19 plugin-loader behavior observed
// by this repository: Cursor chooses its native manifest first, discovers .mcp.json as
// a fallback, lets manifest MCP entries override it, and then expands plugin values.
// It deliberately does not claim to execute Cursor or replace the release GUI smoke.
async function materializeCursorMcp(pluginRoot, configuredVariables, environment = {}) {
  const manifestCandidates = [
    ".cursor-plugin/plugin.json",
    ".claude-plugin/plugin.json",
    "plugin.json",
  ];
  let manifest;
  let manifestPath;
  for (const candidate of manifestCandidates) {
    const parsed = await readJsonIfPresent(join(pluginRoot, candidate));
    if (parsed) {
      manifest = parsed;
      manifestPath = candidate;
      break;
    }
  }
  assert.ok(manifest, "the installed plugin must have a readable manifest");

  let discovered = { mcpServers: {} };
  for (const candidate of [".mcp.json", "mcp.json"]) {
    const parsed = await readJsonIfPresent(join(pluginRoot, candidate));
    if (parsed) {
      discovered = asWrappedMcpConfig(parsed);
      break;
    }
  }

  assert.equal(typeof manifest.mcpServers, "string");
  const descriptorPath = resolve(pluginRoot, manifest.mcpServers);
  const descriptorRelativePath = relative(pluginRoot, descriptorPath);
  assert.ok(
    descriptorRelativePath && !descriptorRelativePath.startsWith("..") && !isAbsolute(descriptorRelativePath),
    "the Cursor MCP descriptor must stay inside the installed plugin",
  );
  const fromManifest = asWrappedMcpConfig(await readJson(descriptorPath));
  const combined = {
    mcpServers: {
      ...discovered.mcpServers,
      ...fromManifest.mcpServers,
    },
  };

  return {
    manifest,
    manifestPath,
    descriptorRelativePath,
    config: expandCursorVariables(combined, {
      configuredVariables,
      environment,
      pluginRoot,
    }),
  };
}

async function copyInstalledPlugin(pluginRoot) {
  await mkdir(pluginRoot, { recursive: true });
  await Promise.all([
    cp(join(repositoryRoot, ".cursor-plugin"), join(pluginRoot, ".cursor-plugin"), { recursive: true }),
    cp(join(repositoryRoot, ".claude-plugin"), join(pluginRoot, ".claude-plugin"), { recursive: true }),
    cp(join(repositoryRoot, "skills"), join(pluginRoot, "skills"), { recursive: true }),
    cp(join(repositoryRoot, ".mcp.json"), join(pluginRoot, ".mcp.json")),
    cp(join(repositoryRoot, ".mcp.cursor.json"), join(pluginRoot, ".mcp.cursor.json")),
  ]);
}

test("the Cursor packaging contract resolves OpenL in a clean project without project JSON", async (t) => {
  const sandbox = await mkdtemp(join(tmpdir(), "openl-cursor-clean-project-"));
  t.after(() => rm(sandbox, { recursive: true, force: true }));

  const projectRoot = join(sandbox, "clean-project");
  const pluginRoot = join(sandbox, "cursor-user", "plugins", "cache", "openl", "commit");
  await mkdir(projectRoot);
  await copyInstalledPlugin(pluginRoot);

  const claudeDescriptor = await readFile(join(pluginRoot, ".mcp.json"), "utf8");
  assert.match(
    claudeDescriptor,
    /\$\{user_config\./u,
    "the fixture must retain the incompatible Claude fallback that Cursor has to override",
  );

  const cursorDescriptor = await readJson(join(pluginRoot, ".mcp.cursor.json"));
  const { env: unresolvedEnvironment, ...expectedInvocation } = cursorDescriptor.mcpServers.tools;
  assert.deepEqual(unresolvedEnvironment, {
    OPENL_BASE_URL: "${OPENL_STUDIO_URL}",
    OPENL_PERSONAL_ACCESS_TOKEN: "${OPENL_STUDIO_TOKEN:-}",
  });
  for (const [configuredVariables, expectedToken] of [
    [
      {
        OPENL_STUDIO_URL: "https://studio.clean-project.example",
        OPENL_STUDIO_TOKEN: "openl_pat_cursor_smoke",
      },
      "openl_pat_cursor_smoke",
    ],
    [{ OPENL_STUDIO_URL: "https://studio.clean-project.example" }, ""],
  ]) {
    const materialized = await materializeCursorMcp(pluginRoot, configuredVariables, {
      // Existing server variables in a developer's shell must not replace the
      // plugin-scoped values entered in Cursor's Configure dialog.
      OPENL_BASE_URL: "https://wrong-shell-value.example",
      OPENL_PERSONAL_ACCESS_TOKEN: "wrong-shell-token",
    });

    assert.equal(materialized.manifestPath, ".cursor-plugin/plugin.json");
    assert.equal(materialized.descriptorRelativePath, ".mcp.cursor.json");
    assert.deepEqual(materialized.config, {
      mcpServers: {
        tools: {
          ...expectedInvocation,
          env: {
            OPENL_BASE_URL: "https://studio.clean-project.example",
            OPENL_PERSONAL_ACCESS_TOKEN: expectedToken,
          },
        },
      },
    });
    assert.doesNotMatch(JSON.stringify(materialized.config), /\$\{(?:user_config\.|OPENL_)/u);
  }

  const installedSkills = (await readdir(join(pluginRoot, "skills"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(installedSkills, [
    "branching",
    "connect",
    "testing",
    "trace-investigation",
    "versioning",
  ]);
  assert.deepEqual(await readdir(projectRoot), [], "installation must not create .cursor or MCP JSON files");
});

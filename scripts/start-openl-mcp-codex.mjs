#!/usr/bin/env node

// The plugin's MCP server as Codex starts it. Codex substitutes no plugin settings, so this
// launcher reads the address and token saved by configure-codex.mjs, then serves the
// Studio the same way the Claude Code and Cursor launcher does: through the server built
// into OpenL Studio 7.0 and later, or the pinned openl-mcp run locally for older releases.

import { realpathSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSupportedNode, readCodexConfig } from "./codex-config.mjs";
import {
  chooseServer,
  describeChoice,
  runBuiltInServer,
  runBundledServer,
} from "./start-openl-mcp.mjs";

export function buildMcpEnvironment(config, isolatedConfigDirectory, inheritedEnv = process.env) {
  // Windows treats environment variable names case-insensitively. Filter every
  // OpenL override before adding canonical keys so differently-cased inherited
  // credentials cannot win when Node serializes the child environment.
  const reservedKeys = new Set([
    "openl_base_url",
    "openl_personal_access_token",
    "openl_config_dir",
    "no_update_notifier",
  ]);
  const env = Object.fromEntries(
    Object.entries(inheritedEnv).filter(([key]) => !reservedKeys.has(key.toLowerCase())),
  );
  env.OPENL_BASE_URL = config.baseUrl;
  env.OPENL_CONFIG_DIR = isolatedConfigDirectory;
  env.NO_UPDATE_NOTIFIER = "1";
  if (config.personalAccessToken) {
    env.OPENL_PERSONAL_ACCESS_TOKEN = config.personalAccessToken;
  }
  return env;
}

async function main() {
  assertSupportedNode();
  const config = await readCodexConfig();
  const server = await chooseServer(config.baseUrl);
  process.stderr.write(`openl-plugin: ${describeChoice(server)}\n`);
  if (server.kind === "built-in") {
    process.exitCode = await runBuiltInServer({ url: server.url, token: config.personalAccessToken });
    return;
  }

  // The local server gets a fresh, empty config directory, so a token cached by an older
  // or user-managed openl-mcp can never override the configured Codex identity.
  const isolatedOpenlConfigDirectory = await mkdtemp(join(tmpdir(), "openl-ai-mcp-"));
  try {
    process.exitCode = await runBundledServer({
      env: buildMcpEnvironment(config, isolatedOpenlConfigDirectory),
    });
  } finally {
    await rm(isolatedOpenlConfigDirectory, { recursive: true, force: true });
  }
}

const isMain = process.argv[1]
  && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(`OpenL Plugin MCP startup failed: ${error?.message ?? String(error)}`);
    process.exitCode = 1;
  });
}

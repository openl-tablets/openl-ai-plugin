#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSupportedNode, readCodexConfig } from "./codex-config.mjs";

const OPENL_MCP_VERSION = "1.1.0";

export function buildMcpEnvironment(config, isolatedConfigDirectory, inheritedEnv = process.env) {
  const env = {
    ...inheritedEnv,
    OPENL_BASE_URL: config.baseUrl,
    OPENL_CONFIG_DIR: isolatedConfigDirectory,
    NO_UPDATE_NOTIFIER: "1",
  };
  delete env.OPENL_PERSONAL_ACCESS_TOKEN;
  if (config.personalAccessToken) {
    env.OPENL_PERSONAL_ACCESS_TOKEN = config.personalAccessToken;
  }
  return env;
}

export function buildNpxInvocation({
  platform = process.platform,
  env = process.env,
} = {}) {
  const npxArguments = ["-y", "-p", `openl-mcp@${OPENL_MCP_VERSION}`, "openl-mcp"];
  if (platform === "win32") {
    return {
      command: env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", `npx.cmd ${npxArguments.join(" ")}`],
    };
  }
  return { command: "npx", args: npxArguments };
}

async function main() {
  assertSupportedNode();
  const config = await readCodexConfig();
  const isolatedOpenlConfigDirectory = await mkdtemp(join(tmpdir(), "openl-ai-mcp-"));

  const env = buildMcpEnvironment(config, isolatedOpenlConfigDirectory);
  const { command, args } = buildNpxInvocation();

  try {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
      windowsHide: true,
      shell: false,
    });

    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, () => child.kill(signal));
    }

    const result = await new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };
      child.once("error", (error) => finish({ error }));
      child.once("exit", (code, signal) => finish({ code, signal }));
    });

    if (result.error) {
      console.error(`Failed to start openl-mcp: ${result.error.message}`);
      process.exitCode = 1;
    } else if (result.signal) {
      console.error(`openl-mcp stopped after signal ${result.signal}.`);
      process.exitCode = 1;
    } else {
      process.exitCode = result.code ?? 1;
    }
  } finally {
    await rm(isolatedOpenlConfigDirectory, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`OpenL AI MCP startup failed: ${error?.message ?? String(error)}`);
    process.exitCode = 1;
  });
}

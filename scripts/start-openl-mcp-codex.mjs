#!/usr/bin/env node

import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSupportedNode, readCodexConfig } from "./codex-config.mjs";

// Keep this in lockstep with the openl-mcp pin in .mcp.json (Claude Code).
// tests/plugin-manifests.test.mjs fails the build if the two versions drift.
const OPENL_MCP_VERSION = "1.2.0";

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

function windowsEnvironmentValue(env, name) {
  const entry = Object.entries(env).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

export async function terminateProcessTree(
  child,
  {
    platform = process.platform,
    signal = "SIGTERM",
    env = process.env,
    killImpl = process.kill,
    spawnImpl = spawn,
  } = {},
) {
  if (!Number.isInteger(child?.pid) || child.pid <= 0) {
    return;
  }

  if (platform !== "win32") {
    try {
      killImpl(-child.pid, signal);
      return;
    } catch (error) {
      if (error?.code === "ESRCH") {
        return;
      }
      try {
        child.kill(signal);
      } catch (fallbackError) {
        throw new AggregateError(
          [error, fallbackError],
          "Failed to terminate the openl-mcp process tree.",
        );
      }
      throw error;
    }
  }

  const windowsRoot = windowsEnvironmentValue(env, "SystemRoot")
    || windowsEnvironmentValue(env, "WINDIR");
  const command = windowsRoot
    ? win32.join(windowsRoot, "System32", "taskkill.exe")
    : "taskkill.exe";

  await new Promise((resolvePromise, rejectPromise) => {
    let killer;
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      killer?.off("error", onError);
      killer?.off("exit", onExit);
      if (!error) {
        resolvePromise();
        return;
      }
      try {
        child.kill(signal);
      } catch (fallbackError) {
        rejectPromise(new AggregateError(
          [error, fallbackError],
          "Failed to terminate the openl-mcp process tree.",
        ));
        return;
      }
      rejectPromise(error);
    };
    const onError = (error) => finish(
      new Error(`Cannot start taskkill.exe: ${error?.message ?? String(error)}`, { cause: error }),
    );
    const onExit = (code) => finish(
      code === 0 ? undefined : new Error(`taskkill.exe exited with code ${code ?? "unknown"}.`),
    );

    try {
      killer = spawnImpl(command, ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
        shell: false,
      });
      killer.once("error", onError);
      killer.once("exit", onExit);
    } catch (error) {
      finish(new Error(
        `Cannot start taskkill.exe: ${error?.message ?? String(error)}`,
        { cause: error },
      ));
    }
  });
}

async function main() {
  assertSupportedNode();
  const config = await readCodexConfig();
  const isolatedOpenlConfigDirectory = await mkdtemp(join(tmpdir(), "openl-ai-mcp-"));

  const env = buildMcpEnvironment(config, isolatedOpenlConfigDirectory);
  const { command, args } = buildNpxInvocation();

  try {
    const child = spawn(command, args, {
      detached: process.platform !== "win32",
      env,
      stdio: "inherit",
      windowsHide: true,
      shell: false,
    });

    let terminationPromise;
    const terminationSignals = process.platform === "win32"
      ? ["SIGINT", "SIGTERM", "SIGBREAK"]
      : ["SIGINT", "SIGTERM"];
    const signalHandlers = new Map();
    for (const signal of terminationSignals) {
      const handler = () => {
        if (
          !terminationPromise
          && child.exitCode == null
          && child.signalCode == null
        ) {
          terminationPromise = terminateProcessTree(child, { signal }).then(
            () => undefined,
            (error) => error,
          );
        }
      };
      signalHandlers.set(signal, handler);
      process.once(signal, handler);
    }

    let result;
    try {
      result = await new Promise((resolvePromise) => {
        let settled = false;
        const finish = (value) => {
          if (!settled) {
            settled = true;
            resolvePromise(value);
          }
        };
        child.once("error", (error) => finish({ error }));
        child.once("exit", (code, signal) => finish({ code, signal }));
      });
    } finally {
      for (const [signal, handler] of signalHandlers) {
        process.off(signal, handler);
      }
    }

    const terminationError = terminationPromise ? await terminationPromise : undefined;
    if (terminationError) {
      console.error(`Failed to stop the complete openl-mcp process tree: ${terminationError.message}`);
      process.exitCode = 1;
    } else if (result.error) {
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

const isMain = process.argv[1]
  && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(`OpenL AI MCP startup failed: ${error?.message ?? String(error)}`);
    process.exitCode = 1;
  });
}

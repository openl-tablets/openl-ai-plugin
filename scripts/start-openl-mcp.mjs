#!/usr/bin/env node

// The plugin's MCP server, as Claude Code and Cursor start it (Codex goes through
// start-openl-mcp-codex.mjs, which reads its own configuration and then uses the same
// choice).
//
// OpenL Studio 7.0 and later serve their own MCP server at <studio>/mcp, built from the
// same release, so the plugin connects to it through a stdio ↔ HTTP bridge. Older Studio
// releases have none, so the plugin runs its pinned openl-mcp release locally, as before.
// The choice is made once per start, from the version Studio reports without sign-in;
// when the version cannot be read, the plugin keeps the local server, which then reports
// the connection problem itself.

import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSupportedNode } from "./codex-config.mjs";
import { runBridge } from "./mcp-http-bridge.mjs";
import { fetchStudioVersion, hasBuiltInMcp, OPENL_MCP_VERSION } from "./studio-compatibility.mjs";

// Every start waits for this, so it is short; an unreachable Studio costs at most this long.
const VERSION_PROBE_TIMEOUT_MS = 5_000;

function log(text) {
  try {
    process.stderr.write(`openl-plugin: ${text}\n`);
  } catch {
    // Nowhere left to report it.
  }
}

/**
 * Which MCP server serves this Studio: `{ kind: "built-in", url }` for Studio 7.0 and later,
 * otherwise `{ kind: "bundled" }` (the pinned openl-mcp, run locally).
 */
export async function chooseServer(
  baseUrl,
  { fetchImpl = globalThis.fetch, timeoutMs = VERSION_PROBE_TIMEOUT_MS } = {},
) {
  let studio;
  try {
    studio = await fetchStudioVersion(baseUrl, { fetchImpl, timeoutMs });
  } catch (error) {
    return { kind: "bundled", studioVersion: null, reason: error?.message ?? String(error) };
  }
  if (hasBuiltInMcp(studio.version)) {
    return { kind: "built-in", studioVersion: studio.version, url: `${studio.baseUrl}/mcp` };
  }
  return { kind: "bundled", studioVersion: studio.version };
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

/**
 * Run the pinned openl-mcp through npx with the given environment, wired to this process's
 * stdin and stdout, and stop its whole process tree on a termination signal. Resolves with
 * the exit code this process should end with.
 */
export async function runBundledServer({ env = process.env } = {}) {
  const { command, args } = buildNpxInvocation({ env });
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
    return 1;
  }
  if (result.error) {
    console.error(`Failed to start openl-mcp: ${result.error.message}`);
    return 1;
  }
  if (result.signal) {
    console.error(`openl-mcp stopped after signal ${result.signal}.`);
    return 1;
  }
  return result.code ?? 1;
}

/**
 * Connect to the server built into Studio until the client closes stdin or stops this
 * process. Resolves with the exit code this process should end with.
 */
export async function runBuiltInServer({ url, token }) {
  // A termination signal ends the bridge the way a closed stdin does, so the Studio
  // session is closed either way.
  const controller = new AbortController();
  const stop = () => controller.abort();
  const terminationSignals = process.platform === "win32"
    ? ["SIGINT", "SIGTERM", "SIGBREAK"]
    : ["SIGINT", "SIGTERM"];
  for (const signal of terminationSignals) {
    process.once(signal, stop);
  }
  try {
    await runBridge({ url, token, signal: controller.signal });
  } finally {
    for (const signal of terminationSignals) {
      process.off(signal, stop);
    }
    // Release stdin so the process can end once the bridge is done.
    process.stdin.destroy();
  }
  return 0;
}

/** One line for the client's MCP log: which server serves this Studio, and why. */
export function describeChoice(server) {
  if (server.kind === "built-in") {
    return `OpenL Studio ${server.studioVersion} has a built-in MCP server; connecting to ${server.url}.`;
  }
  return server.studioVersion
    ? `OpenL Studio ${server.studioVersion} has no built-in MCP server; starting openl-mcp ${OPENL_MCP_VERSION}.`
    : `Could not read the OpenL Studio version (${server.reason}); starting openl-mcp ${OPENL_MCP_VERSION}.`;
}

async function main() {
  assertSupportedNode();
  // Claude Code and Cursor pass the plugin's settings in the environment the local server
  // reads, so the same environment goes on to it unchanged.
  const server = await chooseServer(process.env.OPENL_BASE_URL ?? "");
  log(describeChoice(server));
  process.exitCode = server.kind === "built-in"
    ? await runBuiltInServer({ url: server.url, token: process.env.OPENL_PERSONAL_ACCESS_TOKEN ?? "" })
    : await runBundledServer({ env: process.env });
}

const isMain = process.argv[1]
  && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(`OpenL Plugin MCP startup failed: ${error?.message ?? String(error)}`);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  assertSupportedNode,
  classifyStudioTransport,
  clearCodexConfig,
  CodexConfigNotFoundError,
  isInsecureOptIn,
  probeStudio,
  readCodexConfig,
  resolveConfigPath,
  safeConfigStatus,
  writeCodexConfig,
} from "./codex-config.mjs";

function usage() {
  return `Configure OpenL AI for Codex without putting a Personal Access Token in chat.

Usage:
  node scripts/configure-codex.mjs [--base-url <url>] [--allow-insecure]
  node scripts/configure-codex.mjs --status [--json]
  node scripts/configure-codex.mjs --clear

The token is prompted for with terminal echo disabled. There is intentionally no
--token argument, so a token cannot be left in shell history or a process list.

Loopback http:// addresses work without an extra flag, including when a local Studio
requires a token, but the token is sent unencrypted. A non-loopback Studio must use
HTTPS by default. --allow-insecure (or OPENL_AI_ALLOW_INSECURE=1) explicitly permits
plain HTTP on a trusted internal network.`;
}

function parseArgs(argv) {
  const options = { baseUrl: undefined, status: false, json: false, clear: false, allowInsecure: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--base-url") {
      options.baseUrl = argv[++index];
      if (!options.baseUrl) {
        throw new Error("--base-url requires a value.");
      }
    } else if (argument === "--status") {
      options.status = true;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument === "--clear") {
      options.clear = true;
    } else if (argument === "--allow-insecure") {
      options.allowInsecure = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if ([options.status, options.clear].filter(Boolean).length > 1) {
    throw new Error("Use only one of --status or --clear.");
  }
  if (options.json && !options.status) {
    throw new Error("--json can only be used with --status.");
  }
  if (options.baseUrl && (options.status || options.clear)) {
    throw new Error("--base-url cannot be combined with --status or --clear.");
  }
  if (options.allowInsecure && (options.status || options.clear)) {
    throw new Error("--allow-insecure cannot be combined with --status or --clear.");
  }
  return options;
}

function readSecret(prompt) {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Personal Access Token entry requires an interactive terminal.");
  }

  return new Promise((resolve, reject) => {
    const previousRawMode = stdin.isRaw;
    let secret = "";
    let settled = false;

    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(Boolean(previousRawMode));
      stdin.pause();
    };
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      stdout.write("\n");
      callback();
    };
    const onData = (buffer) => {
      for (const character of buffer.toString("utf8")) {
        if (character === "\u0003") {
          finish(() => reject(new Error("Configuration cancelled.")));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish(() => resolve(secret));
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (secret.length > 0) {
            secret = secret.slice(0, -1);
          }
          continue;
        }
        if (character >= " ") {
          secret += character;
        }
      }
    };

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function showStatus(json) {
  const configPath = resolveConfigPath();
  try {
    const config = await readCodexConfig({ configPath });
    const status = { ...safeConfigStatus(config), configPath };
    if (json) {
      console.log(JSON.stringify(status));
    } else {
      console.log(`Configured Studio: ${status.baseUrl}`);
      console.log(`Authentication: ${status.authentication}`);
      console.log(`Transport: ${status.insecure ? "HTTP (unencrypted)" : "HTTPS"}`);
      console.log(`Configuration file: ${configPath}`);
    }
  } catch (error) {
    if (json && error instanceof CodexConfigNotFoundError) {
      console.log(JSON.stringify({ configured: false, configPath }));
      return;
    }
    throw error;
  }
}

async function configure(baseUrlArgument, { allowInsecure = false } = {}) {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Run this command in an interactive terminal, not through an agent tool.");
  }

  const readline = createInterface({ input: stdin, output: stdout });
  let baseUrl = baseUrlArgument;
  try {
    if (!baseUrl) {
      baseUrl = await readline.question("OpenL Studio address: ");
    }
  } finally {
    readline.close();
  }

  console.error("Checking OpenL Studio…");
  const deployment = await probeStudio(baseUrl, { allowInsecure });
  const transport = classifyStudioTransport(deployment.baseUrl, { allowInsecure });
  // Persist the opt-in only when a non-loopback HTTP address actually needs it.
  // Loopback HTTP is accepted without an opt-in, but is still reported and warned
  // as unencrypted transport.
  const persistInsecure = transport.requiresOptIn && allowInsecure;
  if (!transport.isHttps) {
    console.error(
      "\n⚠️  INSECURE: connecting over plain HTTP. Any Personal Access Token you enter " +
        "is sent unencrypted — use this only for a local copy or on a trusted internal network.",
    );
  }
  let personalAccessToken;
  if (deployment.multiUser) {
    if (!transport.isHttps && !transport.isLoopback && !allowInsecure) {
      throw new Error(
        "A multi-user OpenL Studio must use HTTPS before a Personal Access Token can be entered. " +
          "For a trusted internal HTTP deployment, re-run with --allow-insecure (or OPENL_AI_ALLOW_INSECURE=1).",
      );
    }
    if (!deployment.personalAccessToken) {
      throw new Error("This OpenL Studio does not support Personal Access Tokens.");
    }
    console.error("\nCreate a token in OpenL Studio: User → Personal Access Tokens.");
    console.error("Copy it when Studio shows it; the value will not be echoed below.");
    personalAccessToken = (await readSecret("Personal Access Token: ")).trim();
    if (!personalAccessToken) {
      throw new Error("Personal Access Token cannot be empty for a multi-user Studio.");
    }
  }

  const { configPath } = await writeCodexConfig({
    version: 1,
    baseUrl: deployment.baseUrl,
    ...(persistInsecure ? { allowInsecure: true } : {}),
    ...(personalAccessToken ? { personalAccessToken } : {}),
  });

  console.log(`\nOpenL AI is configured for ${deployment.baseUrl}.`);
  console.log(deployment.multiUser
    ? (process.platform === "win32"
      ? "The token was saved outside Codex; access relies on your Windows user-profile ACLs."
      : "The token was saved outside Codex with owner-only file permissions.")
    : "This Studio is single-user; no token was stored.");
  console.log(`Configuration file: ${configPath}`);
  console.log("Start a new Codex task, then ask: List the OpenL projects I can access.");
}

async function main() {
  assertSupportedNode();
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (options.status) {
    await showStatus(options.json);
    return;
  }
  if (options.clear) {
    const configPath = await clearCodexConfig();
    console.log(`Removed local Codex configuration: ${configPath}`);
    console.log("If you have not already done so, revoke the corresponding token in OpenL Studio now.");
    return;
  }
  const allowInsecure = options.allowInsecure || isInsecureOptIn(process.env.OPENL_AI_ALLOW_INSECURE);
  await configure(options.baseUrl, { allowInsecure });
}

main().catch((error) => {
  console.error(`Configuration failed: ${error?.message ?? String(error)}`);
  process.exitCode = 1;
});

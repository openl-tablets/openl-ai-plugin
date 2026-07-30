#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { realpathSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

const MAX_SECRET_CHARACTERS = 8192;
const TERMINATION_SIGNALS = process.platform === "win32"
  ? ["SIGINT", "SIGTERM", "SIGBREAK"]
  : ["SIGINT", "SIGTERM"];

export function readSecret(
  prompt,
  {
    input = stdin,
    output = stdout,
    signalSource = process,
    maxLength = MAX_SECRET_CHARACTERS,
    terminationSignals = TERMINATION_SIGNALS,
  } = {},
) {
  if (
    !input.isTTY
    || !output.isTTY
    || typeof input.setRawMode !== "function"
    || typeof input.on !== "function"
    || typeof input.off !== "function"
    || typeof output.once !== "function"
    || typeof output.off !== "function"
  ) {
    throw new Error("Personal Access Token entry requires an interactive terminal.");
  }
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new Error("Secret input limit must be a positive integer.");
  }
  if (!Array.isArray(terminationSignals) || terminationSignals.length === 0) {
    throw new Error("At least one termination signal is required.");
  }

  return new Promise((resolvePromise, reject) => {
    const previousRawMode = Boolean(input.isRaw);
    let secret = "";
    let settled = false;
    let rawModeChanged = false;
    let completePendingOutput;
    const signalHandlers = new Map(
      terminationSignals.map((signal) => [
        signal,
        () => cancel(`Configuration cancelled by ${signal}.`),
      ]),
    );

    const cleanupInput = () => {
      input.off("data", onData);
      input.off("end", onInputClosed);
      input.off("close", onInputClosed);
      input.off("error", onInputError);
      for (const [signal, handler] of signalHandlers) {
        signalSource.off(signal, handler);
      }
      if (rawModeChanged) {
        try {
          input.setRawMode(previousRawMode);
        } catch {
          // The terminal may already be gone. There is nothing left to restore.
        }
      }
      try {
        input.pause();
      } catch {
        // Ignore a stream that closed while cleanup was running.
      }
    };
    const cleanupOutput = () => {
      output.off("close", onOutputClosed);
      output.off("error", onOutputError);
    };
    const finish = (callback, { writeNewline = true } = {}) => {
      if (settled) return;
      settled = true;
      cleanupInput();
      if (!writeNewline) {
        cleanupOutput();
        callback();
        return;
      }
      let outputCompleted = false;
      completePendingOutput = () => {
        if (outputCompleted) return;
        outputCompleted = true;
        completePendingOutput = undefined;
        cleanupOutput();
        callback();
      };
      try {
        output.write("\n", completePendingOutput);
      } catch {
        // Do not hide the original result when the output stream has closed.
        completePendingOutput();
      }
    };
    const cancel = (message, options) => finish(() => reject(new Error(message)), options);
    const onInputClosed = () => cancel("Token input closed before it was completed.");
    const onInputError = (error) => cancel(
      `Cannot read Personal Access Token: ${error?.message ?? String(error)}`,
    );
    const onOutputClosed = () => {
      if (settled) {
        completePendingOutput?.();
        return;
      }
      cancel(
        "Token prompt output closed before input was completed.",
        { writeNewline: false },
      );
    };
    const onOutputError = (error) => {
      if (settled) {
        completePendingOutput?.();
        return;
      }
      cancel(
        `Cannot write Personal Access Token prompt: ${error?.message ?? String(error)}`,
        { writeNewline: false },
      );
    };
    const onData = (buffer) => {
      for (const character of buffer.toString("utf8")) {
        if (character === "\u0003") {
          cancel("Configuration cancelled.");
          return;
        }
        if (character === "\r" || character === "\n") {
          finish(() => resolvePromise(secret));
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (secret.length > 0) {
            secret = secret.slice(0, -1);
          }
          continue;
        }
        if (character >= " ") {
          if (secret.length + character.length > maxLength) {
            cancel(`Personal Access Token exceeds the ${maxLength}-character safety limit.`);
            return;
          }
          secret += character;
        }
      }
    };

    try {
      input.on("data", onData);
      input.once("end", onInputClosed);
      input.once("close", onInputClosed);
      input.once("error", onInputError);
      output.once("close", onOutputClosed);
      output.once("error", onOutputError);
      for (const [signal, handler] of signalHandlers) {
        signalSource.once(signal, handler);
      }
      output.write(prompt);
      if (settled) return;
      rawModeChanged = true;
      input.setRawMode(true);
      if (settled) return;
      input.resume();
    } catch (error) {
      cancel(
        `Cannot start secure token input: ${error?.message ?? String(error)}`,
        { writeNewline: false },
      );
    }
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

const isMain = process.argv[1]
  && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(`Configuration failed: ${error?.message ?? String(error)}`);
    process.exitCode = 1;
  });
}

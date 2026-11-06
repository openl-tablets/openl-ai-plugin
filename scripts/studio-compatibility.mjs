#!/usr/bin/env node

// Which MCP server serves which OpenL Studio release, and the check that warns when the
// connected Studio is served by none.
//
// - OpenL Studio 7.0 and later serve their own MCP server at <studio>/mcp, built from the
//   same release, so they always match; the plugin's launcher connects to it.
// - Older Studio releases have none. For them the plugin runs the openl-mcp release
//   pinned below, which calls Studio's REST API. That API changes between Studio
//   releases: connected to a Studio it was not built for, the server mostly keeps
//   working, but some of its tools time out or fail, which looks like a broken tool or a
//   broken project.
//
// Studio publishes its version without sign-in, so the check needs no token.

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeBaseUrl, readLimitedBody } from "./codex-config.mjs";

// The openl-mcp release the plugin runs for a Studio without a built-in MCP server. This
// is the only place that names it: every client starts the plugin's launcher, which
// passes it to npx.
export const OPENL_MCP_VERSION = "1.2.0";

// The first OpenL Studio release line with a built-in MCP server.
export const BUILT_IN_MCP_SINCE = "7.0";

// openl-mcp release line → the OpenL Studio release lines it supports. README.md and
// skills/connect/SKILL.md publish the same rows, plus one for the built-in server, and
// the tests compare them with this table. The pinned release must be the last row.
export const STUDIO_COMPATIBILITY = Object.freeze({
  "1.0": Object.freeze(["6.0"]),
  "1.1": Object.freeze(["6.3"]),
  "1.2": Object.freeze(["6.4"]),
});

export const COMPATIBILITY_TABLE_URL =
  "https://github.com/openl-tablets/openl-ai-plugin#compatible-openl-studio-versions";

// Studio 7.0 and later answer without sign-in under /rest/public. Studio 6.x does so only
// under /web/public: on a multi-user 6.x Studio, /rest/public asks for a sign-in.
export const STUDIO_VERSION_PATHS = Object.freeze([
  "/rest/public/info/openl.json",
  "/web/public/info/openl.json",
]);

const MAX_VERSION_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
// Claude's first reply waits for SessionStart hooks, so the hook gets a short budget:
// an unreachable Studio (VPN off, say) costs at most this long and the hook stays silent.
const SESSION_START_TIMEOUT_MS = 3_000;

/** "6.4.0", "6.4.1-SNAPSHOT" or "6.4" → "6.4"; anything else → null. */
export function releaseLine(version) {
  const match = /^\s*v?(\d+)\.(\d+)(?:[.+-]|\s*$)/u.exec(String(version ?? ""));
  return match ? `${Number(match[1])}.${Number(match[2])}` : null;
}

function formatLines(product, lines) {
  return lines.map((line) => `${product} ${line}`).join(" or ");
}

function compareLines(left, right) {
  const [leftMajor, leftMinor] = left.split(".").map(Number);
  const [rightMajor, rightMinor] = right.split(".").map(Number);
  return leftMajor - rightMajor || leftMinor - rightMinor;
}

/** Whether a Studio of this version serves its own MCP server at <studio>/mcp. */
export function hasBuiltInMcp(studioVersion) {
  const line = releaseLine(studioVersion);
  return line !== null && compareLines(line, BUILT_IN_MCP_SINCE) >= 0;
}

/**
 * Compare a Studio version with the Studio lines the given openl-mcp version supports.
 * `status` is "built-in" for a Studio with its own MCP server, "compatible",
 * "incompatible", or "unknown" when either version cannot be placed in the table.
 */
export function checkCompatibility(
  studioVersion,
  { mcpVersion = OPENL_MCP_VERSION, matrix = STUDIO_COMPATIBILITY } = {},
) {
  const mcpLine = releaseLine(mcpVersion);
  const studioLine = releaseLine(studioVersion);
  const supportedStudioLines = mcpLine && Object.hasOwn(matrix, mcpLine) ? [...matrix[mcpLine]] : [];
  const mcpLinesForStudio = studioLine
    ? Object.keys(matrix).filter((line) => matrix[line].includes(studioLine))
    : [];
  let status = "unknown";
  if (hasBuiltInMcp(studioVersion)) {
    status = "built-in";
  } else if (studioLine && supportedStudioLines.length > 0) {
    status = supportedStudioLines.includes(studioLine) ? "compatible" : "incompatible";
  }
  return {
    status,
    mcpVersion: String(mcpVersion),
    studioVersion: String(studioVersion),
    studioLine,
    supportedStudioLines,
    mcpLinesForStudio,
  };
}

/** The warning for an incompatible pair: both versions, what to do, and the table. */
export function describeMismatch(result, { baseUrl } = {}) {
  const where = baseUrl ? ` at ${baseUrl}` : "";
  const alternative = result.mcpLinesForStudio.length > 0
    ? `OpenL Studio ${result.studioLine} works with ${formatLines("OpenL MCP", result.mcpLinesForStudio)}.`
    : `No OpenL MCP release supports OpenL Studio ${result.studioLine}.`;
  return `OpenL Studio${where} is version ${result.studioVersion}, but the OpenL MCP server ` +
    `${result.mcpVersion} that this plugin runs for it supports ${formatLines("OpenL Studio", result.supportedStudioLines)} ` +
    `only, so some OpenL tools may time out or fail. ${alternative} OpenL Studio ` +
    `${BUILT_IN_MCP_SINCE} and later have their own MCP server, which the plugin uses instead. ` +
    `Compatible versions: ${COMPATIBILITY_TABLE_URL}`;
}

function parseVersionInfo(body) {
  let info;
  try {
    info = JSON.parse(body);
  } catch {
    return null;
  }
  if (!info || typeof info !== "object" || Array.isArray(info)) {
    return null;
  }
  const version = info["openl.version"];
  if (typeof version !== "string" || !releaseLine(version)) {
    return null;
  }
  return version.trim();
}

/**
 * Read the version an OpenL Studio reports about itself, without signing in. Follows no
 * redirects, caps the response size, and gives up after `timeoutMs` for all attempts.
 */
export async function fetchStudioVersion(
  baseUrl,
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = MAX_VERSION_BYTES,
  } = {},
) {
  if (typeof fetchImpl !== "function") {
    throw new Error("This Node.js runtime does not provide fetch(). Node.js 24 or later is required.");
  }

  // The version is public and no token is sent, so plain HTTP to any host is acceptable
  // here; the address rules (scheme, no credentials, no query) still apply.
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, { allowInsecure: true });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const failures = [];
  try {
    for (const path of STUDIO_VERSION_PATHS) {
      try {
        const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
          headers: { Accept: "application/json" },
          redirect: "error",
          signal: controller.signal,
        });
        if (response.status !== 200) {
          await response.body?.cancel().catch(() => {});
          failures.push(`${path} returned HTTP ${response.status}`);
          continue;
        }
        const version = parseVersionInfo(await readLimitedBody(response, maxBytes));
        if (version) {
          return { baseUrl: normalizedBaseUrl, version };
        }
        failures.push(`${path} did not contain openl.version`);
      } catch (error) {
        if (controller.signal.aborted) {
          const seconds = Math.ceil(timeoutMs / 1000);
          throw new Error(
            `OpenL Studio did not report its version within ${seconds} second${seconds === 1 ? "" : "s"}.`,
          );
        }
        failures.push(`${path}: ${error?.message ?? String(error)}`);
      }
    }
  } finally {
    clearTimeout(timeout);
  }
  throw new Error(`OpenL Studio did not report its version (${failures.join("; ")}).`);
}

/**
 * Fetch the Studio version and compare it with the pinned openl-mcp. Never throws: a
 * Studio that cannot be read comes back with `result: null` and an explanatory message.
 */
export async function checkStudio(baseUrl, { mcpVersion = OPENL_MCP_VERSION, ...fetchOptions } = {}) {
  let studio;
  try {
    studio = await fetchStudioVersion(baseUrl, fetchOptions);
  } catch (error) {
    return {
      result: null,
      message: `Could not read the OpenL Studio version, so its compatibility with the OpenL MCP ` +
        `server ${mcpVersion} was not checked: ${error?.message ?? String(error)}`,
    };
  }
  const result = checkCompatibility(studio.version, { mcpVersion });
  let message;
  if (result.status === "built-in") {
    message = `OpenL Studio ${studio.version} at ${studio.baseUrl} has its own MCP server at ` +
      `${studio.baseUrl}/mcp, and the plugin connects to it.`;
  } else if (result.status === "compatible") {
    message = `OpenL Studio ${studio.version} at ${studio.baseUrl} works with the OpenL MCP server ${mcpVersion}.`;
  } else if (result.status === "incompatible") {
    message = describeMismatch(result, { baseUrl: studio.baseUrl });
  } else {
    message = `OpenL Studio at ${studio.baseUrl} reports version ${studio.version}, which the ` +
      `compatibility table cannot place for the OpenL MCP server ${mcpVersion}: ${COMPATIBILITY_TABLE_URL}`;
  }
  return { result, baseUrl: studio.baseUrl, message };
}

/**
 * The Claude Code SessionStart hook: the JSON to print when the configured Studio is
 * incompatible, or null to stay silent. Silence is also the answer when the address is
 * not configured or Studio cannot be read — the server reports those itself, and
 * `openl:connect` diagnoses them.
 */
export async function sessionStartHookOutput({
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = SESSION_START_TIMEOUT_MS,
} = {}) {
  const address = String(env.CLAUDE_PLUGIN_OPTION_STUDIO_BASE_URL ?? "").trim();
  if (!address || address.startsWith("${")) {
    return null;
  }
  const { result, baseUrl } = await checkStudio(address, { fetchImpl, timeoutMs });
  if (result?.status !== "incompatible") {
    return null;
  }
  const warning = describeMismatch(result, { baseUrl });
  return {
    systemMessage: `OpenL Plugin: ${warning}`,
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: `${warning} If an OpenL tool times out or returns an unexpected error in ` +
        "this session, tell the user about this version mismatch before treating the failure as a " +
        "problem in their rules, project, or connection.",
    },
  };
}

function usage() {
  return `Check that the plugin has an MCP server for an OpenL Studio: the one built into
OpenL Studio ${BUILT_IN_MCP_SINCE} and later, or the OpenL MCP server ${OPENL_MCP_VERSION} it runs for older releases.

Usage:
  node scripts/studio-compatibility.mjs --base-url <url> [--json]
  node scripts/studio-compatibility.mjs --session-start-hook

The Studio version is read without signing in. Exit code 0 means compatible or built-in;
1 means incompatible or not checked. --session-start-hook reads the address from
CLAUDE_PLUGIN_OPTION_STUDIO_BASE_URL, prints Claude Code hook JSON only on a mismatch,
and always exits 0.`;
}

function parseArgs(argv) {
  const options = { baseUrl: undefined, json: false, hook: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--base-url") {
      options.baseUrl = argv[++index];
      if (!options.baseUrl) {
        throw new Error("--base-url requires a value.");
      }
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument === "--session-start-hook") {
      options.hook = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (options.hook && (options.baseUrl || options.json)) {
    throw new Error("--session-start-hook cannot be combined with --base-url or --json.");
  }
  if (!options.hook && !options.help && !options.baseUrl) {
    throw new Error("--base-url is required.");
  }
  return options;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--session-start-hook")) {
    // A hook must never fail the session start, whatever goes wrong.
    try {
      const output = await sessionStartHookOutput();
      if (output) {
        process.stdout.write(`${JSON.stringify(output)}\n`);
      }
    } catch {
      // Stay silent.
    }
    return;
  }

  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }
  const check = await checkStudio(options.baseUrl);
  if (options.json) {
    console.log(JSON.stringify({ ...(check.result ?? { status: "not-checked" }), message: check.message }));
  } else {
    console.log(check.message);
  }
  process.exitCode = ["compatible", "built-in"].includes(check.result?.status) ? 0 : 1;
}

const isMain = process.argv[1]
  && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(`OpenL Studio compatibility check failed: ${error?.message ?? String(error)}`);
    process.exitCode = 1;
  });
}

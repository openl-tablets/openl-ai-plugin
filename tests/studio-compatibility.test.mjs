import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";
import {
  BUILT_IN_MCP_SINCE,
  checkCompatibility,
  checkStudio,
  COMPATIBILITY_TABLE_URL,
  describeMismatch,
  fetchStudioVersion,
  hasBuiltInMcp,
  OPENL_MCP_VERSION,
  releaseLine,
  sessionStartHookOutput,
  STUDIO_COMPATIBILITY,
} from "../scripts/studio-compatibility.mjs";

// A stand-in for OpenL Studio's public version endpoint. `routes` maps a path to a
// handler; everything else is 404.
async function withStudio(routes, callback) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ url: request.url, authorization: request.headers.authorization });
    const handler = routes[request.url];
    if (!handler) {
      response.writeHead(404).end();
      return;
    }
    handler(request, response);
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    return await callback(baseUrl, requests);
  } finally {
    server.closeAllConnections();
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }
}

const json = (body, status = 200) => (_request, response) => {
  response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
};
const status = (code) => (_request, response) => response.writeHead(code).end();

// Studio 6.x: /rest/public asks a multi-user Studio for a sign-in; /web/public answers.
const studio6 = (version) => ({
  "/rest/public/info/openl.json": status(401),
  "/web/public/info/openl.json": json({ "openl.version": version, "openl.build.date": "2026-08-19" }),
});
// Studio 7.0+: /rest/public answers; /web is gone.
const studio7 = (version) => ({
  "/rest/public/info/openl.json": json({ "openl.version": version, "openl.build.date": "2026-10-07" }),
});

function runScript(args, env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, ["scripts/studio-compatibility.mjs", ...args], {
      env: { ...process.env, CLAUDE_PLUGIN_OPTION_STUDIO_BASE_URL: "", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", rejectPromise);
    child.once("exit", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

test("release lines are the first two numbers of a version", () => {
  assert.equal(releaseLine("6.4.0"), "6.4");
  assert.equal(releaseLine("6.4.12"), "6.4");
  assert.equal(releaseLine("6.5.0-SNAPSHOT"), "6.5");
  assert.equal(releaseLine("7.0.1+build.5"), "7.0");
  assert.equal(releaseLine("6.4"), "6.4");
  assert.equal(releaseLine(" v1.2.0 "), "1.2");
  assert.equal(releaseLine("06.04.0"), "6.4");
  assert.equal(releaseLine("???"), null);
  assert.equal(releaseLine("6"), null);
  assert.equal(releaseLine("6.4x"), null);
  assert.equal(releaseLine(undefined), null);
});

test("Studio 7.0 and later have their own MCP server", () => {
  assert.equal(BUILT_IN_MCP_SINCE, "7.0");
  for (const version of ["7.0.0", "7.0.1", "7.12.0", "8.0.0-SNAPSHOT", "10.1"]) {
    assert.equal(hasBuiltInMcp(version), true, version);
    assert.equal(checkCompatibility(version).status, "built-in", version);
  }
  for (const version of ["6.4.0", "6.5.0-SNAPSHOT", "6.10.0", "???", undefined]) {
    assert.equal(hasBuiltInMcp(version), false, String(version));
  }
});

test("the pinned server is compatible only with the Studio lines in its row", () => {
  for (const version of ["6.4.0", "6.4.3", "6.4.1-SNAPSHOT"]) {
    assert.equal(checkCompatibility(version).status, "compatible", version);
  }

  // The unreleased 6.5 nightly changed the API openl-mcp 1.2 calls; it became 7.0.
  const nightly = checkCompatibility("6.5.0-SNAPSHOT");
  assert.equal(nightly.status, "incompatible");
  assert.equal(nightly.mcpVersion, OPENL_MCP_VERSION);
  assert.equal(nightly.studioLine, "6.5");
  assert.deepEqual(nightly.supportedStudioLines, ["6.4"]);
  assert.deepEqual(nightly.mcpLinesForStudio, []);

  const older = checkCompatibility("6.3.0");
  assert.equal(older.status, "incompatible");
  assert.deepEqual(older.mcpLinesForStudio, ["1.1"]);

  assert.equal(checkCompatibility("6.3.0", { mcpVersion: "1.1.0" }).status, "compatible");
  assert.equal(checkCompatibility("???").status, "unknown");
  assert.equal(checkCompatibility("6.4.0", { mcpVersion: "9.9.0" }).status, "unknown");
  // Object.prototype keys must not be mistaken for table rows.
  assert.equal(checkCompatibility("6.4.0", { mcpVersion: "constructor" }).status, "unknown");
});

test("the mismatch warning names both versions, what works, and the table", () => {
  const newer = describeMismatch(checkCompatibility("6.5.0-SNAPSHOT"), { baseUrl: "https://studio.example.com" });
  assert.match(newer, /OpenL Studio at https:\/\/studio\.example\.com is version 6\.5\.0-SNAPSHOT/u);
  assert.match(newer, new RegExp(`OpenL MCP server ${OPENL_MCP_VERSION.replaceAll(".", "\\.")}`, "u"));
  assert.match(newer, /supports OpenL Studio 6\.4 only/u);
  assert.match(newer, /No OpenL MCP release supports OpenL Studio 6\.5\./u);
  assert.match(newer, /OpenL Studio 7\.0 and later have their own MCP server, which the plugin uses instead\./u);
  assert.ok(newer.endsWith(COMPATIBILITY_TABLE_URL));

  const older = describeMismatch(checkCompatibility("6.3.2"));
  assert.match(older, /^OpenL Studio is version 6\.3\.2/u);
  assert.match(older, /OpenL Studio 6\.3 works with OpenL MCP 1\.1\./u);
});

test("the version is read from /rest/public on Studio 7 and from /web/public on Studio 6", async () => {
  await withStudio(studio7("7.0.1"), async (baseUrl, requests) => {
    assert.deepEqual(await fetchStudioVersion(`${baseUrl}/`), { baseUrl, version: "7.0.1" });
    assert.deepEqual(requests.map((request) => request.url), ["/rest/public/info/openl.json"]);
  });
  await withStudio(studio6("6.4.0"), async (baseUrl, requests) => {
    assert.deepEqual(await fetchStudioVersion(baseUrl), { baseUrl, version: "6.4.0" });
    assert.deepEqual(
      requests.map((request) => request.url),
      ["/rest/public/info/openl.json", "/web/public/info/openl.json"],
    );
    assert.ok(requests.every((request) => request.authorization === undefined), "no credential is sent");
  });
});

test("a Studio under a context path is probed below that path", async () => {
  await withStudio(
    { "/webstudio/rest/public/info/openl.json": json({ "openl.version": "6.4.1" }) },
    async (baseUrl) => {
      const studio = await fetchStudioVersion(`${baseUrl}/webstudio`);
      assert.equal(studio.version, "6.4.1");
      assert.equal(studio.baseUrl, `${baseUrl}/webstudio`);
    },
  );
});

test("HTML, redirects and responses without a version fall through to the next path", async () => {
  await withStudio(
    {
      "/rest/public/info/openl.json": (_request, response) => {
        response.writeHead(200, { "Content-Type": "text/html" }).end("<html>Studio</html>");
      },
      "/web/public/info/openl.json": json({ "openl.version": "6.4.0" }),
    },
    async (baseUrl) => assert.equal((await fetchStudioVersion(baseUrl)).version, "6.4.0"),
  );

  await withStudio(
    {
      "/rest/public/info/openl.json": (_request, response) => {
        response.writeHead(302, { Location: "/login" }).end();
      },
      "/web/public/info/openl.json": json({ "openl.version": "???" }),
    },
    async (baseUrl) => {
      await assert.rejects(fetchStudioVersion(baseUrl), (error) => {
        assert.match(error.message, /did not report its version/u);
        assert.match(error.message, /\/web\/public\/info\/openl\.json did not contain openl\.version/u);
        return true;
      });
    },
  );
});

test("a Studio that does not answer in time is reported as such", async () => {
  await withStudio(
    { "/rest/public/info/openl.json": () => {} },
    async (baseUrl) => {
      await assert.rejects(
        fetchStudioVersion(baseUrl, { timeoutMs: 200 }),
        /did not report its version within 1 second\./u,
      );
    },
  );
});

test("an oversized response is not read to the end", async () => {
  await withStudio(
    { "/rest/public/info/openl.json": json({ "openl.version": "6.4.0", padding: "x".repeat(70_000) }) },
    async (baseUrl) => {
      await assert.rejects(fetchStudioVersion(baseUrl), /unexpectedly large/u);
    },
  );
});

test("addresses with credentials, queries or other schemes are refused", async () => {
  await assert.rejects(fetchStudioVersion("https://user:pass@studio.example.com"), /username or password/u);
  await assert.rejects(fetchStudioVersion("https://studio.example.com/?x=1"), /query string/u);
  await assert.rejects(fetchStudioVersion("ftp://studio.example.com"), /http:\/\/ or https:\/\//u);
});

test("checkStudio reports every outcome as a sentence and never throws", async () => {
  await withStudio(studio6("6.4.0"), async (baseUrl) => {
    const check = await checkStudio(baseUrl);
    assert.equal(check.result.status, "compatible");
    assert.match(check.message, /6\.4\.0 .* works with the OpenL MCP server/u);
  });
  await withStudio(studio7("7.0.1"), async (baseUrl) => {
    const check = await checkStudio(baseUrl);
    assert.equal(check.result.status, "built-in");
    assert.equal(
      check.message,
      `OpenL Studio 7.0.1 at ${baseUrl} has its own MCP server at ${baseUrl}/mcp, and the plugin connects to it.`,
    );
  });
  await withStudio(studio6("6.3.0"), async (baseUrl) => {
    const check = await checkStudio(baseUrl);
    assert.equal(check.result.status, "incompatible");
    assert.match(check.message, /is version 6\.3\.0/u);
  });
  const unreachable = await checkStudio("http://127.0.0.1:1", { timeoutMs: 2_000 });
  assert.equal(unreachable.result, null);
  assert.match(unreachable.message, /was not checked/u);
});

test("the session-start hook speaks up only when the versions are known to differ", async () => {
  await withStudio(studio6("6.3.0"), async (baseUrl) => {
    const output = await sessionStartHookOutput({ env: { CLAUDE_PLUGIN_OPTION_STUDIO_BASE_URL: baseUrl } });
    assert.match(output.systemMessage, /^OpenL Plugin: OpenL Studio at .* is version 6\.3\.0/u);
    assert.match(output.systemMessage, /OpenL Studio 6\.3 works with OpenL MCP 1\.1\./u);
    assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
    assert.match(output.hookSpecificOutput.additionalContext, /is version 6\.3\.0/u);
    assert.match(output.hookSpecificOutput.additionalContext, /tell the user about this version mismatch/u);
  });
  // A compatible Studio, and one whose own MCP server the plugin uses, need no warning.
  for (const studio of [studio6("6.4.0"), studio7("7.0.1")]) {
    await withStudio(studio, async (baseUrl) => {
      assert.equal(await sessionStartHookOutput({ env: { CLAUDE_PLUGIN_OPTION_STUDIO_BASE_URL: baseUrl } }), null);
    });
  }
  for (const value of [undefined, "", "   ", "${user_config.studio_base_url}"]) {
    assert.equal(await sessionStartHookOutput({ env: { CLAUDE_PLUGIN_OPTION_STUDIO_BASE_URL: value } }), null);
  }
  assert.equal(
    await sessionStartHookOutput({ env: { CLAUDE_PLUGIN_OPTION_STUDIO_BASE_URL: "http://127.0.0.1:1" } }),
    null,
  );
});

test("the hook command prints hook JSON on a mismatch and always exits 0", async () => {
  await withStudio(studio6("6.5.0-SNAPSHOT"), async (baseUrl) => {
    const run = await runScript(["--session-start-hook"], { CLAUDE_PLUGIN_OPTION_STUDIO_BASE_URL: baseUrl });
    assert.equal(run.code, 0);
    assert.equal(run.stderr, "");
    const output = JSON.parse(run.stdout);
    assert.match(output.systemMessage, /6\.5\.0-SNAPSHOT/u);
    assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  });
  await withStudio(studio6("6.4.0"), async (baseUrl) => {
    const run = await runScript(["--session-start-hook"], { CLAUDE_PLUGIN_OPTION_STUDIO_BASE_URL: baseUrl });
    assert.deepEqual(run, { code: 0, stdout: "", stderr: "" });
  });
  const unconfigured = await runScript(["--session-start-hook"], {});
  assert.deepEqual(unconfigured, { code: 0, stdout: "", stderr: "" });
});

test("the command-line check exits 0 only when the plugin has a server for the Studio", async () => {
  await withStudio(studio6("6.4.0"), async (baseUrl) => {
    const run = await runScript(["--base-url", baseUrl], {});
    assert.equal(run.code, 0);
    assert.match(run.stdout, /works with the OpenL MCP server/u);
  });
  await withStudio(studio7("7.0.1"), async (baseUrl) => {
    const run = await runScript(["--base-url", baseUrl, "--json"], {});
    assert.equal(run.code, 0);
    assert.equal(JSON.parse(run.stdout).status, "built-in");
  });
  await withStudio(studio6("6.3.0"), async (baseUrl) => {
    const run = await runScript(["--base-url", baseUrl, "--json"], {});
    assert.equal(run.code, 1);
    const output = JSON.parse(run.stdout);
    assert.equal(output.status, "incompatible");
    assert.equal(output.studioVersion, "6.3.0");
    assert.equal(output.mcpVersion, OPENL_MCP_VERSION);
  });
  const missing = await runScript([], {});
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /--base-url is required/u);
});

// --- The published tables -------------------------------------------------------------

function markdownSection(markdown, heading) {
  const normalized = markdown.replaceAll("\r\n", "\n");
  const start = normalized.indexOf(`\n${heading}\n`);
  assert.ok(start >= 0, `missing section "${heading}"`);
  const level = heading.match(/^#+/u)[0];
  const rest = normalized.slice(start + heading.length + 2);
  const end = rest.search(new RegExp(`^${level} `, "mu"));
  return end >= 0 ? rest.slice(0, end) : rest;
}

// Rows whose first cell is an openl-mcp line, in table order: [["1.0", ["6.0"]], …].
function compatibilityRows(section) {
  return [...section.matchAll(/^\s*\|\s*(\d+\.\d+)\s*\|\s*([^|]+?)\s*\|/gmu)].map(([, mcp, studio]) => [
    mcp,
    studio.split(/\s*(?:,|\bor\b)\s*/u),
  ]);
}

const expectedRows = Object.entries(STUDIO_COMPATIBILITY).map(([mcp, studio]) => [mcp, [...studio]]);

// The row for Studio releases with their own server: "| built into Studio | 7.0 and later |".
const builtInRow = new RegExp(`^\\s*\\|\\s*built into Studio\\s*\\|\\s*${BUILT_IN_MCP_SINCE.replace(".", "\\.")} and later\\s*\\|`, "mu");

test("the README publishes the compatibility table the code uses", async () => {
  const readme = await readFile("README.md", "utf8");
  const section = markdownSection(readme, "## Compatible OpenL Studio versions");
  assert.deepEqual(compatibilityRows(section), expectedRows);
  assert.match(section, builtInRow);
  // The warning links to this section by its GitHub anchor.
  assert.ok(COMPATIBILITY_TABLE_URL.endsWith("#compatible-openl-studio-versions"));
});

test("openl:connect carries the same compatibility table", async () => {
  const skill = await readFile("skills/connect/SKILL.md", "utf8");
  const section = markdownSection(skill, "## Check version compatibility");
  assert.deepEqual(compatibilityRows(section), expectedRows);
  assert.match(section, builtInRow);
});

// The skill tells the agent that the last row is the server this plugin release runs.
test("the pinned server has a row, and it is the last one", () => {
  const lines = Object.keys(STUDIO_COMPATIBILITY);
  assert.equal(lines.at(-1), releaseLine(OPENL_MCP_VERSION));
});

// --- Claude Code wiring ------------------------------------------------------------------

test("Claude Code runs the check from an inline SessionStart hook", async () => {
  const claude = JSON.parse(await readFile(".claude-plugin/plugin.json", "utf8"));
  const [group, ...otherGroups] = claude.hooks.SessionStart;
  assert.deepEqual(otherGroups, []);
  assert.equal(group.matcher, "startup|resume|clear");
  assert.equal(group.hooks.length, 1);
  const [hook] = group.hooks;
  assert.equal(hook.type, "command");
  assert.equal(hook.async, undefined, "only a synchronous hook's systemMessage reaches the user");
  assert.equal(
    hook.command,
    'node "${CLAUDE_PLUGIN_ROOT}/scripts/studio-compatibility.mjs" --session-start-hook',
  );
  // The address arrives as CLAUDE_PLUGIN_OPTION_STUDIO_BASE_URL; substituting the
  // user's value into a shell command would let it run as shell syntax.
  assert.doesNotMatch(hook.command, /\$\{user_config\./u);
  assert.ok(hook.timeout >= 5 && hook.timeout <= 15);
  assert.deepEqual(Object.keys(claude.hooks), ["SessionStart"]);
  await assert.doesNotReject(access("scripts/studio-compatibility.mjs"));
});

// Claude Code merges hooks/hooks.json with the manifest's hooks, but Cursor and Codex may
// discover that default file too and read it under their own hook contracts. Keeping the
// hook inline in the Claude manifest keeps it Claude-only.
test("no client but Claude Code gets the hook", async () => {
  await assert.rejects(access("hooks/hooks.json"));
  const cursor = JSON.parse(await readFile(".cursor-plugin/plugin.json", "utf8"));
  const codex = JSON.parse(await readFile(".codex-plugin/plugin.json", "utf8"));
  assert.equal(cursor.hooks, undefined);
  assert.equal(codex.hooks, undefined);
});

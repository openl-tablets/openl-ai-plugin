import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chooseServer, describeChoice } from "../scripts/start-openl-mcp.mjs";
import { OPENL_MCP_VERSION } from "../scripts/studio-compatibility.mjs";
import { builtInMcpRoutes, startFakeStudio, versionRoutes } from "./helpers/fake-studio.mjs";
import { installFakeNpx, startNode, waitFor } from "./helpers/processes.mjs";

const launcher = join(process.cwd(), "scripts/start-openl-mcp.mjs");
const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } },
};

async function withStudio(routes, callback) {
  const studio = await startFakeStudio(routes);
  try {
    return await callback(studio);
  } finally {
    await studio.close();
  }
}

test("Studio 7.0 and later are served by their own MCP server", async () => {
  for (const version of ["7.0.0", "7.1.2", "8.0.0-SNAPSHOT"]) {
    await withStudio(versionRoutes(version), async (studio) => {
      assert.deepEqual(await chooseServer(`${studio.baseUrl}/`), {
        kind: "built-in",
        studioVersion: version,
        url: `${studio.baseUrl}/mcp`,
      });
    });
  }
});

test("the built-in server of a Studio under a context path is below that path", async () => {
  await withStudio(
    { "GET /webstudio/rest/public/info/openl.json": versionRoutes("7.0.0")["GET /rest/public/info/openl.json"] },
    async (studio) => {
      const server = await chooseServer(`${studio.baseUrl}/webstudio`);
      assert.equal(server.url, `${studio.baseUrl}/webstudio/mcp`);
    },
  );
});

test("older Studio releases, and a Studio that cannot be read, get the pinned openl-mcp", async () => {
  for (const version of ["6.4.0", "6.3.1", "6.5.0-SNAPSHOT"]) {
    await withStudio(versionRoutes(version), async (studio) => {
      assert.deepEqual(await chooseServer(studio.baseUrl), { kind: "bundled", studioVersion: version });
    });
  }
  const unreachable = await chooseServer("http://127.0.0.1:1");
  assert.equal(unreachable.kind, "bundled");
  assert.equal(unreachable.studioVersion, null);
  assert.match(unreachable.reason, /did not report its version/u);
  assert.equal((await chooseServer("${user_config.studio_base_url}")).kind, "bundled");
  assert.equal((await chooseServer("")).kind, "bundled");
});

test("the choice is explained in one line for the client's MCP log", () => {
  assert.equal(
    describeChoice({ kind: "built-in", studioVersion: "7.0.0", url: "https://studio.example.com/mcp" }),
    "OpenL Studio 7.0.0 has a built-in MCP server; connecting to https://studio.example.com/mcp.",
  );
  assert.equal(
    describeChoice({ kind: "bundled", studioVersion: "6.4.0" }),
    `OpenL Studio 6.4.0 has no built-in MCP server; starting openl-mcp ${OPENL_MCP_VERSION}.`,
  );
  assert.match(describeChoice({ kind: "bundled", studioVersion: null, reason: "timeout" }), /\(timeout\)/u);
});

test("the launcher bridges to Studio 7.0's own server and closes the session on exit", async () => {
  await withStudio(builtInMcpRoutes(), async (studio) => {
    const token = "openl_pat_launcher.secret";
    const run = startNode(launcher, {
      ...process.env,
      OPENL_BASE_URL: studio.baseUrl,
      OPENL_PERSONAL_ACCESS_TOKEN: token,
    });
    run.child.stdin.write(`${JSON.stringify(initialize)}\n`);
    await waitFor(() => run.stdout.includes("\n"));
    run.child.stdin.end();
    const exit = await run.exited;

    assert.equal(exit.code, 0, run.stderr);
    const answer = JSON.parse(run.stdout.trim().split("\n")[0]);
    assert.equal(answer.id, 1);
    assert.equal(answer.result.serverInfo.name, "studio-mcp");
    assert.match(run.stderr, /OpenL Studio 7\.0\.0 has a built-in MCP server; connecting to http:\/\/127\.0\.0\.1:\d+\/mcp\./u);
    assert.doesNotMatch(`${run.stdout}${run.stderr}`, /openl_pat_launcher/u);

    const posts = studio.requests.filter((request) => request.url === "/mcp" && request.method === "POST");
    assert.equal(posts[0].headers.authorization, `Token ${token}`);
    assert.ok(studio.requests.some((request) => request.method === "DELETE" && request.url === "/mcp"));
  });
});

test("a termination signal ends the bridge and its session", { skip: process.platform === "win32" }, async () => {
  await withStudio(builtInMcpRoutes(), async (studio) => {
    const run = startNode(launcher, { ...process.env, OPENL_BASE_URL: studio.baseUrl, OPENL_PERSONAL_ACCESS_TOKEN: "" });
    run.child.stdin.write(`${JSON.stringify(initialize)}\n`);
    await waitFor(() => run.stdout.includes("\n"));
    run.child.kill("SIGTERM");
    const exit = await run.exited;
    assert.equal(exit.code, 0, run.stderr);
    assert.ok(studio.requests.some((request) => request.method === "DELETE"));
  });
});

test("the launcher runs the pinned openl-mcp for Studio 6.4 with the client's settings", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "openl-launcher-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const capturePath = join(root, "capture.json");
  const npxEnvironment = await installFakeNpx(root, capturePath);

  await withStudio(versionRoutes("6.4.0"), async (studio) => {
    const run = startNode(launcher, {
      ...process.env,
      ...npxEnvironment,
      OPENL_BASE_URL: studio.baseUrl,
      OPENL_PERSONAL_ACCESS_TOKEN: "openl_pat_bundled.secret",
    });
    run.child.stdin.end();
    const exit = await run.exited;
    assert.equal(exit.code, 0, run.stderr);
    assert.match(run.stderr, /OpenL Studio 6\.4\.0 has no built-in MCP server; starting openl-mcp/u);
    assert.doesNotMatch(`${run.stdout}${run.stderr}`, /openl_pat_bundled/u);

    const capture = JSON.parse(await readFile(capturePath, "utf8"));
    assert.deepEqual(capture.argv, ["-y", "-p", `openl-mcp@${OPENL_MCP_VERSION}`, "openl-mcp"]);
    assert.equal(capture.baseUrl, studio.baseUrl);
    assert.equal(capture.token, "openl_pat_bundled.secret");
    assert.equal(studio.requests.filter((request) => request.url === "/mcp").length, 0);
  });
});

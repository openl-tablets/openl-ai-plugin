import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  createBridge,
  encodeMcpHeaderValue,
  modernRequestHeaders,
  readServerSentEvents,
  runBridge,
} from "../scripts/mcp-http-bridge.mjs";
import { builtInMcpRoutes, json, startFakeStudio } from "./helpers/fake-studio.mjs";

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

function collectingBridge(studio, options = {}) {
  const delivered = [];
  const logged = [];
  const bridge = createBridge({
    url: `${studio.baseUrl}/mcp`,
    token: "openl_pat_test.secret",
    deliver: (message) => delivered.push(message),
    log: (text) => logged.push(text),
    ...options,
  });
  return { bridge, delivered, logged };
}

const mcpPosts = (studio) => studio.requests.filter((request) => request.method === "POST" && request.url === "/mcp");

test("server-sent events are split into the data of each event", async () => {
  async function* chunks(...parts) {
    for (const part of parts) {
      yield new TextEncoder().encode(part);
    }
  }
  const events = [];
  for await (const data of readServerSentEvents(chunks(
    ": keep-alive\r\n\r",
    "\nevent: message\r\ndata: {\"a\":",
    "1}\r\n\r\ndata: line one\ndata:line two\n\n",
    "id: 7\ndata: last",
  ))) {
    events.push(data);
  }
  assert.deepEqual(events, ['{"a":1}', "line one\nline two", "last"]);
});

// MCP 2026-07-28 (which Studio 7.0 speaks and Claude Code tries first) requires these
// headers on every request; a request without them is answered 400. Values follow the
// MCP SDK 2.4.0 HTTP client, which Studio 7.0.0 validates against.
const modernMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("header values are plain ASCII or Base64-wrapped as the MCP HTTP binding requires", () => {
  assert.equal(encodeMcpHeaderValue("openl_list_projects"), "openl_list_projects");
  assert.equal(encodeMcpHeaderValue("file:///a b\tc"), "file:///a b\tc");
  assert.equal(encodeMcpHeaderValue("привет"), `=?base64?${Buffer.from("привет").toString("base64")}?=`);
  assert.equal(encodeMcpHeaderValue(" padded"), `=?base64?${Buffer.from(" padded").toString("base64")}?=`);
  assert.equal(encodeMcpHeaderValue(""), "=?base64??=");
  assert.equal(encodeMcpHeaderValue("=?base64?x?="), `=?base64?${Buffer.from("=?base64?x?=").toString("base64")}?=`);
});

test("a 2026-07-28 request gets its version, method and name as headers; older ones get none", () => {
  assert.deepEqual(
    modernRequestHeaders({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "echo", _meta: modernMeta } }),
    { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call", "Mcp-Name": "echo" },
  );
  assert.deepEqual(
    modernRequestHeaders({ jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri: "openl://x", _meta: modernMeta } }),
    { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "resources/read", "Mcp-Name": "openl://x" },
  );
  assert.deepEqual(
    modernRequestHeaders({ jsonrpc: "2.0", id: 3, method: "tools/list", params: { _meta: modernMeta } }),
    { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/list" },
  );
  assert.deepEqual(modernRequestHeaders(initialize), {});
  assert.deepEqual(modernRequestHeaders({ jsonrpc: "2.0", id: 4, method: "tools/list" }), {});
  // Notifications are exempt, and responses carry no method.
  assert.deepEqual(modernRequestHeaders({ jsonrpc: "2.0", method: "notifications/cancelled", params: { _meta: modernMeta } }), {});
  assert.deepEqual(modernRequestHeaders({ jsonrpc: "2.0", id: 5, result: {} }), {});
});

test("2026-07-28 requests are sent statelessly with the derived headers", async () => {
  await withStudio(
    builtInMcpRoutes({
      "POST /mcp": (request, response, message) => {
        if (request.headers["mcp-protocol-version"] !== "2026-07-28" || request.headers["mcp-method"] !== message.method) {
          response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({
            jsonrpc: "2.0", id: message.id, error: { code: -32020, message: "headers missing" },
          }));
          return;
        }
        json(response, { jsonrpc: "2.0", id: message.id, result: { method: message.method } });
      },
    }),
    async (studio) => {
      const { bridge, delivered } = collectingBridge(studio);
      await bridge.handle({ jsonrpc: "2.0", id: 1, method: "server/discover", params: { _meta: modernMeta } });
      await bridge.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "openl_list_projects", arguments: {}, _meta: modernMeta } });
      assert.deepEqual(delivered.map((message) => message.result?.method), ["server/discover", "tools/call"]);
      const [, call] = mcpPosts(studio);
      assert.equal(call.headers["mcp-name"], "openl_list_projects");
      assert.equal(call.headers["mcp-session-id"], undefined);
      assert.equal(bridge.sessionId, undefined);
    },
  );
});

test("initialize opens a session that later requests carry, with the PAT as a Token", async () => {
  await withStudio(builtInMcpRoutes(), async (studio) => {
    const { bridge, delivered } = collectingBridge(studio);
    await bridge.handle(initialize);
    await bridge.handle({ jsonrpc: "2.0", method: "notifications/initialized" });
    await bridge.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });

    assert.deepEqual(delivered.map((message) => message.id ?? message.method), [1, "notifications/message", 2]);
    assert.equal(delivered[0].result.serverInfo.name, "studio-mcp");
    assert.deepEqual(delivered[2].result.tools, [{ name: "openl_list_projects" }]);
    assert.equal(bridge.sessionId, "session-1");

    const [first, second, third] = mcpPosts(studio);
    assert.equal(first.headers.authorization, "Token openl_pat_test.secret");
    assert.equal(first.headers["mcp-session-id"], undefined);
    assert.equal(first.headers["mcp-protocol-version"], undefined);
    assert.match(first.headers.accept, /application\/json/u);
    assert.match(first.headers.accept, /text\/event-stream/u);
    for (const later of [second, third]) {
      assert.equal(later.headers["mcp-session-id"], "session-1");
      assert.equal(later.headers["mcp-protocol-version"], "2025-11-25");
    }
  });
});

test("a single-user Studio gets no Authorization header", async () => {
  await withStudio(builtInMcpRoutes(), async (studio) => {
    for (const token of ["", "   ", undefined]) {
      const { bridge } = collectingBridge(studio, { token });
      await bridge.handle(initialize);
    }
    assert.ok(mcpPosts(studio).every((request) => request.headers.authorization === undefined));
  });
});

test("answers to server requests and notifications are posted without waiting for a reply", async () => {
  await withStudio(builtInMcpRoutes(), async (studio) => {
    const { bridge, delivered } = collectingBridge(studio);
    await bridge.handle(initialize);
    await bridge.handle({ jsonrpc: "2.0", id: "server-1", result: { roots: [] } });
    await bridge.handle({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 9 } });
    assert.equal(delivered.length, 1);
    assert.deepEqual(mcpPosts(studio).at(-2).body, { jsonrpc: "2.0", id: "server-1", result: { roots: [] } });
  });
});

test("a refused token becomes a JSON-RPC error that says what to do", async () => {
  await withStudio(
    builtInMcpRoutes({ "POST /mcp": (_request, response) => response.writeHead(401).end() }),
    async (studio) => {
      const { bridge, delivered } = collectingBridge(studio);
      await bridge.handle(initialize);
      assert.equal(delivered.length, 1);
      assert.equal(delivered[0].id, 1);
      assert.equal(delivered[0].error.code, -32000);
      assert.match(delivered[0].error.message, /HTTP 401/u);
      assert.match(delivered[0].error.message, /Personal Access Tokens/u);
      assert.doesNotMatch(delivered[0].error.message, /openl_pat_test/u);
    },
  );
});

test("a Studio without its MCP server is reported as such on initialize", async () => {
  await withStudio(
    builtInMcpRoutes({ "POST /mcp": (_request, response) => response.writeHead(404).end() }),
    async (studio) => {
      const { bridge, delivered } = collectingBridge(studio);
      await bridge.handle(initialize);
      assert.match(delivered[0].error.message, /does not serve its built-in MCP server at http:\/\/127\.0\.0\.1:\d+\/mcp \(HTTP 404\)/u);
      assert.match(delivered[0].error.message, /Node\.js/u);
    },
  );
});

test("an HTML page instead of JSON is reported, not forwarded", async () => {
  await withStudio(
    builtInMcpRoutes({
      "POST /mcp": (_request, response) => {
        response.writeHead(200, { "Content-Type": "text/html" }).end("<html></html>");
      },
    }),
    async (studio) => {
      const { bridge, delivered } = collectingBridge(studio);
      await bridge.handle(initialize);
      assert.match(delivered[0].error.message, /answered with text\/html instead of JSON/u);
    },
  );
});

test("a JSON-RPC error the server sends with an HTTP error is forwarded as it is", async () => {
  await withStudio(
    builtInMcpRoutes({
      "POST /mcp": (_request, response, message) => {
        response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32602, message: "Unsupported protocol version" },
        }));
      },
    }),
    async (studio) => {
      const { bridge, delivered } = collectingBridge(studio);
      await bridge.handle(initialize);
      assert.deepEqual(delivered, [{
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32602, message: "Unsupported protocol version" },
      }]);
    },
  );
});

test("a stream that ends without the answer is an error for that request", async () => {
  const base = builtInMcpRoutes()["POST /mcp"];
  await withStudio(
    builtInMcpRoutes({
      "POST /mcp": (request, response, message) => {
        if (message.method === "tools/call") {
          response.writeHead(200, { "Content-Type": "text/event-stream" }).end();
          return;
        }
        base(request, response, message);
      },
    }),
    async (studio) => {
      const { bridge, delivered } = collectingBridge(studio);
      await bridge.handle(initialize);
      await bridge.handle({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "x" } });
      assert.equal(delivered[1].id, 5);
      assert.match(delivered[1].error.message, /closed the response without answering tools\/call/u);
    },
  );
});

test("an expired session is reopened with the client's initialize and the request retried once", async () => {
  let session = 0;
  const base = builtInMcpRoutes()["POST /mcp"];
  await withStudio(
    builtInMcpRoutes({
      "POST /mcp": (request, response, message) => {
        if (message.method === "initialize") {
          session += 1;
          json(response, {
            jsonrpc: "2.0",
            id: message.id,
            result: { protocolVersion: "2025-11-25", capabilities: {}, serverInfo: { name: "studio-mcp" } },
          }, { "Mcp-Session-Id": `session-${session}` });
          return;
        }
        if (request.headers["mcp-session-id"] !== `session-${session}` || message.id === "expire") {
          response.writeHead(404).end();
          return;
        }
        base(request, response, message);
      },
    }),
    async (studio) => {
      const { bridge, delivered, logged } = collectingBridge(studio);
      await bridge.handle(initialize);
      session += 1; // The server forgets session-1.
      await Promise.all([
        bridge.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
        bridge.handle({ jsonrpc: "2.0", id: 3, method: "ping" }),
      ]);

      assert.equal(bridge.sessionId, "session-3");
      const initializes = mcpPosts(studio).filter((request) => request.body.method === "initialize");
      assert.equal(initializes.length, 2, "concurrent 404s reopen the session once");
      assert.deepEqual(initializes[1].body.params, initialize.params);
      assert.notEqual(initializes[1].body.id, initialize.id);
      assert.ok(mcpPosts(studio).some((request) =>
        request.body.method === "notifications/initialized" && request.headers["mcp-session-id"] === "session-3"));
      // The client sees its own answers only, not the second initialize.
      assert.deepEqual(
        delivered.filter((message) => message.id !== undefined).map((message) => message.id).sort(),
        [1, 2, 3],
      );
      assert.equal(delivered.filter((message) => message.id === 1).length, 1);
      assert.match(logged.join("\n"), /opening a new one/u);

      // A request that fails again after a new session is reported, not retried forever.
      await bridge.handle({ jsonrpc: "2.0", id: "expire", method: "ping" });
      assert.match(delivered.at(-1).error.message, /HTTP 404/u);
    },
  );
});

test("an unreachable server is reported for each request", async () => {
  const { bridge, delivered } = collectingBridge({ baseUrl: "http://127.0.0.1:1" });
  await bridge.handle(initialize);
  await bridge.handle({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(delivered.length, 1);
  assert.match(delivered[0].error.message, /Cannot reach OpenL Studio's MCP server at http:\/\/127\.0\.0\.1:1\/mcp/u);
});

test("closing the bridge ends the Studio session", async () => {
  await withStudio(builtInMcpRoutes(), async (studio) => {
    const { bridge } = collectingBridge(studio);
    await bridge.handle(initialize);
    await bridge.close();
    const deletion = studio.requests.find((request) => request.method === "DELETE");
    assert.equal(deletion.headers["mcp-session-id"], "session-1");
    assert.equal(deletion.headers.authorization, "Token openl_pat_test.secret");
  });
});

test("runBridge reads stdin line by line and closes the session when stdin ends", async () => {
  await withStudio(builtInMcpRoutes(), async (studio) => {
    const input = new PassThrough();
    const output = new PassThrough();
    const errorOutput = new PassThrough();
    let written = "";
    output.on("data", (chunk) => {
      written += chunk;
    });
    const running = runBridge({ url: `${studio.baseUrl}/mcp`, token: "", input, output, errorOutput });
    input.write(`${JSON.stringify(initialize)}\n`);
    input.write("not json\n\n");
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    input.end(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    await running;

    const lines = written.trim().split("\n").map((line) => JSON.parse(line));
    assert.ok(lines.some((line) => line.id === 1 && line.result.serverInfo.name === "studio-mcp"));
    assert.ok(lines.some((line) => line.id === null && line.error.code === -32700));
    assert.ok(studio.requests.some((request) => request.method === "DELETE"));
  });
});

test("runBridge stops when its signal aborts", async () => {
  await withStudio(builtInMcpRoutes(), async (studio) => {
    const input = new PassThrough();
    const controller = new AbortController();
    const running = runBridge({
      url: `${studio.baseUrl}/mcp`,
      token: "",
      input,
      output: new PassThrough(),
      errorOutput: new PassThrough(),
      signal: controller.signal,
    });
    input.write(`${JSON.stringify(initialize)}\n`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    controller.abort();
    await running;
    assert.ok(studio.requests.some((request) => request.method === "DELETE"));
  });
});

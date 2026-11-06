// A stand-in for OpenL Studio in tests: the public version endpoint of a 6.x or 7.x
// Studio, plus a scriptable MCP endpoint at /mcp. Not a test file itself (node --test
// picks up only *.test.mjs here).

import { createServer } from "node:http";

export function versionRoutes(version) {
  const info = (_request, response) => {
    response
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ "openl.version": version, "openl.build.date": "2026-10-07" }));
  };
  const [major] = version.split(".").map(Number);
  // Studio 7.0+ answers under /rest/public; 6.x asks a multi-user client to sign in there
  // and answers under /web/public.
  return major >= 7
    ? { "GET /rest/public/info/openl.json": info }
    : {
        "GET /rest/public/info/openl.json": (_request, response) => response.writeHead(401).end(),
        "GET /web/public/info/openl.json": info,
      };
}

export function json(response, body, headers = {}) {
  response.writeHead(200, { "Content-Type": "application/json", ...headers }).end(JSON.stringify(body));
}

export function sse(response, messages, headers = {}) {
  response.writeHead(200, { "Content-Type": "text/event-stream", ...headers });
  for (const message of messages) {
    response.write(`event: message\r\ndata: ${JSON.stringify(message)}\r\n\r\n`);
  }
  response.end();
}

/**
 * Start a fake Studio. `routes` maps "METHOD /path" to a handler; a POST handler gets the
 * parsed JSON body as its third argument. Every request is recorded in `requests`.
 */
export async function startFakeStudio(routes) {
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    const body = text ? JSON.parse(text) : undefined;
    requests.push({ method: request.method, url: request.url, headers: request.headers, body });
    const handler = routes[`${request.method} ${request.url}`];
    if (!handler) {
      response.writeHead(404).end();
      return;
    }
    await handler(request, response, body);
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    requests,
    async close() {
      server.closeAllConnections();
      await new Promise((resolvePromise) => server.close(resolvePromise));
    },
  };
}

/**
 * Routes of a Studio 7.0 MCP endpoint that opens session "session-1" on initialize, answers
 * tools/list as a server-sent event stream with a log notification first, and accepts
 * notifications and DELETE. Extra routes override these.
 */
export function builtInMcpRoutes(extra = {}) {
  return {
    ...versionRoutes("7.0.0"),
    "POST /mcp": (request, response, message) => {
      if (message.method === "initialize") {
        json(response, {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            protocolVersion: "2025-11-25",
            capabilities: { tools: {} },
            serverInfo: { name: "studio-mcp", version: "7.0.0" },
          },
        }, { "Mcp-Session-Id": "session-1" });
        return;
      }
      if (message.method === undefined || message.method.startsWith("notifications/")) {
        response.writeHead(202).end();
        return;
      }
      if (message.method === "tools/list") {
        sse(response, [
          { jsonrpc: "2.0", method: "notifications/message", params: { level: "info", data: "listing" } },
          { jsonrpc: "2.0", id: message.id, result: { tools: [{ name: "openl_list_projects" }] } },
        ]);
        return;
      }
      json(response, { jsonrpc: "2.0", id: message.id, result: { echoed: message.method } });
    },
    "DELETE /mcp": (_request, response) => response.writeHead(200).end(),
    ...extra,
  };
}

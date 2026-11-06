// A stdio ↔ Streamable HTTP bridge to the MCP server built into OpenL Studio 7.0 and later.
//
// Claude Code, Codex and Cursor start the plugin's MCP server as a local program that
// exchanges JSON-RPC messages, one per line, over stdin and stdout. OpenL Studio 7.0
// serves its own MCP server over HTTP at <studio>/mcp. The bridge sends every message
// from stdin to that address as an HTTP POST and writes the server's answers — a JSON
// body or a stream of server-sent events — to stdout.
//
// - The token is sent as `Authorization: Token <PAT>`, the scheme Studio expects for a
//   Personal Access Token, and only when one is configured (a single-user Studio has no
//   sign-in). It lives in memory only: never in arguments, output or logs.
// - Studio serves both protocol eras. A 2026-07-28 request is stateless and must repeat
//   its version, method and name as headers, which the bridge derives from the message.
//   For the 2025 versions Studio keeps a session and may close one left unused for 30
//   minutes; it then answers 404. The bridge replays the client's own `initialize` and
//   retries once, so an idle agent session keeps working.
// - A failure the server does not answer itself becomes a JSON-RPC error for the request
//   that caused it, with a message that tells the user what to do.

import { createInterface } from "node:readline";

const SERVER_ERROR = -32000;
const PARSE_ERROR = -32700;
const MAX_ERROR_BODY_BYTES = 64 * 1024;
const CLOSE_TIMEOUT_MS = 2_000;

// MCP 2026-07-28 is stateless: each request names its protocol version in its `_meta`
// envelope, and over HTTP the client must repeat it, the method, and for some methods the
// name of what is called in headers (SEP-2243). A server such as Studio's checks them
// before it answers. A client on stdio sends no headers, so the bridge derives them from
// the message, as the MCP SDK's own HTTP client does.
const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";
const MCP_NAME_SOURCE = Object.freeze({
  "tools/call": "name",
  "prompts/get": "name",
  "resources/read": "uri",
  "tasks/get": "taskId",
  "tasks/update": "taskId",
  "tasks/cancel": "taskId",
});
const BASE64_SENTINEL_PREFIX = "=?base64?";
const BASE64_SENTINEL_SUFFIX = "?=";

/** A header value as the MCP HTTP binding encodes it: plain printable ASCII, or `=?base64?…?=`. */
export function encodeMcpHeaderValue(value) {
  const plain = value.length > 0
    && value === value.trim()
    && !(value.startsWith(BASE64_SENTINEL_PREFIX) && value.endsWith(BASE64_SENTINEL_SUFFIX))
    && /^[\t\x20-\x7e]*$/u.test(value);
  return plain
    ? value
    : `${BASE64_SENTINEL_PREFIX}${Buffer.from(value, "utf8").toString("base64")}${BASE64_SENTINEL_SUFFIX}`;
}

/** The standard headers a request of the 2026-07-28 protocol carries over HTTP; none for older ones. */
export function modernRequestHeaders(message) {
  if (!isRequest(message)) {
    return {};
  }
  const version = message.params?._meta?.[PROTOCOL_VERSION_META_KEY];
  if (typeof version !== "string") {
    return {};
  }
  const headers = { "MCP-Protocol-Version": version, "Mcp-Method": message.method };
  const field = Object.hasOwn(MCP_NAME_SOURCE, message.method) ? MCP_NAME_SOURCE[message.method] : undefined;
  const name = field ? message.params?.[field] : undefined;
  if (typeof name === "string") {
    headers["Mcp-Name"] = encodeMcpHeaderValue(name);
  }
  return headers;
}

class StudioHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "StudioHttpError";
    this.status = status;
  }
}

const isRequest = (message) => typeof message?.method === "string" && message.id !== undefined && message.id !== null;

async function readText(body, maxBytes) {
  if (!body) {
    return "";
  }
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  for await (const chunk of body) {
    total += chunk.byteLength;
    if (total > maxBytes) {
      break;
    }
    text += decoder.decode(chunk, { stream: true });
  }
  return text + decoder.decode();
}

/** The `data` of each event of a text/event-stream body, as one string per event. */
export async function* readServerSentEvents(body) {
  const decoder = new TextDecoder();
  let buffer = "";
  let data = [];
  const lines = function* (final) {
    while (true) {
      const end = buffer.search(/\r\n|\r|\n/u);
      if (end < 0 || (!final && end === buffer.length - 1 && buffer[end] === "\r")) {
        return;
      }
      const length = buffer.startsWith("\r\n", end) ? 2 : 1;
      yield buffer.slice(0, end);
      buffer = buffer.slice(end + length);
    }
  };
  const dispatch = function* (line) {
    if (line === "") {
      if (data.length > 0) {
        yield data.join("\n");
        data = [];
      }
      return;
    }
    if (line.startsWith(":")) {
      return;
    }
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }
    if (field === "data") {
      data.push(value);
    }
  };

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    for (const line of lines(false)) {
      yield* dispatch(line);
    }
  }
  buffer += decoder.decode();
  for (const line of lines(true)) {
    yield* dispatch(line);
  }
  if (buffer) {
    yield* dispatch(buffer);
  }
  if (data.length > 0) {
    yield data.join("\n");
  }
}

function describeHttpFailure(status, url, method) {
  if (status === 401) {
    return `OpenL Studio refused the request (HTTP 401): the Personal Access Token is missing, expired, ` +
      "or revoked. Create a new one in OpenL Studio under User → Personal Access Tokens, put it into the " +
      "plugin's settings, and start a new session.";
  }
  if (status === 403) {
    return "OpenL Studio refused the request (HTTP 403): the user of this Personal Access Token is not " +
      "allowed to do this.";
  }
  if (method === "initialize" && [404, 405, 501, 502, 503].includes(status)) {
    return `OpenL Studio does not serve its built-in MCP server at ${url} (HTTP ${status}). The server needs ` +
      "Node.js on the OpenL Studio host, is turned off when mcp.enabled is false, and is not available when " +
      "Studio runs on Tomcat. Ask your OpenL administrator to enable it.";
  }
  return `OpenL Studio's MCP server at ${url} answered HTTP ${status}.`;
}

/**
 * The bridge's message handling, without stdin and stdout: `handle` takes one message from
 * the client, and every message for the client goes to `deliver`.
 */
export function createBridge({
  url,
  token,
  deliver,
  log = () => {},
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("This Node.js runtime does not provide fetch(). Node.js 24 or later is required.");
  }
  const credential = String(token ?? "").trim();
  const controller = new AbortController();
  let sessionId;
  let protocolVersion;
  let initializeMessage;
  let reinitializing;
  let reinitializeCount = 0;
  let closed = false;

  function headers(message) {
    const result = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (credential) {
      result.Authorization = `Token ${credential}`;
    }
    if (sessionId) {
      result["Mcp-Session-Id"] = sessionId;
    }
    if (protocolVersion) {
      result["MCP-Protocol-Version"] = protocolVersion;
    }
    // A request that names its protocol version itself is sent with that version.
    return { ...result, ...modernRequestHeaders(message) };
  }

  // Send one message and pass every message of the answer to `onMessage`. Returns whether
  // an answer to `message` (same id) came back.
  async function post(message, onMessage, { retry = true } = {}) {
    const usedSession = sessionId;
    let response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: headers(message),
        body: JSON.stringify(message),
        redirect: "error",
        signal: controller.signal,
      });
    } catch (error) {
      if (closed) {
        throw error;
      }
      throw new Error(`Cannot reach OpenL Studio's MCP server at ${url}: ${error?.cause?.message ?? error?.message ?? String(error)}`);
    }

    if (response.status === 404 && usedSession && message.method !== "initialize" && retry && initializeMessage) {
      await response.body?.cancel().catch(() => {});
      // Requests in flight together all see the 404; only the first opens a new session.
      if (reinitializing) {
        await reinitializing;
      } else if (sessionId === usedSession) {
        await reinitialize();
      }
      return post(message, onMessage, { retry: false });
    }

    const newSession = response.headers.get("mcp-session-id");
    if (newSession) {
      sessionId = newSession;
    }

    if (response.status === 202 || response.status === 204) {
      await response.body?.cancel().catch(() => {});
      return false;
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!response.ok) {
      const text = await readText(response.body, MAX_ERROR_BODY_BYTES).catch(() => "");
      // The server may answer a refused request with a JSON-RPC error of its own; it says more.
      if (contentType.includes("application/json")) {
        try {
          const answer = JSON.parse(text);
          if (answer?.jsonrpc === "2.0" && answer.error && answer.id === message.id) {
            onMessage(answer);
            return true;
          }
        } catch {
          // Fall through to the generic description.
        }
      }
      throw new StudioHttpError(response.status, describeHttpFailure(response.status, url, message.method));
    }

    let answered = false;
    const receive = (answer) => {
      if (answer?.id !== undefined && answer.id === message.id && answer.method === undefined) {
        answered = true;
      }
      onMessage(answer);
    };
    if (contentType.includes("text/event-stream")) {
      for await (const data of readServerSentEvents(response.body)) {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          log(`Ignored an event that is not JSON from ${url}.`);
          continue;
        }
        for (const answer of Array.isArray(parsed) ? parsed : [parsed]) {
          receive(answer);
        }
      }
    } else if (contentType.includes("application/json")) {
      const text = await readText(response.body, Number.POSITIVE_INFINITY);
      const parsed = text.trim() ? JSON.parse(text) : [];
      for (const answer of Array.isArray(parsed) ? parsed : [parsed]) {
        receive(answer);
      }
    } else {
      await response.body?.cancel().catch(() => {});
      throw new Error(
        `OpenL Studio's MCP server at ${url} answered with ${contentType || "no content type"} instead of ` +
          "JSON. Check that the plugin's OpenL Studio address is Studio's own address.",
      );
    }
    return answered;
  }

  function rememberProtocolVersion(answer) {
    const version = answer?.result?.protocolVersion;
    if (typeof version === "string" && version) {
      protocolVersion = version;
    }
  }

  // Open a new session with the client's own initialize, without showing the client the
  // second answer: it already holds the first one.
  function reinitialize() {
    reinitializing ??= (async () => {
      log(`OpenL Studio closed the MCP session; opening a new one at ${url}.`);
      sessionId = undefined;
      protocolVersion = undefined;
      reinitializeCount += 1;
      const replay = { ...initializeMessage, id: `openl-plugin-reinitialize-${reinitializeCount}` };
      const answered = await post(replay, rememberProtocolVersion, { retry: false });
      if (!answered) {
        throw new Error(`OpenL Studio's MCP server at ${url} did not answer a new initialize.`);
      }
      await post({ jsonrpc: "2.0", method: "notifications/initialized" }, () => {}, { retry: false });
    })().finally(() => {
      reinitializing = undefined;
    });
    return reinitializing;
  }

  async function handleOne(message) {
    if (message?.method === "initialize") {
      initializeMessage = message;
      sessionId = undefined;
      protocolVersion = undefined;
    }
    try {
      const answered = await post(message, (answer) => {
        if (message.method === "initialize" && answer?.id === message.id) {
          rememberProtocolVersion(answer);
        }
        if (!closed) {
          deliver(answer);
        }
      });
      if (!answered && isRequest(message) && !closed) {
        throw new Error(`OpenL Studio's MCP server at ${url} closed the response without answering ${message.method}.`);
      }
    } catch (error) {
      if (closed) {
        return;
      }
      const text = error?.message ?? String(error);
      if (isRequest(message)) {
        deliver({ jsonrpc: "2.0", id: message.id, error: { code: SERVER_ERROR, message: text } });
      } else {
        log(text);
      }
    }
  }

  return {
    async handle(message) {
      if (Array.isArray(message)) {
        await Promise.all(message.map(handleOne));
        return;
      }
      await handleOne(message);
    },
    // End the session: stop requests in flight and tell the server it can drop the session.
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      controller.abort();
      if (!sessionId) {
        return;
      }
      const timeout = AbortSignal.timeout(CLOSE_TIMEOUT_MS);
      try {
        const response = await fetchImpl(url, {
          method: "DELETE",
          headers: headers(),
          redirect: "error",
          signal: timeout,
        });
        await response.body?.cancel().catch(() => {});
      } catch {
        // The server drops unused sessions by itself.
      }
    },
    get sessionId() {
      return sessionId;
    },
  };
}

/**
 * Run the bridge over stdin and stdout until the client closes stdin or `signal` aborts.
 * Resolves once the session is closed.
 */
export async function runBridge({
  url,
  token,
  input = process.stdin,
  output = process.stdout,
  errorOutput = process.stderr,
  fetchImpl = globalThis.fetch,
  signal,
}) {
  const log = (text) => {
    try {
      errorOutput.write(`openl-plugin: ${text}\n`);
    } catch {
      // Nowhere left to report it.
    }
  };
  let outputOpen = true;
  output.on?.("error", () => {
    outputOpen = false;
  });
  const deliver = (message) => {
    if (outputOpen) {
      output.write(`${JSON.stringify(message)}\n`);
    }
  };
  const bridge = createBridge({ url, token, deliver, log, fetchImpl });

  const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
  if (signal?.aborted) {
    lines.close();
  }
  signal?.addEventListener("abort", () => lines.close(), { once: true });
  const inFlight = new Set();
  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      deliver({ jsonrpc: "2.0", id: null, error: { code: PARSE_ERROR, message: "Parse error" } });
      continue;
    }
    const task = bridge.handle(message);
    inFlight.add(task);
    task.finally(() => inFlight.delete(task));
  }
  // stdin closed: the client is shutting the server down, so nothing in flight is wanted.
  await bridge.close();
  await Promise.allSettled(inFlight);
}

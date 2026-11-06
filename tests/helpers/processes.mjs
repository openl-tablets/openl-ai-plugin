// Process helpers for launcher tests: a fake `npx` on PATH that records how it was called,
// and an asynchronous spawn (a synchronous one would block a fake Studio served from the
// same test process).

import { spawn } from "node:child_process";
import { chmod, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";

/**
 * Put a fake `npx` into `directory`. It writes its arguments and the OpenL environment it
 * received to `capturePath` as JSON, then exits 0. Returns the environment additions that
 * make the launcher find it.
 */
export async function installFakeNpx(directory, capturePath) {
  const helper = join(directory, "fake-npx.mjs");
  await writeFile(helper, `
import { writeFileSync } from "node:fs";
writeFileSync(process.env.OPENL_TEST_CAPTURE, JSON.stringify({
  argv: process.argv.slice(2),
  baseUrl: process.env.OPENL_BASE_URL,
  token: process.env.OPENL_PERSONAL_ACCESS_TOKEN,
  configDir: process.env.OPENL_CONFIG_DIR
}));
`);
  if (process.platform === "win32") {
    await writeFile(join(directory, "npx.cmd"), '@echo off\r\n"%OPENL_TEST_NODE%" "%OPENL_TEST_HELPER%" %*\r\n');
  } else {
    const fakeNpx = join(directory, "npx");
    await writeFile(fakeNpx, '#!/bin/sh\nexec "$OPENL_TEST_NODE" "$OPENL_TEST_HELPER" "$@"\n', { mode: 0o700 });
    await chmod(fakeNpx, 0o700);
  }
  return {
    OPENL_TEST_CAPTURE: capturePath,
    OPENL_TEST_HELPER: helper,
    OPENL_TEST_NODE: process.execPath,
    PATH: `${directory}${delimiter}${process.env.PATH}`,
  };
}

/** Start `node <script>` with `env`; returns the child plus collected output. */
export function startNode(script, env) {
  const child = spawn(process.execPath, [script], { env, stdio: ["pipe", "pipe", "pipe"] });
  const result = { child, stdout: "", stderr: "" };
  child.stdout.on("data", (chunk) => {
    result.stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    result.stderr += chunk;
  });
  result.exited = new Promise((resolvePromise, rejectPromise) => {
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => resolvePromise({ code, signal }));
  });
  return result;
}

/** Wait until `predicate(result)` holds, polling the collected output. */
export async function waitFor(predicate, { timeoutMs = 10_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for the launcher.");
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
}

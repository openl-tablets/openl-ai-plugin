import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { readSecret } from "../scripts/configure-codex.mjs";

class FakeInput extends EventEmitter {
  constructor() {
    super();
    this.isTTY = true;
    this.isRaw = false;
    this.rawModes = [];
    this.paused = false;
    this.resumed = false;
  }

  setRawMode(value) {
    this.isRaw = value;
    this.rawModes.push(value);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.resumed = true;
  }
}

class FakeOutput extends EventEmitter {
  constructor() {
    super();
    this.isTTY = true;
    this.chunks = [];
  }

  write(value, callback) {
    this.chunks.push(String(value));
    if (callback) queueMicrotask(callback);
    return true;
  }
}

function createTerminal({ output = new FakeOutput() } = {}) {
  return {
    input: new FakeInput(),
    output,
    signalSource: new EventEmitter(),
  };
}

function assertCleanedUp({ input, output, signalSource }, signals = ["SIGINT", "SIGTERM"]) {
  assert.deepEqual(input.rawModes, [true, false]);
  assert.equal(input.paused, true);
  for (const event of ["data", "end", "close", "error"]) {
    assert.equal(input.listenerCount(event), 0, `${event} listener leaked`);
  }
  for (const event of ["close", "error"]) {
    assert.equal(output.listenerCount(event), 0, `output ${event} listener leaked`);
  }
  for (const signal of signals) {
    assert.equal(signalSource.listenerCount(signal), 0, `${signal} listener leaked`);
  }
}

test("secret input stays hidden and restores the terminal after Enter", async () => {
  const terminal = createTerminal();
  const result = readSecret("Personal Access Token: ", terminal);

  terminal.input.emit("data", Buffer.from("abc"));
  terminal.input.emit("data", Buffer.from("\u007fD\n"));

  assert.equal(await result, "abD");
  assert.equal(terminal.input.resumed, true);
  assert.equal(terminal.output.chunks.join(""), "Personal Access Token: \n");
  assert.doesNotMatch(terminal.output.chunks.join(""), /abD/);
  assertCleanedUp(terminal);
});

test("secret input restores the terminal after termination signals", async () => {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    const terminal = createTerminal();
    const result = readSecret("Personal Access Token: ", terminal);
    terminal.signalSource.emit(signal);
    await assert.rejects(result, new RegExp(signal));
    assertCleanedUp(terminal);
  }
});

test("secret input handles the Windows break signal", async () => {
  const terminal = createTerminal();
  const terminationSignals = ["SIGINT", "SIGTERM", "SIGBREAK"];
  const result = readSecret("Personal Access Token: ", {
    ...terminal,
    terminationSignals,
  });
  terminal.signalSource.emit("SIGBREAK");
  await assert.rejects(result, /SIGBREAK/);
  assertCleanedUp(terminal, terminationSignals);
});

test("secret input handles a raw Ctrl+C byte", async () => {
  const terminal = createTerminal();
  const result = readSecret("Personal Access Token: ", terminal);
  terminal.input.emit("data", Buffer.from("\u0003"));
  await assert.rejects(result, /cancelled/);
  assertCleanedUp(terminal);
});

test("secret input restores the terminal when input closes or errors", async () => {
  for (const event of ["end", "close", "error"]) {
    const terminal = createTerminal();
    const result = readSecret("Personal Access Token: ", terminal);
    if (event === "error") {
      terminal.input.emit(event, new Error("terminal failed"));
      await assert.rejects(result, /terminal failed/);
    } else {
      terminal.input.emit(event);
      await assert.rejects(result, /closed before/);
    }
    assertCleanedUp(terminal);
  }
});

test("secret input restores the terminal when prompt output closes or errors", async () => {
  for (const event of ["close", "error"]) {
    const terminal = createTerminal();
    const result = readSecret("Personal Access Token: ", terminal);
    if (event === "error") {
      terminal.output.emit(event, new Error("output failed"));
      await assert.rejects(result, /output failed/);
    } else {
      terminal.output.emit(event);
      await assert.rejects(result, /output closed/);
    }
    assertCleanedUp(terminal);
  }
});

test("secret input never enters raw mode after a synchronous prompt failure", async () => {
  const output = new FakeOutput();
  output.write = function write(value) {
    this.chunks.push(String(value));
    this.emit("error", new Error("synchronous output failure"));
    return false;
  };
  const terminal = createTerminal({ output });
  const result = readSecret("Personal Access Token: ", terminal);
  await assert.rejects(result, /synchronous output failure/);
  assert.deepEqual(terminal.input.rawModes, []);
  assert.equal(terminal.input.resumed, false);
  assert.equal(terminal.input.paused, true);
  for (const event of ["data", "end", "close", "error"]) {
    assert.equal(terminal.input.listenerCount(event), 0, `${event} listener leaked`);
  }
  for (const event of ["close", "error"]) {
    assert.equal(output.listenerCount(event), 0, `output ${event} listener leaked`);
  }
});

test("secret input guards an asynchronous output error during the final newline", async () => {
  const output = new FakeOutput();
  output.write = function write(value, callback) {
    this.chunks.push(String(value));
    if (value === "\n") {
      queueMicrotask(() => this.emit("error", new Error("newline output failed")));
    } else if (callback) {
      queueMicrotask(callback);
    }
    return true;
  };
  const terminal = createTerminal({ output });
  const result = readSecret("Personal Access Token: ", terminal);
  terminal.input.emit("data", Buffer.from("secret\n"));
  assert.equal(await result, "secret");
  assertCleanedUp(terminal);
});

test("secret input restores the terminal when raw mode setup fails", async () => {
  const terminal = createTerminal();
  terminal.input.setRawMode = function setRawMode(value) {
    this.rawModes.push(value);
    if (value) throw new Error("raw mode failed");
    this.isRaw = value;
  };
  const result = readSecret("Personal Access Token: ", terminal);
  await assert.rejects(result, /raw mode failed/);
  assertCleanedUp(terminal);
});

test("secret input rejects oversized values without echoing them", async () => {
  const terminal = createTerminal();
  const result = readSecret("Personal Access Token: ", { ...terminal, maxLength: 3 });
  terminal.input.emit("data", Buffer.from("abcd"));

  await assert.rejects(result, /3-character safety limit/);
  assert.doesNotMatch(terminal.output.chunks.join(""), /abcd/);
  assertCleanedUp(terminal);
});

test("secret input requires a real interactive terminal", () => {
  const terminal = createTerminal();
  terminal.input.isTTY = false;
  assert.throws(
    () => readSecret("Personal Access Token: ", terminal),
    /requires an interactive terminal/,
  );
});

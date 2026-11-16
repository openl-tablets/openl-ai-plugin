// Preloaded with `node --import` into a script under test: fetch() behaves like a request
// to an address that exists but never answers, such as a Studio behind a VPN that is off.
// The request fails once its signal aborts, but the connection attempt behind it stays
// open, as Node's own fetch() leaves an unanswered TCP connect open until its connect
// timeout. A process that waits for its event loop to drain is held up by it.

const LEFTOVER_CONNECT_MS = 20_000;

globalThis.fetch = (_url, { signal } = {}) => {
  setTimeout(() => {}, LEFTOVER_CONNECT_MS);
  return new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
};

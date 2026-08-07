# Use OpenL in Codex

This guide connects **Codex** (desktop or CLI) to OpenL Studio. Codex doesn't have
Claude Code's plugin settings dialog, so the connection details (Studio address and
your token) are saved by a small bundled configurator that keeps your token out of
chat and out of the process list.

> **Which tool are you using?** This guide is for **Codex**. For **Claude Code**
> (terminal, IDE, or the desktop app's Code tab) use
> [claude-code-setup.md](claude-code-setup.md); for the **Claude desktop app
> (Chat/Cowork)** use [cowork-setup.md](cowork-setup.md).

## What you need

- **Codex** (desktop app or CLI) with `codex plugin add` support installed (verified
  with `codex-cli 0.145.0-alpha.30` and `0.146.0-alpha.3.1`; older preview builds
  without that command are not supported).
- **Node.js 24 or newer.** Check in a terminal: `node --version` — you want `v24` or
  higher.
- The **OpenL Studio address** — the web address you open in your browser, e.g.
  `https://studio.example.com`.
- Your usual OpenL Studio account, and your office network or VPN if Studio is
  internal.

## Step 1 — Install the plugin

Add the marketplace and install the plugin with the Codex plugin commands:

```bash
codex plugin marketplace add openl-tablets/openl-ai-plugin
codex plugin add openl@openl-ai-plugin
```

> **Used a prerelease Codex build named `openl-ai`?** Follow the cleanup section in
> the [0.2.0 migration guide](migrate-to-0.2.md). Released 0.1.x versions did not
> include Codex support.

(Or install from the desktop app's plugin browser, if your Codex build has one.)

The plugin gives Codex the OpenL **skills** and registers the OpenL MCP server. The
server won't connect yet — it has no Studio address or token. Step 2 supplies those.

## Step 2 — Create your access token in OpenL Studio

Skip this step if your OpenL Studio has no login screen (single-user mode).

1. Sign in to OpenL Studio in your browser.
2. Open **User → Personal Access Tokens** and create a token (name it e.g. `Codex`).
3. **Copy it now** — Studio shows it only once. It looks like `openl_pat_…`. Keep it
   to yourself.

## Step 3 — Run the configurator

Find the installed plugin's folder:

```bash
codex plugin list --json
```

Take the `source.path` of the `openl@openl-ai-plugin` entry, then run **in your own
terminal** (not inside a Codex chat):

```bash
node "<source.path>/scripts/configure-codex.mjs"
```

It asks for your Studio address, checks the deployment, and — for a multi-user Studio —
prompts for the token **with the input hidden** (nothing is echoed, and there is no
`--token` flag, so the token never lands in your shell history or the process list).
The address and token are saved separately from Codex. On macOS/Linux the default is
`~/.config/openl-ai/codex.json`, or `$XDG_CONFIG_HOME/openl-ai/codex.json` when that
variable is set, with owner-only permissions. On Windows it is
`%APPDATA%\openl-ai\codex.json` and relies on the user profile's ACLs.

Useful variants:

```bash
node "<source.path>/scripts/configure-codex.mjs" --status   # show what's configured (no token)
node "<source.path>/scripts/configure-codex.mjs" --clear    # remove the local configuration
```

### HTTPS, and the exception for internal HTTP

Prefer **HTTPS**, which encrypts the token in transit. Local Studio copies on a
loopback address (`localhost`, any `127.x.x.x`, or `::1`) may use plain `http://`,
including when they require a PAT; the configurator allows this without an extra
flag and prints an unencrypted-transport warning.

If your Studio runs over plain HTTP on a **trusted internal network** (for example
`http://studio.internal:8080`) and you accept that the token is sent unencrypted on
that network, opt in explicitly:

```bash
node "<source.path>/scripts/configure-codex.mjs" --allow-insecure
# or: OPENL_AI_ALLOW_INSECURE=1 node "<source.path>/scripts/configure-codex.mjs"
```

The configurator warns you when it does this, and the non-loopback opt-in is saved
with the configuration so the server starts the same way later.

## Step 4 — Verify

Start a **new Codex task** and ask:

```text
List the OpenL projects I can access.
```

If Codex lists your projects — you're done.

### The skills you now have

The plugin ships its skills to Codex through its own manifest, so they're available in
every task: `openl:connect` (this setup, and repairing it later) and
`openl:trace-investigation` — hand it a rule input and what you expected, and it traces
the run, names the root cause, and proposes the minimal fix. To invoke one explicitly,
type `$` and select `$openl:connect` or `$openl:trace-investigation`; `/skills` opens the
skills picker too. Or just describe the problem:

```text
Why does this policy come out with a premium of 0? Input: { … }
```

## Signing out and rotating the token

- **Sign out:** revoke the token in OpenL Studio (**User → Personal Access Tokens**) —
  that is what actually cuts access — then run the configurator with `--clear` and
  start a new Codex task.
- **Rotate:** create a new token in Studio, rerun the configurator, verify in a new
  task, then revoke the old token in Studio.

## If something doesn't work

| What you see | What to do |
|---|---|
| Codex has no OpenL abilities | Confirm the plugin is installed/enabled (`codex plugin list`), and that you ran the configurator (Step 3). Restart the Codex task afterwards. |
| "Node.js 24 or later is required" | Install/update Node.js (`node --version` must be `v24`+). |
| The configurator asks for `--allow-insecure` | The HTTP address is not loopback. Use its HTTPS address, or — only on a trusted internal network — re-run with `--allow-insecure` (see Step 3). |
| "Unauthorized" / 401 | The token is missing, expired, or revoked. Create a fresh one in Studio and rerun the configurator. |
| "Cannot reach OpenL Studio" | Check the address and your office network or VPN. |

## Good to know

- **The token is stored as plain text** in the platform-specific config file described
  in Step 3 (owner-only on macOS/Linux; Windows relies on `%APPDATA%` ACLs). Anyone who
  can read your user account's files could read it — revoke it in Studio if in doubt.
- The MCP server version is pinned by the plugin release; it updates when you update
  the plugin. Run `codex plugin marketplace upgrade openl-ai-plugin`, then
  `codex plugin remove openl@openl-ai-plugin` and
  `codex plugin add openl@openl-ai-plugin`. The config file is outside the plugin
  cache and remains in place; start a new task afterwards.
- If you also use Claude Code or the Claude desktop app, those set up separately (see
  the links at the top) and don't conflict with this.

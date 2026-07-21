# Use OpenL in Codex

This guide connects **Codex** (desktop or CLI) to OpenL Studio. Codex doesn't have
Claude Code's plugin settings dialog, so the connection details (Studio address and
your token) are saved by a small bundled configurator that keeps your token out of
chat and out of the process list.

> **Which tool are you using?** This guide is for **Codex**. For **Claude Code**
> (terminal/IDE) use the plugin flow in the [README](../README.md); for the **Claude
> desktop app (Chat/Cowork)** use [cowork-setup.md](cowork-setup.md).

## What you need

- **Codex** (desktop app or CLI) installed.
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
codex plugin add openl-ai@openl-ai-plugin
```

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

Take the `source.path` of the `openl-ai@openl-ai-plugin` entry, then run **in your own
terminal** (not inside a Codex chat):

```bash
node "<source.path>/scripts/configure-codex.mjs"
```

It asks for your Studio address, checks the deployment, and — for a multi-user Studio —
prompts for the token **with the input hidden** (nothing is echoed, and there is no
`--token` flag, so the token never lands in your shell history or the process list).
The address and token are saved to a private file (`~/.config/openl-ai/codex.json`,
owner-only permissions), separate from Codex.

Useful variants:

```bash
node "<source.path>/scripts/configure-codex.mjs" --status   # show what's configured (no token)
node "<source.path>/scripts/configure-codex.mjs" --clear    # remove the local configuration
```

### HTTPS, and the exception for internal HTTP

By default the configurator sends your token only over **HTTPS**, so it can't travel
unencrypted. Plain `http://` is allowed without a token for **loopback** development
(`localhost` / `127.0.0.1`).

If your Studio runs over plain HTTP on a **trusted internal network** (for example
`http://studio.internal:8080`) and you accept that the token is sent unencrypted on
that network, opt in explicitly:

```bash
node "<source.path>/scripts/configure-codex.mjs" --allow-insecure
# or: OPENL_AI_ALLOW_INSECURE=1 node "<source.path>/scripts/configure-codex.mjs"
```

The configurator warns you when it does this, and the choice is saved with the
configuration so the server starts the same way later. Prefer HTTPS whenever the
Studio supports it.

## Step 4 — Verify

Start a **new Codex task** and ask:

```text
List the OpenL projects I can access.
```

If Codex lists your projects — you're done.

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
| "must use HTTPS before a Personal Access Token can be entered" | Your Studio isn't HTTPS. Use its HTTPS address, or — only on a trusted internal network — re-run with `--allow-insecure` (see Step 3). |
| "Unauthorized" / 401 | The token is missing, expired, or revoked. Create a fresh one in Studio and rerun the configurator. |
| "Cannot reach OpenL Studio" | Check the address and your office network or VPN. |

## Good to know

- **The token is stored as plain text** in `~/.config/openl-ai/codex.json` (owner-only
  on macOS/Linux; on Windows it relies on your `%APPDATA%` permissions). Anyone who
  can read your user account's files could read it — revoke it in Studio if in doubt.
- The MCP server version is pinned by the plugin release; it updates when you update
  the plugin (`codex plugin` update commands).
- If you also use Claude Code or the Claude desktop app, those set up separately (see
  the links at the top) and don't conflict with this.

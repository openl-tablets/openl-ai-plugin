# Use OpenL in Cursor

This guide connects **Cursor** to OpenL Studio. Cursor asks for the connection details
(your Studio address and your token) in its own **Configure** dialog, so there is no
JSON file to edit and no configurator to run in a terminal.

> **Which tool are you using?** This guide is for **Cursor**. For **Claude Code**
> (terminal, IDE, or the desktop app's Code tab) use
> [claude-code-setup.md](claude-code-setup.md); for the **Claude desktop app
> (Chat/Cowork)** use [cowork-setup.md](cowork-setup.md); for **Codex** use
> [codex-setup.md](codex-setup.md).

## What you need

- **Cursor** with plugin support — the **Customize** page in the sidebar lists
  *Plugins*. Verified on Cursor **3.17.21**.
- **Node.js 24 or newer** on your own computer (the OpenL connection runs locally).
  Check in a terminal: `node --version` — you want `v24` or higher.
- The **OpenL Studio address** — the web address you open in your browser, e.g.
  `https://studio.example.com`.
- Your usual OpenL Studio account, and your office network or VPN if Studio is
  internal.
- **The plugin has to be available to your Cursor account.** Unlike Claude Code, you
  cannot add an arbitrary marketplace yourself: Cursor lists plugins from its own
  reviewed marketplace and from **team marketplaces** your administrator sets up. If
  you don't see `openl` in **Customize**, that is the missing piece — ask your
  administrator to import this repository as a team marketplace (the steps are in
  [admin-setup.md](admin-setup.md#rolling-out-to-cursor-users)).

## Step 1 — Install the plugin

1. Open **Customize** in the Cursor sidebar.
2. Find the **openl** plugin (search by name, or look under your team marketplace).
3. Select **Install**, and choose the **user** scope unless you only want it in one
   project.

Depending on how your administrator distributed the plugin, it may already be
installed — *Default On* and *Required* plugins install themselves.

The plugin gives Cursor the OpenL **skills** and registers the OpenL MCP server. The
server has no Studio address or token yet, so it won't connect until Step 3.

## Step 2 — Create your access token in OpenL Studio

Skip this step if your OpenL Studio has no login screen (single-user mode).

1. Sign in to OpenL Studio in your browser.
2. Open **User → Personal Access Tokens** and create a token (name it e.g. `Cursor`).
3. **Copy it now** — Studio shows it only once. It looks like `openl_pat_…`. Keep it
   to yourself.

## Step 3 — Fill in the connection details

Cursor asks for the plugin's two settings when you install it. To set or change them
later: **Customize → Plugins → openl → Configure**.

| Setting | What to enter |
|---|---|
| **OpenL Studio address** (`OPENL_STUDIO_URL`) | The exact address you open in your browser, including `https://` — for example `https://studio.example.com`. Required. |
| **Personal Access Token** (`OPENL_STUDIO_TOKEN`) | The token from Step 2. Leave it **empty** for a single-user Studio with no sign-in. |

Cursor masks the token field, because the name says `TOKEN`.

Prefer **HTTPS**, which encrypts the token in transit. A local Studio copy on
`localhost` may use plain `http://`; for any other HTTP address, the token travels
unencrypted across that network — use the HTTPS address if there is one.

> **Where these values are stored.** Cursor keeps a marketplace plugin's configured
> values in **your Cursor account**, not in a file on your computer, and supplies them
> to the plugin when it starts the server. That is different from the Claude Code and
> Codex setups, where the token never leaves your machine. Treat the token as you
> would any credential you type into a hosted tool: give it only the access you need,
> and revoke it in Studio (**User → Personal Access Tokens**) when you're done with it.

## Step 4 — Verify

Start a **new chat** in Cursor and ask:

```text
List the OpenL projects I can access.
```

If Cursor lists your projects — you're done.

### The skills you now have

The plugin ships the same skills to every client: `connect` (this setup, and repairing
it later), `branching`, `trace-investigation`, `testing`, and `versioning`. In Cursor
they are listed under **Customize → Skills** in the *Agent Decides* section — the agent
starts the matching one by itself, or you can pick one from the `/` menu in chat. Or
just describe the problem:

```text
Why does this policy come out with a premium of 0? Input: { … }
```

## Keeping OpenL up to date

Cursor updates a plugin when its marketplace is re-indexed, and how that happens is
your administrator's choice:

- **Auto Refresh** on the marketplace re-reads the repository whenever changes are
  pushed to the branch it tracks. It needs the Cursor GitHub App installed on the
  repository, and Cursor re-indexes at most once every 10 minutes.
- **Manual**: your administrator clicks **Refresh** on the marketplace in the Cursor
  dashboard.

Either way, the plugin's pinned OpenL MCP server version moves with the plugin
release. Restart Cursor (or start a new chat) after an update so the server restarts
with the new version. There is nothing for you to update by hand, and no per-user
update command.

## Signing out and rotating the token

- **Sign out:** revoke the token in OpenL Studio (**User → Personal Access Tokens**) —
  that is what actually cuts access — then clear the **Personal Access Token** field in
  **Customize → Plugins → openl → Configure** and start a new chat.
- **Rotate:** create a new token in Studio, put it into the same field, verify in a new
  chat, then revoke the old token in Studio.

## If something doesn't work

| What you see | What to do |
|---|---|
| `openl` isn't listed in **Customize** | The plugin is not available to your account yet. Ask your administrator to import this repository as a team marketplace — see [admin-setup.md](admin-setup.md#rolling-out-to-cursor-users). |
| "Third-party plugin imports are disabled by team admin settings" | Your organization blocks importing plugins from outside Cursor's own marketplace. A team marketplace is the supported route; only an administrator can change this. |
| The OpenL tools don't appear in chat | Confirm the plugin is installed **and** enabled in **Customize**, then check that both settings are filled in under **Configure**. Start a new chat afterwards. |
| The server shows an error mentioning `${OPENL_STUDIO_URL}` | The Studio address was never filled in, so Cursor passed the placeholder through unchanged. Set it under **Configure**. |
| "Node.js 24 or later is required", or the server won't start at all | Install/update Node.js (`node --version` must be `v24`+), then start a new chat. |
| "Unauthorized" / 401 | The token is missing, expired, or revoked. Create a fresh one in Studio and paste it under **Configure**. |
| "Cannot reach OpenL Studio" | Check the address and your office network or VPN. |

More symptoms and fixes: [troubleshooting.md](troubleshooting.md).

## Good to know

- **The Cursor CLI (`cursor-agent`) is a separate surface.** This guide covers the
  Cursor application. Whether an installed plugin's MCP server and skills also reach
  your `cursor-agent` sessions depends on your CLI version — the build verified for
  this release (`2026.01.23`) has no plugin commands at all.
- If you also use Claude Code, the Claude desktop app, or Codex, those set up
  separately (see the links at the top) and don't conflict with this. Each client
  holds its own connection details.

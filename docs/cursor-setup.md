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
  *Plugins*. Re-verified on Cursor **3.19.7**.
- **Node.js 24 or newer** on your own computer (the OpenL connection runs locally).
  Check in a terminal: `node --version` — you want `v24` or higher.
- The **OpenL Studio address** — the web address you open in your browser, e.g.
  `https://studio.example.com`.
- Your usual OpenL Studio account, and your office network or VPN if Studio is
  internal.
- **The plugin has to be available to your Cursor account.** It may come from Cursor's
  reviewed public Marketplace, a **team marketplace** set up by your administrator, or
  a direct GitHub repository import when your organization's policy allows it. For a
  controlled internal rollout, use the team-marketplace steps in
  [admin-setup.md](admin-setup.md#rolling-out-to-cursor-users).

## Step 1 — Install the plugin

1. Open **Customize → Plugins** in the Cursor sidebar.
2. Find **openl** in the public or team marketplace. If it is not listed and your
   organization permits repository imports, select **+ Add → From GitHub Repository**
   and enter `https://github.com/openl-tablets/openl-ai-plugin`.
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

> **Where these values are stored.** Cursor keeps a plugin's configured
> values as part of **your Cursor plugin configuration** and supplies them when it
> starts the local server; this plugin does not write them to project or global MCP
> JSON. The current Cursor implementation submits user-scoped plugin variables to the
> Cursor service, unlike the Claude Code and Codex setups where the token remains in a
> local settings file. Give the token only the access you need and revoke it in Studio
> (**User → Personal Access Tokens**) when you're done with it.

Cursor also supports MCP configuration without a plugin: `.cursor/mcp.json` inside a
project, or `~/.cursor/mcp.json` for the current user, both with an `mcpServers`
wrapper. OpenL deliberately uses the plugin manifest and **Configure** dialog instead,
so users do not have to create or edit either JSON file.

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

Update behaviour depends on how the plugin was installed:

- A **team marketplace** can use **Auto Refresh** to re-read its repository whenever
  changes are pushed to the branch it tracks. It needs the Cursor GitHub App on the
  repository, and Cursor re-indexes at most once every 10 minutes. Otherwise its owner
  clicks **Refresh** in the Cursor dashboard.
- A **public Marketplace** update becomes available after Cursor reviews and publishes
  the new release; a repository push alone is not a public release.
- Cursor's current documentation does not provide a supported update procedure for a
  personal **From GitHub Repository** install. Treat that route as evaluation-only;
  use the public or team marketplace when a defined update path is required.

After an update is actually installed, restart Cursor (or start a new chat) so the
server restarts with the release's pinned OpenL MCP version.

## Signing out and rotating the token

- **Sign out:** revoke the token in OpenL Studio (**User → Personal Access Tokens**) —
  that is what actually cuts access — then clear the **Personal Access Token** field in
  **Customize → Plugins → openl → Configure** and start a new chat.
- **Rotate:** create a new token in Studio, put it into the same field, verify in a new
  chat, then revoke the old token in Studio.

## If something doesn't work

| What you see | What to do |
|---|---|
| `openl` isn't listed in **Customize** | Search the public and team marketplaces. If policy permits it, try **+ Add → From GitHub Repository**. Otherwise ask your administrator to use the team-marketplace rollout in [admin-setup.md](admin-setup.md#rolling-out-to-cursor-users). |
| "Community/third-party plugin imports are disabled" | Your organization blocks direct repository imports. Use a reviewed public plugin or ask an administrator to provide it through the approved team marketplace. |
| The OpenL tools don't appear in chat | Confirm the plugin is installed **and** enabled in **Customize**, then open **Configure**: the **OpenL Studio address** is always required. Add the **Personal Access Token** as well, unless your Studio has no sign-in — for a single-user Studio that field must stay **empty**, and a placeholder value there causes 401 instead of fixing anything. Start a new chat afterwards. |
| The server shows an error mentioning `${OPENL_STUDIO_URL}` | The Studio address was never filled in, so Cursor passed the placeholder through unchanged. Set it under **Configure**. |
| "Node.js 24 or later is required", or the server won't start at all | Install/update Node.js (`node --version` must be `v24`+), then start a new chat. |
| "Unauthorized" / 401 | The token is missing, expired, or revoked. Create a fresh one in Studio and paste it under **Configure**. |
| "Cannot reach OpenL Studio" | Check the address and your office network or VPN. |

More symptoms and fixes: [troubleshooting.md](troubleshooting.md).

## Good to know

- **Current Cursor CLI releases support plugins, MCP and skills**, including the
  `/plugin` command. The older `cursor-agent` build observed during this work
  (`2026.01.23`) predates those commands; update the CLI if `/plugin` is missing.
- If you also use Claude Code, the Claude desktop app, or Codex, those set up
  separately (see the links at the top) and don't conflict with this. Each client
  holds its own connection details.

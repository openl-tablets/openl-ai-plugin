# Use OpenL in the Claude desktop app (Cowork)

This guide is for the **Chat and Cowork tabs** of the Claude desktop app. (For the
**Code** tab or the Claude Code terminal, use the plugin install from the
[README](../README.md) instead.) You'll connect Claude to OpenL Studio in about ten
minutes, and you don't need to be technical: every step tells you exactly what to
click and what to paste.

> **Why is this different from the plugin install in the README?**
> In the Chat and Cowork tabs the plugin can't ask you for its settings (like your
> token) the way Claude Code does — so the plugin here provides the OpenL **skills**
> (Step 1), while the connection itself comes from a small entry you add to one
> settings file on your computer (Steps 2–5). That entry runs the very same OpenL
> server the plugin itself runs in Claude Code.

## What you need

- The **Claude desktop app** installed (macOS or Windows).
- **Node.js 24 or newer** on your computer. To check: open **Terminal** (macOS) or
  **PowerShell** (Windows), type `node --version` and press Enter — you want `v24`
  or higher. If it shows an error or a lower number, ask your administrator to
  install it (or get it yourself from [nodejs.org](https://nodejs.org/)).
- The **OpenL Studio address** — the web address you open in your browser to use
  OpenL Studio, for example `https://studio.example.com`.
- Your usual OpenL Studio account, and your office network or VPN if Studio is
  internal.

## Step 1 — Add the OpenL plugin

The plugin gives Claude the OpenL **skills** — ready-made helpers you call by typing
`/` in the chat, such as `/openl-ai:connect`, with more to come in plugin updates.

1. In the desktop app's sidebar, click **Customize**, then open **Plugins**.
2. Add the plugin's source as a marketplace: `openl-tablets/openl-ai-plugin`
   (marketplaces can be added by URL; the GitHub `owner/repo` form works).
3. Install **openl-ai** from that marketplace.
4. In a new conversation, type `/` — `openl-ai:connect` appears in the list.

If anything offers you the plugin's own settings (Studio address / token), skip
them — in Chat and Cowork they have no effect. The connection is set up in the next
steps.

Trouble with this step? You can skip it for now — the connection (Steps 2–6) works
without the plugin — and come back to it later.

> **Shortcut:** now that the plugin is installed, you can start a new conversation,
> type `/openl-ai:connect` and follow along — Claude walks you through the remaining
> steps right in the chat. (The walkthrough ends with restarting the Claude app —
> that closes the chat; you then check that everything works in a fresh
> conversation, as in Step 6.) The steps below are the same thing written out.

## Step 2 — Create your access token in OpenL Studio

1. Open OpenL Studio in your browser and sign in as usual.
2. Open the **User** menu and go to **Personal Access Tokens**.
3. Create a new token. Name it so you'll recognize it later, e.g. `Claude`.
4. **Copy the token now** — Studio shows it only once. It looks like
   `openl_pat_…`. Keep it to yourself: anyone who has it can act as you in Studio.

## Step 3 — Open the Claude settings file

1. In the Claude desktop app, open the **Claude menu** in your system's menu bar
   (macOS: top of the screen; Windows: the menu at the top of the app window) and
   choose **Settings…** — this is *not* the settings inside the chat window, and
   not the **Customize** sidebar from Step 1.
2. Go to the **Developer** tab.
3. Click **Edit Config**. This opens (or shows you) a file called
   `claude_desktop_config.json`.

If you prefer to find the file yourself, it lives here:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Either way, open the file in a plain-text editor.

## Step 4 — Add the OpenL entry

You will paste a small block into that file, then change **two** things in it:
your Studio address and your token from Step 2.

**If the file is empty or brand new**, make it look exactly like this:

```json
{
  "mcpServers": {
    "openl": {
      "command": "npx",
      "args": ["-y", "--prefer-online", "-p", "openl-mcp", "openl-mcp"],
      "env": {
        "OPENL_BASE_URL": "PASTE-YOUR-STUDIO-ADDRESS-HERE",
        "OPENL_PERSONAL_ACCESS_TOKEN": "PASTE-YOUR-TOKEN-HERE"
      }
    }
  }
}
```

**If the file already has other entries** under `"mcpServers"`, add the `"openl"`
block next to them: put a comma after the previous entry's closing `}`, then paste
the `"openl": { … }` part. Like this:

```json
{
  "mcpServers": {
    "some-existing-server": {
      "command": "…",
      "args": ["…"]
    },
    "openl": {
      "command": "npx",
      "args": ["-y", "--prefer-online", "-p", "openl-mcp", "openl-mcp"],
      "env": {
        "OPENL_BASE_URL": "PASTE-YOUR-STUDIO-ADDRESS-HERE",
        "OPENL_PERSONAL_ACCESS_TOKEN": "PASTE-YOUR-TOKEN-HERE"
      }
    }
  }
}
```

Now replace the two placeholders — keep the surrounding quotes:

- `PASTE-YOUR-STUDIO-ADDRESS-HERE` → your Studio address, e.g.
  `https://studio.example.com`
- `PASTE-YOUR-TOKEN-HERE` → the token you copied in Step 2

Save the file.

The example intentionally does not specify a version. `--prefer-online` makes `npx`
check for a newer `openl-mcp` release when Claude starts, while still using npm's
local cache for package contents.

If you or your administrator need a fixed, reproducible version, replace the `args`
line with an exact version (using the version your administrator provides), for
example:

```json
"args": ["-y", "-p", "openl-mcp@1.1.0", "openl-mcp"]
```

A fixed version does not update automatically. Change the version number in this
line and restart Claude whenever you want to upgrade it.

> Careful with commas and quotes — this file format is strict. If Claude ignores
> your change after restart, a missing/extra comma is the most common reason. Paste
> the blocks rather than retyping them — some editors turn straight quotes into
> curly ones, which break the file.

## Step 5 — Restart Claude

**Quit the Claude app completely** (macOS: Claude menu → Quit; Windows: exit from
the system tray), then start it again. Closing the window is not enough — the file
is read when the app starts.

## Step 6 — Check that it works

Start a new conversation (a Cowork session or a regular chat) and ask:

```text
List the OpenL projects I can access.
```

If Claude lists your projects — you're done.

## If something doesn't work

| What you see | What to do |
|---|---|
| Claude doesn't seem to have any OpenL abilities | 1) Make sure you fully quit and restarted Claude. 2) Re-open the settings file (Step 3) and check the block matches the example in Step 4 — commas and quotes matter. 3) Check Node.js: open Terminal (macOS) or PowerShell (Windows), run `node --version`; if it errors or shows less than `v24`, ask your administrator to install/update Node.js. |
| "Unauthorized" or 401 errors | First re-open the settings file (Step 3) and check the token line: the placeholder must be replaced with your real token (quotes kept, no spaces). If it looks right, the token expired or was revoked — create a fresh one in Studio (**User → Personal Access Tokens**), put it into the file, restart Claude. |
| "Cannot reach OpenL Studio" / timeouts | Check you're on the office network or VPN, and that the address in the file is exactly the one that works in your browser (including `https://`). |
| Worked in a desktop Cowork session, but not on claude.ai in the browser | Expected: this setup works only in the **desktop app**. The web version of Claude can't run it. |
| Can't find **Customize → Plugins** (Step 1) | Update the Claude desktop app to the latest version — or skip Step 1 for now: the connection (Steps 2–6) works without the plugin. |

Still stuck? Send your administrator the error text, your Studio address, and the
output of `node --version` — **never your token**. Administrators can also check
Claude's log file: `~/Library/Logs/Claude/mcp-server-openl.log` (macOS) or
`%APPDATA%\Claude\logs\mcp-server-openl.log` (Windows).

## Good to know

- **Your token is stored as plain text** in that settings file on your computer.
  Don't share the file or its contents. To cut access at any moment, delete the
  configured token in OpenL Studio (**User → Personal Access Tokens**) — that
  invalidates it everywhere. If you previously used direct CLI sign-in, revoke any
  older tokens created for Claude or OpenL MCP there as well.
- Tokens have an expiry date. When Claude starts answering "unauthorized" after
  months of working fine — that's usually it. Create a new token, update the file, and
  restart Claude (Steps 2, 4, and 5).
- The default configuration checks for a new `openl-mcp` version when Claude starts.
  If your organization requires controlled upgrades, use the exact-version option
  described in Step 4.
- If you also use **Claude Code** (the terminal/IDE tool), use the plugin install
  from the [README](../README.md) there — it has a proper masked settings field for
  the token. Both can coexist; they don't conflict.

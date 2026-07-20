# Use OpenL in the Claude desktop app (Cowork)

This guide is for the **Chat and Cowork tabs** of the Claude desktop app. (For the
**Code** tab or the Claude Code terminal, use the plugin install from the
[README](../README.md) instead.) You'll connect Claude to OpenL Studio in about ten
minutes, and you don't need to be technical: every step tells you exactly what to
click and what to paste.

> **Why is this different from the plugin install in the README?**
> There is **no plugin to install in this guide** — don't look for one. The Chat and
> Cowork tabs can't ask you for plugin settings (like your token) the way Claude Code
> does, so a plugin installed there simply can't connect. Instead, you add a small
> entry to one settings file on your computer — it runs the very same OpenL server
> the plugin would. Same result: Claude gets the OpenL tools and works as you.

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

## Step 1 — Create your access token in OpenL Studio

1. Open OpenL Studio in your browser and sign in as usual.
2. Open the **User** menu and go to **Personal Access Tokens**.
3. Create a new token. Name it so you'll recognize it later, e.g. `Claude`.
4. **Copy the token now** — Studio shows it only once. It looks like
   `openl_pat_…`. Keep it to yourself: anyone who has it can act as you in Studio.

## Step 2 — Open the Claude settings file

1. In the Claude desktop app, open the **Claude menu** in your system's menu bar
   (macOS: top of the screen; Windows: the app menu) and choose **Settings…**
   — this is *not* the settings inside the chat window.
2. Go to the **Developer** tab.
3. Click **Edit Config**. This opens (or shows you) a file called
   `claude_desktop_config.json`.

If you prefer to find the file yourself, it lives here:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Open it in any text editor (TextEdit, Notepad).

## Step 3 — Add the OpenL entry

You will paste a small block into that file, then change **two** things in it:
your Studio address and your token from Step 1.

**If the file is empty or brand new**, make it look exactly like this:

```json
{
  "mcpServers": {
    "openl": {
      "command": "npx",
      "args": ["-y", "-p", "openl-mcp@1.1.0", "openl-mcp"],
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
      "args": ["-y", "-p", "openl-mcp@1.1.0", "openl-mcp"],
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
- `PASTE-YOUR-TOKEN-HERE` → the token you copied in Step 1

Save the file.

> Careful with commas and quotes — this file format is strict. If Claude ignores
> your change after restart, a missing/extra comma is the most common reason.

## Step 4 — Restart Claude

**Quit the Claude app completely** (macOS: Claude menu → Quit; Windows: exit from
the system tray), then start it again. Closing the window is not enough — the file
is read when the app starts.

## Step 5 — Check that it works

Start a new conversation (a Cowork session or a regular chat) and ask:

```text
List the OpenL projects I can access.
```

If Claude lists your projects — you're done.

## If something doesn't work

| What you see | What to do |
|---|---|
| Claude doesn't seem to have any OpenL abilities | 1) Make sure you fully quit and restarted Claude. 2) Re-open the file from Step 2 and check the block matches the example — commas and quotes matter. 3) Check Node.js: open Terminal (macOS) or Command Prompt (Windows), run `node --version`; if it errors or shows less than `v24`, ask your administrator to install/update Node.js. |
| "Unauthorized" or 401 errors | First re-open the file from Step 3 and check the token line: the placeholder must be replaced with your real token (quotes kept, no spaces). If it looks right, the token expired or was revoked — create a fresh one in Studio (**User → Personal Access Tokens**), put it into the file, restart Claude. |
| "Cannot reach OpenL Studio" / timeouts | Check you're on the office network or VPN, and that the address in the file is exactly the one that works in your browser (including `https://`). |
| Worked in a desktop Cowork session, but not on claude.ai in the browser | Expected: this setup works only in the **desktop app**. The web version of Claude can't run it. |

Still stuck? Send your administrator the error text, your Studio address, and the
output of `node --version` — **never your token**. Administrators can also check
Claude's log file: `~/Library/Logs/Claude/mcp-server-openl.log` (macOS) or
`%APPDATA%\Claude\logs\mcp-server-openl.log` (Windows).

## Good to know

- **Your token is stored as plain text** in that settings file on your computer.
  Don't share the file or its contents. To cut access at any moment, delete the
  token in OpenL Studio (**User → Personal Access Tokens**) — that kills it
  everywhere, instantly.
- Tokens have an expiry date. When Claude starts answering "unauthorized" after
  months of working fine — that's usually it. Create a new token and update the
  file (Steps 1 and 3).
- If you also use **Claude Code** (the terminal/IDE tool), use the plugin install
  from the [README](../README.md) there — it has a proper masked settings field for
  the token. Both can coexist; they don't conflict.

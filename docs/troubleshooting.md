# Troubleshooting — OpenL AI plugin

Each section below is: what you see → what to try → when to hand it to your OpenL
administrator. When you do contact the administrator, send the info listed in
[What to send your administrator](#what-to-send-your-administrator) — and **never your
access token**.

> This page covers the **Claude Code plugin** ([setup
> guide](claude-code-setup.md)). If you set OpenL up in the **Claude
> desktop app (Cowork)** via the settings file, use the troubleshooting table in
> [cowork-setup.md](cowork-setup.md#if-something-doesnt-work) instead — the fixes
> differ (settings file and app restart instead of `/plugin` commands). For Codex,
> use the table in [codex-setup.md](codex-setup.md#if-something-doesnt-work); for
> **Cursor**, the one in [cursor-setup.md](cursor-setup.md#if-something-doesnt-work) —
> there the connection details live in Cursor's own **Configure** dialog, and the plugin
> may come from the public Marketplace, a team marketplace, or an allowed repository
> import.

> **The `/plugin …` commands below need a terminal.** They work only in an
> interactive Claude Code session started from a terminal — not in the desktop app's
> chat and not in its Code tab. Before running one: **open a terminal, run `claude`**,
> then type the command at its prompt. The settings you save there apply to your IDE
> and desktop Code sessions too.

## The plugin or the OpenL tools didn't appear

You installed the plugin, but Claude doesn't seem to have any OpenL abilities, or
`/openl:connect` is not offered.

1. **Check Node.js first.** The plugin runs a small local component that needs
   Node.js 24 or newer — even when your organization installed the plugin for you.
   In a terminal, run:

   ```text
   node --version
   ```

   If it prints an error, or a version lower than `v24`, ask your administrator to
   install or update Node.js on your computer. This is the most common cause.
2. **Start a new Claude session.** Newly installed plugins load when a session starts.
3. **Check the plugin is installed and enabled.** In Claude Code, run `/plugin` and
   look for `openl`. If it's disabled, enable it.
4. **Check the Studio address is set.** In Claude Code, run
   `/plugin configure openl@openl-ai-plugin` — the "OpenL Studio address" field
   must be filled in.

**Contact your administrator when:** Node.js is missing/old and you can't install
software yourself, or the steps above don't help. Mention that the OpenL tools don't
load and include your `node --version` output.

## "Unauthorized" / 401 errors

Claude's OpenL requests fail with "unauthorized", "401", or "authentication required".
This means the Personal Access Token is missing, expired, or revoked.

1. Create a token in OpenL Studio under **User → Personal Access Tokens** (or ask your
   administrator where to create one), then add it with
   `/plugin configure openl@openl-ai-plugin` — the **Personal Access Token** field.
2. Start a new Claude session (the token is picked up when a session starts).
3. If it still fails, see
   [My access stopped working](#my-access-stopped-working-token-expired) below.

**Contact your administrator when:** you added a fresh token and requests are still
unauthorized in a new session.

## Connected, but no projects are shown

The token was accepted, but "List the OpenL projects I can access" returns nothing or
an empty list.

1. Make sure you're in a **new Claude session**, started after you added the token.
2. Open OpenL Studio in your browser and check you can see your projects there with
   the same account. If Studio shows none either, it's a permissions question, not a
   plugin problem.
3. Check the plugin points at the right Studio: run
   `/plugin configure openl@openl-ai-plugin` and compare the "OpenL Studio
   address" with the address in your browser. Your organization may run several
   Studio instances (test/production). After correcting the address, start a new
   session.

**Contact your administrator when:** Studio in the browser shows your projects but
Claude doesn't, or you're not sure which Studio address is the right one. Ask them to
check your account's project permissions.

## My access stopped working (token expired)

Everything worked before, and now OpenL requests fail with "unauthorized" again.
Personal Access Tokens have an expiry date — this is expected from time to time.

1. Create a fresh token in OpenL Studio under **User → Personal Access Tokens**.
2. Update it via `/plugin configure openl@openl-ai-plugin` and start a new Claude
   session.

**Contact your administrator when:** you can't create a new token in Studio, or a
fresh token still doesn't work.

## "Cannot reach OpenL Studio" / connection errors

Connect or normal requests fail with "cannot reach", "connection refused", or
timeouts.

1. Open the OpenL Studio address in your **browser**. If the browser can't open it
   either, connect to your office network or VPN and try again.
2. If the browser opens Studio fine, compare the address in the browser with the
   plugin's "OpenL Studio address" (`/plugin configure openl@openl-ai-plugin`) —
   they must match exactly, including the `http://` or `https://` scheme. Local
   Studio copies may use HTTP; prefer HTTPS when a PAT crosses a network.

**Contact your administrator when:** you're on the VPN, the browser opens Studio, the
addresses match — and Claude still can't reach it.

## The plugin stays on an old version

A new plugin release exists, but Claude Code keeps loading the old one — or it never
offers an update in the first place.

Updates from this marketplace are **not** automatic. Claude Code refreshes and
auto-updates only the marketplaces it ships with; this one is refreshed when someone
asks for it. In a session:

```text
/plugin marketplace update openl-ai-plugin
/plugin update openl@openl-ai-plugin
```

Then start a new session. The same two steps in a terminal, without entering a
session:

```bash
claude plugin marketplace update openl-ai-plugin
```

```bash
claude plugin update openl@openl-ai-plugin
```

### Making it automatic

You can switch this marketplace to auto-update yourself — you don't need an
administrator for it. In a terminal Claude Code session, run `/plugin`, open
**Marketplaces**, select `openl-ai-plugin`, and use its **Enable auto-update** action.
From then on Claude Code refreshes this marketplace and updates the plugin on startup.

Two caveats:

- The update runs in the background and applies to the **next** session, not the one
  you are in: your current session keeps the version it started with until you restart.
- The toggle is only available when the marketplace was added in a settings scope you
  can edit. If your organization declared it in managed settings, that scope owns the
  flag and only an administrator can change it (see
  [admin-setup.md](admin-setup.md#installing-for-the-organization)).

### Cursor

First identify how `openl` was installed. A **team marketplace** receives a new indexed
revision through **Auto Refresh** (which needs the Cursor GitHub App and runs at most
once every 10 minutes after pushes) or when its owner clicks **Refresh** in the Cursor
dashboard. A **public Marketplace** update appears only after Cursor reviews and
publishes it. Cursor does not currently document unattended updates for **From GitHub
Repository** installs or provide a verified update procedure for them. If a direct
install remains on the old version, move to the reviewed public release or ask the
team-marketplace owner for the managed route. Restart Cursor after the new version is
installed so the OpenL server restarts on its new pin.

### Before you go hunting for a bug

- **Nothing is offered until the marketplace is refreshed.** Claude Code compares your
  installed plugin against its local copy of the marketplace, so a release it has not
  fetched yet simply doesn't exist as far as it's concerned — no update prompt, no new
  version number.
- **In the desktop app's Code tab, automatic plugin updates never run at all.** The app
  manages its own bundled Claude Code and starts it with the auto-updater switched off
  (checked through Claude Code 2.1.222), so neither the toggle above nor an `autoUpdate`
  setting has any effect there. Run the two commands above in a terminal instead; the
  result applies to your desktop Code sessions too.

If your plugin is still the pre-0.2.0 `openl-ai`, it will never receive updates under
that name — follow [the identity migration](migrate-to-0.2.md). For the **Chat and
Cowork tabs** of the desktop app, updates work differently again; see
[Keeping OpenL up to date](cowork-setup.md#keeping-openl-up-to-date).

**Contact your administrator when:** your organization pre-installed the plugin through
managed settings — refreshing, updating, and the auto-update flag are theirs to change
then (see [admin-setup.md](admin-setup.md#installing-for-the-organization)).

## Claude offers two trace skills

Before plugin 0.3.0, the trace workflow was distributed from the `openl-mcp` repository
as a standalone `openl-trace-investigation` directory that users copied into their own
Claude skills folder. Installing or updating the plugin cannot remove that user-owned
copy. If it remains, Claude sees both the old standalone workflow and the plugin's
`/openl:trace-investigation`; their descriptions match the same requests, and the old
copy is frozen at whatever tool surface it was written against — it does not follow the
plugin's `openl-mcp` pin.

If you installed that old standalone skill, delete exactly this directory:

- macOS/Linux: `~/.claude/skills/openl-trace-investigation`
- Windows: `%USERPROFILE%\.claude\skills\openl-trace-investigation`

Then start a new Claude session, or run `/reload-plugins` in Claude Code. Keep the
plugin-managed `/openl:trace-investigation` skill; do not delete files from the plugin
cache.

## What to send your administrator

Include:

- What you asked Claude to do, and the **error text** Claude showed.
- Which setup you use: the **Claude Code plugin** or the **Claude desktop app
  (Cowork)** settings file.
- Your **OpenL Studio address** — Claude Code: from
  `/plugin configure openl@openl-ai-plugin`; Claude desktop app (Cowork): from the
  `openl` entry in `claude_desktop_config.json`.
- The output of `node --version`.
- Whether you have added a Personal Access Token — Claude Code: in the plugin
  settings; desktop app: in `claude_desktop_config.json` — and whether you can create
  one in Studio under **User → Personal Access Tokens**.
- Whether OpenL Studio works for you in the browser with the same account.

Never include:

- Your **access token** or any value from a masked settings field — the administrator
  never needs it, and anyone who has it can act as you in Studio. If you suspect a
  token leaked, revoke it in OpenL Studio under **User → Personal Access Tokens**.

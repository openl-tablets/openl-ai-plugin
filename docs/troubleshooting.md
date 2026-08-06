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
> use the table in [codex-setup.md](codex-setup.md#if-something-doesnt-work).

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

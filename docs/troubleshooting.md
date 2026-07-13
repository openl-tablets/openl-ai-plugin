# Troubleshooting — OpenL AI plugin

Each section below is: what you see → what to try → when to hand it to your OpenL
administrator. When you do contact the administrator, send the info listed in
[What to send your administrator](#what-to-send-your-administrator) — and **never your
access token**.

## The plugin or the OpenL tools didn't appear

You installed the plugin, but Claude doesn't seem to have any OpenL abilities, or
`/openl-ai:connect` is not offered.

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
   look for `openl-ai`. If it's disabled, enable it.
4. **Check the Studio address is set.** In Claude Code, run
   `/plugin configure openl-ai@openl-ai-plugin` — the "OpenL Studio address" field
   must be filled in.

**Contact your administrator when:** Node.js is missing/old and you can't install
software yourself, or the steps above don't help. Mention that the OpenL tools don't
load and include your `node --version` output.

## The browser didn't open during connect

You ran `/openl-ai:connect`, Claude said the browser would open, but nothing appeared.

1. Look for the sign-in link in Claude's reply — the connect flow also prints a URL
   you can open yourself. Copy it into your browser **on the same computer** and sign
   in there.
2. Check the browser didn't open behind other windows, and that pop-ups aren't
   blocked.
3. Run `/openl-ai:connect` again.

**Contact your administrator when:** you work on a remote/virtual machine where no
browser exists at all — browser sign-in can't work there, and the administrator will
give you an access token to use instead.

## "Unauthorized" / 401 errors

Claude's OpenL requests fail with "unauthorized", "401", or "authentication required".

1. Run `/openl-ai:connect` and complete the sign-in.
2. Start a new Claude session (the sign-in is picked up when a session starts).
3. If it still fails, your access token may have expired or been revoked — see
   [My access stopped working](#my-access-stopped-working-token-expired) below.

**Contact your administrator when:** signing in succeeds but requests are still
unauthorized afterwards. Tell them sign-in completes but 401 persists in a new
session.

## Connected, but no projects are shown

Sign-in succeeded, but "List the OpenL projects I can access" returns nothing or an
empty list.

1. Make sure you're in a **new Claude session**, started after you connected.
2. Open OpenL Studio in your browser and check you can see your projects there with
   the same account. If Studio shows none either, it's a permissions question, not a
   plugin problem.
3. Check the plugin points at the right Studio: run
   `/plugin configure openl-ai@openl-ai-plugin` and compare the "OpenL Studio
   address" with the address in your browser. Your organization may run several
   Studio instances (test/production). After correcting the address, run
   `/openl-ai:connect` again and start a new session.

**Contact your administrator when:** Studio in the browser shows your projects but
Claude doesn't, or you're not sure which Studio address is the right one. Ask them to
check your account's project permissions.

## My access stopped working (token expired)

Everything worked before, and now OpenL requests fail with "unauthorized" again.
Access tokens have an expiry date — this is expected from time to time.

1. Run `/openl-ai:connect` and sign in again, then start a new Claude session.
2. If your administrator gave you a token to paste into the plugin settings, ask them
   for a fresh one (or create one yourself in OpenL Studio under
   **User → Personal Access Tokens**) and update it via
   `/plugin configure openl-ai@openl-ai-plugin`.

**Contact your administrator when:** you can't create a new token in Studio, or a
fresh token still doesn't work.

## "Cannot reach OpenL Studio" / connection errors

Connect or normal requests fail with "cannot reach", "connection refused", or
timeouts.

1. Open the OpenL Studio address in your **browser**. If the browser can't open it
   either, connect to your office network or VPN and try again.
2. If the browser opens Studio fine, compare the address in the browser with the
   plugin's "OpenL Studio address" (`/plugin configure openl-ai@openl-ai-plugin`) —
   they must match exactly, including `https://`.

**Contact your administrator when:** you're on the VPN, the browser opens Studio, the
addresses match — and Claude still can't reach it.

## What to send your administrator

Include:

- What you asked Claude to do, and the **error text** Claude showed.
- Your **OpenL Studio address** (from `/plugin configure openl-ai@openl-ai-plugin`).
- The output of `node --version`.
- Whether `/openl-ai:connect` opened the browser, and whether sign-in completed.
- Whether OpenL Studio works for you in the browser with the same account.

Never include:

- Your **access token** or any value from a masked settings field — the administrator
  never needs it, and anyone who has it can act as you in Studio. If you suspect a
  token leaked, revoke it in OpenL Studio under **User → Personal Access Tokens**.

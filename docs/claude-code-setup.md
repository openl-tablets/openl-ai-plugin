# Use OpenL in Claude Code

This guide connects **Claude Code** to OpenL Studio: the terminal CLI, the IDE
extension, and the Claude desktop app's **Code** tab. Setup takes about five minutes.

> **Using something else?** The **Chat or Cowork tabs** of the Claude desktop app set
> up differently — follow [cowork-setup.md](cowork-setup.md). For **Codex** (desktop
> or CLI), follow [codex-setup.md](codex-setup.md).

> **The `/plugin …` commands need a terminal.** They only work in an interactive
> Claude Code session in a terminal — not in the desktop app's chat and not in the
> Code tab. Before running any `/plugin …` line below: **open a terminal and start
> Claude Code by running `claude`**, then type the command at its prompt. You do this
> once; other Claude Code sessions **on the same computer** (terminal, IDE, desktop
> Code tab) pick the saved settings up automatically.

> **No `claude` command in your terminal?** The desktop app ships Claude Code itself
> but not the terminal CLI — that is
> [installed separately](https://code.claude.com/docs/en/quickstart#step-1-install-claude-code),
> and you need it for the steps below. Installing the plugin can also be done from the
> desktop app's UI (**+** next to the prompt box → **Plugins** → **Add plugin**), but
> the plugin's settings dialog is a terminal-session feature, so the CLI is the
> reliable path for both steps.

## What you need

- **Claude Code** installed (terminal, IDE extension, or the desktop app's Code tab),
  version 2.1.119 or later, plus the `claude` terminal command (see the callout
  above).
- A **Local** session — or an **SSH** session, with the caveats at the end of this
  guide. Cloud and WSL sessions can't use this plugin.
- **Node.js 24 or newer** on the machine running Claude Code. Not sure if you have
  it? Just continue — [Step 1](#step-1--install-the-plugin) explains how to check,
  and it's easy to add later.
- The **OpenL Studio address** — the web address you open in your browser to use
  OpenL Studio, for example `https://studio.example.com`.
- Your usual OpenL Studio account, and your office network or VPN if Studio is
  internal.

## Step 1 — Install the plugin

> Skip this step if your organization already installed the plugin for you
> (it shows up under `/plugin` in Claude Code).

**First open a terminal and start Claude Code** — run:

```bash
claude
```

Then, at the Claude Code prompt, run:

```text
/plugin marketplace add openl-tablets/openl-ai-plugin
/plugin install openl@openl-ai-plugin
```

Or do the same without starting a session — run these two commands directly in the
terminal, then restart Claude Code (and the desktop app, if you use its Code tab):

```bash
claude plugin marketplace add openl-tablets/openl-ai-plugin
```

```bash
claude plugin install openl@openl-ai-plugin --config studio_base_url=https://studio.example.com
```

Replace the example address with your own. This form doesn't open the settings
dialog, so pass the address with `--config` as shown — otherwise the plugin installs
without a Studio address and you have to add it afterwards with
`/plugin configure openl@openl-ai-plugin` in a terminal session.

> **Upgrading from 0.1.x?** Version 0.2.0 renames the plugin from `openl-ai` to
> `openl`. Current Claude Code versions migrate the installed plugin and its settings
> automatically; older or centrally managed installations need an extra step. Follow
> [Upgrade from `openl-ai` 0.1.x to `openl` 0.2.0](migrate-to-0.2.md).

> **Previously installed the trace skill by hand?** After installing plugin 0.3.0,
> delete `~/.claude/skills/openl-trace-investigation` (macOS/Linux) or
> `%USERPROFILE%\.claude\skills\openl-trace-investigation` (Windows), then start a new
> Claude session. The plugin cannot remove that user-owned copy, and keeping it leaves
> the obsolete debugger-only workflow alongside `/openl:trace-investigation`. See
> [Troubleshooting](troubleshooting.md#claude-offers-two-trace-skills-or-asks-for-unavailable-debugger-tools).

When Claude Code asks for the plugin settings, fill in the **OpenL Studio address**.
You can leave the **Personal Access Token** empty for now — [Step 2](#step-2--connect-to-openl-studio)
walks you through adding it. As long as these settings are yours to edit (user,
project, or local scope), you can change them any time by starting Claude Code in a
terminal and running `/plugin configure openl@openl-ai-plugin`. If your organization
supplies them through managed settings, Claude Code can't rewrite them — ask your
administrator instead.

> One technical prerequisite: the computer running Claude Code needs **Node.js 24 or
> newer** installed. If you're not sure whether you have it, just continue — if the
> OpenL tools don't appear later, see
> [Troubleshooting](troubleshooting.md#the-plugin-or-the-openl-tools-didnt-appear)
> or ask your administrator.

## Step 2 — Connect to OpenL Studio

You connect by giving the plugin a **Personal Access Token** — a token you create in
OpenL Studio's own screen.

In Claude Code (any surface — terminal, IDE, or the desktop app's Code tab), run:

```text
/openl:connect
```

Claude checks your Studio and walks you through it:

- **Multi-user Studio** — Claude asks you to create a token: open OpenL Studio in your
  browser, go to **User → Personal Access Tokens**, create one (name it e.g. "Claude
  Code"), and copy it. Then **open a terminal, start Claude Code with `claude`**, run
  `/plugin configure openl@openl-ai-plugin` and paste the token into the **Personal
  Access Token** field. The field is masked and the token is not shown to Claude —
  never paste it into the chat.
- **Single-user Studio** — "Your Studio does not require sign-in"; you're done, nothing
  to add.

Use the exact Studio address from the browser, including its scheme. Local copies
may use `http://`; when a PAT is required, Claude warns that HTTP sends it without
transport encryption. Prefer HTTPS outside local development.

The token is stored securely (macOS keychain, or a protected credentials file
elsewhere) and lets Claude act as you in Studio.

## Step 3 — Try it

Start a **new Claude session** (the connection is picked up when a session starts),
then ask:

```text
List the OpenL projects I can access.
```

If Claude shows your projects — setup is complete.

## Remote sessions (SSH, cloud, WSL)

Everything above assumes a **Local** session — Claude Code running on your own
computer, where the plugin, Node.js, and the saved settings all live together. The
desktop app's other session types differ:

- **SSH** — Claude Code runs on the remote machine, so that machine needs Node.js 24+
  and network access to Studio, and the plugin and its settings have to be installed
  there. Repeat Steps 1–2 in a terminal **on the remote host**; the settings saved on
  your laptop do not travel with the session.
- **Cloud** sessions — the desktop plugin browser isn't available and plugins you
  installed locally don't apply. A cloud session would also need to reach your Studio
  from Anthropic's infrastructure, which internal deployments usually don't allow.
- **WSL** sessions — plugins aren't available.

## Signing out and rotating the token

- **Sign out:** revoke the token in OpenL Studio (**User → Personal Access Tokens**) —
  that is what actually cuts access — then clear the **Personal Access Token** field
  via `/plugin configure openl@openl-ai-plugin` (terminal session) and start a new
  Claude session.
- **Rotate:** create a new token in Studio, put it into the same field, verify in a
  new session, then revoke the old token in Studio.

## If something doesn't work

| What you see | First thing to try |
|---|---|
| The OpenL tools or the plugin didn't appear | Start a new Claude session; then see [Troubleshooting](troubleshooting.md#the-plugin-or-the-openl-tools-didnt-appear) |
| "Unauthorized" or 401 errors | Your token is missing, expired, or revoked — create a fresh one in Studio (**User → Personal Access Tokens**), update it in a terminal session with `/plugin configure openl@openl-ai-plugin`, then start a new session |
| "Cannot reach OpenL Studio" | Check the address and your VPN / office network connection |
| `/plugin …` isn't recognized in the desktop app's Code tab | Expected — these commands run only in a terminal Claude Code session. Open a terminal, run `claude`, and use them there; the settings apply to your Code tab sessions too. |

More symptoms and fixes: [troubleshooting.md](troubleshooting.md) — including what
information to send your administrator if you're stuck.

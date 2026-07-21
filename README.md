# OpenL AI plugin for Claude Code

Work with **OpenL Studio** by simply asking [Claude](https://code.claude.com) in plain
language. Once connected, Claude can look things up in Studio for you and act on your
behalf — no need to click through Studio screens or know where things live:

- **Explore** — "Which projects do I have? Show me the tables in the Rating project."
- **Understand** — "Explain what the LossRatio table calculates, in business terms."
- **Investigate** — "Where is the final premium discount actually computed?"
- **Verify** — "Run the tests in this project and explain the failures."

Setup takes about five minutes. If your organization has already set the plugin up
for you, it's even less — skip straight to [Connect to OpenL Studio](#step-2--connect-to-openl-studio).

> **Where do you use Claude?** The Claude desktop app has three tabs — Chat, Cowork,
> and Code — and they are set up differently:
>
> - **Claude Code in a terminal or IDE** — follow the steps below as written.
> - **The desktop app's Code tab** — same plugin, but the `/plugin …` commands don't
>   run in the desktop chat. Run the Step 1 commands **once in a terminal** (exact
>   lines below) — your desktop Code sessions pick the plugin up automatically.
> - **The Chat or Cowork tab** — a different (equally simple) setup: follow the
>   [Claude desktop / Cowork guide](docs/cowork-setup.md). The steps below don't work
>   there (the plugin's settings dialog is Claude Code-only) — the guide installs this
>   plugin for its skills and sets up the connection through a settings file.

## What you need

- **Claude Code** installed (terminal, IDE extension, or the desktop app's Code tab).
- The **OpenL Studio address** — the web address you open in your browser to use
  OpenL Studio, for example `https://studio.example.com`.
- Your usual OpenL Studio account.

## Step 1 — Install the plugin

> Skip this step if your organization already installed the plugin for you
> (it shows up under `/plugin` in Claude Code).

In a Claude Code session in the terminal, run:

```text
/plugin marketplace add openl-tablets/openl-ai-plugin
/plugin install openl-ai@openl-ai-plugin
```

Or, without entering a session (works for the desktop app's Code tab too — run these
in a terminal once, then restart the desktop app):

```bash
claude plugin marketplace add openl-tablets/openl-ai-plugin
claude plugin install openl-ai@openl-ai-plugin
```

When Claude Code asks for the plugin settings, fill in the **OpenL Studio address**.
You can leave the **Personal Access Token** empty for now — [Step 2](#step-2--connect-to-openl-studio)
walks you through adding it. You can change the settings any time with
`/plugin configure openl-ai@openl-ai-plugin`.

> One technical prerequisite: the computer running Claude Code needs **Node.js 24 or
> newer** installed. If you're not sure whether you have it, just continue — if the
> OpenL tools don't appear later, see
> [Troubleshooting](docs/troubleshooting.md#the-plugin-or-the-openl-tools-didnt-appear)
> or ask your administrator.

## Step 2 — Connect to OpenL Studio

You connect by giving the plugin a **Personal Access Token** — a token you create in
OpenL Studio's own screen. In Claude Code, run:

```text
/openl-ai:connect
```

Claude checks your Studio and walks you through it:

- **Multi-user Studio** — Claude asks you to create a token: open OpenL Studio in your
  browser, go to **User → Personal Access Tokens**, create one (name it e.g. "Claude
  Code"), then run `/plugin configure openl-ai@openl-ai-plugin` and paste it into the
  **Personal Access Token** field. The field is masked and the token is not shown to
  Claude — never paste it into the chat.
- **Single-user Studio** — "Your Studio does not require sign-in"; you're done, nothing
  to add.

> **Desktop app's Code tab:** `/plugin configure` opens its dialog only in a terminal
> session — run it there once (open a terminal, run `claude`, type the command). The
> saved settings apply to your desktop Code sessions too.

The token is stored securely (see the token setting in
[Step 1](#step-1--install-the-plugin)) and lets Claude act as you in Studio.

## Step 3 — Try it

Start a **new Claude session** (the connection is picked up when a session starts),
then ask:

```text
List the OpenL projects I can access.
```

If Claude shows your projects — setup is complete.

## What to ask Claude

Some examples of everyday analyst tasks:

- "List the OpenL projects I can access."
- "Open the Rating project and show me its tables."
- "Explain the DriverRisk table in business terms — what does it decide and based on what inputs?"
- "Where in this project is the final premium calculated? Walk me through the steps."
- "Run the tests in the Rating project and give me a short summary of what failed and why."
- "Compare the AutoPremium table with the version from the previous revision — what changed?"

Claude picks the right OpenL operation automatically — there are 50+ of them, covering
projects, tables, tests, tracing, and deployment.

## If something doesn't work

| What you see | First thing to try |
|---|---|
| The OpenL tools or the plugin didn't appear | Start a new Claude session; then see [Troubleshooting](docs/troubleshooting.md#the-plugin-or-the-openl-tools-didnt-appear) |
| "Unauthorized" or 401 errors | Your token is missing, expired, or revoked — create a fresh one in Studio (**User → Personal Access Tokens**), update it with `/plugin configure openl-ai@openl-ai-plugin`, then start a new session |
| "Cannot reach OpenL Studio" | Check the address and your VPN / office network connection |

More symptoms and fixes: [docs/troubleshooting.md](docs/troubleshooting.md) —
including what information to send your administrator if you're stuck.

## Documentation

- [docs/cowork-setup.md](docs/cowork-setup.md) — using OpenL from the **Claude
  desktop app / Cowork** (a different setup than the plugin below).
- [docs/troubleshooting.md](docs/troubleshooting.md) — symptom → fix, for everyone.
- [docs/admin-setup.md](docs/admin-setup.md) — for OpenL administrators: supported
  versions, organization-wide setup, authentication, security notes.
- [docs/architecture.md](docs/architecture.md) — for developers: how the plugin is put together.
- [docs/release.md](docs/release.md) — for maintainers: versioning, releasing, distribution.

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

## What you need

- **Claude Code** installed (the terminal app, desktop app, or IDE extension).
- The **OpenL Studio address** — the web address you open in your browser to use
  OpenL Studio, for example `https://studio.example.com`.
- Your usual OpenL Studio account.

## Step 1 — Install the plugin

> Skip this step if your organization already installed the plugin for you
> (it shows up under `/plugin` in Claude Code).

In Claude Code, run:

```text
/plugin marketplace add openl-tablets/openl-ai-plugin
/plugin install openl-ai@openl-ai-plugin
```

When Claude Code asks for the plugin settings, fill in the **OpenL Studio address**.
Leave the other fields as they are unless your OpenL administrator told you otherwise.
You can change the settings later with `/plugin configure openl-ai@openl-ai-plugin`.

> One technical prerequisite: the computer running Claude Code needs **Node.js 24 or
> newer** installed. If you're not sure whether you have it, just continue — if the
> OpenL tools don't appear later, see
> [Troubleshooting](docs/troubleshooting.md#the-plugin-or-the-openl-tools-didnt-appear)
> or ask your administrator.

## Step 2 — Connect to OpenL Studio

In Claude Code, run:

```text
/openl-ai:connect
```

Claude checks your Studio and walks you through it. One of three things happens:

- **Your browser opens** — sign in with your usual OpenL Studio account and approve.
  Claude confirms with "Connected as \<your name\>."
- **"Your Studio does not require sign-in."** — you're done; nothing to sign in to.
- **"Browser sign-in is not configured for your organization."** — ask your OpenL
  administrator for access instructions. They may give you an access token to add in
  the plugin's **Personal Access Token** setting
  (`/plugin configure openl-ai@openl-ai-plugin`).

Your sign-in credentials are stored securely and are not shown to Claude.

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
| "Unauthorized" or 401 errors | Run `/openl-ai:connect` again, then start a new session |
| "Cannot reach OpenL Studio" | Check the address and your VPN / office network connection |

More symptoms and fixes: [docs/troubleshooting.md](docs/troubleshooting.md) —
including what information to send your administrator if you're stuck.

## Documentation

- [docs/troubleshooting.md](docs/troubleshooting.md) — symptom → fix, for everyone.
- [docs/admin-setup.md](docs/admin-setup.md) — for OpenL administrators: supported
  versions, organization-wide setup, sign-in configuration, security notes.
- [docs/architecture.md](docs/architecture.md) — for developers: how the plugin is put together.
- [docs/release.md](docs/release.md) — for maintainers: versioning, releasing, distribution.

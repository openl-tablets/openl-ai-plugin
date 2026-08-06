# OpenL AI plugin for Claude and Codex

Work with **OpenL Studio** by simply asking your AI assistant in plain language. This
plugin connects **Claude Code**, the **Claude desktop app**, or **Codex** to OpenL
Studio; once connected, the assistant can look things up in Studio for you and act on
your behalf — no need to click through Studio screens or know where things live:

- **Explore** — "Which projects do I have? Show me the tables in the Rating project."
- **Understand** — "Explain what the LossRatio table calculates, in business terms."
- **Investigate** — "Where is the final premium discount actually computed?"
- **Verify** — "Run the tests in this project and explain the failures."

## Set up — pick the tool you use

Each tool sets up differently, so start with the guide for yours. Setup takes five to
ten minutes.

| The tool you use | Setup guide |
|---|---|
| **Claude Code** — terminal, IDE extension, or the Claude desktop app's **Code** tab | [docs/claude-code-setup.md](docs/claude-code-setup.md) |
| **Claude desktop app** — the **Chat** or **Cowork** tabs | [docs/cowork-setup.md](docs/cowork-setup.md) |
| **Codex** — desktop app or CLI | [docs/codex-setup.md](docs/codex-setup.md) |

Not sure which you have? If you type your requests into a **terminal window** or a
panel inside your IDE, it's Claude Code. If you use the **Claude app** with a sidebar
of conversations, it's the desktop app — and the tab you're in (Code, or Chat/Cowork)
decides which of the first two guides to follow.

**Already set up by your organization?** Go straight to the "Connect to OpenL Studio"
step of your guide. Unless your Studio is single-user (no sign-in screen), you add
your own personal access token there — it isn't something an administrator can hand
out for you.

**Upgrading from `openl-ai` 0.1.x?** Version 0.2.0 renames the plugin to `openl`:
[docs/migrate-to-0.2.md](docs/migrate-to-0.2.md).

## What you need

- One of the tools above.
- **Node.js 24 or newer** on your own computer (the OpenL connection runs locally).
  Each setup guide explains how to check.
- The **OpenL Studio address** — the web address you open in your browser to use
  OpenL Studio, for example `https://studio.example.com`.
- Your usual OpenL Studio account, and your office network or VPN if Studio is
  internal.

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

Start with the "If something doesn't work" section of your setup guide — the fixes
differ per tool. For more symptoms and fixes, including what to send your
administrator: [docs/troubleshooting.md](docs/troubleshooting.md).

## Documentation

- [docs/claude-code-setup.md](docs/claude-code-setup.md) — setup for **Claude Code**
  (terminal, IDE, or the desktop app's Code tab).
- [docs/cowork-setup.md](docs/cowork-setup.md) — setup for the **Claude desktop app /
  Cowork** (Chat and Cowork tabs).
- [docs/codex-setup.md](docs/codex-setup.md) — setup for **Codex** (desktop or CLI).
- [docs/migrate-to-0.2.md](docs/migrate-to-0.2.md) — one-time migration from
  the `openl-ai` 0.1.x plugin identity to `openl` 0.2.0.
- [docs/troubleshooting.md](docs/troubleshooting.md) — symptom → fix, for everyone.
- [docs/admin-setup.md](docs/admin-setup.md) — for OpenL administrators: supported
  versions, organization-wide setup, authentication, security notes.
- [docs/architecture.md](docs/architecture.md) — for developers: how the plugin is put together.
- [docs/release.md](docs/release.md) — for maintainers: versioning, releasing, distribution.

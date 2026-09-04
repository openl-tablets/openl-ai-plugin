# OpenL AI plugin for Claude, Cursor and Codex

Work with **OpenL Studio** by simply asking your AI assistant in plain language. This
plugin connects **Claude Code**, the **Claude desktop app**, **Cursor**, or **Codex** to
OpenL Studio; once connected, the assistant can look things up in Studio for you and act
on your behalf — no need to click through Studio screens or know where things live:

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
| **Cursor** | [docs/cursor-setup.md](docs/cursor-setup.md) |
| **Codex** — desktop app or CLI | [docs/codex-setup.md](docs/codex-setup.md) |

Not sure which you have? If you type your requests into a **terminal window** or a
panel inside your IDE, it's Claude Code. If you use the **Claude app** with a sidebar
of conversations, it's the desktop app — and the tab you're in (Code, or Chat/Cowork)
decides which of the first two guides to follow.

**Cursor users:** install `openl` from Cursor's public Marketplace once it is
published, from a team marketplace, or with **Customize → Plugins → + Add → From
GitHub Repository** when your organization's policy permits repository imports. The
[Cursor guide](docs/cursor-setup.md) explains each route.

**Claude in the browser** (claude.ai, including cloud sessions) can't be connected:
the OpenL connection runs on your own computer, and a browser session has no way to
start it. Use one of the tools above instead.

**Already set up by your organization?** Skip the install step and start at the step
of your guide that creates your **access token** in OpenL Studio. Unless your Studio
is single-user (no sign-in screen), that token is yours to create — it isn't something
an administrator can hand out for you.

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

## What to ask

Some examples of everyday analyst tasks — they work the same in Claude, Cursor and Codex:

- "List the OpenL projects I can access."
- "Open the Rating project and show me its tables."
- "Explain the DriverRisk table in business terms — what does it decide and based on what inputs?"
- "Where in this project is the final premium calculated? Walk me through the steps."
- "Run the tests in the Rating project and give me a short summary of what failed and why."
- "Compare the AutoPremium table with the version from the previous revision — what changed?"
- "Why did this policy get a premium of 0? Here's the input JSON."

Your assistant picks the right OpenL operation automatically — there are 50+ of them,
covering projects, tables, tests, tracing, and deployment.

## Skills

Skills are guided workflows the plugin adds to your assistant. Pick one explicitly in
your client, or just describe the problem — the assistant can start the matching skill
by itself.

| Skill | What it does |
|---|---|
| `openl:connect` | Sets up (or repairs) the connection to OpenL Studio — it is part of the setup guide for your tool (the table above). |
| `openl:branching` | Manages isolated branches for any rule or config change — opens the right revision, syncs with base/development, resolves conflicts, and handles the hotfix two-branch rule and post-merge cleanup. |
| `openl:trace-investigation` | Finds out why a rule returned an unexpected result: traces the run, names the root cause, and proposes the minimal fix. Give it the input payload and what you expected. |
| `openl:testing` | Adds test rows and runs the full suite after any rule change, reading per-row results before reporting anything as tested. |
| `openl:versioning` | Adds a new effective-dated or dimension-scoped version of a table — without touching the existing version — with matching test coverage. |

To start one explicitly:

- **Claude Code or the Claude desktop app's Chat/Cowork tabs:** type
  `/openl:connect`, `/openl:branching`, `/openl:trace-investigation`,
  `/openl:testing`, or `/openl:versioning`.
- **Codex:** type `$` and select `$openl:connect`, `$openl:branching`,
  `$openl:trace-investigation`, `$openl:testing`, or `$openl:versioning`;
  `/skills` opens the skills picker too.
- **Cursor:** the skills are listed under **Customize → Skills** (in the *Agent
  Decides* section) and can be picked from the `/` menu in chat.

The trace workflow behaves the same across clients: it needs a connected Studio and
uses whichever trace tools the configured OpenL MCP server exposes. The `connect`
workflow instead adapts its setup steps to Claude Code, Cursor, Codex, or Claude
desktop/Cowork.

> **Upgrading the old manually installed trace skill?** After installing plugin 0.3.0,
> delete `~/.claude/skills/openl-trace-investigation` (macOS/Linux) or
> `%USERPROFILE%\.claude\skills\openl-trace-investigation` (Windows), then start a new
> Claude session (or run `/reload-plugins` in Claude Code). Plugin updates cannot remove
> that user-owned copy, and leaving it in place gives Claude two competing trace
> workflows; the old one targets trace tools that the plugin's pinned server does not
> expose.

## If something doesn't work

Start with the "If something doesn't work" section of your setup guide — the fixes
differ per tool. For more symptoms and fixes, including what to send your
administrator: [docs/troubleshooting.md](docs/troubleshooting.md).

Still on an old plugin version after a release? By default, updates from this marketplace
are manual. Claude Code users can enable auto-update for a marketplace they control, and
an administrator may manage it centrally; desktop Chat/Cowork updates remain manual. In
Cursor, update behaviour depends on whether the plugin came from the public Marketplace,
a team marketplace, or a direct repository import. See
[The plugin stays on an old version](docs/troubleshooting.md#the-plugin-stays-on-an-old-version).

## Documentation

- Setup guides, one per tool (the table above): [Claude
  Code](docs/claude-code-setup.md), [Claude desktop app /
  Cowork](docs/cowork-setup.md), [Cursor](docs/cursor-setup.md),
  [Codex](docs/codex-setup.md).
- [docs/migrate-to-0.2.md](docs/migrate-to-0.2.md) — one-time migration from
  the `openl-ai` 0.1.x plugin identity to `openl` 0.2.0.
- [docs/troubleshooting.md](docs/troubleshooting.md) — symptom → fix, for everyone.
- [docs/admin-setup.md](docs/admin-setup.md) — for OpenL administrators: supported
  versions, organization-wide setup, authentication, security notes.
- [docs/architecture.md](docs/architecture.md) — for developers: how the plugin is put together.
- [docs/release.md](docs/release.md) — for maintainers: versioning, releasing, distribution.

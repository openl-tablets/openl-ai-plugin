# Release & Distribution — `openl` plugin

_How this plugin is versioned, released, and delivered to users. This document is for plugin
maintainers. The marketplace `source` forms, install commands, and `renames`
migration were re-verified against the Claude Code docs (`code.claude.com`) on
2026-07-30. The Codex path-based MCP descriptor and local Git marketplace install
were re-verified with `codex-cli 0.145.0-alpha.30` and `0.146.0-alpha.3.1` on
2026-07-30._

## TL;DR

There are **two independent release streams**:

1. **The MCP server** — `openl-mcp`, published to **npm** from the MCP repo (`npm publish`). This is the
   source of truth for behaviour.
2. **The plugin** — this repo, delivered through a marketplace rooted at
   `.claude-plugin/marketplace.json` and consumed by both Claude Code and Codex. A
   plugin release is a git tag + matching bumped versions in both manifests and
   `package.json` + (when needed) a bumped `openl-mcp` pin.

The plugin **pins** a specific server version (`npx -y -p openl-mcp@X.Y.Z openl-mcp`), so the two streams are decoupled:
the server can publish freely, and the plugin adopts a server version deliberately by bumping the pin.

```
openl-mcp repo ──npm publish──▶ npmjs: openl-mcp@X.Y.Z
                                        ▲
                                        │ pinned in two places that must match:
                                        │   .mcp.json → tools.args               (Claude Code)
                                        │   OPENL_MCP_VERSION in the launcher     (Codex)
openl-ai-plugin repo ──git tag──▶ marketplace.json ──▶ user runs /plugin install
```

---

## 1. Distribution model: the repo is its own marketplace

A Claude Code **marketplace** is just a git repo with `.claude-plugin/marketplace.json`. The simplest pattern for
a single plugin is to make **this repo both the plugin and the marketplace**.

`.claude-plugin/marketplace.json`:

```jsonc
{
  "name": "openl-ai-plugin",
  "owner": { "name": "OpenL Tablets" },
  "plugins": [
    {
      "name": "openl",
      "source": "./",
      "description": "Work with OpenL Studio from Claude Code — manage rules, projects, tables and tests."
    }
  ],
  "renames": {
    "openl-ai": "openl"
  }
}
```

`source` can be (per the current marketplace schema — relative paths are bare strings, every
external source is an **object** with a `source` discriminator):

| `source` | Use |
|---|---|
| `"./"` or `"./path"` (bare string, relative path) | plugin code lives in **this** repo (our case) |
| `{ "source": "github", "repo": "owner/repo" }` (optional `ref`, `sha`) | plugin lives in another GitHub repo |
| `{ "source": "url", "url": "https://gitlab.com/team/plugin.git" }` (optional `ref`, `sha`) | any git host by URL (GitLab/Bitbucket/self-hosted) |
| `{ "source": "git-subdir", "url": "…", "path": "tools/claude-plugin" }` (optional `ref`, `sha`) | plugin in a subdirectory of a monorepo |
| `{ "source": "npm", "package": "@org/plugin" }` (optional `version`, `registry`) | plugin published as an npm package |

When both `ref` and `sha` are given, the `sha` is the effective pin.

`marketplace.json` required fields: `name` (kebab-case), `owner` (object with `name`), `plugins` (array).

### Is publishing gated? (no — for our path)

There are three kinds of marketplace, with different gatekeeping:

| Marketplace | Gate | Relevant to us |
|---|---|---|
| **Your own** (self-hosted git repo) | **None.** "To distribute plugins independently, create your own marketplace and share it with users." No Anthropic approval; users add it by URL. | ✅ **Our path** — fully ungated. |
| **Community** — `anthropics/claude-plugins-community` (install name `claude-community`) | You may **submit**; entry is gated by "Anthropic's automated validation and safety screening"; approved plugins are pinned to a commit SHA. | Optional later, for discoverability. |
| **Official** — `claude-plugins-official` (auto-available) | **Curated; inclusion at Anthropic's discretion.** No application — the submission forms add to *community*, not official. | Not something we control. |

So releasing **our** plugin is free and ungated: push the repo, share the `/plugin marketplace add` line. The
only "gates" are **client/admin-side**, not a barrier to publishing:

- **Trust on install (user consent, not Anthropic approval):** "Plugins and marketplaces are highly trusted
  components that can execute arbitrary code on your machine with your user privileges. Only install plugins and
  add marketplaces from sources you trust." On install Claude Code also warns: "Anthropic does not control what
  MCP servers, files, or other software are included in plugins and cannot verify that they work as intended."
- **Transparency before install:** a **Will install** inventory lists the plugin's commands/agents/skills/hooks/
  MCP & LSP servers (Claude Code v2.1.145+), plus a context-cost estimate.
- **Per-MCP-server approval** on first use.
- **Enterprise controls:** admins can restrict allowed marketplaces via `strictKnownMarketplaces` (managed
  settings), and pre-provision via `extraKnownMarketplaces` + `enabledPlugins`.

(Verified against `code.claude.com/docs/en/discover-plugins` and `…/plugin-marketplaces`, 2026-06-26.)

---

## 2. End-user install / update commands

Both slash commands (typed inside a Claude Code session — they are **not** shell commands) and
`claude plugin …` CLI subcommands (run in a terminal) exist.

In Claude Code, run:

```text
# add this marketplace (GitHub shorthand owner/repo, or a full git URL)
/plugin marketplace add openl-tablets/openl-ai-plugin

# install + enable the plugin
/plugin install openl@openl-ai-plugin
#   → on enable, Claude Code prompts for studio_base_url (+ the optional token /
#     sign-in settings), stores the sensitive token in secure storage (OS keychain
#     on macOS, protected credentials file elsewhere), and starts the MCP server.

# reconfigure later
/plugin configure openl@openl-ai-plugin

# manage
/plugin list                       # what's installed / enabled
/plugin disable openl@openl-ai-plugin
/plugin enable  openl@openl-ai-plugin

# updates
/plugin marketplace update openl-ai-plugin   # refresh the marketplace metadata
/plugin update openl@openl-ai-plugin   # pull the new plugin version
```

CLI equivalents (terminal): `claude plugin marketplace add|list|update|remove`,
`claude plugin install|enable|disable|update|list`. `claude plugin install` also accepts
`--config KEY=VALUE` to pre-fill `userConfig` options headlessly (useful for scripted
rollouts — see [admin-setup.md](admin-setup.md)).

**Neither update step happens on its own.** Startup marketplace refresh is on by
default only for the marketplaces Anthropic ships, so a published `openl` release
reaches an existing installation when a user refreshes this marketplace — or when the
marketplace has auto-update on, either from distributed settings
([admin-setup.md](admin-setup.md#installing-for-the-organization)) or from the
per-marketplace toggle a user can flip in `/plugin` when the declaring scope is editable
([troubleshooting.md](troubleshooting.md#the-plugin-stays-on-an-old-version)). Such an
update lands in the user's next session, not the running one. Inside the Claude
desktop app the plugin auto-updater is switched off entirely (checked through Claude
Code 2.1.222), and its Chat/Cowork installations follow an account-scoped copy of the
marketplace that the user syncs from the app
([cowork-setup.md](cowork-setup.md#keeping-openl-up-to-date)). Plan release
communications around this: pushing a tag does not move anybody's installation.

Validate before publishing:

```bash
claude plugin validate .          # checks plugin.json + marketplace.json schema
```

### One-time 0.1.x → 0.2.0 identity migration

Version 0.2.0 changes the plugin identity from `openl-ai` to `openl`. The top-level,
append-only marketplace `renames` map automatically rewrites editable
`enabledPlugins` and `pluginConfigs` keys on Claude Code 2.1.193+. Release
communications must still link to [migrate-to-0.2.md](migrate-to-0.2.md) for older
clients, managed/read-only settings, shared-PAT precautions, Cowork, and prerelease
Codex cleanup.

---

## 3. Versioning model

- The plugin version is the matching **`version` field in
  `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`,
  `.cursor-plugin/plugin.json`, and `package.json`** (semver, e.g. `"0.2.0"`). Always
  set and bump all four together.
- Claude Code and Codex releases use the explicit manifest version as their published
  update identity. A push without a version bump is not a release for those clients.
- Cursor's **team marketplace** follows an indexed repository revision: **Auto
  Refresh** or a manual **Refresh** can index a new commit even before the manifest
  version changes. Still bump all four versions for every release so the UI, changelog,
  rollback point and other clients describe the same artifact. Public Cursor
  Marketplace updates go through Cursor's review/publish process; Cursor does not
  currently document an unattended-update guarantee for direct GitHub installs.
- The plugin's effective "contents" = the manifest/skills/agents in the tagged commit **plus** the pinned
  `openl-mcp@X.Y.Z`. Bumping the server pin is a plugin-version-worthy change.
- **Landing on `main` *is* the release.** This repository is its own marketplace, so every
  client resolves the plugin from `main` — there is no separate publish step that could
  hold a merged version back, and nothing to "stage". Consequences: date the `CHANGELOG.md`
  section as part of the release commit rather than later, treat a version that reached
  `main` as shipped even if it was never tagged or announced, and fix a released version
  forward with the next patch instead of trying to unship it. Tags mark those releases and
  give a rollback point; they do not gate them.

---

## 4. Release procedure (checklist)

**A. Upstream: cut an `openl-mcp` release (only when server behaviour changed)**
1. In the MCP repo: land changes, update its `CHANGELOG.md`, tag, and `npm publish` → `openl-mcp@X.Y.Z`.
2. Confirm it's resolvable: `npm view openl-mcp@X.Y.Z version`.

**B. This repo: cut a plugin release**
1. If adopting a new server: bump the pin in **all three** places that carry it —
   `.mcp.json` → `tools.args` (Claude Code), `OPENL_MCP_VERSION` in
   `scripts/start-openl-mcp-codex.mjs` (Codex), and `.mcp.cursor.json` →
   `mcpServers.tools.args` (Cursor). They must stay equal;
   `tests/plugin-manifests.test.mjs` fails the build if they drift.
2. Update skills / agents / docs as needed.
3. Bump `version` in all three plugin manifests and `package.json` (and the entry in
   either `marketplace.json` if it carries one).
4. Update `CHANGELOG.md` (replace `Unreleased` with the release date on the version being cut).
5. Run `npm test` and `claude plugin validate .`, then smoke-install through an
   isolated Codex test profile and inspect only this plugin with
   `codex mcp get openl-ai --json`. Confirm it uses the bundled launcher and never
   Claude's `${user_config.*}` placeholders. Do not capture a global
   `codex mcp list --json`: unrelated user-defined servers may expose their configured
   environment values in that output.
   In a live test Studio, also verify the manifest's `writes` approval mode: a
   read-only listing uses the normal read path, a harmless write requests approval,
   the launcher remains the configured process, and no PAT appears in prompts,
   process arguments, stdout, stderr, or captured MCP traffic.
6. Treat the automated Cursor tests as a **packaging contract**, not an application
   smoke test. Publish the candidate to a disposable/team marketplace branch, or use
   local import when an administrator has enabled it. In a clean project and
   user-scoped install, enter a test Studio URL/PAT only through **Configure**, confirm
   the expected plugin version and all five skills, confirm the `tools` server connects,
   run a real *List projects* request, and invoke at least one skill. The project must
   not gain `.cursor/mcp.json` or any other hand-written config. Exercise the chosen
   update route once from the previous release as well, recording whether the settings
   remain configured; never put the PAT in logs or test artifacts.
7. Commit, tag `vA.B.C`, push.
8. (Optional) create a GitHub Release with notes pulled from `CHANGELOG.md`.

**C. Users update**
- Existing Claude Code 0.1.x users: refresh the marketplace; Claude Code 2.1.193+
  applies the rename automatically. Use the
  [identity migration](migrate-to-0.2.md) for older or managed installations.
- Users who manually installed the old `openl-trace-investigation` skill from the
  `openl-mcp` repository: after installing plugin 0.3.0, delete
  `~/.claude/skills/openl-trace-investigation` (macOS/Linux) or
  `%USERPROFILE%\.claude\skills\openl-trace-investigation` (Windows), then start a new
  Claude session. Announce this explicitly; a plugin update cannot remove the user-owned
  copy.
- Later `openl` releases: `/plugin marketplace update openl-ai-plugin` then
  `/plugin update openl@openl-ai-plugin`.
- Codex: `codex plugin marketplace upgrade openl-ai-plugin`, then remove and add
  `openl@openl-ai-plugin` again. The Codex connection config stays outside the
  plugin cache; start a new task after reinstalling.
- Cursor depends on its install route. A team-marketplace owner uses **Auto Refresh**
  (with the Cursor GitHub App) or manual **Refresh**; a public-Marketplace build becomes
  available only after Cursor publishes the reviewed update. Cursor does not document
  a supported update path for **From GitHub Repository** installs, so treat that route
  as non-updating until it is tested and documented; move users to the public or team
  marketplace for managed updates. Announce the release to the marketplace owner as
  well as users; see
  [admin-setup.md](admin-setup.md#rolling-out-to-cursor-users).
- Claude desktop app, **Chat/Cowork** installations: the release is invisible to them
  until they refresh the `openl-ai-plugin` marketplace in **Customize → Plugins**; the
  plugin's **Update** button stays inactive until their account's copy of the
  marketplace has been synced. Say so explicitly in the announcement — see
  [cowork-setup.md](cowork-setup.md#keeping-openl-up-to-date).
- Anyone whose settings carry `autoUpdate: true` for this marketplace gets it on the
  next Claude Code startup, except inside the desktop app. Everyone else needs the
  commands above, so an announcement is part of the release, not an optional extra.

---

## 5. CI automation (recommended for this repo)

- **PR check:** run `claude plugin validate .`, lint the skill markdown, and verify the pinned
  `openl-mcp` version actually exists on npm.
- **Release on tag:** on `v*` tag push, create a GitHub Release from `CHANGELOG.md`.
- **Server-bump watcher:** a scheduled / renovate-style job that watches npm for new `openl-mcp` versions
  and opens a PR bumping the pin (so adopting a server release is a reviewable PR, never silent).

The MCP repo keeps its own existing publish pipeline; this repo's CI does **not** build or publish the server.

---

## 6. Enterprise / private distribution

OpenL Studio is frequently self-hosted, so private distribution matters.

- **Private marketplace:** host `marketplace.json` in a **private git repo** (e.g. `your-org/claude-plugins`).
  Customers run `/plugin marketplace add your-org/claude-plugins`. Auth uses the user's existing git credential
  helper / SSH key; for background auto-update set `GITHUB_TOKEN` / `GITLAB_TOKEN` / `BITBUCKET_TOKEN`.
- **Pre-provisioning:** an org can pin the marketplace and pre-enable the plugin via
  `extraKnownMarketplaces` + `enabledPlugins` in `.claude/settings.json`, and lock down which marketplaces are
  allowed via `strictKnownMarketplaces` in managed settings.
- **Offline / air-gapped:** `npx` needs the npm registry at first launch. For fully offline installs, switch the
  server `command` to a **vendored single-file bundle** under `${CLAUDE_PLUGIN_ROOT}/dist/` (see
  [architecture.md](architecture.md)) and ship it inside the plugin tag. Keep this as a documented variant, not the default.

---

## 7. How auth capabilities map to releases

| Plugin release | `openl-mcp` pin | What users get |
|---|---|---|
| `0.1.x` | `@1.1.0` | Claude Code and desktop/Cowork PAT setup; single-user Studio needs no token. |
| `0.2.x` | `@1.1.0` | First-class Codex manifest, safe interactive config, isolated launcher, and platform-aware connect skill. |
| `0.5.x` | `@1.2.0` | Same PAT/anonymous modes, minus the server's legacy CLI token-cache fallback; adds the interactive trace debugger and branch-merge tools. |

The PAT path works on every surface Claude Code runs on and with any Studio identity provider, so
no browser sign-in is shipped. The Claude **desktop app (Cowork)** is covered by the same PAT-backed
`openl-mcp` server configured via `claude_desktop_config.json` — see
[cowork-setup.md](cowork-setup.md), not this plugin's settings. That manual configuration follows
the current npm release by default and offers an exact-version option for controlled deployments;
it is independent of the pin in `.mcp.json`. Only **claude.ai (web/remote)** needs
the separate remote MCP connector (the `openl-studio-mcp` server's embedded-OAuth mode, which
requires an internet-reachable MCP endpoint).

Each release is a normal plugin release: bump the server pin if needed, adjust the `connect` skill,
bump `version`, tag.

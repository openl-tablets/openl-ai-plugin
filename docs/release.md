# Release & Distribution — `openl-ai` plugin

_How this plugin is versioned, released, and delivered to users. This document is for plugin
maintainers. Verified against the Claude Code docs (`code.claude.com`) as of 2026-06-26; the
marketplace `source` forms and install commands re-verified 2026-07-13._

## TL;DR

There are **two independent release streams**:

1. **The MCP server** — `openl-mcp`, published to **npm** from the MCP repo (`npm publish`). This is the
   source of truth for behaviour.
2. **The plugin** — this repo, delivered through a **Claude Code marketplace** (a git repo containing
   `.claude-plugin/marketplace.json`). A plugin "release" is a git tag + a bumped `version` + (when needed) a
   bumped `openl-mcp` pin.

The plugin **pins** a specific server version (`npx -y -p openl-mcp@X.Y.Z openl-mcp`), so the two streams are decoupled:
the server can publish freely, and the plugin adopts a server version deliberately by bumping the pin.

```
openl-mcp repo ──npm publish──▶ npmjs: openl-mcp@X.Y.Z
                                        ▲
                                        │ pinned in .mcp.json → tools.args
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
      "name": "openl-ai",
      "source": "./",
      "description": "Work with OpenL Studio from Claude Code — manage rules, projects, tables and tests."
    }
  ]
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
/plugin install openl-ai@openl-ai-plugin
#   → on enable, Claude Code prompts for studio_base_url (+ the optional token /
#     sign-in settings), stores the sensitive token in secure storage (OS keychain
#     on macOS, protected credentials file elsewhere), and starts the MCP server.

# reconfigure later
/plugin configure openl-ai@openl-ai-plugin

# manage
/plugin list                       # what's installed / enabled
/plugin disable openl-ai@openl-ai-plugin
/plugin enable  openl-ai@openl-ai-plugin

# updates
/plugin marketplace update openl-ai-plugin   # refresh the marketplace metadata
/plugin update openl-ai@openl-ai-plugin   # pull the new plugin version
```

CLI equivalents (terminal): `claude plugin marketplace add|list|update|remove`,
`claude plugin install|enable|disable|update|list`. `claude plugin install` also accepts
`--config KEY=VALUE` to pre-fill `userConfig` options headlessly (useful for scripted
rollouts — see [admin-setup.md](admin-setup.md)).

Validate before publishing:

```bash
claude plugin validate .          # checks plugin.json + marketplace.json schema
```

---

## 3. Versioning model

- The plugin's version is the **`version` field in `plugin.json`** (semver, e.g. `"0.1.0"`). It is optional but
  **we will always set it**.
- Version resolution order: `plugin.json` `version` → marketplace entry version → git commit SHA → `"unknown"`.
- **Update behaviour:**
  - With an explicit `version`: users only receive an update when you **bump it**. Pushing commits without a bump
    does nothing — good for controlled releases. ← our model.
  - Without a `version`: every commit is treated as a new version — handy for fast internal iteration, but
    avoid for a published plugin.
- The plugin's effective "contents" = the manifest/skills/agents in the tagged commit **plus** the pinned
  `openl-mcp@X.Y.Z`. Bumping the server pin is a plugin-version-worthy change.

---

## 4. Release procedure (checklist)

**A. Upstream: cut an `openl-mcp` release (only when server behaviour changed)**
1. In the MCP repo: land changes, update its `CHANGELOG.md`, tag, and `npm publish` → `openl-mcp@X.Y.Z`.
2. Confirm it's resolvable: `npm view openl-mcp@X.Y.Z version`.

**B. This repo: cut a plugin release**
1. If adopting a new server: bump the pin in `.mcp.json` → `tools.args` to `openl-mcp@X.Y.Z`.
2. Update skills / agents / docs as needed.
3. Bump `version` in `plugin.json` (and the entry in `marketplace.json` if it carries one).
4. Update `CHANGELOG.md` (replace `Unreleased` with the release date on the version being cut).
5. `claude plugin validate .`
6. Commit, tag `vA.B.C`, push.
7. (Optional) create a GitHub Release with notes pulled from `CHANGELOG.md`.

**C. Users update**
- `/plugin marketplace update openl-ai-plugin` then `/plugin update openl-ai@openl-ai-plugin`.

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
| `0.1.x` | `@1.1.0` | Personal Access Token via `userConfig`; `/openl-ai:connect` guides the user through creating and pasting it. Single-user Studio needs no token. |

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

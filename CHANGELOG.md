# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - Unreleased

### Added

- `openl:branching`, `openl:testing`, and `openl:versioning` skills (GENESIS-436950),
  adapted from the equivalent OpenL skills already shipping in the SDLC project's skill
  set (dropping the `eis-dev-` prefix to match this plugin's bare-verb naming, alongside
  `connect` and `trace-investigation`). `branching` teaches isolated task branches,
  correct revision handling, deliberate base/development syncing with dependents tested
  before finalizing, the hotfix two-branch rule, and post-merge cleanup. `testing`
  teaches the pre-test sequence, reading per-row results instead of trusting the summary
  count, and never modifying an existing test row without named approval. `versioning`
  teaches OpenL's table-versioning model — adding a new `properties`-row version,
  runtime context, and testing both the old and new date ranges — without touching a
  prior version in place. All three ship from `skills/` with no manifest change, picked
  up by Claude Code and Codex the same way `connect` and `trace-investigation` are.

## [0.3.0] - 2026-08-07

### Added

- `openl:trace-investigation` skill, moved into the plugin from the `openl-mcp`
  repository (where per-user copying into `~/.claude/skills/` was the only delivery
  path). It investigates why a rule produced an unexpected result — root cause first,
  then the minimal fix, then trace evidence — with audience-aware depth and a root-cause
  taxonomy. Because a skill ships with the plugin while the tools come from the
  configured server, its trace phase checks the tool surface and follows one of two
  paths: the tree-trace tools of the pinned `openl-mcp@1.1.0`
  (`openl_start_trace` → `openl_get_trace_nodes` → `openl_get_trace_node_details`,
  lazy values via `openl_get_trace_parameter`), or the interactive debugger of a newer
  server (`openl_step_trace`, `openl_watch_trace_cells`, `openl_inspect_trace_frame`,
  profiling hotspots, `@N` breakpoints). Both Claude Code and Codex pick the skill up
  from `skills/` with no manifest change. The skill treats a trace as evidence that can
  carry personal data (a full text export is opt-in, not the default), treats the
  profiling overview as a top-N sample rather than proof, and never saves a project
  without checking what else is pending in its working copy.
- Update guidance for every surface, documenting that releases do not reach installations
  by themselves: a "Keeping OpenL up to date" section in the Claude desktop app / Cowork
  guide (why the plugin's **Update** button stays greyed out until the marketplace is
  refreshed, and why it never activates for the pre-0.2.0 `openl-ai` name), a matching
  "The plugin stays on an old version" section in the troubleshooting guide — including
  the per-marketplace auto-update toggle users can flip themselves — explicit
  desktop/Cowork replacement steps in the 0.2.0 migration guide, the `autoUpdate`
  marketplace flag with its scope and desktop-app limits in the administrator guide, and
  release-communication notes in the release guide.

### Changed

- Users who previously copied the standalone `openl-trace-investigation` skill into
  `~/.claude/skills/` must remove that old directory after installing 0.3.0 (on Windows,
  `%USERPROFILE%\.claude\skills\openl-trace-investigation`). Plugin updates cannot
  remove user-owned skills; keeping both copies leaves two matching implicit workflows,
  and the old one targets debugger tools that `openl-mcp@1.1.0` does not expose.
- Documentation: the README no longer walks through the Claude Code setup inline.
  It now starts with a "pick the tool you use" table linking to one guide per tool,
  so users of the Claude desktop app don't follow Claude Code steps by mistake. The
  Claude Code steps moved to the new `docs/claude-code-setup.md`.
- Every analyst-facing place that asks for a `/plugin …` command now states up front
  that it runs only in a terminal Claude Code session — open a terminal and run
  `claude` first (`docs/claude-code-setup.md`, `docs/troubleshooting.md`,
  `docs/migrate-to-0.2.md`, the connect skill, including its sign-out and rotation
  flow). `docs/admin-setup.md` states the same constraint in its settings reference.
- The Claude Code guide now covers what the previous README left implicit: the
  desktop app ships without the `claude` CLI (installed separately), the headless
  `claude plugin install` needs `--config studio_base_url=…` because it doesn't open
  the settings dialog, `/plugin configure` can't rewrite managed settings, and saved
  settings apply only to sessions on the same computer — SSH sessions need their own
  install, cloud and WSL sessions can't use the plugin at all.
- The README no longer implies a personal access token is always required;
  single-user Studio connects without one.

## [0.2.0] - 2026-07-30

### Added

- Codex support: a native `.codex-plugin/plugin.json`, path-based `.mcp.codex.json`
  descriptor, bundled configurator (`scripts/configure-codex.mjs`), and launcher
  (`scripts/start-openl-mcp-codex.mjs`). The configurator stores the Studio address
  and Personal Access Token in a private user config file with no `--token` argument
  and echo-off entry; the launcher injects them into an isolated `openl-mcp` process.
  Loopback HTTP remains supported for local Studio copies, including PAT
  authentication, with an unencrypted-transport warning. Non-loopback HTTP requires
  an explicit `--allow-insecure` / `OPENL_AI_ALLOW_INSECURE=1` opt-in. Analyst guide
  in `docs/codex-setup.md`.
- A `node --test` suite and cross-platform GitHub Actions workflow covering
  manifests, config safety, HTTP policy, launcher isolation, safe terminal cleanup,
  Windows config replacement, and MCP pin parity.

### Changed

- **Plugin identity:** renamed `openl-ai` to `openl`; skills now use the
  `/openl:<skill>` namespace. The marketplace carries an append-only `renames` map,
  so Claude Code 2.1.193+ automatically migrates editable installations and their
  settings. Older and centrally managed installations use the fallback in the
  [migration guide](docs/migrate-to-0.2.md).
- The connect skill and documentation now distinguish Codex, Claude Code, and Claude desktop/Cowork setup paths.
- Codex now loads its MCP server through a manifest path instead of an inline object,
  matching the native Codex plugin packaging contract while leaving the established
  Claude Code `.mcp.json` contract unchanged.
- Hidden PAT entry restores the previous terminal mode on completion, cancellation,
  termination signals, input/output closure, and stream errors.
- The Codex launcher removes inherited OpenL credential variables
  case-insensitively before starting the MCP server, including on Windows.
- On handled shutdown signals, the Codex launcher terminates the complete MCP
  process tree (a POSIX process group or Windows `taskkill /T`) so a descendant
  cannot remain running with the PAT in its environment.

## [0.1.0] - 2026-07-21

First release: the plugin pins `openl-mcp@1.1.0` and authenticates with a Personal Access Token.

### Added

- Initial plugin scaffold: `.claude-plugin/plugin.json` (`userConfig` for the Studio base URL and a Personal Access Token) plus a root `.mcp.json` that bundles the `openl-mcp` MCP server pinned to `openl-mcp@1.1.0` (run via `npx`, server key `tools`) with the config injected into its env; and `.claude-plugin/marketplace.json` so the plugin installs with `/plugin install openl-ai@openl-ai-plugin`. (The MCP server is declared in a bare root `.mcp.json` — the one form observed to register across all Claude Code versions we tested; newer Claude Code also accepts inline `plugin.json` declarations. See `docs/architecture.md`.)
- `/openl-ai:connect` skill — guided setup that detects single- vs multi-user Studio (via the public `/rest/settings` probe) and walks the user through creating a Personal Access Token in Studio (**User → Personal Access Tokens**) and pasting it into the masked plugin setting. No browser sign-in is run from Claude Code; the token works with any Studio identity provider and on every surface, including remote/VM setups.
- The Claude desktop / Cowork setup follows the current `openl-mcp` npm release by default, with an exact-version option for administrators who need reproducible, controlled upgrades. Signing out is handled by revoking all applicable Personal Access Tokens in Studio, with no CLI operation.
- Documentation, split by audience: analyst-focused `README.md` (5-minute setup), `docs/cowork-setup.md` (step-by-step setup for the Claude desktop app / Cowork, where plugin settings are unavailable — the OpenL server is added via `claude_desktop_config.json` instead), `docs/admin-setup.md` (organization rollout, authentication per deployment type, desktop/Cowork rollout, security), `docs/troubleshooting.md` (symptom → fix), plus the developer architecture overview and the maintainer release/distribution guide under `docs/`.

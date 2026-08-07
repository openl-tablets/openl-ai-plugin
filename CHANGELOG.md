# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-08-07

### Added

- `/openl:trace-investigation` skill, moved into the plugin from the `openl-mcp`
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
  from `skills/` with no manifest change.
- Update guidance for every surface, documenting that releases do not reach installations
  by themselves: a "Keeping OpenL up to date" section in the Claude desktop app / Cowork
  guide (why the plugin's **Update** button stays greyed out until the marketplace is
  refreshed, and why it never activates for the pre-0.2.0 `openl-ai` name), a matching
  "The plugin stays on an old version" section in the troubleshooting guide, explicit
  desktop/Cowork replacement steps in the 0.2.0 migration guide, the `autoUpdate`
  marketplace flag with its scope and desktop-app limits in the administrator guide, and
  release-communication notes in the release guide.

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

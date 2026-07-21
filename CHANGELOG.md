# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

First release: the plugin pins `openl-mcp@1.1.0` and authenticates with a Personal Access Token.

### Added

- Initial plugin scaffold: `.claude-plugin/plugin.json` (`userConfig` for the Studio base URL and a Personal Access Token) plus a root `.mcp.json` that bundles the `openl-mcp` MCP server pinned to `openl-mcp@1.1.0` (run via `npx`, server key `tools`) with the config injected into its env; and `.claude-plugin/marketplace.json` so the plugin installs with `/plugin install openl-ai@openl-ai-plugin`. (The MCP server is declared in a bare root `.mcp.json` — the one form observed to register across all Claude Code versions we tested; newer Claude Code also accepts inline `plugin.json` declarations. See `docs/architecture.md`.)
- `/openl-ai:connect` skill — guided setup that detects single- vs multi-user Studio (via the public `/rest/settings` probe) and walks the user through creating a Personal Access Token in Studio (**User → Personal Access Tokens**) and pasting it into the masked plugin setting. No browser sign-in is run from Claude Code; the token works with any Studio identity provider and on every surface, including remote/VM setups.
- The Claude desktop / Cowork setup follows the current `openl-mcp` npm release by default, with an exact-version option for administrators who need reproducible, controlled upgrades. Signing out is handled by revoking all applicable Personal Access Tokens in Studio, with no CLI operation.
- Documentation, split by audience: analyst-focused `README.md` (5-minute setup), `docs/cowork-setup.md` (step-by-step setup for the Claude desktop app / Cowork, where plugin settings are unavailable — the OpenL server is added via `claude_desktop_config.json` instead), `docs/admin-setup.md` (organization rollout, authentication per deployment type, desktop/Cowork rollout, security), `docs/troubleshooting.md` (symptom → fix), plus the developer architecture overview and the maintainer release/distribution guide under `docs/`.

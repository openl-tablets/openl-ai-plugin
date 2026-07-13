# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

First release: the plugin pins `openl-mcp@1.1.0`, the first login-capable release of the MCP server.

### Added

- Initial plugin scaffold: `.claude-plugin/plugin.json` (`userConfig` for the Studio base URL, an optional Personal Access Token, and the OAuth issuer / client-id) plus a root `.mcp.json` that bundles the `openl-mcp` MCP server pinned to `openl-mcp@1.1.0` (run via `npx`, server key `tools`) with the config injected into its env; and `.claude-plugin/marketplace.json` so the plugin installs with `/plugin install openl-ai@openl-ai-plugin`. (The MCP server is declared in a bare root `.mcp.json` — the one form observed to register across all Claude Code versions we tested; newer Claude Code also accepts inline `plugin.json` declarations. See `docs/architecture.md`.)
- `/openl-ai:connect` skill — browser sign-in that mints and caches a Personal Access Token so the OpenL tools authenticate automatically (requires an OAuth2 Studio deployment with an administrator-configured sign-in issuer, and the login-capable `openl-mcp@1.1.0`). The skill reuses the saved plugin settings, detects single-user Studio deployments (no sign-in needed), and directs users to their administrator when browser sign-in isn't configured. The cached `/connect` login is used whenever no explicit PAT is configured.
- Documentation, split by audience: analyst-focused `README.md` (5-minute setup), `docs/admin-setup.md` (organization rollout, sign-in configuration, security), `docs/troubleshooting.md` (symptom → fix), plus the developer architecture overview and the maintainer release/distribution guide under `docs/`.

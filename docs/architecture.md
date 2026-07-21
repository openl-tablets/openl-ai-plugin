# Architecture — `openl-ai` Claude Code Plugin

How the plugin is put together and why: naming, the packaging model, Claude Code integration
notes, and the authentication design. This document is for developers of the plugin. For
versioning/release/distribution see [release.md](release.md); for operational setup
(versions, IdP configuration, rollout) see [admin-setup.md](admin-setup.md).

## Naming

| Thing | Value | Where it shows up |
|---|---|---|
| Repository & marketplace | `openl-ai-plugin` | `/plugin marketplace add openl-tablets/openl-ai-plugin` |
| Plugin (`plugin.json` → `name`) | `openl-ai` | `/openl-ai:<skill>`, `/plugin install openl-ai@openl-ai-plugin` |
| MCP server key (top-level key in `.mcp.json`) | `tools` | `mcp__plugin_openl-ai_tools__<tool>` |
| What it is | lives in the `description` fields, not the name | marketplace / `/plugin` UI |

Rationale: the **plugin** is named `openl-ai` — it is the user-visible namespace (`/openl-ai:…`
skills, `mcp__plugin_openl-ai_…` tool prefix), so it stays short. The **repository and
marketplace** are named `openl-ai-plugin` — describing what the repo contains. The two names
are deliberately different, one per role. `tools` as the server key avoids stuttering inside
the tool prefix (the plugin name and `mcp` are already there) and avoids collisions with
**OpenL Rule Services** (the runtime that does calculations). The "what is it" belongs in the
`description`, not in the immutable namespace.

## Layout

```
openl-ai-plugin/
├── .claude-plugin/
│   ├── plugin.json          # manifest: name, description, version, userConfig
│   └── marketplace.json     # this repo is its own marketplace
├── .mcp.json                # bundled MCP server (kept as a separate root file — see below)
├── skills/
│   └── connect/SKILL.md     # /openl-ai:connect → guided Personal Access Token setup
├── docs/
├── CHANGELOG.md
└── README.md
```

## Packaging model: `npx` from npm

The plugin is a **packaging layer, not a fork**. The MCP server is the published
[`openl-mcp`](https://www.npmjs.com/package/openl-mcp) npm package (source:
[`openl-tablets/openl-mcp`](https://github.com/openl-tablets/openl-mcp)), launched as a **stdio**
server via `npx -y -p openl-mcp@X.Y.Z openl-mcp`.

- **Pin an exact version** (`@1.1.0`), never `@latest`, for reproducibility. Bumping the pin is a
  plugin release (see [release.md](release.md)).
- `npx` needs the npm registry at first launch (cached afterwards). For offline / air-gapped
  installs the documented escape hatch is a vendored single-file bundle under
  `${CLAUDE_PLUGIN_ROOT}/dist/` with `command` pointed at `node`; it is a variant, not the default.
- A monorepo with the server was rejected: plugin sandboxing blocks references outside the plugin
  directory, and the two have different tooling and release cadences.

## Claude Code integration notes (verified on live installs)

- **Where the MCP server is declared is version-sensitive; this repo uses the most compatible
  form.** Our `.mcp.json` is a root file whose **server name is a top-level key** (no
  `mcpServers` wrapper). Observed behaviour:
  - On a June 2026 Claude Code build, this bare root `.mcp.json` was the **only** form that
    registered the server: an inline `mcpServers` block in `plugin.json` was silently ignored
    (`claude plugin details` reported "MCP servers (0)"), and wrapping the server in a
    `mcpServers` object inside `.mcp.json` made Claude Code treat `mcpServers` itself as a
    malformed server and silently skip registration.
  - On Claude Code **2.1.199** (re-verified 2026-07-13 with isolated test installs), **all
    three forms register**: the bare root `.mcp.json`, a root `.mcp.json` with the
    `mcpServers` wrapper, and an inline `plugin.json` → `mcpServers` block. The current
    official plugins reference documents the wrapper and inline forms.
  - Conclusion: keep the bare root `.mcp.json` — it is the only form observed working across
    both versions. Reconsider only when the plugin's minimum supported Claude Code moves past
    the versions where the other forms were broken, and re-verify on a live install first.
- Plugin options require **Claude Code 2.1.83+** (`manifest.userConfig` introduced there) and
  practically **2.1.119+** for this plugin: 2.1.119 fixed plugin MCP servers failing when
  `${user_config.*}` references an optional field left blank, and the token option is optional
  and blank on single-user Studio (and until the user adds a token).
- `userConfig` stays in `plugin.json`. Claude Code prompts for the values at install/enable time,
  stores `sensitive` ones in the OS keychain on macOS (or a protected credentials file,
  `~/.claude/.credentials.json`, on platforms without a keychain), keeps non-sensitive ones in
  `settings.json` under `pluginConfigs`, and injects them via `${user_config.…}` into the
  server's env. Per the current plugins reference, non-sensitive values are also substituted
  into skill/agent content — the `connect` skill relies on that (with a fallback) to reuse the
  saved Studio address without re-asking the user.
- An **unset optional `userConfig` value expands to `""`**, not to an unset variable. That is why
  the pin must be `openl-mcp@1.1.0` or later: it treats a blank/whitespace
  `OPENL_PERSONAL_ACCESS_TOKEN` as absent — falling through to the credential cache, then
  anonymous (see the precedence below) — instead of sending an empty credential and getting
  HTTP 401.
- `${CLAUDE_PLUGIN_ROOT}` is **ephemeral** (changes on update) — never cache credentials or state
  there.

## Authentication design

The request path is always the same: the server sends `Authorization: Token <openl_pat_…>` to
Studio's `/rest/**`. The Personal Access Token comes from the plugin's `studio_token` setting
(injected as `OPENL_PERSONAL_ACCESS_TOKEN`). Server-side precedence:

1. **Explicit token** — the `studio_token` setting. The mode this plugin configures.
2. **Cached CLI login** — a credential cached at `~/.config/openl-mcp/credentials.json` by the
   npm package's `openl-mcp login` command. The plugin never creates or reads this cache, but
   the server consults it whenever no explicit token is set — which is why the connect skill's
   sign-out guidance also runs `openl-mcp logout` (clearing the setting alone would silently
   fall back to this cache on machines where the CLI login was ever used).
3. **Anonymous** — no token at all (single-user Studio, where no sign-in exists).

The user creates the PAT in Studio's own UI (**User → Personal Access Tokens**), where they have
already authenticated through whatever sign-in their organization uses, and pastes it into the
masked setting. The `/openl-ai:connect` skill is pure guidance: it probes
`<base-url>/rest/settings` → `supportedFeatures.personalAccessToken` / `userMode` to tell single-
from multi-user Studio, then walks the user through creating and pasting the token. It runs no
browser flow and no subprocess.

- **Why PAT-only.** A token created in Studio works with any Studio identity provider with no IdP
  changes, and — unlike a loopback OAuth flow — works on the surfaces analysts actually use,
  including remote/VM setups where a `127.0.0.1` callback is unreachable.
- **Secrets stay out of the model's context:** the `studio_token` field is `sensitive` (masked,
  stored in the OS keychain or a protected credentials file — see integration notes); the model
  is instructed never to read it or echo a pasted token.
- **Revocation** is a normal Studio PAT operation: named, time-limited, individually revocable in
  the user's Studio token list.

## Alternatives considered

- **Browser sign-in from Claude Code** (`openl-mcp login`, OAuth 2.0 Authorization Code + PKCE
  with an RFC 8252 loopback redirect, minting a PAT via `POST /rest/users/personal-access-tokens`)
  — **removed.** It required an IdP-side public client with a `http://127.0.0.1/*` redirect, only
  worked when the browser and Claude Code ran on the same machine, and could not work at all in
  Cowork/remote sessions (the loopback callback is unreachable from the user's real browser). PAT
  entry covers every deployment with far less setup, so the flow and its `userConfig` options
  (`oauth_issuer`, `oauth_client_id`) were dropped from the plugin. The `openl-mcp` package
  still ships `login`/`logout` and its credential cache for direct CLI users; the plugin no
  longer invokes the login, but the server-side cache fallback remains active (see the
  precedence above), which the sign-out guidance accounts for.
- **Remote streamable-HTTP MCP** with full MCP OAuth (Studio fronted by an OAuth 2.1
  authorization server, or the MCP server acting as its own AS) — this is the path for
  Cowork / claude.ai, implemented separately in the `openl-studio-mcp` server's embedded-OAuth
  mode, not in this Claude Code plugin.

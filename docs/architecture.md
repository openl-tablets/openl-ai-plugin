# Architecture — `openl-ai` Claude Code Plugin

How the plugin is put together and why: naming, the packaging model, Claude Code integration
notes, and the browser sign-in design. This document is for developers of the plugin. For
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
│   └── connect/SKILL.md     # /openl-ai:connect → browser sign-in
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
  `${user_config.*}` references an optional field left blank, and three of our four options
  are optional and typically blank.
- `userConfig` stays in `plugin.json`. Claude Code prompts for the values at install/enable time,
  stores `sensitive` ones in the OS keychain on macOS (or a protected credentials file,
  `~/.claude/.credentials.json`, on platforms without a keychain), keeps non-sensitive ones in
  `settings.json` under `pluginConfigs`, and injects them via `${user_config.…}` into the
  server's env. Per the current plugins reference, non-sensitive values are also substituted
  into skill/agent content — the `connect` skill relies on that (with a fallback) to reuse the
  saved Studio address without re-asking the user.
- An **unset optional `userConfig` value expands to `""`**, not to an unset variable. That is why
  the pin must be `openl-mcp@1.1.0` or later: it treats a blank/whitespace
  `OPENL_PERSONAL_ACCESS_TOKEN` as absent and falls through to the cached `/connect` login
  (earlier versions sent the empty token and got HTTP 401).
- `${CLAUDE_PLUGIN_ROOT}` is **ephemeral** (changes on update) — never cache credentials or state
  there. The sign-in cache lives in `~/.config/openl-mcp/`.

## Authentication design

The request path is always the same: the server sends `Authorization: Token <openl_pat_…>` to
Studio's `/rest/**`. What varies is how that Personal Access Token is obtained. Server-side
precedence:

1. **Explicit token** — the plugin's `studio_token` setting (injected as
   `OPENL_PERSONAL_ACCESS_TOKEN`). Manual mode; works everywhere, including Cowork.
2. **Cached browser sign-in** — the credential minted by `/openl-ai:connect`.
3. **Anonymous** — no token at all (single-user Studio).

### Browser sign-in (`/openl-ai:connect`)

The skill runs `openl-mcp login <base-url> --issuer <idp-issuer>`, which:

1. opens the system browser to the IdP and runs an **OAuth 2.0 Authorization Code + PKCE** flow
   (RFC 8252) with a loopback redirect `http://127.0.0.1:<ephemeral-port>/callback`;
2. uses the resulting session to **mint a PAT** via Studio's existing
   `POST /rest/users/personal-access-tokens`;
3. caches it at `~/.config/openl-mcp/credentials.json` (file mode `0600`), keyed by base URL.

Design decisions behind that:

- **Login is a subcommand, not part of the MCP protocol.** A stdio MCP server takes credentials
  out-of-band (env, files); OAuth does not run inside the stdio session.
- **A PAT is minted instead of caching IdP tokens.** The PAT appears in the user's Studio token
  list (named, with a TTL, individually revocable) and reuses the exact existing
  `Token <PAT>` request path — no change to how the server talks to Studio.
- **IdP requirements:** a **public** client (no secret) with **PKCE** enabled and a loopback
  redirect `http://127.0.0.1/*` — the IP literal, not `localhost` (per RFC 8252 the port is
  ignored for loopback IPs, which is what makes the ephemeral-port flow work). The confidential
  web client Studio itself uses to log users in will not work.
- **Constraints:** PAT issuance exists only in `oauth2`/`saml` user modes — the skill probes
  `<base-url>/rest/settings` → `supportedFeatures.personalAccessToken` before attempting login.
  The browser and the MCP subprocess must run on the same machine (in Cowork, use the manual
  token instead).
- **Secrets stay out of the model's context:** the `studio_token` field is `sensitive` (masked,
  stored in the OS keychain or a protected credentials file — see integration notes), and
  `openl-mcp login` prints only `Signed in as <user>` — never the token.

## Alternatives considered

- **Device Authorization Grant (RFC 8628)** — a headless/SSH fallback (no local port needed);
  a natural later addition to `openl-mcp login`.
- **Remote streamable-HTTP MCP** with full MCP OAuth (Studio fronted by an OAuth 2.1
  authorization server) — deferred; only justified for a hosted multi-tenant offering.

# Architecture — `openl` plugin

How the plugin is put together and why: naming, the packaging model, Claude Code and Codex
integration notes, and the authentication design. This document is for developers of the plugin. For
versioning/release/distribution see [release.md](release.md); for operational setup
(versions, IdP configuration, rollout) see [admin-setup.md](admin-setup.md).

## Naming

| Thing | Value | Where it shows up |
|---|---|---|
| Repository & marketplace | `openl-ai-plugin` | `/plugin marketplace add openl-tablets/openl-ai-plugin` |
| Plugin (`plugin.json` → `name`) | `openl` | `/openl:<skill>`, `/plugin install openl@openl-ai-plugin` |
| Claude Code MCP server key (top-level key in `.mcp.json`) | `tools` | `mcp__plugin_openl_tools__<tool>` |
| Codex MCP server key (`.mcp.codex.json`) | `openl-ai` | Codex MCP configuration and approvals |
| What it is | lives in the `description` fields, not the name | marketplace / `/plugin` UI |

Rationale: the **plugin** is named `openl` — it is the user-visible namespace (`/openl:…`
skills, `mcp__plugin_openl_…` tool prefix), so it stays short. The **repository and
marketplace** are named `openl-ai-plugin` — describing what the repo contains. The two names
are deliberately different, one per role. `tools` as the server key avoids stuttering inside
the tool prefix (the plugin name and `mcp` are already there) and avoids collisions with
**OpenL Rule Services** (the runtime that does calculations). The "what is it" belongs in the
`description`, not in the immutable namespace.

## Layout

```
openl-ai-plugin/
├── .claude-plugin/
│   ├── plugin.json          # Claude Code manifest: name, description, version, userConfig
│   └── marketplace.json     # this repo is its own marketplace
├── .codex-plugin/
│   └── plugin.json          # Codex manifest: skills, interface, MCP descriptor path
├── .mcp.json                # Claude Code MCP server (kept as a separate root file — see below)
├── .mcp.codex.json          # Codex MCP server (openl-ai) → bundled launcher
├── scripts/                 # Codex-only Node helpers (Claude Code needs none of these)
│   ├── start-openl-mcp-codex.mjs   # launcher: reads saved config, spawns openl-mcp
│   ├── configure-codex.mjs         # interactive, no-echo PAT/address setup
│   └── codex-config.mjs            # shared config read/write + Studio probe helpers
├── skills/
│   ├── connect/SKILL.md     # /openl:connect → guided Personal Access Token setup
│   └── trace-investigation/SKILL.md  # /openl:trace-investigation → root-cause a rule result
├── tests/                   # node --test suite (manifests, config, launcher)
├── .github/workflows/       # CI: runs the test suite
├── package.json             # test runner + Node engines
├── docs/
├── CHANGELOG.md
└── README.md
```

## Packaging model: `npx` from npm

The plugin is a **packaging layer, not a fork**. The MCP server is the published
[`openl-mcp`](https://www.npmjs.com/package/openl-mcp) npm package (source:
[`openl-tablets/openl-mcp`](https://github.com/openl-tablets/openl-mcp)), launched as a **stdio**
server via `npx -y -p openl-mcp@X.Y.Z openl-mcp`.

- **Claude Code plugin:** pin an exact version (`@1.1.0`) in `.mcp.json` for
  reproducibility. Bumping the pin is a plugin release (see [release.md](release.md)).
- **Desktop / Cowork manual config:** use an unversioned package with
  `--prefer-online` by default so it checks for server updates when Claude starts.
  Administrators can replace it with an exact version for a controlled rollout. This
  policy lives in [cowork-setup.md](cowork-setup.md) because the desktop config is not
  managed by the plugin.
- **Codex plugin:** Codex substitutes no `${user_config.*}` values, so its manifest
  points `mcpServers` at `.mcp.codex.json`; that descriptor starts a bundled Node
  launcher (`node ./scripts/start-openl-mcp-codex.mjs`) rather than `npx` directly. The
  launcher reads the Studio address and PAT from the platform-specific user config
  written by `scripts/configure-codex.mjs`: owner-only `0700/0600` storage on POSIX,
  while Windows relies on `%APPDATA%` user-profile ACLs. It then spawns the same
  `npx -y -p openl-mcp@X.Y.Z openl-mcp` in an isolated config dir. It carries its
  **own** version pin (`OPENL_MCP_VERSION`), kept equal to the `.mcp.json` pin by a test
  in `tests/plugin-manifests.test.mjs` — see [release.md](release.md).
  This path-based descriptor was smoke-installed with `codex-cli
  0.145.0-alpha.30` and `0.146.0-alpha.3.1` on 2026-07-30: Codex copied it into
  the plugin cache and registered `openl-ai` with the installed plugin directory
  as `cwd`.
- **Codex config schema:** version 1 stores `baseUrl`, an optional
  `personalAccessToken`, and `allowInsecure: true` only for an explicitly accepted
  non-loopback HTTP address. Loopback HTTP supports local Studio copies without the
  opt-in, but status/configuration still report it as unencrypted. The launcher clears
  inherited OpenL credentials (case-insensitively, which matters on Windows) and
  gives every start a fresh `OPENL_CONFIG_DIR`, so an old CLI token cache cannot
  silently override the configured Codex identity. On handled termination signals,
  the launcher stops the full POSIX process group or Windows process tree before
  removing the isolated directory.
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
- The marketplace's append-only `renames` map moves `openl-ai` installations to
  `openl` on Claude Code 2.1.193+. Claude Code rewrites editable `enabledPlugins`
  and `pluginConfigs` keys. Administrators must update managed/read-only settings
  themselves; see [migrate-to-0.2.md](migrate-to-0.2.md).
- `userConfig` stays in `plugin.json`. Claude Code prompts for the values at install/enable time,
  stores `sensitive` ones in the OS keychain on macOS (or a protected credentials file,
  `~/.claude/.credentials.json`, on platforms without a keychain), keeps non-sensitive ones in
  `settings.json` under `pluginConfigs`, and injects them via `${user_config.…}` into the
  server's env. Per the current plugins reference, non-sensitive values are also substituted
  into skill/agent content — the `connect` skill relies on that (with a fallback) to reuse the
  saved Studio address without re-asking the user.
- An **unset optional `userConfig` value expands to `""`**, not to an unset variable. That is why
  the pin must be `openl-mcp@1.1.0` or later: it treats a blank/whitespace
  `OPENL_PERSONAL_ACCESS_TOKEN` as absent, allowing single-user Studio to connect
  anonymously instead of sending an empty credential and getting HTTP 401.
- `${CLAUDE_PLUGIN_ROOT}` is **ephemeral** (changes on update) — never cache credentials or state
  there.

## Skills: one directory, both clients

`skills/` is the single source for every client — no per-client copy, and nothing to
register per skill:

- **Claude Code** discovers `skills/*/SKILL.md` automatically; `plugin.json` carries no
  `skills` field. The directory name is the invocation name inside the plugin
  namespace: `skills/trace-investigation/` → `/openl:trace-investigation`. Keep the
  frontmatter `name` equal to the directory name.
- **Codex** reads the directory from its own manifest (`.codex-plugin/plugin.json` →
  `"skills": "./skills/"`), so a new sub-directory ships with no manifest change.
- **Claude desktop Chat/Cowork** loads the same plugin skills; only the plugin's
  settings dialog is missing there (see [cowork-setup.md](cowork-setup.md)).

Consequences for skill content:

- **Never assume a client.** `connect` branches per client explicitly, because setup
  differs (`/plugin configure` vs the Codex configurator vs
  `claude_desktop_config.json`).
- **Never assume a tool surface.** A skill ships with the plugin, but the tools come
  from whatever `openl-mcp` version is configured — the pin in `.mcp.json` for Claude
  Code and in `scripts/start-openl-mcp-codex.mjs` for Codex, or a user-managed version
  in the desktop/Cowork config. `trace-investigation` therefore checks which trace
  tools exist and follows one of two paths: the tree-trace tools of the pinned
  `openl-mcp@1.1.0` (`openl_start_trace` → `openl_get_trace_nodes` →
  `openl_get_trace_node_details`), or the interactive debugger of a newer server
  (`openl_step_trace`, `openl_watch_trace_cells`, `openl_inspect_trace_frame`, …).
  When the pin moves to a release that carries the debugger, that path becomes the
  primary one and the tree-trace path can be dropped.

## Authentication design

In the supported plugin flow, requests to Studio's `/rest/**` include
`Authorization: Token <openl_pat_…>` only when the plugin's `studio_token` setting provides
an explicit Personal Access Token (injected as `OPENL_PERSONAL_ACCESS_TOKEN`). Anonymous
single-user requests omit the `Authorization` header entirely; a blank token setting is treated
as absent rather than as an empty credential. The supported plugin modes are:

1. **Explicit token** — the `studio_token` setting for multi-user Studio.
2. **Anonymous** — no token for single-user Studio, where no sign-in exists.

`openl-mcp@1.1.0` retains a legacy fallback to a PAT cached by a past direct CLI
sign-in when no explicit token is set. The plugin never creates or manages that
cache, so this is not a supported plugin authentication mode. Until the bundled pin
moves to a server version without that fallback, complete sign-out means revoking in
Studio both the configured PAT and any older PATs created for Claude or OpenL MCP.

The user creates the PAT in Studio's own UI (**User → Personal Access Tokens**), where they have
already authenticated through whatever sign-in their organization uses, and pastes it into the
masked setting. The `/openl:connect` skill is pure guidance: it probes
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
  the user's Studio token list. Revoking every applicable PAT in Studio is the
  supported sign-out operation; no CLI operation is involved.

## Alternatives considered

- **Browser sign-in from Claude Code** (`openl-mcp login`, OAuth 2.0 Authorization Code + PKCE
  with an RFC 8252 loopback redirect, minting a PAT via `POST /rest/users/personal-access-tokens`)
  — **removed.** It required an IdP-side public client with a `http://127.0.0.1/*` redirect, only
  worked when the browser and Claude Code ran on the same machine, and could not work at all in
  remote CLI/VM sessions when the user's browser is on another machine. PAT entry
  covers every local-client deployment with far less setup, so the flow and its `userConfig` options
  (`oauth_issuer`, `oauth_client_id`) were dropped from the plugin. Direct CLI authentication
  features of the underlying package are outside the plugin's supported authentication flow.
- **Remote streamable-HTTP MCP** with full MCP OAuth (Studio fronted by an OAuth 2.1
  authorization server, or the MCP server acting as its own AS) — this is the path
  for **claude.ai/web**, implemented separately in the `openl-studio-mcp` server's
  embedded-OAuth mode, not in this plugin. Desktop Cowork uses the local stdio
  server from `claude_desktop_config.json`.

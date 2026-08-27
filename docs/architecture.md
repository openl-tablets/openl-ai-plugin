# Architecture — `openl` plugin

How the plugin is put together and why: naming, the packaging model, Claude Code, Codex and
Cursor integration notes, and the authentication design. This document is for developers of the plugin. For
versioning/release/distribution see [release.md](release.md); for operational setup
(versions, IdP configuration, rollout) see [admin-setup.md](admin-setup.md).

## Naming

| Thing | Value | Where it shows up |
|---|---|---|
| Repository & marketplace | `openl-ai-plugin` | `/plugin marketplace add openl-tablets/openl-ai-plugin` |
| Plugin (`plugin.json` → `name`) | `openl` | `/openl:<skill>`, `/plugin install openl@openl-ai-plugin` |
| Claude Code MCP server key (top-level key in `.mcp.json`) | `tools` | `mcp__plugin_openl_tools__<tool>` |
| Codex MCP server key (`.mcp.codex.json`) | `openl-ai` | Codex MCP configuration and approvals |
| Cursor MCP server key (`.mcp.cursor.json`) | `tools` | Cursor registers it as `plugin-openl-tools` |
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
├── .cursor-plugin/
│   ├── plugin.json          # Cursor manifest: variables, MCP descriptor path
│   └── marketplace.json     # Cursor's own copy of the marketplace entry
├── .mcp.json                # Claude Code MCP server (kept as a separate root file — see below)
├── .mcp.codex.json          # Codex MCP server (openl-ai) → bundled launcher
├── .mcp.cursor.json         # Cursor MCP server (tools) → npx + Cursor plugin variables
├── scripts/                 # Codex-only Node helpers (Claude Code needs none of these)
│   ├── start-openl-mcp-codex.mjs   # launcher: reads saved config, spawns openl-mcp
│   ├── configure-codex.mjs         # interactive, no-echo PAT/address setup
│   └── codex-config.mjs            # shared config read/write + Studio probe helpers
├── skills/
│   ├── branching/SKILL.md   # /openl:branching → isolated branches, sync, hotfix workflow
│   ├── connect/SKILL.md     # /openl:connect → guided Personal Access Token setup
│   ├── testing/SKILL.md     # /openl:testing → pre-test sequence, per-row results
│   ├── trace-investigation/SKILL.md  # /openl:trace-investigation → root-cause a rule result
│   └── versioning/SKILL.md  # /openl:versioning → new table versions without touching old ones
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

- **Claude Code plugin:** pin an exact version (`@1.2.0`) in `.mcp.json` for
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
  gives every start a fresh `OPENL_CONFIG_DIR`. The pinned `openl-mcp@1.2.0` keeps no
  CLI token cache and no longer reads that variable; the isolation stays as a guard for
  an older or user-managed server, where a stale cache could otherwise override the
  configured Codex identity. On handled termination signals,
  the launcher stops the full POSIX process group or Windows process tree before
  removing the isolated directory.
- **Cursor plugin:** Cursor substitutes no `${user_config.*}` values either, but it has
  its own per-user plugin **variables**: names declared in `.cursor-plugin/plugin.json`
  under `variables` (a restricted JSON Schema), values entered by the user, and
  `${NAME}` / `${NAME:-default}` placeholders expanded in the MCP descriptor. So Cursor
  needs no launcher and no configurator — `.mcp.cursor.json` runs the same pinned
  `npx -y -p openl-mcp@X.Y.Z openl-mcp` directly, with
  `OPENL_BASE_URL=${OPENL_STUDIO_URL}` and
  `OPENL_PERSONAL_ACCESS_TOKEN=${OPENL_STUDIO_TOKEN:-}`. The `:-` default is load-bearing:
  an unconfigured variable **without** a default survives substitution as the literal
  `${…}` string, so a single-user Studio user who left the token blank would send
  `Authorization: Token ${OPENL_STUDIO_TOKEN}` and get 401; the empty-string default is
  what `openl-mcp` >= 1.1.0 already treats as "no token". The pin is carried a third
  time here and kept equal to the other two by `tests/plugin-manifests.test.mjs`.
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

## Cursor integration notes

Cursor takes the same repository through its own manifest. Two things about this section
matter for future edits: what was **observed on a live install**, and what was **read out
of Cursor's plugin loader** (`Cursor.app/Contents/Resources/app/extensions/cursor-agent-exec/dist/main.js`,
Cursor 3.17.21). They are marked separately, because only the first kind is evidence.

**Observed on a live install (Cursor 3.17.21, macOS, 2026-08-27):**

- The repository installs as a Cursor plugin through a **team marketplace** created from
  the GitHub repo. Cursor's backend indexes the repo (marketplace id
  `openl-tablets-openl-ai-plugin-<n>`, plugin `openl` at git path `.`) and the client
  caches the commit under `~/.cursor/plugins/cache/<marketplace-slug>/openl/<sha>/`.
  Cursor has **no user-added marketplaces**: a user cannot point Cursor at this repo the
  way `/plugin marketplace add` does in Claude Code.
- With only the Claude manifests present, Cursor read the bare-root `.mcp.json`,
  registered the server as `plugin-openl-tools`, started it — and it died immediately:
  `MCP error -32000: Connection closed`. Reproduced outside Cursor: `openl-mcp` exits
  with `Error: Invalid OpenL base URL: ${user_config.studio_base_url}`, because Cursor
  does not substitute `${user_config.*}`. That single failure was the whole gap; skills
  were unaffected.
- The **agent side** (`layout: unifiedAgent`, i.e. the Agent Window) loaded the plugin
  from that cache — `[pluginsSubsystem] Adding enabled plugin: openl` — and reported
  `CursorPluginsAgentSkillsService load completed` with a skill count. What the logs do
  **not** contain is the list of skill names, so "our five skills are available to the
  Cursor agent" is *not* established by them; the only trace of our files is one UI log
  line naming `…/openl/<sha>/skills/connect/SKILL.md`. Confirming the skills is a
  look at **Customize → Skills** (or asking a Cursor chat to run one) — see *Not verified
  yet* below. Nothing observed suggests `skills/` needs Cursor-specific work; it is
  simply unconfirmed.
- Two **admin settings** blocked delivery paths on that machine, and both are worth
  knowing before debugging anything else: importing a Claude-format marketplace was
  refused with `Third-party plugin imports are disabled by team admin settings`, and
  plugin loading reported `userLocal=false` — *Allow Local Plugin Imports* is off, so
  `~/.cursor/plugins/local` (Cursor's documented local-development path) was unavailable.
- The Cursor **CLI** is a separate surface: the `cursor-agent` build on that machine
  (`2026.01.23`) has no plugin commands at all. Nothing here is verified for the CLI.

**Read out of the loader (mechanics this repo relies on, not independently re-verified
after the change):**

- Manifest precedence is `.cursor-plugin/plugin.json` → `.claude-plugin/plugin.json` →
  root `plugin.json`. Adding the Cursor manifest therefore takes over from the Claude
  one in Cursor while changing nothing for Claude Code. Marketplace manifests resolve the
  same way: `.cursor-plugin/marketplace.json` before `.claude-plugin/marketplace.json`,
  which is why both exist here and a test keeps them equivalent.
- MCP descriptors are discovered as `[".mcp.json", "mcp.json"]`, first file wins per
  server key — so `mcp.json` alone could not have replaced Claude Code's descriptor. A
  manifest `mcpServers` field **overrides** discovery, which is what makes
  `.mcp.cursor.json` work while `.mcp.json` stays exactly as Claude Code needs it. Keep
  the server key equal (`tools`) so the override replaces rather than adds.
- The descriptor's bare-root form (server key at top level, no `mcpServers` wrapper) is
  accepted as a fallback, consistent with what `.mcp.json` did.
- Placeholders expand in `command`, `args`, `env` values and `cwd`, as `${NAME}` or
  `${NAME:-default}`. The lookup order is **process environment → the user's configured
  variables → the `:-` default → left in place verbatim**. Two consequences the descriptor
  depends on: the optional token needs `:-` (see the packaging-model note above), and the
  variable names are deliberately plugin-scoped (`OPENL_STUDIO_URL`, `OPENL_STUDIO_TOKEN`)
  rather than the names the server itself reads — an `OPENL_BASE_URL` exported in a
  developer's shell would otherwise silently outrank what they typed into Cursor.
- `${CURSOR_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_ROOT}` are substituted with the plugin
  install path, so a bundled launcher would be possible here too. It is not used: plain
  `npx` is the one spawn path already observed working in Cursor, and Cursor's variables
  remove the reason the Codex launcher exists.
- A variable is masked when its name contains a word like `TOKEN`, `SECRET`, `KEY`, or
  `PASSWORD`. `OPENL_STUDIO_TOKEN` is named for that heuristic; renaming it would
  unmask it.
- The Cursor manifest format also carries `rules/`, `agents/`, `commands/`, and
  `hooks/hooks.json`, discovered from those directories. This plugin ships none of them —
  it is skills plus one MCP server — so "the same tools, skills and agents as Claude
  Code" is satisfied by the shared `skills/` directory today. If agents are ever added,
  Cursor can carry them without a new mechanism; a manifest field for a component
  *replaces* its default directory scan, so keep those fields unset.

**Not verified yet.** Two things, both needing eyes on a Cursor window:

1. An end-to-end install of *this* commit — variables prompt at install, server
   connected, tools answering — which needs the marketplace re-indexed by an
   administrator (verifying locally instead requires an admin to allow local plugin
   imports).
2. That the five `skills/` entries appear to the Cursor agent under **Customize →
   Skills** and can be invoked. The plugin's skill loading was observed; the per-skill
   result was not.

## Skills: one directory, every client

`skills/` is the single source for every client — no per-client copy, and nothing to
register per skill:

- **Claude Code** discovers `skills/*/SKILL.md` automatically; `plugin.json` carries no
  `skills` field. The directory name is the invocation name inside the plugin
  namespace: `skills/trace-investigation/` → `/openl:trace-investigation`. Keep the
  frontmatter `name` equal to the directory name.
- **Codex** reads the directory from its own manifest (`.codex-plugin/plugin.json` →
  `"skills": "./skills/"`), so a new sub-directory ships with no manifest change.
- **Cursor** discovers `skills/*/SKILL.md` the same way Claude Code does, so its
  manifest carries no `skills` field either — setting one would *replace* discovery
  rather than add to it.
- **Claude desktop Chat/Cowork** loads the same plugin skills; only the plugin's
  settings dialog is missing there (see [cowork-setup.md](cowork-setup.md)).

Consequences for skill content:

- **Never assume a client.** `connect` branches per client explicitly, because setup
  differs (`/plugin configure` vs the Codex configurator vs Cursor's **Configure**
  dialog vs `claude_desktop_config.json`).
- **Never assume a tool surface.** A skill ships with the plugin, but the tools come
  from whatever `openl-mcp` version is configured — the pin in `.mcp.json` for Claude
  Code, in `scripts/start-openl-mcp-codex.mjs` for Codex and in `.mcp.cursor.json` for
  Cursor, or a user-managed version in the desktop/Cowork config. `trace-investigation` therefore checks which trace
  tools exist and follows one of two paths: the interactive debugger of the pinned
  `openl-mcp@1.2.0` (`openl_step_trace`, `openl_watch_trace_cells`,
  `openl_inspect_trace_frame`, …), or the tree-trace tools of `openl-mcp@1.1.0`
  (`openl_start_trace` → `openl_get_trace_nodes` → `openl_get_trace_node_details`),
  which `1.2.0` removed. The debugger is the primary path now; the tree path stays
  only for a desktop/Cowork config still held on `1.1.0`, and can be dropped once no
  supported configuration can land there.

## Authentication design

In the supported plugin flow, requests to Studio's `/rest/**` include
`Authorization: Token <openl_pat_…>` only when the plugin's `studio_token` setting provides
an explicit Personal Access Token (injected as `OPENL_PERSONAL_ACCESS_TOKEN`). Anonymous
single-user requests omit the `Authorization` header entirely; a blank token setting is treated
as absent rather than as an empty credential. The supported plugin modes are:

1. **Explicit token** — the `studio_token` setting for multi-user Studio.
2. **Anonymous** — no token for single-user Studio, where no sign-in exists.

`openl-mcp@1.2.0` dropped the legacy fallback to a PAT cached by a past direct CLI
sign-in, so the bundled pin now takes only the two modes above. `1.1.0` still had that
fallback, and the plugin never created or managed the cache in either case. On a
machine that used direct CLI sign-in in the past — or whose desktop/Cowork config is
still on `1.1.0` — complete sign-out therefore means revoking in Studio both the
configured PAT and any older PATs created for Claude or OpenL MCP.

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
  is instructed never to read it or echo a pasted token. Cursor masks its
  `OPENL_STUDIO_TOKEN` variable on the same basis (its name contains `TOKEN`).
- **Where the PAT rests differs per client, and Cursor is the exception.** Claude Code
  keeps it in the OS keychain or a protected credentials file; Codex in an owner-only
  file outside the plugin cache; the desktop/Cowork config in plaintext in the user's own
  config file. All of those stay on the user's machine. Cursor keeps a marketplace
  plugin's configured variables in the **user's Cursor account** and supplies them when it
  starts the local server, so choosing the Cursor path accepts that the PAT leaves the
  machine. What does not change: the PAT is created in Studio, scoped to one user, named,
  and individually revocable there, and revocation in Studio is what cuts access.
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

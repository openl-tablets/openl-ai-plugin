# Architecture — OpenL Plugin

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
├── .mcp.json                # Claude Code MCP server → launcher (kept as a separate root file — see below)
├── .mcp.codex.json          # Codex MCP server (openl-ai) → Codex launcher
├── .mcp.cursor.json         # Cursor MCP server (tools) → launcher + Cursor plugin variables
├── scripts/                 # Node helpers, no npm dependencies
│   ├── start-openl-mcp.mjs         # launcher (Claude Code, Cursor): Studio 7.0+ → bridge, else openl-mcp
│   ├── mcp-http-bridge.mjs         # stdio ↔ Streamable HTTP bridge to <studio>/mcp
│   ├── studio-compatibility.mjs    # openl-mcp pin, Studio compatibility table + check
│   │                               # (Claude Code SessionStart hook, Codex configurator)
│   ├── start-openl-mcp-codex.mjs   # Codex launcher: reads saved config, then as above
│   ├── configure-codex.mjs         # Codex: interactive, no-echo PAT/address setup
│   └── codex-config.mjs            # Codex config read/write + Studio probe helpers
├── skills/
│   ├── branching/SKILL.md   # /openl:branching → isolated branches, sync, hotfix workflow
│   ├── change-log-and-reapply/SKILL.md  # /openl:change-log-and-reapply → log changes, reapply the missing ones
│   ├── connect/SKILL.md     # /openl:connect → guided Personal Access Token setup
│   ├── planning/SKILL.md    # /openl:planning → one plan, one approval, tracked execution
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

## Packaging model: a launcher, then Studio's own server or `npx` from npm

The plugin is a **packaging layer, not a fork**. Every client starts a small Node launcher
of the plugin as its **stdio** MCP server, and the launcher serves the Studio one of two
ways (see [Studio 7.0's built-in MCP server](#studio-70s-built-in-mcp-server)):

- **OpenL Studio 7.0 and later** serve their own MCP server at `<studio>/mcp`, built from
  the `openl-mcp` sources and released with Studio; the launcher bridges stdio to it
  over HTTP.
- **Older Studio releases** get the published
  [`openl-mcp`](https://www.npmjs.com/package/openl-mcp) npm package (source:
  [`openl-tablets/openl-mcp`](https://github.com/openl-tablets/openl-mcp)), which the
  launcher runs via `npx -y -p openl-mcp@X.Y.Z openl-mcp` with its own stdio.

The `openl-mcp` release is pinned exactly once, `OPENL_MCP_VERSION` in
`scripts/studio-compatibility.mjs`, for reproducibility. Bumping the pin is a plugin
release (see [release.md](release.md)).

- **Claude Code plugin:** `.mcp.json` runs `node ${CLAUDE_PLUGIN_ROOT}/scripts/start-openl-mcp.mjs`
  with `OPENL_BASE_URL` and `OPENL_PERSONAL_ACCESS_TOKEN` from the plugin's settings —
  the environment `openl-mcp` reads, which the launcher hands on unchanged.
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
  `npx -y -p openl-mcp@X.Y.Z openl-mcp` in an isolated config dir, or, for Studio 7.0
  and later, bridges to Studio's own server with the configured PAT. It shares the
  server choice, the pin and the process handling with `scripts/start-openl-mcp.mjs`.
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
  needs no configurator — `.mcp.cursor.json` runs the same launcher as Claude Code,
  `node ${CURSOR_PLUGIN_ROOT}/scripts/start-openl-mcp.mjs`, with
  `OPENL_BASE_URL=${OPENL_STUDIO_URL}` and
  `OPENL_PERSONAL_ACCESS_TOKEN=${OPENL_STUDIO_TOKEN:-}`. The `:-` default is load-bearing:
  an unconfigured variable **without** a default survives substitution as the literal
  `${…}` string, so a single-user Studio user who left the token blank would send
  `Authorization: Token ${OPENL_STUDIO_TOKEN}` and get 401; the empty-string default is
  what `openl-mcp` >= 1.1.0 and the bridge both treat as "no token".
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

Cursor takes the same repository through its own native manifest. Keep three evidence
levels separate when changing this integration: Cursor's documented public contract,
observations from the running application, and implementation details read from one
specific app build.

**Documented public contract:**

- [Cursor's plugin reference](https://cursor.com/docs/reference/plugins) defines
  `.cursor-plugin/plugin.json` as the native manifest. Its `mcpServers` field may point
  at an MCP descriptor, and `variables` declares values collected by Cursor instead of
  requiring a user to edit JSON.
- Without a plugin, [Cursor's MCP documentation](https://cursor.com/docs/mcp) uses
  project-local `.cursor/mcp.json` and user-global `~/.cursor/mcp.json`, both using an
  `mcpServers` wrapper. This plugin intentionally does not write either file: the native
  manifest plus **Configure** dialog is the no-manual-JSON delivery path required by
  this task.
- Cursor documents native [skills](https://cursor.com/docs/skills) and
  [subagents](https://cursor.com/docs/subagents), and discovers their plugin files from
  `skills/*/SKILL.md` and `agents/*.md`. This repository currently ships seven shared
  skills and **no agents** for either Claude Code or Cursor,
  so agent parity is zero-to-zero. If agents are added later, smoke-test their
  frontmatter and behaviour in both clients instead of assuming every Claude-specific
  field maps unchanged.
- Current [Cursor CLI commands](https://cursor.com/docs/cli/reference/slash-commands)
  include plugins, MCP and skills, including `/plugin`. Older CLI builds may not expose
  that surface.

**Observed on live installs (macOS):**

- On Cursor 3.17.21 (2026-08-27), the repository installed through a **team
  marketplace** created from the GitHub repository. Cursor cached the indexed commit
  under `~/.cursor/plugins/cache/<marketplace-slug>/openl/<sha>/`.
- Re-checked on Cursor 3.19.7 (2026-09-04), the installed public-branch plugin was still
  `openl` 0.5.0, which only had the Claude descriptor. Cursor registered
  `plugin-openl-tools`, passed `${user_config.studio_base_url}` literally and failed
  with `MCP error -32000: Connection closed` / `Invalid OpenL base URL`. This reproduces
  the ticket's original failure independently of the proposed fix.
- The same Cursor 3.19.7 UI listed all five shared skills by name under the installed
  plugin: `branching`, `connect`, `testing`, `trace-investigation`, and `versioning`.
  A Cursor-specific rules file such as `.cursorrules` is therefore not needed for these
  skills.
- **Customize → Plugins → + Add** offered **From Marketplace** and **From GitHub
  Repository**. Direct repository import remains subject to organization policy; a
  team marketplace is still the controlled route for an internal rollout.
- Local loading reported `userLocal=false`, so `~/.cursor/plugins/local` could not be
  used on this account without an administrator enabling **Allow Local Plugin
  Imports**. The installed `cursor-agent` build (`2026.01.23`) also had no plugin
  commands; treat that as a legacy-build warning, not the current Cursor CLI contract.

**Read from the Cursor 3.19.7 loader (implementation details this descriptor relies
on, not a stable public API):**

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
  install path, which is how `.mcp.cursor.json` addresses the launcher. Until 0.8.0 the
  descriptor ran plain `npx`, the one spawn path observed working in Cursor; the
  launcher became necessary to choose between Studio's own MCP server and `openl-mcp`,
  and **has not been run in a live Cursor yet** — the release smoke test below covers
  it.
- A variable is masked when its name contains a word like `TOKEN`, `SECRET`, `KEY`, or
  `PASSWORD`. `OPENL_STUDIO_TOKEN` is named for that heuristic; renaming it would
  unmask it.
- User-scoped installs and updates submit their configured `variables` as part of the
  plugin installation. This plugin does not mirror them into `.cursor/mcp.json` or
  `~/.cursor/mcp.json`.

**Verification status and delivery decision:**

- `tests/cursor-clean-project.test.mjs` is a regression model of the observed loader
  precedence and substitution rules. It proves that the packaged files resolve to the
  expected command, an existing launcher in the installed copy, the environment and the
  skill directories in an otherwise empty project; it is **not** a Cursor executable or
  GUI end-to-end test.
- No installer-script extension is needed: Cursor's native manifest installs the MCP
  descriptor and shared skills, while **Configure** supplies the two per-user values.
  The separate Codex configurator remains Codex-only.
- Version 0.6.0 from this branch has not yet been installed in Cursor. The feature branch
  is not published or indexed, while local imports are disabled on the available
  account. Before release, expose this commit through a disposable/team marketplace or
  enable local imports, then verify a clean user-scoped install, the two **Configure**
  fields, a connected `tools` server, a real `List projects` call, one skill invocation,
  and an update from the previous version without creating project JSON.
- **Proceed now; do not pause for priority clarification.** Cursor has the required
  native plugin, MCP, skills and agent primitives, and EPBDS-16497 is already the active
  follow-up. The remaining gate is the live 0.6.0 smoke test above, not an unresolved
  product-priority decision.

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
  from whatever MCP server serves the Studio — the one built into Studio 7.0 and later,
  the `openl-mcp` pinned in `scripts/studio-compatibility.mjs` for older releases, or a
  user-managed version in the desktop/Cowork config. `trace-investigation` therefore checks which trace
  tools exist and follows one of two paths: the interactive debugger of the pinned
  `openl-mcp@1.2.0` (`openl_step_trace`, `openl_watch_trace_cells`,
  `openl_inspect_trace_frame`, …), or the tree-trace tools of `openl-mcp@1.1.0`
  (`openl_start_trace` → `openl_get_trace_nodes` → `openl_get_trace_node_details`),
  which `1.2.0` removed. The debugger is the primary path now; the tree path stays
  only for a desktop/Cowork config still held on `1.1.0`, and can be dropped once no
  supported configuration can land there.

## Studio 7.0's built-in MCP server

OpenL Studio 7.0 runs the `openl-mcp` sources inside Studio (EPBDS-16810): Studio starts
the server with Node.js on the Studio host and serves it at `<studio>/mcp` over
Streamable HTTP, released and versioned with Studio. It authenticates the way Studio's
REST API does — `Authorization: Token <PAT>`, or nothing on a single-user Studio — and
exists only when Node.js is installed on the Studio host (the Docker image and the Demo
package include it; a Jetty WAR deployment needs it; Tomcat has no endpoint) and
`mcp.enabled` is not `false`.

The plugin still has to serve Studio 6.4, which has no such server, so it cannot point
the clients' descriptors at `/mcp` directly: a descriptor is static, and the transport
has to follow the Studio. Every client therefore starts a launcher as a stdio server:

- **The choice.** `scripts/start-openl-mcp.mjs` (`start-openl-mcp-codex.mjs` for Codex,
  after reading its config) reads Studio's version as the compatibility check does,
  within five seconds. Studio 7.0 or later → the bridge to `<studio>/mcp`; an older
  release → `npx -y -p openl-mcp@X.Y.Z openl-mcp` with the same environment and stdio;
  a version that cannot be read → `openl-mcp` too, which reports the connection problem
  as it always has. The choice is logged on stderr, which clients keep in their MCP
  logs. It is made once per start: a Studio upgraded under a running session is picked
  up when the client restarts the server.
- **The bridge** (`scripts/mcp-http-bridge.mjs`) is the plugin's own, with no
  dependencies, rather than `mcp-remote`: the PAT stays inside the process
  (never in arguments), nothing third-party is fetched at start, and its behaviour is
  pinned by tests. It forwards each stdin line as a POST with
  `Accept: application/json, text/event-stream` and writes back the JSON body or every
  event of an SSE response. Studio serves both protocol eras, and clients pick: Claude
  Code 2.1.312 tries `server/discover` (2026-07-28) first and falls back to
  `initialize`. A 2026-07-28 request is stateless and must repeat its envelope's
  protocol version, its method and — for `tools/call`, `prompts/get`, `resources/read`
  and `tasks/*` — its name as `MCP-Protocol-Version`, `Mcp-Method` and `Mcp-Name`
  headers (Base64-wrapped when not plain ASCII), or Studio's MCP SDK answers 400; a
  stdio client sends no headers, so the bridge derives them from the message as the
  SDK's own HTTP client does. For a 2025 client it keeps `Mcp-Session-Id` and
  `MCP-Protocol-Version` from `initialize`, and sends `DELETE` when stdin closes or a
  termination signal arrives.
  Studio drops a 2025-protocol session left unused for 30 minutes and then answers 404;
  the bridge replays the client's own `initialize` (under its own id, answer not
  forwarded), sends `notifications/initialized`, and retries the request once, so an
  idle agent session survives. HTTP failures become JSON-RPC errors for the request
  that caused them, worded for the user: 401 points to the PAT, a missing endpoint on
  `initialize` to the Studio host's Node.js. It opens no standalone GET stream, so
  server notifications outside a request (such as `tools/list_changed`) are not
  forwarded, and like `undici` it gives up on a response with no data for five minutes.
- **Chat/Cowork** runs no plugin code; `openl:connect` and
  [cowork-setup.md](cowork-setup.md#the-entry-for-openl-studio-70-and-later) give the
  `mcp-remote` entry that Studio's own guide documents, with the PAT read from the
  entry's `env` rather than written into its arguments.

## Studio version compatibility check

Each `openl-mcp` release line supports particular OpenL Studio release lines (1.2 →
Studio 6.4). Connected to another Studio, the server still starts and most tools answer,
but tools whose Studio endpoints changed time out or fail — `openl-mcp` 1.2 against
Studio 7.0 timed out on the agent-context and file-search tools. Nothing in the server
reports that, so the plugin checks it. Since Studio 7.0 serves its own server, which the
launcher uses, the check matters for releases older than 7.0.

- **One table, three copies.** `STUDIO_COMPATIBILITY` in
  `scripts/studio-compatibility.mjs` is what the code uses; the README publishes it as
  **Compatible OpenL Studio versions**, and `skills/connect/SKILL.md` carries it for
  clients where the agent does the check. Both add a row for the server built into
  Studio 7.0 and later (`BUILT_IN_MCP_SINCE`). `tests/studio-compatibility.test.mjs`
  keeps the three equal and requires the pinned server to be the last numbered row,
  which is how the skill knows the plugin's server before a connection answers.
- **Reading Studio's version without a token.** `/public/info/openl.json` returns
  `openl.version`. Studio 7.0+ serves it anonymously as `/rest/public/…`; Studio 6.x
  only as `/web/public/…` (on a multi-user 6.x, `/rest/public/…` needs a sign-in), so the
  check tries `/rest` first and falls back to `/web`. A path a Studio does not serve may
  come back as an HTML page or a sign-in redirect rather than a 404, so only an HTTP 200
  JSON response with a parseable `openl.version` counts. The check never sends the PAT,
  follows no redirects, caps the body at 64 KiB, and compares major.minor only.
- **Claude Code: a SessionStart hook** declared inline in `.claude-plugin/plugin.json`,
  not in `hooks/hooks.json`. Cursor and Codex read their own manifests, so they never
  see the inline block, whereas a default `hooks/hooks.json` could be found by their own
  hook discovery and read under a different hook contract. The hook reads the address from
  `CLAUDE_PLUGIN_OPTION_STUDIO_BASE_URL`, which Claude Code exports to plugin hooks,
  rather than substituting `${user_config.studio_base_url}` into a shell command. It is
  synchronous, because only a synchronous hook's `systemMessage` is shown to the user;
  its three-second budget bounds the delay when Studio is unreachable, and it stays
  silent unless the versions are known to differ — a Studio with its own server never
  warns. On a mismatch it shows the warning and adds it to Claude's context, so later
  tool timeouts are attributed to the mismatch.
- **Codex:** the configurator runs the same check after its `/rest/settings` probe and
  prints the result; a mismatch is a warning, not a refusal. The launcher logs its
  choice, but its stderr reaches only Codex's logs.
- **Cursor and Chat/Cowork:** no plugin code runs at session start there, so
  `openl:connect` does the check, using the server's own `openl_get_version` tool for
  the version actually running (a Cowork config may be unpinned).

## Authentication design

In the supported plugin flow, requests to Studio's `/rest/**` — or, for Studio 7.0 and
later, to its built-in MCP server at `/mcp` — include `Authorization: Token <openl_pat_…>`
only when the plugin's `studio_token` setting provides an explicit Personal Access Token
(injected as `OPENL_PERSONAL_ACCESS_TOKEN`). Anonymous
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
  config file. All of those stay on the user's machine. The current Cursor implementation
  submits user-scoped plugin variables as part of the user's plugin configuration and
  supplies them when it starts the local server, so choosing the Cursor path is not a
  local-only settings-file flow. What does not change: the PAT is created in Studio,
  scoped to one user, named, and individually revocable there, and revocation in Studio
  is what cuts access.
- **Transport enforcement differs per client, and only Codex enforces anything.** The
  Codex configurator refuses a PAT over non-loopback HTTP until the user opts in with
  `--allow-insecure`, because it is the component that writes the configuration and can
  refuse. Claude Code and Cursor take the address from the client's own settings dialog
  and hand it straight to the server, so on those paths the plugin only warns and never
  blocks — the `connect` skill says so explicitly for both. This is a known and accepted
  gap, not an oversight: enforcing it on the Cursor path would mean introducing the
  Cursor launcher this integration deliberately avoids (or a check inside `openl-mcp`),
  and applying it to Claude Code would change a policy that predates Cursor support.
  Revisit it as its own change across all clients rather than per client.
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

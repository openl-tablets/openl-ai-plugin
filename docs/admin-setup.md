# Administrator Setup — `openl` Plugin

This guide is for OpenL Studio administrators and IT staff who roll the plugin out to
analysts. It covers supported versions, organization-wide installation, how
authentication works for each Studio deployment type, and the security model. End
users only need the setup guide for their tool —
[claude-code-setup.md](claude-code-setup.md), [cowork-setup.md](cowork-setup.md), or
[codex-setup.md](codex-setup.md), all linked from the [README](../README.md); when
they hit problems, point them to [troubleshooting.md](troubleshooting.md).

Version 0.2.0 renames the installed plugin identity from `openl-ai` to `openl`.
Claude Code 2.1.193+ automatically migrates editable installations through the
marketplace rename map. Older and centrally managed installations need the
[migration procedure](migrate-to-0.2.md).

> **Scope.** The repository supports **Claude Code** (terminal / IDE) and **Codex**
> (desktop / CLI) with native manifests and a Personal Access Token (PAT). Codex uses
> its bundled configurator because it has no Claude-style `userConfig` substitution;
> see [codex-setup.md](codex-setup.md). The Claude **desktop app**
> (including Cowork sessions) does not support plugin settings, so the plugin cannot
> deliver the PAT there — on that surface the OpenL server is added through the
> desktop app's own config file instead: see [cowork-setup.md](cowork-setup.md)
> (analyst-facing) and [Rolling out to Claude desktop / Cowork users](#rolling-out-to-claude-desktop--cowork-users)
> below. A cloud **remote MCP connector** (the `openl-studio-mcp` server's
> embedded-OAuth mode) exists as well, but requires an MCP endpoint reachable from
> Anthropic's cloud — not an option for VPN-only deployments.

## Supported versions

| Component | Requirement | Why |
|---|---|---|
| **Claude Code** | **2.1.119 or later; 2.1.193+ recommended for a 0.1.x upgrade** | The plugin's settings dialog uses `manifest.userConfig`, introduced in Claude Code 2.1.83; 2.1.119 fixed optional blank settings, and 2.1.193 added automatic plugin rename migration. |
| **Codex** | A desktop/CLI build with `codex plugin marketplace` and `codex plugin add` (verified with `codex-cli 0.145.0-alpha.30` and `0.146.0-alpha.3.1`) | Codex installs the same marketplace but reads its own native `.codex-plugin` manifest and bundled launcher; older preview builds without `plugin add` are not supported. |
| **Node.js** | **24 or later, on every user's machine** | The plugin's backend is the [`openl-mcp`](https://www.npmjs.com/package/openl-mcp) npm package (`engines: node >= 24`), launched locally via `npx` for Claude Code, Codex, or Cowork. This applies **even when the organization pre-installs the plugin** — there is no server-side variant. First launch downloads the package from the npm registry (cached afterwards). |
| **OpenL Studio** | A deployment reachable from user machines | See [Studio address](#studio-address) below. |

The Claude Code plugin pins `openl-mcp@1.1.0`, the first version that treats a blank
token setting as absent instead of sending an empty credential. The separate desktop /
Cowork setup uses the current npm release by default; administrators can pin it for a
controlled rollout as described below.

## Installing for the organization

Users can always self-install with the two commands from
[claude-code-setup.md](claude-code-setup.md). For a managed
rollout you have three options:

1. **Pre-provision via settings** — add the marketplace and enable the plugin in a
   settings file you distribute (user, project, or managed settings):

   ```json
   {
     "extraKnownMarketplaces": {
       "openl-ai-plugin": {
         "source": { "source": "github", "repo": "openl-tablets/openl-ai-plugin" }
       }
     },
     "enabledPlugins": { "openl@openl-ai-plugin": true }
   }
   ```

   To lock down which marketplaces users may add, use `strictKnownMarketplaces` in
   managed settings.

2. **Scripted install** — the CLI works headlessly and can pre-fill the Studio address:

   ```bash
   claude plugin marketplace add openl-tablets/openl-ai-plugin
   claude plugin install openl@openl-ai-plugin \
     --config studio_base_url=https://studio.example.com
   ```

   Do not pre-fill `studio_token` this way on shared machines — it is a per-user
   secret each analyst adds themselves.

3. **Private marketplace / offline** — host a fork or a private marketplace repo
   internally; see [release.md](release.md#6-enterprise--private-distribution).

Pre-filling `studio_base_url` is what makes the analyst experience truly two-step:
install → `/openl:connect` (which guides them through adding their token).

### Migrating a managed 0.1.x deployment

Claude Code cannot edit managed or other read-only settings. When rolling out 0.2.0,
refresh the marketplace and replace `openl-ai@openl-ai-plugin` with
`openl@openl-ai-plugin` in `enabledPlugins` and in any `pluginConfigs` key you
manage. Preserve the existing configuration values. The marketplace rename map
keeps the plugin loadable while policy rolls out, but users see a recurring rename
notice until the managed keys are updated.

Editable user, project, and local settings migrate automatically on Claude Code
2.1.193+. See [migrate-to-0.2.md](migrate-to-0.2.md) for older clients and PAT
rotation precautions.

### Rolling out to Codex

Install from the same marketplace with:

```bash
codex plugin marketplace add openl-tablets/openl-ai-plugin
codex plugin add openl@openl-ai-plugin
```

Do not distribute a shared PAT. Each analyst runs the bundled
`scripts/configure-codex.mjs` from the installed plugin's `source.path` in a normal
terminal and enters their own token with echo disabled. The resulting config lives
outside the plugin cache: `~/.config/openl-ai/codex.json` by default on macOS/Linux
(`$XDG_CONFIG_HOME/openl-ai/codex.json` when set), or
`%APPDATA%\openl-ai\codex.json` on Windows. POSIX uses `0700/0600`;
Windows relies on the user profile ACLs. The PAT is plaintext in that file.

### Plugin settings reference

Settings are prompted at enable time and editable later with
`/plugin configure openl@openl-ai-plugin` (or pre-filled headlessly with
`claude plugin install … --config`, see above — both store values via the same path).
Each is injected into the MCP server process environment — the model itself never
receives them directly.

| Setting | Required | Injected as | Purpose |
|---|---|---|---|
| `studio_base_url` | yes | `OPENL_BASE_URL` | The OpenL Studio address, e.g. `https://studio.example.com`. |
| `studio_token` | no | `OPENL_PERSONAL_ACCESS_TOKEN` | The user's Personal Access Token (PAT), created in Studio. Required for multi-user Studio; left blank for single-user Studio. Marked `sensitive` — masked and stored in secure storage. |

## Studio address

- Use the exact URL analysts open in the browser (scheme + host + optional context
  path), e.g. `https://studio.example.com`. The plugin calls Studio's REST API under
  `<address>/rest/**`.
- Studio must be reachable **from each user's machine** (VPN or office network if
  Studio is internal). Calls use the exact `http://` or `https://` Studio address;
  there is no relay. Local copies may use HTTP. A PAT sent over HTTP is not encrypted
  in transit, so prefer HTTPS outside local development.

## How authentication works per deployment type

The plugin authenticates to Studio with a Personal Access Token (PAT) supplied in the
`studio_token` setting. Multi-user Studio requires an explicit PAT; single-user Studio
connects anonymously. There is no browser or CLI sign-in run from Claude Code.

| Studio user mode | What analysts should do | Your setup work |
|---|---|---|
| **Single-user** (`user.mode=single`) | Nothing — no sign-in exists. `/openl:connect` detects this and says so. | None. |
| **Multi-user** (`user.mode=multi`, Active Directory, OAuth2/OIDC, SAML — any IdP) | Sign in to Studio in the browser, create a PAT (**User → Personal Access Tokens**), and paste it into the plugin's token setting. | Tell users where to create tokens. No IdP changes are needed — the PAT works regardless of how Studio authenticates users. |

PAT issuance requires a multi-user Studio: `GET <address>/rest/settings` (public)
reports `supportedFeatures.personalAccessToken` and `userMode` (`null` for
single-user). The `/openl:connect` skill probes this endpoint to pick the right
guidance automatically.

## Access token (PAT)

Works with any multi-user Studio and any identity provider, with no IdP changes:

1. The user signs in to OpenL Studio in the browser (through whatever sign-in the
   organization uses — the PAT step is the same afterwards).
2. **User → Personal Access Tokens → create token** (name it e.g. "Claude Code").
3. The user pastes the token into the plugin's **Personal Access Token** setting
   (`/plugin configure openl@openl-ai-plugin`). The field is masked.

PATs are user-scoped, have an expiry date, and are individually revocable in Studio —
treat expiry/revocation as your lever for offboarding. When a PAT expires, tools start
failing with 401; the fix is a new token.

## Rolling out to Claude desktop / Cowork users

Analysts who work in the Claude **desktop app** (Cowork) can't use the plugin's
settings dialog. Instead, each user's `claude_desktop_config.json` gets an `openl`
entry under `mcpServers` — the analyst-facing walkthrough is
[cowork-setup.md](cowork-setup.md). What administrators should know:

- **Same requirements**: Node.js 24+ on the user's machine, Studio reachable from it
  (VPN), a user-created PAT. The server runs locally on the user's machine — exactly
  the same `openl-mcp` package the plugin uses; there is no extra infrastructure.
- **Pre-provisioning**: the file is plain JSON at
  `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) /
  `%APPDATA%\Claude\claude_desktop_config.json` (Windows). You can distribute the
  entry with the Studio address pre-filled via MDM/scripts, leaving only the token
  placeholder for the user. Merge into the existing `mcpServers` object — don't
  overwrite other entries.
- **Version policy**: the analyst guide uses
  `npx -y --prefer-online -p openl-mcp openl-mcp`, so the desktop app checks for a
  new server release when it starts. For a controlled rollout, distribute an exact
  package spec instead, for example
  `npx -y -p openl-mcp@1.1.0 openl-mcp`; pinned installations update only when you
  change that version in the managed config. The Claude Code plugin remains pinned
  independently in its bundled `.mcp.json`.
- **Token storage caveat**: in this file the PAT is stored **in plain text** (there is
  no masked field, unlike the Claude Code plugin). The file lives in the user's
  profile with their ACLs. Set expectations accordingly: short-ish token TTLs and
  revocation in Studio (**User → Personal Access Tokens**) are the controls.
- **Works only in the desktop app** (local sessions). Claude in the browser and
  mobile cannot run local servers.
- **The plugin itself is still useful there — for its skills.** Users install it via
  **Customize → Plugins** (add `openl-tablets/openl-ai-plugin` as a marketplace);
  its skills (e.g. `/openl:connect`) load in Chat/Cowork sessions, while the
  plugin's own settings dialog does not exist there — the connection stays with the
  `claude_desktop_config.json` entry.
- **Logs** for support cases: `~/Library/Logs/Claude/mcp-server-openl.log` (macOS) /
  `%APPDATA%\Claude\logs\mcp-server-openl.log` (Windows).

## Security requirements and properties

- **Secrets stay out of the model's context.** The token setting is `sensitive`:
  masked in the UI, injected only into the MCP server's environment. Instruct users to
  never paste tokens into the chat itself.
- **Storage.** The sensitive token is stored in the OS keychain on macOS, or in a
  protected credentials file (`~/.claude/.credentials.json`) on platforms without a
  keychain. Non-sensitive settings live in the user's Claude Code `settings.json`
  under `pluginConfigs`. Codex instead stores the PAT as plaintext in its
  platform-specific `openl-ai/codex.json` with the filesystem protections described
  above. Cowork stores it as plaintext in `claude_desktop_config.json`.
- **Authentication modes.** Multi-user Studio uses the explicit PAT setting;
  single-user Studio connects anonymously. A blank/whitespace token is treated as
  absent from `openl-mcp@1.1.0` onward, so the plugin does not send an empty
  credential. Compatibility note: `openl-mcp@1.1.0` can still fall back to a PAT
  cached by an older direct CLI sign-in when the explicit setting is absent. The
  plugin never creates or manages that cache, and it is not a supported plugin
  authentication mode.
- **Revocation.** The credential is a normal Studio PAT, visible in the user's token
  list in Studio — named, time-limited, revocable. Deleting it there is the sign-out
  operation and invalidates it everywhere. For machines that used direct CLI sign-in
  in the past, revoke any additional PATs created for Claude or OpenL MCP as well.
  Remove the obsolete value from the client configuration afterwards. No CLI
  operation is part of this flow.
- **Network.** All calls are direct from the user's machine to Studio using the
  configured HTTP or HTTPS scheme. HTTP does not encrypt a PAT in transit. `npx`
  also contacts the npm registry on the first Claude Code plugin launch and whenever
  the default desktop/Cowork configuration checks for an updated package.

## What to tell your analysts

A rollout note can be as short as:

> Claude Code can now work with OpenL Studio. In Claude Code, run
> `/openl:connect`; Claude will help you create a Personal Access Token in Studio
> and add it to the plugin. Then start a new Claude session and ask: "List the OpenL
> projects I can access."
> If anything fails, see the plugin's troubleshooting page, or send me the error text
> (never send your access token).

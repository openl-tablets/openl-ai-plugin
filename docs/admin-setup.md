# Administrator Setup — `openl-ai` Claude Code Plugin

This guide is for OpenL Studio administrators and IT staff who roll the plugin out to
analysts. It covers supported versions, organization-wide installation, how sign-in
works for each Studio deployment type, and the security model. End users only need the
[README](../README.md); when they hit problems, point them to
[troubleshooting.md](troubleshooting.md).

## Supported versions

| Component | Requirement | Why |
|---|---|---|
| **Claude Code** | **2.1.119 or later** | The plugin's settings dialog uses `manifest.userConfig`, introduced in Claude Code 2.1.83; 2.1.119 additionally fixed plugin MCP servers failing when an optional setting referenced via `${user_config.*}` is left blank — and this plugin has three optional settings that are typically blank. (Source: the official [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md), entries 2.1.83 and 2.1.119; verified 2026-07-13.) |
| **Node.js** | **24 or later, on every user's machine** | The plugin's backend is the [`openl-mcp`](https://www.npmjs.com/package/openl-mcp) npm package (`engines: node >= 24`), launched locally via `npx` on the machine where Claude Code runs. This applies **even when the organization pre-installs the plugin** — there is no server-side variant. First launch downloads the package from the npm registry (cached afterwards). |
| **OpenL Studio** | A deployment reachable from user machines | See [Studio address](#studio-address) below. |

The plugin pins `openl-mcp@1.1.0` — the first release with browser sign-in (`login` /
`logout`) and the first that treats a blank token setting as absent instead of sending
an empty credential.

## Installing for the organization

Users can always self-install with the two commands from the README. For a managed
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
     "enabledPlugins": { "openl-ai@openl-ai-plugin": true }
   }
   ```

   To lock down which marketplaces users may add, use `strictKnownMarketplaces` in
   managed settings.

2. **Scripted install** — the CLI works headlessly and can pre-fill settings:

   ```bash
   claude plugin marketplace add openl-tablets/openl-ai-plugin
   claude plugin install openl-ai@openl-ai-plugin \
     --config studio_base_url=https://studio.example.com \
     --config oauth_issuer=https://idp.example.com/realms/openlstudio
   ```

3. **Private marketplace / offline** — host a fork or a private marketplace repo
   internally; see [release.md](release.md#6-enterprise--private-distribution).

Pre-filling `studio_base_url` (and `oauth_issuer`, where browser sign-in is used) is
what makes the analyst experience truly two-step: install → `/openl-ai:connect`.

### Plugin settings reference

Settings are prompted at enable time and editable later with
`/plugin configure openl-ai@openl-ai-plugin` (or pre-filled headlessly with
`claude plugin install … --config`, see above — both store values via the same path).
Each is injected into the MCP server process environment — the model itself never
receives them directly.

| Setting | Required | Injected as | Purpose |
|---|---|---|---|
| `studio_base_url` | yes | `OPENL_BASE_URL` | The OpenL Studio address, e.g. `https://studio.example.com`. |
| `studio_token` | no | `OPENL_PERSONAL_ACCESS_TOKEN` | A manually issued Personal Access Token (PAT). Only needed when browser sign-in is unavailable (see below). Marked `sensitive` — masked and stored in secure storage. |
| `oauth_issuer` | no | `OPENL_OAUTH_ISSUER` | Identity-provider issuer URL enabling browser sign-in, e.g. `https://idp.example.com/realms/openlstudio`. |
| `oauth_client_id` | no | `OPENL_OAUTH_CLIENT_ID` | Public OAuth client id for browser sign-in. Defaults to `openl-cli`. |

## Studio address

- Use the exact URL analysts open in the browser (scheme + host + optional context
  path), e.g. `https://studio.example.com`. The plugin calls Studio's REST API under
  `<address>/rest/**`.
- Studio must be reachable **from each user's machine** (VPN or office network if
  Studio is internal). The plugin makes direct HTTPS calls; there is no relay.
- The cached browser sign-in is keyed by this exact address — if you later change the
  configured address, users must run `/openl-ai:connect` once more.

## How sign-in works per deployment type

The plugin authenticates to Studio with a Personal Access Token (PAT), obtained in one
of two ways. The server picks automatically, in this order of precedence: an explicit
`studio_token` setting → the token cached by `/openl-ai:connect` browser sign-in →
anonymous (single-user Studio only).

| Studio user mode | What analysts should do | Your setup work |
|---|---|---|
| **Single-user** (`user.mode=single`) | Nothing — no sign-in exists. `/openl-ai:connect` detects this and says so. | None. |
| **Multi-user, internal users** (`user.mode=multi`) | Create a PAT in Studio (**User → Personal Access Tokens**) and paste it into the plugin's token setting. | Tell users where to create tokens. Browser sign-in is not possible (no OAuth identity provider). |
| **Active Directory** | Same as multi-user: manual PAT. | Same. |
| **OAuth2 / OIDC** | Run `/openl-ai:connect` — browser sign-in. | Configure the IdP client and distribute `oauth_issuer` (see below). Manual PAT remains a fallback. |
| **SAML** | Manual PAT (browser sign-in requires an OIDC issuer, which SAML deployments typically don't expose). | Tell users where to create tokens. |
| **Cowork / cloud-hosted Claude** | Manual PAT. Browser sign-in cannot work: it needs the browser and Claude Code on the same machine. | Tell users where to create tokens. |

PAT issuance requires a multi-user Studio: `GET <address>/rest/settings` (public)
reports `supportedFeatures.personalAccessToken` and `userMode` (`null` for
single-user). The `/openl-ai:connect` skill probes this endpoint to pick the right
path automatically.

## Browser sign-in (OAuth2 deployments)

`/openl-ai:connect` runs an OAuth 2.0 Authorization Code + PKCE flow (per RFC 8252,
"OAuth 2.0 for Native Apps") against your IdP, then uses the resulting session to mint
a PAT via Studio's `POST /rest/users/personal-access-tokens`. Requirements on the IdP:

- A **public** client (no client secret), with **PKCE** enabled.
- A **loopback redirect URI** `http://127.0.0.1/*` — the IP literal, **not**
  `localhost`. Per RFC 8252 the port is ignored for loopback IP redirects, which is
  what lets the plugin listen on an ephemeral port.
- The client id defaults to **`openl-cli`**; if you register a different one, set the
  plugin's `oauth_client_id`.
- The **confidential web client Studio itself uses** to log users in will **not**
  work: it has Studio's own redirect URI and requires a client secret, which the
  sign-in command does not send.

Then distribute two values to users (or pre-provision them, see above):

- `oauth_issuer` — the IdP realm/issuer URL (must serve
  `<issuer>/.well-known/openid-configuration`), e.g.
  `https://idp.example.com/realms/openlstudio`.
- `oauth_client_id` — only if it differs from `openl-cli`.

Constraint: the browser and Claude Code must run on the **same machine** (the loopback
listener is local). For cloud/remote setups, use a manual PAT.

## Manual access token (PAT)

Works with any multi-user Studio and any identity provider, with no IdP changes:

1. The user signs in to OpenL Studio in the browser.
2. **User → Personal Access Tokens → create token** (name it e.g. "Claude Code").
3. The user pastes the token into the plugin's **Personal Access Token** setting
   (`/plugin configure openl-ai@openl-ai-plugin`). The field is masked.

PATs are user-scoped, have an expiry date, and are individually revocable in Studio —
treat expiry/revocation as your lever for offboarding. When a PAT expires, tools start
failing with 401; the fix is a new token (or `/openl-ai:connect` re-run on OAuth2
deployments).

## Security requirements and properties

- **Secrets stay out of the model's context.** The token setting is `sensitive`:
  masked in the UI, injected only into the MCP server's environment. The browser
  sign-in subprocess prints only `Signed in as <user>` — never the token. Instruct
  users to never paste tokens into the chat itself.
- **Storage.** Sensitive settings are stored in the OS keychain on macOS, or in a
  protected credentials file (`~/.claude/.credentials.json`) on platforms without a
  keychain. Non-sensitive settings live in the user's Claude Code `settings.json`
  under `pluginConfigs`. The browser sign-in cache is
  `~/.config/openl-mcp/credentials.json`, created with file mode `0600`, keyed by
  Studio address.
- **Precedence.** An explicit `studio_token` always wins over a cached sign-in;
  otherwise the cached sign-in is used; otherwise the server connects anonymously
  (only meaningful for single-user Studio). A blank/whitespace token setting is
  treated as absent (from `openl-mcp@1.1.0`).
- **Revocation.** Both paths end in a normal Studio PAT, visible in the user's token
  list in Studio — named, time-limited, revocable.
- **Network.** All calls are direct HTTPS from the user's machine to Studio (plus the
  IdP for browser sign-in, and the npm registry for the first plugin launch).

## What to tell your analysts

A rollout note can be as short as:

> Claude Code can now work with OpenL Studio. In Claude Code, run
> `/openl-ai:connect`, approve the sign-in in your browser, start a new Claude
> session, and ask: "List the OpenL projects I can access."
> If anything fails, see the plugin's troubleshooting page, or send me the error text
> (never send your access token).

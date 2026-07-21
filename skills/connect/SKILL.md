---
name: connect
description: This skill should be used when the user asks to connect, sign in, log in, sign out, rotate credentials, or authenticate Codex, Claude Code, or Claude desktop/Cowork to OpenL Studio, or when OpenL tools fail with 401 Unauthorized.
---

# Connect to OpenL Studio

Connect the current client to OpenL Studio with a Personal Access Token (PAT) when
the deployment requires one, or anonymously for a single-user deployment. Keep the
conversation focused on outcomes and never ask the user to paste a PAT into chat.

## Choose the current client first

Use exactly one branch:

- **Codex desktop or CLI:** Codex task context or the `codex plugin` command is
  available. Follow **Codex setup**. Codex does not substitute `${user_config.*}`
  values and does not use `/plugin configure` or `claude_desktop_config.json`.
- **Claude Code terminal, IDE, or desktop Code tab:** `/plugin` settings are
  available. Follow **Claude Code setup**.
- **Claude desktop Chat or Cowork:** `/plugin` settings are unavailable and the
  session may use sandbox paths such as `/sessions/...`. Follow **Cowork setup**.

If the client cannot be determined from the host context, ask which of these three
the user is using before giving configuration instructions.

Authentication is always created in OpenL Studio under **User → Personal Access
Tokens**. Do not run an OpenL CLI login flow, browser login, or OAuth flow.

## Codex setup

The bundled configurator is the only supported way to save Codex connection data.
It probes the deployment, asks for the Studio address in the user's own terminal,
and requests a PAT only for a multi-user Studio.

1. Find the installed plugin directory by running `codex plugin list --json` and
   selecting the enabled entry whose `pluginId` is
   `openl-ai@openl-ai-plugin`. Read only its `source.path` field. Do not search
   Codex caches, inspect `codex.json`, or read any other configuration file.
2. Optionally run this non-secret status check yourself:

   ```bash
   node "<source.path>/scripts/configure-codex.mjs" --status --json
   ```

   The output contains only the Studio address, authentication type, and config
   path. It never contains the PAT.
3. If configuration is absent or the user wants to change it, give them this exact
   command with the resolved absolute path:

   ```bash
   node "<source.path>/scripts/configure-codex.mjs"
   ```

   Tell them to run it themselves in a normal Terminal or PowerShell window, not in
   chat and not through an agent tool. The command requires a real TTY and hides PAT
   input. Never run the interactive command for the user.
4. For a multi-user Studio, tell the user to create a PAT first: sign in to Studio,
   open **User → Personal Access Tokens**, create a token (for example, named
   "Codex"), and copy it when Studio shows it. By default the configurator accepts a
   PAT only over HTTPS. HTTP works without a token for loopback development; for a
   trusted internal HTTP Studio the user can re-run the configurator with
   `--allow-insecure` (or `OPENL_AI_ALLOW_INSECURE=1`), which permits a PAT over plain
   HTTP and warns that the token is then sent unencrypted.
5. After the configurator succeeds, tell the user to start a new Codex task and ask:
   *List the OpenL projects I can access.*

If `openl-ai@openl-ai-plugin` is not listed, explain that the plugin is not installed
or enabled and point the user to `docs/codex-setup.md`. Do not guess an installation
cache path.

The Codex config stores the PAT as plaintext outside the plugin cache with owner-only
file permissions on POSIX; Windows relies on the user's `%APPDATA%` ACLs. Do not call
this keychain storage, and do not claim that same-user processes or backups cannot
read it.

### Codex sign-out and rotation

- **Sign out:** first revoke the PAT in Studio. Then have the user run
  `node "<source.path>/scripts/configure-codex.mjs" --clear` in their terminal and
  start a new Codex task. Studio-side revocation is what invalidates the token.
- **Rotate:** create a replacement PAT, rerun the configurator, start a new task and
  verify the connection, then revoke the old PAT in Studio.

## Claude Code setup

Claude Code substitutes saved plugin settings into this skill when supported. Treat
a blank value or a literal `${user_config...}` placeholder as unavailable:

- Studio address: `${user_config.studio_base_url}`

If the address is unavailable, reuse a value already present in the conversation or
ask once for the web address the user opens for OpenL Studio. Do not read Claude's
settings files; they may contain unrelated secrets.

Validate the address before probing it. Require an absolute `http://` or `https://`
URL with no credentials, query, fragment, whitespace, or shell metacharacters.
Require HTTPS for a multi-user Studio; allow HTTP only for anonymous loopback
development. Pass the address as one quoted argument and never use `eval`.

Probe `<studio-address>/rest/settings` without authentication. Do not follow
redirects. Use a 10-second timeout, cap the response at 1 MiB, and interpret it only
when the response is HTTP 200 JSON with an object-valued `supportedFeatures` field:

- Unreachable, timeout, redirect, oversized/non-JSON response, non-200 status, or
  missing `supportedFeatures`: explain that Studio cannot be reached at that address
  and suggest checking the address, office network, or VPN. Stop.
- `userMode` absent or `null`: this is single-user Studio. No PAT is needed; continue
  to verification.
- `userMode` present and `supportedFeatures.personalAccessToken` is `true`: continue
  with PAT setup.
- `userMode` present but PAT support is not `true`: explain that this deployment
  cannot issue the tokens required by the plugin and ask the OpenL administrator.

For PAT setup, tell the user:

> 1. Open OpenL Studio in your browser and sign in as usual.
> 2. Go to **User → Personal Access Tokens**, create a token (for example, named
>    "Claude Code"), and copy it when Studio shows it.
> 3. Run `/plugin configure openl-ai@openl-ai-plugin` and paste it into the masked
>    **Personal Access Token** field.

Tell the user to start a new Claude session and ask: *List the OpenL projects I can
access.* A new session is required when tools already started with old settings.

### Claude Code sign-out and rotation

- **Sign out:** revoke the PAT in Studio, clear the plugin's PAT field with
  `/plugin configure openl-ai@openl-ai-plugin`, and start a new session. Revoke any
  older PATs created for Claude/OpenL MCP because old server versions may have cached
  one after a direct CLI login.
- **Rotate:** create a replacement PAT, update the masked plugin setting, start a new
  session and verify, then revoke the old PAT.

## Cowork setup

Use `docs/cowork-setup.md` when available. The desktop app has no plugin settings
dialog for Chat/Cowork, so never suggest `/plugin configure` there.

Guide the user to:

1. Create a PAT in Studio under **User → Personal Access Tokens**.
2. Open **Claude menu → Settings… → Developer → Edit Config**.
3. Add an `openl` entry under `mcpServers` using command `npx`, arguments
   `-y --prefer-online -p openl-mcp openl-mcp`, and an `env` block containing the
   Studio address and PAT.
4. Quit the Claude app completely and restart it, then ask: *List the OpenL projects
   I can access.*

The desktop config contains the PAT in plaintext. If writing a template for the user,
leave an obvious placeholder and have the user replace it in their editor. Never put
the real value into a tool call, file edit, or conversation. Use an exact
`openl-mcp@X.Y.Z` pin only when the user or administrator requests reproducibility.

For sign-out, revoke the PAT in Studio first, then remove the token or entire `openl`
entry and restart the app. For rotation, update and verify the replacement before
revoking the old PAT.

## Safety rules

- Never print, log, read, or repeat a PAT. If one appears in chat, tell the user to
  treat it as exposed, revoke it, and create a replacement.
- Never pass a PAT through command arguments, environment variables supplied by the
  user, a pipe, or an agent-run interactive command.
- Never use CLI authentication commands. PAT creation and Studio-side revocation are
  the supported authentication operations.
- Always finish with the appropriate restart/new-task step and the verification
  prompt.

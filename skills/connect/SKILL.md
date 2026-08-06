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
Tokens**. Allow and instruct the user to sign in to Studio in their normal browser
to create that PAT. Do not start a client-side browser/OAuth authentication flow or
run an OpenL CLI login flow from the AI client.

## Codex setup

The bundled configurator is the only supported way to save Codex connection data.
It probes the deployment, asks for the Studio address in the user's own terminal,
and requests a PAT only for a multi-user Studio.

1. Find the installed plugin directory by running `codex plugin list --json` and
   selecting the enabled entry whose `pluginId` is
   `openl@openl-ai-plugin`. Read only its `source.path` field. Do not search
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
   "Codex"), and copy it when Studio shows it. HTTPS is preferred because it encrypts
   the PAT in transit. Loopback HTTP (`localhost`, `127.0.0.1`, or `::1`) remains
   supported for local Studio copies, including PAT authentication, and produces an
   unencrypted-transport warning. For another trusted internal HTTP host, re-run with
   `--allow-insecure` (or `OPENL_AI_ALLOW_INSECURE=1`), which permits a PAT over plain
   HTTP and warns that the token is then sent unencrypted.
5. After the configurator succeeds, tell the user to start a new Codex task and ask:
   *List the OpenL projects I can access.*

If `openl@openl-ai-plugin` is not listed, explain that the plugin is not installed
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
Accept the exact scheme used by Studio: local copies may use HTTP. When a multi-user
Studio uses HTTP, warn that its PAT will travel unencrypted and recommend HTTPS,
especially for any non-local deployment, but do not misreport HTTP as an invalid
address. Pass the address as one quoted argument and never use `eval`.

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
> 3. Open a terminal and start Claude Code there by running `claude` — the settings
>    dialog opens only in a terminal session.
> 4. At that Claude Code prompt, run `/plugin configure openl@openl-ai-plugin` and
>    paste the token into the masked **Personal Access Token** field.

For an `http://` address, add one plain warning before these steps: the local copy is
supported, but the PAT is not encrypted in transit. Do not block the setup after the
user chooses to use that Studio address.

If the user is in the Claude **desktop app's Code tab**, restate the caveat plainly:
`/plugin configure` opens its dialog only in a terminal `claude` session, not in the
desktop chat or the Code tab. Have them run it once in a terminal; the saved setting
then applies to their desktop Code sessions.

Tell the user to start a new Claude session and ask: *List the OpenL projects I can
access.* A new session is required when tools already started with old settings.

### Claude Code sign-out and rotation

- **Sign out:** revoke the PAT in Studio, clear the plugin's PAT field with
  `/plugin configure openl@openl-ai-plugin`, and start a new session. Revoke any
  older PATs created for Claude/OpenL MCP because old server versions may have cached
  one after a direct CLI login.
- **Rotate:** create a replacement PAT, update the masked plugin setting, start a new
  session and verify, then revoke the old PAT.

## Cowork setup

Use `docs/cowork-setup.md` when available. The desktop app has no plugin settings
dialog for Chat/Cowork, so never suggest `/plugin configure` there.

Guide the user to:

1. Obtain the Studio address and apply the same validation and unauthenticated
   `/rest/settings` probe used in **Claude Code setup**.
2. For multi-user Studio, create a PAT under **User → Personal Access Tokens**. For
   single-user Studio, do not create or configure a token.
3. Open **Claude menu → Settings… → Developer → Edit Config**.
4. Add an `openl` entry under `mcpServers` using command `npx`, arguments
   `-y --prefer-online -p openl-mcp openl-mcp`, and an `env` block containing the
   Studio address. Add `OPENL_PERSONAL_ACCESS_TOKEN` only for multi-user Studio.
5. Quit the Claude app completely and restart it, then ask: *List the OpenL projects
   I can access.*

Accept an `http://` address for a local Studio copy. If a PAT is required, warn that
HTTP sends it unencrypted and recommend HTTPS without falsely declaring the address
unsupported.

The desktop config contains the PAT in plaintext. If writing a template for the user,
leave an obvious placeholder and have the user replace it in their editor. Never put
the real value into a tool call, file edit, or conversation. Use an exact
`openl-mcp@X.Y.Z` pin only when the user or administrator requests reproducibility.
Tell the user to use a plain-text editor, paste the provided JSON template instead of
retyping it, and keep straight quotes: smart/curly quotes make the JSON invalid.

For sign-out, revoke the PAT in Studio first, then remove the token or entire `openl`
entry and restart the app. For rotation, update and verify the replacement before
revoking the old PAT.

## Safety rules

- Never print, log, read, or repeat a PAT. If one appears in chat, tell the user to
  treat it as exposed, revoke it, and create a replacement.
- Never pass a PAT through command arguments, an ad hoc shell environment, a pipe,
  or an agent-run interactive command. The supported Cowork `env` object belongs in
  `claude_desktop_config.json`; leave its real PAT value for the user to enter in a
  plain-text editor, never through an agent tool.
- Never use CLI authentication commands. PAT creation and Studio-side revocation are
  the supported authentication operations.
- Always finish with the appropriate restart/new-task step and the verification
  prompt.

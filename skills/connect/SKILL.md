---
name: connect
description: Connect Claude Code or the Claude desktop app / Cowork to OpenL Studio with a Personal Access Token when required, or anonymously for single-user Studio. Use when the user wants to "connect", "sign in", "log in", "sign out", or "authenticate" to OpenL Studio, set up OpenL in Cowork, or when OpenL tools fail with 401 Unauthorized.
---

# Connect to OpenL Studio

Get the user's OpenL tools authenticated with as little interaction as possible. The
user is typically a business analyst: talk in outcomes, not in mechanics. Do not show
internal endpoint URLs or file paths unless the user explicitly asks for technical
details. Run the checks yourself and report the result in plain words.

Authentication is a **Personal Access Token (PAT)**: the user creates it once in OpenL
Studio's own web UI (where they log in with their usual account, through whatever
sign-in their organization uses) and pastes it into the plugin's settings. Claude then
acts as that user. There is no browser sign-in run from Claude Code — do not attempt
one, and do not bring up OAuth, issuers, or CLI authentication when talking to the
user.

**Detect the surface first.** In **Claude Code** (terminal/IDE), plugin settings work
and the steps below apply as written. In a **Claude desktop app / Cowork session**
(signs: `/plugin` commands are unavailable; you work in a sandboxed workspace, e.g.
paths like `/sessions/...`), the plugin's settings dialog does not exist — the token
goes into the desktop app's own settings file instead. In that case use the
**Cowork variant** of step 2, and never tell the user to run `/plugin configure`.

## Saved plugin settings

Claude Code substitutes the plugin's saved, non-sensitive settings into this skill
when supported. Treat a blank value or a literal `${user_config...}` placeholder as
"not available":

- Studio address: `${user_config.studio_base_url}`

If the **Studio address** is not available above, recover it without bothering the
user, in this order:

1. Reuse a value already present in this conversation.
2. Otherwise ask the user once: "What is your OpenL Studio address? It's the web
   address you open in the browser to use OpenL Studio, for example
   `https://studio.example.com`." Ask for nothing else. Do **not** read Claude's
   own settings/configuration files to recover it — they can contain unrelated
   secrets and must never enter the conversation.

Before using the address in any command below, **validate it**: it must be a plain
absolute `http://` or `https://` URL (scheme + host, optional port and path, no
spaces, quotes, `$`, backticks, `;`, `|`, `&`, or other shell metacharacters). If it
doesn't look like that, ask the user again — do not run anything. When you do run a
command, pass the address as a **single quoted argument** to `curl` / `openl-mcp`;
never concatenate it into a larger shell string and never pass it to `eval`.

## Steps

1. **Probe the deployment.** Fetch `<studio_base_url>/rest/settings` (public, no
   auth) so that the HTTP status is visible, e.g.
   `curl -s -w '\nHTTP_STATUS=%{http_code}' "<studio_base_url>/rest/settings"`.
   Interpret the fields **only** when the status is `200` **and** the body is JSON
   containing `supportedFeatures` — an error page from a proxy or an old Studio can
   be JSON too, and must not be mistaken for "no sign-in needed". Branch:

   - **Unreachable, timeout, non-JSON, status other than 200, or JSON without
     `supportedFeatures`** → tell the user: "I can't reach OpenL Studio at
     \<address\>. Check that the address is the one you use in your browser, and
     that you're connected to the office network or VPN." Stop.
   - **`userMode` is null or absent** → this is a single-user Studio with no sign-in
     at all. Tell the user: "Your Studio does not require sign-in — you can use the
     OpenL tools right away." Do **not** ask for a token. Go to step 3.
   - **`userMode` is present and `supportedFeatures.personalAccessToken` is `true`**
     → multi-user Studio, a token is needed. Continue to step 2.
   - **`userMode` is present but `personalAccessToken` is `false`** (rare, older
     deployments) → this Studio cannot issue the access tokens the OpenL tools use.
     Tell the user: "Your Studio doesn't support connecting from Claude Code yet.
     Ask your OpenL administrator." Stop.

2. **Guide the user to add a token.**

   **In Claude Code**, tell them, in these words:

   > 1. Open OpenL Studio in your browser and sign in as usual.
   > 2. Go to **User → Personal Access Tokens** and create a token (name it e.g.
   >    "Claude Code"). Copy it — Studio shows it only once.
   > 3. Add it to the plugin: run `/plugin configure openl-ai@openl-ai-plugin` and
   >    paste it into the **Personal Access Token** field. The field is masked.

   **In a Claude desktop app / Cowork session**, walk them through the settings-file
   setup instead (full analyst guide: `docs/cowork-setup.md` in the plugin
   repository — read it alongside if available):

   > 1. Open OpenL Studio in your browser, sign in, go to **User → Personal Access
   >    Tokens**, create a token and copy it.
   > 2. In the Claude desktop app: **Claude menu → Settings… → Developer → Edit
   >    Config** — this opens (or shows you) the file `claude_desktop_config.json`.
   > 3. Add an `"openl"` entry under `"mcpServers"` with `"command": "npx"`,
   >    `"args": ["-y", "--prefer-online", "-p", "openl-mcp", "openl-mcp"]`, and an `"env"` block
   >    with `OPENL_BASE_URL` = the Studio address and
   >    `OPENL_PERSONAL_ACCESS_TOKEN` = the copied token.
   > 4. Quit the Claude app completely and start it again.

   Use the unversioned package above by default so the desktop app checks for a new
   `openl-mcp` release when it starts. If the user explicitly asks for a reproducible
   setup, or their administrator provides an exact version, replace `openl-mcp` after
   `-p` with `openl-mcp@X.Y.Z` and omit `--prefer-online`. Explain that a pinned
   version changes only when the config is edited manually.

   You may write the JSON entry into the file for the user if you have file access
   and they agree — but **never fill in the token value yourself and never ask them
   to paste the token into the chat**: leave a clearly marked placeholder for them to
   replace in their text editor.

   If the user pastes the token into the chat, do **not** use it and do **not**
   repeat it back — tell them it needs to go into the masked plugin setting (Claude
   Code) or the settings file (desktop app), not the conversation, and that they
   should treat any token already pasted in chat as exposed and create a fresh one.

3. **Verify.** The token is picked up when the OpenL tools start. Tell the user:
   in Claude Code — "Start a new Claude session and try: *List the OpenL projects I
   can access.*"; in the desktop app — "Quit and restart the Claude app, then try:
   *List the OpenL projects I can access.*" If the OpenL tools already failed with
   401 earlier in this session, mention that the restart/new session is what makes
   the newly added token take effect.

## Signing out / rotating

To sign out, revoke the configured token in OpenL Studio under **User → Personal
Access Tokens**. Also revoke any older tokens the user previously created for Claude
or OpenL MCP: older server versions can fall back to a token cached by a past direct
CLI sign-in. Studio-side revocation is the authoritative operation that invalidates
each token everywhere. Then remove the obsolete value from the client: in Claude
Code, clear the Personal Access Token field with
`/plugin configure openl-ai@openl-ai-plugin` and start a new session; in the desktop
app, remove the token value (or the whole `openl` entry) from
`claude_desktop_config.json` and restart the app.

To rotate a token, create a replacement in Studio, update the client setting, restart
the client, verify the connection, and then revoke the old token in Studio. Never run
CLI authentication commands as part of either flow.

## Rules

- **Never print, log, or read the token value.** Don't read masked settings fields;
  don't echo a token the user pastes.
- **No CLI sign-in or sign-out.** Never run CLI authentication commands or open a
  browser for authentication. Token entry and Studio-side revocation are the only
  supported paths.
- After any successful outcome, always offer the verification prompt from step 3.

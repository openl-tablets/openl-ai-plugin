---
name: connect
description: Connect Claude Code to OpenL Studio by adding a Personal Access Token to the plugin settings, so the OpenL tools authenticate as you. Use when the user wants to "connect", "sign in", "log in", "sign out", or "authenticate" to OpenL Studio, or when OpenL tools fail with 401 Unauthorized.
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
one, and do not bring up OAuth, issuers, or `openl-mcp login` when talking to the
user (the internal sign-out cleanup below is the one exception where the CLI is run).

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
2. Read the user-level Claude Code settings file `~/.claude/settings.json` and take
   `pluginConfigs["openl-ai@…"].options.studio_base_url`. Read only this non-sensitive
   option — never read or search for the token value.
3. Only if still unknown, ask the user once: "What is your OpenL Studio address? It's
   the web address you open in the browser to use OpenL Studio, for example
   `https://studio.example.com`." Ask for nothing else.

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
   >    Config** — this opens the file `claude_desktop_config.json`.
   > 3. Add an `"openl"` entry under `"mcpServers"` with `"command": "npx"`,
   >    `"args": ["-y", "-p", "openl-mcp@1.1.0", "openl-mcp"]`, and an `"env"` block
   >    with `OPENL_BASE_URL` = the Studio address and
   >    `OPENL_PERSONAL_ACCESS_TOKEN` = the copied token.
   > 4. Quit the Claude app completely and start it again.

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

To sign out or replace the token: in Claude Code, run
`/plugin configure openl-ai@openl-ai-plugin` and clear (or overwrite) the Personal
Access Token field, then start a new session; in the desktop app, edit the token
value in `claude_desktop_config.json` (Claude menu → Settings… → Developer → Edit
Config) and restart the app. To fully revoke access, the user deletes the token in
OpenL Studio under **User → Personal Access Tokens** — that is the authoritative
kill switch.

One caveat: clearing the token field alone is **not** a guaranteed sign-out. If the
`openl-mcp login` CLI command was ever used on this machine (it is part of the
underlying npm package; this plugin never runs it), the server falls back to the
credential it cached. When signing out, also run (internal command — don't display
it unless asked): `npx -y -p openl-mcp@1.1.0 openl-mcp logout "<studio_base_url>"` —
it is harmless when no cache exists. Deleting the token in Studio makes this moot:
a revoked PAT stops working everywhere at once.

## Rules

- **Never print, log, or read the token value.** Don't read masked settings fields
  or `~/.config/openl-mcp/credentials.json`; don't echo a token the user pastes.
- **No browser sign-in.** Never run `openl-mcp login` or open a browser for
  authentication — token entry is the only supported path. (`openl-mcp logout` is
  allowed, but only as the sign-out cleanup described above.)
- After any successful outcome, always offer the verification prompt from step 3.

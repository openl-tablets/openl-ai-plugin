---
name: connect
description: Connect Claude Code to OpenL Studio by signing in through the browser and caching an access token, so the OpenL tools work without manually copy-pasting a Personal Access Token. Use when the user wants to "connect", "sign in", "log in", "sign out", or "authenticate" to OpenL Studio, or when OpenL tools fail with 401 Unauthorized.
---

# Connect to OpenL Studio

Get the user's OpenL tools authenticated with as little interaction as possible. The
user is typically a business analyst: talk in outcomes ("Connected as …"), not in
mechanics. Do not show shell commands, URLs of internal endpoints, OAuth terms
(issuer, client id, PKCE), or file paths unless the user explicitly asks for
technical details. Run the technical steps yourself and report the result in plain
words.

## Saved plugin settings

Claude Code substitutes the plugin's saved, non-sensitive settings into this skill
when supported. Current values — treat a blank value or a literal
`${user_config...}` placeholder as "not available":

- Studio address: `${user_config.studio_base_url}`
- Sign-in issuer: `${user_config.oauth_issuer}`
- Sign-in client id: `${user_config.oauth_client_id}` (blank means the default `openl-cli`)

If the **Studio address** is not available above, recover it without bothering the
user, in this order:

1. Reuse a value already present in this conversation.
2. Read the user-level Claude Code settings file `~/.claude/settings.json` and take
   `pluginConfigs["openl-ai@…"].options.studio_base_url` (also check
   `oauth_issuer` / `oauth_client_id` there). Read only these non-sensitive options —
   never search for token values.
3. Only if still unknown, ask the user once: "What is your OpenL Studio address? It's
   the web address you open in the browser to use OpenL Studio, for example
   `https://studio.example.com`." Ask for nothing else.

Never re-ask for a value you already have. Never ask the user for the issuer or
client id — those are administrator-provided settings, not something an analyst
knows (but if the user pastes instructions from their administrator containing them,
use them).

## Steps

1. **Probe the deployment.** Fetch `<studio_base_url>/rest/settings` (public, no
   auth), e.g. with `curl -s`. Branch on the JSON:

   - **Unreachable, non-JSON, or HTTP error** → tell the user: "I can't reach OpenL
     Studio at \<address\>. Check that the address is the one you use in your
     browser, and that you're connected to the office network or VPN." Stop.
   - **`userMode` is null or absent** → this is a single-user Studio with no sign-in
     at all. Tell the user: "Your Studio does not require sign-in — you can use the
     OpenL tools right away." Do **not** suggest an access token or any other setup.
     Go to step 4.
   - **`userMode` is present and `supportedFeatures.personalAccessToken` is `true`**
     → multi-user Studio, sign-in needed. Continue.
   - **`userMode` is present but `personalAccessToken` is `false`** (rare, older
     deployments) → this Studio cannot issue the access tokens the OpenL tools use.
     Tell the user: "Your Studio doesn't support connecting from Claude Code yet.
     Ask your OpenL administrator." Stop.

2. **Pick the sign-in path.**

   - If a sign-in **issuer is available** (saved settings or provided in the
     conversation) → browser sign-in, step 3.
   - If **no issuer is available** → browser sign-in is not set up for this
     deployment. Tell the user: "Browser sign-in is not configured for your
     organization. Ask your OpenL administrator for access instructions. If they give
     you an access token, add it in Claude Code via
     `/plugin configure openl-ai@openl-ai-plugin` (the Personal Access Token field) —
     don't paste it into the chat." Stop.

3. **Run the browser sign-in.** First tell the user: "Your browser will open — sign
   in with your usual OpenL Studio account and approve." Then run (internal command —
   don't display it unless asked):

   ```bash
   npx -y -p openl-mcp@1.1.0 openl-mcp login "<studio_base_url>" --issuer "<oauth_issuer>"
   ```

   - Append `--client-id "<oauth_client_id>"` only when a non-blank client id is
     configured (the default is `openl-cli`).
   - Use the **exact configured Studio address** — the cached sign-in is keyed by it,
     and a variant spelling won't be picked up by the OpenL tools.
   - On a headless machine (no local browser), add `--no-browser` and give the user
     the printed sign-in URL to open.
   - On success the command prints `✅ Signed in as "<user>"` and caches the
     credential at `~/.config/openl-mcp/credentials.json`. Report: "Connected as
     \<user\>."

4. **Verify.** The connection is picked up when the OpenL tools start a new session.
   Tell the user: "Start a new Claude session and try: *List the OpenL projects I can
   access.*" If the OpenL tools already worked in this session before (e.g. this was
   a 401 fix), mention that the new session is what makes the fresh sign-in take
   effect.

## Translating failures for the user

Never show raw stack traces or the failing command by default. Map outcomes:

| Failure | Tell the user |
|---|---|
| Probe unreachable / timeout | "I can't reach OpenL Studio at \<address\> — check the address and your VPN/office network." |
| Login errors "The OAuth issuer is required" | Same message as step 2's "Browser sign-in is not configured…" |
| Issuer discovery fails (bad issuer URL, 404 on `.well-known`) | "Browser sign-in isn't set up correctly for your organization. Ask your OpenL administrator." |
| Browser flow times out or the user cancels | "The sign-in wasn't completed. Want me to try again?" |
| Token minting fails (HTTP 4xx after browser approval) | "You signed in, but Studio refused to issue an access token for your account. Ask your OpenL administrator to check your permissions." |
| Sign-in succeeded but tools still get 401 in a new session | Check the plugin's saved Studio address matches the address used to sign in; if it differs, sign in again with the exact saved address. |

## Rules

- **Never print, log, or read the token value.** Don't read
  `~/.config/openl-mcp/credentials.json` or masked settings fields; don't echo
  tokens the user pastes — if they paste one, tell them to put it in the plugin's
  Personal Access Token setting (`/plugin configure openl-ai@openl-ai-plugin`)
  instead.
- Only mention signing out if the user asks. To sign out, run (internal):
  `npx -y -p openl-mcp@1.1.0 openl-mcp logout "<studio_base_url>"` — then confirm
  "Signed out."
- After any successful outcome, always offer the verification prompt from step 4.

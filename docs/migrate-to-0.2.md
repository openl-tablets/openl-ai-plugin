# Upgrade from `openl-ai` 0.1.x to `openl` 0.2.0

Version 0.2.0 changes the plugin identity from `openl-ai` to `openl`. Follow every
section below for the clients you use. Prefer a separate PAT per client: revoking a
token invalidates every configuration that shares it.

## Claude Code 2.1.193 or later

The marketplace contains Claude Code's native rename map. It migrates editable
user, project, and local `enabledPlugins` and `pluginConfigs` entries — including
the saved Studio settings — from `openl-ai` to `openl`.

1. If you use the Claude desktop app's **Code** tab, open a terminal Claude Code
   session for these plugin commands.
2. Refresh the marketplace:

   ```text
   /plugin marketplace update openl-ai-plugin
   ```

3. Start a new Claude Code session. Claude Code should show a one-time rename notice.
4. Ask: *List the OpenL projects I can access.*

The skill is now `/openl:connect`. You do not need to uninstall the old identity or
create a new PAT when automatic migration succeeds. If the tools do not appear, run
`/plugin install openl@openl-ai-plugin`; if the saved settings are missing, run
`/plugin configure openl@openl-ai-plugin`.

## Older Claude Code with editable settings

Update Claude Code to 2.1.193 or later if possible. Versions 2.1.119–2.1.192 ignore
the rename map and need this manual fallback:

1. Create a replacement PAT in OpenL Studio (**User → Personal Access Tokens**)
   unless the Studio is single-user.
2. Disable the old plugin:

   ```text
   /plugin disable openl-ai@openl-ai-plugin
   ```

3. Refresh the marketplace and install `openl`:

   ```text
   /plugin marketplace update openl-ai-plugin
   /plugin install openl@openl-ai-plugin
   ```

4. Fill in the Studio address and replacement PAT when prompted. If you skipped the
   prompt, run `/plugin configure openl@openl-ai-plugin`.
5. Start a new session and ask: *List the OpenL projects I can access.*
6. After that succeeds, uninstall the old plugin:

   ```text
   /plugin uninstall openl-ai@openl-ai-plugin
   ```

For this manual fallback, revoke the old PAT only after the new connection works
**and** you confirm that no Codex, Cowork, or other configuration still uses that
token. If it is shared, rotate those consumers first.

## Managed or other read-only Claude Code settings

Do not run the manual disable/install sequence for a plugin supplied through a
read-only scope. Ask the administrator to replace `openl-ai@openl-ai-plugin` with
`openl@openl-ai-plugin` in both `enabledPlugins` and any `pluginConfigs` key,
preserving the existing values. Claude Code 2.1.193+ can load the renamed plugin
temporarily, but it cannot rewrite managed files.

## Codex

Released 0.1.x versions did not include Codex support. For a normal 0.2.0 install,
follow the [Codex setup](codex-setup.md); there is no Codex migration.

Only users of a prerelease/test installation named `openl-ai` need to clean it up:

```bash
codex plugin marketplace upgrade openl-ai-plugin
codex plugin remove openl-ai@openl-ai-plugin
codex plugin add openl@openl-ai-plugin
```

The Codex connection file is outside the plugin cache, so it keeps the existing
Studio address and PAT. Start a new Codex task and verify the connection.

## Claude desktop app / Cowork

The `openl` MCP entry and PAT in `claude_desktop_config.json` are independent of the
plugin identity and do not change. In **Customize → Plugins**, update the
`openl-ai-plugin` marketplace. If **openl-ai** remains installed, uninstall it and
install **openl**, then start a new conversation.

The skill is now `/openl:connect`.

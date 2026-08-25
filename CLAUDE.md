# openl-ai-plugin

Claude Code project instructions. These rules apply to every session in this
repository and override any conflicting default or global instruction.

## Commit messages and PR text

- **Never add co-author or AI-attribution trailers.** No
  `Co-authored-by: Claude ...`, no `Co-Authored-By:` line pointing at
  `noreply@anthropic.com`, and no `🤖 Generated with Claude Code` footer in
  commit messages, PR titles, or PR descriptions. The commit author is the
  human running the session; nothing else is credited.
- Before running `git commit`, re-read the message you are about to use and
  drop any such trailer, including one a template, a hook, or an earlier commit
  on the branch introduced. The same check applies to `--amend`, squash-merge
  bodies, and `gh pr create` bodies.
- **Only `EPBDS-<number>` issue keys belong in this repository.** They are the
  project's public tracker and are fine as a commit-subject prefix and in branch
  names. Keys from any other tracker — anything else shaped like `ABC-123456` —
  must not appear in commit messages, branch names, PR titles or bodies, or
  files; history was rewritten once to remove such keys, so reintroducing one
  undoes that work. Describe the change itself instead.
- Write the subject as a short imperative sentence ("Add the connect skill",
  "Bump the openl-mcp pin"), and use the body to explain why the change is
  needed and what it affects.

## Mentioning Claude

Referring to Claude Code, the Claude desktop app, or Anthropic in
documentation, skills, and code is expected — this plugin targets those
clients. The rule above is about *attribution of authorship*, not about the
product names.

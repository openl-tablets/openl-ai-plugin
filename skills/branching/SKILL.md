---
name: branching
description: >
  OpenL Tablets branch management — isolated branches, opening on the
  correct revision, syncing with base/development (send/receive, conflict
  resolution), dependent-project impact checks, hotfix two-branch rule,
  and post-merge cleanup. Use proactively for any rule/config change,
  new task/ticket, opening/reopening a project, a sync/merge/conflict, a
  bug in a released version, or phrases like "create a branch", "switch
  branches", "sync changes". Every rule edit must happen on an isolated
  branch — applies to all OpenL project types.
---

# OpenL Branching Skill

## Purpose

Teach the agent branch discipline for any OpenL Tablets project: isolated
task branches, correct revision handling, deliberate base/development
syncing with dependents tested before finalizing, the hotfix two-branch
rule, and post-merge cleanup.

## When to Use

- A user asks to make any rule/config change, starts a new task/ticket,
  asks which branch to work on, or needs the project opened/reopened.
- Any phrase like "start working on", "create a branch", "switch
  branches", "latest revision", or "sync changes".
- A branch needs to sync, a sync reports a conflict, or a bug is found in
  a released version ("hotfix", "bug in production").

## Key Concepts

- **Never edit rules directly on main.** Always work on an isolated branch.
- **Always open a branch on its latest revision**, never a cached one —
  it can go stale between sessions.
- **Resolve any unsaved working copy at session start immediately** —
  never ignore it; it may belong to a different task.
- Branch creation/saves are writes — same scrutiny as a table edit.
- **Only sync a task branch with base/development (receive/send/merge)
  when the user explicitly asks** — never on your own initiative because
  a task seems ready. At most, recommend a sync and let the user decide.
- **A hotfix follows a two-branch rule — never a merge between them.**
  Branch off the *released* version to fix it, then separately reproduce
  the fix on development. See "Bug Fix / Hotfix Workflow" below before
  touching a released branch.
- **Never delete a branch without an explicit user request to delete it**
  — a confirmed merge and passing target tests are conditions to verify
  once asked, not permission to delete on your own.
- **Before finalizing a merge, discover and test dependent projects too** —
  this project's own passing tests aren't sufficient. See
  "Dependent-Project Impact Check" below.
- **If the tooling can't complete an operation, say so** — flag the gap
  and point to the manual OpenL Studio step; never fake success or skip it.

## Conventions and Patterns

### Before Starting Any Change

1. **Check for an existing branch first** — search by ticket/task
   identifier (e.g. `PROJ-1234`); open it rather than duplicating.
2. **If none exists, create one** — follow a repository-configured naming
   pattern if present, otherwise the fallback convention below, including
   the ticket/task identifier.
3. **Open on that branch's latest revision and confirm it after opening.**
   If already open on a different branch/revision, close and reopen on the
   correct one — never rely on whatever happens to be loaded.

### Unsaved Working Copy at Session Start

If "unsaved working copy from the previous session" appears, resolve it
immediately — never stall or silently discard it:

1. Check which branch it belongs to (shown in project status).
2. Correct branch for this task → save it immediately and continue.
3. Different/unknown branch → **do not save it on your own initiative.**
   Tell the user what it contains and which branch it belongs to, and get
   explicit confirmation before committing it. Once confirmed, save it to
   *that* branch, then close and reopen on the correct branch at the
   latest revision. If the user instead says to discard it, discard it —
   don't save it either.

### During Editing

- Confirm branch and revision before touching any table; close and reopen
  on the latest revision. If on main, stop, branch, and move changes there
  before saving.
- **Save after every individual change** rather than accumulating unsaved
  edits.

### After Saving Changes

Verify every time: the save applied to the correct branch (not main), and
the revision counter incremented (not just held in memory — retry if not).

Tests should run after any rule change, following whatever pre-test
sequence this project's testing process defines — typically close →
reopen on latest revision → check compilation → run.

### Syncing with the Base/Development Branch

**Sync only when the user explicitly asks — never receive, send, or
merge on your own initiative.** If a merge is coming up and the branch
hasn't been synced in a while, say so and let the user decide; do not
sync unprompted just because it seems due.

**A plain request to "sync" is receive-only by default**: bring the base
branch's newer changes into the task branch and re-test — do not also
send the task branch's own changes back unless the user's request was
explicit about that too. **Send** the task branch's committed, tested
changes back to the base/development branch only on an explicit finalize,
merge, or "send" request. **Re-test after every receive and after any
conflict resolution.**

**On a sync conflict**: compare the versions first — never resolve blind.
Download **Yours**/**Theirs**/**Base** if the diff alone isn't enough.
**Use yours**/**Use theirs** only when one side is confirmed superseded;
**Upload merged file** when both changes are needed. Ask the user rather
than pick a side if the right resolution isn't clear.

Full worked example: [references/reference.md](references/reference.md).

### Dependent-Project Impact Check (Before Finalizing a Merge)

Before finalizing a merge, automatically discover which other projects
depend on the one being changed — don't skip this or defer it to the
user. If dependents exist, **run their test suites too**. Treat a
dependent test failure as blocking; report it rather than proceeding.
"No dependents" must be a confirmed result of the check, not an
assumption.

### Bug Fix / Hotfix Workflow (Two-Branch Rule)

A bug in a released version needs the fix applied **twice, as two
separate changes**, never as a merge between the branches involved:
branch off the released version (not development) to fix, test, and
release; then, separately, reproduce the same fix on a fresh development
branch (cherry-picked or redone), not by merging the hotfix branch in.

**Critical invariant — never merge in either direction**: never merge the
released/hotfix branch *into* development, and never merge development
*into* a released branch. If development has since diverged, resolve the
reproduction as its own edit, not a conflict.

### Post-Merge Branch Cleanup

**Delete a branch only when the user explicitly asks for it** — never on
your own initiative, even once a merge looks complete. When asked, verify
**both** are true before deleting: its changes were sent/merged into the
target, *and* the target's own tests pass after absorbing that merge. If
either isn't true, tell the user and don't delete. Uniform rule, hotfix
branches included, no special retention. Never delete a branch with
unsaved edits, an unresolved conflict, or an unconfirmed merge, even if
asked — flag the issue first.

### Branch Naming Convention

**Check for a repository-configured branch naming pattern first** and
follow it if present — use this fallback only when none is configured:

| Context | Format | Example |
|---|---|---|
| Ticket | `PROJ-NNN-description` | `PROJ-1234-add-discount-tier` |
| Ad-hoc fix | `fix-description-YYYYMMDD` | `fix-rate-rounding-20260728` |

Keep descriptions short, lowercase, no spaces/special characters.

## Anti-Patterns

- ❌ Editing tables, or treating a stale branch/revision as current, without
  confirming branch and revision first. Creating a duplicate branch for a
  task that has one, or committing directly to main instead of branching.
- ❌ Bundling a prior session's unknown pending edits into the current
  save instead of their own branch, or saving/discarding an unsaved
  working copy from a different/unknown branch without first getting the
  user's explicit confirmation. Accumulating unsaved edits instead of
  saving after each change, or reporting a save complete without
  confirming the revision incremented.
- ❌ Applying the generic naming convention when the repository already
  has its own configured pattern.
- ❌ Receiving, sending, or merging a branch on your own initiative because
  a task seems ready or a merge is coming up — sync only when the user
  explicitly asks. Also: sending the task branch's changes back on a
  plain "sync" request instead of treating it as receive-only until the
  user explicitly asks to finalize, merge, or send.
- ❌ Resolving a sync conflict with **Use yours**/**Use theirs** without
  comparing first, skipping re-testing after a receive/conflict, or
  reporting "ready to merge" with an unresolved conflict.
- ❌ Merging a released/hotfix branch into development (or vice versa)
  instead of reproducing the fix separately, or considering a hotfix done
  without that reproduction.
- ❌ Deleting a branch without an explicit user request to delete it, even
  if it looks fully merged and tested. Also: deleting once asked without
  confirming both the merge and the target's re-tested state, or keeping
  a hotfix branch alive under an assumed exception instead of the uniform
  cleanup rule.
- ❌ Finalizing a merge on this project's own green tests alone, without
  discovering and testing dependents, or assuming "none" without checking.
- ❌ Silently skipping or reporting complete an operation the tooling can't
  perform, instead of flagging it with the manual OpenL Studio step.

## References

- [references/reference.md](references/reference.md) — full worked
  examples: branch creation, an unsaved working copy, confirming a save, a
  sync conflict, and the hotfix walkthrough.

---
name: branching
description: >
  OpenL Tablets branch management — task branches, latest revision, sync with
  base (receive/send, conflicts), merge to base with dependent checks, the
  hotfix two-branch rule, and cleanup. Use for "create a branch", "switch
  branches", "sync changes", "merge to development", a sync conflict, a bug in
  a released version, or deleting a branch; `planning` calls it for branch
  items. Not for local WebStudio without branches.
---

# OpenL Branching

## Purpose

Branch discipline for any OpenL Tablets project: isolated task branches,
correct revisions, deliberate syncing with dependents tested before a merge,
the hotfix two-branch rule, and cleanup on request.

## Inputs

| Name | Type | Required | Description |
|---|---|---|---|
| `project` | string | yes | Exact OpenL project name |
| `task_key` | string | no | Ticket or task identifier used in the branch name |
| `operation` | string | yes | `start`, `sync`, `merge`, `hotfix`, or `delete` |

## When to use

- Starting, opening, or switching a task branch; syncing with the base; a
  sync or merge conflict; merging to the base; a bug in a released version;
  deleting a branch.
- Not for a local WebStudio repository without branches.

## Key concepts

- **Task branch** — an isolated branch for one task.
- **Base branch** — the branch a task branch is created from and merged
  into (usually development).
- **Receive / send** — bringing base changes into the task branch / sending
  task changes to the base.
- **Dependent project** — a project that uses this one.

## Conventions and patterns


- **Never edit rules on main.** Work on an isolated task branch.
- **Local WebStudio without branches** is exempt: skip branch creation,
  sync, merge, and cleanup, and say so.
- **Open on the latest revision** and confirm branch and revision before
  touching any table; never trust whatever is loaded.
- **Under an approved plan, `planning` rules.** Branch creation is a plan
  item done after approval; before approval only look up and open existing
  branches. An unsaved working copy found at startup is handled by
  `planning`, not saved here.
- **Save after each verified change item** (or at the end of a save group the plan declared), then confirm the save landed on
  the task branch and the revision moved on. When tests run belongs to
  `planning` and `testing`.
- **Sync, merge, and delete only on an explicit user request.** At most,
  recommend a sync.
- **If the tooling cannot do an operation, say so** and name the manual
  OpenL Studio step; never report it as done.

## Start a task branch

1. Look for an existing branch by the task identifier; open it instead of
   creating a duplicate.
2. If none exists, create one (after approval when a plan is in use),
   following the repository's naming pattern, or the fallback below.
3. Open the project on that branch's latest revision and confirm it.

## Unsaved working copy (no plan in use)

1. Read which branch it belongs to.
2. This task's branch → save it and continue.
3. Another or unknown branch → tell the user what it holds and where it
   belongs; save it there or discard it only on their answer. Then reopen on
   the correct branch at its latest revision.

## Sync with base/development

- A plain "sync" is **receive-only**: bring base changes into the task
  branch. **Send** only on an explicit finalize, merge, or send request.
- **On a conflict, compare first**, reading Yours/Theirs/Base only as
  evidence, and recommend a resolution. The user resolves it in OpenL
  Studio (use yours / use theirs / upload a merged file), or the pending
  merge is cancelled and the change log is reapplied (`planning` →
  Reapplication). Never pick a side yourself.
- After a receive or a resolved conflict: save the result, then re-run the
  full suite on the saved revision.

## Before finalizing a merge

Discover the projects that depend on this one and run their suites too. A
dependent failure blocks the merge. "No dependents" must be a checked
result, not an assumption.

## Merge (send to base)

Only on the user's explicit "yes" (under a plan: its Finish item).

1. Check the preconditions of `planning` step 11 and Before finalizing a
   merge.
2. Find the target among the repository's branches (the plan's base
   branch); ask if it is ambiguous.
3. Preview receiving from the target (no write). If the target moved on:
   receive, save, re-run the full suite through `testing`; a failure stops
   the merge.
4. Preview sending (no write), then:
   - mergeable → send;
   - up to date → report "nothing to merge", write nothing;
   - locked or protected → report the blocker and stop;
   - protected-branch bypass offered → explain; bypass only on the user's
     explicit request.
5. Conflict → handle it as in Sync; report the files and what differs.
6. After the send, confirm the target's new revision and report it. Offer
   branch deletion; delete only on request.

## Hotfix: two branches, never a merge

A bug in a released version is fixed twice, as two separate changes:

1. Branch off the **released** revision, fix, verify, save, test, release.
2. Separately redo the fix on a fresh branch off **development**.

Never merge the hotfix branch into development, nor development into a
released branch; if development has moved on, redo the fix's intent there.

## Delete a branch

Only on an explicit request. First verify that its changes reached the
target and the target's tests pass after the merge; never delete a branch
with unsaved edits or an unresolved conflict. Same rule for hotfix branches.

## Code examples

Branch names — use the repository's configured pattern when it has one,
otherwise:

| Context | Format | Example |
|---|---|---|
| Ticket | `PROJ-NNN-description` | `PROJ-1234-add-discount-tier` |
| Ad-hoc fix | `fix-description-YYYYMMDD` | `fix-rate-rounding-20260728` |

Short, lowercase, no spaces or special characters. Worked walkthroughs
(start, foreign working copy, confirming a save, sync conflict, hotfix):
[references/reference.md](references/reference.md).

## Anti-patterns

- ❌ Bundling a prior session's pending edits into this task's save.
- ❌ Reporting "ready to merge" while a conflict is open.

## References

- [references/reference.md](references/reference.md) — worked walkthroughs.

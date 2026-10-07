# OpenL Branching — Reference

Deep technical reference for `branching`. Read from the
skill's SKILL.md; this file holds the full worked examples that don't need
to live inline.

## Table of Contents

- [Starting a Task Branch](#starting-a-task-branch)
- [An Unsaved Working Copy Belonging to a Different Branch](#an-unsaved-working-copy-belonging-to-a-different-branch)
- [Confirming a Save Actually Committed](#confirming-a-save-actually-committed)
- [Receiving Updates, Hitting a Sync Conflict, and Resolving It](#receiving-updates-hitting-a-sync-conflict-and-resolving-it)
- [Hotfix Two-Branch Rule — Full Walkthrough](#hotfix-two-branch-rule--full-walkthrough)

## Starting a Task Branch

Checking for an existing branch, then creating and opening one for task
`PROJ-1234`:

1. List the branches available in the project's repository.
   `PROJ-1234-add-discount-tier` is not among them.
2. Create a branch named `PROJ-1234-add-discount-tier` from the
   repository's latest revision (following any repository-configured
   naming pattern if one exists, per the Branch Naming Convention).
3. Open the project on that new branch.
4. Confirm the opened revision is the branch's current head before
   editing anything.

## An Unsaved Working Copy Belonging to a Different Branch

Without a plan in use (under a plan, `planning` handles it):

1. Read the working copy's branch from the project's status — say it's
   `PROJ-9999-old-task`, not the branch needed for this task.
2. Tell the user: an unsaved working copy from a prior session belongs to
   `PROJ-9999-old-task`, not today's task branch. Ask whether to save it
   there or discard it — do not save it on your own initiative.
3. Once the user confirms saving it, save the pending edits with a
   comment noting they're a checkpoint from the prior session, committing
   them to `PROJ-9999-old-task`. If the user says to discard it instead,
   discard it without saving.
4. Close the project.
5. Reopen it on `PROJ-1234-add-discount-tier` at its latest revision.

## Confirming a Save Actually Committed

1. Save with a comment describing exactly what changed, e.g.
   "PROJ-1234: add discount tier row."
2. Re-check the project's current revision identifier.
3. Compare it to the revision recorded immediately before the save — if
   it is unchanged, the save did not commit; retry before continuing.

## Receiving Updates, Hitting a Sync Conflict, and Resolving It

Task branch `PROJ-1234-add-discount-tier`, the user asks to sync with
development mid-task:

1. **Receive** from development. One conflict: `TT_DiscountRate` changed on
   both sides.
2. **Compare** Yours/Theirs/Base as evidence. Yours adds an `effectiveDate`
   version row; theirs edits `accountCode` exclusions on the existing
   version. Both are needed and do not overlap.
3. **Recommend, do not resolve:** tell the user neither side alone is
   correct and that both changes must be combined and uploaded as a merged
   file in OpenL Studio — or offer to cancel the pending merge and reapply
   the change log onto the refreshed branch (`planning` → Reapplication).
4. After the user resolves it: confirm the saved revision moved on, then
   re-run the full suite on it. Nothing is sent until it shows 0 failures.
5. Sending back is a separate action, only on its own explicit request
   (Merge in SKILL.md).

**Contrast:** if theirs already contains your change (the same
`effectiveDate` row), recommend **Use theirs** — a merged file would
duplicate it. The question is always whether both changes are needed or
one side already covers the other.

## Hotfix Two-Branch Rule — Full Walkthrough

A production bug is reported against the released version currently
deployed (say, revision `r487` of the project, released three weeks ago).
Development has since moved on — several unreleased changes have already
landed on the development branch since that release.

**Step 1 — fix and release the hotfix branch:**
1. Branch off the *released* revision `r487` — not off development, and
   not off whatever revision happens to be currently open. Name it
   following the repository's configured pattern, or the ad-hoc fallback
   (e.g. `fix-rate-rounding-20260728`).
2. Open the project on that new branch, apply and verify the fix, then
   save with a comment describing it and confirm the revision incremented.
3. Run the full test suite on the saved revision.
4. Release/deploy from this hotfix branch (per this project's versioning
   and deploy process) — this branch carries only the released state plus
   this one fix, nothing from development.

**Step 2 — separately reproduce the fix on development:**
5. Open (or create) a task branch off the *development* branch — a fresh
   branch for this purpose, following the normal "Before Starting Any
   Change" flow, not the hotfix branch from step 1.
6. Re-apply the equivalent change here. If development's version of the
   affected table has already moved on since the release (e.g. it has a
   newer `effectiveDate` version, or unrelated columns changed), redo the
   fix's intent against development's current state — do not attempt to
   merge the hotfix branch in to get the fix here.
7. Verify, save, test, and treat this exactly like any other task branch change —
   including syncing it with development per the normal sync discipline.

**Why not just merge:** merging the hotfix branch into development pulls
in only a partial slice of history. Merging development into the
hotfix/released branch is worse — it pulls every unreleased,
in-progress change into a branch about to deploy to production. Two
independent, deliberate changes avoid both.

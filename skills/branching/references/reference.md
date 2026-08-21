# OpenL Branching — Reference

Deep technical reference for `branching`. Read from the
skill's SKILL.md; this file holds the full worked examples that don't need
to live inline.

## Table of Contents

- [Quick Reference](#quick-reference)
- [Starting a Task Branch](#starting-a-task-branch)
- [An Unsaved Working Copy Belonging to a Different Branch](#an-unsaved-working-copy-belonging-to-a-different-branch)
- [Confirming a Save Actually Committed](#confirming-a-save-actually-committed)
- [Receiving Updates, Hitting a Sync Conflict, and Resolving It](#receiving-updates-hitting-a-sync-conflict-and-resolving-it)
- [Hotfix Two-Branch Rule — Full Walkthrough](#hotfix-two-branch-rule--full-walkthrough)

## Quick Reference

| Situation | Action |
|---|---|
| Starting a new task | Check for existing branch → create if absent → open on latest revision |
| Resuming work | Open project → verify branch name and revision hash |
| Branch exists but is stale | Close → reopen on latest revision of that branch |
| Accidentally on main | Stop editing → create branch → reopen on new branch |
| Unsaved working copy detected | Correct branch → save immediately. Different/unknown branch → confirm with the user first, then save to *that* branch → open correct branch at latest revision |
| After every edit | Save immediately → verify revision incremented |
| User asks to sync/receive updates | Receive updates from base branch → re-test → resolve any conflicts (Compare first) |
| Sync conflict reported | Compare → download Yours/Theirs/Base if needed → Use yours / Use theirs / Upload merged file → re-test |
| User asks to finalize/merge | Receive updates once more → resolve conflicts → re-test → check for dependent projects and test them → Send your updates → notify user |
| Bug found in a released version | Branch off the released version, fix & release there → separately reproduce the fix as its own edit on development — never merge between the two |
| User asks to delete a branch | Verify it's merged into the target *and* the target's tests pass → delete — same rule for hotfix branches, no special retention. If either check fails, tell the user instead |

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

A worked example on task branch `PROJ-1234-add-discount-tier`, after the
user asks to sync it with the development branch mid-task:

1. **Receive updates** from the development branch into
   `PROJ-1234-add-discount-tier`. The sync reports one conflict: table
   `TT_DiscountRate` was changed on both sides.
2. **Compare** the two versions before doing anything else. The diff shows
   your change added a new `effectiveDate` version row; the incoming
   change edited an unrelated column (`accountCode` exclusions) on the
   existing version of the same table.
3. The in-tool diff is enough to decide here — both changes are needed and
   don't actually overlap on the same cells, so neither **Use yours** nor
   **Use theirs** alone is correct. If the diff had been ambiguous, the
   next step would be to **download Yours, Theirs, and Base** to inspect
   the underlying files directly before deciding.
4. Manually combine both sets of changes into a single worksheet (outside
   OpenL Studio, in a suitable spreadsheet editor), then **Upload merged
   file** to resolve the conflict with both changes intact.
5. **Re-run the full project test suite** against
   the merged state — the incoming change to `accountCode` exclusions could
   affect test cases that were passing before the merge, even though it
   didn't touch the row you added.
6. Only once tests confirm 0 failures on the merged state, save with a
   comment noting the merge, and confirm the revision incremented.
7. Later, once the task's own edits are complete and tested, **send your
   updates** to push the branch's changes back to the shared repository.

**Contrast — a conflict resolved with "Use theirs":** if step 2's diff had
shown the incoming change already covered everything your local edit was
trying to do (e.g. someone else added the exact same `effectiveDate`
version row first), the correct resolution is **Use theirs** — discard
your redundant local change rather than uploading a merged file that
duplicates it. The distinguishing question is always "does the diff show
both changes are actually needed, or does one side already cover it?" —
never resolve on convenience alone.

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
2. Open the project on that new branch, apply the fix, and run the full
   test suite against it.
3. Save with a comment describing the fix and confirm the revision
   incremented.
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
7. Test, save, and treat this exactly like any other task branch change —
   including syncing it with development per the normal sync discipline.

**Why not just merge:** merging the hotfix branch into development pulls
in only a partial slice of history. Merging development into the
hotfix/released branch is worse — it pulls every unreleased,
in-progress change into a branch about to deploy to production. Two
independent, deliberate changes avoid both.

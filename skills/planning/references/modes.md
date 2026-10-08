# OpenL Change Planning — Modes

Read the section that applies: a local repository, a request to continue an
earlier task, or a request to reapply logged changes.

## Local WebStudio mode

When the target repository is local:

- Read and write a local project only through the connection to the Studio
  that holds it; never write to another Studio in this mode.
- Do not create, validate, or require a branch, and do not ask about merge or
  sync. Plan items that would call `branching` are omitted and the plan says
  why. If `branching` activates on its own, its branch rules do not apply to
  a local repository.
- `testing` still applies; its pre-test step is: close and reopen the local
  project, check compilation, run. Report the local revision instead of a
  branch revision.
- Missing project guidance never blocks planning or reading tables. Inspect the live project instead and say that
  its documentation is missing. Creating an `AGENTS.md` is optional and only
  as an approved plan item.
- Keep every other safeguard unchanged: one approval before writes, minimal
  edits, readback after every write, compilation, tests on the saved state,
  and nothing reported as done with failures.
- Start the change log before the first write when the local workbook is
  expected to be refreshed from the repository before the work is merged (a
  change log trigger in `planning`): the refresh replaces the working state,
  and the log is what makes reapplication possible.


## Resume

To continue a task in a new session:

1. Find its `plan.md` (the change log folder, or ask the user for it).
2. Reopen the projects on the latest revision (step 2).
3. Check only the items marked done against the live project — a key-scoped
   read per item, not a full re-read — and the change log if there is one.
4. Continue from the first unmarked item. Never redo a marked item; if the
   live state disagrees with a mark, report it and ask. A Finish item counts
   as done only when the merge is confirmed on the target.

The original approval still covers the remaining unchanged items. Any change
to them needs a restated plan.


## Reapplication

After a merge conflict, a project refresh, a replaced local state, or for a
backport:

1. Make the projects ready (step 2) and detect the mode (step 3). In remote
   mode, name the target branch: the existing task branch, or the base branch
   a new one will be created from.
2. Call `change-log-and-reapply` in reapply mode for the read-only preflight
   on that branch's latest revision.
3. On a conflict, report it and stop. On a clean preflight, present the
   reapplication plan with the approval block, append it to `plan.md`, and
   stop.
4. After approval, track it like any plan (step 9) and close with the
   summary (step 10).


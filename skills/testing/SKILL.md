---
name: testing
description: >
  OpenL Tablets test management — adding test rows, running the suite on the
  saved revision, reading per-row results, diagnosing failures. Use when a
  task's changes are complete, a test fails, a test case must be added or an
  existing row changed, or on "run tests", "did the tests pass", "verify my
  changes", "is it safe to sync or deploy".
---

# OpenL Testing

## Purpose

Add test rows correctly, run tests against the saved revision rather than
Studio's in-memory state, and report results only from verified per-row
data.

## Inputs

| Name | Type | Required | Description |
|---|---|---|---|
| `project` | string | yes | Exact OpenL project name |
| `test_cases` | list | yes for new rows | Confirmed input → expected output pairs (`planning` confirms them) |
| `scope` | string | no | A narrower test table or range, only when the user names it |

## When to use

- All rule changes of a task are saved and the suite must run (once).
- A test fails, a test case must be added, or an existing test row would
  change.
- The user asks whether tests pass or a change is safe to sync or deploy.

## Key concepts

- **Saved revision** — what is committed on the branch (or the reopened
  local project); Studio's in-memory state is not.
- **Per-row detail** — the result of each test row, as opposed to the
  suite's summary count.
- **Terminal compile state** — `ok`, `warnings` or `errors` for the saved
  revision. `idle` or `compiling` means not yet compiled: it says nothing
  about errors.
- **New vs existing test rows** — new rows prove this task; existing rows
  belong to the project.

## Conventions and patterns


- **Tests run on the latest saved revision**, never on unsaved or
  previously reported state.
- **Full suite by default.** Run a narrower scope only when the user names
  it.
- **Once per task.** Under a plan, the suite runs once after all changes and
  their test rows are saved — never between individual edits.
- **Read per-row detail** for every table with rows added in this task and
  every table the summary reports as failing; the summary count alone can
  omit a new row's failure. Other tables need no per-row read.
- **Existing test rows and tables are never edited or removed** without an
  approval that names exactly what changes (or a plan item that names the
  table, row key, and old and new expected value).
- **A green suite does not prove the project compiles.** Studio skips a
  test column it cannot bind — for example an expected field the tested
  method's result does not have — and still passes the row, so that check
  silently disappears. An error in a test table blocks the task like an
  error in a rule.
- **If the tooling cannot do an operation, say so** and name the manual
  OpenL Studio step.

## Add test rows

Add the rows for the confirmed cases after all rule changes are written and
saved, as the last edit items, then save them. Every rule change is covered
by at least one new row. Take inputs from the project's real vocabularies and
datatypes, never invented values. Every expected column must name a field
of the tested method's actual result datatype (read it; a generic helper
may expose fewer fields than the typed one).

## Pre-test sequence

Run it before the task's test run, and again after any change made outside
this session: a sync or receive, another user's save, or the user's own edit
in OpenL Studio. Tests must run on what is really saved on the branch,
including saves made by someone else, and no unsaved work may be lost.

1. **Read the state.** From the project status, take the opened branch, the
   opened revision, and the pending (unsaved) changes. From the branch's
   revision history, take its latest revision.
2. **Pending changes must all be this task's.** If a pending file is one
   this task did not write since its last save (for example, the user
   edited the same project in Studio), stop and ask. Never save, close, or
   discard it on your own: closing a project discards its unsaved changes.
3. **Opened revision is the latest and nothing is pending:** no reopen is
   needed. Go to step 5.
4. **The branch has a newer revision:** someone saved after this session
   opened the project.
   - Nothing pending: reopen on the latest revision.
   - Something pending: stop and ask; saving now could overwrite or
     conflict with that revision.

   Report each newer revision (author, time, comment). If it touches a table
   this task changed or tests, re-read that table before going on. A manual
   edit is kept, never overwritten.
5. **Check compilation of the saved revision.** Wait for a terminal
   compile state and count error-severity messages, including those in
   test tables. With errors, fix, save and recheck before running. If no
   terminal state can be obtained, the compile state is unverified: say so
   and do not infer it from the test results.

In a local WebStudio without branches there is no revision history: close
and reopen the local project instead of steps 1–4.

Between a fix and its re-run in one continuous session, repeat steps 1–4
only if someone else may have changed the project meanwhile; step 5 always
runs.

## On a failure

Classify the cause before changing anything: rule logic, the reference or
lookup data the rule uses, the test's own inputs, or stale project state.

- Rule logic → fix the rule, save, re-run the suite.
- Reference data → report what data is missing or wrong.
- Stale state → run the pre-test sequence and re-run.
- Test inputs → report the mismatch and ask for the named approval above.

## Report

- Total / passed / failed, confirmed by per-row detail where required.
- The tested revision (or "local workspace").
- Compile errors and warnings as measured in step 5 after the final save
  (counts, or "unverified"), even when everything passed.
- For failures: the rows, expected vs. actual, the classified cause, and the
  action for that cause.

## Code examples

Worked examples — the pre-test sequence, reading per-row detail, drilling
into a row failure: [references/reference.md](references/reference.md).

## Anti-patterns

- ❌ Treating "fix the failing tests" as "change the tests"; fix the cause.
- ❌ Suggesting a new expected value to match wrong rule output.
- ❌ Reporting "0 errors" or "compiles" from an `idle`/empty compile status
  or from a passing suite.

## References

- [references/reference.md](references/reference.md) — worked examples.

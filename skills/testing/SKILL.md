---
name: testing
description: >
  OpenL Tablets test management — adding test rows, running tests safely, and
  verifying results for any OpenL project type (offer configuration, rating,
  commission, census, or other). Use proactively whenever tests need to run or
  re-run after any rule change; the user asks whether tests pass or a change
  is safe to save/sync/deploy; a test is failing and needs diagnosis; a new
  test case needs to be added; or the user asks about editing or removing
  existing test rows. Trigger on "run tests", "did the tests pass", "check if
  everything works", "verify my changes", "save and test", "all tests green?",
  or any test-related phrase in an OpenL project context.
---

# OpenL Testing Skill

## Purpose

Teach the agent to manage and trust OpenL Tablets test execution for any
OpenL project type (offer configuration, rating, commission calculation,
census, or otherwise) — adding test rows correctly, running the pre-test
sequence that guards against OpenL Studio's in-memory/saved-state
divergence, and reporting results only from verified, per-row data.

## When to Use

- Whenever tests need to run or re-run after any rule change — this is part
  of the change itself, not optional cleanup.
- The user asks whether tests pass, or whether a change is "safe to
  save/sync/deploy."
- A test is failing and needs diagnosis.
- A new test case needs to be added for a rule change.
- The user asks about editing or removing existing test rows.
- Trigger phrases: "run tests", "did the tests pass", "check if everything
  works", "verify my changes", "save and test", "all tests green?", or any
  test-related phrasing in an OpenL project context.

## Key Concepts

- **Don't trust in-memory or previously reported test results.** Always run
  the full test suite (or the specific tests requested) against the latest
  saved revision on the branch before reporting any result as "tested"
  (see Pre-Test Sequence below).
- **Never trust the summary count alone.** A newly added test row's failure
  can be excluded from it entirely. Always read per-row detail.
- **If the tooling can't complete an operation, say so** — flag the gap
  and point to the manual OpenL Studio step; never fake success or skip it.

## Conventions and Patterns

### Adding Test Rows

- Add a new test row for every rule change, before saving.
- Populate test inputs from the project's actual vocabulary and datatype
  tables — never invented values.
- **Never modify, delete, or remove an existing test row or test
  table/case** without explicit, specific user approval naming exactly
  what changes — e.g. "update test row 5 to expect 60 instead of 30." A
  general instruction like "fix the failing tests" is **not** approval;
  it means find and fix the *rule* that produced the wrong output, not
  the test.

### Pre-Test Sequence (session start, and after any external change)

Reset to a known-good state before trusting the first result you report in
a session — this skill doesn't own saving edits (that's whatever process
or skill handles branch and save discipline in this project), only making
sure tests run against the latest saved revision:

1. **Close the project, then reopen it on the latest branch revision.**
   Required once per session, and again after any change made outside this
   session (a sync/receive, another user's edit) — not before every
   fix-and-retest cycle within one continuous session.
2. **Check compilation status before running tests.** If errors are
   present, fix them, then reopen and recheck before running tests.

### Running Tests and Reading Results

- Run the full project test suite, not just the table you touched.
- Read the **per-row detail view**, never the summary count alone. Every
  row must pass, including rows added this session.
- On any row failure: identify which rule produced the wrong result, fix
  the rule configuration and save it, then **re-run the test suite.** No
  need to close/reopen again within the same continuous session — only at
  session start or after an external change (see Pre-Test Sequence above).

### Reporting

After confirming zero failures in the per-row detail view, report:
- Total / passed / failed counts, read from per-row detail — never from
  the summary alone.
- The revision hash that was actually tested.
- Any compilation warnings, even when all tests passed.

If tests fail, report:
- Which rows failed and what the mismatch was (expected vs. actual).
- What rule fix is needed.
- Never suggest updating test expectations to match incorrect rule output.

## Code Examples

Worked examples described by outcome, not tied to a specific tool/API/
client — use whichever capability is available. Full worked examples
(pre-test sequence, reading per-row detail, drilling into a row failure)
are in [references/reference.md](references/reference.md).

## Anti-Patterns

- ❌ Reporting "all tests passed" from a summary count without opening
  per-row detail.
- ❌ Running the first test of a session, or testing after an external
  change (sync/receive), without first closing and reopening the project
  on the latest revision.
- ❌ Running tests while compilation errors are present.
- ❌ Modifying, deleting, or removing an existing test row or test
  table/case without exact, named approval — including treating
  "fix the failing tests" as approval.
- ❌ Testing a rule fix before saving it.
- ❌ Inventing test input values instead of pulling them from the project's
  real vocabulary/datatype tables.
- ❌ Silently skipping or reporting complete an operation the tooling can't
  perform, instead of flagging it with the manual OpenL Studio step.

## References

- [references/reference.md](references/reference.md) — full worked
  examples: pre-test sequence, reading per-row detail, and drilling into
  a row failure.

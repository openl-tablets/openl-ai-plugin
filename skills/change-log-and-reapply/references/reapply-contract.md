# Reapplication Contract

## Contents

- When to reapply
- Phase 1 — validate and preflight, no writes
- Conflict matrix and similarity rules
- Generated order fields on replay
- Phase 2 — execute after approval
- Reports

## When to reapply

After a merge conflict, a project refresh, a replaced local working state, or
a backport, when the change log must be brought into the latest project state.
Reapplication applies **only the logged changes that are missing** and stops on
anything that disagrees with the log.

## Phase 1 — validate and preflight (read-only)

1. **Validate the artifacts.** Read every phase file as bytes, record a
   SHA-256 digest, parse it, and validate it against this skill's bundled
   schema (never the file's own `$schema` URI). Accept `schemaVersion` 1.5.0 or
   1.6.0. Reject with `INVALID_CHANGE_SET` a file that mixes phases, lacks a
   selector part, repeats a key mutation, carries a generated order field, or
   uses `keyFields` that differ from the domain catalog entry. Never repair the
   file.
2. **Confirm the project.** The live project must match `project.name`. Never
   redirect a log to another project silently.
3. **Read the latest state.** Close and reopen the project on the latest
   revision of the target: in remote mode the `target_branch` (the existing
   task branch, or the base a new branch will be created from); in local mode
   the local project. Record that revision. Rediscover each table by workbook, sheet name, and table name —
   never by a logged id, coordinate, or position. Read the smallest evidence
   that proves presence, absence, uniqueness, and equality, plus merged header
   bands for dimensioned rows.
4. **Preflight the whole log before any write.** Evaluate the structure file
   against live headers and project the post-structure layout in memory. Then
   evaluate the data file against that projection. Each operation is one of:
   - **missing** — its precondition holds; it goes into the reapplication plan;
   - **conflict** — see the matrix below; the whole reapplication stops.
5. **On any conflict, stop before any branch or write.** List every conflict
   found, with expected and observed state, and say the log must be corrected
   or re-recorded. Do not skip, merge, overwrite, or mark anything as already
   applied.
6. **On a clean preflight, build the reapplication plan** in dependency order:
   file digests, the structure phase, the data phase, targets, a save after
   each verified write, and one test run on the final saved revision. Present it through the `planning` skill's template, which
   ends with its approval block, and stop.

## Conflict matrix

| Operation | Precondition | Conflict |
|---|---|---|
| Add row | No row has the same derived key or the same complete semantic state | Key match, full-content match, or ambiguous identity |
| Add column | No column has the same exact expression | Same expression exists (even under another label), or the header is ambiguous |
| Edit row | Exactly one row matches the key and equals `before` | Row absent, several matches, or any field/tuple differs from `before` |
| Remove row | Exactly one row matches the key and equals the logged state | Row absent, several matches, or any field/tuple differs |
| Remove column | Exactly one column matches label and expression | Pair absent, several matches, or expression under another label |

A live row that already equals an edit's `after` still conflicts: it no longer
equals `before`, so the target contains a similar change made independently.
That is exactly the case that must block execution.

Similarity is never fuzzy: same derived key, or same complete semantic state,
compared by `semantic-comparison.md`. If live reads do
not expose enough to decide, report `AMBIGUOUS_LIVE_STATE`.

## Generated order fields on replay

For a table the domain catalog marks with a generated order field:

- **Add** — read the complete live ordering column; assign `1` for an empty
  table, otherwise `max + 1`; never fill a gap. Several adds to one table take
  consecutive values in operation order.
- **Edit** — keep the row's live value.
- **Remove** — never renumber.

Immediately before each such add, recompute the value; if it drifted from the
plan, stop with `ORDER_FIELD_DRIFT`. A missing or non-integer ordering column
is `AMBIGUOUS_ORDER_FIELD_STATE`.

## Phase 2 — execute after approval

1. Quote the approval. Re-read every file and require unchanged digests; if a
   digest changed, rerun Phase 1.
2. Remote mode: create or confirm the task branch through `branching` before
   the first write, and confirm its head still equals the preflighted
   revision (a new branch starts from it). Otherwise rerun Phase 1. Local
   WebStudio mode: no branch; confirm the local revision is unchanged.
3. Apply every structure operation and verify it before starting data.
4. Before each write, re-read the target and compare it with the projected
   state; after each write, read back, compare with the intended state, and
   save, as `branching` requires. Stop on the first mismatch.
5. Compile, then run the full suite on the saved revision through `testing`,
   reading per-row detail; record exact counts and the revision tested.
6. Record the final revision.
7. Update the log: set each reapplied operation's `status: reapplied` with its
   evidence, set `execution.saveRevision`, and append a `reapplied` history
   entry. Update `plan.md`.

After a failure following earlier writes: stop, report the executed and saved
operation ids and any unsaved edit, and ask the user whether to fix forward or
revert. Never roll back automatically.

## Reports

Conflict item:

```text
<order> <id> <action> <elementType> — <workbook> / <sheet> / <table>
Key: <derived key or column label/expression>
Reason: <reason code>
Expected: <precondition or snapshot>
Observed: <live state or cardinality>
Action: correct or re-record the log, then rerun preflight
```

Final status:

```text
REAPPLY_STATUS: INVALID_CHANGE_SET | CONFLICT | AWAITING_APPROVAL | COMPLETE | FAILED
PROJECT: <name> (<remote|local>)
PREFLIGHT: structure <PASS|FAIL|NOT_RUN>, data <PASS|FAIL|NOT_RUN>
MISSING / APPLIED: <n> / <n>
CONFLICTS: <none | list>
TESTS: <exact counts | NOT_RUN>
SAVE: <final revision | NOT_SAVED>
```

`COMPLETE` means every missing operation was applied, verified, and saved,
and the full suite on the final saved revision reported zero failures.

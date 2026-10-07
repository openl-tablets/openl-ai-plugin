---
name: change-log-and-reapply
description: >
  OpenL change log and reapplication — keeps a schema-validated log of every
  applied change of a feature, and reapplies only the missing changes after a
  merge conflict, project refresh, replaced local state, or backport, blocking
  on conflicting or similar changes in the target. Use when a plan starts the
  change log, or for "keep a log of the changes", "reapply the changes", "redo
  the feature after the conflict", "replay the change set", "carry this change
  to another branch".
metadata:
  status: "implemented"
  version: "0.1.0"
---

# OpenL Change Log and Reapply

## Purpose

Some OpenL workbooks cannot be edited in parallel: a conflict or a refresh can
throw away the working state, and the same feature has to be applied again.
This skill keeps a replayable log of the applied changes while the feature is
built, and uses it to reapply only what is missing — never by replaying stale
row positions, never over a conflicting change.

## Inputs

| Name | Type | Required | Description |
|---|---|---|---|
| `mode` | `"log"` \| `"reapply"` | yes | Record changes, or reapply a recorded log |
| `project` | string | yes | Exact OpenL project name |
| `ticket` | string | no | Feature key used for the log folder and `metadata.ticket` |
| `log_folder` | path | reapply: yes | Folder with the structure/data files and `plan.md` |
| `approved_plan` | markdown | log: yes | The plan approved through `planning`; saved as `plan.md` |
| `target_branch` | string | reapply, remote: yes | Branch whose latest revision is preflighted: the existing task branch, or the base a new branch will be created from |

## When to use

- A plan starts the change log, or the user asks to keep a log of changes.
- After a merge conflict, project refresh, or replaced local state; or to
  carry a feature to another branch (backport).

## Key concepts

- **Change log** — the `openl-change-log/<slug>/` folder: `plan.md` plus the
  JSON **change sets** (a structure file and/or a data file).
- **Working folder** — a folder of the user's that outlives the session and
  that a later session can open: the user's local workspace or a folder they
  connected. Never the OpenL project, and never output storage that belongs
  only to the current session.
- **Plan** / **reapplication plan** — what `planning` shows for approval;
  a reapplication plan is appended to `plan.md`, never overwriting it.

- **Approval** belongs to `planning`. Logging adds no approval of its own; a
  reapplication plan is a new plan and gets its own single approval.
- **Domain semantics** (edit order, which tables change together) belong to
  the installed domain catalog skill. This skill records and
  replays; it does not decide what the change should be.
- **Semantic keys** come from the domain catalog skill's key reference,
  when one is installed, then the project's guidance, then the
  smallest proven-unique key.
- **Branches, tests, versions** belong to `branching`, `testing`,
  `versioning`.
- All OpenL reads and writes go through OpenL MCP. Never edit workbook files
  locally.

## Mode: log

1. **Start before the first write.** Create the log folder
   (`openl-change-log/<ticket-or-slug>/`) in the user's working folder
   ([location rules](references/log-contract.md)), save the approved plan as
   `plan.md`, and copy [assets/openl-change-set.schema.json](assets/openl-change-set.schema.json)
   beside it.
2. **After every verified write**, append the operation — purpose, order,
   dependencies, before/after state, evidence — to the structure or data
   file at once (`execution.status: in-progress`), so an interrupted session
   loses nothing. Evidence rules:
   [references/log-contract.md](references/log-contract.md).
3. **Structure first.** Log and verify column changes before taking row
   `before` evidence.
4. **Mark progress in `plan.md`** as items are verified, so the plan remains
   the log of everything planned and the JSON remains the log of everything
   applied.
5. **At the end of the task**, reduce repeated mutations
   ([references/row-chain-normalization.md](references/row-chain-normalization.md)),
   partition the phases ([references/phase-contract.md](references/phase-contract.md)),
   validate, rewrite, re-read, and validate again. Set `execution.status:
   complete`, `saveRevision`, and final test counts.
6. **Report** with the `LOG_STATUS` block from the log contract.

## Mode: reapply

1. **Validate** the files and **confirm the project** — Phase 1 of
   [references/reapply-contract.md](references/reapply-contract.md).
2. **Read the latest state** and **preflight the whole log** without writing.
   Classify each operation as missing or conflicting.
3. **Any conflict → stop.** Report every conflict with expected and observed
   state. This includes a similar change already present in the target.
4. **Clean preflight → reapplication plan** in dependency order, presented
   through `planning` with its approval block. Stop.
5. **After approval**, apply structure then data, one verified write at a
   time, saving after each verified write as `branching` requires; compile;
   run the full suite on the saved revision through `testing`; update the
   log. `planning` tracks the items and writes the summary.
6. **Report** with the `REAPPLY_STATUS` block.

## Conventions and patterns

- Only applied changes go into the JSON log; planned ones live in `plan.md`.
- Never identify a row by row number, MCP id, coordinate, or column range.
- A live row that already equals the logged `after` is a conflict, not
  "already done".
- Save after each verified write (or at the end of a declared save group); run the tests once, on the final saved
  revision. On a failed step, stop, report what is saved, and ask whether to
  fix forward or revert; never roll back automatically and never report a
  partial run as complete.
- If a Draft 2020-12 validator is unavailable, return `FAIL`; do not claim a
  log is complete without validation.

## Code examples

A complete data-phase log with two operations, semantic keys, and dimension
tuples: [references/example.data.openl-changeset.json](references/example.data.openl-changeset.json).

## Anti-patterns

- ❌ Starting the log after the first edit and reconstructing `before` state
  from memory or the current table.
- ❌ Logging a narrative ("added three rows") instead of complete semantic
  snapshots.
- ❌ Fixing or re-splitting a user's log during reapplication.

## References

- [references/log-contract.md](references/log-contract.md) — evidence, keys, values, sequence, validation, `LOG_STATUS`.
- [references/reapply-contract.md](references/reapply-contract.md) — preflight, conflict matrix, execution, `REAPPLY_STATUS`.
- [references/semantic-comparison.md](references/semantic-comparison.md) — how values, rows, columns, and tuples are compared.
- [references/dimension-normalization.md](references/dimension-normalization.md) — merged headers to semantic tuples.
- [references/row-chain-normalization.md](references/row-chain-normalization.md) — reducing repeated mutations.
- [references/phase-contract.md](references/phase-contract.md) — structure and data files.
- [references/example.data.openl-changeset.json](references/example.data.openl-changeset.json) — non-authoritative example (schema 1.6.0).
- [assets/openl-change-set.schema.json](assets/openl-change-set.schema.json) — the bundled schema.

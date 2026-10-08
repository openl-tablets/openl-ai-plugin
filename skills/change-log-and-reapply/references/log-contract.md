# Change Log Contract

## Contents

- What the log is, where it lives
- Evidence before and after every write
- Delta classification and semantic keys
- Generated order fields
- Values and dimensions
- Ordering, phases, and the logging sequence
- Artifact set and validation

## What the log is

The change log is a declarative replay artifact: what a person recognizes in
the OpenL table, plus enough previous state for pessimistic conflict
detection. It is not an MCP transcript, a native project export, or a
spreadsheet diff. It holds **only applied changes**; the approved plan, which
lists every planned change, is saved beside it as `plan.md`.

Location: the user's working folder — a folder that outlives the session and
that a later session can open (the local workspace or a folder the user
connected). With several candidates, use the one the task's files come from,
or ask once. Never place the log inside the OpenL project: it would be saved
and merged with the rules.

```text
openl-change-log/<ticket-or-slug>/
├── plan.md                                  # approved plan snapshot, updated with item status
├── openl-change-set.schema.json             # copy of this skill's asset
├── <slug>.structure.openl-changeset.json    # column operations, only if any
└── <slug>.data.openl-changeset.json         # row operations, only if any
```

If no such folder is writable, keep the log in the session, say at the start
that it lives only in this session and cannot be resumed elsewhere, and deliver
the validated files to the user at the end. Never describe a session-only log
as resumable. Report the log's location in the plan and in the final summary.

## Evidence

Start logging **before the first write**. For every write, keep the smallest
operation-scoped evidence, read through OpenL MCP immediately before and
immediately after it:

| Operation | Before write | After write |
|---|---|---|
| Add row | Semantic selector and a key-scoped read proving zero matching rows | Complete added row and a read proving exactly one match |
| Edit row | Complete affected row and a read proving exactly one match | Complete row after the edit, same key, exactly one match |
| Remove row | Complete affected row and a read proving exactly one match | Key-scoped read proving zero matches |
| Add or remove column | Header and column definition proving prior absence or presence | Header and column definition proving the resulting state |

For a dimensioned row, also keep the merged header bands needed to rebuild its
dimension tuples (`dimension-normalization.md`).
Prefer key-scoped and affected-row reads; a whole-table read is a fallback only
when a narrower read cannot prove presence, absence, uniqueness, or the header
mapping. Never use a workbook or project export as evidence.

Acceptable previous-state sources, in order: the operation-scoped reads above;
an OpenL MCP comparison between a named base revision and the editing
revision; before/after snapshots the user supplied with a named source.
Conversation memory, tests, or a current-state-only export are not evidence.

If logging started late: an addition can still be logged when absence in the
base is proven; an edit or removal cannot. Report `NEEDS_BASE_STATE` with the
affected tables.

## Delta classification

- **Add** — absent before, present after. Rows carry the complete semantic
  `fields` and, when dimensioned, `dimensionValues`. Columns carry label and
  expression.
- **Edit** — rows only. Complete `before` and `after` snapshots, never only the
  changed fields.
- **Remove** — present before, absent after. Keep the complete removed state.

Every operation also records, in schema 1.6.0: `purpose` (one business
sentence), `dependsOn` (ids that must apply first), `status`, and `evidence`
(readback, compile, and focused test counts only if focused tests ran for
that operation). Write `status: verified` only after readback and compilation
passed. The final full-suite result — per-row detail, total/passed/failed, and
the revision tested — goes in `execution.tests` and `execution.saveRevision`.

## Semantic keys

`keyFields` names the stable business fields whose values, taken from the row
state, find exactly one logical row. It holds names, never values.

Source of the key, in order:

1. The **semantic-key catalog of the domain**, owned by the domain catalog
   skill, when one is installed. Copy the listed names exactly, in catalog
   order.
2. A project-specific key documented in the project's guidance.
3. Otherwise the smallest stable, user-visible set of fields proven unique by
   the evidence.

Never use generated UUIDs, MCP row or table ids, row numbers, cell addresses,
or positional indexes. A change of a key field's value is a remove under the
old key followed by an add under the new key. If no compliant key is unique,
return `FAIL` with `AMBIGUOUS_SEMANTIC_KEY`.

## Generated order fields

Some tables expose a numbered column that only reflects physical order (for
example `Rule` or a test table's `_id_`). The catalog is the only source that
says which table has one. Exclude it from `keyFields`, `fields`,
`before.fields`, and `after.fields`. Reapplication derives it from the live
table for adds; edits and removals never change it.

## Values and dimensions

- Store values as JSON string, number, boolean, or null exactly as the table
  exposes them. No objects, arrays, or MCP wrappers.
- The optional `type` is only the JSON literal kind. Formatted text stays a
  string without `type`. A collection such as `AK, AL, AR` stays a string.
- For dimensioned tables, ordinary fields go in `fields`; value-column data
  goes in `dimensionValues` under complete tuples. A confirmed blank header
  is `""` and means wildcard; `null` or an omitted dimension is invalid.
  Details: `dimension-normalization.md`.

## Ordering, phases, and sequence

Give each operation a positive, unique `order` in dependency order — for
example vocabulary registration before the Product Specific Attribute, and a
result column before rows that fill it. Column operations go to the structure
file, row operations to the data file
(`phase-contract.md`); structure always comes first.

Logging sequence:

1. Log structure evidence and apply structure changes; verify the new layout.
2. Take row `before` evidence against the verified post-structure layout.
3. Apply and verify row changes.
4. Reduce repeated mutations of the same key
   (`row-chain-normalization.md`).
5. Append each verified operation to its phase file as you go; at the end
   reduce, partition, validate, and rewrite the files.

Do not log row snapshots against a layout that a later structure change will
alter. If that order cannot be proven, return `NEEDS_BASE_STATE`.

## Artifact set and validation

Write `schemaVersion: "1.6.0"` and `$schema: "./openl-change-set.schema.json"`.
Never write an empty phase file or a file mixing phases.

Intermediate appends must parse and carry `execution.status: in-progress`.
Before the final rewrite, and again after re-reading the written bytes, every
file must:

- parse as JSON and pass the bundled schema with a Draft 2020-12 validator;
- have positive, unique `order` values and a non-empty `purpose` on every
  operation;
- give every target `workbook`, `sheetName`, and `tableName`;
- use duplicate-free `keyFields` that exist in the row state and, for a
  cataloged target, equal the catalog entry;
- contain no generated order field in keys or snapshots;
- have complete `before`/`after` for edits, complete state for removes, and
  every written field for adds, test rows included (inputs and expected
  values), not only the key;
- have complete, unique dimension tuples;
- contain no live ids, coordinates, ranges, or MCP wrappers;
- hold at most one effective mutation per target and derived key.

If a validator is unavailable, or any check fails, return `FAIL` and write
nothing (or remove what was written). Report:

```text
LOG_STATUS: COMPLETE | NEEDS_BASE_STATE | FAIL
LOCATION: <folder or delivered-as-download>
STRUCTURE_FILE: <path | NOT_WRITTEN>
DATA_FILE: <path | NOT_WRITTEN>
OPERATIONS: <n> add, <n> edit, <n> remove
VALIDATION: schema <PASS|FAIL|NOT_RUN>, semantic <PASS|FAIL|NOT_RUN>
OPEN_ITEMS: <none | blockers>
```

---
name: versioning
description: >
  OpenL Tablets table versioning — adding version properties to tables
  (effectiveDate, startRequestDate, lob, state, currency, etc.), creating new
  table versions, configuring runtime context, file naming conventions, and
  writing tests for versioned tables. Use proactively whenever a user asks to
  make a rule effective from a certain date; a new rate, factor, or
  configuration should apply starting on a specific date; a user mentions
  "effective date", "version", "new version of the table", "applicable
  from", "starting from", or "replace rates as of"; tables need to be
  segmented by LOB, state, country, or currency using versioning
  properties; or a user asks how to test different date scenarios.
---

# OpenL Table Versioning Skill

## Purpose

Teach the agent how OpenL Tablets' built-in table versioning works —
multiple time- or dimension-scoped copies of the same table coexisting in a
project — and how to add a new version correctly: via the `properties` row,
the OpenL Studio "New Business Dimension Version" copy workflow, correct file
naming conventions (when the project uses them), and test coverage across
both the old and new ranges. Full property tables, schemas, and worked
examples live in [references/reference.md](references/reference.md).

## When to Use

- A user asks to make a rule effective from a certain date.
- A new rate, factor, or configuration should apply starting on a specific
  date.
- A user mentions "effective date", "version", "new version of the table",
  "applicable from", "starting from", or "replace rates as of".
- Tables need to be segmented by LOB, state, country, or currency
  using versioning properties.
- A user asks how to test different date scenarios against a versioned
  table.

## Key Concepts

- **Versioning properties can be declared at three levels**: table (a
  `properties` section after the header row — first cell `properties`,
  **one `<propertyName> | <value>` pair per row**, additional properties
  as additional rows underneath, dates as `MM/DD/YYYY`), category, or
  module. Check for an inherited category-/module-level property before
  concluding a table with no `properties` row is unversioned. A module's
  properties can also be *set* via its file or folder name instead of a
  module-level Properties table, but never both — see File Naming below.
  Full hierarchy and examples: [references/reference.md](references/reference.md).
- **When levels conflict, the more specific one wins**: table > category >
  module. File/folder name extraction is not a fourth level above or below
  module — it's an alternate way to *declare* module-level properties, and
  OpenL prohibits declaring the same property both there and in the
  module's own Properties table. Confirm edge cases against the references
  if it matters for the task.
- **Resolution is most-specific-match, not first-match.** OpenL picks the
  version whose properties most closely match the runtime context.
- The common versioning properties (`effectiveDate`, `state`, `lob`,
  `currency`, etc.) and the exact context variable each one matches are
  listed in [references/reference.md](references/reference.md) — the most
  frequent combination is `effectiveDate` alone, or `effectiveDate` +
  `startRequestDate`.
- **Default to binding context on the Datatype model**, not the REST API
  attribute. A Datatype field suffixed `: context.<contextVar>`
  auto-populates from runtime context. Reach for this before the raw
  `runtimeContext` REST attribute below. See
  [references/reference.md](references/reference.md) for a worked example.
- **Confirm runtime context is enabled per project** (Rules Deploy
  Configuration → **Provide runtime context**) before relying on either
  the Datatype-binding pattern or versioned-table property matching. Only
  fall back to passing `runtimeContext` explicitly as a REST API attribute
  when no Datatype binding covers the value you need — see the full schema
  in [references/reference.md](references/reference.md).
- **If the tooling can't complete an operation, say so** — flag the gap
  and point to the manual OpenL Studio step; never fake success or skip it.

## Conventions and Patterns

### Choosing a Versioning Level (Default: Table)

Default to a **table-level** `properties` row without asking, but only
once the task is confirmed to be scoped to that one named table — that is
the narrow, low-impact default, not an excuse to skip confirming scope
altogether.

Category- or module-level Properties apply to **every table** in that
category/module — a much larger blast radius. **Get the user's explicit
confirmation before applying a change at category or module level**, even
on a project that already uses that convention for other properties.
Checking for an inherited category-/module-level property (see Key
Concepts) is still fine to do silently — that's read-only; it's *writing*
a new or changed property at that broader scope that needs confirmation.

### Creating a New Version of a Table

When rates or rules change on a future date, create a **new copy** of the
table. Never edit the existing one in place.

1. In OpenL Studio, open the module containing the table to version.
2. Click the **Copy Table** icon, then **Copy as → New Business Dimension
   Version**.
3. Set the new `effectiveDate` (and any other properties) in the dialog,
   confirm the target workbook/worksheet, and click **Copy**.
4. Edit the new copy's data rows with the updated values.
5. Do not change the table name or signature — they must match the
   original exactly.

The two tables (old and new version) coexist; OpenL selects between them at
runtime based on context.

### File Naming (Only If the Project Uses It)

File name (and folder name) extraction is an **alternate way to declare
module-level properties** — see Key Concepts above — not a fourth
precedence level. **Never declare the same property both in the filename
pattern and the module's Properties table**; OpenL treats that as a
conflict to avoid, not a "more specific wins" case. Only touch a project's
filename pattern (`ProjectName-CW-YYYYMMDD-YYYYMMDD.xlsx`-style) if it
already uses file-based property extraction, or the user explicitly asks
to split rules into separate files per dimension value. Adding a new
table-, category-, or module-level property never by itself implies a
filename pattern change. Full pattern syntax and correct/wrong examples:
[references/reference.md](references/reference.md).

### Testing Versioned Tables

Add a context column to the test table — prefix `_context_.` + the context
variable name (e.g. `_context_.currentDate`) — so each test row exercises
its own date/dimension scenario independently. See
[references/reference.md](references/reference.md) for the full list of
context test column names and a worked test table.

### Checklist: Adding a New Version of an Existing Table

1. ⬜ Create an isolated task branch, following this project's branch
   discipline.
2. ⬜ Confirm the versioning level: default to table-level for a
   single-table task; get the user's explicit confirmation first if this
   would apply a category- or module-level change (see "Choosing a
   Versioning Level" above).
3. ⬜ Open the module containing the current table version.
4. ⬜ Copy the table as **New Business Dimension Version**.
5. ⬜ Set `effectiveDate` (and any other properties) on the new copy.
6. ⬜ Update the data rows in the new copy — leave the old copy unchanged.
7. ⬜ Verify the table name and signature are identical between versions.
8. ⬜ Add or update test rows covering both the old date range and the new
   one, following this project's test-management process.
9. ⬜ Run tests — confirm each date range returns the expected values.
10. ⬜ Save → confirm the revision incremented on the branch.

## Anti-Patterns

- ❌ Editing an existing table version in place instead of copying a new
  version.
- ❌ Changing the table name or signature between the old and new version —
  they must match exactly.
- ❌ Prepending the property name as a literal label in a filename or
  filename pattern (e.g. `-Country-US-` instead of `-US-`).
- ❌ Adding a new dimension value to the filename pattern just because a new
  table-, category-, or module-level property was added.
- ❌ Concluding a table is unversioned just because it has no `properties`
  row of its own — check for an inherited category- or module-level
  property before drawing that conclusion.
- ❌ Adding a new version without adding/updating test rows for **both** the
  old date range and the new one.
- ❌ Assuming `runtimeContext` is available on the REST API without first
  confirming **Provide runtime context** is checked in the project's Rules
  Deploy Configuration.
- ❌ Reaching for the raw `runtimeContext` REST attribute as the first
  option instead of a Datatype context-binding field.
- ❌ Asking the user which property level (table/category/module) to use
  for a routine single-table version bump instead of defaulting to
  table-level and checking the existing project convention first.
- ❌ Applying a category- or module-level property change — which affects
  every table in that category/module — without first getting the user's
  explicit confirmation, even on a project that already uses that
  convention elsewhere.
- ❌ Silently skipping or reporting complete an operation the tooling can't
  perform, instead of flagging it with the manual OpenL Studio step.

## References

- [references/reference.md](references/reference.md) — full versioning
  property table, the table/category/module property-inheritance hierarchy,
  runtime context REST schema, Datatype context-binding example,
  file-naming pattern reference, and the complete context test-column list
  with a worked example.

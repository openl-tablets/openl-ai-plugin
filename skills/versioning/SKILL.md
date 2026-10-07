---
name: versioning
description: >
  OpenL Tablets table versioning — version properties (effectiveDate,
  startRequestDate, lob, state, currency), new table or module versions,
  runtime context, file naming, and tests for versioned tables. Use
  proactively when a rule, rate, or configuration must apply from a date or
  per LOB/state/country/currency, or on "effective date", "new version of the
  table", "applicable from", "starting from", "replace rates as of".
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

## When to use

- A rule, rate, or configuration must apply from a date, or per LOB, state,
  country, or currency.
- Adding a new table or module version, setting runtime context, or testing
  date scenarios.

## Key concepts

Details and examples for each point: [references/reference.md](references/reference.md).

- **Three levels:** table (a `properties` section after the header — one
  `<propertyName> | <value>` pair per row, dates `MM/DD/YYYY`), category,
  module. A module's properties may be declared by its file/folder name
  instead of a module Properties table, never both. Check inherited
  properties before calling a table unversioned.
- **More specific wins:** table > category > module. Resolution is
  most-specific-match, not first-match.
- **Common properties:** `effectiveDate` alone, or with `startRequestDate`;
  the full list and their context variables are in the reference.
- **Bind context on the Datatype** (`: context.<contextVar>` field suffix)
  before passing `runtimeContext` through the REST API.
- **Runtime context must be enabled** for the project (Rules Deploy
  Configuration → Provide runtime context).
- **If the tooling can't complete an operation, say so** and name the
  manual OpenL Studio step; never fake success.

## Conventions and patterns

### Choosing a Versioning Level

**Follow the level the project already uses.** If `rules.xml` declares a
filename pattern (for example `.*-%state%-%effectiveDate%-%startRequestDate%`),
the project versions whole modules: a new version is a new module, created
as described in [Creating a New Version of a Module](#creating-a-new-version-of-a-module).
Do not add table-level version properties inside such a module and do not
create "New Business Dimension Version" table copies there — versioning the
same property at module and table level at the same time adds nothing and
hides which version wins.

Only when the project does not version by module, default to a
**table-level** `properties` row without asking, but only
once the task is confirmed to be scoped to that one named table — that is
the narrow, low-impact default, not an excuse to skip confirming scope
altogether.

Category- or module-level Properties apply to **every table** in that
category/module — a much larger blast radius. **Get the user's explicit
confirmation before applying a change at category or module level** — as a
question in the plan when `planning` is in use — even on a project that
already uses that convention for other properties.
Checking for an inherited category-/module-level property (see Key
Concepts) is still fine to do silently — that's read-only; it's *writing*
a new or changed property at that broader scope that needs confirmation.

### Creating a New Version of a Module

Use this when the project versions by module filename.

1. Find the latest existing file of that module family (each family —
   for example Settings and Configuration — has its own dates; never derive
   one family's name from another's).
2. Copy the **whole module file** to the new name (for example
   `Defaults-CW-20270101-20261201.xlsx`). Do not rebuild the module
   by copying tables one by one: a table copy makes a table version and
   requires table-level version properties.
3. Make the period's changes in the new module only. The old module stays
   unchanged.
4. Compile: both modules now define the same tables with the same
   signatures; OpenL selects between them by the filename properties.

### Shared (unversioned) modules and files

Modules excluded from the filename pattern (typically `.*Model`, `.*Tests`,
`.*API`) and files that are not modules (`i18n/*.properties`, `AGENTS.md`,
descriptors) are shared by **every** version. A change there applies to all
periods, not only the new one:

- a new vocabulary value is known before its effective date — for example a
  domain-validation message starts listing it in the old period too;
- a new datatype field must compile against every version of every module
  that constructs that datatype;
- a new message key is visible to all periods.

List each shared change in the plan as a risk with its effect on the old
period, and prove the old period with tests. If a change must not reach the
old period, it belongs in the versioned module instead.

### Creating a New Version of a Table

When rates or rules change on a future date, create a **new copy** of the
table. Never edit the existing one in place.

1. Copy the table as a **New Business Dimension Version** through the
   OpenL tooling (the Studio UI fallback: Copy Table → Copy as → New
   Business Dimension Version), into the intended workbook and worksheet.
2. Set the new `effectiveDate` and any other properties on the copy.
3. Edit the new copy's data rows with the updated values.
4. Keep the table name and signature identical to the original.

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

### Testing Versioned Tables and Modules

**Every test row can carry its own date.** Add a context column to the test
table — prefix `_context_.` + the context variable name (e.g.
`_context_.currentDate`, `_context_.requestDate`) — or set the request field
that is bound to the context (for example `effectiveDate : context.currentDate`),
so each row exercises its own date scenario. Cover the old and the new period
in the same test table with per-row dates rather than separate helper tables.
Before relying on existing test helpers, check that they do not hard-code a
date: a helper that always passes a fixed date only ever reaches one version. See
[references/reference.md](references/reference.md) for the full list of
context test column names and a worked test table.

### Checklist: Adding a New Version of an Existing Table

Branch, saves, and the test run follow `planning`, `branching`, and
`testing`; this checklist covers only the versioning items.

1. ⬜ Confirm the versioning level: the project's existing level first
   (module filename → follow "Creating a New Version of a Module" instead of
   this checklist); otherwise table-level for a single-table task; get the
   user's explicit confirmation first if this would apply a category- or
   module-level change (see "Choosing a Versioning Level" above).
2. ⬜ Copy the table as **New Business Dimension Version**.
3. ⬜ Set `effectiveDate` (and any other properties) on the new copy.
4. ⬜ Update the data rows in the new copy — leave the old copy unchanged.
5. ⬜ Verify the table name and signature are identical between versions,
   then save.
6. ⬜ After all changes: test rows covering both the old and the new date
   range, with a `_context_.` column per scenario.

## Code examples

In [references/reference.md](references/reference.md): a versioned table
with a `properties` row, context-bound Datatype fields, the runtime context
REST schema, file-naming patterns, and context test columns.

## Anti-patterns

- ❌ Versioning the same property at module level (filename) and table level
  at the same time, or adding table-level version properties inside a module
  that is already versioned by filename.
- ❌ Assuming a change to a shared module (Model, Tests, i18n) affects only
  the new period.

- ❌ Editing an existing table version in place, or changing the table name
  or signature between versions.
- ❌ Writing the property name into a filename (`-Country-US-` instead of
  `-US-`), or changing the filename pattern only because a new table-,
  category-, or module-level property was added.

## References

- [references/reference.md](references/reference.md) — full versioning
  property table, the table/category/module property-inheritance hierarchy,
  runtime context REST schema, Datatype context-binding example,
  file-naming pattern reference, and the complete context test-column list
  with a worked example.

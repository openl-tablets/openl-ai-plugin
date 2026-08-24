# OpenL Table Versioning — Reference

Deep technical reference for `versioning`. Read from the skill's
SKILL.md; this file holds the full property tables, schemas, and
worked examples that don't need to live inline.

## Table of Contents

- [A Versioned Table with a `properties` Row](#a-versioned-table-with-a-properties-row)
- [Versioning Properties and Matching Context Variables](#versioning-properties-and-matching-context-variables)
- [Property Levels and Precedence](#property-levels-and-precedence)
- [Context-Bound Datatype Fields](#context-bound-datatype-fields)
- [Runtime Context — REST API Schema](#runtime-context--rest-api-schema)
- [File Naming Convention for Versioned Modules](#file-naming-convention-for-versioned-modules)
- [Context Test Columns — Full Reference](#context-test-columns--full-reference)

## A Versioned Table with a `properties` Row

Effective-date-only versioning — a single property, so the `properties`
section is one row:

```text
| SimpleRules Double DiscountRate ( ProductCategory productCategory ) |
| properties   | effectiveDate      | 01/01/2020             |
|--------------|--------------------|-----------------------|
| Electronics         | $150                                |
| Furniture           | $130                                |
```

A second copy of the same table with `effectiveDate = 01/01/2022` replaces
this one once `currentDate >= 2022-01-01`; both versions stay in the
project simultaneously.

**One property/value pair per row** — adding a second property (e.g. also
scoping this version to one US state) means adding a second row
underneath the first, not a second pair of columns on the same row. The
`properties` label occupies the first column only once — it's a single
cell merged down over every property row, so later rows leave that first
column blank:

```text
| SimpleRules Double DiscountRate ( ProductCategory productCategory ) |
| properties   | effectiveDate      | 01/01/2020             |
|              | state              | NY                     |
|--------------|--------------------|-----------------------|
| Electronics         | $150                                |
| Furniture           | $130                                |
```

Category-level and module-level Properties tables are a different table
type, not a scaled-up `properties` row — see
[Property Levels and Precedence](#property-levels-and-precedence) below
for their required header structure (`Properties` reserved word, `scope`,
and `category`).

## Versioning Properties and Matching Context Variables

| Property name in table | Matches context variable | Type | Meaning |
|---|---|---|---|
| `effectiveDate` | `currentDate` | Date | Table is active on/after this date |
| `expirationDate` | `currentDate` | Date | Table is active **through and including** this date — inactive the day after |
| `startRequestDate` | `requestDate` | Date | Rule applies to requests on/after this date |
| `endRequestDate` | `requestDate` | Date | Rule applies to requests before this date |
| `lob` | `lob` | String | Line of business |
| `state` | `usState` | Enum | US state |
| `country` | `country` | Enum | Country |
| `usregion` | `usRegion` | Enum | US region |
| `currency` | `currency` | Enum | Currency |
| `lang` | `lang` | Enum | Language |
| `region` | `region` | Enum | Economic region |
| `caProvinces` | `caProvince` | Enum | Canada province |
| `caRegions` | `caRegion` | Enum | Canada region |
| `nature` | `nature` | String | User-defined business value |

The most common combination is `effectiveDate` alone (time-only
versioning), or `effectiveDate` + `startRequestDate` (rate effective date
plus request date).

## Property Levels and Precedence

A `properties` row on an individual table (see the example above) is the
most specific way to declare a versioning property, but it is not the only
one. OpenL resolves the same set of properties from **three levels**:

| Level | How it's declared | Applies to |
|---|---|---|
| Table | `properties` row inside the table itself | That one table only |
| Category | A Properties table declared once for a category | Every table in that category |
| Module | A Properties table declared once for a module — or, as an alternate declaration mechanism, extracted from the module's file or folder name (`%propertyName%` placeholders — see below) | Every table in that module |

**A table's effective properties are the merge of every level that applies
to it.** When the same property name is declared at more than one level,
the more specific level wins: table-level overrides category-level, which
overrides module-level. File/folder name extraction is not a separate,
broader level — it's an alternate way to set a module-level property, and
OpenL does not allow the same property to be declared both in the
filename/folder pattern and the module's own Properties table; treat that
as a conflict to avoid, not something with a defined override order. This
is the general OpenL precedence principle for overlapping property values;
if a task depends on an exact edge case (for example, two non-overlapping
properties declared at different levels combining rather than one
overriding the other), confirm against the project's own internal
versioning documentation rather than assuming.

**Practical consequence for an agent working on a versioned table**: a
table with no visible `properties` row is not necessarily unversioned — it
may inherit its versioning properties from its category or module. Before
concluding a table has no versioning behavior, check whether it belongs to
a category or module that carries its own Properties table.

Category-level and module-level Properties tables are their own table
type, not a table-level `properties` section scaled up — they need extra
header rows a table-level `properties` row never has:

| Row | Content |
|---|---|
| Header | The reserved word `Properties`, optionally followed by a Java identifier (exposes this table's values in rules as a field of that name, typed `TableProperties`) |
| `scope` | `Module` — inherited by every table in the module; only one `Module`-scope Properties table is allowed per module — or `Category` — inherited by every table whose category matches |
| `category` | Required only when `scope` is `Category`; names the category. If omitted, the category defaults to the worksheet name |
| Property rows | One `<propertyName> \| <value>` pair per row (dates as `MM/DD/YYYY`), same shape as a table-level `properties` section — these are the properties being declared at this level |

A table-level `properties` row has none of the `Properties`/`scope`/
`category` header rows — it's only the property-name/value pairs from the
last table above.

## Context-Bound Datatype Fields

**This is the preferred, default pattern** for exposing runtime
context values to rule logic — prefer it over passing `runtimeContext`
explicitly as a REST API attribute (see the next section) whenever a
Datatype field can carry the value instead.

A Datatype field suffixed with `: context.<contextVar>` is auto-populated
from the matching runtime context variable instead of from the caller:

```text
| Datatype Order                                           |
| String       | orderNumber                               |
| Date         | rateEffectiveDate : context.currentDate   |
| Date         | requestDate : context.requestDate         |
| State        | customerState : context.usState           |
| Integer      | accountCode                                |
```

Rely on the `: context.<contextVar>` suffix as the signal that a field is
context-bound — not the UI highlight color OpenL Studio may render it
with, which is theme-dependent and not authoritative.

## Runtime Context — REST API Schema

Available once **Provide runtime context** is checked in the project's
Rules Deploy Configuration (OpenL Studio Repository view → project → **Rules
Deploy Configuration** tab). This is required infrastructure regardless of
consumption pattern — both the Datatype-binding approach above and
versioned-table property matching depend on it — but treat passing
`runtimeContext` explicitly as a REST API attribute as the **fallback**,
used only when no Datatype context binding covers the value needed:

```json
{
  "runtimeContext": {
    "currentDate": "2022-04-07T11:28:41.878Z",
    "requestDate": "2022-04-07T11:28:41.878Z",
    "lob": "string",
    "nature": "string",
    "usState": "AL",
    "country": "AE",
    "usRegion": "MW",
    "currency": "ALL",
    "lang": "ALB",
    "region": "NCSA",
    "caProvince": "AB",
    "caRegion": "QC"
  }
}
```

## File Naming Convention for Versioned Modules

Only relevant when a project encodes version info in module filenames:

```text
ProjectName-CW-YYYYMMDD-YYYYMMDD.xlsx
```

Example: `Pricing Model-CW-20210101-20210101.xlsx`. Here `CW` is an OpenL
convention for "country-wide" (i.e. no state/province segmentation) —
not a placeholder to substitute with a property value. The `-CW-` segment
followed by two dates encodes the effective window. Configure extraction at
Repository view → edit (pencil) icon next to the project name → **Properties
patterns for a file name**, e.g.:

```text
.*-%state%-%effectiveDate%-%startRequestDate%
.*Tests
.*Model
```

The first pattern extracts `state`, `effectiveDate`, and `startRequestDate`
from versioned module filenames; `.*Tests` and `.*Model` are exclusion
patterns for files never versioned by filename.

**Filenames carry property VALUES only, never property names:**

| ✅ Correct filename | ❌ Wrong filename |
|---|---|
| `MyModule-US-20270101-20270101.xlsx` | `MyModule-Country-US-20270101-20270101.xlsx` |
| `MyModule-AL-20270101-20270101.xlsx` | `MyModule-State-AL-20270101-20270101.xlsx` |

Same rule for filename **patterns** — use `%propertyName%` as the value
placeholder, never the property name as a literal label:

| ✅ Correct pattern | ❌ Wrong pattern |
|---|---|
| `.*-%country%-%effectiveDate%-%startRequestDate%` | `.*-Country-%country%-%effectiveDate%-%startRequestDate%` |
| `.*-%lob%-%effectiveDate%-%startRequestDate%` | `.*-LOB-%lob%-%effectiveDate%-%startRequestDate%` |

File/folder name extraction is an alternate way to declare module-level
properties (see "Property Levels and Precedence" above), not a fourth
level of its own. Never let the same property be set both by the filename
pattern and by a module-level Properties table — OpenL doesn't define an
override order for that case, it's a conflict to avoid. Only touch the
filename pattern if the project already uses file-based property
extraction, or the user explicitly asks to split rules into separate
files per dimension value.

## Context Test Columns — Full Reference

The `_context_` column represents the whole `IRulesRuntimeContext` object as
a single compound field, so its individual properties are addressed with
OpenL's standard dot notation for nested fields: `_context_.` followed by
the context variable name, e.g. `_context_.currentDate`. Each data row sets
the context for that test case independently:

| Test column header | Context variable set |
|---|---|
| `_context_.currentDate` | `currentDate` → selects by `effectiveDate`/`expirationDate` |
| `_context_.requestDate` | `requestDate` → selects by `startRequestDate`/`endRequestDate` |
| `_context_.lob` | `lob` |
| `_context_.usState` | `usState` → selects by `state` |
| `_context_.country` | `country` |
| `_context_.usRegion` | `usRegion` |
| `_context_.currency` | `currency` |
| `_context_.lang` | `lang` |
| `_context_.nature` | `nature` |
| `_context_.region` | `region` |
| `_context_.caProvince` | `caProvince` → selects by `caProvinces` |
| `_context_.caRegion` | `caRegion` → selects by `caRegions` |

Worked example — a test table exercising two date ranges of the same
versioned table:

```text
| Test DiscountRate DiscountRateTest                                |
| _context_.currentDate   | productCategory   | _res_               |
| Current Date            | Product Category  | Price               |
| 06/19/2020              | Electronics       | $150                |
| 06/19/2022              | Electronics       | $160                |
| 08/21/2021              | Furniture         | $130                |
| 08/21/2022              | Furniture         | $140                |
```

The display label row ("Current Date") directly under the header is
optional but good practice for readability.

**Cover the `expirationDate` boundary explicitly.** Because a table stays
active *through and including* its `expirationDate`, add one test row
where `_context_.currentDate` equals that exact date (still expected to
match the expiring version) and one row for the day after (expected to
match the next version, or no active version if there isn't one). Don't
rely on rows that only test dates well inside or well outside the range —
the boundary itself is what regresses silently.

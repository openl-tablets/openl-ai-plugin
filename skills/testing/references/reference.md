# OpenL Testing — Reference

Deep technical reference for `testing`. Read from the skill's
SKILL.md; this file holds the full worked examples that don't need to
live inline.

## Table of Contents

- [Pre-Test Sequence for a Rule Change](#pre-test-sequence-for-a-rule-change)
- [Running the Full Suite and Reading Per-Row Detail](#running-the-full-suite-and-reading-per-row-detail)
- [A Row Failed — Drill In, Fix, Save, Re-Run](#a-row-failed--drill-in-fix-save-re-run)
- [Test Table Special Columns](#test-table-special-columns)
- [Expected-Error Rows: `_error_`](#expected-error-rows-_error_)
- [Multi-Column Results for Nested and Array Return Types](#multi-column-results-for-nested-and-array-return-types)
- [Blank Result Cells Are an Assertion](#blank-result-cells-are-an-assertion)
- [Bulk Input Reference: `>DataTableName`](#bulk-input-reference-datatablename)
- [Data-Validation Self-Check Tables](#data-validation-self-check-tables)

These are worked examples of the workflow, described in terms of the
outcome each step must produce — not tied to any specific tool, API, or
client. Use whichever capability is actually available (MCP tools, REST
API, OpenL Studio UI) to achieve each step; the sequence and the checks
are what matter.

## Pre-Test Sequence for a Rule Change

Worked example for a discount-eligibility rule change (the rule change
and its save already happened, following this project's branch/save
process):

1. Close the project.
2. Reopen it on the same branch at its latest revision.
3. Check the project's compilation status. If any error-severity messages
   are present, stop and fix them before running tests.

## Running the Full Suite and Reading Per-Row Detail

1. Trigger the project's full test run.
2. Read the detailed, per-table test results — not just the aggregate
   pass/fail summary.
3. Confirm every table shows 0 failures, including any table containing a
   row added this session.

## A Row Failed — Drill In, Fix, Save, Re-Run

1. Read the detailed results scoped to just the failing table (e.g.
   `TT_DiscountEligibility`) to see the mismatch.
2. Fix the rule configuration that produced the wrong output and save
   it — never adjust the test's expected value.
3. Re-run the test suite in place — no need to close/reopen again within
   this same session.

## Test Table Special Columns

Two optional columns identify and label individual test cases:

- **`_id_`** — a numeric case identifier. Gaps in the sequence (e.g. 5, 6,
  8) are normal — cases get removed over time and are not renumbered.
  A gap is not a sign of a missing or corrupted row.
- **`_description_`** — a human-readable case name, e.g. "MinMax
  validation failed less than min." When reporting a failure, quote
  `_id_`/`_description_` if the table has them, instead of only a raw
  row number — it is far more useful to the user.

A label row directly under the header row (before the first data row)
holds human-readable column labels (e.g. "Test Case", "Monthly Premium")
instead of test data. Recognize it by position, not content, and skip it
when reading actual input/expected values.

## Expected-Error Rows: `_error_`

An optional `_error_` column marks rows where the correct, passing
behavior is that the rule **throws** a specific error — not that it
returns a value. When `_error_` is present on a row:

- All `_res_*` columns for that row are typically blank.
- The row passes when the rule raises an error whose message matches
  the `_error_` cell.
- **Check for `_error_` before treating any exception as a defect.**
  An exception on a row with a matching `_error_` value is the test
  passing, not a bug to fix. Only rows with no `_error_` value are
  expected to complete without raising.

Worked example — a table validating that an out-of-domain input is
rejected:

```
| Test ValidateAction                                                    |
| actionCode | _error_                                                   |
| Fake       | Value 'Fake' is outside of valid domain 'ActionCode'.     |
|            |                                                           |
    Valid values: [Approve, Reject, Escalate]                            |
```

The row with `actionCode = Fake` passes only if the rule raises exactly
that error; it does not pass by returning any value.

## Multi-Column Results for Nested and Array Return Types

`_res_` is not always a single column. When the tested rule returns a
nested object, an array, or a `SpreadsheetResult`, the expected result
spreads across many columns, each addressing one field by path:

- Dot notation into nested fields: `_res_.field.subField`
- Bracket notation into arrays: `_res_[0].field`, `_res_.items[0].field`
- `$StepName` addressing into a `SpreadsheetResult`'s steps:
  `_res_.$Total.$Amount`, `_res_.$Lines[0].$Discount.$Amount`

Worked example — a pricing calculation returning a nested result:

```
| Test CalculateOrderTotal                                                    |
| order      | _res_.$Total.$Amount | _res_.$Lines[0].$Discount.$Amount        |
| >OrderData | 133.50               | 12.00                                    |
```

**When reading per-row detail on a row like this, every one of its
result columns must match — not just the first one noticed.** A row
that matches on `_res_.$Total.$Amount` but mismatches on
`_res_.$Lines[0].$Discount.$Amount` is still a failing row.

## Blank Result Cells Are an Assertion

A blank `_res_*` or `_error_` cell on a data row is not "no check here"
— it asserts the absence of a value: no result returned, no matching
item, no error raised. Treat a blank cell exactly like any other
expected value when comparing actual output; do not skip validating a
column just because its expected value is empty.

## Bulk Input Reference: `>DataTableName`

An input column's data-row value can be `>SomeDataTable` instead of an
inline value. This means the entire input object for that row is
pulled from a separate `Data` table named `SomeDataTable`, keyed by
whatever identifier column links them — not entered inline in the test
table.

Worked example:

```
| Data Order OrderData                              |
| orderNumber | customerTier | items[0].sku          |
| ORD-1001    | Gold         | SKU-42                |

| Test CalculateOrderTotal                            |
| order       | _res_.$Total.$Amount                  |
| >OrderData  | 133.50                                 |
```

If a test's input values need to change, and its input column shows
`>DataTableName`, the values to edit live in that referenced `Data`
table — not in the test row itself. Follow the same read-only,
named-approval discipline there that applies to test rows (see
Conventions and Patterns in the skill's SKILL.md).

## Data-Validation Self-Check Tables

Not every test table exercises a business rule against sample inputs.
Some test a `Spreadsheet` that checks a cross-table data-integrity
invariant instead — e.g. confirming every code used in one table is
also defined in a lookup table — and returns a fixed sentinel value
(commonly `"ok"`) on success or raises an error describing the mismatch
on failure.

Worked example:

```
| Spreadsheet String ValidateAllCodesExist()                              |
| Step                  | Formula                                        |
| MissingCodes          | = find codes in DiscountRules missing from    |
|                          the DiscountCode lookup                       |
| Result                | = isEmpty($MissingCodes) ? "ok" :              |
|                          error("Undefined discount codes: " +          |
|                          textJoin(",", $MissingCodes))                 |

| Test ValidateAllCodesExist                                              |
| _res_                                                                    |
| ok                                                                       |
```

Recognize this pattern by the sentinel-value `_res_` and the absence of
real business inputs. When it fails, the fix is correcting the
**reference data** the invariant checks (e.g. the lookup table), not
the rule logic.

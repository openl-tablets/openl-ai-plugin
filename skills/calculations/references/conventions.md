# Spreadsheet table conventions

The calculations skill's conventions for writing a Spreadsheet table: header and layout, step naming, formula conventions, and two examples its SKILL.md points to.

## Contents

- Header and layout
- Step naming
- Formula conventions
- Example: a key value as an input
- Example: looping over an array

## Header and layout

```text
Spreadsheet SpreadsheetResult DetermineCoverageConstants (Coverage coverage)
Step                     | Formula
CoverageType             | = coverageType
AmountType               | = benefitTerms.amountType
```

- Header text: `Spreadsheet <ReturnType> <TableName> (<Type1> param1, <Type2> param2, …)`. Arrays as `Type[]`; spreadsheet results as `SpreadsheetResult<TableName>` (also accepted as `SR<TableName>`); unions as `SRA & SRB`.

- The row after the header: the project's header pair (rule 1 in SKILL.md). Formatting follows the Formatting rule in [other-modes.md](other-modes.md#writing-offline-or-in-a-reply). One empty row and column around every table; tables on a sheet start in the same column, with each calling table above the tables it calls.

- Sheets: follow the module's existing sheet layout. In a new module, or where the module has none yet, use one sheet per level or business-entity calculation, named after it (for example Policy, Plan, Benefit, Rates per Age Band, Coverage Tier, Benefit Routing, Helpers), the entry point's sheet first, then the sheets top-down by level, shared helper spreadsheets on a Helpers sheet after the level sheets, and the Environment sheet last; confirm the sheets with the user before writing a new module. The module's Environment sheet is always the last sheet: a new sheet goes before it. The server cannot reorder sheets, so after adding a sheet, list the module's sheets; if the Environment sheet is no longer last, ask the user to move its tab to the end in Studio or Excel, and say so in the summary.

- Optional `properties` row directly under the header (`parallel`, `cacheable`, dimension properties such as `effectiveDate`, `lob`, `state`).

- Extra columns to the right of the formula column are free comment columns (change notes, "previously: …", ticket ids). Keep them; add a short note when a formula encodes a non-obvious agreement. A column headed `//Formula` is a formal description column that appears in the API schema; use it only if the project already does.

- Formulas start with `= ` (a space after `=` is the house style: `= max ($MinAmount, $BaseAmount)`; a space before the argument bracket of rule calls: `BaseRate ("Standard")`). The cell is text, never an Excel formula: in the Excel UI type an apostrophe before `=`; when writing the `.xlsx` with a library, store the cell as a text value. Through OpenL Studio and the MCP server, a formula that Excel can also read (`= product ($F1:$F4)`, `= $F1 * 2`) may be saved as an Excel formula: Excel computes it from the sheet's own cells, the cell shows `0`, and the rule returns a wrong result with no error. The step names below prevent it (Step naming); the check after a write is in Writing the table ([workflow.md](workflow.md#writing-the-table-through-the-mcp-server)).

## Step naming

- PascalCase, no spaces, no underscores, no type suffix, business meaning first. Use the requirement's own name for the quantity whenever one exists. Short enough to read in a formula.

- A step may carry the name of the rule it calls (`WaiverFactor = WaiverFactor (…)`).

- No `Step1`, `Premium1`, `Tmp`, no unexplained abbreviations; domain abbreviations are fine when the project uses them.

- **No name Excel can read as a cell reference.** A step or column name must not be 1–3 letters (`F`, `AB`, `TAX`), 1–3 letters followed by digits (`F1`, `Q4`, `AB12`, `FY2026`), or a plain number (`1`, `2`). In a formula `$F1`, `$F:$F`, `$A$1` or `$FY2026` is a valid Excel reference, so the cell can be saved as an Excel formula and calculate `0` (Header and layout). Use a business name (`BasePremium`, `Factor1Value`, `FiscalYear2026`). An existing table that already has such names keeps them unless the user agrees to rename (rule 7 in SKILL.md); tell the user its formulas are exposed to this.

- Same-named steps across spreadsheets should hold the same type (autotype takes the nearest common type otherwise).

- The output markers go at the end of the step name: `Name*` = in the output, `Name~` = hidden from it. Never at the start (`*Name`, `~Name`).

## Formula conventions

Syntax is not kept here. Operators, literals, null behaviour, `$` references, ranges, index operators (`select`, `order by`, `split by`, `transform to`) and the function library are read from the bundled reference guide chapters (Scope and sources). What this skill adds is the house style:

- Words, not symbols: `and`, `or`, `not`, `<>`; `select all having`, `order by`, `split by`, never `@`, `^@`, `~@`.

- Ternary for simple conditions; nested deeper than two or three branches is a lookup, not a formula (see Hand-offs). `= isNotEmpty ($Discount) ? Calc ($Discount)` (no else) is the standard "only if present" idiom and leaves the step null.

- Objects are built in the named-attribute form, `Datatype (attr1 = v1, attr2 = v2)`, so model changes do not break the table.

- Assignment into an input object (`= field = value; …; object`) only in a table whose purpose is to default or enrich the object; mutations are not thread-safe under `parallel`.

- Each distinct value once: `otherPolicyTypes[(t) transform unique to t]` removes duplicates before a rule is applied to the array (`= sum (MultiPolicyDiscount (otherPolicyTypes[(t) transform unique to t]))` for a discount that applies once per policy type). Guard an empty array before `sum`, which returns null for it.

- `select first having` when the business rule says at most one element matches; an index when exactly one exists; never `[select all having …][0]`.

- No literal index arrays. Never type a sequence of numbers as an array literal (`{1, 2, …, 100}`). Loop over the array that holds the objects; when an index is really needed, build it from its bounds (the array's length, the first and last age or year) with a range or a helper rule, so a changed bound needs no edit. Take the syntax from the reference guide.

- A spreadsheet call needs no type annotation on its step and no `(Double)` casts on its result; pass it down as `SpreadsheetResult<TableName>` (also accepted as `SR<TableName>`).

- A formula calls the lookup tables the project already has, by their existing signatures (`= BaseRate (coverageType, state)`). A vocabulary value written in a formula goes to a parameter typed by that vocabulary, never to a `String` parameter, so a misspelled or renamed value fails to compile instead of matching nothing. It never re-implements a lookup as a ternary chain, and a lookup that does not exist is a hand-off to the decision-table skill, not a table this skill creates.

## Example: a key value as an input

From Levels of calculation in [structure-and-levels.md](structure-and-levels.md#levels-of-calculation): the key becomes an input of the spreadsheet that does the calculation, and the caller runs it once per key value.

```text
DeterminePlanPremium (Plan plan, Double premiumAdjustmentFactor)
AgeBandValues  = getValues (AgeBand)
GenderValues   = getValues (Gender)
RateCardCalc*  = DetermineRateCardPremium (plan, $AgeBandValues, $GenderValues, $AdjustmentFactor)   ← one run per age band × gender
DetermineRateCardPremium (Plan plan, AgeBand ageBand, Gender gender, Double adjustmentFactor)
AgeBand*, Gender*, BenefitsCalc = BenefitCalculation (benefits, ageBand, gender), RateCardPremium, FinalRateCardPremium*, EmployeePremium, SpousePremium
BenefitCalculation (Benefit benefit, AgeBand ageBand, Gender gender)
BenefitName, BenefitFactor = BenefitRate (benefitName, gender, ageBand), BenefitMaxDaysFactor, BenefitPremium
```

## Example: looping over an array

From Looping over arrays in [structure-and-levels.md](structure-and-levels.md#looping-over-arrays-rules-applied-to-arrays): the per-coverage table is written once, for one coverage, and the plan passes the whole array.

```text
Spreadsheet SpreadsheetResult DeterminePlanPremium (Plan plan)
Step                     | Formula
PlanName*                | = planName
CoverageCalcs*           | = DetermineCoveragePremium (coverages)          ← array in, array of results out
PlanPremium*             | = round (sum ($CoverageCalcs.$CoveragePremium), 2)

Spreadsheet SpreadsheetResult DetermineCoveragePremium (Coverage coverage)
Step                     | Formula
CoverageType*            | = coverageType                                   ← one coverage per run
CoveragePremium*         | = …
```

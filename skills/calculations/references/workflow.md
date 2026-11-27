# Workflow, writing the table and verification

Part of the calculations skill, moved word for word from its SKILL.md. SKILL.md keeps one line per Workflow step and a short form of each Non-negotiable; this file holds the full steps, Writing the table, the convention check and the Verification checklist. Scope and sources and Hand-offs are in [SKILL.md](../SKILL.md); the Non-negotiables in full (rules 1–8) are in [non-negotiables.md](non-negotiables.md); any other section named in parentheses is in one of the files listed under **Where to read** in SKILL.md.

## Contents

- Step 1. Understand the level and the inputs
- Step 2. Decide the table shape
- Step 3. Write the steps in calculation order
- Step 4. Mark the output
- Step 5. Wire it in
- Step 6. Verify
- Writing the table through the MCP server
- Convention check
- Verification checklist

## Step 1. Understand the level and the inputs

- Read the requirement completely, cell comments and notes included (a comment can carry a rule: "apply the discount once per policy type"), and AGENTS.md if there is one.
- Read the tables around the insertion point: the entry point, the parent that will call the new table, siblings at the same level, and the `Datatype` tables for exact attribute names. Through the MCP server, read each table's raw cells (layout, headers, markers); the server's guidance and bundled guides say how. Never guess attribute names; read the model.
- Decide here whether the change is a new version rather than an edit (effective date, state, LOB, product, or old behaviour to keep). If it is, hand off (Hand-offs) before writing anything.

## Step 2. Decide the table shape

- Spreadsheet or another table type, and which table the steps belong in ([structure-and-levels.md](structure-and-levels.md)).
- Return `SpreadsheetResult` when any step will be referenced elsewhere or be part of the output (most cases). A plain type (`Double`, `String[]`, `Boolean`, a model datatype) only when exactly one value is needed: faster, but its steps can't be referenced and it is called like a decision table. Then use a `RETURN` step or let the last step return.
- Inputs:
  - the entry point: one parameter, the top datatype;
  - otherwise only the attributes the table needs when there are a few, the whole object when it needs many — never both: an attribute of an object input is read from it, not passed again beside it;
  - never a collection when the table reads one value from it: compute that value once in a step at the level that owns the collection and pass the value (`RiderAmount = RiderAmount (coverages)`, then `= DetermineCoverage (coverages, $RiderAmount)`), so the dependency is its own visible step;
  - results of higher levels as `SpreadsheetResult<TableName>` (or `SR<A> & SR<B>` for a step that is a ternary between two spreadsheets);
  - a singular parameter (`Coverage coverage`) with an array passed by the caller is how per-object calculations are written (Looping over arrays).
- Name: the project's convention (siblings, or AGENTS.md). No convention → `Determine…` for each level's main spreadsheet (`DeterminePolicyPremium`, `DetermineCoverageConstants`), a `…Calculation` suffix for other SpreadsheetResult tables, `Calculate…` / `Validate…` for single-value and validation tables. Names are unique across all modules.

## Step 3. Write the steps in calculation order

Top-down, one idea per step ([conventions.md](conventions.md) first).

- A per-object table starts with its identifiers, so the output can be matched to the object; mark them `*` if the table's results are part of the output.
- Usual order, as far as the table has those parts: inputs read or normalised → lookups and rule calls (one rule call per step) → arithmetic → rounded final values.
- A product of factors is one step. Premium = base rate × a chain of factors (increased limit, vehicle type, age, mileage): each factor is its own step (one rule call per step) and the premium is one step that multiplies them and rounds once: `CoveragePremium = round ($BaseRate * $IncreasedLimitFactor * vehicleTypeFactor * $AgeFactor * $MileageFactor, 0)`. No intermediate premium per factor (`IncreasedLimitPremium`, `VehicleTypePremium` …), each rounded. "Round each step" means each numbered step that produces an amount; a factor is not an amount. Ask when the requirement really shows a rounded intermediate premium.
- Long formulas are split into steps; nested ternaries deeper than two or three branches become a SmartRules/SimpleRules table.
- Grouping rows: a label row with no formula (`VALIDATIONS`, `CALCULATIONS`), merged across the name and formula columns, separates sections of a long table.

## Step 4. Mark the output

- `StepName*` (suffix) for every step in the output structure, whatever consumes it: the calling application, a UI config, another service. Mark the step that calls a nested spreadsheet too, or the nested results are cut off.
- Mark the steps a consumer reads. Work them out from the current response, a UI config that reads the steps (if accessible), test tables that check the step, and how siblings are marked. In a new project, or when these don't settle it, ask the user which steps the output must contain, before the first table is written and with the other build questions. Never guess; never deliver a new calculation with no `*` marks. A new step stays unmarked unless the requirement or the user names it as output.
- No new output datatypes; a project that already uses them keeps them.
- `StepName~` (suffix) hides helper steps; on the step that calls a nested spreadsheet it hides that whole spreadsheet and everything below it. Within one project use whichever marker needs fewer annotations, consistently with the siblings.
- Final amounts are explicitly `round (x, n)` with the precision the requirement or sibling steps use (ask when neither says; 2 decimals is the usual default), even when the inputs were already rounded.

## Step 5. Wire it in

Add the calling step in the parent (`= TableName (arg1, arg2)`; inputs by name only, no types). Pass down values computed above instead of recomputing them, and remove the now-redundant steps in the lower table. Delete tables that no longer take part in the calculation; one kept disabled gets a note next to it saying why. Every removal or rename goes through the dependency check of rule 7 first.

## Step 6. Verify

Verify (checklist below): compile status; tests; a trace on one real input; response size; once deployed, the response schema in the service's API description (e.g. Swagger UI). A new table or step no test exercises gets one first (testing skill, Hand-offs). Then stop: show what changed (tables, steps, formulas, markers) with a business summary — what the calculation now does differently, in the requirement's own words, for the approver and the commit message — and ask for approval before the project is saved. The user decides when the branch is saved, merged and deployed.

## Writing the table through the MCP server

**Through the OpenL MCP server** (preferred when the project is open in Studio):

- Before the first write, create or switch to a work branch; never write on the main branch.
- Send a new table as its full grid of cells, row by row: header row (`Spreadsheet …`, merged across all columns), the header pair (rule 1), one row per step (name | formula), plus any grouping rows. Copy a sibling's grid as the model, so merges, markers and column count match.
- Edit by reading the whole table, changing it and writing it all back (or appending steps at the end). Re-read the raw cells to confirm headers and markers survived and every formula cell still holds its text. A formula cell that comes back as `0`, or with an Excel formula attached, was saved as an Excel formula (step naming, [conventions.md](conventions.md#step-naming)): rename the steps it references and write it again; never leave it. Table ids can change after an edit: take the id from the latest response, or list again.
- Then run the convention check (below), check the project compiles with no new errors, run the module's tests, and trace one real test input to confirm each new step's value.
- A sheet left empty after its last table is removed is deleted — never the Environment sheet. List the module's sheets after a removal; if the server cannot delete the sheet, ask the user to delete the tab in Studio or Excel, and say so in the summary. Offline, remove the sheet from the workbook.
- Tool names come from the server's own tool list, never hard-coded; follow its guidance for request shapes.

## Convention check

**Convention check, before every save.** Put every new or changed table, as read back raw, with the `Datatype` and vocabulary tables its inputs use and the signatures of the tables its formulas call (from the table listing), into one JSON file and run `python3 scripts/check_conventions.py <file>`. It flags:

- an attribute passed beside the object that owns it;
- an input-parameter name kept where only one input owns the attribute (Non-negotiable 3);
- a vocabulary value passed as text to a `String` parameter;
- a family of called tables with mixed suffixes;
- names after a mathematical role.

Fix every finding, or state in the summary why it stays. Offline, build the same file from the cells written.

## Verification checklist

- New tables use the siblings' headers; existing tables still have theirs; no `: Type` suffixes; parameter-name prefixes removed where unambiguous; every `$Step` referenced exists and is spelled identically; markers are suffixes; no step or column name looks like an Excel cell reference; every formula cell reads back as its text, not `0`. Every attribute the formulas read exists in the model under that exact name; nullable inputs and denominators are guarded; unit conversions are explicit steps.
- Every level is named for the object or key values it runs per (per age band, per gender), never a technical construct (cell, row, item, entry).
- No array is unrolled into a step per element; every array is processed by one per-element table, with element specifics in routing or decision tables (rule 8).
- No expression appears twice in the table or across the parent/child pair; no rule is called twice with the same inputs; nothing per-element recomputes a per-parent constant.
- Each table is one object and one topic, unless the project does otherwise; nothing belongs to another object's table.
- Identifiers first and marked `*` when the table feeds the output; nested calls with outputs marked `*`; final values rounded.
- No attribute is passed beside the object that owns it and no collection is passed for one value; vocabulary values in formulas go to vocabulary-typed parameters. The convention check ran on every new or changed table and is clean, or each remaining finding is explained.
- The project compiles with no new errors or warnings; existing tests pass; a trace on a real case shows the expected values; the response still contains every required field and is not larger than before; once deployed, the response schema in the service's API description still matches what the consumers read. Every removed or renamed step, input or table passed the dependency check (rule 7). The work is on a branch and the user approved it before saving.
- Every new table or step is exercised by a test; test and data table changes, trace investigation and versioning went to their own skills (Hand-offs), or to the OpenL server's tools and the project's convention when no skill is available.

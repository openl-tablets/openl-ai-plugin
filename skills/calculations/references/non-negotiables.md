# Non-negotiables in full

Part of the calculations skill, moved word for word from its SKILL.md. SKILL.md keeps each rule as a one- or two-line statement with its number; this file holds the full text, the sub-bullets and the examples. Read the rule a task touches before writing or reviewing a table, and all eight before a review. Scope and sources and Hand-offs are in [SKILL.md](../SKILL.md); the Workflow steps, Writing the table and the Verification checklist are in [workflow.md](workflow.md); any other section named in parentheses is in one of the files listed under **Where to read** in SKILL.md.

## Rule 1: Headers follow the project

**Headers follow the project.** A new table uses its siblings' headers, whatever they are; `Step | Formula` only when there is no clear convention. Read the table back after writing to confirm them. Never rename an existing table's headers.

## Rule 2: Autotype, no type on step names

**Autotype — no type on step names.** Write `MinAmount`, not `MinAmount : Double`. Autotype (automatic type discovery) is normally on; confirm it in the project's Properties table (`autotype`), don't assume it. Use `Step : Type` only when:

- (a) the step calls a rule declared with the generic return type `SpreadsheetResult` (no `<TableName>`, e.g. a decision table that returns a spreadsheet);
- (b) OpenL reports a circular-dependency typing error;
- (c) the spreadsheet calls itself.

## Rule 3: Drop the input-parameter name when it is unambiguous

**Drop the input-parameter name when it is unambiguous.** With `(Coverage coverage)` the only input that owns the attribute, write `benefitTerms.amountType`, not `coverage.benefitTerms.amountType`. Keep the name when two or more inputs (or an input and a step) could own the attribute, e.g. `(Claim claim, Policy policy)` both with `effectiveDate`. A `$Step.` prefix is a reference, not a parameter name, and stays. Same through nested objects: with `(Policy policy)` write `plans.coverages.rateBasis`.

## Rule 4: Reuse earlier steps

**Reuse earlier steps; never re-derive an existing expression.** Before writing a formula, scan the table and its inputs for a step that already holds the value or part of it, and reference it with `$Step`.

- A value fetched in a step is referenced by that step everywhere after it: once `RoundingRule = benefitTerms.roundingRule` exists, write `RoundingStep ($RoundingRule)`, not `RoundingStep (benefitTerms.roundingRule)`.
- An expression used two or more times (a `select`, `flatten`, `removeNulls`, a sorted array, a rule call) becomes its own step and is referenced. The same rule is never called twice with the same inputs anywhere in the calculation.
- A step equal to an existing step plus one term is `= $ExistingStep + term`, not the full list again.
- A step that only renames another (`NetPremium = $TotalPremium`) is removed unless the output or the next level needs it. Steps no formula or output uses, and table inputs no step reads, are removed too — after the dependency check of rule 7.

## Rule 5: Compute at the highest level that has the data

**Compute at the highest level that has the data.** Anything that does not vary per element of the lower level (constants, assumptions, sorted schedules, filtered arrays) is computed once at the parent and passed down as an input (`SpreadsheetResult<Name>` or plain values). Never recompute it inside a per-element loop.

## Rule 6: Split large arrays once, at the top

**Split large arrays once, at the top, and pass the groups down.** A large input array (census, claim lines, transactions, rate rows) is never filtered again and again with `select all having` inside a lower-level table — the most common cause of slow rules.

- At the highest level that holds the array, split it by the key the lower levels need (`[split by classNumber]`, `[split by age + "_" + gender]`).
- Wrap each group in a small spreadsheet that names its key and keeps the group; pass that array of results down.
- The lower level takes its group with `select first having $Key == key`, or by index when positions correspond. See Example 2 ([worked-examples.md](worked-examples.md#example-2--split-a-large-array-once-instead-of-filtering-it-per-element-rule-6)).

## Rule 7: Check dependencies before removing or renaming anything

**Check dependencies before removing or renaming anything.** "Unused" cannot be judged from formulas and the output alone: a step, input, marker or whole table no formula reads can still be read by a UI config (it links to steps by name), test tables, another project through the spreadsheet result, or the response consumers.

- Before deleting or renaming a step, input, marker or table, run a dependency check: a dependency-analysis tool if available, otherwise search the whole project and the UI config for the name, and check the test tables and every caller. List what would break.
- Never remove or rename something whose readers you have not checked. Something outside the project depends on it → hand the change to the user instead of making it.

## Rule 8: Arrays are processed, never unrolled

**Arrays are processed, never unrolled.** An array in the model (benefits, coverages, covered options, members, vehicles, claim lines) is calculated by one general rule that works for any element: a per-element spreadsheet the caller loops over the array ([structure-and-levels.md](structure-and-levels.md#looping-over-arrays-rules-applied-to-arrays), Looping over arrays), with the values that differ by element in decision tables keyed by its name or type.

- Never a step per element (`AirAmbulance = benefits[select first having benefitName == "AirAmbulance"].benefitAmount`, then the same for the next benefit); never name individual element values in formulas.
- An element with its own logic gets a separate spreadsheet or decision table that the general rule selects by type (a routing decision table that calls it). Logic shared by several types is written once.
- A step-per-element table is rejected in review, whatever its results.

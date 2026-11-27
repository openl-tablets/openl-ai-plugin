# Choosing a Spreadsheet, levels and arrays

Part of the calculations skill, moved word for word from its SKILL.md. Scope and sources, Hand-offs, the Non-negotiables (rules 1–8, short form) and the Workflow (one line per step) are in [SKILL.md](../SKILL.md); the full Non-negotiables are in [non-negotiables.md](non-negotiables.md), the full Workflow steps, Writing the table and the Verification checklist in [workflow.md](workflow.md); any other section named in parentheses is in one of the files listed under **Where to read** there.

## Choosing a Spreadsheet and splitting tables


A Spreadsheet holds a calculation flow: maths, an algorithm, a sequence where each step builds on earlier ones. A calculation is never written as a TBasic table or as Java code. When the logic is not a flow, use another table type (the bundled guides give each type's structure, not when to choose it):

- Conditions that pick one value (factor, rate, discount, eligibility, decision) → SmartRules / SimpleRules.

- A value found by two keys (age × gender, zone × class) → SmartLookup / SimpleLookup.

- A fixed list of records or allowed values → a Data table or vocabulary. A spreadsheet whose only step returns a list of age bands is a list, not a calculation.

One spreadsheet usually covers one object at one level (policy, coverage, claim, invoice, vehicle, employee …) and one topic of its calculation. Exceptions exist, such as a summary or output table that gathers several objects' results, so follow the project when it does otherwise. Split or combine by what the steps are about, not by how many there are:

- **Same object, same topic → one table.** Grouping rows separate the sub-topics. A vehicle premium table keeps the vehicle's coverage premiums, forms, discounts and minimum-premium floor together, under grouping rows such as "Discounts" and "Total". Two or three new steps of that object and topic go into the existing table, not a new one.

- **Different object → its own table, even if there is only one of it.** Example: a home policy with one homeowner and one house. The homeowner's factors (age, claims history) go in a homeowner table, the house's factors (construction, location) in a house table, and the policy table calls both.

- **Same object, a separate stage → a table per stage, when other tables reuse that stage or it has its own result.** A plan price built as base cost → loading → rates → output gets one table per stage, each called once and readable on one screen.

- **Too long:** past roughly 30–40 steps, or several sub-topics that each produce their own result → split at the sub-topic boundary.

- **Too short:** a one- or two-step spreadsheet that wraps a formula used once → move it into its caller. A small spreadsheet with plain inputs that several callers share is fine.

## Levels of calculation


A calculation is a tree of levels that mirrors the input model, with one spreadsheet per object at each level. The entry point is the top of the tree; every lower level is a spreadsheet written for one object and called by its parent with the parent's array (see Looping over arrays). Read the entry point and its callers and sketch the tree before adding a table; for a new project, agree the levels with the user first, then create a placeholder spreadsheet for every level and fill them bottom-up. The first question for any new step is which level owns it.

- A level owns what it can compute from its own object plus what arrived from above.

- Results travel back up only through the step that called the child: `ItemCalcs = DetermineItem (items)`, then `Total = round (sum ($ItemCalcs.$Amount), 2)`. The parent aggregates; a child never reaches up or sideways.

- A level gets its own spreadsheet when it has its own calculation. A level that only holds an array or sums its children is a step in the parent, not a table. When a level has several spreadsheets (common logic, calculation, validation), they take the same input and the parent calls them in order, passing the result of one into the next.

- Identifier steps (`PolicyNumber`, `CoverageType`, `ClaimId` …) come first, marked `*`, in the spreadsheet whose results are part of the output or are matched by the parent. A second spreadsheet on the same level repeats them only if it uses them or the business needs them in its output.

- **A level is named for what it runs per, in business words.** A spreadsheet run once per object is named after that object (`DetermineCoverageTier`); one run once per combination of key values says those keys: `DetermineRatesPerAgeBandAndGender (Plan plan, AgeBand ageBand, Gender gender, …)`, one run per age band, per gender. Never name a level, its parameter or its datatype after a technical construct (cell, row, item, record, grid, entry): `RatingCellCalculation (RatingCell ratingCell, …)` is rejected.

- One table per object type, applied to every member; nothing is hard-coded per member (rule 8). Type-specific values live in lookups keyed by the type. When one type's logic is unique, it gets its own table that the parent selects; logic shared by several types is never duplicated across tables.

- **A key value is an input, not a pair of steps.** When the same steps repeat once per value of a key (Male and Female, Employee and Spouse, each tier), the key becomes an input of the spreadsheet that does the calculation, and the caller passes every value of it, so the steps are written once. Never write `MaleRate` and `FemaleRate`, `MaleCost` and `FemaleCost`, or a lookup call with a hard-coded value (`BenefitRate ($BenefitName, ageBand, "Male")`). Example: a rate card per age band with six Male/Female step pairs and a separate benefit-cost table is rejected; the accepted form takes the gender as an input.

  An example of the key as an input is in [references/conventions.md](conventions.md#example-a-key-value-as-an-input).

  Before splitting a step by a key value, check whether the key can be a parameter.
- **All values of a vocabulary → `getValues (Vocabulary)`.** To run a level once per vocabulary value (every age band, every gender), take the values with `getValues (AgeBand)`; never build a lookup table that only lists them. Passing two such arrays where singles are expected runs every combination (Looping over arrays).
- **A block of factors → one product, passed down once.** Consecutive factor steps are multiplied with a range product, `= product ($AreaFactor:$DiscountFactor) * adjustment`, and the level passes one combined factor to its children (`DeterminePlanPremium (plans, $PremiumAdjustmentFactor)`), not each factor as its own parameter. Keep the factor steps adjacent so the range stays correct when a step is added.

## Looping over arrays (rules applied to arrays)


A per-object calculation is written once, for one object, and looped by its caller. The called spreadsheet declares the parameter in the singular (`Coverage coverage`, `Claim claim`); the caller passes the whole array (`plan.coverages`, `$OpenClaims`). OpenL runs the spreadsheet once per element and the calling step holds an array of results (`SpreadsheetResultCoverageCalc[]`). Nothing in the called table says "loop": the loop exists only because the caller sent an array where one object is expected.

An example of a per-coverage table looped by its plan is in [references/conventions.md](conventions.md#example-looping-over-an-array).

- To receive the whole array in one run instead (a total, a count, a split), declare it as an array: `(Coverage[] coverages)`.

- An array and single objects in the same call: `DetermineLineBenefit (lines, $ClaimConstants, claim)` loops over the array and passes the other arguments unchanged into every run. This is how parent-level results reach the child.

- A two-dimensional array (the result of `split by`) passed to a table declared with a one-dimensional array runs once per group: the loop is over the outer dimension and the table sees one whole group.

- Two array arguments where singles are expected loop over every combination; pass the second as an array type, or pre-select it, when that is not wanted.

- The results array is filtered and read like any array of spreadsheet results: `$CoverageCalcs [select first having $CoverageType == "Basic"].$CoveragePremium`, `sum ($CoverageCalcs.$CoveragePremium)`.

- Per-record tables looped over a large array carry `properties | parallel | true` when the project's siblings do.

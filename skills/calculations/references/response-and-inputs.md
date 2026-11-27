# The response and inputs

Part of the calculations skill, moved word for word from its SKILL.md. Scope and sources, Hand-offs, the Non-negotiables (rules 1–8, short form) and the Workflow (one line per step) are in [SKILL.md](../SKILL.md); the full Non-negotiables are in [non-negotiables.md](non-negotiables.md), the full Workflow steps, Writing the table and the Verification checklist in [workflow.md](workflow.md); any other section named in parentheses is in one of the files listed under **Where to read** there.

## The response


The response is what the entry point returns: the steps marked as output, or, in a project that returns output datatypes, those datatypes. This skill owns it.

- **Start from the consumer.** For each value the consumer stores or displays, record what it is, the level it belongs to (policy, plan, coverage, claim, line …) and the consumer's field. Take this from the consumer's contract, the integration mapping, the current response, a UI config and the test tables that check outputs. When they don't settle it, ask the user; never guess what the consumer reads.
- **The requirements decide what the response contains.** Intermediate results, echoed inputs and arrays included, are added or left out by the business requirements and the consumer's contract, never to save size. Measure the response for the largest realistic request against the project's size target (when it has none, a common target is under 10 KB). A change that makes it larger, or takes it over the target, is reported with its size before and after, for the business to decide.
- **Identifiers on every repeating level.** Each level that repeats carries the identifier or type of its element, echoed from the request, so each value can be matched to its item. Without it the consumer receives an array of numbers.
- **The project decides the mechanism.** A project that marks steps keeps marking steps; a project that returns output datatypes keeps them (Workflow step 4, [workflow.md](workflow.md#step-4-mark-the-output)). In a project with output datatypes, this skill decides their content; the datatype tables themselves are written through the model skill.
- **A response change is a contract change.** A new, renamed or removed response field or level is verified by the consuming team and approved by the user before the project is saved. Renaming or removing is breaking; a new field is additive, but it adds size and may be rejected by a consumer with strict parsing, so ask.
- **"What does the response contain?"** is answered read-only: read the entry point, its output markers (or output datatypes) and the API schema, and list the response tree by level with each level's identifier. Nothing is written.
- **After deployment** the user checks the response schema in the service's API description: every level, every identifier, every value the consumer reads.

## Inputs: model, guards and units


- **Requirement vs model.** Before writing a formula, confirm that every attribute the requirement needs exists in the `Datatype` tables with that exact name, type and cardinality. A missing attribute is a model and API-contract change: stop, list the missing attributes and hand them to the model skill and the user (Hand-offs). Never work around it by reusing another field, hard-coding a value or deriving a guess.

- **Null guards.** An input that can be absent (an optional attribute, an empty array, a `select first` with no match) is guarded before use with `isEmpty` / `isNotEmpty` or the only-if-present ternary (`= isNotEmpty ($Cov) ? Calc ($Cov)`). `+` and `-` treat null as 0, but `*` and `/` return null, so a null that reaches a product or a division silently empties the result.

- **Division guards.** Never divide by an unchecked input or step: `= $Volume > 0 ? $Premium / $Volume : 0`, or an `error (…)` when a zero denominator is a data problem the business must see.

- **Where validation goes.** Validation of inputs is a `Validate…` table at the entry point (or the level's own validation table) returning `String[]` messages, raised once with `error (textJoin ("\n", $Messages))`; follow the project's existing validation table when it has one. Per-step guards protect arithmetic; they do not replace validation.

- **Units.** Check what the model attribute holds before using it: percent or decimal (5 vs 0.05), annual or monthly, per unit or per 1,000, rounded or not. Read the datatype description, the sibling tables that use the attribute and the test data. Convert explicitly in its own step named with the unit (`RatePer1000 = $Rate / 1000`, `MonthlyPremium = $AnnualPremium / 12`); never assume the requirement's unit matches the model's.

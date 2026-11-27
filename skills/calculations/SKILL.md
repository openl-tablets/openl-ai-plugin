---
name: calculations
description: "Create, change, optimize, refactor or review OpenL Spreadsheet tables: steps, formulas, headers, output marks, nested calls, calculation levels, performance, and the response the entry point returns. Use for any Spreadsheet-table or response task, even 'add a step', 'build the premium calculation', 'move this to the parent level', 'the rater is too slow', a pasted formula or 'what does the response contain'. Not for decision tables, datatypes or test tables on their own, finding why a value is wrong, or auditing rules against a requirements document."
compatibility: "Works through a connection to OpenL Studio (the OpenL MCP server); offline .xlsx only when the work must stay offline"
metadata:
  version: "0.1.1"
---

# Calculations (Spreadsheet tables)

Builds and changes the Spreadsheet tables of an OpenL project. Project facts come from the project, never from this skill. Read only the references the task needs.

## Inputs

| Name | Type | Required | Description |
|---|---|---|---|
| `request` | string | yes | The Spreadsheet table or step to build, change, optimize or review; a pasted formula counts |
| `studio` | string | yes | The OpenL Studio the user names; check the connected MCP server is that one before the first read; ask, never assume |
| `project` | string | yes | Exact project name, repository and branch; a planning or domain skill that calls this one passes them on |
| `table` | string | no | The Spreadsheet table and steps, when the user names them |
| `requirement` | file or text | new or changed logic | The rule, worked example or formula the steps implement |
| `targets` | object | performance mode | Timing and response-size targets when the project sets its own; otherwise the defaults in Performance |

## Where to read

| Task or question | Read |
|---|---|
| Header line and header pair, sheets, comment columns; step naming (PascalCase business names, no names Excel reads as a cell reference, output markers as suffixes); formula conventions (words not symbols, named-attribute object creation, `select first having`, no literal index arrays, calling existing lookups). **Read before writing or reviewing any table.** | [references/conventions.md](references/conventions.md) |
| The Non-negotiables in full, with their sub-bullets and examples. Read the rule a task touches before writing; all eight before a review. | [references/non-negotiables.md](references/non-negotiables.md) |
| The full Workflow steps, Writing the table through the MCP server, the convention check and the Verification checklist. Read at each Workflow step, before the first write, and before reporting. | [references/workflow.md](references/workflow.md) |
| Spreadsheet or another table type; splitting tables; levels of calculation; looping over arrays | [references/structure-and-levels.md](references/structure-and-levels.md) |
| What the entry point returns; reading the model, guards for nullable inputs and denominators, units | [references/response-and-inputs.md](references/response-and-inputs.md) |
| Performance mode: a slow rater, a benchmark over its threshold, "make this faster" — the targets and fix order, the patterns and the optimizing procedure (limits, baseline, hot tables, one fix at a time, proof, report) | [references/performance.md](references/performance.md) |
| Reviewing a table; writing offline (`.xlsx`) or in a reply only; formatting | [references/other-modes.md](references/other-modes.md) |
| Before and after examples: a new common-logic table after review (rules 1–4, identifier first); a large array split once at the top instead of filtered per element (rule 6). Read them when unsure how the rules look in a real table. | [references/worked-examples.md](references/worked-examples.md) |

## Scope and sources

| Source | Rule |
|---|---|
| Studio and project | Work in the Studio and project the user names (Studio URL, repository, project, branch). The OpenL MCP server may be connected to another Studio: check it is the one the user means before the first read. None named, or the connected Studio does not hold the project → ask; never assume. A planning or domain skill that calls this one passes them on. |
| The project | Its entry point, the parent and sibling tables, the datatypes, AGENTS.md if there is one. They give the objects and levels, naming, output consumers, rounding and performance targets. The project's convention wins; the Non-negotiables always apply. Not settled by the project → ask; never invent a convention. |
| OpenL Tablets Reference Guide | When a formula needs an operator, function, index operator, typing rule or property you are not sure of, read the chapter. The MCP server bundles the guide by chapter, matching the Studio version: list the guides and fetch the chapter (the seven *Spreadsheet Table* chapters, *Referencing Attributes*, *Working with Arrays from Rules*, *Round Function*, the BEX and function appendices). No server → ask the user to connect it. Only when the work must stay offline (an `.xlsx` module without Studio) use https://openldocs.readthedocs.io/en/latest/documentation/guides/reference_guide/ for syntax, and say in the reply that the table was written without compiling, tests or a trace. |

**Hand-offs.** Seven neighbouring tasks are not done here. Hand each to the matching skill when available; otherwise follow the project's own convention or the OpenL server's tools. Never improvise them.

| Task | Goes to |
|---|---|
| Lookup tables | Formulas call the project's existing lookups. A lookup that does not exist yet (a new factor, rate or decision table) → the decision-table skill; this skill builds no decision tables. |
| Model | Formulas read the attributes the model has. A missing or wrongly typed attribute, or a new vocabulary value → the model skill and its contract approval; never work around the model. The response is this skill's own ([response-and-inputs.md](references/response-and-inputs.md)). |
| Versioning | An effective-dated change, one for some states, LOBs or products only, or one that must keep the old behaviour for policies already rated, is not an in-place edit: the table gets a new version (dimension properties, `version` / `active`). Recognise it before writing and hand the table to the versioning skill. Without one, copy the project's existing versioned tables exactly and ask the user to confirm the dates and dimensions. |
| Project structure | Which module a new spreadsheet goes in (the module that holds the project's calculations, the entry point's sheet first), and module dependencies: follow the project's structure; a new module, or a new project built from a requirement → ask the user before creating it. |
| Tests, baseline, benchmark | Test or data tables for a new step or table; recording behaviour and timings before a change and comparing after; the performance benchmark → the testing skill. A new table or step without a test that exercises it is not finished; a performance change without a before/after baseline is not proven. |
| Trace investigation | Finding why a value is wrong → the trace skill. This skill only fixes the spreadsheet once the cause is known. |
| Requirements audit | Checking rules against a business document is a conformance audit, a separate task. |

## Non-negotiables

Each rule in short; read its full text, sub-bullets and examples in [non-negotiables.md](references/non-negotiables.md) before writing or reviewing a table it touches.

1. **Headers follow the project.** A new table uses its siblings' headers (`Step | Formula` only with no clear convention); never rename an existing table's headers. [Detail](references/non-negotiables.md#rule-1-headers-follow-the-project).
2. **Autotype — no type on step names.** `MinAmount`, not `MinAmount : Double`; `Step : Type` only in the three listed cases (generic `SpreadsheetResult` call, circular-dependency typing error, self-call). [Detail](references/non-negotiables.md#rule-2-autotype-no-type-on-step-names).
3. **Drop the input-parameter name when it is unambiguous.** With `(Coverage coverage)` write `benefitTerms.amountType`; keep the name when two or more inputs (or an input and a step) could own the attribute. A `$Step.` prefix stays. [Detail](references/non-negotiables.md#rule-3-drop-the-input-parameter-name-when-it-is-unambiguous).
4. **Reuse earlier steps; never re-derive an existing expression.** An expression used twice becomes its own step; the same rule is never called twice with the same inputs. [Detail](references/non-negotiables.md#rule-4-reuse-earlier-steps).
5. **Compute at the highest level that has the data.** What does not vary per element is computed once at the parent and passed down, never recomputed in a per-element loop. [Detail](references/non-negotiables.md#rule-5-compute-at-the-highest-level-that-has-the-data).
6. **Split large arrays once, at the top, and pass the groups down.** Never re-filter a large array with `select all having` inside a lower-level table: split it by the key at the top, wrap each group in a small spreadsheet, and let the lower level take its group with `select first having`. [Detail](references/non-negotiables.md#rule-6-split-large-arrays-once-at-the-top).
7. **Check dependencies before removing or renaming anything.** Run a dependency check (UI config, test tables, other projects, consumers) first; something outside the project depends on it → hand the change to the user. [Detail](references/non-negotiables.md#rule-7-check-dependencies-before-removing-or-renaming-anything).
8. **Arrays are processed, never unrolled.** One per-element rule the caller loops over the array, element specifics in decision tables keyed by name or type; never a step per element. A step-per-element table is rejected in review. [Detail](references/non-negotiables.md#rule-8-arrays-are-processed-never-unrolled).

## Workflow

**When the change outgrows the Spreadsheet tables, switch to the planning skill.** Before the first write, as soon as the change turns out to need a new or changed lookup, a model field or vocabulary value, more than one version file, or a consumer outside the project, load the planning skill, hand it the request with what you found, and say so in one line ("This needs more than this table: …, so I'm planning it as one change"). Do not ask first: the planning skill shows the whole change and gets the user's approval before any write. Exceptions: the user limited the work to this table — do only that and list the rest as hand-offs in the summary; the planning skill is already running and called this skill — report back to it instead; no planning skill is installed — list the rest as hand-offs and ask. Found only after a write: stop, report what is written and still unsaved on the work branch, and hand it to the planning skill, which starts from that state.

Read each step's detail in [workflow.md](references/workflow.md) when you reach it.

1. **Understand the level and the inputs** — requirement with its comments, surrounding tables, exact attribute names; a new version → hand off first. [Step 1](references/workflow.md#step-1-understand-the-level-and-the-inputs).
2. **Decide the table shape** — table type and placement; `SpreadsheetResult` unless exactly one value is needed; inputs (never an attribute beside its object, never a collection for one value); the project's naming convention. [Step 2](references/workflow.md#step-2-decide-the-table-shape).
3. **Write the steps in calculation order**, top-down, one idea per step ([conventions.md](references/conventions.md) first). [Step 3](references/workflow.md#step-3-write-the-steps-in-calculation-order).
4. **Mark the output** — `*` on every step a consumer reads (ask when unsettled; never guess), `~` for helpers, no new output datatypes, final amounts explicitly rounded. [Step 4](references/workflow.md#step-4-mark-the-output).
5. **Wire it in** — the calling step in the parent; removals and renames after the rule 7 check. [Step 5](references/workflow.md#step-5-wire-it-in).
6. **Verify** — compile, tests, trace, response size; show what changed with a business summary and ask for approval before the project is saved. Check the project's AGENTS.md: a fact it documents that the change made incorrect (an entry point, an output per level, a step it names, a rounding rule, a gotcha) is named, with a drafted correction, for the skill that maintains the file — the planning skill when one is running, otherwise the user in the summary. This skill adds no new entries and never writes the file. [Step 6](references/workflow.md#step-6-verify).

## Performance

Targets, unless the project sets its own: ≤ 100 ms normal; ≤ 1 s only for heavy batch; ≤ 10 s poor; > 10 s blocker; response < 10 KB. Timings come from the testing skill's baseline and benchmark, never a single run. In performance mode, read [performance.md](references/performance.md) for the fix order, the `cacheable` rule, the patterns and the optimizing procedure.

## Writing the table

- **Through the OpenL MCP server** (preferred): on a work branch; full grid copied from a sibling; read back raw and fix any formula cell that returns `0`. Read [workflow.md](references/workflow.md#writing-the-table-through-the-mcp-server) before the first write.
- **Convention check, before every save:** run `python3 scripts/check_conventions.py <file>` on every new or changed table; fix every finding or explain it. Read [workflow.md](references/workflow.md#convention-check) for the input file and what it flags.
- **Offline (`.xlsx`), formatting, or in a reply only:** read [other-modes.md](references/other-modes.md).

## Verification checklist

Before asking for approval, walk the full checklist in [workflow.md](references/workflow.md#verification-checklist): the Non-negotiables hold; the convention check is clean; the project compiles with no new errors or warnings; tests pass and every new table or step has one; a trace shows the expected values; the response keeps every required field and does not grow; the work is on a branch and the user approved it before saving.

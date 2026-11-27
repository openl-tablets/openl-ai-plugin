---
name: decision-tables
description: "Create, change, optimize or review OpenL decision tables: SmartRules, SimpleRules, SmartLookup, SimpleLookup and Rules tables (C, HC, RET columns), external Conditions, Returns and Actions tables, their conditions, ranges, catch-all rows, gaps, overlaps and layout. Use for any decision-table or lookup task, even 'add a row for ages 70–74', 'turn this rate sheet into a lookup', 'new rates from 1 January' or a pasted rate table. Not for Spreadsheet tables, test tables or test data, finding why a value is wrong or a rule never fires, or auditing rules against a requirements document."
compatibility: "Works through a connection to OpenL Studio (the OpenL MCP server); offline .xlsx only when the work must stay offline"
metadata:
  version: "0.1.1"
---

# Decision tables

Builds and changes the decision tables of an OpenL project. Project facts come from the project, never from this skill. SKILL.md is the orchestration guide: the Non-negotiables, the Workflow steps and the checks in short form. The full text of each lives in the references below; read only the ones the task needs, at the step that names them.

## Inputs

| Name | Type | Required | Description |
|---|---|---|---|
| `request` | string | yes | The decision table to build, change, optimize or review; a pasted rate table counts |
| `studio` | string | yes | The OpenL Studio the user names; check the connected MCP server is that one before the first read; ask, never assume |
| `project` | string | yes | Exact project name, repository and branch |
| `table` | string | no | The existing table, when the user names one |
| `source_values` | file or text | new or changed values | Rate sheet, filing, manual or pasted table; every value and boundary copied exactly (Non-negotiable 2) |
| `effective_from` | date | no | When new values apply from a date or for some states only: a new version, not an in-place edit |

## Where to read

| When | Read |
|---|---|
| Before the first project read; a source or the boundary with another skill is unclear | [workflow-and-writing.md → Scope and sources](references/workflow-and-writing.md#scope-and-sources) |
| A Non-negotiable's short form below leaves a case open, or a step cites one | [references/non-negotiables.md](references/non-negotiables.md) |
| At each Workflow step, for the step's full text | [workflow-and-writing.md → Workflow](references/workflow-and-writing.md#workflow) |
| Before the first write through Studio; before every save (convention check); before asking for approval (checklist) | [references/workflow-and-writing.md](references/workflow-and-writing.md) |
| Step 2: which table type; one table or several with a routing rule; dispatcher | [references/table-types.md](references/table-types.md) |
| Steps 2 to 4: titles, matching by title, horizontal conditions, lookup layout and headers, ranges, arrays; gaps, overlaps, unreachable rows, the temporary gap and overlap check | [references/conditions-and-completeness.md](references/conditions-and-completeness.md) |
| Step 3 on an existing table: changing values (companion rows, impact preview); step 2: versions, dispatch, properties | [references/changes-and-versioning.md](references/changes-and-versioning.md) |
| Step 2: table names, suffixes, module and sheet, layout on the sheet | [references/naming-and-layout.md](references/naming-and-layout.md) |
| An optimization task: compacting, transposing or merging a table; performance | [references/optimization-and-performance.md](references/optimization-and-performance.md) |
| Step 2, when the table uses external Conditions, Returns or Actions tables or hand-declared Rules columns (C, HC, RET …) | [references/external-and-rules-tables.md](references/external-and-rules-tables.md) |
| A review of a table against this skill; writing offline (`.xlsx`) or in a reply only | [references/other-modes.md](references/other-modes.md) |
| When a pattern below needs its before and after tables | [references/worked-examples.md](references/worked-examples.md) |

## Scope and sources

Full text: [workflow-and-writing.md → Scope and sources](references/workflow-and-writing.md#scope-and-sources), read before the first project read.

- **Studio and project:** the ones the user names; confirm the connected Studio is that one before the first read. None named, or not there → ask.
- **The project** (siblings, callers, `Datatype` and vocabulary tables, versioning, AGENTS.md) gives the conventions; the project's convention wins, the Non-negotiables always apply. Not settled → ask.
- **Syntax** only from the OpenL Tablets Reference Guide bundled by the Studio connection; the online guide only when the work must stay offline, and say so.
- **Stops at:** the calling Spreadsheet step (the spreadsheet skill), test tables and test data (the testing skill), a wrong value (the trace skill), AGENTS.md edits (drafted for the hand-off only).

## Non-negotiables

Each rule in full, with its sub-cases: [references/non-negotiables.md](references/non-negotiables.md), read when a rule below leaves a case open.

1. **Existing tables keep what they have** (type, header, titles, column order, orientation, notation, place); a new table follows its siblings. Only optimization changes layout, never a value. [Detail](references/non-negotiables.md#1-existing-tables-keep-what-they-have).
2. **Values exactly as given:** every value, band and boundary at full precision and unit — the stored value, not the displayed one; possibly rounded pasted text → ask for the source. Never invent, round, interpolate or extend a band; write `FALSE`, `No` and `0`, never a blank for a value. [Detail](references/non-negotiables.md#2-values-exactly-as-given).
3. **Every input lands where someone decided:** check each condition's full value domain (vocabulary values, true and false, the numeric range, empty), list the uncovered inputs and ask; never leave a gap silently or invent its value. A vocabulary value gets its own row; the requirement's "any other", or an input without vocabulary, gets one catch-all row, last. A table listing every value of a vocabulary gets a drafted AGENTS.md entry. [Detail](references/non-negotiables.md#3-every-input-lands-where-someone-decided).
4. **Specific rows first, the catch-all last:** at most one catch-all, at the end; an overlap is fixed or reported. [Detail](references/non-negotiables.md#4-specific-rows-first-the-catch-all-last).
5. **Ranges in one cell, both ends included** (`25 - 29`, `< 18`, `70+`) unless siblings differ; no gaps, overlaps or mixed notations; fractional inputs take the bracket form. [Detail](references/non-negotiables.md#5-ranges-in-one-cell-both-ends-included).
6. **Check dependencies before removing or renaming anything** (table, row, column, return value or type, input or its name, vocabulary value a row tests): callers, tests, UI configs, other projects, other versions of the rule. List what would break; hand outside dependencies to the user. [Detail](references/non-negotiables.md#6-check-dependencies-before-removing-or-renaming-anything).
7. **An optimization never changes a result:** prove it over the full value domain before saving. [Detail](references/non-negotiables.md#7-an-optimization-never-changes-a-result).
8. **Values chosen by an input live in decision tables** keyed by that input, never in a ternary chain or a hard-coded constant; Data tables stay with test data, and an existing one rules read stays unless the task asks. [Detail](references/non-negotiables.md#8-values-chosen-by-an-input-live-in-decision-tables).
9. **The fewest columns and rows that say the requirement:** business keys only, horizontal conditions for short splitting keys, surcharges as return-cell formulas, rows in the requirement's layout. [Detail](references/non-negotiables.md#9-the-fewest-columns-and-rows-that-say-the-requirement).

## Workflow

**When the change outgrows the decision table, switch to the planning skill.** Before the first write, as soon as the change turns out to need a model field or vocabulary value, a change to the calling Spreadsheet step, more than one version file, or a consumer outside the project, load the planning skill, hand it the request with what you found, and say so in one line ("This needs more than this table: …, so I'm planning it as one change"). Do not ask first: the planning skill shows the whole change and gets the user's approval before any write. Exceptions: the user limited the work to this table — do only that and list the rest as hand-offs in the summary; the planning skill is already running and called this skill — report back to it instead; no planning skill is installed — list the rest as hand-offs and ask. Found only after a write: stop, report what is written and still unsaved on the work branch, and hand it to the planning skill, which starts from that state.

Before each step, read its full text in [workflow-and-writing.md → Workflow](references/workflow-and-writing.md#workflow).

1. **Understand the requirement and its surroundings:** the whole requirement, cell comments included (only a few words → ask what it leaves open); AGENTS.md, the siblings, the caller, the `Datatype` and vocabulary tables, read as raw cells. Never guess names, spellings or units. A missing attribute or vocabulary value, or a type change, is a model change: stop and hand it to the user. [Step 1](references/workflow-and-writing.md#1-understand-the-requirement-and-its-surroundings).
2. **Decide the shape:** table type; rows in the requirement's layout; a signature returning what the caller needs, with either the few attributes the conditions read or the whole object, never both; a name in the project's convention (else the requirement's term in PascalCase); the siblings' module, sheet and version. [Step 2](references/workflow-and-writing.md#2-decide-the-shape).
3. **Map the values** exactly, with units in titles; never convert silently. [Step 3](references/workflow-and-writing.md#3-map-the-values).
4. **Check gaps and overlaps, then close the value domain:** bands meet end to end; every combination of input values checked for gaps, overlaps and unreachable rows; uncovered inputs listed and asked about. [Step 4](references/workflow-and-writing.md#4-check-gaps-and-overlaps-then-close-the-value-domain).
5. **Wire it in:** give the spreadsheet skill the call; a changed signature changes every caller after the dependency check. [Step 5](references/workflow-and-writing.md#5-wire-it-in).
6. **Verify:** compile status, a run on every domain value and range boundary, the temporary gap and overlap check, the module's tests. Hand unit test cases, expected values from the requirement, to the testing skill; then show what changed and stop for approval before saving. [Step 6](references/workflow-and-writing.md#6-verify).

## Writing the table

- **Through the Studio connection** (preferred): on a work branch only; send the full grid, copied from a sibling's; numbers as numbers, ranges, lists, vocabulary values and `"= …"` expressions as text; re-read the raw cells after every write, delete cells a shrinking rewrite left behind, take table ids from the latest response; tool names from the connection's own tool list. Read [workflow-and-writing.md → Writing the table](references/workflow-and-writing.md#writing-the-table) before the first write.
- **Convention check, before every save:** run `python3 scripts/check_conventions.py <file>` on every new or changed table and fix or explain each finding. How to build the file and the six checks: [workflow-and-writing.md → Convention check](references/workflow-and-writing.md#convention-check).
- **Offline (`.xlsx` without Studio) or in a reply only:** read [other-modes.md](references/other-modes.md).

## Verification checklist

At step 6, before asking for approval, walk the full checklist in [workflow-and-writing.md → Verification checklist](references/workflow-and-writing.md#verification-checklist). Beyond the Non-negotiables themselves, it checks:

- names use the requirement's term for the returned value, one suffix per family; the signature conventions (no key beside its owner, no collection read for one value, bare fields, vocabulary-typed parameters); the convention check is clean or explained;
- Smart titles match the intended inputs, Simple inputs follow condition order, commas inside values are escaped;
- each requirement table is its own table, with one routing table when there are several per key; lookups put readable keys across the top;
- external and Rules columns follow [external-and-rules-tables.md](references/external-and-rules-tables.md);
- AGENTS.md entries are drafted for every model departure and every table listing a whole vocabulary; unit test cases went to testing; a value change came with an impact preview and confirmed companion rows;
- the project compiles with no new errors or warnings, the temporary gap and overlap check was removed, the domain run matches, existing tests pass; the work is on a branch and approved before saving.

## Worked examples

The patterns apply in any domain; full examples with before and after tables are in [references/worked-examples.md](references/worked-examples.md), read when a pattern below matches the task. External Conditions, Returns and Actions tables and hand-declared Rules columns, with a complete example, are in [references/external-and-rules-tables.md](references/external-and-rules-tables.md).

| Example | Pattern | Rule |
|---|---|---|
| 1 | The catch-all row and the gaps | Non-negotiables 3 and 4 |
| 2 | A list of combinations becomes a lookup | Optimizing an existing table |
| 3 | A Double input: one range notation, no gap | Non-negotiable 5 |
| 4 | A ternary chain becomes a table | Non-negotiable 8 |
| 5 | A Rules table in its short form, a key across the top | Non-negotiable 9 |
| 6 | A list of combinations becomes a lookup with two stacked horizontal conditions | Lookup layout |
| 7 | Readable keys across the top, coded numbers down the rows or titled | Lookup layout |
| 8 | A dispatcher instead of one merged table | Choosing the table type |
| 9 | Separate tables and one routing rule, even when every block has the same conditions | Choosing the table type |


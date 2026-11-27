# Scope, workflow, writing and verification in full

Part of the decision-tables skill, moved word for word from its SKILL.md, which keeps a one-line statement of each step, a short form of Writing the table and of the Verification checklist, and links here. The Non-negotiables in full are in [non-negotiables.md](non-negotiables.md); any other section named in parentheses is in one of the files listed under **Where to read** in [SKILL.md](../SKILL.md).

## Contents

- [Scope and sources](#scope-and-sources): read before the first read of the project, and whenever a source or the boundary with another skill is unclear.
- [Workflow](#workflow): the full text of each step; read the step SKILL.md points to before doing it.
  - [1. Understand the requirement and its surroundings](#1-understand-the-requirement-and-its-surroundings)
  - [2. Decide the shape](#2-decide-the-shape)
  - [3. Map the values](#3-map-the-values)
  - [4. Check gaps and overlaps, then close the value domain](#4-check-gaps-and-overlaps-then-close-the-value-domain)
  - [5. Wire it in](#5-wire-it-in)
  - [6. Verify](#6-verify)
- [Writing the table](#writing-the-table): read before the first write through the Studio connection.
- [Convention check](#convention-check): read before every save.
- [Verification checklist](#verification-checklist): read at Workflow step 6, before asking for approval.

## Scope and sources

| Source | Rule |
|---|---|
| Studio and project | Work in the Studio and project the user names (Studio URL, repository, project, branch). The OpenL MCP server may be connected to another Studio: check it is the one the user means before the first read. None named, or the connected Studio does not hold the project → ask; never assume. A planning or domain skill that calls this one passes them on. |
| The project | Sibling tables in the target module; the tables and spreadsheets that call it; the `Datatype` and vocabulary tables for each input and its allowed values; module structure and versioning; AGENTS.md if there is one. They give naming, layout, range notation, units, table types in use and how rules are versioned. The project's convention wins; the Non-negotiables always apply. Not settled by the project → ask; never invent a convention. |
| OpenL Tablets Reference Guide | Syntax is never kept in this skill: table headers, Rules column codes, range formats, array and escaping rules, properties and their values come from the guide. The Studio connection bundles it by chapter, matching the Studio version: list the guides and fetch the chapter needed. Chapters: the *Decision Table* chapters (structure, interpretation, Simple and Smart Rules, Smart Rules, custom data type results, multiple return columns, Simple and Smart Lookup, external tables, ranges and arrays, Rules tables, collecting results, local parameters, transposed tables), *Representing Values of Different Types*, *Working with Data Types* (range types and formats), *Vocabulary Data Types*, the *Data Table* chapters, *Rule Versioning* and *Dev Properties* under Table Properties, *Calling a Table from Another Table*, *Referencing Attributes*. No connection → ask the user to set it up. Only when the work must stay offline (an `.xlsx` module without Studio, see Writing the table) use https://openldocs.readthedocs.io/en/latest/documentation/guides/reference_guide/ and say in the reply that the table was written without compiling, tests or a run. |
| Where this skill stops | The Spreadsheet step that calls the lookup belongs to the Spreadsheet skill: this skill owns the table and its signature, that skill owns the step and the call. Test tables and test data, and investigating a wrong value, are separate tasks: hand them to a testing or trace skill if available, otherwise use the test and trace tools of the Studio connection. AGENTS.md is not edited here: the entries it needs (Workflow step 1, Non-negotiable 3) are drafted word for word in the hand-off, for an AGENTS.md skill or for the user. |

## Workflow

### 1. Understand the requirement and its surroundings

- Read the requirement completely, in any form: a few words in the chat, a request or email, a ticket, a document, a workbook such as a rate sheet. In a workbook, read cell comments and notes too (a comment can change the rule: "apply the discount once per policy type").
- Only a few words → list what it leaves open (keys, values, the catch-all) and ask before building.
- Read AGENTS.md if there is one; the sibling tables in the target module (type, titles, range notation, layout); the table or spreadsheet that will call the new table; the `Datatype` and vocabulary tables for every key. Through the Studio connection, read each table's raw cells (the connection's guidance and bundled guides say how). Never guess attribute names, value spellings or units: read the model.
- *Model attributes and calculated values.* A condition reads a model attribute or a value the caller calculates and passes in (a step result, a computed amount or band); both are normal.
  - Model attribute: confirm name, type and cardinality in the `Datatype` tables, and that each condition value is spelled as in its vocabulary (the vocabulary's spelling, not the requirement's display text).
  - A missing attribute, a missing vocabulary value or a type change is a model change: stop, list it and hand it to the user, because tests and the calculation may need changing too.
  - A calculated input is named after what it holds and typed as the caller computes it.
  - A deliberate departure from the model (a String input in place of a vocabulary, so one table can serve objects whose vocabularies differ) only when AGENTS.md documents it, or sibling tables already use it for the same purpose and the user confirms. Record it in the table's description property and draft the AGENTS.md entry for the hand-off.

### 2. Decide the shape

- *Table type*, and for a lookup which key goes across the top: read [table-types.md](table-types.md) and, for lookups, [conditions-and-completeness.md](conditions-and-completeness.md). External tables or hand-declared Rules columns: read [external-and-rules-tables.md](external-and-rules-tables.md).
- *Rows* follow the requirement's layout, so the table can be checked and updated line by line against its source. A value listed on its own line gets its own row, even when several values return the same result (a state factor: one state, one row). Values share one cell as a comma-separated list (Gold, Platinum) only when the requirement groups them or the user asks. Escape a comma that is part of a value.
- *Signature.* Return type: the type the caller needs (`Double` for a factor, a vocabulary type for a classification, `Boolean` for an eligibility flag, a datatype for a compound return). Inputs: the attributes the conditions read when there are a few, the whole object when there are many (Smart types only), never both — a Smart condition titled by a field (`Benefit Name`) matches that field of an object input (`benefit.benefitName`), so a key that is already a field of an object input is not passed again. An input only one row needs is the value that row needs, computed by the caller, not its collection (a sibling object's amount arrives as a `Double`, not the whole array). Parameter names are the source attribute names, which also makes title matching reliable.
- *Name:* the project's convention (siblings, or AGENTS.md). No convention → the requirement's own term for what the table returns, in PascalCase: `AreaFactor`, `BaseRate`, `EligibilityDecision` ([naming-and-layout.md](naming-and-layout.md)). Names are unique across all modules, except versions of the same rule.
- *Place:* the module and sheet where the siblings of this topic live ([naming-and-layout.md](naming-and-layout.md)), and the version the table belongs to: a new table follows its module's versioning. A new rule version (business dimension properties) is a versioning task: hand it to a versioning skill if available, otherwise ask how the project versions rules ([changes-and-versioning.md](changes-and-versioning.md)).

### 3. Map the values

Copy every value and boundary exactly (Non-negotiable 2). Ranges in the project's notation (Non-negotiable 5); rows from specific to general (Non-negotiable 4). Title each column with the business name of the condition or value, with the unit where there is one (`Rate per 1,000`). Check the unit the attribute and the caller expect (percent or decimal, annual or monthly, per unit or per 1,000). Never convert silently: a different unit in the requirement → ask which one the table holds. Changing values of an existing table: read [changes-and-versioning.md](changes-and-versioning.md) first.

### 4. Check gaps and overlaps, then close the value domain

Detail in [conditions-and-completeness.md](conditions-and-completeness.md).
- Each range condition: bands meet with no gap and no overlap from the lowest to the highest value the input can take, in one notation (Non-negotiable 5). A value between two bands is a gap.
- Every condition: list every value an input can take (a calculated input: the values its computing step can produce) and find gaps, overlaps and unreachable rows across the combinations.
- List the inputs the requirement does not cover, an empty input included when the input has no vocabulary, and ask what the table returns for each. A vocabulary value gets its own row (Non-negotiable 3); any other agreed default is one catch-all row, last.

### 5. Wire it in

The calling step belongs to the Spreadsheet skill; give it the call (`= AreaFactor (areaCode)`, inputs by name only). When an existing table's signature changes, every caller changes with it, after the dependency check (Non-negotiable 6).

### 6. Verify

Follow the [Verification checklist](#verification-checklist) below: compile status; a run of the table on every domain value and every range boundary; a temporary gap and overlap check; the module's existing tests.
- Every new table: hand the cases of the domain run to a testing skill, if available, as a unit test — each input with its expected value from the requirement or the user's recorded decision, never from the table just written. No testing skill → give the cases to the user.
- Then stop: show what changed (tables, rows, values and where each value came from) and ask for approval before the project is saved. Work only on a branch; the user decides when it is saved, merged and deployed.

## Writing the table

**Through the Studio connection** (preferred when the project is open in Studio):

- Before the first write, create or switch to a work branch; never write on the main branch.
- Send a new table as its full grid of cells, row by row: header row (merged across all columns), any properties rows, the title row or rows (for a lookup, the horizontal header rows with the vertical titles merged down over them), then one row per rule. Copy a sibling's grid as the model, so merges, title style and column count match.
- Numbers as numbers; ranges, comma-separated lists and vocabulary values as text; expression cells as the text `"= …"`.
- Edit by reading the whole table, changing it and writing it all back, or by inserting or appending rows and columns. Re-read the raw cells to confirm titles, merges and values survived.
- A rewrite that makes the table narrower or shorter can leave old cells inside its range: compare the reported position with the new size and delete leftover columns or rows. Table ids can change after an edit: take the id from the latest response, or list again.
- Then run the convention check (below), check the project compiles with no new errors or warnings, run the table on the value domain, and run the module's tests.
- Tool names come from the connection's own tool list, never hard-coded; follow its guidance for request shapes.

Offline (`.xlsx` without Studio) or in a reply only: read [other-modes.md](other-modes.md).

## Convention check

Before every save. Put every new or changed table, as read back raw, with the `Datatype` and vocabulary tables its inputs use and the signatures of the tables its formulas call (from the table listing), into one JSON file and run `python3 scripts/check_conventions.py <file>`. It flags:
- a key passed beside the object that owns it;
- an owner prefix where only one input owns the field;
- a vocabulary value passed as text to a `String` parameter;
- an array input read by one cell only;
- one family of tables with mixed suffixes;
- names after a mathematical role.

Fix every finding, or state in the summary why it stays (a role word the requirement itself uses). Not ready for approval until the check is clean or every remaining finding is explained. Offline, build the same file from the cells written; for a reply-only table, apply the same six checks by reading.

## Verification checklist

- Existing tables keep type, titles, column order, orientation and notation; new tables match their siblings. Every key and value exists in the model and vocabularies under that exact spelling; nothing was worked around.
- Every value and boundary traces to the requirement or the user; nothing invented, rounded or extended. Units are named in the titles and match what the caller expects.
- Ranges follow the project's notation, meet without gaps or overlaps, never mix notations in one column; fractional bands use the bracket form.
- Rows run from specific to general, at most one catch-all, last; no unreachable or duplicate rows; no blank return cell meant as null or zero. Every gap, an empty input without a vocabulary included, was listed and the user decided what it returns.
- Table names use the requirement's term for the returned value, not its mathematical role; tables of one kind share one suffix.
- No key passed beside the object that owns it; no input is a collection read for one value; fields read bare when one input owns them; vocabulary values in formulas go to vocabulary-typed parameters. The convention check ran on every new or changed table and is clean, or each remaining finding is explained.
- Smart titles matched the intended inputs (no ambiguous-matching warning); Simple tables have inputs in condition order. Commas inside values are escaped.
- Each requirement table is its own table, called through one routing table when there are several per key; rows follow the requirement's layout (one value per row unless the requirement groups them).
- Lookups put every key that reads well across the top, stacked where needed, with a balance between width and height.
- No condition column, row or expression the engine does not need: Rules tables use the short form for plain matches; a short key that splits every row is a horizontal condition; a surcharge or discount is a formula in the return cell, not an extra column or row; the requirement's "any other" is one blank row, last.
- Every external Conditions, Returns or Actions element and every hand-declared Rules column follows [external-and-rules-tables.md](external-and-rules-tables.md): each column's kind decided by the condition-or-return test; Inputs list only what the expression reads, named as in the signature; Parameters typed by the model and named uniquely; external titles unique and copied exactly by the Smart table; every binding confirmed after compiling.
- Values that depend on an input are in decision tables: no Data table, ternary chain or hard-coded constant added for them. Every departure from the model has its description property and a drafted AGENTS.md entry in the hand-off (Workflow step 1); every table listing all values of a vocabulary has a drafted entry recording it against that vocabulary (Non-negotiable 3). Every new table has unit test cases, expected values from the requirement, handed to testing. A value change came with an impact preview, and its companion rows were confirmed by the user.
- The project compiles with no new errors or warnings; the temporary gap and overlap check ran and its property was removed; the domain run matches the requirement; existing tests pass. After an optimization, every result is identical to before.
- Every removed or renamed table, row, column, return value or input passed the dependency check (Non-negotiable 6); versions of the rule keep identical signatures. The work is on a branch and the user approved it before saving.

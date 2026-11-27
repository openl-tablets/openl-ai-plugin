# Non-negotiables in full

Part of the decision-tables skill, moved word for word from its SKILL.md, which keeps a one- or two-line statement of each rule and links here. Section names in parentheses are in this file, in [workflow-and-writing.md](workflow-and-writing.md), or in one of the files listed under **Where to read** in [SKILL.md](../SKILL.md).

Read the section of a rule when SKILL.md points to it, or whenever a rule's short form there leaves a case open. The numbers are the ones the other files cite.

## 1. Existing tables keep what they have

**Existing tables keep what they have:** type, header, column titles, column order, orientation, range notation, place on the sheet. Change only what the task asks. Only an optimization task may change the layout ([optimization](optimization-and-performance.md)), and even then never a value. A new table follows its siblings in the module: same type, title style, range notation, layout. Read the table back after writing to confirm.

## 2. Values exactly as given

**Values exactly as given.** Every value, band and boundary is copied from the requirement or the user, with full precision and unit.
- Spreadsheet source: take the stored value, not the displayed one (a format can show 0.76 for 0.7633). Use a tool that returns stored values (for a formula cell, its calculated result).
- Pasted text or a screenshot that may be rounded for display → ask for the source file or the full values.
- Never invent, round, interpolate or extend a band; never fill a missing cell. Ask.
- Write every value the source gives, `FALSE`, `No` and `0` included. A blank cell never stands in for a value: an empty condition cell matches anything, an empty return cell returns no value.

## 3. Every input lands where someone decided

**Every input lands where someone decided.** Check each condition's full value domain, not only the values the requirement names. This is a coverage check, not a list of rows to build: other values can still reach the table, and an unmatched input returns null or an error, depending on the table type.

| Input | Domain and decision |
|---|---|
| Any | Vocabulary values; true and false; the numeric range from the lowest to the highest possible value; empty, for an input without a vocabulary. |
| Calculated (passed in by the caller, no domain in the model) | Take its values or range from the step that computes it when readable there; otherwise ask the user and propose a catch-all row. |
| Vocabulary | No empty case and no catch-all: it cannot hold a value outside its vocabulary. A value the requirement does not name gets its own row, with the value the user gives. |
| Requirement decides the rest ("any other coverage type", "all others") | That is the decision: one catch-all row, blank condition, last. Never a list of the remaining vocabulary values: the requirement also means values added later. |
| No vocabulary | Propose one catch-all row, blank conditions, last, returning the value the user or the requirement gives. |

List the inputs the requirement does not cover and ask what the table returns for them. Never leave a gap silently; never invent its value. A table that lists every value of a vocabulary (no catch-all) must be updated whenever the vocabulary gets a value, or the new value matches no row: draft an AGENTS.md entry (or the project's equivalent) recording the table against that vocabulary, and name it in the hand-off as a table to revisit when the vocabulary grows.

## 4. Specific rows first, the catch-all last

**Specific rows first, the catch-all last.** The first matching row wins and a blank condition matches anything, so a blank row above more specific rows hides them. Order rows from most specific to most general, with at most one catch-all, at the end. Two rows that match the same input with different results are an overlap to fix or report, unless the user states the order is the intended rule.

## 5. Ranges in one cell, both ends included

**Ranges in one cell, both ends included,** unless the siblings use another notation: `25 - 29`; open ends `< 18` and `70+`; adjacent bands meet with no gap and no overlap (`25 - 29`, `30 - 34`). Never mix notations in one column. Fractional inputs cannot meet with both ends included (a value between `0.5` and `0.51` falls in no band): there, every band takes the bracket form with one end excluded (`[0.5; 1)`).

## 6. Check dependencies before removing or renaming anything

**Check dependencies before removing or renaming anything:** a table, row, column, return value or return type, input parameter or its name, or a vocabulary value a row tests.
- Readers: calling spreadsheets and rules, test tables, a UI config, other projects through module dependencies, and other versions of the same rule (dispatch needs identical signatures, parameter names included).
- Before the change, run a dependency check: a dependency-analysis tool if available, otherwise search the whole project for the name and check every caller and test table. List what would break.
- Something outside the project depends on it → hand the change to the user instead of making it.

## 7. An optimization never changes a result

**An optimization never changes a result.** A compacted, transposed or merged table returns the same value as before for every input. Prove it by running the old and the new table over the full value domain before saving ([optimization](optimization-and-performance.md)).

## 8. Values chosen by an input live in decision tables

**Values chosen by an input live in decision tables** (a factor per state, a rate per plan type, a discount per age band): a SmartRules or SmartLookup table (or the sibling type the project uses), keyed by that input.
- Never a ternary chain (`state == "NY" ? 1.1 : state == "CA" ? 1.2 : 1.0`); never a constant hard-coded where a table should hold it.
- Data tables are never used for rule logic: values a rule reads go in a decision table; Data tables stay with test data.
- An existing Data table that rules read stays as it is unless the task asks to replace it; propose the replacement in the reply.

## 9. The fewest columns and rows that say the requirement

**The fewest columns and rows that say the requirement.**
- Every condition column is a business key of the requirement, and nothing else.
- A key with a few values that splits every row (Own/Rent, gender, tier) goes across the top as a horizontal condition (in a lookup, or `HC1` in a Rules table), not a condition column that doubles the rows.
- A surcharge or discount for one key value is a formula in the return cell that keeps the given figures visible (`=150 * (1 + 0.2)` for a 20% charge). Never an extra column only for the arithmetic (a charge of 0 or 0.2); never a duplicated row.
- Rows follow the requirement's layout: a value listed on its own line gets its own row (one state, one line). Values share one cell as a comma-separated list only when the requirement groups them so or the user asks. The requirement's "any other" is one blank row (Non-negotiable 3).
- Before writing, read the draft once more and remove any column, row or expression OpenL does not need for the same result.

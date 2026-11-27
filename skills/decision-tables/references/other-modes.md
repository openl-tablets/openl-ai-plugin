# Reviewing, offline and reply-only modes

Part of the decision-tables skill, moved from its SKILL.md. Non-negotiables, Workflow, Writing the table, Verification checklist and Scope and sources are in short form in [SKILL.md](../SKILL.md) and in full in [non-negotiables.md](non-negotiables.md) and [workflow-and-writing.md](workflow-and-writing.md); any other section named in parentheses is in one of the files listed under **Where to read** there.

## Reviewing a decision table

A review checks a table against this skill's conventions. It does not check values against a business document (a conformance audit, a separate task) and changes nothing unless the user asks for the fix afterwards.

1. Read the table raw (layout, titles, merges) and parsed, its siblings, the model datatypes and vocabularies it reads, its callers and the test tables that check it.
2. Walk, in order: the Non-negotiables; Completeness and conflicts (list the gaps, overlaps and unreachable rows found); the Verification checklist; the patterns of Optimizing an existing table and Performance.
3. Report in the chat, one block per finding: where (table, row, column), which rule or section, what is wrong, the concrete change. Group as must fix (a Non-negotiable), should fix (completeness, layout, performance, naming) and notes. Close with what was checked and holds, one line each, and any question the project does not settle (ask; never invent a convention).

## Writing offline or in a reply

**Offline, through a spreadsheet library** (module `.xlsx` delivered or committed, no Studio connected): reproduce the siblings' sheet layout (start column, merged header, title rows, merges), one blank row and column around each table. Store ranges, lists and expressions as text, so Excel does not turn `1-4` into a date or `= …` into an Excel formula. Syntax from the online reference guide (Scope and sources). Nothing can be compiled, run or tested this way: say so and list what the user must verify in Studio.

**In a reply only:** a Markdown table with the header line above it, exactly as typed into Excel, one Markdown row per sheet row. Show merged cells by repeating the value or leaving the cell blank, with a note saying which.

# Reviewing, offline and reply-only modes

Part of the calculations skill, moved word for word from its SKILL.md. Scope and sources, Hand-offs, the Non-negotiables (rules 1–8, short form), the Workflow (one line per step) and the Performance rule are in [SKILL.md](../SKILL.md); the full Non-negotiables are in [non-negotiables.md](non-negotiables.md), the full Workflow steps, Writing the table and the Verification checklist in [workflow.md](workflow.md), and the Performance patterns in [performance.md](performance.md); any other section named in parentheses is in one of the files listed under **Where to read** there.

## Reviewing a spreadsheet

A review checks a table against this skill's conventions; it does not check the rules against a business document (that is a conformance audit, a separate task) and it changes nothing unless the user asks for the fix afterwards.

1.  Read the table raw (layout, headers, markers) and parsed (formulas), its parent and siblings, the model datatypes it reads, and the test tables that check it.

2.  Walk the Non-negotiables ([non-negotiables.md](non-negotiables.md)), then the Verification checklist ([workflow.md](workflow.md#verification-checklist)), then the Performance patterns ([performance.md](performance.md#patterns-that-save-execution-time)), in that order.

3.  Report in the chat, one block per finding: where (table and step), which rule or section, what is wrong, the concrete change. Group them as must fix (a Non-negotiable), should fix (performance, design, naming) and notes. Close with what was checked and holds, in one line each, and with any question the project does not settle (ask; never invent a convention).

## Writing offline or in a reply

**Offline, through a spreadsheet library** (module `.xlsx` delivered or committed, no Studio connected): reproduce the sheet layout of the sibling tables (start column, header merged over the columns, header-pair row, formula cells stored as text), one blank row between tables, and keep the comment columns. Insert a new sheet before the Environment sheet, which stays last. Syntax lookups then use the online reference guide (see Scope and sources). Nothing can be compiled, tested or traced this way, so say so in the reply and list what the user must verify in Studio.

- **Formatting.** Fonts, fills, borders and number formats are optional and never block the task; do not ask the user to add them. The project's AGENTS.md or the user decides; otherwise:
    - *Through Studio:* write the cells only (the server can neither read nor set styles). If the user wants formatting, list the new tables and say it is done in Studio by copying a sibling table's look.
    - *Offline `.xlsx`:* copy the style of an existing table of the same kind on the sheet; with none, write plain cells; apply a house table format only when the user asks for it.
    - *Layout is not formatting* and always applies: the merged header, one blank row and column around each table, orientation, and the Environment sheet last.

**In a reply only:** render the table as a two-column Markdown table with the header line above it, exactly as it would be typed into Excel.

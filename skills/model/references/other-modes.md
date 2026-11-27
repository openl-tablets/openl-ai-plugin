# Reviewing, offline and reply-only modes

Part of the model skill, moved word for word from its SKILL.md. The Workflow, the hand-offs and Writing the table are in [SKILL.md](../SKILL.md); the full Non-negotiables are in [non-negotiables.md](non-negotiables.md); Scope and sources, the Workflow steps in detail and the Verification checklist are in [sources-workflow-verification.md](sources-workflow-verification.md); any other section named in parentheses is in one of the files listed under **Where to read** there.

## Reviewing a model

A review checks a model against this skill's rules. It does not check the rules against a business document (that is a requirements audit), and it changes nothing unless the user asks for the fix afterwards.

1. Read the model and vocabulary tables raw, the entry point's signature, the request schema if the project is deployed, and the consumer's contract if it is available. When the review is of a change, compare the branch with the main branch's model.
2. Walk the Non-negotiables, then the Breaking-change rules (for a change), in that order.
3. Report in the chat, one block per finding, grouped as:
    - **Must fix** — breaks a Non-negotiable.
    - **Should fix** — design, naming, schema documentation.
    - **Notes** — observations that need no change.

   Each finding gives the location (`Datatype.field`, a vocabulary and value, or a table and step), the rule, and the concrete change. Close with what was checked and holds, one line each, and with the questions the project does not settle.

## Writing offline or in a reply

**Offline, through a spreadsheet library** (a module file delivered or committed, no Studio connected): reproduce the siblings' layout and sheet, one blank row and column around each table, and use the online reference guide for syntax. A datatype with only type, name and default columns has no column-header row; adding a description, example or mandatory column needs one. Nothing can be compiled or tested this way: say so in the reply, and list what the user must check in Studio.

- **Formatting.** Fonts, fills, borders and number formats are optional and never block the task; do not ask the user to add them. The project's AGENTS.md or the user decides; otherwise:
    - *Through Studio:* write the cells only (the server can neither read nor set styles). If the user wants formatting, list the new tables and say it is done in Studio by copying a sibling table's look.
    - *Offline `.xlsx`:* copy the style of an existing table of the same kind on the sheet; with none, write plain cells; apply a house table format only when the user asks for it.
    - *Layout is not formatting* and always applies: the merged header, one blank row and column around each table, orientation, and the Environment sheet last.

**In a reply only:** render each table as a Markdown table with its header line above it, exactly as it would be typed into Excel.

# Sources, workflow detail and verification

Part of the model skill, moved word for word from its SKILL.md. Workflow and the one-line Non-negotiables are in [SKILL.md](../SKILL.md), the hand-offs and Writing the table are there too; the full Non-negotiables are in [non-negotiables.md](non-negotiables.md); any other section named in parentheses is in one of the files listed under **Where to read** in SKILL.md.

## Contents

- [Scope and sources](#scope-and-sources) — read at Workflow step 1, before the first read of the project
- [Workflow steps in detail](#workflow-steps-in-detail) — read alongside each Workflow step
- [Verification checklist](#verification-checklist) — run at Workflow step 6

## Scope and sources

| Source | Rule |
|---|---|
| Studio and project | Work in the Studio and project the user names (Studio URL, repository, project, branch). The OpenL MCP server may be connected to another Studio: check it is the one the user means before the first read. None named, or the connected Studio does not hold the project → ask; never assume. A planning or domain skill that calls this one passes them on. |
| The model module | Its datatype and vocabulary tables and their sheets (usually Model and Vocabulary), the entry point's signature, the current request schema in the service's API description, AGENTS.md if there is one. They give the object hierarchy, naming and layout, and what the consumer sends. The project's convention wins; the Non-negotiables always apply. Not settled by the project → ask; never invent a convention. |
| The model's readers | The spreadsheet and lookup tables that read the model, test and data tables, a UI config if there is one. Read for the dependency check (Non-negotiable 5), not for conventions. |
| Requirements and the consumer's data | A requirements inventory (the inputs the rules need) and the calling system's side: its product model (objects, attributes, levels, lookups), the configuration of the values it offers, an integration mapping document, the current request. They decide names, levels, types and value lists (Non-negotiables 1–3), so they are needed before drafting, not after. Look for them first: AGENTS.md, the connected document stores, related projects in Studio (possibly another Studio instance; ask which). Ask the user for every one not found, say which are missing, and never present a draft built without them as aligned with the calling system. |
| OpenL Tablets Reference Guide | Syntax is never kept here. The MCP server bundles the guide by chapter at the Studio's version: list the guides and fetch the chapter. Chapters: *Datatype Table*, *Inheritance in Data Types*, *Vocabulary Data Types*, *Working with Data Types*, and the *Runtime Context Properties in Datatype Tables* part of *Rule Versioning*. Defaults, including those for a nested object or an array, are in *Datatype Table*. The titles name topics, not fixed chapters: if one is renamed, split or missing at the Studio's version, list the guides, fetch whichever covers the topic and name it in the reply; if none does, say so and ask. No server → ask the user to connect it. Only when the work must stay offline use https://openldocs.readthedocs.io/en/latest/documentation/guides/reference_guide/ and state that nothing was compiled or tested. |

## Workflow steps in detail

The step numbers match the Workflow in SKILL.md.

1. **Understand.** Read the request and AGENTS.md if there is one. Through the MCP server, read raw (layout, columns, sheets): the model and vocabulary tables, the entry point's signature and the tables it calls first, the test tables, the UI config if any. Read the current request schema in the service's API description when the project is deployed, the consumer's contract and the requirements inventory. Never guess a field name; read the model.
   - *When the user provides a model* (pasted datatype tables, a module file, a product model workbook or a target structure), read it like the project's own.
     - The current model → work in change mode from it, with no Studio needed until writing.
     - The target model → it replaces deriving the inputs from the requirements: take its objects, fields, types and lists as given, check them against the Non-negotiables, and put every conflict with the requirements, the consumer's contract or the project's existing model on the clarification list. Never redesign it silently.
     - Studio is also connected and the two differ → ask which one is current.
2. **Decide the mode:** build or change (table at the top).
3. **Draft.**
   - *Build mode:* follow [build-mode.md](build-mode.md) — step 1 lists the inputs when no inventory and no user-provided model exist, step 2 turns the list into `Datatype` tables.
   - *Change mode: write a change list.* The draft when the model exists and the request adds, renames, retypes or removes fields or vocabulary values ("add field X to the request"). Instead of a new model: one line per change, with object and field, before → after, and breaking or additive ([breaking-change rules](response-and-breaking-changes.md)).
   - *Single object: build one datatype and its children.* The request names one object ("create a datatype for Driver") and no parent → build that object, its child datatypes and its vocabularies, and put on the clarification list which object holds it and whether it repeats there (for example `Policy.drivers`), so it can be reached from the top datatype (Non-negotiable 2).
   - *All modes: the clarification list.* The questions the requirements leave open, if any. One line per question: the field, the question, why it matters, who answers. It goes to the BA (Non-negotiable 4).
   - *All modes: show the draft before writing.* Show the draft and the clarification list to the user; only settled items are written. When the user asks for the file or table straight away, deliver it as a draft instead of holding it back: put the proposed naming (Non-negotiable 1) and the clarification list in the same reply, use only the defaults and values the user stated, and say it changes once the questions are answered.
4. **Check dependencies** for every rename, retype, move or removal, and every vocabulary value added or removed (Non-negotiable 5).
   - A new vocabulary value is additive for the contract but still a dependency: find every decision table and spreadsheet step that tests the vocabulary's values, and hand each to the decision-table or spreadsheet skill — to add a row or branch for the new value, or to confirm that a catch-all row already returns the right value. Not done until each one is updated or confirmed.
   - Report the readers grouped as: tables in this project (table and cell); test and data tables; the UI config; dependent projects; the exposed service and its consumers; integration mappings. Name the hand-off for each group.
5. **Write** on a work branch: the datatypes and vocabularies (Writing the table, in SKILL.md), and in the same branch the readers' changes, made through the hand-off skills or as mechanical reference changes, so the project compiles.
6. **Verify** with the Verification checklist.
7. **Write the business summary.** Plain words, no syntax: what the request gains or loses; each change, breaking or additive, and who reads it; the hand-offs (a change the response must follow, such as an echoed identifier, goes to the spreadsheet skill); the open clarifications.
8. **Stop for approval.** The consuming team verifies the contract change, and the user approves it before the project is saved. The user decides when the branch is saved, merged and deployed.

## Verification checklist

Workflow step 6 runs every line; the business summary reports any line that does not hold.

- Names, types and arrays follow the siblings, or the default the user confirmed; no field is a bare generic word (`type`, `amount`, `date`); datatypes and vocabularies sit where Non-negotiable 7 places them.
- Every field sits on its owner object, once; every datatype except the top one is a field of its parent.
- Level check: every level and object of the consumer's structure (or of the confirmed reference) is in the draft, with the same parent and cardinality; nothing was dropped, merged, flattened or re-parented without the user's answer to a question asked before the draft.
- Every major object, the top datatype included, has an identifier; every level that can repeat had its cardinality confirmed.
- Every closed list is a vocabulary; values from another system match its list (apart from a dropped technical prefix and type suffix); values first defined in this model have no blanks or symbols.
- Related attributes of four or more are grouped in a datatype at the product model's level.
- No attribute mixes units (dollar vs percent).
- Vocabulary values from another system have their repeated technical prefix and redundant type suffix dropped, and the mapping hand-off lists it; the Model module holds no new internal helper datatype unless the user asked for it.
- Every input that drives rule versioning is declared as a context field; no selected/included flag is kept for items sent only when selected.
- Nothing on the clarification list was written as a guess.
- Every rename, retype, move or removal, and every added or removed vocabulary value, passed the dependency check; every table that tests an added value's vocabulary was updated for it or confirmed through the hand-off; a new search finds no reader left on the old name; every reader outside the project is handed off.
- The project compiles with no new errors or warnings.
- The existing tests pass, or each failure is explained by the change and handed to the testing skill.
- One real test input run through the entry point is read correctly: the rules receive the expected request fields.
- Every change the response must follow is in the hand-off to the spreadsheet skill.
- The work is on a branch, the business summary is written, and the change is waiting for approval.

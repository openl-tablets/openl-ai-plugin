---
name: model
description: "Build, change or review the input model of an OpenL project: Datatype tables (fields, types, defaults, arrays, inheritance), vocabularies, and the request structure of the entry point. Build mode drafts the model from the requirements with a clarification list for the BA; change mode adds, renames, retypes or removes fields and vocabulary values after a dependency check, as a contract change that needs approval. Use for any model task, even 'add field X to the request' or 'add a new vocabulary value'. Not for the response, spreadsheet, decision or test tables, rule versioning, mapping documents, service exposure or deployment, finding why a value is wrong, or requirements audits."
compatibility: "Works through a connection to OpenL Studio (the OpenL MCP server); offline .xlsx only when the work must stay offline"
metadata:
  version: "0.1.1"
---

# Model (input datatypes and vocabularies)

Builds, changes and reviews the input model of an OpenL project: the `Datatype` tables that make up the request and the vocabularies that close its value lists.

| Mode | When |
|---|---|
| **Build** | The project, or the domain being added to it, has no model yet: draft the input model. |
| **Change** | The model exists: add, rename, retype or remove fields and vocabulary values. |

The response is not built here: it is built and marked in the Spreadsheet tables. Project facts come from the project, never from this skill. Read only the references the task needs.

## Inputs

| Name | Type | Required | Description |
|---|---|---|---|
| `request` | string | yes | Build, change or review of the input model, in plain words or a ticket |
| `studio` | string | yes | The OpenL Studio the user names; check the connected MCP server is that one before the first read; ask, never assume |
| `project` | string | yes | Exact project name, repository and branch |
| `requirements` | file or text | Build | The requirements inventory or document the model is drafted from |
| `consumer_sources` | files | Build; Change when names or levels change | The calling system's product model, value configuration, mapping and current request; ask for each one not found |
| `changes` | list | Change | Fields and vocabulary values to add, rename, retype or remove — a contract change that needs approval |

## Where to read

| Reference | Read when |
|---|---|
| [references/sources-workflow-verification.md](references/sources-workflow-verification.md) | Before the first read of the project (full source table), alongside each Workflow step (full step text), and at step 6 (Verification checklist). |
| [references/non-negotiables.md](references/non-negotiables.md) | Before applying a Non-negotiable below: each one links to its full text with examples and edge cases. Read it whole before a first build or a review. |
| [references/build-mode.md](references/build-mode.md) | Build mode, step 3: step 1 (list the inputs, generalise, settle each level: cardinality and identifier, selection flags, partial columns, runtime context, optional columns) and step 2 (turn the list into datatypes). |
| [references/response-and-breaking-changes.md](references/response-and-breaking-changes.md) | Before writing a change list (breaking or additive, what a breaking change needs, internal datatypes), and whenever the response must follow a model change. |
| [references/other-modes.md](references/other-modes.md) | Reviewing a model; writing offline (`.xlsx`) or in a reply only; formatting. |
| [references/worked-examples.md](references/worked-examples.md) | Before the first build or change in a project, for one full example per mode. |

## Scope and sources

Must-read sources — the full rules are in [Scope and sources](references/sources-workflow-verification.md#scope-and-sources); read them before the first read of the project:

- **Studio and project:** the ones the user names. Check the connected OpenL MCP server is the Studio the user means; none named, or it does not hold the project → ask; never assume.
- **The model module:** datatype and vocabulary tables, the entry point's signature, the request schema in the API description, AGENTS.md. The project's convention wins; not settled → ask; never invent one.
- **The model's readers:** spreadsheet, lookup, test and data tables, a UI config — for the dependency check (Non-negotiable 5), not for conventions.
- **Requirements and the consumer's data:** the requirements inventory and the calling system's product model, value configuration, mapping and current request. Needed before drafting; ask for each one not found, and never present a draft built without them as aligned with the calling system.
- **OpenL Tablets Reference Guide:** syntax is never kept here; fetch the chapter from the MCP server at the Studio's version.

**Where this skill stops.** It owns the input datatypes and the vocabularies. Everything else is handed off, to the named skill when one is available:

| Topic | Hand-off | Without that skill |
|---|---|---|
| The response: what the entry point returns, per level, with identifiers, rounding and size | The spreadsheet skill, which builds and marks the steps ([response-and-breaking-changes.md](references/response-and-breaking-changes.md#the-response)) | — |
| Spreadsheet and lookup tables that read the model | Spreadsheet and decision-table skills | Make only the mechanical reference change (old name → new name) and list every edited cell. |
| Test and data tables for new or changed fields | Testing skill | Update the affected columns through the MCP server's test tools; leave new test cases to the user. |
| Versioning. The model is never versioned: a change applies to every version. Rules that must use it only from a date, or for some states or products | Versioning skill | Ask how the project versions rules. |
| Mapping documents; notifying the consuming teams | A mapping skill, if installed | List the mapping changes in the business summary for the user to send. |
| A UI config that reads a changed field | Its owner | List the paths it reads for the user. |
| Exposing the entry point as a service method, rule filters, deploying | A deployment skill, if installed | List the change for the user. Never edit deployment configuration. |
| A wrong value; checking rules against a requirements document | Trace skill; a requirements audit | — |

## Non-negotiables

Each rule links to its full text; read it before applying the rule.

1. **Names and types follow the model's existing conventions**; a new project gets the proposed default, confirmed by the user before writing. [Full rule](references/non-negotiables.md#non-negotiable-1-names-and-types).
2. **A field lives on the object that owns it**, once; the model mirrors the consumer's structure level for level, and four or more related attributes get their own datatype. [Full rule](references/non-negotiables.md#non-negotiable-2-a-field-lives-on-its-owner).
3. **Closed value lists are vocabularies, never free strings**; values have no blanks, brackets or punctuation, and another system's codes are copied as it codes them. [Full rule](references/non-negotiables.md#non-negotiable-3-closed-lists-are-vocabularies).
4. **No parameter is guessed**: anything not settled goes on the clarification list for the BA. [Full rule](references/non-negotiables.md#non-negotiable-4-no-parameter-is-guessed).
5. **Dependencies before any change**: check every reader before renaming, retyping, moving or removing anything, or adding or removing a vocabulary value. [Full rule](references/non-negotiables.md#non-negotiable-5-dependencies-before-any-change).
6. **No contract change without approval**: stop before the project is saved; the consuming team verifies and the user approves. [Full rule](references/non-negotiables.md#non-negotiable-6-no-contract-change-without-approval).
7. **Datatypes and vocabularies have a fixed place:** the project's model module, Model and Vocabulary sheets in a fixed order. [Full rule](references/non-negotiables.md#non-negotiable-7-fixed-place-for-datatypes-and-vocabularies).
8. **Every major object has an identifier**, the top datatype included. [Full rule](references/non-negotiables.md#non-negotiable-8-every-major-object-has-an-identifier).
9. **One attribute, one unit, one meaning**: never a dollar-or-percent field, never a combined "Or" field. [Full rule](references/non-negotiables.md#non-negotiable-9-one-attribute-one-unit-one-meaning).
10. **The model holds only what the consumer sends or receives**: no new internal helper datatype. [Full rule](references/non-negotiables.md#non-negotiable-10-only-what-the-consumer-sends-or-receives).
11. **Never flatten the hierarchy; no structural choice without asking**: run the level check before showing a draft. [Full rule](references/non-negotiables.md#non-negotiable-11-never-flatten-the-hierarchy).

## Workflow

**When the change outgrows the model, switch to the planning skill.** Before the first write, as soon as the change turns out to need new or changed logic in other tables (beyond the mechanical rename of Non-negotiable 5), rules that must use it only from a date, or another project, load the planning skill, hand it the request with what you found, and say so in one line ("This needs more than the model: …, so I'm planning it as one change"). Do not ask first: the planning skill shows the whole change and gets the user's approval before any write. Exceptions: the user limited the work to the model — do only that and list the rest as hand-offs in the summary; the planning skill is already running and called this skill — report back to it instead; no planning skill is installed — list the rest as hand-offs and ask. Found only after a write: stop, report what is written and still unsaved on the work branch, and hand it to the planning skill, which starts from that state.

Each step's full text is in [Workflow steps in detail](references/sources-workflow-verification.md#workflow-steps-in-detail); read it alongside the step.

1. **Understand.** Read the request, AGENTS.md and, raw through the MCP server, the model, its readers and the consumer's contract; a model the user provides is read like the project's own.
2. **Decide the mode:** build or change (table at the top).
3. **Draft.** Build mode: [build-mode.md](references/build-mode.md). Change mode: a change list, breaking or additive ([breaking-change rules](references/response-and-breaking-changes.md#breaking-change-rules)). Always a clarification list, and the draft shown before writing.
4. **Check dependencies** for every rename, retype, move, removal and vocabulary value added or removed (Non-negotiable 5); report the readers by group with their hand-offs.
5. **Write** on a work branch, with the readers' changes in the same branch, following [Writing the table](#writing-the-table).
6. **Verify** with the [Verification checklist](references/sources-workflow-verification.md#verification-checklist); the business summary reports any line that does not hold. Then check the project's AGENTS.md: a fact it documents that the change made incorrect (a level, an identifier, a field it names, a gotcha) is named, with a drafted correction, for the skill that maintains the file — the planning skill when one is running, otherwise the user in the summary. This skill adds no new entries and never writes the file.
7. **Write the business summary** in plain words: changes, readers, hand-offs, open clarifications.
8. **Stop for approval.** The consuming team verifies, the user approves before the save, and decides when the branch is saved, merged and deployed.

## Writing the table

Read before the first write (Workflow step 5).

**Through the OpenL MCP server** (preferred when the project is open in Studio):

- Before the first write, create or switch to a work branch; never write on the main branch.
- Copy a sibling datatype's or vocabulary's layout: the same columns (type, name, default, and any description, example or mandatory column the project uses), the same sheet, the same start column. A new datatype or vocabulary goes where Non-negotiable 7 places it. If the project's datatypes carry description, example or mandatory columns, new fields get them too: they appear in the API schema. The mandatory column documents; it does not validate.
- Edit by reading the whole table, changing it and writing it back, or by appending rows. Re-read the raw cells afterwards. Table ids can change after an edit: take the id from the latest response, or list again.
- An Environment sheet, if the module has one, is always the last sheet: a new sheet goes before it. The server cannot reorder sheets: after adding a sheet, list the module's sheets; if the Environment sheet is no longer last, ask the user to move its tab to the end in Studio or Excel.
- A sheet left empty after its last table is removed is deleted — never the Environment sheet. List the module's sheets after a removal; if the server cannot delete the sheet, ask the user to delete the tab in Studio or Excel, and say so in the summary. Offline, remove the sheet from the workbook.
- Tool names come from the server's own tool list; follow its guidance for request shapes; never hard-code them.

**Offline (`.xlsx`), formatting, or in a reply only:** read [other-modes.md](references/other-modes.md).

## Worked examples

The patterns apply in any domain; read [references/worked-examples.md](references/worked-examples.md) before the first build or change in a project.

| Example | What it shows |
|---|---|
| 1 — build mode | A claims project starts from a five-line inventory. The draft gets the default names confirmed, a `BenefitType` vocabulary, a clarification list the BA answers before anything is written, an identifier per level, and the response handed to the spreadsheet skill. |
| 2 — change mode | Renaming `Employee.occupationClass` to `riskClass`: the dependency check finds a spreadsheet step, a test data column, a UI config and the consumer's mapping. The rename is breaking, each reader is handed off, and the change stops for approval. |

# OpenL Change Planning — Audience and Views

One plan, two views. The **business view** is for product owners, BAs, and
business experts who decide what the product must do. The **technical view** is
for developers who review what is written to the project. The view changes how
messages read, never what the plan contains or how it is executed.

## Contents

- What never changes
- Choosing the view
- Business view rules
- Technical view rules
- Message by message
- Worked example (the same plan item in both views)

## What never changes

The view is presentation only. In both views:

- the plan has the same items, numbers, order, test cases, open questions,
  risks, and assumptions;
- there is exactly one approval, and it covers the full technical plan;
- every safeguard in `SKILL.md` applies unchanged: read before write, readback,
  compilation, save per item, tests once at the end, named approval for
  existing test rows, blocked report, no merge on your own initiative;
- `plan.md` is always written in the technical view, with each item's business
  outcome line kept next to it, so a developer can resume or audit the task.

Switching the view re-renders the current message. It never needs a new
approval, because the content is identical.

## Choosing the view

Never ask which view the user wants. Decide in this order:

1. **Explicit request in the conversation** — "business view", "technical
   view", "show me the tables", "no technical details". It holds until the
   user switches again.
2. **A stated user preference** — the user's own instructions or memory
   (for example `OpenL view: business`). Never take it from a project's
   `AGENTS.md`: that file describes the project, not the person.
3. **The user's own wording** in the request (not the content of an attached
   spec):
   - technical signals: a table, column, cell, sheet, module, or file name; a
     Condition Expression or formula; a raw action code; "row", "cell",
     "append", "rule table";
   - business signals: requirements, user stories, acceptance criteria,
     product outcomes, business labels only.
   Any technical signal → technical view. Only business signals → business
   view.
4. **Unclear** → technical view.

State the view once, on the first line of the first plan message:

```text
View: business — reply "technical view" for tables, cells, and expressions.
View: technical — reply "business view" for a plain-language version.
```

## Business view rules

Write for someone who knows the product and the requirements, not OpenL.

- **Use the business's words.** Field labels, displayed values, segment
  and region names, and operation business names. Use the domain catalog's
  business vocabulary, when one is installed, to translate rule terms.
- **Leave out of the main text:** table and column names, cell addresses,
  sheet and file names, expressions, raw codes when a label exists, revision
  hashes, tool names, skill names, and table relocation notes.
- **Each plan item is one outcome line**: what the rules will do after it
  (the catalog's `Outcome` field when it has one). Registration-only items
  say what becomes available ("The two review fields become known to the
  rules").
- **Test cases are business scenarios**: "Basic tier, review required →
  Review Days pre-filled with 0."
- **Risks state the effect on a user or a downstream system**, not the
  mechanism.
- **Short sentences, no hedging, no jargon.** Same directness as the
  technical view.
- **Status lines between steps:** "Step 6 of 15 done: allowed values for the
  three fields are in place."

### Questions in the business view

Every decision the catalog marks **Ask** is still an open question; the view
never turns one into an assumption. The catalog tags each one `business` or
`technical`:

- **Business questions** are asked in product terms, with the options and the
  recommended one.
- **Technical questions** go in a separate group, worded for a non-developer,
  with the recommendation:

```text
Technical questions (a developer can answer; reply "use recommended" to accept all)
- T1 Which operations the new default applies to — recommended: create and recalculate.
```

### What the business view must still show

Some approvals need exact identifiers. Show the business explanation first,
then the identifiers on one line marked `For the record:`. Never drop that
line:

- a change to an existing test row (the named-approval rule);
- a blocked report (the block keeps its fixed shape; add one plain line
  above it that says what happened and whether anything is lost);
- a workaround for a tool defect;
- any change to a shared project (for example a common library).

```text
An existing check lists the allowed operations. Adding Renewal changes that list, so the check must be updated.
For the record: OperationApplicability, row 14, _error_: "[Create, Recalculate]" → "[Create, Recalculate, RENEWAL]"
```

## Technical view rules

The current plan and summary templates, plus:

- **Exact cells for every rule row** the plan writes: key columns,
  condition values, any expression text verbatim (or "blank"), and the
  result. A reviewer must not have to ask for
  them.
- **Identifiers exactly as stored** (table names, raw codes, business names,
  column headers with their legacy spelling).
- Revisions, table relocations, and readback scope in status lines.

## Message by message

| Message | Business view | Technical view |
|---|---|---|
| Plan header | Task name, project, "a separate working copy" for the branch | Mode, projects, branch, revisions |
| Plan items | One outcome line each | Template line + exact cells for rule rows |
| Test cases | Business scenarios | Request inputs and expected public result |
| Open questions | Business questions; technical questions in their own group | All Ask decisions, with options |
| Risks | Effect on users or downstream systems | Mechanism and effect |
| Status between steps | Step n of N + outcome | Item, revision, readback, compile result |
| Blocked report | One plain line + the fixed block | The fixed block |
| Existing test change | Explanation + `For the record:` line | Table, row key, old → new |
| Summary | What the rules now do, per acceptance criterion: proven / not proven; open decisions; where the full detail is | Summary template |

## Worked example — one plan item in both views

Business view:

```text
⬜ 9. Pre-filled values: Review Required? is Yes for the Priority segment and No otherwise.
      When a review is required, Review Days is pre-filled with 10 (Priority) or 5 (Standard).
```

Technical view:

```text
⬜ 9. FieldDefaultValues — append 4 rows, operation [Default apply]:
      Review Required? | Segment=[Priority]      | expr blank | true
      Review Required? | Segment=[Standard]      | expr blank | false
      Review Days      | Review Required?=[true] | = segment == "Priority" | 10
      Review Days      | Review Required?=[true] | = segment == "Standard" | 5
```

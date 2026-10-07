---
name: planning
description: >
  OpenL change planning — the entry point for building, changing, or fixing
  anything in an OpenL Tablets project of any domain: projects to open,
  research or diagnosis, branch and optional merge (or local WebStudio), the
  domain catalog's ordered changes, one approval, tracked execution, verified
  summary. Use proactively for "configure X", "add/update the rule for Y",
  "fix bug in Z", "implement PROJ-1234", "apply this ticket", or "why is this
  wrong".
metadata:
  status: "implemented"
  version: "0.4.0"
---

# OpenL Change Planning

## Purpose

Turn an OpenL build, change, or fix request into one approved, ordered plan,
execute it through the skills that own each mechanic, verify it against a real
test case, and report back. This skill owns the plan, the approval, the
tracking, and the summary. It does not own domain editing order — a domain
catalog skill supplies that — and it does not own branching, testing,
versioning, tracing, or change logging mechanics.

## Inputs

| Name | Type | Required | Description |
|---|---|---|---|
| `request` | string | yes | Plain-language request, ticket key/link, or spec file |
| `projects` | string[] | no | OpenL project names, if the user already named them |
| `verification_case` | object | no | Input payload and expected output that proves the change |
| `upstream_analysis` | string | no | A change-request-analysis handoff (scope, tier, stories); used as input, never redone |
| `audience` | `"business"` \| `"technical"` | no | How plans, questions, status lines, and the summary read. Unset → chosen as in [Audience](#audience). Never changes plan content or safeguards |

## When to use

- Any request to build, change, or fix an OpenL project, including a ticket
  key, a spec, or "why is this wrong".
- Continuing an earlier task (Resume) or redoing work after a conflict or
  refresh (Reapplication).
- Not for read-only questions or a plain test run — those go straight to the
  owning skill.

## Key concepts

- **Plan** — the full checklist this skill shows for approval.
- **Change plan** — a domain catalog's ordered items, embedded in the plan.
- **Change log** — the `openl-change-log/<slug>/` folder kept by
  `change-log-and-reapply`; its JSON files are the **change sets**.
- **Reapplication plan** — a new plan for reapplying a change log; it gets
  its own approval and is appended to `plan.md`, never overwriting it.
- **Ownership** — this skill owns the left column, delegates the right:

| Owned here | Delegated |
|---|---|
| Which projects, in which order, and whether research or diagnosis comes first | Root cause → `trace-investigation` |
| The deployment path: remote branch-and-merge, or local WebStudio | Branch creation, sync, merge → `branching` (remote only) |
| One plan, one approval, tracking, the closing summary | Domain edit order and evidence → the installed domain catalog skill |
| When the change log starts; running a reapplication plan | Log, preflight, and replay mechanics → `change-log-and-reapply` |
| Which gates need another approver | Test mechanics → `testing`; version properties → `versioning` |
| Presentation: business or technical view of every user-facing message | Business vocabulary and item outcomes → the domain catalog |

Scope, tier, estimation, and story split belong to change-request analysis
upstream. If its handoff exists, plan from it; do not re-estimate.

## Workflow

1. **Understand the request.** Fetch a ticket in full through the connected
   tracker (summary, description, Gherkin acceptance criteria, comments,
   samples); missing acceptance criteria is an open question, never something
   to invent. Read a spec in full. For a plain prompt, check it against the
   live project before assuming what is new. A wrong-result or bug request
   first delegates root cause to `trace-investigation`, then plans the fix. A
   request to redo work after a merge conflict, refresh, or replaced local
   state goes to Reapplication ([Modes](#modes)). A request to continue an
   earlier task goes to Resume ([Modes](#modes)).
2. **Make the projects ready (startup, no approval needed).** List the
   projects and match the request to them; an ambiguous match is a scope
   question. Include every project the domain catalog declares as required
   (for example a shared library the target project depends on). Open each one on its latest
   revision; open or initialize a missing, closed, or uninitialized one.
   Opening is not a rule change. If any required project cannot be opened,
   stop with a [blocked report](#blocked-report) — never plan against a
   partial set. An unsaved working copy found here is not saved or discarded
   before approval: report what it holds and which branch it belongs to, and
   make keeping or discarding it the first plan item. This rule takes
   precedence over any startup save rule of another skill.
3. **Detect the deployment mode.** Read the repository type of each target
   project through OpenL MCP. A local repository type means local WebStudio
   mode — see Local WebStudio ([Modes](#modes)). Otherwise remote
   mode. Record the mode in the plan.
4. **Find the test cases** — concrete input and expected output from the
   user, the ticket, or an attachment. Every change needs at least one,
   configuration changes included. If none was given, draft them from the
   catalog's evidence scenarios (Gherkin) and put them in the plan for the
   user to confirm or correct in step 7 — never invent expected values
   silently.
5. **Load the domain catalog.** If an installed catalog skill covers the
   project's domain (identified by the project's guidance or its
   structure), load it and take its
   change plan as the ordered domain items of this plan. Never invent a
   domain's edit order. No catalog installed → plan from the project's own
   conventions and say so.
6. **Choose the view** ([Audience](#audience)), then **draft one plan** with
   the template in [references/reference.md](references/reference.md),
   rendered in that view: context items
   (research, impact check, branch in remote mode, change log start only
   when a [change log trigger](#change-log) holds), the domain items, external gates,
   then the **test items last**: new test rows for the confirmed cases, one
   full test run, and the optional Finish item (merge; see the plan
   template rules). Use a ⬜ checklist of
   concrete, verifiable items. Save the approved plan as `plan.md` for every
   task — in the change log folder when there is one, otherwise in
   `openl-change-log/<slug>/` of the user's working folder, under the
   location rules of `change-log-and-reapply`. Across several projects, use
   one branch name everywhere and list every identifier that must match
   exactly.
7. **Ask only what matters** — genuine ambiguity, a decision expensive to
   reverse, data that cannot be inferred, and confirmation of drafted test
   cases.
   A decision a domain catalog marks **Ask** (for example: scoped
   configuration exists and the request names no scope) is always an open
   question, even when you have a preferred answer. State the options and
   mark the recommended one; never record it as an assumption. An
   assumption is only something no reasonable reviewer would decide
   differently. Risks the catalog raises go in the plan's Risks group.
   Bundle every question with the plan in one message: open questions, Ask
   decisions, and drafted test cases to confirm all go out with the plan, so
   the user answers once. Every later message to the user resumes a long
   session at high cost; after approval, ask again only when execution
   proves the plan wrong (step 9), never for something step 7 could have
   asked.
8. **Get one approval.** End the plan with the approval block from the
   reference and stop. Silence or an unrelated reply is not approval. If the
   user edits scope, restate the plan and ask again.
9. **Track and execute.** Keep the approved list visible and never silently
   add, drop, or reorder items. Delegate each item to the skill that owns it.
   After each item: read back the changed rows, check compilation, then
   save — in remote and local mode alike. **Save groups:** when dependent
   structural items cannot compile one at a time (for example a new
   dimension across model datatypes, scope helpers and result
   constructors), the plan declares them as one save group with its
   reason. Read back each item as it is written; check compilation and save
   once, at the end of the group. Never group independent items to postpone
   a save. Write a cell value that starts
   with `=` with a leading apostrophe (`'= true`, `'= getBoolean(...)`), so it
   is stored as text, not as a spreadsheet formula. Before each save, confirm that
   the pending changes hold only files this item wrote and, in remote
   mode, that the branch has no revision newer than the one the item
   started from; otherwise stop and ask, as `testing` describes in its
   pre-test sequence. Do not add test rows or run tests
   between changes. Record every feedback item at once (see
   [Feedback](#feedback)). Mark each verified item in `plan.md` at once, so the task
   can be resumed. End a turn only at an item boundary with nothing unsaved.
   If execution shows the plan is
   wrong or incomplete — for example a new dimension turns out to be
   needed — stop, restate the changed plan, and get approval again.
10. **Test, then summarize.** After the last change: add the new test rows
    for the confirmed cases, save, then run the full suite once through
    `testing` and read the results as it prescribes. A failure is classified
    by `testing`; a fix inside an approved item is verified, saved, and the
    suite re-run once, while a fix outside the plan needs a restated plan. A
    green suite alone does not close the task if a confirmed case was not
    checked. Before the summary, check every requirement of the request and
    every confirmed case against the readback and test evidence, and close
    any gap inside the approved items now: a gap the user's review finds
    costs another round-trip. Close with the summary template: one line per item, per-row test
    counts, the verification result, the branch or local project state, the
    change log location, any deviation from the plan, and every open problem
    the user must decide (unresolved findings, requirements not done,
    evidence not proven) — never leave one only in `plan.md` — and the
    feedback items.
11. **Finish — offer the merge** (only when the plan has the Finish item).
    Offer it only when all hold: 0 failures on the saved revision, every
    confirmed case checked, nothing unsaved, no open conflict, every ⏸ gate
    closed, no deviation awaiting a decision; otherwise report what is
    missing instead. Name the target branch in the question. Never merge or
    sync on your own initiative; on "yes", hand off to `branching`. Mark the
    item done only after the merge is confirmed on the target; on "no", leave
    it unmarked with the reason.
12. **Offer the feedback** (only when there are feedback items). List them
    and ask whether to send them to the OpenL team. On "yes", send each
    through the OpenL server's feedback channel when it offers one;
    otherwise give one ready-to-send text. Never send without that "yes".

## Feedback

A feedback item is anything that made the task harder than it should be.
Record it in the `Feedback` section of `plan.md` when it happens, in
addition to fixing it:

| Category | When |
|---|---|
| `tool_error` | A tool failed with an unexpected error |
| `unexpected_result` | Readback differs from the request: another row or table changed, rows shifted, merged cells lost, a table created elsewhere or in another shape |
| `skill_gap` | The tool did what was asked, but the request was wrong; the user corrected the agent or explained a term again; the catalog had no rule for the case; the plan had to be restated mid-task |
| `missing_capability` | The step needed a manual action in OpenL Studio |
| `other` | A workaround or friction not covered above |

Each item: category, source (`tooling` or the skill name and version),
what was requested, what happened, and the effect. Describe; never guess a
root cause unless marked "hypothesis". Never include request payloads, rule
values beyond the affected keys, client names, or credentials.

## Change log

Start the change log, and load `change-log-and-reapply`, only when one of
these holds:

- the user asks for it;
- the task is a Reapplication, a backport, or carries a change to another
  branch;
- the working state is expected to be replaced before the merge: a local
  workbook that will be refreshed from the repository, or another open
  branch or user known to edit the same workbooks, so a sync conflict is
  likely.

A durable location alone is not a trigger, and a domain catalog does not
turn the log on by default. Otherwise `plan.md` with the saved revision of
each item is the record: do not load `change-log-and-reapply`, and state
`Change log: not used — <reason>` in the plan.

## Conventions and patterns

Approval rules:

- **Exactly one approval to write**, given to the plan this skill presents. A
  domain catalog or mechanic skill called from this plan does not ask again
  for work the plan already covers.
- **Checks are not approvals.** Green tests, clean compilation, an accepted
  impact report, and a clean reapplication preflight are verified by the
  agent and recorded, not re-asked.
- **Existing test rows keep their own rule.** A plan item may change or
  remove an existing test row only if it names the Test table, the row's key,
  and the old and new expected value. Otherwise `testing` still requires its
  separate, named approval.
- **Gates with another approver become explicit plan items** marked ⏸ —
  for example a contract owner's sign-off or a domain expert's review. Work
  that depends on them waits.
- **New scope means a new approval.** Anything outside the approved list
  stops execution until the restated plan is approved.
- **`AGENTS.md` edits are plan items.** When a catalog's gate says the
  project file changes, that edit is a ⬜ item like any other.

## Audience

Load [references/audience.md](references/audience.md) before the first plan
message. Every user-facing message — plan, questions, status lines, blocked
report, existing-test approval, summary — is rendered in one of two views:

- **Business view** — product words only: field labels, displayed values,
  plan and operation names; one outcome line per item; technical **Ask**
  decisions in their own group with a "use recommended" reply; identifiers
  only on a `For the record:` line where an approval needs them.
- **Technical view** — the templates as written, plus the exact cell values
  of every behavior row the plan writes.

Choose without asking: an explicit request in the conversation, then a stated
user preference (never a project's `AGENTS.md`), then technical signals in the
user's own wording; unclear → technical. Name the view on the plan's first
line. A switch re-renders the message and needs no new approval. The view
never changes the items, their numbers, the one approval, or any safeguard;
`plan.md` is always technical, with each item's outcome line.

## Modes

Load [references/modes.md](references/modes.md) when one applies:

- **Local WebStudio** (local repository type): no branches and no Finish
  item; missing project guidance never blocks; `testing` reopens the local
  project and reports the local revision.
- **Resume** (continue an earlier task): read `plan.md`, check done items
  against the live project, continue from the first unmarked item.
- **Reapplication** (after a conflict, refresh, or for a backport):
  read-only preflight through `change-log-and-reapply`, then its own plan and
  approval.

## Code examples

Plan and summary templates and five worked plans (remote, local, bug fix,
drafted cases, business view): [references/reference.md](references/reference.md).

### Blocked report

When a step cannot continue, report in this shape and stop:

```text
BLOCKED at step <n> — <step name>
Project: <name> (<remote|local>)
Error: <exact tool error or observed state, one line>
Done so far: <completed items, or none>
Unsaved state: <yes/no and what>
Need from you: <one concrete choice — e.g. fix and retry, skip, or abort>
```

## Anti-patterns

- ❌ Any write, branch, change log, or save before approval — even one cell.
- ❌ Asking what the project's conventions or the domain catalog already
  answer.
- ❌ Asking questions in several messages, or after approval, when step 7
  could have asked them with the plan.
- ❌ Loading `change-log-and-reapply` when no [change log trigger](#change-log)
  holds.

## References

- [references/reference.md](references/reference.md) — plan and summary
  templates, the approval block, and worked examples: a remote change
  with an embedded catalog section, a local WebStudio change, a bug fix, and
  drafted test cases for confirmation, and the same plan in the business view.
- [references/audience.md](references/audience.md) — choosing the view,
  business and technical view rules, and message-by-message rendering.
- [references/modes.md](references/modes.md) — Local WebStudio, Resume, and
  Reapplication.

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
  version: "0.5.0"
---

# OpenL Change Planning

## Purpose

Turn an OpenL build, change, or fix request into one approved, ordered plan,
execute it through the skills that own each mechanic, verify it against real
test cases, and report back against every requirement. This skill owns the
requirements list, the plan, the approval, the tracking, and the summary. It
does not own domain editing order — a domain catalog skill supplies that —
and it does not own branching, testing, versioning, tracing, or change
logging mechanics.

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

- **Requirement** — one checkable result from the request, numbered R1…Rn
  with its source; test cases the user gave are requirements too.
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
| Requirements, one plan, one approval, tracking, the closing summary | Domain edit order and evidence → the installed domain catalog skill |
| When the change log starts; running a reapplication plan | Log, preflight, and replay mechanics → `change-log-and-reapply` |
| Which gates need another approver | Test mechanics → `testing`; version properties → `versioning` |
| Presentation: business or technical view of every user-facing message | Business vocabulary and item outcomes → the domain catalog |

Scope, tier, estimation, and story split belong to change-request analysis
upstream. If its handoff exists, plan from it; do not re-estimate.

## Workflow

1. **Understand the request.** Fetch a ticket in full through the connected
   tracker (summary, description, acceptance criteria, comments,
   attachments, samples). Read a spec in full. For a plain prompt, check it
   against the live project before assuming what is new. A wrong-result or
   bug request first delegates root cause to `trace-investigation`, then
   plans the fix. Redoing work after a merge conflict, refresh, or replaced
   local state → Reapplication; continuing an earlier task → Resume
   ([Modes](#modes)).
2. **Make the projects ready (startup, no approval needed).** List the
   projects and match the request to them; an ambiguous match is a scope
   question. Include every project the domain catalog declares as required
   (for example a shared library the target depends on). Open each one on
   its latest revision; open or initialize a missing, closed, or
   uninitialized one. Opening is not a rule change. If a required project
   cannot be opened, stop with a [blocked report](#blocked-report) — never
   plan against a partial set. An unsaved working copy found here is not
   saved or discarded before approval: report what it holds and which
   branch it belongs to, and make keeping or discarding it the first plan
   item. This rule takes precedence over any startup save rule of another
   skill.
3. **Detect the deployment mode.** Read the repository type of each target
   project: local, or a file-system repository without branch support (for
   example a mounted developer workspace) → local WebStudio mode
   ([Modes](#modes)); otherwise remote. Record the mode in the plan.
4. **List the requirements and the test cases.** Read
   [references/requirements.md](references/requirements.md) first. Number
   every requirement R1…Rn with its source, marking inferred ones
   `derived`; take the user's test cases with their expected values
   unchanged; give every requirement at least one case, drafting missing
   ones for confirmation — never invent expected values silently.
5. **Load the domain catalog.** If an installed catalog skill covers the
   project's domain (identified by the project's guidance or its
   structure, such as its dependencies on other projects), invoke that skill
   by name through the client's skill mechanism, the way a user would call
   it.
   Never open or read its `SKILL.md` as a file instead: its references and
   rules are then not loaded the way the skill expects. Take its change plan
   as the ordered domain items of this plan; never invent a domain's edit
   order. No catalog installed → plan from the project's own conventions and
   say so.
6. **Choose the view, then draft one plan.** Read
   [references/audience.md](references/audience.md) to choose the view and
   [references/reference.md](references/reference.md) for the plan template.
   In order: the requirements, context items (research, impact check, branch
   in remote mode, change log start only when a [trigger](#change-log)
   holds), the domain items, external gates, then the **test items last**
   (new test rows for the confirmed cases, one full test run) and the
   optional Finish item. Use a ⬜ checklist of concrete, verifiable items.
   Save the approved plan as `plan.md` for every task — in the change log
   folder when there is one, otherwise in `openl-change-log/<slug>/` of the
   user's working folder, under the location rules of
   `change-log-and-reapply`. Across several projects, use one branch name
   everywhere and list every identifier that must match exactly.
7. **Ask only what matters, all at once.** Follow
   [references/requirements.md](references/requirements.md) → Questions:
   catalog **Ask** decisions are always questions; the recommended option is
   the most conservative one; "keep as is" means a check only; an assumption
   that conflicts with the request is a question. Risks the catalog raises
   go in the plan's Risks group. Ask every question together with the plan:
   when the client offers a structured question dialog (multiple-choice
   answers), post the plan, then ask there — one question per decision, the
   plan's options as answers, the recommended option first and marked
   "(Recommended)"; split into several dialogs only when the questions do not
   fit the client's limit for one. Without such a dialog, put the questions
   in the plan message as text. After approval, ask again only when execution
   proves the plan wrong, never for something this step could have asked.
8. **Get one approval.** End the plan with the approval block from the
   template and stop. When the client offers a question dialog or a
   plan-approval mode, ask for the approval there, after the questions
   (answers: approve and execute / change the plan); otherwise the text block
   is the request. Approval is an explicit answer to that request — from the
   user, or from an agent the user has set up to answer for them (for
   example a requirements agent). Your own scheduled wake-ups, background
   task notifications, and tool results are never approval; neither is
   silence or an unrelated reply. If the answer edits scope, restate the plan
   and ask again.
9. **Track and execute.** Read [references/execution.md](references/execution.md)
   before the first write. Delegate each item to the skill that owns it;
   after each item read back, check compilation, and save; change nothing
   the items do not name; mark each verified item in `plan.md`. A plan that
   proves wrong is restated and approved again.
10. **Test, then summarize.** Add the test rows, save, then run the full
    suite once through `testing` as the last action on the project
    ([references/execution.md](references/execution.md) → Final test run).
    Close with the summary template: the requirements table (requirement →
    module / sheet / table / row key → tests, passed/total), then the items,
    the final run, state, changes outside the requirements, problems,
    assumptions, questions for the BA, and feedback items.
11. **Finish — offer the merge** (only when the plan has the Finish item and
    every condition in [references/execution.md](references/execution.md) →
    Finish holds). Never merge on your own initiative; on "yes", hand off to
    `branching`.
12. **Offer the feedback** (only when there are feedback items) and send it
    only after the user's "yes" ([references/execution.md](references/execution.md)
    → Feedback).

## Conventions and patterns

### Approval rules

- **Exactly one approval to write**, given to the plan this skill presents.
  A domain catalog or mechanic skill called from this plan does not ask
  again for work the plan already covers.
- **Checks are not approvals.** Green tests, clean compilation, an accepted
  impact report, and a clean reapplication preflight are verified and
  recorded, not re-asked.
- **Existing test rows keep their own rule.** A plan item may change or
  remove an existing test row only if it names the Test table, the row's
  key, and the old and new expected value; otherwise `testing` requires its
  separate, named approval.
- **Gates with another approver** become explicit plan items marked ⏸ (a
  contract owner's sign-off, a domain expert's review). Work that depends on
  them waits.
- **New scope means a new approval.** Anything outside the approved list
  stops execution until the restated plan is approved.
- **`AGENTS.md` edits are plan items** when a catalog's gate says the
  project file changes.

### Change log

Start the change log, and load `change-log-and-reapply`, only when one of
these holds:

- the user asks for it;
- the task is a Reapplication, a backport, or carries a change to another
  branch;
- the working state is expected to be replaced before the merge: a local
  workbook that will be refreshed from the repository, or another open
  branch or user known to edit the same workbooks.

A durable location alone is not a trigger, and a domain catalog does not
turn the log on by default. Otherwise `plan.md` with the saved revision of
each item is the record: state `Change log: not used — <reason>` in the
plan.

### Audience

Every user-facing message — plan, questions, status lines, blocked report,
existing-test approval, summary — is rendered in the **business view**
(product words, one outcome line per item, identifiers only on a
`For the record:` line) or the **technical view** (the templates as written,
plus the exact cells of every behavior row). Choose without asking: an
explicit request, then a stated user preference (never a project's
`AGENTS.md`), then technical signals in the user's wording; unclear →
technical. Name the view on the plan's first line. The view never changes
the items, their numbers, the one approval, or any safeguard; `plan.md` is
always technical. Rules: [references/audience.md](references/audience.md).

### Modes

Read [references/modes.md](references/modes.md) when one applies:

- **Local WebStudio** (local or branchless file-system repository): no
  branches and no Finish item; missing project guidance never blocks;
  generated files among the pending changes do not block a save;
  `testing` reopens the local project and reports the local revision.
- **Resume** (continue an earlier task): read `plan.md`, check done items
  against the live project, continue from the first unmarked item.
- **Reapplication** (after a conflict, refresh, or for a backport):
  read-only preflight through `change-log-and-reapply`, then its own plan
  and approval.

## Code examples

Plan and summary templates, a filled summary, and five worked plans
(remote, local, bug fix, drafted cases, business view):
[references/reference.md](references/reference.md).

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
  answer; asking in several rounds, or after approval, what step 7 could
  have asked (splitting one round over the dialog's per-call limit is fine).
- ❌ Treating your own scheduled wake-up, a background task's completion, or
  a tool result as the approval.
- ❌ Loading a domain catalog by reading its files instead of invoking the
  skill.
- ❌ Changing or dropping a test case the user gave to make the suite pass.
- ❌ Touching existing items the request keeps as they are, or making a
  change no requirement asks for without reporting it.
- ❌ Reporting a test run made before the last save, or ending a turn with
  unsaved work or background work still running.
- ❌ Loading `change-log-and-reapply` when no [change log trigger](#change-log)
  holds.

## References

- [references/requirements.md](references/requirements.md) — read at steps
  4 and 7: numbering requirements, user and drafted test cases, questions,
  assumptions, the recommended option, scope.
- [references/execution.md](references/execution.md) — read at step 9:
  executing items, save groups, the final test run, the closing summary, the
  merge offer, feedback.
- [references/reference.md](references/reference.md) — read at steps 6 and
  10: plan and summary templates, the approval block, worked examples.
- [references/audience.md](references/audience.md) — read before the first
  plan message: choosing the view and rendering each message.
- [references/modes.md](references/modes.md) — read when a mode applies:
  Local WebStudio, Resume, Reapplication.

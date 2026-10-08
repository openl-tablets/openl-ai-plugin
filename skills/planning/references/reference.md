# OpenL Change Planning — Templates and Worked Examples

## Contents

- Plan template and approval block
- Summary template
- Example 1 — Remote change with an embedded catalog section
- Example 2 — Local WebStudio change
- Example 3 — Bug fix that starts with diagnosis
- Example 4 — No test case given
- Example 5 — Example 1 in the business view

## Plan template

Post this before touching anything, whether the plan has one item or twenty.
Omit a group that has no items.

```text
View: <technical | business> — reply "<business view | technical view>" to switch.
Plan — <ticket or short task name>
Mode: <remote | local WebStudio>   Projects: <names>   Branch: <name | none (local)>

Ready: <projects opened at revision … | initialized>   (startup step, already done)

Context
⬜ 1. <research or diagnosis, if needed>
⬜ 2. <dependency impact check>
⬜ 3. <check for an existing branch, else create (remote) / none (local)>
⬜ 4. <start the change log — only when a change log trigger holds; else "Change log: not used — <reason>">

<Domain> change plan  (from <catalog skill>) — each item, or declared save group, saved after it is verified
⬜ 5. <domain item>
⬜ 6. <domain item>   [save group with 5 — <why they cannot compile separately>, only when needed]
⬜ 7. <AGENTS.md update, only when the catalog's gate says so>

External gates
⏸ 8. <gate — named approver>

Test (after all changes)
⬜ 9. <add test rows for the confirmed cases: C1..Cn>
⬜ 10. <run the full suite once on the saved revision; per-row detail for new/failing tables>

Finish (only when the task delivers to a base branch)
⬜ 11. <check dependent projects' suites, then ask to merge <task branch> → <base>; merge only on your "yes" (branching)>

Test cases (given, or drafted here for you to confirm)
- C1: <input> → <expected>

Open questions (only if any; every catalog "Ask" decision goes here, with its options and the recommended one)
- <question>

Risks (only if any; what the configuration cannot guarantee on its own)
- <risk>

Assumptions (only if any; only what no reviewer would decide differently)
- <assumption>

⛔ AWAITING APPROVAL — execution has NOT started.
Reply "proceed" to execute, or tell me what to adjust.
```

This is the technical view; behavior items also list the exact cells they
write. The business view
([audience.md](audience.md)) keeps the same groups and item numbers, renders
each item as its outcome line, and adds a "Technical questions" group when the
catalog tags an Ask decision `technical`.

**Finish group.** Include it in remote mode when the changes must reach a
base branch — the default for a remote task that changes OpenL. Omit it and
say why in one line when the mode is local ("No merge — local WebStudio"),
the user keeps the work on the task branch, or nothing in OpenL changes.
Approving the plan approves only asking; the merge waits for an explicit
"yes" after the summary.

The approval block is always the last two lines, verbatim. Opening the
projects happens before the plan (workflow step 2). Do not write, branch,
start a change log, or save until the user answers the block.

## Summary template

```text
Done — <task name>

- <item>: <what changed, one line>
- ...

Tests: <X/Y passed> on <project>, read from per-row detail.
Verification case: <input> → expected <…> → actual <…> — <match | mismatch>.
State: <branch and revision | local project saved at revision>.
Change log: <path | not used>.
Deviations from the plan: <none | what and why>.
Open problems: <none | problem — effect — decision needed, one per line>.
Feedback: <none | category — what happened, one per line>.

<plan has the Finish item:> Ready to merge this to <base branch>?
<feedback items:> Send the feedback to the OpenL team?
```

Business view of the summary:

```text
Done — <task name>

What the rules do now:
- <outcome, one line per item that changed behavior>

Acceptance criteria: <AC-1 proven, AC-2 proven, … | AC-n not proven — why>
Needs a decision: <none | decision>
Feedback for the OpenL team: <none | one line per item>
Full technical detail: plan.md and the technical summary (reply "technical view").

<plan has the Finish item:> Ready to publish this change to <base branch>?
<feedback items:> Send the feedback to the OpenL team?
```

---

## Example 1 — Remote change with an embedded catalog section

**User:** "Implement PROJ-1234 — add a Pro tier to Sample Rules."

**Understand.** Fetch the ticket: tier Pro, defaults for two fields, Gherkin
AC with one concrete case. Repository type: remote → remote mode.
`Sample Rules` depends on `Common Library`; the installed domain catalog
declares both as required. Another open branch also edits the tier tables,
so a sync conflict is likely: a change log trigger holds.

```text
Plan — PROJ-1234 Pro tier
Mode: remote   Projects: Sample Rules, Common Library (read-only)   Branch: PROJ-1234-pro-tier

Ready: Sample Rules and Common Library opened on their latest revisions

Context
⬜ 1. Dependency impact check for tier-scoped tables
⬜ 2. Check for an existing PROJ-1234 branch, else create PROJ-1234-pro-tier (branching)
⬜ 3. Start the change log for PROJ-1234 — another branch edits the tier tables (change-log-and-reapply)

<Domain> change plan  (from the domain catalog) — each item, or declared save group, saved after it is verified
⬜ 4. Register tier value Pro + its eligibility + messages
⬜ 5. Default rows for limitAmount and reviewDays at tier Pro

Test (after all changes)
⬜ 6. Add test rows C1–C3
⬜ 7. Run the full Sample Rules suite once; per-row detail for new/failing tables

Finish
⬜ 8. Check dependents' suites, then ask to merge PROJ-1234-pro-tier → development (branching)

Test cases
- C1 (from AC): tier Pro, region CA → limitAmount = 500
- C2 (drafted, please confirm): tier Pro → reviewDays default = 20
- C3 (drafted, please confirm): existing tier Plus → defaults unchanged

⛔ AWAITING APPROVAL — execution has NOT started.
Reply "proceed" to execute, or tell me what to adjust.
```

The catalog supplied items 4–5, their order, and C2–C3; this skill supplied
the rest. Neither the catalog nor `testing` asks for approval again.

---

## Example 2 — Local WebStudio change

**User:** "In my local WebStudio, add the review fields to Sample Rules."

**Startup.** `Sample Rules` is not initialized: initialize it and open
`Common Library` (workflow step 2). Repository type: local → local
WebStudio mode. Missing project guidance is reported, not a blocker.

```text
Plan — review fields
Mode: local WebStudio   Projects: Sample Rules, Common Library   Branch: none (local)

Ready: Sample Rules initialized, Common Library opened — both available

Context
⬜ 1. Start the change log (a local workbook can be refreshed from the repo)

<Domain> change plan — each item, or declared save group, saved after it is verified
⬜ 2. Register fields isReviewRequired, reviewDays
⬜ 3. Default and Min/Max rows for reviewDays

Test (after all changes)
⬜ 4. Add test rows C1–C2
⬜ 5. Close and reopen the local project, check compilation, run the full suite once

No merge — local WebStudio.

Test cases (drafted, please confirm)
- C1: tier Basic, review required → reviewDays default = 0
- C2: reviewDays = 45 → Min/Max validation error

Project documentation is missing for Sample Rules — tables are read from the live project.

⛔ AWAITING APPROVAL — execution has NOT started.
Reply "proceed" to execute, or tell me what to adjust.
```

If a required project cannot be opened, stop before any plan:

```text
BLOCKED at step 2 — make the projects ready
Project: Common Library (local)
Error: project not found in the local design repository
Done so far: Sample Rules initialized
Unsaved state: no
Need from you: import Common Library into the local WebStudio, then say "retry" — or "abort"
```

---

## Example 3 — Bug fix that starts with diagnosis

**User:** "Request #4471 got the wrong limitAmount — fix it."

Delegate root cause to `trace-investigation`. Suppose a wildcard column sits
before the specific Pro column, so the fallback shadows the tier value.
Expected 500 vs actual 1000 is the verification case.

```text
Plan — fix limitAmount default for Pro
Mode: remote   Projects: Sample Rules, Common Library (read-only)   Branch: fix-pro-default-precedence-20261001
Ready: both projects opened on their latest revisions

⬜ 1. Check for an existing branch for this fix, else create it (branching)
⬜ 2. Move the Pro column before its wildcard column; save
⬜ 3. (after the fix) Regression test row for request #4471 inputs, expecting 500
⬜ 4. Run the full suite once on the saved revision
⬜ 5. Check dependents' suites, then ask to merge the fix branch → development (branching)

Change log: not used — single-item fix, no refresh or parallel edit expected

⛔ AWAITING APPROVAL — execution has NOT started.
Reply "proceed" to execute, or tell me what to adjust.
```

---

## Example 4 — No test case given

**User:** "Eligibility for the Pro tier must follow the attached spec for New York."

The spec is prose only: draft cases and ask for confirmation inside the plan
message. Never use a drafted case as proof until it is confirmed:

```text
Plan — Pro tier eligibility for NY
...
Test cases (drafted from the spec, please confirm or correct)
- C1: region NY, authority level 1 → Pro is eligible
- C2: region NY, authority level 0 → Pro is not eligible
- C3: region CA → Pro eligibility unchanged

⛔ AWAITING APPROVAL — execution has NOT started.
Reply "proceed" to execute, or tell me what to adjust.
```

---

## Example 5 — Example 1 in the business view

**User:** "PROJ-1234: we need a Pro tier. Limit 500, review period 20 days."
The wording names no table or cell, so the business view applies.

```text
View: business — reply "technical view" for tables, cells, and expressions.
Plan — PROJ-1234 Pro tier (Sample Rules)
Changes are made in a separate working copy (PROJ-1234-pro-tier) and published only after you agree.

Preparation
⬜ 1. Check what else reuses the tier settings
⬜ 2. Create the separate working copy
⬜ 3. Start the change record, so the work can be redone after a conflict

Changes — each step is checked and saved before the next one
⬜ 4. Pro becomes a selectable tier, with its display name
⬜ 5. Pro pre-fills Limit with 500 and Review Days with 20

Checks (after all changes)
⬜ 6. Add the checks below as automated tests
⬜ 7. Run every test once

Publish
⬜ 8. Check what reuses these settings, then ask before publishing to development

Scenarios
- C1 (from the ticket): Pro, California → Limit pre-filled with 500
- C2 (drafted, please confirm): Pro → Review Days pre-filled with 20
- C3 (drafted, please confirm): Plus → pre-filled values unchanged

⛔ AWAITING APPROVAL — execution has NOT started.
Reply "proceed" to execute, or tell me what to adjust.
```

Items 1–8 are Example 1's items with the same numbers; the approval covers the
technical plan, which is saved to `plan.md`.

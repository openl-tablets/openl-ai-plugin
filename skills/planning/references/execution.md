# Execution, final test run, and closing

Read this at workflow step 9, before the first write, and keep it for
steps 10–12.

## Contents

- [Executing the approved items](#executing-the-approved-items)
- [When a write or save fails](#when-a-write-or-save-fails)
- [Final test run](#final-test-run)
- [Closing summary](#closing-summary)
- [Finish: the merge offer](#finish-the-merge-offer)
- [Feedback](#feedback)

## Executing the approved items

- Keep the approved list visible; never silently add, drop, or reorder
  items. Delegate each item to the skill that owns it.
- **After each item:** read back the changed rows, check compilation, then
  save — in remote and local mode alike. Mark the verified item in
  `plan.md` at once, so the task can be resumed.
- **Save groups.** Dependent structural items that cannot compile one at a
  time (for example a new dimension across model datatypes, scope helpers,
  and result constructors) are declared in the plan as one save group with
  its reason. Read back each item as it is written; check compilation and
  save once, at the end of the group. Never group independent items to
  postpone a save.
- **Formulas.** Write a cell value that starts with `=` with a leading
  apostrophe (`'= true`, `'= getBoolean(...)`), so it is stored as text,
  not as a spreadsheet formula.
- **Before each save**, confirm that the pending changes hold only files
  this item wrote and, in remote mode, that the branch has no revision newer
  than the one the item started from; otherwise stop and ask, as `testing`
  describes in its pre-test sequence. In local mode, sort the pending list
  as [modes.md → Local WebStudio mode](modes.md#local-webstudio-mode)
  describes.
- **No test rows or test runs between changes.**
- **Change nothing the approved items do not name**, even a technical detail
  of a row being edited. A change that turns out to be unavoidable is
  recorded at once and reported in the summary as a change outside the
  requirements.
- **Feedback** items are recorded the moment they happen
  ([Feedback](#feedback)).
- **End a turn** only at an item boundary, with nothing unsaved and no
  background work you started still running — sub-agents, background tasks,
  scheduled wake-ups: wait for it and use its result, or stop it, first.
- **The plan proves wrong or incomplete** (for example a new dimension
  turns out to be needed): stop, restate the changed plan, and get approval
  again.

## When a write or save fails

A write **failed** when the tool returns an error, and also when it reports
success but the read-back cannot find the table or the row, shows other
rows changed, or compilation shows errors that were not there before the
item.

1. Stop writing. Read the project status and its compilation messages.
2. Restore the last saved state: discard the unsaved changes. Every earlier
   item is already saved, so only this item's write is lost. If something
   else is pending that this task did not write, ask first.
3. Retry the same write once only if the failure may be transient (timeout,
   lost connection, a project that was not open). A failure that repeats
   with the same result is a tool defect, not a reason to try another way.
4. Never switch to a write path the plan does not name: rewriting a whole
   table to remove one row, blanking cells instead of deleting, uploading
   an edited file, editing the workbook outside Studio. Such a path is a
   restated plan item with its risk, approved again.
5. Stop with the [blocked report](../SKILL.md#blocked-report): the exact
   request, the response, the compilation message, and the restored state.
   Offer concrete choices: a fix of the tool and retry; the user makes this
   one edit in OpenL Studio and the task verifies it and continues; or skip
   the item and report the requirement as not done. Record a `tool_error`
   or `unexpected_result` feedback item.

A **save** that times out or returns an error may still have been applied.
Read the project status and the latest revision before anything else: a
revision with this item's comment and nothing pending means the save
succeeded. Repeat a save only when that check shows it did not happen.

## Final test run

1. After the last change, add the new test rows for the confirmed cases,
   save, then run the full suite once through `testing` and read the results
   as it prescribes.
2. The final full run is the last action on the project. Anything saved
   after it — a fix, a test row, a project-guidance file — needs another
   full run; the summary reports only the last run on the last saved
   revision.
3. A failure is classified by `testing`. A fix inside an approved item is
   verified, saved, and the suite re-run once; a fix outside the plan needs
   a restated plan.
4. A test case the user gave keeps its expected value. If it fails, it is a
   problem and a question for the BA.
5. A green suite alone does not close the task if a confirmed case was not
   checked. Check every requirement R1…Rn and every confirmed case against
   the readback and test evidence, and close any gap inside the approved
   items now: a gap the user's review finds costs another round-trip.

## Closing summary

Use the summary template in `references/reference.md`, in this order:

1. The requirements table: each requirement → module / sheet / table / row
   key → its test rows, passed/total. Every requirement gets a row, also
   those checked only or not done.
2. One line per item.
3. Totals of the final run, the verification result, the branch or local
   project state, the change log location.
4. Changes outside the requirements; deviations from the plan.
5. Problems (unresolved findings, requirements not done, evidence not
   proven, failing user cases), then assumptions, then questions for the BA.
   An assumption that turns out to conflict with the request moves to the
   questions. Never leave one only in `plan.md`.
6. Feedback items.

## Finish: the merge offer

Only when the plan has the Finish item. Offer it only when all hold: 0
failures on the saved revision, every confirmed case checked, nothing
unsaved, no open conflict, every ⏸ gate closed, no deviation awaiting a
decision; otherwise report what is missing instead. Name the target branch
in the question. Never merge or sync on your own initiative; on "yes", hand
off to `branching`. Mark the item done only after the merge is confirmed on
the target; on "no", leave it unmarked with the reason.

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

After the summary, list the items and ask whether to send them to the
OpenL team. On "yes", send each through the OpenL server's feedback channel
when it offers one; otherwise give one ready-to-send text. Never send
without that "yes".

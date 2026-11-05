# Requirements, test cases, and questions

Read this at workflow step 4, before listing requirements, and again at
step 7, before writing the plan's questions and assumptions.

## Contents

- [Numbering the requirements](#numbering-the-requirements)
- [Test cases](#test-cases)
- [Questions, assumptions, and the recommended option](#questions-assumptions-and-the-recommended-option)
- [Scope: what the plan may change](#scope-what-the-plan-may-change)

## Numbering the requirements

- Number every requirement R1…Rn, whatever form the request takes: an
  acceptance criteria block, Gherkin, bullets, prose, comments, attachments.
- Give each its source: `AC-2`, `description`, `comment <author, date>`,
  `<attachment name>`.
- One requirement is one checkable result. Split a sentence that holds two.
- Missing acceptance criteria is an open question, never something to
  invent.
- Mark a requirement inferred from the description rather than stated as
  `derived — <where it is inferred from>`.
- A statement that cannot be turned into a checkable result is a question
  for the BA, never a guess.
- The list goes into the plan for approval and into the closing summary's
  requirements table, with the same numbers.

## Test cases

A test case is a concrete input and expected output, linked to the
requirement it proves (`C1 (R1, …)`).

- **Cases the user gave** — in the request, the ticket, or an attachment —
  are requirements too. List them with their inputs and expected values
  exactly as given; they must be green at the end. A given case that the
  rules cannot satisfy as written is a question for the BA, never an
  expected value to change.
- **Every requirement needs at least one case**, configuration changes
  included. A requirement that no test can prove is listed as "not testable
  — <why>".
- **Missing cases are drafted** from the domain catalog's evidence
  scenarios (Gherkin), marked "drafted, please confirm", and confirmed with
  the plan. Never invent an expected value silently; never use a drafted
  case as proof before it is confirmed.

## Questions, assumptions, and the recommended option

- Ask only what matters: genuine ambiguity, a decision expensive to
  reverse, data that cannot be inferred, and confirmation of drafted cases.
- A decision a domain catalog marks **Ask** is always an open question, even
  when one answer looks better. State the options and mark the recommended
  one.
- **The recommended option is the most conservative one** — the one that
  changes least beyond the requirements.
- An assumption is only something no reasonable reviewer would decide
  differently. An assumption that conflicts with the request's wording or
  with a requirement is a question, not an assumption.
- Ask every question together with the plan — in the client's question
  dialog when it has one (workflow step 7), otherwise as text in the plan
  message.

## Scope: what the plan may change

- When the request says existing items stay as they are, plan a read-back
  check of them, never a change.
- A change the requirements do not ask for — even a technical one, such as
  re-storing a value in another type or normalizing a neighbor's label —
  is either left out or asked as a question with "leave as is"
  recommended.

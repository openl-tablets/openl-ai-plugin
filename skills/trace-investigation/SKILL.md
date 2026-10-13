---
name: trace-investigation
description: >
  OpenL rule result investigation — traces a rule run over OpenL MCP, names
  the root cause, and proposes the minimal fix. Use when the user asks why
  OpenL produced an unexpected result — a wrong premium or amount, a null or
  blank value, a rejected claim, a rule that fired or was skipped incorrectly
  — or pastes a rule input payload for explanation, or asks to fix a dispatch
  table or a rule row.
---

# Investigate an OpenL rule result

## Purpose

Investigate OpenL Tablets rule execution outcomes over the OpenL MCP server that this
plugin registers. Supports business users, BAs, and developers. Always lead with root
cause and fix — trace detail follows. Adapt depth and language to the audience (infer
from phrasing, never ask).

The trace tools require a connected Studio: if they fail with 401, run the
`connect` skill first.

## When to use

- Why OpenL produced an unexpected result: a wrong premium or amount, a null or
  blank value, a rejected claim, a rule that fired or was skipped incorrectly.
- A pasted rule input payload to explain, or a dispatch table or rule row to fix.

## Key concepts

### Output order — always follow this sequence

1. **ROOT CAUSE** — one short paragraph, plain business language, no table IDs
   or formula syntax. State what produced the wrong outcome and why.
2. **SUGGESTED FIX** — concrete and minimal. Name the table, row/condition, and
   corrected logic. Offer to apply directly if the user is a developer or BA. For
   business users, describe in business terms and note it requires a dev team.
3. **SUPPORTING EVIDENCE** — trace summary and table data proving the root
   cause. Depth varies by audience: business users get a plain summary;
   developers get the full trace tree, formulas, and table data.

Never reverse this order.

### Tone and depth by audience

Infer from how the question is phrased — do not ask the user:

- *"Why was my claim rejected?" / "Why is the premium wrong?"* → plain language,
  no table names or formulas, actionable next step for the business.
- *"Trace this for [product]" / "What's wrong with [table]?"* → root cause +
  fix + summary trace, table names included.
- *"Why is [factor] null?" / "Can you fix the dispatch table?"* → full trace
  tree, formula text, lookup data, offer to apply the fix.

### Root cause taxonomy

Always classify the root cause — the fix differs by type:

| Type | Description | Fix |
|---|---|---|
| **MISSING DATA** | Lookup table exists but has no row for this input | Add data row or reroute |
| **WRONG ROUTING** | Dispatch table sends input to a table that doesn't cover this case | Update dispatch condition |
| **MISSING RULE** | No row in a decision table covers this scenario | Add a rule row |
| **FORMULA BUG** | Formula references wrong field or applies wrong operation | Correct the formula |
| **INPUT MISSING/MALFORMED** | Required input field missing or contains an unexpected value | Fix on calling system side |
| **UPSTREAM MAPPING DEFECT** | Trace ran cleanly, formula picked a valid branch, but the JSON delivered data that does not represent UI entry (dual-encoded fields, scale errors, phantom fields, inverted flags, mis-mapped enums) | Primary fix in the mapping layer; consider a defensive guard in the OpenL formula |

## Workflow

### Phase 0 — Understand the problem

Always identify the expected vs actual outcome before tracing. Common issue types:

- Result is null/blank when a value was expected
- Calculation produced a wrong number
- Decision table returned an unexpected result or no result
- A rule was skipped or matched incorrectly
- A validation fired when it should not, or did not fire when it should
- Result is mathematically correct given the inputs, but the inputs do not
  represent what was entered on the upstream UI (mapping or integration defect)

If the user provides a **ticket number from a tracking system (like Jira)**,
fetch it first via the issue tracker MCP tool (if connected) to understand full
context before doing anything else.

If the problem description is unclear, ask **one** clarifying question: what
was the expected outcome and what was the actual outcome?

### Phase 1 — Identify the project and entry point

**Step 1: Find the right project.** List the available OpenL projects and match
by product keyword from the user's description (e.g. "Personal Pet", "STD",
"Claims", "Group Dental", "Offering"). If ambiguous, list candidates and ask the
user to confirm.

Open the project before tracing — trace calls run against an open project session —
and load the project's agent context if the server offers it: it carries the
project's own conventions.

**Step 2: Find the entry point table.** Entry points are tables exposed as API
endpoints. To identify them:

1. Look for a `rules.xml` file containing an **Included Methods** RegExp
   pattern — tables whose names match are exposed as endpoints.
2. List the tables in the project and find candidates based on the user's
   problem context — the entry point name typically reflects the product or
   operation described. Common naming patterns include `Determine*`,
   `Calculate*`, `Process*`, `Rate*`, but match by context first, not by name.
3. **Match against the user's input structure**: read the top-level parameter
   types of each candidate (from the table signature). Compare against keys in
   the user's JSON. E.g. if input has a `policy` object and the signature is
   `DeterminePolicyPremium(Policy policy)` → strong match.
4. If multiple candidates match, use problem context to disambiguate (premium
   → rating entry point; claim decision → claims entry point).
5. If still ambiguous, ask the user to confirm.

### Phase 2 — Run the trace

The OpenL MCP server ships two generations of trace tools, and which one is
available depends on the server version behind this plugin. **Check the tool list
first**, then follow the matching path in
[references/trace-tools.md](references/trace-tools.md) — Path A when
`openl_get_trace_nodes` is present (tree trace), Path B when `openl_step_trace` /
`openl_watch_trace_cells` are present (interactive debugger; prefer it whenever
it is there). Never call a tool that is not there, and never fall back to
reading tables by hand instead of tracing.

Both paths take the user's JSON wrapped as shown in
[Code examples](#code-examples) (include `runtimeContext` only if the rule needs
it — e.g. `lob`, `usState`, effective date; omit it otherwise). The param name
comes from the entry point table's signature. For a test table, pass test ranges
(e.g. `1-3,5`) instead of input JSON.

If the trace won't start (404, other errors) or the run ends in `error`, follow
[references/trace-tools.md → When a trace won't start](references/trace-tools.md#when-a-trace-wont-start).
Whatever the cause, do NOT quietly fall back to reading tables by hand and
presenting that as a trace result. Say the trace could not run.

### Phase 3 — Analyse the trace

The trace reflects exactly what the engine executed. Analyse in light of the
reported problem — do not look only for exceptions. Open
[references/root-cause-catalog.md](references/root-cause-catalog.md) and follow
the section for the issue type from Phase 0 — error or exception, null or blank
result, wrong calculation, technically correct but not the intended scenario
(upstream mapping), wrong decision or rule match. Then classify the result with
the [root cause taxonomy](#root-cause-taxonomy).

When a failing table calls into a shared library or another project, follow
[references/root-cause-catalog.md → Cross-project dependency](references/root-cause-catalog.md#cross-project-dependency)
and report the root cause at the dependency level, not the caller level.

### Phase 4 — Propose and apply the fix

State the minimum change needed. Reference the specific table, row, condition,
or formula to change. Do not propose restructuring tables unnecessarily.

If the user is a **developer or BA**: offer to apply the fix directly by
updating the affected table or creating a new one in the project. **Never
apply without explicit user confirmation.**

An edit lands in the project's working copy; saving turns the working copy into **one
revision of the whole project** with a required comment — it is not a per-table commit.
So before saving:

1. Read the project status and look at its pending changes.
2. If everything pending is your own fix, save with a comment naming the table and the
   root cause.
3. If anything else is pending — earlier edits, another agent's work in this session —
   list those changes to the user and get a separate confirmation that they should go
   into the same revision. Never fold unrelated pending work into your revision
   silently; leaving the fix unsaved is the better default.
4. Projects from the `local` repository cannot be opened or saved through these tools.
   There, state plainly that the change stays in the working copy and who has to commit
   it.

If the user is a **business user**: describe the fix in business terms and
note it requires a development team action.

If the root cause is `UPSTREAM MAPPING DEFECT`, the fix has two sides — the
primary fix in the caller and an optional defensive guard in OpenL; follow
[references/root-cause-catalog.md → Fixing an upstream mapping defect](references/root-cause-catalog.md#fixing-an-upstream-mapping-defect)
and name the owning team(s) for each side.

After a confirmed fix, suggest filing a ticket in the tracking system (like
Jira) if a bug or data gap was found — see [Code examples](#code-examples).

## Code examples

Trace input wrapper (Phase 2):
```json
{ "params": { "<paramName>": <value> }, "runtimeContext": { "<key>": <value> } }
```
Suggested ticket after a confirmed fix (Phase 4):
> "Suggest filing: `AgeFactor dispatch table missing cat rows for MixedBreed —
>   causes null premium for mixed-breed cats`"

## Anti-patterns

- ❌ Never ask the user to find the project or table themselves if they haven't provided it.
- ❌ Never call a trace tool that this server does not expose — check the tool list and follow the matching path in Phase 2.
- ❌ Never conclude a root cause without reading the actual table formula first.
- ❌ Never assume data is missing from a lookup without reading the full table.
- ❌ Never treat all nulls as errors — check whether null is the intended result.
- ❌ Never conclude an OpenL bug when the trace ran cleanly and the formula picked a valid branch without first checking whether the input JSON faithfully represents the UI entry.
- ❌ Never apply a fix in OpenL Studio without explicit user confirmation.
- ❌ Never save a project without checking what else is pending in its working copy — a save is one revision of the whole project.
- ❌ Never export a full trace on your own initiative, and never treat it as shareable: it carries the input payload, runtime context, and results.
- ❌ Never read "not in `profile.hotspots`" or "not in a watch series" as proof that a table or factor is fine — both are capped samples.
- ❌ Never expose internal table IDs or system URLs in business user outputs.
- ❌ Never skip running a trace and rely solely on manual table reading to determine the root cause.

## References

- [references/trace-tools.md](references/trace-tools.md) — Path A (tree trace) and Path B (interactive debugger) step by step, trace export rules.
- [references/root-cause-catalog.md](references/root-cause-catalog.md) — analysis per issue type, including input-integrity smells and the arithmetic-identity check for upstream mapping defects.

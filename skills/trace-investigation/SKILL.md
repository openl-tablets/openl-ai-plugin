---
name: trace-investigation
description: This skill should be used when the user asks why OpenL produced an unexpected result — a wrong premium or amount, a null or blank value, a rejected claim, a rule that fired or was skipped incorrectly — or pastes a rule input payload for explanation, or asks to fix a dispatch table or a rule row.
---

# Investigate an OpenL rule result

Investigate OpenL Tablets rule execution outcomes over the OpenL MCP server that this
plugin registers. Supports business users, BAs, and developers. Always lead with root
cause and fix — trace detail follows. Adapt depth and language to the audience (infer
from phrasing, never ask).

The trace tools require a connected Studio: if they fail with 401, run the
[`connect`](../connect/SKILL.md) skill first.

---

## Output order — always follow this sequence

1. **ROOT CAUSE** — one short paragraph, plain business language, no table IDs
   or formula syntax. State what produced the wrong outcome and why.
2. **SUGGESTED FIX** — concrete and minimal. Name the table, row/condition, and
   corrected logic. Offer to apply directly if the user is a developer or BA. For
   business users, describe in business terms and note it requires a dev team.
3. **SUPPORTING EVIDENCE** — trace summary and table data proving the root
   cause. Depth varies by audience: business users get a plain summary;
   developers get the full trace tree, formulas, and table data.

Never reverse this order.

---

## Tone and depth by audience

Infer from how the question is phrased — do not ask the user:

- *"Why was my claim rejected?" / "Why is the premium wrong?"* → plain language,
  no table names or formulas, actionable next step for the business.
- *"Trace this for [product]" / "What's wrong with [table]?"* → root cause +
  fix + summary trace, table names included.
- *"Why is [factor] null?" / "Can you fix the dispatch table?"* → full trace
  tree, formula text, lookup data, offer to apply the fix.

---

## Phase 0 — Understand the problem

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

---

## Phase 1 — Identify the project and entry point

### Step 1: Find the right project

List the available OpenL projects and match by product keyword from the user's
description (e.g. "Personal Pet", "STD", "Claims", "Group Dental", "Offering").
If ambiguous, list candidates and ask the user to confirm.

Open the project before tracing — trace calls run against an open project session —
and load the project's agent context if the server offers it: it carries the
project's own conventions.

### Step 2: Find the entry point table

Entry points are tables exposed as API endpoints. To identify them:

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

---

## Phase 2 — Run the trace

The OpenL MCP server ships two generations of trace tools, and which one is
available depends on the server version behind this plugin. **Check the tool list
first**, then follow the matching path — never call a tool that is not there, and
never fall back to reading tables by hand instead of tracing.

Both paths take the user's JSON wrapped as (include `runtimeContext` only if the
rule needs it — e.g. `lob`, `usState`, effective date; omit it otherwise):

```json
{ "params": { "<paramName>": <value> }, "runtimeContext": { "<key>": <value> } }
```

The param name comes from the entry point table's signature. For a test table, pass
test ranges (e.g. `1-3,5`) instead of input JSON.

### Path A — tree trace (`openl_get_trace_nodes` is present)

This is the surface of the server version this plugin pins.

1. `openl_start_trace` with the project, the entry point table, and the wrapped
   input. It returns immediately — the run is asynchronous.
2. `openl_get_trace_nodes` **once**, without a node id, for the root nodes. It waits
   for the run to finish server-side (no polling, no retrying on 409). Pass the same
   table id if a different process started the trace.
3. Walk down by passing a `nodeId` to get that node's children. Follow the branch
   that leads to the reported problem — the failing calculation, the decision table,
   the factor that came back null — instead of expanding everything.
4. `openl_get_trace_node_details` on the interesting node for its parameters,
   runtime context, result, and error. `openl_get_trace_parameter` resolves a
   parameter whose value arrived lazy (`lazy: true` with a `parameterId`).
5. Ask for exact values when the numbers matter: `showRealNumbers: true` keeps full
   precision, and `response_format: "json"` avoids a prettified summary.
6. `openl_cancel_trace` aborts a run that is taking too long.

Node details are the default way to read values. `openl_export_trace` dumps the **whole**
run as plain text — every parameter, runtime context, and result along the way, which for
a policy or claim payload means personal data and the full business logic. Do not export
to "have the trace handy", and never hand the dump to the user as a shareable artifact on
your own initiative: ask for the specific node instead. Export only when the user asks
for a complete trace, say what it contains before producing it, quote just the lines that
carry the evidence, and use `release: true` so the trace does not sit in server memory.

### Path B — interactive debugger (`openl_step_trace` / `openl_watch_trace_cells` present)

A newer server replaces the tree tools with a debugger. Prefer it when available.

1. Start with a whole-run profiling pass: `openl_start_trace` with
   `stopAtEntry: false`, `profiling: true` and an explicit `breakpoints: []`. The
   breakpoint set is only replaced when you send one, so omitting it keeps the previous
   session's breakpoints and the "single call" run stops somewhere unexpected. The run
   returns a constant-size `profile` — `hotspots` (slowest tables by
   selfMillis/totalMillis/count) plus `nodeCount`/`distinctTables`/`totalMillis`. Add
   `includeTree: true` to browse structure, and walk deeper levels with
   `openl_expand_trace_tree`.
2. Scan `profile.hotspots` for the table relevant to the problem — the hot table, or
   one that ran an unexpected number of times. Treat this as a **sample, not an
   inventory**: `hotspots` ranks by time and holds only the top N (backend default 20,
   raise it with `profileTop`), so a fast table that returns a wrong value may not
   appear at all. If the table you suspect from Phase 1 is missing, go to it directly
   with a watch or a breakpoint instead of concluding it is innocent — and check
   `profile.truncated` and a node's `notRetained`, which mark a tree the server cut at
   its size limit.
3. `openl_watch_trace_cells` returns one series per named cell across the whole run,
   so a single call shows a factor's value in every coverage/iteration. Find the
   outlier (e.g. `83.372` among `1.0`s). Compare each series' length with the `total`
   execution count it reports: the server caps points per series, so a shorter series
   means later executions are not in front of you — narrow the run or break into the
   later instances before calling a factor clean.
4. Replay into the offending pass: restart with a breakpoint built from the outlier's
   `ref` and `instance` — `<ref>@<instance>`, where `@N` targets the N-th execution
   (a plain cell breakpoint stops on every pass). Send neither input nor test ranges
   on the replay; the previous run's input is remembered.
5. Inspect the suspended frame with `openl_inspect_trace_frame`: parameters, runtime
   context, computed step values, and — for a decision table — which rule fired and
   how each condition evaluated. `excludeStepValues: [1]` hides neutral rating
   factors (lazy values are resolved before the comparison, so lazily-arriving
   neutral factors are filtered too). `openl_get_trace_value` expands a lazy value.
6. `openl_step_trace` with `type: "out"` runs the current frame to its own exit so
   its result is inspectable — the main step for declarative rules;
   `"into"`/`"over"` are for imperative TBasic and loops. `openl_resume_trace` runs
   to the next breakpoint, exception, or completion.
7. `openl_stop_trace` when the investigation is done.

### When a trace won't start

- **404** — read the message the backend returned before deciding. The usual cause is a
  stale project session: open the project and retry once. It can also mean an id that no
  longer resolves (table ids change when an edit relocates a table), a project that is
  not in the list at all, or a Studio without that trace endpoint. Re-list the projects
  and tables to re-resolve both ids, and retry with the fresh ones.
- **Still failing after opening the project and re-resolving the ids** — stop, report the
  exact error message and which of the causes above you ruled out, and suggest filing a
  bug against the OpenL MCP server.
- Whatever the cause: do NOT quietly fall back to reading tables by hand and presenting
  that as a trace result. Say the trace could not run.
- **The run ends in `error`** — the failing frame carries a structured error with the
  table, step, and exception. That is usually the root-cause pointer.

---

## Phase 3 — Analyse the trace

The trace reflects exactly what the engine executed. Analyse in light of the
reported problem — do not look only for exceptions.

### Issue: error or exception

An exception surfaces at the throwing frame before it propagates — read that frame's
parameters and step values right there; the structured `error` names the failing
table, step, and exception type. Read the actual table formula directly from the
project — **never infer it**.

### Issue: null or blank result

Null can be a legitimate result (a rule row intentionally returns null, or no
row matched). Do not assume null is always a bug.

- Find where in the trace the value first became null.
- Read the formula or decision table that produced it.
- Read the **full** relevant lookup table to check whether the input combination
  has a matching row — do not assume it is missing.
- Determine: is null expected (no match by design) or unexpected (missing data,
  wrong routing, missing rule row)?

### Issue: wrong calculation

- Find the cell or rule that produced the unexpected value.
- Read its formula.
- Trace back through inputs — identify which factor, rate, or condition
  contributed the wrong value.
- Read the relevant lookup tables to confirm what was returned and why.

### Issue: result is technically correct but doesn't match the intended scenario

The trace runs cleanly, the formula picks a valid branch, and the math is
internally consistent — yet the result is wrong because the input JSON does
not faithfully represent what was entered on the upstream UI. Suspect this
when:

- The result is off by an order of magnitude (10×, 100×, 1/10×, 1/100×).
- A regression mismatch is segment-specific (e.g. child rate wrong, adult
  rate fine), pointing to one branch of the formula firing on bad input.
- The JSON contains fields that look contradictory, redundant, or impossible
  given what the user describes entering on the UI.

Before concluding "OpenL bug", scan the input JSON for **integrity smells**:

- **Dual-encoded fields** — the same business concept sent two ways at once
  (e.g. both `benefitAmount` and `benefitPercentage` for one benefit). The
  formula's branch-selector silently picks one; if that branch was never
  the user's intent, the result is mathematically correct but conceptually
  wrong.
- **Scale errors** — a percentage arriving as `10` when the formula expects
  `0.1`; a basis-point field arriving as a decimal. Multiply the suspect
  field by the obvious scale factor and check whether the wrong answer
  matches the expected one.
- **Phantom fields** — values present in JSON for inputs the user says they
  never entered. Usually from default values, stale offer config, or a
  mapping layer that always emits the field.
- **Inverted booleans or mis-mapped enums** — `true` where `false` was
  intended, or an enum value that routes to the wrong branch.
- **Effective-date drift** — the JSON's effective date routes the trace to
  a module revision the user did not expect.

Then confirm the **arithmetic identity** from the trace: which branch fired,
what value it used, which constant or sub-formula it applied. If the wrong
result equals what a different input value would have produced via a
different branch, that is the smoking gun (e.g. `100/250 = 0.4` is identical
to what `benefitPercentage = 0.10` would yield via `0.10 × 1000 / 250`).

To confirm the upstream defect, request from the user any of:

- UI screenshot of the field(s) in question
- Product model definition (which fields exist, whether mutually exclusive)
- Offer configuration (defaults, hidden fields, conditional show/hide rules)
- Mapping layer rules that build this part of the JSON

If these aren't provided, do not block — state mapping is the suspected
layer based on the JSON evidence and the arithmetic identity, and request
the artifacts to confirm.

### Issue: wrong decision or rule match

- Find the decision table node in the trace.
- Check which condition matched and which rule was returned.
- Read the full decision table to understand all conditions.
- Determine whether the wrong row fired or the right row is missing.

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

---

## Phase 4 — Propose and apply the fix

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

### When the bug is upstream (mapping or integration)

If the root cause is `UPSTREAM MAPPING DEFECT`, the fix has two sides:

- **Primary** — the caller (UI, integration layer, or mapping rules) must
  stop sending data that misrepresents the UI entry. This is where the bug
  actually lives.
- **Defensive (optional)** — the OpenL formula can be hardened to reject
  contradictory inputs (e.g. reject when both `$` and `%` are non-zero for
  the same benefit) or to document which branch wins. This is a guardrail,
  not the fix.

Name the owning team(s) for each side. Do not draft tickets unless asked —
just state ownership and the nature of each fix clearly.

After a confirmed fix, suggest filing a ticket in the tracking system (like
Jira) if a bug or data gap was found:
> "Suggest filing: `AgeFactor dispatch table missing cat rows for MixedBreed —
>   causes null premium for mixed-breed cats`"

---

## Cross-project dependency pattern

When a failing table calls into a shared library or another project:

1. Note the dependency reference in the table formula.
2. Locate the dependency project from the list of available projects.
3. Repeat Phase 3 in the dependency project.
4. Report root cause at the dependency level, not the caller level.

**Common pattern**: Rating or processing projects often depend on shared library
projects. The failure appears in the calling project but the missing data or
rule is in the shared library.

---

## What you must never do

- Never ask the user to find the project or table themselves if they haven't provided it.
- Never call a trace tool that this server does not expose — check the tool list and follow the matching path in Phase 2.
- Never conclude a root cause without reading the actual table formula first.
- Never assume data is missing from a lookup without reading the full table.
- Never treat all nulls as errors — check whether null is the intended result.
- Never conclude an OpenL bug when the trace ran cleanly and the formula picked a valid branch without first checking whether the input JSON faithfully represents the UI entry.
- Never apply a fix in OpenL Studio without explicit user confirmation.
- Never save a project without checking what else is pending in its working copy — a save is one revision of the whole project.
- Never export a full trace on your own initiative, and never treat it as shareable: it carries the input payload, runtime context, and results.
- Never read "not in `profile.hotspots`" or "not in a watch series" as proof that a table or factor is fine — both are capped samples.
- Never expose internal table IDs or system URLs in business user outputs.
- Never skip running a trace and rely solely on manual table reading to determine the root cause.
